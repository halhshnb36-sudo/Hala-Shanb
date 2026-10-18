import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Loading, ErrorBox } from './States';
import { signedVideoUrl } from '@/lib/storage';
import { trackView } from '@/lib/track';
import { errMsg, parseVideoUrl } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';

interface Props {
  item: MediaItem | null;
  onClose: () => void;
  /** false for administrator previews so they do not inflate the statistics */
  track?: boolean;
}

/**
 * Clean playback dialog.
 * - Uploaded files (private bucket): short-lived signed URL, native <video>, counted when playback begins.
 * - YouTube / Vimeo: the player is only loaded after the visitor opens it, and that click is the "play".
 */
export function VideoModal({ item, onClose, track = true }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counted = useRef<string | null>(null);

  const embed = item?.external_url ? parseVideoUrl(item.external_url) : null;

  useEffect(() => {
    setSrc(null);
    setError(null);
    counted.current = null;
    if (!item) return;

    if (embed) {
      if (track && counted.current !== item.id) {
        counted.current = item.id;
        void trackView('video', item.id);
      }
      return;
    }
    if (!item.storage_path) {
      setError('هذا الفيديو غير متاح حاليًا.');
      return;
    }
    let alive = true;
    signedVideoUrl(item.storage_path)
      .then((u) => alive && setSrc(u))
      .catch((e: unknown) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  return (
    <Modal open onClose={onClose} title={item.title || 'فيديو'} bare>
      <div className="overflow-hidden rounded-2xl border border-gold-500/30 bg-black shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-lg gold-text">{item.title || 'فيديو'}</h2>
          <button type="button" className="btn btn-plain btn-sm" onClick={onClose}>
            ✕ إغلاق
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          {error ? (
            <ErrorBox message={error} />
          ) : embed ? (
            <iframe
              src={embed.embed}
              title={item.title || 'فيديو'}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : src ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full"
              onPlay={() => {
                if (track && item && counted.current !== item.id) {
                  counted.current = item.id;
                  void trackView('video', item.id);
                }
              }}
            />
          ) : (
            <Loading label="جارٍ تجهيز الفيديو…" />
          )}
        </div>
        {item.description && <p className="px-4 py-3 text-sm leading-7 text-zinc-300">{item.description}</p>}
      </div>
    </Modal>
  );
}
