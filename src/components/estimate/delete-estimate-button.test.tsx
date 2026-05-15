// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { DeleteEstimateButton } from './delete-estimate-button';
import { toast } from 'sonner';

const mockedToastSuccess = vi.mocked(toast.success);
const mockedToastError = vi.mocked(toast.error);

describe('DeleteEstimateButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it('renders the trigger button', () => {
    render(
      <DeleteEstimateButton
        estimateId="est-1"
        projectId="proj-1"
        projectName="Linden Chambers"
        projectNumber="2026-0001"
      />,
    );
    expect(screen.getByTestId('delete-estimate-trigger')).toBeInTheDocument();
    expect(screen.getByText('Delete estimate')).toBeInTheDocument();
  });

  it('opens AlertDialog with project name + total on trigger click', async () => {
    render(
      <DeleteEstimateButton
        estimateId="est-1"
        projectId="proj-1"
        projectName="Linden Chambers"
        projectNumber="2026-0001"
        estimateTotal="$3.17M"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId('delete-estimate-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Delete this estimate?')).toBeInTheDocument();
    });
    // Description contains projectNumber + name + total
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('2026-0001');
    expect(dialog).toHaveTextContent('Linden Chambers');
    expect(dialog).toHaveTextContent('$3.17M');
  });

  it('on confirm: calls DELETE, shows success toast, redirects to /takeoff/[projectId]', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, projectId: 'proj-1' }),
    }) as unknown as typeof fetch;

    render(
      <DeleteEstimateButton
        estimateId="est-1"
        projectId="proj-1"
        projectName="Linden Chambers"
        projectNumber="2026-0001"
      />,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByTestId('delete-estimate-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-estimate-confirm')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-estimate-confirm'));

    // Fetch called with correct URL + method
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/estimates/est-1', {
        method: 'DELETE',
      });
    });

    // Toast success
    await waitFor(() => {
      expect(mockedToastSuccess).toHaveBeenCalledWith(
        'Estimate deleted. Project reverted to active.',
      );
    });

    // Advance the 200ms setTimeout, then check redirect
    vi.advanceTimersByTime(250);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/takeoff/proj-1');
    });

    vi.useRealTimers();
  });

  it('shows error toast when DELETE fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    }) as unknown as typeof fetch;

    render(
      <DeleteEstimateButton
        estimateId="est-1"
        projectId="proj-1"
        projectName="Linden Chambers"
        projectNumber="2026-0001"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId('delete-estimate-trigger'));
    await user.click(screen.getByTestId('delete-estimate-confirm'));

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalled();
    });
    // No redirect on failure
    expect(mockPush).not.toHaveBeenCalled();
  });
});
