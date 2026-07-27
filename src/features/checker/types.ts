import type * as OBC from "@thatopen/components";
import type * as FRAGS from "@thatopen/fragments";

/**
 * Every node has a query (tested against its parent's "yes" population) and
 * exactly two branches: yes (vorhanden/true/bestanden) and no (nicht
 * vorhanden/false/nicht bestanden). Leaf nodes have no children.
 */
export interface TreeNode {
  id: string;
  label: string;
  description: string;
  query: FRAGS.ItemsQueryParams;
  color: string;
  yesLabel?: string; // override default "Vorhanden"
  noLabel?: string;  // override default "Nicht vorhanden"
  yes?: TreeNode;
  no?: TreeNode;
  /** Additional nodes tested at the same population as this node's "yes" set (parallel siblings). */
  siblings?: TreeNode[];
}

export interface CombinationTest {
  id: string;
  label: string;
  description: string;
  /** Population this test runs on = intersection of these node ids' "yes" sets. */
  populationFromIds: string[];
  /** Value query that defines the "branch" (e.g. LoadBearing = true). */
  branchQuery: FRAGS.ItemsQueryParams;
  branchLabel: string; // e.g. "LoadBearing = true"
  /** Pattern query checked within the branch (e.g. FireRating = R...). */
  patternQuery: FRAGS.ItemsQueryParams;
  patternLabel: string; // e.g. "FireRating = R..."
  color: string;
}

/** Everything one attribute-checker view needs: the population and the tree/tests run against it. */
export interface CheckerConfig {
  /** Root population every node is (transitively) tested against, e.g. all walls. */
  rootQuery: FRAGS.ItemsQueryParams;
  rootLabel: string;
  rootDescription: string;
  tree: TreeNode;
  combinationTests: CombinationTest[];
}

export interface ElementInfo {
  modelId: string;
  localId: number;
  name: string;
  guid?: string;
  reason: string; // which test it failed
}

export interface NodeResult {
  yesMap: OBC.ModelIdMap;
  noMap: OBC.ModelIdMap;
  yesCount: number;
  noCount: number;
}

export interface CombinationResult {
  branchMap: OBC.ModelIdMap;   // population in this branch (e.g. LoadBearing=true ∩ ...)
  branchCount: number;
  passMap: OBC.ModelIdMap;     // branch ∩ pattern (Bestanden)
  failMap: OBC.ModelIdMap;     // branch minus pass (Nicht bestanden)
  passCount: number;
  failCount: number;
}

export type ResultTree = Record<string, NodeResult>;
export type CombinationResultTree = Record<string, CombinationResult>;

/** State + actions for one checker run, shared by every way it can be rendered. */
export interface CheckerController {
  loading: boolean;
  resetting: boolean;
  ghostMode: boolean;
  error: string | null;
  disabled: boolean;
  rootCount: number | null;
  results: ResultTree;
  combinations: CombinationResultTree;
  failures: ElementInfo[];
  resolvingFailures: boolean;
  highlightedId: string | null;
  handleRunPipeline: () => Promise<void>;
  handleReset: () => Promise<void>;
  handleToggleGhost: () => Promise<void>;
  handleHighlightYes: (node: TreeNode) => Promise<void>;
  handleHighlightNo: (node: TreeNode) => Promise<void>;
  handleHighlightCombination: (test: CombinationTest, branch: "pass" | "fail") => Promise<void>;
  handleHighlightElement: (el: ElementInfo) => Promise<void>;
}
