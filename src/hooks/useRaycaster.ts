import { useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import { BimWorld } from "../bim/world";
import type { SelectedItem } from "../types/ifc";

export type { SelectedItem };

export function useRaycaster(worldRef: React.RefObject<BimWorld | null>) {
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const clearSelection = useCallback(() => setSelected(null), []);

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      if (!worldRef.current) { setTimeout(init, 100); return; }

      const { world, fragments } = worldRef.current;
      const canvas: HTMLCanvasElement = world.renderer.three.domElement;

      let lastResult: FRAGS.RaycastResult | null = null;

      const onClick = async (e: MouseEvent) => {
        const mouse = new THREE.Vector2(e.clientX, e.clientY);
        const camera = world.camera.three;

        // Reset previous highlight
        if (lastResult) {
          await lastResult.fragments.resetHighlight();
          await fragments.core.update(true);
          lastResult = null;
          setSelected(null);
        }

        const results: FRAGS.RaycastResult[] = [];
        for (const [, model] of fragments.core.models.list) {
          const result = await model.raycast({ camera, mouse, dom: canvas });
          if (result) results.push(result);
        }

        if (results.length === 0) return;

        const closest = results.reduce((a, b) =>
          b.distance < a.distance ? b : a
        );

        // Highlight selected element
        await closest.fragments.highlight(
          [closest.localId],
          {
            color: new THREE.Color("#bcf124"),
            renderedFaces: FRAGS.RenderedFaces.ONE,
            opacity: 1,
            transparent: false,
          }
        );
        await fragments.core.update(true);
        lastResult = closest;

        // Fetch attributes, property sets, and type properties
        const [attrs] = await closest.fragments.getItemsData(
          [closest.localId],
          {
            // Include all direct IFC attributes (Name, GlobalId, ObjectType, Tag…)
            attributesDefault: true,
            relations: {
              // IfcRelDefinesByProperties → all Psets (Pset_WallCommon, custom, etc.)
              IsDefinedBy: { attributes: true, relations: true },
              // IfcRelDefinesByType → type-level properties (IfcWallType, etc.)
              IsTypedBy: { attributes: true, relations: true },
            },
          }
        );



        setSelected({
          localId: closest.localId,
          modelId: closest.fragments.modelId,
          attrs: attrs ?? null,
        });
      };


      window.addEventListener("click", onClick);
      return () => window.removeEventListener("click", onClick);
    };

    let cleanup: (() => void) | undefined;
    const doInit = () => {
      if (cancelled) return;
      if (!worldRef.current) { setTimeout(doInit, 100); return; }
      cleanup = init() as any;
    };
    doInit();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return { selected, clearSelection };
}