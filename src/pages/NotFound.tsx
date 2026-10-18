import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useSeo } from '@/lib/seo';

export default function NotFound() {
  useSeo({ title: 'الصفحة غير موجودة' });
  return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <Logo className="mx-auto h-32 w-32 object-contain opacity-80" />
      <p className="mt-4 font-display text-6xl gold-text">٤٠٤</p>
      <h1 className="mt-2 font-display text-2xl text-zinc-100">الصفحة التي تبحثين عنها غير موجودة</h1>
      <p className="mt-2 text-zinc-400">ربما تغيّر الرابط أو تم حذف الصفحة.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-gold">
          الصفحة الرئيسية
        </Link>
        <Link to="/articles" className="btn btn-ghost">
          المقالات
        </Link>
      </div>
    </div>
  );
}
