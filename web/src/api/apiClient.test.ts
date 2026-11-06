import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchApi, fetchApiBlob } from './apiClient';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient session transport', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never sends a leftover localStorage token as a bearer header', async () => {
    localStorage.setItem('bantai_token', 'legacy.jwt.value');
    // A fresh Response per call: a body can only be read once.
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ok: true }, 200)),
    );

    await fetchApi('/auth/me');
    await fetchApiBlob('/datasets/snapshots/x/export');

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(init?.credentials).toBe('include');
    }
  });

  it('scrubs a leftover token when the session is rejected', async () => {
    localStorage.setItem('bantai_token', 'legacy.jwt.value');
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));

    await expect(fetchApi('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem('bantai_token')).toBeNull();
  });
});

describe('fetchApiBlob errors', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the server problem details for a refused download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'Your license has expired. Renew it to download exports.',
            code: 'LICENSE_INACTIVE',
          },
          403,
        ),
      ),
    );
    const accessChanged = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: accessChanged });

    const error = await fetchApiBlob('/campaigns/c1/export').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'Your license has expired. Renew it to download exports.',
      status: 403,
      code: 'LICENSE_INACTIVE',
    });
    // Same lifecycle signal as JSON calls, so the account layer re-resolves.
    expect(accessChanged).toHaveBeenCalledTimes(1);
  });

  it('falls back to the status line when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>bad gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
      ),
    );

    await expect(fetchApiBlob('/x')).rejects.toMatchObject({
      message: 'HTTP 502: Bad Gateway',
      status: 502,
    });
  });
});
