/*
 * QR code for desktop visitors: scan to open a page on the phone. The
 * encoder loads on demand so it never weighs on the first paint.
 */
import React, { useEffect, useState } from 'react';

export function QrCode({ path, label }: { path: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(path, window.location.origin).toString();
    void import('qrcode')
      .then((qr) =>
        qr.toString(url, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'M',
          color: { dark: '#2b2530', light: '#00000000' },
        }),
      )
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <figure className="qr" role="img" aria-label={label}>
      {svg ? (
        <span
          className="qr__code"
          aria-hidden="true"
          // Markup comes from the local encoder, not from user input.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span className="qr__code qr__code--loading" aria-hidden="true" />
      )}
    </figure>
  );
}

export default QrCode;
