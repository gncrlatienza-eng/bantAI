// Refuse anything but a local, disposable landing-capture database.
export function assertDisposableDb(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Use a disposable local bantai_shield_landing_* database.');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!local || !url.pathname.startsWith('/bantai_shield_landing_')) {
    throw new Error('Use a disposable local bantai_shield_landing_* database.');
  }
}
