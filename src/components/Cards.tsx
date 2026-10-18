import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { publicUrl } from '@/lib/storage';
import { excerpt, formatDate, parseVideoUrl } from '@/lib/utils';
import type { Article, MediaItem } from '@/lib/types';
import { Logo } from './Logo';

export function SectionShell({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14 sm:px-6 md:py-20">
      <div className="mb-10 text-center">
        <div className="ornament mb-3" aria-hidden="true">✦</div>
        <h2 className="font-display text-3xl font-bold gold-text md:text-4xl">{title}</h2>
        {description && <p className="mx-auto mt-3 max-w-2xl text-zinc-400">{description}</p>}
      </div>
      {children}
      {action && <div className="mt-10 text-center">{action}</div>}
    </section>
  );
}

export function ArticleCard({ a }: { a: Article }) {
  const cover = publicUrl('articles', a.cover_path);
  return (
    <Link
      to={`/articles/${encodeURIComponent(a.slug)}`}
      className="card card-hover group flex h-full flex-col overflow-hidden no-underline"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-coal">
        {cover ? (
          <img
            src={cover}
            alt={a.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-40">
            <Logo className="h-24 w-24 object-contain" />
          </div>
        )}
        {a.featured && (
          <span className="absolute start-3 top-3 rounded-full bg-gold-500 px-3 py-0.5 text-xs font-bold text-black">
            مميّز
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <time className="text-xs text-gold-500" dateTime={a.published_at ?? undefined}>
          {formatDate(a.published_at)}
        </time>
        <h3 className="font-display text-xl font-bold leading-snug text-zinc-50">{a.title}</h3>
        <p className="line-clamp-3 text-sm leading-7 text-zinc-400">{a.subtitle || excerpt(a.body)}</p>
        <span className="mt-auto pt-2 text-sm font-bold text-gold-400">اقرئي المزيد ←</span>
      </div>
    </Link>
  );
}

export function videoThumb(v: MediaItem): string {
  if (v.thumb_path) return publicUrl('gallery', v.thumb_path);
  const p = parseVideoUrl(v.external_url);
  return p?.thumb ?? '';
}

export function VideoCard({ v, onPlay }: { v: MediaItem; onPlay: (v: MediaItem) => void }) {
  const thumb = videoThumb(v);
  return (
    <button
      type="button"
      onClick={() => onPlay(v)}
      className="card card-hover group flex h-full w-full flex-col overflow-hidden text-start"
      aria-label={`تشغيل الفيديو: ${v.title || 'فيديو'}`}
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
        ) : (
          <div className="flex h-full items-center justify-center opacity-30">
            <Logo className="h-20 w-20 object-contain" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-400/70 bg-black/60 text-2xl text-gold-300 backdrop-blur transition group-hover:scale-110">
            ▶
          </span>
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-bold text-zinc-50">{v.title || 'فيديو'}</h3>
        {v.description && <p className="mt-1 line-clamp-2 text-sm leading-7 text-zinc-400">{v.description}</p>}
      </div>
    </button>
  );
}
