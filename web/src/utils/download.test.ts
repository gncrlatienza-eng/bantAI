import { describe, expect, it } from 'vitest';

import { csvBlob, csvCell } from './download';

describe('csvCell', () => {
  it('quotes values and doubles embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it.each(['=HYPERLINK("http://evil")', '+1', '-2+3', '@SUM(A1)'])(
    'neutralizes a spreadsheet formula in %j',
    (value) => {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    },
  );
});

/* Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF records. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe('csvBlob', () => {
  it('writes a UTF-8 CSV with a byte-order mark and CRLF rows', async () => {
    const blob = csvBlob(['id', 'label'], [['c1', 'GCash promo']]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(
      '"id","label"\r\n"c1","GCash promo"',
    );
  });

  // QA 2026-10-01 F4-02: the in-app browser never produced a downloaded file,
  // so the file's contents are verified here instead. ExportPage writes every
  // admin CSV through csvBlob, so these bytes are exactly what gets saved.
  it('round-trips multilingual text, separators and hostile cells', async () => {
    const headers = ['id', 'label', 'messageCount', 'isActive', 'domains'];
    const rows = [
      ['c1', 'Pañawagan sa GCash, "libre" 🚨', 12, true, ['gcash-claim.top']],
      ['c2', '诈骗短信\r\nline two', 0, false, []],
      ['c3', '=HYPERLINK("http://evil","click")', 3, true, null],
      ['c4', '\t=1+1', 1, true, ['bit.ly']],
      ['c5', '@SUM(A1:A9)', 2, false, null],
    ];
    const bytes = new Uint8Array(await csvBlob(headers, rows).arrayBuffer());
    // TextDecoder strips the BOM, as a spreadsheet app does.
    const parsed = parseCsv(new TextDecoder('utf-8').decode(bytes));

    expect(parsed).toEqual([
      headers,
      [
        'c1',
        'Pañawagan sa GCash, "libre" 🚨',
        '12',
        'true',
        '["gcash-claim.top"]',
      ],
      ['c2', '诈骗短信\r\nline two', '0', 'false', '[]'],
      ['c3', `'=HYPERLINK("http://evil","click")`, '3', 'true', ''],
      ['c4', "'\t=1+1", '1', 'true', '["bit.ly"]'],
      ['c5', "'@SUM(A1:A9)", '2', 'false', ''],
    ]);
    // No cell may start with a formula trigger once parsed.
    for (const cell of parsed.flat()) {
      expect(cell).not.toMatch(/^[=+\-@\t\r]/);
    }
  });
});
