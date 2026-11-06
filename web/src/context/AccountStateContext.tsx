import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError } from '../api/apiClient';
import { getAccountState, type AccountState } from '../services/accountService';

/*
 * Holds the server-resolved account lifecycle state (GET /api/account/state).
 * Routing decisions read it; nothing here is authoritative — the backend
 * re-checks every request. Loaded lazily so public pages cost nothing until
 * a guarded or auth-aware route asks for it.
 */

export const ACCESS_CHANGED_EVENT = 'bantai:access-changed';

type Status = 'idle' | 'loading' | 'anonymous' | 'ready' | 'error';

interface AccountStateValue {
  status: Status;
  state: AccountState | null;
  /** Start the first load if nothing has been loaded yet. */
  ensure: () => void;
  /** Re-resolve from the server (after sign-in, setup, submit, payment…). */
  refresh: () => Promise<AccountState | null>;
  /** Forget the session locally (after sign-out). */
  clear: () => void;
}

const AccountStateContext = createContext<AccountStateValue | null>(null);

export function AccountStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [state, setState] = useState<AccountState | null>(null);
  const inflight = useRef<Promise<AccountState | null> | null>(null);

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current;
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const request = getAccountState()
      .then((next) => {
        setState(next);
        setStatus('ready');
        return next;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setState(null);
          setStatus('anonymous');
        } else if (error instanceof ApiError && error.status === 403) {
          // A non-web session (e.g. mobile token) has no web lifecycle.
          setState(null);
          setStatus('anonymous');
        } else {
          setStatus('error');
        }
        return null;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = request;
    return request;
  }, []);

  const ensure = useCallback(() => {
    if (status === 'idle') void refresh();
  }, [status, refresh]);

  const clear = useCallback(() => {
    setState(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    window.addEventListener('bantai:signed-out', clear);
    return () => window.removeEventListener('bantai:signed-out', clear);
  }, [clear]);

  // A licensed route answered LICENSE_INACTIVE (e.g. expiry mid-session):
  // re-resolve so the guard moves the user to their current state.
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(ACCESS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ACCESS_CHANGED_EVENT, onChange);
  }, [refresh]);

  // Re-resolve on every navigation once signed in, so expiry, suspension, or
  // activation takes effect on the next route change. The last known state
  // keeps rendering meanwhile (no loading flash).
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (status === 'ready') void refresh();
  }, [pathname, status, refresh]);

  const value = useMemo(
    () => ({ status, state, ensure, refresh, clear }),
    [status, state, ensure, refresh, clear],
  );
  return (
    <AccountStateContext.Provider value={value}>
      {children}
    </AccountStateContext.Provider>
  );
}

export function useAccountState(): AccountStateValue {
  const value = useContext(AccountStateContext);
  if (!value) {
    throw new Error('useAccountState must be used inside AccountStateProvider');
  }
  return value;
}
