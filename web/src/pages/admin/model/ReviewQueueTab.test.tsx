import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewQueueTab } from './ReviewQueueTab';
import * as datasets from '../../../services/datasetsService';

vi.mock('../../../services/datasetsService', async (original) => ({
  ...(await original<typeof datasets>()),
  getReviewQueue: vi.fn(),
  confirmReviewCandidate: vi.fn(),
  skipReviewCandidate: vi.fn(),
}));

const candidate = (id: string): datasets.ReviewCandidate => ({
  messageId: id,
  kind: 'detected',
  maskedText: `Reply with your <OTP> ${id}`,
  label: 'Scam',
  score: 0.97,
  bucket: 'blocked',
  clusterId: null,
  receivedAt: '2026-10-15T01:00:00.000Z',
});

describe('ReviewQueueTab', () => {
  beforeEach(() => {
    vi.mocked(datasets.getReviewQueue).mockReset();
    vi.mocked(datasets.confirmReviewCandidate).mockReset();
    vi.mocked(datasets.skipReviewCandidate).mockReset();
  });

  it('loads detected scams first and shows the model verdict', async () => {
    vi.mocked(datasets.getReviewQueue).mockResolvedValue([candidate('m1')]);
    render(<ReviewQueueTab />);
    expect(await screen.findByText('97% confidence')).toBeInTheDocument();
    expect(datasets.getReviewQueue).toHaveBeenCalledWith('detected');
  });

  it("saves the admin's label, not the model's, and removes the row", async () => {
    vi.mocked(datasets.getReviewQueue).mockResolvedValue([
      candidate('m1'),
      candidate('m2'),
    ]);
    vi.mocked(datasets.confirmReviewCandidate).mockResolvedValue(
      {} as datasets.DatasetSample,
    );
    render(<ReviewQueueTab />);
    const items = await screen.findAllByRole('listitem');
    await userEvent.click(
      within(items[0]).getByRole('button', { name: 'Real message' }),
    );
    expect(datasets.confirmReviewCandidate).toHaveBeenCalledWith('m1', 'Ham');
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(1),
    );
  });

  it('skips without adding to the dataset', async () => {
    vi.mocked(datasets.getReviewQueue).mockResolvedValue([candidate('m1')]);
    vi.mocked(datasets.skipReviewCandidate).mockResolvedValue({
      messageId: 'm1',
      skipped: true,
    });
    render(<ReviewQueueTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(datasets.skipReviewCandidate).toHaveBeenCalledWith('m1');
    expect(datasets.confirmReviewCandidate).not.toHaveBeenCalled();
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
  });

  it('switches to the spot-check queue', async () => {
    vi.mocked(datasets.getReviewQueue).mockResolvedValue([]);
    render(<ReviewQueueTab />);
    await screen.findByText('Nothing to review');
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'spot_check');
    await waitFor(() =>
      expect(datasets.getReviewQueue).toHaveBeenLastCalledWith('spot_check'),
    );
  });

  it('keeps the row and shows the error when saving fails', async () => {
    vi.mocked(datasets.getReviewQueue).mockResolvedValue([candidate('m1')]);
    vi.mocked(datasets.confirmReviewCandidate).mockRejectedValue(
      new Error('This message is already in the dataset.'),
    );
    render(<ReviewQueueTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Scam' }));
    expect(
      await screen.findByText('This message is already in the dataset.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
