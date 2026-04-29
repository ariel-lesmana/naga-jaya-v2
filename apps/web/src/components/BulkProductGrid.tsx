'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { bulkCreateProducts, checkProductDuplicates } from '@/lib/api';
import { Brand, CreateProductDto, DuplicateMatch } from '@/lib/types';
import { toast } from 'sonner';

type BulkRow = {
  id: string;
  name: string;
  brand_id: string;
  harga_gross: string;
  disc_pct: string;
  harga_per_pcs: string;
  harga_per_lusin: string;
  harga_per_pak: string;
  harga_per_kotak: string;
  harga_per_karton: string;
  harga_net: string;
  harga_daftar: string;
  harga: string;
  harga_jual: string;
  harga_jual_per_lusin: string;
  harga_jual_per_pak: string;
  harga_jual_per_kotak: string;
  harga_jual_per_karton: string;
};

type RowErrors = Partial<Record<keyof Omit<BulkRow, 'id'>, string>>;

const EDITABLE_COLS: (keyof Omit<BulkRow, 'id'>)[] = [
  'name', 'brand_id',
  'harga_gross', 'disc_pct',
  'harga_per_pcs', 'harga_per_lusin', 'harga_per_pak', 'harga_per_kotak', 'harga_per_karton',
  'harga_net', 'harga_daftar', 'harga',
  'harga_jual', 'harga_jual_per_lusin', 'harga_jual_per_pak', 'harga_jual_per_kotak', 'harga_jual_per_karton',
];
const LAST_COL = EDITABLE_COLS.length - 1;

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEmptyRow(): BulkRow {
  return {
    id: genId(),
    name: '', brand_id: '',
    harga_gross: '', disc_pct: '',
    harga_per_pcs: '', harga_per_lusin: '', harga_per_pak: '', harga_per_kotak: '', harga_per_karton: '',
    harga_net: '', harga_daftar: '', harga: '',
    harga_jual: '', harga_jual_per_lusin: '', harga_jual_per_pak: '', harga_jual_per_kotak: '', harga_jual_per_karton: '',
  };
}

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

interface Props {
  brands: Brand[];
  onSuccess: () => void;
}

export default function BulkProductGrid({ brands, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: 5 }, makeEmptyRow));
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const cellRefs = useRef<(HTMLElement | null)[][]>([]);
  const pendingSubmitRef = useRef<BulkRow[]>([]);

  const [debouncedRows, setDebouncedRows] = useState<BulkRow[]>(rows);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRows(rows), 300);
    return () => clearTimeout(t);
  }, [rows]);

  const dupQueries = useQueries({
    queries: debouncedRows.map((r) => {
      const trimmed = r.name.trim();
      return {
        queryKey: ['product-duplicates', r.brand_id, trimmed.toLowerCase()],
        queryFn: () =>
          checkProductDuplicates({ brand_id: Number(r.brand_id), name: trimmed }),
        enabled: Boolean(r.brand_id) && trimmed.length >= 2,
        staleTime: 30_000,
      };
    }),
  });
  const dupByRowId: Record<string, DuplicateMatch[]> = {};
  debouncedRows.forEach((r, i) => {
    const data = dupQueries[i]?.data;
    if (data?.matches?.length) dupByRowId[r.id] = data.matches;
  });

  const mutation = useMutation({
    mutationFn: bulkCreateProducts,
    onSuccess: (result) => {
      if (result.errors === 0) {
        toast.success(`${result.inserted} produk berhasil ditambahkan`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        onSuccess();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.error(`${result.inserted} berhasil, ${result.errors} gagal — baris yang sukses dihapus, perbaiki yang gagal lalu simpan ulang`);

      const succeededIds = new Set<string>();
      const failedErrors: Record<string, RowErrors> = {};
      result.results.forEach((r) => {
        const rowId = pendingSubmitRef.current[r.index]?.id;
        if (!rowId) return;
        if (r.success) succeededIds.add(rowId);
        else failedErrors[rowId] = { name: r.error };
      });

      setRows((prev) => {
        const remaining = prev.filter((r) => !succeededIds.has(r.id));
        return remaining.length > 0 ? remaining : [makeEmptyRow()];
      });
      setRowErrors(failedErrors);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateRow = useCallback((id: string, field: keyof Omit<BulkRow, 'id'>, value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setRowErrors((prev) => {
      if (!prev[id]?.[field]) return prev;
      const updated = { ...prev[id] };
      delete updated[field as keyof RowErrors];
      return { ...prev, [id]: updated };
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, makeEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  function handleKeyDown(rowIdx: number, colIdx: number, e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        if (colIdx < LAST_COL) {
          cellRefs.current[rowIdx]?.[colIdx + 1]?.focus();
        } else {
          if (rowIdx === rows.length - 1) {
            addRow();
            setTimeout(() => cellRefs.current[rowIdx + 1]?.[0]?.focus(), 0);
          } else {
            cellRefs.current[rowIdx + 1]?.[0]?.focus();
          }
        }
      } else {
        if (colIdx > 0) {
          cellRefs.current[rowIdx]?.[colIdx - 1]?.focus();
        } else if (rowIdx > 0) {
          cellRefs.current[rowIdx - 1]?.[LAST_COL]?.focus();
        }
      }
    }

    if (e.key === 'Enter' && colIdx === LAST_COL) {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRow();
        setTimeout(() => cellRefs.current[rowIdx + 1]?.[LAST_COL]?.focus(), 0);
      } else {
        cellRefs.current[rowIdx + 1]?.[LAST_COL]?.focus();
      }
    }
  }

  function isRowEmpty(row: BulkRow): boolean {
    return EDITABLE_COLS.every((col) => !row[col]);
  }

  function validate(): Record<string, RowErrors> {
    const errors: Record<string, RowErrors> = {};
    rows.forEach((row) => {
      if (isRowEmpty(row)) return;
      const rowErr: RowErrors = {};
      if (!row.name.trim()) rowErr.name = 'Wajib diisi';
      if (!row.brand_id) rowErr.brand_id = 'Pilih brand';
      if (Object.keys(rowErr).length) errors[row.id] = rowErr;
    });
    return errors;
  }

  function handleSubmit() {
    const errs = validate();
    setRowErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const toSubmit = rows.filter((r) => !isRowEmpty(r));
    if (toSubmit.length === 0) {
      toast.error('Tidak ada produk yang diisi');
      return;
    }

    const exactDupCount = toSubmit.filter((r) => {
      const trimmed = r.name.trim();
      if (!r.brand_id || trimmed.length < 2) return false;
      const cached = queryClient.getQueryData<{ matches: DuplicateMatch[] }>([
        'product-duplicates',
        r.brand_id,
        trimmed.toLowerCase(),
      ]);
      return cached?.matches?.some((m) => m.match_type === 'exact') ?? false;
    }).length;

    if (exactDupCount > 0) {
      const ok = window.confirm(
        `${exactDupCount} baris tampak duplikat dari produk yang sudah ada. Tetap simpan semua?`,
      );
      if (!ok) return;
    }

    pendingSubmitRef.current = toSubmit;

    const dtos: CreateProductDto[] = toSubmit.map((row) => {
      const dto: CreateProductDto = {
        name: row.name.trim(),
        brand_id: Number(row.brand_id),
      };
      const optFields: (keyof Omit<BulkRow, 'id' | 'name' | 'brand_id'>)[] = [
        'harga_gross', 'disc_pct',
        'harga_per_pcs', 'harga_per_lusin', 'harga_per_pak', 'harga_per_kotak', 'harga_per_karton',
        'harga_net', 'harga_daftar', 'harga',
        'harga_jual', 'harga_jual_per_lusin', 'harga_jual_per_pak', 'harga_jual_per_kotak', 'harga_jual_per_karton',
      ];
      optFields.forEach((field) => {
        const val = numOrNull(row[field]);
        if (val !== null) (dto as any)[field] = val;
      });
      return dto;
    });

    mutation.mutate(dtos);
  }

  const filledCount = rows.filter((r) => r.name.trim()).length;
  const errorCount = Object.keys(rowErrors).length;

  function setCellRef(el: HTMLElement | null, rowIdx: number, colIdx: number) {
    if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = [];
    cellRefs.current[rowIdx][colIdx] = el;
  }

  const inputClass = (rowId: string, field: keyof RowErrors) =>
    `w-full px-2 py-3 rounded-lg border bg-transparent text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2 ${
      rowErrors[rowId]?.[field] ? 'border-red' : 'border-border'
    }`;

  const selectClass = (rowId: string) =>
    `w-full px-2 py-3 rounded-lg border bg-bg text-sm focus:outline-none focus:border-border2 ${
      rowErrors[rowId]?.brand_id ? 'border-red' : 'border-border'
    }`;

  return (
    <div>
      <p className="text-xs text-muted mb-3">
        Tab / Shift+Tab untuk navigasi · Enter di kolom terakhir untuk baris baru · Ctrl+Enter untuk simpan
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="text-sm border-collapse" style={{ minWidth: 'max-content' }}>
          <thead className="sticky top-0 z-10 bg-surface">
            {/* Group header row */}
            <tr className="border-b border-border">
              <th className="sticky left-0 z-20 bg-surface px-3 py-2 text-left text-xs font-medium text-muted w-8" rowSpan={2}>#</th>
              <th className="sticky left-8 z-20 bg-surface px-3 py-2 text-left text-xs font-medium text-muted w-52 border-r border-border" colSpan={2}>Informasi Dasar</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted border-r border-border" colSpan={2}>Gross + Diskon</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted border-r border-border" colSpan={5}>Harga Beli Kemasan</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted border-r border-border" colSpan={3}>Harga Beli Referensi</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted border-r border-border" colSpan={5}>Harga Jual</th>
              <th className="sticky right-0 z-20 bg-surface w-10" />
            </tr>
            {/* Column label row */}
            <tr className="border-b border-border">
              {/* Nama Produk — sticky col 1 */}
              <th className="sticky left-8 z-20 bg-surface px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-52">
                Nama Produk <span className="text-red">*</span>
              </th>
              {/* Brand — sticky col 2 */}
              <th className="sticky z-20 bg-surface px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-36 border-r border-border" style={{ left: '14rem' }}>
                Brand <span className="text-red">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Harga Gross</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-24 border-r border-border">Diskon %</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Pcs</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Lusin</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Pak</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Kotak</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28 border-r border-border">Per Karton</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Harga Net</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Harga Daftar</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28 border-r border-border">Harga Umum</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Pcs</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Lusin</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Pak</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28">Per Kotak</th>
              <th className="px-3 py-2 text-left text-xs text-muted font-medium whitespace-nowrap w-28 border-r border-border">Per Karton</th>
              <th className="sticky right-0 z-20 bg-surface w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const errs = rowErrors[row.id] ?? {};
              const rowBg = rowIdx % 2 === 0 ? 'bg-surface' : 'bg-bg';

              return (
                <tr key={row.id} className={rowBg}>
                  {/* Row number */}
                  <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1 text-xs text-muted font-[family-name:var(--font-dm-mono)] w-8`}>
                    {rowIdx + 1}
                  </td>

                  {/* Nama Produk */}
                  <td className={`sticky left-8 z-10 ${rowBg} px-1 py-1 w-52`}>
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 0)}
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 0, e)}
                      className={inputClass(row.id, 'name')}
                      placeholder="Nama produk"
                    />
                    {errs.name && <p className="text-xs text-red mt-0.5 px-1">{errs.name}</p>}
                    {(() => {
                      const matches = dupByRowId[row.id];
                      if (!matches || matches.length === 0) return null;
                      const exact = matches.some((m) => m.match_type === 'exact');
                      const tooltip = matches
                        .slice(0, 3)
                        .map((m) => `${m.name} (${m.match_type === 'exact' ? 'sama' : `${m.score}%`})`)
                        .join('\n');
                      return (
                        <p
                          className={`text-[10px] mt-0.5 px-1 flex items-center gap-1 ${
                            exact ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400'
                          }`}
                          title={tooltip}
                        >
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              exact ? 'bg-amber-500' : 'bg-orange-500'
                            }`}
                          />
                          {exact ? 'duplikat' : 'mirip'}
                        </p>
                      );
                    })()}
                  </td>

                  {/* Brand */}
                  <td className={`sticky z-10 ${rowBg} px-1 py-1 w-36 border-r border-border`} style={{ left: '14rem' }}>
                    <select
                      ref={(el) => setCellRef(el, rowIdx, 1)}
                      value={row.brand_id}
                      onChange={(e) => updateRow(row.id, 'brand_id', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 1, e)}
                      className={selectClass(row.id)}
                    >
                      <option value="">Pilih</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {errs.brand_id && <p className="text-xs text-red mt-0.5 px-1">{errs.brand_id}</p>}
                  </td>

                  {/* harga_gross */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 2)}
                      type="number" inputMode="numeric"
                      value={row.harga_gross}
                      onChange={(e) => updateRow(row.id, 'harga_gross', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 2, e)}
                      className={inputClass(row.id, 'harga_gross')}
                      placeholder="—"
                    />
                  </td>

                  {/* disc_pct */}
                  <td className="px-1 py-1 w-24 border-r border-border">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 3)}
                      type="number" inputMode="decimal" step="0.01"
                      value={row.disc_pct}
                      onChange={(e) => updateRow(row.id, 'disc_pct', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 3, e)}
                      className={inputClass(row.id, 'disc_pct')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_per_pcs */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 4)}
                      type="number" inputMode="numeric"
                      value={row.harga_per_pcs}
                      onChange={(e) => updateRow(row.id, 'harga_per_pcs', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 4, e)}
                      className={inputClass(row.id, 'harga_per_pcs')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_per_lusin */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 5)}
                      type="number" inputMode="numeric"
                      value={row.harga_per_lusin}
                      onChange={(e) => updateRow(row.id, 'harga_per_lusin', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 5, e)}
                      className={inputClass(row.id, 'harga_per_lusin')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_per_pak */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 6)}
                      type="number" inputMode="numeric"
                      value={row.harga_per_pak}
                      onChange={(e) => updateRow(row.id, 'harga_per_pak', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 6, e)}
                      className={inputClass(row.id, 'harga_per_pak')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_per_kotak */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 7)}
                      type="number" inputMode="numeric"
                      value={row.harga_per_kotak}
                      onChange={(e) => updateRow(row.id, 'harga_per_kotak', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 7, e)}
                      className={inputClass(row.id, 'harga_per_kotak')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_per_karton */}
                  <td className="px-1 py-1 w-28 border-r border-border">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 8)}
                      type="number" inputMode="numeric"
                      value={row.harga_per_karton}
                      onChange={(e) => updateRow(row.id, 'harga_per_karton', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 8, e)}
                      className={inputClass(row.id, 'harga_per_karton')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_net */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 9)}
                      type="number" inputMode="numeric"
                      value={row.harga_net}
                      onChange={(e) => updateRow(row.id, 'harga_net', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 9, e)}
                      className={inputClass(row.id, 'harga_net')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_daftar */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 10)}
                      type="number" inputMode="numeric"
                      value={row.harga_daftar}
                      onChange={(e) => updateRow(row.id, 'harga_daftar', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 10, e)}
                      className={inputClass(row.id, 'harga_daftar')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga */}
                  <td className="px-1 py-1 w-28 border-r border-border">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 11)}
                      type="number" inputMode="numeric"
                      value={row.harga}
                      onChange={(e) => updateRow(row.id, 'harga', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 11, e)}
                      className={inputClass(row.id, 'harga')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_jual */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 12)}
                      type="number" inputMode="numeric"
                      value={row.harga_jual}
                      onChange={(e) => updateRow(row.id, 'harga_jual', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 12, e)}
                      className={inputClass(row.id, 'harga_jual')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_jual_per_lusin */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 13)}
                      type="number" inputMode="numeric"
                      value={row.harga_jual_per_lusin}
                      onChange={(e) => updateRow(row.id, 'harga_jual_per_lusin', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 13, e)}
                      className={inputClass(row.id, 'harga_jual_per_lusin')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_jual_per_pak */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 14)}
                      type="number" inputMode="numeric"
                      value={row.harga_jual_per_pak}
                      onChange={(e) => updateRow(row.id, 'harga_jual_per_pak', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 14, e)}
                      className={inputClass(row.id, 'harga_jual_per_pak')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_jual_per_kotak */}
                  <td className="px-1 py-1 w-28">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 15)}
                      type="number" inputMode="numeric"
                      value={row.harga_jual_per_kotak}
                      onChange={(e) => updateRow(row.id, 'harga_jual_per_kotak', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 15, e)}
                      className={inputClass(row.id, 'harga_jual_per_kotak')}
                      placeholder="—"
                    />
                  </td>

                  {/* harga_jual_per_karton */}
                  <td className="px-1 py-1 w-28 border-r border-border">
                    <input
                      ref={(el) => setCellRef(el, rowIdx, 16)}
                      type="number" inputMode="numeric"
                      value={row.harga_jual_per_karton}
                      onChange={(e) => updateRow(row.id, 'harga_jual_per_karton', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIdx, 16, e)}
                      className={inputClass(row.id, 'harga_jual_per_karton')}
                      placeholder="—"
                    />
                  </td>

                  {/* Delete */}
                  <td className={`sticky right-0 z-10 ${rowBg} px-1 py-1 text-center w-10`}>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="p-2 rounded-lg text-muted hover:text-red transition-colors disabled:opacity-20"
                      title="Hapus baris"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-text hover:bg-surface transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah Baris
        </button>

        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-sm text-red">{errorCount} produk ada error</span>
          )}
          <span className="text-sm text-muted">{filledCount} produk</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="bg-text text-surface px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : `Simpan ${filledCount} Produk`}
          </button>
        </div>
      </div>
    </div>
  );
}
