// Game Engine Core
export type Rect = { x: number; y: number; w: number; h: number };

export type PlatformType =
  | "normal"      // standard ground / building roof
  | "lava"        // deadly red zone
  | "goal"        // yellow goal
  | "rail"        // train rails (visual only, walkable)
  | "metro"       // metro platform (walkable, decorated)
  | "rooftop";    // building rooftop (walkable, decorated)

export interface Platform extends Rect {
  type: PlatformType;
}

export type DecorationType =
  | "lamp"
  | "tree"
  | "bench"
  | "sign"
  | "tower"      // mini Eiffel tower silhouette
  | "cloud"
  | "building"   // background building
  | "moon";

export interface Decoration {
  x: number;
  y: number;
  type: DecorationType;
  scale: number;
  // parallax: 0 = static (foreground), 1 = locked to camera (sky)
  parallax: number;
}

export interface Train {
  x: number;        // current x
  y: number;        // top y of the train
  w: number;        // length
  h: number;        // height
  vx: number;       // velocity (px/frame)
  spawnX: number;
  endX: number;
  color: string;
}

export interface GameState {
  player: {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    color: string;
    isGrounded: boolean;
  };
  platforms: Platform[];
  trains: Train[];
  decorations: Decoration[];
  level: number;
  parcours: number;
  totalParcours: number;
  time: number;
  status: "playing" | "dead" | "won_parcours" | "won_level";
  worldEnd: number;     // x position where the level ends
  theme: LevelTheme;
}

export type LevelTheme = "metro" | "rooftops" | "boulevard" | "night";

export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;
export const MOVE_SPEED = 5;
export const MAX_FALL_SPEED = 15;

export function checkCollision(r1: Rect, r2: Rect) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

// ──────────────────────────────────────────────────────────────
// Seeded PRNG (Mulberry32) — same (level, parcours) → same map
// ──────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTheme(level: number): LevelTheme {
  const themes: LevelTheme[] = ["boulevard", "metro", "rooftops", "night"];
  return themes[(level - 1) % themes.length];
}

export function getTotalParcours(level: number) {
  if (level <= 2) return 1;
  if (level < 100) return 2;
  return 4;
}

interface GeneratedLevel {
  platforms: Platform[];
  trains: Train[];
  decorations: Decoration[];
  worldEnd: number;
  theme: LevelTheme;
}

export function generateLevel(level: number, parcoursIndex: number): GeneratedLevel {
  const seed = level * 100003 + parcoursIndex * 977 + 7;
  const rng = mulberry32(seed);
  const theme = pickTheme(level);

  const platforms: Platform[] = [];
  const trains: Train[] = [];
  const decorations: Decoration[] = [];

  const difficulty = Math.min(level / 10, 10); // 0 to 10
  const groundY = 540;

  // ── Starting platform ────────────────────────────────────
  const startType: PlatformType =
    theme === "metro" ? "metro" : theme === "rooftops" ? "rooftop" : "normal";
  platforms.push({ x: 0, y: groundY, w: 280, h: 60, type: startType });

  // Decorate start
  decorations.push({ x: 60, y: groundY, type: "lamp", scale: 1, parallax: 0 });
  decorations.push({ x: 180, y: groundY, type: "sign", scale: 1, parallax: 0 });

  let currentX = 280;
  let currentY = groundY;

  const numSegments = 6 + Math.floor(difficulty * 2);

  for (let i = 0; i < numSegments; i++) {
    // Decide segment type
    const r = rng();
    const useTrain = r < 0.35 + difficulty * 0.02 && i > 0;
    const useFloating = !useTrain && r < 0.65;

    if (useTrain) {
      // Train segment: rails on the ground with a gap, train moves over them
      const railLen = 280 + rng() * 120;
      const gapAfter = 80 + rng() * 40;

      // Rails are walkable but flush with ground
      platforms.push({
        x: currentX,
        y: groundY,
        w: railLen,
        h: 60,
        type: "rail",
      });

      // Train: tall enough that you must jump over it
      const trainH = 70;
      const trainW = 130 + rng() * 60;
      const trainY = groundY - trainH; // sits ON the rails
      const speed = 2.5 + difficulty * 0.25 + rng() * 1.5;
      // Half spawn from the right (-vx), half from the left (+vx)
      const fromRight = rng() < 0.5;
      const palette = ["#fbbf24", "#22d3ee", "#f87171", "#a78bfa", "#34d399"];
      trains.push({
        x: fromRight ? currentX + railLen : currentX - trainW,
        y: trainY,
        w: trainW,
        h: trainH,
        vx: fromRight ? -speed : speed,
        spawnX: fromRight ? currentX + railLen : currentX - trainW,
        endX: fromRight ? currentX - trainW - 60 : currentX + railLen + 60,
        color: palette[Math.floor(rng() * palette.length)],
      });

      // Decorate rails
      decorations.push({ x: currentX + 20, y: groundY, type: "lamp", scale: 0.9, parallax: 0 });
      decorations.push({ x: currentX + railLen - 30, y: groundY, type: "sign", scale: 0.9, parallax: 0 });

      currentX += railLen + gapAfter;
      currentY = groundY;
    } else if (useFloating) {
      // Floating platform with a gap
      const gapX = 90 + rng() * (40 + difficulty * 8);
      const dy = (rng() - 0.5) * 120;
      currentX += gapX;
      currentY = Math.max(220, Math.min(groundY, currentY + dy));

      const width = Math.max(60, 160 - difficulty * 8);
      const platType: PlatformType =
        theme === "rooftops" ? "rooftop" : theme === "metro" ? "metro" : "normal";
      platforms.push({ x: currentX, y: currentY, w: width, h: 28, type: platType });

      // Random decoration on top
      if (rng() < 0.4) {
        decorations.push({
          x: currentX + width / 2 - 8,
          y: currentY,
          type: rng() < 0.5 ? "lamp" : "tree",
          scale: 0.85,
          parallax: 0,
        });
      }

      currentX += width;
    } else {
      // Ground segment
      const len = 200 + rng() * 200;
      platforms.push({ x: currentX, y: groundY, w: len, h: 60, type: startType });

      // Add some decorations
      const numDecos = 1 + Math.floor(rng() * 3);
      for (let d = 0; d < numDecos; d++) {
        const dx = currentX + 30 + rng() * (len - 60);
        const choices: DecorationType[] =
          theme === "boulevard"
            ? ["lamp", "tree", "bench", "sign"]
            : theme === "metro"
            ? ["sign", "lamp"]
            : theme === "rooftops"
            ? ["tower", "lamp"]
            : ["lamp", "tree", "moon"];
        decorations.push({
          x: dx,
          y: groundY,
          type: choices[Math.floor(rng() * choices.length)],
          scale: 0.9 + rng() * 0.3,
          parallax: 0,
        });
      }

      // Maybe a small lava pit at the end
      if (rng() < 0.25 + difficulty * 0.02) {
        const pitW = 60 + rng() * 40;
        platforms.push({ x: currentX + len, y: groundY + 20, w: pitW, h: 40, type: "lava" });
        currentX += len + pitW;
      } else {
        currentX += len;
      }
    }
  }

  // ── Goal platform ────────────────────────────────────────
  const goalX = currentX + 80;
  const goalY = groundY - 90;
  // Pedestal under goal
  platforms.push({ x: goalX - 20, y: groundY, w: 140, h: 60, type: startType });
  // The goal trigger (yellow zone)
  platforms.push({ x: goalX, y: goalY, w: 100, h: 90, type: "goal" });

  // ── Floor lava (death pit) ───────────────────────────────
  platforms.push({ x: -2000, y: 720, w: goalX + 5000, h: 200, type: "lava" });

  // ── Background decorations (parallax) ────────────────────
  const skyEnd = goalX + 200;
  // Moon / sun
  decorations.push({
    x: 100,
    y: 60,
    type: theme === "night" ? "moon" : "cloud",
    scale: 1.4,
    parallax: 0.9,
  });
  // Clouds
  for (let c = 0; c < 6; c++) {
    decorations.push({
      x: rng() * skyEnd,
      y: 40 + rng() * 120,
      type: "cloud",
      scale: 0.7 + rng() * 0.8,
      parallax: 0.85,
    });
  }
  // Mid-back buildings
  for (let b = 0; b < 14; b++) {
    decorations.push({
      x: rng() * skyEnd,
      y: groundY,
      type: "building",
      scale: 0.6 + rng() * 0.7,
      parallax: 0.55,
    });
  }
  // Eiffel tower somewhere
  decorations.push({
    x: skyEnd * (0.3 + rng() * 0.4),
    y: groundY,
    type: "tower",
    scale: 1.2 + rng() * 0.4,
    parallax: 0.5,
  });

  return {
    platforms,
    trains,
    decorations,
    worldEnd: goalX + 200,
    theme,
  };
}
