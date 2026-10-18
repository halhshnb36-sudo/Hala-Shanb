import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Loading, ErrorBox, Empty } from '@/components/States';
import { ArticleCard, SectionShell, VideoCard } from '@/components/Cards';
import { PhotoGrid, toLightboxItems } from '@/components/PhotoGrid';
import { useLightbox } from '@/components/useLightbox';
import { VideoModal } from '@/components/VideoModal';
import { ContactSection } from '@/components/ContactSection';
import { getBiography, getFeaturedMedia, listArticles, listMedia } from '@/lib/api';
import { publicUrl } from '@/lib/storage';
import { useSettings, whatsappHref } from '@/lib/settings';
import { useSeo } from '@/lib/seo';
import { excerpt, useAsync } from '@/lib/utils';
import type { MediaItem, SectionCfg } from '@/lib/types';

function Hero() {
  const { settings } = useSettings();
  const heroImg = publicUrl('branding', settings.hero_image_path);
  const tel = settings.phone.replace(/[^\d+]/g, '');
  const wa = settings.social.whatsapp.enabled ? whatsappHref(settings) : null;
  return (
    <section className="hero-bg relative isolate overflow-hidden" aria-labelledby="hero-title">
      {heroImg && (
        <>
          <img src={heroImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/60 to-ink" />
        </>
      )}
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:px-6 md:grid-cols-2 md:py-20">
        <div className="order-2 text-center md:order-1 md:text-start">
          <p className="fade-up mb-3 text-sm tracking-wide text-gold-500">✦ الموقع الرسمي ✦</p>
          <h1 id="hero-title" className="fade-up-2 font-display text-4xl font-bold leading-tight gold-text sm:text-5xl md:text-6xl">
            {settings.hero_headline}
          </h1>
          <p className="fade-up-2 mt-4 font-display text-xl text-gold-300 sm:text-2xl">{settings.slogan}</p>
          {settings.hero_intro && (
            <p className="fade-up-3 mx-auto mt-5 max-w-xl leading-9 text-zinc-300 md:mx-0">{settings.hero_intro}</p>
          )}
          <div className="fade-up-3 mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link to="/biography" className="btn btn-gold">
              اقرئي حكاية هالة
            </Link>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                راسلينا على واتساب
              </a>
            ) : (
              settings.phone && (
                <a href={`tel:${tel}`} className="btn btn-ghost">
                  اتصلي الآن
                </a>
              )
            )}
          </div>
        </div>
        <div className="order-1 flex justify-center md:order-2">
          <Logo priority className="floaty logo-glow w-52 sm:w-64 md:w-[24rem]" />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- story */
function StorySection({ cfg }: { cfg: SectionCfg }) {
  const bio = useAsync(getBiography, []);
  const featured = useAsync(getFeaturedMedia, []);
  const [video, setVideo] = useState<MediaItem | null>(null);
  const photo = featured.data?.type === 'image' ? [featured.data] : [];
  const lb = useLightbox(toLightboxItems(photo));

  let media: ReactNode;
  const f = featured.data;
  if (f?.type === 'image') {
    media = (
      <button
        type="button"
        onClick={() => lb.open(0)}
        className="card card-hover block w-full overflow-hidden"
        aria-label={`عرض الصورة: ${f.title || 'صورة مميزة'}`}
      >
        <img src={publicUrl('gallery', f.storage_path)} alt={f.title || 'صورة مميزة'} loading="lazy" decoding="async" className="w-full object-cover" />
        {f.title && <span className="block p-3 text-center font-display text-lg text-gold-300">{f.title}</span>}
      </button>
    );
  } else if (f?.type === 'video') {
    media = <VideoCard v={f} onPlay={setVideo} />;
  } else {
    media = (
      <div className="card flex aspect-square items-center justify-center p-8">
        <Logo className="logo-glow w-full max-w-xs object-contain" />
      </div>
    );
  }

  return (
    <SectionShell id="story" title={cfg.title} description={cfg.description}>
      {bio.loading || featured.loading ? (
        <Loading />
      ) : bio.error ? (
        <ErrorBox message={bio.error} onRetry={bio.reload} />
      ) : !bio.data ? (
        <Empty title="الحكاية قيد التجهيز" text="سيتم نشر قصة هالة شنب قريبًا." />
      ) : (
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>{media}</div>
          <div>
            <p className="text-lg leading-10 text-zinc-200">{excerpt(bio.data.body, 420)}</p>
            <Link to="/biography" className="btn btn-gold mt-6">
              اقرئي الحكاية كاملة
            </Link>
          </div>
        </div>
      )}
      {lb.node}
      <VideoModal item={video} onClose={() => setVideo(null)} />
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- services */
function ServicesSection({ cfg }: { cfg: SectionCfg }) {
  const { settings } = useSettings();
  return (
    <SectionShell id="services" title={cfg.title} description={cfg.description}>
      {settings.services.length === 0 ? (
        <Empty title="سيتم إضافة الخدمات قريبًا" />
      ) : (
        <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {settings.services.map((s, i) => (
            <li key={i} className="card card-hover p-6">
              <span className="font-display text-4xl gold-text" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mb-2 mt-2 font-display text-xl text-zinc-50">{s.title}</h3>
              <p className="text-sm leading-7 text-zinc-400">{s.text}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- articles */
const fetchLatestArticles = () => listArticles(3, 0);
function ArticlesSection({ cfg }: { cfg: SectionCfg }) {
  const q = useAsync(fetchLatestArticles, []);
  return (
    <SectionShell
      id="articles"
      title={cfg.title}
      description={cfg.description}
      action={q.data && q.data.total > 3 ? <Link to="/articles" className="btn btn-ghost">كل المقالات</Link> : undefined}
    >
      {q.loading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data || q.data.rows.length === 0 ? (
        <Empty title="لا توجد مقالات منشورة بعد" text="تابعينا قريبًا لقراءة أحدث المقالات." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {q.data.rows.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- gallery */
function GallerySection({ cfg }: { cfg: SectionCfg }) {
  const fetchPhotos = useCallback(() => listMedia('image', 8, 0), []);
  const q = useAsync(fetchPhotos, [fetchPhotos]);
  const items = toLightboxItems(q.data?.rows ?? []);
  const lb = useLightbox(items);
  return (
    <SectionShell
      id="gallery"
      title={cfg.title}
      description={cfg.description}
      action={q.data && q.data.total > 8 ? <Link to="/gallery" className="btn btn-ghost">عرض كل الصور</Link> : undefined}
    >
      {q.loading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : items.length === 0 ? (
        <Empty title="لا توجد صور منشورة بعد" text="سيتم عرض الصور هنا فور إضافتها." />
      ) : (
        <PhotoGrid items={items} onOpen={lb.open} />
      )}
      {lb.node}
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- videos */
function VideosSection({ cfg }: { cfg: SectionCfg }) {
  const fetchVideos = useCallback(() => listMedia('video', 3, 0), []);
  const q = useAsync(fetchVideos, [fetchVideos]);
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  return (
    <SectionShell
      id="videos"
      title={cfg.title}
      description={cfg.description}
      action={q.data && q.data.total > 3 ? <Link to="/videos" className="btn btn-ghost">كل الفيديوهات</Link> : undefined}
    >
      {q.loading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data || q.data.rows.length === 0 ? (
        <Empty title="لا توجد فيديوهات منشورة بعد" text="سيتم عرض الفيديوهات هنا فور إضافتها." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {q.data.rows.map((v) => (
            <VideoCard key={v.id} v={v} onPlay={setPlaying} />
          ))}
        </div>
      )}
      <VideoModal item={playing} onClose={() => setPlaying(null)} />
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- page */
export default function Home() {
  const { settings } = useSettings();
  useSeo({});
  return (
    <>
      <Hero />
      {settings.sections
        .filter((s) => s.visible)
        .map((s) => {
          switch (s.id) {
            case 'story':
              return <StorySection key={s.id} cfg={s} />;
            case 'services':
              return <ServicesSection key={s.id} cfg={s} />;
            case 'articles':
              return <ArticlesSection key={s.id} cfg={s} />;
            case 'gallery':
              return <GallerySection key={s.id} cfg={s} />;
            case 'videos':
              return <VideosSection key={s.id} cfg={s} />;
            case 'contact':
              return <ContactSection key={s.id} />;
            default:
              return null;
          }
        })}
    </>
  );
}
