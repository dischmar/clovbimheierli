import { colors } from "../styles/tokens";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
}

/** Generic button-row tab switcher. Content switching is the caller's job. */
export function TabBar<T extends string>({ tabs, activeId, onChange }: TabBarProps<T>) {
  return (
    <div style={s.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{ ...s.tabBtn, ...(activeId === tab.id ? s.tabBtnActive : null) }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tabBar: {
    display: "flex", flexShrink: 0,
    borderBottom: `1px solid ${colors.border}`,
  },
  tabBtn: {
    flex: 1, padding: "6px 10px", border: "none", background: "transparent",
    color: colors.textMuted, fontSize: 11, fontFamily: "monospace", fontWeight: 600,
    letterSpacing: 0.5, textTransform: "uppercase" as const,
    cursor: "pointer", borderBottom: "2px solid transparent",
  },
  tabBtnActive: {
    color: colors.accent, borderBottom: `2px solid ${colors.accent}`,
  },
};
