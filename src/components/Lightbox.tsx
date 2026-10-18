import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxItem {
  id: string;
  src: string;
  title?: string | null;
  description?: string | null;
}

interface Props {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}

/** Full-screen photo viewer: Esc closes, arrow keys navigate (left = next, matching Arabic reading direction). */
export function Lightbox({ items, index, onClose, onIndex }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  const next = () => onIndex((index + 1) % items.length);
  const prev = () => onIndex((index - 1 + items.length) % items.length);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') next();
      else if (e.key === 'ArrowRight') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!item) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || 'عرض الصورة'}
    >
      <div className="flex items-center justify-between p-3">
        <span className="text-sm text-zinc-400" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button ref={closeRef} type="button" className="btn btn-plain btn-sm" onClick={onClose} aria-label="إغلاق">
          ✕ إغلاق
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-14" onClick={onClose}>
        {items.length > 1 && (
          <button
            type="button"
            className="btn btn-plain absolute left-2 top-1/2 z-10 -translate-y-1/2 !px-3 text-xl"
            aria-label="الصورة التالية"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            ‹
          </button>
        )}
        <img
          src={item.src}
          alt={item.title || 'صورة من معرض هالة شنب'}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {items.length > 1 && (
          <button
            type="button"
            className="btn btn-plain absolute right-2 top-1/2 z-10 -translate-y-1/2 !px-3 text-xl"
            aria-label="الصورة السابقة"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            ›
          </button>
        )}
      </div>

      {(item.title || item.description) && (
        <div className="mx-auto max-h-40 w-full max-w-3xl overflow-y-auto p-4 text-center">
          {item.title && <h2 className="font-display text-xl gold-text">{item.title}</h2>}
          {item.description && <p className="mt-1 text-sm leading-7 text-zinc-300">{item.description}</p>}
        </div>
      )}
    </div>,
    document.body,
  );
}
