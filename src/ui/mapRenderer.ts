import Phaser from 'phaser';
import { TILE_SIZE, MAP_COLS, MAP_ROWS, COLORS } from '@/config/gameConfig';
import { MapDef } from '@/config/maps';
import { Waypoint } from '@/entities/Enemy';
import { tileToPixel } from '@/utils/helpers';

export function drawMap(scene: Phaser.Scene, mapDef: MapDef, waypoints: Waypoint[]): void {
  const grid = mapDef.grid;

  const detailsG = scene.add.graphics();
  detailsG.setDepth(0.5);

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = grid[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      let color: number;
      if (tile === 1 || tile === 2) {
        color = COLORS.path;
      } else {
        color = (row + col) % 2 === 0 ? COLORS.grass : COLORS.grassAlt;
      }

      const rect = scene.add.rectangle(
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        TILE_SIZE,
        TILE_SIZE,
        color,
      );
      rect.setDepth(0);

      if (tile === 0) {
        const seed = (row * 31 + col * 17) % 100;
        if (seed >= 50) {
          detailsG.fillStyle(0x1e3d28, 0.55);
          const ox1 = (seed * 7) % (TILE_SIZE - 8) + 3;
          const oy1 = (seed * 13) % (TILE_SIZE - 8) + 3;
          detailsG.fillRect(x + ox1, y + oy1, (seed % 3) + 2, (seed % 2) + 2);
          if (seed >= 75) {
            const ox2 = (seed * 11) % (TILE_SIZE - 8) + 3;
            const oy2 = (seed * 19) % (TILE_SIZE - 8) + 3;
            detailsG.fillRect(x + ox2, y + oy2, (seed % 2) + 2, (seed % 3) + 2);
          }
        }
      }
    }
  }

  const edgeG = scene.add.graphics();
  edgeG.setDepth(1);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = grid[row][col];
      if (tile !== 1 && tile !== 2) continue;
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      edgeG.lineStyle(2, COLORS.pathEdge, 0.65);
      if (row === 0 || grid[row - 1][col] === 0) {
        edgeG.beginPath();
        edgeG.moveTo(x, y);
        edgeG.lineTo(x + TILE_SIZE, y);
        edgeG.strokePath();
      }
      if (row === MAP_ROWS - 1 || grid[row + 1][col] === 0) {
        edgeG.beginPath();
        edgeG.moveTo(x, y + TILE_SIZE);
        edgeG.lineTo(x + TILE_SIZE, y + TILE_SIZE);
        edgeG.strokePath();
      }
      if (col === 0 || grid[row][col - 1] === 0) {
        edgeG.beginPath();
        edgeG.moveTo(x, y);
        edgeG.lineTo(x, y + TILE_SIZE);
        edgeG.strokePath();
      }
      if (col === MAP_COLS - 1 || grid[row][col + 1] === 0) {
        edgeG.beginPath();
        edgeG.moveTo(x + TILE_SIZE, y);
        edgeG.lineTo(x + TILE_SIZE, y + TILE_SIZE);
        edgeG.strokePath();
      }
    }
  }

  createMapIndicators(scene, waypoints);
}

export function createMapIndicators(scene: Phaser.Scene, waypoints: Waypoint[]): void {
  if (waypoints.length < 2) return;

  const spawnWp = waypoints[0];
  const exitWp  = waypoints[waypoints.length - 1];

  const spawnAngle = edgeAngle(spawnWp.x, spawnWp.y);
  const exitAngle  = edgeAngle(exitWp.x,  exitWp.y);

  const spawnPos = tileToPixel(spawnWp.x, spawnWp.y);
  const exitPos  = tileToPixel(exitWp.x,  exitWp.y);

  const makeIndicator = (cx: number, cy: number, angle: number, color: number): void => {
    const g = scene.add.graphics();
    g.setDepth(2);
    g.fillStyle(color, 0.9);
    g.fillTriangle(13, 0, -5, -8, -5, 8);
    g.setPosition(cx, cy);
    g.setRotation(angle);
    scene.tweens.add({
      targets: g,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 750,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  };

  makeIndicator(spawnPos.x, spawnPos.y, spawnAngle, 0x44ff88);
  makeIndicator(exitPos.x,  exitPos.y,  exitAngle,  0xff5555);
}

export function edgeAngle(col: number, row: number): number {
  if (col === 0)            return 0;           // left edge  → point right
  if (col === MAP_COLS - 1) return Math.PI;     // right edge → point left
  if (row === 0)            return Math.PI / 2; // top edge   → point down
  return -Math.PI / 2;                          // bottom edge → point up
}

export function drawDashedCircle(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, radius: number,
  color: number, alpha: number,
): void {
  const dashArc = Math.PI / 12; // 15° dash
  const gapArc  = Math.PI / 18; // 10° gap
  const step = dashArc + gapArc;
  g.lineStyle(1, color, alpha);
  for (let a = 0; a < Math.PI * 2; a += step) {
    g.beginPath();
    g.arc(cx, cy, radius, a, Math.min(a + dashArc, Math.PI * 2));
    g.strokePath();
  }
}
