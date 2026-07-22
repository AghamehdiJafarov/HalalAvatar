import { describe, it, expect } from "vitest";
import { validatePart, type ErrCode } from "../validator";

const ok = `<symbol id="p_head_blank" viewBox="0 0 1600 900"><circle cx="800" cy="290" r="85" fill="var(--c-skin)"/></symbol>`;

function codes(svg: string, id: string | null, slot: string | null, bytes = 200): ErrCode[] {
  return validatePart(svg, id, slot, bytes).map((e) => e.code);
}

describe("validator accepts good part", () => {
  it("clean head passes", () => {
    expect(validatePart(ok, "p_head_blank", "head", 200)).toEqual([]);
  });
});

describe("7 broken fixtures — one per error code", () => {
  it("ROOT_NOT_SYMBOL: wrong root / bad viewBox", () => {
    const svg = `<g id="p_head_blank" viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10" fill="none"/></g>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("ROOT_NOT_SYMBOL");
  });

  it("BAD_ID: id mismatch", () => {
    const svg = `<symbol id="p_wrong_id" viewBox="0 0 1600 900"><rect x="0" y="0" width="10" height="10" fill="none"/></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("BAD_ID");
  });

  it("TAG_FORBIDDEN: <text> not allowed", () => {
    const svg = `<symbol id="p_head_blank" viewBox="0 0 1600 900"><text x="0" y="0">hi</text></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("TAG_FORBIDDEN");
  });

  it("ATTR_FORBIDDEN: href / on* / style", () => {
    const svg = `<symbol id="p_head_blank" viewBox="0 0 1600 900"><rect x="0" y="0" width="10" height="10" fill="none" onclick="x()"/></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("ATTR_FORBIDDEN");
  });

  it("COLOR_NOT_TOKEN: raw hex", () => {
    const svg = `<symbol id="p_head_blank" viewBox="0 0 1600 900"><circle cx="800" cy="290" r="85" fill="#ff0000"/></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("COLOR_NOT_TOKEN");
  });

  it("OPACITY_FORBIDDEN", () => {
    const svg = `<symbol id="p_head_blank" viewBox="0 0 1600 900"><circle cx="800" cy="290" r="85" fill="var(--c-skin)" opacity="0.5"/></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("OPACITY_FORBIDDEN");
  });

  it("ROOT_TRANSFORM", () => {
    const svg = `<symbol id="p_head_blank" viewBox="0 0 1600 900" transform="rotate(5)"><circle cx="800" cy="290" r="85" fill="var(--c-skin)"/></symbol>`;
    expect(codes(svg, "p_head_blank", "head")).toContain("ROOT_TRANSFORM");
  });
});

describe("bonus structural codes", () => {
  it("FACE_ZONE_VIOLATION: stray primitive inside face zone on non-glasses slot", () => {
    const svg = `<symbol id="p_hair_short_a" viewBox="0 0 1600 900"><circle cx="800" cy="295" r="5" fill="var(--c-dark)"/></symbol>`;
    expect(codes(svg, "p_hair_short_a", "hair")).toContain("FACE_ZONE_VIOLATION");
  });

  it("face zone allows glasses", () => {
    const svg = `<symbol id="p_glasses_round" viewBox="0 0 1600 900"><circle cx="800" cy="295" r="5" fill="none" stroke="var(--c-dark)" stroke-width="7"/></symbol>`;
    expect(codes(svg, "p_glasses_round", "glasses")).not.toContain("FACE_ZONE_VIOLATION");
  });

  it("face zone allows single skin fill on head", () => {
    expect(codes(ok, "p_head_blank", "head")).not.toContain("FACE_ZONE_VIOLATION");
  });

  it("SIZE_LIMIT", () => {
    expect(codes(ok, "p_head_blank", "head", 9000)).toContain("SIZE_LIMIT");
  });
});
