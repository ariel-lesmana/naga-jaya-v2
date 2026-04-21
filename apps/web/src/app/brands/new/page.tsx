"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { createBrand, getBrands } from "@/lib/api";

export default function NewBrandPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const mutation = useMutation({
    mutationFn: createBrand,
    onSuccess: (brand) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`Brand "${brand.name}" ditambahkan`);
      setName("");
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama brand wajib diisi");
      return;
    }
    mutation.mutate({ name: trimmed });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-6 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Kembali
      </Link>

      <h1 className="text-2xl font-semibold mb-6">Tambah Brand Baru</h1>

      {error && (
        <div className="bg-red-bg text-red px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Brand *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
              placeholder="cth: WARDAH"
            />
            <p className="text-xs text-muted mt-1">
              Nama harus unik — tidak boleh sama dengan brand yang sudah ada.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 bg-text text-surface py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan Brand"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products/new")}
            className="px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-bg transition-colors"
          >
            Tambah Produk
          </button>
        </div>
      </form>

      {brands && brands.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
            Brand tersedia ({brands.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <span
                key={b.id}
                className="px-3 py-1 rounded-full border border-border text-xs text-muted bg-surface"
              >
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
