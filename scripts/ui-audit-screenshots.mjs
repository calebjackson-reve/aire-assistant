import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://aireintel.org';
const OUT_DIR = path.join(process.cwd(), 'ui-audit-screenshots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'dashboard', path: '/aire' },
  { name: 'morning-brief', path: '/aire/morning-brief' },
  { name: 'email', path: '/aire/email' },
  { name: 'transactions', path: '/aire/transactions' },
  { name: 'contacts', path: '/aire/relationships' },
  { name: 'intelligence', path: '/aire/intelligence' },
  { name: 'airsign', path: '/airsign' },
  { name: 'settings', path: '/aire/settings' },
  { name: 'compliance', path: '/aire/compliance' },
  { name: 'contracts', path: '/aire/contracts' },
  { name: 'monitoring', path: '/aire/monitoring' },
  { name: 'voice-analytics', path: '/aire/voice-analytics' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    for (const pg of PAGES) {
      const url = `${BASE_URL}${pg.path}`;
      const filename = `${pg.name}-${vp.name}.png`;
      console.log(`Capturing ${url} @ ${vp.name}...`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      } catch (e) {
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        } catch (e2) {
          console.log(`  FAILED: ${e2.message}`);
          continue;
        }
      }

      await new Promise(r => setTimeout(r, 2000));

      await page.screenshot({
        path: path.join(OUT_DIR, filename),
        fullPage: true,
      });
      console.log(`  Saved ${filename}`);
    }

    await page.close();
  }

  await browser.close();
  console.log(`\nDone! Screenshots in ${OUT_DIR}`);
}

run().catch(console.error);
