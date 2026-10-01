/*
 * Browser file downloads. The anchor is attached to the document (Firefox
 * ignores clicks on detached anchors) and the object URL is revoked only
 * after the browser has started the download; revoking it synchronously
 * can cancel the save in some browsers.
 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* Spreadsheet apps execute a cell that starts with one of these as a
   formula; record values (campaign labels, domains) are not trusted. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const raw =
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string'
          ? value
          : typeof value === 'number' ||
              typeof value === 'boolean' ||
              typeof value === 'bigint'
            ? value.toString()
            : '';
  const text = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

/* UTF-8 with a byte-order mark so spreadsheet apps read non-ASCII text. */
export function csvBlob(headers: string[], rows: unknown[][]): Blob {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  return new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
}
