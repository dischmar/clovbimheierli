import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";

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

export class IdsParameters extends OBC.Component {
  enabled = false;
  static readonly uuid = "fb6821d5-a9e2-4dd0-a46c-dcea964b875e";

  idsData: Property[] = [];

  // Store original materials for ghost mode restore
  private _originalColors = new Map<
    FRAGS.BIMMaterial,
    { color: number; transparent: boolean; opacity: number }
  >();

  constructor(components: OBC.Components) {
    super(components);
    components.add(IdsParameters.uuid, this);
  }

  async applyRequirements(idsSpecifications: string): Promise<SpecResult[]> {
    const ids = this.components.get(OBC.IDSSpecifications);
    const fragments = this.components.get(OBC.FragmentsManager);

    // Load the IDS file — this populates ids.list with the specs
    ids.load(idsSpecifications);

    // Build regex list from ALL currently loaded model IDs
    const modelRegexes = [...fragments.list.keys()].map(
      (id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );

    console.log("[IDS] loaded model IDs:", [...fragments.list.keys()]);
    console.log("[IDS] specs in ids.list:", ids.list.size);
    console.log("[IDS] using regexes:", modelRegexes);

    // ── Full spec dump ────────────────────────────────────────────────────
    for (const [id, spec] of ids.list) {
      console.group(`[IDS] spec: ${spec.name} (${id})`);
      console.log("  description:", spec.description);
      console.log("  ifcVersion:", spec.ifcVersion);
      console.log("  identifier:", spec.identifier);
      console.log("  applicability facets:", spec.applicability.size);
      for (const facet of spec.applicability) {
        console.log("    applicability:", facet.facetType, facet);
      }
      console.log("  requirement facets:", spec.requirements.size);
      for (const facet of spec.requirements) {
        console.log("    requirement:", facet.facetType, facet);
      }
      console.groupEnd();
    }

    const results: SpecResult[] = [];

    const highlightPromises: Promise<any>[] = [fragments.resetHighlight()];

    // Iterate specs from ids.list — exact pattern from docs
    for (const [, spec] of ids.list) {
      console.log("[IDS] testing spec:", spec.name, spec.identifier);

      // spec.test() takes regex array matching modelIds — exact from docs
      const testResult = await spec.test(modelRegexes);
      console.log("[IDS] testResult:", testResult);

      const { pass, fail } = ids.getModelIdMap(testResult);
      console.log("[IDS] pass:", pass, "fail:", fail);

      highlightPromises.push(
        fragments.highlight(
          {
            customId: "ids-pass",
            color: new THREE.Color("green"),
            renderedFaces: FRAGS.RenderedFaces.ONE,
            opacity: 1,
            transparent: false,
          },
          pass
        )
      );

      highlightPromises.push(
        fragments.highlight(
          {
            customId: "ids-fail",
            color: new THREE.Color("red"),
            renderedFaces: FRAGS.RenderedFaces.ONE,
            opacity: 1,
            transparent: false,
          },
          fail
        )
      );

      results.push({
        name: spec.name ?? "—",
        description: spec.description ?? "—",
        identifier: spec.identifier ?? "—",
        pass,
        fail,
      });
    }

    highlightPromises.push(fragments.core.update(true));
    await Promise.all(highlightPromises);

    console.log("[IDS] results:", results);
    return results;
  }

  // Ghost mode — exact implementation from docs
  async setGhostMode(enabled: boolean) {
    const fragments = this.components.get(OBC.FragmentsManager);
    const materials = [...fragments.core.models.materials.list.values()];

    if (enabled) {
      for (const material of materials) {
        if (material.userData.customId) continue;

        let color: number;
        if ("color" in material) {
          color = (material as any).color.getHex();
        } else {
          color = (material as any).lodColor.getHex();
        }

        this._originalColors.set(material, {
          color,
          transparent: material.transparent,
          opacity: material.opacity,
        });

        material.transparent = true;
        material.opacity = 0.05;
        material.needsUpdate = true;

        if ("color" in material) {
          (material as any).color.setColorName("white");
        } else {
          (material as any).lodColor.setColorName("white");
        }
      }
    } else {
      for (const [material, data] of this._originalColors) {
        const { color, transparent, opacity } = data;
        material.transparent = transparent;
        material.opacity = opacity;
        if ("color" in material) {
          (material as any).color.setHex(color);
        } else {
          (material as any).lodColor.setHex(color);
        }
        material.needsUpdate = true;
      }
      this._originalColors.clear();
    }
  }

  async clear() {
    const fragments = this.components.get(OBC.FragmentsManager);
    await fragments.resetHighlight();
    await this.setGhostMode(false);
    await fragments.core.update(true);
  }
}

// ── Standalone export for testing without loading an IDS file ─────────────────
export async function runDummySpec(components: OBC.Components): Promise<void> {
  const ids = components.get(OBC.IDSSpecifications);
  const fragments = components.get(OBC.FragmentsManager);

  // Create a spec programmatically — exact pattern from docs
  const spec = ids.create("Sample", ["IFC4"]);
  spec.description = "All doors must have FireRating specified in Pset_DoorCommon";

  const entity = new OBC.IDSEntity(components, {
    type: "simple",
    parameter: "IFCDOOR",
  });

  const property = new OBC.IDSProperty(
    components,
    { type: "simple", parameter: "Pset_DoorCommon" },
    { type: "simple", parameter: "FireRating" }
  );

  spec.applicability.add(entity);
  spec.requirements.add(property);

  console.group("[IDS DUMMY TEST]");
  console.log("spec name:", spec.name);
  console.log("spec description:", spec.description);
  console.log("applicability facets:", spec.applicability.size);
  console.log("requirement facets:", spec.requirements.size);

  // Build regex from loaded model IDs
  const modelRegexes = [...fragments.list.keys()].map(
    (id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  console.log("testing against models:", [...fragments.list.keys()]);

  const testResult = await spec.test(modelRegexes);
  console.log("raw testResult:", testResult);

  const { pass, fail } = ids.getModelIdMap(testResult);
  console.log("pass ModelIdMap:", pass);
  console.log("fail ModelIdMap:", fail);

  const passCount = Object.values(pass).reduce((s, v) => s + v.size, 0);
  const failCount = Object.values(fail).reduce((s, v) => s + v.size, 0);
  console.log(`✅ pass: ${passCount} elements`);
  console.log(`❌ fail: ${failCount} elements`);
  console.groupEnd();

  // Highlight results
  await Promise.all([
    fragments.resetHighlight(),
    fragments.highlight(
      { customId: "dummy-pass", color: new THREE.Color("green"), renderedFaces: FRAGS.RenderedFaces.ONE, opacity: 1, transparent: false },
      pass
    ),
    fragments.highlight(
      { customId: "dummy-fail", color: new THREE.Color("red"), renderedFaces: FRAGS.RenderedFaces.ONE, opacity: 1, transparent: false },
      fail
    ),
    fragments.core.update(true),
  ]);
}