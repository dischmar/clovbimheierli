import { useEffect, useRef, useState, useCallback } from "react";
import { createBimWorld, BimWorld } from "../core/world";
import { loadIfc } from "../core/ifc-loader";

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

  const loadIfcFile = useCallback(async (file: File) => {
    const bimWorld = worldRef.current;
    if (!bimWorld) return;

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      await loadIfc(bimWorld.components, file, setProgress);
      setModelLoaded(true);
    } catch (err) {
      setError(`Failed to load IFC: ${err}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  return { worldRef, ready, loading, progress, error, modelLoaded, loadIfc: loadIfcFile };
}
