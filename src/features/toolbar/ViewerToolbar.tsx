import { colors } from "../../styles/tokens";
import { useViewerToolbar } from "./useViewerToolbar";
import type { ToolbarToolContext } from "./types";
import type { SelectedItem } from "../../types/ifc";
import { HiderSection } from "./HiderSection";
import { ToolbarSection, ts } from "./ToolbarSection";

interface ViewerToolbarProps {
  ctx: ToolbarToolContext | null;
  /** Fires whenever the active tool changes, so the rest of the app (e.g. click-to-select) can yield the viewport. */
  onActiveToolChange?: (activeToolId: string | null) => void;
  selected: SelectedItem | null;
  onClearSelection: () => void;
}

/** Modular bottom-center toolbar overlaying the 3D viewport. Only one tool is active at a time. */
export function ViewerToolbar({ ctx, onActiveToolChange, selected, onClearSelection }: ViewerToolbarProps) {
  const { tools, activeToolId, toggleTool } = useViewerToolbar(ctx, onActiveToolChange);

  if (!ctx || tools.length === 0) return null;

  return (
    <div style={s.wrap}>
      {tools.map((tool) => {
        const active = activeToolId === tool.id;
        return (
          <ToolbarSection key={tool.id} title={tool.label} icon={tool.icon} active={active}>
            <button
              onClick={() => toggleTool(tool.id)}
              title={active ? `Turn ${tool.label} off` : `Turn ${tool.label} on`}
              style={{ ...ts.button, ...(active ? ts.buttonActive : null) }}
            >
              {active ? "On" : "Off"}
            </button>
          </ToolbarSection>
        );
      })}
      <HiderSection
        components={ctx.components}
        selected={selected}
        onClearSelection={onClearSelection}
        suspended={activeToolId !== null}
      />
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
    alignItems: "stretch",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    background: colors.panelBg,
    border: `1px solid ${colors.border}`,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    zIndex: 10,
  },
};
