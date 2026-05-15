// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CoworkImportPreviewStage,
  type PreviewSummary,
  type IntegrityFlag,
} from './cowork-import-preview-stage';

function makeSummary(overrides?: Partial<PreviewSummary>): PreviewSummary {
  return {
    projectName: 'Avalon Kanso',
    estimateType: 'Siding',
    scopeItemsCount: 17,
    takeoffItemsCount: 18,
    materialsCount: 16,
    laborProductivityCount: 13,
    scenariosCount: 3,
    recommendedScenarioCode: 'C_HYBRID',
    totalBidPrice: 2327465,
    ...overrides,
  };
}

function makeFlag(overrides?: Partial<IntegrityFlag>): IntegrityFlag {
  return {
    rule: 'MATERIAL_COVERAGE',
    severity: 'REVIEW',
    message: 'Some materials are missing for service code S-01',
    ...overrides,
  };
}

describe('CoworkImportPreviewStage', () => {
  describe('status rendering', () => {
    it('shows "Ready to apply" badge for status=previewed', () => {
      render(
        <CoworkImportPreviewStage
          fileName="avalon.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText('Ready to apply')).toBeInTheDocument();
      expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
    });

    it('shows "Blocked" badge for status=failed', () => {
      render(
        <CoworkImportPreviewStage
          fileName="avalon.json"
          status="failed"
          warnings={[]}
          blockers={[makeFlag({ severity: 'BLOCKER' })]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText('Blocked')).toBeInTheDocument();
      expect(screen.queryByText('Ready to apply')).not.toBeInTheDocument();
    });

    it('renders the file name in header', () => {
      render(
        <CoworkImportPreviewStage
          fileName="my-special-import.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText('my-special-import.json')).toBeInTheDocument();
    });
  });

  describe('summary card', () => {
    it('renders summary card with project name + bid price when summary provided', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary({
            projectName: 'Test Project',
            totalBidPrice: 1500000,
          })}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByTestId('preview-summary')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      // formatted as $1,500,000 (no decimals)
      expect(screen.getByText('$1,500,000')).toBeInTheDocument();
    });

    it('hides summary card when summary is not provided', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="failed"
          warnings={[]}
          blockers={[makeFlag({ severity: 'BLOCKER' })]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByTestId('preview-summary')).not.toBeInTheDocument();
    });

    it('renders all summary stats (scope, takeoff, materials, etc)', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText('Scope items')).toBeInTheDocument();
      expect(screen.getByText('Takeoffs')).toBeInTheDocument();
      expect(screen.getByText('Materials')).toBeInTheDocument();
      // values from makeSummary defaults
      expect(screen.getByText('17')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
    });
  });

  describe('warnings and blockers', () => {
    it('renders warnings section when warnings present', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[
            makeFlag({ severity: 'REVIEW', message: 'Check this' }),
            makeFlag({ severity: 'INFO', message: 'FYI this' }),
          ]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByTestId('preview-warnings')).toBeInTheDocument();
      expect(screen.getByText('Warnings (2)')).toBeInTheDocument();
      expect(screen.getByText('Check this')).toBeInTheDocument();
      expect(screen.getByText('FYI this')).toBeInTheDocument();
    });

    it('renders blockers section when blockers present', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="failed"
          warnings={[]}
          blockers={[makeFlag({ severity: 'BLOCKER', message: 'Tenant slug mismatch' })]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByTestId('preview-blockers')).toBeInTheDocument();
      expect(screen.getByText('Blockers (1)')).toBeInTheDocument();
      expect(screen.getByText('Tenant slug mismatch')).toBeInTheDocument();
    });

    it('shows healthy state message when no warnings AND status=previewed', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText(/no warnings or blockers/i)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('Apply button calls onApplyRequested on click', async () => {
      const onApply = vi.fn();
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={onApply}
          onRejectRequested={() => {}}
        />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByTestId('apply-button'));
      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('Reject button calls onRejectRequested on click', async () => {
      const onReject = vi.fn();
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={onReject}
        />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /reject/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('hides Apply button when status=failed', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="failed"
          warnings={[]}
          blockers={[makeFlag({ severity: 'BLOCKER' })]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
      // But Reject is still there
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('renders Back button only when onBack provided', () => {
      const { rerender } = render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();

      rerender(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
          onBack={() => {}}
        />,
      );
      expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    });

    it('isApplying disables Apply + Reject buttons', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
          isApplying={true}
        />,
      );
      expect(screen.getByTestId('apply-button')).toBeDisabled();
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled();
    });
  });

  describe('detail tabs', () => {
    const FAKE_PAYLOAD = {
      scope_items: [
        {
          service_code: 'S-01',
          description: 'Test scope item',
          type: 'M+L',
          status: 'ACTIVE',
        },
      ],
      takeoff_items: [
        {
          takeoff_id: 'TK-S01-A',
          service_code: 'S-01',
          quantity: 100,
          unit: 'SF',
          waste_pct: 0.1,
        },
      ],
      materials: [
        {
          material_id: 'M-S01',
          service_code: 'S-01',
          description: 'Vinyl siding',
          qty: 110,
          unit: 'SF',
          unit_cost: 5.5,
          total: 605,
        },
      ],
      labor_productivity: [
        {
          service_code: 'S-01',
          activity: 'Install siding',
          mh_per_unit: 0.05,
          total_mh: 5,
          crew_size: 2,
        },
      ],
      labor_rates: [{ trade_code: 'CARPENTER', base_hr: 45, billed_hr: 75 }],
      scenarios: [
        {
          scenario_code: 'A',
          label: 'Conservative',
          total_bid: 100000,
          markups: { profit_pct: 0.1, overhead_pct: 0.08 },
        },
      ],
    };

    it('does NOT render tabs when payload is not provided', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByTestId('preview-tabs')).not.toBeInTheDocument();
    });

    it('renders tabs when payload provided', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          payload={FAKE_PAYLOAD}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByTestId('preview-tabs')).toBeInTheDocument();
    });

    it('shows correct count in each tab label', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[makeFlag()]}
          payload={FAKE_PAYLOAD}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByRole('tab', { name: /scope.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /takeoffs.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /materials.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /scenarios.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /issues.*1/i })).toBeInTheDocument();
    });

    it('renders scope items in the default Scope tab', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          payload={FAKE_PAYLOAD}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      // First tab is Scope by default
      expect(screen.getByText('S-01')).toBeInTheDocument();
      expect(screen.getByText('Test scope item')).toBeInTheDocument();
    });

    it('switches to Takeoffs tab on click', async () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          payload={FAKE_PAYLOAD}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: /takeoffs/i }));

      // After switching tabs, takeoff ID should be visible
      expect(screen.getByText('TK-S01-A')).toBeInTheDocument();
    });

    it('shows empty state in tab when array is empty', async () => {
      const emptyPayload = {
        ...FAKE_PAYLOAD,
        scope_items: [],
      };

      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[]}
          payload={emptyPayload}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );

      expect(screen.getByText(/no scope items/i)).toBeInTheDocument();
    });

    it('hides inline warnings section when payload is provided (uses tab instead)', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="previewed"
          summary={makeSummary()}
          warnings={[makeFlag()]}
          payload={FAKE_PAYLOAD}
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      // No inline warnings section
      expect(screen.queryByTestId('preview-warnings')).not.toBeInTheDocument();
      // But Issues tab counter shows the warning
      expect(screen.getByRole('tab', { name: /issues.*1/i })).toBeInTheDocument();
    });
  });

  describe('read-only statuses (applied/rejected)', () => {
    it('renders Applied badge for status=applied', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="applied"
          summary={makeSummary()}
          warnings={[]}
          appliedAt="2026-05-14T18:30:00Z"
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      // "Applied" appears in both the badge and the audit-info text.
      // The badge is the only one inside the header (data-testid=preview-header).
      const header = screen.getByTestId('preview-header');
      expect(header).toHaveTextContent('Applied');
    });

    it('renders audit info with formatted date for status=applied', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="applied"
          summary={makeSummary()}
          warnings={[]}
          appliedAt="2026-05-14T18:30:00Z"
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      const auditInfo = screen.getByTestId('audit-info');
      expect(auditInfo).toHaveTextContent(/applied on/i);
      // Formatted output is locale-dependent but should contain
      // recognizable month name or year
      expect(auditInfo).toHaveTextContent(/may|2026/i);
    });

    it('renders rejection reason for status=rejected', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="rejected"
          warnings={[]}
          rejectionReason="Customer wants different scenario"
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Customer wants different scenario')).toBeInTheDocument();
    });

    it('hides Apply and Reject buttons for status=applied', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="applied"
          summary={makeSummary()}
          warnings={[]}
          appliedAt="2026-05-14T18:30:00Z"
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
    });

    it('hides Apply and Reject buttons for status=rejected', () => {
      render(
        <CoworkImportPreviewStage
          fileName="x.json"
          status="rejected"
          warnings={[]}
          rejectionReason="Test reason"
          onApplyRequested={() => {}}
          onRejectRequested={() => {}}
        />,
      );
      expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
    });
  });
});
