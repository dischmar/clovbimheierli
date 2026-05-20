import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import type { SpecResult } from "../../types/ifc";

export class IdsParameters extends OBC.Component {
  enabled = false;
  static readonly uuid = "fb6821d5-a9e2-4dd0-a46c-dcea964b875e";

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

    ids.load(idsSpecifications);

    const modelRegexes = [...fragments.list.keys()].map(
      (id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );

    const results: SpecResult[] = [];
    const highlightPromises: Promise<any>[] = [fragments.resetHighlight()];

    for (const [, spec] of ids.list) {
      const testResult = await spec.test(modelRegexes);
      const { pass, fail } = ids.getModelIdMap(testResult);

      highlightPromises.push(
        fragments.highlight(
          { customId: "ids-pass", color: new THREE.Color("green"), renderedFaces: FRAGS.RenderedFaces.ONE, opacity: 1, transparent: false },
          pass
        )
      );
      highlightPromises.push(
        fragments.highlight(
          { customId: "ids-fail", color: new THREE.Color("red"), renderedFaces: FRAGS.RenderedFaces.ONE, opacity: 1, transparent: false },
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

    return results;
  }

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
