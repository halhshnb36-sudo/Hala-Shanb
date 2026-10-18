import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { publicUrl } from '@/lib/storage';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { formatDateTime, formatNumber, useAsync } from '@/lib/utils';
import { PageHeader } from './ui';

type Range = 'today' | '7d' | '30d' | 'all';
const RANGES: Array<[Range, string]> = [
  ['today', 'اليوم'],
  ['7d', 'آخر ٧ أيام'],
  ['30d', 'آخر ٣٠ يومًا'],
  ['all', 'كل الوقت'],
];

interface TopRow {
  id: string;
  title: string;
  views: number;
  kind?: string;
  storage_path?: string | null;
}
interface Stats {
  article_views: number;
  biography_views: number;
  image_views: number;
  video_plays: number;
  total_events: number;
  published_articles: number;
  photos: number;
  videos: number;
  daily: Array<{ day: string; page_views: number; image_views: number; video_plays: number }>;
  top_articles: TopRow[];
  top_images: TopRow[];
  top_videos: TopRow[];
  recent: Array<{ created_at: string; content_type: string; event_type: string; title: string }>;
}

const EVENT_LABEL: Record<string, string> = {
  page_view: 'مشاهدة صفحة',
  image_view: 'عرض صورة',
  video_play: 'تشغيل فيديو',
};
const TYPE_LABEL: Record<string, string> = { biography: 'السيرة', article: 'مقال', image: 'صورة', video: 'فيديو' };

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold gold-text">{formatNumber(value)}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function TopList({ title, rows, thumbs }: { title: string; rows: TopRow[]; thumbs?: boolean }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h2 className="mb-3 font-bold text-gold-300">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">لا توجد بيانات في هذه الفترة.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm text-zinc-500">{formatNumber(i + 1)}</span>
              {thumbs && r.storage_path && (
                <img src={publicUrl('gallery', r.storage_path)} alt="" className="h-10 w-10 rounded-md object-cover" loading="lazy" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.title}
                {r.kind === 'biography' && <span className="ms-2 text-xs text-gold-500">(السيرة)</span>}
              </span>
              <span className="text-sm font-bold text-gold-300">{formatNumber(r.views)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<Range>('30d');
  const q = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_stats', { p_range: range });
    if (error) throw new Error(error.message);
    return data as Stats;
  }, [range]);
  const s = q.data;

  return (
    <div>
      <PageHeader
        title="الإحصائيات"
        subtitle="أرقام حقيقية من أحداث المشاهدة المسجّلة في قاعدة البيانات. زيارات المدير المسجّل دخوله لا تُحتسب."
        actions={
          <div className="flex flex-wrap gap-1" role="group" aria-label="الفترة الزمنية">
            {RANGES.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={range === k}
                onClick={() => setRange(k)}
                className={`btn btn-sm ${range === k ? 'btn-gold' : 'btn-plain'}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {q.loading && !s ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="مشاهدات المقالات" value={s.article_views} hint="خلال الفترة المحددة" />
            <Kpi label="مشاهدات صفحة السيرة" value={s.biography_views} hint="خلال الفترة المحددة" />
            <Kpi label="مشاهدات الصور" value={s.image_views} hint="مرات فتح الصورة" />
            <Kpi label="تشغيلات الفيديو" value={s.video_plays} hint="مرات بدء التشغيل" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="إجمالي زيارات المحتوى" value={s.total_events} hint="كل الأحداث في الفترة" />
            <Kpi label="مقالات منشورة" value={s.published_articles} />
            <Kpi label="إجمالي الصور" value={s.photos} />
            <Kpi label="إجمالي الفيديوهات" value={s.videos} />
          </div>

          <section className="card p-4" aria-label="الرسم البياني للمشاهدات">
            <h2 className="mb-3 font-bold text-gold-300">المشاهدات حسب اليوم</h2>
            {s.daily.length === 0 ? (
              <Empty title="لا توجد مشاهدات في هذه الفترة" text="ستظهر الأرقام هنا بمجرد أن يتصفّح الزوّار المحتوى." />
            ) : (
              <div dir="ltr" className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={s.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#2b2b2b" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2b2b2b', borderRadius: 10, direction: 'rtl' }} />
                    <Legend />
                    <Area type="monotone" dataKey="page_views" name="مشاهدات الصفحات" stroke="#dcbd72" fill="#dcbd7233" strokeWidth={2} />
                    <Area type="monotone" dataKey="image_views" name="مشاهدات الصور" stroke="#7dd3c0" fill="#7dd3c026" strokeWidth={2} />
                    <Area type="monotone" dataKey="video_plays" name="تشغيلات الفيديو" stroke="#f0a1b0" fill="#f0a1b026" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <TopList title="الأكثر مشاهدة: المقالات" rows={s.top_articles} />
            <TopList title="الأكثر مشاهدة: الصور" rows={s.top_images} thumbs />
            <TopList title="الأكثر مشاهدة: الفيديو" rows={s.top_videos} />
          </div>

          <section className="card p-4" aria-label="آخر النشاط">
            <h2 className="mb-3 font-bold text-gold-300">آخر النشاط</h2>
            {s.recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">لا يوجد نشاط في هذه الفترة.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {s.recent.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="text-gold-400">{EVENT_LABEL[r.event_type] ?? r.event_type}</span>
                      <span className="text-zinc-500"> · {TYPE_LABEL[r.content_type] ?? r.content_type} · </span>
                      {r.title}
                    </span>
                    <time className="text-xs text-zinc-500">{formatDateTime(r.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="card p-4">
            <summary className="cursor-pointer font-bold text-gold-300">كيف تُحسب هذه الأرقام؟</summary>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-7 text-zinc-300">
              <li><b>مشاهدات المقالات / السيرة:</b> مرة واحدة عند فتح الصفحة. نفس الزائر (نفس جلسة المتصفح) لا يُحتسب أكثر من مرة كل ٣٠ دقيقة لنفس الصفحة، فلا تزيد الأرقام بسبب التحديث المتكرر.</li>
              <li><b>مشاهدات الصور:</b> عند فتح الصورة فعليًا في العرض المكبّر (أو التنقل إليها). نفس الزائر لا يُحتسب لنفس الصورة أكثر من مرة كل ١٠ دقائق. مجرد ظهور الصورة في الشبكة لا يُحتسب.</li>
              <li><b>تشغيلات الفيديو:</b> عند بدء التشغيل. نفس الزائر لا يُحتسب لنفس الفيديو أكثر من مرة كل ٥ دقائق. فيديوهات يوتيوب/فيميو تُحتسب عند ضغط الزائر لفتح المشغّل (لا يمكن معرفة لحظة التشغيل داخل مشغّل خارجي).</li>
              <li><b>إجمالي زيارات المحتوى:</b> مجموع كل الأحداث أعلاه، وهو ليس عدد الزوّار الفريدين.</li>
              <li><b>الخصوصية:</b> لا يُخزَّن عنوان IP ولا بيانات شخصية. يُحفظ فقط معرّف جلسة عشوائي مؤقت من المتصفح. زياراتك أنتِ كمديرة مسجّلة الدخول لا تُحتسب.</li>
              <li><b>التواريخ:</b> تُحسب الأيام بتوقيت القاهرة.</li>
              <li><b>الحماية من التلاعب:</b> الكتابة في جدول الأحداث ممنوعة مباشرة، وتتم فقط عبر دالة في قاعدة البيانات تتحقق من أن المحتوى منشور، وتحدّ من التكرار والإغراق. الحماية تقلّل التلاعب لكنها لا تمنع شخصًا مصمّمًا من توليد جلسات كثيرة؛ للحماية الأقوى يمكن لاحقًا تمرير التتبع عبر Cloudflare Worker مع Rate Limiting.</li>
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}
