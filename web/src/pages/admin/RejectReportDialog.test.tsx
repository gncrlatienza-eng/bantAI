import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RejectReportDialog } from './RejectReportDialog';

function renderDialog(count = 1) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <RejectReportDialog
      open
      count={count}
      busy={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onCancel };
}

describe('RejectReportDialog', () => {
  it('requires a choice before rejecting', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
  });

  it('sends Ham for "Real message"', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: /Real message/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onConfirm).toHaveBeenCalledWith('Ham');
  });

  it('sends Spam for "Spam"', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: /^Spam/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onConfirm).toHaveBeenCalledWith('Spam');
  });

  it('names the count when rejecting a group', () => {
    renderDialog(3);
    expect(
      screen.getByRole('dialog', { name: 'Reject 3 reports' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject 3' })).toBeDisabled();
  });

  it('cancels without rejecting', async () => {
    const { onConfirm, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
