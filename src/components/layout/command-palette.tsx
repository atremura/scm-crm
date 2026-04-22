'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  Building2,
  Users,
  Settings,
  Plus,
  Search,
  Sparkles,
  CornerDownLeft,
  ArrowRight,
} from 'lucide-react';

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Navigate' | 'Create' | 'Tools';
  run: (router: ReturnType<typeof useRouter>) => void;
  keywords: string;
};

const COMMANDS: Command[] = [
  {
    id: 'go-dashboard',
    label: 'Go to Dashboard',
    hint: 'Home overview & map',
    icon: LayoutDashboard,
    group: 'Navigate',
    run: (r) => r.push('/dashboard'),
    keywords: 'home overview map',
  },
  {
    id: 'go-bids',
    label: 'Go to BIDs',
    hint: 'Pipeline & list',
    icon: Inbox,
    group: 'Navigate',
    run: (r) => r.push('/bids'),
    keywords: 'pipeline list',
  },
  {
    id: 'go-clients',
    label: 'Go to Clients',
    hint: 'GCs, developers, owners',
    icon: Building2,
    group: 'Navigate',
    run: (r) => r.push('/clients'),
    keywords: 'companies gc developer owner',
  },
  {
    id: 'go-users',
    label: 'Go to Users & Roles',
    hint: 'Permissions matrix',
    icon: Users,
    group: 'Navigate',
    run: (r) => r.push('/users'),
    keywords: 'team permissions roles',
  },
  {
    id: 'go-settings',
    label: 'Go to Settings',
    hint: 'Base location, distance, AI',
    icon: Settings,
    group: 'Navigate',
    run: (r) => r.push('/settings'),
    keywords: 'config preferences base distance',
  },
  {
    id: 'new-bid',
    label: 'New Bid',
    hint: 'Manually log a bid',
    icon: Plus,
    group: 'Create',
    run: (r) => r.push('/bids/new'),
    keywords: 'create add manual',
  },
  {
    id: 'new-user',
    label: 'New User',
    hint: 'Invite a teammate',
    icon: Plus,
    group: 'Create',
    run: (r) => r.push('/users/new'),
    keywords: 'create invite team member',
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onAskAi: () => void;
};

export function CommandPalette({ open, onClose, onAskAi }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build the action list (commands + Ask AI placeholder)
  const askAiCommand: Command = {
    id: 'ask-ai',
    label: 'Ask JMO Copilot',
    hint: 'Open the AI side panel',
    icon: Sparkles,
    group: 'Tools',
    run: () => onAskAi(),
    keywords: 'ai claude assistant chat copilot',
  };

  const all = [...COMMANDS, askAiCommand];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter((c) => {
        const haystack = `${c.label} ${c.hint} ${c.keywords}`.toLowerCase();
        return haystack.includes(q);
      })
    : all;

  // Group by section, preserve filtered order
  const groups: Record<string, Command[]> = {};
  filtered.forEach((c) => {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  });

  const flat = filtered;

  function execute(cmd: Command) {
    cmd.run(router);
    onClose();
  }

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flat[activeIdx];
        if (cmd) execute(cmd);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx, flat]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      role="dialog"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder="Type a command or jump to a page…"
            className="flex-1 bg-transparent text-[14px] text-fg-default placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-fg-subtle">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto py-1">
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-fg-subtle">
              No matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(groups).map(([groupName, cmds]) => (
              <div key={groupName} className="py-1">
                <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                  {groupName}
                </div>
                {cmds.map((cmd) => {
                  runningIdx++;
                  const active = runningIdx === activeIdx;
                  const idx = runningIdx;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => execute(cmd)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                        active ? 'bg-blue-500/15' : ''
                      }`}
                    >
                      <div
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                          active ? 'bg-blue-500/25 text-blue-500' : 'bg-sunken text-fg-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-fg-default">
                          {cmd.label}
                        </div>
                        <div className="text-[11.5px] text-fg-muted">{cmd.hint}</div>
                      </div>
                      {active && <CornerDownLeft className="h-3.5 w-3.5 text-fg-muted" />}
                      {!active && <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-sunken/40 px-4 py-2 text-[10.5px] text-fg-subtle">
          <span>
            <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono">
              ↑↓
            </kbd>{' '}
            navigate ·{' '}
            <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono">
              ↵
            </kbd>{' '}
            select
          </span>
          <span>{flat.length} action{flat.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
