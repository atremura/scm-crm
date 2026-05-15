'use client';

import { useState } from 'react';
import { FileJson } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CoworkImportSheet } from './cowork-import-sheet';

type Props = {
  projectId: string;
  /**
   * Optional override for button styling. Defaults to outline variant
   * matching other Takeoff panel buttons.
   */
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default';
};

/**
 * Trigger button that opens the Cowork import sheet.
 *
 * Encapsulates the sheet's open/closed state so parents don't need to
 * manage it. Drop into any toolbar where importing makes sense.
 */
export function CoworkImportTrigger({ projectId, variant = 'outline', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        data-testid="cowork-import-trigger"
      >
        <FileJson className="mr-2 h-4 w-4" />
        Cowork import
      </Button>
      <CoworkImportSheet open={open} onOpenChange={setOpen} projectId={projectId} />
    </>
  );
}
