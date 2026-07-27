import { useState, useEffect, useCallback, useRef } from "react";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { ClassifierConfig, ClassifierController, GroupEntry } from "./types";
import { getClassifierColor } from "./classifierDefinitions";
import { runClassifierDefinition, addDefaultGroups } from "./runClassifierDefinition";

const EMPTY_STRINGS: string[] = [];
const EMPTY_STEPS: ((components: OBC.Components) => Promise<void>)[] = [];

interface UseClassifierControllerArgs {
  components: OBC.Components | null;
  world?: OBC.World | null;
  config: ClassifierConfig;
}

/**
 * All state and engine logic behind one classifier view (which groups exist,
 * add-defaults, colorize, isolate, reset). Pure data + actions — no JSX — so
 * it can be rendered as a single self-contained panel, as one tab among
 * several, or any other shape a future screen needs.
 */
export function useClassifierController({ components, world = null, config }: UseClassifierControllerArgs): ClassifierController {
  const {
    definitions,
    includeGeneralDefaults = false,
    extraClassifications = EMPTY_STRINGS,
    dynamicSteps = EMPTY_STEPS,
  } = config;

  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meshColorizedClassification, setMeshColorizedClassification] = useState<string | null>(null);
  const [isolatedKey, setIsolatedKey] = useState<string | null>(null);

  const visibleClassifications = new Set(definitions.map((d) => d.classificationName));
  for (const name of extraClassifications) visibleClassifications.add(name);
  if (includeGeneralDefaults) {
    visibleClassifications.add("Category");
    visibleClassifications.add("Levels");
  }

  const refreshGroups = useCallback(() => {
    if (!components) return;
    const classifier = components.get(OBC.Classifier);
    const entries: GroupEntry[] = [];
    for (const [classification, groupMap] of classifier.list) {
      if (!visibleClassifications.has(classification)) continue;
      for (const [name, groupData] of groupMap) {
        const hasItems = Object.values(groupData.map).some((ids) => ids.size > 0);
        if (!hasItems) continue;
        entries.push({ classification, name });
      }
    }
    setGroups(entries);
    console.log(groups)
  }, [components, definitions, includeGeneralDefaults, extraClassifications]);

  useEffect(() => {
    if (!components) return;
    const classifier = components.get(OBC.Classifier);
    const handler = () => setTimeout(() => refreshGroups());
    classifier.list.onItemSet.add(handler);
    refreshGroups();
    return () => { classifier.list.onItemSet.remove(handler); };
  }, [components, refreshGroups]);

  // Every colored group gets its own copy meshes, built once here and kept
  // around for the lifetime of the panel — Colorize/Isolate only ever flip
  // `.visible` on this cache afterwards, they never build or destroy geometry.
  const groupMeshesRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  // The set of original items currently swapped out for the active
  // classification's colored meshes (empty when nothing is colorized).
  const hiddenItemsRef = useRef<OBC.ModelIdMap | null>(null);

  const buildAllGroupMeshes = useCallback(async () => {
    if (!components || !world) return;
    for (const meshes of groupMeshesRef.current.values()) {
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
    }
    groupMeshesRef.current.clear();

    const classifier = components.get(OBC.Classifier);
    const fragments = components.get(OBC.FragmentsManager);

    for (const [classification, groupMap] of classifier.list) {
      if (!visibleClassifications.has(classification)) continue;
      for (const [name, groupData] of groupMap) {
        const color = getClassifierColor(name);
        if (!color) continue; // no assigned color -> stays as original geometry

        const modelIdMap = await groupData.get();
        const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide });
        const meshes: THREE.Mesh[] = [];

        for (const [modelId, ids] of Object.entries(modelIdMap)) {
          const model = fragments.list.get(modelId);
          if (!model) continue;
          const localIds = [...ids];
          const itemsGeometry = await model.getItemsGeometry(localIds, 0);

          for (let i = 0; i < localIds.length; i++) {
            const itemKey = `${modelId}:${localIds[i]}`;
            for (const data of itemsGeometry[i] ?? []) {
              const { positions, normals, indices, transform } = data;
              if (!(positions && normals && indices && transform)) continue;

              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
              geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
              geometry.setIndex(new THREE.BufferAttribute(indices, 1));
              geometry.applyMatrix4(transform);
              geometry.computeVertexNormals();

              const mesh = new THREE.Mesh(geometry, material);
              mesh.visible = false;
              mesh.userData.itemKey = itemKey;
              world.scene.three.add(mesh);
              meshes.push(mesh);
            }
          }
        }

        groupMeshesRef.current.set(`${classification}::${name}`, meshes);
      }
    }
  }, [components, world, visibleClassifications]);

  const handleAddDefaults = useCallback(async () => {
    if (!components) return;
    setAdding(true);
    setError(null);
    try {
      const classifier = components.get(OBC.Classifier);
      if (includeGeneralDefaults) {
        await classifier.byCategory();
        await classifier.byIfcBuildingStorey({ classificationName: "Levels" });
      }

      const failures: string[] = [];
      for (const def of definitions) {
        try {
          await runClassifierDefinition(components, def);
        } catch (e: any) {
          failures.push(`${def.queryName}: ${String(e?.message ?? e)}`);
        }
      }
      for (const step of dynamicSteps) {
        try {
          await step(components);
        } catch (e: any) {
          failures.push(String(e?.message ?? e));
        }
      }
      if (failures.length > 0) setError(failures.join(" | "));

      await addDefaultGroups(components, definitions);
      refreshGroups();
      await buildAllGroupMeshes();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAdding(false);
    }
  }, [components, definitions, includeGeneralDefaults, dynamicSteps, refreshGroups, buildAllGroupMeshes]);

  // Hides whichever classification is currently colorized (if any) and shows
  // its original geometry again, so a different classification can take over.
  const hideActiveColorize = useCallback(async () => {
    if (!components) return;
    if (hiddenItemsRef.current) {
      const hider = components.get(OBC.Hider);
      await hider.set(true, hiddenItemsRef.current);
      hiddenItemsRef.current = null;
    }
    if (meshColorizedClassification) {
      const prefix = `${meshColorizedClassification}::`;
      for (const [key, meshes] of groupMeshesRef.current) {
        if (!key.startsWith(prefix)) continue;
        for (const mesh of meshes) mesh.visible = false;
      }
    }
  }, [components, meshColorizedClassification]);

  const handleToggleColorizeMesh = useCallback(async (classification: string, names: string[]) => {
    if (!components) return;
    const isColorized = meshColorizedClassification === classification;
    setLoadingGroup(`mesh::${classification}`);
    setError(null);
    try {
      if (isolatedKey) setIsolatedKey(null);
      await hideActiveColorize();

      if (!isColorized) {
        const classifierMap = components.get(OBC.Classifier).list.get(classification);
        if (!classifierMap) return;
        const hider = components.get(OBC.Hider);
        const toHide: OBC.ModelIdMap = {};

        for (const name of names) {
          const meshes = groupMeshesRef.current.get(`${classification}::${name}`);
          if (!meshes) continue; // no color assigned to this group
          for (const mesh of meshes) mesh.visible = true;

          const groupData = classifierMap.get(name);
          if (!groupData) continue;
          const modelIdMap = await groupData.get();
          for (const [modelId, ids] of Object.entries(modelIdMap)) {
            const hideSet = (toHide[modelId] ??= new Set<number>());
            for (const id of ids) hideSet.add(id);
          }
        }

        hiddenItemsRef.current = toHide;
        await hider.set(false, toHide);
        setMeshColorizedClassification(classification);
      } else {
        setMeshColorizedClassification(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingGroup(null);
    }
  }, [components, meshColorizedClassification, isolatedKey, hideActiveColorize]);

  // Puts the scene back to whatever was active before an isolate: the active
  // classification's colored meshes (if any) plus every plain fragment.
  const restoreVisibility = useCallback(async () => {
    if (!components) return;
    // Run both in parallel (like OBC.Hider.isolate does internally) so the
    // scene never renders the in-between frame where everything is shown
    // uncolored before the colorized-away items get re-hidden.
    const hider = components.get(OBC.Hider);
    const restores: Promise<void>[] = [hider.set(true)];
    if (hiddenItemsRef.current) restores.push(hider.set(false, hiddenItemsRef.current));
    await Promise.all(restores);

    const activePrefix = meshColorizedClassification ? `${meshColorizedClassification}::` : null;
    for (const [key, meshes] of groupMeshesRef.current) {
      const visible = activePrefix ? key.startsWith(activePrefix) : false;
      for (const mesh of meshes) mesh.visible = visible;
    }


  }, [components, meshColorizedClassification]);

  // Isolate is purely a "show only these items" filter — it never changes
  // color. Whatever classification is currently Colorized keeps showing its
  // colors for the isolated subset; items not covered by it fall back to
  // their plain original geometry. Color only ever changes via Colorize.
  const handleToggleIsolate = useCallback(async (entry: GroupEntry) => {
    if (!components) return;
    const key = `${entry.classification}::${entry.name}`;
    setLoadingGroup(`isolate::${key}`);
    setError(null);
    try {
      if (isolatedKey === key) {
        await restoreVisibility();
        setIsolatedKey(null);
        return;
      }

      const groupData = components.get(OBC.Classifier).list.get(entry.classification)?.get(entry.name);
      if (!groupData) return;
      const modelIdMap = await groupData.get();

      const targetIds = new Set<string>();
      for (const [modelId, ids] of Object.entries(modelIdMap)) {
        for (const id of ids) targetIds.add(`${modelId}:${id}`);
      }

      const hider = components.get(OBC.Hider);
      await hider.set(false);

      const activePrefix = meshColorizedClassification ? `${meshColorizedClassification}::` : null;
      const coveredIds = new Set<string>();
      for (const [k, meshes] of groupMeshesRef.current) {
        const isActive = activePrefix !== null && k.startsWith(activePrefix);
        for (const mesh of meshes) {
          const itemKey = mesh.userData.itemKey as string;
          const show = isActive && targetIds.has(itemKey);
          mesh.visible = show;
          if (show) coveredIds.add(itemKey);
        }
      }

      // Items the active classification doesn't color get their plain geometry back.
      const toShow: OBC.ModelIdMap = {};
      for (const [modelId, ids] of Object.entries(modelIdMap)) {
        for (const id of ids) {
          if (coveredIds.has(`${modelId}:${id}`)) continue;
          (toShow[modelId] ??= new Set()).add(id);
        }
      }
      if (Object.keys(toShow).length > 0) await hider.set(true, toShow);

      setIsolatedKey(key);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingGroup(null);
    }
  }, [components, isolatedKey, meshColorizedClassification, restoreVisibility]);

  const handleResetVisibility = useCallback(async () => {
    if (!components) return;
    setResetting(true);
    setError(null);
    try {
      const hider = components.get(OBC.Hider);
      await hider.set(true);
      for (const meshes of groupMeshesRef.current.values()) {
        for (const mesh of meshes) mesh.visible = false;
      }
      hiddenItemsRef.current = null;
      setMeshColorizedClassification(null);
      setIsolatedKey(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components]);

  // Same as handleResetVisibility, but also undoes "Add Defaults" itself:
  // removes this view's classification groups from the classifier (not just
  // their visibility), so a future "Add Defaults" starts from a clean slate
  // instead of re-adding on top of what's already there.
  const handleResetVisibilityDefaults = useCallback(async () => {
    if (!components) return;
    setResetting(true);
    setError(null);
    try {
      const hider = components.get(OBC.Hider);
      await hider.set(true);

      for (const meshes of groupMeshesRef.current.values()) {
        for (const mesh of meshes) {
          mesh.removeFromParent();
          mesh.geometry.dispose();
        }
      }
      groupMeshesRef.current.clear();
      hiddenItemsRef.current = null;
      setMeshColorizedClassification(null);
      setIsolatedKey(null);

      const classifier = components.get(OBC.Classifier);
      for (const classification of visibleClassifications) {
        classifier.list.delete(classification);
      }
      refreshGroups();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components, visibleClassifications, refreshGroups]);

  const byClassification = groups.reduce<Record<string, string[]>>((acc, g) => {
    (acc[g.classification] ??= []).push(g.name);
    return acc;
  }, {});

  return {
    groups,
    byClassification,
    disabled: !components,
    adding,
    resetting,
    error,
    loadingGroup,
    meshColorizedClassification,
    isolatedKey,
    handleAddDefaults,
    handleResetVisibility,
    handleResetVisibilityDefaults,
    handleToggleColorizeMesh,
    handleToggleIsolate,
  };
}
