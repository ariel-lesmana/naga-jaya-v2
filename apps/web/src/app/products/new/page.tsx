'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands, createProduct, createBrand, checkProductDuplicates } from '@/lib/api';
import { CreateProductDto } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { Tooltip, InfoIcon } from '@/components/Tooltip';
import { toast } from 'sonner';
import Link from 'next/link';
import BulkProductGrid from '@/components/BulkProductGrid';

const HARGA_BELI_KEMASAN = [
  { key: 'harga_per_pcs', label: 'Per Pcs', tooltip: 'Harga beli per satuan langsung dari supplier' },
  { key: 'harga_per_lusin', label: 'Per Lusin (12)', tooltip: 'Harga beli per 12 pcs. Paling umum di produk FMCG' },
  { key: 'harga_per_pak', label: 'Per Pak', tooltip: 'Harga beli per pak. Biasanya: Harga Karton ÷ jumlah pak per karton' },
  { key: 'harga_per_kotak', label: 'Per Kotak', tooltip: 'Harga beli per kotak — di antara karton dan pak' },
  { key: 'harga_per_karton', label: 'Per Karton', tooltip: 'Harga beli satu karton penuh dari supplier' },
];

const HARGA_BELI_REF = [
  { key: 'harga_net', label: 'Harga Net', tooltip: 'Harga setelah diskon supplier — lebih akurat dari Harga Umum' },
  { key: 'harga_daftar', label: 'Harga Daftar', tooltip: 'Harga katalog sebelum diskon. Gunakan sebagai referensi saja' },
  { key: 'harga', label: 'Harga Umum', tooltip: 'Harga generik dari supplier — satuan tidak selalu jelas' },
];

const HARGA_JUAL_FIELDS = [
  { key: 'harga_jual', label: 'Per Pcs', tooltip: 'Harga jual ke konsumen per satuan', required: false },
  { key: 'harga_jual_per_lusin', label: 'Per Lusin (12)', tooltip: 'Harga jual per 12 pcs', required: false },
  { key: 'harga_jual_per_pak', label: 'Per Pak', tooltip: 'Harga jual per pak', required: false },
  { key: 'harga_jual_per_kotak', label: 'Per Kotak', tooltip: 'Harga jual per kotak', required: false },
  { key: 'harga_jual_per_karton', label: 'Per Karton', tooltip: 'Harga jual per karton', required: false },
];

function computeDiscNet(gross: string, disc: string): number | null {
  const g = gross ? Number(gross) : null;
  const d = disc ? Number(disc) : null;
  if (g == null || d == null || isNaN(g) || isNaN(d)) return null;
  return Math.round(g * (1 - d / 100));
}

function PriceInput({
  label,
  tooltip,
  value,
  onChange,
  required = false,
}: {
  label: string;
  tooltip: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center text-xs text-muted mb-1.5">
        {label}{required && ' *'}
        <Tooltip content={tooltip}><InfoIcon /></Tooltip>
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
        placeholder={required ? 'Wajib diisi' : 'Opsional'}
      />
    </div>
  );
}

function NewProductPageInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'bulk' ? 'bulk' : 'single';

  const [name, setName] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [brandId, setBrandId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name), 300);
    return () => clearTimeout(t);
  }, [name]);

  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [brandError, setBrandError] = useState('');

  const [beliPrices, setBeliPrices] = useState<Record<string, string>>({});
  const [hargaGross, setHargaGross] = useState('');
  const [discPct, setDiscPct] = useState('');

  const [jualPrices, setJualPrices] = useState<Record<string, string>>({});

  const [error, setError] = useState('');

  const liveDiscNet = useMemo(() => computeDiscNet(hargaGross, discPct), [hargaGross, discPct]);

  const liveBelisatuan = useMemo(() => {
    if (liveDiscNet != null) return liveDiscNet;
    if (beliPrices.harga_per_pcs) return Number(beliPrices.harga_per_pcs);
    if (beliPrices.harga_net) return Number(beliPrices.harga_net);
    if (beliPrices.harga) return Number(beliPrices.harga);
    if (beliPrices.harga_daftar) return Number(beliPrices.harga_daftar);
    return null;
  }, [liveDiscNet, beliPrices]);

  const liveMargin = useMemo(() => {
    const jual = jualPrices.harga_jual ? Number(jualPrices.harga_jual) : null;
    if (jual == null || liveBelisatuan == null || liveBelisatuan === 0) return null;
    return Math.round(((jual - liveBelisatuan) / liveBelisatuan) * 100);
  }, [jualPrices, liveBelisatuan]);

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  const { data: dupData } = useQuery({
    queryKey: ['product-duplicates', brandId, debouncedName.trim().toLowerCase()],
    queryFn: () =>
      checkProductDuplicates({ brand_id: Number(brandId), name: debouncedName }),
    enabled: Boolean(brandId) && debouncedName.trim().length >= 2,
    staleTime: 30_000,
  });
  const dupMatches = dupData?.matches ?? [];
  const hasExactDup = dupMatches.some((m) => m.match_type === 'exact');

  const brandMutation = useMutation({
    mutationFn: createBrand,
    onSuccess: (brand) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setBrandId(String(brand.id));
      setNewBrandName('');
      setShowBrandModal(false);
      setBrandError('');
      toast.success(`Brand "${brand.name}" ditambahkan`);
    },
    onError: (err: Error) => {
      setBrandError(err.message);
    },
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

    if (hasExactDup) {
      const ok = window.confirm(
        'Produk dengan nama yang sama sudah ada di brand ini. Tetap simpan?',
      );
      if (!ok) return;
    }

    const dto: CreateProductDto = {
      name: name.trim(),
      brand_id: Number(brandId),
    };

    [...HARGA_BELI_KEMASAN, ...HARGA_BELI_REF].forEach(({ key }) => {
      const val = beliPrices[key];
      if (val) (dto as any)[key] = Number(val);
    });

    if (hargaGross) dto.harga_gross = Number(hargaGross);
    if (discPct) dto.disc_pct = Number(discPct);

    HARGA_JUAL_FIELDS.forEach(({ key }) => {
      const val = jualPrices[key];
      if (val) (dto as any)[key] = Number(val);
    });

    mutation.mutate(dto);
  };

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBrandError('');
    if (!newBrandName.trim()) { setBrandError('Nama brand wajib diisi'); return; }
    brandMutation.mutate({ name: newBrandName.trim() });
  };

  const closeBrandModal = () => {
    setShowBrandModal(false);
    setBrandError('');
    setNewBrandName('');
  };

  const selectedBrand = brands?.find((b) => String(b.id) === brandId);

  return (
    <div className={mode === 'bulk' ? 'max-w-full px-4' : 'max-w-2xl mx-auto'}>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-6 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
        </svg>
        Kembali
      </Link>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl mb-6 w-fit">
        <Link
          href="/products/new"
          replace
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'single' ? 'bg-text text-surface' : 'text-muted hover:text-text'
          }`}
        >
          Satu Produk
        </Link>
        <Link
          href="/products/new?mode=bulk"
          replace
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'bulk' ? 'bg-text text-surface' : 'text-muted hover:text-text'
          }`}
        >
          Banyak Produk
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-6">
        {mode === 'single' ? 'Tambah Produk Baru' : 'Tambah Banyak Produk'}
      </h1>

      {mode === 'bulk' ? (
        <BulkProductGrid
          brands={brands ?? []}
          onSuccess={() => router.push('/?created=1')}
        />
      ) : (
        <>
          {error && (
            <div className="bg-red-bg text-red px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informasi Dasar */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Informasi Dasar</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Produk *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
                  placeholder="Masukkan nama produk"
                />
                {dupMatches.length > 0 && (
                  <div
                    className={`mt-2 px-3 py-2.5 rounded-lg border text-xs ${
                      hasExactDup
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400'
                        : 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400'
                    }`}
                  >
                    <p className="font-medium mb-1">
                      {hasExactDup
                        ? 'Produk dengan nama yang sama sudah ada di brand ini'
                        : 'Produk dengan nama mirip sudah ada di brand ini'}
                    </p>
                    <ul className="space-y-0.5">
                      {dupMatches.map((m) => (
                        <li key={m.id}>
                          <Link
                            href={`/products/${m.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:no-underline"
                          >
                            {m.name}
                          </Link>
                          <span className="ml-2 opacity-60">
                            {m.match_type === 'exact' ? 'sama persis' : `mirip ${m.score}%`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand *</label>
                <div className="flex gap-2">
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
                  >
                    <option value="">Pilih brand</option>
                    {brands?.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowBrandModal(true)}
                    className="px-4 py-3 rounded-lg border border-border bg-bg text-sm hover:bg-surface transition-colors flex items-center gap-1.5 text-muted hover:text-text whitespace-nowrap"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Brand Baru
                  </button>
                </div>
                {selectedBrand && (
                  <p className="text-xs text-green mt-1.5">✓ {selectedBrand.name}</p>
                )}
              </div>
            </div>

            {/* Harga Beli */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Harga Beli</h2>

              <div>
                <p className="text-xs font-medium text-muted mb-3">Dari Supplier (Gross + Diskon)</p>
                <div className="grid grid-cols-2 gap-3">
                  <PriceInput
                    label="Harga Gross"
                    tooltip="Harga asli dari supplier sebelum diskon diterapkan"
                    value={hargaGross}
                    onChange={setHargaGross}
                  />
                  <PriceInput
                    label="Diskon (%)"
                    tooltip="Persentase diskon dari supplier. Hasil net = Gross × (1 − disc%)"
                    value={discPct}
                    onChange={setDiscPct}
                  />
                </div>
                {liveDiscNet != null && (
                  <div className="mt-2 px-3 py-2 bg-bg rounded-lg text-xs font-[family-name:var(--font-dm-mono)] text-green">
                    → Harga Net: {formatIDR(liveDiscNet)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-3">Per Unit / Kemasan</p>
                <div className="grid grid-cols-2 gap-3">
                  {HARGA_BELI_KEMASAN.map(({ key, label, tooltip }) => (
                    <PriceInput
                      key={key}
                      label={label}
                      tooltip={tooltip}
                      value={beliPrices[key] ?? ''}
                      onChange={(v) => setBeliPrices({ ...beliPrices, [key]: v })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-3">Harga Referensi</p>
                <div className="grid grid-cols-2 gap-3">
                  {HARGA_BELI_REF.map(({ key, label, tooltip }) => (
                    <PriceInput
                      key={key}
                      label={label}
                      tooltip={tooltip}
                      value={beliPrices[key] ?? ''}
                      onChange={(v) => setBeliPrices({ ...beliPrices, [key]: v })}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Harga Jual */}
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Harga Jual</h2>
                {liveMargin != null && (
                  <span className={`text-xs font-[family-name:var(--font-dm-mono)] font-medium px-2 py-1 rounded ${liveMargin >= 0 ? 'text-green bg-green/10' : 'text-red bg-red-bg'}`}>
                    Margin {liveMargin >= 0 ? '+' : ''}{liveMargin}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {HARGA_JUAL_FIELDS.map(({ key, label, tooltip, required }) => (
                  <PriceInput
                    key={key}
                    label={label}
                    tooltip={tooltip}
                    value={jualPrices[key] ?? ''}
                    onChange={(v) => setJualPrices({ ...jualPrices, [key]: v })}
                    required={required}
                  />
                ))}
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

          {/* Brand Quick-Add Modal */}
          {showBrandModal && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={closeBrandModal}
            >
              <div
                className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 overflow-y-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold mb-4">Tambah Brand Baru</h3>
                {brandError && (
                  <div className="bg-red-bg text-red px-3 py-2 rounded-lg text-sm mb-3">{brandError}</div>
                )}
                <form onSubmit={handleBrandSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nama Brand *</label>
                    <input
                      type="text"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
                      placeholder="cth: Unilever, Nestle..."
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeBrandModal}
                      className="flex-1 px-4 py-3 rounded-lg border border-border text-sm hover:bg-bg transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={brandMutation.isPending}
                      className="flex-1 bg-text text-surface px-4 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {brandMutation.isPending ? 'Menyimpan...' : 'Simpan Brand'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto animate-pulse h-20 bg-border rounded-xl" />}>
      <NewProductPageInner />
    </Suspense>
  );
}
