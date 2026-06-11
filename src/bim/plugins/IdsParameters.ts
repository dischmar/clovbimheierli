import * as OBC from "@thatopen/components";
import type { SpecResult } from "../../types/ifc";
import { FrontFunctions } from "./FrontFunctions";

export class IdsParameters extends OBC.Component {
  enabled = false;
  static readonly uuid = "1655f9ff-03ae-4429-9559-8565e3ebc41c";

  constructor(components: OBC.Components) {
    super(components);
    components.add(IdsParameters.uuid, this);
  }

  async applyRequirements(idsSpecifications: string): Promise<SpecResult[]> {
    const ids = this.components.get(OBC.IDSSpecifications);
    const fragments = this.components.get(OBC.FragmentsManager);
    const hl = this.components.get(FrontFunctions);

    ids.load(idsSpecifications);

    const modelRegexes = [...fragments.list.keys()].map(
      (id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );

    const results: SpecResult[] = [];

    for (const [, spec] of ids.list) {
      const testResult = await spec.test(modelRegexes);
      const { pass, fail } = ids.getModelIdMap(testResult);
      results.push({
        name: spec.name ?? "—",
        description: spec.description ?? "—",
        identifier: spec.identifier ?? "—",
        pass,
        fail,
      });
    }

    // Merge all pass/fail maps across specs
    const mergedPass: OBC.ModelIdMap = {};
    const mergedFail: OBC.ModelIdMap = {};

    for (const result of results) {
      for (const [modelId, ids] of Object.entries(result.pass)) {
        if (!mergedPass[modelId]) mergedPass[modelId] = new Set();
        for (const id of ids) mergedPass[modelId].add(id);
      }
      for (const [modelId, ids] of Object.entries(result.fail)) {
        if (!mergedFail[modelId]) mergedFail[modelId] = new Set();
        for (const id of ids) mergedFail[modelId].add(id);
      }
    }

    await hl.applyPassFail(mergedPass, mergedFail);

    return results;
  }

  async applyHistoryRequirements(idsSpecResults: SpecResult[] = [], i: number): Promise<SpecResult[]> {
    const hl = this.components.get(FrontFunctions);
    const { pass, fail } = idsSpecResults[i];
    await hl.applyPassFail(pass, fail);
    return idsSpecResults;
  }

  async clear() {
    const hl = this.components.get(FrontFunctions);
    await hl.reset();
  }
}