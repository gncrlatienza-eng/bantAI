import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivationPage } from '../../pages/account/ActivationPage';
import * as context from '../../context/AccountStateContext';
import * as account from '../../services/accountService';
import * as auth from '../../services/authService';

const application = {
  id: 'req-test',
  status: 'approved',
  currentAgreementVersion: '2026-09',
  organization: 'QA',
  scope: {
    name: 'Shield',
    purpose: 'QA',
    dataset: 'Patterns',
    users: '10',
    exports: 'Reviewed',
    api: 'Gated',
    redistribution: 'No',
    reidentification: 'No',
    term: 'Subscription',
  },
  pricing: {
    confirmed: true,
    annual: { display: 'PHP 1,200/year' },
    monthly: { display: 'PHP 100/month' },
  },
};
function mount(status = 'approved', confirmed = true, url = '/activation') {
  const refresh = vi.fn().mockResolvedValue(null);
  vi.spyOn(context, 'useAccountState').mockReturnValue({
    status: 'ready',
    state: {
      routeGroups: ['activation'],
      application: {
        ...application,
        status,
        pricing: { ...application.pricing, confirmed },
      },
    } as account.AccountState,
    ensure: vi.fn(),
    refresh,
    clear: vi.fn(),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <ActivationPage />
    </MemoryRouter>,
  );
  return refresh;
}
describe('Signed-in activation (server payment verification remains authoritative)', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('blocks acceptance until explicit agreement', async () => {
    const accept = vi
      .spyOn(account, 'acceptApplicationAgreement')
      .mockResolvedValue({} as never);
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: 'Accept and continue to payment' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Confirm that you accept',
    );
    expect(accept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Accept and continue to payment' }),
    );
    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith('req-test', '2026-09'),
    );
  });
  it('blocks terms when Stripe prices are unconfirmed', () => {
    const accept = vi.spyOn(account, 'acceptApplicationAgreement');
    mount('approved', false);
    expect(
      screen.getByRole('button', { name: 'Accept and continue to payment' }),
    ).toBeDisabled();
    expect(accept).not.toHaveBeenCalled();
  });
  it('sends the selected billing period to the authenticated checkout API', async () => {
    const checkout = vi
      .spyOn(account, 'startApplicationCheckout')
      .mockResolvedValue({ status: 'pending' } as never);
    mount('agreement_accepted');
    fireEvent.click(screen.getByRole('radio', { name: /Monthly/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to secure payment' }),
    );
    await waitFor(() =>
      expect(checkout).toHaveBeenCalledWith('req-test', 'MONTHLY'),
    );
  });
  it('shows confirmation and asks the server to verify a returned session', async () => {
    const reconcile = vi
      .spyOn(auth, 'reconcileTestCheckout')
      .mockResolvedValue({ status: 'pending' });
    const checkout = vi.spyOn(account, 'startApplicationCheckout');
    mount(
      'agreement_accepted',
      true,
      '/activation?checkout=success&session_id=cs_test',
    );
    expect(screen.getByText('Confirming your payment')).toBeInTheDocument();
    await waitFor(() => expect(reconcile).toHaveBeenCalledWith('cs_test'));
    expect(checkout).not.toHaveBeenCalled();
  });
});
