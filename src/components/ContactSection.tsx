import { useSettings, whatsappHref, useSocialLinks } from '@/lib/settings';
import { SocialLinks } from './SocialIcon';
import { SectionShell } from './Cards';

export function ContactSection({ standalone = false }: { standalone?: boolean }) {
  const { settings } = useSettings();
  const cfg = settings.sections.find((s) => s.id === 'contact');
  const links = useSocialLinks();
  const tel = settings.phone.replace(/[^\d+]/g, '');
  const wa = settings.social.whatsapp.enabled ? whatsappHref(settings) : null;
  const maps = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;

  return (
    <SectionShell id="contact" title={cfg?.title || 'تواصلي معنا'} description={cfg?.description}>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 font-display text-xl text-gold-300">بيانات التواصل</h3>
          <dl className="space-y-4">
            {settings.phone && (
              <div>
                <dt className="text-sm text-zinc-400">الهاتف</dt>
                <dd className="text-lg">
                  <a href={`tel:${tel}`} className="hover:text-gold-300">
                    <bdi dir="ltr">{settings.phone}</bdi>
                  </a>
                </dd>
              </div>
            )}
            {settings.address && (
              <div>
                <dt className="text-sm text-zinc-400">العنوان</dt>
                <dd className="leading-8">{settings.address}</dd>
              </div>
            )}
          </dl>
          {links.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm text-zinc-400">تابعينا</p>
              <SocialLinks />
            </div>
          )}
        </div>

        <div className="card flex flex-col justify-center gap-3 p-6 text-center">
          <p className="font-display text-2xl gold-text">{settings.slogan}</p>
          <div className="mt-2 grid gap-3">
            {settings.phone && (
              <a className="btn btn-gold" href={`tel:${tel}`}>
                اتصلي الآن
              </a>
            )}
            {wa && (
              <a className="btn btn-ghost" href={wa} target="_blank" rel="noopener noreferrer">
                راسلينا على واتساب
              </a>
            )}
            {maps && (
              <a className="btn btn-plain" href={maps} target="_blank" rel="noopener noreferrer">
                عرض العنوان على الخريطة
              </a>
            )}
          </div>
        </div>
      </div>
      {standalone && <span className="sr-only">صفحة التواصل</span>}
    </SectionShell>
  );
}
