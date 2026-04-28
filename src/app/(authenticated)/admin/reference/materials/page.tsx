'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Search, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReferencePageShell } from '@/components/admin/reference-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Material = {
  id: string;
  name: string;
  divisionId: string | null;
  materialTypeId: string | null;
  sku: string | null;
  uom: string;
  lowCents: number | null;
  avgCents: number;
  highCents: number | null;
  wastePercent: number;
  supplier: string | null;
  notes: string | null;
  division: { id: string; name: string } | null;
};

type Division = { id: string; name: string };
type MType = { id: string; name: string };

const UOMS = ['SF', 'LF', 'FT', 'EA', 'BX', 'LB', 'GAL', 'TUBE', 'SY', 'CY', 'WK', 'LS'];

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [types, setTypes] = useState<MType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Material>>({});
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reference/materials?q=${encodeURIComponent(search)}`);
    if (!res.ok) {
      toast.error('Failed to load materials');
      setLoading(false);
      return;
    }
    const d = await res.json();
    setItems(d.items);
    setDivisions(d.divisions);
    setTypes(d.types);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEdit(m: Material) {
    setEditingId(m.id);
    setDraft({ ...m });
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }
  async function saveEdit() {
    if (!editingId) return;
    const patch: any = {
      name: draft.name,
      divisionId: draft.divisionId ?? null,
      sku: draft.sku ?? null,
      uom: draft.uom,
      avgCents: Number(draft.avgCents) || 0,
      lowCents: draft.lowCents !== null && draft.lowCents !== undefined && draft.lowCents !== ('' as any) ? Number(draft.lowCents) : null,
      highCents: draft.highCents !== null && draft.highCents !== undefined && draft.highCents !== ('' as any) ? Number(draft.highCents) : null,
      wastePercent: Number(draft.wastePercent ?? 5),
      supplier: draft.supplier ?? null,
      notes: draft.notes ?? null,
    };
    const res = await fetch(`/api/admin/reference/materials/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(d?.error ?? 'Save failed');
      return;
    }
    toast.success('Saved');
    cancelEdit();
    load();
  }
  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/admin/reference/materials/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? 'Delete failed');
      return;
    }
    toast.success('Deleted');
    load();
  }

  async function createNew(payload: any) {
    const res = await fetch('/api/admin/reference/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(d?.error ?? 'Create failed');
      return;
    }
    toast.success('Created');
    setShowCreate(false);
    load();
  }

  return (
    <ReferencePageShell
      title="Materials"
      subtitle={`${items.length} item${items.length === 1 ? '' : 's'} · catalog used by the Estimate auto-pricer`}
      toolbar={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="Search name / SKU / supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              className="h-8 w-[260px] pl-7 text-[12.5px]"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New material
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-[calc(100vh-220px)] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-sunken text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2 text-right">$/unit</th>
                <th className="px-3 py-2 text-right">Waste %</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-fg-muted">
                    No materials. Click <b>New material</b> or refine the search.
                  </td>
                </tr>
              )}
              {items.map((m) =>
                editingId === m.id ? (
                  <tr key={m.id} className="border-t border-border bg-blue-500/5">
                    <td className="px-3 py-1.5">
                      <select
                        value={draft.divisionId ?? ''}
                        onChange={(e) => setDraft({ ...draft, divisionId: e.target.value || null })}
                        className="h-7 w-full rounded border border-border bg-canvas px-2 text-[12px]"
                      >
                        <option value="">— none —</option>
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={draft.name ?? ''}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="h-7 w-full rounded border border-border bg-canvas px-2 text-[12px]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={draft.sku ?? ''}
                        onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                        className="h-7 w-full rounded border border-border bg-canvas px-2 font-mono text-[11px]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={draft.uom ?? ''}
                        onChange={(e) => setDraft({ ...draft, uom: e.target.value })}
                        className="h-7 w-full rounded border border-border bg-canvas px-1 text-[12px]"
                      >
                        {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.avgCents !== null && draft.avgCents !== undefined ? (Number(draft.avgCents) / 100).toFixed(2) : ''}
                        onChange={(e) => setDraft({ ...draft, avgCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                        className="h-7 w-24 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        value={draft.wastePercent ?? 5}
                        onChange={(e) => setDraft({ ...draft, wastePercent: parseInt(e.target.value || '0', 10) })}
                        className="h-7 w-16 rounded border border-border bg-canvas px-2 text-right font-mono text-[12px]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={draft.supplier ?? ''}
                        onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                        className="h-7 w-full rounded border border-border bg-canvas px-2 text-[12px]"
                      />
                    </td>
                    <td className="px-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit} title="Save">
                          <Save className="h-3.5 w-3.5 text-emerald-400" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit} title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="border-t border-border hover:bg-sunken/40">
                    <td className="px-3 py-1.5 text-fg-muted">{m.division?.name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-fg-default">
                      <button
                        onClick={() => startEdit(m)}
                        className="text-left hover:underline"
                      >
                        {m.name}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">{m.sku ?? '—'}</td>
                    <td className="px-3 py-1.5 uppercase text-fg-subtle">{m.uom}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      ${(m.avgCents / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-fg-muted">{m.wastePercent}%</td>
                    <td className="px-3 py-1.5 text-fg-muted">{m.supplier ?? '—'}</td>
                    <td className="pr-2">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => remove(m.id, m.name)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-danger-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateMaterialDialog
          divisions={divisions}
          onCancel={() => setShowCreate(false)}
          onSubmit={createNew}
        />
      )}
    </ReferencePageShell>
  );
}

function CreateMaterialDialog({
  divisions,
  onCancel,
  onSubmit,
}: {
  divisions: Division[];
  onCancel: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState<string>('');
  const [uom, setUom] = useState('LF');
  const [price, setPrice] = useState('');
  const [wastePercent, setWastePercent] = useState('5');
  const [supplier, setSupplier] = useState('');
  const [sku, setSku] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-canvas p-5 shadow-2xl">
        <h2 className="text-[15px] font-bold text-fg-default">New material</h2>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <Field label="Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HardieTrim 1x4 12ft" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="UOM *">
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"
              >
                {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Price ($/unit) *">
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2.45" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Waste %">
              <Input type="number" value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} />
            </Field>
            <Field label="Division">
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className="h-9 w-full rounded border border-border bg-canvas px-2 text-[13px]"
              >
                <option value="">— none —</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="SKU"><Input value={sku} onChange={(e) => setSku(e.target.value)} /></Field>
          <Field label="Supplier"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button
            disabled={submitting || !name || !uom || !price}
            onClick={async () => {
              setSubmitting(true);
              await onSubmit({
                name: name.trim(),
                divisionId: divisionId || null,
                uom,
                avgCents: Math.round(parseFloat(price) * 100),
                wastePercent: parseInt(wastePercent || '5', 10),
                supplier: supplier.trim() || null,
                sku: sku.trim() || null,
              });
              setSubmitting(false);
            }}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
