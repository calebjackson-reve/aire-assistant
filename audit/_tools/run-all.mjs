#!/usr/bin/env node
// Iterate routes.json × 3 widths. Call audit-screenshot for each; log result.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname } from "node:path";

const routes = JSON.parse(await readFile("audit/_tools/routes.json", "utf8"));
const widths = [375, 768, 1280];
const base = "http://localhost:3000";
const results = [];

function run(url, width, outpath) {
  return new Promise((resolve) => {
    const p = spawn("node", ["audit/_tools/audit-screenshot.mjs", url, String(width), outpath], { shell: false });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      let parsed = null;
      try { parsed = JSON.parse(out.trim().split("\n").pop()); } catch {}
      resolve({ code, out: parsed, err: err.trim() });
    });
  });
}

let i = 0;
for (const r of routes) {
  for (const w of widths) {
    i++;
    const outpath = `temporary screenshots/baseline/${r.cluster}/${r.slug}-${w}.png`;
    await mkdir(dirname(outpath), { recursive: true });
    process.stdout.write(`[${i}/${routes.length * widths.length}] ${r.cluster} ${r.slug} @${w} ... `);
    const res = await run(base + r.route, w, outpath);
    const status = res.out?.status ?? "ERR";
    const finalUrl = res.out?.finalUrl ?? "";
    const redirected = finalUrl && !finalUrl.endsWith(r.route) && !(r.route === "/" && finalUrl === base + "/");
    const authGated = redirected && (finalUrl.includes("/sign-in") || finalUrl.includes("clerk.com") || finalUrl.includes("accounts."));
    process.stdout.write(`status=${status}${authGated ? " AUTH-GATED" : redirected ? " REDIR" : ""}\n`);
    results.push({ cluster: r.cluster, slug: r.slug, route: r.route, width: w, status, finalUrl, authGated, redirected, err: res.err });
  }
}

await writeFile("audit/_tools/results.json", JSON.stringify(results, null, 2));
console.log("\nDone. Results → audit/_tools/results.json");
