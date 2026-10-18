import type { ReactNode } from 'react';

export function Loading({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-zinc-400" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-lg rounded-2xl border border-red-900/70 bg-red-950/40 p-6 text-center" role="alert">
      <p className="mb-4 text-red-100">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto my-6 max-w-lg rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 text-3xl text-gold-500" aria-hidden="true">
        ✦
      </div>
      <h3 className="mb-1 text-lg font-bold text-zinc-100">{title}</h3>
      {text && <p className="text-sm text-zinc-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
