import { useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { colors } from "../styles/tokens";
import * as THREE from "three";
import { FrontFunctions } from "../bim/plugins/FrontFunctions";
import checksData from "../static/Check.json";

interface FinderPanelProps {
  components: OBC.Components | null;
}

interface TestCondition {
  name: string;
  pset?: string;
  property: string;
  valuePattern: string;
  valuePatternFlags?: string;
}

interface TestSpec {
  id: string;
  name: string;
  description: string;
  category: string;
  conditions: TestCondition[];
  operator: "intersect" | "subtract";
  passColor: string;
  failColor: string;
}

const TESTS: TestSpec[] = (checksData as { HeierliChecks: TestSpec[] }).HeierliChecks;


// ── helpers ─────────────────────────────────────────────────────────────────

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

function buildFinderQuery(category: string, cond: TestCondition) {
  const innerQuery: any = {
    relation: {
      name: "HasProperties",
      query: {
        attributes: {
          queries: [
            { name: /Name/, value: new RegExp(cond.property) },
            {
              name: /NominalValue/,
              value: new RegExp(cond.valuePattern, cond.valuePatternFlags),
            },
          ],
        },
      },
    },
  };

  if (cond.pset) {
    innerQuery.attributes = {
      queries: [{ name: /Name/, value: new RegExp(cond.pset) }],
    };
  }

  return {
    categories: [new RegExp(category)],
    relation: {
      name: "IsDefinedBy",
      query: innerQuery,
    },
  };
}

// ── component ───────────────────────────────────────────────────────────────

export function AttributeChecker({ components }: FinderPanelProps) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [results, setResults] = useState<
    Record<string, { pass: number; fail: number }>
  >({});

  const getHl = useCallback((): FrontFunctions | null => {
    if (!components) return null;
    try { return components.get(FrontFunctions); } catch { return null; }
  }, [components]);

  const handleRunTest = useCallback(async (spec: TestSpec) => {
    if (!components) return;
    setRunningId(spec.id);
    setError(null);
    try {
      const finder = components.get(OBC.ItemsFinder);
      const fragments = components.get(OBC.FragmentsManager);

      const conditionResults: OBC.ModelIdMap[] = [];

      for (const cond of spec.conditions) {
        const queryName = `${spec.id}-${cond.name}`;
        if (finder.list.get(queryName)) {
          finder.list.delete(queryName);
        }

        finder.create(queryName, [buildFinderQuery(spec.category, cond)]);

        const finderQuery = finder.list.get(queryName);
        if (!finderQuery) {
          setError(`Query "${queryName}" could not be created.`);
          return;
        }

        const result = await finderQuery.test();
        conditionResults.push(result);
      }

      let pass: OBC.ModelIdMap;
      let fail: OBC.ModelIdMap;

      if (spec.operator === "intersect") {
        pass = intersectModelIdMaps(conditionResults);
        fail = subtractModelIdMaps(conditionResults[0], pass);
      } else {
        pass = subtractModelIdMaps(conditionResults[0], conditionResults[1]);
        fail = intersectModelIdMaps(conditionResults);
      }

      const passCount = Object.values(pass).reduce((sum, s) => sum + s.size, 0);
      const failCount = Object.values(fail).reduce((sum, s) => sum + s.size, 0);
      setResults((prev) => ({ ...prev, [spec.id]: { pass: passCount, fail: failCount } }));

      await fragments.resetHighlight();
      await fragments.highlight(
        {
          customId: "isolate",
          color: new THREE.Color(spec.passColor),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        pass
      );
      await fragments.highlight(
        {
          customId: "isolate",
          color: new THREE.Color(spec.failColor),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        fail
      );
      await fragments.core.update(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setRunningId(null);
    }
  }, [components]);

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
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components]);

  const disabled = !components;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>HeierliChecker</span>

        <div style={s.actions}>
          <Btn onClick={handleReset} disabled={disabled || resetting} color={colors.accentBold}>
            {resetting ? "Resetting…" : "Reset"}
          </Btn>
          <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
            {ghostMode ? "Unghost" : "Ghost"}
          </Btn>
        </div>

        {error && <div style={s.error}>{error}</div>}
      </div>

      <div style={s.body}>
        {TESTS.map((spec) => {
          const busy = runningId === spec.id;
          const result = results[spec.id];
          return (
            <div key={spec.id} style={s.card}>
              <div style={s.cardHeader}>
                <span style={s.cardName}>{spec.name}</span>
                <span style={s.cardDesc}>{spec.description}</span>
              </div>
              <button
                onClick={() => handleRunTest(spec)}
                disabled={disabled || !!runningId}
                style={{
                  ...s.runBtn,
                  opacity: busy ? 0.6 : 1,
                  cursor: disabled || !!runningId ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Running…" : "Run Check"}
              </button>
              {result && (
                <div style={s.counts}>
                  <span style={s.pass}>✓ {result.pass} pass</span>
                  <span style={s.fail}>✗ {result.fail} fail</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, color }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px", borderRadius: 5, border: "none",
        background: disabled ? colors.border : color,
        color: disabled ? colors.textDisabled : "#fff",
        fontSize: 11, fontFamily: "monospace", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
    background: colors.panelBg, borderLeft: `1px solid ${colors.border}`,
    overflow: "hidden", fontFamily: "monospace",
  },
  header: {
    padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
  },
  title: {
    display: "block", color: colors.accent, fontWeight: 700, fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },
  actions: { display: "flex", gap: 6 },
  error: {
    marginTop: 8, padding: "6px 8px", background: "#2a0a0a",
    border: "1px solid #7f1d1d", borderRadius: 5, color: colors.errorLight, fontSize: 11,
  },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  card: {
    margin: "0 10px 10px", padding: 10,
    background: colors.appBg, borderRadius: 7, border: `1px solid ${colors.border}`,
  },
  cardHeader: { marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 },
  cardName: { color: colors.textPrimary, fontSize: 12, fontWeight: 700 },
  cardDesc: { color: colors.textSecondary, fontSize: 10 },
  runBtn: {
    width: "100%", padding: "5px 10px", borderRadius: 5, border: "none",
    background: "#0f766e", color: "#fff", fontSize: 11,
    fontFamily: "monospace", fontWeight: 600,
  },
  counts: { display: "flex", gap: 10, alignItems: "center", marginTop: 8 },
  pass: { color: colors.success, fontSize: 11, fontWeight: 600 },
  fail: { color: colors.error, fontSize: 11, fontWeight: 600 },
  input: {
    flex: 1, padding: "4px 8px", borderRadius: 5,
    border: `1px solid ${colors.border}`, background: colors.panelBg,
    color: colors.textPrimary, fontSize: 11, fontFamily: "monospace",
    minWidth: 0,
  },
};