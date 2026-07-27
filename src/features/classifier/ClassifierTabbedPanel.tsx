import { useRef } from "react";
import * as OBC from "@thatopen/components";
import { ClassifierTabsContent } from "./ClassifierTabsContent";
import type { ClassifierResetHandle } from "./types";
import { Panel } from "../../components/Panel";
import { colors } from "../../styles/tokens";

interface ClassifierTabbedPanelProps {
  components: OBC.Components | null;
  world?: OBC.World | null;
  onClose?: () => void;
}

/** The multi-config classifier panel used in the viewer: one Panel wrapping `ClassifierTabsContent`. */
export function ClassifierTabbedPanel({ components, world = null, onClose }: ClassifierTabbedPanelProps) {
  const tabsRef = useRef<ClassifierResetHandle>(null);

  const handleClose = async () => {
    await tabsRef.current?.resetVisibility();
    onClose?.();
  };

  return (
    <Panel
      title="Classifier"
      width={260}
      onClose={handleClose}
      header={<span style={s.subtitle}>IFC element classifier</span>}
    >
      <ClassifierTabsContent ref={tabsRef} components={components} world={world} />
    </Panel>
  );
}

const s: Record<string, React.CSSProperties> = {
  subtitle: {
    display: "block", color: colors.textMuted, fontSize: 10, marginTop: 3,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    maxWidth: 210,
  },
};
