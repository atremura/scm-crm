'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Search, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReferencePageShell } from '@/components/admin/reference-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Entry = {
  id: string;
  divisionId: string;
  scopeName: string;
  uom: string;
  crewDescription: string | null;
  assumedTradeId: string | null;
  mhPerUnitLow: number | string | null;
  mhPerUnitAvg: number | string;
  mhPerUnitHigh: number | string | null;
  matchCode: string | null;
  matchKeywords: string | null;
  notes: string | null;
  division: { id: string; name: string };
  assumedTrade: { id: string; name: string } | null;
};

type Ref = { id: string; name: string };
const UOMS = ['SF', 'LF', 'FT', 'EA', 'BX', 'LB', 'GAL', 'SY', 'CY', 'WK', 'LS'];

export default function ProductivityPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [divisions, setDivisions] = useState<Ref[]>([]);
  const [trades, setTrades] = useState<Ref[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reference/productivity?q=${encodeURIComponent(search)}`);
    if (!res.ok) {
      toast.error('Failed to load');
      setLoading(false);
      return;
    }
    const d = await res.json();
    setItems(d.items);
    setDivisions(d.divisions);
    setTrades(d.trades);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!editingId) return;
    const res = await fetch(`/api/admin/reference/productivity/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionId: draft.divisionId,
        scopeName: draft.scopeName,
        uom: draft.uom,
        assumedTradeId: draft.assumedTradeId || null,
        mhPerUnitLow: draft.mhPerUnitLow !== '' && draft.mhPerUnitLow != null ? Number(draft.mhPerUnitLow) : null,
        mhPerUnitAvg: Number(draft.mhPerUnitAvg),
        mhPerUnitHigh: draft.mhPerUnitHigh !== '' && draft.mhPerUnitHigh != null ? Number(draft.mhPerUnitHigh) : null,
        matchCode: draft.matchCode || null,
        matchKeywords: draft.matchKeywords || null,
        notes: draft.notes || null,
      }),
    });
    const d = await res.json();
    if (!res.ok) { toast.error(d?.error ?? 'Save failed'); return; }
    toast.success('Saved');
    setEditingId(null); setDraft({});
    load();
  }
  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/admin/reference/productivity/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Delete failed'); return; }
    toast.success('Deleted'); load();
  }
  async function create(payload: any) {
    const res = await fetch('/api/admin/reference/productivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { toast.error(d?.error ?? 'Create failed'); return; }
    toast.success('Created'); setShowCreate(false); load();
  }

  return (
    <ReferencePageShell
      title="Productivity"
      subtitle={`${items.length} entr${items.length === 1 ? 'y' : 'ies'} · MH/unit per scope (drives the labor side of every estimate line)`}
      toolbar={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input placeholder="Search scope / matchCode / keywords" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="h-8 w-[280px] pl-7 text-[12.5px]" />
          </div>
          <Button size="sm" variant="outline" onClick={load}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" /> New entry</Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-[calc(100vh-220px)] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-sunken text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2 text-right">MH low</th>
                <th className="px-3 py-2 text-right">MH avg</th>
                <th className="px-3 py-2 text-right">MH high</th>
                <th className="px-3 py-2">Trade</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => editingId === e.id ? (
                <tr key={e.id} className="border-t border-border bg-blue-500/5">
                  <td className="px-3 py-1.5"><select value={draft.divisionId ?? ''} onChange={(ev) => setDraft({ ...draft, divisionId: ev.target.value })} className="h-7 w-full rounded border border-border bg-canvas px-1 text-[12px]">{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
                  <td className="px-3 py-1.5"><input value={draft.scopeName ?? ''} onChange={(ev) => setDraft({ ...draft, scopeName: ev.target.value })} className="h-7 w-full rounded border border-border bg-canvas px-2 text-[12px]" /></td>
                  <td className="px-3 py-1.5"><input value={draft.matchCode ?? ''} onChange={(ev) => setDraft({ ...draft, matchCode: ev.target.value })} placeholder="ELFCS" className="h-7 w-24 rounded border border-border bg-canvas px-2 font-mono text-[11px] uppercase" /></td>
                  <td className="px-3 py-1.5"><select value={draft.uom ?? ''} onChange={(ev) => setDraft({ ...draft, uom: ev.target.value })} className="h-7 w-full rounded border border-border bg-canvas px-1 text-[12px]">{UOMS.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.0001" value={draft.mhPerUnitLow ?? ''} onChange={(ev) => setDraft({ ...draft, mhPerUnitLow: ev.target.value })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.0001" value={draft.mhPerUnitAvg ?? ''} onChange={(ev) => setDraft({ ...draft, mhPerUnitAvg: ev.target.value })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.0001" value={draft.mhPerUnitHigh ?? ''} onChange={(ev) => setDraft({ ...draft, mhPerUnitHigh: ev.target.value })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="px-3 py-1.5"><select value={draft.assumedTradeId ?? ''} onChange={(ev) => setDraft({ ...draft, assumedTradeId: ev.target.value || null })} className="h-7 w-full rounded border border-border bg-canvas px-1 text-[12px]"><option value="">— none —</option>{trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
                  <td className="pr-2"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Save className="h-3.5 w-3.5 text-emerald-400" /></Button><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(null); setDraft({}); }}><X className="h-3.5 w-3.5" /></Button></div></td>
                </tr>
              ) : (
                <tr key={e.id} className="border-t border-border hover:bg-sunken/40">
                  <td className="px-3 py-1.5 text-fg-muted">{e.division.name}</td>
                  <td className="px-3 py-1.5 text-fg-default"><button onClick={() => { setEditingId(e.id); setDraft({ ...e, mhPerUnitLow: e.mhPerUnitLow ?? '', mhPerUnitAvg: e.mhPerUnitAvg, mhPerUnitHigh: e.mhPerUnitHigh ?? '' }); }} className="text-left hover:underline">{e.scopeName}</button></td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">{e.matchCode ?? '—'}</td>
                  <td className="px-3 py-1.5 uppercase text-fg-subtle">{e.uom}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-subtle">{e.mhPerUnitLow !== null ? Number(e.mhPerUnitLow).toFixed(4) : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{Number(e.mhPerUnitAvg).toFixed(4)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-subtle">{e.mhPerUnitHigh !== null ? Number(e.mhPerUnitHigh).toFixed(4) : '—'}</td>
                  <td className="px-3 py-1.5 text-fg-muted">{e.assumedTrade?.name ?? '—'}</td>
                  <td className="pr-2"><div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(e.id, e.scopeName)}><Trash2 className="h-3.5 w-3.5 text-danger-500" /></Button></div></td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-fg-muted">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateDialog divisions={divisions} trades={trades} onCancel={() => setShowCreate(false)} onSubmit={create} />}
    </ReferencePageShell>
  );
}

function CreateDialog({ divisions, trades, onCancel, onSubmit }: { divisions: Ref[]; trades: Ref[]; onCancel: () => void; onSubmit: (p: any) => void }) {
  const [form, setForm] = useState({ scopeName: '', divisionId: divisions[0]?.id ?? '', uom: 'LF', matchCode: '', mhAvg: '', tradeId: '' });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-canvas p-5">
        <h2 className="text-[15px] font-bold">New productivity entry</h2>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Scope name *</span><Input value={form.scopeName} onChange={(e) => setForm({ ...form, scopeName: e.target.value })} placeholder="Fiber cement fascia install" autoFocus /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Division *</span><select value={form.divisionId} onChange={(e) => setForm({ ...form, divisionId: e.target.value })} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]">{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">UOM *</span><select value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]">{UOMS.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">MH/unit avg *</span><Input type="number" step="0.0001" value={form.mhAvg} onChange={(e) => setForm({ ...form, mhAvg: e.target.value })} placeholder="0.055" /></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Match code</span><Input value={form.matchCode} onChange={(e) => setForm({ ...form, matchCode: e.target.value.toUpperCase() })} placeholder="ELFCS" className="font-mono uppercase" /></label>
          </div>
          <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Trade</span><select value={form.tradeId} onChange={(e) => setForm({ ...form, tradeId: e.target.value })} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option value="">— none —</option>{trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!form.scopeName || !form.divisionId || !form.mhAvg} onClick={() => onSubmit({ scopeName: form.scopeName.trim(), divisionId: form.divisionId, uom: form.uom, mhPerUnitAvg: parseFloat(form.mhAvg), matchCode: form.matchCode.trim() || null, assumedTradeId: form.tradeId || null })}>Create</Button>
        </div>
      </div>
    </div>
  );
}
