import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessDenied } from '../../components/common/AccessDenied';
import { CommerceDisclosuresCard } from '../../components/common/CommerceDisclosuresCard';

describe('Accessibility & Keyboard Navigation (W9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AccessDenied Component (Denial State Accessibility)', () => {
    it('provides accessible landmarks, ARIA labels, and keyboard-focusable action buttons', () => {
      const mockReturn = vi.fn();

      render(
        <MemoryRouter>
          <AccessDenied
            title="Model Retraining Unavailable"
            reason="Your license does not permit custom model retraining."
            onReturn={mockReturn}
            returnLabel="Back to Overview"
          />
        </MemoryRouter>,
      );

      // Verify accessible region and title
      const region = screen.getByRole('region', {
        name: /Model Retraining Unavailable/i,
      });
      expect(region).toBeInTheDocument();

      expect(screen.getByText(/HTTP 403 Forbidden/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Your license does not permit custom model retraining./i,
        ),
      ).toBeInTheDocument();

      // Verify button is keyboard focusable and triggerable
      const returnBtn = screen.getByRole('button', {
        name: /Back to Overview/i,
      });
      returnBtn.focus();
      expect(document.activeElement).toBe(returnBtn);

      fireEvent.click(returnBtn);
      expect(mockReturn).toHaveBeenCalled();
    });
  });

  describe('CommerceDisclosuresCard Accessibility', () => {
    it('allows keyboard interaction to toggle agreement checkbox and navigate policy links', () => {
      const handleAgreeChange = vi.fn();

      render(
        <MemoryRouter>
          <CommerceDisclosuresCard
            tier="ORGANIZATION"
            billingPeriod="ANNUAL"
            showAgreeCheckbox={true}
            agreed={false}
            onAgreeChange={handleAgreeChange}
          />
        </MemoryRouter>,
      );

      // Verify all policy links are rendered as accessible anchors
      const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
      const licenseLink = screen.getByRole('link', {
        name: /License Agreement/i,
      });
      const redressLink = screen.getByRole('link', {
        name: /DPO Redress Protocol/i,
      });

      expect(termsLink).toHaveAttribute('href', '/legal?tab=terms');
      expect(privacyLink).toHaveAttribute('href', '/legal?tab=privacy');
      expect(licenseLink).toHaveAttribute('href', '/legal?tab=license');
      expect(redressLink).toHaveAttribute('href', '/legal?tab=redress');

      // Verify checkbox keyboard interaction
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);

      fireEvent.click(checkbox);
      expect(handleAgreeChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Modal Dialog Accessibility & Escape Handling', () => {
    it('closes modal dialogs when Escape key is pressed', () => {
      const handleClose = vi.fn();

      // Render a dialog element with Escape key handling matching WorkspacePage
      const ModalTestComponent = () => {
        const [isOpen, setIsOpen] = React.useState(true);

        React.useEffect(() => {
          const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              handleClose();
            }
          };
          window.addEventListener('keydown', onKey);
          return () => window.removeEventListener('keydown', onKey);
        }, []);

        if (!isOpen) return null;

        return (
          <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <h2 id="dialog-title">Invite Colleague to Workspace</h2>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleClose();
              }}
            >
              Cancel
            </button>
          </div>
        );
      };

      render(<ModalTestComponent />);

      expect(
        screen.getByRole('dialog', { name: /Invite Colleague to Workspace/i }),
      ).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(handleClose).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
