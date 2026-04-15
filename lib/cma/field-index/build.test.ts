import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFieldIndex } from "./build.ts";

test("buildFieldIndex aggregates fields from all dom_maps", () => {
  const fixture = {
    "listing_detail": {
      surface: "listing_detail",
      fields: {
        beds: { label: "Beds", selector: "td[data-field='Beds']", type: "integer" },
        mineral_rights: { label: "Mineral Rights", selector: ".mineral-rights .value", type: "string" },
      },
    },
    "comp_grid_step2": {
      surface: "comp_grid_step2",
      fields: {
        beds: { label: "Beds", selector: "td.col-beds", type: "integer" },
      },
    },
  };

  const index = buildFieldIndex(fixture);

  assert.equal(index.version, 1);
  assert.ok(index.fields["Beds"]);
  assert.deepEqual(index.fields["Beds"].surfaces.sort(), ["comp_grid_step2", "listing_detail"]);
  assert.equal(index.fields["Beds"].type, "integer");
  assert.ok(index.fields["Mineral Rights"]);
  assert.deepEqual(index.fields["Mineral Rights"].surfaces, ["listing_detail"]);
});

test("buildFieldIndex handles empty input", () => {
  const index = buildFieldIndex({});
  assert.equal(index.version, 1);
  assert.deepEqual(index.fields, {});
});
