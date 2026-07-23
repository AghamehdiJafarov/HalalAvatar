import { parseSync, type INode } from "svgson";

// ---- Whitelists (spec 4.2) ----
export const ALLOWED_TAGS = new Set([
  "symbol", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
]);
export const ALLOWED_ATTRS = new Set([
  "id", "viewBox", "d", "x", "y", "width", "height", "rx", "ry",
  "cx", "cy", "r", "x1", "y1", "x2", "y2", "points",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "fill-rule", "transform",
]);

// ---- Color tokens (spec 4.3) ----
export const COLOR_TOKENS = new Set([
  "--c-wall", "--c-wall2", "--c-desk", "--c-skin", "--c-hair", "--c-headwear",
  "--c-shirt", "--c-shirt2", "--c-dark", "--c-white", "--c-accent", "--c-pants", "--c-shoes",
]);

// ---- Face zone (spec 4.4 / rule): circle (800,295) r62 ----
export const FACE_ZONE = { x: 800, y: 295, r: 62 };

export type ErrCode =
  | "ROOT_NOT_SYMBOL" | "BAD_ID" | "TAG_FORBIDDEN" | "ATTR_FORBIDDEN"
  | "COLOR_NOT_TOKEN" | "OPACITY_FORBIDDEN" | "ROOT_TRANSFORM"
  | "FACE_ZONE_VIOLATION" | "SIZE_LIMIT";

export interface ValErr { code: ErrCode; detail: string }

const COLOR_RE = /^var\((--c-[a-z0-9]+)\)$/;

function checkColor(val: string, errs: ValErr[], where: string): void {
  if (val === "none") return;
  const m = COLOR_RE.exec(val.trim());
  if (!m) { errs.push({ code: "COLOR_NOT_TOKEN", detail: `${where}="${val}"` }); return; }
  if (!COLOR_TOKENS.has(m[1]!)) errs.push({ code: "COLOR_NOT_TOKEN", detail: `${where}="${val}"` });
}

// Extract numeric pairs from a node for a rough bounding box (spec 19: err on the safe side).
function numbersOf(node: INode): number[] {
  const a = node.attributes;
  const nums: number[] = [];
  const push = (s?: string) => { if (s) for (const t of s.match(/-?\d+(\.\d+)?/g) ?? []) nums.push(parseFloat(t)); };
  if (node.name === "path") push(a.d);
  else if (node.name === "polyline" || node.name === "polygon") push(a.points);
  else {
    for (const k of ["x", "y", "width", "height", "cx", "cy", "r", "x1", "y1", "x2", "y2", "rx", "ry"]) push(a[k]);
  }
  return nums;
}

// Rough bbox: treat consecutive numbers as x,y pairs; also fold in rect/circle extents.
function bboxOf(node: INode): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const a = node.attributes;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const fold = (x: number, y: number) => {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  if (node.name === "circle" || node.name === "ellipse") {
    const cx = parseFloat(a.cx ?? "NaN"), cy = parseFloat(a.cy ?? "NaN");
    const rx = parseFloat(a.r ?? a.rx ?? "0"), ry = parseFloat(a.r ?? a.ry ?? "0");
    if (!Number.isNaN(cx) && !Number.isNaN(cy)) { fold(cx - rx, cy - ry); fold(cx + rx, cy + ry); }
  } else if (node.name === "rect") {
    const x = parseFloat(a.x ?? "NaN"), y = parseFloat(a.y ?? "NaN");
    const w = parseFloat(a.width ?? "0"), h = parseFloat(a.height ?? "0");
    if (!Number.isNaN(x) && !Number.isNaN(y)) { fold(x, y); fold(x + w, y + h); }
  } else {
    const nums = numbersOf(node);
    for (let i = 0; i + 1 < nums.length; i += 2) fold(nums[i]!, nums[i + 1]!);
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

function bboxInsideFaceZone(b: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  // entirely inside the face-zone circle: all 4 corners within radius
  const { x, y, r } = FACE_ZONE;
  const corners = [[b.minX, b.minY], [b.maxX, b.minY], [b.minX, b.maxY], [b.maxX, b.maxY]];
  return corners.every(([cx, cy]) => (cx! - x) ** 2 + (cy! - y) ** 2 <= r * r);
}

/**
 * Validate a single part SVG string.
 * @param expectedId the id derived from file path (p_<slot>_<name>), or null to skip id check
 * @param slot the slot name derived from path (for face-zone exemptions), or null
 * @param bytes file size in bytes
 */
export function validatePart(
  svg: string,
  expectedId: string | null,
  slot: string | null,
  bytes: number,
): ValErr[] {
  const errs: ValErr[] = [];
  let root: INode;
  try {
    // svgson.parseSync only accepts a root <svg>; wrap then unwrap the single child.
    const wrapped = parseSync(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    const child = (wrapped.children ?? []).find((c) => c.type === "element");
    if (!child) { errs.push({ code: "ROOT_NOT_SYMBOL", detail: "empty part" }); return errs; }
    root = child;
  } catch (e) {
    errs.push({ code: "ROOT_NOT_SYMBOL", detail: `parse error: ${(e as Error).message}` });
    return errs;
  }

  // Root must be <symbol> with exact viewBox
  if (root.name !== "symbol") errs.push({ code: "ROOT_NOT_SYMBOL", detail: `root <${root.name}>` });
  if (root.attributes.viewBox !== "0 0 1600 900")
    errs.push({ code: "ROOT_NOT_SYMBOL", detail: `viewBox="${root.attributes.viewBox ?? ""}"` });

  // Root id must match expected
  if (expectedId != null && root.attributes.id !== expectedId)
    errs.push({ code: "BAD_ID", detail: `got "${root.attributes.id ?? ""}", expected "${expectedId}"` });

  // Root transform forbidden
  if (root.attributes.transform)
    errs.push({ code: "ROOT_TRANSFORM", detail: `transform on root symbol` });

  if (bytes > 8 * 1024) errs.push({ code: "SIZE_LIMIT", detail: `${bytes} bytes > 8192` });

  const isGlasses = slot === "glasses";
  const isHeadLike = slot === "head" || slot === "headwear";

  const walk = (node: INode): void => {
    if (node.name !== "symbol") {
      if (!ALLOWED_TAGS.has(node.name))
        errs.push({ code: "TAG_FORBIDDEN", detail: `<${node.name}>` });
      for (const [k, v] of Object.entries(node.attributes)) {
        if (k === "opacity" || k === "fill-opacity" || k === "stroke-opacity") {
          errs.push({ code: "OPACITY_FORBIDDEN", detail: k }); continue;
        }
        if (/^on/i.test(k) || k === "href" || k === "xlink:href" || k === "style") {
          errs.push({ code: "ATTR_FORBIDDEN", detail: k }); continue;
        }
        if (!ALLOWED_ATTRS.has(k)) { errs.push({ code: "ATTR_FORBIDDEN", detail: k }); continue; }
        if (k === "fill" || k === "stroke") checkColor(v, errs, k);
      }
      // Face-zone rule 4.4
      if (!isGlasses && ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].includes(node.name)) {
        const b = bboxOf(node);
        if (b && bboxInsideFaceZone(b)) {
          const fill = (node.attributes.fill ?? "").trim();
          const isSkinFill = isHeadLike && fill === "var(--c-skin)";
          if (!isSkinFill) errs.push({ code: "FACE_ZONE_VIOLATION", detail: `<${node.name}> in face zone` });
        }
      }
    }
    for (const c of node.children ?? []) walk(c);
  };
  walk(root);

  return errs;
}
