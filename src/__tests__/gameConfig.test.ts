import { describe, it, expect } from 'vitest';
import {
  TOWER_DEFS, ENEMY_DEFS, WAVE_DEFS,
  MAP_DATA, MAP_ROWS, MAP_COLS, PATH_WAYPOINTS,
} from '@/config/gameConfig';

// ─── Tower definitions ────────────────────────────────────────────────────────

describe('TOWER_DEFS', () => {
  const towers = Object.entries(TOWER_DEFS);
  const validDamageTypes = ['physical', 'magic', 'fire', 'ice', 'lightning', 'poison'] as const;

  it('defines exactly 7 tower types', () => {
    expect(towers).toHaveLength(7);
  });

  it('every tower id matches its key in the record', () => {
    for (const [key, def] of towers) {
      expect(def.id).toBe(key);
    }
  });

  it('every tower has exactly 3 upgrade levels', () => {
    for (const [, def] of towers) {
      expect(def.levels).toHaveLength(3);
    }
  });

  it('base level (index 0) has upgradeCost of 0', () => {
    for (const [, def] of towers) {
      expect(def.levels[0].upgradeCost).toBe(0);
    }
  });

  it('upgrade levels 1 and 2 have positive costs', () => {
    for (const [, def] of towers) {
      expect(def.levels[1].upgradeCost).toBeGreaterThan(0);
      expect(def.levels[2].upgradeCost).toBeGreaterThan(0);
    }
  });

  it('damage is non-decreasing across upgrade levels', () => {
    for (const [, def] of towers) {
      expect(def.levels[1].damage).toBeGreaterThanOrEqual(def.levels[0].damage);
      expect(def.levels[2].damage).toBeGreaterThanOrEqual(def.levels[1].damage);
    }
  });

  it('range is non-decreasing across upgrade levels', () => {
    for (const [, def] of towers) {
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

  it('all towers have positive fire rate and range on every level', () => {
    for (const [, def] of towers) {
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

  it('defines exactly 5 enemy types', () => {
    expect(enemies).toHaveLength(5);
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
});

// ─── MAP_DATA ─────────────────────────────────────────────────────────────────

describe('MAP_DATA', () => {
  it('has exactly MAP_ROWS rows', () => {
    expect(MAP_DATA).toHaveLength(MAP_ROWS);
  });

  it('every row has exactly MAP_COLS columns', () => {
    for (const row of MAP_DATA) {
      expect(row).toHaveLength(MAP_COLS);
    }
  });

  it('all tile values are 0 (grass), 1 (path), or 2 (zone)', () => {
    for (const row of MAP_DATA) {
      for (const cell of row) {
        expect([0, 1, 2]).toContain(cell);
      }
    }
  });

  it('contains at least one buildable grass tile', () => {
    const hasBuildable = MAP_DATA.some(row => row.includes(0));
    expect(hasBuildable).toBe(true);
  });

  it('contains at least one path tile', () => {
    const hasPath = MAP_DATA.some(row => row.includes(1));
    expect(hasPath).toBe(true);
  });
});

// ─── PATH_WAYPOINTS ───────────────────────────────────────────────────────────

describe('PATH_WAYPOINTS', () => {
  it('has at least 2 waypoints', () => {
    expect(PATH_WAYPOINTS.length).toBeGreaterThanOrEqual(2);
  });

  it('all waypoints are within map bounds', () => {
    for (const wp of PATH_WAYPOINTS) {
      expect(wp.x).toBeGreaterThanOrEqual(0);
      expect(wp.x).toBeLessThan(MAP_COLS);
      expect(wp.y).toBeGreaterThanOrEqual(0);
      expect(wp.y).toBeLessThan(MAP_ROWS);
    }
  });

  it('waypoint tiles are path or zone tiles, not buildable grass', () => {
    for (const wp of PATH_WAYPOINTS) {
      expect(MAP_DATA[wp.y][wp.x]).toBeGreaterThan(0);
    }
  });

  it('no two consecutive waypoints are identical', () => {
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      expect(a.x === b.x && a.y === b.y).toBe(false);
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
