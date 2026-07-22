"use client";
import { useEffect, useRef } from "react";
import { ASSETS_VERSION } from "@faceless/avatar-core";

// Mini preview of a single part id, using the injected sprite sheet + current palette tokens.
export function PartThumb({ partId, paletteMap, selected, onClick }: {
  partId: string | null;
  paletteMap: Record<string, string>;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const style = Object.entries(paletteMap).map(([k, v]) => `${k}:${v}`).join(";");
    const use = partId ? `<use href="#${partId}"/>` : "";
    ref.current.innerHTML =
      `<svg viewBox="0 0 1600 900" width="120" height="68" style="${style}">${use}</svg>`;
  }, [partId, paletteMap]);
  void ASSETS_VERSION;
  return (
    <button onClick={onClick} className={`rounded-lg border p-1 ${selected ? "border-neutral-900" : "border-neutral-200"}`}>
      <div ref={ref} className="h-[68px] w-[120px] overflow-hidden bg-neutral-100" />
    </button>
  );
}
