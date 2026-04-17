'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Ruler,
  Calculator,
  FileSignature,
  HardHat,
  DollarSign,
  Building2,
  Users,
  Settings,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navigation: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Modules',
    items: [
      { label: 'Bids', href: '/bids', icon: FileText },
      { label: 'Takeoff', href: '/takeoff', icon: Ruler },
      { label: 'Estimates', href: '/estimates', icon: Calculator },
      { label: 'Contracts', href: '/contracts', icon: FileSignature },
      { label: 'Execution', href: '/execution', icon: HardHat },
      { label: 'Financial', href: '/financial', icon: DollarSign },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Clients', href: '/clients', icon: Building2 },
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-screen">
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-sm font-semibold text-slate-900">AWG Construction</h1>
        <p className="text-xs text-slate-500 mt-0.5">CRM System</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 mb-2">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}