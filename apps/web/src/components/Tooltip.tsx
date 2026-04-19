'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && coords && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-2.5 py-1.5 rounded-md text-xs text-white max-w-[240px] w-max pointer-events-none"
          style={{
            backgroundColor: '#1A1A18',
            left: coords.left,
            top: coords.top,
            transform: coords.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: '12px',
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
    <span className="inline-flex items-center ml-1 text-muted/60 hover:text-muted cursor-help" tabIndex={0}>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    </span>
  );
}
