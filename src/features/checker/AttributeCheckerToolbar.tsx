import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import type { CheckerController } from "./types";

interface AttributeCheckerToolbarProps {
  controller: CheckerController;
}

/** Run Pipeline / Reset / Ghost actions for a single checker controller. */
export function AttributeCheckerToolbar({ controller }: AttributeCheckerToolbarProps) {
  const { disabled, loading, resetting, ghostMode, handleRunPipeline, handleReset, handleToggleGhost } = controller;
  return (
    <div style={s.actions}>
      <Btn onClick={handleRunPipeline} disabled={disabled || loading} color="#0f766e">
        {loading ? "Running…" : "Run Pipeline"}
      </Btn>
      <Btn onClick={handleReset} disabled={disabled || resetting} color={colors.accentBold}>
        {resetting ? "Resetting…" : "Reset"}
      </Btn>
      <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
        {ghostMode ? "Unghost" : "Ghost"}
      </Btn>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
};
