import { useEffect, useRef, useState } from 'react';
import { supabase, unwrap } from '@/lib/supabase';
import { publicUrl, removeFiles, uploadImage, uploadVideo } from '@/lib/storage';
import type { VideoUpload } from '@/lib/storage';
import { Modal } from '@/components/Modal';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { VideoModal } from '@/components/VideoModal';
import { videoThumb } from '@/components/Cards';
import { useConfirm, useToast } from '@/components/feedback';
import { errMsg, formatBytes, formatNumber, parseVideoUrl, useAsync, useDebounced } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';
import { Badge, escapeLike, Field, PageHeader, Pagination, Toggle } from './ui';

const PAGE = 12;
type StatusFilter = 'all' | 'published' | 'hidden';

async function minSortOrder(type: 'image' | 'video'): Promise<number> {
  const { data } = await supabase.from('media').select('sort_order').eq('type', type).order('sort_order', { ascending: true }).limit(1);
  const first = (data?.[0] as { sort_order: number } | undefined)?.sort_order;
  return typeof first === 'number' ? first : 0;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

/* ======================================================================= upload dialog */
interface QueueItem {
  file: File;
  state: 'wait' | 'busy' | 'done' | 'error';
  pct?: number;
  message?: string;
}

function UploadModal({ type, onClose, onDone }: { type: 'image' | 'video'; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [running, setRunning] = useState(false);
  const videoUp = useRef<VideoUpload | null>(null);

  const patch = (i: number, v: Partial<QueueItem>) => setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, ...v } : it)));

  async function start() {
    setRunning(true);
    const base = await minSortOrder(type);
    const todo = queue.map((q, i) => ({ q, i })).filter((x) => x.q.state !== 'done');
    let ok = 0;
    for (const [n, { q, i }] of todo.entries()) {
      patch(i, { state: 'busy', pct: 0, message: undefined });
      try {
        let path: string;
        let mime: string;
        let size: number;
        if (type === 'image') {
          const up = await uploadImage('gallery', q.file);
          ({ path, mime, size } = up);
        } else {
          const up = uploadVideo(q.file, (pct) => patch(i, { pct }));
          videoUp.current = up;
          ({ path, mime, size } = await up.promise);
          videoUp.current = null;
        }
        try {
          await unwrap(
            supabase
              .from('media')
              .insert({
                type,
                title: baseName(q.file.name),
                storage_path: path,
                mime_type: mime,
                size_bytes: size,
                is_published: publishNow,
                sort_order: base - todo.length + n,
              })
              .select('id')
              .single(),
          );
        } catch (e) {
          await removeFiles(type === 'image' ? 'gallery' : 'videos', [path]);
          throw e;
        }
        patch(i, { state: 'done', pct: 100 });
        ok++;
      } catch (e) {
        patch(i, { state: 'error', message: errMsg(e) });
      }
    }
    setRunning(false);
    if (ok) {
      toast.success(`تم رفع ${formatNumber(ok)} ${type === 'image' ? 'صورة' : 'فيديو'}.`);
      onDone();
    }
  }

  const finished = queue.length > 0 && queue.every((q) => q.state === 'done');

  return (
    <Modal
      open
      onClose={() => {
        if (!running) onClose();
      }}
      title={type === 'image' ? 'رفع صور' : 'رفع فيديو'}
      wide
      footer={
        <>
          {running && type === 'video' && (
            <button type="button" className="btn btn-plain" onClick={() => videoUp.current?.abort()}>
              إلغاء الرفع
            </button>
          )}
          <button type="button" className="btn btn-plain" disabled={running} onClick={onClose}>
            {finished ? 'إغلاق' : 'إلغاء'}
          </button>
          <button type="button" className="btn btn-gold" disabled={running || queue.length === 0 || finished} onClick={() => void start()}>
            {running ? 'جارٍ الرفع…' : 'بدء الرفع'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-gold-500/50 p-6 text-center hover:bg-gold-500/5">
          <span className="font-bold text-gold-300">{type === 'image' ? 'اختاري صورة أو أكثر' : 'اختاري ملف فيديو'}</span>
          <span className="text-xs text-zinc-400">
            {type === 'image' ? 'JPG / PNG / WebP — حتى ١٥ م.ب للصورة، وتُصغَّر الصور الكبيرة تلقائيًا' : 'MP4 / WebM / MOV — حتى ٥٠٠ م.ب، رفع متقطّع يمكن استئنافه'}
          </span>
          <input
            type="file"
            className="sr-only"
            multiple={type === 'image'}
            accept={type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm,video/quicktime'}
            disabled={running}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) setQueue(files.map((file) => ({ file, state: 'wait' as const })));
            }}
          />
        </label>
        <Toggle checked={publishNow} onChange={setPublishNow} label="نشر فورًا (يظهر للزوّار بعد الرفع)" />
        {queue.length > 0 && (
          <ul className="space-y-2 text-sm">
            {queue.map((q, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate" dir="auto">{q.file.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{formatBytes(q.file.size)}</span>
                </div>
                {q.state === 'busy' && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={q.pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-gold-500 transition-all" style={{ width: `${type === 'video' ? (q.pct ?? 0) : 60}%` }} />
                  </div>
                )}
                {q.state === 'done' && <p className="mt-1 text-emerald-300">✓ تم الرفع</p>}
                {q.state === 'error' && <p className="mt-1 text-red-300">✕ {q.message}</p>}
                {q.state === 'wait' && <p className="mt-1 text-zinc-500">في الانتظار</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/* ======================================================================= edit dialog */
function EditModal({
  item,
  type,
  onClose,
  onSaved,
}: {
  item: MediaItem | null; // null = new external video link
  type: 'image' | 'video';
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [published, setPublished] = useState(item?.is_published ?? true);
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [externalUrl, setExternalUrl] = useState(item?.external_url ?? '');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPoster, setNewPoster] = useState<File | null>(null);
  const [dropPoster, setDropPoster] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const videoUp = useRef<VideoUpload | null>(null);

  async function save() {
    const ext = externalUrl.trim();
    if (type === 'video' && ext && !parseVideoUrl(ext)) {
      toast.error('رابط الفيديو يجب أن يكون رابط يوتيوب أو فيميو يبدأ بـ https.');
      return;
    }
    if (!item && !ext) {
      toast.error('أدخلي رابط الفيديو.');
      return;
    }
    setSaving(true);
    const newlyUploaded: Array<[('gallery' | 'videos'), string]> = [];
    const toRemove: Array<[('gallery' | 'videos'), string | null]> = [];
    try {
      const values: Record<string, unknown> = {
        title: title.trim() || null,
        description: description.trim() || null,
        is_published: published,
        featured,
      };

      if (type === 'image' && newFile && item) {
        const up = await uploadImage('gallery', newFile);
        newlyUploaded.push(['gallery', up.path]);
        values.storage_path = up.path;
        values.mime_type = up.mime;
        values.size_bytes = up.size;
        toRemove.push(['gallery', item.storage_path]);
      }

      if (type === 'video') {
        if (newFile) {
          const up = uploadVideo(newFile, setPct);
          videoUp.current = up;
          const res = await up.promise;
          videoUp.current = null;
          newlyUploaded.push(['videos', res.path]);
          values.storage_path = res.path;
          values.mime_type = res.mime;
          values.size_bytes = res.size;
          values.external_url = null;
          if (item?.storage_path) toRemove.push(['videos', item.storage_path]);
        } else if (ext) {
          values.external_url = ext;
          if (item?.storage_path) {
            values.storage_path = null;
            values.mime_type = null;
            values.size_bytes = null;
            toRemove.push(['videos', item.storage_path]);
          }
        }
        if (newPoster) {
          const up = await uploadImage('gallery', newPoster, { prefix: 'posters/' });
          newlyUploaded.push(['gallery', up.path]);
          values.thumb_path = up.path;
          if (item?.thumb_path) toRemove.push(['gallery', item.thumb_path]);
        } else if (dropPoster && item?.thumb_path) {
          values.thumb_path = null;
          toRemove.push(['gallery', item.thumb_path]);
        }
      }

      if (item) {
        await unwrap(supabase.from('media').update(values).eq('id', item.id).select('id').single());
      } else {
        const min = await minSortOrder('video');
        await unwrap(
          supabase
            .from('media')
            .insert({ ...values, type: 'video', sort_order: min - 1 })
            .select('id')
            .single(),
        );
      }
      for (const [b, p] of toRemove) await removeFiles(b, [p]);
      toast.success('تم الحفظ.');
      onSaved();
    } catch (e) {
      for (const [b, p] of newlyUploaded) await removeFiles(b, [p]);
      toast.error(`${errMsg(e)} لم تُفقد البيانات التي أدخلتِها.`);
    } finally {
      setSaving(false);
      setPct(null);
      videoUp.current = null;
    }
  }

  const heading = item ? (type === 'image' ? 'تعديل الصورة' : 'تعديل الفيديو') : 'إضافة فيديو برابط خارجي';
  const uploadedVideo = Boolean(item?.storage_path);

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title={heading}
      wide
      footer={
        <>
          {saving && videoUp.current && (
            <button type="button" className="btn btn-plain" onClick={() => videoUp.current?.abort()}>
              إلغاء رفع الفيديو
            </button>
          )}
          <button type="button" className="btn btn-plain" disabled={saving} onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void save()}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {item && type === 'image' && <img src={publicUrl('gallery', item.storage_path)} alt="" className="mx-auto max-h-56 rounded-lg border border-line" />}
        <Field label="العنوان" htmlFor="m-title">
          <input id="m-title" className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="الوصف" htmlFor="m-desc">
          <textarea id="m-desc" className="input min-h-24" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {type === 'image' && item && (
          <Field label="استبدال الصورة (اختياري)" hint="تُحفظ العناوين والترتيب وتتغيّر الصورة فقط.">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
          </Field>
        )}

        {type === 'video' && (
          <>
            <Field label="رابط يوتيوب أو فيميو" htmlFor="m-url" hint={uploadedVideo ? 'هذا الفيديو ملف مرفوع. إدخال رابط هنا سيستبدل الملف بالرابط.' : undefined}>
              <input id="m-url" className="input" dir="ltr" placeholder="https://www.youtube.com/watch?v=…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} disabled={Boolean(newFile)} />
            </Field>
            {item && (
              <Field label={uploadedVideo || newFile ? 'استبدال ملف الفيديو (اختياري)' : 'أو ارفعي ملف فيديو بدل الرابط'} hint="MP4 / WebM / MOV حتى ٥٠٠ م.ب. الرفع على دفعات ويمكن استئنافه.">
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="input" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
              </Field>
            )}
            {pct !== null && (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-sm text-zinc-300">جارٍ رفع الفيديو… {pct}%</p>
              </div>
            )}
            <Field label="صورة مصغّرة للفيديو (اختياري)" hint="تظهر على بطاقة الفيديو. فيديوهات يوتيوب لها صورة تلقائية.">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setNewPoster(e.target.files?.[0] ?? null)} />
            </Field>
            {item?.thumb_path && !newPoster && (
              <Toggle checked={dropPoster} onChange={setDropPoster} label="إزالة الصورة المصغّرة الحالية" />
            )}
          </>
        )}

        <div className="grid gap-1 sm:grid-cols-2">
          <Toggle checked={published} onChange={setPublished} label="منشور (ظاهر للزوّار)" />
          <Toggle checked={featured} onChange={setFeatured} label="مميّز (يظهر في الصفحة الرئيسية)" />
        </div>
      </div>
    </Modal>
  );
}

/* ======================================================================= page */
export default function MediaManager({ type }: { type: 'image' | 'video' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const ds = useDebounced(search);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | 'new' | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);

  useEffect(() => setPage(0), [ds, status, type]);
  const filtering = ds.trim() !== '' || status !== 'all';

  const q = useAsync(async () => {
    let qb = supabase.from('media').select('*', { count: 'exact' }).eq('type', type);
    if (status === 'published') qb = qb.eq('is_published', true);
    if (status === 'hidden') qb = qb.eq('is_published', false);
    if (ds.trim()) qb = qb.ilike('title', `%${escapeLike(ds.trim())}%`);
    const { data, error, count } = await qb
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as MediaItem[], total: count ?? 0 };
  }, [type, page, ds, status]);

  const views = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_view_counts', { p_range: 'all' });
    if (error) throw new Error(error.message);
    const map: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ content_id: string; views: number }>) map[r.content_id] = Number(r.views);
    return map;
  }, [type]);

  async function patch(m: MediaItem, values: Partial<MediaItem>, okMsg: string) {
    setBusy(m.id);
    try {
      await unwrap(supabase.from('media').update(values).eq('id', m.id).select('id').single());
      toast.success(okMsg);
      q.reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function move(m: MediaItem, dir: -1 | 1) {
    setBusy(m.id);
    try {
      const { error } = await supabase.rpc('admin_move_media', { p_id: m.id, p_dir: dir });
      if (error) throw new Error(error.message);
      q.reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: MediaItem) {
    const ok = await confirm({
      title: type === 'image' ? 'حذف الصورة' : 'حذف الفيديو',
      message: `سيتم حذف «${m.title || 'بدون عنوان'}» نهائيًا مع ملفه وإحصائياته. لا يمكن التراجع.`,
      confirmText: 'نعم، احذف',
      danger: true,
    });
    if (!ok) return;
    setBusy(m.id);
    try {
      const { data, error } = await supabase.from('media').delete().eq('id', m.id).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('forbidden');
      if (type === 'image') await removeFiles('gallery', [m.storage_path]);
      else {
        await removeFiles('videos', [m.storage_path]);
        await removeFiles('gallery', [m.thumb_path]);
      }
      toast.success('تم الحذف.');
      if (q.data && q.data.rows.length === 1 && page > 0) setPage(page - 1);
      else q.reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const noun = type === 'image' ? 'الصور' : 'الفيديوهات';

  return (
    <div>
      <PageHeader
        title={type === 'image' ? 'الصور' : 'الفيديو'}
        subtitle={`الترتيب هنا هو نفس ترتيب العرض للزوّار. ${filtering ? 'أزيلي البحث/التصفية لتفعيل أزرار الترتيب.' : ''}`}
        actions={
          <>
            <button type="button" className="btn btn-gold" onClick={() => setUploadOpen(true)}>
              + {type === 'image' ? 'رفع صور' : 'رفع فيديو'}
            </button>
            {type === 'video' && (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing('new')}>
                + رابط يوتيوب / فيميو
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <input className="input" type="search" placeholder="بحث بالعنوان…" aria-label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" aria-label="تصفية بالحالة" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">الكل</option>
          <option value="published">منشور</option>
          <option value="hidden">غير منشور</option>
        </select>
      </div>

      {q.loading && !q.data ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data || q.data.rows.length === 0 ? (
        <Empty
          title={filtering ? 'لا توجد نتائج مطابقة' : `لا توجد ${noun} بعد`}
          text={filtering ? 'جرّبي تغيير البحث أو التصفية.' : `ابدئي برفع أول ${type === 'image' ? 'صورة' : 'فيديو'}.`}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.rows.map((m, idx) => {
              const first = page === 0 && idx === 0;
              const last = (page + 1) * PAGE >= q.data!.total && idx === q.data!.rows.length - 1;
              const thumb = type === 'image' ? publicUrl('gallery', m.storage_path) : videoThumb(m);
              return (
                <li key={m.id} className="card flex flex-col overflow-hidden">
                  <div className="relative aspect-video bg-black">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl text-zinc-600">▶</div>
                    )}
                    <div className="absolute start-2 top-2 flex gap-1">
                      <Badge tone={m.is_published ? 'green' : 'gray'}>{m.is_published ? 'منشور' : 'غير منشور'}</Badge>
                      {m.featured && <Badge tone="gold">مميّز</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="truncate font-bold" dir="auto">{m.title || 'بدون عنوان'}</h3>
                    <p className="text-xs text-zinc-400">
                      المشاهدات: {formatNumber(views.data?.[m.id] ?? 0)}
                      {m.size_bytes ? ` · ${formatBytes(m.size_bytes)}` : ''}
                      {type === 'video' && (m.external_url ? ' · رابط خارجي' : ' · ملف مرفوع')}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      <button type="button" className="btn btn-plain btn-sm" disabled={busy === m.id || filtering || first} onClick={() => void move(m, -1)} title="تقديم في الترتيب">
                        ↑ تقديم
                      </button>
                      <button type="button" className="btn btn-plain btn-sm" disabled={busy === m.id || filtering || last} onClick={() => void move(m, 1)} title="تأخير في الترتيب">
                        ↓ تأخير
                      </button>
                      <button type="button" className="btn btn-plain btn-sm" onClick={() => setEditing(m)}>
                        تعديل
                      </button>
                      {type === 'video' ? (
                        <button type="button" className="btn btn-plain btn-sm" onClick={() => setPreview(m)}>
                          معاينة
                        </button>
                      ) : (
                        <a className="btn btn-plain btn-sm" href={publicUrl('gallery', m.storage_path)} target="_blank" rel="noopener noreferrer">
                          معاينة
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-plain btn-sm"
                        disabled={busy === m.id}
                        onClick={() => void patch(m, { is_published: !m.is_published }, m.is_published ? 'تم إلغاء النشر' : 'تم النشر')}
                      >
                        {m.is_published ? 'إلغاء النشر' : 'نشر'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-plain btn-sm"
                        disabled={busy === m.id}
                        onClick={() => void patch(m, { featured: !m.featured }, m.featured ? 'تمت إزالة التمييز' : 'تم التمييز (يظهر في الصفحة الرئيسية)')}
                      >
                        {m.featured ? 'إزالة التمييز' : 'تمييز'}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy === m.id} onClick={() => void remove(m)}>
                        حذف
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}

      {uploadOpen && (
        <UploadModal
          type={type}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            q.reload();
          }}
        />
      )}
      {editing !== null && (
        <EditModal
          item={editing === 'new' ? null : editing}
          type={type}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            q.reload();
          }}
        />
      )}
      <VideoModal item={preview} onClose={() => setPreview(null)} track={false} />
    </div>
  );
}
