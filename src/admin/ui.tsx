import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { formatNumber } from '@/lib/utils';

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold gold-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'gold' | 'red'; children: ReactNode }) {
  const cls =
    tone === 'green'
      ? 'border-emerald-700 bg-emerald-950 text-emerald-200'
      : tone === 'gold'
        ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
        : tone === 'red'
          ? 'border-red-800 bg-red-950 text-red-200'
          : 'border-line bg-panel text-zinc-300';
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <input
        id={id}
        type="checkbox"
        className="h-5 w-5 cursor-pointer"
        style={{ accentColor: 'var(--g500)' }}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="التنقل بين الصفحات">
      <button type="button" className="btn btn-plain btn-sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span className="text-sm text-zinc-300">
        صفحة {formatNumber(page + 1)} من {formatNumber(pages)} · {formatNumber(total)} عنصر
      </span>
      <button type="button" className="btn btn-plain btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </nav>
  );
}

/** Warns before leaving the page (closing the tab, refreshing) while there are unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}
