import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI_HEIGHT, COLORS, DIFFICULTY_SETTINGS, DifficultyKey } from '@/config/gameConfig';
import { MAP_DEFS, DEFAULT_MAP_ID } from '@/config/maps';
import { loadLeaderboard } from '@/utils/leaderboard';

const CANVAS_HEIGHT = GAME_HEIGHT + UI_HEIGHT;

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: DifficultyKey = 'normal';
  private selectedMapId: string = DEFAULT_MAP_ID;

  private difficultyButtons: { key: DifficultyKey; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private mapButtons: { id: string; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private diffDescText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // Backdrop card
    this.add.rectangle(cx, CANVAS_HEIGHT / 2 - 10, 680, 660, 0x0d1428)
      .setStrokeStyle(1, 0x243050);

    this.buildTitle(cx);
    this.buildBestScore(cx);
    this.buildStartButton(cx);
    this.buildMapSelector(cx);
    this.buildDifficultySelector(cx);
    this.buildControlsPanel(cx);
  }

  private buildTitle(cx: number): void {
    this.add.text(cx + 2, 112, 'PHASER MAUL', {
      fontSize: '64px',
      color: '#000000',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setAlpha(0.55);

    this.add.text(cx, 110, 'PHASER MAUL', {
      fontSize: '64px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0xffd700, 0.35);
    gfx.lineBetween(cx - 220, 155, cx + 220, 155);

    this.add.text(cx, 175, 'A tower defense game', {
      fontSize: '17px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
  }

  private buildBestScore(cx: number): void {
    const entries = loadLeaderboard();
    if (entries.length === 0) return;
    this.add.text(cx, 196, `Best: ${entries[0].score.toLocaleString()}`, {
      fontSize: '13px',
      color: COLORS.ui.gold,
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
  }

  private buildStartButton(cx: number): void {
    const color = 0x1d7a35;
    const container = this.add.container(cx, 235);

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

    bg.on('pointerdown', () => {
      this.scene.start('GameScene', {
        difficulty: this.selectedDifficulty,
        mapId: this.selectedMapId,
      });
    });
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2eaa50);
      bg.setStrokeStyle(1, 0x55cc70);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(color);
      bg.setStrokeStyle(1, 0x2eaa50);
    });
  }

  private buildMapSelector(cx: number): void {
    this.add.text(cx, 283, 'Map', {
      fontSize: '13px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const maps = Object.values(MAP_DEFS);
    const difficultyColors: Record<string, number> = {
      easy: 0x1b5e20,
      medium: 0x0d3b6e,
      hard: 0x7f0000,
    };

    const btnW = 140;
    const btnH = 44;
    const gap = 10;
    const totalW = maps.length * btnW + (maps.length - 1) * gap;
    const startX = cx - totalW / 2;

    this.mapButtons = [];

    maps.forEach((map, i) => {
      const x = startX + i * (btnW + gap) + btnW / 2;
      const y = 320;
      const color = difficultyColors[map.difficulty] ?? 0x222244;
      const isSelected = map.id === this.selectedMapId;

      const bg = this.add.rectangle(x, y, btnW, btnH, color);
      bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const nameText = this.add.text(x, y - 8, map.name, {
        fontSize: '13px',
        color: isSelected ? '#ffffff' : '#aaaaaa',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);

      const diffLabel = map.difficulty.charAt(0).toUpperCase() + map.difficulty.slice(1);
      this.add.text(x, y + 10, diffLabel, {
        fontSize: '11px',
        color: isSelected ? '#cccccc' : '#777777',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);

      this.mapButtons.push({ id: map.id, bg, text: nameText });

      bg.on('pointerdown', () => {
        this.selectedMapId = map.id;
        this.refreshMapButtons();
      });

      bg.on('pointerover', () => {
        if (map.id !== this.selectedMapId) {
          const r = Math.min(0xff, ((color >> 16) & 0xff) + 0x11);
          const g = Math.min(0xff, ((color >>  8) & 0xff) + 0x11);
          const b = Math.min(0xff, ( color        & 0xff) + 0x11);
          bg.setFillStyle((r << 16) | (g << 8) | b);
        }
      });
      bg.on('pointerout', () => {
        if (map.id !== this.selectedMapId) bg.setFillStyle(color);
      });
    });
  }

  private refreshMapButtons(): void {
    for (const { id, bg, text } of this.mapButtons) {
      const selected = id === this.selectedMapId;
      bg.setStrokeStyle(selected ? 2 : 1, selected ? 0xffffff : 0x444466);
      text.setStyle({ color: selected ? '#ffffff' : '#aaaaaa', fontStyle: selected ? 'bold' : 'normal' });
    }
  }

  private buildDifficultySelector(cx: number): void {
    this.add.text(cx, 362, 'Difficulty', {
      fontSize: '13px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const options: { key: DifficultyKey; label: string; color: number }[] = [
      { key: 'easy',   label: 'Easy',   color: 0x1b5e20 },
      { key: 'normal', label: 'Normal', color: 0x0d3b6e },
      { key: 'hard',   label: 'Hard',   color: 0x7f0000 },
    ];

    const btnW = 100;
    const btnH = 32;
    const gap = 10;
    const totalW = options.length * btnW + (options.length - 1) * gap;
    const startX = cx - totalW / 2;

    this.difficultyButtons = [];

    options.forEach(({ key, label, color }, i) => {
      const x = startX + i * (btnW + gap) + btnW / 2;
      const y = 391;

      const bg = this.add.rectangle(x, y, btnW, btnH, color);
      const isSelected = key === this.selectedDifficulty;
      bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const text = this.add.text(x, y, label, {
        fontSize: '13px',
        color: isSelected ? '#ffffff' : '#aaaaaa',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);

      this.difficultyButtons.push({ key, bg, text });

      bg.on('pointerdown', () => {
        this.selectedDifficulty = key;
        this.refreshDifficultyButtons();
      });
      bg.on('pointerover', () => {
        if (key !== this.selectedDifficulty) {
          const r = Math.min(0xff, ((color >> 16) & 0xff) + 0x11);
          const g = Math.min(0xff, ((color >>  8) & 0xff) + 0x11);
          const b = Math.min(0xff, ( color        & 0xff) + 0x11);
          bg.setFillStyle((r << 16) | (g << 8) | b);
        }
      });
      bg.on('pointerout', () => {
        if (key !== this.selectedDifficulty) bg.setFillStyle(color);
      });
    });

    const diffDescs: Record<DifficultyKey, string> = {
      easy:   'Easy — more gold, more lives, weaker enemies',
      normal: 'Normal — balanced for a first run',
      hard:   'Hard — less gold, stronger enemies',
    };

    this.diffDescText = this.add.text(cx, 416, diffDescs[this.selectedDifficulty], {
      fontSize: '11px',
      color: '#666677',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
  }

  private refreshDifficultyButtons(): void {
    for (const { key, bg, text } of this.difficultyButtons) {
      const selected = key === this.selectedDifficulty;
      bg.setStrokeStyle(selected ? 2 : 1, selected ? 0xffffff : 0x444466);
      text.setStyle({ color: selected ? '#ffffff' : '#aaaaaa', fontStyle: selected ? 'bold' : 'normal' });
    }

    const diffDescs: Record<DifficultyKey, string> = {
      easy:   'Easy — more gold, more lives, weaker enemies',
      normal: 'Normal — balanced for a first run',
      hard:   'Hard — less gold, stronger enemies',
    };
    this.diffDescText?.setText(diffDescs[this.selectedDifficulty]);
  }

  private buildControlsPanel(cx: number): void {
    const panelW = 540;
    const panelH = 148;
    const panelY = 508;
    const top = panelY - panelH / 2;

    this.add.rectangle(cx, panelY, panelW, panelH, COLORS.ui.panel)
      .setStrokeStyle(1, 0x2a3a5e);

    this.add.text(cx, top + 19, 'Controls', {
      fontSize: '14px',
      color: COLORS.ui.wave,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5, 0.5);

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
      const y = top + 52 + i * 25;
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
