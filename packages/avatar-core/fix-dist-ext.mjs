// Post-build: append .js to relative import/export specifiers in emitted dist/*.js
// so the output is valid ESM for Node (worker, NodeNext). Idempotent; dist-only.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("./dist/", import.meta.url).pathname;
const rel = /(from\s+|import\s+|export\s+\*\s+from\s+)(["'])(\.\.?\/[^"']+?)(["'])/g;

for (const f of readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const p = join(dir, f);
  let src = readFileSync(p, "utf8");
  src = src.replace(rel, (m, kw, q1, spec, q2) => {
    if (spec.endsWith(".js") || spec.endsWith(".json")) return m;
    return `${kw}${q1}${spec}.js${q2}`;
  });
  writeFileSync(p, src);
}
console.log("dist import extensions fixed");
