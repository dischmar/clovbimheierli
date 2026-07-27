import * as OBC from "@thatopen/components";
import type { ClassifierDefinition } from "./types";
import { DEFAULT_GROUP_NAME } from "./classifierDefinitions";

/**
 * Runs a single classifier definition: (re)creates its finder query, tests it,
 * and — if it matched anything — adds the result as a classifier group.
 * Pure engine logic, no React state; throws on failure so callers can decide
 * whether one failing definition should stop the rest of a batch.
 */
export async function runClassifierDefinition(
  components: OBC.Components,
  def: ClassifierDefinition
): Promise<OBC.ModelIdMap> {
  const classifier = components.get(OBC.Classifier);
  const finder = components.get(OBC.ItemsFinder);

  if (finder.list.get(def.queryName)) {
    finder.list.delete(def.queryName);
  }
  finder.create(def.queryName, def.query);

  const finderQuery = finder.list.get(def.queryName);
  if (!finderQuery) {
    throw new Error(`Query "${def.queryName}" could not be created.`);
  }

  const modelIdMap = await finderQuery.test();
  if (!modelIdMap || Object.keys(modelIdMap).length === 0) {
    throw new Error(`No elements found for "${def.queryName}".`);
  }
  if(modelIdMap ) {
    classifier.addGroupItems(def.classificationName, def.groupName, modelIdMap);}
  return modelIdMap;
}

/**
 * For each classification named in `definitions`, finds every element that
 * matches that classification's base categories but wasn't claimed by any of
 * its specific property-value groups, and adds the leftovers as a
 * `DEFAULT_GROUP_NAME` group (colored red via getClassifierColor) so nothing
 * classified-but-unmatched is left showing its original, uncolored geometry.
 */
export async function addDefaultGroups(
  components: OBC.Components,
  definitions: ClassifierDefinition[]
): Promise<void> {
  const classifier = components.get(OBC.Classifier);
  const finder = components.get(OBC.ItemsFinder);

  const classificationNames = new Set(definitions.map((d) => d.classificationName));
  for (const classificationName of classificationNames) {
    const categories = definitions.find(
      (d) => d.classificationName === classificationName
    )?.query[0]?.categories;
    if (!categories) continue;

    const queryName = `${classificationName}-${DEFAULT_GROUP_NAME}-scope`;
    if (finder.list.get(queryName)) finder.list.delete(queryName);
    finder.create(queryName, [{ categories }]);
    const scope = await finder.list.get(queryName)?.test();
    finder.list.delete(queryName);
    if (!scope) continue;

    const classifiedIds: Record<string, Set<number>> = {};
    const groupMap = classifier.list.get(classificationName);
    if (groupMap) {
      for (const [, groupData] of groupMap) {
        for (const [modelId, ids] of Object.entries(groupData.map)) {
          const set = (classifiedIds[modelId] ??= new Set<number>());
          for (const id of ids) set.add(id);
        }
      }
    }

    const leftover: OBC.ModelIdMap = {};
    for (const [modelId, ids] of Object.entries(scope)) {
      const already = classifiedIds[modelId];
      const remaining = already ? [...ids].filter((id) => !already.has(id)) : [...ids];
      if (remaining.length > 0) leftover[modelId] = new Set(remaining);
    }

    if (Object.keys(leftover).length > 0) {
      classifier.addGroupItems(classificationName, DEFAULT_GROUP_NAME, leftover);
    }
  }
}
