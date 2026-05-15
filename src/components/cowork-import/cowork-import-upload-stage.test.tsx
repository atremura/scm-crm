// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoworkImportUploadStage } from './cowork-import-upload-stage';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
const mockedToastError = vi.mocked(toast.error);

function makeJsonFile(name = 'test.json', content = '{}'): File {
  return new File([content], name, { type: 'application/json' });
}

function mockFetch(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('CoworkImportUploadStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders upload dropzone when no file selected', () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
      expect(screen.getByText(/drop a cowork json file here/i)).toBeInTheDocument();
    });

    it('disables Preview button when no file selected', () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);
      const btn = screen.getByRole('button', { name: /preview import/i });
      expect(btn).toBeDisabled();
    });

    it('renders Cancel button only when onCancel is provided', () => {
      const { rerender } = render(
        <CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />,
      );
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();

      rerender(
        <CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} onCancel={() => {}} />,
      );
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('shows selected file metadata after picking a .json file', async () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);

      const input = screen.getByTestId('file-input') as HTMLInputElement;
      const file = makeJsonFile('avalon.json', '{"hello":"world"}');

      const user = userEvent.setup();
      await user.upload(input, file);

      expect(screen.getByTestId('selected-file')).toBeInTheDocument();
      expect(screen.getByText('avalon.json')).toBeInTheDocument();
    });

    it('rejects non-.json files with toast error', async () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);

      const input = screen.getByTestId('file-input') as HTMLInputElement;
      const file = new File(['data'], 'image.png', { type: 'image/png' });

      // applyAccept: false bypasses userEvent's automatic filter on the
      // input's accept attribute, so the file reaches our client-side
      // validation (which is what this test is exercising).
      const user = userEvent.setup({ applyAccept: false });
      await user.upload(input, file);

      expect(mockedToastError).toHaveBeenCalledWith('Only .json files are accepted');
      expect(screen.queryByTestId('selected-file')).not.toBeInTheDocument();
    });

    it('rejects files > 1 MiB with toast error', async () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);

      const input = screen.getByTestId('file-input') as HTMLInputElement;
      const largeContent = 'x'.repeat(1_048_577);
      const file = new File([largeContent], 'huge.json', {
        type: 'application/json',
      });

      const user = userEvent.setup();
      await user.upload(input, file);

      expect(mockedToastError).toHaveBeenCalled();
      const callArg = mockedToastError.mock.calls[0][0];
      expect(callArg).toMatch(/too large/i);
    });

    it('clears file when X button is clicked', async () => {
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);

      const input = screen.getByTestId('file-input') as HTMLInputElement;
      const file = makeJsonFile();

      const user = userEvent.setup();
      await user.upload(input, file);
      expect(screen.getByTestId('selected-file')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Remove file'));
      expect(screen.queryByTestId('selected-file')).not.toBeInTheDocument();
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
    });
  });

  describe('upload behavior', () => {
    it('calls onUploadResult with preview_success on HTTP 200', async () => {
      mockFetch(200, {
        importId: 'imp-1',
        summary: { projectName: 'Test', totalBidPrice: 1000 },
        warnings: [],
      });

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'preview_success',
            importId: 'imp-1',
          }),
        );
      });
    });

    it('calls onUploadResult with blocker on HTTP 422 with blockers', async () => {
      mockFetch(422, {
        importId: 'imp-2',
        blockers: [{ rule: 'TENANT_SLUG_MATCH', severity: 'BLOCKER' }],
        warnings: [],
      });

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'blocker',
            importId: 'imp-2',
          }),
        );
      });
    });

    it('calls onUploadResult with conflict on HTTP 409', async () => {
      mockFetch(409, {
        existingImportId: 'imp-existing',
        existingStatus: 'previewed',
      });

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'conflict',
            existingImportId: 'imp-existing',
          }),
        );
      });
    });

    it('calls onUploadResult with zod_error on HTTP 400 with zodErrors', async () => {
      mockFetch(400, {
        zodErrors: { formErrors: ['Schema mismatch'], fieldErrors: {} },
      });

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ kind: 'zod_error' }));
      });
    });

    it('calls onUploadResult with bad_request on generic 4xx/5xx', async () => {
      mockFetch(403, { error: 'Forbidden: missing permission' });

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith({
          kind: 'bad_request',
          message: 'Forbidden: missing permission',
        });
      });
    });

    it('shows toast and does not call callback on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const onResult = vi.fn();
      render(<CoworkImportUploadStage projectId="p1" onUploadResult={onResult} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());
      await user.click(screen.getByRole('button', { name: /preview import/i }));

      await waitFor(() => {
        expect(mockedToastError).toHaveBeenCalledWith('Network error during upload');
      });
      expect(onResult).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('disables Preview button during upload', async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ) as unknown as typeof fetch;

      render(<CoworkImportUploadStage projectId="p1" onUploadResult={() => {}} />);

      const user = userEvent.setup();
      await user.upload(screen.getByTestId('file-input'), makeJsonFile());

      const btn = screen.getByRole('button', { name: /preview import/i });
      await user.click(btn);

      expect(btn).toBeDisabled();

      // Resolve the pending fetch so the test cleans up
      resolveFetch({
        status: 200,
        ok: true,
        json: async () => ({ importId: 'x', summary: {}, warnings: [] }),
      });
    });
  });
});
