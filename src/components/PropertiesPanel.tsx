import type { SelectedItem } from "../hooks/useRaycaster";

interface PropertiesPanelProps {
  selected: SelectedItem;
  onClose: () => void;
}

export function PropertiesPanel({ selected, onClose }: PropertiesPanelProps) {
  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <span style={styles.title}>Properties</span>
          <span style={styles.subtitle}>Local ID: {selected.localId}</span>
          <span style={styles.subtitle}>Model: {selected.modelId}</span>
        </div>
        <button onClick={onClose} style={styles.closeBtn} title="Close">×</button>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {selected.attrs ? (
          <AttributesTable attrs={selected.attrs as Record<string, any>} />
        ) : (
          <span style={styles.empty}>No attributes found</span>
        )}
      </div>
    </div>
  );
}

// ── Attributes table ───────────────────────────────────────────────────────────
function AttributesTable({ attrs }: { attrs: Record<string, any> }) {
  const rows = flattenAttrs(attrs);
  return (
    <table style={styles.table}>
      <tbody>
        {rows.map(([key, val]) => (
          <tr key={key} style={styles.row}>
            <td style={styles.tdKey}>{key}</td>
            <td style={styles.tdVal}>{String(val ?? "—")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function flattenAttrs(obj: Record<string, any>, prefix = ""): [string, any][] {
  const rows: [string, any][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      rows.push(...flattenAttrs(v, key));
    } else {
      rows.push([key, v]);
    }
  }
  return rows;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 300,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: "#12121e",
    borderLeft: "1px solid #1e1e38",
    overflow: "hidden",
    fontFamily: "monospace",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: "1px solid #1e1e38",
    flexShrink: 0,
    gap: 8,
  },
  title: {
    display: "block",
    color: "#a78bfa",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  subtitle: {
    display: "block",
    color: "#6b7280",
    fontSize: 10,
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 210,
  },
  closeBtn: {
    background: "none",
    border: "1px solid #1e1e38",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 7px",
    borderRadius: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: "auto",
  },
  empty: {
    display: "block",
    padding: 14,
    color: "#6b7280",
    fontSize: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  row: {
    borderBottom: "1px solid #1a1a2e",
  },
  tdKey: {
    padding: "5px 12px",
    color: "#9ca3af",
    fontSize: 11,
    verticalAlign: "top",
    width: "45%",
    wordBreak: "break-word",
  },
  tdVal: {
    padding: "5px 12px 5px 0",
    color: "#e5e7eb",
    fontSize: 11,
    verticalAlign: "top",
    wordBreak: "break-word",
  },
};