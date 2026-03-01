import Phaser from 'phaser';
import { TowerDef, TOWER_DEFS } from '@/config/gameConfig';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { distance } from '@/utils/helpers';

export class Tower {
  public sprite: Phaser.GameObjects.Rectangle;
  public rangeCircle: Phaser.GameObjects.Arc;
  public levelIndicators: Phaser.GameObjects.Arc[] = [];
  public def: TowerDef;
  public level: number = 0;
  public tileX: number;
  public tileY: number;

  private scene: Phaser.Scene;
  private fireCooldown: number = 0;
  private turretLine: Phaser.GameObjects.Line;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileX: number,
    tileY: number,
    towerDefId: string
  ) {
    this.scene = scene;
    this.def = TOWER_DEFS[towerDefId];
    this.tileX = tileX;
    this.tileY = tileY;

    // Tower body — square with the tower's color
    this.sprite = scene.add.rectangle(x, y, 36, 36, this.def.color);
    this.sprite.setDepth(5);
    this.sprite.setStrokeStyle(2, 0x222222);

    // Turret direction indicator (line from center)
    this.turretLine = scene.add.line(0, 0, x, y, x, y - 18, 0x222222);
    this.turretLine.setLineWidth(2);
    this.turretLine.setDepth(6);

    // Range circle (hidden by default, shown on hover/select)
    const stats = this.getStats();
    this.rangeCircle = scene.add.circle(x, y, stats.range, 0xffffff, 0.1);
    this.rangeCircle.setStrokeStyle(1, 0xffffff, 0.3);
    this.rangeCircle.setDepth(4);
    this.rangeCircle.setVisible(false);

    // Make interactive for selection
    this.sprite.setInteractive();
    this.sprite.on('pointerover', () => this.rangeCircle.setVisible(true));
    this.sprite.on('pointerout', () => this.rangeCircle.setVisible(false));

    this.updateLevelIndicators();
  }

  getStats() {
    return this.def.levels[this.level];
  }

  canUpgrade(): boolean {
    return this.level < this.def.levels.length - 1;
  }

  getUpgradeCost(): number {
    if (!this.canUpgrade()) return 0;
    return this.def.levels[this.level + 1].upgradeCost;
  }

  upgrade(): void {
    if (!this.canUpgrade()) return;
    this.level++;

    // Update range circle
    const stats = this.getStats();
    this.rangeCircle.setRadius(stats.range);

    // Brighten the tower slightly per level
    const brighten = this.level * 0x111111;
    this.sprite.setFillStyle(this.def.color + brighten);

    this.updateLevelIndicators();
  }

  private updateLevelIndicators(): void {
    // Remove old indicators
    this.levelIndicators.forEach((dot) => dot.destroy());
    this.levelIndicators = [];

    // Add dots for current level
    for (let i = 0; i < this.level; i++) {
      const offsetX = (i - (this.level - 1) / 2) * 8;
      const dot = this.scene.add.circle(
        this.sprite.x + offsetX,
        this.sprite.y + 22,
        3,
        0xffd700
      );
      dot.setDepth(7);
      this.levelIndicators.push(dot);
    }
  }

  update(delta: number, enemies: Enemy[]): Projectile | null {
    this.fireCooldown -= delta;

    if (this.fireCooldown > 0) return null;

    const stats = this.getStats();

    // Poison tower: DOT aura — no projectile, applies effect to all in range
    if (this.def.id === 'poison') {
      let anyInRange = false;
      const dotDuration = stats.dotDuration ?? 1900;
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = distance(this.sprite.x, this.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (dist <= stats.range) {
          enemy.applyEffect({ type: 'poison', duration: dotDuration, value: stats.damage });
          anyInRange = true;
        }
      }
      if (anyInRange) {
        this.fireCooldown = 1000 / stats.fireRate;
      }
      return null;
    }

    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = distance(this.sprite.x, this.sprite.y, enemy.sprite.x, enemy.sprite.y);
      if (dist <= stats.range && dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (!closestEnemy) return null;

    // Fire!
    this.fireCooldown = 1000 / stats.fireRate;

    // Point turret at target
    const angle = Math.atan2(
      closestEnemy.sprite.y - this.sprite.y,
      closestEnemy.sprite.x - this.sprite.x
    );
    const lineLength = 18;
    this.turretLine.setTo(
      this.sprite.x,
      this.sprite.y,
      this.sprite.x + Math.cos(angle) * lineLength,
      this.sprite.y + Math.sin(angle) * lineLength
    );

    return new Projectile(
      this.scene,
      this.sprite.x,
      this.sprite.y,
      closestEnemy,
      stats.damage,
      this.def,
      this.level
    );
  }

  showRange(): void {
    this.rangeCircle.setVisible(true);
  }

  hideRange(): void {
    this.rangeCircle.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.turretLine.destroy();
    this.rangeCircle.destroy();
    this.levelIndicators.forEach((dot) => dot.destroy());
  }
}
