import { supabase } from './supabase';
import type { Article, MediaItem } from './types';

/*
 * Public data access. Every query filters on published content explicitly, even though RLS already
 * enforces it: a signed-in administrator browsing the public site must not see drafts mixed in.
 */

export async function getBiography(): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('kind', 'biography')
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Article | null) ?? null;
}

export async function listArticles(limit: number, offset = 0): Promise<{ rows: Article[]; total: number }> {
  const { data, error, count } = await supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('kind', 'article')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Article[], total: count ?? 0 };
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('kind', 'article')
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Article | null) ?? null;
}

export async function listMedia(
  type: 'image' | 'video',
  limit: number,
  offset = 0,
): Promise<{ rows: MediaItem[]; total: number }> {
  const { data, error, count } = await supabase
    .from('media')
    .select('*', { count: 'exact' })
    .eq('type', type)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as MediaItem[], total: count ?? 0 };
}

export async function getFeaturedMedia(): Promise<MediaItem | null> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('is_published', true)
    .eq('featured', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MediaItem | null) ?? null;
}
