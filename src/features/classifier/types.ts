import type * as FRAGS from "@thatopen/fragments";

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
