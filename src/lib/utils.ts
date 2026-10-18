import { useEffect, useState } from 'react';
import type { DependencyList } from 'react';

/* ------------------------------------------------------------------ errors */
export function errMsg(e: unknown): string {
  const m =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : ((e as { message?: string } | null)?.message ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m))
    return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.';
  if (/duplicate key|23505/.test(m)) return 'هذه القيمة مستخدمة بالفعل (مثل الرابط المختصر). غيّرها وحاول مرة أخرى.';
  if (/row-level security|42501|forbidden|permission denied/i.test(m)) return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  if (/JSON object requested|no rows/i.test(m)) return 'لم يتم العثور على العنصر، أو لا تملك صلاحية تعديله.';
  if (/maximum allowed size|too large|413|exceeded/i.test(m)) return 'حجم الملف أكبر من المسموح به.';
  if (/mime type|not supported|invalid_mime/i.test(m)) return 'نوع الملف غير مسموح به.';
  return m || 'حدث خطأ غير متوقع.';
}

/* ------------------------------------------------------------------ async hook */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setState({ data: null, loading: false, error: errMsg(e) });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ------------------------------------------------------------------ formatting */
const dateFmt = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'Africa/Cairo' });
const dateTimeFmt = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Cairo',
});
const numFmt = new Intl.NumberFormat('ar-EG');

export const formatDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '');
export const formatDateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '');
export const formatNumber = (n?: number | null) => numFmt.format(n ?? 0);
export const formatBytes = (b?: number | null) => {
  if (!b) return '';
  if (b < 1024 * 1024) return `${numFmt.format(Math.round(b / 1024))} ك.ب`;
  if (b < 1024 * 1024 * 1024) return `${numFmt.format(Math.round((b / 1024 / 1024) * 10) / 10)} م.ب`;
  return `${numFmt.format(Math.round((b / 1024 / 1024 / 1024) * 100) / 100)} ج.ب`;
};

/** ISO <-> value of <input type="datetime-local"> (browser local time). */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ------------------------------------------------------------------ article body */
export type Block = { t: 'h2' | 'h3' | 'quote' | 'p'; text: string };

/**
 * Body format: blocks separated by a blank line.
 * "## " = heading, "### " = small heading, "> " = quote, anything else = paragraph.
 * Rendered as plain text nodes by React (never as HTML), so stored content cannot inject markup.
 */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    let para: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ t: 'p', text: para.join('\n') });
      para = [];
    };
    for (const line of chunk.split('\n')) {
      if (line.startsWith('### ')) {
        flush();
        blocks.push({ t: 'h3', text: line.slice(4).trim() });
      } else if (line.startsWith('## ')) {
        flush();
        blocks.push({ t: 'h2', text: line.slice(3).trim() });
      } else if (line.startsWith('> ')) {
        flush();
        blocks.push({ t: 'quote', text: line.slice(2).trim() });
      } else {
        para.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export function excerpt(body: string, max = 170): string {
  const first = parseBody(body).find((b) => b.t === 'p');
  if (!first) return '';
  const t = first.text.replace(/\s+/g, ' ');
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t;
}

/* ------------------------------------------------------------------ links */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Egyptian-friendly normalisation of a phone number to international digits for wa.me. */
export function waDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '20' + d.slice(1);
  return d;
}

export type ParsedVideo =
  | { kind: 'youtube'; embed: string; thumb: string }
  | { kind: 'vimeo'; embed: string; thumb: null };

/** Only YouTube and Vimeo are accepted as external video sources. */
export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id: string | null | undefined;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else id = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,20})/)?.[1];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) {
      return {
        kind: 'youtube',
        embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
    if (host === 'vimeo.com') {
      const vid = u.pathname.match(/^\/(\d{4,})/)?.[1];
      if (vid) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${vid}?autoplay=1`, thumb: null };
    }
    if (host === 'player.vimeo.com') {
      const vid = u.pathname.match(/^\/video\/(\d{4,})/)?.[1];
      if (vid) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${vid}?autoplay=1`, thumb: null };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function randomId(len = 8): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}
