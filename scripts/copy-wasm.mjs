import { copyFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules", "web-ifc");
const dest = resolve(root, "public");

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

for (const file of ["web-ifc.wasm", "web-ifc-mt.wasm"]) {
  const from = resolve(src, file);
  const to = resolve(dest, file);
  if (existsSync(from)) {
    copyFileSync(from, to);
    console.log(`✅  Copied ${file} → public/`);
  } else {
    console.warn(`⚠️   ${file} not found — skipping`);
  }
}
