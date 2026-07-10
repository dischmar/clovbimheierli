import { colors } from "../styles/tokens";

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8, padding: "6px 8px", background: "#2a0a0a",
        border: "1px solid #7f1d1d", borderRadius: 5, color: colors.errorLight, fontSize: 11,
      }}
    >
      {children}
    </div>
  );
}
