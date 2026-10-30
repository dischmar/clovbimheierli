import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import type { ClassifierController } from "./types";

interface ClassifierToolbarProps {
  controller: ClassifierController;
}

/** Reset Visibility action for a single classifier controller (defaults are added automatically on mount). */
export function ClassifierToolbar({ controller }: ClassifierToolbarProps) {
  const { disabled, adding, resetting, handleResetVisibility } = controller;
  return (
    <div style={s.actions}>
      {adding && <span style={s.status}>Classifying…</span>}
      <Btn onClick={handleResetVisibility} disabled={disabled || resetting} color={colors.accentBold}>
        {resetting ? "Resetting…" : "Reset Visibility"}
      </Btn>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" },
  status: { color: colors.textMuted, fontSize: 11 },
};
