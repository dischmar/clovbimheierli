import { useCallback, useEffect, useState } from "react";
import * as OBC from "@thatopen/components";

const AUTHOR_STORAGE_KEY = "bcf.author";

export interface BcfTaskInput {
  title: string;
  description: string;
  type: string;
  priority: string;
  assignedTo: string;
  author: string;
  elementGuids: string[];
}

function readStoredAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeAuthor(author: string) {
  try {
    localStorage.setItem(AUTHOR_STORAGE_KEY, author);
  } catch {
    // Remembering the author is only a convenience.
  }
}

/**
 * `setup()` is idempotent; without it the BCF version is empty and exports lose their viewpoints.
 * Without `includeSelectionTag` the library also writes the selection as visibility exceptions,
 * which makes other BCF viewers hide the selected elements.
 */
export function getBcfTopics(components: OBC.Components) {
  const bcf = components.get(OBC.BCFTopics);
  bcf.setup();
  bcf.config.includeSelectionTag = true;
  return bcf;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Tasks live in the `OBC.BCFTopics` singleton, so they survive closing the panel
 * but not a page reload. `tasks` is a React copy of that list.
 */
export function useBcfController(components: OBC.Components | null, world: OBC.World | null) {
  const [tasks, setTasks] = useState<OBC.Topic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [author, setAuthor] = useState(readStoredAuthor);

  const refresh = useCallback(() => {
    setTasks(components ? [...getBcfTopics(components).list.values()] : []);
  }, [components]);

  useEffect(refresh, [refresh]);

  /** Saves a task with the current camera view and returns whether it worked. */
  const addTask = useCallback(
    async (input: BcfTaskInput): Promise<boolean> => {
      if (!components || !world) return false;
      setError(null);

      const viewpoints = components.get(OBC.Viewpoints);
      const viewpoint = viewpoints.create();
      for (const guid of input.elementGuids) viewpoint.selectionComponents.add(guid);
      try {
        viewpoint.world = world;
        await viewpoint.updateCamera(true);
      } catch (e) {
        viewpoints.list.delete(viewpoint.guid);
        setError(e instanceof Error ? e.message : "Ansicht konnte nicht gespeichert werden");
        return false;
      }

      const bcf = getBcfTopics(components);
      bcf.config.author = input.author;
      const topic = bcf.create({
        title: input.title,
        description: input.description || undefined,
        type: input.type,
        priority: input.priority || undefined,
        assignedTo: input.assignedTo || undefined,
      });
      topic.viewpoints.add(viewpoint.guid);

      setAuthor(input.author);
      storeAuthor(input.author);
      refresh();
      return true;
    },
    [components, world, refresh]
  );

  const removeTask = useCallback(
    (topic: OBC.Topic) => {
      if (!components) return;
      const viewpoints = components.get(OBC.Viewpoints);
      for (const guid of topic.viewpoints) {
        viewpoints.snapshots.delete(guid);
        viewpoints.list.delete(guid);
      }
      getBcfTopics(components).list.delete(topic.guid);
      refresh();
    },
    [components, refresh]
  );

  const exportBcf = useCallback(async () => {
    if (!components) return;
    setError(null);
    setExporting(true);
    try {
      const blob = await getBcfTopics(components).export();
      downloadBlob(blob, `Aufgaben_${new Date().toISOString().slice(0, 10)}.bcf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "BCF-Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }, [components]);

  return { tasks, error, exporting, author, addTask, removeTask, exportBcf };
}
