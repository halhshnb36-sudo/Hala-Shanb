import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { useSettings } from '@/lib/settings';

const LINKS: Array<[string, string]> = [
  ['/', 'الرئيسية'],
  ['/biography', 'حكايتها'],
  ['/articles', 'المقالات'],
  ['/gallery', 'معرض الصور'],
  ['/videos', 'الفيديو'],
  ['/contact', 'تواصل معنا'],
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { settings } = useSettings();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label={`${settings.site_name} — الصفحة الرئيسية`}>
          <Logo priority className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
          <span className="hidden font-display text-xl font-bold gold-text sm:block">{settings.site_name}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
          {LINKS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[0.95rem] transition ${
                  isActive ? 'text-gold-300' : 'text-zinc-300 hover:text-gold-300'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="btn btn-ghost btn-sm lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'إغلاق' : 'القائمة'}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-white/5 bg-ink px-4 pb-4 lg:hidden" aria-label="التنقل الرئيسي">
          <ul className="mx-auto grid max-w-6xl gap-1 pt-2">
            {LINKS.map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 ${isActive ? 'bg-gold-500/10 text-gold-300' : 'text-zinc-200'}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
