'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Power } from 'lucide-react';
import { toast } from 'sonner';
import { ReferencePageShell } from '@/components/admin/reference-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Rule = {
  id: string;
  name: string;
  triggerProductivityMatchCode: string | null;
  triggerDivisionId: string | null;
  costType: string;
  formula: any;
  materialIdRef: string | null;
  uomIn: string | null;
  uomOut: string | null;
  isActive: boolean;
  createdBy: string;
  notes: string | null;
  division: { id: string; name: string } | null;
};

type Division = { id: string; name: string };
type MatRef = { id: string; name: string; uom: string; avgCents: number };

export default function RulesPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [materials, setMaterials] = useState<MatRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/reference/rules');
    if (!res.ok) { toast.error('Failed to load'); setLoading(false); return; }
    const d = await res.json();
    setItems(d.items); setDivisions(d.divisions); setMaterials(d.materials); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(r: Rule) {
    const res = await fetch(`/api/admin/reference/rules/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    if (!res.ok) { toast.error('Toggle failed'); return; }
    load();
  }
  async function remove(r: Rule) {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/reference/rules/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    toast.success('Deleted'); load();
  }
  async function create(payload: any) {
    const res = await fetch('/api/admin/reference/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await res.json();
    if (!res.ok) { toast.error(d?.error ?? 'Create failed'); return; }
    toast.success('Created'); setShowCreate(false); load();
  }

  function formulaSummary(f: any): string {
    if (!f || !f.kind) return '?';
    if (f.kind === 'qty_per_unit') return `${f.factor} ${f.uomOut}/${f.uomIn}`;
    if (f.kind === 'percent_of_direct') return `${f.percent}% of ${f.basis}`;
    if (f.kind === 'fixed_per_week') return `$${(f.cents / 100).toFixed(2)}/wk`;
    if (f.kind === 'count_per_opening') return `${f.perUnit} ${f.uomOut}/opening`;
    if (f.kind === 'lump_sum') return `$${(f.cents / 100).toFixed(2)} lump`;
    return f.kind;
  }

  return (
    <ReferencePageShell
      title="Derivative cost rules"
      subtitle={`${items.length} rule${items.length === 1 ? '' : 's'} · drives IA-2 (fasteners, tape, dumpster, consumables)`}
      toolbar={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" /> New rule</Button>}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-fg-subtle"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-sunken text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2 w-12">On</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Formula</th>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Source</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const mat = r.materialIdRef ? materials.find(m => m.id === r.materialIdRef) : null;
                return (
                  <tr key={r.id} className={`border-t border-border hover:bg-sunken/40 ${!r.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-1.5">
                      <button onClick={() => toggleActive(r)} title={r.isActive ? 'Active — click to disable' : 'Disabled — click to enable'}>
                        <Power className={`h-4 w-4 ${r.isActive ? 'text-emerald-400' : 'text-fg-subtle'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-fg-default">{r.name}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                      {r.triggerProductivityMatchCode ? <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-400">{r.triggerProductivityMatchCode}</span>
                        : r.triggerDivisionId ? <span className="rounded bg-fg-subtle/15 px-1.5 py-0.5">div: {r.division?.name}</span>
                        : <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-400">project-wide</span>}
                    </td>
                    <td className="px-3 py-1.5 text-fg-muted">{r.costType}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{formulaSummary(r.formula)}</td>
                    <td className="px-3 py-1.5 text-fg-muted">
                      {mat ? <span title={mat.name}>{mat.name.slice(0, 32)}{mat.name.length > 32 ? '…' : ''}</span> :
                        r.materialIdRef ? <span className="text-warn-500">(missing)</span> : '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-mono ${r.createdBy === 'manual' ? 'bg-fg-subtle/15 text-fg-muted' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {r.createdBy === 'ai-suggested-approved' ? 'AI ✓' : r.createdBy}
                      </span>
                    </td>
                    <td className="pr-2"><div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5 text-danger-500" /></Button></div></td>
                  </tr>
                );
              })}
              {items.length === 0 && (<tr><td colSpan={8} className="px-3 py-6 text-center text-fg-muted">No rules yet. Run IA-2 on an estimate or add one manually.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateRuleDialog divisions={divisions} materials={materials} onCancel={() => setShowCreate(false)} onSubmit={create} />
      )}
    </ReferencePageShell>
  );
}

function CreateRuleDialog({ divisions, materials, onCancel, onSubmit }: any) {
  const [name, setName] = useState('');
  const [matchCode, setMatchCode] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [costType, setCostType] = useState<'material' | 'labor' | 'site' | 'cleanup'>('material');
  const [kind, setKind] = useState<'qty_per_unit' | 'percent_of_direct' | 'fixed_per_week' | 'count_per_opening' | 'lump_sum'>('qty_per_unit');
  const [factor, setFactor] = useState('');
  const [percent, setPercent] = useState('');
  const [basis, setBasis] = useState<'labor' | 'material' | 'subtotal'>('material');
  const [cents, setCents] = useState('');
  const [perUnit, setPerUnit] = useState('');
  const [uomIn, setUomIn] = useState('SF');
  const [uomOut, setUomOut] = useState('BX');
  const [materialId, setMaterialId] = useState('');

  function buildFormula(): any {
    if (kind === 'qty_per_unit') return { kind, factor: parseFloat(factor || '0'), uomIn, uomOut };
    if (kind === 'percent_of_direct') return { kind, percent: parseFloat(percent || '0'), basis };
    if (kind === 'fixed_per_week') return { kind, cents: Math.round(parseFloat(cents || '0') * 100) };
    if (kind === 'count_per_opening') return { kind, perUnit: parseFloat(perUnit || '0'), uomOut };
    if (kind === 'lump_sum') return { kind, cents: Math.round(parseFloat(cents || '0') * 100) };
    return { kind };
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-canvas p-5">
        <h2 className="text-[15px] font-bold">New derivative rule</h2>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Name *</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hardie smooth siding fasteners" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Trigger matchCode</span><Input value={matchCode} onChange={(e) => setMatchCode(e.target.value.toUpperCase())} placeholder="ELFCS" className="font-mono uppercase" /></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">OR Trigger division</span><select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option value="">— project-wide —</option>{divisions.map((d: Division) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Cost type *</span><select value={costType} onChange={(e) => setCostType(e.target.value as any)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option>material</option><option>labor</option><option>site</option><option>cleanup</option></select></label>
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Formula kind *</span><select value={kind} onChange={(e) => setKind(e.target.value as any)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option value="qty_per_unit">qty_per_unit</option><option value="percent_of_direct">percent_of_direct</option><option value="fixed_per_week">fixed_per_week</option><option value="count_per_opening">count_per_opening</option><option value="lump_sum">lump_sum</option></select></label>
          </div>

          {kind === 'qty_per_unit' && (
            <div className="grid grid-cols-3 gap-3">
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Factor</span><Input type="number" step="0.0001" value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="0.025" /></label>
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">UOM in</span><Input value={uomIn} onChange={(e) => setUomIn(e.target.value.toUpperCase())} className="uppercase" /></label>
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">UOM out</span><Input value={uomOut} onChange={(e) => setUomOut(e.target.value.toUpperCase())} className="uppercase" /></label>
            </div>
          )}
          {kind === 'percent_of_direct' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Percent (0-50)</span><Input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="2.0" /></label>
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Basis</span><select value={basis} onChange={(e) => setBasis(e.target.value as any)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option>material</option><option>labor</option><option>subtotal</option></select></label>
            </div>
          )}
          {(kind === 'fixed_per_week' || kind === 'lump_sum') && (
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">{kind === 'fixed_per_week' ? '$/week' : '$ lump'}</span><Input type="number" step="0.01" value={cents} onChange={(e) => setCents(e.target.value)} placeholder="650.00" /></label>
          )}
          {kind === 'count_per_opening' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Per unit</span><Input type="number" step="0.01" value={perUnit} onChange={(e) => setPerUnit(e.target.value)} placeholder="2" /></label>
              <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">UOM out</span><Input value={uomOut} onChange={(e) => setUomOut(e.target.value.toUpperCase())} className="uppercase" /></label>
            </div>
          )}

          {(kind === 'qty_per_unit' || kind === 'count_per_opening') && (
            <label className="block"><span className="block text-[10.5px] font-semibold uppercase text-fg-subtle">Material</span><select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"><option value="">— none —</option>{materials.map((m: MatRef) => <option key={m.id} value={m.id}>{m.name} ({m.uom} · ${(m.avgCents / 100).toFixed(2)})</option>)}</select></label>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!name} onClick={() => onSubmit({
            name: name.trim(),
            triggerProductivityMatchCode: matchCode.trim() || null,
            triggerDivisionId: divisionId || null,
            costType, formula: buildFormula(),
            materialIdRef: materialId || null,
            uomIn: uomIn || null, uomOut: uomOut || null,
            isActive: true,
          })}>Create</Button>
        </div>
      </div>
    </div>
  );
}
