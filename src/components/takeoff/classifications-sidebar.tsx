'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  Check,
  X,
  Ruler,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  VALID_CLASSIFICATION_TYPES,
  VALID_UOM,
  VALID_CLASSIFICATION_SCOPES,
  CLASSIFICATION_SCOPE_LABELS,
  CLASSIFICATION_SCOPE_BADGE,
  DEFAULT_UOM_BY_TYPE,
  type ClassificationType,
  type ClassificationScope,
  type Uom,
} from '@/lib/takeoff-utils';

export type ClassificationRow = {
  id: string;
  name: string;
  type: string;
  uom: string;
  scope: string;
  quantity: number | string;
  unitCost: number | string | null;
  color: string | null;
  note: string | null;
  externalId: string | null;
  template?: { id: string; name: string } | null;
};

const TYPE_COLORS: Record<ClassificationType, string> = {
  area: 'bg-blue-500',
  linear: 'bg-success-500',
  count: 'bg-warn-500',
};

type Props = {
  projectId: string;
  /** Optional callback when classifications change, so the parent can refresh counts. */
  onChange?: () => void;
};

export function ClassificationsSidebar({ projectId, onChange }: Props) {
  const [rows, setRows] = useState<ClassificationRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ClassificationRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ClassificationRow | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/classifications`);
    if (res.ok) {
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } else {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.externalId?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const t = { area: 0, linear: 0, count: 0, cost: 0 };
    if (!rows) return t;
    for (const r of rows) {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unitCost) || 0;
      if (r.type in t) t[r.type as ClassificationType] += q;
      t.cost += q * c;
    }
    return t;
  }, [rows]);

  async function afterMutation() {
    await load();
    onChange?.();
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Ruler className="h-4 w-4 text-fg-muted" />
        <div className="flex-1 text-[13px] font-semibold text-fg-default">
          Classifications
          {rows !== null && (
            <span className="ml-1.5 text-[11.5px] font-normal text-fg-subtle">
              ({rows.length})
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code"
            className="h-8 pl-7 text-[12.5px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered === null ? (
          <div className="flex items-center justify-center py-8 text-fg-subtle">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            <span className="text-[12px]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} hasSearch={!!search} />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <ClassificationRowItem
                key={r.id}
                row={r}
                onEdit={() => setEditRow(r)}
                onDelete={() => setDeleteRow(r)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      {rows && rows.length > 0 && (
        <div className="border-t border-border bg-sunken/40 px-3 py-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            Totals
          </div>
          <div className="space-y-0.5 text-[11.5px]">
            {totals.area > 0 && <TotalRow label="Area" value={totals.area} uom="SF" />}
            {totals.linear > 0 && <TotalRow label="Linear" value={totals.linear} uom="LF" />}
            {totals.count > 0 && <TotalRow label="Count" value={totals.count} uom="EA" />}
            {totals.cost > 0 && (
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
                <span className="font-semibold text-fg-default">Est. value</span>
                <span className="font-mono font-semibold text-fg-default">
                  ${totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create */}
      <ClassificationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projectId={projectId}
        onSaved={async () => {
          setCreateOpen(false);
          await afterMutation();
        }}
      />

      {/* Edit */}
      <ClassificationDialog
        open={!!editRow}
        onOpenChange={(v) => !v && setEditRow(null)}
        mode="edit"
        projectId={projectId}
        existing={editRow ?? undefined}
        onSaved={async () => {
          setEditRow(null);
          await afterMutation();
        }}
      />

      {/* Delete */}
      <DeleteDialog
        row={deleteRow}
        projectId={projectId}
        onClose={() => setDeleteRow(null)}
        onDeleted={async () => {
          setDeleteRow(null);
          await afterMutation();
        }}
      />
    </aside>
  );
}

function ClassificationRowItem({
  row,
  onEdit,
  onDelete,
}: {
  row: ClassificationRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const qty = Number(row.quantity) || 0;
  const dot = TYPE_COLORS[row.type as ClassificationType] ?? 'bg-ink-300';

  return (
    <li
      className="group flex items-start gap-2 px-3 py-2.5 text-[12.5px] hover:bg-sunken/50"
      onMouseLeave={() => setMenuOpen(false)}
    >
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={row.color ? { backgroundColor: row.color } : undefined}
        aria-hidden
      >
        {!row.color && <span className={`block h-full w-full rounded-full ${dot}`} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="min-w-0 flex-1 text-left font-semibold text-fg-default hover:text-blue-400"
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate">{row.name}</span>
              <ScopeBadge scope={row.scope} />
            </div>
            {row.externalId && (
              <div className="truncate text-[10.5px] font-normal text-fg-subtle">
                {row.externalId}
              </div>
            )}
          </button>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[12px] font-semibold text-fg-default">
              {qty.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {row.uom}
            </div>
          </div>
        </div>
        {row.note && (
          <div className="mt-0.5 truncate text-[11px] text-fg-muted">{row.note}</div>
        )}
      </div>
      <div className="relative shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Row menu"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-10 w-36 rounded-md border border-border bg-surface shadow-md">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-sunken"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-danger-500 hover:bg-danger-500/10"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const s = scope as ClassificationScope;
  const label = CLASSIFICATION_SCOPE_BADGE[s] ?? '?';
  const full = CLASSIFICATION_SCOPE_LABELS[s] ?? scope;
  const color =
    s === 'service'
      ? 'bg-warn-500/15 text-warn-500'
      : 'bg-blue-500/15 text-blue-400';
  return (
    <span
      title={full}
      className={`shrink-0 rounded px-1.5 py-[1px] font-mono text-[9.5px] font-bold ${color}`}
    >
      {label}
    </span>
  );
}

function TotalRow({ label, value, uom }: { label: string; value: number; uom: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono text-fg-default">
        {value.toLocaleString(undefined, { maximumFractionDigits: 3 })}{' '}
        <span className="text-[10px] text-fg-subtle">{uom}</span>
      </span>
    </div>
  );
}

function EmptyState({
  onCreate,
  hasSearch,
}: {
  onCreate: () => void;
  hasSearch: boolean;
}) {
  if (hasSearch) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-fg-subtle">
        No match.
      </div>
    );
  }
  return (
    <div className="px-4 py-8 text-center">
      <Ruler className="mx-auto h-6 w-6 text-fg-subtle" />
      <p className="mt-2 text-[12px] text-fg-muted">
        No classifications yet.
      </p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" />
        Add one
      </Button>
    </div>
  );
}

// ============================================================
// Create / edit dialog
// ============================================================

function ClassificationDialog({
  open,
  onOpenChange,
  mode,
  projectId,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  projectId: string;
  existing?: ClassificationRow;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [uom, setUom] = useState<Uom>('SF');
  const [scope, setScope] = useState<ClassificationScope>('service_and_material');
  const [quantity, setQuantity] = useState('0');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && existing) {
      setName(existing.name);
      setExternalId(existing.externalId ?? '');
      setUom((existing.uom as Uom) ?? 'SF');
      setScope((existing.scope as ClassificationScope) ?? 'service_and_material');
      setQuantity(String(existing.quantity ?? 0));
      setUnitCost(existing.unitCost !== null && existing.unitCost !== undefined
        ? String(existing.unitCost)
        : '');
      setNote(existing.note ?? '');
    } else if (mode === 'create') {
      setName('');
      setExternalId('');
      setUom('SF');
      setScope('service_and_material');
      setQuantity('0');
      setUnitCost('');
      setNote('');
    }
  }, [open, mode, existing]);

  async function save() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const qn = Number(quantity);
    if (Number.isNaN(qn) || qn < 0) {
      toast.error('Quantity must be a non-negative number');
      return;
    }
    const cn = unitCost.trim() === '' ? null : Number(unitCost);
    if (cn !== null && (Number.isNaN(cn) || cn < 0)) {
      toast.error('Unit cost must be a non-negative number');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        externalId: externalId.trim() || null,
        uom,
        scope,
        quantity: qn,
        unitCost: cn,
        note: note.trim() || null,
      };
      const url =
        mode === 'create'
          ? `/api/projects/${projectId}/classifications`
          : `/api/projects/${projectId}/classifications/${existing!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to save');
        setSaving(false);
        return;
      }
      toast.success(mode === 'create' ? 'Classification added' : 'Classification updated');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New classification' : 'Edit classification'}
          </DialogTitle>
          <DialogDescription>
            Define a material or service line item for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-[13px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cls-name">Name</Label>
            <Input
              id="cls-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Doors unit, Baseboard, Siding"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cls-extid">ID / code (optional)</Label>
              <Input
                id="cls-extid"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="e.g. EL02A"
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cls-uom">UOM</Label>
              <Select
                value={uom}
                onValueChange={(v) => setUom(v as Uom)}
                disabled={saving}
              >
                <SelectTrigger id="cls-uom">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_UOM.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cls-scope">Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as ClassificationScope)}
              disabled={saving}
            >
              <SelectTrigger id="cls-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_CLASSIFICATION_SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CLASSIFICATION_SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-fg-subtle">
              Tells the Estimate module whether to price labor only or labor +
              materials when this item goes to a proposal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cls-qty">Quantity</Label>
              <Input
                id="cls-qty"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cls-cost">Unit cost ($) — optional</Label>
              <Input
                id="cls-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="e.g. 3.25"
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cls-note">Note (optional)</Label>
            <Input
              id="cls-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                {mode === 'create' ? 'Create' : 'Save'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  row,
  projectId,
  onClose,
  onDeleted,
}: {
  row: ClassificationRow | null;
  projectId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!row) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/classifications/${row.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to delete');
        return;
      }
      toast.success('Classification deleted');
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete classification</DialogTitle>
          <DialogDescription>
            Remove <b>{row?.name}</b> from this project. This won&apos;t affect the
            library template (if it came from one) or other projects.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
