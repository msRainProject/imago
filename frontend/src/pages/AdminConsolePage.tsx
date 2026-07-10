import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HardDrive, KeyRound, Settings, User, Users } from 'lucide-react';
import { t } from '@/i18n/strings';

import AdminAPIKeysPage from '@pages/AdminAPIKeysPage';
import AdminSettingsPage from '@pages/AdminSettingsPage';
import AdminStoragePage from '@pages/AdminStoragePage';
import AdminUsersPage from '@pages/AdminUsersPage';
import ProfilePage from '@pages/ProfilePage';

type Tab = 'settings' | 'storage' | 'tokens' | 'users' | 'passkey';

const TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
  { key: 'settings', icon: <Settings className="h-4 w-4" />, label: t.console.settingsTab },
  { key: 'storage', icon: <HardDrive className="h-4 w-4" />, label: t.console.storageTab },
  { key: 'tokens', icon: <KeyRound className="h-4 w-4" />, label: t.console.tokensTab },
  { key: 'users', icon: <Users className="h-4 w-4" />, label: t.console.usersTab },
  { key: 'passkey', icon: <User className="h-4 w-4" />, label: t.console.passkeyTab },
];

function isTab(value: string | null): value is Tab {
  return (
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
    return isTab(raw) ? raw : 'settings';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('tab');
    const next: Tab = isTab(raw) ? raw : 'settings';
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const selectTab = (next: Tab) => {
    setTab(next);
    const target = next === 'settings' ? '/admin' : `/admin?tab=${next}`;
    if (location.pathname + location.search !== target) {
      navigate(target, { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-headline-sm text-surface-on sm:text-headline-md">
          {t.console.title}
        </h1>
        <p className="text-body-sm text-surface-on/60 sm:text-body-md">
          {t.console.subtitle}
        </p>
      </header>

      <div
        className="relative mb-6 flex border-b border-outline-variant/60"
        role="tablist"
      >
        {TABS.map(({ key, icon, label }) => (
          <TabButton
            key={key}
            active={tab === key}
            onClick={() => selectTab(key)}
            icon={icon}
            label={label}
          />
        ))}
        <motion.span
          layoutId="admin-tab-indicator"
          className="absolute -bottom-px h-0.5 bg-primary"
          animate={{
            left: `${(TABS.findIndex((it) => it.key === tab) / TABS.length) * 100}%`,
            width: `${100 / TABS.length}%`,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          aria-hidden
        />
      </div>

      <div>
        {tab === 'settings' && <AdminSettingsPage />}
        {tab === 'storage' && <AdminStoragePage />}
        {tab === 'tokens' && <AdminAPIKeysPage />}
        {tab === 'users' && <AdminUsersPage />}
        {tab === 'passkey' && <ProfilePage />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'flex min-w-0 flex-1 items-center justify-center gap-0 px-1.5 py-3 text-label-md transition-colors duration-md3-short2 ease-md3-standard sm:gap-2 sm:px-2 sm:text-label-lg',
        active
          ? 'text-primary'
          : 'text-surface-on/60 hover:text-surface-on hover:bg-primary/5',
      ].join(' ')}
    >
      {icon}
      <span className="hidden truncate sm:inline">{label}</span>
    </button>
  );
}
