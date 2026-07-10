import { useState } from "react";
import * as OBC from "@thatopen/components";
import { colors } from "../../styles/tokens";
import { ClassifierPanel } from "./ClassifierPanel";
import { CONCRETE_CLASSIFIER_DEFINITIONS, REINFORCEMENT_CLASSIFIER_DEFINITIONS } from "./classifierDefinitions";
import { classifyPositionsnummer, POSITIONSNUMMER_CLASSIFICATION } from "./classifyPositionsnummer";

const BEWEHRUNG_DYNAMIC_STEPS = [classifyPositionsnummer];
const BEWEHRUNG_EXTRA_CLASSIFICATIONS = [POSITIONSNUMMER_CLASSIFICATION];

interface ClassifierTabsProps {
  components: OBC.Components | null;
}

// 1) Add the new tab's id here.

type TabId = "beton" | "bewehrung";


// 2) Add one entry per tab — each `id` must be unique, it's what wires the
// button to its content below.
const TABS: { id: TabId; label: string }[] = [
  { id: "beton", label: "Beton" },
  { id: "bewehrung", label: "Bewehrung" },
];

export function ClassifierTabs({ components }: ClassifierTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("beton");

  return (
    <div style={s.wrapper}>
      <div style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...s.tabBtn,
              ...(activeTab === tab.id ? s.tabBtnActive : null),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {/* 3) Add one render line per tab, guarded by its own unique id. */}
        {activeTab === "beton" && (
          <ClassifierPanel
            components={components}
            definitions={CONCRETE_CLASSIFIER_DEFINITIONS}
            includeGeneralDefaults
            emptyMessage='Click "Add Defaults" to group elements by category, level and concrete properties'
          />
        )}
        {activeTab === "bewehrung" && (
          <ClassifierPanel
            components={components}
            definitions={REINFORCEMENT_CLASSIFIER_DEFINITIONS}
            extraClassifications={BEWEHRUNG_EXTRA_CLASSIFICATIONS}
            dynamicSteps={BEWEHRUNG_DYNAMIC_STEPS}
            emptyMessage='Click "Add Defaults" to group reinforcement elements'
          />
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
  },
  content: {
    flex: 1, minHeight: 0, display: "flex",
  },
  tabBar: {
    display: "flex", background: colors.panelBg,
    borderLeft: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`,
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
