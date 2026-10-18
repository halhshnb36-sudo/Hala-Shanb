import { Navigate, Route, Routes } from 'react-router-dom';
import { FeedbackProvider } from '@/components/feedback';
import { AdminAuthProvider, AdminGuard } from './auth';
import Login from './Login';
import { AdminLayout } from './AdminLayout';
import Dashboard from './Dashboard';
import ArticlesList from './ArticlesList';
import ArticleEditor from './ArticleEditor';
import MediaManager from './MediaManager';
import Settings from './Settings';

// Mounted at /admin/* by App.tsx, so all paths below are relative to /admin.
export default function AdminRoutes() {
  return (
    <FeedbackProvider>
      <AdminAuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="articles" element={<ArticlesList />} />
              <Route path="articles/:id" element={<ArticleEditor kind="article" />} />
              <Route path="biography" element={<ArticleEditor kind="biography" />} />
              <Route path="photos" element={<MediaManager type="image" />} />
              <Route path="videos" element={<MediaManager type="video" />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminAuthProvider>
    </FeedbackProvider>
  );
}
