import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from '@/lib/settings';
import { isConfigured } from '@/lib/supabase';
import { Loading } from '@/components/States';
import { PublicLayout } from '@/pages/PublicLayout';
import Home from '@/pages/Home';
import Biography from '@/pages/Biography';
import Articles from '@/pages/Articles';
import ArticleDetail from '@/pages/ArticleDetail';
import Gallery from '@/pages/Gallery';
import Videos from '@/pages/Videos';
import Contact from '@/pages/Contact';
import NotFound from '@/pages/NotFound';

// The admin area is a separate chunk: public visitors never download it (or the chart library).
const AdminRoutes = lazy(() => import('@/admin/AdminRoutes'));

function MissingConfig() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-display text-3xl gold-text">الموقع غير مُهيّأ بعد</h1>
      <p className="mt-4 leading-8 text-zinc-300">
        لم يتم ضبط متغيّرات Supabase. أنشئي الملف <bdi dir="ltr">.env.local</bdi> (أو أضيفي المتغيّرات في Cloudflare) بالقيم
        <bdi dir="ltr"> VITE_SUPABASE_URL </bdi> و <bdi dir="ltr">VITE_SUPABASE_PUBLISHABLE_KEY</bdi> ثم أعيدي البناء.
      </p>
    </div>
  );
}

export default function App() {
  if (!isConfigured) return <MissingConfig />;
  return (
    <BrowserRouter>
      <SettingsProvider>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<Loading />}>
                <AdminRoutes />
              </Suspense>
            }
          />
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="biography" element={<Biography />} />
            <Route path="articles" element={<Articles />} />
            <Route path="articles/:slug" element={<ArticleDetail />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="videos" element={<Videos />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </SettingsProvider>
    </BrowserRouter>
  );
}
