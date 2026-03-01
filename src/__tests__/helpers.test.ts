import { describe, it, expect } from 'vitest';
import { tileToPixel, pixelToTile, distance, calculateDamage, angleBetween, lerp } from '@/utils/helpers';
import { TILE_SIZE } from '@/config/gameConfig';

describe('tileToPixel', () => {
  it('origin tile maps to pixel center', () => {
    expect(tileToPixel(0, 0)).toEqual({ x: TILE_SIZE / 2, y: TILE_SIZE / 2 });
  });

  it('tile (1, 0) shifts by one tile width', () => {
    expect(tileToPixel(1, 0)).toEqual({ x: TILE_SIZE + TILE_SIZE / 2, y: TILE_SIZE / 2 });
  });

  it('tile (0, 1) shifts by one tile height', () => {
    expect(tileToPixel(0, 1)).toEqual({ x: TILE_SIZE / 2, y: TILE_SIZE + TILE_SIZE / 2 });
  });

  it('result is always the center of the tile, not the corner', () => {
    const { x, y } = tileToPixel(3, 5);
    expect(x % TILE_SIZE).toBe(TILE_SIZE / 2);
    expect(y % TILE_SIZE).toBe(TILE_SIZE / 2);
  });
});

describe('pixelToTile', () => {
  it('pixel at (0, 0) maps to tile (0, 0)', () => {
    expect(pixelToTile(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('last pixel before tile boundary stays in tile 0', () => {
    expect(pixelToTile(TILE_SIZE - 1, TILE_SIZE - 1)).toEqual({ x: 0, y: 0 });
  });

  it('pixel at exact tile boundary moves to tile 1', () => {
    expect(pixelToTile(TILE_SIZE, TILE_SIZE)).toEqual({ x: 1, y: 1 });
  });

  it('is the inverse of tileToPixel for tile centers', () => {
    const cases = [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 19, y: 12 }];
    for (const tile of cases) {
      const pixel = tileToPixel(tile.x, tile.y);
      expect(pixelToTile(pixel.x, pixel.y)).toEqual(tile);
    }
  });
});

describe('distance', () => {
  it('returns 0 for the same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0);
  });

  it('solves a 3-4-5 right triangle', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('is symmetric', () => {
    expect(distance(0, 0, 10, 20)).toBeCloseTo(distance(10, 20, 0, 0));
  });

  it('handles horizontal distance', () => {
    expect(distance(0, 5, 10, 5)).toBe(10);
  });

  it('handles vertical distance', () => {
    expect(distance(3, 0, 3, 7)).toBe(7);
  });

  it('is always non-negative', () => {
    expect(distance(-10, -10, 5, 5)).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateDamage', () => {
  it('physical damage is reduced by armor', () => {
    expect(calculateDamage(20, 'physical', 5, 0)).toBe(15);
  });

  it('magic damage is reduced by magicResist', () => {
    expect(calculateDamage(20, 'magic', 10, 8)).toBe(12);
  });

  it('fire damage uses magicResist, not armor', () => {
    expect(calculateDamage(10, 'fire', 99, 3)).toBe(7);
  });

  it('ice damage uses magicResist, not armor', () => {
    expect(calculateDamage(10, 'ice', 99, 3)).toBe(7);
  });

  it('lightning damage uses magicResist, not armor', () => {
    expect(calculateDamage(10, 'lightning', 99, 5)).toBe(5);
  });

  it('poison damage uses magicResist, not armor', () => {
    expect(calculateDamage(10, 'poison', 99, 3)).toBe(7);
  });

  it('physical damage ignores magicResist', () => {
    expect(calculateDamage(20, 'physical', 0, 99)).toBe(20);
  });

  it('magic damage ignores armor', () => {
    expect(calculateDamage(20, 'magic', 99, 0)).toBe(20);
  });

  it('armor cannot reduce damage below 1', () => {
    expect(calculateDamage(5, 'physical', 100, 0)).toBe(1);
  });

  it('magicResist cannot reduce damage below 1', () => {
    expect(calculateDamage(5, 'magic', 0, 100)).toBe(1);
  });

  it('zero armor and zero resist deals full base damage', () => {
    expect(calculateDamage(30, 'physical', 0, 0)).toBe(30);
  });
});

describe('angleBetween', () => {
  it('right direction (positive x) is 0 radians', () => {
    expect(angleBetween(0, 0, 1, 0)).toBeCloseTo(0);
  });

  it('down direction (positive y) is π/2', () => {
    expect(angleBetween(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
  });

  it('left direction (negative x) is ±π', () => {
    expect(Math.abs(angleBetween(0, 0, -1, 0))).toBeCloseTo(Math.PI);
  });

  it('up direction (negative y) is -π/2', () => {
    expect(angleBetween(0, 0, 0, -1)).toBeCloseTo(-Math.PI / 2);
  });

  it('result is within [-π, π]', () => {
    const angle = angleBetween(100, 200, 350, 75);
    expect(angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(angle).toBeLessThanOrEqual(Math.PI);
  });
});

describe('lerp', () => {
  it('t=0 returns the start value', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('t=1 returns the end value', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('t=0.5 returns the midpoint', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('works with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('works when a > b', () => {
    expect(lerp(100, 0, 0.25)).toBe(75);
  });
});
