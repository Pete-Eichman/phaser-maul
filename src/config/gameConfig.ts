// ============================================================
// GAME CONFIGURATION
// All balance numbers, tower/enemy stats, and map data live here.
// Tweak these to tune gameplay — no need to touch game logic.
// ============================================================

export const TILE_SIZE = 48;
export const MAP_COLS = 20;
export const MAP_ROWS = 13;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE;   // 960
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE;  // 624

// Starting resources
export const STARTING_GOLD = 100;
export const STARTING_LIVES = 20;

// Colors for procedural graphics (no sprite assets needed to start)
export const COLORS = {
  grass: 0x4a7c59,
  grassAlt: 0x3d6b4e,
  path: 0xc4a35a,
  pathBorder: 0x8b7340,
  buildable: 0x5a8f6a,    // Slightly lighter grass = "you can build here"
  buildableHover: 0x6aaf7a,
  invalidHover: 0xff4444,
  ui: {
    background: 0x1a1a2e,
    panel: 0x16213e,
    text: '#e0e0e0',
    gold: '#ffd700',
    health: '#ff4444',
    wave: '#64b5f6',
  },
};

// ============================================================
// MAP LAYOUT
// 0 = grass (buildable)
// 1 = path (enemies walk here)
// 2 = unbuildable (decorative, spawn/exit zones)
// ============================================================
export const MAP_DATA: number[][] = [
  [2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
];

// Path waypoints (tile coordinates) — enemies follow this sequence
// Derived from MAP_DATA above. Order matters!
export const PATH_WAYPOINTS: { x: number; y: number }[] = [
  { x: 3, y: 0 },   // Spawn (top)
  { x: 3, y: 3 },
  { x: 8, y: 3 },
  { x: 8, y: 6 },
  { x: 13, y: 6 },
  { x: 13, y: 2 },
  { x: 16, y: 2 },
  { x: 16, y: 9 },
  { x: 19, y: 9 },
  { x: 19, y: 12 },  // Exit (bottom-right)
];

// ============================================================
// TOWER DEFINITIONS
// Each tower type has stats per upgrade level (0 = base, 1, 2)
// ============================================================
export interface TowerLevel {
  damage: number;
  range: number;        // in pixels
  fireRate: number;     // shots per second
  upgradeCost: number;  // cost to reach THIS level (0 for base)
  slowDuration?: number; // ms; ice tower only
}

export interface TowerDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  color: number;         // Procedural color for the tower sprite
  projectileColor: number;
  projectileSpeed: number;
  damageType: 'physical' | 'magic' | 'fire' | 'ice';
  levels: TowerLevel[];
  special?: string;      // Description of special effect
  slowRadius?: number;   // AOE slow radius in pixels; ice tower only
}

export const TOWER_DEFS: Record<string, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: 'Arrow Tower',
    description: 'Fast attacks, solid all-rounder',
    cost: 50,
    color: 0x8b6914,
    projectileColor: 0xdaa520,
    projectileSpeed: 400,
    damageType: 'physical',
    levels: [
      { damage: 10, range: 150, fireRate: 1.2, upgradeCost: 0 },
      { damage: 18, range: 170, fireRate: 1.5, upgradeCost: 40 },
      { damage: 30, range: 200, fireRate: 1.8, upgradeCost: 80 },
    ],
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon Tower',
    description: 'Slow but heavy splash damage',
    cost: 75,
    color: 0x555555,
    projectileColor: 0x333333,
    projectileSpeed: 250,
    damageType: 'physical',
    levels: [
      { damage: 25, range: 120, fireRate: 0.6, upgradeCost: 0 },
      { damage: 45, range: 140, fireRate: 0.7, upgradeCost: 60 },
      { damage: 70, range: 160, fireRate: 0.8, upgradeCost: 100 },
    ],
    special: 'Splash damage (hits enemies near impact)',
  },
  ice: {
    id: 'ice',
    name: 'Ice Tower',
    description: 'Slows enemies on hit',
    cost: 60,
    color: 0x4fc3f7,
    projectileColor: 0xb3e5fc,
    projectileSpeed: 350,
    damageType: 'ice',
    slowRadius: 40,
    levels: [
      { damage: 5, range: 130, fireRate: 0.8, upgradeCost: 0,  slowDuration: 1500 },
      { damage: 8, range: 150, fireRate: 1.0, upgradeCost: 50, slowDuration: 1750 },
      { damage: 12, range: 175, fireRate: 1.2, upgradeCost: 90, slowDuration: 2000 },
    ],
    special: 'AOE slow — slows all enemies within radius by 40%',
  },
  fire: {
    id: 'fire',
    name: 'Fire Tower',
    description: 'Burns enemies over time',
    cost: 65,
    color: 0xff6f00,
    projectileColor: 0xff9800,
    projectileSpeed: 300,
    damageType: 'fire',
    levels: [
      { damage: 8, range: 130, fireRate: 0.9, upgradeCost: 0 },
      { damage: 14, range: 150, fireRate: 1.1, upgradeCost: 55 },
      { damage: 22, range: 175, fireRate: 1.3, upgradeCost: 95 },
    ],
    special: 'Burns for 5 DPS over 3s (stacks)',
  },
};

// ============================================================
// ENEMY DEFINITIONS
// ============================================================
export interface EnemyDef {
  id: string;
  name: string;
  health: number;
  speed: number;        // pixels per second
  reward: number;       // gold on kill
  color: number;
  size: number;         // radius in pixels
  armor: number;        // flat damage reduction (physical)
  magicResist: number;  // flat damage reduction (magic/elemental)
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    id: 'grunt',
    name: 'Grunt',
    health: 60,
    speed: 60,
    reward: 5,
    color: 0xe53935,
    size: 10,
    armor: 0,
    magicResist: 0,
  },
  runner: {
    id: 'runner',
    name: 'Runner',
    health: 35,
    speed: 110,
    reward: 4,
    color: 0xffb300,
    size: 8,
    armor: 0,
    magicResist: 0,
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    health: 200,
    speed: 35,
    reward: 12,
    color: 0x6d4c41,
    size: 14,
    armor: 5,
    magicResist: 2,
  },
  mage: {
    id: 'mage',
    name: 'Mage Shield',
    health: 80,
    speed: 55,
    reward: 8,
    color: 0x7e57c2,
    size: 10,
    armor: 0,
    magicResist: 8,
  },
  boss: {
    id: 'boss',
    name: 'Boss',
    health: 800,
    speed: 30,
    reward: 50,
    color: 0xd50000,
    size: 18,
    armor: 5,
    magicResist: 5,
  },
};

// ============================================================
// WAVE DEFINITIONS
// Each wave is an array of spawn groups.
// A group spawns `count` of `enemyType` with `interval` ms between each.
// `delay` is ms to wait before this group starts (after previous group).
// ============================================================
export interface SpawnGroup {
  enemyType: string;
  count: number;
  interval: number;  // ms between spawns within group
  delay: number;     // ms delay before this group starts
}

export interface WaveDef {
  groups: SpawnGroup[];
  reward: number;  // bonus gold for clearing the wave
}

export const WAVE_DEFS: WaveDef[] = [
  // Wave 1: Easy intro — just grunts
  {
    groups: [
      { enemyType: 'grunt', count: 8, interval: 1200, delay: 0 },
    ],
    reward: 20,
  },
  // Wave 2: More grunts, faster spawn
  {
    groups: [
      { enemyType: 'grunt', count: 12, interval: 1000, delay: 0 },
    ],
    reward: 25,
  },
  // Wave 3: Introduce runners
  {
    groups: [
      { enemyType: 'grunt', count: 6, interval: 1000, delay: 0 },
      { enemyType: 'runner', count: 6, interval: 800, delay: 2000 },
    ],
    reward: 30,
  },
  // Wave 4: Mixed wave
  {
    groups: [
      { enemyType: 'runner', count: 10, interval: 700, delay: 0 },
      { enemyType: 'grunt', count: 8, interval: 900, delay: 1500 },
    ],
    reward: 35,
  },
  // Wave 5: First tanks
  {
    groups: [
      { enemyType: 'grunt', count: 5, interval: 1000, delay: 0 },
      { enemyType: 'tank', count: 3, interval: 2000, delay: 2000 },
      { enemyType: 'grunt', count: 5, interval: 800, delay: 1000 },
    ],
    reward: 40,
  },
  // Wave 6: Mage shields
  {
    groups: [
      { enemyType: 'mage', count: 6, interval: 1200, delay: 0 },
      { enemyType: 'runner', count: 8, interval: 600, delay: 2000 },
    ],
    reward: 40,
  },
  // Wave 7: Heavy mixed
  {
    groups: [
      { enemyType: 'tank', count: 4, interval: 1800, delay: 0 },
      { enemyType: 'mage', count: 4, interval: 1200, delay: 3000 },
      { enemyType: 'runner', count: 10, interval: 500, delay: 2000 },
    ],
    reward: 50,
  },
  // Wave 8: Runner swarm
  {
    groups: [
      { enemyType: 'runner', count: 25, interval: 400, delay: 0 },
    ],
    reward: 45,
  },
  // Wave 9: Tank wall
  {
    groups: [
      { enemyType: 'tank', count: 8, interval: 1500, delay: 0 },
      { enemyType: 'mage', count: 6, interval: 1000, delay: 2000 },
    ],
    reward: 55,
  },
  // Wave 10: BOSS
  {
    groups: [
      { enemyType: 'grunt', count: 10, interval: 600, delay: 0 },
      { enemyType: 'boss', count: 1, interval: 0, delay: 3000 },
      { enemyType: 'mage', count: 4, interval: 1000, delay: 2000 },
      { enemyType: 'runner', count: 8, interval: 500, delay: 1000 },
    ],
    reward: 100,
  },
];
