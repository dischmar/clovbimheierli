import { useState, useEffect, useCallback } from "react";
import * as OBC from "@thatopen/components";
import { colors } from "../styles/tokens";

interface ClassifierPanelProps {
  components: OBC.Components | null;
}

interface GroupEntry {
  classification: string;
  name: string;
}

export function ClassifierPanel({ components }: ClassifierPanelProps) {
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshGroups = useCallback(() => {
    if (!components) return;
    const classifier = components.get(OBC.Classifier);
    const entries: GroupEntry[] = [];
    for (const [classification, groupMap] of classifier.list) {
      for (const [name] of groupMap) {
        entries.push({ classification, name });
      }
    }
    setGroups(entries);
  }, [components]);

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
      await classifier.byCategory();
      await classifier.byIfcBuildingStorey({ classificationName: "Levels" });
      refreshGroups();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAdding(false);
    }
  }, [components, refreshGroups]);

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
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>Classifier</span>
        <div style={s.actions}>
          <Btn onClick={handleAddDefaults} disabled={disabled || adding} color="#0f766e">
            {adding ? "Adding…" : "Add Defaults"}
          </Btn>
          <Btn onClick={handleResetVisibility} disabled={disabled || resetting} color={colors.accentBold}>
            {resetting ? "Resetting…" : "Reset Visibility"}
          </Btn>
        </div>
        {error && <div style={s.error}>{error}</div>}
      </div>

      <div style={s.body}>
        {groups.length === 0 ? (
          <Empty>Click "Add Defaults" to group elements by category and level</Empty>
        ) : (
          Object.entries(byClassification).map(([classification, names]) => (
            <div key={classification}>
              <div style={s.sectionTitle}>{classification}</div>
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
          ))
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, color }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; color: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "4px 10px", borderRadius: 5, border: "none",
      background: disabled ? colors.border : color,
      color: disabled ? colors.textDisabled : "#fff",
      fontSize: 11, fontFamily: "monospace", fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, color: colors.textMuted, fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
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
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  error: {
    marginTop: 8, padding: "6px 8px", background: "#2a0a0a",
    border: "1px solid #7f1d1d", borderRadius: 5, color: colors.errorLight, fontSize: 11,
  },
  body: { flex: 1, overflowY: "auto" },
  sectionTitle: {
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
