"use client";
import { useEffect, useRef, useState } from "react";
import { AvatarPlayer, type AvatarConfig, type Instance } from "@faceless/avatar-core";
import { loadClientAssets, composeBrowserScene, type ClientAssets } from "@/lib/avatar-client";

interface Props {
  config: AvatarConfig;
  instances?: Instance[];
  audio?: HTMLAudioElement | null;
  /** Wrap playback time so catalog loops repeat forever. 0 = no wrapping. */
  loopMs?: number;
}

const IDLE: Instance[] = [
  { clip: "idle_breathe", startMs: 0, endMs: 10_000_000 },
  { clip: "idle_sway", startMs: 0, endMs: 10_000_000 },
];

export function AvatarStage({ config, instances, audio, loopMs = 0 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AvatarPlayer | null>(null);
  const [assets, setAssets] = useState<ClientAssets | null>(null);

  useEffect(() => { loadClientAssets().then(setAssets).catch(() => {}); }, []);

  // (Re)compose the scene when config or assets change.
  useEffect(() => {
    if (!assets || !hostRef.current) return;
    hostRef.current.innerHTML = composeBrowserScene(assets, config); // trusted compositor output
    const svg = hostRef.current.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    svg.setAttribute("width", "100%");
    svg.style.maxHeight = "900px";
    playerRef.current = new AvatarPlayer(svg, assets.clips, { loopMs });
    playerRef.current.load(instances && instances.length ? instances : IDLE);
    playerRef.current.start();
    return () => playerRef.current?.stop();
  }, [assets, config]);

  // Swap timeline / loop window without rebuilding the DOM tree.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.setLoopMs(loopMs);
    p.load(instances && instances.length ? instances : IDLE);
    if (audio) p.attachAudio(audio);
    p.start();
  }, [instances, audio, loopMs]);

  return (
    <div className="w-full overflow-hidden rounded-xl bg-neutral-900/5" style={{ aspectRatio: "16 / 9" }}>
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
