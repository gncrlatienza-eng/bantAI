/**
 * "Sep 23, 2:23 PM" — the year is shown only when it is not the current
 * one. The full "Sep 23, 2026, 2:23 PM" wrapped onto three lines in table
 * cells; most admin rows are from this year.
 */
export function formatCompactDateTime(date: Date, now = new Date()): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: 'numeric' as const }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Same as formatCompactDateTime plus seconds, for request logs. */
export function formatLogTime(date: Date, now = new Date()): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: 'numeric' as const }),
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
