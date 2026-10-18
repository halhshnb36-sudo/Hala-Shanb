import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { errMsg } from '@/lib/utils';
import { useAdminAuth } from './auth';

export default function Login() {
  const { session, isAdmin, ready } = useAdminAuth();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && session && isAdmin) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(/invalid login/i.test(err.message) ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : errMsg(err.message));
      }
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-6 sm:p-8" aria-labelledby="login-title">
        <Logo priority className="mx-auto h-28 w-28 object-contain" />
        <h1 id="login-title" className="mt-2 text-center font-display text-2xl gold-text">
          دخول لوحة الإدارة
        </h1>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">البريد الإلكتروني</label>
            <input id="email" className="input" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">كلمة المرور</label>
            <input id="password" className="input" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-100" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-gold w-full" disabled={busy}>
            {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
        </div>
        {session && ready && !isAdmin && (
          <p className="mt-4 text-center text-sm text-amber-300">هذا الحساب غير مصرّح له بدخول لوحة الإدارة.</p>
        )}
      </form>
    </div>
  );
}
