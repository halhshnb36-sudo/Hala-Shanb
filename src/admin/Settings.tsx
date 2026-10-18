import { useRef, useState } from 'react';
import { supabase, unwrap } from '@/lib/supabase';
import { publicUrl, removeFiles, uploadImage } from '@/lib/storage';
import { Loading, ErrorBox } from '@/components/States';
import { useToast } from '@/components/feedback';
import { activeSocialLinks, mergeSettings, socialLabel, useSettings } from '@/lib/settings';
import { errMsg, safeHttpUrl, useAsync, waDigits } from '@/lib/utils';
import type { Accent, SectionCfg, SiteSettings, SocialKey } from '@/lib/types';
import { Field, PageHeader, Toggle, useUnsavedWarning } from './ui';

const ACCENTS: Array<{ id: Accent; label: string; swatch: string }> = [
  { id: 'gold', label: 'ذهبي كلاسيكي', swatch: '#c9a24d' },
  { id: 'champagne', label: 'شامبانيا', swatch: '#d2b97f' },
  { id: 'rose', label: 'روز جولد', swatch: '#cf8f72' },
];

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

async function loadSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'site').maybeSingle();
  if (error) throw new Error(error.message);
  return mergeSettings((data?.value ?? null) as Partial<SiteSettings> | null);
}

export default function Settings() {
  const q = useAsync(loadSettings, []);
  if (q.loading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox message={q.error ?? 'تعذّر تحميل الإعدادات'} onRetry={q.reload} />;
  return <SettingsForm initial={q.data} />;
}

function SettingsForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast();
  const { reload } = useSettings();
  const [s, setS] = useState<SiteSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'hero' | null>(null);
  const removeLater = useRef<string[]>([]);
  useUnsavedWarning(dirty);

  function update(fn: (draft: SiteSettings) => SiteSettings) {
    setS((cur) => fn(cur));
    setDirty(true);
  }

  async function upload(kind: 'logo' | 'hero', file: File) {
    setUploading(kind);
    try {
      // The logo keeps its transparency and exact pixels (no re-compression).
      const up = await uploadImage('branding', file, { prefix: `${kind}/`, compress: kind === 'hero' });
      const key = kind === 'logo' ? 'logo_path' : 'hero_image_path';
      const old = s[key];
      if (old) removeLater.current.push(old);
      update((d) => ({ ...d, [key]: up.path }));
      toast.success('تم رفع الصورة. اضغطي «حفظ الإعدادات» لتطبيقها على الموقع.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(null);
    }
  }

  function clearImage(kind: 'logo' | 'hero') {
    const key = kind === 'logo' ? 'logo_path' : 'hero_image_path';
    const old = s[key];
    if (old) removeLater.current.push(old);
    update((d) => ({ ...d, [key]: null }));
  }

  function validate(): string | null {
    if (!s.site_name.trim()) return 'اسم الموقع مطلوب.';
    for (const k of ['facebook', 'instagram'] as const) {
      const c = s.social[k];
      if (c.enabled && !safeHttpUrl(c.url)) return `فعّلتِ أيقونة ${socialLabel(k)} لكن الرابط غير صحيح. أدخلي رابطًا كاملًا يبدأ بـ https.`;
      if (c.url.trim() && !safeHttpUrl(c.url)) return `رابط ${socialLabel(k)} غير صحيح.`;
    }
    const w = s.social.whatsapp;
    if (w.url.trim() && !/^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(w.url.trim())) {
      return 'رابط واتساب يجب أن يبدأ بـ https://wa.me/ أو اتركيه فارغًا واكتبي رقم الهاتف.';
    }
    if (w.enabled && !w.url.trim() && waDigits(w.phone || s.phone).length < 8) return 'فعّلتِ واتساب لكن لا يوجد رقم هاتف أو رابط صحيح.';
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const clean: SiteSettings = {
        ...s,
        site_name: s.site_name.trim(),
        social: {
          facebook: { ...s.social.facebook, url: s.social.facebook.url.trim() },
          instagram: { ...s.social.instagram, url: s.social.instagram.url.trim() },
          whatsapp: { ...s.social.whatsapp, url: s.social.whatsapp.url.trim(), phone: s.social.whatsapp.phone.trim() },
        },
        services: s.services.filter((x) => x.title.trim() || x.text.trim()),
      };
      await unwrap(supabase.from('site_settings').upsert({ key: 'site', value: clean }, { onConflict: 'key' }).select('key').single());
      await removeFiles('branding', removeLater.current);
      removeLater.current = [];
      setS(clean);
      setDirty(false);
      reload();
      toast.success('تم حفظ الإعدادات وتطبيقها على الموقع.');
    } catch (e) {
      toast.error(`${errMsg(e)} لم تُفقد تعديلاتك — يمكنك إعادة المحاولة.`);
    } finally {
      setSaving(false);
    }
  }

  const setSection = (i: number, patch: Partial<SectionCfg>) =>
    update((d) => ({ ...d, sections: d.sections.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));

  const logoPreview = s.logo_path ? publicUrl('branding', s.logo_path) : '/logo.png';
  const heroPreview = publicUrl('branding', s.hero_image_path);
  const activePreview = activeSocialLinks(s);

  return (
    <div>
      <PageHeader title="إعدادات الموقع" subtitle="كل ما هنا محفوظ في قاعدة البيانات ويظهر في الموقع بعد الضغط على «حفظ الإعدادات»." />

      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-wrap items-center gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button type="button" className="btn btn-gold btn-sm" disabled={saving || uploading !== null} onClick={() => void save()}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
        </button>
        {dirty && <span className="text-sm text-gold-300">توجد تعديلات غير محفوظة</span>}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---------------- general + logo */}
        <section className="card space-y-4 p-5" aria-labelledby="s-general">
          <h2 id="s-general" className="font-bold text-gold-300">الهوية والشعار</h2>
          <Field label="اسم الموقع" htmlFor="sn">
            <input id="sn" className="input" value={s.site_name} onChange={(e) => update((d) => ({ ...d, site_name: e.target.value }))} />
          </Field>
          <Field label="الشعار التسويقي" htmlFor="slogan">
            <input id="slogan" className="input" value={s.slogan} onChange={(e) => update((d) => ({ ...d, slogan: e.target.value }))} />
          </Field>
          <div>
            <p className="label">الشعار (Logo)</p>
            <div className="flex flex-wrap items-center gap-4">
              <img src={logoPreview} alt="الشعار الحالي" className="h-28 w-28 rounded-xl border border-line bg-coal object-contain p-2" />
              <div className="flex flex-col gap-2">
                <label className="btn btn-plain btn-sm cursor-pointer">
                  {uploading === 'logo' ? 'جارٍ الرفع…' : 'رفع شعار جديد'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void upload('logo', f);
                    }}
                  />
                </label>
                {s.logo_path && (
                  <button type="button" className="btn btn-plain btn-sm" onClick={() => clearImage('logo')}>
                    العودة للشعار الافتراضي
                  </button>
                )}
              </div>
            </div>
            <p className="hint">يُفضّل PNG بخلفية شفافة (حتى ٥ م.ب).</p>
          </div>
          <div>
            <p className="label">اللون الرئيسي (ضمن نظام التصميم المعتمد)</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="اللون الرئيسي">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={s.accent === a.id}
                  onClick={() => update((d) => ({ ...d, accent: a.id }))}
                  className={`btn btn-sm ${s.accent === a.id ? 'btn-gold' : 'btn-plain'}`}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: a.swatch }} aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- hero */}
        <section className="card space-y-4 p-5" aria-labelledby="s-hero">
          <h2 id="s-hero" className="font-bold text-gold-300">الصفحة الرئيسية (الواجهة)</h2>
          <Field label="العنوان الرئيسي" htmlFor="hh">
            <input id="hh" className="input" value={s.hero_headline} onChange={(e) => update((d) => ({ ...d, hero_headline: e.target.value }))} />
          </Field>
          <Field label="النص التعريفي" htmlFor="hi">
            <textarea id="hi" className="input min-h-32" value={s.hero_intro} onChange={(e) => update((d) => ({ ...d, hero_intro: e.target.value }))} />
          </Field>
          <div>
            <p className="label">صورة خلفية الواجهة (اختياري)</p>
            {heroPreview && <img src={heroPreview} alt="" className="mb-2 h-32 w-full rounded-lg border border-line object-cover" />}
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-plain btn-sm cursor-pointer">
                {uploading === 'hero' ? 'جارٍ الرفع…' : heroPreview ? 'استبدال الصورة' : 'رفع صورة'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void upload('hero', f);
                  }}
                />
              </label>
              {heroPreview && (
                <button type="button" className="btn btn-plain btn-sm" onClick={() => clearImage('hero')}>
                  إزالة
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- contact + footer + SEO */}
        <section className="card space-y-4 p-5" aria-labelledby="s-contact">
          <h2 id="s-contact" className="font-bold text-gold-300">بيانات التواصل والتذييل</h2>
          <Field label="رقم الهاتف" htmlFor="ph">
            <input id="ph" className="input" dir="ltr" value={s.phone} onChange={(e) => update((d) => ({ ...d, phone: e.target.value }))} />
          </Field>
          <Field label="العنوان" htmlFor="ad">
            <textarea id="ad" className="input min-h-24" value={s.address} onChange={(e) => update((d) => ({ ...d, address: e.target.value }))} />
          </Field>
          <Field label="نص التذييل (Footer)" htmlFor="ft">
            <input id="ft" className="input" value={s.footer_text} onChange={(e) => update((d) => ({ ...d, footer_text: e.target.value }))} />
          </Field>
          <Field label="عنوان SEO الافتراضي" htmlFor="st">
            <input id="st" className="input" maxLength={120} value={s.seo_title} onChange={(e) => update((d) => ({ ...d, seo_title: e.target.value }))} />
          </Field>
          <Field label="وصف SEO الافتراضي" htmlFor="sd">
            <textarea id="sd" className="input min-h-24" maxLength={300} value={s.seo_description} onChange={(e) => update((d) => ({ ...d, seo_description: e.target.value }))} />
          </Field>
        </section>

        {/* ---------------- social */}
        <section className="card space-y-4 p-5" aria-labelledby="s-social">
          <h2 id="s-social" className="font-bold text-gold-300">وسائل التواصل الاجتماعي</h2>
          <p className="text-sm leading-7 text-zinc-400">
            الأيقونة لا تظهر في الموقع إلا إذا كانت <b>مفعّلة</b> وكان رابطها صحيحًا. لا تُدخلي روابط غير حقيقية.
          </p>
          <ul className="space-y-4">
            {s.social_order.map((key: SocialKey, i) => (
              <li key={key} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-bold">{socialLabel(key)}</h3>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-plain btn-sm" disabled={i === 0} aria-label="تقديم" onClick={() => update((d) => ({ ...d, social_order: move(d.social_order, i, -1) }))}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-plain btn-sm" disabled={i === s.social_order.length - 1} aria-label="تأخير" onClick={() => update((d) => ({ ...d, social_order: move(d.social_order, i, 1) }))}>
                      ↓
                    </button>
                  </div>
                </div>
                {key === 'whatsapp' ? (
                  <div className="space-y-3">
                    <Field label="رقم واتساب" htmlFor="wp" hint="يُستخدم لبناء رابط المحادثة تلقائيًا (wa.me).">
                      <input id="wp" className="input" dir="ltr" value={s.social.whatsapp.phone} onChange={(e) => update((d) => ({ ...d, social: { ...d.social, whatsapp: { ...d.social.whatsapp, phone: e.target.value } } }))} />
                    </Field>
                    <Field label="أو رابط محادثة جاهز (اختياري)" htmlFor="wu">
                      <input id="wu" className="input" dir="ltr" placeholder="https://wa.me/201117723485" value={s.social.whatsapp.url} onChange={(e) => update((d) => ({ ...d, social: { ...d.social, whatsapp: { ...d.social.whatsapp, url: e.target.value } } }))} />
                    </Field>
                    <Toggle checked={s.social.whatsapp.enabled} onChange={(v) => update((d) => ({ ...d, social: { ...d.social, whatsapp: { ...d.social.whatsapp, enabled: v } } }))} label="تفعيل أيقونة واتساب" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field label={`رابط ${socialLabel(key)}`} htmlFor={`u-${key}`}>
                      <input
                        id={`u-${key}`}
                        className="input"
                        dir="ltr"
                        placeholder="https://…"
                        value={s.social[key].url}
                        onChange={(e) => update((d) => ({ ...d, social: { ...d.social, [key]: { ...d.social[key], url: e.target.value } } }))}
                      />
                    </Field>
                    <Toggle
                      checked={s.social[key].enabled}
                      onChange={(v) => update((d) => ({ ...d, social: { ...d.social, [key]: { ...d.social[key], enabled: v } } }))}
                      label={`تفعيل أيقونة ${socialLabel(key)}`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-400">
            الأيقونات الظاهرة حاليًا بعد هذه التعديلات: {activePreview.length ? activePreview.map((l) => l.label).join('، ') : 'لا شيء (لن يظهر قسم الأيقونات)'}
          </p>
        </section>

        {/* ---------------- homepage sections */}
        <section className="card space-y-4 p-5 xl:col-span-2" aria-labelledby="s-sections">
          <h2 id="s-sections" className="font-bold text-gold-300">أقسام الصفحة الرئيسية (الترتيب والعناوين)</h2>
          <ul className="space-y-3">
            {s.sections.map((sec, i) => (
              <li key={sec.id} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Toggle checked={sec.visible} onChange={(v) => setSection(i, { visible: v })} label={`إظهار القسم (${sec.id})`} />
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-plain btn-sm" disabled={i === 0} aria-label="تقديم القسم" onClick={() => update((d) => ({ ...d, sections: move(d.sections, i, -1) }))}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-plain btn-sm" disabled={i === s.sections.length - 1} aria-label="تأخير القسم" onClick={() => update((d) => ({ ...d, sections: move(d.sections, i, 1) }))}>
                      ↓
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="عنوان القسم" htmlFor={`st-${sec.id}`}>
                    <input id={`st-${sec.id}`} className="input" value={sec.title} onChange={(e) => setSection(i, { title: e.target.value })} />
                  </Field>
                  <Field label="وصف القسم" htmlFor={`sd-${sec.id}`}>
                    <input id={`sd-${sec.id}`} className="input" value={sec.description} onChange={(e) => setSection(i, { description: e.target.value })} />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- services */}
        <section className="card space-y-4 p-5 xl:col-span-2" aria-labelledby="s-services">
          <div className="flex items-center justify-between">
            <h2 id="s-services" className="font-bold text-gold-300">بطاقات قسم الخدمات</h2>
            <button type="button" className="btn btn-plain btn-sm" onClick={() => update((d) => ({ ...d, services: [...d.services, { title: '', text: '' }] }))}>
              + إضافة بطاقة
            </button>
          </div>
          {s.services.length === 0 && <p className="text-sm text-zinc-400">لا توجد بطاقات. سيظهر في الموقع «سيتم إضافة الخدمات قريبًا».</p>}
          <ul className="space-y-3">
            {s.services.map((sv, i) => (
              <li key={i} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_2fr_auto]">
                <input className="input" aria-label="عنوان الخدمة" placeholder="عنوان الخدمة" value={sv.title} onChange={(e) => update((d) => ({ ...d, services: d.services.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)) }))} />
                <input className="input" aria-label="وصف الخدمة" placeholder="وصف قصير" value={sv.text} onChange={(e) => update((d) => ({ ...d, services: d.services.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)) }))} />
                <div className="flex gap-1">
                  <button type="button" className="btn btn-plain btn-sm" disabled={i === 0} aria-label="تقديم" onClick={() => update((d) => ({ ...d, services: move(d.services, i, -1) }))}>↑</button>
                  <button type="button" className="btn btn-plain btn-sm" disabled={i === s.services.length - 1} aria-label="تأخير" onClick={() => update((d) => ({ ...d, services: move(d.services, i, 1) }))}>↓</button>
                  <button type="button" className="btn btn-danger btn-sm" aria-label="حذف البطاقة" onClick={() => update((d) => ({ ...d, services: d.services.filter((_, idx) => idx !== i) }))}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
