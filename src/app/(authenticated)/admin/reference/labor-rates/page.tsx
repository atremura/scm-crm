'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReferencePageShell } from '@/components/admin/reference-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Rate = {
  id: string;
  tradeId: string;
  regionId: string;
  shopType: string;
  lowCents: number | null;
  avgCents: number;
  highCents: number | null;
  notes: string | null;
  trade: { id: string; name: string };
  region: { id: string; name: string; stateCode: string };
};

type Ref = { id: string; name: string; stateCode?: string };

export default function LaborRatesPage() {
  const [items, setItems] = useState<Rate[]>([]);
  const [trades, setTrades] = useState<Ref[]>([]);
  const [regions, setRegions] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/reference/labor-rates');
    if (!res.ok) { toast.error('Failed to load'); setLoading(false); return; }
    const d = await res.json();
    setItems(d.items); setTrades(d.trades); setRegions(d.regions); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editingId) return;
    const res = await fetch(`/api/admin/reference/labor-rates/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avgCents: Number(draft.avgCents),
        lowCents: draft.lowCents !== '' && draft.lowCents != null ? Number(draft.lowCents) : null,
        highCents: draft.highCents !== '' && draft.highCents != null ? Number(draft.highCents) : null,
        shopType: draft.shopType,
      }),
    });
    const d = await res.json();
    if (!res.ok) { toast.error(d?.error ?? 'Save failed'); return; }
    toast.success('Saved'); setEditingId(null); setDraft({}); load();
  }
  async function remove(id: string) {
    if (!confirm('Delete this rate?')) return;
    const res = await fetch(`/api/admin/reference/labor-rates/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    toast.success('Deleted'); load();
  }
  async function create(payload: any) {
    const res = await fetch('/api/admin/reference/labor-rates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { toast.error(d?.error ?? 'Create failed'); return; }
    toast.success('Created'); setShowCreate(false); load();
  }

  return (
    <ReferencePageShell
      title="Labor rates"
      subtitle={`${items.length} rate${items.length === 1 ? '' : 's'} · $/hr by trade × region × shop type`}
      toolbar={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" /> New rate</Button>}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-fg-subtle"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-sunken text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Shop</th>
                <th className="px-3 py-2 text-right">Low $/hr</th>
                <th className="px-3 py-2 text-right">Avg $/hr</th>
                <th className="px-3 py-2 text-right">High $/hr</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => editingId === r.id ? (
                <tr key={r.id} className="border-t border-border bg-blue-500/5">
                  <td className="px-3 py-1.5 text-fg-default">{r.trade.name}</td>
                  <td className="px-3 py-1.5 text-fg-muted">{r.region.name}</td>
                  <td className="px-3 py-1.5">
                    <select value={draft.shopType ?? r.shopType} onChange={(e) => setDraft({ ...draft, shopType: e.target.value })} className="h-7 rounded border border-border bg-canvas px-1 text-[12px]">
                      <option value="open_shop">open_shop</option><option value="union">union</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.01" value={draft.lowCents != null ? (Number(draft.lowCents) / 100).toFixed(2) : ''} onChange={(e) => setDraft({ ...draft, lowCents: e.target.value === '' ? null : Math.round(parseFloat(e.target.value) * 100) })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.01" value={draft.avgCents != null ? (Number(draft.avgCents) / 100).toFixed(2) : ''} onChange={(e) => setDraft({ ...draft, avgCents: Math.round(parseFloat(e.target.value || '0') * 100) })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="px-3 py-1.5 text-right"><input type="number" step="0.01" value={draft.highCents != null ? (Number(draft.highCents) / 100).toFixed(2) : ''} onChange={(e) => setDraft({ ...draft, highCents: e.target.value === '' ? null : Math.round(parseFloat(e.target.value) * 100) })} className="h-7 w-20 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]" /></td>
                  <td className="pr-2"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Save className="h-3.5 w-3.5 text-emerald-400" /></Button><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(null); setDraft({}); }}><X className="h-3.5 w-3.5" /></Button></div></td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t border-border hover:bg-sunken/40">
                  <td className="px-3 py-1.5 text-fg-default">
                    <button onClick={() => { setEditingId(r.id); setDraft({ shopType: r.shopType, lowCents: r.lowCents, avgCents: r.avgCents, highCents: r.highCents }); }} className="text-left hover:underline">
                      {r.trade.name}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-fg-muted">{r.region.name} <span className="text-fg-subtle">({r.region.stateCode})</span></td>
                  <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] ${r.shopType === 'union' ? 'bg-purple-500/15 text-purple-400' : 'bg-fg-subtle/15 text-fg-muted'}`}>{r.shopType}</span></td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-subtle">{r.lowCents !== null ? `$${(r.lowCents / 100).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">${(r.avgCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-subtle">{r.highCents !== null ? `$${(r.highCents / 100).toFixed(2)}` : '—'}</td>
                  <td className="pr-2"><div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-danger-500" /></Button></div></td>
                </tr>
              ))}
              {items.length === 0 && (<tr><td colSpan={7} className="px-3 py-6 text-center text-fg-muted">No labor rates.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateRateDialog trades={trades} regions={regions} onCancel={() => setShowCreate(false)} onSubmit={create} />
      )}
    </ReferencePageShell>
  );
}

function CreateRateDialog({ trades, regions, onCancel, onSubmit }: any) {
  const [tradeId, setTradeId] = useState(trades[0]?.id ?? '');
  const [regionId, setRegionId] = useState(regions[0]?.id ?? '');
  const [shopType, setShopType] = useState<'open_shop' | 'union'>('open_shop');
  const [low, setLow] = useState(''); const [avg, setAvg] = useState(''); const [high, setHigh] = useState('');
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-canvas p-5">
        <h2 className="text-[15px] font-bold">New labor rate</h2>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Trade *</span><select value={tradeId} onChange={(e) => setTradeId(e.target.value)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]">{trades.map((t: Ref) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Region *</span><select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]">{regions.map((r: Ref) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          </div>
          <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Shop type *</span><select value={shopType} onChange={(e) => setShopType(e.target.value as any)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option value="open_shop">open_shop</option><option value="union">union</option></select></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Low $/hr</span><Input type="number" step="0.01" value={low} onChange={(e) => setLow(e.target.value)} /></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Avg $/hr *</span><Input type="number" step="0.01" value={avg} onChange={(e) => setAvg(e.target.value)} /></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">High $/hr</span><Input type="number" step="0.01" value={high} onChange={(e) => setHigh(e.target.value)} /></label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!tradeId || !regionId || !avg} onClick={() => onSubmit({
            tradeId, regionId, shopType,
            avgCents: Math.round(parseFloat(avg) * 100),
            lowCents: low ? Math.round(parseFloat(low) * 100) : null,
            highCents: high ? Math.round(parseFloat(high) * 100) : null,
          })}>Create</Button>
        </div>
      </div>
    </div>
  );
}
