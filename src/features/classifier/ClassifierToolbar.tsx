import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import type { ClassifierController } from "./types";

interface ClassifierToolbarProps {
  controller: ClassifierController;
}

/** Add Defaults / Reset Visibility actions for a single classifier controller. */
export function ClassifierToolbar({ controller }: ClassifierToolbarProps) {
  const { disabled, adding, resetting, handleAddDefaults, handleResetVisibility } = controller;
  return (
    <div style={s.actions}>
      <Btn onClick={handleAddDefaults} disabled={disabled || adding} color="#0f766e">
        {adding ? "Adding…" : "Add Defaults"}
      </Btn>
      <Btn onClick={handleResetVisibility} disabled={disabled || resetting} color={colors.accentBold}>
        {resetting ? "Resetting…" : "Reset Visibility"}
      </Btn>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
};
