import { TILE_SIZE } from '@/config/gameConfig';

/** Convert tile coordinates to pixel center */
export function tileToPixel(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Convert pixel position to tile coordinates */
export function pixelToTile(pixelX: number, pixelY: number): { x: number; y: number } {
  return {
    x: Math.floor(pixelX / TILE_SIZE),
    y: Math.floor(pixelY / TILE_SIZE),
  };
}

/** Euclidean distance between two points */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Calculate actual damage after armor/resist */
export function calculateDamage(
  baseDamage: number,
  damageType: string,
  armor: number,
  magicResist: number
): number {
  let reduction = 0;
  if (damageType === 'physical') {
    reduction = armor;
  } else if (damageType === 'magic' || damageType === 'fire' || damageType === 'ice') {
    reduction = magicResist;
  }
  return Math.max(1, baseDamage - reduction); // Always deal at least 1 damage
}

/** Angle from point A to point B in radians */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
