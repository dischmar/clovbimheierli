import { useState, useCallback } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";

type Orientation = "front" | "back" | "left" | "right" | "top" | "bottom";

interface BoxInfo {
  size: THREE.Vector3;
  center: THREE.Vector3;
}

interface BoundingBoxerPanelProps {
  components: OBC.Components | null;
  // The boxer needs an active world to fit/orient the camera and to host
  // Box3Helper visualizations, so it's passed in alongside `components`.
  world: OBC.World | null;
}

export function BoundingBoxerPanel({ components, world }: BoundingBoxerPanelProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("front");
  const [helpers, setHelpers] = useState<THREE.Box3Helper[]>([]);
  const [lastBox, setLastBox] = useState<BoxInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBoxer = useCallback((): OBC.BoundingBoxer | null => {
    if (!components) return null;
    try { return components.get(OBC.BoundingBoxer); } catch { return null; }
  }, [components]);


  const getClipper = useCallback((): OBC.Clipper | null => {
    if (!components) return null;
    try { return components.get(OBC.Clipper); } catch { return null; }
  }, [components]);

  const getCamera = useCallback((): OBC.OrthoPerspectiveCamera | null => {
    const camera = world?.camera as OBC.OrthoPerspectiveCamera | undefined;
    if (!camera?.controls) return null;
    return camera;
  }, [world]);

  const recordBox = (box: THREE.Box3) => {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    setLastBox({ size, center });
  };

  const addHelper = (box: THREE.Box3) => {
    if (!world) return;
    const helper = new THREE.Box3Helper(box);
    world.scene.three.add(helper);
    setHelpers((prev) => [...prev, helper]);
  };

  const getCategoryModelIdMap = async (category: string): Promise<OBC.ModelIdMap> => {
    const fragments = components!.get(OBC.FragmentsManager);
    const modelIdMap: OBC.ModelIdMap = {};
    for (const [modelId, model] of fragments.list) {
      const items = await model.getItemsOfCategories([new RegExp(`^${category}$`)]);
      const localIds = Object.values(items).flat();
      if (localIds.length) modelIdMap[modelId] = new Set(localIds);
    }
    return modelIdMap;
  };

  const handleLoadCategories = async () => {
    if (!components) return;
    setError(null);
    try {
      const fragments = components.get(OBC.FragmentsManager);
      if (fragments.list.size === 0) { setError("Load a model first"); return; }
      const set = new Set<string>();
      for (const [, model] of fragments.list) {
        const modelCategories = await model.getItemsWithGeometryCategories();
        for (const category of modelCategories) {
          if (category != null) set.add(category);
        }
      }
      const sorted = [...set].sort();
      setCategories(sorted);
      setSelectedCategory(sorted[0] ?? "");
      console.log("[BoundingBoxer] categories loaded:", sorted.length);
    } catch (e: any) {
      console.error("[BoundingBoxer] error loading categories:", e);
      setError(String(e?.message ?? e));
    }
  };

  const handleFitModels = () => {
    const boxer = getBoxer();
    const camera = getCamera();
    if (!boxer || !camera) { setError("Boxer or camera not available"); return; }
    setError(null);
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();
    recordBox(box);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    camera.controls.fitToSphere(sphere, true);
  };

  const handleAddModelsHelper = () => {
    const boxer = getBoxer();
    if (!boxer || !world) { setError("Boxer or world not available"); return; }
    setError(null);
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();
    recordBox(box);
    addHelper(box);
  };

  const handleClipper = () => {
    const boxer = getBoxer();
    const clipper = getClipper();
    if (!boxer || !clipper || !world) { setError("Boxer or world not available"); return; }
    setError(null);

    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const margin = size.clone().multiplyScalar(0.5);

    const faces: { normal: THREE.Vector3; point: THREE.Vector3 }[] = [
      { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(center.x - margin.x, center.y, center.z) },
      { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(center.x + margin.x, center.y, center.z) },
      { normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(center.x, center.y - margin.y, center.z) },
      { normal: new THREE.Vector3(0, -1, 0), point: new THREE.Vector3(center.x, center.y + margin.y, center.z) },
      { normal: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(center.x, center.y, center.z - margin.z) },
      { normal: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(center.x, center.y, center.z + margin.z) },
    ];

    for (const { normal, point } of faces) {
      clipper.createFromNormalAndCoplanarPoint(world, normal, point);
    }

    console.log(clipper);

    clipper.config.color = new THREE.Color("white");
    clipper.config.visible = true;
    clipper.config.opacity = 0.01;
    clipper.config.size = 1;
    recordBox(box);
    addHelper(box);
  };

  const handleCleanClipper = () => {
    const clipper = getClipper();
    clipper!.deleteAll();
  };

  const handleFitCategory = async () => {
    if (!selectedCategory) { setError("Load and pick a category first"); return; }
    const boxer = getBoxer();
    const camera = getCamera();
    if (!boxer || !camera) { setError("Boxer or camera not available"); return; }
    setLoading(true);
    setError(null);
    try {
      const modelIdMap = await getCategoryModelIdMap(selectedCategory);
      boxer.list.clear();
      await boxer.addFromModelIdMap(modelIdMap);
      const box = boxer.get();
      boxer.list.clear();
      recordBox(box);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      camera.controls.fitToSphere(sphere, true);
    } catch (e: any) {
      console.error("[BoundingBoxer] error fitting category:", e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategoryHelper = async () => {
    if (!selectedCategory) { setError("Load and pick a category first"); return; }
    const boxer = getBoxer();
    if (!boxer || !world) { setError("Boxer or world not available"); return; }
    setLoading(true);
    setError(null);
    try {
      const modelIdMap = await getCategoryModelIdMap(selectedCategory);
      boxer.list.clear();
      await boxer.addFromModelIdMap(modelIdMap);
      const box = boxer.get();
      boxer.list.clear();
      recordBox(box);
      addHelper(box);
    } catch (e: any) {
      console.error("[BoundingBoxer] error adding category helper:", e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleSetOrientation = async () => {
    const boxer = getBoxer();
    const camera = getCamera();
    if (!boxer || !camera) { setError("Boxer or camera not available"); return; }
    setLoading(true);
    setError(null);
    try {
      const { position, target } = await boxer.getCameraOrientation(orientation);
      await camera.controls.setLookAt(
        position.x, position.y, position.z,
        target.x, target.y, target.z,
        true,
      );
    } catch (e: any) {
      console.error("[BoundingBoxer] error setting orientation:", e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisposeHelpers = () => {
    if (!components || helpers.length === 0) return;
    const disposer = components.get(OBC.Disposer);
    for (const helper of helpers) disposer.destroy(helper);
    setHelpers([]);
  };

  const handleClear = () => {
    handleDisposeHelpers();
    setLastBox(null);
    setError(null);
  };

  const disabled = !components || !world;
  const hasBox = lastBox !== null;

  return (
    <Panel
      title="Bounding Boxer"
      width={280}
      bodyStyle={{ padding: "8px 0" }}
      header={
        <>
          {/* By models */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Models</span>
            <div style={s.row}>
              <Btn onClick={handleFitModels} disabled={disabled} color="#0f766e">Fit Models</Btn>
              <Btn onClick={handleAddModelsHelper} disabled={disabled} color="#6d28d9">Add Helper</Btn>
            </div>
          </div>

          {/* By category */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Category</span>
            <div style={s.row}>
              <Btn onClick={handleLoadCategories} disabled={disabled} color="#6d28d9">
                {categories.length ? "Reload" : "Load Categories"}
              </Btn>
              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={s.select}
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            {categories.length > 0 && (
              <div style={s.row}>
                <Btn onClick={handleFitCategory} disabled={disabled || loading} color="#0f766e">
                  {loading ? "Working…" : "Fit Category"}
                </Btn>
                <Btn onClick={handleAddCategoryHelper} disabled={disabled || loading} color="#6d28d9">
                  Add Helper
                </Btn>
              </div>
            )}
          </div>

          {/* Orientation */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Orientation</span>
            <div style={s.row}>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                style={s.select}
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
              <Btn onClick={handleSetOrientation} disabled={disabled || loading} color="#0f766e">
                Set View
              </Btn>
            </div>
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Always-visible actions */}
          <div style={s.actions}>
            <Btn onClick={handleDisposeHelpers} disabled={helpers.length === 0} color="#b45309">
              Dispose Helpers{helpers.length > 0 ? ` (${helpers.length})` : ""}
            </Btn>
            {hasBox && <Btn onClick={handleClear} disabled={false} color={colors.textMuted}>Clear</Btn>}
          </div>
        </>
      }
    >
      {!hasBox ? (
        <Empty>
          {disabled
            ? "Load a model in the viewer first"
            : "Fit or add a helper to compute a bounding box"}
        </Empty>
      ) : (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <span style={s.cardName}>Last Bounding Box</span>
          </div>
          <div style={s.dims}>
            <Dim label="Size" value={fmtVec(lastBox.size)} />
            <Dim label="Center" value={fmtVec(lastBox.center)} />
          </div>
        </div>
      )}

      <div style={s.clipperSection}>
        <span style={s.sectionLabel}>Clipper</span>
        <div style={s.row}>
          <Btn onClick={handleClipper} disabled={disabled} color="#0f766e">Clipping Planes</Btn>
          <Btn onClick={handleCleanClipper} disabled={disabled} color="#6d28d9">Delete Planes</Btn>
        </div>
      </div>
    </Panel>
  );
}

function Dim({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
      <span style={{ color: colors.textSecondary }}>{label}</span>
      <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function fmtVec(v: THREE.Vector3) {
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}

const s: Record<string, React.CSSProperties> = {
  section: { marginBottom: 10 },
  sectionLabel: {
    display: "block", color: colors.textMuted, fontWeight: 700, fontSize: 10,
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 6,
  },
  row: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" },
  select: {
    flex: 1, minWidth: 110, padding: "4px 6px", borderRadius: 5,
    border: `1px solid ${colors.border}`, background: colors.appBg, color: colors.textPrimary,
    fontSize: 11, fontFamily: "monospace",
  },
  actions: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  card: {
    margin: "0 10px 10px", padding: 10,
    background: colors.appBg, borderRadius: 7, border: `1px solid ${colors.border}`,
  },
  cardHeader: { marginBottom: 8 },
  cardName: { display: "block", color: colors.textPrimary, fontSize: 12, fontWeight: 700 },
  dims: { display: "flex", flexDirection: "column", gap: 4 },
  clipperSection: {
    margin: "0 10px 10px", paddingTop: 10, borderTop: `1px solid ${colors.border}`,
  },
};
