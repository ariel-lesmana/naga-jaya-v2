'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createReceipt } from '@/lib/api';
import { toast } from 'sonner';

export default function NewReceiptPage() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const created = await createReceipt();
        router.replace(`/receipts/${created.id}`);
      } catch (e) {
        const err = e as Error;
        toast.error(err.message || 'Gagal membuka kwitansi');
      }
    })();
  }, [router]);

  return (
    <div className="max-w-xl mx-auto py-12 text-center text-sm text-muted">
      Menyiapkan kwitansi…
    </div>
  );
}
