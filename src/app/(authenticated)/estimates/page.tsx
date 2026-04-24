'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Search,
  Building2,
  MapPin,
  Loader2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type ApiEstimate = {
  id: string;
  status: string;
  clientName: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    address: string | null;
  };
  region: { stateCode: string };
  owner: { id: string; name: string };
  _count: { lines: number };
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-ink-200 text-fg-muted',
  in_pricing: 'bg-blue-500/15 text-blue-400',
  pricing_done: 'bg-warn-500/15 text-warn-500',
  submitted_to_client: 'bg-warn-500/15 text-warn-500',
  won: 'bg-success-500/15 text-success-500',
  lost: 'bg-danger-500/15 text-danger-500',
  cancelled: 'bg-ink-200 text-fg-muted',
};

export default function EstimatesListPage() {
  const [estimates, setEstimates] = useState<ApiEstimate[] | null>(null);
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (mine) params.set('mine', '1');
    fetch(`/api/estimates?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEstimates(Array.isArray(d) ? d : []))
      .catch(() => setEstimates([]));
  }, [search, mine]);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-6 md:p-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Estimates
          </h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            Proposals in flight — from accepted Takeoffs to client-ready quotes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-fg-muted">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
            className="h-[15px] w-[15px] accent-blue-500"
          />
          Only mine
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Project, number or client"
            className="h-9 w-[260px] pl-8 text-[13px]"
          />
        </div>
      </div>

      {estimates === null ? (
        <div className="flex items-center justify-center py-16 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : estimates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-sunken/40 px-6 py-16 text-center">
          <Calculator className="mx-auto h-8 w-8 text-fg-subtle" />
          <h3 className="mt-3 text-[15px] font-semibold text-fg-default">
            No estimates yet
          </h3>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Accept a handoff from a Takeoff project to start pricing.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {estimates.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/estimates/${e.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-sunken/60"
                >
                  <Calculator className="h-4 w-4 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      {e.project.projectNumber && (
                        <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-fg-muted">
                          {e.project.projectNumber}
                        </span>
                      )}
                      <span className="font-semibold text-fg-default">{e.project.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_COLORS[e.status] ?? 'bg-ink-200 text-fg-muted'
                        }`}
                      >
                        {e.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-fg-subtle">
                      {e.clientName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {e.clientName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.region.stateCode}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {e._count.lines} line{e._count.lines === 1 ? '' : 's'}
                      </span>
                      <span>
                        Owner: {e.owner.name} · {new Date(e.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
