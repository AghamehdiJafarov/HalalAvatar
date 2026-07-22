import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

// Spec 2.1: no image-generation strings anywhere in sources.
const FORBIDDEN = ["dall-e", "stability", "replicate", "image/generations", "midjourney"];

describe("no-image-generation invariant", () => {
  it("source tree contains no forbidden generative strings", () => {
    const root = new URL("../../..", import.meta.url).pathname;
    for (const needle of FORBIDDEN) {
      let hits = "";
      try {
        hits = execSync(
          `grep -rIl --include=*.ts --include=*.tsx --include=*.js --include=*.mjs --include=*.json ` +
          `--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist ` +
          `-i -F ${JSON.stringify(needle)} ${JSON.stringify(root)}`,
          { encoding: "utf8" },
        );
      } catch { hits = ""; } // grep exits 1 when nothing found
      // allow this test file itself
      const files = hits.split("\n").filter((f) => f && !f.endsWith("invariant.test.ts"));
      expect(files, `found "${needle}" in: ${files.join(", ")}`).toEqual([]);
    }
  });
});
