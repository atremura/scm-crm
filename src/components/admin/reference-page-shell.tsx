'use client';

import { ReactNode } from 'react';

/**
 * Shared shell for the admin reference pages — title, subtitle,
 * optional "New" / "Search" toolbar slot, and a body that scrolls.
 * Pages plug in their own table + dialog inside `children`.
 */
export function ReferencePageShell({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] text-fg-muted">{subtitle}</p>
          )}
        </div>
        {toolbar}
      </header>
      {children}
    </div>
  );
}
