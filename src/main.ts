import Phaser from 'phaser';
import { MenuScene } from '@/scenes/MenuScene';
import { GameScene } from '@/scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT, MAP_ROWS, TILE_SIZE } from '@/config/gameConfig';

// UI panel adds extra height below the map
const UI_HEIGHT = 96;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,  // WebGL with Canvas fallback
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT + UI_HEIGHT,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene],
  physics: {
    // We don't need Phaser physics — movement is manual for better control
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  // Performance settings
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
