// scripts/copy-assets.mjs
// Copies web-ifc WASM binaries AND the fragments worker into /public
// so Vite serves them statically (no CORS issues).
// Runs automatically after `npm install` via the "postinstall" script.

import { copyFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dest = resolve(root, "public");

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const assets = [
  // web-ifc WASM binaries
  {
    from: resolve(root, "node_modules/web-ifc/web-ifc.wasm"),
    to: resolve(dest, "web-ifc.wasm"),
  },
  {
    from: resolve(root, "node_modules/web-ifc/web-ifc-mt.wasm"),
    to: resolve(dest, "web-ifc-mt.wasm"),
  },
  // Fragments worker — must be served locally to avoid CORS
  {
    from: resolve(root, "node_modules/@thatopen/fragments/dist/worker/worker.mjs"),
    to: resolve(dest, "worker.mjs"),
  },
];

for (const { from, to } of assets) {
  if (existsSync(from)) {
    copyFileSync(from, to);
    console.log(`✅  Copied ${from.split("node_modules/")[1]} → public/`);
  } else {
    console.warn(`⚠️   Not found: ${from} — skipping`);
  }
}
