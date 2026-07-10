import * as OBC from "@thatopen/components";
import type * as FRAGS from "@thatopen/fragments";
import { REINFORCEMENT_CATEGORIES } from "./classifierDefinitions";

export const POSITIONSNUMMER_CLASSIFICATION = "Positionsnr.";

const QUERY_NAME = "Positionsnr-exists";

/** "0er" for 1–2 digit values, "200er" for e.g. 206 — i.e. bucket by leading digit. */
function bucketFor(value: number): string {
  const hundreds = Math.floor(value / 100) * 100;
  return hundreds === 0 ? "0er" : `${hundreds}er`;
}

function readPositionsnummer(data: FRAGS.ItemData): number | undefined {
  const isDefinedBy = data.IsDefinedBy;
  if (!Array.isArray(isDefinedBy)) return undefined;
  for (const pset of isDefinedBy) {
    const hasProperties = (pset as any)?.HasProperties;
    if (!Array.isArray(hasProperties)) continue;
    for (const prop of hasProperties) {
      if ((prop as any)?.Name?.value !== "Positionsnummer") continue;
      const value = (prop as any)?.NominalValue?.value;
      return typeof value === "number" ? value : undefined;
    }
  }
  return undefined;
}

/**
 * Groups reinforcement items under "Positionsnr." by the leading digit of
 * their Positionsnummer value (206 → "200er", 5 → "0er"). Positionsnummer is
 * an IFCINTEGER, and the ItemsFinder engine only matches numbers by exact
 * equality (RegExp only ever matches string values) — so this can't be
 * expressed as a static ClassifierDefinition; each item's real value has to
 * be read and bucketed here instead.
 */
export async function classifyPositionsnummer(components: OBC.Components): Promise<void> {
  const finder = components.get(OBC.ItemsFinder);
  const classifier = components.get(OBC.Classifier);
  const fragments = components.get(OBC.FragmentsManager);

  if (finder.list.get(QUERY_NAME)) finder.list.delete(QUERY_NAME);
  finder.create(QUERY_NAME, [
    {
      categories: REINFORCEMENT_CATEGORIES,
      relation: {
        name: "IsDefinedBy",
        query: {
          attributes: { queries: [{ name: /Name/, value: /CH_Pset_BIN/ }] },
          relation: {
            name: "HasProperties",
            query: {
              attributes: { queries: [{ name: /Name/, value: /Positionsnummer/ }] },
            },
          },
        },
      },
    },
  ]);
  const finderQuery = finder.list.get(QUERY_NAME);
  if (!finderQuery) throw new Error(`Query "${QUERY_NAME}" could not be created.`);
  const modelIdMap = await finderQuery.test();

  const buckets = new Map<string, OBC.ModelIdMap>();

  for (const [modelId, localIdSet] of Object.entries(modelIdMap)) {
    const model = fragments.list.get(modelId);
    const localIds = Array.from(localIdSet);
    if (!model || localIds.length === 0) continue;

    const items = await model.getItemsData(localIds, {
      relations: { IsDefinedBy: { attributes: true, relations: true } },
    });

    items.forEach((data, index) => {
      const value = readPositionsnummer(data);
      if (value === undefined) return;
      const bucket = bucketFor(value);
      const bucketMap = buckets.get(bucket) ?? {};
      (bucketMap[modelId] ??= new Set()).add(localIds[index]);
      buckets.set(bucket, bucketMap);
    });
  }

  if (buckets.size === 0) {
    throw new Error(`No elements found for "${QUERY_NAME}".`);
  }
  for (const [bucket, map] of buckets) {
    classifier.addGroupItems(POSITIONSNUMMER_CLASSIFICATION, bucket, map);
  }
}
