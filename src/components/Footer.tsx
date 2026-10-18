import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { SocialLinks } from './SocialIcon';
import { useSettings } from '@/lib/settings';

export function Footer() {
  const { settings } = useSettings();
  const tel = settings.phone.replace(/[^\d+]/g, '');
  return (
    <footer className="mt-24 border-t border-gold-500/25 bg-coal">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-6 md:grid-cols-3">
        <div className="text-center md:text-start">
          <Logo className="mx-auto h-28 w-28 object-contain md:mx-0" />
          <p className="mt-3 font-display text-xl gold-text">{settings.slogan}</p>
        </div>

        <div>
          <h2 className="mb-3 font-bold text-gold-300">تواصلي معنا</h2>
          <ul className="space-y-2 text-zinc-300">
            {settings.phone && (
              <li>
                <a href={`tel:${tel}`} className="hover:text-gold-300">
                  <span className="text-zinc-400">الهاتف: </span>
                  <bdi dir="ltr">{settings.phone}</bdi>
                </a>
              </li>
            )}
            {settings.address && (
              <li>
                <span className="text-zinc-400">العنوان: </span>
                {settings.address}
              </li>
            )}
          </ul>
          <SocialLinks className="mt-4" />
        </div>

        <div>
          <h2 className="mb-3 font-bold text-gold-300">روابط سريعة</h2>
          <ul className="grid grid-cols-2 gap-2 text-zinc-300">
            <li><Link className="hover:text-gold-300" to="/biography">حكايتها</Link></li>
            <li><Link className="hover:text-gold-300" to="/articles">المقالات</Link></li>
            <li><Link className="hover:text-gold-300" to="/gallery">معرض الصور</Link></li>
            <li><Link className="hover:text-gold-300" to="/videos">الفيديو</Link></li>
            <li><Link className="hover:text-gold-300" to="/contact">تواصل معنا</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-sm text-zinc-400">
        {settings.footer_text} © {new Date().getFullYear()}
      </div>
    </footer>
  );
}
