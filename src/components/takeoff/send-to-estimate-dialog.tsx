'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
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
  projectId: string;
  /** The project's current estimator — gets preselected as receiver since
   * for small teams, the same person handles both takeoff and proposal. */
  currentEstimatorId?: string | null;
  /** Current logged-in user's id, so we can show a hint if they're sending
   * it to themselves. */
  currentUserId?: string | null;
  onSent: () => void;
};

export function SendToEstimateDialog({
  open,
  onOpenChange,
  projectId,
  currentEstimatorId,
  currentUserId,
  onSent,
}: Props) {
  const [users, setUsers] = useState<UserLite[] | null>(null);
  const [receiverId, setReceiverId] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote('');
    setReceiverId(currentEstimatorId ?? currentUserId ?? '');
    fetch('/api/users?status=active')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, [open, currentEstimatorId, currentUserId]);

  const selfAssigned = receiverId && receiverId === currentUserId;

  async function send() {
    if (!receiverId) {
      toast.error('Choose a receiver');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/send-to-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to send');
        return;
      }
      toast.success('Project sent to Estimate');
      onSent();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to Estimate</DialogTitle>
          <DialogDescription>
            Hand this project off to whoever builds the proposal. They&apos;ll
            receive it with all classifications, quantities, and scope flags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-[13px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receiver">Receiver</Label>
            {users === null ? (
              <div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…
              </div>
            ) : (
              <Select
                value={receiverId}
                onValueChange={setReceiverId}
                disabled={submitting}
              >
                <SelectTrigger id="receiver">
                  <SelectValue placeholder="Choose who builds the proposal" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                      {u.role?.name ? ` · ${u.role.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selfAssigned && (
              <p className="text-[11.5px] text-fg-subtle">
                You&apos;re sending this to yourself. That&apos;s fine — common in
                smaller teams. The Estimate module will pick it up for you.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Handoff note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Client wants 3 options — base, mid, premium. Deadline Monday."
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={send} disabled={!receiverId || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
