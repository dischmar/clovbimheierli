import { useEffect, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { colors } from "../../styles/tokens";
import type { SelectedItem } from "../../types/ifc";
import { ToolbarSection, ts } from "./ToolbarSection";

interface HiderSectionProps {
  components: OBC.Components;
  selected: SelectedItem | null;
  onClearSelection: () => void;
  /** A toolbar tool (e.g. Measure) owns the Delete key while active — hiding is paused then. */
  suspended: boolean;
}

/** Checkbox toggle: while checked, Delete/Backspace hides the currently selected element. */
export function HiderSection({ components, selected, onClearSelection, suspended }: HiderSectionProps) {
  const [enabled, setEnabled] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  // Only what this section hid, so "Show" doesn't undo isolates from other panels.
  const hiddenRef = useRef<OBC.ModelIdMap>({});

  useEffect(() => {
    if (!enabled || suspended || !selected) return;

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.code !== "Delete" && event.code !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const { modelId, localId } = selected;
      await components.get(OBC.Hider).set(false, { [modelId]: new Set([localId]) });
      (hiddenRef.current[modelId] ??= new Set<number>()).add(localId);
      setHiddenCount((n) => n + 1);
      onClearSelection();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, suspended, selected, components, onClearSelection]);

  const showHidden = async () => {
    await components.get(OBC.Hider).set(true, hiddenRef.current);
    hiddenRef.current = {};
    setHiddenCount(0);
  };

  return (
    <ToolbarSection title="Hide" icon="👁" active={enabled}>
      <label
        style={{ ...ts.checkboxLabel, color: enabled ? colors.accent : colors.textSecondary }}
        title="Click an element, then press Delete to hide it"
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={ts.checkbox}
        />
        Click + Del
      </label>
      <button
        onClick={showHidden}
        disabled={hiddenCount === 0}
        style={{ ...ts.button, opacity: hiddenCount === 0 ? 0.4 : 1, cursor: hiddenCount === 0 ? "default" : "pointer" }}
        title="Show all elements hidden here"
      >
        Show all{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
      </button>
    </ToolbarSection>
  );
}
