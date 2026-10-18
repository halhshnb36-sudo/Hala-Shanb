import { useMemo } from 'react';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { PhotoGrid, toLightboxItems } from '@/components/PhotoGrid';
import { useLightbox } from '@/components/useLightbox';
import { listMedia } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { useLoadMore } from '@/lib/useLoadMore';
import type { MediaItem } from '@/lib/types';

const fetchPhotos = (limit: number, offset: number) => listMedia('image', limit, offset);

export default function Gallery() {
  useSeo({ title: 'معرض الصور' });
  const q = useLoadMore<MediaItem>(fetchPhotos, 24);
  const items = useMemo(() => toLightboxItems(q.rows), [q.rows]);
  const lb = useLightbox(items);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
      <div className="mb-10 text-center">
        <div className="ornament mb-3" aria-hidden="true">✦</div>
        <h1 className="font-display text-4xl font-bold gold-text">معرض الصور</h1>
        <p className="mt-3 text-zinc-400">اضغطي على أي صورة لعرضها بحجم أكبر.</p>
      </div>

      {q.error && q.rows.length === 0 ? (
        <ErrorBox message={q.error} onRetry={q.retry} />
      ) : q.loading && q.rows.length === 0 ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="لا توجد صور منشورة بعد" text="سيتم عرض الصور هنا فور إضافتها." />
      ) : (
        <>
          <PhotoGrid items={items} onOpen={lb.open} />
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
      {lb.node}
    </div>
  );
}
