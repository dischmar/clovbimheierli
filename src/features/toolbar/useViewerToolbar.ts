import { useEffect, useMemo, useState } from "react";
import type { ToolbarTool, ToolbarToolContext } from "./types";
import { createMeasureTool } from "./tools/measureTool";
import { createSliceTool } from "./tools/sliceTool";

/** Add new tools here — each factory receives the shared viewer context and returns an on/off toggle. */
const TOOL_FACTORIES = [createMeasureTool, createSliceTool];

export function useViewerToolbar(
  ctx: ToolbarToolContext | null,
  onActiveChange?: (activeToolId: string | null) => void
) {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const tools = useMemo<ToolbarTool[]>(() => {
    if (!ctx) return [];
    return TOOL_FACTORIES.map((factory) => factory(ctx));
  }, [ctx]);

  // Tools are rebuilt (e.g. on world reload) — make sure the old active one is switched off first.
  useEffect(() => {
    setActiveToolId(null);
  }, [tools]);

  useEffect(() => {
    onActiveChange?.(activeToolId);
  }, [activeToolId]);

  const toggleTool = (id: string) => {
    setActiveToolId((current) => {
      const next = current === id ? null : id;
      if (current) tools.find((t) => t.id === current)?.onDisable();
      if (next) tools.find((t) => t.id === next)?.onEnable();
      return next;
    });
  };

  return { tools, activeToolId, toggleTool };
}
