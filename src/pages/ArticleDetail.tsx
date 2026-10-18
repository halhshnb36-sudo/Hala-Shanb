import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArticleBody } from '@/components/ArticleBody';
import { Loading, ErrorBox } from '@/components/States';
import { useLightbox } from '@/components/useLightbox';
import { getArticleBySlug } from '@/lib/api';
import { publicUrl, signedVideoUrl } from '@/lib/storage';
import { trackView } from '@/lib/track';
import { useSeo } from '@/lib/seo';
import { errMsg, formatDate, parseVideoUrl, useAsync } from '@/lib/utils';
import type { Article } from '@/lib/types';

/** Click-to-load video: nothing heavy is loaded until the visitor presses play. */
function ArticleVideo({ a }: { a: Article }) {
  const [started, setStarted] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const embed = parseVideoUrl(a.video_url);

  async function start() {
    setStarted(true);
    if (!embed && a.video_path) {
      try {
        setSrc(await signedVideoUrl(a.video_path));
      } catch (e) {
        setError(errMsg(e));
      }
    }
  }

  if (!embed && !a.video_path) return null;
  return (
    <div className="mx-auto my-10 max-w-3xl overflow-hidden rounded-2xl border border-gold-500/30 bg-black">
      <div className="aspect-video">
        {!started ? (
          <button
            type="button"
            onClick={start}
            className="flex h-full w-full items-center justify-center bg-coal text-gold-300"
            aria-label="تشغيل الفيديو"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-400/70 text-3xl">▶</span>
          </button>
        ) : error ? (
          <ErrorBox message={error} />
        ) : embed ? (
          <iframe
            src={embed.embed}
            title={a.title}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : src ? (
          <video src={src} controls autoPlay playsInline className="h-full w-full" />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}

export default function ArticleDetail() {
  const { slug = '' } = useParams();
  const q = useAsync(() => getArticleBySlug(slug), [slug]);
  const a = q.data;

  useSeo({
    title: a?.seo_title || a?.title,
    description: a?.seo_description || a?.subtitle,
    image: a?.cover_path ? publicUrl('articles', a.cover_path) : null,
    type: 'article',
  });

  useEffect(() => {
    if (a?.id) void trackView('article', a.id);
  }, [a?.id]);

  const extra = (a?.images ?? []).map((p, i) => ({ id: `${a?.id}-${i}`, src: publicUrl('articles', p), title: a?.title }));
  const lb = useLightbox(extra, false);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!a) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl gold-text">المقال غير موجود</h1>
        <p className="mt-3 text-zinc-400">ربما تم حذفه أو لم يُنشر بعد.</p>
        <Link to="/articles" className="btn btn-gold mt-6">
          كل المقالات
        </Link>
      </div>
    );
  }

  const cover = publicUrl('articles', a.cover_path);
  return (
    <article className="px-5 py-10 sm:px-6 md:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <Link to="/articles" className="text-sm text-gold-400 hover:underline">
          ← كل المقالات
        </Link>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight gold-text md:text-5xl">{a.title}</h1>
        {a.subtitle && <p className="mt-4 font-display text-xl leading-9 text-zinc-300">{a.subtitle}</p>}
        <time className="mt-4 block text-sm text-gold-500" dateTime={a.published_at ?? undefined}>
          {formatDate(a.published_at)}
        </time>
      </header>

      {cover && (
        <img
          src={cover}
          alt={a.title}
          decoding="async"
          fetchPriority="high"
          className="mx-auto my-8 max-h-[32rem] w-full max-w-4xl rounded-2xl border border-line object-cover"
        />
      )}

      <ArticleBody body={a.body} />
      <ArticleVideo a={a} />

      {extra.length > 0 && (
        <ul className="mx-auto mt-10 grid max-w-4xl list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
          {extra.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => lb.open(i)}
                className="block w-full overflow-hidden rounded-xl border border-line"
                aria-label={`عرض الصورة ${i + 1}`}
              >
                <img src={img.src} alt={`${a.title} — صورة ${i + 1}`} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {lb.node}
    </article>
  );
}
