import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupField } from "./lookup.ts";
import type { FieldIndex } from "./build.ts";

const fixture: FieldIndex = {
  version: 1,
  last_updated: "2026-04-14T00:00:00Z",
  fields: {
    "Beds": {
      surfaces: ["listing_detail", "comp_grid_step2"],
      selector: "td[data-field='Beds']",
      type: "integer",
      dom_map_refs: ["dom_maps/listing_detail.dom.json#fields.beds"],
    },
    "Mineral Rights": {
      surfaces: ["listing_detail"],
      selector: ".mineral-rights .value",
      type: "string",
      dom_map_refs: ["dom_maps/listing_detail.dom.json#fields.mineral_rights"],
    },
    "Year Built": {
      surfaces: ["listing_detail"],
      selector: ".year-built",
      type: "integer",
      dom_map_refs: [],
    },
  },
};

test("lookupField exact match", () => {
  const results = lookupField(fixture, "Beds");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Beds");
});

test("lookupField case-insensitive", () => {
  const results = lookupField(fixture, "beds");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Beds");
});

test("lookupField partial match", () => {
  const results = lookupField(fixture, "mineral");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Mineral Rights");
});

test("lookupField no match returns empty", () => {
  const results = lookupField(fixture, "nonexistent");
  assert.deepEqual(results, []);
});

test("lookupField multi-word partial", () => {
  const results = lookupField(fixture, "year");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Year Built");
});
