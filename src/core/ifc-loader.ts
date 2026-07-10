import * as OBC from "@thatopen/components";

export async function loadIfc(
  components: OBC.Components,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const ifcLoader = components.get(OBC.IfcLoader);

  await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/", absolute: true } });

  const buffer = await file.arrayBuffer();
  await ifcLoader.load(new Uint8Array(buffer), false, file.name, {
    processData: { progressCallback: (p: number) => onProgress?.(Math.round(p * 100)) },
  });
}
