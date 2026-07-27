import * as OBC from "@thatopen/components";

export function countModelIdMap(map: OBC.ModelIdMap): number {
  return Object.values(map).reduce((sum, s) => sum + s.size, 0);
}

export function intersectModelIdMaps(maps: OBC.ModelIdMap[]): OBC.ModelIdMap {
  const result: OBC.ModelIdMap = {};
  if (maps.length === 0) return result;

  const [first, ...rest] = maps;

  for (const [modelId, ids] of Object.entries(first)) {
    let intersected = new Set(ids);
    for (const map of rest) {
      const other = map[modelId];
      if (!other) {
        intersected = new Set();
        break;
      }
      intersected = new Set([...intersected].filter((id) => other.has(id)));
    }
    if (intersected.size > 0) {
      result[modelId] = intersected;
    }
  }

  return result;
}

export function subtractModelIdMaps(base: OBC.ModelIdMap, subtract: OBC.ModelIdMap): OBC.ModelIdMap {
  const result: OBC.ModelIdMap = {};

  for (const [modelId, ids] of Object.entries(base)) {
    const toRemove = subtract[modelId] ?? new Set();
    const remaining = new Set([...ids].filter((id) => !toRemove.has(id)));
    if (remaining.size > 0) {
      result[modelId] = remaining;
    }
  }

  return result;
}
