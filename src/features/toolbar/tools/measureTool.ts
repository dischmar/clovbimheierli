import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import type { ToolbarTool, ToolbarToolContext } from "../types";

/** Length measurement tool: double-click to place a dimension, Delete/Backspace to remove one. */
export function createMeasureTool({ components, world, container }: ToolbarToolContext): ToolbarTool {
  const measurer = components.get(OBF.LengthMeasurement);
  measurer.world = world;
  measurer.color = new THREE.Color("#494cb6");
  measurer.snappings = [FRAGS.SnappingClass.POINT];
  measurer.enabled = false;

  const onDblClick = () => measurer.create();


  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Delete" || event.code === "Backspace") {
      measurer.delete();
    }
  };

  return {
    id: "measure",
    label: "Measure",
    icon: "📏",
    onEnable: () => {
      measurer.enabled = true;
      container.addEventListener("dblclick", onDblClick);
      window.addEventListener("keydown", onKeyDown);
    },
    onDisable: () => {
      measurer.enabled = false;
      container.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
