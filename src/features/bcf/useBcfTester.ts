import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import * as OBC from "@thatopen/components";
import { getBcfTopics } from "./useBcfController";

const SELECTION_COLOR = "#bcf124";

export interface ImportedBcf {
  fileName: string;
  topics: OBC.Topic[];
  viewpoints: Map<string, OBC.Viewpoint>;
  snapshots: Map<string, Uint8Array>;
}

/** How many of the GUIDs a viewpoint references exist in the loaded models. */
export interface ViewpointReport {
  hasCamera: boolean;
  elementsTotal: number;
  elementsFound: number;
}

/** Kept outside the hook so the imported file survives closing the panel, like the tasks do. */
const importedByComponents = new WeakMap<OBC.Components, ImportedBcf>();

function restoreMap<K, V>(map: Map<K, V>, saved: Map<K, V>) {
  for (const key of [...map.keys()]) {
    if (!saved.has(key)) map.delete(key);
  }
  for (const [key, value] of saved) map.set(key, value);
}

/**
 * `BCFTopics.load` writes into the singleton that holds the manually written tasks, overwriting
 * equal GUIDs. Everything it touched is put back so an import can't change the task list or
 * end up in its export.
 */
async function loadIsolated(components: OBC.Components, file: File): Promise<ImportedBcf> {
  const bcf = getBcfTopics(components);
  const viewpoints = components.get(OBC.Viewpoints);

  const savedTopics = new Map(bcf.list);
  const savedDocuments = new Map(bcf.documents);
  const savedViewpoints = new Map(viewpoints.list);
  const savedSnapshots = new Map(viewpoints.snapshots);

  try {
    const result = await bcf.load(new Uint8Array(await file.arrayBuffer()));
    const imported: ImportedBcf = {
      fileName: file.name,
      topics: result.topics,
      viewpoints: new Map(result.viewpoints.map((v) => [v.guid, v])),
      snapshots: new Map(),
    };
    for (const { guid } of result.viewpoints) {
      const bytes = viewpoints.snapshots.get(guid);
      if (bytes) imported.snapshots.set(guid, bytes);
    }
    return imported;
  } finally {
    restoreMap(bcf.list, savedTopics);
    restoreMap(bcf.documents, savedDocuments);
    restoreMap(viewpoints.list, savedViewpoints);
    restoreMap(viewpoints.snapshots, savedSnapshots);
  }
}

/** `Viewpoint.go` does nothing at all for a viewpoint without camera, not even its visibility. */
function hasCamera({ camera }: OBC.Viewpoint) {
  const { camera_view_point: p, camera_direction: d } = camera;
  return [p.x, p.y, p.z, d.x, d.y, d.z].some((value) => value !== 0);
}

async function createReport(components: OBC.Components, viewpoint: OBC.Viewpoint): Promise<ViewpointReport> {
  const guids = new Set([...viewpoint.selectionComponents, ...viewpoint.exceptionComponents]);
  for (const [, colored] of viewpoint.componentColors) {
    for (const guid of colored) guids.add(guid);
  }
  const found = await components.get(OBC.FragmentsManager).guidsToModelIdMap([...guids]);
  const elementsFound = Object.values(found).reduce((sum, localIds) => sum + localIds.size, 0);
  return {
    hasCamera: hasCamera(viewpoint),
    elementsTotal: guids.size,
    elementsFound: Math.min(elementsFound, guids.size),
  };
}

async function setSelectionHighlight(components: OBC.Components, viewpoint: OBC.Viewpoint, highlighted: boolean) {
  const fragments = components.get(OBC.FragmentsManager);
  const selection = await viewpoint.getSelectionMap();
  for (const [modelId, localIds] of Object.entries(selection)) {
    const model = fragments.list.get(modelId);
    if (!model || localIds.size === 0) continue;
    if (highlighted) {
      await model.highlight([...localIds], {
        color: new THREE.Color(SELECTION_COLOR),
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 1,
        transparent: false,
      });
    } else {
      await model.resetHighlight([...localIds]);
    }
  }
  await fragments.core.update(true);
}

async function removeHighlights(components: OBC.Components, viewpoint: OBC.Viewpoint) {
  await viewpoint.setColorizationState(false);
  await setSelectionHighlight(components, viewpoint, false);
}

export function useBcfTester(components: OBC.Components | null, world: OBC.World | null) {
  const [imported, setImported] = useState(() => (components ? importedByComponents.get(components) ?? null : null));
  const [selectedTopic, setSelectedTopic] = useState<OBC.Topic | null>(null);
  const [activeViewpoint, setActiveViewpoint] = useState<string | null>(null);
  const [report, setReport] = useState<ViewpointReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownRef = useRef<OBC.Viewpoint | null>(null);
  // Hiding and highlighting are async; running them in order keeps fast clicks from mixing two viewpoints.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((job: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(job).catch((e) => {
      setError(e instanceof Error ? e.message : "Ansicht konnte nicht angezeigt werden");
    });
    return queueRef.current;
  }, []);

  const showViewpoint = useCallback(
    (viewpoint: OBC.Viewpoint) => {
      if (!components || !world) return;
      setError(null);
      setActiveViewpoint(viewpoint.guid);
      setReport(null);
      enqueue(async () => {
        if (shownRef.current) await removeHighlights(components, shownRef.current);
        shownRef.current = viewpoint;
        viewpoint.world = world;

        // Imported viewpoints carry no clipping planes, and applying them would switch off the slice tool.
        const moved = hasCamera(viewpoint)
          ? viewpoint.go({ applyClippings: false })
          : viewpoint.applyVisibility();
        await viewpoint.setColorizationState(true);
        await setSelectionHighlight(components, viewpoint, true);
        setReport(await createReport(components, viewpoint));
        await moved;
      });
    },
    [components, world, enqueue]
  );

  const selectTopic = useCallback(
    (topic: OBC.Topic) => {
      setSelectedTopic(topic);
      setActiveViewpoint(null);
      setReport(null);
      const guid = [...topic.viewpoints][0];
      const viewpoint = guid ? imported?.viewpoints.get(guid) : undefined;
      if (viewpoint) showViewpoint(viewpoint);
    },
    [imported, showViewpoint]
  );

  const resetView = useCallback(() => {
    if (!components) return;
    setActiveViewpoint(null);
    setReport(null);
    return enqueue(async () => {
      const shown = shownRef.current;
      if (!shown) return;
      shownRef.current = null;
      await removeHighlights(components, shown);
      await components.get(OBC.Hider).set(true);
    });
  }, [components, enqueue]);

  const importFile = useCallback(
    async (file: File) => {
      if (!components) return;
      setError(null);
      setImporting(true);
      setSelectedTopic(null);
      await resetView();
      try {
        const next = await loadIsolated(components, file);
        importedByComponents.set(components, next);
        setImported(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "BCF-Import fehlgeschlagen");
      } finally {
        setImporting(false);
      }
    },
    [components, resetView]
  );

  // Leaving the tab must not leave the model filtered down to the last viewpoint.
  useEffect(() => () => void resetView(), [resetView]);

  return {
    imported,
    selectedTopic,
    activeViewpoint,
    report,
    importing,
    error,
    importFile,
    selectTopic,
    showViewpoint,
    resetView,
  };
}
