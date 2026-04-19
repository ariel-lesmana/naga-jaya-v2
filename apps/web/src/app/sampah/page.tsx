"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getDeletedProducts,
  restoreProduct,
  permanentDeleteProduct,
} from "@/lib/api";
import { formatIDR } from "@/lib/format";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${d.getDate().toString().padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SampahPage() {
  const queryClient = useQueryClient();
  const [confirmingPurge, setConfirmingPurge] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", "trash"],
    queryFn: () => getDeletedProducts({ limit: 200 }),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dipulihkan");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const purgeMutation = useMutation({
    mutationFn: permanentDeleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dihapus permanen");
      setConfirmingPurge(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmingPurge(null);
    },
  });

  const products = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sampah</h1>
          <p className="text-xs text-muted mt-1">
            Produk yang dihapus. Pulihkan atau hapus permanen.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-text">
          ← Kembali
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted">Memuat data...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted">
          Sampah kosong.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Brand
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Nama Produk
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Harga Jual
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Dihapus
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-48">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr
                  key={p.id}
                  className={i % 2 === 0 ? "bg-surface" : "bg-bg"}
                >
                  <td className="px-3 py-2.5 text-muted text-xs">
                    {p.brand.name}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 font-[family-name:var(--font-dm-mono)] text-xs">
                    {p.harga_jual != null ? formatIDR(p.harga_jual) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted font-[family-name:var(--font-dm-mono)]">
                    {formatDate(p.deleted_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreMutation.mutate(p.id)}
                        disabled={restoreMutation.isPending}
                        className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-bg disabled:opacity-40"
                      >
                        Pulihkan
                      </button>
                      {confirmingPurge === p.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => purgeMutation.mutate(p.id)}
                            disabled={purgeMutation.isPending}
                            className="px-4 py-2.5 rounded-lg bg-red text-white text-sm font-medium disabled:opacity-40"
                          >
                            Hapus Permanen?
                          </button>
                          <button
                            onClick={() => setConfirmingPurge(null)}
                            className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted"
                          >
                            Batal
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmingPurge(p.id)}
                          className="px-4 py-2.5 rounded-lg text-sm text-red hover:bg-red-bg"
                        >
                          Hapus Permanen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
