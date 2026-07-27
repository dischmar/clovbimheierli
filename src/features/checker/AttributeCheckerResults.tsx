import { colors } from "../../styles/tokens";
import { Empty } from "../../components/Empty";
import type { CheckerConfig, CheckerController, ElementInfo, ResultTree, TreeNode } from "./types";

interface AttributeCheckerResultsProps {
  controller: CheckerController;
  config: CheckerConfig;
}

/** Root card + recursive tree + combination tests + failures list for one checker run. */
export function AttributeCheckerResults({ controller, config }: AttributeCheckerResultsProps) {
  const {
    loading, disabled, results, rootCount, highlightedId, combinations, failures, resolvingFailures,
    handleHighlightYes, handleHighlightNo, handleHighlightCombination, handleHighlightElement,
  } = controller;

  const hasResults = Object.keys(results).length > 0;

  if (!hasResults) {
    return <Empty>{loading ? "Running pipeline…" : 'Click "Run Pipeline" to start'}</Empty>;
  }

  return (
    <>
      {rootCount !== null && (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={{ ...s.swatch, background: "#94a3b8" }} />
            <div style={{ flex: 1 }}>
              <span style={s.cardName}>{config.rootLabel}</span>
              <span style={s.cardDesc}>{config.rootDescription}</span>
            </div>
          </div>
          <div style={s.counts}>
            <span style={s.count}>{rootCount} elements</span>
          </div>
        </div>
      )}

      <NodeCard
        node={config.tree}
        results={results}
        highlightedId={highlightedId}
        disabled={disabled}
        onYes={handleHighlightYes}
        onNo={handleHighlightNo}
        depth={0}
      />

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.cardName}>Kombinationstests</span>
          <span style={s.cardDesc}>
            Basis: Pset_WallCommon ∩ LoadBearing vorhanden ∩ FireRating vorhanden
          </span>
        </div>
        {config.combinationTests.map((test) => {
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

      <div style={s.section}>
        <div style={s.sectionHeader}>
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
        {failures.map((el) => (
          <FailureRow
            key={`${el.modelId}-${el.localId}`}
            el={el}
            active={highlightedId === `element-${el.modelId}-${el.localId}`}
            disabled={disabled}
            onClick={() => handleHighlightElement(el)}
          />
        ))}
      </div>
    </>
  );
}

function FailureRow({ el, active, disabled, onClick }: {
  el: ElementInfo;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s.failureRow,
        borderColor: active ? "#ef4444" : colors.border,
        background: active ? "#2a0a0a" : "transparent",
      }}
    >
      <span style={s.failureName}>{el.name}</span>
      <span style={s.failureReason}>{el.reason}</span>
    </button>
  );
}

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
  section: {
    margin: "12px 10px 10px", paddingTop: 10, borderTop: `1px solid ${colors.border}`,
  },
  sectionHeader: { marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 },
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
