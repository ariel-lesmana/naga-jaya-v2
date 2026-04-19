"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { previewImport, commitImport } from "@/lib/api";
import { DiffResult, ParsedRow, ImportResult } from "@/lib/types";
import { formatIDR } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Step = 1 | 2 | 3;

export function ImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [createNew, setCreateNew] = useState(true);
  const [createBrands, setCreateBrands] = useState(true);

  // Step 3
  const [result, setResult] = useState<ImportResult | null>(null);

  // Collapsible sections
  const [showChanged, setShowChanged] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showUnknown, setShowUnknown] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError("Format file harus .xlsx atau .xls");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await previewImport(file);
      setRows(res.rows);
      setDiff(res.diff);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Gagal memproses file");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!diff) return;
    setLoading(true);
    try {
      const res = await commitImport(rows, {
        create_new: createNew,
        update_existing: updateExisting,
        create_brands: createBrands,
      });
      setResult(res);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan import");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 3) {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose();
      }}
    >
      <div className="bg-surface w-full h-full md:h-auto md:max-h-[90vh] md:max-w-[800px] md:rounded-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import Excel</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Upload" },
            { n: 2, label: "Preview" },
            { n: 3, label: "Selesai" },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step >= n
                    ? "bg-text text-surface"
                    : "border border-border text-muted"
                }`}
              >
                {n}
              </div>
              <span
                className={step >= n ? "text-text font-medium" : "text-muted"}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? "border-text bg-bg"
                    : "border-border hover:border-border2"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <FileSpreadsheet
                  size={40}
                  className="mx-auto mb-3 text-muted"
                />
                <p className="text-sm text-muted mb-3">
                  Drag & drop file Excel, atau
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors"
                >
                  Pilih File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-bg rounded-lg text-sm">
                  <FileSpreadsheet size={18} className="text-green shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted shrink-0">
                    {formatSize(file.size)}
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-bg text-red text-sm rounded-lg">
                  {error}
                </div>
              )}

              <a
                href={`${API_URL}/import/template`}
                className="text-xs text-muted hover:text-text underline underline-offset-2 transition-colors"
              >
                Unduh Template
              </a>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-bg transition-colors"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="px-4 py-2 rounded-lg bg-text text-surface text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {loading ? "Memproses..." : "Lanjut"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && diff && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-bg rounded-xl p-4 space-y-1.5 text-sm">
                {diff.updated_products.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-green">&#10003;</span>
                    <span>
                      {diff.updated_products.length} produk berubah
                    </span>
                  </div>
                )}
                {diff.new_products.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span>&#10024;</span>
                    <span>{diff.new_products.length} produk baru</span>
                  </div>
                )}
                {diff.unchanged_products.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted">&#9193;</span>
                    <span className="text-muted">
                      {diff.unchanged_products.length} tidak berubah
                    </span>
                  </div>
                )}
                {diff.unknown_brands.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-amber">&#9888;</span>
                    <span>
                      {diff.unknown_brands.length} brand tidak ditemukan:{" "}
                      {diff.unknown_brands.join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Collapsible: Changed products */}
              {diff.updated_products.length > 0 && (
                <CollapsibleSection
                  title={`Produk Berubah (${diff.updated_products.length})`}
                  open={showChanged}
                  onToggle={() => setShowChanged(!showChanged)}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 font-medium text-muted">
                            Nama Produk
                          </th>
                          <th className="text-left py-2 px-2 font-medium text-muted">
                            Brand
                          </th>
                          <th className="text-left py-2 px-2 font-medium text-muted">
                            Field yang Berubah
                          </th>
                          <th className="text-left py-2 px-2 font-medium text-muted">
                            Nilai Lama
                          </th>
                          <th className="text-left py-2 px-2 font-medium text-muted">
                            Nilai Baru
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.updated_products.map((d, i) => {
                          const firstField = d.changed_fields[0];
                          const oldVal =
                            (d.existing as any)[firstField] != null
                              ? (d.existing as any)[firstField]
                              : "\u2014";
                          const newVal =
                            (d.incoming as any)[firstField] != null
                              ? (d.incoming as any)[firstField]
                              : "\u2014";
                          return (
                            <tr
                              key={i}
                              className={
                                i % 2 === 0 ? "bg-surface" : "bg-bg"
                              }
                            >
                              <td className="py-1.5 px-2 max-w-[180px] truncate">
                                {d.incoming.name}
                              </td>
                              <td className="py-1.5 px-2 text-muted">
                                {d.incoming.brand_name}
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="flex flex-wrap gap-1">
                                  {d.changed_fields.map((f) => (
                                    <span
                                      key={f}
                                      className="px-1.5 py-0.5 bg-amber-bg text-amber rounded text-[10px] font-medium"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 font-[family-name:var(--font-dm-mono)]">
                                {typeof oldVal === "number"
                                  ? formatIDR(oldVal)
                                  : oldVal}
                              </td>
                              <td className="py-1.5 px-2 font-[family-name:var(--font-dm-mono)] font-medium">
                                {typeof newVal === "number"
                                  ? formatIDR(newVal)
                                  : newVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {/* Collapsible: New products */}
              {diff.new_products.length > 0 && (
                <CollapsibleSection
                  title={`Produk Baru (${diff.new_products.length})`}
                  open={showNew}
                  onToggle={() => setShowNew(!showNew)}
                >
                  <div className="space-y-1">
                    {diff.new_products.map((p, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 py-1.5 px-2 text-xs rounded ${
                          i % 2 === 0 ? "bg-surface" : "bg-bg"
                        }`}
                      >
                        <span className="font-medium truncate flex-1">
                          {p.name}
                        </span>
                        <span className="text-muted shrink-0">
                          {p.brand_name}
                        </span>
                        <span className="font-[family-name:var(--font-dm-mono)] shrink-0">
                          {p.harga_jual != null
                            ? formatIDR(p.harga_jual)
                            : "\u2014"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Collapsible: Unknown brands */}
              {diff.unknown_brands.length > 0 && (
                <CollapsibleSection
                  title={`Brand Tidak Dikenal (${diff.unknown_brands.length})`}
                  open={showUnknown}
                  onToggle={() => setShowUnknown(!showUnknown)}
                >
                  <div className="space-y-1 text-xs">
                    {diff.unknown_brands.map((b, i) => (
                      <div key={i} className="py-1 px-2">
                        <span className="font-medium">{b}</span>
                      </div>
                    ))}
                    <p className="text-muted italic px-2 pt-1">
                      Akan dibuat otomatis jika diaktifkan
                    </p>
                  </div>
                </CollapsibleSection>
              )}

              {/* Options */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="rounded"
                  />
                  Perbarui produk yang berubah
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createNew}
                    onChange={(e) => setCreateNew(e.target.checked)}
                    className="rounded"
                  />
                  Tambah produk baru
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBrands}
                    onChange={(e) => setCreateBrands(e.target.checked)}
                    className="rounded"
                  />
                  Buat brand baru otomatis
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-bg transition-colors"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleCommit}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-text text-surface text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {loading ? "Menyimpan..." : "Simpan Import"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && result && (
            <div className="space-y-4">
              <div className="bg-green-bg text-green rounded-xl p-6 text-center">
                <p className="text-lg font-semibold mb-3">
                  &#10003; Import selesai
                </p>
                <div className="space-y-1 text-sm">
                  {result.updated > 0 && (
                    <p>{result.updated} produk diperbarui</p>
                  )}
                  {result.inserted > 0 && (
                    <p>{result.inserted} produk ditambahkan</p>
                  )}
                  {result.skipped > 0 && (
                    <p className="text-muted">
                      {result.skipped} dilewati (tidak berubah)
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <CollapsibleSection
                  title={`Error (${result.errors.length})`}
                  open={showErrors}
                  onToggle={() => setShowErrors(!showErrors)}
                >
                  <div className="space-y-1 text-xs">
                    {result.errors.map((e, i) => (
                      <div
                        key={i}
                        className="py-1 px-2 bg-red-bg text-red rounded"
                      >
                        Baris {e.row}: {e.name} — {e.reason}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg bg-text text-surface text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-bg transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={16} className="text-muted shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-muted shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="px-4 pb-3 border-t border-border">{children}</div>}
    </div>
  );
}
