import { supabase } from './supabase';

export type TrackType = 'biography' | 'article' | 'image' | 'video';

const SID_KEY = 'hs_sid';
let memorySid: string | null = null;

/** Random per-tab-session identifier. Contains no personal data and is not linked to any account. */
function sessionId(): string {
  try {
    let v = sessionStorage.getItem(SID_KEY);
    if (!v || v.length < 16) {
      v = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, v);
    }
    return v;
  } catch {
    memorySid ??= crypto.randomUUID();
    return memorySid;
  }
}

const recent = new Map<string, number>();

/**
 * Records ONE real view event through the server-side `track_view` function.
 * - Called only on real user actions (page opened, photo opened, video play started), never on re-renders.
 * - A 3 second in-memory guard absorbs React StrictMode double effects.
 * - The database applies the real de-duplication window and rate limits.
 * - Signed-in sessions (the administrator previewing the site) are not counted.
 */
export async function trackView(type: TrackType, id: string): Promise<void> {
  const key = `${type}:${id}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 3000) return;
  recent.set(key, now);

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const event = type === 'image' ? 'image_view' : type === 'video' ? 'video_play' : 'page_view';
    await supabase.rpc('track_view', {
      p_content_type: type,
      p_content_id: id,
      p_event_type: event,
      p_session: sessionId(),
    });
  } catch {
    /* analytics must never break the page */
  }
}
