import { forwardRef, useImperativeHandle } from "react";
import * as OBC from "@thatopen/components";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";
import { useClassifierController } from "./useClassifierController";
import { ClassifierToolbar } from "./ClassifierToolbar";
import { ClassifierGroupList } from "./ClassifierGroupList";
import type { ClassifierConfig, ClassifierResetHandle } from "./types";

interface ClassifierSinglePanelProps extends ClassifierConfig {
  components: OBC.Components | null;
  /** Needed to host the custom-geometry mesh overlays created by Colorize. */
  world?: OBC.World | null;
  onClose?: () => void;
}

const DEFAULT_EMPTY_MESSAGE = 'No elements matched the category or level groups';

/**
 * Self-contained classifier view: one Panel, one config, no tabs. This is the
 * pattern to copy for any future single-config panel — swap `Toolbar`/`GroupList`
 * for your own content, still built on the same `Panel` chrome (title, close ×).
 * Compare with `ClassifierTabbedPanel`, the multi-config equivalent.
 */
export const ClassifierSinglePanel = forwardRef<ClassifierResetHandle, ClassifierSinglePanelProps>(function ClassifierSinglePanel({
  components,
  world = null,
  onClose,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  ...config
}, ref) {
  const controller = useClassifierController({ components, world, config });

  useImperativeHandle(ref, () => ({ resetVisibility: controller.handleResetVisibilityDefaults }), [controller.handleResetVisibilityDefaults]);

  return (
    <Panel
      title=""
      width={260}
      onClose={onClose}
      titleAction={<ClassifierToolbar controller={controller} />}
      header={controller.error ? <ErrorBanner>{controller.error}</ErrorBanner> : undefined}
    >
      <ClassifierGroupList controller={controller} emptyMessage={emptyMessage} canColorize={!!world} />
    </Panel>
  );
});
