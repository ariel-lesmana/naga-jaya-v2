'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const visible = hovered || pinned;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const spaceAbove = rect.top;
    const above = spaceAbove > 60;
    setCoords({
      left: centerX,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  }, []);

  useEffect(() => {
    if (visible) updatePosition();
  }, [visible, updatePosition]);

  // Clamp tooltip so it doesn't overflow viewport edges
  useEffect(() => {
    if (!visible || !tooltipRef.current || !coords) return;
    const el = tooltipRef.current;
    const tooltipRect = el.getBoundingClientRect();
    const pad = 8;
    if (tooltipRect.left < pad) {
      el.style.transform = `translateX(0)`;
      el.style.left = `${pad}px`;
    } else if (tooltipRect.right > window.innerWidth - pad) {
      el.style.transform = `translateX(0)`;
      el.style.left = `${window.innerWidth - pad - tooltipRect.width}px`;
    }
  }, [visible, coords]);

  // Outside-tap dismisses pinned tooltip
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      setPinned(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [pinned]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setPinned((p) => !p);
      }}
    >
      {children}
      {visible && coords && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 rounded-md text-xs text-white max-w-[280px] w-max"
          style={{
            backgroundColor: '#1A1A18',
            left: coords.left,
            top: coords.top,
            transform: coords.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: '13px',
            lineHeight: '1.4',
          }}
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}

export function InfoIcon() {
  return (
    <span className="inline-flex items-center justify-center ml-1 -my-1 p-1 text-muted/60 hover:text-muted cursor-help" tabIndex={0}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    </span>
  );
}
