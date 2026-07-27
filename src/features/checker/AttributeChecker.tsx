import * as OBC from "@thatopen/components";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";
import { useAttributeCheckerController } from "./useAttributeCheckerController";
import { AttributeCheckerToolbar } from "./AttributeCheckerToolbar";
import { AttributeCheckerResults } from "./AttributeCheckerResults";
import { WALL_CHECKER_CONFIG } from "./wallCheckerTree";
import type { CheckerConfig } from "./types";

interface AttributeCheckerProps {
  components: OBC.Components | null;
  /** Defaults to the built-in wall Pset_WallCommon/LoadBearing/FireRating pipeline. */
  config?: CheckerConfig;
}

/**
 * Self-contained checker view: one Panel, one config. Same shape as the
 * classifier's `ClassifierSinglePanel` — swap `config` for a different
 * population/tree, or swap `Toolbar`/`Results` for different content, all on
 * the same `Panel` chrome.
 */
export function AttributeChecker({ components, config = WALL_CHECKER_CONFIG }: AttributeCheckerProps) {
  const controller = useAttributeCheckerController({ components, config });

  return (
    <Panel
      title="Attribute Checker"
      width={320}
      bodyStyle={{ padding: "8px 0" }}
      header={
        <>
          <AttributeCheckerToolbar controller={controller} />
          {controller.error && <ErrorBanner>{controller.error}</ErrorBanner>}
        </>
      }
    >
      <AttributeCheckerResults controller={controller} config={config} />
    </Panel>
  );
}
