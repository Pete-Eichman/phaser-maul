import { describe, it, expect } from 'vitest';
import {
  TOWER_DEFS, ENEMY_DEFS, WAVE_DEFS,
  MAP_ROWS, MAP_COLS,
  DIFFICULTY_SETTINGS,
} from '@/config/gameConfig';
import { MAP_DEFS } from '@/config/maps';
import { findPath } from '@/systems/Pathfinder';

// ─── Tower definitions ────────────────────────────────────────────────────────

describe('TOWER_DEFS', () => {
  const towers = Object.entries(TOWER_DEFS);
  const validDamageTypes = ['physical', 'magic', 'fire', 'ice', 'lightning', 'poison'] as const;

  it('defines exactly 8 tower types', () => {
    expect(towers).toHaveLength(8);
  });

  it('every tower id matches its key in the record', () => {
    for (const [key, def] of towers) {
      expect(def.id).toBe(key);
    }
  });

  it('combat towers have exactly 3 upgrade levels', () => {
    for (const [, def] of towers) {
      if (def.id === 'wall') continue;
      expect(def.levels).toHaveLength(3);
    }
  });

  it('base level (index 0) has upgradeCost of 0', () => {
    for (const [, def] of towers) {
      expect(def.levels[0].upgradeCost).toBe(0);
    }
  });

  it('upgrade levels 1 and 2 have positive costs for combat towers', () => {
    for (const [, def] of towers) {
      if (def.id === 'wall') continue;
      expect(def.levels[1].upgradeCost).toBeGreaterThan(0);
      expect(def.levels[2].upgradeCost).toBeGreaterThan(0);
    }
  });

  it('damage is non-decreasing across upgrade levels for combat towers', () => {
    for (const [, def] of towers) {
      if (def.id === 'wall') continue;
      expect(def.levels[1].damage).toBeGreaterThanOrEqual(def.levels[0].damage);
      expect(def.levels[2].damage).toBeGreaterThanOrEqual(def.levels[1].damage);
    }
  });

  it('range is non-decreasing across upgrade levels for combat towers', () => {
    for (const [, def] of towers) {
      if (def.id === 'wall') continue;
      expect(def.levels[1].range).toBeGreaterThanOrEqual(def.levels[0].range);
      expect(def.levels[2].range).toBeGreaterThanOrEqual(def.levels[1].range);
    }
  });

  it('all towers have a valid damage type', () => {
    for (const [, def] of towers) {
      expect(validDamageTypes as readonly string[]).toContain(def.damageType);
    }
  });

  it('all towers have a positive base cost', () => {
    for (const [, def] of towers) {
      expect(def.cost).toBeGreaterThan(0);
    }
  });

  it('all combat towers have positive fire rate and range on every level', () => {
    for (const [, def] of towers) {
      if (def.id === 'wall') continue;
      for (const level of def.levels) {
        expect(level.fireRate).toBeGreaterThan(0);
        expect(level.range).toBeGreaterThan(0);
      }
    }
  });

  // Ice-specific
  it('ice tower has a slowRadius', () => {
    expect(TOWER_DEFS.ice.slowRadius).toBeGreaterThan(0);
  });

  it('ice tower levels all have a positive slowDuration', () => {
    for (const level of TOWER_DEFS.ice.levels) {
      expect(level.slowDuration).toBeGreaterThan(0);
    }
  });

  it('ice tower slowDuration is non-decreasing across levels', () => {
    const levels = TOWER_DEFS.ice.levels;
    expect(levels[1].slowDuration!).toBeGreaterThanOrEqual(levels[0].slowDuration!);
    expect(levels[2].slowDuration!).toBeGreaterThanOrEqual(levels[1].slowDuration!);
  });

  // Lightning-specific
  it('lightning tower has positive chainCount and chainRadius', () => {
    expect(TOWER_DEFS.lightning.chainCount).toBeGreaterThan(0);
    expect(TOWER_DEFS.lightning.chainRadius).toBeGreaterThan(0);
  });

  // Poison-specific
  it('poison tower levels all have a positive dotDuration', () => {
    for (const level of TOWER_DEFS.poison.levels) {
      expect(level.dotDuration).toBeGreaterThan(0);
    }
  });
});

// ─── Enemy definitions ────────────────────────────────────────────────────────

describe('ENEMY_DEFS', () => {
  const enemies = Object.entries(ENEMY_DEFS);

  it('defines exactly 8 enemy types', () => {
    expect(enemies).toHaveLength(8);
  });

  it('all vital stats are positive', () => {
    for (const [, enemy] of enemies) {
      expect(enemy.health).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.reward).toBeGreaterThan(0);
      expect(enemy.size).toBeGreaterThan(0);
    }
  });

  it('armor and magicResist are non-negative', () => {
    for (const [, enemy] of enemies) {
      expect(enemy.armor).toBeGreaterThanOrEqual(0);
      expect(enemy.magicResist).toBeGreaterThanOrEqual(0);
    }
  });

  it('boss has the highest health of all enemy types', () => {
    const maxHealth = Math.max(...Object.values(ENEMY_DEFS).map(e => e.health));
    expect(ENEMY_DEFS.boss.health).toBe(maxHealth);
  });

  it('runner has the highest speed of all enemy types', () => {
    const maxSpeed = Math.max(...Object.values(ENEMY_DEFS).map(e => e.speed));
    expect(ENEMY_DEFS.runner.speed).toBe(maxSpeed);
  });

  it('armored grunt has more armor than base grunt', () => {
    expect(ENEMY_DEFS.armoredGrunt.armor).toBeGreaterThan(ENEMY_DEFS.grunt.armor);
  });

  it('ghost is marked as physically immune and has no armor', () => {
    expect(ENEMY_DEFS.ghost.physicalImmune).toBe(true);
    expect(ENEMY_DEFS.ghost.armor).toBe(0);
  });

  it('splitter references a valid enemy type', () => {
    expect(ENEMY_DEFS.splitter.splits).toBeDefined();
    expect(Object.keys(ENEMY_DEFS)).toContain(ENEMY_DEFS.splitter.splits);
    expect(ENEMY_DEFS.splitter.splitCount).toBeGreaterThan(0);
  });
});

// ─── Map definitions ──────────────────────────────────────────────────────────

describe('MAP_DEFS', () => {
  const maps = Object.entries(MAP_DEFS);

  it('defines exactly 4 maps', () => {
    expect(maps).toHaveLength(4);
  });

  it('every map id matches its key', () => {
    for (const [key, map] of maps) {
      expect(map.id).toBe(key);
    }
  });

  it('every map grid has exactly MAP_ROWS rows', () => {
    for (const [, map] of maps) {
      expect(map.grid).toHaveLength(MAP_ROWS);
    }
  });

  it('every map grid row has exactly MAP_COLS columns', () => {
    for (const [, map] of maps) {
      for (const row of map.grid) {
        expect(row).toHaveLength(MAP_COLS);
      }
    }
  });

  it('all tile values are 0, 1, or 2', () => {
    for (const [, map] of maps) {
      for (const row of map.grid) {
        for (const cell of row) {
          expect([0, 1, 2]).toContain(cell);
        }
      }
    }
  });

  it('every map has at least one buildable tile', () => {
    for (const [, map] of maps) {
      expect(map.grid.some(row => row.includes(0))).toBe(true);
    }
  });

  it('fixed-path maps have at least one path tile', () => {
    for (const [, map] of maps) {
      if (map.openField) continue;
      expect(map.grid.some(row => row.includes(1))).toBe(true);
    }
  });

  it('start and end tiles are within map bounds', () => {
    for (const [, map] of maps) {
      expect(map.start.row).toBeGreaterThanOrEqual(0);
      expect(map.start.row).toBeLessThan(MAP_ROWS);
      expect(map.start.col).toBeGreaterThanOrEqual(0);
      expect(map.start.col).toBeLessThan(MAP_COLS);
      expect(map.end.row).toBeGreaterThanOrEqual(0);
      expect(map.end.row).toBeLessThan(MAP_ROWS);
      expect(map.end.col).toBeGreaterThanOrEqual(0);
      expect(map.end.col).toBeLessThan(MAP_COLS);
    }
  });

  it('start and end tiles are walkable (non-zero)', () => {
    for (const [, map] of maps) {
      expect(map.grid[map.start.row][map.start.col]).toBeGreaterThan(0);
      expect(map.grid[map.end.row][map.end.col]).toBeGreaterThan(0);
    }
  });

  it('A* finds a valid path for every map', () => {
    for (const [, map] of maps) {
      const grid = map.openField
        ? map.grid.map(row => row.map(tile => tile === 0 ? 1 : tile))
        : map.grid;
      const path = findPath(grid, map.start, map.end);
      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0]).toEqual({ x: map.start.col, y: map.start.row });
      expect(path[path.length - 1]).toEqual({ x: map.end.col, y: map.end.row });
    }
  });

  it('computed waypoints are within map bounds', () => {
    for (const [, map] of maps) {
      const grid = map.openField
        ? map.grid.map(row => row.map(tile => tile === 0 ? 1 : tile))
        : map.grid;
      const path = findPath(grid, map.start, map.end);
      for (const wp of path) {
        expect(wp.x).toBeGreaterThanOrEqual(0);
        expect(wp.x).toBeLessThan(MAP_COLS);
        expect(wp.y).toBeGreaterThanOrEqual(0);
        expect(wp.y).toBeLessThan(MAP_ROWS);
      }
    }
  });

  it('computed waypoints land only on walkable tiles', () => {
    for (const [, map] of maps) {
      const grid = map.openField
        ? map.grid.map(row => row.map(tile => tile === 0 ? 1 : tile))
        : map.grid;
      const path = findPath(grid, map.start, map.end);
      for (const wp of path) {
        expect(grid[wp.y][wp.x]).toBeGreaterThan(0);
      }
    }
  });

  it('map difficulty values are valid', () => {
    const valid = ['easy', 'medium', 'hard'];
    for (const [, map] of maps) {
      expect(valid).toContain(map.difficulty);
    }
  });
});

// ─── WAVE_DEFS ────────────────────────────────────────────────────────────────

describe('WAVE_DEFS', () => {
  const validEnemyIds = Object.keys(ENEMY_DEFS);

  it('defines exactly 10 waves', () => {
    expect(WAVE_DEFS).toHaveLength(10);
  });

  it('all wave rewards are positive', () => {
    for (const wave of WAVE_DEFS) {
      expect(wave.reward).toBeGreaterThan(0);
    }
  });

  it('all spawn groups reference valid enemy types', () => {
    for (const wave of WAVE_DEFS) {
      for (const group of wave.groups) {
        expect(validEnemyIds).toContain(group.enemyType);
      }
    }
  });

  it('all spawn group counts are positive', () => {
    for (const wave of WAVE_DEFS) {
      for (const group of wave.groups) {
        expect(group.count).toBeGreaterThan(0);
      }
    }
  });

  it('all spawn intervals are non-negative', () => {
    for (const wave of WAVE_DEFS) {
      for (const group of wave.groups) {
        expect(group.interval).toBeGreaterThanOrEqual(0);
        expect(group.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─── DIFFICULTY_SETTINGS ─────────────────────────────────────────────────────

describe('DIFFICULTY_SETTINGS', () => {
  const difficulties = Object.entries(DIFFICULTY_SETTINGS);

  it('defines exactly 3 difficulty levels', () => {
    expect(difficulties).toHaveLength(3);
  });

  it('all multipliers are positive', () => {
    for (const [, diff] of difficulties) {
      expect(diff.startingGoldMult).toBeGreaterThan(0);
      expect(diff.startingLivesMult).toBeGreaterThan(0);
      expect(diff.enemyHpMult).toBeGreaterThan(0);
      expect(diff.enemySpeedMult).toBeGreaterThan(0);
      expect(diff.goldMult).toBeGreaterThan(0);
    }
  });

  it('normal difficulty uses 1.0 for all multipliers', () => {
    const n = DIFFICULTY_SETTINGS.normal;
    expect(n.startingGoldMult).toBe(1);
    expect(n.startingLivesMult).toBe(1);
    expect(n.enemyHpMult).toBe(1);
    expect(n.enemySpeedMult).toBe(1);
    expect(n.goldMult).toBe(1);
  });

  it('easy gives more starting resources than hard', () => {
    expect(DIFFICULTY_SETTINGS.easy.startingGoldMult).toBeGreaterThan(
      DIFFICULTY_SETTINGS.hard.startingGoldMult,
    );
    expect(DIFFICULTY_SETTINGS.easy.startingLivesMult).toBeGreaterThan(
      DIFFICULTY_SETTINGS.hard.startingLivesMult,
    );
  });

  it('hard has stronger enemies than easy', () => {
    expect(DIFFICULTY_SETTINGS.hard.enemyHpMult).toBeGreaterThan(
      DIFFICULTY_SETTINGS.easy.enemyHpMult,
    );
    expect(DIFFICULTY_SETTINGS.hard.enemySpeedMult).toBeGreaterThan(
      DIFFICULTY_SETTINGS.easy.enemySpeedMult,
    );
  });

  it('all difficulties have a non-empty label', () => {
    for (const [, diff] of difficulties) {
      expect(diff.label.length).toBeGreaterThan(0);
    }
  });
});
