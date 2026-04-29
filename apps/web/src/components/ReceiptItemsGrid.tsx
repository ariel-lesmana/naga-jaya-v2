'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Pencil, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { replaceReceiptItems, updateProduct } from '@/lib/api';
import {
  PRICE_FIELD,
  Receipt,
  ReceiptItem,
  ReceiptItemInput,
  ReceiptItemProduct,
  ReceiptUnit,
  RECEIPT_UNITS,
} from '@/lib/types';
import { ProductTypeahead } from './ProductTypeahead';
import { ProductEditDrawer } from './ProductEditDrawer';
import { ProductCreateModal } from './ProductCreateModal';
import { ReceiptNotesModal } from './ReceiptNotesModal';

interface GridRow {
  key: string;
  id: number | null;
  quantity: string;
  unit_type: ReceiptUnit | '';
  product: ReceiptItemProduct | null;
  discount_per_unit: string;
  line_total_override: string;
  notes: string;
}

function genKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyRow(): GridRow {
  return {
    key: genKey(),
    id: null,
    quantity: '',
    unit_type: '',
    product: null,
    discount_per_unit: '',
    line_total_override: '',
    notes: '',
  };
}

function fromServer(item: ReceiptItem): GridRow {
  return {
    key: String(item.id),
    id: item.id,
    quantity: item.quantity != null ? String(item.quantity) : '',
    unit_type: item.unit_type ?? '',
    product: item.product,
    discount_per_unit:
      item.discount_per_unit != null && item.discount_per_unit !== 0
        ? String(item.discount_per_unit)
        : '',
    line_total_override:
      item.line_total_override != null ? String(item.line_total_override) : '',
    notes: item.notes ?? '',
  };
}

function toPayload(row: GridRow, index: number): ReceiptItemInput {
  return {
    id: row.id ?? undefined,
    product_id: row.product?.id ?? null,
    quantity: row.quantity.trim() === '' ? null : Number(row.quantity),
    unit_type: row.unit_type === '' ? null : row.unit_type,
    discount_per_unit:
      row.discount_per_unit.trim() === '' ? 0 : Number(row.discount_per_unit),
    line_total_override:
      row.line_total_override.trim() === ''
        ? null
        : Number(row.line_total_override),
    notes: row.notes.trim() === '' ? null : row.notes.trim(),
    position: index,
  };
}

function effectivePrice(row: GridRow, snapshot: number | null): number | null {
  if (snapshot != null) return snapshot;
  if (!row.product || !row.unit_type) return null;
  return row.product[PRICE_FIELD[row.unit_type]] ?? null;
}

const fmt = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('id-ID').format(n);

interface Props {
  receipt: Receipt;
  readOnly?: boolean;
}

export function ReceiptItemsGrid({ receipt, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const snapshotMap = useRef<Map<number, number | null>>(new Map());

  const syncSnapshots = useCallback((items: ReceiptItem[]) => {
    const m = new Map<number, number | null>();
    for (const it of items) m.set(it.id, it.price_snapshot);
    snapshotMap.current = m;
  }, []);

  const [rows, setRows] = useState<GridRow[]>(() => {
    syncSnapshots(receipt.items);
    const mapped = receipt.items.map(fromServer);
    return mapped.length ? mapped : [emptyRow()];
  });

  useEffect(() => {
    syncSnapshots(receipt.items);
    const byId = new Map(receipt.items.map((i) => [i.id, i]));
    setRows((prev) =>
      prev.map((r) => {
        if (r.id == null) return r;
        const fresh = byId.get(r.id);
        if (!fresh) return r;
        const sameProduct =
          JSON.stringify(r.product) === JSON.stringify(fresh.product);
        if (sameProduct) return r;
        return { ...r, product: fresh.product };
      }),
    );
  }, [receipt.id, receipt.items, syncSnapshots]);

  const lastSavedRef = useRef<string>(JSON.stringify(rows.map(toPayload)));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<GridRow[] | null>(null);
  const inFlightRef = useRef(false);
  const flushRef = useRef<() => void>(() => {});

  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    rowKey: string;
    name: string;
    unit: ReceiptUnit | null;
  } | null>(null);

  const updatePriceMut = useMutation({
    mutationFn: (args: {
      productId: number;
      field: keyof ReceiptItemProduct;
      value: number | null;
    }) => updateProduct(args.productId, { [args.field]: args.value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-search'] });
      toast.success('Harga produk diperbarui');
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal update harga'),
  });

  function commitPrice(r: GridRow) {
    const draft = priceEdits[r.key];
    if (draft === undefined) return;
    const clear = () =>
      setPriceEdits((p) => {
        const n = { ...p };
        delete n[r.key];
        return n;
      });
    if (!r.product || !r.unit_type) {
      clear();
      return;
    }
    const trimmed = draft.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && Number.isNaN(value)) {
      clear();
      return;
    }
    const field = PRICE_FIELD[r.unit_type];
    const current = r.product[field] as number | null;
    if (value === current) {
      clear();
      return;
    }
    updatePriceMut.mutate({ productId: r.product.id, field, value });
    clear();
  }

  const saveMut = useMutation({
    mutationFn: (items: ReceiptItemInput[]) =>
      replaceReceiptItems(receipt.id, items),
    onMutate: () => {
      inFlightRef.current = true;
    },
    onSuccess: (data) => {
      syncSnapshots(data.items);
      setRows((prev) => {
        const serverById = new Map(data.items.map((i) => [i.position, i]));
        return prev.map((r, idx) => {
          if (r.id != null) return r;
          const srv = serverById.get(idx);
          if (!srv) return r;
          return { ...r, id: srv.id, key: String(srv.id) };
        });
      });
      queryClient.setQueryData(['receipt', receipt.id], data);
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Gagal menyimpan');
    },
    onSettled: () => {
      inFlightRef.current = false;
      flushRef.current();
    },
  });

  const flushSave = useCallback(() => {
    if (inFlightRef.current) return;
    const next = pendingRef.current;
    if (!next) return;
    const payload = next.map(toPayload);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = null;
    lastSavedRef.current = serialized;
    saveMut.mutate(payload);
  }, [saveMut]);

  flushRef.current = flushSave;

  const queueSave = useCallback(
    (next: GridRow[]) => {
      if (readOnly) return;
      pendingRef.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, 1000);
    },
    [readOnly, flushSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r));
      queueSave(next);
      return next;
    });
  }

  function addRow() {
    setRows((prev) => {
      const next = [...prev, emptyRow()];
      queueSave(next);
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      const safe = next.length ? next : [emptyRow()];
      queueSave(safe);
      return safe;
    });
  }

  const totalsAll = rows.reduce(
    (acc, r) => {
      const snap = r.id != null ? snapshotMap.current.get(r.id) ?? null : null;
      const price = effectivePrice(r, snap);
      const qty = r.quantity.trim() === '' ? 0 : Number(r.quantity);
      const disc =
        r.discount_per_unit.trim() === '' ? 0 : Number(r.discount_per_unit);
      const override =
        r.line_total_override.trim() === ''
          ? null
          : Number(r.line_total_override);
      const lineTotal = (price ?? 0) * qty;
      const lineDisc =
        override ?? Math.max(0, (price ?? 0) - disc) * qty;
      acc.total += lineTotal;
      acc.totalDisc += lineDisc;
      return acc;
    },
    { total: 0, totalDisc: 0 },
  );

  return (
    <div className="print-area border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left">
            <tr>
              <th className="px-3 py-2 w-20">Qty</th>
              <th className="px-3 py-2 w-28">Satuan</th>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2 w-32 text-right">Harga</th>
              <th className="px-3 py-2 w-28 text-right print:hidden">Diskon/unit</th>
              <th className="px-3 py-2 w-32 text-right print:hidden">Total</th>
              <th className="px-3 py-2 w-36 text-right print:hidden">
                Total Setelah Diskon
              </th>
              <th
                colSpan={2}
                className="hidden print:table-cell px-3 py-2 text-right"
              >
                Subtotal
              </th>
              <th className="px-3 py-2 w-20 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const snap =
                r.id != null ? snapshotMap.current.get(r.id) ?? null : null;
              const price = effectivePrice(r, snap);
              const qty = r.quantity.trim() === '' ? 0 : Number(r.quantity);
              const disc =
                r.discount_per_unit.trim() === ''
                  ? 0
                  : Number(r.discount_per_unit);
              const total = (price ?? 0) * qty;
              const computedDisc = Math.max(0, (price ?? 0) - disc) * qty;
              const hasOverride = r.line_total_override.trim() !== '';
              const priceMissing =
                r.product && r.unit_type && price == null;

              return (
                <tr key={r.key} className="border-t border-border">
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      value={r.quantity}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateRow(r.key, { quantity: e.target.value })
                      }
                      className="w-full px-2 py-1 bg-transparent outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.unit_type}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateRow(r.key, {
                          unit_type: e.target.value as ReceiptUnit | '',
                        })
                      }
                      className="w-full px-2 py-1 bg-transparent outline-none"
                    >
                      <option value="">—</option>
                      {RECEIPT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <div className="print:hidden">
                      {readOnly ? (
                        <span>{r.product?.name ?? '—'}</span>
                      ) : (
                        <ProductTypeahead
                          value={r.product}
                          onPick={(p) => updateRow(r.key, { product: p })}
                          onCreate={(q) =>
                            setCreating({
                              rowKey: r.key,
                              name: q,
                              unit: r.unit_type === '' ? null : r.unit_type,
                            })
                          }
                          onEnter={addRow}
                        />
                      )}
                      {readOnly ? (
                        r.notes.trim() !== '' && (
                          <p className="px-2 py-0.5 text-xs text-muted italic truncate">
                            {r.notes}
                          </p>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingNotesKey(r.key)}
                          className={`mt-0.5 inline-flex items-center gap-1 max-w-full px-2 py-1 rounded border text-xs ${
                            r.notes.trim() !== ''
                              ? 'border-border bg-bg text-text'
                              : 'border-dashed border-border text-muted hover:bg-bg'
                          }`}
                          title={
                            r.notes.trim() !== ''
                              ? 'Edit catatan'
                              : 'Tambah catatan'
                          }
                        >
                          <StickyNote size={12} className="shrink-0" />
                          <span className="truncate italic">
                            {r.notes.trim() !== '' ? r.notes : '+ Catatan'}
                          </span>
                        </button>
                      )}
                    </div>
                    <span className="hidden print:inline">
                      {r.product?.name ?? '—'}
                      {r.notes.trim() !== '' ? ` — ${r.notes.trim()}` : ''}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      disabled={
                        readOnly ||
                        !r.product ||
                        !r.unit_type ||
                        r.id == null ||
                        snapshotMap.current.get(r.id) != null
                      }
                      value={
                        priceEdits[r.key] ?? (price != null ? String(price) : '')
                      }
                      placeholder={
                        !r.product || !r.unit_type ? '—' : 'Belum di-set'
                      }
                      onChange={(e) =>
                        setPriceEdits((p) => ({
                          ...p,
                          [r.key]: e.target.value,
                        }))
                      }
                      onBlur={() => commitPrice(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className={`w-full px-2 py-1 bg-transparent outline-none text-right tabular-nums print:hidden ${
                        priceMissing ? 'text-red-600' : ''
                      }`}
                      title={
                        priceMissing
                          ? 'Harga belum di-set, isi untuk update produk'
                          : 'Edit harga jual produk'
                      }
                    />
                    <span className="hidden print:inline tabular-nums">
                      {price != null ? `Rp ${fmt(price)}` : '—'}
                    </span>
                  </td>
                  <td className="px-2 py-1 print:hidden">
                    <input
                      type="number"
                      min={0}
                      value={r.discount_per_unit}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateRow(r.key, {
                          discount_per_unit: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 bg-transparent outline-none text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums print:hidden">
                    {fmt(price != null ? total : null)}
                  </td>
                  <td className="px-2 py-1 print:hidden">
                    <input
                      type="number"
                      min={0}
                      value={r.line_total_override}
                      disabled={readOnly}
                      placeholder={
                        price != null ? String(computedDisc) : '—'
                      }
                      onChange={(e) =>
                        updateRow(r.key, {
                          line_total_override: e.target.value,
                        })
                      }
                      className={`w-full px-2 py-1 bg-transparent outline-none text-right tabular-nums font-medium ${
                        hasOverride ? 'text-amber-600' : ''
                      }`}
                      title={
                        hasOverride
                          ? 'Manual override — kosongkan untuk pakai hitungan otomatis'
                          : 'Isi untuk override total setelah diskon'
                      }
                    />
                  </td>
                  <td
                    colSpan={2}
                    className="hidden print:table-cell px-2 py-1 text-right tabular-nums font-medium"
                  >
                    {(() => {
                      const eff = hasOverride
                        ? Number(r.line_total_override)
                        : price != null
                        ? computedDisc
                        : null;
                      return eff != null ? `Rp ${fmt(eff)}` : '—';
                    })()}
                  </td>
                  <td className="px-2 py-1 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      {r.product && !readOnly && (
                        <button
                          onClick={() => setEditingProductId(r.product!.id)}
                          className="p-1 rounded hover:bg-bg"
                          title="Edit produk"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => removeRow(r.key)}
                          className="p-1 rounded hover:bg-bg"
                          title="Hapus baris"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-bg">
              <td colSpan={5} className="px-3 py-2 text-right font-medium">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums print:hidden">
                {fmt(totalsAll.total)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold print:hidden">
                {fmt(totalsAll.totalDisc)}
              </td>
              <td
                colSpan={2}
                className="hidden print:table-cell px-3 py-2 text-right tabular-nums font-semibold"
              >
                Rp {fmt(totalsAll.totalDisc)}
              </td>
              <td className="print:hidden"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!readOnly && (
        <div className="px-3 py-2 border-t border-border flex items-center gap-2 text-sm no-print">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-bg"
          >
            <Plus size={14} /> Tambah baris
          </button>
          <span className="text-muted text-xs">
            {saveMut.isPending
              ? 'Menyimpan…'
              : saveMut.isError
              ? 'Gagal simpan'
              : 'Tersimpan otomatis'}
          </span>
        </div>
      )}
      {editingProductId != null && (
        <ProductEditDrawer
          productId={editingProductId}
          receiptQueryKey={['receipt', receipt.id]}
          onClose={() => setEditingProductId(null)}
        />
      )}
      {creating != null && (
        <ProductCreateModal
          initialName={creating.name}
          initialUnit={creating.unit}
          onClose={() => setCreating(null)}
          onCreated={(p) => updateRow(creating.rowKey, { product: p })}
        />
      )}
      {editingNotesKey != null &&
        (() => {
          const row = rows.find((r) => r.key === editingNotesKey);
          if (!row) return null;
          return (
            <ReceiptNotesModal
              initialValue={row.notes}
              productName={row.product?.name ?? null}
              onClose={() => setEditingNotesKey(null)}
              onSave={(v) => updateRow(row.key, { notes: v })}
            />
          );
        })()}
    </div>
  );
}
