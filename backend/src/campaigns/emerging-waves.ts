/*
 * Server-side grouping of scam texts that matched no known campaign.
 *
 * The offline clusters only know campaigns from the training data, so a new
 * blast (e.g. "You won a P50,000 GCash prize") never matches and the admin
 * dashboard never sees it, while the phone shows it as a Scam Wave by
 * grouping its own inbox. This is the same grouping, run over every user's
 * unmatched scam texts. A port of mobile LocalCampaigns.kt; keep the two (and
 * ai/service/campaign_naming.py's categories) in sync.
 *
 *  1. Attach: a text that shares a link with, or reads like, a wave found
 *     earlier joins that wave.
 *  2. Group the rest: first by a shared link domain, then by similar wording
 *     (TF-IDF cosine, single-link). A new wave needs MIN_WAVE_SIZE texts.
 *
 * Pure functions, no Prisma, so it is covered by emerging-waves.spec.ts.
 */

export const MIN_WAVE_SIZE = 2;
// Cosine over TF-IDF weights; groups reworded copies of one blast without
// pulling in merely same-topic texts. Same threshold as the phone.
export const SIMILAR_WORDING_THRESHOLD = 0.45;
export const OTHER_SCAM_CATEGORY = 'Other scam';
const MIN_CATEGORY_SHARE = 0.4;

export interface WaveText {
  id: string;
  body: string;
}

export interface ExistingWave {
  id: string;
  members: WaveText[];
}

export interface NewWave {
  category: string;
  /** Same naming as the AI's clusters: "Bank phishing (BDO)". */
  label: string;
  reason: 'SAME_LINK' | 'SIMILAR_WORDING';
  memberIds: string[];
}

export interface GroupingResult {
  /** waveId -> ids of unmatched texts that joined it */
  attachments: Map<string, string[]>;
  newWaves: NewWave[];
}

export function groupUnmatched(
  candidates: WaveText[],
  existing: ExistingWave[],
): GroupingResult {
  const attachments = new Map<string, string[]>();
  if (candidates.length === 0) return { attachments, newWaves: [] };

  // One vocabulary over everything, so weights are comparable.
  const allMembers = existing.flatMap((w) => w.members);
  const idf = inverseDocumentFrequency(
    [...candidates, ...allMembers].map((t) => wordTokens(t.body)),
  );
  const vector = memoize((t: WaveText) => tfIdf(wordTokens(t.body), idf));
  const domainsOf = memoize((t: WaveText) => linkDomains(t.body));

  // Pass 1: attach to a wave found earlier.
  const waveDomains = existing.map(
    (w) => new Set(w.members.flatMap((m) => domainsOf(m))),
  );
  const remaining: WaveText[] = [];
  for (const text of candidates) {
    const domains = domainsOf(text);
    let best: { id: string; score: number } | null = null;
    existing.forEach((wave, i) => {
      const score = domains.some((d) => waveDomains[i].has(d))
        ? 1
        : Math.max(
            0,
            ...wave.members.map((m) => cosine(vector(text), vector(m))),
          );
      if (score >= SIMILAR_WORDING_THRESHOLD && (!best || score > best.score)) {
        best = { id: wave.id, score };
      }
    });
    if (best) {
      const { id } = best as { id: string };
      attachments.set(id, [...(attachments.get(id) ?? []), text.id]);
    } else {
      remaining.push(text);
    }
  }

  // Pass 2: a shared link domain is the strongest evidence of one blast.
  const newWaves: NewWave[] = [];
  const byDomain = new Map<string, WaveText[]>();
  for (const text of remaining) {
    const first = domainsOf(text)[0];
    if (first) byDomain.set(first, [...(byDomain.get(first) ?? []), text]);
  }
  const grouped = new Set<string>();
  for (const members of byDomain.values()) {
    if (members.length >= MIN_WAVE_SIZE) {
      newWaves.push({
        ...describeWave(members.map((m) => m.body)),
        reason: 'SAME_LINK',
        memberIds: members.map((m) => m.id),
      });
      members.forEach((m) => grouped.add(m.id));
    }
  }

  // Pass 3: similar wording, single-link clustering.
  const rest = remaining.filter((t) => !grouped.has(t.id));
  const parent = rest.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    return r;
  };
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      if (cosine(vector(rest[i]), vector(rest[j])) >= SIMILAR_WORDING_THRESHOLD)
        parent[root(j)] = root(i);
    }
  }
  const clusters = new Map<number, WaveText[]>();
  rest.forEach((t, i) =>
    clusters.set(root(i), [...(clusters.get(root(i)) ?? []), t]),
  );
  for (const members of clusters.values()) {
    if (members.length >= MIN_WAVE_SIZE) {
      newWaves.push({
        ...describeWave(members.map((m) => m.body)),
        reason: 'SIMILAR_WORDING',
        memberIds: members.map((m) => m.id),
      });
    }
  }

  newWaves.sort((a, b) => b.memberIds.length - a.memberIds.length);
  return { attachments, newWaves };
}

// --- category vote (LocalCampaigns.kt inferCategory / messageCategory) ---

const SCAM_CATEGORIES: [string, string[]][] = [
  [
    'Parcel / delivery scam',
    words(
      'parcel|delivery|redelivery|lbc|j&t|jnt|ninja van|shipment|package|courier|recipient|address',
    ),
  ],
  [
    'Bank phishing',
    words(
      'bdo|bpi|metrobank|unionbank|landbank|security bank|rcbc|pnb|chinabank|unauthorized|transaction|mybdo',
    ),
  ],
  [
    'E-wallet phishing',
    words(
      'gcash|maya|paymaya|deactivation|deactivated|disabled|temporarily|advisory',
    ),
  ],
  [
    'Loan / credit offer',
    words(
      'loan|collateral|credit card|approval|lending|utang|pautang|need cash|easy cash|credit|processing|getcash',
    ),
  ],
  [
    'Online gambling / casino',
    words(
      'bonus|deposit|deposito|magdeposito|jackpot|slot|casino|bet|roulette|bingo|jili|sabong|cashback|turnover|laro|maglaro|games|game|gojackpot|manalo|panalo|bets|cash out|play|wins',
    ),
  ],
  [
    'Rewards / prize claim',
    words(
      'points|redeem|expire|reward|rewards|prize|raffle|congratulations|won|premyo|red envelope|lucky|gift',
    ),
  ],
  [
    'Job / task offer',
    words(
      'trabaho|job|hiring|salary|sahod|kumita|earn|commission|task|part-time|part time|work from home|natutulog|habang|share|earn money',
    ),
  ],
  [
    'OTP / account update',
    words('otp|pin|update|updated|registered|sim|verify|verification'),
  ],
  [
    'Government / ID request',
    words(
      'government|requirements|dswd|sss|philhealth|bir|lto|nbi|ayuda|pagibig|pag-ibig|frontface|front face|valid id|selfie|kindly',
    ),
  ],
];

function words(joined: string): string[] {
  return joined.split('|');
}

const patterns = new Map<string, RegExp>();
function wholeWord(kw: string): RegExp {
  let re = patterns.get(kw);
  if (!re) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
    patterns.set(kw, re);
  }
  return re;
}

export function messageCategory(text: string): string | null {
  const low = text.toLowerCase();
  let best: string | null = null;
  let bestHits = 0;
  for (const [category, keywords] of SCAM_CATEGORIES) {
    const hits = keywords.filter((kw) => wholeWord(kw).test(low)).length;
    if (hits > bestHits) {
      best = category;
      bestHits = hits;
    }
  }
  return best;
}

export function inferCategory(bodies: string[]): string {
  const votes = new Map<string, number>();
  for (const body of bodies) {
    const c = messageCategory(body);
    if (c) votes.set(c, (votes.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let count = 0;
  for (const [c, n] of votes) {
    if (n > count) {
      best = c;
      count = n;
    }
  }
  return best && count >= bodies.length * MIN_CATEGORY_SHARE
    ? best
    : OTHER_SCAM_CATEGORY;
}

// --- naming (ai/service/campaign_naming.py describe) ---

// A brand must appear in at least this share of members to be named.
const BRAND_SHARE = 0.3;
const BANK_BRANDS = new Set([
  'BDO',
  'BPI',
  'Metrobank',
  'UnionBank',
  'Landbank',
]);
const EWALLET_BRANDS = new Set(['GCash', 'Maya']);
const BRANDS: [string, string][] = [
  ['gcash', 'GCash'],
  ['paymaya', 'Maya'],
  ['maya', 'Maya'],
  ['bdo', 'BDO'],
  ['bpi', 'BPI'],
  ['metrobank', 'Metrobank'],
  ['unionbank', 'UnionBank'],
  ['landbank', 'Landbank'],
  ['lbc', 'LBC'],
  ['j&t', 'J&T'],
  ['globe', 'Globe'],
  ['smart', 'Smart'],
  ['dito', 'DITO'],
  ['shopee', 'Shopee'],
  ['lazada', 'Lazada'],
  ['sss', 'SSS'],
  ['philhealth', 'PhilHealth'],
];
// A brand only where it says something about the scam: "Bank phishing
// (BDO)" yes, "Online gambling (GCash)" -- GCash as the deposit channel -- no.
const BRANDED_CATEGORIES = new Set([
  'Bank phishing',
  'E-wallet phishing',
  'Parcel / delivery scam',
  'Rewards / prize claim',
  'OTP / account update',
  'Government / ID request',
]);

function messageBrand(text: string): string | null {
  const low = text.toLowerCase();
  for (const [key, display] of BRANDS) {
    if (wholeWord(key).test(low)) return display;
  }
  return null;
}

export function describeWave(bodies: string[]): {
  category: string;
  label: string;
} {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    const b = messageBrand(body);
    if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  let brand: string | null = null;
  let top = 0;
  for (const [b, n] of counts) {
    if (n > top) {
      brand = b;
      top = n;
    }
  }
  if (top < Math.max(bodies.length, 1) * BRAND_SHARE) brand = null;

  let category = inferCategory(bodies);
  // Bank vs e-wallet phishing is decided by whose name is on it.
  if (
    brand &&
    (category === 'Bank phishing' || category === 'E-wallet phishing')
  ) {
    if (EWALLET_BRANDS.has(brand)) category = 'E-wallet phishing';
    else if (BANK_BRANDS.has(brand)) category = 'Bank phishing';
  }
  const label =
    brand && BRANDED_CATEGORIES.has(category)
      ? `${category} (${brand})`
      : category;
  return { category, label };
}

// --- links and wording (LocalCampaigns.kt linkDomains / wordTokens) ---

const LINK =
  /(https?:\/\/|www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,}))(?:[/?#]\S*)?/gi;

// Without a scheme or www a domain only counts when its TLD is one links
// actually use, so a run-on sentence ("account.Click") is not a link.
const BARE_LINK_TLDS = new Set(
  'com net org ph info xyz top site online club vip cc me io link live shop app co bet win fun icu store tk ml ga cf gq pw buzz asia biz'.split(
    ' ',
  ),
);

export function linkDomains(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(LINK)) {
    const [, scheme, domain, tld] = m;
    if (!scheme && !BARE_LINK_TLDS.has(tld.toLowerCase())) continue;
    const host = domain.toLowerCase().replace(/^www\./, '');
    if (!out.includes(host)) out.push(host);
  }
  return out;
}

const WORD = /[\p{L}\p{N}]{3,}/gu;

// English + Tagalog/Taglish filler plus generic SMS words every scam shares,
// so similarity rests on content.
const STOP_WORDS = new Set(
  (
    'the and are for from has have you your our this that with will was were can may just now all any please ' +
    'not http https www com click link here text reply stop ang mga ito iyan iyon yan yun dito doon para ' +
    'kung kapag pag dahil upang pero ngunit kaya yung iyong lahat bawat mula hanggang tungkol naman kasi ' +
    'sana lang lamang din rin niya nila namin ninyo natin atin inyo kanila ako ikaw tayo kami kayo sila ' +
    'may mayroon meron wala hindi'
  ).split(' '),
);

function wordTokens(body: string): string[] {
  const text = body.toLowerCase().replace(LINK, ' ');
  return [...text.matchAll(WORD)]
    .map((m) => m[0])
    .filter((w) => !STOP_WORDS.has(w));
}

function inverseDocumentFrequency(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of docs) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log((n + 1) / (f + 1)) + 1);
  return idf;
}

function tfIdf(
  tokens: string[],
  idf: Map<string, number>,
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [t, n] of tf) out.set(t, n * (idf.get(t) ?? 1));
  return out;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  for (const [t, w] of a) dot += w * (b.get(t) ?? 0);
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((s, w) => s + w * w, 0));
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot / denom;
}

function memoize<T extends { id: string }, R>(fn: (t: T) => R): (t: T) => R {
  const cache = new Map<string, R>();
  return (t) => {
    let v = cache.get(t.id);
    if (v === undefined) {
      v = fn(t);
      cache.set(t.id, v);
    }
    return v;
  };
}
