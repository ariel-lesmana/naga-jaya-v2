"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getProducts, getBrands, deleteProduct } from "@/lib/api";
import { ProductResponse } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { ProductDrawer } from "@/components/ProductDrawer";
import { RecentChanges } from "@/components/RecentChanges";
import { Tooltip, InfoIcon } from "@/components/Tooltip";
import { toast } from "sonner";

type SortKey =
  | "brand"
  | "name"
  | "harga_beli_satuan"
  | "harga_beli_grosir";

const BUY_PRICE_TIERS = [
  { key: "harga_per_pcs", label: "/pcs" },
  { key: "harga_per_lusin", label: "/lsn" },
  { key: "harga_per_karton", label: "/krt" },
  { key: "harga_per_kotak", label: "/ktk" },
  { key: "harga_per_pak", label: "/pak" },
  { key: "harga_net", label: "/net" },
  { key: "harga_daftar", label: "/daftar" },
  { key: "harga", label: "/umum" },
] as const;

const SELL_PRICE_TIERS = [
  { key: "harga_jual", label: "/pcs" },
  { key: "harga_jual_per_lusin", label: "/lsn" },
  { key: "harga_jual_per_karton", label: "/krt" },
  { key: "harga_jual_per_kotak", label: "/ktk" },
  { key: "harga_jual_per_pak", label: "/pak" },
] as const;

function getPriceTiers(
  product: ProductResponse,
  tiers: readonly { key: string; label: string }[],
) {
  const result: { value: number; label: string }[] = [];
  for (const { key, label } of tiers) {
    const val = product[key as keyof ProductResponse] as number | null;
    if (val != null) result.push({ value: val, label });
  }
  return result;
}

function StackedPriceCell({
  tiers,
  bold,
}: {
  tiers: { value: number; label: string }[];
  bold?: boolean;
}) {
  if (tiers.length === 0) return <span className="text-muted">{"\u2014"}</span>;
  const visible = tiers.slice(0, 3);
  const remaining = tiers.length - 3;
  return (
    <div className="leading-[1.6]">
      {visible.map((t, i) => (
        <div key={i} className="whitespace-nowrap">
          <span
            className={`font-[family-name:var(--font-dm-mono)] text-xs ${bold ? "font-semibold" : ""}`}
          >
            {formatIDR(t.value)}
          </span>
          <span className="font-[family-name:var(--font-dm-mono)] text-[10px] text-muted ml-1">
            {t.label}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-[10px] text-muted font-[family-name:var(--font-dm-mono)]">
          +{remaining} lagi
        </div>
      )}
    </div>
  );
}

type SortDir = "asc" | "desc";
type MarginFilter = "all" | "gt20" | "10to20" | "lt10" | "no_sell";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const page = Number(searchParams.get("page") || "1");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<number | undefined>();
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductResponse | null>(null);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    "detail" | "history"
  >("detail");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, brandFilter, page],
    queryFn: () =>
      getProducts({
        search: debouncedSearch || undefined,
        brand_id: brandFilter,
        page,
        limit: 50,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk berhasil dihapus");
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeletingId(null);
    },
  });

  const filteredAndSorted = useMemo(() => {
    if (!productsData?.data) return [];
    let items = [...productsData.data];

    if (marginFilter !== "all") {
      items = items.filter((p) => {
        if (marginFilter === "no_sell") return p.harga_jual == null;
        if (p.margin_pct == null) return false;
        if (marginFilter === "gt20") return p.margin_pct >= 20;
        if (marginFilter === "10to20")
          return p.margin_pct >= 10 && p.margin_pct < 20;
        if (marginFilter === "lt10") return p.margin_pct < 10;
        return true;
      });
    }

    items.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortKey) {
        case "brand":
          aVal = a.brand.name;
          bVal = b.brand.name;
          break;
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        default:
          aVal = a[sortKey];
          bVal = b[sortKey];
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return items;
  }, [productsData?.data, marginFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const items = filteredAndSorted;
    const uniqueBrands = new Set(items.map((p) => p.brand_id)).size;
    const margins = items
      .filter((p) => p.margin_pct != null)
      .map((p) => p.margin_pct!);
    const avgMargin =
      margins.length > 0
        ? Math.round(
            (margins.reduce((a, b) => a + b, 0) / margins.length) * 100,
          ) / 100
        : null;
    return { total: items.length, uniqueBrands, avgMargin };
  }, [filteredAndSorted]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const SortHeader = ({
    label,
    sortKeyName,
    tooltip,
  }: {
    label: string;
    sortKeyName: SortKey;
    tooltip: string;
  }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors"
      onClick={() => handleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Tooltip content={tooltip}>
          <InfoIcon />
        </Tooltip>
        {sortKey === sortKeyName && (
          <span className="text-text">
            {sortDir === "asc" ? "\u2191" : "\u2193"}
          </span>
        )}
      </span>
    </th>
  );

  return (
    <div>
      <div className="sticky top-[57px] z-40 bg-bg pb-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Cari nama produk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2 transition-colors"
          />
          <select
            value={brandFilter || ""}
            onChange={(e) =>
              setBrandFilter(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className="px-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
          >
            <option value="">Semua Brand</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={marginFilter}
            onChange={(e) => setMarginFilter(e.target.value as MarginFilter)}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
          >
            <option value="all">Semua Margin</option>
            <option value="gt20">&gt;20%</option>
            <option value="10to20">10 - 20%</option>
            <option value="lt10">&lt;10%</option>
            <option value="no_sell">Tanpa Harga Jual</option>
          </select>
        </div>
        <div className="flex gap-4 text-xs text-muted font-[family-name:var(--font-dm-mono)]">
          <span>{stats.total} produk</span>
          <span>{stats.uniqueBrands} brand</span>
          {stats.avgMargin != null && (
            <span>rata-rata margin {stats.avgMargin}%</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted">Memuat data...</div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface border-b border-border">
                  <tr>
                    <SortHeader
                      label="Brand"
                      sortKeyName="brand"
                      tooltip="Nama supplier atau merek produk"
                    />
                    <SortHeader
                      label="Nama Produk"
                      sortKeyName="name"
                      tooltip="Nama lengkap produk dari supplier"
                    />
                    <th className="w-44 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Harga Daftar
                    </th>
                    <th className="w-44 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Harga Jual
                    </th>
                    <th className="w-20 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((product, i) => (
                    <tr
                      key={product.id}
                      className={`${
                        i % 2 === 0 ? "bg-surface" : "bg-bg"
                      } hover:bg-border/30 cursor-pointer transition-colors`}
                      onClick={() => {
                        setSelectedProduct(product);
                        setDrawerEditMode(false);
                        setDrawerInitialTab("detail");
                      }}
                    >
                      <td
                        className="w-36 px-3 py-2.5 text-muted text-xs truncate"
                        title={product.brand.name}
                      >
                        {product.brand.name}
                      </td>
                      <td className="px-3 py-2.5 font-medium truncate">
                        {product.name}
                      </td>
                      <td className="w-44 px-3 py-2">
                        <StackedPriceCell
                          tiers={getPriceTiers(product, BUY_PRICE_TIERS)}
                        />
                      </td>
                      <td className="w-44 px-3 py-2">
                        <StackedPriceCell
                          tiers={getPriceTiers(product, SELL_PRICE_TIERS)}
                          bold
                        />
                      </td>
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
                            title="Edit"
                            onClick={() => {
                              setSelectedProduct(product);
                              setDrawerEditMode(true);
                              setDrawerInitialTab("detail");
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          {deletingId === product.id ? (
                            <span className="text-xs flex items-center gap-1">
                              <span className="text-red">Hapus?</span>
                              <button
                                className="text-red font-medium hover:underline"
                                onClick={() =>
                                  deleteMutation.mutate(product.id)
                                }
                              >
                                Ya
                              </button>
                              <button
                                className="text-muted hover:underline"
                                onClick={() => setDeletingId(null)}
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <button
                              className="p-1.5 rounded hover:bg-red-bg transition-colors text-muted hover:text-red"
                              title="Hapus"
                              onClick={() => setDeletingId(product.id)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSorted.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted">
                        Tidak ada produk ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {productsData && productsData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-40 hover:bg-bg transition-colors"
              >
                Prev
              </button>
              <span className="text-sm text-muted font-[family-name:var(--font-dm-mono)]">
                {page} / {productsData.totalPages}
              </span>
              <button
                disabled={page >= productsData.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-40 hover:bg-bg transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <RecentChanges
        onProductClick={(productId) => {
          const product = filteredAndSorted.find((p) => p.id === productId);
          if (product) {
            setSelectedProduct(product);
            setDrawerEditMode(false);
            setDrawerInitialTab("history");
          }
        }}
      />

      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          editMode={drawerEditMode}
          onEditModeChange={setDrawerEditMode}
          initialTab={drawerInitialTab}
          onClose={() => {
            setSelectedProduct(null);
            setDrawerEditMode(false);
            setDrawerInitialTab("detail");
          }}
        />
      )}
    </div>
  );
}
