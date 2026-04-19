"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { getHistorySummary } from "@/lib/api";
import { formatIDR } from "@/lib/format";

export function RecentChanges({
  onProductClick,
}: {
  onProductClick: (productId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["history-summary", 7],
    queryFn: () => getHistorySummary({ days: 7, limit: 5 }),
  });

  if (!summary || summary.length === 0) return null;

  return (
    <div className="mt-6 bg-surface rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-bg transition-colors"
      >
        <span>Perubahan Harga Terakhir (7 hari)</span>
        {expanded ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {summary.map((entry, i) => (
            <button
              key={entry.product_id}
              onClick={() => onProductClick(entry.product_id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg transition-colors ${
                i % 2 === 0 ? "bg-surface" : "bg-bg"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {entry.product_name}
                  </span>
                  <span className="text-xs text-muted bg-bg px-1.5 py-0.5 rounded shrink-0">
                    {entry.brand_name}
                  </span>
                </div>
                <div className="text-xs mt-0.5">
                  {entry.harga_jual_diff != null &&
                  entry.fields_changed.length === 1 &&
                  entry.fields_changed[0] === "Harga Jual" ? (
                    <span
                      className={`font-[family-name:var(--font-dm-mono)] ${
                        entry.harga_jual_diff > 0 ? "text-green" : "text-red"
                      }`}
                    >
                      Harga Jual{" "}
                      {entry.harga_jual_diff > 0 ? "+" : ""}
                      {formatIDR(entry.harga_jual_diff)}
                    </span>
                  ) : (
                    <span className="text-muted">
                      {entry.changes_count} kolom berubah
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted shrink-0">
                {entry.relative_time}
              </span>
            </button>
          ))}

          <div className="px-4 py-2.5 border-t border-border text-right">
            <Link
              href="/history"
              className="text-xs text-muted hover:text-text transition-colors"
            >
              Lihat semua &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
