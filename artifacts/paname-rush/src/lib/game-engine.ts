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

export interface Crousty {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;       // for arcing/bouncing
  baseY: number;    // ground reference
  spawnX: number;
  endX: number;
  rotation: number; // current rotation in radians
  spin: number;     // rotation speed
}

// Laser: a horizontal or vertical deadly beam that pulses on/off
export interface Laser {
  x: number;
  y: number;
  w: number;
  h: number;
  // Phase in seconds: laser is "on" when (time + offset) % period < onDuration
  period: number;
  onDuration: number;
  offset: number;
  orientation: "horizontal" | "vertical";
}

// Jewel: collectible items that appear in chapter 2 levels (5–10).
// Walking over one collects it (no death, just bumps a counter).
export type JewelType = "diamond" | "ruby" | "crown" | "necklace" | "bracelet";

export interface Jewel {
  x: number;
  y: number;
  w: number;
  h: number;
  type: JewelType;
  collected: boolean;
  // Visual phase offset so jewels don't all bob/sparkle in sync
  phase: number;
}

// Whether the given level should spawn collectible jewels.
export function levelHasJewels(level: number): boolean {
  return level >= 5 && level <= 10;
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
    jumpsRemaining: number;
  };
  platforms: Platform[];
  trains: Train[];
  croustys: Crousty[];
  lasers: Laser[];
  jewels: Jewel[];
  decorations: Decoration[];
  level: number;
  parcours: number;
  totalParcours: number;
  time: number;
  status: "playing" | "dead" | "won_parcours" | "won_level";
  worldEnd: number;     // x position where the level ends
  theme: LevelTheme;
}

export type LevelTheme = "metro" | "rooftops" | "boulevard" | "night" | "kingdom";

// Named levels — Paris-themed names for all 100 levels.
export const LEVEL_NAMES: Record<number, string> = {
  1: "RER A",
  2: "Crousty Attack",
  3: "Métro Châtelet",
  4: "Rue de Rivoli",
  5: "Tour Eiffel",
  6: "Sacré-Cœur",
  7: "Pigalle by Night",
  8: "Canal St-Martin",
  9: "Bastille",
  10: "Champs-Élysées",
  11: "Gare du Nord",
  12: "Belleville Beat",
  13: "Lasers de Beaubourg",
  14: "Rooftop République",
  15: "Bois de Vincennes",
  16: "Crousty Rush",
  17: "Boulevard Magenta",
  18: "Métro Barbès",
  19: "Pont Neuf",
  20: "Tournée du 20e",
  21: "RER B Express",
  22: "Lasers Saint-Lazare",
  23: "Catacombes",
  24: "Crousty Storm",
  25: "Quai de Seine",
  26: "Trocadéro",
  27: "Place Vendôme",
  28: "Le Marais",
  29: "Cimetière du Père-Lachaise",
  30: "Étoile",
  31: "Métro Stalingrad",
  32: "Lasers du Louvre",
  33: "Crousty Rampage",
  34: "Pont des Arts",
  35: "Boulevard Saint-Michel",
  36: "Place de la Concorde",
  37: "Buttes-Chaumont",
  38: "RER C Tornado",
  39: "Lasers de la Défense",
  40: "Tour Montparnasse",
  41: "Crousty Apocalypse",
  42: "Bercy Village",
  43: "Tramway T3",
  44: "Lasers Opéra",
  45: "Quartier Latin",
  46: "Métro Nation",
  47: "Crousty Hurricane",
  48: "Pont Alexandre III",
  49: "Place de la République",
  50: "Mi-Parcours : Boss",
  51: "RER D Furie",
  52: "Lasers Châtelet-Les-Halles",
  53: "Crousty Tsunami",
  54: "Boulevard Périph'",
  55: "Métro 14",
  56: "Roof Run République",
  57: "Lasers Bibliothèque",
  58: "Crousty Inferno",
  59: "Bouquinistes",
  60: "Pont Marie",
  61: "Métro Censier",
  62: "Lasers Bastille",
  63: "Crousty Vortex",
  64: "Sacré-Cœur Express",
  65: "Place Vendôme Sprint",
  66: "Lasers Forum des Halles",
  67: "Crousty Cataclysme",
  68: "Métro Abbesses",
  69: "Bois de Boulogne",
  70: "Pyramide du Louvre",
  71: "Crousty Anarchie",
  72: "Lasers Tour Eiffel",
  73: "Tramway Express",
  74: "Métro Arts-et-Métiers",
  75: "Trois Quarts",
  76: "RER E Délire",
  77: "Lasers Pigalle",
  78: "Crousty Délire",
  79: "Boulevard Voltaire",
  80: "Place d'Italie",
  81: "Métro Pyramides",
  82: "Lasers Notre-Dame",
  83: "Crousty Chaos",
  84: "Pont de l'Alma",
  85: "Marché aux Puces",
  86: "Métro Réaumur",
  87: "Lasers Gare de Lyon",
  88: "Crousty Frénésie",
  89: "Place du Tertre",
  90: "Sprint final",
  91: "Métro Hyper-Vitesse",
  92: "Lasers de l'Observatoire",
  93: "Crousty Massacre",
  94: "Périph' Infini",
  95: "Lasers du Trocadéro",
  96: "Crousty Damné",
  97: "Maze de Montmartre",
  98: "Métro Fantôme",
  99: "Lasers Apocalypse",
  100: "Boss Final : Tour Paname",
};

export function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Niveau ${level}`;
}

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

// Whether a laser is currently emitting (and therefore deadly) at a given time.
export function isLaserActive(l: Laser, time: number): boolean {
  const t = (time + l.offset) % l.period;
  return t >= 0 && t < l.onDuration;
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
  // Chapter 1 (levels 1-4) — "Royaume de Maître Crousty".
  // Matches the intro cinematic art direction (sandstone castle, bright sky).
  if (level <= 4) return "kingdom";
  const themes: LevelTheme[] = ["boulevard", "metro", "rooftops", "night"];
  return themes[(level - 5) % themes.length];
}

export function getTotalParcours(level: number) {
  if (level <= 2) return 1;
  if (level <= 30) return 2;
  if (level <= 70) return 3;
  if (level < 100) return 4;
  return 5; // boss
}

// Per-level mechanic mix: which obstacle families show up.
function levelMechanics(level: number) {
  // From the named list, deduce from name. Fallback by level number.
  const name = (LEVEL_NAMES[level] ?? "").toLowerCase();
  const hasLaserName = name.includes("laser");
  const hasCroustyName = name.includes("crousty");

  // Default: trains. Add lasers/croustys based on level milestones for variety.
  const useTrains = !hasLaserName && !hasCroustyName ? true : level >= 20;
  const useCroustys = hasCroustyName || level === 2 || (level % 5 === 0 && level > 10);
  const useLasers = hasLaserName || (level >= 13 && level % 7 === 0);

  // Boss / late-game: enable everything.
  const isBoss = level === 50 || level === 100;
  return {
    useTrains: isBoss ? true : useTrains,
    useCroustys: isBoss ? true : useCroustys,
    useLasers: isBoss ? true : useLasers,
    isBoss,
  };
}

interface GeneratedLevel {
  platforms: Platform[];
  trains: Train[];
  croustys: Crousty[];
  lasers: Laser[];
  jewels: Jewel[];
  decorations: Decoration[];
  worldEnd: number;
  theme: LevelTheme;
}

export function generateLevel(level: number, parcoursIndex: number): GeneratedLevel {
  const seed = level * 100003 + parcoursIndex * 977 + 7;
  const rng = mulberry32(seed);
  const theme = pickTheme(level);
  const mechanics = levelMechanics(level);

  const platforms: Platform[] = [];
  const trains: Train[] = [];
  const croustys: Crousty[] = [];
  const lasers: Laser[] = [];
  const jewels: Jewel[] = [];
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

  const numSegments = 6 + Math.floor(difficulty * 2) + (mechanics.isBoss ? 4 : 0);

  // Helper: pick a hazard family based on what's enabled for this level
  const pickHazard = (): "train" | "crousty" | "laser" => {
    const choices: Array<"train" | "crousty" | "laser"> = [];
    if (mechanics.useTrains) choices.push("train");
    if (mechanics.useCroustys) choices.push("crousty");
    if (mechanics.useLasers) choices.push("laser");
    if (choices.length === 0) choices.push("train");
    return choices[Math.floor(rng() * choices.length)];
  };

  for (let i = 0; i < numSegments; i++) {
    const r = rng();
    const useHazard = r < 0.4 + difficulty * 0.02 && i > 0;
    const useFloating = !useHazard && r < 0.7;

    if (useHazard) {
      const hazard = pickHazard();
      const stretchLen = 280 + rng() * 120;
      const gapAfter = 80 + rng() * 40;

      if (hazard === "crousty") {
        platforms.push({ x: currentX, y: groundY, w: stretchLen, h: 60, type: startType });

        const numCroustys = 1 + Math.floor(rng() * 3);
        for (let cIx = 0; cIx < numCroustys; cIx++) {
          const cw = 70 + rng() * 30;
          const ch = 50 + rng() * 20;
          const fromRight = rng() < 0.5;
          const speed = 3 + difficulty * 0.3 + rng() * 1.5;
          const startXc = fromRight ? currentX + stretchLen + 40 : currentX - cw - 40;
          const endXc = fromRight ? currentX - cw - 80 : currentX + stretchLen + 80;
          croustys.push({
            x: startXc,
            y: groundY - ch - 60 - rng() * 80,
            w: cw,
            h: ch,
            vx: fromRight ? -speed : speed,
            vy: -2 - rng() * 2,
            baseY: groundY - ch - 80,
            spawnX: startXc,
            endX: endXc,
            rotation: rng() * Math.PI * 2,
            spin: (rng() - 0.5) * 0.08,
          });
        }

        decorations.push({ x: currentX + 20, y: groundY, type: "sign", scale: 0.9, parallax: 0 });
        decorations.push({ x: currentX + stretchLen - 30, y: groundY, type: "lamp", scale: 0.9, parallax: 0 });
      } else if (hazard === "laser") {
        // Ground stretch with one or more pulsing horizontal/vertical lasers
        platforms.push({ x: currentX, y: groundY, w: stretchLen, h: 60, type: startType });

        const numLasers = 1 + Math.floor(rng() * 2) + (mechanics.isBoss ? 1 : 0);
        for (let lIx = 0; lIx < numLasers; lIx++) {
          const isVertical = rng() < 0.55;
          const lx = currentX + 40 + (lIx + 0.5) * (stretchLen / (numLasers + 1));
          if (isVertical) {
            // Vertical beam from sky to ground (spans almost the playfield)
            const beamH = 380;
            lasers.push({
              x: lx - 6,
              y: groundY - beamH,
              w: 12,
              h: beamH,
              period: 1.6 - Math.min(0.6, difficulty * 0.04),
              onDuration: 0.55 + rng() * 0.15,
              offset: rng() * 1.5,
              orientation: "vertical",
            });
          } else {
            // Horizontal beam at jump-height (~140 above ground)
            const beamW = 160 + rng() * 80;
            lasers.push({
              x: lx - beamW / 2,
              y: groundY - 140 - rng() * 40,
              w: beamW,
              h: 12,
              period: 1.6 - Math.min(0.6, difficulty * 0.04),
              onDuration: 0.55 + rng() * 0.15,
              offset: rng() * 1.5,
              orientation: "horizontal",
            });
          }
        }

        decorations.push({ x: currentX + 20, y: groundY, type: "sign", scale: 0.9, parallax: 0 });
        decorations.push({ x: currentX + stretchLen - 30, y: groundY, type: "lamp", scale: 0.9, parallax: 0 });
      } else {
        // Train hazard
        platforms.push({ x: currentX, y: groundY, w: stretchLen, h: 60, type: "rail" });

        const trainH = 70;
        const trainW = 130 + rng() * 60;
        const trainY = groundY - trainH;
        const speed = 2.5 + difficulty * 0.25 + rng() * 1.5;
        const fromRight = rng() < 0.5;
        const palette = ["#fbbf24", "#22d3ee", "#f87171", "#a78bfa", "#34d399"];
        trains.push({
          x: fromRight ? currentX + stretchLen : currentX - trainW,
          y: trainY,
          w: trainW,
          h: trainH,
          vx: fromRight ? -speed : speed,
          spawnX: fromRight ? currentX + stretchLen : currentX - trainW,
          endX: fromRight ? currentX - trainW - 60 : currentX + stretchLen + 60,
          color: palette[Math.floor(rng() * palette.length)],
        });

        decorations.push({ x: currentX + 20, y: groundY, type: "lamp", scale: 0.9, parallax: 0 });
        decorations.push({ x: currentX + stretchLen - 30, y: groundY, type: "sign", scale: 0.9, parallax: 0 });
      }

      currentX += stretchLen + gapAfter;
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

  // ── Jewels (chapter 2: levels 5–10) ──────────────────────
  // Sprinkle 6–10 collectible jewels across the level. We place them above
  // walkable platforms (avoiding lava/goal) and slightly above ground so the
  // player walks/jumps through them.
  if (levelHasJewels(level)) {
    const jewelTypes: JewelType[] = ["diamond", "ruby", "crown", "necklace", "bracelet"];
    const walkable = platforms.filter(
      (p) => p.type !== "lava" && p.type !== "goal" && p.w >= 50 && p.y < 700,
    );
    const jewelCount = 6 + Math.floor(rng() * 5); // 6–10 jewels per level
    for (let j = 0; j < jewelCount && walkable.length > 0; j++) {
      const plat = walkable[Math.floor(rng() * walkable.length)];
      const jw = 26;
      const jh = 26;
      // Position above the platform surface — sometimes "floating" so the
      // player has to jump for it.
      const liftAboveSurface = 18 + Math.floor(rng() * 60); // 18–78px
      const margin = 12;
      const usableW = Math.max(0, plat.w - jw - margin * 2);
      const jx = plat.x + margin + rng() * usableW;
      const jy = plat.y - jh - liftAboveSurface;
      jewels.push({
        x: jx,
        y: jy,
        w: jw,
        h: jh,
        type: jewelTypes[Math.floor(rng() * jewelTypes.length)],
        collected: false,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  // ── Goal platform ────────────────────────────────────────
  const goalX = currentX + 80;
  const goalY = groundY - 90;
  platforms.push({ x: goalX - 20, y: groundY, w: 140, h: 60, type: startType });
  platforms.push({ x: goalX, y: goalY, w: 100, h: 90, type: "goal" });

  // ── Floor lava (death pit) ───────────────────────────────
  platforms.push({ x: -2000, y: 720, w: goalX + 5000, h: 200, type: "lava" });

  // ── Background decorations (parallax) ────────────────────
  const skyEnd = goalX + 200;
  decorations.push({
    x: 100,
    y: 60,
    type: theme === "night" ? "moon" : "cloud",
    scale: 1.4,
    parallax: 0.9,
  });
  for (let c = 0; c < 6; c++) {
    decorations.push({
      x: rng() * skyEnd,
      y: 40 + rng() * 120,
      type: "cloud",
      scale: 0.7 + rng() * 0.8,
      parallax: 0.85,
    });
  }
  for (let b = 0; b < 14; b++) {
    decorations.push({
      x: rng() * skyEnd,
      y: groundY,
      type: "building",
      scale: 0.6 + rng() * 0.7,
      parallax: 0.55,
    });
  }
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
    croustys,
    lasers,
    jewels,
    decorations,
    worldEnd: goalX + 200,
    theme,
  };
}
