import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, GAME_WIDTH, GAME_HEIGHT, UI_HEIGHT,
  COLORS, STARTING_GOLD, STARTING_LIVES, WINTERMAUL_STARTING_GOLD,
  TOWER_DEFS, TowerDef,
  DIFFICULTY_SETTINGS, DifficultyKey, ENEMY_DEFS, EnemyDef,
} from '@/config/gameConfig';
import { MAP_DEFS, DEFAULT_MAP_ID, MapDef } from '@/config/maps';
import { findPath } from '@/systems/Pathfinder';
import { SpatialHash } from '@/systems/SpatialHash';
import { Tower } from '@/entities/Tower';
import { Enemy, Waypoint } from '@/entities/Enemy';
import { Projectile } from '@/entities/Projectile';
import { WaveManager } from '@/systems/WaveManager';
import { tileToPixel, pixelToTile } from '@/utils/helpers';
import { computeScore, addLeaderboardEntry, LeaderboardEntry } from '@/utils/leaderboard';
import {
  sfxArrow, sfxCannon, sfxIce, sfxFire, sfxSniper, sfxLightning,
  sfxEnemyDie, sfxLifeLost, sfxWaveStart, sfxVictory, sfxDefeat,
  isMuted, toggleMute,
} from '@/utils/sound';
import { drawMap, drawDashedCircle } from '@/ui/mapRenderer';
import { showEndScreen, showWaveBanner, flashVignette, showFloatingText } from '@/ui/endScreen';
import {
  INFO_PANEL_X,
  InfoPanelRefs, TowerInfoCallbacks,
  showInfoPanel, showWavePreview, clearInfoPanel,
  showTowerInfo, clearTowerInfo,
} from '@/ui/infoPanel';

const TOWER_SFX: Record<string, () => void> = {
  arrow:     sfxArrow,
  cannon:    sfxCannon,
  ice:       sfxIce,
  fire:      sfxFire,
  sniper:    sfxSniper,
  lightning: sfxLightning,
};

export class GameScene extends Phaser.Scene {
  // Game state
  private gold: number = 0;
  private lives: number = 0;
  private killCount: number = 0;
  private gameOver: boolean = false;
  private gameWon: boolean = false;
  private difficultyKey: DifficultyKey = 'normal';
  private mapId: string = DEFAULT_MAP_ID;

  // Active map data (set in init, used throughout)
  private mapDef!: MapDef;
  private waypoints: Waypoint[] = [];
  private pathGrid: number[][] = [];
  private isOpenField: boolean = false;

  // Entities
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];

  // Systems
  private waveManager!: WaveManager;
  private spatialHash!: SpatialHash<Enemy>;

  // UI
  private selectedTowerDef: TowerDef | null = null;
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private startWaveButton!: Phaser.GameObjects.Container;
  private selectedTower: Tower | null = null;
  private muteButton!: Phaser.GameObjects.Container;
  private speedButton!: Phaser.GameObjects.Container;
  private speedButtonText!: Phaser.GameObjects.Text;

  // Info panel — mutable refs owned and mutated by infoPanel.ts functions
  private panelRefs: InfoPanelRefs = {
    graphics: null as unknown as Phaser.GameObjects.Graphics,
    text: null as unknown as Phaser.GameObjects.Text,
    upgradeButton: null,
    sellButton: null,
    targetModeButton: null,
    towerNameText: null,
    convertPanelItems: [],
  };
  private infoPanelX: number = INFO_PANEL_X;

  // Pause / speed state
  private paused: boolean = false;
  private gameSpeed: 1 | 2 = 1;
  private pauseOverlay: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { difficulty?: DifficultyKey; mapId?: string }): void {
    this.difficultyKey = data.difficulty ?? 'normal';
    this.mapId = data.mapId ?? DEFAULT_MAP_ID;

    // Load map definition and compute waypoints via A*
    this.mapDef = MAP_DEFS[this.mapId] ?? MAP_DEFS[DEFAULT_MAP_ID];
    this.isOpenField = this.mapDef.openField ?? false;
    if (this.isOpenField) {
      this.pathGrid = this.mapDef.grid.map(row =>
        row.map(tile => tile === 0 ? 1 : tile)
      );
    }
    const gridForPath = this.isOpenField ? this.pathGrid : this.mapDef.grid;
    const rawWaypoints = findPath(gridForPath, this.mapDef.start, this.mapDef.end);
    this.waypoints = rawWaypoints;

    // Reset state so restarts start clean
    this.gameOver = false;
    this.gameWon = false;
    this.killCount = 0;
    this.paused = false;
    this.gameSpeed = 1;
    this.pauseOverlay = null;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedTowerDef = null;
    this.selectedTower = null;
    this.towerButtons = [];

    // Reset panel refs (graphics/text are recreated in create())
    this.panelRefs.upgradeButton = null;
    this.panelRefs.sellButton = null;
    this.panelRefs.targetModeButton = null;
    this.panelRefs.towerNameText = null;
    this.panelRefs.convertPanelItems = [];
  }

  create(): void {
    const diff = DIFFICULTY_SETTINGS[this.difficultyKey];
    this.gold = this.isOpenField
      ? Math.round(WINTERMAUL_STARTING_GOLD * diff.startingGoldMult)
      : Math.round(STARTING_GOLD * diff.startingGoldMult);
    this.lives = Math.round(STARTING_LIVES * diff.startingLivesMult);

    // Cell size = 2 tiles; balances bucket count vs enemies-per-bucket at typical wave sizes
    this.spatialHash = new SpatialHash<Enemy>(TILE_SIZE * 2, (e) => ({ x: e.sprite.x, y: e.sprite.y }));

    drawMap(this, this.mapDef, this.waypoints);
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.hoverGraphics = this.add.graphics();
    this.hoverGraphics.setDepth(20);

    this.waveManager = new WaveManager(
      this,
      this.waypoints,
      (enemy) => this.enemies.push(enemy),
      (reward) => this.onWaveComplete(reward),
      diff.enemyHpMult,
      diff.enemySpeedMult,
      diff.goldMult,
    );

    this.createUI();
    showWavePreview(this, this.panelRefs, this.waveManager, this.infoPanelX);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(pointer);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const towerIds = this.isOpenField
        ? ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison', 'wall']
        : ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison'];
      const towerKeys = towerIds.map((_, i) => `${i + 1}`);
      const idx = towerKeys.indexOf(event.key);
      if (idx !== -1) this.selectTowerDef(towerIds[idx]);
      if (event.key === 'Escape') this.deselectAll();
      if (event.key === 'p' || event.key === 'P') this.togglePause();
      if (event.key === 'f' || event.key === 'F') this.toggleSpeed();
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.gameWon) return;
    if (this.paused) return;

    const scaledDelta = delta * this.gameSpeed;

    this.waveManager.update(scaledDelta);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(scaledDelta);

      if (!enemy.alive) {
        if (enemy.reachedEnd) {
          this.lives--;
          sfxLifeLost();
          flashVignette(this);
          this.waveManager.onEnemyReachedEnd();
          enemy.destroy();
          this.enemies.splice(i, 1);
          if (this.lives <= 0) {
            this.endGame(false);
            return;
          }
        } else if (!enemy.deathAnimationStarted) {
          // First frame the enemy is dead — process rewards and kick off animation.
          // The enemy stays in the array until the tween finishes (dying=false).
          this.gold += enemy.reward;
          this.killCount++;
          this.waveManager.onEnemyDied();

          // Splitter: spawn children at the parent's position and waypoint
          if (enemy.def.splits && enemy.def.splitCount) {
            const childBaseDef: EnemyDef | undefined = ENEMY_DEFS[enemy.def.splits];
            if (childBaseDef) {
              const childDef = this.waveManager.scaleDef(childBaseDef);
              for (let j = 0; j < enemy.def.splitCount; j++) {
                const child = new Enemy(this, childDef, this.waypoints, enemy.waypointIndex);
                child.sprite.setPosition(enemy.sprite.x, enemy.sprite.y);
                this.enemies.push(child);
                this.waveManager.addEnemy();
              }
            }
          }

          sfxEnemyDie();
          enemy.startDeathAnimation();
        } else if (!enemy.dying) {
          // Animation finished — clean up.
          enemy.destroy();
          this.enemies.splice(i, 1);
        }
        // else: tween still running, leave in array
      }
    }

    // Rebuild spatial hash each frame so towers query only nearby enemies
    this.spatialHash.clear();
    for (const enemy of this.enemies) {
      if (enemy.alive) this.spatialHash.insert(enemy);
    }

    for (const tower of this.towers) {
      const nearby = this.spatialHash.query(tower.sprite.x, tower.sprite.y, tower.getStats().range);
      const projectile = tower.update(scaledDelta, nearby);
      if (projectile) {
        TOWER_SFX[tower.def.id]?.();
        projectile.onDamageDealt = (x, y, dmg, label) => {
          const offsetX = (Math.random() - 0.5) * 16;
          if (label) {
            showFloatingText(this, x + offsetX, y - 10, label, '#aaaaaa', '11px', 700);
          } else {
            showFloatingText(this, x + offsetX, y - 10, String(dmg), '#ffffff', '12px', 800);
          }
        };
        this.projectiles.push(projectile);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(scaledDelta, this.enemies);

      if (!proj.alive) {
        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }

    if (this.waveManager.allWavesComplete && this.enemies.length === 0) {
      this.endGame(true);
    }

    this.updateUI();
  }

  // UI creation

  private createUI(): void {
    const uiY = MAP_ROWS * TILE_SIZE;

    const uiBg = this.add.rectangle(
      GAME_WIDTH / 2, uiY + UI_HEIGHT / 2,
      GAME_WIDTH, UI_HEIGHT,
      COLORS.ui.panel,
    );
    uiBg.setDepth(50);
    uiBg.setStrokeStyle(1, 0x222244);

    // Gold accent line separating map from UI panel
    const accentLine = this.add.graphics();
    accentLine.lineStyle(2, COLORS.ui.accent, 1);
    accentLine.lineBetween(0, uiY, GAME_WIDTH, uiY);
    accentLine.setDepth(52);

    this.goldText = this.add.text(12, uiY + 10, '', {
      fontSize: '16px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
    });
    this.goldText.setDepth(51);

    this.livesText = this.add.text(165, uiY + 10, '', {
      fontSize: '16px',
      color: COLORS.ui.health,
      fontStyle: 'bold',
    });
    this.livesText.setDepth(51);

    this.waveText = this.add.text(310, uiY + 10, '', {
      fontSize: '14px',
      color: COLORS.ui.wave,
    });
    this.waveText.setDepth(51);

    this.statusText = this.add.text(12, uiY + 30, '', {
      fontSize: '12px',
      color: '#999999',
    });
    this.statusText.setDepth(51);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x333355, 1);
    divider.lineBetween(0, uiY + 48, GAME_WIDTH, uiY + 48);
    divider.setDepth(50);

    // Vertical separator between tower buttons and info panel
    const infoDivider = this.add.graphics();
    infoDivider.lineStyle(1, 0x333355, 0.8);
    infoDivider.lineBetween(this.infoPanelX, uiY + 52, this.infoPanelX, uiY + 132);
    infoDivider.setDepth(51);

    // Info panel background (right side of row 2)
    const infoPanelCenterX = (this.infoPanelX + GAME_WIDTH) / 2;
    const infoPanelWidth = GAME_WIDTH - this.infoPanelX - 4;
    const infoPanelBg = this.add.rectangle(
      infoPanelCenterX, uiY + 92,
      infoPanelWidth, 76,
      0x0d0d1e,
    );
    infoPanelBg.setStrokeStyle(1, 0x252545);
    infoPanelBg.setDepth(51);

    this.panelRefs.text = this.add.text(this.infoPanelX + 8, uiY + 56, '', {
      fontSize: '11px',
      color: COLORS.ui.text,
      lineSpacing: 3,
    });
    this.panelRefs.text.setDepth(52);

    this.panelRefs.graphics = this.add.graphics();
    this.panelRefs.graphics.setDepth(53);

    const towerIds = this.isOpenField
      ? ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison', 'wall']
      : ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison'];
    const startX = 82;
    towerIds.forEach((id, i) => {
      const def = TOWER_DEFS[id];
      const btnX = startX + i * 82;
      const btn = this.createTowerButton(btnX, uiY + 92, def, `${i + 1}`);
      this.towerButtons.push(btn);
    });

    this.startWaveButton = this.createButton(
      GAME_WIDTH - 80, uiY + 24, 130, 36,
      'Start Wave', 0x4caf50,
      () => this.startWave(),
    );

    this.muteButton = this.createMuteButton(620, uiY + 24);
    this.speedButton = this.createSpeedButton(700, uiY + 24);
  }

  private createTowerButton(
    x: number, y: number, def: TowerDef, hotkey: string,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(51);

    const bg = this.add.rectangle(0, 0, 80, 76, 0x2a2a4a);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    // Small icon representing the tower type
    const icon = this.add.graphics();
    const iconY = -20;
    icon.fillStyle(def.color, 1);
    const iconPts = (coords: number[]): { x: number; y: number }[] => {
      const result: { x: number; y: number }[] = [];
      for (let i = 0; i < coords.length; i += 2) {
        result.push({ x: coords[i], y: iconY + coords[i + 1] });
      }
      return result;
    };
    switch (def.id) {
      case 'arrow':
        icon.fillPoints(iconPts([0, -9, 9, 0, 0, 9, -9, 0]), true);
        break;
      case 'cannon': {
        const oct: number[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          oct.push(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        icon.fillPoints(iconPts(oct), true);
        break;
      }
      case 'ice': {
        const r = 9;
        const h = r * Math.sin(Math.PI / 3);
        const half = r * 0.5;
        icon.fillTriangle(0, iconY - r, h, iconY + half, -h, iconY + half);
        icon.fillTriangle(0, iconY + r, h, iconY - half, -h, iconY - half);
        break;
      }
      case 'fire': {
        const pent: number[] = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          pent.push(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        icon.fillPoints(iconPts(pent), true);
        break;
      }
      case 'sniper':
        icon.fillPoints(iconPts([0, -10, 5, 0, 0, 10, -5, 0]), true);
        break;
      case 'lightning': {
        const hex: number[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          hex.push(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        icon.fillPoints(iconPts(hex), true);
        break;
      }
      case 'poison': {
        const star: number[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r2 = i % 2 === 0 ? 9 : 4;
          star.push(Math.cos(a) * r2, Math.sin(a) * r2);
        }
        icon.fillPoints(iconPts(star), true);
        break;
      }
      case 'wall':
        icon.fillRect(-9, iconY - 9, 18, 18);
        break;
    }

    const label = def.name.replace(' Tower', '');
    const nameText = this.add.text(0, 2, label, {
      fontSize: '12px',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
      color: '#dddddd',
    });
    nameText.setOrigin(0.5);

    const costText = this.add.text(0, 17, `${def.cost}g`, {
      fontSize: '12px',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
      color: COLORS.ui.gold,
    });
    costText.setOrigin(0.5);

    const hotkeyText = this.add.text(30, -30, hotkey, {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#666688',
    });
    hotkeyText.setOrigin(0.5);

    container.add([bg, icon, nameText, costText, hotkeyText]);

    bg.on('pointerdown', () => this.selectTowerDef(def.id));
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3a3a5a);
      showInfoPanel(this.panelRefs, def);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(this.selectedTowerDef?.id === def.id ? 0x3a3a5a : 0x2a2a4a);
      clearInfoPanel(this.panelRefs, this.waveManager, this, this.infoPanelX);
    });

    return container;
  }

  private createButton(
    x: number, y: number, width: number, height: number,
    label: string, color: number, onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(51);

    const bg = this.add.rectangle(0, 0, width, height, color);
    bg.setStrokeStyle(2, 0x222222);
    bg.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    container.add([bg, text]);

    bg.on('pointerdown', onClick);
    bg.on('pointerover', () => {
      const r = Math.min(0xff, ((color >> 16) & 0xff) + 0x22);
      const g = Math.min(0xff, ((color >>  8) & 0xff) + 0x22);
      const b = Math.min(0xff, ( color        & 0xff) + 0x22);
      bg.setFillStyle((r << 16) | (g << 8) | b);
    });
    bg.on('pointerout', () => bg.setFillStyle(color));

    return container;
  }

  private createMuteButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(51);

    const bg = this.add.rectangle(0, 0, 80, 28, 0x2a2a4a);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    const label = () => isMuted() ? 'SFX: OFF' : 'SFX: ON';
    const text = this.add.text(0, 0, label(), {
      fontSize: '12px',
      color: '#dddddd',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    container.add([bg, text]);

    bg.on('pointerdown', () => {
      toggleMute();
      text.setText(label());
      bg.setFillStyle(isMuted() ? 0x1a1a2e : 0x2a2a4a);
    });
    bg.on('pointerover', () => bg.setFillStyle(isMuted() ? 0x1a1a2e : 0x3a3a5a));
    bg.on('pointerout', () => bg.setFillStyle(isMuted() ? 0x1a1a2e : 0x2a2a4a));

    return container;
  }

  private createSpeedButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(51);

    const bg = this.add.rectangle(0, 0, 80, 28, 0x2a2a4a);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    this.speedButtonText = this.add.text(0, 0, '1×', {
      fontSize: '12px',
      color: '#dddddd',
      fontStyle: 'bold',
    });
    this.speedButtonText.setOrigin(0.5);

    container.add([bg, this.speedButtonText]);

    bg.on('pointerdown', () => this.toggleSpeed());
    bg.on('pointerover', () => bg.setFillStyle(this.gameSpeed === 2 ? 0x1a3a6a : 0x3a3a5a));
    bg.on('pointerout', () => bg.setFillStyle(this.gameSpeed === 2 ? 0x1a3a5a : 0x2a2a4a));

    return container;
  }

  private togglePause(): void {
    if (this.gameOver || this.gameWon) return;
    this.paused = !this.paused;
    if (this.paused) {
      const mapH = MAP_ROWS * TILE_SIZE;
      this.pauseOverlay = this.add.text(GAME_WIDTH / 2, mapH / 2, 'PAUSED', {
        fontSize: '64px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      });
      this.pauseOverlay.setOrigin(0.5);
      this.pauseOverlay.setDepth(100);
    } else {
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
    }
  }

  private toggleSpeed(): void {
    if (this.gameOver || this.gameWon) return;
    this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
    this.speedButtonText.setText(this.gameSpeed === 1 ? '1×' : '2×');
    const bg = this.speedButton.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(this.gameSpeed === 2 ? 0x1a3a5a : 0x2a2a4a);
  }

  // UI updates

  private updateUI(): void {
    this.goldText.setText(`Gold: ${this.gold}`);
    this.livesText.setText(`Lives: ${this.lives}`);
    this.waveText.setText(
      `Wave: ${this.waveManager.currentWave + (this.waveManager.waveInProgress ? 1 : 0)}` +
      ` / ${this.waveManager.getTotalWaves()}`,
    );

    const idleText = this.isOpenField
      ? 'Build a maze — enemies pathfind through your towers  (1–8)'
      : 'Select a tower (1–7) then click the map to place it';
    const status = this.selectedTowerDef
      ? `Placing: ${this.selectedTowerDef.name} (${this.selectedTowerDef.cost}g) — Click to place, Esc to cancel`
      : this.waveManager.waveInProgress
        ? `Wave in progress — ${this.waveManager.getWaveProgress()}`
        : idleText;
    this.statusText.setText(status);
  }

  // Input handling

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.hoverGraphics.clear();

    if (!this.selectedTowerDef) return;
    if (pointer.y >= MAP_ROWS * TILE_SIZE) return;

    const tile = pixelToTile(pointer.x, pointer.y);
    if (tile.x < 0 || tile.x >= MAP_COLS || tile.y < 0 || tile.y >= MAP_ROWS) return;

    const canBuild = this.canBuildAt(tile.x, tile.y);
    const color = canBuild ? COLORS.buildableHover : COLORS.invalidHover;

    this.hoverGraphics.fillStyle(color, 0.4);
    this.hoverGraphics.fillRect(
      tile.x * TILE_SIZE, tile.y * TILE_SIZE,
      TILE_SIZE, TILE_SIZE,
    );

    if (canBuild && this.selectedTowerDef) {
      const center = tileToPixel(tile.x, tile.y);
      const range = this.selectedTowerDef.levels[0].range;
      this.hoverGraphics.fillStyle(0xffffff, 0.05);
      this.hoverGraphics.fillCircle(center.x, center.y, range);
      drawDashedCircle(this.hoverGraphics, center.x, center.y, range, 0xffffff, 0.45);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.y < MAP_ROWS * TILE_SIZE) {
      if (this.selectedTowerDef) {
        this.tryPlaceTower(pointer);
      } else {
        this.trySelectTower(pointer);
      }
    }
  }

  private trySelectTower(pointer: Phaser.Input.Pointer): void {
    const tile = pixelToTile(pointer.x, pointer.y);
    const tower = this.towers.find((t) => t.tileX === tile.x && t.tileY === tile.y);

    this.clearTowerSelection();

    if (tower) {
      this.selectedTower = tower;
      tower.showRange();
      showTowerInfo(this, this.panelRefs, tower, this.buildTowerInfoCallbacks());
    }
  }

  private convertWallToTower(wall: Tower, defId: string): void {
    const def = TOWER_DEFS[defId];
    if (this.gold < def.cost) return;

    this.gold -= def.cost;
    clearTowerInfo(this.panelRefs);
    this.selectedTower = null;

    const { tileX, tileY } = wall;
    const idx = this.towers.indexOf(wall);
    if (idx !== -1) this.towers.splice(idx, 1);
    wall.destroy();

    const center = tileToPixel(tileX, tileY);
    const newTower = new Tower(this, center.x, center.y, tileX, tileY, defId);

    newTower.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.selectedTower === newTower && newTower.def.id !== 'poison' && newTower.def.id !== 'wall') {
          newTower.cycleTargetMode();
          clearTowerInfo(this.panelRefs);
          showTowerInfo(this, this.panelRefs, newTower, this.buildTowerInfoCallbacks());
        }
        pointer.event.stopPropagation();
      } else if (!this.selectedTowerDef) {
        pointer.event.stopPropagation();
        this.clearTowerSelection();
        this.selectedTower = newTower;
        newTower.showRange();
        showTowerInfo(this, this.panelRefs, newTower, this.buildTowerInfoCallbacks());
      }
    });

    this.towers.push(newTower);

    // Pop-in tween — same as tryPlaceTower
    newTower.sprite.setScale(0.4);
    newTower.inner.setScale(0.4);
    this.tweens.add({
      targets: [newTower.sprite, newTower.inner],
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  private clearTowerSelection(): void {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
      this.selectedTower = null;
    }
    clearTowerInfo(this.panelRefs);
  }

  // Tower placement

  private selectTowerDef(towerId: string): void {
    this.clearTowerSelection();
    const def = TOWER_DEFS[towerId];
    if (!def) return;

    if (this.selectedTowerDef?.id === towerId) {
      this.selectedTowerDef = null;
    } else {
      this.selectedTowerDef = def;
    }
  }

  private deselectAll(): void {
    this.selectedTowerDef = null;
    this.clearTowerSelection();
    this.hoverGraphics.clear();
  }

  private canBuildAt(tileX: number, tileY: number): boolean {
    if (tileY < 0 || tileY >= MAP_ROWS || tileX < 0 || tileX >= MAP_COLS) return false;
    if (this.mapDef.grid[tileY][tileX] !== 0) return false;
    if (this.towers.some((t) => t.tileX === tileX && t.tileY === tileY)) return false;
    if (this.isOpenField) {
      this.pathGrid[tileY][tileX] = 0;
      const testPath = findPath(this.pathGrid, this.mapDef.start, this.mapDef.end);
      this.pathGrid[tileY][tileX] = 1;
      if (testPath.length === 0) return false;
    }
    return true;
  }

  private tryPlaceTower(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedTowerDef) return;

    const tile = pixelToTile(pointer.x, pointer.y);
    if (!this.canBuildAt(tile.x, tile.y)) return;

    if (this.gold < this.selectedTowerDef.cost) {
      showFloatingText(this, pointer.x, pointer.y, 'Not enough gold!', '#ff4444');
      return;
    }

    this.gold -= this.selectedTowerDef.cost;
    const center = tileToPixel(tile.x, tile.y);
    const tower = new Tower(
      this, center.x, center.y,
      tile.x, tile.y, this.selectedTowerDef.id,
    );

    tower.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (this.selectedTower === tower && tower.def.id !== 'poison' && tower.def.id !== 'wall') {
          tower.cycleTargetMode();
          clearTowerInfo(this.panelRefs);
          showTowerInfo(this, this.panelRefs, tower, this.buildTowerInfoCallbacks());
        }
        pointer.event.stopPropagation();
      } else if (!this.selectedTowerDef) {
        pointer.event.stopPropagation();
        this.clearTowerSelection();
        this.selectedTower = tower;
        tower.showRange();
        showTowerInfo(this, this.panelRefs, tower, this.buildTowerInfoCallbacks());
      }
    });

    this.towers.push(tower);

    if (this.isOpenField) {
      this.pathGrid[tile.y][tile.x] = 0;
      const newWaypoints = findPath(this.pathGrid, this.mapDef.start, this.mapDef.end);
      this.waypoints = newWaypoints;
      this.waveManager.updateWaypoints(newWaypoints);
      for (const enemy of this.enemies) {
        if (enemy.alive) enemy.repath(newWaypoints);
      }
    }

    // Pop-in tween — starts small and eases to full size with a slight overshoot
    tower.sprite.setScale(0.4);
    tower.inner.setScale(0.4);
    this.tweens.add({
      targets: [tower.sprite, tower.inner],
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    showFloatingText(
      this,
      center.x, center.y - 20,
      `-${this.selectedTowerDef.cost}g`,
      COLORS.ui.gold,
    );
  }

  // Wave management

  private startWave(): void {
    if (this.waveManager.waveInProgress) return;
    if (this.waveManager.allWavesComplete) return;
    const waveNumber = this.waveManager.currentWave + 1;
    sfxWaveStart();
    this.waveManager.startNextWave();
    showWaveBanner(this, waveNumber);
    this.panelRefs.text.setText('');
    this.panelRefs.graphics.clear();
  }

  private onWaveComplete(reward: number): void {
    this.gold += reward;
    showFloatingText(
      this,
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `Wave Complete! +${reward}g`,
      COLORS.ui.gold,
    );
    showWavePreview(this, this.panelRefs, this.waveManager, this.infoPanelX);
  }

  // Game end

  private endGame(won: boolean): void {
    if (won) { this.gameWon = true; sfxVictory(); } else { this.gameOver = true; sfxDefeat(); }

    const wavesCompleted = this.waveManager.currentWave;
    const score = computeScore({
      killCount: this.killCount,
      wavesCompleted,
      livesRemaining: this.lives,
      won,
      difficulty: this.difficultyKey,
    });

    const entry: LeaderboardEntry = {
      score,
      difficulty: this.difficultyKey,
      mapId: this.mapId,
      won,
      wavesCompleted,
      killCount: this.killCount,
      livesRemaining: this.lives,
      timestamp: Date.now(),
    };

    const { entries, rank } = addLeaderboardEntry(entry);
    showEndScreen(this, {
      message: won ? 'VICTORY!' : 'GAME OVER',
      color: won ? '#4caf50' : '#ff4444',
      score,
      rank,
      topEntries: entries,
      totalWaves: this.waveManager.getTotalWaves(),
      onRestart: () => this.scene.restart({ difficulty: this.difficultyKey, mapId: this.mapId }),
    });
  }

  // Builds the callback object passed to infoPanel functions; called fresh at each show/refresh.
  private buildTowerInfoCallbacks(): TowerInfoCallbacks {
    return {
      getGold: () => this.gold,
      onUpgrade: (tower, cost) => {
        this.gold -= cost;
        tower.upgrade();
        clearTowerInfo(this.panelRefs);
        showTowerInfo(this, this.panelRefs, tower, this.buildTowerInfoCallbacks());
      },
      onSell: (tower, sellValue) => {
        this.gold += sellValue;
        const idx = this.towers.indexOf(tower);
        if (idx !== -1) this.towers.splice(idx, 1);
        if (this.isOpenField) {
          this.pathGrid[tower.tileY][tower.tileX] = 1;
          const newWaypoints = findPath(this.pathGrid, this.mapDef.start, this.mapDef.end);
          this.waypoints = newWaypoints;
          this.waveManager.updateWaypoints(newWaypoints);
          for (const enemy of this.enemies) {
            if (enemy.alive) enemy.repath(newWaypoints);
          }
        }
        this.clearTowerSelection();
        tower.startSellAnimation(() => tower.destroy());
      },
      onConvert: (wall, defId) => this.convertWallToTower(wall, defId),
      onRefresh: (tower) => {
        clearTowerInfo(this.panelRefs);
        showTowerInfo(this, this.panelRefs, tower, this.buildTowerInfoCallbacks());
      },
      createButton: (x, y, w, h, label, color, onClick) =>
        this.createButton(x, y, w, h, label, color, onClick),
      infoPanelX: this.infoPanelX,
    };
  }
}
