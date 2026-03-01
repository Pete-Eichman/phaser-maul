import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/config/gameConfig';

const UI_HEIGHT = 136;
const CANVAS_HEIGHT = GAME_HEIGHT + UI_HEIGHT;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // Backdrop card behind the menu content
    this.add.rectangle(cx, CANVAS_HEIGHT / 2 - 20, 680, 520, 0x0d1428)
      .setStrokeStyle(1, 0x243050);

    this.buildTitle(cx);
    this.buildStartButton(cx);
    this.buildControlsPanel(cx);
  }

  private buildTitle(cx: number): void {
    // Drop shadow layer
    this.add.text(cx + 2, 152, 'PHASER MAUL', {
      fontSize: '64px',
      color: '#000000',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setAlpha(0.55);

    this.add.text(cx, 150, 'PHASER MAUL', {
      fontSize: '64px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    // Gold rule
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0xffd700, 0.35);
    gfx.lineBetween(cx - 220, 195, cx + 220, 195);

    this.add.text(cx, 215, 'A tower defense game', {
      fontSize: '17px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
  }

  private buildStartButton(cx: number): void {
    const color = 0x1d7a35;
    const container = this.add.container(cx, 295);

    const bg = this.add.rectangle(0, 0, 220, 50, color);
    bg.setStrokeStyle(1, 0x2eaa50);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add.text(0, 0, 'START GAME', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    });
    label.setOrigin(0.5);

    container.add([bg, label]);

    bg.on('pointerdown', () => this.scene.start('GameScene'));
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2eaa50);
      bg.setStrokeStyle(1, 0x55cc70);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(color);
      bg.setStrokeStyle(1, 0x2eaa50);
    });
  }

  private buildControlsPanel(cx: number): void {
    const panelW = 540;
    const panelH = 162;
    const panelY = 460;
    const top = panelY - panelH / 2;

    this.add.rectangle(cx, panelY, panelW, panelH, COLORS.ui.panel)
      .setStrokeStyle(1, 0x2a3a5e);

    this.add.text(cx, top + 19, 'Controls', {
      fontSize: '14px',
      color: COLORS.ui.wave,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5, 0.5);

    // Divider under header
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x2a3a5e, 1);
    gfx.lineBetween(cx - 260, top + 36, cx + 260, top + 36);

    const rows: [string, string][] = [
      ['1 – 7',       'Select a tower type'],
      ['Left click',  'Place tower or select existing'],
      ['Escape',      'Cancel placement'],
      ['Click tower', 'Upgrade or sell'],
    ];

    const keyX = cx - 245;
    const descX = cx - 80;

    rows.forEach(([key, desc], i) => {
      const y = top + 52 + i * 27;
      this.add.text(keyX, y, key, {
        fontSize: '13px',
        color: COLORS.ui.gold,
        fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0, 0.5);
      this.add.text(descX, y, desc, {
        fontSize: '13px',
        color: COLORS.ui.text,
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0, 0.5);
    });
  }
}
