import Phaser from 'phaser';
import { GAME_WIDTH, MAP_ROWS, TILE_SIZE, COLORS } from '@/config/gameConfig';
import { LeaderboardEntry } from '@/utils/leaderboard';

export function showWaveBanner(scene: Phaser.Scene, waveNumber: number): void {
  const mapH = MAP_ROWS * TILE_SIZE;
  const banner = scene.add.text(GAME_WIDTH / 2, mapH / 2, `Wave ${waveNumber}`, {
    fontSize: '52px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  });
  banner.setOrigin(0.5);
  banner.setDepth(100);
  banner.setAlpha(0);
  scene.tweens.add({
    targets: banner,
    alpha: 1,
    duration: 200,
    ease: 'Power2',
    yoyo: true,
    hold: 600,
    onComplete: () => banner.destroy(),
  });
}

export function flashVignette(scene: Phaser.Scene): void {
  const mapH = MAP_ROWS * TILE_SIZE;
  const vignette = scene.add.rectangle(GAME_WIDTH / 2, mapH / 2, GAME_WIDTH, mapH, 0xff0000, 0.28);
  vignette.setDepth(99);
  scene.tweens.add({
    targets: vignette,
    alpha: 0,
    duration: 350,
    ease: 'Power2',
    onComplete: () => vignette.destroy(),
  });
}

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string,
  fontSize: string = '14px',
  duration: number = 1200,
): void {
  const text = scene.add.text(x, y, message, {
    fontSize,
    color,
    fontStyle: 'bold',
  });
  text.setOrigin(0.5);
  text.setDepth(30);
  scene.tweens.add({
    targets: text,
    y: y - 30,
    alpha: 0,
    duration,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}

export interface EndScreenParams {
  message: string;
  color: string;
  score: number;
  rank: number;
  topEntries: LeaderboardEntry[];
  totalWaves: number;
  onRestart: () => void;
}

export function showEndScreen(scene: Phaser.Scene, params: EndScreenParams): void {
  const mapH = MAP_ROWS * TILE_SIZE;
  const cx = GAME_WIDTH / 2;
  const midY = mapH / 2;
  const { message, color, score, rank, topEntries, totalWaves, onRestart } = params;

  const blackout = scene.add.rectangle(cx, midY, GAME_WIDTH, mapH, 0x000000);
  blackout.setDepth(99);
  scene.tweens.add({
    targets: blackout,
    alpha: 0,
    duration: 600,
    delay: 100,
    ease: 'Power2',
    onComplete: () => blackout.destroy(),
  });

  const overlay = scene.add.rectangle(cx, midY, GAME_WIDTH, mapH, 0x000000, 0.6);
  overlay.setDepth(100);

  scene.add.text(cx, midY - 80, message, {
    fontSize: '48px', color, fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(101);

  scene.add.text(cx, midY - 28, `Score: ${score.toLocaleString()}`, {
    fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(101);

  if (rank > 0) {
    scene.add.text(cx, midY - 4, `#${rank} of all time!`, {
      fontSize: '14px', color: COLORS.ui.gold,
    }).setOrigin(0.5).setDepth(101);
  }

  scene.add.text(cx, midY + 20, '— Top Scores —', {
    fontSize: '11px', color: '#888888',
  }).setOrigin(0.5).setDepth(101);

  const diffLabels: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  topEntries.slice(0, 5).forEach((e, i) => {
    const label = `#${i + 1}  ${diffLabels[e.difficulty]}  ${e.wavesCompleted}/${totalWaves}  ${e.won ? '✓' : '✗'}  ${e.score.toLocaleString()}`;
    scene.add.text(cx, midY + 36 + i * 16, label, {
      fontSize: '11px', color: '#cccccc',
    }).setOrigin(0.5).setDepth(101);
  });

  // Play Again button
  const btnContainer = scene.add.container(cx, midY + 140);
  btnContainer.setDepth(101);
  const btnColor = 0x4caf50;
  const bg = scene.add.rectangle(0, 0, 160, 40, btnColor);
  bg.setStrokeStyle(2, 0x222222);
  bg.setInteractive({ useHandCursor: true });
  const btnText = scene.add.text(0, 0, 'Play Again', {
    fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
  });
  btnText.setOrigin(0.5);
  btnContainer.add([bg, btnText]);
  bg.on('pointerdown', onRestart);
  bg.on('pointerover', () => {
    const r = Math.min(0xff, ((btnColor >> 16) & 0xff) + 0x22);
    const g = Math.min(0xff, ((btnColor >>  8) & 0xff) + 0x22);
    const b = Math.min(0xff, ( btnColor        & 0xff) + 0x22);
    bg.setFillStyle((r << 16) | (g << 8) | b);
  });
  bg.on('pointerout', () => bg.setFillStyle(btnColor));
}
