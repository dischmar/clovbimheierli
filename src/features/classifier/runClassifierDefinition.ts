import * as OBC from "@thatopen/components";
import type { ClassifierDefinition } from "./types";

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
