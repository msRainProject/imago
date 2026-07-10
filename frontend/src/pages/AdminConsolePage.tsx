import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HardDrive, KeyRound, LayoutDashboard, Settings, User, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/i18n/strings';

import OverviewDashboard from '@/components/OverviewDashboard';
import AdminAPIKeysPage from '@pages/AdminAPIKeysPage';
import AdminSettingsPage from '@pages/AdminSettingsPage';
import AdminStoragePage from '@pages/AdminStoragePage';
import AdminUsersPage from '@pages/AdminUsersPage';
import ProfilePage from '@pages/ProfilePage';

type Tab = 'overview' | 'settings' | 'storage' | 'tokens' | 'users' | 'passkey';

const TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
  { key: 'overview', icon: <LayoutDashboard className="h-4 w-4" />, label: '概览' },
  { key: 'settings', icon: <Settings className="h-4 w-4" />, label: t.console.settingsTab },
  { key: 'storage', icon: <HardDrive className="h-4 w-4" />, label: t.console.storageTab },
  { key: 'tokens', icon: <KeyRound className="h-4 w-4" />, label: t.console.tokensTab },
  { key: 'users', icon: <Users className="h-4 w-4" />, label: t.console.usersTab },
  { key: 'passkey', icon: <User className="h-4 w-4" />, label: t.console.passkeyTab },
];

function isTab(value: string | null): value is Tab {
  return (
    value === 'overview' ||
    value === 'settings' ||
    value === 'storage' ||
    value === 'tokens' ||
    value === 'users' ||
    value === 'passkey'
  );
}

export default function AdminConsolePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab: Tab = (() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('tab');
    return isTab(raw) ? raw : 'overview';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('tab');
    const next: Tab = isTab(raw) ? raw : 'overview';
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const selectTab = (next: Tab) => {
    setTab(next);
    const target = next === 'overview' ? '/admin' : `/admin?tab=${next}`;
    if (location.pathname + location.search !== target) {
      navigate(target, { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl text-balance">
          {t.console.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {t.console.subtitle}
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => selectTab(v as Tab)} className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-6 sm:inline-flex sm:w-auto">
          {TABS.map(({ key, icon, label }) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 px-2 sm:px-3">
              {icon}
              <span className="hidden truncate sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div>
          {tab === 'overview' && <OverviewDashboard />}
          {tab === 'settings' && <AdminSettingsPage />}
          {tab === 'storage' && <AdminStoragePage />}
          {tab === 'tokens' && <AdminAPIKeysPage />}
          {tab === 'users' && <AdminUsersPage />}
          {tab === 'passkey' && <ProfilePage />}
        </div>
      </Tabs>
    </div>
  );
}
