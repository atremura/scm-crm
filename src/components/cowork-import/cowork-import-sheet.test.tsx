// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoworkImportSheet } from './cowork-import-sheet';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
const mockedToastSuccess = vi.mocked(toast.success);
const mockedToastError = vi.mocked(toast.error);

describe('CoworkImportSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty history list, suppresses noise
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ imports: [] }),
    }) as unknown as typeof fetch;
  });

  describe('open/close', () => {
    it('renders Sheet content when open=true', async () => {
      render(<CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />);
      // SheetTitle should be in the DOM
      await waitFor(() => {
        expect(screen.getByText('Cowork import')).toBeInTheDocument();
      });
    });

    it('starts in history stage', async () => {
      render(<CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new cowork import/i })).toBeInTheDocument();
      });
    });
  });

  describe('stage transitions', () => {
    it('transitions to upload stage when "New Cowork import" is clicked', async () => {
      render(<CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />);
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new cowork import/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /new cowork import/i }));

      // Upload stage shows dropzone
      await waitFor(() => {
        expect(screen.getByText(/drop a cowork json file here/i)).toBeInTheDocument();
      });
    });

    it('returns to history when upload Cancel is clicked', async () => {
      render(<CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />);
      const user = userEvent.setup();

      // Go to upload
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new cowork import/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /new cowork import/i }));

      // Click Cancel in upload stage
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      // Back to history
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new cowork import/i })).toBeInTheDocument();
      });
    });
  });

  describe('smoke + reset', () => {
    it('renders without crashing through open/close/open toggles', async () => {
      const { rerender } = render(
        <CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />,
      );

      rerender(<CoworkImportSheet open={false} onOpenChange={() => {}} projectId="p1" />);

      rerender(<CoworkImportSheet open={true} onOpenChange={() => {}} projectId="p1" />);

      await waitFor(() => {
        expect(screen.getByText('Cowork import')).toBeInTheDocument();
      });

      // Suppress unused-import warnings for mocks we keep available
      // for future expansion of this smoke test.
      void mockedToastSuccess;
      void mockedToastError;
    });
  });
});
