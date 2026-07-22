"use client";
import { useEffect, useState } from "react";

interface Props {
  text: string;
  marks?: { word: string; tMs: number }[];
  audio?: HTMLAudioElement | null;
}

// Highlight the currently spoken word by marks; without marks show full text.
export function SubtitleBar({ text, marks, audio }: Props) {
  const [idx, setIdx] = useState(-1);
  useEffect(() => {
    if (!audio || !marks?.length) { setIdx(-1); return; }
    let raf = 0;
    const tick = () => {
      const t = audio.currentTime * 1000;
      let i = -1;
      for (let k = 0; k < marks.length; k++) if (marks[k]!.tMs <= t) i = k; else break;
      setIdx(i);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio, marks]);

  if (!marks?.length) return <p className="text-center text-lg text-neutral-700">{text}</p>;
  const words = text.split(/\s+/);
  return (
    <p className="text-center text-lg leading-relaxed">
      {words.map((w, i) => (
        <span key={i} className={i === idx ? "text-neutral-900 font-semibold" : "text-neutral-400"}>{w}{" "}</span>
      ))}
    </p>
  );
}
