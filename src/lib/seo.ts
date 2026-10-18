import { useEffect } from 'react';
import { logoSrc, useSettings } from './settings';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

interface SeoInput {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  type?: 'website' | 'article';
}

/**
 * Updates the document title and meta tags on every page.
 * Note: social crawlers (Facebook, WhatsApp...) do not run JavaScript, so link previews use the
 * site-wide defaults in index.html; search engines such as Google do render these tags.
 */
export function useSeo({ title, description, image, type = 'website' }: SeoInput) {
  const { settings } = useSettings();
  useEffect(() => {
    const name = settings.site_name;
    const fullTitle = title ? `${title} | ${name}` : settings.seo_title || name;
    const desc = description || settings.seo_description || settings.slogan;
    const img = image || (logoSrc(settings).startsWith('http') ? logoSrc(settings) : `${location.origin}/logo.png`);

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', location.href);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:card', 'summary_large_image');
  }, [title, description, image, type, settings]);
}
