'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Props = {
  estimateId: string;
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  /** Formatted total for the confirmation copy (e.g. "$3.17M"). Optional. */
  estimateTotal?: string;
};

/**
 * Trigger button + confirmation dialog for deleting an Estimate.
 *
 * On confirm:
 *  - DELETE /api/estimates/[id]
 *  - On 200: toast success, redirect to /takeoff/[projectId]
 *  - On error: toast error, stay on page (dialog can be retried)
 *
 * Used in the Estimate detail page header. Critical during Cowork
 * iteration when a faulty import needs to be wiped and re-applied.
 */
export function DeleteEstimateButton({
  estimateId,
  projectId,
  projectName,
  projectNumber,
  estimateTotal,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorText = await res.text();
        toast.error(`Failed to delete: ${errorText || res.statusText}`);
        setLoading(false);
        return;
      }
      toast.success('Estimate deleted. Project reverted to active.');
      setOpen(false);
      setTimeout(() => {
        router.push(`/takeoff/${projectId}`);
      }, 200);
    } catch {
      toast.error('Network error while deleting estimate.');
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="delete-estimate-trigger">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete estimate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the estimate for{' '}
            <strong>
              {projectNumber ? `${projectNumber} — ` : ''}
              {projectName}
            </strong>
            {estimateTotal ? ` (total: ${estimateTotal})` : ''}, plus all its estimate lines and the
            linked Cowork import history. The project will revert to status &quot;active&quot;.
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="delete-estimate-confirm"
          >
            {loading ? 'Deleting...' : 'Delete estimate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
