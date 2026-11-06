/* Every shipped landing capture: the real portal on synthetic demo data.
 * Regenerate with tools/landing-capture (see
 * src/assets/landing/captures/MANIFEST.md). */
import hiwConnect from '../../assets/landing/captures/hiw-connect.webp';
import psPortalLoopWebm from '../../assets/landing/captures/ps-portal-loop.webm';
import psPortalLoopMp4 from '../../assets/landing/captures/ps-portal-loop.mp4';
import psPortalLoopPoster from '../../assets/landing/captures/ps-portal-loop-poster.webp';

export const CAPTURES = {
  hiwConnect,
  psPortalLoop: {
    webm: psPortalLoopWebm,
    mp4: psPortalLoopMp4,
    poster: psPortalLoopPoster,
  },
};
