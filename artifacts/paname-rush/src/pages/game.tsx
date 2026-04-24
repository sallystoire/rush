import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDiscord } from "@/hooks/use-discord";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifyTeamDeath, getTeamState, notifyTeamAdvance, getTeamAdvance, pushTeamPosition, getTeamPositions, type TeammatePosition } from "@/lib/team-api";
import { 
  generateLevel, getTotalParcours, getLevelName, isLaserActive, levelHasJewels,
  checkCollision, GRAVITY, JUMP_FORCE, MOVE_SPEED, MAX_FALL_SPEED,
  type GameState, type Rect, type Platform, type Decoration, type LevelTheme,
  type Jewel
} from "@/lib/game-engine";
import { 
  useStartGame, 
  useCompleteLevel, 
  useUpdatePlayerProgress
} from "@workspace/api-client-react";
import CinematicChapter1 from "@/components/cinematic-chapter1";
import CinematicChapter2 from "@/components/cinematic-chapter2";
import { isAdminPlayer } from "@/lib/admin";
import { SkipForward, SkipBack } from "lucide-react";

const CINEMATIC_CHAPTER1_KEY = "paname:cinematic-chapter1-seen";
const CINEMATIC_CHAPTER2_KEY = "paname:cinematic-chapter2-seen";

const croustyImgUrl = `${import.meta.env.BASE_URL}images/crousty.png`;
const kingdomBgUrl = `${import.meta.env.BASE_URL}images/bg-kingdom.png`;

// Module-level image cache for the kingdom (levels 1-4) background. Loaded
// once when the module first imports and reused across mounts.
let _kingdomBgImg: HTMLImageElement | null = null;
let _kingdomBgLoaded = false;
function getKingdomBg(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (_kingdomBgImg === null) {
    const img = new Image();
    img.onload = () => { _kingdomBgLoaded = true; };
    img.src = kingdomBgUrl;
    _kingdomBgImg = img;
  }
  return _kingdomBgLoaded ? _kingdomBgImg : null;
}

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
    case "kingdom":
      // Royaume de Maître Crousty — sky blue → soft golden horizon, warm sandstone ground
      return { skyTop: "#5cb8f0", skyBot: "#fde8b8", ground: "#92581f", glow: "#fcd34d" };
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

  // Kingdom — replace the procedural mountains with the painted kingdom
  // background. Drawn in screen space so the parallax sky stays put while
  // the camera scrolls. Falls back to the gradient already painted above
  // until the image finishes loading.
  if (theme === "kingdom") {
    const bg = getKingdomBg();
    if (bg && bg.complete && bg.naturalWidth > 0) {
      // Cover the canvas while preserving aspect ratio (centered crop).
      const iw = bg.naturalWidth, ih = bg.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
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

  // Kingdom: warm sandstone block with mortar lines + grass top
  if (theme === "kingdom") {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "#d8a868");
    grad.addColorStop(1, "#8a5524");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Grass top
    ctx.fillStyle = "#3f9b3f";
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = "#5fc35f";
    ctx.fillRect(x, y, w, 2);
    // Mortar lines — staggered brick pattern
    ctx.fillStyle = "rgba(60, 30, 10, 0.45)";
    const brickH = 18;
    for (let row = 0; row * brickH < h; row++) {
      const ry = y + 8 + row * brickH;
      if (ry > y + h - 2) break;
      ctx.fillRect(x, ry, w, 1);
      const offset = row % 2 === 0 ? 0 : 22;
      for (let bx = offset; bx < w; bx += 44) {
        ctx.fillRect(x + bx, ry, 1, brickH);
      }
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
  theme: LevelTheme,
  seedX?: number
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
      if (theme === "kingdom") {
        // Castle keep silhouette — sandstone walls, terracotta conical roof, red flag
        const wallH = 170, wallW = 80;
        // Wall body
        const wallGrad = ctx.createLinearGradient(0, -wallH, 0, 0);
        wallGrad.addColorStop(0, "#e0b074");
        wallGrad.addColorStop(1, "#9a6028");
        ctx.fillStyle = wallGrad;
        ctx.fillRect(-wallW / 2, -wallH, wallW, wallH);
        // Mortar lines
        ctx.fillStyle = "rgba(60, 30, 10, 0.35)";
        for (let row = 0; row < 8; row++) {
          ctx.fillRect(-wallW / 2, -wallH + row * 22, wallW, 1);
          const ofs = row % 2 === 0 ? 0 : 20;
          for (let bx = ofs; bx < wallW; bx += 40) {
            ctx.fillRect(-wallW / 2 + bx, -wallH + row * 22, 1, 22);
          }
        }
        // Crenellations on the wall top
        ctx.fillStyle = "#b8843e";
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-wallW / 2 + i * 18 + 2, -wallH - 8, 10, 8);
        }
        // Window
        ctx.fillStyle = "#1a0f05";
        ctx.fillRect(-6, -wallH + 60, 12, 22);
        ctx.fillStyle = "#fde68a";
        ctx.fillRect(-4, -wallH + 62, 8, 6);
        // Conical terracotta roof on a smaller top tower
        const topW = 44;
        ctx.fillStyle = "#cd5a2e";
        ctx.beginPath();
        ctx.moveTo(-topW / 2 - 4, -wallH - 8);
        ctx.lineTo(0, -wallH - 70);
        ctx.lineTo(topW / 2 + 4, -wallH - 8);
        ctx.closePath();
        ctx.fill();
        // Roof shading
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.moveTo(0, -wallH - 70);
        ctx.lineTo(topW / 2 + 4, -wallH - 8);
        ctx.lineTo(4, -wallH - 8);
        ctx.closePath();
        ctx.fill();
        // Flag pole + red banner
        ctx.fillStyle = "#3f3a36";
        ctx.fillRect(-1, -wallH - 100, 2, 32);
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.moveTo(1, -wallH - 96);
        ctx.lineTo(20, -wallH - 90);
        ctx.lineTo(1, -wallH - 84);
        ctx.closePath();
        ctx.fill();
        break;
      }
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
      // Use stable seedX so height never changes as camera scrolls
      const stableX = Math.abs(Math.round(seedX ?? x));
      const seed = stableX % 997;

      // Kingdom — sandstone keep with crenellations, banner & terracotta roof
      if (theme === "kingdom") {
        const variants = [
          { body: "#d4a06b", trim: "#a8702e", roof: "#cd5a2e", flag: "#dc2626" }, // warm sandstone, terracotta roof
          { body: "#c89260", trim: "#8b5a23", roof: "#b04420", flag: "#dc2626" }, // darker sandstone
          { body: "#e0b074", trim: "#9a6028", roof: "#e07033", flag: "#facc15" }, // light + golden flag
        ];
        const v = variants[seed % variants.length];
        const bw = 64 + (seed % 4) * 14;
        const bh = 110 + (seed % 6) * 22;

        // Wall body with gradient
        const grad = ctx.createLinearGradient(0, -bh, 0, 0);
        grad.addColorStop(0, v.body);
        grad.addColorStop(1, v.trim);
        ctx.fillStyle = grad;
        ctx.fillRect(-bw / 2, -bh, bw, bh);

        // Mortar (faint brick lines)
        ctx.fillStyle = "rgba(60, 30, 10, 0.30)";
        const rows = Math.floor(bh / 20);
        for (let r = 0; r < rows; r++) {
          const ry = -bh + r * 20;
          ctx.fillRect(-bw / 2, ry, bw, 1);
          const ofs = r % 2 === 0 ? 0 : 18;
          for (let bx = ofs; bx < bw; bx += 36) {
            ctx.fillRect(-bw / 2 + bx, ry, 1, 20);
          }
        }

        // Crenellations along the top
        ctx.fillStyle = v.trim;
        const merlons = Math.max(3, Math.floor(bw / 14));
        for (let m = 0; m < merlons; m++) {
          const mx = -bw / 2 + m * (bw / merlons);
          if (m % 2 === 0) ctx.fillRect(mx, -bh - 6, bw / merlons - 1, 6);
        }

        // Tall arched window
        ctx.fillStyle = "#1a0f05";
        ctx.fillRect(-5, -bh + 38, 10, 24);
        ctx.beginPath();
        ctx.arc(0, -bh + 38, 5, Math.PI, 0);
        ctx.fill();
        // Window glow
        ctx.fillStyle = "#fde68a";
        ctx.fillRect(-3, -bh + 40, 6, 5);

        // Side conical roof tower (every other building)
        if (seed % 2 === 0) {
          const tx = bw / 2 - 6;
          const tWallH = Math.min(70, bh * 0.45);
          // Tower body
          ctx.fillStyle = v.body;
          ctx.fillRect(tx, -bh - tWallH, 18, tWallH);
          ctx.strokeStyle = "rgba(60, 30, 10, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(tx, -bh - tWallH, 18, tWallH);
          // Conical roof
          ctx.fillStyle = v.roof;
          ctx.beginPath();
          ctx.moveTo(tx - 3, -bh - tWallH);
          ctx.lineTo(tx + 9, -bh - tWallH - 30);
          ctx.lineTo(tx + 21, -bh - tWallH);
          ctx.closePath();
          ctx.fill();
          // Flag pole + banner
          ctx.fillStyle = "#3f3a36";
          ctx.fillRect(tx + 8, -bh - tWallH - 50, 2, 22);
          ctx.fillStyle = v.flag;
          ctx.beginPath();
          ctx.moveTo(tx + 10, -bh - tWallH - 48);
          ctx.lineTo(tx + 22, -bh - tWallH - 43);
          ctx.lineTo(tx + 10, -bh - tWallH - 38);
          ctx.closePath();
          ctx.fill();
        }

        // Hanging red banner on the wall (signature of the cinematic art)
        const bannerW = 14, bannerH = 28;
        const bannerX = -bw / 2 + 6 + (seed % 3) * 10;
        const bannerY = -bh + 14;
        ctx.fillStyle = "#b1281c";
        ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
        // Banner V-cut bottom
        ctx.fillStyle = v.trim;
        ctx.beginPath();
        ctx.moveTo(bannerX, bannerY + bannerH);
        ctx.lineTo(bannerX + bannerW / 2, bannerY + bannerH - 6);
        ctx.lineTo(bannerX + bannerW, bannerY + bannerH);
        ctx.closePath();
        ctx.fill();
        // Banner emblem
        ctx.fillStyle = "#fde047";
        ctx.fillRect(bannerX + bannerW / 2 - 2, bannerY + 10, 4, 4);

        break;
      }

      // Geometry Dash / Subway Surfer: bold flat colors, neon outlines, sharp shapes
      const palettes = {
        night:    [["#0f0f23","#7c3aed"],["#0f172a","#06b6d4"],["#1e1b4b","#f472b6"]],
        rooftops: [["#7c2d12","#f97316"],["#450a0a","#ef4444"],["#431407","#fb923c"]],
        metro:    [["#1f2937","#00f0ff"],["#111827","#a855f7"],["#0f172a","#22d3ee"]],
        boulevard:[["#1e293b","#facc15"],["#18181b","#4ade80"],["#27272a","#f472b6"]],
      };
      const pal = palettes[theme as Exclude<LevelTheme, "kingdom">] ?? palettes.boulevard;
      const [bodyColor, accentColor] = pal[seed % pal.length];

      const bw = 56 + (seed % 3) * 12;
      // Height fixed by seed, not by screen position
      const bh = 130 + (seed % 7) * 22;
      const floors = Math.max(2, Math.floor(bh / 38));

      // Body fill
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-bw / 2, -bh, bw, bh);

      // Neon outline (Geometry Dash style)
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.strokeRect(-bw / 2, -bh, bw, bh);
      ctx.shadowBlur = 0;

      // Floor dividers (horizontal lines)
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.25;
      for (let f = 1; f < floors; f++) {
        const lineY = -bh + f * (bh / floors);
        ctx.fillRect(-bw / 2, lineY, bw, 2);
      }
      ctx.globalAlpha = 1;

      // Windows: square Geometry Dash style, alternating lit/unlit
      const winSize = 9;
      const winGapX = 13;
      const winGapY = bh / floors;
      for (let f = 0; f < floors; f++) {
        const wy = -bh + f * winGapY + winGapY * 0.3;
        for (let col = 0; col < 2; col++) {
          const wx = -bw / 2 + 9 + col * winGapX;
          const lit = ((seed + f + col) % 3) !== 0;
          ctx.fillStyle = lit ? accentColor : "rgba(255,255,255,0.06)";
          ctx.shadowColor = lit ? accentColor : "transparent";
          ctx.shadowBlur = lit ? 6 : 0;
          ctx.fillRect(wx, wy, winSize, winSize);
          ctx.shadowBlur = 0;
        }
      }

      // Rooftop accent stripe (Subway Surfer bold top)
      ctx.fillStyle = accentColor;
      ctx.fillRect(-bw / 2, -bh, bw, 4);
      break;
    }
  }

  ctx.restore();
}

function drawJewel(
  ctx: CanvasRenderingContext2D,
  jewel: Jewel,
  time: number,
) {
  if (jewel.collected) return;
  const cx = jewel.x + jewel.w / 2;
  const baseCy = jewel.y + jewel.h / 2;
  // Gentle bobbing
  const bob = Math.sin(time * 2 + jewel.phase) * 3;
  const cy = baseCy + bob;
  const halfW = jewel.w / 2;
  const halfH = jewel.h / 2;

  ctx.save();
  // Soft golden halo so jewels are easy to spot at any zoom
  const haloGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, halfW * 1.8);
  haloGrad.addColorStop(0, "rgba(255, 235, 150, 0.55)");
  haloGrad.addColorStop(1, "rgba(255, 235, 150, 0)");
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, halfW * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "rgba(255, 220, 120, 0.85)";
  ctx.shadowBlur = 10;

  switch (jewel.type) {
    case "diamond": {
      // Cyan/white rhombus with bright facet
      const grad = ctx.createLinearGradient(cx, cy - halfH, cx, cy + halfH);
      grad.addColorStop(0, "#e0f7ff");
      grad.addColorStop(0.5, "#7dd3fc");
      grad.addColorStop(1, "#0ea5e9");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfH);
      ctx.lineTo(cx + halfW, cy);
      ctx.lineTo(cx, cy + halfH);
      ctx.lineTo(cx - halfW, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Highlight facet
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfH * 0.8);
      ctx.lineTo(cx + halfW * 0.4, cy - halfH * 0.1);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "ruby": {
      // Red gem (oval cabochon)
      const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, halfW);
      grad.addColorStop(0, "#fecaca");
      grad.addColorStop(0.4, "#ef4444");
      grad.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW, halfH * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff1f2";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.ellipse(cx - halfW * 0.35, cy - halfH * 0.3, halfW * 0.3, halfH * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "crown": {
      // Gold crown — base band + 3 points + 3 jewels
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.5;
      // Band
      const bandY = cy + halfH * 0.3;
      const bandH = halfH * 0.55;
      ctx.beginPath();
      ctx.rect(cx - halfW, bandY, jewel.w, bandH);
      ctx.fill();
      ctx.stroke();
      // Three triangular points
      ctx.beginPath();
      ctx.moveTo(cx - halfW, bandY);
      ctx.lineTo(cx - halfW * 0.55, cy - halfH * 0.7);
      ctx.lineTo(cx - halfW * 0.1, bandY);
      ctx.lineTo(cx + halfW * 0.1, bandY);
      ctx.lineTo(cx + halfW * 0.55, cy - halfH * 0.7);
      ctx.lineTo(cx + halfW, bandY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Three little gems on the points
      const gems = [
        { x: cx - halfW * 0.55, color: "#22d3ee" },
        { x: cx, color: "#ef4444" },
        { x: cx + halfW * 0.55, color: "#22d3ee" },
      ];
      for (const g of gems) {
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(g.x, cy - halfH * 0.78, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "necklace": {
      // Pearl chain in a U curve with a red gem pendant
      ctx.strokeStyle = "rgba(120, 53, 15, 0.6)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#fef3c7";
      const beadCount = 9;
      for (let b = 0; b < beadCount; b++) {
        const t = b / (beadCount - 1);
        const bx = cx - halfW + t * jewel.w;
        // U curve
        const by = cy - halfH * 0.4 + Math.sin(Math.PI * t) * halfH * 0.7;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Pendant (red drop)
      const pendantY = cy + halfH * 0.5;
      ctx.fillStyle = "#dc2626";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, pendantY - 4);
      ctx.lineTo(cx + 3.5, pendantY);
      ctx.lineTo(cx, pendantY + 5);
      ctx.lineTo(cx - 3.5, pendantY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "bracelet": {
      // Gold ring with a small gem
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW * 0.85, halfH * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Inner highlight
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW * 0.85, halfH * 0.6, 0, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      // Centerpiece gem
      ctx.fillStyle = "#a855f7";
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy - halfH * 0.55, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  // Twinkling sparkle
  const twinkle = (Math.sin(time * 4 + jewel.phase) + 1) / 2; // 0..1
  if (twinkle > 0.6) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.9})`;
    const sx = cx + halfW * 0.5;
    const sy = cy - halfH * 0.7;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx + 1, sy - 1);
    ctx.lineTo(sx + 4, sy);
    ctx.lineTo(sx + 1, sy + 1);
    ctx.lineTo(sx, sy + 4);
    ctx.lineTo(sx - 1, sy + 1);
    ctx.lineTo(sx - 4, sy);
    ctx.lineTo(sx - 1, sy - 1);
    ctx.closePath();
    ctx.fill();
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

const REQUIRED_GUILD_ID = "1489787998676713632";

export default function Game() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const isTeamMode = searchString.includes("mode=team");
  const urlTeamId = (() => {
    const m = searchString.match(/teamId=(\d+)/);
    return m ? Number(m[1]) : null;
  })();
  
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  const { inside: insideDiscord, ready: discordReady, guildId, channelId } = useDiscord();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  const startGame = useStartGame();
  const completeLevel = useCompleteLevel();
  const updateProgress = useUpdatePlayerProgress();
  
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const gameStateRef = useRef<GameState | null>(null);
  const sessionStartedRef = useRef(false);
  const lastFrameTimeRef = useRef<number>(0);
  const frameAccumulatorRef = useRef<number>(0);
  const FIXED_STEP_MS = 1000 / 60; // physics always at 60Hz regardless of display

  // Team death sync — timestamp of when we started playing this session
  const teamDeathSinceRef = useRef<number>(Date.now());
  const teamDeathPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Team advance sync — timestamp of when we started playing this session
  const teamAdvanceSinceRef = useRef<number>(Date.now());
  const teamAdvancePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Team position sync — stores latest teammate positions for rendering
  const teammatesRef = useRef<TeammatePosition[]>([]);
  const teamPositionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Team camera — persists zoom value across frames for smooth lerp
  const teamCamZoomRef = useRef<number>(1.0);
  // Ref so draw() (no-dep useCallback) can read isTeamMode without stale closure
  const isTeamModeRef = useRef(isTeamMode);
  
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const jumpKeyHeldRef = useRef<boolean>(false);
  
  const [uiState, setUiState] = useState({
    level: 1,
    parcours: 1,
    totalParcours: 1,
    time: 0,
    attempts: 1,
    jewels: 0,
    status: "loading" // loading, playing, dead, won_parcours, won_level
  });

  // Chapter 1 intro cinematic — shown the first time a player enters level 1
  // in this browser session. Persists in sessionStorage so a death/retry on
  // level 1 does not replay the cutscene.
  const [showCinematicCh1, setShowCinematicCh1] = useState(false);
  const cinematicChecked = useRef(false);

  // Chapter 2 intro cinematic — shown the first time a player enters level 5
  // (the "Musée du Louvre" arc where jewels start spawning).
  const [showCinematicCh2, setShowCinematicCh2] = useState(false);
  const cinematicCh2Checked = useRef(false);
  const pendingLevelStart = useRef<{ level: number; parcours: number } | null>(null);

  // Preload crousty obstacle image
  const croustyImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = croustyImgUrl;
    img.onload = () => { croustyImgRef.current = img; };
  }, []);

  // Voice channel check — only enforce inside Discord
  useEffect(() => {
    if (!insideDiscord || !discordReady) return;
    if (!channelId) {
      setVoiceError("Tu dois être dans un salon vocal pour jouer ! Rejoins un salon vocal sur le serveur et relance l'activité.");
      return;
    }
    if (guildId && guildId !== REQUIRED_GUILD_ID) {
      setVoiceError("Cette activité est réservée au serveur officiel. Rejoins le bon serveur Discord pour jouer !");
      return;
    }
    setVoiceError(null);
  }, [insideDiscord, discordReady, guildId, channelId]);

  // Team death sync — poll for teammate deaths in team mode
  useEffect(() => {
    if (!isTeamMode || !urlTeamId) return;
    teamDeathSinceRef.current = Date.now();

    teamDeathPollRef.current = setInterval(async () => {
      const state = gameStateRef.current;
      if (!state || state.status !== "playing") return;
      try {
        const result = await getTeamState(urlTeamId, teamDeathSinceRef.current);
        if (result.died && result.playerId !== player?.id) {
          // A teammate died — restart current parcours
          teamDeathSinceRef.current = result.timestamp ?? Date.now();
          state.status = "dead";
          setUiState(s => ({ ...s, status: "dead", attempts: s.attempts + 1 }));
          setTimeout(() => {
            if (gameStateRef.current) {
              initLevel(gameStateRef.current.level, gameStateRef.current.parcours);
            }
          }, 1200);
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    return () => {
      if (teamDeathPollRef.current) clearInterval(teamDeathPollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamMode, urlTeamId]);

  // Team advance sync — poll for teammate level/parcours advances in team mode
  useEffect(() => {
    if (!isTeamMode || !urlTeamId) return;
    teamAdvanceSinceRef.current = Date.now();

    teamAdvancePollRef.current = setInterval(async () => {
      const state = gameStateRef.current;
      if (!state || state.status === "dead") return;
      try {
        const result = await getTeamAdvance(urlTeamId, teamAdvanceSinceRef.current);
        if (result.advanced && result.playerId !== player?.id && result.level && result.parcours) {
          teamAdvanceSinceRef.current = result.timestamp ?? Date.now();
          const currentLevel = state.level;
          const currentParcours = state.parcours;
          // Only jump forward, never backward
          const shouldJump =
            result.level > currentLevel ||
            (result.level === currentLevel && result.parcours > currentParcours);
          if (shouldJump) {
            initLevel(result.level, result.parcours);
          }
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    return () => {
      if (teamAdvancePollRef.current) clearInterval(teamAdvancePollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamMode, urlTeamId]);

  // Team position sync — broadcast own position + receive teammates' positions every 100ms
  useEffect(() => {
    if (!isTeamMode || !urlTeamId || !player) return;

    teamPositionIntervalRef.current = setInterval(async () => {
      const state = gameStateRef.current;
      if (!state) return;
      const p = state.player;
      // Broadcast our own position (fire-and-forget)
      pushTeamPosition(
        urlTeamId, player.id,
        Math.round(p.x), Math.round(p.y),
        player.color,
        state.level, state.parcours,
        p.vx >= 0,
      ).catch(() => {});
      // Fetch teammates' positions
      try {
        const positions = await getTeamPositions(urlTeamId, player.id);
        teammatesRef.current = positions;
      } catch {
        // ignore
      }
    }, 100);

    return () => {
      if (teamPositionIntervalRef.current) clearInterval(teamPositionIntervalRef.current);
      teammatesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamMode, urlTeamId, player]);

  // Init game — runs only once. Using player as dep so it waits for auth to resolve,
  // but the sessionStartedRef guard prevents re-running when player updates mid-game
  // (e.g. after level completion saves progress and updates the player object).
  useEffect(() => {
    if (sessionStartedRef.current) return;
    if (!player) {
      setLocation("/");
      return;
    }
    if (voiceError) return;
    
    sessionStartedRef.current = true;

    // Start session
    startGame.mutate(
      { data: { playerId: player.id, mode: isTeamMode ? "team" : "solo", teamId: isTeamMode && player.teamId ? player.teamId : undefined } },
      {
        onSuccess: (session) => {
          setSessionId(session.id);
          // If entering level 1 fresh and the chapter 1 cinematic hasn't
          // been seen yet this session, show it BEFORE initLevel so the
          // timer / physics don't tick during the cutscene.
          let showIntro = false;
          if (session.currentLevel === 1 && !cinematicChecked.current) {
            cinematicChecked.current = true;
            try {
              showIntro = !sessionStorage.getItem(CINEMATIC_CHAPTER1_KEY);
            } catch {
              showIntro = true;
            }
          }
          if (showIntro) {
            setShowCinematicCh1(true);
            // initLevel will be called when cinematic completes
          } else {
            initLevel(session.currentLevel, 1);
          }
        },
        onError: () => {
          sessionStartedRef.current = false; // allow retry on error
          toast({ title: "Erreur", description: "Impossible de demarrer la partie.", variant: "destructive" });
          setLocation("/game-mode");
        }
      }
    );
  }, [player, isTeamMode]);

  const initLevel = useCallback((level: number, parcours: number) => {
    if (!player) return;

    // Chapter 2 cinematic gate — first time the player reaches level 5,
    // pause and show the "Musée du Louvre" intro before generating the map.
    // We only gate when entering a fresh level (parcours === 1) so death
    // restarts mid-level don't replay the cutscene.
    if (level === 5 && parcours === 1 && !cinematicCh2Checked.current) {
      cinematicCh2Checked.current = true;
      let seenCh2 = false;
      try {
        seenCh2 = !!sessionStorage.getItem(CINEMATIC_CHAPTER2_KEY);
      } catch {
        seenCh2 = true;
      }
      if (!seenCh2) {
        pendingLevelStart.current = { level, parcours };
        setShowCinematicCh2(true);
        return;
      }
    }

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
        isGrounded: false,
        jumpsRemaining: 2
      },
      platforms: gen.platforms,
      trains: gen.trains.map(t => ({ ...t })),
      croustys: gen.croustys.map(c => ({ ...c })),
      lasers: gen.lasers.map(l => ({ ...l })),
      jewels: gen.jewels.map(j => ({ ...j })),
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
      // Attempts persist across levels — only reset when the user leaves the activity
      attempts: s.attempts,
      // Jewel counter resets each new level (parcours 1) and persists across parcours
      jewels: parcours === 1 ? 0 : (s.jewels ?? 0),
      status: "playing"
    }));
  }, [player]);

  // Called once the chapter 1 intro cinematic is dismissed.
  const handleCinematicCh1Done = useCallback(() => {
    try { sessionStorage.setItem(CINEMATIC_CHAPTER1_KEY, "1"); } catch { /* ignore */ }
    // Clear any keys that may have been "stuck down" while the cinematic
    // was capturing input (Space / Enter / ArrowRight on the Suite button)
    // so the player doesn't auto-jump as soon as the level appears.
    keysRef.current = {};
    jumpKeyHeldRef.current = false;
    setShowCinematicCh1(false);
    initLevel(1, 1);
  }, [initLevel]);

  // Called once the chapter 2 (Louvre) intro cinematic is dismissed.
  const handleCinematicCh2Done = useCallback(() => {
    try { sessionStorage.setItem(CINEMATIC_CHAPTER2_KEY, "1"); } catch { /* ignore */ }
    keysRef.current = {};
    jumpKeyHeldRef.current = false;
    setShowCinematicCh2(false);
    const pending = pendingLevelStart.current ?? { level: 5, parcours: 1 };
    pendingLevelStart.current = null;
    initLevel(pending.level, pending.parcours);
  }, [initLevel]);

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
    if (keys["ArrowLeft"] || keys["a"] || keys["q"]) p.vx = -3;
    else if (keys["ArrowRight"] || keys["d"] || keys["d"]) p.vx = 3;
    else p.vx = 0;

    const jumpHeld = !!(keys["ArrowUp"] || keys["w"] || keys["z"] || keys[" "]);
    if (jumpHeld && !jumpKeyHeldRef.current && p.jumpsRemaining > 0) {
      p.vy = JUMP_FORCE;
      p.isGrounded = false;
      p.jumpsRemaining -= 1;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
    jumpKeyHeldRef.current = jumpHeld;

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
            p.jumpsRemaining = 2;
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

    // ── Lasers: deadly when active ───────────────────────────
    for (const l of state.lasers) {
      if (!isLaserActive(l, state.time)) continue;
      const lRect: Rect = { x: l.x, y: l.y, w: l.w, h: l.h };
      if (checkCollision({ x: p.x, y: p.y, w: p.w, h: p.h }, lRect)) {
        dieRef.current();
        return;
      }
    }

    // ── Jewels: collected on contact (no death — just bumps the counter) ─
    if (state.jewels.length > 0) {
      let collectedThisFrame = 0;
      const playerRect: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
      for (const j of state.jewels) {
        if (j.collected) continue;
        const jRect: Rect = { x: j.x, y: j.y, w: j.w, h: j.h };
        if (checkCollision(playerRect, jRect)) {
          j.collected = true;
          collectedThisFrame += 1;
        }
      }
      if (collectedThisFrame > 0) {
        setUiState((s) => ({ ...s, jewels: s.jewels + collectedThisFrame }));
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(15);
        }
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

    // Notify team of death in team mode
    if (isTeamMode && urlTeamId && player) {
      notifyTeamDeath(urlTeamId, player.id).catch(() => {});
    }

    // Levels 90-100: restart entire level
    if (state.level >= 90) {
      state.status = "dead";
      setUiState(s => ({ ...s, status: "dead", attempts: s.attempts + 1 }));
      setTimeout(() => {
        initLevel(state.level, 1);
      }, 1000);
    } else {
      state.status = "dead";
      setUiState(s => ({ ...s, status: "dead", attempts: s.attempts + 1 }));
      setTimeout(() => initLevel(state.level, state.parcours), 1000);
    }
  }, [initLevel, isTeamMode, urlTeamId, player]);

  const win = useCallback(() => {
    if (!gameStateRef.current || !player || !sessionId) return;
    const state = gameStateRef.current;
    
    if (state.parcours < state.totalParcours) {
      state.status = "won_parcours";
      setUiState(s => ({ ...s, status: "won_parcours" }));

      if (isTeamMode && urlTeamId) {
        // In team mode: auto-advance and notify teammates of the new parcours
        notifyTeamAdvance(urlTeamId, player.id, state.level, state.parcours + 1).catch(() => {});
        setTimeout(() => initLevel(state.level, state.parcours + 1), 800);
      }
      // In solo mode: player clicks goToNextParcours
    } else {
      state.status = "won_level";
      setUiState(s => ({ ...s, status: "won_level" }));

      // Save progress
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

      if (isTeamMode && urlTeamId) {
        // In team mode: auto-advance to next level and notify teammates
        notifyTeamAdvance(urlTeamId, player.id, state.level + 1, 1).catch(() => {});
        setTimeout(() => initLevel(state.level + 1, 1), 1200);
      }
      // In solo mode: player clicks goToNextLevel
    }
  }, [player, sessionId, initLevel, isTeamMode, urlTeamId]);

  const goToNextParcours = useCallback(() => {
    if (!gameStateRef.current) return;
    const state = gameStateRef.current;
    initLevel(state.level, state.parcours + 1);
  }, [initLevel]);

  const goToNextLevel = useCallback(() => {
    if (!gameStateRef.current) return;
    const currentLevel = gameStateRef.current.level;
    initLevel(currentLevel + 1, 1);
  }, [initLevel]);

  // ── Admin-only navigation: jump forward/back a level mid-game and persist
  // the new level on the player so it sticks on next session.
  const adminJumpLevel = useCallback((delta: number) => {
    if (!player || !isAdminPlayer(player)) return;
    if (!gameStateRef.current) return;
    const target = Math.max(1, gameStateRef.current.level + delta);
    initLevel(target, 1);
    updateProgress.mutate(
      { playerId: player.id, data: { level: target } },
      {
        onSuccess: (updatedPlayer) => setPlayer(updatedPlayer),
      }
    );
  }, [player, initLevel, updateProgress, setPlayer]);

  // Keep refs in sync with the latest callbacks so the rAF loop sees fresh state
  useEffect(() => { winRef.current = win; }, [win]);
  useEffect(() => { dieRef.current = die; }, [die]);
  useEffect(() => { isTeamModeRef.current = isTeamMode; }, [isTeamMode]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = gameStateRef.current;
    
    if (!canvas || !ctx || !state) return;

    // ── Team co-op camera with dynamic zoom ─────────────────
    const visibleTeammates = teammatesRef.current.filter(
      tm => tm.level === state.level && tm.parcours === state.parcours
    );

    let camX: number;
    let zoom: number;

    const MIN_ZOOM = 0.42;
    const ZOOM_PADDING = 220; // world-px padding around the group bounding box
    const ZOOM_LERP = 0.06;

    if (isTeamModeRef.current && visibleTeammates.length > 0) {
      // Bounding box covering all players on this parcours
      const allXs = [
        state.player.x + state.player.w / 2,
        ...visibleTeammates.map(tm => tm.x + 15),
      ];
      const minX = Math.min(...allXs);
      const maxX = Math.max(...allXs);
      const spreadX = maxX - minX;

      // Target zoom: fit spread + padding into the canvas width
      const targetZoom = Math.max(MIN_ZOOM, Math.min(1.0, canvas.width / (spreadX + ZOOM_PADDING * 2)));
      teamCamZoomRef.current += (targetZoom - teamCamZoomRef.current) * ZOOM_LERP;
      zoom = teamCamZoomRef.current;

      // Center camera on the midpoint of all players
      const centerX = (minX + maxX) / 2;
      const visibleWidth = canvas.width / zoom;
      camX = Math.max(0, centerX - visibleWidth / 2);
    } else {
      // Solo or no visible teammates — follow own player, return to zoom 1
      teamCamZoomRef.current += (1.0 - teamCamZoomRef.current) * ZOOM_LERP;
      zoom = teamCamZoomRef.current;
      const visibleWidth = canvas.width / zoom;
      camX = Math.max(0, state.player.x - visibleWidth / 3);
    }

    // ── Sky gradient (themed) — drawn in screen space before transform
    drawSky(ctx, canvas.width, canvas.height, state.theme, state.time);

    ctx.save();
    // Apply zoom from top-left then translate for camera
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, 0);

    // ── Background decorations (parallax > 0) ───────────────
    for (const d of state.decorations) {
      if (d.parallax === 0) continue;
      // Apply parallax: shift back toward camera
      const px = d.x + camX * d.parallax;
      drawDecoration(ctx, px, d.y, d.type, d.scale, state.theme, d.x);
    }

    // Distant ground band — pass visible world width so band covers the full view
    drawGroundBand(ctx, camX, canvas.width / zoom, state.theme);

    // ── Platforms ───────────────────────────────────────────
    for (const plat of state.platforms) {
      drawPlatform(ctx, plat, state.theme);
    }

    // ── Trains ──────────────────────────────────────────────
    for (const tr of state.trains) {
      drawTrain(ctx, tr.x, tr.y, tr.w, tr.h, tr.color, tr.vx >= 0);
    }

    // ── Lasers ──────────────────────────────────────────────
    for (const l of state.lasers) {
      const active = isLaserActive(l, state.time);
      // Emitter caps (always visible at both ends)
      ctx.fillStyle = "#1f2937";
      if (l.orientation === "vertical") {
        ctx.fillRect(l.x - 4, l.y - 8, l.w + 8, 8);
        ctx.fillRect(l.x - 4, l.y + l.h, l.w + 8, 8);
      } else {
        ctx.fillRect(l.x - 8, l.y - 4, 8, l.h + 8);
        ctx.fillRect(l.x + l.w, l.y - 4, 8, l.h + 8);
      }
      if (active) {
        ctx.save();
        ctx.shadowColor = "rgba(255, 0, 80, 0.85)";
        ctx.shadowBlur = 20;
        const grad =
          l.orientation === "vertical"
            ? ctx.createLinearGradient(l.x, 0, l.x + l.w, 0)
            : ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
        grad.addColorStop(0, "rgba(255,80,120,0.8)");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "rgba(255,80,120,0.8)");
        ctx.fillStyle = grad;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.restore();
      } else {
        // Faint guide line so the player learns the pattern
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#ff5577";
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.restore();
      }
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

    // ── Jewels (chapter 2 levels 5–10) ──────────────────────
    for (const j of state.jewels) {
      drawJewel(ctx, j, state.time);
    }

    // ── Teammates (same level & parcours only, already filtered above) ──
    if (visibleTeammates.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (const tm of visibleTeammates) {
        const pw = 30, ph = 40;
        drawCharacter(ctx, tm.x, tm.y, pw, ph, tm.color, tm.facingRight);
        // Coloured dot above as name tag
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(tm.x + pw / 2, tm.y - 12, 5, 0, Math.PI * 2);
        ctx.fillStyle = tm.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 0.65;
      }
      ctx.restore();
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

  const loop = useCallback((timestamp: number) => {
    // Cap delta to 100ms so a browser tab pause doesn't cause a huge jump
    const delta = lastFrameTimeRef.current
      ? Math.min(timestamp - lastFrameTimeRef.current, 100)
      : 0;
    lastFrameTimeRef.current = timestamp;
    frameAccumulatorRef.current += delta;

    // Run physics at a fixed 60Hz step regardless of display refresh rate
    while (frameAccumulatorRef.current >= FIXED_STEP_MS) {
      update();
      frameAccumulatorRef.current -= FIXED_STEP_MS;
    }

    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    lastFrameTimeRef.current = 0;
    frameAccumulatorRef.current = 0;
    requestRef.current = requestAnimationFrame(loop);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col font-sans overflow-hidden">
      {/* HUD Header */}
      <div className="h-12 md:h-14 border-b-2 border-border bg-card flex items-center justify-between px-2 md:px-4 shrink-0 z-10 graffiti-text">
        <Link href="/game-mode">
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>

        <div className="flex items-center gap-2 md:gap-5 text-sm md:text-base flex-1 justify-center min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-muted-foreground text-xs md:text-sm hidden sm:inline">NIV.</span>
            <span className="text-base md:text-xl text-primary drop-shadow-[0_0_5px_rgba(255,0,85,0.6)] truncate max-w-[110px] md:max-w-[180px]">
              {uiState.level} · {getLevelName(uiState.level)}
            </span>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block"></div>

          <div className="hidden sm:flex items-baseline gap-1.5">
            <span className="text-muted-foreground text-xs md:text-sm">PARC.</span>
            <span className="text-base md:text-xl text-secondary drop-shadow-[0_0_5px_rgba(0,240,255,0.6)]">
              {uiState.parcours}/{uiState.totalParcours}
            </span>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block"></div>

          <div className="text-base md:text-xl text-accent drop-shadow-[0_0_5px_rgba(250,204,21,0.6)] tabular-nums">
            {uiState.time.toFixed(1)}s
          </div>

          <div className="h-5 w-px bg-border"></div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground text-xs md:text-sm">TRY</span>
            <span className="text-base md:text-xl text-destructive drop-shadow-[0_0_5px_rgba(239,68,68,0.6)] tabular-nums">
              {uiState.attempts}
            </span>
          </div>

          {levelHasJewels(uiState.level) && (
            <>
              <div className="h-5 w-px bg-border"></div>
              <div className="flex items-baseline gap-1.5" data-testid="hud-jewels">
                <span className="text-base md:text-xl" aria-hidden>💎</span>
                <span className="text-base md:text-xl text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.7)] tabular-nums">
                  {uiState.jewels}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {player && isAdminPlayer(player) && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2 border-red-500 text-red-300 hover:bg-red-500/20"
                onClick={() => adminJumpLevel(-1)}
                disabled={uiState.level <= 1}
                title="Niveau précédent (admin)"
                data-testid="admin-prev-level"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2 border-red-500 text-red-300 hover:bg-red-500/20"
                onClick={() => adminJumpLevel(1)}
                title="Niveau suivant (admin)"
                data-testid="admin-next-level"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </>
          )}
          {player && (
            <>
              <span className="graffiti-text text-sm hidden lg:block">{player.username}</span>
              <div className="w-7 h-7 pixel-border" style={{ backgroundColor: player.color }}></div>
            </>
          )}
        </div>
      </div>

      {/* Game Area — fills the remaining viewport, canvas is letterboxed */}
      <div className="flex-1 relative bg-[#09090b] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1000}
          height={562.5} // 16:9 internal resolution
          className="absolute inset-0 m-auto max-w-full max-h-full w-full h-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />

        {showCinematicCh1 && (
          <CinematicChapter1 onComplete={handleCinematicCh1Done} />
        )}

        {showCinematicCh2 && (
          <CinematicChapter2 onComplete={handleCinematicCh2Done} />
        )}

        {voiceError && (
          <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center z-30 p-6 text-center">
            <div className="graffiti-text text-4xl md:text-5xl text-destructive drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] mb-4">🎙️ VOCAL REQUIS</div>
            <div className="text-white text-base md:text-lg max-w-sm leading-relaxed">{voiceError}</div>
          </div>
        )}

        {uiState.status === "loading" && !voiceError && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
            <div className="graffiti-text text-3xl text-white tracking-widest animate-pulse">CHARGEMENT...</div>
          </div>
        )}

        {uiState.status === "dead" && (
          <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center z-20">
            <div className="graffiti-text text-5xl md:text-6xl text-destructive drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">MORT !</div>
            <div className="graffiti-text text-white mt-2 text-xl">Redémarrage...</div>
          </div>
        )}

        {uiState.status === "won_parcours" && (
          <div className="absolute inset-0 bg-secondary/20 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-6 text-center">
            <div className="graffiti-text text-4xl md:text-5xl text-secondary drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]">PARCOURS RÉUSSI !</div>
            <div className="graffiti-text text-white mt-3 text-lg md:text-xl">
              {uiState.parcours}/{uiState.totalParcours} — Continue vers le parcours {uiState.parcours + 1}
            </div>
            {isTeamMode ? (
              <div className="graffiti-text text-secondary mt-6 text-xl animate-pulse">En attente des coéquipiers...</div>
            ) : (
              <Button
                onClick={goToNextParcours}
                size="lg"
                className="graffiti-text text-xl tracking-widest mt-6 bg-secondary hover:bg-secondary/90 text-black border-2 border-border shadow-[0_0_15px_rgba(0,240,255,0.5)]"
              >
                CONTINUER
              </Button>
            )}
          </div>
        )}

        {uiState.status === "won_level" && (
          <div className="absolute inset-0 bg-accent/30 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-6 text-center">
            <div className="graffiti-text text-3xl md:text-5xl text-accent drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] tracking-wider">
              NIVEAU {uiState.level} TERMINÉ !
            </div>
            <div className="graffiti-text text-white mt-3 text-lg md:text-xl">
              Temps : {uiState.time.toFixed(1)}s — Tentatives : {uiState.attempts}
            </div>
            <div className="graffiti-text text-secondary mt-4 text-xl md:text-3xl drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] tracking-wider">
              PROCHAIN NIVEAU : {uiState.level + 1}
            </div>
            {isTeamMode ? (
              <div className="graffiti-text text-accent mt-6 text-xl animate-pulse">Prochain niveau en cours...</div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  onClick={goToNextLevel}
                  size="lg"
                  className="graffiti-text text-xl tracking-widest bg-primary hover:bg-primary/90 text-white border-2 border-border shadow-[0_0_15px_rgba(255,0,85,0.5)]"
                >
                  JOUER
                </Button>
                <Button
                  onClick={() => setLocation("/")}
                  variant="secondary"
                  size="lg"
                  className="graffiti-text text-xl tracking-widest border-2 border-border"
                >
                  RETOUR À L'ACCUEIL
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Mobile Touch Controls — overlaid on the canvas so the playfield uses full screen */}
        <div className="md:hidden absolute inset-x-0 bottom-0 z-30 flex justify-between items-end p-3 select-none touch-none pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <button
              type="button"
              aria-label="Gauche"
              className="w-16 h-16 border-4 border-border rounded-full bg-background/70 backdrop-blur active:bg-primary/40 flex items-center justify-center graffiti-text text-3xl text-white shadow-lg"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = false; }}
              onTouchCancel={(e) => { e.preventDefault(); keysRef.current["ArrowLeft"] = false; }}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Droite"
              className="w-16 h-16 border-4 border-border rounded-full bg-background/70 backdrop-blur active:bg-primary/40 flex items-center justify-center graffiti-text text-3xl text-white shadow-lg"
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = false; }}
              onTouchCancel={(e) => { e.preventDefault(); keysRef.current["ArrowRight"] = false; }}
            >
              →
            </button>
          </div>

          <button
            type="button"
            aria-label="Sauter"
            className="w-20 h-20 border-4 border-primary rounded-full bg-primary/30 backdrop-blur active:bg-primary/60 flex items-center justify-center graffiti-text text-base tracking-widest text-white shadow-lg drop-shadow-[0_0_8px_rgba(255,0,85,0.5)] pointer-events-auto"
            onTouchStart={(e) => { e.preventDefault(); keysRef.current[" "] = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current[" "] = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keysRef.current[" "] = false; }}
          >
            SAUT
          </button>
        </div>
      </div>
    </div>
  );
}
