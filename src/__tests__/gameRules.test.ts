/**
 * Game rule / feature tests.
 *
 * These tests exercise cross-cutting behaviors — combinations of config data
 * and pure helper logic — that represent actual gameplay guarantees. They sit
 * between unit tests (single function) and integration tests (Phaser runtime)
 * and should catch balance regressions when gameConfig.ts is edited.
 */
import { describe, it, expect } from 'vitest';
import { TOWER_DEFS, ENEMY_DEFS, WAVE_DEFS } from '@/config/gameConfig';
import { MAP_DEFS } from '@/config/maps';
import { findPath } from '@/systems/Pathfinder';
import { calculateDamage, distance, tileToPixel, pixelToTile } from '@/utils/helpers';

// ─── Damage pipeline ──────────────────────────────────────────────────────────

describe('Damage pipeline', () => {
  const combatTowers = Object.values(TOWER_DEFS).filter(t => t.id !== 'wall');

  it('every combat tower deals at least 1 damage to every enemy type at base level', () => {
    for (const tower of combatTowers) {
      for (const enemy of Object.values(ENEMY_DEFS)) {
        // Ghost physical immunity is enforced at the Projectile level, not calculateDamage.
        // This test verifies the calculateDamage floor — Projectile handles the immunity path.
        const dmg = calculateDamage(
          tower.levels[0].damage,
          tower.damageType,
          enemy.armor,
          enemy.magicResist,
        );
        expect(dmg).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every combat tower deals at least 1 damage to every enemy type at max level', () => {
    for (const tower of combatTowers) {
      const maxLevel = tower.levels[tower.levels.length - 1];
      for (const enemy of Object.values(ENEMY_DEFS)) {
        const dmg = calculateDamage(
          maxLevel.damage,
          tower.damageType,
          enemy.armor,
          enemy.magicResist,
        );
        expect(dmg).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('max-upgraded combat towers always deal at least as much damage as their base level', () => {
    for (const tower of combatTowers) {
      for (const enemy of Object.values(ENEMY_DEFS)) {
        const baseDmg = calculateDamage(
          tower.levels[0].damage, tower.damageType,
          enemy.armor, enemy.magicResist,
        );
        const maxDmg = calculateDamage(
          tower.levels[2].damage, tower.damageType,
          enemy.armor, enemy.magicResist,
        );
        expect(maxDmg).toBeGreaterThanOrEqual(baseDmg);
      }
    }
  });

  it('physical towers are less effective against armored enemies than unarmored ones', () => {
    const physicalTowers = Object.values(TOWER_DEFS).filter(t => t.damageType === 'physical' && t.id !== 'wall');
    const armored   = Object.values(ENEMY_DEFS).filter(e => e.armor > 0);
    const unarmored = Object.values(ENEMY_DEFS).filter(e => e.armor === 0);

    for (const tower of physicalTowers) {
      for (const armoredEnemy of armored) {
        for (const unarmoredEnemy of unarmored) {
          const vsArmored = calculateDamage(
            tower.levels[0].damage, 'physical', armoredEnemy.armor, armoredEnemy.magicResist,
          );
          const vsUnarmored = calculateDamage(
            tower.levels[0].damage, 'physical', unarmoredEnemy.armor, unarmoredEnemy.magicResist,
          );
          expect(vsArmored).toBeLessThanOrEqual(vsUnarmored);
        }
      }
    }
  });

  it('lightning ignores armor — deals more damage to armored enemies than physical would', () => {
    const lightning = TOWER_DEFS.lightning;
    const tank = ENEMY_DEFS.tank; // has both armor and magicResist

    const lightningDmg = calculateDamage(
      lightning.levels[0].damage, 'lightning', tank.armor, tank.magicResist,
    );
    // Same base damage treated as physical would lose more to armor
    const asPhysical = calculateDamage(
      lightning.levels[0].damage, 'physical', tank.armor, tank.magicResist,
    );
    expect(lightningDmg).toBeGreaterThan(asPhysical);
  });

  it('armored grunt takes less physical damage than an unarmored grunt', () => {
    const arrow = TOWER_DEFS.arrow;
    const vsGrunt = calculateDamage(
      arrow.levels[0].damage, 'physical', ENEMY_DEFS.grunt.armor, ENEMY_DEFS.grunt.magicResist,
    );
    const vsArmoredGrunt = calculateDamage(
      arrow.levels[0].damage, 'physical', ENEMY_DEFS.armoredGrunt.armor, ENEMY_DEFS.armoredGrunt.magicResist,
    );
    expect(vsArmoredGrunt).toBeLessThan(vsGrunt);
  });

  it('ghost has physical immunity flag — elemental towers are unaffected by it', () => {
    expect(ENEMY_DEFS.ghost.physicalImmune).toBe(true);
    // Elemental towers bypass physical immunity (ghost has no magicResist)
    const fireDmg = calculateDamage(
      TOWER_DEFS.fire.levels[0].damage, 'fire', ENEMY_DEFS.ghost.armor, ENEMY_DEFS.ghost.magicResist,
    );
    expect(fireDmg).toBeGreaterThanOrEqual(1);
  });
});

// ─── Path coherence ───────────────────────────────────────────────────────────

describe('Path coherence', () => {
  // Run coherence checks against the computed path for every map so that a
  // bad grid edit is caught immediately by the test suite.
  const mapEntries = Object.entries(MAP_DEFS);

  const getGrid = (map: (typeof MAP_DEFS)[string]) =>
    map.openField
      ? map.grid.map(row => row.map(tile => tile === 0 ? 1 : tile))
      : map.grid;

  it('consecutive waypoints share an axis (orthogonal movement)', () => {
    for (const [, map] of mapEntries) {
      const waypoints = findPath(getGrid(map), map.start, map.end);
      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i];
        const b = waypoints[i + 1];
        expect(a.x === b.x || a.y === b.y).toBe(true);
      }
    }
  });

  it('every waypoint pixel center round-trips through pixelToTile', () => {
    for (const [, map] of mapEntries) {
      const waypoints = findPath(getGrid(map), map.start, map.end);
      for (const wp of waypoints) {
        const pixel = tileToPixel(wp.x, wp.y);
        expect(pixelToTile(pixel.x, pixel.y)).toEqual({ x: wp.x, y: wp.y });
      }
    }
  });

  it('distance between consecutive waypoints is positive', () => {
    for (const [, map] of mapEntries) {
      const waypoints = findPath(getGrid(map), map.start, map.end);
      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = tileToPixel(waypoints[i].x, waypoints[i].y);
        const b = tileToPixel(waypoints[i + 1].x, waypoints[i + 1].y);
        expect(distance(a.x, a.y, b.x, b.y)).toBeGreaterThan(0);
      }
    }
  });

  it('total path length exceeds 500px on every map', () => {
    for (const [, map] of mapEntries) {
      const waypoints = findPath(getGrid(map), map.start, map.end);
      let total = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = tileToPixel(waypoints[i].x, waypoints[i].y);
        const b = tileToPixel(waypoints[i + 1].x, waypoints[i + 1].y);
        total += distance(a.x, a.y, b.x, b.y);
      }
      expect(total).toBeGreaterThan(500);
    }
  });
});

// ─── Wave escalation ──────────────────────────────────────────────────────────

describe('Wave escalation', () => {
  const enemyCounts = WAVE_DEFS.map(wave =>
    wave.groups.reduce((sum, g) => sum + g.count, 0),
  );

  it('the second half of waves has more enemies on average than the first half', () => {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(enemyCounts.slice(5))).toBeGreaterThan(avg(enemyCounts.slice(0, 5)));
  });

  it('the final wave reward is larger than the first wave reward', () => {
    expect(WAVE_DEFS[WAVE_DEFS.length - 1].reward).toBeGreaterThan(WAVE_DEFS[0].reward);
  });

  it('the boss only appears in wave 6 or later', () => {
    for (let i = 0; i < 5; i++) {
      const hasBoss = WAVE_DEFS[i].groups.some(g => g.enemyType === 'boss');
      expect(hasBoss).toBe(false);
    }
  });

  it('the final wave includes the boss', () => {
    const finalWave = WAVE_DEFS[WAVE_DEFS.length - 1];
    expect(finalWave.groups.some(g => g.enemyType === 'boss')).toBe(true);
  });

  it('wave difficulty index (enemy count × average health) increases overall', () => {
    const difficulty = (waveIndex: number) => {
      let total = 0;
      for (const group of WAVE_DEFS[waveIndex].groups) {
        total += group.count * ENEMY_DEFS[group.enemyType].health;
      }
      return total;
    };
    // First wave difficulty should be less than final wave difficulty
    expect(difficulty(WAVE_DEFS.length - 1)).toBeGreaterThan(difficulty(0));
  });

  it('new enemy types appear in wave 5 or later', () => {
    const newTypes = new Set(['armoredGrunt', 'ghost', 'splitter']);
    for (let i = 0; i < 4; i++) {
      for (const group of WAVE_DEFS[i].groups) {
        expect(newTypes.has(group.enemyType)).toBe(false);
      }
    }
  });
});

// ─── Tower balance sanity ─────────────────────────────────────────────────────

describe('Tower balance', () => {
  const combatTowers = Object.values(TOWER_DEFS).filter(t => t.id !== 'wall');

  it('the most expensive combat tower at base has higher DPS than the cheapest combat tower at base', () => {
    const dps = (towerId: string) => {
      const def = TOWER_DEFS[towerId];
      // DPS = damage × fireRate (ignoring armor for a fair comparison)
      return def.levels[0].damage * def.levels[0].fireRate;
    };

    const costs = combatTowers.map(d => d.cost);
    const maxCost = Math.max(...costs);
    const minCost = Math.min(...costs);

    const mostExpensive = combatTowers.find(d => d.cost === maxCost)!;
    const cheapest      = combatTowers.find(d => d.cost === minCost)!;

    expect(dps(mostExpensive.id)).toBeGreaterThan(dps(cheapest.id));
  });

  it('sniper tower has the longest range of any combat tower at every level', () => {
    for (let lvl = 0; lvl < 3; lvl++) {
      const sniperRange = TOWER_DEFS.sniper.levels[lvl].range;
      for (const tower of combatTowers) {
        if (tower.id === 'sniper') continue;
        expect(sniperRange).toBeGreaterThan(tower.levels[lvl].range);
      }
    }
  });

  it('sniper tower has the lowest fire rate among combat towers (slowest shooter)', () => {
    const sniperRate = TOWER_DEFS.sniper.levels[0].fireRate;
    for (const tower of combatTowers) {
      if (tower.id === 'sniper') continue;
      expect(sniperRate).toBeLessThan(tower.levels[0].fireRate);
    }
  });
});
