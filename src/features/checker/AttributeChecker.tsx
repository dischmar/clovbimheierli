import { useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { colors } from "../../styles/tokens";
import * as THREE from "three";
import { FrontFunctions } from "../hider/FrontFunctions";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";

interface FinderPanelProps {
  components: OBC.Components | null;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function countModelIdMap(map: OBC.ModelIdMap): number {
  return Object.values(map).reduce((sum, s) => sum + s.size, 0);
}

function intersectModelIdMaps(maps: OBC.ModelIdMap[]): OBC.ModelIdMap {
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

function subtractModelIdMaps(base: OBC.ModelIdMap, subtract: OBC.ModelIdMap): OBC.ModelIdMap {
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

interface ElementInfo {
  modelId: string;
  localId: number;
  name: string;
  guid?: string;
  reason: string; // which test it failed
}

/**
 * Resolve human-readable info (Name attribute, GUID) for each element in a ModelIdMap.
 */
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

// ── reusable query builders ─────────────────────────────────────────────────
// Each query is scoped to walls + Pset_WallCommon + HasProperties,
// filtered by a property Name (and optionally NominalValue).

const walls: FRAGS.ItemsQueryParams = { categories: [/WALL/] };

const wallsPsetCommon: FRAGS.ItemsQueryParams = {
  ...walls,
  relation: {
    name: "IsDefinedBy",
    query: {
      attributes: { queries: [{ name: /Name/, value: /Pset_WallCommon/ }] },
    },
  },
};

function withProperty(propertyQueries: { name: RegExp; value: any }[]): FRAGS.ItemsQueryParams {
  return {
    ...walls,
    relation: {
      name: "IsDefinedBy",
      query: {
        attributes: { queries: [{ name: /Name/, value: /Pset_WallCommon/ }] },
        relation: {
          name: "HasProperties",
          query: {
            attributes: { queries: propertyQueries },
          },
        },
      },
    },
  };
}

const loadBearingExists = withProperty([{ name: /Name/, value: /LoadBearing/ }]);
const loadBearingTrue = withProperty([
  { name: /Name/, value: /LoadBearing/ },
  { name: /NominalValue/, value: true },
]);
const loadBearingFalse = withProperty([
  { name: /Name/, value: /LoadBearing/ },
  { name: /NominalValue/, value: false },
]);

const fireRatingExists = withProperty([{ name: /Name/, value: /FireRating/ }]);
const fireRatingR = withProperty([
  { name: /Name/, value: /FireRating/ },
  { name: /NominalValue/, value: /^R\d+$/ },
]);
const fireRatingEI = withProperty([
  { name: /Name/, value: /FireRating/ },
  { name: /NominalValue/, value: /^EI\d+$/ },
]);

// ── tree definition ──────────────────────────────────────────────────────────
// Every node has a query (tested against its parent's "yes" population)
// and exactly two children: yes (vorhanden/true/bestanden) and no (nicht vorhanden/false/nicht bestanden).
// Leaf nodes have no children.

interface TreeNode {
  id: string;
  label: string;
  description: string;
  query: FRAGS.ItemsQueryParams;
  color: string;
  yesLabel?: string; // override default "Vorhanden"
  noLabel?: string;  // override default "Nicht vorhanden"
  yes?: TreeNode;
  no?: TreeNode;
  /** additional nodes tested at the same population as this node's "yes" set (parallel siblings) */
  siblings?: TreeNode[];
}

const TREE: TreeNode = {
  id: "psetCommon",
  label: "Pset_WallCommon",
  description: "Walls with Pset_WallCommon",
  query: wallsPsetCommon,
  color: "#60a5fa",
  yes: {
    id: "loadBearingExists",
    label: "LoadBearing (Property)",
    description: "Walls where LoadBearing property exists",
    query: loadBearingExists,
    color: "#fbbf24",
  },
};

// FireRating-Existenz wird auf derselben Ebene wie LoadBearing-Existenz geprüft,
// d.h. beide direkt unter Pset_WallCommon (Population = psetCommon.yes).
TREE.yes!.siblings = [
  {
    id: "fireRatingExists",
    label: "FireRating (Property)",
    description: "Walls where FireRating property exists",
    query: fireRatingExists,
    color: "#fb923c",
  },
];

// ── combination tests ─────────────────────────────────────────────────────────
// Population = Pset_WallCommon ∩ LoadBearing-vorhanden (FireRating-Existenz wird
// NICHT vorausgesetzt — fehlt FireRating komplett, zählt das auch als "Nicht bestanden").
// Within that population, split by LoadBearing value and check the matching
// FireRating pattern.

interface CombinationTest {
  id: string;
  label: string;
  description: string;
  /** population this test runs on = intersection of these node ids' "yes" sets */
  populationFromIds: string[];
  /** value query that defines the "branch" (e.g. LoadBearing = true) */
  branchQuery: FRAGS.ItemsQueryParams;
  branchLabel: string; // e.g. "LoadBearing = true"
  /** pattern query checked within the branch (e.g. FireRating = R...) */
  patternQuery: FRAGS.ItemsQueryParams;
  patternLabel: string; // e.g. "FireRating = R..."
  color: string;
}

const COMBINATION_TESTS: CombinationTest[] = [
  {
    id: "loadBearingTrue_fireR",
    label: "LoadBearing = true → FireRating = R...",
    description: "Load-bearing walls must have FireRating matching /^R\\d+$/",
    populationFromIds: ["psetCommon", "loadBearingExists"],
    branchQuery: loadBearingTrue,
    branchLabel: "LoadBearing = true",
    patternQuery: fireRatingR,
    patternLabel: "FireRating = R...",
    color: "#34d399",
  },
  {
    id: "loadBearingFalse_fireEI",
    label: "LoadBearing = false → FireRating = EI...",
    description: "Non-load-bearing walls must have FireRating matching /^EI\\d+$/",
    populationFromIds: ["psetCommon", "loadBearingExists"],
    branchQuery: loadBearingFalse,
    branchLabel: "LoadBearing = false",
    patternQuery: fireRatingEI,
    patternLabel: "FireRating = EI...",
    color: "#2dd4bf",
  },
];

// ── result tree ──────────────────────────────────────────────────────────────

interface NodeResult {
  yesMap: OBC.ModelIdMap;
  noMap: OBC.ModelIdMap;
  yesCount: number;
  noCount: number;
}

interface CombinationResult {
  branchMap: OBC.ModelIdMap;   // population in this branch (e.g. LoadBearing=true ∩ ...)
  branchCount: number;
  passMap: OBC.ModelIdMap;     // branch ∩ pattern (Bestanden)
  failMap: OBC.ModelIdMap;     // branch minus pass (Nicht bestanden)
  passCount: number;
  failCount: number;
}

type ResultTree = Record<string, NodeResult>;
type CombinationResultTree = Record<string, CombinationResult>;

// ── component ───────────────────────────────────────────────────────────────

export function AttributeChecker({ components }: FinderPanelProps) {
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

      // root population: all walls
      const rootMap = await testQuery("pipeline-root", walls);
      setRootCount(countModelIdMap(rootMap));

      // recursively walk the tree; siblings share the same population as `population`
      const walk = async (node: TreeNode, population: OBC.ModelIdMap) => {
        const raw = await testQuery(`pipeline-${node.id}`, node.query);
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

      await walk(TREE, rootMap);

      setResults(newResults);

      // ── combination tests ──────────────────────────────────────────────────
      const newCombinations: CombinationResultTree = {};
      for (const test of COMBINATION_TESTS) {
        // population = intersection of all referenced nodes' "yes" sets
        const maps = test.populationFromIds.map((id) => newResults[id]?.yesMap ?? {});
        const basePopulation = intersectModelIdMaps(maps);

        const rawBranch = await testQuery(`pipeline-${test.id}-branch`, test.branchQuery);
        const branchMap = intersectModelIdMaps([basePopulation, rawBranch]);

        const rawPattern = await testQuery(`pipeline-${test.id}-pattern`, test.patternQuery);
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
        for (const test of COMBINATION_TESTS) {
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
  }, [components]);

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

  const handleToggleGhost = async () => {
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
  };

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

  const disabled = !components;
  const hasResults = Object.keys(results).length > 0;

  return (
    <Panel
      title="Allplanfinder"
      width={320}
      bodyStyle={{ padding: "8px 0" }}
      header={
        <>
          <div style={s.actions}>
            <Btn
              onClick={handleRunPipeline}
              disabled={disabled || loading}
              color="#0f766e"
            >
              {loading ? "Running…" : "Run Pipeline"}
            </Btn>
            <Btn onClick={handleReset} disabled={disabled || resetting} color={colors.accentBold}>
              {resetting ? "Resetting…" : "Reset"}
            </Btn>
            <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
              {ghostMode ? "Unghost" : "Ghost"}
            </Btn>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
        </>
      }
    >
      {!hasResults ? (
        <Empty>{loading ? "Running pipeline…" : 'Click "Run Pipeline" to start'}</Empty>
      ) : (
        <>
          {rootCount !== null && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <span style={{ ...s.swatch, background: "#94a3b8" }} />
                <div style={{ flex: 1 }}>
                  <span style={s.cardName}>All Walls</span>
                  <span style={s.cardDesc}>Every wall in the model</span>
                </div>
              </div>
              <div style={s.counts}>
                <span style={s.count}>{rootCount} elements</span>
              </div>
            </div>
          )}
          <NodeCard
            node={TREE}
            results={results}
            highlightedId={highlightedId}
            disabled={disabled}
            onYes={handleHighlightYes}
            onNo={handleHighlightNo}
            depth={0}
          />

          <div style={s.failuresSection}>
            <div style={s.failuresHeader}>
              <span style={s.cardName}>Kombinationstests</span>
              <span style={s.cardDesc}>
                Basis: Pset_WallCommon ∩ LoadBearing vorhanden ∩ FireRating vorhanden
              </span>
            </div>
            {COMBINATION_TESTS.map((test) => {
              const result = combinations[test.id];
              if (!result) return null;
              const isPass = highlightedId === `${test.id}-pass`;
              const isFail = highlightedId === `${test.id}-fail`;
              return (
                <div key={test.id} style={s.card}>
                  <div style={s.cardHeader}>
                    <span style={{ ...s.swatch, background: test.color }} />
                    <div style={{ flex: 1 }}>
                      <span style={s.cardName}>{test.label}</span>
                      <span style={s.cardDesc}>{test.description}</span>
                    </div>
                  </div>
                  <div style={s.counts}>
                    <span style={s.count}>{result.branchCount} elements ({test.branchLabel})</span>
                  </div>
                  <div style={s.btnRow}>
                    <button
                      onClick={() => handleHighlightCombination(test, "pass")}
                      disabled={disabled}
                      style={{
                        ...s.highlightBtn,
                        borderColor: test.color,
                        color: isPass ? "#fff" : test.color,
                        background: isPass ? test.color : "transparent",
                      }}
                    >
                      Bestanden ({result.passCount})
                    </button>
                    <button
                      onClick={() => handleHighlightCombination(test, "fail")}
                      disabled={disabled}
                      style={{
                        ...s.highlightBtn,
                        borderColor: "#ef4444",
                        color: isFail ? "#fff" : "#ef4444",
                        background: isFail ? "#ef4444" : "transparent",
                      }}
                    >
                      Nicht bestanden ({result.failCount})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={s.failuresSection}>
            <div style={s.failuresHeader}>
              <span style={s.cardName}>
                Zu bearbeiten {resolvingFailures ? "…" : `(${failures.length})`}
              </span>
              <span style={s.cardDesc}>
                Walls ohne Pset_WallCommon/LoadBearing, oder mit falschem/fehlendem FireRating
              </span>
            </div>
            {failures.length === 0 && !resolvingFailures && (
              <div style={s.failuresEmpty}>Keine Elemente — alles bestanden ✓</div>
            )}
            {failures.map((el) => {
              const isActive = highlightedId === `element-${el.modelId}-${el.localId}`;
              return (
                <button
                  key={`${el.modelId}-${el.localId}`}
                  onClick={() => handleHighlightElement(el)}
                  disabled={disabled}
                  style={{
                    ...s.failureRow,
                    borderColor: isActive ? "#ef4444" : colors.border,
                    background: isActive ? "#2a0a0a" : "transparent",
                  }}
                >
                  <span style={s.failureName}>{el.name}</span>
                  <span style={s.failureReason}>{el.reason}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

// ── recursive node card ──────────────────────────────────────────────────────

function NodeCard({
  node,
  results,
  highlightedId,
  disabled,
  onYes,
  onNo,
  depth,
}: {
  node: TreeNode;
  results: ResultTree;
  highlightedId: string | null;
  disabled: boolean;
  onYes: (node: TreeNode) => void;
  onNo: (node: TreeNode) => void;
  depth: number;
}) {
  const result = results[node.id];
  if (!result) return null;

  const isYes = highlightedId === `${node.id}-yes`;
  const isNo = highlightedId === `${node.id}-no`;
  const yesLabel = node.yesLabel ?? "Vorhanden";
  const noLabel = node.noLabel ?? "Nicht vorhanden";

  return (
    <div style={{ ...s.card, marginLeft: depth * 12 }}>
      <div style={s.cardHeader}>
        <span style={{ ...s.swatch, background: node.color }} />
        <div style={{ flex: 1 }}>
          <span style={s.cardName}>{node.label}</span>
          <span style={s.cardDesc}>{node.description}</span>
        </div>
      </div>
      <div style={s.btnRow}>
        <button
          onClick={() => onYes(node)}
          disabled={disabled}
          style={{
            ...s.highlightBtn,
            borderColor: node.color,
            color: isYes ? "#fff" : node.color,
            background: isYes ? node.color : "transparent",
          }}
        >
          {yesLabel} ({result.yesCount})
        </button>
        <button
          onClick={() => onNo(node)}
          disabled={disabled}
          style={{
            ...s.highlightBtn,
            borderColor: "#ef4444",
            color: isNo ? "#fff" : "#ef4444",
            background: isNo ? "#ef4444" : "transparent",
          }}
        >
          {noLabel} ({result.noCount})
        </button>
      </div>

      {node.yes && (
        <>
          <div style={s.branch}>
            <NodeCard
              node={node.yes}
              results={results}
              highlightedId={highlightedId}
              disabled={disabled}
              onYes={onYes}
              onNo={onNo}
              depth={depth + 1}
            />
          </div>
          {node.yes.siblings?.map((sibling) => (
            <div key={sibling.id} style={s.branch}>
              <NodeCard
                node={sibling}
                results={results}
                highlightedId={highlightedId}
                disabled={disabled}
                onYes={onYes}
                onNo={onNo}
                depth={depth + 1}
              />
            </div>
          ))}
        </>
      )}
      {node.no && (
        <div style={s.branch}>
          <NodeCard
            node={node.no}
            results={results}
            highlightedId={highlightedId}
            disabled={disabled}
            onYes={onYes}
            onNo={onNo}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  card: {
    margin: "0 10px 10px", padding: 10,
    background: colors.appBg, borderRadius: 7, border: `1px solid ${colors.border}`,
  },
  cardHeader: { marginBottom: 8, display: "flex", gap: 8, alignItems: "flex-start" },
  swatch: {
    width: 10, height: 10, borderRadius: 3, marginTop: 3, flexShrink: 0,
  },
  cardName: { display: "block", color: colors.textPrimary, fontSize: 12, fontWeight: 700 },
  cardDesc: { display: "block", color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  counts: { display: "flex", gap: 10, alignItems: "center" },
  btnRow: { display: "flex", gap: 6 },
  count: { color: colors.textPrimary, fontSize: 11, fontWeight: 600 },
  branch: {
    marginTop: 8, paddingLeft: 8, borderLeft: `2px solid ${colors.border}`,
  },
  highlightBtn: {
    flex: 1, padding: "5px 10px", borderRadius: 5, border: "1px solid",
    fontSize: 11, fontFamily: "monospace", fontWeight: 600, cursor: "pointer",
    background: "transparent",
  },
  failuresSection: {
    margin: "12px 10px 10px", paddingTop: 10, borderTop: `1px solid ${colors.border}`,
  },
  failuresHeader: { marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 },
  failuresEmpty: {
    padding: "8px 10px", color: colors.success, fontSize: 11, textAlign: "center",
  },
  failureRow: {
    width: "100%", display: "flex", flexDirection: "column", gap: 2,
    padding: "6px 8px", marginBottom: 4, borderRadius: 5, border: `1px solid ${colors.border}`,
    background: "transparent", cursor: "pointer", textAlign: "left" as const,
    fontFamily: "monospace",
  },
  failureName: { color: colors.textPrimary, fontSize: 11, fontWeight: 600 },
  failureReason: { color: colors.errorLight, fontSize: 9 },
};
