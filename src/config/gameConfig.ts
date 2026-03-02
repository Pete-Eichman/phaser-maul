export const TILE_SIZE = 48;
export const MAP_COLS = 20;
export const MAP_ROWS = 13;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE;   // 960
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE;  // 624
export const UI_HEIGHT = 136;

// Starting resources
export const STARTING_GOLD = 100;
export const STARTING_LIVES = 20;

// Colors for procedural graphics (no sprite assets needed to start)
export const COLORS = {
  grass: 0x2d5a3f,
  grassAlt: 0x3a6b4a,
  path: 0x8c7a6b,
  pathBorder: 0x7a6b5c,
  pathEdge: 0x8ab4c8,
  buildable: 0x2d5a3f,
  buildableHover: 0x4a8a5a,
  invalidHover: 0xff4444,
  ui: {
    background: 0x1a1a2e,
    panel: 0x16213e,
    accent: 0xc9a959,
    text: '#e0e0e0',
    gold: '#f0d060',
    health: '#e05555',
    wave: '#64b5f6',
  },
};

// Difficulty settings
export type DifficultyKey = 'easy' | 'normal' | 'hard';

export interface DifficultySetting {
  label: string;
  startingGoldMult: number;
  startingLivesMult: number;
  enemyHpMult: number;
  enemySpeedMult: number;
  goldMult: number;
}

export const DIFFICULTY_SETTINGS: Record<DifficultyKey, DifficultySetting> = {
  easy: {
    label: 'Easy',
    startingGoldMult: 1.5,
    startingLivesMult: 1.5,
    enemyHpMult: 0.7,
    enemySpeedMult: 0.85,
    goldMult: 1.2,
  },
  normal: {
    label: 'Normal',
    startingGoldMult: 1.0,
    startingLivesMult: 1.0,
    enemyHpMult: 1.0,
    enemySpeedMult: 1.0,
    goldMult: 1.0,
  },
  hard: {
    label: 'Hard',
    startingGoldMult: 0.75,
    startingLivesMult: 0.8,
    enemyHpMult: 1.4,
    enemySpeedMult: 1.2,
    goldMult: 0.85,
  },
};

// Tower definitions — stats per upgrade level (0 = base, 1, 2)
export interface TowerLevel {
  damage: number;
  range: number;        // in pixels
  fireRate: number;     // shots per second
  upgradeCost: number;  // cost to reach THIS level (0 for base)
  slowDuration?: number; // ms; ice tower only
  dotDuration?: number;  // ms; poison tower only
}

export interface TowerDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  color: number;         // Procedural color for the tower sprite
  projectileColor: number;
  projectileSpeed: number;
  damageType: 'physical' | 'magic' | 'fire' | 'ice' | 'lightning' | 'poison';
  levels: TowerLevel[];
  special?: string;      // Description of special effect
  slowRadius?: number;   // AOE slow radius in pixels; ice tower only
  chainCount?: number;   // Number of chain targets; lightning tower only
  chainRadius?: number;  // Chain jump radius in pixels; lightning tower only
}

export const TOWER_DEFS: Record<string, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: 'Arrow Tower',
    description: 'Fast attacks, solid all-rounder',
    cost: 50,
    color: 0xd0d0d0,
    projectileColor: 0xc0c0c0,
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
    color: 0x7a5c3a,
    projectileColor: 0x4a3322,
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
    color: 0x66ccff,
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
    color: 0xff6633,
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
  sniper: {
    id: 'sniper',
    name: 'Sniper Tower',
    description: 'Extreme range, devastating single shots',
    cost: 80,
    color: 0xbb77ff,
    projectileColor: 0xdd99ff,
    projectileSpeed: 650,
    damageType: 'physical',
    levels: [
      { damage: 45, range: 250, fireRate: 0.25, upgradeCost: 0 },
      { damage: 75, range: 290, fireRate: 0.3,  upgradeCost: 70 },
      { damage: 115, range: 330, fireRate: 0.35, upgradeCost: 115 },
    ],
    special: 'Very long range, very high single-target damage',
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning Tower',
    description: 'Zaps enemies in a chain',
    cost: 90,
    color: 0xffd700,
    projectileColor: 0xffee58,
    projectileSpeed: 500,
    damageType: 'lightning',
    chainCount: 2,
    chainRadius: 90,
    levels: [
      { damage: 18, range: 140, fireRate: 0.7,  upgradeCost: 0 },
      { damage: 30, range: 160, fireRate: 0.9,  upgradeCost: 70 },
      { damage: 45, range: 185, fireRate: 1.1,  upgradeCost: 110 },
    ],
    special: 'Chains to 2 nearby enemies (50% damage per chain)',
  },
  poison: {
    id: 'poison',
    name: 'Poison Tower',
    description: 'Poisons all enemies in range',
    cost: 70,
    color: 0x77dd44,
    projectileColor: 0xa5d6a7,
    projectileSpeed: 300,
    damageType: 'poison',
    levels: [
      { damage: 4,  range: 110, fireRate: 0.5, upgradeCost: 0,  dotDuration: 1900 },
      { damage: 7,  range: 130, fireRate: 0.5, upgradeCost: 55, dotDuration: 1900 },
      { damage: 11, range: 155, fireRate: 0.5, upgradeCost: 85, dotDuration: 1900 },
    ],
    special: 'Poisons all enemies in range (stacks from multiple towers)',
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    description: 'Blocks the path. No damage.',
    cost: 15,
    color: 0x667788,
    projectileColor: 0x667788,
    projectileSpeed: 0,
    damageType: 'physical',
    levels: [{ damage: 0, range: 0, fireRate: 0, upgradeCost: 0 }],
  },
};

// Enemy definitions
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
  alpha?: number;       // sprite opacity (1 = opaque)
  physicalImmune?: boolean; // takes no damage from physical attacks
  splits?: string;      // enemy type to spawn on death (killed only, not end)
  splitCount?: number;  // how many to spawn on death
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    id: 'grunt',
    name: 'Grunt',
    health: 60,
    speed: 60,
    reward: 5,
    color: 0xcc4444,
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
    color: 0xbbcc33,
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
    color: 0x667788,
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
    color: 0x9966cc,
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
    color: 0x991133,
    size: 18,
    armor: 5,
    magicResist: 5,
  },
  armoredGrunt: {
    id: 'armoredGrunt',
    name: 'Armored Grunt',
    health: 90,
    speed: 45,
    reward: 8,
    color: 0x78909c,
    size: 12,
    armor: 8,
    magicResist: 0,
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    health: 70,
    speed: 85,
    reward: 10,
    color: 0xe0e0e0,
    size: 10,
    armor: 0,
    magicResist: 0,
    alpha: 0.55,
    physicalImmune: true,
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    health: 80,
    speed: 65,
    reward: 6,
    color: 0xf06292,
    size: 12,
    armor: 0,
    magicResist: 0,
    splits: 'runner',
    splitCount: 2,
  },
};

// Wave definitions — spawn groups; interval/delay in ms
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
  // Wave 5: Tanks + first armored grunts (magic towers become valuable)
  {
    groups: [
      { enemyType: 'grunt', count: 5, interval: 1000, delay: 0 },
      { enemyType: 'tank', count: 3, interval: 2000, delay: 2000 },
      { enemyType: 'grunt', count: 5, interval: 800, delay: 1000 },
      { enemyType: 'armoredGrunt', count: 3, interval: 1800, delay: 3000 },
    ],
    reward: 40,
  },
  // Wave 6: Mage shields + ghosts (forces elemental damage)
  {
    groups: [
      { enemyType: 'mage', count: 6, interval: 1200, delay: 0 },
      { enemyType: 'runner', count: 8, interval: 600, delay: 2000 },
      { enemyType: 'ghost', count: 4, interval: 1000, delay: 1000 },
    ],
    reward: 40,
  },
  // Wave 7: Heavy mixed with armored grunts and first splitters
  {
    groups: [
      { enemyType: 'tank', count: 4, interval: 1800, delay: 0 },
      { enemyType: 'mage', count: 4, interval: 1200, delay: 3000 },
      { enemyType: 'runner', count: 10, interval: 500, delay: 2000 },
      { enemyType: 'armoredGrunt', count: 3, interval: 1500, delay: 1000 },
      { enemyType: 'splitter', count: 2, interval: 2500, delay: 4500 },
    ],
    reward: 50,
  },
  // Wave 8: Runner swarm with ghost flankers
  {
    groups: [
      { enemyType: 'runner', count: 25, interval: 400, delay: 0 },
      { enemyType: 'ghost', count: 6, interval: 600, delay: 2000 },
    ],
    reward: 45,
  },
  // Wave 9: Tank wall with armored support
  {
    groups: [
      { enemyType: 'tank', count: 8, interval: 1500, delay: 0 },
      { enemyType: 'mage', count: 6, interval: 1000, delay: 2000 },
      { enemyType: 'armoredGrunt', count: 4, interval: 1500, delay: 1000 },
    ],
    reward: 55,
  },
  // Wave 10: BOSS + all enemy types
  {
    groups: [
      { enemyType: 'grunt', count: 10, interval: 600, delay: 0 },
      { enemyType: 'boss', count: 1, interval: 0, delay: 3000 },
      { enemyType: 'mage', count: 4, interval: 1000, delay: 2000 },
      { enemyType: 'runner', count: 8, interval: 500, delay: 1000 },
      { enemyType: 'ghost', count: 4, interval: 800, delay: 1500 },
      { enemyType: 'splitter', count: 3, interval: 2000, delay: 5000 },
    ],
    reward: 100,
  },
];

// Score weights
export const SCORE_WEIGHTS = {
  killMultiplier:  10,
  waveMultiplier:  25,
  livesMultiplier: 50,
  winBonus:       500,
  difficultyMult: {
    easy:   0.8,
    normal: 1.0,
    hard:   1.3,
  } as Record<DifficultyKey, number>,
};
