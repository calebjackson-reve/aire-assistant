import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildFieldIndex, type DomMap } from "../lib/cma/field-index/build.ts";

const DOM_MAPS_DIR = path.resolve("lib/cma/scrapers/dom_maps");
const OUTPUT_PATH = path.resolve("lib/cma/paragon-field-index.json");

function loadDomMaps(): Record<string, DomMap> {
  const result: Record<string, DomMap> = {};
  const files = readdirSync(DOM_MAPS_DIR).filter((f) => f.endsWith(".dom.json"));
  for (const file of files) {
    const surfaceKey = file.replace(/\.dom\.json$/, "");
    const raw = readFileSync(path.join(DOM_MAPS_DIR, file), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.surface && typeof parsed.surface === "string") {
      result[surfaceKey] = {
        surface: parsed.surface,
        fields: parsed.fields ?? {},
      };
    }
  }
  return result;
}

const maps = loadDomMaps();
const index = buildFieldIndex(maps);
writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
console.log(`Wrote ${OUTPUT_PATH} — ${Object.keys(index.fields).length} unique fields from ${Object.keys(maps).length} surfaces`);
