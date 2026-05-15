// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoworkImportTrigger } from './cowork-import-trigger';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('CoworkImportTrigger', () => {
  it('renders the trigger button', () => {
    // Mock fetch to suppress history fetch noise when sheet eventually opens
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ imports: [] }),
    }) as unknown as typeof fetch;

    render(<CoworkImportTrigger projectId="p1" />);
    expect(screen.getByTestId('cowork-import-trigger')).toBeInTheDocument();
    expect(screen.getByText('Cowork import')).toBeInTheDocument();
  });

  it('opens the sheet when clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ imports: [] }),
    }) as unknown as typeof fetch;

    render(<CoworkImportTrigger projectId="p1" />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('cowork-import-trigger'));

    // History stage of the sheet shows the "New Cowork import" button.
    // We can't query for the title text "Cowork import" alone because
    // it also appears on the trigger button — disambiguate with role.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new cowork import/i })).toBeInTheDocument();
    });
  });
});
