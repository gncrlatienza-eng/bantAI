import {
  OTHER_SCAM_CATEGORY,
  describeWave,
  groupUnmatched,
  inferCategory,
  linkDomains,
} from './emerging-waves';

const prize = (id: string, amount = 'P50,000') => ({
  id,
  body: `Congratulations! You won a ${amount} GCash prize. Claim now at gcash-claim.example`,
});

describe('groupUnmatched', () => {
  it('groups reworded copies of one blast as a new wave', () => {
    const { newWaves, attachments } = groupUnmatched(
      [
        prize('a'),
        prize('b', 'P20,000'),
        {
          id: 'c',
          body: 'Your parcel is held at the LBC hub. Pay the redelivery fee today.',
        },
      ],
      [],
    );
    expect(attachments.size).toBe(0);
    expect(newWaves).toEqual([
      {
        category: 'Rewards / prize claim',
        label: 'Rewards / prize claim (GCash)',
        reason: 'SIMILAR_WORDING',
        memberIds: ['a', 'b'],
      },
    ]);
  });

  it('groups texts sharing a link domain first, whatever their wording', () => {
    const { newWaves } = groupUnmatched(
      [
        {
          id: 'a',
          body: 'BDO: unusual login. Verify at https://bdo-secure.xyz/x',
        },
        { id: 'b', body: 'Account locked, see bdo-secure.xyz now' },
      ],
      [],
    );
    expect(newWaves).toEqual([
      expect.objectContaining({ reason: 'SAME_LINK', memberIds: ['a', 'b'] }),
    ]);
  });

  it('never makes a wave out of a single text', () => {
    expect(groupUnmatched([prize('a')], []).newWaves).toEqual([]);
  });

  it('attaches a new copy to a wave found earlier instead of starting another', () => {
    const { newWaves, attachments } = groupUnmatched(
      [prize('new')],
      [{ id: 'w1', members: [prize('old1'), prize('old2')] }],
    );
    expect(newWaves).toEqual([]);
    expect(attachments.get('w1')).toEqual(['new']);
  });

  it('does not attach an unrelated text', () => {
    const { attachments } = groupUnmatched(
      [{ id: 'x', body: 'Hiring part-time task workers, earn 3,000 a day.' }],
      [{ id: 'w1', members: [prize('old1'), prize('old2')] }],
    );
    expect(attachments.size).toBe(0);
  });
});

describe('describeWave', () => {
  it('names the brand where it matters, like the AI', () => {
    expect(
      describeWave([
        'BPI 175th Anniversary: Your 8,413 points expire today. Redeem now',
        'BPI: your reward points expire today, redeem at bpi-rewards.xyz',
      ]),
    ).toEqual({
      category: 'Rewards / prize claim',
      label: 'Rewards / prize claim (BPI)',
    });
  });

  it('moves a bank-named e-wallet blast to bank phishing', () => {
    expect(
      describeWave([
        'BDO advisory: account temporarily disabled, unauthorized transaction',
        'BDO: deactivation notice, unauthorized transaction detected',
      ]).label,
    ).toBe('Bank phishing (BDO)');
  });
});

describe('inferCategory', () => {
  it('needs a 40% share to name a category', () => {
    expect(
      inferCategory([
        'Congratulations you won a prize',
        'random text one',
        'random text two',
      ]),
    ).toBe(OTHER_SCAM_CATEGORY);
  });
});

describe('linkDomains', () => {
  it('counts bare domains only on link TLDs', () => {
    expect(linkDomains('Go to www.Example.ph/x or bdo-secure.xyz')).toEqual([
      'example.ph',
      'bdo-secure.xyz',
    ]);
    expect(linkDomains('Your account.Click here')).toEqual([]);
  });
});
