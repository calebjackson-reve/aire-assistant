#!/usr/bin/env node
// Audit-scoped screenshot helper. Usage:
//   node audit/_tools/audit-screenshot.mjs <url> <width> <outpath>
// Takes a full-page screenshot at given viewport width (height 1024) and writes
// to <outpath>. On failure writes a small .note.txt sibling and exits 0 so the
// loop doesn't crash.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [, , url, widthStr, outpath] = process.argv;
if (!url || !widthStr || !outpath) {
  console.error("usage: audit-screenshot.mjs <url> <width> <outpath>");
  process.exit(2);
}
const width = parseInt(widthStr, 10);

async function writeNote(msg) {
  try {
    await mkdir(dirname(outpath), { recursive: true });
    await writeFile(outpath + ".note.txt", msg, "utf8");
  } catch {}
}

const timeout = 20000;
let browser;
try {
  await mkdir(dirname(outpath), { recursive: true });
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width, height: 1024 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  const status = resp ? resp.status() : 0;
  // small settle
  await page.waitForTimeout(800);
  const finalUrl = page.url();
  await page.screenshot({ path: outpath, fullPage: true });
  console.log(JSON.stringify({ ok: true, status, finalUrl, outpath }));
  await browser.close();
} catch (err) {
  const msg = `ERROR ${url} @${width}: ${err && err.message ? err.message : String(err)}`;
  console.error(msg);
  await writeNote(msg);
  try { if (browser) await browser.close(); } catch {}
  process.exit(0);
}
