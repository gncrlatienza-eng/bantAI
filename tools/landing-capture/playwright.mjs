// The capture tools live outside web/ (so web's type-aware lint doesn't cover
// dev-only Node scripts) but use web's Playwright install.
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
export const { chromium } = require('playwright');
