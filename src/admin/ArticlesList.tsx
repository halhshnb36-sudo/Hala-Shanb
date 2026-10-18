import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { removeFiles } from '@/lib/storage';
import { useConfirm, useToast } from '@/components/feedback';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { errMsg, formatDate, formatNumber, useAsync, useDebounced } from '@/lib/utils';
import { Badge, escapeLike, PageHeader, Pagination } from './ui';

const PAGE = 10;
type StatusFilter = 'all' | 'draft' | 'published';

interface Row {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  featured: boolean;
  published_at: string | null;
  created_at: string;
  cover_path: string | null;
  images: string[];
  video_path: string | null;
}

export default function ArticlesList() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const ds = useDebounced(search);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setPage(0), [ds, status]);

  const q = useAsync(async () => {
    let qb = supabase
      .from('articles')
      .select('id,title,slug,status,featured,published_at,created_at,cover_path,images,video_path', { count: 'exact' })
      .eq('kind', 'article');
    if (status !== 'all') qb = qb.eq('status', status);
    if (ds.trim()) qb = qb.ilike('title', `%${escapeLike(ds.trim())}%`);
    const { data, error, count } = await qb.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Row[], total: count ?? 0 };
  }, [page, ds, status]);

  const views = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_view_counts', { p_range: 'all' });
    if (error) throw new Error(error.message);
    const map: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ content_id: string; views: number }>) map[r.content_id] = Number(r.views);
    return map;
  }, []);

  async function patch(row: Row, values: Partial<Row>, okMsg: string) {
    setBusy(row.id);
    try {
      const { data, error } = await supabase.from('articles').update(values).eq('id', row.id).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('forbidden');
      toast.success(okMsg);
      q.reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: Row) {
    const ok = await confirm({
      title: 'حذف المقال',
      message: `سيتم حذف «${row.title}» نهائيًا مع صوره وإحصائياته. لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: 'نعم، احذف',
      danger: true,
    });
    if (!ok) return;
    setBusy(row.id);
    try {
      const { data, error } = await supabase.from('articles').delete().eq('id', row.id).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('forbidden');
      await removeFiles('articles', [row.cover_path, ...(row.images ?? [])]);
      await removeFiles('videos', [row.video_path]);
      toast.success('تم حذف المقال');
      if (q.data && q.data.rows.length === 1 && page > 0) setPage(page - 1);
      else q.reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="المقالات"
        subtitle="المقالات المنشورة تظهر للزوّار، والمسودات تبقى خاصة بالإدارة."
        actions={
          <Link to="/admin/articles/new" className="btn btn-gold">
            + مقال جديد
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <input className="input" type="search" placeholder="ابحثي في عناوين المقالات…" aria-label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" aria-label="تصفية بالحالة" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">كل الحالات</option>
          <option value="published">منشور</option>
          <option value="draft">مسودة</option>
        </select>
      </div>

      {q.loading && !q.data ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data || q.data.rows.length === 0 ? (
        <Empty
          title={ds || status !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد مقالات بعد'}
          text={ds || status !== 'all' ? 'جرّبي تغيير البحث أو التصفية.' : 'ابدئي بإضافة أول مقال.'}
          action={<Link to="/admin/articles/new" className="btn btn-gold">+ مقال جديد</Link>}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {q.data.rows.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/articles/${r.id}`} className="block truncate font-bold text-zinc-50 hover:text-gold-300">
                    {r.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <Badge tone={r.status === 'published' ? 'green' : 'gray'}>{r.status === 'published' ? 'منشور' : 'مسودة'}</Badge>
                    {r.featured && <Badge tone="gold">مميّز</Badge>}
                    <span>{r.published_at ? formatDate(r.published_at) : formatDate(r.created_at)}</span>
                    <span>· المشاهدات: {formatNumber(views.data?.[r.id] ?? 0)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/articles/${r.id}`} className="btn btn-plain btn-sm">
                    تعديل
                  </Link>
                  <button
                    type="button"
                    className="btn btn-plain btn-sm"
                    disabled={busy === r.id}
                    onClick={() =>
                      patch(
                        r,
                        r.status === 'published' ? { status: 'draft' } : { status: 'published' },
                        r.status === 'published' ? 'تم إلغاء النشر' : 'تم النشر',
                      )
                    }
                  >
                    {r.status === 'published' ? 'إلغاء النشر' : 'نشر'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-plain btn-sm"
                    disabled={busy === r.id}
                    onClick={() => patch(r, { featured: !r.featured }, r.featured ? 'تمت إزالة التمييز' : 'تم تمييز المقال')}
                  >
                    {r.featured ? 'إزالة التمييز' : 'تمييز'}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => void remove(r)}>
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
