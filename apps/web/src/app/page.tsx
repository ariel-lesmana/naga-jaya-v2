"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { getProducts, getBrands, deleteProduct } from "@/lib/api";
import { ProductResponse } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { ProductDrawer } from "@/components/ProductDrawer";
import { RecentChanges } from "@/components/RecentChanges";
import { Tooltip, InfoIcon } from "@/components/Tooltip";
import { toast } from "sonner";

type SortKey = "brand" | "name";

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
            className={`font-[family-name:var(--font-dm-mono)] text-sm ${bold ? "font-semibold" : ""}`}
          >
            {formatIDR(t.value)}
          </span>
          <span className="font-[family-name:var(--font-dm-mono)] text-xs text-muted ml-1">
            {t.label}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-xs text-muted font-[family-name:var(--font-dm-mono)]">
          +{remaining} lagi
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-surface" : "bg-bg"}
            >
              <td className="w-36 px-3 py-3">
                <div className="h-3 bg-border rounded w-20 animate-pulse" />
              </td>
              <td className="px-3 py-3">
                <div className="h-3 bg-border rounded w-3/4 animate-pulse" />
              </td>
              <td className="w-44 px-3 py-3">
                <div className="space-y-1.5">
                  <div className="h-3 bg-border rounded w-24 animate-pulse" />
                  <div className="h-3 bg-border rounded w-20 animate-pulse" />
                </div>
              </td>
              <td className="w-44 px-3 py-3">
                <div className="space-y-1.5">
                  <div className="h-3 bg-border rounded w-24 animate-pulse" />
                  <div className="h-3 bg-border rounded w-20 animate-pulse" />
                </div>
              </td>
              <td className="w-24 px-3 py-3">
                <div className="flex gap-2">
                  <div className="h-9 w-9 bg-border rounded animate-pulse" />
                  <div className="h-9 w-9 bg-border rounded animate-pulse" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SortDir = "asc" | "desc";

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const page = Number(searchParams.get("page") || "1");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<number | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductResponse | null>(null);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    "detail" | "history"
  >("detail");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedProduct) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      )
        return;
      const input = searchRef.current;
      if (!input) return;
      e.preventDefault();
      input.focus();
      setSearch((s) => s + e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedProduct]);

  useEffect(() => {
    if (page !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, brandFilter, sortKey, sortDir]);

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, brandFilter, page, sortKey, sortDir],
    queryFn: () =>
      getProducts({
        search: debouncedSearch || undefined,
        brand_id: brandFilter,
        page,
        limit: 50,
        sort_by: sortKey,
        sort_dir: sortDir,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dipindah ke sampah");
      setDeletingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeletingId(null);
    },
  });

  const products = productsData?.data ?? [];

  const stats = useMemo(() => {
    const uniqueBrands = new Set(products.map((p) => p.brand_id)).size;
    const margins = products
      .filter((p) => p.margin_pct != null)
      .map((p) => p.margin_pct!);
    const avgMargin =
      margins.length > 0
        ? Math.round(
            (margins.reduce((a, b) => a + b, 0) / margins.length) * 100,
          ) / 100
        : null;
    return {
      total: productsData?.total ?? 0,
      uniqueBrands,
      avgMargin,
    };
  }, [products, productsData?.total]);

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
  }) => {
    const active = sortKey === sortKeyName;
    return (
      <th
        className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors"
        onClick={() => handleSort(sortKeyName)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <Tooltip content={tooltip}>
            <InfoIcon />
          </Tooltip>
          <span
            className={active ? "text-text" : "text-muted/40"}
          >
            {active ? (sortDir === "asc" ? "\u2191" : "\u2193") : "\u2195"}
          </span>
        </span>
      </th>
    );
  };

  return (
    <div>
      <div className="sticky top-[57px] z-40 bg-bg pb-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            ref={searchRef}
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
        <TableSkeleton />
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
                  {products.map((product, i) => (
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
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            className="p-3 rounded-lg hover:bg-bg transition-colors text-muted hover:text-text"
                            title="Edit"
                            aria-label="Edit produk"
                            onClick={() => {
                              setSelectedProduct(product);
                              setDrawerEditMode(true);
                              setDrawerInitialTab("detail");
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
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
                            <span className="flex items-center gap-2">
                              <button
                                className="px-3 py-2 rounded-lg bg-red text-white text-sm font-medium"
                                onClick={() =>
                                  deleteMutation.mutate(product.id)
                                }
                              >
                                Hapus
                              </button>
                              <button
                                className="px-3 py-2 rounded-lg border border-border text-sm text-muted"
                                onClick={() => setDeletingId(null)}
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <button
                              className="p-3 rounded-lg hover:bg-red-bg transition-colors text-muted hover:text-red"
                              title="Hapus"
                              aria-label="Hapus produk"
                              onClick={() => setDeletingId(product.id)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
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
                  {products.length === 0 && (
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
          const product = products.find((p) => p.id === productId);
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

export default function HomePage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <HomePageInner />
    </Suspense>
  );
}
