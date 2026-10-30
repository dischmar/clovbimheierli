import { forwardRef, useImperativeHandle, useState } from "react";
import * as OBC from "@thatopen/components";
import { TabBar, type TabItem } from "../../components/TabBar";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ClassifierToolbar } from "./ClassifierToolbar";
import { ClassifierGroupList } from "./ClassifierGroupList";
import { useClassifierController } from "./useClassifierController";
import type { ClassifierConfig, ClassifierResetHandle } from "./types";
import { CONCRETE_CLASSIFIER_DEFINITIONS, REINFORCEMENT_CLASSIFIER_DEFINITIONS } from "./classifierDefinitions";
import { classifyPositionsnummer, POSITIONSNUMMER_CLASSIFICATION } from "./classifyPositionsnummer";

type TabId = "beton" | "bewehrung";

// Add a tab by adding one entry here — id, label, and the classifier config it renders.
const TAB_CONFIGS: (TabItem<TabId> & { config: ClassifierConfig })[] = [
  {
    id: "beton",
    label: "Schalung",
    config: {
      definitions: CONCRETE_CLASSIFIER_DEFINITIONS,
      includeGeneralDefaults: true,
      emptyMessage: 'No elements matched the category, level or concrete property groups',
    },
  },
  {
    id: "bewehrung",
    label: "Bewehrung",
    config: {
      definitions: REINFORCEMENT_CLASSIFIER_DEFINITIONS,
      extraClassifications: [POSITIONSNUMMER_CLASSIFICATION],
      dynamicSteps: [classifyPositionsnummer],
      emptyMessage: 'No reinforcement elements found',
    },
  },
];

interface ClassifierTabsContentProps {
  components: OBC.Components | null;
  world?: OBC.World | null;
}

/**
 * Multi-config classifier view: a `TabBar` plus, per active tab, the same
 * `ClassifierToolbar` + `ClassifierGroupList` pair `ClassifierSinglePanel` uses
 * standalone. No `Panel` of its own — embed it inside one (see `ClassifierTabbedPanel`).
 */
export const ClassifierTabsContent = forwardRef<ClassifierResetHandle, ClassifierTabsContentProps>(function ClassifierTabsContent({
  components,
  world = null,
}, ref) {
  const [activeId, setActiveId] = useState<TabId>(TAB_CONFIGS[0].id);
  const active = TAB_CONFIGS.find((tab) => tab.id === activeId)!;

  return (
    <div style={s.wrapper}>
      <TabBar tabs={TAB_CONFIGS} activeId={activeId} onChange={setActiveId} />
      {/* Keying on the tab id remounts the pane on switch, so each tab
          starts with fresh state instead of inheriting the previous tab's
          isolate/colorize selection. */}
      <ClassifierTabPane key={activeId} ref={ref} components={components} world={world} config={active.config} />
    </div>
  );
});

interface ClassifierTabPaneProps {
  components: OBC.Components | null;
  world: OBC.World | null;
  config: ClassifierConfig;
}

/** One tab's worth of classifier UI — same shape as `ClassifierSinglePanel`'s body, minus the `Panel` wrapper. */
const ClassifierTabPane = forwardRef<ClassifierResetHandle, ClassifierTabPaneProps>(function ClassifierTabPane({
  components,
  world,
  config,
}, ref) {
  const controller = useClassifierController({ components, world, config });

  useImperativeHandle(ref, () => ({ resetVisibility: controller.handleResetVisibilityDefaults }), [controller.handleResetVisibilityDefaults]);

  return (
    <div>
      <div style={s.toolbarRow}>
        <ClassifierToolbar controller={controller} />
        {controller.error && <ErrorBanner>{controller.error}</ErrorBanner>}
      </div>
      <ClassifierGroupList controller={controller} emptyMessage={config.emptyMessage ?? ""} canColorize={!!world} />
    </div>
  );
});

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column" },
  toolbarRow: { padding: "10px 12px" },
};
