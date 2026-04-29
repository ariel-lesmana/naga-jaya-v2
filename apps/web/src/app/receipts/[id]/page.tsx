'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deleteReceipt,
  duplicateReceipt,
  finalizeReceipt,
  getReceipt,
  updateReceipt,
} from '@/lib/api';
import { ReceiptItemsGrid } from '@/components/ReceiptItemsGrid';

export default function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => getReceipt(id),
  });

  const [customer, setCustomer] = useState('');
  const [customerDirty, setCustomerDirty] = useState(false);

  useEffect(() => {
    if (receipt && !customerDirty) {
      setCustomer(receipt.customer_name ?? '');
    }
  }, [receipt, customerDirty]);

  const updateCustomerMut = useMutation({
    mutationFn: (v: string) => updateReceipt(id, { customer_name: v || null }),
    onSuccess: (data) => {
      queryClient.setQueryData(['receipt', id], data);
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal menyimpan nama'),
  });

  useEffect(() => {
    if (!customerDirty) return;
    const t = setTimeout(() => {
      updateCustomerMut.mutate(customer);
      setCustomerDirty(false);
    }, 500);
    return () => clearTimeout(t);
  }, [customer, customerDirty, updateCustomerMut]);

  const finalizeMut = useMutation({
    mutationFn: () => finalizeReceipt(id),
    onSuccess: (data) => {
      queryClient.setQueryData(['receipt', id], data);
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Kwitansi difinalisasi');
    },
    onError: (e: unknown) => {
      const err = e as Error & { errors?: string[] };
      const msg = err.message || 'Gagal finalisasi';
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Kwitansi dihapus');
      router.push('/receipts');
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal hapus'),
  });

  const duplicateMut = useMutation({
    mutationFn: () => duplicateReceipt(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success(`Kwitansi diduplikat #${data.id}`);
      router.push(`/receipts/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal duplikat'),
  });

  if (isLoading || !receipt) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="h-20 bg-border rounded-xl animate-pulse" />
      </div>
    );
  }

  const isFinalized = receipt.status === 'FINALIZED';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-4 no-print">
        <Link
          href="/receipts"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-text"
        >
          ← Kembali
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded ${
              isFinalized
                ? 'bg-green/10 text-green'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            {isFinalized ? 'FINAL' : 'DRAFT'}
          </span>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-bg"
          >
            Cetak
          </button>
          {isFinalized && (
            <button
              onClick={() => duplicateMut.mutate()}
              disabled={duplicateMut.isPending}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-bg disabled:opacity-50"
            >
              {duplicateMut.isPending ? 'Menduplikat…' : 'Duplikat'}
            </button>
          )}
          {!isFinalized && (
            <button
              onClick={() => {
                if (confirm('Hapus kwitansi draft ini?')) deleteMut.mutate();
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-red hover:bg-red-bg"
            >
              Hapus
            </button>
          )}
          {!isFinalized && (
            <button
              onClick={() => finalizeMut.mutate()}
              disabled={finalizeMut.isPending}
              className="px-4 py-1.5 rounded-lg bg-text text-surface text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {finalizeMut.isPending ? 'Menyimpan…' : 'Finalisasi'}
            </button>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-semibold mb-1 no-print">
        Kwitansi #{receipt.id}
      </h1>
      <p className="text-xs text-muted mb-6 no-print">
        Dibuat {new Date(receipt.created_at).toLocaleString('id-ID')}
        {receipt.finalized_at &&
          ` · Final ${new Date(receipt.finalized_at).toLocaleString('id-ID')}`}
      </p>

      <div className="bg-surface border border-border rounded-xl p-4 mb-4 no-print">
        <label className="block text-xs text-muted mb-1">Nama Pelanggan</label>
        <input
          type="text"
          value={customer}
          disabled={isFinalized}
          onChange={(e) => {
            setCustomer(e.target.value);
            setCustomerDirty(true);
          }}
          placeholder="Opsional"
          className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border2"
        />
      </div>

      <div className="hidden print:block mb-2 text-[10px] leading-tight">
        <div className="font-semibold">Kwitansi #{receipt.id}</div>
        <div>{new Date(receipt.created_at).toLocaleString('id-ID')}</div>
        {customer && <div>Pelanggan: {customer}</div>}
      </div>

      <ReceiptItemsGrid receipt={receipt} readOnly={isFinalized} />
    </div>
  );
}
