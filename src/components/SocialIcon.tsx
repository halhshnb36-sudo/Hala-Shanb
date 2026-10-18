import type { SocialKey } from '@/lib/types';
import { useSocialLinks } from '@/lib/settings';

export function SocialIcon({ name, size = 22 }: { name: SocialKey; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'facebook') {
    return (
      <svg {...common}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    );
  }
  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 21l1.65-4.8A9 9 0 1 1 8 19.35L3 21z" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.7-1.9-1-.9.9a4.4 4.4 0 0 1-2.4-2.4l.9-.9-1-1.9L9 8.5z" />
    </svg>
  );
}

/** Renders only the ENABLED social links that have a valid URL. Renders nothing otherwise. */
export function SocialLinks({ className = '' }: { className?: string }) {
  const links = useSocialLinks();
  if (!links.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`} aria-label="حساباتنا على وسائل التواصل">
      {links.map((l) => (
        <li key={l.key}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.label}
            title={l.label}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/50 text-gold-300 transition hover:bg-gold-500/15 hover:text-gold-300"
          >
            <SocialIcon name={l.key} />
          </a>
        </li>
      ))}
    </ul>
  );
}
