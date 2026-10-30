import { colors } from "../../styles/tokens";

interface ToolbarSectionProps {
  title: string;
  icon?: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}

/** One titled group in the viewer toolbar: a small header with its controls underneath. */
export function ToolbarSection({ title, icon, active = false, children }: ToolbarSectionProps) {
  return (
    <div style={{ ...ts.section, borderColor: active ? colors.accent : colors.border }}>
      <div style={{ ...ts.title, color: active ? colors.accent : colors.textMuted }}>
        {icon && <span style={ts.titleIcon}>{icon}</span>}
        {title}
      </div>
      <div style={ts.controls}>{children}</div>
    </div>
  );
}

/** Shared control styles so every section's buttons and checkboxes look alike. */
export const ts: Record<string, React.CSSProperties> = {
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "6px 10px 8px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.appBg,
    minWidth: 84,
    transition: "border-color 0.15s",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    transition: "color 0.15s",
  },
  titleIcon: {
    display: "flex",
    fontSize: 13,
    lineHeight: 1,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  button: {
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    background: colors.panelBg,
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  buttonActive: {
    border: `1px solid ${colors.accent}`,
    background: colors.border,
    color: colors.accent,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    accentColor: colors.accent,
    cursor: "pointer",
    margin: 0,
  },
};
