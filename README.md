# Phaser Maul

A Wintermaul-inspired tower defense game built with **Phaser 3** and **TypeScript**.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## How to Play

1. **Select a tower** by clicking its button in the bottom panel (or press 1-4)
2. **Click on a green tile** to place the tower (path tiles and occupied tiles are blocked)
3. **Press "Start Wave"** to begin the enemy assault
4. **Earn gold** by killing enemies and completing waves
5. **Click an existing tower** to upgrade or sell it
6. Survive all 10 waves to win!

### Tower Types

| Tower | Cost | Damage Type | Special |
|-------|------|-------------|---------|
| Arrow | 50g | Physical | Fast fire rate, all-rounder |
| Cannon | 75g | Physical | Slow, heavy splash damage |
| Ice | 60g | Ice | AOE slow — slows all enemies within radius by 40% |
| Fire | 65g | Fire | Burns enemies (5 DPS for 3s, stacks) |

### Enemy Types

| Enemy | Health | Speed | Notes |
|-------|--------|-------|-------|
| Grunt | 60 | Normal | Basic enemy |
| Runner | 35 | Fast | Low HP, high speed |
| Tank | 200 | Slow | High armor |
| Mage Shield | 80 | Normal | High magic resist |
| Boss | 800 | Very Slow | Tanky all-around |

## Controls

- **1-4** — Select tower type
- **Click** — Place tower / Select existing tower
- **Escape** — Deselect / Cancel placement
- **Hover over tower** — See its range

## Project Structure

```
src/
├── main.ts                 # Phaser game bootstrap
├── config/
│   └── gameConfig.ts       # All balance data, map layout, wave definitions
├── entities/
│   ├── Enemy.ts            # Enemy movement, health, status effects
│   ├── Tower.ts            # Targeting, firing, upgrades
│   └── Projectile.ts       # Projectile movement and hit effects
├── systems/
│   └── WaveManager.ts      # Wave spawning orchestration
├── scenes/
│   └── GameScene.ts        # Main game scene (map, UI, game loop)
└── utils/
    └── helpers.ts           # Math utilities, coordinate conversion
```

## Architecture Notes

**Why this structure?**
- `config/` is separated so you can tweak all balance numbers without touching game logic
- `entities/` are self-contained classes that manage their own sprites and behavior
- `systems/` handle cross-cutting concerns (wave management, potentially pathfinding later)
- `scenes/` are Phaser scenes that orchestrate everything

**Procedural graphics:** The game uses Phaser's built-in shape primitives (circles,
rectangles, lines) instead of sprite assets. This means zero asset loading and instant
iteration. When you're ready for real art, swap the shapes for sprites — the game logic
stays identical.

**No Phaser physics:** Enemy movement and projectile tracking are done manually with
simple math. This gives precise control over behavior (e.g., projectiles that track
targets, not just fly in a straight line) and is actually simpler than configuring
Phaser's arcade physics for a tower defense game.

## Extending the Game

### Add a new tower type
1. Add its definition to `TOWER_DEFS` in `gameConfig.ts`
2. Add its keyboard shortcut in `GameScene.create()`
3. If it has a unique effect, add the logic in `Projectile.onHit()`

### Add a new enemy type
1. Add its definition to `ENEMY_DEFS` in `gameConfig.ts`
2. Use it in `WAVE_DEFS` — that's it!

### Add a new map
1. Create a new `MAP_DATA` grid and `PATH_WAYPOINTS` array
2. (Future: add a map selection screen)

### Add sprite assets
1. Drop images in `src/assets/`
2. Preload them in a `PreloadScene`
3. Replace `this.add.circle(...)` / `this.add.rectangle(...)` with `this.add.sprite(...)`

## Tech Stack

- **Phaser 3.87** — 2D game framework (Canvas/WebGL)
- **TypeScript 5.7** — Type safety and IDE support
- **Vite 6** — Fast dev server and bundler

## Build for Production

```bash
npm run build
```

Output is in `dist/`. Deploy to any static hosting (Vercel, Netlify, GitHub Pages).
