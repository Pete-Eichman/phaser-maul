import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, GAME_WIDTH, GAME_HEIGHT,
  MAP_DATA, COLORS, STARTING_GOLD, STARTING_LIVES,
  TOWER_DEFS, TowerDef, PATH_WAYPOINTS,
} from '@/config/gameConfig';
import { Tower } from '@/entities/Tower';
import { Enemy } from '@/entities/Enemy';
import { Projectile } from '@/entities/Projectile';
import { WaveManager } from '@/systems/WaveManager';
import { tileToPixel, pixelToTile } from '@/utils/helpers';

// UI panel height below the game map
const UI_HEIGHT = 136;

export class GameScene extends Phaser.Scene {
  // Game state
  private gold: number = STARTING_GOLD;
  private lives: number = STARTING_LIVES;
  private gameOver: boolean = false;
  private gameWon: boolean = false;

  // Entities
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];

  // Systems
  private waveManager!: WaveManager;

  // UI
  private selectedTowerDef: TowerDef | null = null;
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private startWaveButton!: Phaser.GameObjects.Container;
  private selectedTowerInfo: Phaser.GameObjects.Container | null = null;
  private upgradeButton: Phaser.GameObjects.Container | null = null;
  private sellButton: Phaser.GameObjects.Container | null = null;
  private selectedTower: Tower | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Draw the tile map
    this.drawMap();

    // Hover indicator for tower placement
    this.hoverGraphics = this.add.graphics();
    this.hoverGraphics.setDepth(20);

    // Initialize wave manager
    this.waveManager = new WaveManager(
      this,
      (enemy) => this.enemies.push(enemy),
      (reward) => this.onWaveComplete(reward)
    );

    // Create UI
    this.createUI();

    // Input: tower placement
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(pointer);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });

    // Keyboard shortcut: press 1-7 to select tower, Escape to deselect
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const towerKeys = ['1', '2', '3', '4', '5', '6', '7'];
      const towerIds = ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison'];
      const idx = towerKeys.indexOf(event.key);
      if (idx !== -1) {
        this.selectTowerDef(towerIds[idx]);
      }
      if (event.key === 'Escape') {
        this.deselectAll();
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.gameWon) return;

    // Update wave spawning
    this.waveManager.update(delta);

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(delta);

      if (!enemy.alive) {
        if (enemy.reachedEnd) {
          this.lives--;
          this.waveManager.onEnemyReachedEnd();
        } else {
          // Killed — give gold
          this.gold += enemy.reward;
          this.waveManager.onEnemyDied();
        }
        enemy.destroy();
        this.enemies.splice(i, 1);

        if (this.lives <= 0) {
          this.endGame(false);
          return;
        }
      }
    }

    // Update towers — fire at enemies
    for (const tower of this.towers) {
      const projectile = tower.update(delta, this.enemies);
      if (projectile) {
        this.projectiles.push(projectile);
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(delta, this.enemies);

      if (!proj.alive) {
        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }

    // Check win condition
    if (this.waveManager.allWavesComplete && this.enemies.length === 0) {
      this.endGame(true);
    }

    // Update UI text
    this.updateUI();
  }

  // ============================================================
  // MAP RENDERING
  // ============================================================

  private drawMap(): void {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = MAP_DATA[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        let color: number;
        if (tile === 1) {
          color = COLORS.path;
        } else if (tile === 2) {
          color = COLORS.path; // Spawn/exit zones look like path
        } else {
          // Checkerboard grass for visual variety
          color = (row + col) % 2 === 0 ? COLORS.grass : COLORS.grassAlt;
        }

        const rect = this.add.rectangle(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          color
        );
        rect.setDepth(0);

        // Path border effect
        if (tile === 1) {
          rect.setStrokeStyle(1, COLORS.pathBorder, 0.4);
        }
      }
    }

    // Draw spawn/exit markers
    const spawn = tileToPixel(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
    const exit = tileToPixel(
      PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].x,
      PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].y
    );

    const spawnLabel = this.add.text(spawn.x, spawn.y - 20, 'SPAWN', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    spawnLabel.setOrigin(0.5);
    spawnLabel.setDepth(2);

    const exitLabel = this.add.text(exit.x, exit.y + 20, 'EXIT', {
      fontSize: '11px',
      color: '#ff4444',
      fontStyle: 'bold',
    });
    exitLabel.setOrigin(0.5);
    exitLabel.setDepth(2);
  }

  // ============================================================
  // UI CREATION
  // ============================================================

  private createUI(): void {
    const uiY = MAP_ROWS * TILE_SIZE;

    // UI background panel
    const uiBg = this.add.rectangle(
      GAME_WIDTH / 2, uiY + UI_HEIGHT / 2,
      GAME_WIDTH, UI_HEIGHT,
      COLORS.ui.panel
    );
    uiBg.setDepth(50);
    uiBg.setStrokeStyle(2, 0x333333);

    // Row 1: stats inline across the left, Start Wave on the right
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

    // Divider between rows
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x333355, 1);
    divider.lineBetween(0, uiY + 48, GAME_WIDTH, uiY + 48);
    divider.setDepth(50);

    // Row 2: tower selection buttons
    const towerIds = ['arrow', 'cannon', 'ice', 'fire', 'sniper', 'lightning', 'poison'];
    const startX = 155;
    towerIds.forEach((id, i) => {
      const def = TOWER_DEFS[id];
      const btnX = startX + i * 90;
      const btn = this.createTowerButton(btnX, uiY + 92, def, `${i + 1}`);
      this.towerButtons.push(btn);
    });

    // Start Wave button (row 1, right side)
    this.startWaveButton = this.createButton(
      GAME_WIDTH - 80, uiY + 24, 130, 36,
      'Start Wave', 0x4caf50,
      () => this.startWave()
    );
  }

  private createTowerButton(
    x: number, y: number, def: TowerDef, hotkey: string
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(51);

    // Background
    const bg = this.add.rectangle(0, 0, 80, 76, 0x2a2a4a);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    // Tower color swatch
    const swatch = this.add.rectangle(0, -18, 20, 20, def.color);
    swatch.setStrokeStyle(1, 0x222222);

    // Name
    const nameText = this.add.text(0, 0, def.name, {
      fontSize: '10px',
      color: '#cccccc',
    });
    nameText.setOrigin(0.5);

    // Cost
    const costText = this.add.text(0, 14, `${def.cost}g`, {
      fontSize: '11px',
      color: COLORS.ui.gold,
      fontStyle: 'bold',
    });
    costText.setOrigin(0.5);

    // Hotkey
    const hotkeyText = this.add.text(30, -30, hotkey, {
      fontSize: '10px',
      color: '#666688',
    });
    hotkeyText.setOrigin(0.5);

    container.add([bg, swatch, nameText, costText, hotkeyText]);

    // Click to select
    bg.on('pointerdown', () => {
      this.selectTowerDef(def.id);
    });

    bg.on('pointerover', () => {
      bg.setFillStyle(0x3a3a5a);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(this.selectedTowerDef?.id === def.id ? 0x3a3a5a : 0x2a2a4a);
    });

    return container;
  }

  private createButton(
    x: number, y: number, width: number, height: number,
    label: string, color: number, onClick: () => void
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
    bg.on('pointerover', () => bg.setFillStyle(color + 0x222222));
    bg.on('pointerout', () => bg.setFillStyle(color));

    return container;
  }

  // ============================================================
  // UI UPDATES
  // ============================================================

  private updateUI(): void {
    this.goldText.setText(`Gold: ${this.gold}`);
    this.livesText.setText(`Lives: ${this.lives}`);
    this.waveText.setText(
      `Wave: ${this.waveManager.currentWave + (this.waveManager.waveInProgress ? 1 : 0)}` +
      ` / ${this.waveManager.getTotalWaves()}`
    );

    const status = this.selectedTowerDef
      ? `Placing: ${this.selectedTowerDef.name} (${this.selectedTowerDef.cost}g) — Click to place, Esc to cancel`
      : this.waveManager.waveInProgress
        ? `Wave in progress — ${this.waveManager.getWaveProgress()}`
        : 'Select a tower (1–7) then click the map to place it';
    this.statusText.setText(status);
  }

  // ============================================================
  // INPUT HANDLING
  // ============================================================

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.hoverGraphics.clear();

    if (!this.selectedTowerDef) return;

    // Only show hover on map area
    if (pointer.y >= MAP_ROWS * TILE_SIZE) return;

    const tile = pixelToTile(pointer.x, pointer.y);
    if (tile.x < 0 || tile.x >= MAP_COLS || tile.y < 0 || tile.y >= MAP_ROWS) return;

    const canBuild = this.canBuildAt(tile.x, tile.y);
    const color = canBuild ? COLORS.buildableHover : COLORS.invalidHover;

    this.hoverGraphics.fillStyle(color, 0.4);
    this.hoverGraphics.fillRect(
      tile.x * TILE_SIZE, tile.y * TILE_SIZE,
      TILE_SIZE, TILE_SIZE
    );

    // Show range preview
    if (canBuild && this.selectedTowerDef) {
      const center = tileToPixel(tile.x, tile.y);
      const range = this.selectedTowerDef.levels[0].range;
      this.hoverGraphics.lineStyle(1, 0xffffff, 0.3);
      this.hoverGraphics.strokeCircle(center.x, center.y, range);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Clicking on map area
    if (pointer.y < MAP_ROWS * TILE_SIZE) {
      if (this.selectedTowerDef) {
        this.tryPlaceTower(pointer);
      } else {
        // Try to select an existing tower
        this.trySelectTower(pointer);
      }
    }
  }

  private trySelectTower(pointer: Phaser.Input.Pointer): void {
    const tile = pixelToTile(pointer.x, pointer.y);

    // Find tower at this tile
    const tower = this.towers.find(
      (t) => t.tileX === tile.x && t.tileY === tile.y
    );

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

    // Show upgrade button if possible
    if (tower.canUpgrade()) {
      const cost = tower.getUpgradeCost();
      this.upgradeButton = this.createButton(
        x, uiY + 68, 130, 30,
        `Upgrade (${cost}g)`,
        this.gold >= cost ? 0x2196f3 : 0x555555,
        () => {
          if (this.gold >= cost) {
            this.gold -= cost;
            tower.upgrade();
            this.clearTowerInfo();
            this.showTowerInfo(tower);
          }
        }
      );
    }

    // Sell button
    const sellValue = Math.floor(tower.def.cost * 0.6);
    this.sellButton = this.createButton(
      x, uiY + 104, 130, 24,
      `Sell (${sellValue}g)`,
      0x666666,
      () => {
        this.gold += sellValue;
        const idx = this.towers.indexOf(tower);
        if (idx !== -1) this.towers.splice(idx, 1);
        tower.destroy();
        this.clearTowerSelection();
      }
    );
  }

  private clearTowerInfo(): void {
    this.upgradeButton?.destroy();
    this.upgradeButton = null;
    this.sellButton?.destroy();
    this.sellButton = null;
  }

  private clearTowerSelection(): void {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
      this.selectedTower = null;
    }
    this.clearTowerInfo();
  }

  // ============================================================
  // TOWER PLACEMENT
  // ============================================================

  private selectTowerDef(towerId: string): void {
    this.clearTowerSelection();
    const def = TOWER_DEFS[towerId];
    if (!def) return;

    if (this.selectedTowerDef?.id === towerId) {
      // Toggle off
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
    // Check map tile is buildable (grass = 0)
    if (tileY < 0 || tileY >= MAP_ROWS || tileX < 0 || tileX >= MAP_COLS) return false;
    if (MAP_DATA[tileY][tileX] !== 0) return false;

    // Check no existing tower
    const occupied = this.towers.some(
      (t) => t.tileX === tileX && t.tileY === tileY
    );
    return !occupied;
  }

  private tryPlaceTower(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedTowerDef) return;

    const tile = pixelToTile(pointer.x, pointer.y);
    if (!this.canBuildAt(tile.x, tile.y)) return;

    // Check gold
    if (this.gold < this.selectedTowerDef.cost) {
      this.showFloatingText(pointer.x, pointer.y, 'Not enough gold!', '#ff4444');
      return;
    }

    // Place tower
    this.gold -= this.selectedTowerDef.cost;
    const center = tileToPixel(tile.x, tile.y);
    const tower = new Tower(
      this, center.x, center.y,
      tile.x, tile.y, this.selectedTowerDef.id
    );

    // Tower click handler for selection
    tower.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.selectedTowerDef) {
        pointer.event.stopPropagation();
        this.clearTowerSelection();
        this.selectedTower = tower;
        tower.showRange();
        this.showTowerInfo(tower);
      }
    });

    this.towers.push(tower);

    this.showFloatingText(
      center.x, center.y - 20,
      `-${this.selectedTowerDef.cost}g`,
      COLORS.ui.gold
    );
  }

  // ============================================================
  // WAVE MANAGEMENT
  // ============================================================

  private startWave(): void {
    if (this.waveManager.waveInProgress) return;
    if (this.waveManager.allWavesComplete) return;
    this.waveManager.startNextWave();
  }

  private onWaveComplete(reward: number): void {
    this.gold += reward;
    this.showFloatingText(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `Wave Complete! +${reward}g`,
      COLORS.ui.gold
    );
  }

  // ============================================================
  // GAME END
  // ============================================================

  private endGame(won: boolean): void {
    if (won) {
      this.gameWon = true;
      this.showEndScreen('VICTORY!', '#4caf50');
    } else {
      this.gameOver = true;
      this.showEndScreen('GAME OVER', '#ff4444');
    }
  }

  private showEndScreen(message: string, color: string): void {
    // Dim overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, (MAP_ROWS * TILE_SIZE) / 2,
      GAME_WIDTH, MAP_ROWS * TILE_SIZE,
      0x000000, 0.6
    );
    overlay.setDepth(100);

    const text = this.add.text(
      GAME_WIDTH / 2, (MAP_ROWS * TILE_SIZE) / 2 - 20,
      message,
      { fontSize: '48px', color, fontStyle: 'bold' }
    );
    text.setOrigin(0.5);
    text.setDepth(101);

    const subText = this.add.text(
      GAME_WIDTH / 2, (MAP_ROWS * TILE_SIZE) / 2 + 30,
      `Waves Survived: ${this.waveManager.currentWave} / ${this.waveManager.getTotalWaves()}`,
      { fontSize: '18px', color: '#cccccc' }
    );
    subText.setOrigin(0.5);
    subText.setDepth(101);

    // Restart button
    const restartBtn = this.createButton(
      GAME_WIDTH / 2, (MAP_ROWS * TILE_SIZE) / 2 + 80,
      160, 40, 'Play Again', 0x4caf50,
      () => this.scene.restart()
    );
    restartBtn.setDepth(101);
  }

  // ============================================================
  // VISUAL FEEDBACK
  // ============================================================

  private showFloatingText(x: number, y: number, message: string, color: string): void {
    const text = this.add.text(x, y, message, {
      fontSize: '14px',
      color,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(30);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
