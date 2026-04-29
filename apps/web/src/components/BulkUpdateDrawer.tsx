'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, bulkUpdateProducts } from '@/lib/api';
import { ProductResponse, UpdateProductDto } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { toast } from 'sonner';

const BELI_FIELDS = [
  { key: 'harga_per_pcs', label: 'Harga Per Pcs' },
  { key: 'harga_per_lusin', label: 'Harga Per Lusin' },
  { key: 'harga_per_pak', label: 'Harga Per Pak' },
  { key: 'harga_per_kotak', label: 'Harga Per Kotak' },
  { key: 'harga_per_karton', label: 'Harga Per Karton' },
  { key: 'harga_net', label: 'Harga Net' },
  { key: 'harga_daftar', label: 'Harga Daftar' },
  { key: 'harga', label: 'Harga Umum' },
] as const;

const JUAL_FIELDS = [
  { key: 'harga_jual', label: 'Harga Jual / Pcs' },
  { key: 'harga_jual_per_lusin', label: 'Harga Jual Per Lusin' },
  { key: 'harga_jual_per_pak', label: 'Harga Jual Per Pak' },
  { key: 'harga_jual_per_kotak', label: 'Harga Jual Per Kotak' },
  { key: 'harga_jual_per_karton', label: 'Harga Jual Per Karton' },
] as const;

const ALL_FIELDS = [...BELI_FIELDS, ...JUAL_FIELDS] as const;
type FieldKey = (typeof ALL_FIELDS)[number]['key'];

const FIELD_LABEL: Record<FieldKey, string> = ALL_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: f.label }),
  {} as Record<FieldKey, string>,
);

type Step = 'pick' | 'edit' | 'preview';

interface Props {
  open: boolean;
  brandId: number | undefined;
  brandName: string | undefined;
  onClose: () => void;
}

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function BulkUpdateDrawer({ open, brandId, brandName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('pick');
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  // edits keyed by product id, then field key. Values are strings from inputs.
  const [edits, setEdits] = useState<Record<number, Partial<Record<FieldKey, string>>>>({});
  const [bulkErrors, setBulkErrors] = useState<Record<number, string>>({});
  const cellRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-bulk-update', brandId],
    queryFn: () =>
      getProducts({ brand_id: brandId, limit: 1000, sort_by: 'name', sort_dir: 'asc' }),
    enabled: open && brandId !== undefined,
  });

  const products = useMemo(() => productsData?.data ?? [], [productsData]);
  const fieldList = useMemo(
    () => ALL_FIELDS.filter((f) => selectedFields.has(f.key)),
    [selectedFields],
  );

  const mutation = useMutation({
    mutationFn: bulkUpdateProducts,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-bulk-update'] });
      queryClient.invalidateQueries({ queryKey: ['product-history'] });
      queryClient.invalidateQueries({ queryKey: ['history-summary'] });
      if (result.errors === 0) {
        toast.success(`${result.updated} produk diperbarui`);
        handleClose();
        return;
      }

      toast.error(
        `${result.updated} berhasil, ${result.errors} gagal — perubahan yang sukses sudah tersimpan, perbaiki yang gagal lalu terapkan ulang`,
      );

      const failedIds = new Set<number>();
      const errs: Record<number, string> = {};
      result.results.forEach((r) => {
        if (!r.success) {
          failedIds.add(r.id);
          errs[r.id] = r.error ?? 'Gagal';
        }
      });

      setEdits((prev) => {
        const next: typeof prev = {};
        for (const key of Object.keys(prev)) {
          const id = Number(key);
          if (failedIds.has(id)) next[id] = prev[id];
        }
        return next;
      });
      setBulkErrors(errs);
      setStep('edit');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = useCallback(() => {
    setStep('pick');
    setSelectedFields(new Set());
    setEdits({});
    setBulkErrors({});
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  function toggleField(key: FieldKey) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateCell(productId: number, field: FieldKey, value: string) {
    setEdits((prev) => {
      const row = { ...(prev[productId] ?? {}) };
      row[field] = value;
      return { ...prev, [productId]: row };
    });
    setBulkErrors((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function currentValue(p: ProductResponse, field: FieldKey): string {
    const override = edits[p.id]?.[field];
    if (override !== undefined) return override;
    const v = p[field];
    return v != null ? String(v) : '';
  }

  function originalValue(p: ProductResponse, field: FieldKey): number | null {
    const v = p[field];
    return v != null ? v : null;
  }

  // Build list of changes to preview/submit. A change = edited cell whose new value differs from original.
  const changes = useMemo(() => {
    const items: {
      product: ProductResponse;
      field: FieldKey;
      oldValue: number | null;
      newValue: number | null;
    }[] = [];
    products.forEach((p) => {
      const row = edits[p.id];
      if (!row) return;
      (Object.keys(row) as FieldKey[]).forEach((field) => {
        if (!selectedFields.has(field)) return;
        const newVal = numOrNull(row[field] ?? '');
        const oldVal = originalValue(p, field);
        if (newVal === oldVal) return;
        items.push({ product: p, field, oldValue: oldVal, newValue: newVal });
      });
    });
    return items;
  }, [edits, products, selectedFields]);

  const changedProductIds = useMemo(
    () => new Set(changes.map((c) => c.product.id)),
    [changes],
  );

  function handleApply() {
    const byProduct = new Map<number, UpdateProductDto>();
    changes.forEach((c) => {
      const existing = byProduct.get(c.product.id) ?? {};
      (existing as Record<string, number | null>)[c.field] = c.newValue;
      byProduct.set(c.product.id, existing);
    });
    const payload = Array.from(byProduct.entries()).map(([id, patch]) => ({ id, patch }));
    if (payload.length === 0) {
      toast.error('Tidak ada perubahan');
      return;
    }
    mutation.mutate(payload);
  }

  function handleKeyDown(
    rowIdx: number,
    colIdx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setStep('preview');
      return;
    }
    const lastCol = fieldList.length - 1;
    const lastRow = products.length - 1;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        if (colIdx < lastCol) cellRefs.current[rowIdx]?.[colIdx + 1]?.focus();
        else if (rowIdx < lastRow) cellRefs.current[rowIdx + 1]?.[0]?.focus();
      } else {
        if (colIdx > 0) cellRefs.current[rowIdx]?.[colIdx - 1]?.focus();
        else if (rowIdx > 0) cellRefs.current[rowIdx - 1]?.[lastCol]?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx < lastRow) cellRefs.current[rowIdx + 1]?.[colIdx]?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < lastRow) cellRefs.current[rowIdx + 1]?.[colIdx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) cellRefs.current[rowIdx - 1]?.[colIdx]?.focus();
    }
  }

  function setCellRef(el: HTMLInputElement | null, rowIdx: number, colIdx: number) {
    if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = [];
    cellRefs.current[rowIdx][colIdx] = el;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-bg w-full max-w-[1400px] m-4 rounded-xl border border-border flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div>
            <h2 className="font-semibold text-lg">Bulk Update Harga</h2>
            <p className="text-xs text-muted mt-0.5">
              Brand: <span className="text-text">{brandName ?? '—'}</span> ·{' '}
              {products.length} produk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StepIndicator step={step} />
            <button
              onClick={handleClose}
              aria-label="Tutup"
              className="p-2.5 rounded-lg hover:bg-bg transition-colors text-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted">Memuat produk...</div>
          ) : step === 'pick' ? (
            <FieldPicker
              selected={selectedFields}
              onToggle={toggleField}
              disabled={products.length === 0}
            />
          ) : step === 'edit' ? (
            <EditGrid
              products={products}
              fields={fieldList}
              currentValue={currentValue}
              originalValue={originalValue}
              onChange={updateCell}
              onKeyDown={handleKeyDown}
              setCellRef={setCellRef}
              bulkErrors={bulkErrors}
            />
          ) : (
            <DiffPreview changes={changes} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between">
          <div className="text-xs text-muted">
            {step === 'pick' && selectedFields.size > 0 && (
              <span>{selectedFields.size} field dipilih</span>
            )}
            {step === 'edit' && (
              <span>
                {changedProductIds.size} produk diubah · {changes.length} perubahan
              </span>
            )}
            {step === 'preview' && <span>{changes.length} perubahan siap diterapkan</span>}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'pick' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'edit' : 'pick')}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-bg transition-colors disabled:opacity-40"
              >
                Kembali
              </button>
            )}
            {step === 'pick' && (
              <button
                onClick={() => setStep('edit')}
                disabled={selectedFields.size === 0 || products.length === 0}
                className="bg-text text-surface px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Lanjut ke Edit
              </button>
            )}
            {step === 'edit' && (
              <button
                onClick={() => setStep('preview')}
                disabled={changes.length === 0}
                className="bg-text text-surface px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Preview ({changes.length})
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleApply}
                disabled={mutation.isPending || changes.length === 0}
                className="bg-text text-surface px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {mutation.isPending
                  ? 'Menerapkan...'
                  : `Terapkan ${changes.length} perubahan`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'pick', label: '1. Pilih Field' },
    { key: 'edit', label: '2. Edit' },
    { key: 'preview', label: '3. Preview' },
  ];
  return (
    <div className="hidden md:flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-2">
          <span
            className={
              s.key === step
                ? 'text-text font-medium'
                : 'text-muted'
            }
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted">→</span>}
        </span>
      ))}
    </div>
  );
}

function FieldPicker({
  selected,
  onToggle,
  disabled,
}: {
  selected: Set<FieldKey>;
  onToggle: (k: FieldKey) => void;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <div className="p-8 text-center text-muted">
        Brand ini belum punya produk.
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <p className="text-sm text-muted">
        Pilih field harga yang mau diubah. Kolom-kolom ini akan muncul sebagai cell yang bisa
        diedit di langkah berikutnya, pre-filled dengan nilai sekarang.
      </p>
      <FieldGroup title="Harga Beli" fields={BELI_FIELDS} selected={selected} onToggle={onToggle} />
      <FieldGroup title="Harga Jual" fields={JUAL_FIELDS} selected={selected} onToggle={onToggle} />
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  selected,
  onToggle,
}: {
  title: string;
  fields: readonly { key: FieldKey; label: string }[];
  selected: Set<FieldKey>;
  onToggle: (k: FieldKey) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {fields.map((f) => {
          const checked = selected.has(f.key);
          return (
            <label
              key={f.key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? 'border-text bg-surface'
                  : 'border-border hover:bg-surface'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(f.key)}
                className="accent-text"
              />
              <span className="text-sm">{f.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function EditGrid({
  products,
  fields,
  currentValue,
  originalValue,
  onChange,
  onKeyDown,
  setCellRef,
  bulkErrors,
}: {
  products: ProductResponse[];
  fields: readonly { key: FieldKey; label: string }[];
  currentValue: (p: ProductResponse, f: FieldKey) => string;
  originalValue: (p: ProductResponse, f: FieldKey) => number | null;
  onChange: (id: number, f: FieldKey, v: string) => void;
  onKeyDown: (rowIdx: number, colIdx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  setCellRef: (el: HTMLInputElement | null, r: number, c: number) => void;
  bulkErrors: Record<number, string>;
}) {
  return (
    <div className="p-4">
      <p className="text-xs text-muted mb-3">
        Tab / Shift+Tab navigasi · Enter/↓ turun baris · ↑ naik baris · Ctrl+Enter preview
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="text-sm border-collapse" style={{ minWidth: 'max-content' }}>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border">
              <th className="sticky left-0 z-20 bg-surface px-3 py-2 text-left text-xs font-medium text-muted w-64">
                Produk
              </th>
              {fields.map((f) => (
                <th
                  key={f.key}
                  className="px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap w-36"
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? 'bg-surface' : 'bg-bg';
              const err = bulkErrors[p.id];
              return (
                <tr key={p.id} className={rowBg}>
                  <td
                    className={`sticky left-0 z-10 ${rowBg} px-3 py-1 w-64`}
                    title={err ? `${p.name} — ${err}` : p.name}
                  >
                    <div className="truncate font-medium text-sm">{p.name}</div>
                    {err && (
                      <p className="text-[10px] text-red truncate mt-0.5">Gagal: {err}</p>
                    )}
                  </td>
                  {fields.map((f, colIdx) => {
                    const val = currentValue(p, f.key);
                    const orig = originalValue(p, f.key);
                    const numVal = val.trim() ? Number(val) : null;
                    const changed =
                      (numVal === null ? null : isNaN(numVal) ? null : numVal) !== orig;
                    return (
                      <td key={f.key} className="px-1 py-1 w-36">
                        <input
                          ref={(el) => setCellRef(el, rowIdx, colIdx)}
                          type="number"
                          inputMode="numeric"
                          value={val}
                          onChange={(e) => onChange(p.id, f.key, e.target.value)}
                          onKeyDown={(e) => onKeyDown(rowIdx, colIdx, e)}
                          placeholder={orig != null ? String(orig) : '—'}
                          className={`w-full px-2 py-2 rounded-lg border bg-transparent text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2 ${
                            changed ? 'border-text' : 'border-border'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffPreview({
  changes,
}: {
  changes: {
    product: ProductResponse;
    field: FieldKey;
    oldValue: number | null;
    newValue: number | null;
  }[];
}) {
  if (changes.length === 0) {
    return <div className="p-8 text-center text-muted">Tidak ada perubahan.</div>;
  }
  return (
    <div className="p-6">
      <p className="text-sm text-muted mb-4">
        Tinjau perubahan sebelum diterapkan. Nilai yang dihapus akan jadi kosong (—).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Produk</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Field</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Lama</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted w-10"></th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Baru</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={`${c.product.id}-${c.field}`} className={i % 2 === 0 ? 'bg-surface' : 'bg-bg'}>
                <td className="px-3 py-2 font-medium truncate max-w-xs" title={c.product.name}>
                  {c.product.name}
                </td>
                <td className="px-3 py-2 text-muted text-xs">{FIELD_LABEL[c.field]}</td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-dm-mono)] text-muted">
                  {c.oldValue != null ? formatIDR(c.oldValue) : '—'}
                </td>
                <td className="px-3 py-2 text-center text-muted">→</td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-dm-mono)] font-semibold">
                  {c.newValue != null ? formatIDR(c.newValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
