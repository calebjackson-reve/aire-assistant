import { readFileSync } from "node:fs";
import path from "node:path";
import { lookupField } from "../lib/cma/field-index/lookup.ts";
import type { FieldIndex } from "../lib/cma/field-index/build.ts";

const INDEX_PATH = path.resolve("lib/cma/paragon-field-index.json");
const query = process.argv.slice(2).join(" ").trim();

if (!query) {
  console.error("Usage: npm run paragon:lookup -- \"<field name>\"");
  process.exit(2);
}

let index: FieldIndex;
try {
  index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
} catch (e) {
  console.error(`Missing ${INDEX_PATH}. Run: npm run field-index:build`);
  process.exit(3);
}

const results = lookupField(index, query);

if (results.length === 0) {
  console.log(`No match for "${query}".`);
  console.log(`Index has ${Object.keys(index.fields).length} fields. Last updated ${index.last_updated}.`);
  process.exit(1);
}

for (const r of results) {
  console.log(`\n${r.name}`);
  console.log(`  surfaces:  ${r.entry.surfaces.join(", ")}`);
  console.log(`  selector:  ${r.entry.selector}`);
  console.log(`  type:      ${r.entry.type}`);
  for (const ref of r.entry.dom_map_refs) {
    console.log(`  dom_map:   ${ref}`);
  }
}
console.log("");
