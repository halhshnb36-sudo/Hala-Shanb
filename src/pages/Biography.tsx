import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArticleBody } from '@/components/ArticleBody';
import { Logo } from '@/components/Logo';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { getBiography } from '@/lib/api';
import { publicUrl } from '@/lib/storage';
import { trackView } from '@/lib/track';
import { useSeo } from '@/lib/seo';
import { useAsync } from '@/lib/utils';

export default function Biography() {
  const q = useAsync(getBiography, []);
  const bio = q.data;

  useSeo({
    title: bio?.seo_title || bio?.title,
    description: bio?.seo_description || bio?.subtitle,
    image: bio?.cover_path ? publicUrl('articles', bio.cover_path) : null,
    type: 'article',
  });

  // One page_view per visit (the database also de-duplicates by session).
  useEffect(() => {
    if (bio?.id) void trackView('biography', bio.id);
  }, [bio?.id]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!bio) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <Empty title="الحكاية قيد التجهيز" text="سيتم نشر قصة هالة شنب قريبًا." action={<Link to="/" className="btn btn-ghost">العودة للرئيسية</Link>} />
      </div>
    );
  }

  const cover = publicUrl('articles', bio.cover_path);
  return (
    <article>
      <header className="hero-bg border-b border-gold-500/20">
        <div className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-6 md:py-16">
          <Logo className="logo-glow mx-auto mb-6 h-28 w-28 object-contain md:h-36 md:w-36" />
          <h1 className="fade-up font-display text-4xl font-bold leading-tight gold-text md:text-6xl">{bio.title}</h1>
          {bio.subtitle && (
            <p className="fade-up-2 mx-auto mt-5 max-w-2xl font-display text-xl leading-9 text-zinc-200 md:text-2xl">
              {bio.subtitle}
            </p>
          )}
          <div className="ornament mt-8" aria-hidden="true">✦</div>
        </div>
      </header>

      {cover && (
        <div className="mx-auto mt-10 max-w-4xl px-5 sm:px-6">
          <img src={cover} alt={bio.title} className="w-full rounded-2xl border border-line object-cover" decoding="async" />
        </div>
      )}

      <div className="px-5 py-12 sm:px-6 md:py-16">
        <ArticleBody body={bio.body} />
      </div>
    </article>
  );
}
