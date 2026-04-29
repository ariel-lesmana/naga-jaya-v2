'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteReceipt,
  listReceipts,
  listTrashedReceipts,
  permanentDeleteReceipt,
  restoreReceipt,
} from '@/lib/api';
import { ReceiptStatus } from '@/lib/types';

type Tab = 'all' | 'draft' | 'final' | 'trash';
const PAGE_SIZE = 10;

const TABS: { v: Tab; label: string }[] = [
  { v: 'all', label: 'Semua' },
  { v: 'draft', label: 'Draft' },
  { v: 'final', label: 'Final' },
  { v: 'trash', label: 'Trash' },
];

export default function ReceiptsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [page, setPage] = useState(1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(search.trim());
      setSuggestQuery(search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, appliedSearch]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestQuery]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const status: ReceiptStatus | undefined = useMemo(() => {
    if (tab === 'draft') return 'DRAFT';
    if (tab === 'final') return 'FINALIZED';
    return undefined;
  }, [tab]);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', tab, status, appliedSearch, page],
    queryFn: () => {
      const params = {
        status,
        search: appliedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      };
      return tab === 'trash'
        ? listTrashedReceipts(params)
        : listReceipts(params);
    },
  });

  const suggestEnabled = suggestOpen && suggestQuery.length >= 1;
  const { data: suggestData } = useQuery({
    queryKey: ['receipts-suggest', tab, status, suggestQuery],
    queryFn: () => {
      const params = { status, search: suggestQuery, page: 1, limit: 20 };
      return tab === 'trash'
        ? listTrashedReceipts(params)
        : listReceipts(params);
    },
    enabled: suggestEnabled,
    staleTime: 10_000,
  });

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of suggestData?.data ?? []) {
      const name = r.customer_name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= 8) break;
    }
    return out;
  }, [suggestData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    queryClient.invalidateQueries({ queryKey: ['receipts-suggest'] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteReceipt(id),
    onSuccess: () => {
      toast.success('Dipindahkan ke trash');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal hapus'),
  });

  const restoreMut = useMutation({
    mutationFn: (id: number) => restoreReceipt(id),
    onSuccess: () => {
      toast.success('Kwitansi dipulihkan');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal pulihkan'),
  });

  const permanentMut = useMutation({
    mutationFn: (id: number) => permanentDeleteReceipt(id),
    onSuccess: () => {
      toast.success('Kwitansi dihapus permanen');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal hapus permanen'),
  });

  function pickSuggestion(name: string) {
    setSearch(name);
    setAppliedSearch(name);
    setSuggestQuery(name);
    setSuggestOpen(false);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const choice = suggestions[highlight];
      if (choice) {
        e.preventDefault();
        pickSuggestion(choice);
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
    }
  }

  const totalPages = data?.totalPages ?? 1;
  const isTrash = tab === 'trash';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Kwitansi</h1>
        <Link
          href="/receipts/new"
          className="flex items-center gap-1.5 bg-text text-surface px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Kwitansi Baru
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl w-fit text-sm">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`px-3 py-1.5 rounded-lg ${
                tab === t.v
                  ? 'bg-text text-surface'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          ref={wrapperRef}
          className="relative flex-1 min-w-[200px] max-w-sm"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => {
              if (search.trim()) setSuggestOpen(true);
            }}
            onKeyDown={onSearchKey}
            placeholder="Cari nama pelanggan…"
            className="w-full px-3 py-2 pr-8 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-border2"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setAppliedSearch('');
                setSuggestOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
          {suggestOpen && suggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-auto text-sm">
              {suggestions.map((name, i) => (
                <li
                  key={name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(name);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-3 py-2 cursor-pointer ${
                    i === highlight ? 'bg-bg' : ''
                  }`}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left">
            <tr>
              <th className="px-4 py-2 w-16">#</th>
              <th className="px-4 py-2">Pelanggan</th>
              <th className="px-4 py-2 w-24">Status</th>
              <th className="px-4 py-2 w-20 text-right">Items</th>
              <th className="px-4 py-2 w-44">
                {isTrash ? 'Dihapus' : 'Dibuat'}
              </th>
              <th className="px-4 py-2 w-28 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Memuat…
                </td>
              </tr>
            )}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  {isTrash
                    ? 'Trash kosong.'
                    : appliedSearch
                      ? 'Tidak ada hasil pencarian.'
                      : 'Belum ada kwitansi.'}
                </td>
              </tr>
            )}
            {data?.data.map((r) => {
              const customerLabel = r.customer_name?.trim() || '—';
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/receipts/${r.id}`)}
                  className="border-t border-border hover:bg-bg cursor-pointer"
                >
                  <td className="px-4 py-2 tabular-nums">{r.id}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.customer_name
                          ? 'text-text font-medium'
                          : 'text-muted'
                      }
                    >
                      {customerLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        r.status === 'FINALIZED'
                          ? 'bg-green/10 text-green'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.item_count}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {new Date(r.created_at).toLocaleString('id-ID')}
                  </td>
                  <td
                    className="px-4 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isTrash ? (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => restoreMut.mutate(r.id)}
                          disabled={restoreMut.isPending}
                          className="p-1.5 rounded-lg border border-border text-muted hover:text-text hover:bg-bg disabled:opacity-50"
                          title="Pulihkan"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus permanen kwitansi #${r.id}? Tidak bisa dibatalkan.`,
                              )
                            )
                              permanentMut.mutate(r.id);
                          }}
                          disabled={permanentMut.isPending}
                          className="p-1.5 rounded-lg border border-border text-red hover:bg-red-bg disabled:opacity-50"
                          title="Hapus permanen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Pindahkan kwitansi #${r.id} ke trash?`))
                            deleteMut.mutate(r.id);
                        }}
                        disabled={deleteMut.isPending}
                        className="p-1.5 rounded-lg border border-border text-muted hover:text-red hover:bg-red-bg disabled:opacity-50"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-40 hover:bg-bg transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-muted font-[family-name:var(--font-dm-mono)]">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-sm disabled:opacity-40 hover:bg-bg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
