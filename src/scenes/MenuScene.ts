import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/config/gameConfig';

const UI_HEIGHT = 96;
const CANVAS_HEIGHT = GAME_HEIGHT + UI_HEIGHT;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 195, 'PHASER MAUL', {
      fontSize: '72px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 272, 'A tower defense game', {
      fontSize: '20px',
      color: '#8090a8',
    }).setOrigin(0.5);

    this.createButton(cx, 370, 210, 54, 'START GAME', 0x1a6b2e, () => {
      this.scene.start('GameScene');
    });

    this.buildControlsPanel(cx);
  }

  private buildControlsPanel(cx: number): void {
    const panelW = 420;
    const panelH = 176;
    const panelY = 510;

    this.add.rectangle(cx, panelY, panelW, panelH, COLORS.ui.panel)
      .setStrokeStyle(1, 0x2a3a5e);

    const top = panelY - panelH / 2;

    this.add.text(cx, top + 20, 'Controls', {
      fontSize: '16px',
      color: COLORS.ui.wave,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const rows: [string, string][] = [
      ['1 – 7',        'Select tower type'],
      ['Left click',   'Place tower / select placed tower'],
      ['Escape',       'Cancel placement'],
      ['Click tower',  'Upgrade or sell'],
    ];

    const keyX = cx - 190;
    const descX = cx - 60;
    rows.forEach(([key, desc], i) => {
      const y = top + 52 + i * 30;
      this.add.text(keyX, y, key, {
        fontSize: '14px',
        color: COLORS.ui.gold,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.add.text(descX, y, desc, {
        fontSize: '14px',
        color: COLORS.ui.text,
      }).setOrigin(0, 0.5);
    });
  }

  private createButton(
    x: number, y: number, width: number, height: number,
    label: string, color: number, onClick: () => void
  ): void {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, width, height, color);
    bg.setStrokeStyle(2, 0x333333);
    bg.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    container.add([bg, text]);

    bg.on('pointerdown', onClick);
    bg.on('pointerover', () => bg.setFillStyle(color + 0x222222));
    bg.on('pointerout', () => bg.setFillStyle(color));
  }
}
