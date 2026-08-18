import { colors } from "../../styles/tokens";
import { useViewerToolbar } from "./useViewerToolbar";
import type { ToolbarToolContext } from "./types";

interface ViewerToolbarProps {
  ctx: ToolbarToolContext | null;
  /** Fires whenever the active tool changes, so the rest of the app (e.g. click-to-select) can yield the viewport. */
  onActiveToolChange?: (activeToolId: string | null) => void;
}

/** Modular bottom-center toolbar overlaying the 3D viewport. Only one tool is active at a time. */
export function ViewerToolbar({ ctx, onActiveToolChange }: ViewerToolbarProps) {
  const { tools, activeToolId, toggleTool } = useViewerToolbar(ctx, onActiveToolChange);

  if (!ctx || tools.length === 0) return null;

  return (
    <div style={s.wrap}>
      {tools.map((tool) => {
        const active = activeToolId === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => toggleTool(tool.id)}
            title={tool.label}
            style={{
              ...s.button,
              border: `1px solid ${active ? colors.accent : colors.border}`,
              background: active ? colors.border : colors.panelBg,
              color: active ? colors.accent : colors.textSecondary,
            }}
          >
            {tool.icon && <span style={s.icon}>{tool.icon}</span>}
            <span>{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    position: "absolute",
    left: "50%",
    bottom: 24,
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 10,
    background: colors.panelBg,
    border: `1px solid ${colors.border}`,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  button: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  icon: {
    fontSize: 14,
    lineHeight: 1,
  },
};
