import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { getClassifierColor } from "./classifierDefinitions";
import type { ClassifierController } from "./types";

interface ClassifierGroupListProps {
  controller: ClassifierController;
  /** Shown in place of the list when there are no groups yet. */
  emptyMessage: string;
  /** Whether mesh Colorize is available (needs a world to host the overlay meshes). */
  canColorize: boolean;
}

/** Renders one classifier controller's groups, with per-classification Colorize and per-group Isolate. */
export function ClassifierGroupList({ controller, emptyMessage, canColorize }: ClassifierGroupListProps) {
  const {
    byClassification, disabled, loadingGroup, meshColorizedClassification, isolatedKey,
    handleToggleColorizeMesh, handleToggleIsolate,
  } = controller;

  if (Object.keys(byClassification).length === 0) {
    return <Empty>{emptyMessage}</Empty>;
  }

  return (
    <>
      {Object.entries(byClassification).map(([classification, names]) => {
        const hasColors = names.some((name) => getClassifierColor(name));
        const isMeshColorized = meshColorizedClassification === classification;
        const meshBusy = loadingGroup === `mesh::${classification}`;
        return (
          <div key={classification}>
            <div style={s.sectionTitle}>
              <span>{classification}</span>
              {hasColors && (
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn
                    onClick={() => handleToggleColorizeMesh(classification, names)}
                    disabled={disabled || !canColorize || !!loadingGroup}
                    color="#0f4c76"
                  >
                    {meshBusy ? "Working…" : isMeshColorized ? "Uncolorize" : "Colorize"}
                  </Btn>
                </div>
              )}
            </div>
            {names.map((name) => {
              const key = `${classification}::${name}`;
              const isolateBusy = loadingGroup === `isolate::${key}`;
              const isIsolated = isolatedKey === key;
              return (
                <div key={name} style={s.row}>
                  <span style={s.groupName}>{name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => handleToggleIsolate({ classification, name })}
                      disabled={disabled || !!loadingGroup}
                      style={{
                        ...s.isolateBtn,
                        opacity: isolateBusy ? 0.6 : 1,
                        cursor: disabled || !!loadingGroup ? "not-allowed" : "pointer",
                        backgroundColor: isIsolated ? colors.accentBold : getClassifierColor(name),
                        color: "#343434",
                        outline: isIsolated ? `2px solid ${colors.accentBold}` : "none",
                      }}
                    >
                      {isolateBusy ? "…" : isIsolated ? "Un-isolate" : "Isolate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
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
    fontSize: 10, fontFamily: "monospace", fontWeight: 600,
    flexShrink: 0,
  },
};
