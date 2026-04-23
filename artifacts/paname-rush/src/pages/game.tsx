import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  generateLevel, getTotalParcours, 
  checkCollision, GRAVITY, JUMP_FORCE, MOVE_SPEED, MAX_FALL_SPEED,
  type GameState, type Rect
} from "@/lib/game-engine";
import { 
  useStartGame, 
  useCompleteLevel, 
  useUpdatePlayerProgress
} from "@workspace/api-client-react";

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
    status: "loading" // loading, playing, dead, won_parcours, won_level
  });

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
    const platforms = generateLevel(level, parcours);
    
    gameStateRef.current = {
      player: {
        x: 100,
        y: 400,
        w: 30,
        h: 30,
        vx: 0,
        vy: 0,
        color: player.color,
        isGrounded: false
      },
      platforms,
      level,
      parcours,
      totalParcours: totalP,
      time: parcours === 1 ? 0 : (gameStateRef.current?.time || 0),
      status: "playing"
    };
    
    setUiState({
      level,
      parcours,
      totalParcours: totalP,
      time: gameStateRef.current.time,
      status: "playing"
    });
  }, [player]);

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
    
    // Horizontal collision
    let playerRectX: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const plat of state.platforms) {
      if (checkCollision(playerRectX, plat)) {
        if (plat.type === "lava") {
          die();
          return;
        } else if (plat.type === "goal") {
          win();
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

    // Vertical collision
    let playerRectY: Rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const plat of state.platforms) {
      if (checkCollision(playerRectY, plat)) {
        if (plat.type === "lava") {
          die();
          return;
        } else if (plat.type === "goal") {
          win();
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
      setUiState(s => ({ ...s, status: "dead" }));
      setTimeout(() => initLevel(state.level, 1), 1000);
    } else {
      state.status = "dead";
      setUiState(s => ({ ...s, status: "dead" }));
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
                  setTimeout(() => initLevel(state.level + 1, 1), 2000);
                }
              }
            );
          }
        }
      );
    }
  }, [player, sessionId, initLevel]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = gameStateRef.current;
    
    if (!canvas || !ctx || !state) return;

    // Camera follow player
    const camX = Math.max(0, state.player.x - canvas.width / 3);

    ctx.fillStyle = "#09090b"; // dark bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, 0);

    // Draw platforms
    for (const plat of state.platforms) {
      if (plat.type === "lava") {
        ctx.fillStyle = "#ef4444"; // red
      } else if (plat.type === "goal") {
        ctx.fillStyle = "#eab308"; // yellow
      } else {
        ctx.fillStyle = "#27272a"; // gray border
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = "#3f3f46"; // slightly lighter inside
        ctx.fillRect(plat.x + 2, plat.y + 2, plat.w - 4, plat.h - 4);
        continue;
      }
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    }

    // Draw player
    if (state.status !== "dead") {
      drawCharacter(ctx, state.player.x, state.player.y, state.player.w, state.player.h, state.player.color, state.player.vx >= 0);
    } else {
      // Death particles
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
            <div className="text-muted-foreground text-sm">NIVEAU</div>
            <div className="text-2xl text-primary drop-shadow-[0_0_5px_rgba(255,0,85,0.5)]">{uiState.level}</div>
          </div>
          
          <div className="h-8 w-px bg-border hidden md:block"></div>
          
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground text-sm">PARCOURS</div>
            <div className="text-2xl text-secondary drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
              {uiState.parcours}/{uiState.totalParcours}
            </div>
          </div>
          
          <div className="h-8 w-px bg-border hidden md:block"></div>
          
          <div className="flex items-center gap-3 w-32 justify-end font-mono font-bold text-2xl text-accent drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
            {uiState.time.toFixed(1)}s
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
            <div className="absolute inset-0 bg-accent/20 flex flex-col items-center justify-center z-20">
              <div className="pixel-text text-5xl text-accent drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">NIVEAU TERMINE !</div>
              <div className="pixel-text text-white mt-4 text-xl">Preparation du niveau suivant...</div>
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
