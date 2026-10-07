import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  BookOpenIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SunIcon,
  UserIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { GeneratedAvatar } from '@/components/generated-art';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-provider';
import { Wordmark } from '@/features/landing/wordmark';
import { cn } from '@/lib/utils';

const NAV: { label: string; to: '/home' | '/courses' | '/profile'; icon: LucideIcon }[] = [
  { label: 'Home', to: '/home', icon: HomeIcon },
  { label: 'My courses', to: '/courses', icon: BookOpenIcon },
  { label: 'Profile', to: '/profile', icon: UserIcon },
];

const COLLAPSE_KEY = 'sidebar-collapsed';

/** Uxcel-style shell: collapsible left sidebar, slim top bar, account menu. */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // ignore
      }
      return !c;
    });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside
        aria-label="Sidebar"
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-muted/40 transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-4')}>
          <Link to="/home" aria-label="ViBe home">
            {collapsed ? (
              <span className="grid size-8 place-items-center rounded-lg bg-primary font-aleo font-semibold text-primary-foreground">V</span>
            ) : (
              <Wordmark />
            )}
          </Link>
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className={cn('mt-auto p-2', collapsed && 'flex justify-center')}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between px-4">
              <Wordmark />
              <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-md hover:bg-muted">
                <XIcon className="size-5" />
              </button>
            </div>
            <SidebarNav collapsed={false} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-md hover:bg-muted md:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="md:hidden">
            <Wordmark />
          </span>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>
        <main id="main" className="relative flex-1">
          {/* Soft Luma-style tint behind the top of every app page */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/8 to-transparent" />
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  return (
    <nav aria-label="App" className="flex flex-col gap-0.5 p-2">
      {!collapsed && <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Learn</p>}
      {NAV.map(({ label, to, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
          activeProps={{ className: 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className={cn(collapsed && 'sr-only')}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    await navigate({ to: '/login', replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col items-center gap-1 px-3 py-3 text-center">
          <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={44} />
          {user?.displayName && <span className="text-sm font-medium">{user.displayName}</span>}
          <span className="max-w-full truncate text-xs text-muted-foreground">{user?.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
