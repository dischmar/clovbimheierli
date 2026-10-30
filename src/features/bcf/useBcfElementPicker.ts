import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import * as OBC from "@thatopen/components";

// Differs from the raycaster's green so an element it still highlights doesn't look picked.
const PICK_COLOR = "#f97316";
const MAX_CLICK_MOVEMENT = 4;

interface PickedElement {
  modelId: string;
  localId: number;
}

/**
 * While `picking`, clicks on the canvas toggle elements instead of inspecting them. Picks stay
 * highlighted until the hook unmounts, so they also appear in the snapshot saved with the task.
 */
export function useBcfElementPicker(components: OBC.Components | null, world: OBC.World | null) {
  const [picking, setPicking] = useState(false);
  const [guids, setGuids] = useState<string[]>([]);
  const pickedRef = useRef(new Map<string, PickedElement>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const unhighlight = useCallback(
    async (elements: PickedElement[]) => {
      if (!components) return;
      const fragments = components.get(OBC.FragmentsManager);
      for (const { modelId, localId } of elements) {
        await fragments.list.get(modelId)?.resetHighlight([localId]);
      }
      await fragments.core.update(true);
    },
    [components]
  );

  const togglePick = useCallback(
    async (e: MouseEvent, canvas: HTMLCanvasElement) => {
      if (!components || !world) return;
      const fragments = components.get(OBC.FragmentsManager);
      const mouse = new THREE.Vector2(e.clientX, e.clientY);
      const camera = world.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;

      const results: FRAGS.RaycastResult[] = [];
      for (const model of fragments.list.values()) {
        const result = await model.raycast({ camera, mouse, dom: canvas });
        if (result) results.push(result);
      }
      if (results.length === 0) return;
      const closest = results.reduce((a, b) => (b.distance < a.distance ? b : a));

      const { modelId } = closest.fragments;
      const { localId } = closest;
      const [guid] = await closest.fragments.getGuidsByLocalIds([localId]);
      if (!guid) return;

      const picked = pickedRef.current;
      const previous = picked.get(guid);
      if (previous) {
        picked.delete(guid);
        await unhighlight([previous]);
      } else {
        picked.set(guid, { modelId, localId });
        await closest.fragments.highlight([localId], {
          color: new THREE.Color(PICK_COLOR),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        });
        await fragments.core.update(true);
      }
      setGuids([...picked.keys()]);
    },
    [components, world, unhighlight]
  );

  useEffect(() => {
    const canvas = world?.renderer?.three.domElement;
    if (!picking || !canvas) return;

    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onClick = (e: MouseEvent) => {
      e.stopPropagation(); // Keeps useRaycaster on window from clearing the highlights.
      // Orbiting the camera ends with a click as well.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > MAX_CLICK_MOVEMENT) return;
      queueRef.current = queueRef.current.then(() => togglePick(e, canvas)).catch(console.error);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("click", onClick);
    };
  }, [picking, world, togglePick]);

  const clearPicks = useCallback(() => {
    const elements = [...pickedRef.current.values()];
    pickedRef.current.clear();
    setGuids([]);
    queueRef.current = queueRef.current.then(() => unhighlight(elements)).catch(console.error);
  }, [unhighlight]);

  useEffect(() => clearPicks, [clearPicks]);

  return { picking, guids, startPicking: () => setPicking(true), stopPicking: () => setPicking(false), clearPicks };
}
