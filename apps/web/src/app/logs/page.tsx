"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, LogOut, RefreshCw, X } from "lucide-react";
import { getAuditLogs, getAuditLog } from "@/lib/api";
import { AuditLogDetail, AuditLogFilters } from "@/lib/types";

const TOKEN_KEY = "admin_token";

export default function LogsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="text-muted text-sm">Memuat...</div>;
  }

  if (!token) {
    return (
      <TokenGate
        onAuthenticated={(t) => {
          localStorage.setItem(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <LogsView
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

function TokenGate({ onAuthenticated }: { onAuthenticated: (t: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    setLoading(true);
    setError(null);
    try {
      await getAuditLogs(input, { limit: 1 });
      onAuthenticated(input);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === "UNAUTHORIZED" ? "Token salah" : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-lg font-semibold mb-4">Akses Logs</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Admin token"
          autoFocus
          className="w-full px-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        />
        {error && <div className="text-xs text-red">{error}</div>}
        <button
          type="submit"
          disabled={loading || !input}
          className="w-full px-4 py-2 rounded-lg bg-text text-surface text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}

function LogsView({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => getAuditLogs(token, filters),
    retry: false,
  });

  useEffect(() => {
    if ((error as Error)?.message === "UNAUTHORIZED") {
      onLogout();
    }
  }, [error, onLogout]);

  function updateFilter<K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const page = filters.page ?? 1;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold">Audit Logs</h1>
        <span className="text-xs text-muted">{total} entri</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
            title="Refresh"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 rounded hover:bg-bg transition-colors text-muted hover:text-text"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filters.method ?? ""}
          onChange={(e) => updateFilter("method", e.target.value || undefined)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        >
          <option value="">Semua method</option>
          <option value="POST">POST</option>
          <option value="PATCH">PATCH</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="text"
          placeholder="Cari path..."
          value={filters.path ?? ""}
          onChange={(e) => updateFilter("path", e.target.value || undefined)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        />
        <select
          value={filters.status_min ?? ""}
          onChange={(e) =>
            updateFilter(
              "status_min",
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        >
          <option value="">Semua status</option>
          <option value="400">4xx+</option>
          <option value="500">5xx only</option>
        </select>
        <select
          value={filters.limit ?? 50}
          onChange={(e) => updateFilter("limit", Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
        >
          <option value={25}>25 / halaman</option>
          <option value={50}>50 / halaman</option>
          <option value={100}>100 / halaman</option>
          <option value={200}>200 / halaman</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted">Memuat data...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted">Belum ada log</div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[140px_72px_1fr_64px_80px_40px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wider text-muted border-b border-border">
            <div>Waktu</div>
            <div>Method</div>
            <div>Path</div>
            <div className="text-right">Status</div>
            <div className="text-right">Durasi</div>
            <div></div>
          </div>
          {rows.map((row, i) => (
            <button
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              className={`w-full grid grid-cols-[140px_72px_1fr_64px_80px_40px] gap-3 px-4 py-2 text-sm text-left hover:bg-border/20 transition-colors ${
                i % 2 === 0 ? "bg-surface" : "bg-bg"
              }`}
            >
              <div className="font-[family-name:var(--font-dm-mono)] text-xs text-muted truncate">
                {formatTime(row.created_at)}
              </div>
              <div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${methodColor(row.method)}`}
                >
                  {row.method}
                </span>
              </div>
              <div className="font-[family-name:var(--font-dm-mono)] text-xs truncate">
                {row.path}
              </div>
              <div
                className={`text-right font-[family-name:var(--font-dm-mono)] text-xs ${statusColor(row.status_code)}`}
              >
                {row.status_code}
              </div>
              <div className="text-right font-[family-name:var(--font-dm-mono)] text-xs text-muted">
                {row.duration_ms}ms
              </div>
              <div className="text-muted text-xs">›</div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => updateFilter("page", Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm rounded border border-border disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => updateFilter("page", Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm rounded border border-border disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}

      {selectedId != null && (
        <LogDetailModal
          token={token}
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function LogDetailModal({
  token,
  id,
  onClose,
}: {
  token: string;
  id: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<AuditLogDetail>({
    queryKey: ["audit-log", id],
    queryFn: () => getAuditLog(token, id),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl border border-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Log #{id}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
          {isLoading || !data ? (
            <div className="text-muted">Memuat...</div>
          ) : (
            <>
              <Meta label="Waktu" value={new Date(data.created_at).toLocaleString("id-ID")} />
              <div className="grid grid-cols-2 gap-3">
                <Meta label="Method" value={data.method} />
                <Meta
                  label="Status"
                  value={
                    <span className={statusColor(data.status_code)}>
                      {data.status_code}
                    </span>
                  }
                />
                <Meta label="Path" value={data.path} mono />
                <Meta label="Durasi" value={`${data.duration_ms}ms`} mono />
                <Meta label="IP" value={data.ip ?? "—"} mono />
                <Meta
                  label="User-Agent"
                  value={data.user_agent ?? "—"}
                  mono
                  small
                />
              </div>

              {data.error_message && (
                <Section title="Error">
                  <pre className="text-xs text-red whitespace-pre-wrap">
                    {data.error_message}
                  </pre>
                </Section>
              )}

              {data.query != null && (
                <Section title="Query">
                  <Json value={data.query} />
                </Section>
              )}

              <Section title="Request body">
                <Json value={data.request_body} />
              </Section>

              <Section title="Response body">
                <Json value={data.response_body} />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">
        {label}
      </div>
      <div
        className={`${mono ? "font-[family-name:var(--font-dm-mono)]" : ""} ${small ? "text-xs" : "text-sm"} break-all`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Json({ value }: { value: unknown }) {
  if (value == null) {
    return <div className="text-xs text-muted">—</div>;
  }
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="text-xs font-[family-name:var(--font-dm-mono)] bg-bg border border-border rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap break-all">
      {text}
    </pre>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function methodColor(method: string): string {
  switch (method) {
    case "POST":
      return "bg-green/20 text-green";
    case "PATCH":
    case "PUT":
      return "bg-amber-bg text-amber";
    case "DELETE":
      return "bg-red/20 text-red";
    default:
      return "bg-border/40 text-muted";
  }
}

function statusColor(status: number): string {
  if (status >= 500) return "text-red";
  if (status >= 400) return "text-amber";
  if (status >= 300) return "text-muted";
  return "text-green";
}
