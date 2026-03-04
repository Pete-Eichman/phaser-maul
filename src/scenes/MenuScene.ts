import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI_HEIGHT, COLORS, DIFFICULTY_SETTINGS, DifficultyKey } from '@/config/gameConfig';
import { MAP_DEFS, DEFAULT_MAP_ID } from '@/config/maps';
import { loadLeaderboard } from '@/utils/leaderboard';

const CANVAS_HEIGHT = GAME_HEIGHT + UI_HEIGHT;

type VisibleObject = { setVisible(visible: boolean): void };

export class MenuScene extends Phaser.Scene {
  private selectedMode: 'standard' | 'wintermaul' = 'standard';
  private selectedDifficulty: DifficultyKey = 'normal';
  private selectedMapId: string = DEFAULT_MAP_ID;

  private modeButtons: { mode: 'standard' | 'wintermaul'; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private modeDescText: Phaser.GameObjects.Text | null = null;
  private mapSectionObjects: VisibleObject[] = [];
  private wintermaulNoteObjects: VisibleObject[] = [];
  private controlsKeyText: Phaser.GameObjects.Text | null = null;

  private difficultyButtons: { key: DifficultyKey; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private mapButtons: { id: string; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private diffDescText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // Backdrop card
    this.add.rectangle(cx, CANVAS_HEIGHT / 2 - 10, 680, 700, 0x0d1428)
      .setStrokeStyle(1, 0x243050);

    this.buildTitle(cx);
    this.buildBestScore(cx);
    this.buildModeSelector(cx);
    this.buildMapSelector(cx);
    this.buildWintermaulNote(cx);
    this.buildDifficultySelector(cx);
    this.buildStartButton(cx);
    this.buildControlsPanel(cx);

    this.refreshModeButtons();
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

  private buildModeSelector(cx: number): void {
    this.add.text(cx, 238, 'Game Mode', {
      fontSize: '13px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const modeConfigs: { mode: 'standard' | 'wintermaul'; label: string; color: number }[] = [
      { mode: 'standard',   label: 'STANDARD',   color: 0x0d3b6e },
      { mode: 'wintermaul', label: 'WINTERMAUL', color: 0x1a3a1a },
    ];

    const btnW = 200;
    const btnH = 50;
    const gap = 16;
    const totalW = 2 * btnW + gap;
    const leftCenterX = cx - totalW / 2 + btnW / 2;

    this.modeButtons = [];

    modeConfigs.forEach(({ mode, label, color }, i) => {
      const x = leftCenterX + i * (btnW + gap);
      const bg = this.add.rectangle(x, 275, btnW, btnH, color);
      bg.setInteractive({ useHandCursor: true });

      const text = this.add.text(x, 275, label, {
        fontSize: '15px',
        fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaaaa',
      }).setOrigin(0.5);

      this.modeButtons.push({ mode, bg, text });

      bg.on('pointerdown', () => {
        this.selectedMode = mode;
        this.refreshModeButtons();
      });
      bg.on('pointerover', () => {
        if (mode !== this.selectedMode) {
          const r = Math.min(0xff, ((color >> 16) & 0xff) + 0x11);
          const g = Math.min(0xff, ((color >>  8) & 0xff) + 0x11);
          const b = Math.min(0xff, ( color        & 0xff) + 0x11);
          bg.setFillStyle((r << 16) | (g << 8) | b);
        }
      });
      bg.on('pointerout', () => {
        if (mode !== this.selectedMode) bg.setFillStyle(color);
      });
    });

    this.modeDescText = this.add.text(cx, 315, '', {
      fontSize: '12px',
      color: '#888899',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 440 },
    }).setOrigin(0.5);
  }

  private refreshModeButtons(): void {
    for (const { mode, bg, text } of this.modeButtons) {
      const selected = mode === this.selectedMode;
      bg.setStrokeStyle(selected ? 2 : 1, selected ? 0xffffff : 0x444466);
      text.setStyle({ color: selected ? '#ffffff' : '#aaaaaa' });
    }

    const modeDescs: Record<'standard' | 'wintermaul', string> = {
      standard:   'Fixed path — pick a map and survive the waves using combat towers.',
      wintermaul: 'Open field — build walls to maze enemies, then convert them to combat towers.',
    };
    this.modeDescText?.setText(modeDescs[this.selectedMode]);

    this.refreshMapSection();
  }

  private refreshMapSection(): void {
    const isWintermaul = this.selectedMode === 'wintermaul';

    for (const obj of this.mapSectionObjects) {
      obj.setVisible(!isWintermaul);
    }
    for (const obj of this.wintermaulNoteObjects) {
      obj.setVisible(isWintermaul);
    }

    if (isWintermaul) {
      this.selectedMapId = 'wintermaul';
      this.controlsKeyText?.setText('1 – 8  (8 = Wall)');
    } else {
      this.selectedMapId = DEFAULT_MAP_ID;
      this.refreshMapButtons();
      this.controlsKeyText?.setText('1 – 7');
    }
  }

  private buildMapSelector(cx: number): void {
    const label = this.add.text(cx, 355, 'Map', {
      fontSize: '13px',
      color: '#7a8eaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
    this.mapSectionObjects.push(label);

    const standardMaps = Object.values(MAP_DEFS).filter(m => !m.openField);
    const difficultyColors: Record<string, number> = {
      easy:   0x1b5e20,
      medium: 0x0d3b6e,
      hard:   0x7f0000,
    };

    const btnW = 170;
    const btnH = 44;
    const gap = 10;
    const totalW = standardMaps.length * btnW + (standardMaps.length - 1) * gap;
    const startX = cx - totalW / 2;

    this.mapButtons = [];

    standardMaps.forEach((map, i) => {
      const x = startX + i * (btnW + gap) + btnW / 2;
      const y = 390;
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
      const diffText = this.add.text(x, y + 10, diffLabel, {
        fontSize: '11px',
        color: isSelected ? '#cccccc' : '#777777',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);

      this.mapButtons.push({ id: map.id, bg, text: nameText });
      this.mapSectionObjects.push(bg, nameText, diffText);

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

  private buildWintermaulNote(cx: number): void {
    const line1 = this.add.text(cx, 375, 'Enemies enter at the top, exit at the bottom.', {
      fontSize: '13px',
      color: COLORS.ui.gold,
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const line2 = this.add.text(cx, 400, 'You must never fully block all routes.', {
      fontSize: '12px',
      color: '#777788',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    this.wintermaulNoteObjects.push(line1, line2);
  }

  private buildDifficultySelector(cx: number): void {
    this.add.text(cx, 447, 'Difficulty', {
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
      const y = 478;

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

    this.diffDescText = this.add.text(cx, 504, diffDescs[this.selectedDifficulty], {
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

  private buildStartButton(cx: number): void {
    const color = 0x1d7a35;
    const container = this.add.container(cx, 537);

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

  private buildControlsPanel(cx: number): void {
    const panelW = 540;
    const panelH = 120;
    const panelY = 635;
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
    gfx.lineBetween(cx - 260, top + 33, cx + 260, top + 33);

    const keyX = cx - 245;
    const descX = cx - 80;

    // First row — key range changes based on selected mode
    this.controlsKeyText = this.add.text(keyX, top + 49, '1 – 7', {
      fontSize: '13px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    this.add.text(descX, top + 49, 'Select a tower type', {
      fontSize: '13px',
      color: COLORS.ui.text,
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    const remainingRows: [string, string][] = [
      ['Left click',  'Place tower or select existing'],
      ['Escape',      'Cancel placement'],
      ['Click tower', 'Upgrade, sell, or convert'],
    ];

    remainingRows.forEach(([key, desc], i) => {
      const y = top + 49 + (i + 1) * 22;
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
