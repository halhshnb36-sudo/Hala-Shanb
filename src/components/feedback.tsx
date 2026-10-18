import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}
interface Ctx {
  push: (kind: ToastKind, text: string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const FeedbackCtx = createContext<Ctx>({ push: () => {}, confirm: async () => false });

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 4000);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setDialog(o);
      }),
    [],
  );

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <FeedbackCtx.Provider value={{ push, confirm }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${
              t.kind === 'success'
                ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
                : t.kind === 'error'
                  ? 'border-red-700 bg-red-950 text-red-100'
                  : 'border-line bg-panel text-zinc-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
      <Modal
        open={dialog !== null}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        footer={
          <>
            <button type="button" className="btn btn-plain" onClick={() => close(false)}>
              إلغاء
            </button>
            <button
              type="button"
              className={`btn ${dialog?.danger ? 'btn-danger' : 'btn-gold'}`}
              onClick={() => close(true)}
            >
              {dialog?.confirmText ?? 'تأكيد'}
            </button>
          </>
        }
      >
        <p className="leading-8 text-zinc-300">{dialog?.message}</p>
      </Modal>
    </FeedbackCtx.Provider>
  );
}

export const useToast = () => {
  const { push } = useContext(FeedbackCtx);
  return {
    success: (t: string) => push('success', t),
    error: (t: string) => push('error', t),
    info: (t: string) => push('info', t),
  };
};
export const useConfirm = () => useContext(FeedbackCtx).confirm;
