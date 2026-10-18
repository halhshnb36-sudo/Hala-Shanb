import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Dark full-bleed style used by the lightbox and video player. */
  bare?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide, bare }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          bare
            ? 'relative w-full max-w-5xl outline-none'
            : `card relative flex max-h-[92vh] w-full flex-col outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-b-none sm:rounded-b-2xl`
        }
      >
        {!bare && (
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold text-gold-300">{title}</h2>
            <button type="button" className="btn btn-plain btn-sm" onClick={onClose} aria-label="إغلاق">
              ✕
            </button>
          </div>
        )}
        <div className={bare ? '' : 'overflow-y-auto px-5 py-4'}>{children}</div>
        {footer && !bare && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
