"use client";
export function PaletteSwatch({ name, map, selected, onClick }: {
  name: string; map: Record<string, string>; selected: boolean; onClick: () => void;
}) {
  const keys = ["--c-wall", "--c-desk", "--c-shirt", "--c-accent"];
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${selected ? "border-neutral-900" : "border-neutral-200"}`}>
      <span className="flex">{keys.map((k) => <span key={k} className="h-5 w-5 rounded-sm" style={{ background: map[k] }} />)}</span>
      <span className="text-sm">{name}</span>
    </button>
  );
}
