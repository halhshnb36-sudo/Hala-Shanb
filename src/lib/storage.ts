import * as tus from 'tus-js-client';
import { supabase, SUPABASE_URL, publishableKey } from './supabase';
import type { Bucket } from './types';

const MB = 1024 * 1024;

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_IMAGE_BYTES: Record<'branding' | 'articles' | 'gallery', number> = {
  branding: 5 * MB,
  articles: 10 * MB,
  gallery: 15 * MB,
};
export const MAX_VIDEO_BYTES = 500 * MB;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Public URL of a file in a PUBLIC bucket (branding, articles, gallery). */
export function publicUrl(bucket: Exclude<Bucket, 'videos'>, path?: string | null): string {
  if (!path) return '';
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Short-lived URL for a file in the PRIVATE videos bucket (allowed only for published videos, or admins). */
export async function signedVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('videos').createSignedUrl(path, 60 * 60 * 3);
  if (error || !data) throw new Error(error?.message ?? 'تعذّر تجهيز رابط الفيديو');
  return data.signedUrl;
}

export async function removeFiles(bucket: Bucket, paths: Array<string | null | undefined>): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  try {
    await supabase.storage.from(bucket).remove(list);
  } catch {
    /* best effort: an orphaned file is harmless and can be removed later from the Supabase dashboard */
  }
}

/** Downscales very large photos in the browser (max 2400px) before uploading, to keep the site fast. */
export async function compressImage(file: File, maxDim = 2400): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 2.5 * MB) {
      bmp.close();
      return file;
    }
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

export interface UploadedImage {
  path: string;
  mime: string;
  size: number;
}

/** Validates, optionally compresses, and uploads one image. Returns the storage path. */
export async function uploadImage(
  bucket: 'branding' | 'articles' | 'gallery',
  input: File,
  opts: { prefix?: string; compress?: boolean } = {},
): Promise<UploadedImage> {
  if (!IMAGE_MIME.includes(input.type)) throw new Error('نوع الصورة غير مسموح. المسموح: JPG أو PNG أو WebP.');
  const file = opts.compress === false ? input : await compressImage(input);
  if (file.size > MAX_IMAGE_BYTES[bucket]) {
    throw new Error(`حجم الصورة أكبر من الحد المسموح (${MAX_IMAGE_BYTES[bucket] / MB} م.ب).`);
  }
  const path = `${opts.prefix ?? ''}${crypto.randomUUID()}.${EXT[file.type] ?? 'bin'}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, mime: file.type, size: file.size };
}

function resumableEndpoint(): string {
  const override = import.meta.env.VITE_SUPABASE_STORAGE_URL;
  if (override) return `${override.replace(/\/$/, '')}/storage/v1/upload/resumable`;
  const u = new URL(SUPABASE_URL ?? 'http://localhost');
  if (u.hostname.endsWith('.supabase.co')) {
    return `https://${u.hostname.split('.')[0]}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${SUPABASE_URL}/storage/v1/upload/resumable`;
}

export interface VideoUpload {
  promise: Promise<UploadedImage>;
  abort: () => void;
}

/**
 * Resumable (TUS) upload of a video in 6 MB chunks. The file is streamed from disk,
 * it is never loaded into browser memory. Interrupted uploads can resume automatically.
 */
export function uploadVideo(file: File, onProgress: (pct: number) => void): VideoUpload {
  let upload: tus.Upload | null = null;
  const promise = new Promise<UploadedImage>((resolve, reject) => {
    if (!VIDEO_MIME.includes(file.type)) {
      reject(new Error('نوع الفيديو غير مسموح. المسموح: MP4 أو WebM أو MOV.'));
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      reject(new Error(`حجم الفيديو أكبر من الحد المسموح (${MAX_VIDEO_BYTES / MB} م.ب). استخدم رابط YouTube أو Vimeo للملفات الأكبر.`));
      return;
    }
    const path = `${crypto.randomUUID()}.${EXT[file.type] ?? 'mp4'}`;
    upload = new tus.Upload(file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * MB,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { apikey: publishableKey },
      metadata: {
        bucketName: 'videos',
        objectName: path,
        contentType: file.type,
        cacheControl: '3600',
      },
      onBeforeRequest: async (req) => {
        const { data } = await supabase.auth.getSession();
        req.setHeader('Authorization', `Bearer ${data.session?.access_token ?? publishableKey}`);
      },
      onError: (err) => reject(new Error(err.message || 'فشل رفع الفيديو')),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve({ path, mime: file.type, size: file.size }),
    });
    upload.start();
  });
  return {
    promise,
    abort: () => {
      void upload?.abort(true);
    },
  };
}
