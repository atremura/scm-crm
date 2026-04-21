'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  Ruler,
  Calculator,
  FileSignature,
  HardHat,
  DollarSign,
  Building2,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavGroup = {
  section: string;
  items: NavItem[];
};

const navigation: NavGroup[] = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Modules',
    items: [
      { label: 'BIDs', href: '/bids', icon: Inbox, badge: '8' },
      { label: 'Takeoff', href: '/takeoff', icon: Ruler },
      { label: 'Estimate', href: '/estimates', icon: Calculator },
      { label: 'Contract', href: '/contracts', icon: FileSignature },
      { label: 'Execution', href: '/execution', icon: HardHat },
      { label: 'Financial', href: '/financial', icon: DollarSign },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'Clients', href: '/clients', icon: Building2 },
      { label: 'Users & Roles', href: '/users', icon: Users },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

type SidebarProps = {
  userName: string;
  userRole: string;
};

export function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const initials = (userName || 'U')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside
      className={`flex h-screen flex-col bg-[var(--bg-sidebar)] text-[color:rgba(198,208,232,0.9)] transition-[width] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      {/* Brand */}
      <div
        className={`flex items-center border-b border-white/[0.06] ${
          collapsed ? 'justify-center px-2 py-[18px]' : 'px-4 py-[18px]'
        } min-h-[72px]`}
      >
        <div className="relative flex items-center">
          <Image
            src="/brand/jmo-logo-white.png"
            alt="JMO Group"
            width={170}
            height={66}
            priority
            style={{ height: 'auto' }}
            className={collapsed ? 'w-9' : 'w-[170px]'}
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[10px] py-3">
        {navigation.map((group) => (
          <div key={group.section} className="flex flex-col gap-[1px]">
            {!collapsed && (
              <div className="px-[10px] pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                {group.section}
              </div>
            )}
            {collapsed && <div className="h-3" />}
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg border border-transparent px-[10px] py-[9px] text-[13.5px] font-medium whitespace-nowrap transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'border-[rgba(58,90,122,0.35)] bg-gradient-to-r from-[rgba(58,90,122,0.25)] to-[rgba(58,90,122,0.02)] text-white'
                      : 'text-[color:rgba(198,208,232,0.9)] hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {isActive && !collapsed && (
                    <span className="absolute -left-[10px] top-2 bottom-2 w-[3px] rounded-r-sm bg-blue-500" />
                  )}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-[rgba(58,90,122,0.24)] px-[7px] py-[1px] text-[11px] font-semibold text-blue-300">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: user tile + collapse */}
      <div className="flex items-center gap-[10px] border-t border-white/[0.06] p-[10px]">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-navy-800 text-[13px] font-bold text-white">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col leading-[1.15]">
            <strong className="truncate text-[13px] font-semibold text-white">
              {userName}
            </strong>
            <span className="truncate text-[11px] text-white/60">
              {userRole}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title="Toggle sidebar"
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-[15px] w-[15px]" />
          ) : (
            <ChevronLeft className="h-[15px] w-[15px]" />
          )}
        </button>
      </div>
    </aside>
  );
}
