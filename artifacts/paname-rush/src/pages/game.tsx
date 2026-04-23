import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  generateLevel, getTotalParcours, getLevelName,
  checkCollision, GRAVITY, JUMP_FORCE, MOVE_SPEED, MAX_FALL_SPEED,
  type GameState, type Rect, type Platform, type Decoration, type LevelTheme
} from "@/lib/game-engine";
import { 
  useStartGame, 
  useCompleteLevel, 
  useUpdatePlayerProgress
} from "@workspace/api-client-react";

const croustyImgUrl = `${import.meta.env.BASE_URL}images/crousty.png`;

// ──────────────────────────────────────────────────────────────
// Themed sky / background
// ──────────────────────────────────────────────────────────────
function themePalette(theme: LevelTheme) {
  switch (theme) {
    case "metro":
      return { skyTop: "#1e1b4b", skyBot: "#312e81", ground: "#1f2937", glow: "#fbbf24" };
    case "rooftops":
      return { skyTop: "#fde68a", skyBot: "#fb7185", ground: "#7c2d12", glow: "#fbbf24" };
    case "night":
      return { skyTop: "#020617", skyBot: "#1e3a8a", ground: "#0f172a", glow: "#a5b4fc" };
    case "boulevard":
    default:
      return { skyTop: "#7dd3fc", skyBot: "#fde68a", ground: "#27272a", glow: "#fde047" };
  }
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  theme: LevelTheme,
  time: number
) {
  const pal = themePalette(theme);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stars at night
  if (theme === "night" || theme === "metro") {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 73) % w);
      const sy = ((i * 131) % (h * 0.5));
      const tw = 1 + ((i + Math.floor(time * 2)) % 3 === 0 ? 1 : 0);
      ctx.fillRect(sx, sy, tw, tw);
    }
  }
}

function drawGroundBand(
  ctx: CanvasRenderingContext2D,
  camX: number, vw: number,
  theme: LevelTheme
) {
  const pal = themePalette(theme);
  // Far-back silhouette band
  ctx.fillStyle = pal.ground;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(camX - 100, 600, vw + 400, 200);
  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────────────────────
// Platforms
// ──────────────────────────────────────────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform, theme: LevelTheme) {
  const { x, y, w, h, type } = plat;

  if (type === "lava") {
    // Animated-looking lava with bright top edge
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "#fde047");
    grad.addColorStop(0.3, "#f97316");
    grad.addColorStop(1, "#b91c1c");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Bubbles
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < w; i += 18) {
      ctx.fillRect(x + i + 3, y + 2, 3, 2);
    }
    return;
  }

  if (type === "goal") {
    // Glowing yellow trophy zone with checkered flag
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#fde047";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // Flag pole
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x + w / 2 - 2, y - 30, 4, h + 30);
    // Checkered flag
    const fw = 28, fh = 18;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? "#1f2937" : "#ffffff";
        ctx.fillRect(x + w / 2 + 2 + i * (fw / 4), y - 26 + j * (fh / 3), fw / 4, fh / 3);
      }
    }
    return;
  }

  if (type === "rail") {
    // Train track ground: dark base + sleepers + shiny rails
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(x, y, w, h);
    // Gravel highlights
    ctx.fillStyle = "#52525b";
    for (let i = 0; i < w; i += 8) {
      ctx.fillRect(x + i, y + 8 + ((i * 7) % 6), 3, 2);
    }
    // Sleepers
    ctx.fillStyle = "#78350f";
    for (let i = 0; i < w; i += 24) {
      ctx.fillRect(x + i + 2, y + 28, 18, 8);
    }
    // Rails (two metal lines)
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x, y + 24, w, 3);
    ctx.fillRect(x, y + 38, w, 3);
    return;
  }

  if (type === "metro") {
    // Tiled metro platform with yellow safety stripe
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(x, y, w, h);
    // Tile lines
    ctx.fillStyle = "#d6d3d1";
    for (let i = 0; i < w; i += 24) {
      ctx.fillRect(x + i, y + 4, 1, h - 8);
    }
    for (let j = 0; j < h; j += 24) {
      ctx.fillRect(x + 4, y + j, w - 8, 1);
    }
    // Yellow safety stripe near edge
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x, y + 5, w, 2);
    return;
  }

  if (type === "rooftop") {
    // Rooftop tile with chimney detail
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "#9ca3af");
    grad.addColorStop(1, "#374151");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Roof edge
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x, y, w, 4);
    // Slate texture
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let i = 6; i < w; i += 14) {
      ctx.fillRect(x + i, y + 6, 1, h - 8);
    }
    return;
  }

  // normal: stylized stone block
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "#52525b");
  grad.addColorStop(1, "#27272a");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Top highlight
  ctx.fillStyle = "#71717a";
  ctx.fillRect(x, y, w, 4);
  // Cobble lines
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < w; i += 22) {
    ctx.fillRect(x + i, y + 4, 1, h - 4);
  }
}

// ──────────────────────────────────────────────────────────────
// Train (Paris RER style)
// ──────────────────────────────────────────────────────────────
function drawTrain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  facingRight: boolean
) {
  // Body
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = grad;
  roundedRect(ctx, x, y + 4, w, h - 14, 6);
  ctx.fill();

  // Roof
  ctx.fillStyle = shade(color, -0.5);
  ctx.fillRect(x + 4, y, w - 8, 6);

  // Front nose (a bit darker on front side)
  ctx.fillStyle = shade(color, -0.25);
  if (facingRight) {
    roundedRect(ctx, x + w - 22, y + 8, 22, h - 18, 6);
  } else {
    roundedRect(ctx, x, y + 8, 22, h - 18, 6);
  }
  ctx.fill();

  // Windows
  ctx.fillStyle = "#bae6fd";
  const winW = 18, winH = 16, gap = 6;
  const winY = y + 14;
  let firstWinX = x + 14;
  let lastWinX = x + w - 14 - winW;
  let wx = firstWinX;
  while (wx <= lastWinX) {
    ctx.fillRect(wx, winY, winW, winH);
    // Window divider
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(wx + winW / 2 - 1, winY, 2, winH);
    ctx.fillStyle = "#bae6fd";
    wx += winW + gap;
  }

  // Headlight
  ctx.fillStyle = "#fef9c3";
  if (facingRight) {
    ctx.fillRect(x + w - 6, y + h - 22, 4, 6);
  } else {
    ctx.fillRect(x + 2, y + h - 22, 4, 6);
  }

  // Wheels
  ctx.fillStyle = "#0f172a";
  const wheelR = 7;
  const wheelY = y + h - wheelR;
  const positions = [x + 18, x + w / 2, x + w - 18];
  for (const wx2 of positions) {
    ctx.beginPath();
    ctx.arc(wx2, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.arc(wx2, wheelY, wheelR - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
  }

  // Stripe
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(x + 6, y + h - 16, w - 12, 2);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function shade(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}

// ──────────────────────────────────────────────────────────────
// Decorations
// ──────────────────────────────────────────────────────────────
function drawDecoration(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  type: Decoration["type"],
  scale: number,
  theme: LevelTheme
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  switch (type) {
    case "lamp": {
      // Lamp post
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(-2, -42, 4, 42);
      ctx.fillRect(-8, -42, 16, 4);
      // Bulb
      ctx.fillStyle = "#fde047";
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -48, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "tree": {
      // Trunk
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-3, -28, 6, 28);
      // Foliage circles
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.arc(0, -38, 14, 0, Math.PI * 2);
      ctx.arc(-10, -32, 10, 0, Math.PI * 2);
      ctx.arc(10, -32, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(-3, -42, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bench": {
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-16, -14, 32, 4);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(-14, -10, 3, 10);
      ctx.fillRect(11, -10, 3, 10);
      break;
    }
    case "sign": {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(-1, -36, 2, 36);
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(-14, -38, 28, 12);
      ctx.fillStyle = "#ffffff";
      // "M" for métro
      ctx.fillRect(-9, -36, 2, 8);
      ctx.fillRect(-3, -36, 2, 8);
      ctx.fillRect(3, -36, 2, 8);
      ctx.fillRect(-7, -34, 8, 2);
      break;
    }
    case "tower": {
      // Mini Eiffel silhouette
      ctx.fillStyle = "rgba(31,41,55,0.85)";
      // Base wide → narrow top
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(-5, -160);
      ctx.lineTo(5, -160);
      ctx.lineTo(40, 0);
      ctx.closePath();
      ctx.fill();
      // Mid section
      ctx.fillStyle = "rgba(15,23,42,0.5)";
      ctx.fillRect(-22, -60, 44, 4);
      ctx.fillRect(-30, -30, 60, 4);
      // Antenna
      ctx.fillStyle = "rgba(31,41,55,0.85)";
      ctx.fillRect(-1, -180, 2, 20);
      break;
    }
    case "cloud": {
      ctx.fillStyle = theme === "night" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.arc(14, 2, 12, 0, Math.PI * 2);
      ctx.arc(-14, 4, 10, 0, Math.PI * 2);
      ctx.arc(6, -6, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "moon": {
      ctx.fillStyle = "#fef3c7";
      ctx.shadowColor = "#fef3c7";
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.beginPath();
      ctx.arc(-4, -4, 4, 0, Math.PI * 2);
      ctx.arc(6, 2, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "building": {
      const colors =
        theme === "night"
          ? ["#0f172a", "#1e293b", "#334155"]
          : theme === "rooftops"
          ? ["#92400e", "#b45309", "#7c2d12"]
          : theme === "metro"
          ? ["#1f2937", "#374151", "#4b5563"]
          : ["#475569", "#64748b", "#94a3b8"];
      const c = colors[Math.abs(Math.round(x)) % colors.length];
      const bw = 60, bh = 140 + (Math.abs(Math.round(x)) % 120);
      ctx.fillStyle = c;
      ctx.fillRect(-bw / 2, -bh, bw, bh);
      // Windows
      ctx.fillStyle = theme === "night" ? "#fde68a" : "rgba(255,255,255,0.45)";
      for (let wy = -bh + 12; wy < -10; wy += 18) {
        for (let wx = -bw / 2 + 6; wx < bw / 2 - 6; wx += 14) {
          if ((wx + wy) % 3 === 0) continue;
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
      // Roof
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-bw / 2 - 2, -bh - 4, bw + 4, 4);
      break;
    }
  }

  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  facingRight: boolean
) {
  // T-shaped blocky character inspired by "Chained Together"
  // Bounding box: w x h (default 30x32)
  const px = Math.round(x);
  const py = Math.round(y);

  // ── Proportions ──────────────────────────────────────────
  const headW = Math.round(w * 0.44);   // ~13px
  const headH = Math.round(h * 0.34);   // ~11px
  const torsoW = w;                      // full width
  const torsoH = Math.round(h * 0.28);  // ~9px
  const bodyW  = Math.round(w * 0.40);  // ~12px
  const bodyH  = h - headH - torsoH;    // remaining

  // Head position: top-right if facing right, top-left otherwise
  const headX = facingRight ? px + w - headW : px;
  const headY = py;

  // Torso (shoulders/arms): below head, full width
  const torsoY = py + headH;

  // Body/legs: centered below torso
  const bodyX = px + Math.round((w - bodyW) / 2);
  const bodyY = torsoY + torsoH;

  // ── Draw body ───────────────────────────────────────────
  ctx.fillStyle = color;
  // Head
  ctx.fillRect(headX, headY, headW, headH);
  // Torso
  ctx.fillRect(px, torsoY, torsoW, torsoH);
  // Body / legs
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // ── Dark eye ─────────────────────────────────────────────
  ctx.fillStyle = "#1a1a1a";
  const eyeSize = Math.max(3, Math.round(headW * 0.32));
  const eyeX = facingRight
    ? headX + headW - eyeSize - 2
    : headX + 2;
  const eyeY = headY + 2;
  ctx.fillRect(eyeX, eyeY, eyeSize, eyeSize);

  // ── Pixel highlight (top-left of head) ───────────────────
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(facingRight ? headX + 1 : headX + headW - 3, headY + 1, 2, 2);
}

export default function Game() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const isTeamMode = searchString.includes("mode=team");
  
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  const startGame = useStartGame();
  const completeLevel = useCompleteLevel();
  const updateProgress = useUpdatePlayerProgress();
  
  const [sessionId, setSessionId] = useState<number | null>(null);
  
  const gameStateRef = useRef<GameState | null>(null);
  
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  const [uiState, setUiState] = useState({
    level: 1,
    parcours: 1,
    totalParcours: 1,
    time: 0,
    attempts: 1,
    status: "loading" // loading, playing, dead, won_parcours, won_level
  });

  // Preload crousty obstacle image
  const croustyImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = croustyImgUrl;
    img.onload = () => { croustyImgRef.current = img; };
  }, []);

  // Init game
  useEffect(() => {
    if (!player) {
      setLocation("/");
      return;
    }
    
    // Start session
    startGame.mutate(
      { data: { playerId: player.id, mode: isTeamMode ? "team" : "solo", teamId: isTeamMode && player.teamId ? player.teamId : undefined } },
      {
        onSuccess: (session) => {
          setSessionId(session.id);
          initLevel(session.currentLevel, 1);
        },
        onError: () => {
          toast({ title: "Erreur", description: "Impossible de demarrer la partie.", variant: "destructive" });
          setLocation("/game-mode");
        }
      }
    );
  }, [player, isTeamMode]);

  const initLevel = useCallback((level: number, parcours: number) => {
    if (!player) return;
    
    const totalP = getTotalParcours(level);
    const gen = generateLevel(level, parcours);
    
    gameStateRef.current = {
      player: {
        x: 100,
        y: 400,
        w: 30,
        h: 32,
        vx: 0,
        vy: 0,
        color: player.color,
        isGrounded: false
      },
      platforms: gen.platforms,
      trains: gen.trains.map(t => ({ ...t })),
      croustys: gen.croustys.map(c => ({ ...c })),
      decorations: gen.decorations,
      worldEnd: gen.worldEnd,
      theme: gen.theme,
      level,
      parcours,
      totalParcours: totalP,
      time: parcours === 1 ? 0 : (gameStateRef.current?.time || 0),
      status: "playing"
    };
    
    setUiState((s) => ({
      level,
      parcours,
      totalParcours: totalP,
      time: gameStateRef.current!.time,
      // Reset attempts only when starting a fresh level (parcours 1)
      attempts: parcours === 1 ? 1 : s.attempts,
      status: "playing"
    }));
  }, [player]);

  // Refs to always hold the latest win/die so the rAF loop (with empty deps)
  // doesn't capture a stale version where sessionId/player are still null.
  const winRef = useRef<() => void>(() => {});
  const dieRef = useRef<() => void>(() => {});

  // Game Loop
  const update = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.status !== "playing") return;

    const p = state.player;
    const keys = keysRef.current;

    // Movement
    if (keys["ArrowLeft"] || keys["a"] || keys["q"]) p.vx = -MOVE_SPEED;
    else if (keys["ArrowRight"] || keys["d"] || keys["d"]) p.vx = MOVE_SPEED;
    else p.vx = 0;

    if ((keys["ArrowUp"] || keys["w"] || keys["z"] || keys[" "]) && p.isGrounded) {
      p.vy = JUMP_FORCE;
      p.isGrounded = false;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }

    // Apply physics
    p.vy += GRAVITY;
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;

    p.x += p.vx;
    
    // Horizontal collision (platforms)
    let playerRectX: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const plat of state.platforms) {
      if (checkCollision(playerRectX, plat)) {
        if (plat.type === "lava") {
          dieRef.current();
          return;
        } else if (plat.type === "goal") {
          winRef.current();
          return;
        } else {
          if (p.vx > 0) p.x = plat.x - p.w;
          else if (p.vx < 0) p.x = plat.x + plat.w;
          p.vx = 0;
        }
      }
    }

    p.y += p.vy;
    p.isGrounded = false;

    // Vertical collision (platforms)
    let playerRectY: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const plat of state.platforms) {
      if (checkCollision(playerRectY, plat)) {
        if (plat.type === "lava") {
          dieRef.current();
          return;
        } else if (plat.type === "goal") {
          winRef.current();
          return;
        } else {
          if (p.vy > 0) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.isGrounded = true;
          } else if (p.vy < 0) {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      }
    }

    // ── Croustys: arc through the air, deadly on contact ─────
    for (const c of state.croustys) {
      c.x += c.vx;
      c.vy += 0.18;          // light gravity
      c.y += c.vy;
      c.rotation += c.spin;
      // Bounce upward arc when reaching baseY-ish
      if (c.y > c.baseY + 80) {
        c.vy = -4 - Math.random() * 2;
      }
      // Loop back when off-track
      const offEnd = c.vx > 0 ? c.x > c.endX : c.x < c.endX;
      if (offEnd) {
        c.x = c.spawnX;
        c.y = c.baseY - 60 - Math.random() * 60;
        c.vy = -2 - Math.random() * 2;
      }
      // Collision (deadly always — you cannot stand on a flying plate)
      const cRect: Rect = { x: c.x + 6, y: c.y + 6, w: c.w - 12, h: c.h - 12 };
      if (checkCollision({ x: p.x, y: p.y, w: p.w, h: p.h }, cRect)) {
        dieRef.current();
        return;
      }
    }

    // ── Trains: move and collide ─────────────────────────────
    for (const tr of state.trains) {
      tr.x += tr.vx;
      // Loop train when it goes off track
      if (tr.vx > 0 && tr.x > tr.endX) tr.x = tr.spawnX;
      if (tr.vx < 0 && tr.x < tr.endX) tr.x = tr.spawnX;

      const trainRect: Rect = { x: tr.x, y: tr.y, w: tr.w, h: tr.h };
      if (checkCollision({ x: p.x, y: p.y, w: p.w, h: p.h }, trainRect)) {
        // If player is landing on top → safe ride
        const playerBottom = p.y + p.h;
        const landedOnTop =
          p.vy >= 0 && playerBottom - tr.y < 14;
        if (landedOnTop) {
          p.y = tr.y - p.h;
          p.vy = 0;
          p.isGrounded = true;
          // Carry player along with the train
          p.x += tr.vx;
        } else {
          dieRef.current();
          return;
        }
      }
    }

    // Keep in bounds
    if (p.x < 0) p.x = 0;
    
    state.time += 1 / 60; // Approx 60fps
    setUiState(s => ({ ...s, time: state.time }));
  }, []);

  const die = useCallback(() => {
    if (!gameStateRef.current) return;
    const state = gameStateRef.current;

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([60, 40, 120]);
    }

    // Levels 90-100: restart entire level
    if (state.level >= 90) {
      state.status = "dead";
      setUiState(s => ({ ...s, status: "dead", attempts: s.attempts + 1 }));
      setTimeout(() => {
        setUiState(s => ({ ...s, attempts: 1 }));
        initLevel(state.level, 1);
      }, 1000);
    } else {
      state.status = "dead";
      setUiState(s => ({ ...s, status: "dead", attempts: s.attempts + 1 }));
      setTimeout(() => initLevel(state.level, state.parcours), 1000);
    }
  }, [initLevel]);

  const win = useCallback(() => {
    if (!gameStateRef.current || !player || !sessionId) return;
    const state = gameStateRef.current;
    
    if (state.parcours < state.totalParcours) {
      state.status = "won_parcours";
      setUiState(s => ({ ...s, status: "won_parcours" }));
      setTimeout(() => initLevel(state.level, state.parcours + 1), 1000);
    } else {
      state.status = "won_level";
      setUiState(s => ({ ...s, status: "won_level" }));

      // Save progress (no auto-advance — wait for player to click a button)
      completeLevel.mutate(
        { sessionId, data: { level: state.level, time: state.time } },
        {
          onSuccess: () => {
            updateProgress.mutate(
              { playerId: player.id, data: { level: state.level + 1, bestTime: state.time } },
              {
                onSuccess: (updatedPlayer) => {
                  setPlayer(updatedPlayer);
                }
              }
            );
          }
        }
      );
    }
  }, [player, sessionId, initLevel]);

  const goToNextLevel = useCallback(() => {
    if (!gameStateRef.current) return;
    const state = gameStateRef.current;
    initLevel(state.level + 1, 1);
  }, [initLevel]);

  // Keep refs in sync with the latest callbacks so the rAF loop sees fresh state
  useEffect(() => { winRef.current = win; }, [win]);
  useEffect(() => { dieRef.current = die; }, [die]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = gameStateRef.current;
    
    if (!canvas || !ctx || !state) return;

    // Camera follow player
    const camX = Math.max(0, state.player.x - canvas.width / 3);

    // ── Sky gradient (themed) ───────────────────────────────
    drawSky(ctx, canvas.width, canvas.height, state.theme, state.time);

    ctx.save();
    ctx.translate(-camX, 0);

    // ── Background decorations (parallax > 0) ───────────────
    for (const d of state.decorations) {
      if (d.parallax === 0) continue;
      // Apply parallax: shift back toward camera
      const px = d.x + camX * d.parallax;
      drawDecoration(ctx, px, d.y, d.type, d.scale, state.theme);
    }

    // Distant ground band
    drawGroundBand(ctx, camX, canvas.width, state.theme);

    // ── Platforms ───────────────────────────────────────────
    for (const plat of state.platforms) {
      drawPlatform(ctx, plat, state.theme);
    }

    // ── Trains ──────────────────────────────────────────────
    for (const tr of state.trains) {
      drawTrain(ctx, tr.x, tr.y, tr.w, tr.h, tr.color, tr.vx >= 0);
    }

    // ── Croustys (food obstacles) ───────────────────────────
    const croustyImg = croustyImgRef.current;
    for (const c of state.croustys) {
      if (croustyImg) {
        ctx.save();
        ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
        ctx.rotate(c.rotation);
        ctx.shadowColor = "rgba(249, 115, 22, 0.7)";
        ctx.shadowBlur = 12;
        ctx.drawImage(croustyImg, -c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      } else {
        // Fallback: orange tray
        ctx.fillStyle = "#f97316";
        ctx.fillRect(c.x, c.y, c.w, c.h);
      }
    }

    // ── Foreground decorations (parallax 0) ─────────────────
    for (const d of state.decorations) {
      if (d.parallax !== 0) continue;
      drawDecoration(ctx, d.x, d.y, d.type, d.scale, state.theme);
    }

    // ── Player ──────────────────────────────────────────────
    if (state.status !== "dead") {
      drawCharacter(ctx, state.player.x, state.player.y, state.player.w, state.player.h, state.player.color, state.player.vx >= 0);
    } else {
      ctx.fillStyle = state.player.color;
      ctx.fillRect(state.player.x - 10, state.player.y - 10, 10, 10);
      ctx.fillRect(state.player.x + 30, state.player.y - 5, 10, 10);
      ctx.fillRect(state.player.x + 10, state.player.y + 30, 10, 10);
    }

    ctx.restore();
  }, []);

  const loop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    requestRef.current = requestAnimationFrame(loop);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* HUD Header */}
      <div className="h-16 border-b-4 border-border bg-card flex items-center justify-between px-6 shrink-0 z-10">
        <Link href="/game-mode">
          <Button variant="ghost" size="icon" className="hover:bg-muted text-muted-foreground hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>

        <div className="flex items-center gap-8 pixel-text">
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground text-sm">NIVEAU {uiState.level}</div>
            <div className="text-xl md:text-2xl text-primary drop-shadow-[0_0_5px_rgba(255,0,85,0.5)] truncate max-w-[160px]">
              {getLevelName(uiState.level)}
            </div>
          </div>
          
          <div className="h-8 w-px bg-border hidden md:block"></div>
          
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground text-sm">PARCOURS</div>
            <div className="text-2xl text-secondary drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
              {uiState.parcours}/{uiState.totalParcours}
            </div>
          </div>
          
          <div className="h-8 w-px bg-border hidden md:block"></div>
          
          <div className="flex items-center gap-3 font-mono font-bold text-2xl text-accent drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
            {uiState.time.toFixed(1)}s
          </div>

          <div className="h-8 w-px bg-border hidden md:block"></div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground text-sm">TENTATIVES</div>
            <div className="text-2xl font-mono font-bold text-destructive drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
              {uiState.attempts}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {player && (
            <>
              <div className="font-bold pixel-text text-sm hidden md:block">{player.username}</div>
              <div className="w-8 h-8 pixel-border" style={{ backgroundColor: player.color }}></div>
            </>
          )}
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        <div className="relative border-4 border-border shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-[1000px] aspect-video">
          
          {uiState.status === "loading" && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
              <div className="pixel-text text-2xl text-white animate-pulse">CHARGEMENT...</div>
            </div>
          )}
          
          {uiState.status === "dead" && (
            <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center z-20">
              <div className="pixel-text text-4xl text-destructive drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">MORT !</div>
              <div className="pixel-text text-white mt-4">Redemarrage...</div>
            </div>
          )}
          
          {uiState.status === "won_parcours" && (
            <div className="absolute inset-0 bg-secondary/20 flex flex-col items-center justify-center z-20">
              <div className="pixel-text text-4xl text-secondary drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]">PARCOURS REUSSI !</div>
            </div>
          )}

          {uiState.status === "won_level" && (
            <div className="absolute inset-0 bg-accent/20 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-6 text-center">
              <div className="pixel-text text-4xl md:text-5xl text-accent drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">
                NIVEAU {uiState.level} TERMINE !
              </div>
              <div className="pixel-text text-white mt-4 text-lg md:text-xl">
                Temps : {uiState.time.toFixed(1)}s — Tentatives : {uiState.attempts}
              </div>
              <div className="pixel-text text-secondary mt-6 text-xl md:text-2xl drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
                PROCHAIN NIVEAU : {uiState.level + 1}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Button
                  onClick={goToNextLevel}
                  size="lg"
                  className="pixel-text text-base bg-primary hover:bg-primary/90 text-white border-2 border-border shadow-[0_0_15px_rgba(255,0,85,0.5)]"
                >
                  JOUER
                </Button>
                <Button
                  onClick={() => setLocation("/")}
                  variant="secondary"
                  size="lg"
                  className="pixel-text text-base border-2 border-border"
                >
                  RETOUR A L'ACCUEIL
                </Button>
              </div>
            </div>
          )}

          <canvas 
            ref={canvasRef} 
            width={1000} 
            height={562.5} // 16:9
            className="w-full h-full object-cover bg-[#09090b]"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>
      
      {/* Desktop Controls Guide */}
      <div className="p-4 hidden md:flex justify-center gap-8 border-t-4 border-border bg-card pixel-text text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><div className="p-2 border-2 border-border rounded bg-background">← → / A D</div> BOUGER</div>
        <div className="flex items-center gap-2"><div className="p-2 border-2 border-border rounded bg-background">↑ / W / ESPACE</div> SAUTER</div>
      </div>

      {/* Mobile Touch Controls */}
      <div className="md:hidden flex justify-between items-end p-4 border-t-4 border-border bg-card select-none touch-none">
        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Gauche"
            className="w-20 h-20 border-4 border-border rounded-full bg-background active:bg-primary/40 flex items-center justify-center pixel-text text-3xl text-white shadow-lg"
            onTouchStart={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = false; }}
            onMouseDown={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = true; }}
            onMouseUp={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = false; }}
            onMouseLeave={() => { keysRef.current["ArrowLeft"] = false; }}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Droite"
            className="w-20 h-20 border-4 border-border rounded-full bg-background active:bg-primary/40 flex items-center justify-center pixel-text text-3xl text-white shadow-lg"
            onTouchStart={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = false; }}
            onMouseDown={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = true; }}
            onMouseUp={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = false; }}
            onMouseLeave={() => { keysRef.current["ArrowRight"] = false; }}
          >
            →
          </button>
        </div>

        <button
          type="button"
          aria-label="Sauter"
          className="w-24 h-24 border-4 border-primary rounded-full bg-primary/20 active:bg-primary/60 flex items-center justify-center pixel-text text-sm text-primary shadow-lg drop-shadow-[0_0_8px_rgba(255,0,85,0.5)]"
          onTouchStart={(e) => { e.preventDefault(); keysRef.current[" "] = true; }}
          onTouchEnd={(e) => { e.preventDefault(); keysRef.current[" "] = false; }}
          onTouchCancel={(e) => { e.preventDefault(); keysRef.current[" "] = false; }}
          onMouseDown={(e) => { e.preventDefault(); keysRef.current[" "] = true; }}
          onMouseUp={(e) => { e.preventDefault(); keysRef.current[" "] = false; }}
          onMouseLeave={() => { keysRef.current[" "] = false; }}
        >
          SAUTER
        </button>
      </div>
    </div>
  );
}
