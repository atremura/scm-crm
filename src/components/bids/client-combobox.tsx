'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronsUpDown, Plus, Search, X } from 'lucide-react';

export type ClientOption = {
  id: string;
  companyName: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
};

type Props = {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  onCreateNew: () => void;
  placeholder?: string;
  error?: string;
};

export function ClientCombobox({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Select a client…',
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Load clients when opening or when search changes
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        const res = await fetch(`/api/clients?${params}`);
        if (res.ok) setClients(await res.json());
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [search, open]);

  return (
    <div ref={wrapRef} className="relative" data-error={error ? 'true' : undefined}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-invalid={error ? true : undefined}
        className={`flex w-full items-center gap-2 rounded-md border bg-surface px-3 py-2 text-left text-[13.5px] transition-colors ${
          error ? 'border-danger-500' : 'border-border hover:border-border-strong'
        } ${open ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}`}
      >
        <Building2 className="h-4 w-4 shrink-0 text-fg-subtle" />
        {value ? (
          <span className="flex-1 truncate">
            <span className="font-semibold text-fg-default">{value.companyName}</span>
            {value.city && (
              <span className="ml-2 text-[11.5px] text-fg-muted">
                {value.city}
                {value.state ? `, ${value.state}` : ''}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 text-fg-subtle">{placeholder}</span>
        )}
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="grid h-5 w-5 place-items-center rounded-md text-fg-subtle hover:bg-sunken hover:text-fg-default"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-md border border-transparent bg-sunken px-3 py-1.5 pl-9 text-[13px] text-fg-default placeholder:text-fg-subtle focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-[12.5px] text-fg-subtle">
                Loading…
              </div>
            ) : clients.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12.5px] text-fg-subtle">
                {search ? 'No clients match' : 'No clients yet'}
              </div>
            ) : (
              clients.map((c) => {
                const selected = value?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                      selected
                        ? 'bg-blue-500/15 text-fg-default'
                        : 'text-fg-default hover:bg-sunken'
                    }`}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-fg-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.companyName}</div>
                      {(c.type || c.city) && (
                        <div className="truncate text-[11.5px] text-fg-muted">
                          {[c.type, c.city].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreateNew();
            }}
            className="flex w-full items-center gap-2 border-t border-border bg-sunken px-3 py-2.5 text-left text-[13px] font-semibold text-blue-500 transition-colors hover:bg-sunken/60"
          >
            <Plus className="h-4 w-4" />
            Create new client
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-[11.5px] text-danger-500">{error}</p>}
    </div>
  );
}
