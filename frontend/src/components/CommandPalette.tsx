import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, FolderOpen, Settings, KeyRound, Users, Fingerprint, HardDrive, LogOut } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { isAuthenticated, isAdmin, clearAuth } from '@/utils/auth';
import { t } from '@/i18n/strings';

/**
 * Global command palette (Cmd/Ctrl+K).
 * Quick navigation across the app; admin destinations only
 * show for admin users.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const authenticated = isAuthenticated();
  const admin = isAdmin();

  if (!authenticated) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="输入命令或搜索页面…" />
      <CommandList>
        <CommandEmpty>{t.common.noData}</CommandEmpty>
        <CommandGroup heading="导航">
          <CommandItem onSelect={() => go('/')}>
            <Home className="h-4 w-4" />
            <span>{t.nav.home}</span>
          </CommandItem>
          <CommandItem onSelect={() => go('/files')}>
            <FolderOpen className="h-4 w-4" />
            <span>{t.nav.files}</span>
          </CommandItem>
        </CommandGroup>
        {admin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="管理">
              <CommandItem onSelect={() => go('/admin?tab=settings')}>
                <Settings className="h-4 w-4" />
                <span>系统设置</span>
              </CommandItem>
              <CommandItem onSelect={() => go('/admin?tab=storage')}>
                <HardDrive className="h-4 w-4" />
                <span>存储配置</span>
              </CommandItem>
              <CommandItem onSelect={() => go('/admin?tab=tokens')}>
                <KeyRound className="h-4 w-4" />
                <span>API 令牌</span>
              </CommandItem>
              <CommandItem onSelect={() => go('/admin?tab=users')}>
                <Users className="h-4 w-4" />
                <span>用户管理</span>
              </CommandItem>
              <CommandItem onSelect={() => go('/admin?tab=passkey')}>
                <Fingerprint className="h-4 w-4" />
                <span>Passkey</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="账户">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              clearAuth();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>{t.nav.logout}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
