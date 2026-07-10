import { colors } from "../styles/tokens";

interface BtnProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}

export function Btn({ children, onClick, disabled, color }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px", borderRadius: 5, border: "none",
        background: disabled ? colors.border : color,
        color: disabled ? colors.textDisabled : "#fff",
        fontSize: 11, fontFamily: "monospace", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
