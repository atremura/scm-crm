'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Mail,
  Phone,
  ChevronRight,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NewClientDialog } from '@/components/bids/new-client-dialog';

type ApiClient = {
  id: string;
  companyName: string;
  type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
  _count: { bids: number };
};

type StatusFilter = 'active' | 'inactive' | 'all';

export default function ClientsPage() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [newOpen, setNewOpen] = useState(false);

  async function load(s: StatusFilter, q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: s });
      if (q) params.set('search', q);
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) throw new Error('Failed to load clients');
      setClients(await res.json());
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const t = setTimeout(() => load(status, search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.isActive).length;
    const totalBids = clients.reduce((sum, c) => sum + c._count.bids, 0);
    const withContacts = clients.filter((c) => c.contacts.length > 0).length;
    return { active, totalBids, withContacts };
  }, [clients]);

  const isEmpty = !loading && clients.length === 0 && !search;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-6 md:p-8">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Clients
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            General contractors, developers, owners. Add manually now — AI will
            auto-create clients when processing emails.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Client
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Active Clients" value={stats.active} />
        <StatCard label="With Contacts" value={stats.withContacts} />
        <StatCard label="Total Bids Received" value={stats.totalBids} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1 max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Search by company, city, or contact name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Archived only</SelectItem>
            <SelectItem value="all">All clients</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isEmpty ? (
        <EmptyState onCreate={() => setNewOpen(true)} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Primary Contact</th>
                  <th className="px-4 py-3 text-right">Bids</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-fg-subtle">
                      Loading…
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-fg-subtle">
                      No clients match your search
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const primary = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
                    return (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-sunken/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/clients/${c.id}`}
                            className="flex items-center gap-2.5"
                          >
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-500">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-fg-default">
                                {c.companyName}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {c.type ? (
                            <span className="inline-flex items-center rounded-full border border-border bg-sunken px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                              {c.type}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-fg-default">
                          {c.city || c.state ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-fg-subtle" />
                              {[c.city, c.state].filter(Boolean).join(', ')}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {primary ? (
                            <div>
                              <div className="font-semibold text-fg-default">{primary.name}</div>
                              {primary.email && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-fg-muted">
                                  <Mail className="h-3 w-3" />
                                  {primary.email}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-fg-subtle">No contacts</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-fg-default">
                          {c._count.bids}
                        </td>
                        <td className="px-4 py-3">
                          {c.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/15 px-2 py-0.5 text-[11px] font-semibold text-success-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100/60 px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                              <Archive className="h-3 w-3" />
                              Archived
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/clients/${c.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {clients.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[12.5px] text-fg-muted">
              <span>
                Showing {clients.length} {clients.length === 1 ? 'client' : 'clients'}
              </span>
            </div>
          )}
        </div>
      )}

      <NewClientDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(c) => {
          toast.success(`Client "${c.companyName}" created`);
          load(status, search);
        }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
        {label}
      </div>
      <div className="mt-2 text-[26px] font-bold leading-none text-fg-default">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
        <Building2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-[18px] font-bold text-fg-default">No clients yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">
        Add your first GC, developer, or owner. You&apos;ll be able to attach bids
        to them. Later, AI will auto-create clients from inbound emails.
      </p>
      <Button size="lg" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        New Client
      </Button>
    </div>
  );
}
