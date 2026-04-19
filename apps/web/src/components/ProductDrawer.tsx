'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductResponse, UpdateProductDto, HistoryEntry } from '@/lib/types';
import { getBrands, updateProduct, getProduct, getProductHistory } from '@/lib/api';
import { formatIDR, formatPct, marginColor } from '@/lib/format';
import { Tooltip, InfoIcon } from './Tooltip';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';

type DrawerTab = 'detail' | 'history';

interface Props {
  product: ProductResponse;
  editMode: boolean;
  onEditModeChange: (editing: boolean) => void;
  onClose: () => void;
  initialTab?: DrawerTab;
}

const PRICE_FIELDS = [
  { key: 'harga_per_karton', label: 'Harga Per Karton', tooltip: 'Harga beli satu karton penuh dari supplier' },
  { key: 'harga_per_kotak', label: 'Harga Per Kotak', tooltip: 'Harga beli per kotak \u2014 di antara karton dan pak' },
  { key: 'harga_per_pak', label: 'Harga Per Pak', tooltip: 'Harga beli per pak. Biasanya: Harga Karton \u00F7 jumlah pak per karton' },
  { key: 'harga_per_lusin', label: 'Harga Per Lusin (12 pcs)', tooltip: 'Harga beli per 12 pcs. Paling umum di produk FMCG' },
  { key: 'harga_per_pcs', label: 'Harga Per Pcs', tooltip: 'Harga beli per satuan langsung dari supplier' },
  { key: 'harga_net', label: 'Harga Net', tooltip: 'Harga setelah diskon supplier \u2014 lebih akurat dari Harga Umum' },
  { key: 'harga_daftar', label: 'Harga Daftar', tooltip: 'Harga katalog sebelum diskon. Gunakan sebagai referensi saja' },
  { key: 'harga', label: 'Harga Umum', tooltip: 'Harga generik dari supplier \u2014 satuan tidak selalu jelas' },
  { key: 'harga_jual', label: 'Harga Jual / Pcs', tooltip: 'Harga jual per satuan ke konsumen akhir' },
  { key: 'harga_jual_per_lusin', label: 'Harga Jual Per Lusin', tooltip: 'Harga jual per lusin (12 pcs) ke konsumen' },
  { key: 'harga_jual_per_karton', label: 'Harga Jual Per Karton', tooltip: 'Harga jual per karton ke konsumen' },
  { key: 'harga_jual_per_kotak', label: 'Harga Jual Per Kotak', tooltip: 'Harga jual per kotak ke konsumen' },
  { key: 'harga_jual_per_pak', label: 'Harga Jual Per Pak', tooltip: 'Harga jual per pak ke konsumen' },
] as const;

const SATUAN_SOURCE_LABEL: Record<string, string> = {
  disc_net_computed: 'Net dari Diskon Supplier',
  harga_per_pcs: 'Harga Per Pcs',
  harga_net: 'Harga Net',
  harga: 'Harga Umum',
  harga_daftar: 'Harga Daftar',
};

function getSatuanSource(product: ProductResponse): { key: string; label: string } | null {
  if (product.disc_net_computed != null) return { key: 'disc_net_computed', label: SATUAN_SOURCE_LABEL.disc_net_computed };
  if (product.harga_per_pcs != null) return { key: 'harga_per_pcs', label: SATUAN_SOURCE_LABEL.harga_per_pcs };
  if (product.harga_net != null) return { key: 'harga_net', label: SATUAN_SOURCE_LABEL.harga_net };
  if (product.harga != null) return { key: 'harga', label: SATUAN_SOURCE_LABEL.harga };
  if (product.harga_daftar != null) return { key: 'harga_daftar', label: SATUAN_SOURCE_LABEL.harga_daftar };
  return null;
}

function computeDiscNet(gross: string, disc: string): number | null {
  const g = gross ? Number(gross) : null;
  const d = disc ? Number(disc) : null;
  if (g == null || d == null || isNaN(g) || isNaN(d)) return null;
  return Math.round(g * (1 - d / 100));
}

export function ProductDrawer({ product: initialProduct, editMode, onEditModeChange, onClose, initialTab }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab || 'detail');

  const { data: freshProduct } = useQuery({
    queryKey: ['product', initialProduct.id],
    queryFn: () => getProduct(initialProduct.id),
    initialData: initialProduct,
  });

  const product = freshProduct;

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [discExpanded, setDiscExpanded] = useState(false);

  useEffect(() => {
    if (editMode) {
      setActiveTab('detail');
      const initial: Record<string, string> = {
        name: product.name,
        brand_id: String(product.brand_id),
        harga_gross: product.harga_gross != null ? String(product.harga_gross) : '',
        disc_pct: product.disc_pct != null ? String(product.disc_pct) : '',
      };
      PRICE_FIELDS.forEach(({ key }) => {
        const val = product[key as keyof ProductResponse];
        initial[key] = val != null ? String(val) : '';
      });
      setForm(initial);
    }
  }, [editMode, product]);

  const liveDiscNet = useMemo(
    () => computeDiscNet(form.harga_gross || '', form.disc_pct || ''),
    [form.harga_gross, form.disc_pct],
  );

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateProductDto) => updateProduct(product.id, dto),
    onMutate: async (dto) => {
      await queryClient.cancelQueries({ queryKey: ['product', product.id] });
      const prev = queryClient.getQueryData<ProductResponse>(['product', product.id]);
      if (prev) {
        queryClient.setQueryData(['product', product.id], { ...prev, ...dto });
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['product', product.id], data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-history', product.id] });
      toast.success('Produk berhasil diperbarui');
      onEditModeChange(false);
    },
    onError: (err: Error, _dto, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['product', product.id], context.prev);
      }
      toast.error(err.message);
    },
  });

  const handleSave = () => {
    const dto: UpdateProductDto = {};
    if (form.name !== product.name) dto.name = form.name;
    if (Number(form.brand_id) !== product.brand_id) dto.brand_id = Number(form.brand_id);
    PRICE_FIELDS.forEach(({ key }) => {
      const val = form[key];
      const newVal = val === '' ? null : Number(val);
      if (newVal !== product[key as keyof ProductResponse]) {
        (dto as any)[key] = newVal;
      }
    });
    const newGross = form.harga_gross === '' ? null : Number(form.harga_gross);
    const newDisc = form.disc_pct === '' ? null : Number(form.disc_pct);
    if (newGross !== product.harga_gross) dto.harga_gross = newGross;
    if (newDisc !== product.disc_pct) dto.disc_pct = newDisc;
    updateMutation.mutate(dto);
  };

  const satuanSource = useMemo(() => getSatuanSource(product), [product]);

  const discMismatch = useMemo(() => {
    if (product.disc_net_computed == null || product.harga_beli_satuan == null) return false;
    return product.disc_net_computed !== product.harga_beli_satuan;
  }, [product]);

  const chipClass = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-bg text-green';
      case 'amber': return 'bg-amber-bg text-amber';
      case 'red': return 'bg-red-bg text-red';
      default: return 'bg-bg text-muted';
    }
  };

  const PriceRow = ({ label, value, italic, green }: { label: string; value: number | null; italic?: boolean; green?: boolean }) => {
    if (value == null) return null;
    return (
      <div className="flex justify-between py-1.5">
        <span className={`text-sm ${italic ? 'italic text-muted' : 'text-muted'}`}>{label}</span>
        <span className={`font-[family-name:var(--font-dm-mono)] text-sm ${green ? 'text-green font-medium' : ''}`}>
          {formatIDR(value)}
        </span>
      </div>
    );
  };

  const FieldLabel = ({ label, tooltip }: { label: string; tooltip: string }) => (
    <label className="flex items-center text-xs text-muted mb-1">
      {label}
      <Tooltip content={tooltip}><InfoIcon /></Tooltip>
    </label>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-surface z-50 shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface">
          <div className="border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg truncate pr-4">
              {editMode ? 'Edit Produk' : product.name}
            </h2>
            <div className="flex items-center gap-2">
              {!editMode && (
                <button
                  onClick={() => onEditModeChange(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-bg transition-colors"
                >
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-bg transition-colors text-muted"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          {!editMode && (
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('detail')}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                  activeTab === 'detail'
                    ? 'text-text border-b-2 border-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                Detail
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                  activeTab === 'history'
                    ? 'text-text border-b-2 border-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                Riwayat Harga
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-6">
          {editMode ? (
            <>
              <div>
                <label className="block text-xs text-muted mb-1">Nama Produk</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Brand</label>
                <select
                  value={form.brand_id || ''}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
                >
                  {brands?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {PRICE_FIELDS.map(({ key, label, tooltip }) => (
                  <div key={key}>
                    <FieldLabel label={label} tooltip={tooltip} />
                    <input
                      type="number"
                      value={form[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      placeholder={product[key as keyof ProductResponse] != null ? String(product[key as keyof ProductResponse]) : 'Kosong'}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Dari Supplier</h3>
                <div>
                  <FieldLabel label="Harga Gross Supplier" tooltip="Harga asli dari supplier sebelum diskon diterapkan" />
                  <input
                    type="number"
                    value={form.harga_gross ?? ''}
                    onChange={(e) => setForm({ ...form, harga_gross: e.target.value })}
                    placeholder={product.harga_gross != null ? String(product.harga_gross) : 'Kosong'}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                  />
                </div>
                <div>
                  <FieldLabel label="Diskon (%)" tooltip="Persentase diskon dari supplier. Hasil net = Gross \u00D7 (1 \u2212 disc%)" />
                  <input
                    type="number"
                    value={form.disc_pct ?? ''}
                    onChange={(e) => setForm({ ...form, disc_pct: e.target.value })}
                    placeholder="cth: 50"
                    min={0}
                    max={100}
                    step={0.01}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm font-[family-name:var(--font-dm-mono)] focus:outline-none focus:border-border2"
                  />
                </div>
                <div className="font-[family-name:var(--font-dm-mono)] text-sm text-green">
                  Hasil net: {liveDiscNet != null ? formatIDR(liveDiscNet) : '\u2014'}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-text text-surface py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => onEditModeChange(false)}
                  className="flex-1 border border-border py-2.5 rounded-lg text-sm hover:bg-bg transition-colors"
                >
                  Batal
                </button>
              </div>
            </>
          ) : activeTab === 'detail' ? (
            <>
              <div className="text-xs text-muted">{product.brand.name}</div>

              {(product.harga_per_karton != null ||
                product.harga_per_kotak != null ||
                product.harga_per_pak != null ||
                product.harga_per_lusin != null) && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                    Harga Grosir
                  </h3>
                  <div className="border border-border rounded-lg px-4 py-2 divide-y divide-border">
                    <PriceRow label="Per Karton" value={product.harga_per_karton} />
                    <PriceRow label="Per Kotak" value={product.harga_per_kotak} />
                    <PriceRow label="Per Pak" value={product.harga_per_pak} />
                    <PriceRow label="Per Lusin (12 pcs)" value={product.harga_per_lusin} />
                  </div>
                </div>
              )}

              {(product.harga_per_pcs != null ||
                product.harga_per_pcs_derived != null ||
                product.harga_net != null ||
                product.harga_daftar != null ||
                product.harga != null ||
                product.disc_net_computed != null) && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                    Harga Beli Satuan
                  </h3>
                  {satuanSource ? (
                    <p className="text-[11px] text-muted font-[family-name:var(--font-dm-mono)] mb-2">
                      Menggunakan: {satuanSource.label}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber font-[family-name:var(--font-dm-mono)] mb-2">
                      Tidak ada harga beli tersimpan
                    </p>
                  )}
                  <div className="border border-border rounded-lg px-4 py-2 divide-y divide-border">
                    <PriceRow label="Per Pcs" value={product.harga_per_pcs} />
                    {product.harga_per_pcs == null && product.harga_per_pcs_derived != null && (
                      <PriceRow label="Per Pcs estimasi dari lusin" value={product.harga_per_pcs_derived} italic />
                    )}
                    <PriceRow label="Harga Net" value={product.harga_net} />
                    <PriceRow label="Harga Daftar" value={product.harga_daftar} />
                    <PriceRow label="Harga Umum" value={product.harga} />
                  </div>

                  {product.harga_gross != null && (
                    <div className="mt-2">
                      <button
                        onClick={() => setDiscExpanded(!discExpanded)}
                        className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors py-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform ${discExpanded ? 'rotate-90' : ''}`}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                        Rincian Diskon Supplier
                      </button>
                      {discExpanded && (
                        <div className="border border-border rounded-lg px-4 py-2 mt-1 space-y-0 divide-y divide-border">
                          <PriceRow label="Harga Gross" value={product.harga_gross} />
                          <div className="flex justify-between py-1.5">
                            <span className="text-muted text-sm">Diskon</span>
                            <span className="font-[family-name:var(--font-dm-mono)] text-sm">
                              {product.disc_pct != null ? `${product.disc_pct}%` : '\u2014'}
                            </span>
                          </div>
                          <PriceRow label="Harga Net (hasil)" value={product.disc_net_computed} green />
                          {discMismatch && product.harga_beli_satuan != null && (
                            <div className="py-1.5 text-xs text-amber flex items-center gap-1">
                              <span>{'\u26A0'}</span>
                              <span>Harga tersimpan ({formatIDR(product.harga_beli_satuan)}) berbeda dari hasil hitung</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(product.harga_jual != null ||
                product.harga_jual_per_lusin != null ||
                product.harga_jual_per_karton != null ||
                product.harga_jual_per_kotak != null ||
                product.harga_jual_per_pak != null) && (
                <div>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                    Harga Jual
                  </h3>
                  <div className="border border-border rounded-lg px-4 py-2 divide-y divide-border">
                    <PriceRow label="Per Pcs" value={product.harga_jual} green />
                    <PriceRow label="Per Lusin (12 pcs)" value={product.harga_jual_per_lusin} />
                    <PriceRow label="Per Karton" value={product.harga_jual_per_karton} />
                    <PriceRow label="Per Kotak" value={product.harga_jual_per_kotak} />
                    <PriceRow label="Per Pak" value={product.harga_jual_per_pak} />
                  </div>
                </div>
              )}

              {(product.margin != null || product.margin_pct != null) && (
                <div className="bg-bg rounded-lg px-4 py-3 space-y-2">
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Margin</h3>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted">Margin (%)</span>
                    <span
                      className={`font-[family-name:var(--font-dm-mono)] text-[20px] font-bold ${
                        product.margin_pct != null
                          ? marginColor(product.margin_pct) === 'green'
                            ? 'text-green'
                            : marginColor(product.margin_pct) === 'amber'
                              ? 'text-amber'
                              : marginColor(product.margin_pct) === 'red'
                                ? 'text-red'
                                : 'text-text'
                          : 'text-muted'
                      }`}
                    >
                      {formatPct(product.margin_pct) ?? '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Margin (IDR)</span>
                    <span className="font-[family-name:var(--font-dm-mono)] text-[13px] text-muted">
                      {formatIDR(product.margin)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted pt-1 border-t border-border">
                    <span>Harga Beli Satuan (basis)</span>
                    <span className="font-[family-name:var(--font-dm-mono)]">
                      {formatIDR(product.harga_beli_satuan)}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <HistoryTab productId={product.id} />
          )}
        </div>
      </div>
    </>
  );
}

function HistoryTab({ productId }: { productId: number }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['product-history', productId],
    queryFn: ({ pageParam }) =>
      getProductHistory(productId, {
        limit: 50,
        before: pageParam || undefined,
      }),
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.entries.length === 0) return undefined;
      return lastPage.entries[lastPage.entries.length - 1].created_at;
    },
  });

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-border mt-1.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-border rounded w-1/3" />
              <div className="h-3 bg-border rounded w-2/3" />
              <div className="h-3 bg-border rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={32} className="mx-auto mb-3 text-muted" />
        <p className="text-sm text-muted">Belum ada riwayat perubahan harga</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <HistoryEntryRow key={entry.id} entry={entry} isLast={i === entries.length - 1} />
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-2.5 text-sm text-muted hover:text-text transition-colors"
        >
          {isFetchingNextPage ? 'Memuat...' : 'Muat lebih banyak'}
        </button>
      )}
    </div>
  );
}

function HistoryEntryRow({ entry, isLast }: { entry: HistoryEntry; isLast: boolean }) {
  const changeColor =
    entry.change_amount != null
      ? entry.change_amount > 0
        ? 'text-green'
        : entry.change_amount < 0
          ? 'text-red'
          : 'text-muted'
      : 'text-muted';

  return (
    <div className="flex gap-3 relative">
      {/* Timeline */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-2 h-2 rounded-full bg-border2 mt-1.5" />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium">{entry.field_label}</span>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted">{entry.relative_time}</div>
            <div className="text-[11px] text-muted">{entry.source_label}</div>
          </div>
        </div>
        <div className="font-[family-name:var(--font-dm-mono)] text-xs mt-0.5">
          {entry.old_value != null ? formatIDR(entry.old_value) : '\u2014'}
          {' \u2192 '}
          {entry.new_value != null ? (
            formatIDR(entry.new_value)
          ) : (
            <span className="text-red">dihapus</span>
          )}
        </div>
        <div className={`text-xs mt-0.5 font-[family-name:var(--font-dm-mono)] ${changeColor}`}>
          {entry.change_amount != null ? (
            <>
              {entry.change_amount > 0 ? '+' : ''}
              {formatIDR(entry.change_amount)}
              {entry.change_pct != null && ` (${entry.change_pct > 0 ? '+' : ''}${entry.change_pct}%)`}
            </>
          ) : (
            <span className="text-muted">(nilai baru)</span>
          )}
        </div>
      </div>
    </div>
  );
}
