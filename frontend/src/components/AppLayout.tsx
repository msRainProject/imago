import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Image as ImageIcon, LogIn, LogOut, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommandPalette from '@/components/CommandPalette';
import { isAuthenticated, isAdmin, clearAuth } from '@/utils/auth';
import { cn } from '@/lib/utils';
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
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-border/60 bg-background/80 px-2.5 backdrop-blur-xl sm:gap-3 sm:px-4 md:gap-6 md:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-base font-semibold text-foreground max-[380px]:gap-1.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="hidden md:inline">Hill Images</span>
        </Link>

        {!isLoginPage && (
          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <NavItem to="/">{t.nav.home}</NavItem>
            {authenticated && <NavItem to="/files">{t.nav.files}</NavItem>}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {authenticated && (
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 gap-2 text-muted-foreground sm:inline-flex"
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )
              }
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">搜索</span>
              <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          )}

          {authenticated ? (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t.nav.logout}</span>
            </Button>
          ) : !isLoginPage ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">{t.nav.login}</span>
              </Link>
            </Button>
          ) : null}
          {authenticated && admin && (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{t.nav.console}</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <CommandPalette />
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
        cn(
          'rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );
}
