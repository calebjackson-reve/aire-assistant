export type DomMapField = {
  label: string;
  selector: string;
  type: string;
};

export type DomMap = {
  surface: string;
  fields: Record<string, DomMapField>;
};

export type FieldIndexEntry = {
  surfaces: string[];
  selector: string;
  type: string;
  dom_map_refs: string[];
};

export type FieldIndex = {
  version: 1;
  last_updated: string;
  fields: Record<string, FieldIndexEntry>;
};

export function buildFieldIndex(domMaps: Record<string, DomMap>): FieldIndex {
  const fields: Record<string, FieldIndexEntry> = {};

  for (const [surfaceKey, map] of Object.entries(domMaps)) {
    for (const [fieldKey, field] of Object.entries(map.fields ?? {})) {
      const label = field.label;
      if (!fields[label]) {
        fields[label] = {
          surfaces: [],
          selector: field.selector,
          type: field.type,
          dom_map_refs: [],
        };
      }
      if (!fields[label].surfaces.includes(map.surface)) {
        fields[label].surfaces.push(map.surface);
      }
      fields[label].dom_map_refs.push(`dom_maps/${surfaceKey}.dom.json#fields.${fieldKey}`);
    }
  }

  return {
    version: 1,
    last_updated: new Date().toISOString(),
    fields,
  };
}
