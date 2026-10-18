import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useAdminAuth } from './auth';

const NAV: Array<[string, string, boolean]> = [
  ['/admin', 'الإحصائيات', true],
  ['/admin/articles', 'المقالات', false],
  ['/admin/biography', 'السيرة الذاتية', false],
  ['/admin/photos', 'الصور', false],
  ['/admin/videos', 'الفيديو', false],
  ['/admin/settings', 'إعدادات الموقع', false],
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { session, signOut } = useAdminAuth();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    document.title = 'لوحة الإدارة | هالة شنب';
    return () => {
      m.remove();
    };
  }, []);

  const nav = (
    <nav aria-label="قائمة الإدارة" className="flex flex-col gap-1">
      {NAV.map(([to, label, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2.5 text-[0.95rem] transition ${
              isActive ? 'bg-gold-500/15 font-bold text-gold-300' : 'text-zinc-300 hover:bg-white/5'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-coal px-4 py-2 md:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <Logo className="h-10 w-10 object-contain" priority />
          <span className="font-display text-lg gold-text">لوحة الإدارة</span>
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'إغلاق' : 'القائمة'}
        </button>
      </header>
      {open && <div className="border-b border-line bg-coal p-3 md:hidden">{nav}</div>}

      <aside className="hidden w-64 shrink-0 flex-col border-e border-line bg-coal p-4 md:flex">
        <Link to="/admin" className="mb-6 flex flex-col items-center gap-1">
          <Logo className="h-24 w-24 object-contain" priority />
          <span className="font-display text-xl gold-text">لوحة الإدارة</span>
        </Link>
        {nav}
        <div className="mt-auto space-y-2 pt-6 text-sm">
          <Link to="/" target="_blank" className="btn btn-plain btn-sm w-full">
            عرض الموقع ↗
          </Link>
          <p className="truncate text-center text-xs text-zinc-500" dir="ltr">{session?.user.email}</p>
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => void signOut()}>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8" id="main">
        <Outlet />
        <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-4 md:hidden">
          <Link to="/" target="_blank" className="btn btn-plain btn-sm">عرض الموقع ↗</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>تسجيل الخروج</button>
        </div>
      </main>
    </div>
  );
}
