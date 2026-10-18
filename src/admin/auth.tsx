import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/States';

interface AuthCtx {
  session: Session | null;
  isAdmin: boolean;
  ready: boolean;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>({ session: null, isAdmin: false, ready: false, signOut: async () => {} });
export const useAdminAuth = () => useContext(Ctx);

/**
 * UI convenience only. The REAL protection is Row Level Security in the database:
 * even if someone bypassed this screen, every admin query/upload is rejected unless the signed-in
 * account has a row in public.profiles with role = 'admin'.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!sessionReady) return;
    if (!uid) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    let alive = true;
    setChecked(false);
    supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setIsAdmin(data?.role === 'admin');
        setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [uid, sessionReady]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      isAdmin,
      ready: sessionReady && checked,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, isAdmin, sessionReady, checked],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AdminGuard() {
  const { session, isAdmin, ready, signOut } = useAdminAuth();
  const loc = useLocation();
  if (!ready) return <Loading label="جارٍ التحقق من الصلاحيات…" />;
  if (!session) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-display text-3xl gold-text">غير مصرّح</h1>
        <p className="mt-3 leading-8 text-zinc-300">
          هذا الحساب مسجّل الدخول لكنه غير مضاف كمدير للموقع. اطلبي من مسؤول الموقع إضافته، أو سجّلي الدخول بحساب آخر.
        </p>
        <button type="button" className="btn btn-gold mt-6" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </div>
    );
  }
  return <Outlet />;
}
