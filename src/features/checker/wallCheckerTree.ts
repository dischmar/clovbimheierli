import type * as FRAGS from "@thatopen/fragments";
import type { CheckerConfig, CombinationTest, TreeNode } from "./types";

// ── reusable query builders ─────────────────────────────────────────────────
// Each query is scoped to walls + Pset_WallCommon + HasProperties,
// filtered by a property Name (and optionally NominalValue).

const walls: FRAGS.ItemsQueryParams = { categories: [/WALL/] };

const wallsPsetCommon: FRAGS.ItemsQueryParams = {
  ...walls,
  relation: {
    name: "IsDefinedBy",
    query: {
      attributes: { queries: [{ name: /Name/, value: /Pset_WallCommon/ }] },
    },
  },
};

function withProperty(propertyQueries: { name: RegExp; value: any }[]): FRAGS.ItemsQueryParams {
  return {
    ...walls,
    relation: {
      name: "IsDefinedBy",
      query: {
        attributes: { queries: [{ name: /Name/, value: /Pset_WallCommon/ }] },
        relation: {
          name: "HasProperties",
          query: {
            attributes: { queries: propertyQueries },
          },
        },
      },
    },
  };
}

const loadBearingExists = withProperty([{ name: /Name/, value: /LoadBearing/ }]);
const loadBearingTrue = withProperty([
  { name: /Name/, value: /LoadBearing/ },
  { name: /NominalValue/, value: true },
]);
const loadBearingFalse = withProperty([
  { name: /Name/, value: /LoadBearing/ },
  { name: /NominalValue/, value: false },
]);

const fireRatingExists = withProperty([{ name: /Name/, value: /FireRating/ }]);
const fireRatingR = withProperty([
  { name: /Name/, value: /FireRating/ },
  { name: /NominalValue/, value: /^R\d+$/ },
]);
const fireRatingEI = withProperty([
  { name: /Name/, value: /FireRating/ },
  { name: /NominalValue/, value: /^EI\d+$/ },
]);

// ── tree definition ──────────────────────────────────────────────────────────

const TREE: TreeNode = {
  id: "psetCommon",
  label: "Pset_WallCommon",
  description: "Walls with Pset_WallCommon",
  query: wallsPsetCommon,
  color: "#60a5fa",
  yes: {
    id: "loadBearingExists",
    label: "LoadBearing (Property)",
    description: "Walls where LoadBearing property exists",
    query: loadBearingExists,
    color: "#fbbf24",
  },
};

// FireRating-Existenz wird auf derselben Ebene wie LoadBearing-Existenz geprüft,
// d.h. beide direkt unter Pset_WallCommon (Population = psetCommon.yes).
TREE.yes!.siblings = [
  {
    id: "fireRatingExists",
    label: "FireRating (Property)",
    description: "Walls where FireRating property exists",
    query: fireRatingExists,
    color: "#fb923c",
  },
];

// ── combination tests ─────────────────────────────────────────────────────────
// Population = Pset_WallCommon ∩ LoadBearing-vorhanden (FireRating-Existenz wird
// NICHT vorausgesetzt — fehlt FireRating komplett, zählt das auch als "Nicht bestanden").
// Within that population, split by LoadBearing value and check the matching
// FireRating pattern.

const COMBINATION_TESTS: CombinationTest[] = [
  {
    id: "loadBearingTrue_fireR",
    label: "LoadBearing = true → FireRating = R...",
    description: "Load-bearing walls must have FireRating matching /^R\\d+$/",
    populationFromIds: ["psetCommon", "loadBearingExists"],
    branchQuery: loadBearingTrue,
    branchLabel: "LoadBearing = true",
    patternQuery: fireRatingR,
    patternLabel: "FireRating = R...",
    color: "#34d399",
  },
  {
    id: "loadBearingFalse_fireEI",
    label: "LoadBearing = false → FireRating = EI...",
    description: "Non-load-bearing walls must have FireRating matching /^EI\\d+$/",
    populationFromIds: ["psetCommon", "loadBearingExists"],
    branchQuery: loadBearingFalse,
    branchLabel: "LoadBearing = false",
    patternQuery: fireRatingEI,
    patternLabel: "FireRating = EI...",
    color: "#2dd4bf",
  },
];

/** Config for the built-in wall pipeline check: Pset_WallCommon → LoadBearing/FireRating. */
export const WALL_CHECKER_CONFIG: CheckerConfig = {
  rootQuery: walls,
  rootLabel: "All Walls",
  rootDescription: "Every wall in the model",
  tree: TREE,
  combinationTests: COMBINATION_TESTS,
};
