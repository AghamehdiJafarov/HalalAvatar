export const SCENE_W = 1600;
export const SCENE_H = 900;          // scene 16:9; video 1920x1080 (scale x1.2)
export const FPS = 30;
export const VIDEO_W = 1920;
export const VIDEO_H = 1080;         // even sizes required by yuv420p

export const DESK_TOP_Y = 640;       // desk top line; torso bottom = this line
export const DESK = { x: 250, y: 640, w: 1100, h: 60 };

export const HEAD_C = { x: 800, y: 290 };
export const HEAD_R = 85;

// Pivots of animated groups (scene coordinates)
export const PIVOTS = {
  rt_torso:     { x: 800, y: 640 },
  rt_head:      { x: 800, y: 400 },  // neck base
  rt_arm_L:     { x: 695, y: 455 },  // screen-left shoulder
  rt_arm_R:     { x: 905, y: 455 },
  rt_forearm_L: { x: 635, y: 560 },  // elbow
  rt_forearm_R: { x: 965, y: 560 },
  rt_hand_L:    { x: 760, y: 615 },  // wrist
  rt_hand_R:    { x: 870, y: 615 },
} as const;
export type RigTarget = keyof typeof PIVOTS;

// Additive delta limits (runtime clamp)
export const LIMITS = { r: 25, t: 40, s: 0.05 };

export const MAX_TTS_CHARS = 600;
export const MAX_VIDEO_MS = 90_000;

// Face zone (facelessness rule 4.4)
export const FACE_ZONE = { x: 800, y: 295, r: 62 };
