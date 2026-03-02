import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, GAME_WIDTH, GAME_HEIGHT, UI_HEIGHT,
  COLORS, STARTING_GOLD, STARTING_LIVES,
  TOWER_DEFS, TowerDef,
  DIFFICULTY_SETTINGS, DifficultyKey, ENEMY_DEFS, EnemyDef,
  WAVE_DEFS,
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

// Right-side panel start x (leaves room for 7 tower buttons at 90px spacing starting at 155)
const INFO_PANEL_X = 745;

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
  private infoPanelText!: Phaser.GameObjects.Text;
  private infoPanelGraphics!: Phaser.GameObjects.Graphics;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private startWaveButton!: Phaser.GameObjects.Container;
  private upgradeButton: Phaser.GameObjects.Container | null = null;
  private sellButton: Phaser.GameObjects.Container | null = null;
  private targetModeButton: Phaser.GameObjects.Container | null = null;
  private towerNameText: Phaser.GameObjects.Text | null = null;
  private selectedTower: Tower | null = null;

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
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedTowerDef = null;
    this.selectedTower = null;
    this.upgradeButton = null;
    this.sellButton = null;
    this.targetModeButton = null;
    this.towerNameText = null;
    this.towerButtons = [];
  }

  create(): void {
    const diff = DIFFICULTY_SETTINGS[this.difficultyKey];
    this.gold = Math.round(STARTING_GOLD * diff.startingGoldMult);
    this.lives = Math.round(STARTING_LIVES * diff.startingLivesMult);

    // Cell size = 2 tiles; balances bucket count vs enemies-per-bucket at typical wave sizes
    this.spatialHash = new SpatialHash<Enemy>(TILE_SIZE * 2, (e) => ({ x: e.sprite.x, y: e.sprite.y }));

    this.drawMap();
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
    this.showWavePreview();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(pointer);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const towerKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
      const towerIds = ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison', 'wall'];
      const idx = towerKeys.indexOf(event.key);
      if (idx !== -1) this.selectTowerDef(towerIds[idx]);
      if (event.key === 'Escape') this.deselectAll();
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.gameWon) return;

    this.waveManager.update(delta);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(delta);

      if (!enemy.alive) {
        if (enemy.reachedEnd) {
          this.lives--;
          this.flashVignette();
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
      const projectile = tower.update(delta, nearby);
      if (projectile) {
        projectile.onDamageDealt = (x, y, dmg, label) => {
          const offsetX = (Math.random() - 0.5) * 16;
          if (label) {
            this.showFloatingText(x + offsetX, y - 10, label, '#aaaaaa', '11px', 700);
          } else {
            this.showFloatingText(x + offsetX, y - 10, String(dmg), '#ffffff', '12px', 800);
          }
        };
        this.projectiles.push(projectile);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(delta, this.enemies);

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

  // Map rendering

  private drawMap(): void {
    const grid = this.mapDef.grid;

    const detailsG = this.add.graphics();
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

        const rect = this.add.rectangle(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          color,
        );
        rect.setDepth(0);

        if (tile === 1) {
          rect.setStrokeStyle(1, COLORS.pathBorder, 0.4);
        }

        // Subtle grass detail marks — deterministic from tile position
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

    this.createMapIndicators();
  }

  private createMapIndicators(): void {
    if (this.waypoints.length < 2) return;

    const spawnWp = this.waypoints[0];
    const exitWp  = this.waypoints[this.waypoints.length - 1];

    const spawnAngle = this.edgeAngle(spawnWp.x, spawnWp.y);
    const exitAngle  = this.edgeAngle(exitWp.x,  exitWp.y);

    const spawnPos = tileToPixel(spawnWp.x, spawnWp.y);
    const exitPos  = tileToPixel(exitWp.x,  exitWp.y);

    const makeIndicator = (cx: number, cy: number, angle: number, color: number): void => {
      const g = this.add.graphics();
      g.setDepth(2);
      g.fillStyle(color, 0.9);
      g.fillTriangle(13, 0, -5, -8, -5, 8);
      g.setPosition(cx, cy);
      g.setRotation(angle);
      this.tweens.add({
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

  // Returns the angle (radians) pointing inward from whichever map edge a tile sits on.
  private edgeAngle(col: number, row: number): number {
    if (col === 0)           return 0;          // left edge  → point right
    if (col === MAP_COLS - 1) return Math.PI;   // right edge → point left
    if (row === 0)           return Math.PI / 2; // top edge   → point down
    return -Math.PI / 2;                         // bottom edge → point up
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
    infoDivider.lineBetween(INFO_PANEL_X, uiY + 52, INFO_PANEL_X, uiY + 132);
    infoDivider.setDepth(51);

    // Info panel background (right side of row 2)
    const infoPanelCenterX = (INFO_PANEL_X + GAME_WIDTH) / 2;
    const infoPanelWidth = GAME_WIDTH - INFO_PANEL_X - 4;
    const infoPanelBg = this.add.rectangle(
      infoPanelCenterX, uiY + 92,
      infoPanelWidth, 76,
      0x0d0d1e,
    );
    infoPanelBg.setStrokeStyle(1, 0x252545);
    infoPanelBg.setDepth(51);

    this.infoPanelText = this.add.text(INFO_PANEL_X + 8, uiY + 56, '', {
      fontSize: '11px',
      color: COLORS.ui.text,
      lineSpacing: 3,
    });
    this.infoPanelText.setDepth(52);

    this.infoPanelGraphics = this.add.graphics();
    this.infoPanelGraphics.setDepth(53);

    const towerIds = ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison', 'wall'];
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
    switch (def.id) {
      case 'arrow':
        icon.fillTriangle(-9, iconY + 10, 9, iconY + 10, 0, iconY - 10);
        break;
      case 'cannon':
        icon.fillCircle(0, iconY, 10);
        break;
      case 'ice':
        icon.fillTriangle(0, iconY - 11, 10, iconY + 1, 0, iconY + 11);
        icon.fillTriangle(0, iconY - 11, -10, iconY + 1, 0, iconY + 11);
        break;
      case 'fire':
        icon.fillTriangle(-8, iconY + 10, 8, iconY + 10, 0, iconY - 10);
        icon.fillStyle(0xffcc55, 1);
        icon.fillTriangle(-4, iconY + 5, 4, iconY + 5, 0, iconY - 3);
        break;
      case 'sniper':
        icon.fillTriangle(-4, iconY + 12, 4, iconY + 12, 0, iconY - 12);
        break;
      case 'lightning':
        icon.lineStyle(3, def.color, 1);
        icon.beginPath();
        icon.moveTo(5, iconY - 11);
        icon.lineTo(-3, iconY);
        icon.lineTo(5, iconY);
        icon.lineTo(-5, iconY + 11);
        icon.strokePath();
        break;
      case 'poison':
        icon.fillCircle(0, iconY, 9);
        icon.fillStyle(0x44aa22, 1);
        icon.fillCircle(0, iconY - 13, 4);
        icon.fillCircle(11, iconY + 7, 3);
        icon.fillCircle(-11, iconY + 7, 3);
        break;
      case 'wall':
        icon.fillStyle(def.color, 1);
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
      this.showInfoPanel(def);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(this.selectedTowerDef?.id === def.id ? 0x3a3a5a : 0x2a2a4a);
      this.clearInfoPanel();
    });

    return container;
  }

  private showInfoPanel(def: TowerDef): void {
    this.infoPanelGraphics.clear();
    const stats = def.levels[0];
    const isPoisonAura = def.id === 'poison';

    const line2 = isPoisonAura
      ? `DOT: ${stats.damage}/s  Rate: ${stats.fireRate}/s`
      : `Dmg: ${stats.damage}  Rate: ${stats.fireRate}/s`;

    const line3 = isPoisonAura
      ? `Range: ${stats.range}`
      : `Range: ${stats.range}  DPS: ${(stats.damage * stats.fireRate).toFixed(1)}`;

    const detail = def.special ?? def.description;

    this.infoPanelText.setText(
      `${def.name}  ${def.cost}g\n${line2}\n${line3}\n${detail}`,
    );
  }

  private showWavePreview(): void {
    this.infoPanelGraphics.clear();

    const nextWaveIdx = this.waveManager.currentWave;
    if (nextWaveIdx >= WAVE_DEFS.length) {
      this.infoPanelText.setText('');
      return;
    }

    const waveDef = WAVE_DEFS[nextWaveIdx];
    const totalEnemies = waveDef.groups.reduce((sum, g) => sum + g.count, 0);
    const uiY = MAP_ROWS * TILE_SIZE;
    // Approximate line height for 11px font + 3px lineSpacing
    const lineH = 16;
    const circleX = INFO_PANEL_X + 11;
    const firstGroupY = uiY + 56 + lineH; // one line below the header

    const textLines = [`Wave ${nextWaveIdx + 1}  ·  ${totalEnemies} enemies`];

    waveDef.groups.forEach((group, i) => {
      const enemyDef = ENEMY_DEFS[group.enemyType];
      if (!enemyDef) return;
      const circleY = firstGroupY + i * lineH + Math.floor(lineH / 2) - 2;
      this.infoPanelGraphics.fillStyle(enemyDef.color, 1);
      this.infoPanelGraphics.fillCircle(circleX, circleY, 4);
      textLines.push(`      ×${group.count}  ${enemyDef.name}`);
    });

    this.infoPanelText.setText(textLines.join('\n'));
  }

  private clearInfoPanel(): void {
    if (!this.waveManager.waveInProgress && !this.waveManager.allWavesComplete) {
      this.showWavePreview();
    } else {
      this.infoPanelText.setText('');
      this.infoPanelGraphics.clear();
    }
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
      : 'Select a tower (1–8) then click the map to place it';
    const status = this.selectedTowerDef
      ? `Placing: ${this.selectedTowerDef.name} (${this.selectedTowerDef.cost}g) — Click to place, Esc to cancel`
      : this.waveManager.waveInProgress
        ? `Wave in progress — ${this.waveManager.getWaveProgress()}`
        : idleText;
    this.statusText.setText(status);
  }

  // Input handling

  private drawDashedCircle(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, radius: number,
    color: number, alpha: number,
  ): void {
    const dashArc = Math.PI / 12;  // 15° dash
    const gapArc  = Math.PI / 18;  // 10° gap
    const step = dashArc + gapArc;
    g.lineStyle(1, color, alpha);
    for (let a = 0; a < Math.PI * 2; a += step) {
      g.beginPath();
      g.arc(cx, cy, radius, a, Math.min(a + dashArc, Math.PI * 2));
      g.strokePath();
    }
  }

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
      this.drawDashedCircle(this.hoverGraphics, center.x, center.y, range, 0xffffff, 0.45);
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
      this.showTowerInfo(tower);
    }
  }

  private showTowerInfo(tower: Tower): void {
    this.clearTowerInfo();

    const uiY = MAP_ROWS * TILE_SIZE;
    const x = GAME_WIDTH - 80;
    const panelCenterX = (INFO_PANEL_X + GAME_WIDTH) / 2;

    // Tower name header — identifies which tower is selected
    const colorHex = `#${tower.def.color.toString(16).padStart(6, '0')}`;
    this.towerNameText = this.add.text(panelCenterX, uiY + 58, tower.def.name, {
      fontSize: '12px',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
      color: colorHex,
    });
    this.towerNameText.setOrigin(0.5, 0.5);
    this.towerNameText.setDepth(52);

    // Targeting mode toggle (not shown for poison or wall — neither fires projectiles)
    if (tower.def.id !== 'poison' && tower.def.id !== 'wall') {
      const modeLabel = tower.targetMode.charAt(0).toUpperCase() + tower.targetMode.slice(1);
      this.targetModeButton = this.createButton(
        x, uiY + 75, 130, 20,
        `Target: ${modeLabel}`,
        0x1a1a3a,
        () => {
          tower.cycleTargetMode();
          this.clearTowerInfo();
          this.showTowerInfo(tower);
        },
      );
    }

    if (tower.canUpgrade()) {
      const cost = tower.getUpgradeCost();
      this.upgradeButton = this.createButton(
        x, uiY + 98, 130, 24,
        `Upgrade (${cost}g)`,
        this.gold >= cost ? 0x2196f3 : 0x555555,
        () => {
          if (this.gold >= cost) {
            this.gold -= cost;
            tower.upgrade();
            this.clearTowerInfo();
            this.showTowerInfo(tower);
          }
        },
      );
    }

    const sellValue = Math.floor(tower.def.cost * 0.6);
    this.sellButton = this.createButton(
      x, uiY + 120, 130, 20,
      `Sell (${sellValue}g)`,
      0x666666,
      () => {
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
    );
  }

  private clearTowerInfo(): void {
    this.upgradeButton?.destroy();
    this.upgradeButton = null;
    this.sellButton?.destroy();
    this.sellButton = null;
    this.targetModeButton?.destroy();
    this.targetModeButton = null;
    this.towerNameText?.destroy();
    this.towerNameText = null;
  }

  private clearTowerSelection(): void {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
      this.selectedTower = null;
    }
    this.clearTowerInfo();
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
      this.showFloatingText(pointer.x, pointer.y, 'Not enough gold!', '#ff4444');
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
          this.clearTowerInfo();
          this.showTowerInfo(tower);
        }
        pointer.event.stopPropagation();
      } else if (!this.selectedTowerDef) {
        pointer.event.stopPropagation();
        this.clearTowerSelection();
        this.selectedTower = tower;
        tower.showRange();
        this.showTowerInfo(tower);
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

    this.showFloatingText(
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
    this.waveManager.startNextWave();
    this.showWaveBanner(waveNumber);
    this.infoPanelText.setText('');
    this.infoPanelGraphics.clear();
  }

  private showWaveBanner(waveNumber: number): void {
    const mapH = MAP_ROWS * TILE_SIZE;
    const banner = this.add.text(GAME_WIDTH / 2, mapH / 2, `Wave ${waveNumber}`, {
      fontSize: '52px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    banner.setOrigin(0.5);
    banner.setDepth(100);
    banner.setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
      hold: 600,
      onComplete: () => banner.destroy(),
    });
  }

  private onWaveComplete(reward: number): void {
    this.gold += reward;
    this.showFloatingText(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `Wave Complete! +${reward}g`,
      COLORS.ui.gold,
    );
    this.showWavePreview();
  }

  // Game end

  private endGame(won: boolean): void {
    if (won) { this.gameWon = true; } else { this.gameOver = true; }

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
    this.showEndScreen(won ? 'VICTORY!' : 'GAME OVER', won ? '#4caf50' : '#ff4444', score, rank, entries);
  }

  private showEndScreen(
    message: string,
    color: string,
    score: number,
    rank: number,
    topEntries: LeaderboardEntry[],
  ): void {
    const mapH = MAP_ROWS * TILE_SIZE;
    const cx = GAME_WIDTH / 2;
    const midY = mapH / 2;

    const blackout = this.add.rectangle(cx, midY, GAME_WIDTH, mapH, 0x000000);
    blackout.setDepth(99);
    this.tweens.add({
      targets: blackout,
      alpha: 0,
      duration: 600,
      delay: 100,
      ease: 'Power2',
      onComplete: () => blackout.destroy(),
    });

    const overlay = this.add.rectangle(cx, midY, GAME_WIDTH, mapH, 0x000000, 0.6);
    overlay.setDepth(100);

    // Main message
    this.add.text(cx, midY - 80, message, {
      fontSize: '48px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    // Score
    this.add.text(cx, midY - 28, `Score: ${score.toLocaleString()}`, {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    // Rank badge
    if (rank > 0) {
      this.add.text(cx, midY - 4, `#${rank} of all time!`, {
        fontSize: '14px', color: COLORS.ui.gold,
      }).setOrigin(0.5).setDepth(101);
    }

    // Leaderboard header
    this.add.text(cx, midY + 20, '— Top Scores —', {
      fontSize: '11px', color: '#888888',
    }).setOrigin(0.5).setDepth(101);

    // Top entries (up to 5)
    const totalWaves = this.waveManager.getTotalWaves();
    const diffLabels: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
    topEntries.slice(0, 5).forEach((e, i) => {
      const label = `#${i + 1}  ${diffLabels[e.difficulty]}  ${e.wavesCompleted}/${totalWaves}  ${e.won ? '✓' : '✗'}  ${e.score.toLocaleString()}`;
      this.add.text(cx, midY + 36 + i * 16, label, {
        fontSize: '11px', color: '#cccccc',
      }).setOrigin(0.5).setDepth(101);
    });

    // Play Again button, shifted down to clear the leaderboard rows
    const restartBtn = this.createButton(
      cx, midY + 140,
      160, 40, 'Play Again', 0x4caf50,
      () => this.scene.restart({ difficulty: this.difficultyKey, mapId: this.mapId }),
    );
    restartBtn.setDepth(101);
  }

  // Visual feedback

  private flashVignette(): void {
    const mapH = MAP_ROWS * TILE_SIZE;
    const vignette = this.add.rectangle(GAME_WIDTH / 2, mapH / 2, GAME_WIDTH, mapH, 0xff0000, 0.28);
    vignette.setDepth(99);
    this.tweens.add({
      targets: vignette,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => vignette.destroy(),
    });
  }

  private showFloatingText(
    x: number,
    y: number,
    message: string,
    color: string,
    fontSize: string = '14px',
    duration: number = 1200,
  ): void {
    const text = this.add.text(x, y, message, {
      fontSize,
      color,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(30);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
