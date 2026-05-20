import type * as FRAGS from "@thatopen/fragments";
import type * as OBC from "@thatopen/components";

export interface SelectedItem {
  localId: number;
  modelId: string;
  attrs: FRAGS.ItemData | null;
}

export interface Property {
  specId: string;
  pSet: string;
  name: string;
  type: string;
  value: string | boolean | number;
}

export interface SpecResult {
  name: string;
  description: string;
  identifier: string;
  pass: OBC.ModelIdMap;
  fail: OBC.ModelIdMap;
}
