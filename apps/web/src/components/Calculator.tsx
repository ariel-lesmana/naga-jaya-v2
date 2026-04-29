"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Delete, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Op = "+" | "-" | "*" | "/";

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
  }
}

function formatDisplay(value: string): string {
  if (value === "Error") return value;
  const [intPart, decPart] = value.split(".");
  const neg = intPart.startsWith("-");
  const absInt = neg ? intPart.slice(1) : intPart;
  const withSep = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const formatted = (neg ? "-" : "") + withSep;
  return decPart !== undefined ? `${formatted},${decPart}` : formatted;
}

function toPlainNumber(value: string): string | null {
  if (value === "Error") return null;
  const n = parseFloat(value);
  if (!isFinite(n)) return null;
  return String(Math.round(n));
}

async function copyText(text: string): Promise<void> {
  if (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to legacy fallback
    }
  }
  if (typeof document === "undefined") {
    throw new Error("Clipboard tidak tersedia");
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
  if (!ok) throw new Error("execCommand copy gagal");
}

export function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputDigit = useCallback(
    (d: string) => {
      setDisplay((cur) => {
        if (cur === "Error") return d;
        if (waitingForNext) {
          setWaitingForNext(false);
          return d;
        }
        if (cur === "0") return d;
        if (cur.replace(/[-.]/g, "").length >= 14) return cur;
        return cur + d;
      });
    },
    [waitingForNext]
  );

  const inputDot = useCallback(() => {
    setDisplay((cur) => {
      if (cur === "Error") return "0.";
      if (waitingForNext) {
        setWaitingForNext(false);
        return "0.";
      }
      if (cur.includes(".")) return cur;
      return cur + ".";
    });
  }, [waitingForNext]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setWaitingForNext(false);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((cur) => {
      if (cur === "Error" || waitingForNext) return "0";
      if (cur.length <= 1 || (cur.length === 2 && cur.startsWith("-"))) return "0";
      return cur.slice(0, -1);
    });
  }, [waitingForNext]);

  const toggleSign = useCallback(() => {
    setDisplay((cur) => {
      if (cur === "Error" || cur === "0") return cur;
      return cur.startsWith("-") ? cur.slice(1) : "-" + cur;
    });
  }, []);

  const percent = useCallback(() => {
    setDisplay((cur) => {
      if (cur === "Error") return cur;
      const n = parseFloat(cur);
      if (!isFinite(n)) return "Error";
      return String(n / 100);
    });
  }, []);

  const applyOp = useCallback(
    (nextOp: Op) => {
      const current = parseFloat(display);
      if (display === "Error" || !isFinite(current)) {
        clearAll();
        return;
      }
      if (prev === null) {
        setPrev(current);
      } else if (!waitingForNext && op) {
        const result = compute(prev, current, op);
        if (!isFinite(result)) {
          setDisplay("Error");
          setPrev(null);
          setOp(null);
          setWaitingForNext(false);
          return;
        }
        setPrev(result);
        setDisplay(String(result));
      }
      setOp(nextOp);
      setWaitingForNext(true);
    },
    [display, prev, op, waitingForNext, clearAll]
  );

  const equals = useCallback(() => {
    if (op === null || prev === null) return;
    const current = parseFloat(display);
    if (display === "Error" || !isFinite(current)) return;
    const result = compute(prev, current, op);
    if (!isFinite(result)) {
      setDisplay("Error");
    } else {
      setDisplay(String(result));
    }
    setPrev(null);
    setOp(null);
    setWaitingForNext(true);
  }, [op, prev, display]);

  const copyResult = useCallback(async () => {
    const plain = toPlainNumber(display);
    if (plain === null) {
      toast.error("Tidak ada hasil untuk disalin");
      return;
    }
    try {
      await copyText(plain);
      setCopied(true);
      toast.success(`Disalin: ${plain}`);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      toast.error(`Gagal menyalin: ${msg}`);
    }
  }, [display]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k >= "0" && k <= "9") {
        inputDigit(k);
      } else if (k === "." || k === ",") {
        inputDot();
      } else if (k === "+" || k === "-" || k === "*" || k === "/") {
        e.preventDefault();
        applyOp(k as Op);
      } else if (k === "Enter" || k === "=") {
        e.preventDefault();
        equals();
      } else if (k === "Backspace") {
        backspace();
      } else if (k === "Escape") {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && (k === "c" || k === "C")) {
        e.preventDefault();
        copyResult();
      } else if (k === "Delete" || k === "c" || k === "C") {
        clearAll();
      } else if (k === "%") {
        percent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDigit, inputDot, applyOp, equals, backspace, clearAll, percent, copyResult, onClose]);

  const btn =
    "h-12 rounded-lg font-semibold text-base transition-colors active:scale-[0.97] select-none";
  const numBtn = `${btn} bg-bg hover:bg-border/60 text-text`;
  const opBtn = `${btn} bg-text/10 hover:bg-text/20 text-text`;
  const accentBtn = `${btn} bg-text text-surface hover:opacity-90`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-surface shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Kalkulator</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={copyResult}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-bg transition-colors"
              aria-label="Salin hasil"
              title="Salin hasil (bulat, tanpa pemisah ribuan)"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Tersalin" : "Salin"}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg transition-colors"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-lg bg-bg px-3 py-4 min-h-[72px] flex flex-col items-end justify-end">
            <div className="text-xs text-muted h-4">
              {prev !== null && op ? `${formatDisplay(String(prev))} ${op}` : ""}
            </div>
            <div className="text-3xl font-semibold tabular-nums break-all text-right">
              {formatDisplay(display)}
            </div>
            <div className="text-[11px] text-muted mt-1 tabular-nums">
              Salin: {toPlainNumber(display) ?? "—"}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button className={opBtn} onClick={clearAll}>
              AC
            </button>
            <button className={opBtn} onClick={toggleSign}>
              +/-
            </button>
            <button className={opBtn} onClick={percent}>
              %
            </button>
            <button className={opBtn} onClick={() => applyOp("/")}>
              ÷
            </button>

            <button className={numBtn} onClick={() => inputDigit("7")}>
              7
            </button>
            <button className={numBtn} onClick={() => inputDigit("8")}>
              8
            </button>
            <button className={numBtn} onClick={() => inputDigit("9")}>
              9
            </button>
            <button className={opBtn} onClick={() => applyOp("*")}>
              ×
            </button>

            <button className={numBtn} onClick={() => inputDigit("4")}>
              4
            </button>
            <button className={numBtn} onClick={() => inputDigit("5")}>
              5
            </button>
            <button className={numBtn} onClick={() => inputDigit("6")}>
              6
            </button>
            <button className={opBtn} onClick={() => applyOp("-")}>
              −
            </button>

            <button className={numBtn} onClick={() => inputDigit("1")}>
              1
            </button>
            <button className={numBtn} onClick={() => inputDigit("2")}>
              2
            </button>
            <button className={numBtn} onClick={() => inputDigit("3")}>
              3
            </button>
            <button className={opBtn} onClick={() => applyOp("+")}>
              +
            </button>

            <button className={`${numBtn} col-span-2`} onClick={() => inputDigit("0")}>
              0
            </button>
            <button className={numBtn} onClick={inputDot}>
              ,
            </button>
            <button className={accentBtn} onClick={equals}>
              =
            </button>

            <button
              className={`${opBtn} col-span-4 flex items-center justify-center gap-2`}
              onClick={backspace}
              aria-label="Hapus"
            >
              <Delete size={16} />
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
