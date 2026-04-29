"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Upload, Trash2, Calculator as CalculatorIcon, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { exportExcel } from "@/lib/api";
import { ImportModal } from "./ImportModal";
import { Calculator } from "./Calculator";

export function NavActions() {
  const [showImport, setShowImport] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
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
          onClick={() => setShowCalc(true)}
          className="flex items-center justify-center p-2 rounded-lg border border-border hover:bg-bg transition-colors"
          aria-label="Kalkulator"
          title="Kalkulator"
        >
          <CalculatorIcon size={16} />
        </button>
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
          href="/receipts"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors"
        >
          <ReceiptIcon size={16} />
          Kwitansi
        </Link>
        <Link
          href="/sampah"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors"
        >
          <Trash2 size={16} />
          Sampah
        </Link>
        <Link
          href="/brands/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-bg transition-colors"
        >
          Tambah Brand
        </Link>
        <Link
          href="/products/new"
          className="bg-text text-surface px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Tambah Produk
        </Link>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
    </>
  );
}
