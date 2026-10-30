import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { createComponents } from "./components";
import { createMouseOrbitControl } from "./mouseOrbitControl";
import { createSmoothWheelControl } from "./smoothWheelControl";
import * as THREE from "three";

export interface BimWorld {
  components: OBC.Components;
  world: any;
  fragments: OBC.FragmentsManager;
  container: HTMLDivElement;
  dispose: () => void;
}

export async function createBimWorld(container: HTMLDivElement): Promise<BimWorld> {
  const components = createComponents();
  const worlds = components.get(OBC.Worlds);

  // Docs use SimpleRenderer — this is what makes castRay() work with no args
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBC.SimpleRenderer
  >();

  const color = new THREE.Color("rgb(100%, 96%, 86%)");

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = color;

  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.OrthoPerspectiveCamera(components);

    // Create controls
  const smoothWheel = createSmoothWheelControl(world, components, container)
  const mouseOrbit = createMouseOrbitControl(world, components)

  // Add event listeners
  container.addEventListener('wheel', smoothWheel.wheelHandler, { passive: false })
  container.addEventListener('mousedown', mouseOrbit.mouseDownHandler, true)
  container.addEventListener('mousemove', mouseOrbit.mouseMoveHandler, true)
  container.addEventListener('touchstart', mouseOrbit.touchStartHandler, true)

  // Listeners must be removed before components.dispose(): otherwise a disposed world
  // (e.g. from a React StrictMode remount) keeps reacting to events on the same container
  // and throws "No camera initialized!".
  const removeControls = () => {
    container.removeEventListener('wheel', smoothWheel.wheelHandler)
    container.removeEventListener('mousedown', mouseOrbit.mouseDownHandler, true)
    container.removeEventListener('mousemove', mouseOrbit.mouseMoveHandler, true)
    container.removeEventListener('touchstart', mouseOrbit.touchStartHandler, true)
    smoothWheel.cleanup()
  }

  components.init();
  components.get(OBC.Grids).create(world);

  world.renderer.showLogo = false;

  const fragments = components.get(OBC.FragmentsManager);
  fragments.init("/worker.mjs");

  world.camera.controls.addEventListener("update", () => fragments.core.update());

  world.onCameraChanged.add((camera: any) => {
    for (const [, model] of fragments.list) model.useCamera(camera.three);
    fragments.core.update(true);
  });



  fragments.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    model.setLodMode(FRAGS.LodMode.ALL_VISIBLE);
    fragments.core.update(true);
  });

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = Math.random();
    }
  });




  return { components, world, fragments, container, dispose: () => { removeControls(); components.dispose(); } };
}
