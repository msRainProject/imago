import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@components/AppLayout';
import HomePage from '@pages/HomePage';

import AdminConsolePage from '@pages/AdminConsolePage';
import AdminFilesPage from '@pages/AdminFilesPage';
import LoginPage from '@pages/LoginPage';
import { ToastProvider } from '@hooks/useToast';
import { isAuthenticated } from '@/utils/auth';

/**
 * Auth guard: redirects unauthenticated users to /login,
 * and authenticated users away from /login.
 */
function AuthGuard({ children, requireAuth = false }: { children: React.ReactNode; requireAuth?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();

  useEffect(() => {
    if (requireAuth && !authenticated) {
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
    } else if (!requireAuth && authenticated && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [authenticated, location.pathname, location.search, navigate, requireAuth]);

  // If auth is required and user is not authenticated, don't render children
  if (requireAuth && !authenticated) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Whitelist of valid `?tab=` values for /admin.
 * Keep in sync with `Tab` in `pages/AdminConsolePage.tsx`.
 */
const ADMIN_VALID_TABS = new Set(['settings', 'storage', 'tokens', 'users', 'passkey']);

/**
 * Redirect /admin?tab=files → /files for backwards compatibility with
 * any old bookmarks that pointed at the file manager inside the
 * console. Unknown tab values are dropped; known tabs are kept verbatim.
 */
function AdminEntry() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'files') {
      navigate('/files', { replace: true });
      return;
    }
    if (tab && !ADMIN_VALID_TABS.has(tab)) {
      // Unknown tab — drop it.
      navigate('/admin', { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <AuthGuard requireAuth>
      <AdminConsolePage />
    </AuthGuard>
  );
}

/**
 * Hill Images — root component.
 *
 * Routes:
 *   /              → public landing / upload widget
 *   /files         → standalone file manager (requires auth)
 *   /admin         → admin console — settings / tokens / users (requires auth)
 *   /login         → password + Passkey login
 *
 * Legacy redirects:
 *   /admin/files          → /files
 *   /admin?tab=files      → /files
 *   /admin?tab=settings   → /admin?tab=settings
 *   /admin?tab=storage    → /admin?tab=storage
 *   /admin?tab=tokens     → /admin?tab=tokens
 *   /admin?tab=users      → /admin?tab=users
 */
export default function App() {
  // On app load, validate token existence. If token exists but is expired,
  // the API will return 401 and the client interceptor will handle it.
  useEffect(() => {
    // Check if token exists; if not and we're on a protected route,
    // the AuthGuard will redirect.
    const token = localStorage.getItem('hill_token');
    if (token) {
      // Token exists — we trust it until an API call fails with 401.
      // The JWT interceptor in client.ts attaches it automatically.
    }
  }, []);

  return (
    <ToastProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        className="min-h-full"
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <AuthGuard requireAuth>
                  <HomePage />
                </AuthGuard>
              }
            />

            <Route
              path="/files"
              element={
                <AuthGuard requireAuth>
                  <AdminFilesPage />
                </AuthGuard>
              }
            />

            <Route path="/admin" element={<AdminEntry />} />

            {/* Legacy /admin/files → /files */}
            <Route path="/admin/files" element={<Navigate to="/files" replace />} />

            <Route
              path="/login"
              element={
                <AuthGuard>
                  <LoginPage />
                </AuthGuard>
              }
            />
            <Route path="*" element={<Navigate to={isAuthenticated() ? '/' : '/login'} replace />} />
          </Route>
        </Routes>
      </motion.div>
    </ToastProvider>
  );
}
