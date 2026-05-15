// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoworkImportHistory } from './cowork-import-history';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
const mockedToastError = vi.mocked(toast.error);

// Helpers
function makeImportRow(
  overrides?: Partial<{
    id: string;
    fileName: string;
    status: string;
    createdAt: string;
  }>,
) {
  return {
    id: 'import-1',
    fileName: 'avalon.json',
    fileHash: 'abc123',
    schemaVersion: '1.0.0',
    status: 'previewed',
    estimateId: null,
    appliedById: null,
    appliedAt: null,
    rejectedById: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: '2026-05-14T15:00:00Z',
    ...overrides,
  };
}

function mockFetch(response: { ok: boolean; data: unknown }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.data,
  }) as unknown as typeof fetch;
}

describe('CoworkImportHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator initially', () => {
    mockFetch({ ok: true, data: { imports: [] } });

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    expect(screen.getByText(/loading import history/i)).toBeInTheDocument();
  });

  it('renders empty state when no imports exist', async () => {
    mockFetch({ ok: true, data: { imports: [] } });

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/no cowork imports yet/i)).toBeInTheDocument();
    });
  });

  it('renders list of imports when API returns rows', async () => {
    mockFetch({
      ok: true,
      data: {
        imports: [
          makeImportRow({
            id: 'i1',
            fileName: 'first.json',
            status: 'previewed',
          }),
          makeImportRow({
            id: 'i2',
            fileName: 'second.json',
            status: 'applied',
          }),
        ],
      },
    });

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('first.json')).toBeInTheDocument();
    });
    expect(screen.getByText('second.json')).toBeInTheDocument();
    expect(screen.getByText('Previewed')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('calls onSelectImport with importId when row is clicked', async () => {
    const onSelect = vi.fn();
    mockFetch({
      ok: true,
      data: {
        imports: [makeImportRow({ id: 'click-me', fileName: 'click.json' })],
      },
    });

    render(<CoworkImportHistory projectId="p1" onSelectImport={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('click.json')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('click.json'));

    expect(onSelect).toHaveBeenCalledWith('click-me');
  });

  it('shows error toast when fetch fails (non-2xx)', async () => {
    mockFetch({
      ok: false,
      data: { error: 'Forbidden: missing permission' },
    });

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith('Forbidden: missing permission');
    });
  });

  it('shows generic toast on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    // Silence console.error noise from the catch
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith('Network error loading history');
    });

    errorSpy.mockRestore();
  });

  it('re-fetches when refreshKey changes', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({ imports: [] }),
      };
    }) as unknown as typeof fetch;

    const { rerender } = render(
      <CoworkImportHistory projectId="p1" onSelectImport={() => {}} refreshKey={0} />,
    );

    await waitFor(() => {
      expect(fetchCount).toBe(1);
    });

    rerender(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} refreshKey={1} />);

    await waitFor(() => {
      expect(fetchCount).toBe(2);
    });
  });

  it('renders all 4 status variants correctly', async () => {
    mockFetch({
      ok: true,
      data: {
        imports: [
          makeImportRow({ id: 'i1', fileName: 'p.json', status: 'previewed' }),
          makeImportRow({ id: 'i2', fileName: 'a.json', status: 'applied' }),
          makeImportRow({ id: 'i3', fileName: 'r.json', status: 'rejected' }),
          makeImportRow({ id: 'i4', fileName: 'f.json', status: 'failed' }),
        ],
      },
    });

    render(<CoworkImportHistory projectId="p1" onSelectImport={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Previewed')).toBeInTheDocument();
      expect(screen.getByText('Applied')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });
});
