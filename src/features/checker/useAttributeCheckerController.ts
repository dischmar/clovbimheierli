import { useCallback, useState } from "react";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { FrontFunctions } from "../hider/FrontFunctions";
import { countModelIdMap, intersectModelIdMaps, subtractModelIdMaps } from "./modelIdMapUtils";
import type {
  CheckerConfig, CheckerController, CombinationResultTree, CombinationTest,
  ElementInfo, ResultTree, TreeNode,
} from "./types";

interface UseAttributeCheckerControllerArgs {
  components: OBC.Components | null;
  config: CheckerConfig;
}

/** Resolves human-readable info (Name attribute, GUID) for each element in a ModelIdMap. */
async function resolveElementInfo(
  components: OBC.Components,
  map: OBC.ModelIdMap,
  reason: string
): Promise<ElementInfo[]> {
  const fragments = components.get(OBC.FragmentsManager);
  const out: ElementInfo[] = [];

  for (const [modelId, localIds] of Object.entries(map)) {
    const model = fragments.list.get(modelId);
    if (!model) continue;

    for (const localId of localIds) {
      let name = `#${localId}`;
      let guid: string | undefined;
      try {
        const [data] = await model.getItemsData([localId], {
          attributesDefault: true,
        });
        const attrs = (data as any)?.attributes ?? data;
        name = attrs?.Name?.value ?? attrs?.Tag?.value ?? name;
        guid = attrs?.GlobalId?.value;
      } catch {
        // ignore resolution errors, fall back to default name
      }
      out.push({ modelId, localId, name, guid, reason });
    }
  }

  return out;
}

/**
 * All state and engine logic behind one checker run: walk the tree, run the
 * combination tests, resolve failures, and highlight results in the scene.
 * Pure data + actions — no JSX — parameterized by a `CheckerConfig` so a
 * different population/tree can reuse the exact same engine.
 */
export function useAttributeCheckerController({ components, config }: UseAttributeCheckerControllerArgs): CheckerController {
  const { rootQuery, tree, combinationTests } = config;

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [results, setResults] = useState<ResultTree>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [rootCount, setRootCount] = useState<number | null>(null);
  const [failures, setFailures] = useState<ElementInfo[]>([]);
  const [resolvingFailures, setResolvingFailures] = useState(false);
  const [combinations, setCombinations] = useState<CombinationResultTree>({});

  const getHl = useCallback((): FrontFunctions | null => {
    if (!components) return null;
    try { return components.get(FrontFunctions); } catch { return null; }
  }, [components]);

  const handleRunPipeline = useCallback(async () => {
    if (!components) return;
    setLoading(true);
    setError(null);
    try {
      const finder = components.get(OBC.ItemsFinder);
      const newResults: ResultTree = {};

      const testQuery = async (name: string, query: FRAGS.ItemsQueryParams) => {
        if (finder.list.get(name)) finder.list.delete(name);
        finder.create(name, [query]);
        const fq = finder.list.get(name);
        if (!fq) throw new Error(`Query "${name}" could not be created.`);
        return fq.test();
      };

      // root population (e.g. all walls)
      const rootMap = await testQuery("checker-root", rootQuery);
      setRootCount(countModelIdMap(rootMap));

      // recursively walk the tree; siblings share the same population as `population`
      const walk = async (node: TreeNode, population: OBC.ModelIdMap) => {
        const raw = await testQuery(`checker-${node.id}`, node.query);
        const yesMap = intersectModelIdMaps([population, raw]);
        const noMap = subtractModelIdMaps(population, yesMap);

        newResults[node.id] = {
          yesMap,
          noMap,
          yesCount: countModelIdMap(yesMap),
          noCount: countModelIdMap(noMap),
        };

        if (node.yes) await walk(node.yes, yesMap);
        if (node.no) await walk(node.no, noMap);
        if (node.siblings) {
          for (const sibling of node.siblings) {
            await walk(sibling, population);
          }
        }
      };

      await walk(tree, rootMap);

      setResults(newResults);

      // ── combination tests ──────────────────────────────────────────────────
      const newCombinations: CombinationResultTree = {};
      for (const test of combinationTests) {
        // population = intersection of all referenced nodes' "yes" sets
        const maps = test.populationFromIds.map((id) => newResults[id]?.yesMap ?? {});
        const basePopulation = intersectModelIdMaps(maps);

        const rawBranch = await testQuery(`checker-${test.id}-branch`, test.branchQuery);
        const branchMap = intersectModelIdMaps([basePopulation, rawBranch]);

        const rawPattern = await testQuery(`checker-${test.id}-pattern`, test.patternQuery);
        const passMap = intersectModelIdMaps([branchMap, rawPattern]);
        const failMap = subtractModelIdMaps(branchMap, passMap);

        newCombinations[test.id] = {
          branchMap,
          branchCount: countModelIdMap(branchMap),
          passMap,
          failMap,
          passCount: countModelIdMap(passMap),
          failCount: countModelIdMap(failMap),
        };
      }
      setCombinations(newCombinations);

      // Collect failures: missing Pset, missing LoadBearing, and both combination tests
      setResolvingFailures(true);
      try {
        const failingLists: ElementInfo[] = [];

        // Walls without Pset_WallCommon at all → cannot be checked → fail
        const noPsetResult = newResults["psetCommon"];
        if (noPsetResult) {
          const info = await resolveElementInfo(
            components,
            noPsetResult.noMap,
            "Pset_WallCommon fehlt komplett"
          );
          failingLists.push(...info);
        }

        // Walls with Pset_WallCommon but no LoadBearing property → fail
        const noLoadBearingResult = newResults["loadBearingExists"];
        if (noLoadBearingResult) {
          const info = await resolveElementInfo(
            components,
            noLoadBearingResult.noMap,
            "LoadBearing-Property fehlt"
          );
          failingLists.push(...info);
        }

        // Combination test failures (LoadBearing true/false vs FireRating R/EI)
        for (const test of combinationTests) {
          const result = newCombinations[test.id];
          if (!result) continue;
          const info = await resolveElementInfo(
            components,
            result.failMap,
            `${test.branchLabel}, ${test.patternLabel} fehlt/falsch`
          );
          failingLists.push(...info);
        }

        setFailures(failingLists);
      } finally {
        setResolvingFailures(false);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [components, rootQuery, tree, combinationTests]);

  const highlightMap = useCallback(async (map: OBC.ModelIdMap, color: string) => {
    if (!components) return;
    const fragments = components.get(OBC.FragmentsManager);
    await fragments.resetHighlight();
    await fragments.highlight(
      {
        customId: "isolate",
        color: new THREE.Color(color),
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 1,
        transparent: false,
      },
      map
    );
    await fragments.core.update(true);
  }, [components]);

  const handleHighlightYes = useCallback(async (node: TreeNode) => {
    const result = results[node.id];
    if (!result) return;
    try {
      await highlightMap(result.yesMap, node.color);
      setHighlightedId(`${node.id}-yes`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [results, highlightMap]);

  const handleHighlightNo = useCallback(async (node: TreeNode) => {
    const result = results[node.id];
    if (!result) return;
    try {
      await highlightMap(result.noMap, "#ef4444");
      setHighlightedId(`${node.id}-no`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [results, highlightMap]);

  const handleHighlightCombination = useCallback(async (test: CombinationTest, branch: "pass" | "fail") => {
    const result = combinations[test.id];
    if (!result) return;
    try {
      const map = branch === "pass" ? result.passMap : result.failMap;
      const color = branch === "pass" ? test.color : "#ef4444";
      await highlightMap(map, color);
      setHighlightedId(`${test.id}-${branch}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [combinations, highlightMap]);

  const handleHighlightElement = useCallback(async (el: ElementInfo) => {
    const map: OBC.ModelIdMap = { [el.modelId]: new Set([el.localId]) };
    try {
      await highlightMap(map, "#ef4444");
      setHighlightedId(`element-${el.modelId}-${el.localId}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [highlightMap]);

  const handleToggleGhost = useCallback(async () => {
    const hl = getHl();
    if (!hl) return;
    try {
      if (ghostMode) {
        await hl.unghost();
      } else {
        await hl.ghost();
      }
      setGhostMode(!ghostMode);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [getHl, ghostMode]);

  const handleReset = useCallback(async () => {
    if (!components) return;
    setResetting(true);
    setError(null);
    try {
      const fragments = components.get(OBC.FragmentsManager);
      await fragments.resetHighlight();
      setResults({});
      setRootCount(null);
      setHighlightedId(null);
      setFailures([]);
      setCombinations({});
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components]);

  return {
    loading,
    resetting,
    ghostMode,
    error,
    disabled: !components,
    rootCount,
    results,
    combinations,
    failures,
    resolvingFailures,
    highlightedId,
    handleRunPipeline,
    handleReset,
    handleToggleGhost,
    handleHighlightYes,
    handleHighlightNo,
    handleHighlightCombination,
    handleHighlightElement,
  };
}
