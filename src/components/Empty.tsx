import { colors } from "../styles/tokens";

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, color: colors.textMuted, fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>
      {children}
    </div>
  );
}
