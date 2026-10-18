import type { MediaItem } from '@/lib/types';
import { publicUrl } from '@/lib/storage';
import type { LightboxItem } from './Lightbox';

export function toLightboxItems(rows: MediaItem[]): LightboxItem[] {
  return rows.map((m) => ({
    id: m.id,
    src: publicUrl('gallery', m.storage_path),
    title: m.title,
    description: m.description,
  }));
}

export function PhotoGrid({ items, onOpen }: { items: LightboxItem[]; onOpen: (i: number) => void }) {
  return (
    <ul className="masonry list-none p-0">
      {items.map((it, i) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            className="group relative block w-full overflow-hidden rounded-xl border border-line bg-coal transition hover:border-gold-500/60"
            aria-label={`عرض الصورة: ${it.title || 'صورة'}`}
          >
            <img
              src={it.src}
              alt={it.title || 'صورة من معرض هالة شنب'}
              loading="lazy"
              decoding="async"
              className="block w-full transition duration-700 group-hover:scale-105"
            />
            {it.title && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-start text-sm font-bold text-gold-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {it.title}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
