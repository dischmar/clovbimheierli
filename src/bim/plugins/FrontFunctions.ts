import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";

export class FrontFunctions extends OBC.Component {
  static readonly uuid = "a2c9dc04-7129-4cb0-83a2-3d3e0e4d26a7";
  enabled = true;

  private _originalColors = new Map<
    FRAGS.BIMMaterial,
    { color: number; transparent: boolean; opacity: number }
  >();

  constructor(components: OBC.Components) {
    super(components);
    components.add(FrontFunctions.uuid, this);
  }

  // ── primitives ──────────────────────────────────────────────────────────────

  async ghost() {
    if (this._originalColors.size > 0) return; // already ghosted
    const fragments = this.components.get(OBC.FragmentsManager);
    const materials = [...fragments.core.models.materials.list.values()];

    for (const material of materials) {
      if (material.userData.customId) continue; // skip highlight materials

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
  }

  async unghost() {
    if (this._originalColors.size === 0) return; // already restored

    for (const [material, data] of this._originalColors) {
      const { color, transparent, opacity } = data;
      material.transparent = transparent;
      material.opacity = opacity;
      material.needsUpdate = true;

      if ("color" in material) {
        (material as any).color.setHex(color);
      } else {
        (material as any).lodColor.setHex(color);
      }
    }

    this._originalColors.clear();
  }

  async reset() {
    const fragments = this.components.get(OBC.FragmentsManager);
    await fragments.resetHighlight();
    await this.unghost();
    await fragments.core.update(true);
  }

  // ── named modes ─────────────────────────────────────────────────────────────

  /**
   * Ghost the model and highlight a specific set of elements.
   * Used by FinderPanel, classifier isolate, etc.
   */
  async isolate(modelIdMap: OBC.ModelIdMap, color = new THREE.Color("blue")) {
    const fragments = this.components.get(OBC.FragmentsManager);
    await this.unghost();
    await fragments.resetHighlight();
    await this.ghost();
    await fragments.highlight(
      {
        customId: "isolate",
        color,
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 1,
        transparent: false,
      },
      modelIdMap
    );
    await fragments.core.update(true);
  }

  /**
   * Highlight pass (green) and fail (red) maps.
   * Used by IDS panel.
   */
  async applyPassFail(pass: OBC.ModelIdMap, fail: OBC.ModelIdMap) {
    const fragments = this.components.get(OBC.FragmentsManager);
    await this.unghost();
    await fragments.resetHighlight();
    await Promise.all([
      fragments.highlight(
        {
          customId: "ids-pass",
          color: new THREE.Color("green"),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        pass
      ),
      fragments.highlight(
        {
          customId: "ids-fail",
          color: new THREE.Color("red"),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        fail
      ),
      fragments.core.update(true),
    ]);
  }

  /**
   * Highlight a single map with a custom color, no ghosting.
   * Generic use case.
   */
  async highlight(
    modelIdMap: OBC.ModelIdMap,
    color: THREE.Color,
    customId = "highlight"
  ) {
    const fragments = this.components.get(OBC.FragmentsManager);
    await fragments.resetHighlight();
    await fragments.highlight(
      {
        customId,
        color,
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 1,
        transparent: false,
      },
      modelIdMap
    );
    await fragments.core.update(true);
  }

  /**
   * Highlight history result by index from a SpecResult array.
   * Used by IDS history panel.
   */
  async applyHistoryResult(
    pass: OBC.ModelIdMap,
    fail: OBC.ModelIdMap
  ) {
    await this.applyPassFail(pass, fail);
  }
}