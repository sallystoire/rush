# Paname Rush

## Overview

A 2D platformer game inspired by Together (Roblox) and Chained Together. Players navigate obstacle courses, avoid lava/red zones, and race through 100 levels with increasing difficulty.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS
- **State Management**: Zustand (player auth)
- **Game Engine**: Custom HTML5 Canvas 2D platformer
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- Main menu with Play and Credits
- Game mode selection (Quick Play, Create Team, Join Team, Leaderboard, Code Boost)
- 2D platformer gameplay with physics (gravity, jumping, collision)
- 100 levels with progressive difficulty
- Team system (create at level 4+, join, team play)
- Leaderboard (individual & team, top 50)
- Boost code system (skip parcours/level)
- Player persistence via localStorage + API

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `players` — Player profiles (username, color, level, bestTime, teamId)
- `teams` — Teams (name, captainId, maxMembers, minLevelRequired, level)
- `boost_codes` — Redeemable boost codes (code, boostType, value)
- `player_boosts` — Player's redeemed boosts (playerId, boostType, used)
- `game_sessions` — Active game sessions (playerId, mode, currentLevel)
- `code_redemptions` — Tracks which player redeemed which code

## API Routes

- `/api/players` — Create/get players, update progress, get boosts
- `/api/teams` — CRUD teams, join/leave
- `/api/leaderboard` — Individual and team leaderboards
- `/api/codes` — Create and redeem boost codes
- `/api/game` — Start game sessions, complete levels
