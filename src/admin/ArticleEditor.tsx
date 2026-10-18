import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, unwrap } from '@/lib/supabase';
import { publicUrl, removeFiles, uploadImage, uploadVideo } from '@/lib/storage';
import type { VideoUpload } from '@/lib/storage';
import { ArticleBody } from '@/components/ArticleBody';
import { Modal } from '@/components/Modal';
import { Loading, ErrorBox } from '@/components/States';
import { useConfirm, useToast } from '@/components/feedback';
import { errMsg, formatBytes, fromLocalInput, parseVideoUrl, randomId, toLocalInput } from '@/lib/utils';
import type { Article } from '@/lib/types';
import { Badge, Field, PageHeader, Toggle, useUnsavedWarning } from './ui';

interface FormState {
  title: string;
  subtitle: string;
  slug: string;
  body: string;
  cover_path: string | null;
  images: string[];
  video_url: string;
  video_path: string | null;
  status: 'draft' | 'published';
  featured: boolean;
  published_at: string; // datetime-local value
  seo_title: string;
  seo_description: string;
}

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  slug: '',
  body: '',
  cover_path: null,
  images: [],
  video_url: '',
  video_path: null,
  status: 'draft',
  featured: false,
  published_at: '',
  seo_title: '',
  seo_description: '',
};

function fromRow(a: Article): FormState {
  return {
    title: a.title,
    subtitle: a.subtitle ?? '',
    slug: a.slug,
    body: a.body,
    cover_path: a.cover_path,
    images: a.images ?? [],
    video_url: a.video_url ?? '',
    video_path: a.video_path,
    status: a.status,
    featured: a.featured,
    published_at: toLocalInput(a.published_at),
    seo_title: a.seo_title ?? '',
    seo_description: a.seo_description ?? '',
  };
}

export default function ArticleEditor({ kind }: { kind: 'article' | 'biography' }) {
  const { id: routeId } = useParams();
  const isNew = kind === 'article' && routeId === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [restore, setRestore] = useState<FormState | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const removeImgs = useRef<string[]>([]);
  const removeVideos = useRef<string[]>([]);
  const videoUp = useRef<VideoUpload | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = kind === 'biography' ? 'hs_draft_biography' : `hs_draft_article_${routeId ?? 'new'}`;
  useUnsavedWarning(dirty);

  /* ---------------------------------------------------------------- load */
  useEffect(() => {
    let alive = true;
    removeImgs.current = [];
    removeVideos.current = [];
    setDirty(false);
    setLoadError(null);

    const offerDraft = (base: FormState) => {
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as FormState;
        if (JSON.stringify(parsed) !== JSON.stringify(base)) setRestore(parsed);
      } catch {
        /* ignore corrupt draft */
      }
    };

    if (isNew) {
      setRowId(null);
      setForm(EMPTY);
      setLoading(false);
      offerDraft(EMPTY);
      return;
    }

    (async () => {
      setLoading(true);
      let qb = supabase.from('articles').select('*');
      qb = kind === 'biography' ? qb.eq('kind', 'biography') : qb.eq('id', routeId ?? '').eq('kind', 'article');
      const { data, error } = await qb.maybeSingle();
      if (!alive) return;
      if (error) {
        setLoadError(errMsg(error.message));
      } else if (!data) {
        if (kind === 'biography') {
          const base = { ...EMPTY, slug: 'biography', title: 'ما لا تعرفه عن هالة شنب' };
          setRowId(null);
          setForm(base);
          offerDraft(base);
        } else {
          setLoadError('المقال غير موجود.');
        }
      } else {
        const base = fromRow(data as Article);
        setRowId((data as Article).id);
        setForm(base);
        offerDraft(base);
      }
      setLoading(false);
    })().catch((e: unknown) => {
      if (alive) {
        setLoadError(errMsg(e));
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, kind, reloadTick]);

  /* ------------------------------------------- local crash-backup of unsaved edits */
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {
        /* storage full or blocked: ignore */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [form, dirty, draftKey]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  /* ---------------------------------------------------------------- body toolbar */
  function prefixLine(prefix: string) {
    const ta = bodyRef.current;
    const text = form.body;
    const pos = ta?.selectionStart ?? text.length;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    set('body', text.slice(0, lineStart) + prefix + text.slice(lineStart));
    setTimeout(() => ta?.focus(), 0);
  }

  /* ---------------------------------------------------------------- uploads */
  async function onCover(file: File) {
    setUploading('cover');
    try {
      const up = await uploadImage('articles', file, { prefix: 'covers/' });
      if (form.cover_path) removeImgs.current.push(form.cover_path);
      set('cover_path', up.path);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(null);
    }
  }

  async function onImages(files: FileList) {
    setUploading('images');
    const added: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const up = await uploadImage('articles', f, { prefix: 'images/' });
        added.push(up.path);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      if (added.length) setForm((f) => ({ ...f, images: [...f.images, ...added] }));
      if (added.length) setDirty(true);
      setUploading(null);
    }
  }

  function removeImage(path: string) {
    removeImgs.current.push(path);
    set(
      'images',
      form.images.filter((p) => p !== path),
    );
  }

  async function onVideoFile(file: File) {
    setVideoPct(0);
    const up = uploadVideo(file, setVideoPct);
    videoUp.current = up;
    try {
      const res = await up.promise;
      if (form.video_path) removeVideos.current.push(form.video_path);
      setForm((f) => ({ ...f, video_path: res.path, video_url: '' }));
      setDirty(true);
      toast.success(`تم رفع الفيديو (${formatBytes(res.size)}). اضغطي «حفظ» لتثبيته في المقال.`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setVideoPct(null);
      videoUp.current = null;
    }
  }

  function onVideoUrl(v: string) {
    if (v.trim() && form.video_path) {
      removeVideos.current.push(form.video_path);
      setForm((f) => ({ ...f, video_url: v, video_path: null }));
      setDirty(true);
    } else {
      set('video_url', v);
    }
  }

  /* ---------------------------------------------------------------- save / delete */
  async function save(nextStatus?: 'draft' | 'published') {
    const title = form.title.trim();
    if (!title) {
      toast.error('العنوان مطلوب.');
      return;
    }
    const videoUrl = form.video_url.trim();
    if (videoUrl && !parseVideoUrl(videoUrl)) {
      toast.error('رابط الفيديو يجب أن يكون رابط يوتيوب أو فيميو يبدأ بـ https.');
      return;
    }
    const slug = kind === 'biography' ? 'biography' : form.slug.trim() || `a-${randomId()}`;
    if (/[\s/?#%]/.test(slug)) {
      toast.error('الرابط المختصر لا يجوز أن يحتوي مسافات أو الرموز / ? # %');
      return;
    }
    const status = nextStatus ?? form.status;

    const payload = {
      kind,
      slug,
      title,
      subtitle: form.subtitle.trim() || null,
      body: form.body,
      cover_path: form.cover_path,
      images: form.images,
      video_url: videoUrl || null,
      video_path: videoUrl ? null : form.video_path,
      status,
      featured: kind === 'biography' ? false : form.featured,
      published_at: fromLocalInput(form.published_at),
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
    };

    setSaving(true);
    try {
      let savedId = rowId;
      let saved: { id: string; published_at: string | null; slug: string };
      if (rowId) {
        saved = await unwrap<{ id: string; published_at: string | null; slug: string }>(
          supabase.from('articles').update(payload).eq('id', rowId).select('id,published_at,slug').single(),
        );
      } else {
        saved = await unwrap<{ id: string; published_at: string | null; slug: string }>(
          supabase.from('articles').insert(payload).select('id,published_at,slug').single(),
        );
        savedId = saved.id;
        setRowId(saved.id);
      }
      await removeFiles('articles', removeImgs.current);
      await removeFiles('videos', removeVideos.current);
      removeImgs.current = [];
      removeVideos.current = [];
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setForm((f) => ({
        ...f,
        status,
        slug: saved.slug,
        published_at: toLocalInput(saved.published_at),
        video_path: payload.video_path,
        video_url: payload.video_url ?? '',
      }));
      setDirty(false);
      setRestore(null);
      toast.success(status === 'published' ? 'تم الحفظ والنشر.' : 'تم حفظ المسودة.');
      if (isNew && savedId) navigate(`/admin/articles/${savedId}`, { replace: true });
    } catch (e) {
      toast.error(`${errMsg(e)} لم تُفقد تعديلاتك — يمكنك إعادة المحاولة.`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!rowId || kind === 'biography') return;
    const ok = await confirm({
      title: 'حذف المقال',
      message: `سيتم حذف «${form.title}» نهائيًا مع صوره وإحصائياته. لا يمكن التراجع.`,
      confirmText: 'نعم، احذف',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('articles').delete().eq('id', rowId).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('forbidden');
      await removeFiles('articles', [form.cover_path, ...form.images, ...removeImgs.current]);
      await removeFiles('videos', [form.video_path, ...removeVideos.current]);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setDirty(false);
      toast.success('تم حذف المقال.');
      navigate('/admin/articles', { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- render */
  if (loading) return <Loading />;
  if (loadError) {
    return (
      <div>
        <ErrorBox message={loadError} onRetry={() => setReloadTick((t) => t + 1)} />
        <div className="text-center">
          <Link to="/admin/articles" className="btn btn-plain">العودة للمقالات</Link>
        </div>
      </div>
    );
  }

  const isBio = kind === 'biography';
  const coverUrl = publicUrl('articles', form.cover_path);
  const busy = saving || uploading !== null || videoPct !== null;

  return (
    <div>
      <PageHeader
        title={isBio ? 'تعديل السيرة الذاتية' : isNew ? 'مقال جديد' : 'تعديل المقال'}
        subtitle={
          isBio
            ? 'هذا هو نص صفحة «ما لا تعرفه عن هالة شنب». أي تعديل يظهر مباشرة بعد الحفظ.'
            : undefined
        }
        actions={
          <>
            <Badge tone={form.status === 'published' ? 'green' : 'gray'}>{form.status === 'published' ? 'منشور' : 'مسودة'}</Badge>
            {dirty && <Badge tone="gold">تعديلات غير محفوظة</Badge>}
          </>
        }
      />

      {restore && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/50 bg-gold-500/10 p-4" role="alert">
          <p className="text-sm">وُجدت نسخة غير محفوظة من تعديلات سابقة على هذه الصفحة. هل تريدين استعادتها؟</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={() => {
                setForm(restore);
                setDirty(true);
                setRestore(null);
              }}
            >
              استعادة
            </button>
            <button
              type="button"
              className="btn btn-plain btn-sm"
              onClick={() => {
                try {
                  localStorage.removeItem(draftKey);
                } catch {
                  /* ignore */
                }
                setRestore(null);
              }}
            >
              تجاهل
            </button>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button type="button" className="btn btn-gold btn-sm" disabled={busy} onClick={() => void save('published')}>
          {saving ? 'جارٍ الحفظ…' : form.status === 'published' ? 'حفظ التعديلات' : 'حفظ ونشر'}
        </button>
        {form.status === 'published' ? (
          <button type="button" className="btn btn-plain btn-sm" disabled={busy} onClick={() => void save('draft')}>
            إلغاء النشر (تحويل لمسودة)
          </button>
        ) : (
          <button type="button" className="btn btn-plain btn-sm" disabled={busy} onClick={() => void save('draft')}>
            حفظ كمسودة
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(true)}>
          معاينة
        </button>
        <Link to={isBio ? '/admin' : '/admin/articles'} className="btn btn-plain btn-sm">
          رجوع
        </Link>
        {!isNew && !isBio && (
          <button type="button" className="btn btn-danger btn-sm ms-auto" disabled={busy} onClick={() => void remove()}>
            حذف المقال
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Field label="العنوان *" htmlFor="title">
            <input id="title" className="input" value={form.title} maxLength={300} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="عنوان فرعي (اختياري)" htmlFor="subtitle">
            <input id="subtitle" className="input" value={form.subtitle} maxLength={500} onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
          <div>
            <label className="label" htmlFor="body">نص المقال</label>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-plain btn-sm" onClick={() => prefixLine('## ')}>عنوان رئيسي</button>
              <button type="button" className="btn btn-plain btn-sm" onClick={() => prefixLine('### ')}>عنوان صغير</button>
              <button type="button" className="btn btn-plain btn-sm" onClick={() => prefixLine('> ')}>اقتباس</button>
            </div>
            <textarea
              id="body"
              ref={bodyRef}
              className="input min-h-[28rem]"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
            />
            <p className="hint">
              افصلي بين الفقرات بسطر فارغ. لجعل سطر عنوانًا ابدئيه بـ <bdi dir="ltr">## </bdi> أو <bdi dir="ltr">### </bdi>، وللاقتباس بـ <bdi dir="ltr">&gt; </bdi>. زر «معاينة» يعرض الشكل النهائي.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-3 p-4">
            <h2 className="font-bold text-gold-300">النشر</h2>
            <Field label="الحالة" htmlFor="status">
              <select id="status" className="input" value={form.status} onChange={(e) => set('status', e.target.value as 'draft' | 'published')}>
                <option value="draft">مسودة (خاصة بالإدارة)</option>
                <option value="published">منشور</option>
              </select>
            </Field>
            <Field label="تاريخ النشر" htmlFor="pub" hint="اتركيه فارغًا ليُستخدم وقت النشر. تاريخ مستقبلي = نشر مجدول.">
              <input id="pub" type="datetime-local" className="input" dir="ltr" value={form.published_at} onChange={(e) => set('published_at', e.target.value)} />
            </Field>
            {!isBio && <Toggle checked={form.featured} onChange={(v) => set('featured', v)} label="مقال مميّز (يظهر أولًا)" />}
            {!isBio && (
              <Field label="الرابط المختصر" htmlFor="slug" hint="يُولَّد تلقائيًا إن تُرك فارغًا. بدون مسافات.">
                <input id="slug" className="input" dir="ltr" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
              </Field>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-bold text-gold-300">صورة الغلاف</h2>
            {coverUrl && <img src={coverUrl} alt="غلاف المقال" className="w-full rounded-lg border border-line" />}
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-plain btn-sm cursor-pointer">
                {uploading === 'cover' ? 'جارٍ الرفع…' : coverUrl ? 'استبدال الصورة' : 'رفع صورة'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void onCover(f);
                  }}
                />
              </label>
              {coverUrl && (
                <button
                  type="button"
                  className="btn btn-plain btn-sm"
                  onClick={() => {
                    if (form.cover_path) removeImgs.current.push(form.cover_path);
                    set('cover_path', null);
                  }}
                >
                  إزالة
                </button>
              )}
            </div>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-bold text-gold-300">صور إضافية</h2>
            {form.images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {form.images.map((p) => (
                  <li key={p} className="relative">
                    <img src={publicUrl('articles', p)} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                    <button
                      type="button"
                      className="btn btn-danger absolute end-1 top-1 !min-h-0 !px-2 !py-0.5 text-xs"
                      aria-label="حذف الصورة"
                      onClick={() => removeImage(p)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="btn btn-plain btn-sm cursor-pointer">
              {uploading === 'images' ? 'جارٍ الرفع…' : '+ إضافة صور'}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length) void onImages(files);
                  e.target.value = '';
                }}
              />
            </label>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-bold text-gold-300">فيديو (اختياري)</h2>
            <Field label="رابط يوتيوب أو فيميو" htmlFor="vurl">
              <input id="vurl" className="input" dir="ltr" placeholder="https://www.youtube.com/watch?v=…" value={form.video_url} onChange={(e) => onVideoUrl(e.target.value)} />
            </Field>
            <p className="text-center text-xs text-zinc-500">— أو —</p>
            {form.video_path && <p className="text-sm text-emerald-300">يوجد ملف فيديو مرفوع لهذا المقال.</p>}
            {videoPct !== null ? (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={videoPct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-gold-500 transition-all" style={{ width: `${videoPct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>جارٍ الرفع… {videoPct}%</span>
                  <button type="button" className="btn btn-plain btn-sm" onClick={() => videoUp.current?.abort()}>
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <label className="btn btn-plain btn-sm cursor-pointer">
                {form.video_path ? 'استبدال ملف الفيديو' : 'رفع ملف فيديو'}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void onVideoFile(f);
                  }}
                />
              </label>
            )}
            {form.video_path && videoPct === null && (
              <button
                type="button"
                className="btn btn-plain btn-sm"
                onClick={() => {
                  removeVideos.current.push(form.video_path!);
                  set('video_path', null);
                }}
              >
                إزالة الفيديو المرفوع
              </button>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-bold text-gold-300">محركات البحث (SEO)</h2>
            <Field label="عنوان SEO" htmlFor="seot" hint="اختياري. يُستخدم عنوان المقال إن تُرك فارغًا.">
              <input id="seot" className="input" maxLength={120} value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} />
            </Field>
            <Field label="وصف SEO" htmlFor="seod">
              <textarea id="seod" className="input min-h-24" maxLength={300} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} />
            </Field>
          </section>
        </aside>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="معاينة قبل النشر" wide>
        <div className="space-y-4">
          {form.status !== 'published' && <p className="rounded-lg border border-line bg-panel p-2 text-center text-sm text-amber-300">هذه معاينة: المقال ما زال مسودة ولا يراه الزوّار.</p>}
          {coverUrl && <img src={coverUrl} alt="" className="w-full rounded-xl" />}
          <h2 className="text-center font-display text-3xl gold-text">{form.title || 'بدون عنوان'}</h2>
          {form.subtitle && <p className="text-center font-display text-lg text-zinc-300">{form.subtitle}</p>}
          <ArticleBody body={form.body} />
        </div>
      </Modal>
    </div>
  );
}
