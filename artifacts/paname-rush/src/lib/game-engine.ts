// Game Engine Core
export type Rect = { x: number; y: number; w: number; h: number };

export interface Platform extends Rect {
  type: "normal" | "lava" | "goal";
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
  level: number;
  parcours: number; // current parcours in the level
  totalParcours: number;
  time: number;
  status: "playing" | "dead" | "won_parcours" | "won_level";
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

export function generateLevel(level: number, parcoursIndex: number): Platform[] {
  // Simple procedural generation based on level
  const platforms: Platform[] = [];
  
  // Starting platform
  platforms.push({ x: 50, y: 500, w: 200, h: 40, type: "normal" });
  
  const difficulty = Math.min(level / 10, 10); // 0 to 10
  let currentX = 250;
  let currentY = 500;
  
  const numJumps = 5 + Math.floor(difficulty * 2);
  
  for (let i = 0; i < numJumps; i++) {
    const gapX = 80 + Math.random() * (40 + difficulty * 10);
    const gapY = (Math.random() - 0.5) * 100;
    
    currentX += gapX;
    currentY += gapY;
    
    // Keep in bounds roughly
    if (currentY > 600) currentY = 600;
    if (currentY < 200) currentY = 200;
    
    const width = Math.max(40, 150 - difficulty * 10);
    
    platforms.push({ x: currentX, y: currentY, w: width, h: 30, type: "normal" });
    
    // Add lava occasionally
    if (Math.random() < 0.2 + (difficulty * 0.05)) {
      platforms.push({
        x: currentX,
        y: currentY + 30,
        w: width,
        h: 20,
        type: "lava"
      });
    }
  }
  
  // Goal
  platforms.push({ x: currentX + 150, y: currentY - 50, w: 100, h: 100, type: "goal" });
  
  // Floor lava
  platforms.push({ x: -1000, y: 700, w: 10000, h: 200, type: "lava" });
  
  return platforms;
}

export function getTotalParcours(level: number) {
  if (level <= 2) return 1;
  if (level < 100) return 2;
  return 4;
}
