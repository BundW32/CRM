import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto(new URL('./endcard.html', import.meta.url).href);
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/endcard.png' });
await b.close();
