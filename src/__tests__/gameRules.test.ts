/**
 * Game rule / feature tests.
 *
 * These tests exercise cross-cutting behaviors — combinations of config data
 * and pure helper logic — that represent actual gameplay guarantees. They sit
 * between unit tests (single function) and integration tests (Phaser runtime)
 * and should catch balance regressions when gameConfig.ts is edited.
 */
import { describe, it, expect } from 'vitest';
import { TOWER_DEFS, ENEMY_DEFS, WAVE_DEFS, PATH_WAYPOINTS } from '@/config/gameConfig';
import { calculateDamage, distance, tileToPixel, pixelToTile } from '@/utils/helpers';

// ─── Damage pipeline ──────────────────────────────────────────────────────────

describe('Damage pipeline', () => {
  it('every tower type deals at least 1 damage to every enemy type at base level', () => {
    for (const tower of Object.values(TOWER_DEFS)) {
      for (const enemy of Object.values(ENEMY_DEFS)) {
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

  it('every tower type deals at least 1 damage to every enemy type at max level', () => {
    for (const tower of Object.values(TOWER_DEFS)) {
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

  it('max-upgraded towers always deal at least as much damage as their base level', () => {
    for (const tower of Object.values(TOWER_DEFS)) {
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
    const physicalTowers = Object.values(TOWER_DEFS).filter(t => t.damageType === 'physical');
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
});

// ─── Path coherence ───────────────────────────────────────────────────────────

describe('Path coherence', () => {
  it('consecutive waypoints move orthogonally (share x or y axis)', () => {
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      const sharesAxis = a.x === b.x || a.y === b.y;
      expect(sharesAxis).toBe(true);
    }
  });

  it('every waypoint pixel center round-trips through pixelToTile', () => {
    for (const wp of PATH_WAYPOINTS) {
      const pixel = tileToPixel(wp.x, wp.y);
      expect(pixelToTile(pixel.x, pixel.y)).toEqual({ x: wp.x, y: wp.y });
    }
  });

  it('distance between consecutive waypoints is positive', () => {
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = tileToPixel(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
      const b = tileToPixel(PATH_WAYPOINTS[i + 1].x, PATH_WAYPOINTS[i + 1].y);
      expect(distance(a.x, a.y, b.x, b.y)).toBeGreaterThan(0);
    }
  });

  it('total path length is a meaningful traversal distance (> 500px)', () => {
    let total = 0;
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = tileToPixel(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
      const b = tileToPixel(PATH_WAYPOINTS[i + 1].x, PATH_WAYPOINTS[i + 1].y);
      total += distance(a.x, a.y, b.x, b.y);
    }
    expect(total).toBeGreaterThan(500);
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
});

// ─── Tower balance sanity ─────────────────────────────────────────────────────

describe('Tower balance', () => {
  it('the most expensive tower at base has higher DPS than the cheapest at base', () => {
    const dps = (towerId: string) => {
      const def = TOWER_DEFS[towerId];
      // DPS = damage × fireRate (ignoring armor for a fair comparison)
      return def.levels[0].damage * def.levels[0].fireRate;
    };

    const costs = Object.values(TOWER_DEFS).map(d => d.cost);
    const maxCost = Math.max(...costs);
    const minCost = Math.min(...costs);

    const mostExpensive = Object.values(TOWER_DEFS).find(d => d.cost === maxCost)!;
    const cheapest      = Object.values(TOWER_DEFS).find(d => d.cost === minCost)!;

    expect(dps(mostExpensive.id)).toBeGreaterThan(dps(cheapest.id));
  });

  it('sniper tower has the longest range of any tower at every level', () => {
    for (let lvl = 0; lvl < 3; lvl++) {
      const sniperRange = TOWER_DEFS.sniper.levels[lvl].range;
      for (const [id, def] of Object.entries(TOWER_DEFS)) {
        if (id === 'sniper') continue;
        expect(sniperRange).toBeGreaterThan(def.levels[lvl].range);
      }
    }
  });

  it('sniper tower has the lowest fire rate (slowest shooter)', () => {
    const sniperRate = TOWER_DEFS.sniper.levels[0].fireRate;
    for (const [id, def] of Object.entries(TOWER_DEFS)) {
      if (id === 'sniper') continue;
      expect(sniperRate).toBeLessThan(def.levels[0].fireRate);
    }
  });
});
