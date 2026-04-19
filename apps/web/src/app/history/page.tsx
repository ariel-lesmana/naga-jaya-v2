"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { getHistorySummary, getBrands, getProductHistory } from "@/lib/api";
import { SummaryEntry, HistoryEntry } from "@/lib/types";
import { formatIDR } from "@/lib/format";

export default function HistoryPage() {
  const [days, setDays] = useState(7);
  const [brandFilter, setBrandFilter] = useState<number | undefined>();

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["history-summary-full", days, brandFilter],
    queryFn: () =>
      getHistorySummary({ days, brand_id: brandFilter, limit: 200 }),
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold">Riwayat Perubahan Harga</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        >
          <option value={7}>7 hari</option>
          <option value={30}>30 hari</option>
          <option value={90}>90 hari</option>
        </select>
        <select
          value={brandFilter || ""}
          onChange={(e) =>
            setBrandFilter(e.target.value ? Number(e.target.value) : undefined)
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

      {isLoading ? (
        <div className="text-center py-12 text-muted">Memuat data...</div>
      ) : !summary || summary.length === 0 ? (
        <div className="text-center py-12 text-muted">
          Tidak ada perubahan harga dalam {days} hari terakhir
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {summary.map((entry, i) => (
            <SummaryRow
              key={entry.product_id}
              entry={entry}
              even={i % 2 === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  entry,
  even,
}: {
  entry: SummaryEntry;
  even: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={even ? "bg-surface" : "bg-bg"}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {entry.product_name}
            </span>
            <span className="text-[10px] text-muted bg-border/40 px-1.5 py-0.5 rounded shrink-0">
              {entry.brand_name}
            </span>
          </div>
          <div className="text-xs text-muted mt-0.5">
            {entry.fields_changed.join(", ")}
          </div>
        </div>
        <div className="text-right shrink-0">
          {entry.harga_jual_diff != null && (
            <div
              className={`text-xs font-[family-name:var(--font-dm-mono)] ${
                entry.harga_jual_diff > 0 ? "text-green" : "text-red"
              }`}
            >
              Harga Jual{" "}
              {entry.harga_jual_diff > 0 ? "+" : ""}
              {formatIDR(entry.harga_jual_diff)}
            </div>
          )}
          <div className="text-[11px] text-muted">{entry.relative_time}</div>
        </div>
      </button>

      {expanded && <ExpandedHistory productId={entry.product_id} />}
    </div>
  );
}

function ExpandedHistory({ productId }: { productId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-history-inline", productId],
    queryFn: () => getProductHistory(productId, { limit: 20 }),
  });

  if (isLoading) {
    return (
      <div className="px-10 pb-3 text-xs text-muted">Memuat riwayat...</div>
    );
  }

  const entries = data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <div className="px-10 pb-3 text-xs text-muted">Tidak ada riwayat</div>
    );
  }

  return (
    <div className="px-10 pb-3 space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 text-xs"
        >
          <span className="font-medium w-36 shrink-0">{e.field_label}</span>
          <span className="font-[family-name:var(--font-dm-mono)] text-muted">
            {e.old_value != null ? formatIDR(e.old_value) : "\u2014"}
            {" \u2192 "}
            {e.new_value != null ? formatIDR(e.new_value) : "\u2014"}
          </span>
          {e.change_amount != null && (
            <span
              className={`font-[family-name:var(--font-dm-mono)] ${
                e.change_amount > 0 ? "text-green" : "text-red"
              }`}
            >
              {e.change_amount > 0 ? "+" : ""}
              {formatIDR(e.change_amount)}
            </span>
          )}
          <span className="text-muted ml-auto shrink-0">
            {e.relative_time}
          </span>
        </div>
      ))}
    </div>
  );
}
