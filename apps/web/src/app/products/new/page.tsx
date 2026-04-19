'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getBrands, createProduct } from '@/lib/api';
import { CreateProductDto } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { Tooltip, InfoIcon } from '@/components/Tooltip';
import { toast } from 'sonner';
import Link from 'next/link';

const PRICE_FIELDS = [
  { key: 'harga_per_karton', label: 'Harga Per Karton', tooltip: 'Harga beli satu karton penuh dari supplier' },
  { key: 'harga_per_kotak', label: 'Harga Per Kotak', tooltip: 'Harga beli per kotak \u2014 di antara karton dan pak' },
  { key: 'harga_per_pak', label: 'Harga Per Pak', tooltip: 'Harga beli per pak. Biasanya: Harga Karton \u00F7 jumlah pak per karton' },
  { key: 'harga_per_lusin', label: 'Harga Per Lusin (12 pcs)', tooltip: 'Harga beli per 12 pcs. Paling umum di produk FMCG' },
  { key: 'harga_per_pcs', label: 'Harga Per Pcs', tooltip: 'Harga beli per satuan langsung dari supplier' },
  { key: 'harga_net', label: 'Harga Net', tooltip: 'Harga setelah diskon supplier \u2014 lebih akurat dari Harga Umum' },
  { key: 'harga_daftar', label: 'Harga Daftar', tooltip: 'Harga katalog sebelum diskon. Gunakan sebagai referensi saja' },
  { key: 'harga', label: 'Harga Umum', tooltip: 'Harga generik dari supplier \u2014 satuan tidak selalu jelas' },
] as const;

function computeDiscNet(gross: string, disc: string): number | null {
  const g = gross ? Number(gross) : null;
  const d = disc ? Number(disc) : null;
  if (g == null || d == null || isNaN(g) || isNaN(d)) return null;
  return Math.round(g * (1 - d / 100));
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [hargaGross, setHargaGross] = useState('');
  const [discPct, setDiscPct] = useState('');
  const [error, setError] = useState('');

  const liveDiscNet = useMemo(() => computeDiscNet(hargaGross, discPct), [hargaGross, discPct]);

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast.success('Produk berhasil ditambahkan');
      router.push('/?created=1');
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Nama produk wajib diisi'); return; }
    if (!brandId) { setError('Brand wajib dipilih'); return; }
    if (!hargaJual) { setError('Harga jual wajib diisi'); return; }

    const dto: CreateProductDto = {
      name: name.trim(),
      brand_id: Number(brandId),
      harga_jual: Number(hargaJual),
    };

    PRICE_FIELDS.forEach(({ key }) => {
      const val = prices[key];
      if (val) (dto as any)[key] = Number(val);
    });

    if (hargaGross) dto.harga_gross = Number(hargaGross);
    if (discPct) dto.disc_pct = Number(discPct);

    mutation.mutate(dto);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-6 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
        </svg>
        Kembali
      </Link>

      <h1 className="text-2xl font-semibold mb-6">Tambah Produk Baru</h1>

      {error && (
        <div className="bg-red-bg text-red px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Produk *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
              placeholder="Masukkan nama produk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brand *</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
            >
              <option value="">Pilih brand</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Harga Grosir & Beli</h2>
          {PRICE_FIELDS.map(({ key, label, tooltip }) => (
            <div key={key}>
              <label className="flex items-center text-xs text-muted mb-1">
                {label}
                <Tooltip content={tooltip}><InfoIcon /></Tooltip>
              </label>
              <input
                type="number"
                value={prices[key] ?? ''}
                onChange={(e) => setPrices({ ...prices, [key]: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                placeholder="Opsional"
              />
            </div>
          ))}

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Dari Supplier</h3>
            <div>
              <label className="flex items-center text-xs text-muted mb-1">
                Harga Gross Supplier
                <Tooltip content="Harga asli dari supplier sebelum diskon diterapkan"><InfoIcon /></Tooltip>
              </label>
              <input
                type="number"
                value={hargaGross}
                onChange={(e) => setHargaGross(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                placeholder="Opsional"
              />
            </div>
            <div>
              <label className="flex items-center text-xs text-muted mb-1">
                Diskon (%)
                <Tooltip content="Persentase diskon dari supplier. Hasil net = Gross × (1 − disc%)"><InfoIcon /></Tooltip>
              </label>
              <input
                type="number"
                value={discPct}
                onChange={(e) => setDiscPct(e.target.value)}
                placeholder="cth: 50"
                min={0}
                max={100}
                step={0.01}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
              />
            </div>
            <div className="font-[family-name:var(--font-dm-mono)] text-sm text-green">
              Hasil net: {liveDiscNet != null ? formatIDR(liveDiscNet) : '\u2014'}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium mb-1">Harga Jual ke Konsumen *</label>
            <input
              type="number"
              value={hargaJual}
              onChange={(e) => setHargaJual(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
              placeholder="Wajib diisi"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-text text-surface py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? 'Menyimpan...' : 'Simpan Produk'}
        </button>
      </form>
    </div>
  );
}
