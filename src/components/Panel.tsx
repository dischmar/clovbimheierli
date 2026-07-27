import { colors } from "../styles/tokens";

interface PanelProps {
  title: string;
  width?: number;
  /** Rendered inline on the same row as the title (e.g. a primary action button). */
  titleAction?: React.ReactNode;
  header?: React.ReactNode;
  bodyStyle?: React.CSSProperties;
  children: React.ReactNode;
  onClose?: () => void;
}

export function Panel({ title, width = 280, titleAction, header, bodyStyle, children, onClose }: PanelProps) {
  return (
    <div style={{ ...s.panel, width }}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <span style={s.title}>{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {titleAction}
            {onClose && (
              <button onClick={onClose} style={s.closeBtn} title="Close panel">
                ×
              </button>
            )}
          </div>
        </div>
        {header}
      </div>
      <div style={{ ...s.body, ...bodyStyle }}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    flexShrink: 0, display: "flex", flexDirection: "column",
    background: colors.panelBg, borderLeft: `1px solid ${colors.border}`,
    overflow: "hidden", fontFamily: "monospace",
  },
  header: { padding: "10px 12px", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 },
  titleRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, marginBottom: 10,
  },
  title: {
    color: colors.accent, fontWeight: 700, fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
  },
  body: { flex: 1, overflowY: "auto" },
  closeBtn: {
    background: "none",
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 7px",
    borderRadius: 4,
  },
};
