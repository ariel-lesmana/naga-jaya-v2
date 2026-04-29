'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { createBrand, createProduct, getBrands } from '@/lib/api';
import {
  CreateProductDto,
  PRICE_FIELD,
  ProductResponse,
  ReceiptItemProduct,
  ReceiptUnit,
} from '@/lib/types';

interface Props {
  initialName: string;
  initialUnit: ReceiptUnit | null;
  onClose: () => void;
  onCreated: (p: ReceiptItemProduct) => void;
}

function toItemProduct(p: ProductResponse): ReceiptItemProduct {
  return {
    id: p.id,
    name: p.name,
    brand_id: p.brand_id,
    harga_jual: p.harga_jual,
    harga_jual_per_lusin: p.harga_jual_per_lusin,
    harga_jual_per_pak: p.harga_jual_per_pak,
    harga_jual_per_kotak: p.harga_jual_per_kotak,
    harga_jual_per_karton: p.harga_jual_per_karton,
    deleted_at: p.deleted_at,
  };
}

export function ProductCreateModal({
  initialName,
  initialUnit,
  onClose,
  onCreated,
}: Props) {
  const queryClient = useQueryClient();
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  const [name, setName] = useState(initialName);
  const [brandId, setBrandId] = useState('');
  const [unit, setUnit] = useState<ReceiptUnit | ''>(initialUnit ?? '');
  const [price, setPrice] = useState('');
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (brandId || !brands) return;
    const def = brands.find((b) => b.name.trim().toLowerCase() === 'edit nanti');
    if (def) setBrandId(String(def.id));
  }, [brands, brandId]);

  const brandMut = useMutation({
    mutationFn: createBrand,
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setBrandId(String(b.id));
      setNewBrandName('');
      setShowBrandForm(false);
      toast.success(`Brand "${b.name}" dibuat`);
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal membuat brand'),
  });

  function submitBrand() {
    const n = newBrandName.trim();
    if (!n) {
      toast.error('Nama brand wajib diisi');
      return;
    }
    brandMut.mutate({ name: n });
  }

  const createMut = useMutation({
    mutationFn: (dto: CreateProductDto) => createProduct(dto),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-search'] });
      toast.success('Produk dibuat');
      onCreated(toItemProduct(p));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal membuat produk'),
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
    const dto: CreateProductDto = {
      name: name.trim(),
      brand_id: Number(brandId),
    };
    if (unit && price.trim() !== '') {
      const n = Number(price);
      if (!Number.isNaN(n)) {
        (dto as Record<string, number | null>)[PRICE_FIELD[unit]] = n;
      }
    }
    createMut.mutate(dto);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold">Buat Produk Baru</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs text-muted mb-1">Nama Produk *</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Brand *</label>
            {showBrandForm ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitBrand();
                    } else if (e.key === 'Escape') {
                      setShowBrandForm(false);
                      setNewBrandName('');
                    }
                  }}
                  placeholder="cth: Unilever"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
                />
                <button
                  type="button"
                  onClick={submitBrand}
                  disabled={brandMut.isPending}
                  className="px-3 py-2 rounded-lg bg-text text-surface text-xs font-medium disabled:opacity-50"
                >
                  {brandMut.isPending ? '…' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBrandForm(false);
                    setNewBrandName('');
                  }}
                  className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-bg"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
                >
                  <option value="">Pilih brand</option>
                  {brands?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowBrandForm(true)}
                  className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-bg whitespace-nowrap"
                >
                  + Brand baru
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Satuan harga</label>
              <select
                value={unit}
                onChange={(e) =>
                  setUnit(e.target.value as ReceiptUnit | '')
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2"
              >
                <option value="">— skip —</option>
                <option value="pcs">pcs</option>
                <option value="lusin">lusin</option>
                <option value="pak">pak</option>
                <option value="kotak">kotak</option>
                <option value="karton">karton</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Harga Jual {unit ? `/ ${unit}` : ''}
              </label>
              <input
                type="number"
                value={price}
                disabled={!unit}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={unit ? 'Opsional' : 'Pilih satuan dulu'}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2 disabled:opacity-50"
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Harga lain bisa di-isi lewat tombol pensil setelah dipilih.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-bg"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={createMut.isPending}
              className="flex-1 bg-text text-surface px-4 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {createMut.isPending ? 'Menyimpan…' : 'Buat & Pilih'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
