import { useEffect } from 'react';
import {
  NavigationType,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

/*
 * Starts every newly opened page at the top. Without it the window kept its
 * scroll position across route changes, so opening a campaign from far down
 * the list landed at the bottom of the detail page.
 *
 * Back/forward (POP) is left alone so the browser can restore where the
 * reader was. A hash link (#section) is left to scroll to its target.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === NavigationType.Pop || hash) return;
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash, navigationType]);

  return null;
}
