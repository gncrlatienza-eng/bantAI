/*
 * Finds and re-masks SMS text stored before server-side ingest masking
 * (audit 2026-09-30, finding 0). A modified or older mobile client could send
 * an original SMS under `maskedBody`; those rows kept it verbatim.
 *
 *   npm run build
 *   node --env-file=.env scripts/remask-stored-sms.mjs           # dry run: counts only
 *   node --env-file=.env scripts/remask-stored-sms.mjs --apply   # rewrite changed rows
 *
 * Uses the compiled canonical masker (dist/src/sms/sms-privacy-masker.js), so
 * build first. Prints counts only, never message text. Take a pg_dump before
 * --apply: frozen dataset snapshot items are rewritten too, because a snapshot
 * holding unmasked personal data must not be kept as-is.
 */
import { PrismaClient } from '@prisma/client';

import { maskSmsBody } from '../dist/src/sms/sms-privacy-masker.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;
const prisma = new PrismaClient();

// [model, text fields] — every column that stores message-derived text.
const TARGETS = [
  ['smsMessage', ['body']],
  ['messageFeature', ['normalizedBody', 'maskedBody']],
  ['datasetSample', ['maskedText']],
  ['datasetSampleRevision', ['maskedText']],
  ['datasetSnapshotItem', ['maskedText']],
];

async function remask(model, fields) {
  const select = Object.fromEntries([
    ['id', true],
    ...fields.map((f) => [f, true]),
  ]);
  let cursor;
  let scanned = 0;
  let changed = 0;
  for (;;) {
    const rows = await prisma[model].findMany({
      select,
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;
    const updates = [];
    for (const row of rows) {
      const data = {};
      for (const field of fields) {
        const masked = maskSmsBody(row[field]);
        if (masked !== row[field]) data[field] = masked;
      }
      if (Object.keys(data).length) {
        changed += 1;
        updates.push(prisma[model].update({ where: { id: row.id }, data }));
      }
    }
    if (APPLY && updates.length) await prisma.$transaction(updates);
  }
  return { scanned, changed };
}

try {
  console.log(
    APPLY
      ? 'Re-masking stored SMS text…'
      : 'Dry run (pass --apply to rewrite):',
  );
  for (const [model, fields] of TARGETS) {
    const { scanned, changed } = await remask(model, fields);
    console.log(
      `  ${model}: ${changed} of ${scanned} rows ${APPLY ? 'rewritten' : 'would change'}`,
    );
  }
} finally {
  await prisma.$disconnect();
}
