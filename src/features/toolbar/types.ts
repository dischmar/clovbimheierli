import type * as OBC from "@thatopen/components";

export interface ToolbarToolContext {
  components: OBC.Components;
  world: any;
  container: HTMLDivElement;
}

export interface ToolbarTool {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Called once when the tool is switched on. */
  onEnable: () => void;
  /** Called once when the tool is switched off. */
  onDisable: () => void;
}
