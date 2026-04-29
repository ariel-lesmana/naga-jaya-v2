'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { getBrands, getProduct, updateProduct } from '@/lib/api';
import { ProductResponse, UpdateProductDto } from '@/lib/types';

const HARGA_BELI_KEMASAN: { key: keyof UpdateProductDto; label: string }[] = [
  { key: 'harga_per_pcs', label: 'Beli / Pcs' },
  { key: 'harga_per_lusin', label: 'Beli / Lusin' },
  { key: 'harga_per_pak', label: 'Beli / Pak' },
  { key: 'harga_per_kotak', label: 'Beli / Kotak' },
  { key: 'harga_per_karton', label: 'Beli / Karton' },
];

const HARGA_BELI_REF: { key: keyof UpdateProductDto; label: string }[] = [
  { key: 'harga_net', label: 'Harga Net' },
  { key: 'harga_daftar', label: 'Harga Daftar' },
  { key: 'harga', label: 'Harga Umum' },
];

const HARGA_JUAL: { key: keyof UpdateProductDto; label: string }[] = [
  { key: 'harga_jual', label: 'Jual / Pcs' },
  { key: 'harga_jual_per_lusin', label: 'Jual / Lusin' },
  { key: 'harga_jual_per_pak', label: 'Jual / Pak' },
  { key: 'harga_jual_per_kotak', label: 'Jual / Kotak' },
  { key: 'harga_jual_per_karton', label: 'Jual / Karton' },
];

const NUM_KEYS = [
  ...HARGA_BELI_KEMASAN.map((f) => f.key),
  ...HARGA_BELI_REF.map((f) => f.key),
  ...HARGA_JUAL.map((f) => f.key),
  'harga_gross' as const,
  'disc_pct' as const,
];

interface Props {
  productId: number;
  receiptQueryKey: unknown[];
  onClose: () => void;
}

export function ProductEditDrawer({
  productId,
  receiptQueryKey,
  onClose,
}: Props) {
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setBrandId(String(product.brand_id));
    const v: Record<string, string> = {};
    for (const k of NUM_KEYS) {
      const raw = (product as unknown as Record<string, number | null>)[k];
      v[k] = raw == null ? '' : String(raw);
    }
    setValues(v);
  }, [product]);

  const saveMut = useMutation({
    mutationFn: (dto: UpdateProductDto) => updateProduct(productId, dto),
    onSuccess: (updated: ProductResponse) => {
      queryClient.setQueryData(['product', productId], updated);
      queryClient.invalidateQueries({ queryKey: receiptQueryKey });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-search'] });
      toast.success('Produk diperbarui');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal menyimpan'),
  });

  function submit() {
    if (!name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    if (!brandId) {
      toast.error('Brand wajib dipilih');
      return;
    }
    const dto: UpdateProductDto = {
      name: name.trim(),
      brand_id: Number(brandId),
    };
    for (const k of NUM_KEYS) {
      const raw = values[k] ?? '';
      const trimmed = raw.trim();
      if (trimmed === '') {
        (dto as Record<string, number | null>)[k] = null;
      } else {
        const n = Number(trimmed);
        if (!Number.isNaN(n)) {
          (dto as Record<string, number | null>)[k] = n;
        }
      }
    }
    saveMut.mutate(dto);
  }

  const setVal = (k: string, v: string) =>
    setValues((p) => ({ ...p, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-surface border-l border-border w-full max-w-xl h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit Produk</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading || !product ? (
          <div className="p-6">
            <div className="h-20 bg-border rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="p-5 space-y-5 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">Nama Produk *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Brand *</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
              >
                <option value="">Pilih brand</option>
                {brands?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="border border-border rounded-xl p-4 space-y-3">
              <legend className="px-2 text-xs uppercase tracking-wider text-muted">
                Gross + Diskon
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Harga Gross</label>
                  <input
                    type="number"
                    value={values.harga_gross ?? ''}
                    onChange={(e) => setVal('harga_gross', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Diskon (%)</label>
                  <input
                    type="number"
                    value={values.disc_pct ?? ''}
                    onChange={(e) => setVal('disc_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-xl p-4 space-y-3">
              <legend className="px-2 text-xs uppercase tracking-wider text-muted">
                Harga Beli / Kemasan
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {HARGA_BELI_KEMASAN.map(({ key, label }) => (
                  <div key={key as string}>
                    <label className="block text-xs text-muted mb-1">{label}</label>
                    <input
                      type="number"
                      value={values[key as string] ?? ''}
                      onChange={(e) => setVal(key as string, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-xl p-4 space-y-3">
              <legend className="px-2 text-xs uppercase tracking-wider text-muted">
                Harga Beli / Referensi
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {HARGA_BELI_REF.map(({ key, label }) => (
                  <div key={key as string}>
                    <label className="block text-xs text-muted mb-1">{label}</label>
                    <input
                      type="number"
                      value={values[key as string] ?? ''}
                      onChange={(e) => setVal(key as string, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-xl p-4 space-y-3">
              <legend className="px-2 text-xs uppercase tracking-wider text-muted">
                Harga Jual
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {HARGA_JUAL.map(({ key, label }) => (
                  <div key={key as string}>
                    <label className="block text-xs text-muted mb-1">{label}</label>
                    <input
                      type="number"
                      value={values[key as string] ?? ''}
                      onChange={(e) => setVal(key as string, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-bg"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={saveMut.isPending}
                className="flex-1 bg-text text-surface px-4 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saveMut.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
