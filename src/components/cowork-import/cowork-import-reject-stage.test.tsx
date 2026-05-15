// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoworkImportRejectStage } from './cowork-import-reject-stage';

describe('CoworkImportRejectStage', () => {
  describe('initial render', () => {
    it('renders file name in the banner', () => {
      render(
        <CoworkImportRejectStage fileName="avalon.json" onConfirm={() => {}} onBack={() => {}} />,
      );
      expect(screen.getByText('avalon.json')).toBeInTheDocument();
    });

    it('renders empty textarea', () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      const ta = screen.getByTestId('rejection-reason-textarea') as HTMLTextAreaElement;
      expect(ta.value).toBe('');
    });

    it('disables Confirm button when reason is empty', () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      expect(screen.getByTestId('confirm-reject-button')).toBeDisabled();
    });
  });

  describe('validation', () => {
    it('keeps Confirm disabled while reason is less than 10 chars', async () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('rejection-reason-textarea'), 'too short');
      expect(screen.getByTestId('confirm-reject-button')).toBeDisabled();
    });

    it('enables Confirm at exactly 10 chars', async () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('rejection-reason-textarea'), '1234567890');
      expect(screen.getByTestId('confirm-reject-button')).not.toBeDisabled();
    });

    it('treats whitespace-only as invalid', async () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('rejection-reason-textarea'), '             ');
      expect(screen.getByTestId('confirm-reject-button')).toBeDisabled();
    });

    it('shows remaining-chars hint when reason is non-empty but invalid', async () => {
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('rejection-reason-textarea'), 'short');
      // 10 - 5 = 5 more needed
      expect(screen.getByText(/5 more characters needed/i)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('calls onConfirm with TRIMMED reason on Confirm click', async () => {
      const onConfirm = vi.fn();
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={onConfirm} onBack={() => {}} />);
      const user = userEvent.setup();
      await user.type(
        screen.getByTestId('rejection-reason-textarea'),
        '  Customer wants different scenario  ',
      );
      await user.click(screen.getByTestId('confirm-reject-button'));
      expect(onConfirm).toHaveBeenCalledWith('Customer wants different scenario');
    });

    it('calls onBack on Back button click', async () => {
      const onBack = vi.fn();
      render(<CoworkImportRejectStage fileName="x.json" onConfirm={() => {}} onBack={onBack} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^back$/i }));
      expect(onBack).toHaveBeenCalled();
    });

    it('disables textarea and buttons when isSubmitting', () => {
      render(
        <CoworkImportRejectStage
          fileName="x.json"
          onConfirm={() => {}}
          onBack={() => {}}
          isSubmitting={true}
        />,
      );
      expect(screen.getByTestId('rejection-reason-textarea')).toBeDisabled();
      expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled();
      expect(screen.getByTestId('confirm-reject-button')).toBeDisabled();
    });
  });
});
