import * as OBC from "@thatopen/components";
import { IdsParameters } from "./plugins/IdsParameters";

export interface BimWorld {
  components: OBC.Components;
  world: any;
  fragments: OBC.FragmentsManager;
  container: HTMLDivElement;
  dispose: () => void;
}

export async function createBimWorld(container: HTMLDivElement): Promise<BimWorld> {
  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);

  // Docs use SimpleRenderer — this is what makes castRay() work with no args
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = null;

        

  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.OrthoPerspectiveCamera(components);

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
    fragments.core.update(true);
  });

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = Math.random();
    }
  });

    // Register IdsParameters so components.get(IdsParameters) works everywhere
  new IdsParameters(components);

  return { components, world, fragments, container, dispose: () => components.dispose() };
}