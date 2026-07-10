import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Image as ImageIcon, LogIn, LogOut, Settings } from 'lucide-react';
import { isAuthenticated, isAdmin, clearAuth } from '@/utils/auth';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/strings';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = isAuthenticated();
  const admin = isAdmin();
  const isLoginPage = location.pathname === '/login';

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-full bg-surface">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-outline-variant/60 bg-surface/85 px-2.5 backdrop-blur-md sm:gap-3 sm:px-4 md:gap-6 md:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-title-md text-surface-on max-[380px]:gap-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-on">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="hidden md:inline">Hill Images</span>
        </Link>

        {!isLoginPage && (
          <nav className="flex min-w-0 items-center gap-0.5 text-label-lg text-surface-on/70 sm:gap-1">
            <NavItem to="/">{t.nav.home}</NavItem>
            {authenticated && <NavItem to="/files">{t.nav.files}</NavItem>}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {authenticated ? (
            <button
              type="button"
              className="md3-btn-text"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t.nav.logout}</span>
            </button>
          ) : !isLoginPage ? (
            <Link to="/login" className="md3-btn-text">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">{t.nav.login}</span>
            </Link>
          ) : null}
          {authenticated && admin && (
            <Link to="/admin" className="md3-btn-tonal">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t.nav.console}</span>
            </Link>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive =
    to === '/'
      ? location.pathname === '/'
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={() =>
        [
          'rounded-full px-2.5 py-1.5 text-label-sm transition-colors duration-md3-short2 ease-md3-standard sm:px-4 sm:text-label-lg',
          isActive
            ? 'bg-secondary-container text-secondary-on-container'
            : 'hover:bg-primary/10',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
