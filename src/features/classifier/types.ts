import type * as FRAGS from "@thatopen/fragments";
import type * as OBC from "@thatopen/components";

export interface GroupEntry {
  classification: string;
  name: string;
  // color: string;
}

export interface ClassifierDefinition {
  /** Name under which the finder query is registered (must be unique). */
  queryName: string;
  /** Classification bucket the resulting group is added under. */
  classificationName: string;
  /** Group name within that classification. */
  groupName: string;
  /** Finder query used to select the elements for this group. */
  query: FRAGS.ItemsQueryParams[];
  /** Color associated with this group, for reuse anywhere it's rendered/highlighted. */
  color: string;
}

/** Everything one classifier "view" needs: which groups to build and show. */
export interface ClassifierConfig {
  /** Definitions this view can add and whose groups it displays. */
  definitions: ClassifierDefinition[];
  /** Also add/show the generic "Category" and "Levels" classifications. */
  includeGeneralDefaults?: boolean;
  /** Classification names shown that aren't produced by `definitions` (e.g. a dynamic classifier). */
  extraClassifications?: string[];
  /** Extra classification step(s) run on "Add Defaults" that can't be expressed as a ClassifierDefinition. */
  dynamicSteps?: ((components: OBC.Components) => Promise<void>)[];
  /** Shown when no groups exist yet. */
  emptyMessage?: string;
}

/** State + actions for one classifier view, shared by every way it can be rendered. */
export interface ClassifierController {
  groups: GroupEntry[];
  byClassification: Record<string, string[]>;
  disabled: boolean;
  adding: boolean;
  resetting: boolean;
  error: string | null;
  loadingGroup: string | null;
  meshColorizedClassification: string | null;
  isolatedKey: string | null;
  handleAddDefaults: () => Promise<void>;
  handleResetVisibility: () => Promise<void>;
  handleToggleColorizeMesh: (classification: string, names: string[]) => Promise<void>;
  handleToggleIsolate: (entry: GroupEntry) => Promise<void>;
  handleResetVisibilityDefaults: () => Promise<void>;
}

/** Imperative escape hatch for a mounted classifier view — e.g. so a parent's close button can restore visibility first. */
export interface ClassifierResetHandle {
  resetVisibility: () => Promise<void>;
}
