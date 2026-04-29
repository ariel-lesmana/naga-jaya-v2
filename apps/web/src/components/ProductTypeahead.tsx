'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/lib/api';
import { ReceiptItemProduct } from '@/lib/types';

interface Props {
  value: ReceiptItemProduct | null;
  onPick: (product: ReceiptItemProduct | null) => void;
  onCreate?: (query: string) => void;
  onEnter?: () => void;
  onTab?: (shift: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface ProductTypeaheadHandle {
  focus: () => void;
}

export const ProductTypeahead = forwardRef<ProductTypeaheadHandle, Props>(
  function ProductTypeahead(
    { value, onPick, onCreate, onEnter, onTab, placeholder, disabled },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [query, setQuery] = useState(value?.name ?? '');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      setQuery(value?.name ?? '');
    }, [value?.id, value?.name]);

    const [debounced, setDebounced] = useState(query);
    useEffect(() => {
      const t = setTimeout(() => setDebounced(query), 200);
      return () => clearTimeout(t);
    }, [query]);

    const enabled = open && debounced.trim().length >= 1;

    const { data } = useQuery({
      queryKey: ['products-search', debounced],
      queryFn: () => getProducts({ search: debounced, limit: 8 }),
      enabled,
      staleTime: 10_000,
    });

    const results = useMemo<ReceiptItemProduct[]>(() => {
      return (data?.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        brand_id: p.brand_id,
        harga_jual: p.harga_jual,
        harga_jual_per_lusin: p.harga_jual_per_lusin,
        harga_jual_per_pak: p.harga_jual_per_pak,
        harga_jual_per_kotak: p.harga_jual_per_kotak,
        harga_jual_per_karton: p.harga_jual_per_karton,
        deleted_at: p.deleted_at,
      }));
    }, [data]);

    useEffect(() => {
      setHighlight(0);
    }, [debounced]);

    function pick(p: ReceiptItemProduct | null) {
      onPick(p);
      setOpen(false);
      if (p) setQuery(p.name);
    }

    const trimmedQuery = query.trim();
    const hasExact = results.some(
      (r) => r.name.trim().toLowerCase() === trimmedQuery.toLowerCase(),
    );
    const showCreate =
      Boolean(onCreate) && trimmedQuery.length >= 1 && !hasExact;
    const createIndex = showCreate ? results.length : -1;
    const maxIndex = Math.max(0, results.length - 1 + (showCreate ? 1 : 0));

    function handleKey(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, maxIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        if (open && highlight === createIndex && showCreate) {
          e.preventDefault();
          onCreate?.(trimmedQuery);
          setOpen(false);
          return;
        }
        if (open && results[highlight]) {
          e.preventDefault();
          pick(results[highlight]);
          return;
        }
        if (onEnter) {
          e.preventDefault();
          onEnter();
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'Tab') {
        if (open && results[highlight] && query !== value?.name) {
          pick(results[highlight]);
        } else {
          setOpen(false);
        }
        if (onTab) onTab(e.shiftKey);
      }
    }

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder ?? 'Cari barang…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== value.name) onPick(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKey}
          className="w-full px-2 py-1 bg-transparent outline-none text-sm"
        />
        {open && (results.length > 0 || showCreate) && (
          <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-auto text-sm">
            {results.map((r, i) => (
              <li
                key={r.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-2 cursor-pointer ${
                  i === highlight ? 'bg-bg' : ''
                }`}
              >
                {r.name}
              </li>
            ))}
            {showCreate && (
              <li
                key="__create"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreate?.(trimmedQuery);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(createIndex)}
                className={`px-3 py-2 cursor-pointer border-t border-border text-green ${
                  highlight === createIndex ? 'bg-bg' : ''
                }`}
              >
                + Buat baru: <span className="font-medium">{trimmedQuery}</span>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  },
);
