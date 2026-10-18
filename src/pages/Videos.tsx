import { useState } from 'react';
import { VideoCard } from '@/components/Cards';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { VideoModal } from '@/components/VideoModal';
import { listMedia } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { useLoadMore } from '@/lib/useLoadMore';
import type { MediaItem } from '@/lib/types';

const fetchVideos = (limit: number, offset: number) => listMedia('video', limit, offset);

export default function Videos() {
  useSeo({ title: 'معرض الفيديو' });
  const q = useLoadMore<MediaItem>(fetchVideos, 12);
  const [playing, setPlaying] = useState<MediaItem | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
      <div className="mb-10 text-center">
        <div className="ornament mb-3" aria-hidden="true">✦</div>
        <h1 className="font-display text-4xl font-bold gold-text">معرض الفيديو</h1>
        <p className="mt-3 text-zinc-400">اضغطي على أي فيديو لمشاهدته.</p>
      </div>

      {q.error && q.rows.length === 0 ? (
        <ErrorBox message={q.error} onRetry={q.retry} />
      ) : q.loading && q.rows.length === 0 ? (
        <Loading />
      ) : q.rows.length === 0 ? (
        <Empty title="لا توجد فيديوهات منشورة بعد" text="سيتم عرض الفيديوهات هنا فور إضافتها." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {q.rows.map((v) => (
              <VideoCard key={v.id} v={v} onPlay={setPlaying} />
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
      <VideoModal item={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
