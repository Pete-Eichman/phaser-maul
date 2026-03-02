import Phaser from 'phaser';
import { MenuScene } from '@/scenes/MenuScene';
import { GameScene } from '@/scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT, UI_HEIGHT } from '@/config/gameConfig';

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
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
