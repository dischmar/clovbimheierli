import { useState, useEffect, useCallback } from "react";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";
import type { ClassifierDefinition, GroupEntry } from "./types";
import { getClassifierColor } from "./classifierDefinitions";
import { runClassifierDefinition } from "./runClassifierDefinition";

interface ClassifierPanelProps {
  components: OBC.Components | null;
  /** Definitions this panel can add and whose groups it displays. */
  definitions: ClassifierDefinition[];
  /** Also add/show the generic "Category" and "Levels" classifications. */
  includeGeneralDefaults?: boolean;
  /** Classification names shown that aren't produced by `definitions` (e.g. a dynamic classifier). */
  extraClassifications?: string[];
  /** Extra classification step(s) run on "Add Defaults" that can't be expressed as a ClassifierDefinition. */
  dynamicSteps?: ((components: OBC.Components) => Promise<void>)[];
  emptyMessage?: string;
}

export function ClassifierPanel({
  components,
  definitions,
  includeGeneralDefaults = false,
  extraClassifications = [],
  dynamicSteps = [],
  emptyMessage = 'Click "Add Defaults" to group elements by category and level',
}: ClassifierPanelProps) {
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorizedClassification, setColorizedClassification] = useState<string | null>(null);

  const visibleClassifications = new Set(definitions.map((d) => d.classificationName));
  for (const name of extraClassifications) visibleClassifications.add(name);
  if (includeGeneralDefaults) {
    visibleClassifications.add("Category");
    visibleClassifications.add("Levels");
  }

  const refreshGroups = useCallback(() => {
    if (!components) return;
    const classifier = components.get(OBC.Classifier);
    const entries: GroupEntry[] = [];
    for (const [classification, groupMap] of classifier.list) {
      if (!visibleClassifications.has(classification)) continue;
      for (const [name] of groupMap) {
        entries.push({ classification, name });
      }
    }
    setGroups(entries);
  }, [components, definitions, includeGeneralDefaults, extraClassifications]);

  useEffect(() => {
    if (!components) return;
    const classifier = components.get(OBC.Classifier);
    const handler = () => setTimeout(() => refreshGroups());
    classifier.list.onItemSet.add(handler);
    refreshGroups();
    return () => { classifier.list.onItemSet.remove(handler); };
  }, [components, refreshGroups]);

  const handleAddDefaults = useCallback(async () => {
    if (!components) return;
    setAdding(true);
    setError(null);
    try {
      const classifier = components.get(OBC.Classifier);
      if (includeGeneralDefaults) {
        await classifier.byCategory();
        await classifier.byIfcBuildingStorey({ classificationName: "Levels" });
      }

      const failures: string[] = [];
      for (const def of definitions) {
        try {
          await runClassifierDefinition(components, def);
        } catch (e: any) {
          failures.push(`${def.queryName}: ${String(e?.message ?? e)}`);
        }
      }
      for (const step of dynamicSteps) {
        try {
          await step(components);
        } catch (e: any) {
          failures.push(String(e?.message ?? e));
        }
      }
      if (failures.length > 0) setError(failures.join(" | "));

      refreshGroups();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAdding(false);
    }
  }, [components, definitions, includeGeneralDefaults, dynamicSteps, refreshGroups]);


  const handleColorize = useCallback(async (classification: string, names: string[]) => {
    if (!components) return;
    const classifierMap = components.get(OBC.Classifier).list.get(classification);
    if (!classifierMap) return;
    const fragments = components.get(OBC.FragmentsManager);

    await fragments.resetHighlight();
    for (const name of names) {
      const color = getClassifierColor(name);
      const groupData = classifierMap.get(name);
      if (!color || !groupData) continue;
      const modelIdMap = await groupData.get();
      await fragments.highlight(
        {
          customId: `colorize-${name}`,
          color: new THREE.Color(color),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        modelIdMap
      );
    }
    await fragments.core.update(true);
  }, [components]);

  const handleToggleColorize = useCallback(async (classification: string, names: string[]) => {
    if (!components) return;
    const isColorized = colorizedClassification === classification;
    setLoadingGroup(classification);
    setError(null);
    try {
      if (isColorized) {
        const fragments = components.get(OBC.FragmentsManager);
        await fragments.resetHighlight();
        await fragments.core.update(true);
        setColorizedClassification(null);
      } else {
        await handleColorize(classification, names);
        setColorizedClassification(classification);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingGroup(null);
    }
  }, [components, colorizedClassification, handleColorize]);




  const handleIsolate = useCallback(async (entry: GroupEntry) => {
    if (!components) return;
    const key = `${entry.classification}::${entry.name}`;
    setLoadingGroup(key);
    setError(null);
    try {
      const classifier = components.get(OBC.Classifier);
      const classification = classifier.list.get(entry.classification);
      if (!classification) return;
      const groupData = classification.get(entry.name);
      if (!groupData) return;
      const hider = components.get(OBC.Hider);
      const modelIdMap = await groupData.get();
      await hider.isolate(modelIdMap);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingGroup(null);
    }
  }, [components]);

  const handleResetVisibility = useCallback(async () => {
    if (!components) return;
    setResetting(true);
    setError(null);
    try {
      const hider = components.get(OBC.Hider);
      await hider.set(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components]);

  const disabled = !components;

  const byClassification = groups.reduce<Record<string, string[]>>((acc, g) => {
    (acc[g.classification] ??= []).push(g.name);
    return acc;
  }, {});

  return (
    <Panel
      title=""
      width={260}
      header={
        <>
          <div style={s.actions}>
            <Btn onClick={handleAddDefaults} disabled={disabled || adding} color="#0f766e">
              {adding ? "Adding…" : "Add Defaults"}
            </Btn>
            <Btn onClick={handleResetVisibility} disabled={disabled || resetting} color={colors.accentBold}>
              {resetting ? "Resetting…" : "Reset Visibility"}
            </Btn>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
        </>
      }
    >
      {groups.length === 0 ? (
        <Empty>{emptyMessage}</Empty>
      ) : (
        Object.entries(byClassification).map(([classification, names]) => {
          const hasColors = names.some((name) => getClassifierColor(name));
          const isColorized = colorizedClassification === classification;
          const busy = loadingGroup === classification;
          return (
          <div key={classification}>
            <div style={s.sectionTitle}>
              <span>{classification}</span>
              {hasColors && (
                <Btn
                  onClick={() => handleToggleColorize(classification, names)}
                  disabled={disabled || !!loadingGroup}
                  color="#760f0f"
                >
                  {busy ? "Working…" : isColorized ? "Uncolorize" : "Colorize"}
                </Btn>
              )}
            </div>
            {names.map((name) => {
              const key = `${classification}::${name}`;
              const busy = loadingGroup === key;
              return (
                <div key={name} style={s.row}>
                  <span style={s.groupName}>{name}</span>
                  <button
                    onClick={() => handleIsolate({ classification, name })}
                    disabled={disabled || !!loadingGroup}
                    style={{
                      ...s.isolateBtn,
                      opacity: busy ? 0.6 : 1,
                      cursor: disabled || !!loadingGroup ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? "…" : "Isolate"}
                  </button>
                </div>
              );
            })}
          </div>
          );
        })
      )}
    </Panel>
  );
}

const s: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  sectionTitle: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    padding: "8px 12px 4px",
    color: colors.accent, fontSize: 10, fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase" as const,
    borderBottom: `1px solid ${colors.border}`,
  },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "5px 12px", borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  groupName: {
    color: colors.textPrimary, fontSize: 11,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
    flex: 1, marginRight: 8,
  },
  isolateBtn: {
    padding: "3px 8px", borderRadius: 4, border: `1px solid ${colors.border}`,
    background: "transparent", color: colors.accent,
    fontSize: 10, fontFamily: "monospace", fontWeight: 600,
    flexShrink: 0,
  },
};
