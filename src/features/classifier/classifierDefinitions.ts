import type { ClassifierDefinition } from "./types";

const CONCRETE_CATEGORIES = [/WALL/, /SLAB/, /BEAM/, /COLUMN/, /DOOR/, /WINDOW/,/FOOTING/];

export const REINFORCEMENT_CATEGORIES = [/REBAR/, /REINFORCINGBAR/];

/**
 * Every group here is the same shape: category-filtered elements, filtered by
 * CH_Pset_BIN, filtered by one property name + value pattern. Only the
 * category set, classification, property name, and per-code value/color differ.
 */
function propertyClassifierDefinition(
  categories: RegExp[],
  classificationName: string,
  propertyName: RegExp,
  code: string,
  valuePattern: RegExp | boolean | number,
  color: string
): ClassifierDefinition {
  return {
    queryName: `${classificationName}-${code.replace(/\s+/g, "")}`,
    classificationName,
    groupName: code,
    color,
    query: [
      {
        categories,
        relation: {
          name: "IsDefinedBy",
          query: {
            attributes: {
              queries: [{ name: /Name/, value: /CH_Pset_BIN/ }],
            },
            relation: {
              name: "HasProperties",
              query: {
                attributes: {
                  queries: [
                    { name: /Name/, value: propertyName },
                    { name: /NominalValue/, value: valuePattern },
                  ],
                },
              },
            },
          },
        },
      },
    ],
  };
}

/** Binds propertyClassifierDefinition to a fixed category set. */
function forCategories(categories: RegExp[]) {
  return (
    classificationName: string,
    propertyName: RegExp,
    code: string,
    valuePattern: RegExp | boolean | number,
    color: string
  ): ClassifierDefinition =>
    propertyClassifierDefinition(categories, classificationName, propertyName, code, valuePattern, color);
}

const concreteDef = forCategories(CONCRETE_CATEGORIES);
const reinforcementDef = forCategories(REINFORCEMENT_CATEGORIES);

// Add one entry per group you want classified out of finder queries.
// `queryName` and `groupName` must each be unique across all definitions —
// reusing a `groupName` (even under the same classification) overwrites the
// previous group's elements instead of adding a separate, isolatable one.
export const CONCRETE_CLASSIFIER_DEFINITIONS: ClassifierDefinition[] = [
  concreteDef("Betonsorten", /Betonart/, "BE1", /BE1/, "#fff2cc"),
  concreteDef("Betonsorten", /Betonart/, "BE2", /BE2/, "#ffe699"),
  concreteDef("Betonsorten", /Betonart/, "BE3", /BE3/, "#ffd966"),
  concreteDef("Betonsorten", /Betonart/, "BE4", /BE4/, "#bf8f00"),
  concreteDef("Betonsorten", /Betonart/, "BE5", /BE5/, "#806000"),
  concreteDef("Betonsorten", /Betonart/, "NPK A", /NPK A/, "#ecf5e7"),
  concreteDef("Betonsorten", /Betonart/, "NPK B", /NPK B/, "#e2efda"),
  concreteDef("Betonsorten", /Betonart/, "NPK C", /NPK C/, "#c6e0b4"),
  concreteDef("Betonsorten", /Betonart/, "NPK D", /NPK D/, "#a9d08e"),
  concreteDef("Betonsorten", /Betonart/, "NPK E", /NPK E/, "#68a042"),
  concreteDef("Betonsorten", /Betonart/, "NPK F", /NPK F/, "#548235"),
  concreteDef("Betonsorten", /Betonart/, "NPK G", /NPK G/, "#375623"),

  concreteDef("Wasserdichtigkeit", /wasserdicht/, "wasserdicht", true, "#00b0f0"),
  concreteDef("Wasserdichtigkeit", /wasserdicht/, "nicht wasserdicht", false, "#ffff00"),

  concreteDef("Betonüberdeckung", /Betonüberdeckung \[mm\]/, "20 mm", 20, "#ecf5e7"),
  concreteDef("Betonüberdeckung", /Betonüberdeckung \[mm\]/, "30 mm", 30, "#e2efda"),
  concreteDef("Betonüberdeckung", /Betonüberdeckung \[mm\]/, "35 mm", 35, "#c6e0b4"),
  concreteDef("Betonüberdeckung", /Betonüberdeckung \[mm\]/, "40 mm", 40, "#a9d08e"),
  concreteDef("Betonüberdeckung", /Betonüberdeckung \[mm\]/, "55 mm", 55, "#68a042"),

  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "R0", /R0/, "#fce4d6"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "R30", /R30/, "#f8cbad"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "R60", /R60/, "#f4b084"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "R90", /R90/, "#c65911"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "R120", /R120/, "#833c0c"),

  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "EI0", /EI0/, "#ffccff"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "EI30", /EI30/, "#ff99ff"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "EI60", /EI60/, "#ff66ff"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "EI90", /EI90/, "#ff00ff"),
  concreteDef("Feuerwiderstand", /Feuerwiderstandsklasse/, "EI120", /EI120/, "#cc00cc"),

  concreteDef("Schalungstyp", /Schalungstyp/, "Typ 1", /Typ 1/, "#ddebf7"),
  concreteDef("Schalungstyp", /Schalungstyp/, "Typ 2", /Typ 2/, "#bdd7ee"),
  concreteDef("Schalungstyp", /Schalungstyp/, "Typ 2.1", /Typ 2.1/, "#9bc2e6"),
  concreteDef("Schalungstyp", /Schalungstyp/, "Typ 3.1", /Typ 3.1/, "#2f75b5"),
  concreteDef("Schalungstyp", /Schalungstyp/, "Typ 4.1", /Typ 4.1/, "#1f4e78"),

  // Add more definitions here:
  // concreteDef(classificationName, propertyNameRegex, code, valuePattern, color)
];

// Guessed property names/codes — adjust to match the actual CH_Pset_BIN
// property names and values once known.
export const REINFORCEMENT_CLASSIFIER_DEFINITIONS: ClassifierDefinition[] = [
  reinforcementDef("Lage", /Lage/, "1.Lage", /1.Lage/, "#0000ff"),
  reinforcementDef("Lage", /Lage/, "2.Lage", /2.Lage/, "#ffccff"),
  reinforcementDef("Lage", /Lage/, "3.Lage", /3.Lage/, "#66ccff"),
  reinforcementDef("Lage", /Lage/, "4.Lage", /4.Lage/, "#ff00ff"),

  reinforcementDef("Lage", /Lage/, "spezial", /spezial/, "#ffff00"),
  reinforcementDef("Lage", /Lage/, "AE", /AE/, "#ffff00"),
  reinforcementDef("Lage", /Lage/, "Zulage", /Zulage/, "#ff0000"),
  reinforcementDef("Lage", /Lage/, "ME", /ME/, "#ffc000"),
  reinforcementDef("Lage", /Lage/, "VE", /VE/, "#ffc000"),
  reinforcementDef("Lage", /Lage/, "ME", /ME/, "#ffc000"),
  reinforcementDef("Lage", /Lage/, "Schraubbew", /Schraubbew/, "#7030a0"),
  reinforcementDef("Lage", /Lage/, "Erdbebenbew", /Erdbebenbew/, "#ff0000"),

  // Positionsnr. is NOT listed here: NominalValue for Positionsnummer is an
  // IFCINTEGER (e.g. 206), and the finder engine can only match numbers by
  // exact equality (never by regex/range) — a code like 200 would only ever
  // match items whose value is *exactly* 200, never 206. Grouping by "first
  // digit" therefore needs to read each item's real value and bucket it in
  // code; see classifyPositionsnummer.ts, wired into ClassifierPanel's
  // dynamicStep. POSITIONSNUMMER_BUCKET_COLORS below supplies its colors.

  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø8", 8, "#ff00ff"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø10", 10, "#7030a0"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø12", 12, "#000099"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø14", 14, "#0000ff"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø16", 16, "#00b0f0"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø18", 18, "#00b050"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø20", 20, "#92d050"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø22", 22, "#ffff00"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø26", 26, "#ffc000"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø30", 30, "#ff0000"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø34", 34, "#c00000"),
  reinforcementDef("Durchmesser", /Durchmesser \[mm\]/, "Ø40", 40, "#000000"),



  reinforcementDef("Teilung", /Teilung \[mm\]/, "andere", /andere/, "#ff00ff"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "50", 50, "#000099"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "75", 75, "#0000ff"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "100", 100, "#00b0f0"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "125", 125, "#00b050"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "150", 150, "#92d050"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "200", 200, "#ffff00"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "250", 250, "#ffc000"),
  reinforcementDef("Teilung", /Teilung \[mm\]/, "300", 300, "#ff0000")



  // Add more definitions here:
  // reinforcementDef(classificationName, propertyNameRegex, code, valuePattern, color)
];



export const CLASSIFIER_DEFINITIONS: ClassifierDefinition[] = [
  ...CONCRETE_CLASSIFIER_DEFINITIONS,
  ...REINFORCEMENT_CLASSIFIER_DEFINITIONS,
];

// Colors for the Positionsnr. buckets built dynamically by
// classifyPositionsnummer.ts (grouped by leading digit, e.g. 206 → "200er").
export const POSITIONSNUMMER_BUCKET_COLORS: Record<string, string> = {
  "0er": "#ffff00",
  "100er": "#0000ff",
  "200er": "#ffccff",
  "300er": "#66ccff",
  "400er": "#ff00ff",
  "500er": "#ffff00",
  "600er": "#ff0000",
  "700er": "#00b050",
  "800er": "#ffc000",
  "900er": "#7030a0",
};

/** Look up a definition's color by its groupName, for use outside this panel. */
export function getClassifierColor(groupName: string): string | undefined {
  return (
    CLASSIFIER_DEFINITIONS.find((d) => d.groupName === groupName)?.color ??
    POSITIONSNUMMER_BUCKET_COLORS[groupName]
  );
}

