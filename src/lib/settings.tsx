import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import { publicUrl } from './storage';
import { safeHttpUrl, waDigits } from './utils';
import type { SectionCfg, SectionId, SiteSettings, SocialKey } from './types';

/**
 * Fallback values used ONLY to fill gaps while the saved settings load (or if a field is missing).
 * The real, editable content lives in the `site_settings` table.
 */
export const DEFAULT_SECTIONS: SectionCfg[] = [
  { id: 'story', title: 'ما لا تعرفه عن هالة شنب', description: '', visible: true },
  { id: 'services', title: 'العناية بالشعر والتريتمنت', description: '', visible: true },
  { id: 'articles', title: 'آخر المقالات والأخبار', description: '', visible: true },
  { id: 'gallery', title: 'معرض الصور', description: '', visible: true },
  { id: 'videos', title: 'معرض الفيديو', description: '', visible: true },
  { id: 'contact', title: 'تواصلي معنا', description: '', visible: true },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'هالة شنب للعناية بالشعر',
  slogan: 'استعيدي جمال وقوة شعرك مع هالة شنب.',
  logo_path: null,
  hero_image_path: null,
  hero_headline: 'هالة شنب للعناية بالشعر',
  hero_intro: '',
  phone: '01117723485',
  address: 'كوتسيكا - المعادي - شارع الست شتيا - أمام نفق كوتسيكا - بجوار ورشة الحاج مصباح للخراطة',
  social: {
    facebook: { url: '', enabled: false },
    instagram: { url: '', enabled: false },
    whatsapp: { url: '', phone: '01117723485', enabled: false },
  },
  social_order: ['facebook', 'instagram', 'whatsapp'],
  footer_text: 'جميع الحقوق محفوظة لـ هالة شنب للعناية بالشعر.',
  seo_title: 'هالة شنب للعناية بالشعر',
  seo_description: 'استعيدي جمال وقوة شعرك مع هالة شنب.',
  accent: 'gold',
  sections: DEFAULT_SECTIONS,
  services: [],
};

export function mergeSettings(saved: Partial<SiteSettings> | null | undefined): SiteSettings {
  const s = saved ?? {};
  const savedSections = Array.isArray(s.sections) ? s.sections : [];
  const known = new Set<SectionId>(DEFAULT_SECTIONS.map((d) => d.id));
  const ordered: SectionCfg[] = savedSections
    .filter((x): x is SectionCfg => Boolean(x) && known.has(x.id))
    .map((x) => ({ ...DEFAULT_SECTIONS.find((d) => d.id === x.id)!, ...x }));
  for (const d of DEFAULT_SECTIONS) if (!ordered.some((o) => o.id === d.id)) ordered.push(d);

  const order = Array.isArray(s.social_order) ? s.social_order : [];
  const fullOrder: SocialKey[] = [...order.filter((k): k is SocialKey => ['facebook', 'instagram', 'whatsapp'].includes(k))];
  for (const k of DEFAULT_SETTINGS.social_order) if (!fullOrder.includes(k)) fullOrder.push(k);

  return {
    ...DEFAULT_SETTINGS,
    ...s,
    social: {
      facebook: { ...DEFAULT_SETTINGS.social.facebook, ...(s.social?.facebook ?? {}) },
      instagram: { ...DEFAULT_SETTINGS.social.instagram, ...(s.social?.instagram ?? {}) },
      whatsapp: { ...DEFAULT_SETTINGS.social.whatsapp, ...(s.social?.whatsapp ?? {}) },
    },
    social_order: fullOrder,
    sections: ordered,
    services: Array.isArray(s.services) ? s.services : DEFAULT_SETTINGS.services,
  };
}

interface Ctx {
  settings: SiteSettings;
  loading: boolean;
  error: string | null;
  reload: () => void;
}
const SettingsCtx = createContext<Ctx>({ settings: DEFAULT_SETTINGS, loading: true, error: null, reload: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: err } = await supabase.from('site_settings').select('value').eq('key', 'site').maybeSingle();
      if (!alive) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setSettings(mergeSettings((data?.value ?? null) as Partial<SiteSettings> | null));
      }
      setLoading(false);
    })().catch((e: unknown) => {
      if (alive) {
        setError(e instanceof Error ? e.message : 'settings error');
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    document.documentElement.dataset.accent = settings.accent;
  }, [settings.accent]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const value = useMemo(() => ({ settings, loading, error, reload }), [settings, loading, error, reload]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export const useSettings = () => useContext(SettingsCtx);

export function logoSrc(s: SiteSettings): string {
  return s.logo_path ? publicUrl('branding', s.logo_path) : '/logo.png';
}

export interface SocialLink {
  key: SocialKey;
  label: string;
  href: string;
}
const LABELS: Record<SocialKey, string> = { facebook: 'فيسبوك', instagram: 'إنستجرام', whatsapp: 'واتساب' };
export const socialLabel = (k: SocialKey) => LABELS[k];

/** WhatsApp click-to-chat link from either an explicit https URL or the configured phone number. */
export function whatsappHref(s: SiteSettings): string | null {
  const w = s.social.whatsapp;
  const url = safeHttpUrl(w.url);
  if (url && /^https:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(url)) return url;
  const digits = waDigits(w.phone || s.phone);
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Only icons that are ENABLED and have a valid URL are returned — no empty or broken links are ever shown. */
export function activeSocialLinks(s: SiteSettings): SocialLink[] {
  const out: SocialLink[] = [];
  for (const key of s.social_order) {
    let href: string | null = null;
    if (key === 'whatsapp') {
      if (s.social.whatsapp.enabled) href = whatsappHref(s);
    } else if (s.social[key].enabled) {
      href = safeHttpUrl(s.social[key].url);
    }
    if (href) out.push({ key, label: LABELS[key], href });
  }
  return out;
}

export function useSocialLinks(): SocialLink[] {
  const { settings } = useSettings();
  return useMemo(() => activeSocialLinks(settings), [settings]);
}
