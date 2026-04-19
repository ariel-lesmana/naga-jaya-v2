"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportExcel } from "@/lib/api";
import { ImportModal } from "./ImportModal";

export function NavActions() {
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `daftar_harga_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengekspor file");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors disabled:opacity-40"
        >
          {exporting ? (
            <span className="w-4 h-4 border-2 border-muted border-t-text rounded-full animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Export Excel
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors"
        >
          <Upload size={16} />
          Import Excel
        </button>
        <Link
          href="/products/new"
          className="bg-text text-surface px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Tambah Produk
        </Link>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}
