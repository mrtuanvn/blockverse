# BlockVerse - 3D Web Game Platform

A Roblox-style 3D game platform built with Next.js, React Three Fiber, and Rapier Physics.

## 🎮 Game Modes

| Mode | Description | Difficulty |
|------|-------------|------------|
| 🏠 **Lobby** | Central 3D hub with portals to all games | - |
| 🏃 **Obby Runner** | Jump across platforms, avoid obstacles! | Medium |
| ⚔️ **Battle Arena** | Fight waves of enemies, defeat the boss! | Hard |
| 🏎️ **Speed Run** | Race through obstacles against the clock! | Medium |
| 🌍 **Explorer** | Open world with 5 biomes, collectibles & secrets | Easy |
| 🏗️ **Builder** | Build anything with colorful blocks! | Easy |

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **3D Engine**: React Three Fiber + Three.js
- **Physics**: @react-three/rapier (Rapier WASM)
- **State**: Zustand
- **UI**: Tailwind CSS 4
- **Database**: Turso (libSQL) - optional, falls back to in-memory
- **Deployment**: Vercel (free tier)

## 🚀 Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build
```

## 🌐 Environment Variables (Optional - for Turso)

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

> Without Turso, the app uses in-memory storage with seeded leaderboard data.

## 📋 Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Space | Jump |
| Mouse | Look around |
| E | Attack / Interact |
| R | Respawn (when dead) |
| Esc | Pause / Release mouse |
| Left Click (Builder) | Place block |
| Right Click (Builder) | Remove block |
| Scroll (Builder) | Zoom |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── leaderboard/route.ts  # Score API with Turso support
│   │   └── player/route.ts       # Player data API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Main game page
├── game/
│   ├── components/               # Reusable 3D & UI components
│   │   ├── Player.tsx            # Blocky character
│   │   ├── ThirdPersonCamera.tsx # Camera system
│   │   ├── HUD.tsx               # Game overlay
│   │   ├── Portal.tsx            # Scene portals
│   │   ├── Enemy.tsx             # AI enemies
│   │   ├── CollectibleItem.tsx   # Coins, gems, hearts
│   │   └── ...
│   ├── scenes/                   # Game mode scenes
│   │   ├── LobbyScene.tsx        # Central hub
│   │   ├── ObbyScene.tsx         # Obstacle course
│   │   ├── BattleScene.tsx       # Wave combat
│   │   ├── SpeedRunScene.tsx     # Racing
│   │   ├── ExplorerScene.tsx     # Open world
│   │   └── BuilderScene.tsx      # Block builder
│   ├── store/
│   │   └── index.ts              # Zustand game store
│   └── types/
│       └── index.ts              # TypeScript types
└── components/ui/                # shadcn/ui components
```

## 🏆 Features

- 6 unique game modes with distinct gameplay
- 3D physics-based interactions (Rapier)
- Real-time score tracking & leaderboard
- Player progression (XP, levels, coins)
- Responsive design (mobile & desktop)
- Free to deploy on Vercel

## 📝 License

MIT