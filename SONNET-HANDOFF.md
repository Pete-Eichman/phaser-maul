# Phaser Maul — Sonnet Handoff Document

## Project Overview

A Wintermaul-inspired tower defense game built as a portfolio project. Demonstrates TypeScript proficiency, game architecture, and interactive web development for the Boston/Worcester job market (targeting React/TypeScript frontend roles).

**Tech stack:** Phaser 3.87, TypeScript 5.7, Vite 6
**Repo:** https://github.com/Pete-Eichman/phaser-maul
**No backend.** Frontend-only.
**No sprite assets.** Everything is procedural (Phaser shapes). Sprite integration is a future task.

---

## Architecture

```
src/
├── main.ts                 # Phaser bootstrap, game config
├── config/
│   └── gameConfig.ts       # ALL balance data, map layout, wave defs, tower/enemy stats
├── entities/
│   ├── Enemy.ts            # Movement along path waypoints, HP, status effects (slow/burn/poison)
│   ├── Tower.ts            # Targeting, fire cooldown, upgrades, poison aura
│   └── Projectile.ts       # Homing projectiles, damage calc, splash/slow/chain/burn on hit
├── systems/
│   └── WaveManager.ts      # Spawn groups with delays/intervals, wave completion detection
├── scenes/
│   └── GameScene.ts        # Main scene: map, UI panel, tower placement, game loop
└── utils/
    └── helpers.ts           # tileToPixel, pixelToTile, distance, calculateDamage, angleBetween
```

### Key Design Decisions

- **No Phaser physics.** Movement and collision are manual math. Intentional — tower defense doesn't need a physics engine.
- **Config-driven balance.** All tower stats, enemy stats, wave compositions, and the map layout live in `gameConfig.ts`.
- **Procedural graphics.** Towers are rectangles, enemies are circles, projectiles are small circles. Swapping to sprites means replacing shape calls with `this.add.sprite()` — game logic doesn't change.
- **Status effects** are stored as an array on each Enemy. Slow replaces if stronger; burn and poison stack. Processed each frame in `Enemy.processStatusEffects()`.
- **DOT damage bypasses armor/resist.** Only direct projectile hits go through `calculateDamage()`. Burn and poison DOTs call `takeDamage()` directly.
- **Poison tower has no projectile.** `Tower.update()` applies the 'poison' effect directly to all enemies in range and returns `null`. This is the only tower that diverges from the projectile pattern.
- **UI is in-scene**, not HTML overlay. The bottom 96px of the canvas is a UI panel drawn with Phaser objects.

### Constants to Know

- `TILE_SIZE = 48` — everything snaps to this grid
- `MAP_COLS = 20, MAP_ROWS = 13` — game area is 960×624, plus 96px UI panel below
- Tower levels are 0-indexed (0 = base, 1 = first upgrade, 2 = max)
- Damage formula: `max(1, baseDamage - armor)` for physical, `max(1, baseDamage - magicResist)` for all elemental types
- Depth layers: map=0, range circles=4, towers=5-7, enemies=10-11, projectiles=15, chain flash=16, hover=20, UI=50-51, overlays=100+

---

## What Currently Works

- ✅ Tile map renders with checkerboard grass and path
- ✅ 7 tower types: Arrow, Cannon, Ice, Fire, Sniper, Lightning, Poison (keys 1–7)
- ✅ 3 upgrade tiers per tower with gold costs
- ✅ 5 enemy types: Grunt, Runner, Tank, Mage Shield, Boss
- ✅ 10 waves with escalating difficulty and mixed compositions
- ✅ Towers auto-target closest enemy in range and fire homing projectiles
- ✅ Status effects: slow (ice AOE), burn DOT (fire, stacks), poison DOT (poison tower aura, stacks)
- ✅ Ice tower: AOE slow — hits all enemies within 40px of primary target
- ✅ Lightning tower: chains to 2 nearby enemies at 50% damage per jump, arc flash visual
- ✅ Poison tower: no-projectile aura, applies poison DOT to all enemies in range on tick
- ✅ Cannon: splash damage on impact
- ✅ Sniper: extreme range (250–330px), slow fire, high single-target physical damage
- ✅ Gold economy: earn from kills + wave clear bonuses, spend on towers/upgrades
- ✅ Lives system: enemies reaching the exit cost 1 life
- ✅ Tower sell (60% refund) and upgrade UI on click
- ✅ Hover preview shows valid/invalid placement + range circle
- ✅ Keyboard shortcuts (1–7 tower select, Escape cancel)
- ✅ Victory/defeat screens with restart
- ✅ Floating text feedback for gold changes

---

## Tower Identity Reference

| Tower | Key | Cost | Role | Damage Model | Why You Build It |
|-------|-----|------|------|-------------|-----------------|
| **Arrow** | 1 | 50g | DPS workhorse | Fast single-target physical | Reliable, cheap, good vs everything |
| **Cannon** | 2 | 75g | Group killer | Slow splash physical | Clears packs of grunts/runners |
| **Ice** | 3 | 60g | Crowd control | Low single-target + AOE slow | Slows groups so other towers get more shots |
| **Fire** | 4 | 65g | Tank buster | Single-target + stacking burn | Melts high-HP enemies; burns stack from multiple towers |
| **Sniper** | 5 | 80g | Long-range sniper | Very slow, very high single-target physical | Covers areas no other tower can reach |
| **Lightning** | 6 | 90g | Group zapper | Magic, chains to 2 nearby | Efficient vs tightly grouped enemies |
| **Poison** | 7 | 70g | Sustained AOE | Magic DOT aura, no projectile | Continuous pressure on groups; stacks from multiple towers |

### Balance Notes
- **Fire burn stacks** — each shot pushes a new 5 DPS / 3s burn effect. At 0.9 shots/s, one fire tower maintains ~2-3 stacks on its target (~13 DPS burn at steady state). Multiple fire towers on a boss is very powerful.
- **Poison does NOT self-stack** from one tower — dotDuration (1900ms) is set just under the tick interval (2000ms) so there's minimal overlap. Multiple poison towers DO stack on the same enemy.
- **Sniper is physical** — armor matters. Strong vs unarmored runners, less dominant vs tanks (5 armor).
- **Lightning is magic** — consistent vs armor, slightly reduced by magic resist. Best when enemies are clustered.

---

## Open PRs

- `feature/additional-tower-types` — Sniper, Lightning, Poison tower types. Ready to merge.

---

## Iteration Tasks

Below are self-contained tasks ordered roughly by impact. Each can be done independently unless noted.

---

### 1. Title/Menu Scene

**Priority:** High
**Complexity:** Low

Create a `MenuScene` that displays before `GameScene`. Should have:
- Game title ("Phaser Maul")
- "Start Game" button that transitions to `GameScene`
- Brief controls reference (1–7 tower select, click to place, Escape to cancel)
- Later: map selection, difficulty selection

Add to the scene array in `main.ts`: `scene: [MenuScene, GameScene]`.

---

### 2. Tower Targeting Modes

**Priority:** Medium
**Complexity:** Low

Currently towers target the closest enemy. Add selectable targeting modes:
- **Closest** (current behavior)
- **First** (furthest along the path — highest `waypointIndex` + progress)
- **Strongest** (highest current HP)
- **Weakest** (lowest current HP)

Add a `targetMode` property to `Tower`. Cycle it on right-click or via a small UI button when a tower is selected. The targeting logic is in `Tower.update()`.

To support "First" targeting, expose a `pathProgress` float on `Enemy` — sum of completed waypoint segment lengths plus current progress toward the next waypoint.

---

### 3. Wave Preview / Enemy Info

**Priority:** Medium
**Complexity:** Low

Before each wave starts, show what's coming:
- List of enemy types and counts for the next wave
- Colored circles matching enemy colors
- Optional 3-second countdown after clicking "Start Wave"

Data source: `WAVE_DEFS[currentWave].groups` — already there.

---

### 4. Damage Numbers / Combat Feedback

**Priority:** Medium
**Complexity:** Low

Show floating damage numbers above enemies when they take damage. `showFloatingText()` already exists in `GameScene`. Options:
- Emit an event from `Enemy.takeDamage()` that the scene listens to
- Or have `Projectile.onHit()` call a callback

Keep it subtle — small font, fast fade, slight random offset so overlapping hits don't stack visually. Skip DOT ticks (too spammy) — only show on direct projectile hits.

---

### 5. Add Sound Effects

**Priority:** High (huge feel improvement)
**Complexity:** Low-Medium

Sounds needed:
- Tower firing (per tower type — different pitch/style)
- Enemy death
- Enemy reaching exit (life lost)
- Tower placement
- Wave start / wave complete
- Upgrade purchased
- Game over / victory

Use Phaser's audio system. Free SFX from freesound.org or jsfxr. Add a `PreloadScene` to load audio before `GameScene`. Add a mute toggle to the UI.

---

### 6. Additional Enemy Types

**Priority:** Medium
**Complexity:** Low

Ideas that fit the wave progression:
- **Armored Grunt** — like grunt but 8 armor. Forces players to use magic damage towers.
- **Ghost** — immune to physical damage entirely. Magic-only.
- **Splitter** — on death, spawns 2 small runners. Needs death callback in GameScene.
- **Healer** — periodically restores HP to nearby enemies (aura, like poison tower but healing).

For each: add to `ENEMY_DEFS`, add to `WAVE_DEFS`. Splitter requires a death callback mechanism (GameScene already handles enemy death — add `onDeath?: () => void` to Enemy).

---

### 7. Multiple Maps

**Priority:** Medium
**Complexity:** Medium

Create additional map layouts. Each map is just a different `MAP_DATA` grid + `PATH_WAYPOINTS` array. Ideas:
- A spiral path (longer, more tower spots)
- A short, direct path (harder — less time to kill)
- A map with two entry points (enemies from top and side simultaneously)

Add a map selection UI to `MenuScene`. Pass the selected map config into `GameScene` via scene data.

---

### 8. Difficulty Scaling

**Priority:** Low-Medium
**Complexity:** Low

Add Easy / Normal / Hard modes that modify:
- Starting gold and lives
- Enemy health/speed multiplier
- Gold earned multiplier

Implement as a `difficulty` config object passed into `GameScene` via scene data. Multiply relevant values from `gameConfig.ts` at spawn time.

---

### 9. Leaderboard / Score System

**Priority:** Low (good for portfolio)
**Complexity:** Medium

Scoring:
- Points for kills (vary by enemy type)
- Bonus for remaining lives
- Bonus for waves started early (time-to-complete bonus)
- Track total gold earned

Persist to `localStorage` for now. Could become Supabase/Firebase later.

---

### 10. Particle Effects

**Priority:** Low
**Complexity:** Low-Medium

Phaser has a built-in particle system (`this.add.particles()`). Add effects for:
- Projectile impact (small burst matching damage type color)
- Enemy death (explosion)
- Burn DOT (small fire particles on burning enemies)
- Ice slow (frost particles)
- Lightning chain flash is already implemented as a line tween

---

### 11. Mobile / Touch Support

**Priority:** Low (portfolio relevant)
**Complexity:** Medium

The game uses pointer events which work on touch, but the UI needs adaptation. Phaser's `Scale.FIT` is already set. Main work is UI layout for small viewports and larger touch targets.

---

## Code Style Notes

- TypeScript strict mode is on — no `any`, maintain proper types
- Entities manage their own Phaser game objects and have a `destroy()` method
- Game balance changes go in `gameConfig.ts`, not scattered through logic files
- The `GameScene.update()` loop processes enemies → towers → projectiles in that order
- `showFloatingText(x, y, message, color)` is available on GameScene for any feedback text
- No AI fingerprints in code or commits — write as a human developer
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`

---

## Running the Project

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`. Hot module reload is active.

```bash
npm run build   # TypeScript check + Vite build → dist/
```
