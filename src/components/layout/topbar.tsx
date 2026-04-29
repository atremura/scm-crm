'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Search,
  Bell,
  Sparkles,
  Menu,
  LogOut,
  User as UserIcon,
  HelpCircle,
  Sun,
  Moon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AiPanel } from './ai-panel';
import { CommandPalette } from './command-palette';

type TopbarProps = {
  userName: string;
  userEmail: string;
  userRole: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Home',
  bids: 'BIDs',
  new: 'New',
  takeoff: 'Takeoff',
  estimates: 'Estimate',
  contracts: 'Contract',
  execution: 'Execution',
  financial: 'Financial',
  clients: 'Clients',
  users: 'Users & Roles',
  settings: 'Settings',
};

function UUID_RE(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

function buildCrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string; mono?: boolean }[] = [];
  let acc = '';
  parts.forEach((p, i) => {
    acc += `/${p}`;
    const label = UUID_RE(p)
      ? p.slice(0, 8).toUpperCase()
      : SEGMENT_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
    crumbs.push({ label, href: acc, mono: UUID_RE(p) });
  });
  if (crumbs.length === 0) {
    crumbs.push({ label: 'Home', href: '/dashboard' });
  }
  return crumbs;
}

export function Topbar({ userName, userEmail, userRole }: TopbarProps) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const [aiOpen, setAiOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Hydrate theme state from the class set by the inline <head> script.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* private browsing — ignore */
    }
  }

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const initials = (userName || 'U')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex min-h-[64px] items-center gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur md:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-sunken hover:text-fg-default md:hidden"
        aria-label="Menu"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 && <span className="text-fg-subtle">/</span>}
              {isLast ? (
                <span
                  className={`font-semibold text-fg-default ${c.mono ? 'font-mono text-[12px]' : ''}`}
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className={`text-fg-muted transition-colors hover:text-fg-default ${
                    c.mono ? 'font-mono text-[12px]' : ''
                  }`}
                >
                  {c.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Search trigger (opens command palette) */}
      <div className="ml-4 hidden max-w-[420px] flex-1 md:block">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group relative flex h-[38px] w-full items-center rounded-lg border border-border bg-sunken pl-9 pr-12 text-left text-[13.5px] text-fg-subtle transition-colors hover:border-blue-500/40 hover:text-fg-muted"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-subtle" />
          Search bids, clients, projects…
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-fg-subtle">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Ask AI */}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          title="Open JMO Copilot"
          className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 text-[12.5px] font-semibold text-blue-500 transition-colors hover:bg-blue-500/25"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="relative grid h-[38px] w-[38px] place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:bg-sunken hover:text-fg-default"
        >
          {theme === 'dark' ? (
            <Sun className="h-[17px] w-[17px]" />
          ) : (
            <Moon className="h-[17px] w-[17px]" />
          )}
        </button>

        {/* Notifications */}
        <button
          type="button"
          title="Notifications"
          className="relative grid h-[38px] w-[38px] place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:bg-sunken hover:text-fg-default"
        >
          <Bell className="h-[17px] w-[17px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-surface" />
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-sunken"
            >
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-[12.5px] font-semibold text-fg-default">{userName}</p>
                <p className="text-[11px] text-fg-muted">{userRole}</p>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-navy-800 text-[11px] font-bold text-white">
                {initials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{userName}</span>
                <span className="text-xs font-normal text-fg-muted">{userEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & docs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-danger-500 focus:text-danger-500"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAskAi={() => {
          setPaletteOpen(false);
          setAiOpen(true);
        }}
      />
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </header>
  );
}
