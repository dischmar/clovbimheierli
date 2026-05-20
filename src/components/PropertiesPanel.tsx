import React, { useState, useCallback } from "react";
import type * as FRAGS from "@thatopen/fragments";
import type { SelectedItem } from "../types/ifc";
import { colors } from "../styles/tokens";

interface PropertiesPanelProps {
  selected: SelectedItem | null;
  onClose: () => void;
}

interface PsetGroup {
  name: string;
  props: [string, string][];
}

function val(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object" && "value" in (v as object)) {
    return val((v as FRAGS.ItemAttribute).value);
  }
  return String(v);
}

function directAttrs(data: FRAGS.ItemData): [string, string][] {
  const skip = new Set(["IsDefinedBy", "IsTypedBy", "type"]);
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v !== null && typeof v === "object" && "value" in (v as object)) {
      rows.push([k, val(v)]);
    }
  }
  return rows;
}

function extractPsets(data: FRAGS.ItemData): PsetGroup[] {
  const isDefinedBy = data.IsDefinedBy as FRAGS.ItemData[] | undefined;
  if (!Array.isArray(isDefinedBy)) return [];
  return isDefinedBy.flatMap((pset) => {
    if (typeof pset !== "object" || pset === null) return [];
    const name = val((pset as any).Name);
    if (!name || name === "—") return [];
    const hasProps = (pset as any).HasProperties as FRAGS.ItemData[] | undefined;
    if (!Array.isArray(hasProps)) return [];
    const props: [string, string][] = hasProps.flatMap((p) => {
      if (typeof p !== "object" || p === null || "[Circular]" in p) return [];
      const propName = val((p as any).Name);
      const propVal = val((p as any).NominalValue ?? (p as any).Value);
      if (!propName || propName === "—") return [];
      return [[propName, propVal]] as [string, string][];
    });
    return props.length > 0 ? [{ name, props }] : [];
  });
}

function extractTypeProps(data: FRAGS.ItemData): [string, string][] {
  const isTypedBy = data.IsTypedBy as FRAGS.ItemData[] | undefined;
  if (!Array.isArray(isTypedBy)) return [];
  return isTypedBy.flatMap((rel) => {
    if (typeof rel !== "object" || rel === null) return [];
    return directAttrs(rel as FRAGS.ItemData);
  });
}

function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  }, 2);
}

function stop(e: React.SyntheticEvent) {
  e.stopPropagation();
}

const blockProps = {
  onClick: stop,
  onPointerDown: stop,
  onPointerUp: stop,
  onPointerMove: stop,
  onMouseDown: stop,
  onMouseUp: stop,
  onMouseMove: stop,
  onTouchStart: stop,
  onTouchEnd: stop,
  onTouchMove: stop,
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr style={styles.row}>
      <td style={styles.tdKey}>{label}</td>
      <td style={styles.tdVal}>{value}</td>
    </tr>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((o) => !o);
  }, []);

  return (
    <div style={{ borderBottom: `1px solid ${colors.border}` }}>
      <button
        onClick={handleClick}
        onPointerDown={stop}
        onPointerUp={stop}
        onMouseDown={stop}
        onMouseUp={stop}
        style={styles.collapsibleBtn}
      >
        <span style={{ ...styles.chevron, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
          ›
        </span>
        {title}
        <span style={styles.badge}>{open ? "collapse" : "expand"}</span>
      </button>
      {open && children}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <span style={styles.emptyTitle}>No element selected</span>
      <span style={styles.emptyHint}>Click any element in the viewer to inspect its IFC properties.</span>
    </div>
  );
}

export function PropertiesPanel({ selected, onClose }: PropertiesPanelProps) {
  const attrs = selected?.attrs;
  const direct = attrs ? directAttrs(attrs) : [];
  const psets = attrs ? extractPsets(attrs) : [];
  const typeProps = attrs ? extractTypeProps(attrs) : [];
  const hasContent = direct.length > 0 || psets.length > 0 || typeProps.length > 0;

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!attrs) return;
    const json = safeStringify(attrs);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attrs-${selected?.localId ?? "element"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [attrs, selected?.localId]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  return (
    <div style={styles.panel} {...blockProps}>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ minWidth: 0 }}>
          <span style={styles.title}>Properties</span>
          {selected ? (
            <>
              <span style={styles.subtitle}>Local ID: {selected.localId}</span>
              <span style={styles.subtitle}>Model: {selected.modelId}</span>
            </>
          ) : (
            <span style={styles.subtitle}>IFC element inspector</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {selected && (
            <button onClick={handleDownload} onPointerDown={stop} onMouseDown={stop} style={styles.iconBtn} title="Download JSON">
              ↓
            </button>
          )}
          <button onClick={handleClose} onPointerDown={stop} onMouseDown={stop} style={styles.iconBtn} title="Close panel">
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {!selected ? (
          <EmptyState />
        ) : !hasContent ? (
          <span style={styles.empty}>No attributes found</span>
        ) : (
          <>
            {direct.length > 0 && (
              <Collapsible title="Attributes" defaultOpen>
                <table style={styles.table}>
                  <tbody>
                    {direct.map(([k, v]) => (
                      <Row key={k} label={k} value={v} />
                    ))}
                  </tbody>
                </table>
              </Collapsible>
            )}

            {psets.map((pset) => (
              <Collapsible key={pset.name} title={pset.name} defaultOpen={false}>
                <table style={styles.table}>
                  <tbody>
                    {pset.props.map(([k, v]) => (
                      <Row key={k} label={k} value={v} />
                    ))}
                  </tbody>
                </table>
              </Collapsible>
            ))}

            {typeProps.length > 0 && (
              <Collapsible title="Type Properties" defaultOpen={false}>
                <table style={styles.table}>
                  <tbody>
                    {typeProps.map(([k, v]) => (
                      <Row key={k} label={k} value={v} />
                    ))}
                  </tbody>
                </table>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 300,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: colors.panelBg,
    borderLeft: `1px solid ${colors.border}`,
    overflow: "hidden",
    fontFamily: "monospace",
    position: "relative",
    zIndex: 10,
    pointerEvents: "all",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
    gap: 8,
  },
  title: {
    display: "block",
    color: colors.accent,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  subtitle: {
    display: "block",
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 210,
  },
  iconBtn: {
    background: "none",
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 7px",
    borderRadius: 4,
  },
  body: {
    flex: 1,
    overflowY: "auto",
  },
  empty: {
    display: "block",
    padding: 14,
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    gap: 12,
    textAlign: "center",
  },
  emptyIcon: {
    color: colors.textDisabled,
    marginBottom: 4,
  },
  emptyTitle: {
    display: "block",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyHint: {
    display: "block",
    color: colors.textDisabled,
    fontSize: 11,
    lineHeight: 1.6,
  },
  collapsibleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "7px 12px",
    color: colors.accent,
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "left",
  },
  chevron: {
    display: "inline-block",
    fontSize: 14,
    lineHeight: 1,
    color: colors.textDisabled,
    transition: "transform 0.15s ease",
  },
  badge: {
    marginLeft: "auto",
    fontSize: 9,
    color: colors.textDisabled,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  row: {
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  tdKey: {
    padding: "5px 12px",
    color: colors.textSecondary,
    fontSize: 11,
    verticalAlign: "top",
    width: "45%",
    wordBreak: "break-word",
  },
  tdVal: {
    padding: "5px 12px 5px 0",
    color: colors.textPrimary,
    fontSize: 11,
    verticalAlign: "top",
    wordBreak: "break-word",
  },
};