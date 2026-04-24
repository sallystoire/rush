# Paname Legend

## Overview

A Fortnite-style browser battle royale game for the Paname Discord community. Players fight in a 2D top-down arena with 30 players, shrinking storm, loot weapons, and full character customization.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS
- **State Management**: Zustand (player auth, persisted to localStorage)
- **Game Engine**: Custom HTML5 Canvas 2D battle royale
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)

## Pages & Routes

| Path | Description |
|------|-------------|
| `/` | Login/register screen (Paname Legend styled) |
| `/lobby` | Main hub (2v2.io/Fortnite style: character preview, mode selection, stats) |
| `/locker` | Character customization (skin color, gender, hair color, accessories) |
| `/shop` | Cosmetics shop (hair, caps, wings, glasses — admin-defined items) |
| `/battle-royale` | Full canvas 2D battle royale game (30 players, storm, loot, kill feed) |
| `/leaderboard` | Player & team rankings |
| `/admin` | Admin panel (boost codes, player management) |

## Key Features

### Character Customization
- **Skin color**: 7 presets (beige, light, medium, tan, brown, dark, ebony)
- **Gender**: Male / Female (affects body shape, hair, clothes)
- **Hair color**: 10 color options
- **Accessories**: equip owned items from shop (hair, cap, wings, glasses)
- Stored in DB: `skin_color`, `gender`, `hair_color`, `equipped_items` (JSON), `owned_items` (JSON)

### Shop System
- 14 hardcoded cosmetic items across 4 categories: Hair, Caps, Wings, Glasses
- Rarities: common, uncommon, rare, epic, legendary
- Purchase with in-game coins
- Admin sets default available items in `artifacts/api-server/src/routes/shop.ts`
- Player's owned items tracked in `players.owned_items` (JSON array of IDs)

### Battle Royale Game
- Canvas 2D top-down view, map size 3200×3200
- 1 human player + 29 bots with state machine AI (wander/engage/flee)
- Storm circle that shrinks in 5 phases (~5 minutes total)
- 3 weapon types: pistol, rifle, shotgun (found as loot crates on map)
- WASD movement, mouse aim, left-click to shoot, R to reload
- Kill feed, minimap, health/shield bars, weapon HUD
- Win ("VICTOIRE ROYALE") or death screen with option to replay or return to lobby

### Admin System
- Boost codes with max redemption limits
- Player management (ban, edit, add coins)
- Admin access: `ADMIN_DISCORD_ID` env var OR `ADMIN_PLAYER_IDS` env var (comma-separated)
- Dev access: `ADMIN_PLAYER_IDS=1,2,3,4,5` gives first 5 players admin

## Architecture

```
workspace/
├── artifacts/
│   ├── paname-rush/          # React+Vite frontend (port 5000 dev)
│   │   └── src/
│   │       ├── pages/        # lobby, locker, shop-page, battle-royale, home, admin, leaderboard
│   │       ├── components/   # PlayerCharacter.tsx (SVG), ui/
│   │       ├── lib/          # shop-items.ts, character-api.ts, discord.ts, admin.ts
│   │       └── hooks/        # use-auth.ts (Zustand), use-discord.tsx
│   └── api-server/           # Express backend (port 8080)
│       └── src/
│           ├── routes/       # players, shop, admin, leaderboard, codes, game, ...
│           └── lib/          # migrate.ts, logger.ts
├── lib/
│   ├── db/src/schema/        # Drizzle ORM schema (players, teams, boost_codes, ...)
│   ├── api-spec/             # openapi.yaml (source of truth for codegen)
│   ├── api-client-react/     # Orval-generated React Query hooks
│   └── api-zod/              # Orval-generated Zod validators
└── replit.md
```

## Database Schema (key tables)

### players
- `id`, `username`, `discord_id`, `coins`, `level`, `banned`
- `skin_color` TEXT DEFAULT 'beige'
- `gender` TEXT DEFAULT 'male'
- `hair_color` TEXT DEFAULT '#3b1f0a'
- `equipped_items` TEXT DEFAULT '[]' (JSON array of item IDs)
- `owned_items` TEXT DEFAULT '[]' (JSON array of item IDs)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL (Replit managed) |
| `ADMIN_DISCORD_ID` | Discord ID of admin user |
| `ADMIN_PLAYER_IDS` | Comma-separated player IDs with admin access (dev) |
| `VITE_ADMIN_PLAYER_IDS` | Same as above, exposed to frontend |
| `VITE_API_BASE_URL` | API base URL for frontend (optional) |

## User Preferences

- Game is for the Discord server `discord.gg/paname`
- Game name: **Paname Legend**
- Visual style: Fortnite / 2v2.io dark blue aesthetic
- Shop items are chosen/defined by admin (currently hardcoded in shop.ts)
- Character customization is a core feature: skin, gender, hair, accessories
