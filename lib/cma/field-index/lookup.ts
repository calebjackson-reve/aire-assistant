import type { FieldIndex, FieldIndexEntry } from "./build.ts";

export type LookupResult = {
  name: string;
  entry: FieldIndexEntry;
};

export function lookupField(index: FieldIndex, query: string): LookupResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: LookupResult[] = [];
  for (const [name, entry] of Object.entries(index.fields)) {
    if (name.toLowerCase().includes(q)) {
      results.push({ name, entry });
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
