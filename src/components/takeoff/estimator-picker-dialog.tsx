'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UserLite = { id: string; name: string; email: string; role?: { name: string } };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  /** Preselect this user id when the dialog opens. */
  initialEstimatorId?: string | null;
  /** Is an unassigned option ok? Defaults to false (required). */
  allowUnassigned?: boolean;
  /** Label on the primary button. */
  confirmLabel: string;
  /** Called with the chosen estimatorId (or null if unassigned was picked). */
  onConfirm: (estimatorId: string | null) => Promise<void> | void;
};

/**
 * Dialog for picking an estimator (or any company user) before an action.
 * Used by "Start Takeoff" on a Bid and by "Assign estimator" on a Project.
 */
export function EstimatorPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  initialEstimatorId,
  allowUnassigned = false,
  confirmLabel,
  onConfirm,
}: Props) {
  const [users, setUsers] = useState<UserLite[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const SENTINEL_UNASSIGNED = '__none__';

  useEffect(() => {
    if (!open) return;
    setUsers(null);
    fetch('/api/users?status=active')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, [open]);

  useEffect(() => {
    if (open) {
      setSelectedId(initialEstimatorId ?? '');
    }
  }, [open, initialEstimatorId]);

  async function handleConfirm() {
    if (!selectedId && !allowUnassigned) return;
    setSubmitting(true);
    try {
      const estimatorId =
        selectedId === SENTINEL_UNASSIGNED || selectedId === '' ? null : selectedId;
      await onConfirm(estimatorId);
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = allowUnassigned || (!!selectedId && selectedId !== SENTINEL_UNASSIGNED);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="estimator-select">Estimator</Label>
          {users === null ? (
            <div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…
            </div>
          ) : users.length === 0 ? (
            <p className="text-[12.5px] text-fg-muted">
              No active users to assign. Add users under Users &amp; Roles first.
            </p>
          ) : (
            <Select
              value={selectedId || SENTINEL_UNASSIGNED}
              onValueChange={setSelectedId}
              disabled={submitting}
            >
              <SelectTrigger id="estimator-select">
                <SelectValue placeholder="Choose an estimator" />
              </SelectTrigger>
              <SelectContent>
                {allowUnassigned && (
                  <SelectItem value={SENTINEL_UNASSIGNED}>(unassigned)</SelectItem>
                )}
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.role?.name ? ` · ${u.role.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
