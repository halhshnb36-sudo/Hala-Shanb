import { ArticleCard } from '@/components/Cards';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { listArticles } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { useLoadMore } from '@/lib/useLoadMore';
import type { Article } from '@/lib/types';

const fetchArticles = (limit: number, offset: number) => listArticles(limit, offset);

export default function Articles() {
  useSeo({ title: 'المقالات والأخبار' });
  const q = useLoadMore<Article>(fetchArticles, 9);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
      <div className="mb-10 text-center">
        <div className="ornament mb-3" aria-hidden="true">✦</div>
        <h1 className="font-display text-4xl font-bold gold-text">المقالات والأخبار</h1>
        <p className="mt-3 text-zinc-400">معلومات وأخبار عن هالة شنب وعالم العناية بالشعر.</p>
      </div>

      {q.error && q.rows.length === 0 ? (
        <ErrorBox message={q.error} onRetry={q.retry} />
      ) : q.loading && q.rows.length === 0 ? (
        <Loading />
      ) : q.rows.length === 0 ? (
        <Empty title="لا توجد مقالات منشورة بعد" text="تابعينا قريبًا." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {q.rows.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
          {q.error && <ErrorBox message={q.error} onRetry={q.retry} />}
          {q.hasMore && (
            <div className="mt-10 text-center">
              <button type="button" className="btn btn-ghost" onClick={q.loadMore} disabled={q.loading}>
                {q.loading ? 'جارٍ التحميل…' : 'تحميل المزيد'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
