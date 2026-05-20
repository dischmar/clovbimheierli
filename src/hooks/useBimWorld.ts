import { useEffect, useRef, useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import { createBimWorld, BimWorld } from "../bim/world";

export function useBimWorld(containerRef: React.RefObject<HTMLDivElement | null>) {
  const worldRef = useRef<BimWorld | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);


  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    createBimWorld(containerRef.current)
      .then((bimWorld) => {
        if (disposed) { bimWorld.dispose(); return; }
        worldRef.current = bimWorld;
        setReady(true);
      })
      .catch((err) => setError(String(err)));

    return () => {
      disposed = true;
      worldRef.current?.dispose();
      worldRef.current = null;
      setReady(false);
      setModelLoaded(false);
    };
  }, []);

  const loadIfc = useCallback(async (file: File) => {
    const bimWorld = worldRef.current;
    if (!bimWorld) return;

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const { components } = bimWorld;
      const ifcLoader = components.get(OBC.IfcLoader);

      await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/", absolute: true } });

      const buffer = await file.arrayBuffer();
      await ifcLoader.load(new Uint8Array(buffer), false, file.name, {
        processData: { progressCallback: (p: number) => setProgress(Math.round(p * 100)) },
      });

      // const bbox = components.get(OBC.BoundingBoxer);
      // const [model] = bimWorld.fragments.list.values();
      // if (model) {
      //   bbox.add(model);
      //   await world.camera.controls.fitToSphere(bbox.getSphere(), true);
      //   bbox.reset();
      // }

      setModelLoaded(true);
    } catch (err) {
      setError(`Failed to load IFC: ${err}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  return { worldRef, ready, loading, progress, error, modelLoaded, loadIfc };
}