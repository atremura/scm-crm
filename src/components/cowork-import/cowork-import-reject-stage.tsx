'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  /**
   * Visible name of the file being rejected (shown for context).
   */
  fileName: string;
  /**
   * Called when user confirms rejection. Parent does the POST /reject
   * call. Reason is already trimmed and validated.
   */
  onConfirm: (rejectionReason: string) => void | Promise<void>;
  /**
   * Called when user clicks Back to return to preview stage.
   */
  onBack: () => void;
  /**
   * True while parent is processing — disables form and buttons.
   */
  isSubmitting?: boolean;
};

const MIN_REASON_LENGTH = 10;

export function CoworkImportRejectStage({
  fileName,
  onConfirm,
  onBack,
  isSubmitting = false,
}: Props) {
  const [reason, setReason] = useState('');

  const trimmedLength = reason.trim().length;
  const isValid = trimmedLength >= MIN_REASON_LENGTH;
  const remaining = Math.max(0, MIN_REASON_LENGTH - trimmedLength);

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(reason.trim());
  }

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3"
        data-testid="reject-banner"
      >
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Reject this import?</p>
          <p className="text-xs text-muted-foreground">
            Marks <span className="font-mono">{fileName}</span> as rejected with the reason below.
            Recorded for audit. Cannot be undone.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rejection-reason">
          Rejection reason
          <span className="text-muted-foreground font-normal">
            {' '}
            · minimum {MIN_REASON_LENGTH} characters
          </span>
        </Label>
        <Textarea
          id="rejection-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Why is this import being rejected? E.g. wrong scenario, outdated estimate, customer changed scope..."
          disabled={isSubmitting}
          data-testid="rejection-reason-textarea"
        />
        {!isValid && trimmedLength > 0 && (
          <p className="text-xs text-muted-foreground">
            {remaining} more character{remaining === 1 ? '' : 's'} needed.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={!isValid || isSubmitting}
          data-testid="confirm-reject-button"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm reject
        </Button>
      </div>
    </div>
  );
}
