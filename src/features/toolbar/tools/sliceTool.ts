import type { ToolbarTool, ToolbarToolContext } from "../types";
import * as OBC from "@thatopen/components";
import { IoCutSharp } from "react-icons/io5";
import { createElement } from "react";
import * as OBF from "@thatopen/components-front"
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";


/** Placeholder — real slicing logic to be wired in later. */
export function createSliceTool({ components, world, container }: ToolbarToolContext): ToolbarTool {
  const casters = components.get(OBC.Raycasters);
  casters.get(world);



  const clipper = components.get(OBC.Clipper);

  clipper.config.color = new THREE.Color("purple");
  clipper.config.visible = true;
  clipper.config.opacity = 0.5;
  clipper.config.size = 1;

  const clipStyler = components.get(OBF.ClipStyler);
  clipStyler.world = world;

  clipStyler.styles.set("Green", {
  linesMaterial: new LineMaterial({ color: "black", linewidth: 4 }),
  fillsMaterial: new THREE.MeshBasicMaterial({
    color: "lightgreen",
    side: 2,
    opacity: 0.4,

  }),
});

  container.ondblclick = () => {
    console.log("doubleclick")
  if (clipper.enabled) {
    clipper.create(world);
  }
};

console.log(clipper.list)

clipper.list.onItemSet.add(({ key }) => {
  // As you see, there is an special method to link
  // clipping planes with the ClipStyler.
  clipStyler.createFromClipping(key, {
    items: { All: { style: "Green" } },
  });
});



window.onkeydown = (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    if (clipper.enabled) clipper.delete(world);
  }
};

const resetClippings = () => {
  clipper.deleteAll();
  clipper.enabled = false;
}




  return {
    id: "slice",
    label: "Slice",
    icon: createElement(IoCutSharp, { color: "#76ddeb", size: 20 }),
    onEnable: () => {
      clipper.enabled = true;
    },
    onDisable: () => {
      resetClippings();
    },
  };
}
