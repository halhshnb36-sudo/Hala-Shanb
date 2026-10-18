import { useEffect, useState } from 'react';
import { Lightbox } from './Lightbox';
import type { LightboxItem } from './Lightbox';
import { trackView } from '@/lib/track';

/**
 * Opens a photo viewer. When `track` is true, a real `image_view` event is recorded
 * each time a photo is actually opened or navigated to in the viewer.
 */
export function useLightbox(items: LightboxItem[], track = true) {
  const [index, setIndex] = useState<number | null>(null);
  const currentId = index !== null ? items[index]?.id : undefined;

  useEffect(() => {
    if (track && currentId) void trackView('image', currentId);
  }, [currentId, track]);

  const node =
    index !== null && items[index] ? (
      <Lightbox items={items} index={index} onClose={() => setIndex(null)} onIndex={setIndex} />
    ) : null;

  return { open: (i: number) => setIndex(i), node };
}
