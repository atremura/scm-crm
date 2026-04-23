'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  FileText,
  Inbox,
  Ruler,
  Loader2,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type ApiProject = {
  id: string;
  name: string;
  projectNumber: string | null;
  address: string | null;
  workType: string | null;
  status: string;
  startedAt: string;
  client: { id: string; companyName: string } | null;
  bid: { id: string; bidNumber: string; status: string } | null;
  estimator: { id: string; name: string; email: string } | null;
  _count: { documents: number; classifications: number };
};

type Tab = 'active' | 'archived' | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

export default function TakeoffProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[] | null>(null);
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bid' | 'standalone'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('status', tab);
    if (search) params.set('search', search);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);

    fetch(`/api/projects?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [tab, search, sourceFilter]);

  const counts = useMemo(() => {
    const a = projects?.filter((p) => p.status === 'active').length ?? 0;
    const ar = projects?.filter((p) => p.status === 'archived').length ?? 0;
    return { active: a, archived: ar, all: (projects?.length ?? 0) };
  }, [projects]);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-6 md:p-8">
      {/* Head */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Takeoff Projects
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Measurements, classifications, and documents for every project.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/takeoff/new">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-[10px] bg-sunken p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all ${
                tab === t.key
                  ? 'bg-surface text-fg-default shadow-sm'
                  : 'text-fg-muted hover:text-fg-default'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'bid' | 'standalone')}
            className="h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-fg-default focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">Any source</option>
            <option value="bid">From Bid</option>
            <option value="standalone">Standalone</option>
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, number, address"
              className="h-9 w-[260px] pl-8 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading && !projects ? (
        <div className="flex items-center justify-center py-16 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects…
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState onNew={() => (window.location.href = '/takeoff/new')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ApiProject }) {
  const archived = project.status === 'archived';
  return (
    <Link
      href={`/takeoff/${project.id}`}
      className={`group block overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-all hover:border-blue-500/40 hover:shadow-sm ${
        archived ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {project.projectNumber && (
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg-muted">
                {project.projectNumber}
              </span>
            )}
            {project.bid && (
              <span
                title={`From Bid ${project.bid.bidNumber}`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-blue-400"
              >
                <Inbox className="h-3 w-3" />
                {project.bid.bidNumber}
              </span>
            )}
            {archived && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-fg-muted">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-semibold text-fg-default group-hover:text-blue-400">
            {project.name}
          </h3>
        </div>
      </div>

      <div className="space-y-2 px-5 py-4 text-[12.5px] text-fg-muted">
        {project.client && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.client.companyName}</span>
          </div>
        )}
        {project.address && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.address}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-sunken/40 px-5 py-2.5 text-[11.5px] text-fg-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {project._count.documents} doc{project._count.documents === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" />
            {project._count.classifications} class.
          </span>
        </div>
        {project.estimator && (
          <span className="truncate">{project.estimator.name}</span>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-sunken/40 px-6 py-16 text-center">
      <Ruler className="mx-auto h-8 w-8 text-fg-subtle" />
      <h3 className="mt-3 text-[15px] font-semibold text-fg-default">
        No projects yet
      </h3>
      <p className="mt-1 text-[12.5px] text-fg-muted">
        Start a takeoff from a qualified bid, or create a standalone project.
      </p>
      <Button onClick={onNew} size="sm" className="mt-4">
        <Plus className="h-3.5 w-3.5" />
        New Project
      </Button>
    </div>
  );
}
