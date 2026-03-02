import Phaser from 'phaser';
import { TowerDef, TOWER_DEFS } from '@/config/gameConfig';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { distance } from '@/utils/helpers';

export type TargetMode = 'closest' | 'first' | 'strongest' | 'weakest';

export class Tower {
  public sprite: Phaser.GameObjects.Rectangle;
  public inner: Phaser.GameObjects.Graphics;
  public rangeCircle: Phaser.GameObjects.Arc;
  public levelIndicators: Phaser.GameObjects.Arc[] = [];
  public def: TowerDef;
  public level: number = 0;
  public tileX: number;
  public tileY: number;
  public targetMode: TargetMode = 'closest';

  private scene: Phaser.Scene;
  private fireCooldown: number = 0;
  private innerColor: number = 0;
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

    // Tower body — dark base square with colored inner square
    this.sprite = scene.add.rectangle(x, y, 36, 36, 0x1c1c2e);
    this.sprite.setDepth(5);

    this.innerColor = this.def.color;
    this.inner = scene.add.graphics();
    this.inner.setPosition(x, y);
    this.inner.setDepth(5.1);
    this.drawInnerShape(this.innerColor);

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

    if (this.def.id === 'wall') {
      this.turretLine.setVisible(false);
      this.rangeCircle.setVisible(false);
      this.sprite.removeListener('pointerover');
      this.sprite.removeListener('pointerout');
    }

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

  cycleTargetMode(): void {
    const modes: TargetMode[] = ['closest', 'first', 'strongest', 'weakest'];
    this.targetMode = modes[(modes.indexOf(this.targetMode) + 1) % modes.length];
  }

  upgrade(): void {
    if (!this.canUpgrade()) return;
    this.level++;

    // Update range circle
    const stats = this.getStats();
    this.rangeCircle.setRadius(stats.range);

    this.innerColor = this.addColorPerChannel(this.def.color, this.level * 0x11);
    this.drawInnerShape(this.innerColor);

    this.updateLevelIndicators();
  }

  private updateLevelIndicators(): void {
    this.levelIndicators.forEach((ring) => ring.destroy());
    this.levelIndicators = [];

    const radii = [20, 24];
    for (let i = 0; i < this.level; i++) {
      const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, radii[i]);
      ring.setFillStyle(0, 0);
      ring.setStrokeStyle(1.5, 0xc9a959);
      ring.setDepth(5.2);
      this.levelIndicators.push(ring);
    }
  }

  update(delta: number, enemies: Enemy[]): Projectile | null {
    if (this.def.id === 'wall') return null;

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

    const inRange = enemies.filter(
      (e) => e.alive && distance(this.sprite.x, this.sprite.y, e.sprite.x, e.sprite.y) <= stats.range,
    );
    if (inRange.length === 0) return null;

    let target: Enemy;
    switch (this.targetMode) {
      case 'first':
        target = inRange.reduce((b, e) => e.pathProgress > b.pathProgress ? e : b);
        break;
      case 'strongest':
        target = inRange.reduce((b, e) => e.health > b.health ? e : b);
        break;
      case 'weakest':
        target = inRange.reduce((b, e) => e.health < b.health ? e : b);
        break;
      default: // 'closest'
        target = inRange.reduce((b, e) => {
          const db = distance(this.sprite.x, this.sprite.y, b.sprite.x, b.sprite.y);
          const de = distance(this.sprite.x, this.sprite.y, e.sprite.x, e.sprite.y);
          return de < db ? e : b;
        });
    }

    this.fireCooldown = 1000 / stats.fireRate;

    // Point turret at target
    const angle = Math.atan2(
      target.sprite.y - this.sprite.y,
      target.sprite.x - this.sprite.x
    );
    const lineLength = 18;
    this.turretLine.setTo(
      this.sprite.x,
      this.sprite.y,
      this.sprite.x + Math.cos(angle) * lineLength,
      this.sprite.y + Math.sin(angle) * lineLength
    );

    const projectile = new Projectile(
      this.scene,
      this.sprite.x,
      this.sprite.y,
      target,
      stats.damage,
      this.def,
      this.level
    );

    const flashColor = this.addColorPerChannel(this.innerColor, 0x40);
    this.drawInnerShape(flashColor);
    this.scene.time.delayedCall(80, () => {
      if (this.inner?.active) this.drawInnerShape(this.innerColor);
    });

    return projectile;
  }

  // Adds `amount` to each RGB channel independently, clamping at 0xff per channel
  // to prevent overflow from carrying bits across channel boundaries.
  private addColorPerChannel(base: number, amount: number): number {
    const r = Math.min(0xff, ((base >> 16) & 0xff) + amount);
    const g = Math.min(0xff, ((base >> 8) & 0xff) + amount);
    const b = Math.min(0xff, (base & 0xff) + amount);
    return (r << 16) | (g << 8) | b;
  }

  private drawInnerShape(color: number): void {
    this.inner.clear();
    this.inner.fillStyle(color, 1);

    const pts = (coords: number[]): { x: number; y: number }[] => {
      const result: { x: number; y: number }[] = [];
      for (let i = 0; i < coords.length; i += 2) {
        result.push({ x: coords[i], y: coords[i + 1] });
      }
      return result;
    };

    switch (this.def.id) {
      case 'arrow':
        this.inner.fillPoints(pts([0, -13, 13, 0, 0, 13, -13, 0]), true);
        break;
      case 'cannon': {
        const oct: number[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          oct.push(Math.cos(a) * 12, Math.sin(a) * 12);
        }
        this.inner.fillPoints(pts(oct), true);
        break;
      }
      case 'ice': {
        const r = 12;
        const h = r * Math.sin(Math.PI / 3);
        const half = r * 0.5;
        this.inner.fillTriangle(0, -r, h, half, -h, half);
        this.inner.fillTriangle(0, r, h, -half, -h, -half);
        break;
      }
      case 'fire': {
        const pent: number[] = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          pent.push(Math.cos(a) * 12, Math.sin(a) * 12);
        }
        this.inner.fillPoints(pts(pent), true);
        break;
      }
      case 'sniper':
        this.inner.fillPoints(pts([0, -14, 7, 0, 0, 14, -7, 0]), true);
        break;
      case 'lightning': {
        const hex: number[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          hex.push(Math.cos(a) * 12, Math.sin(a) * 12);
        }
        this.inner.fillPoints(pts(hex), true);
        break;
      }
      case 'poison': {
        const star: number[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r2 = i % 2 === 0 ? 12 : 5;
          star.push(Math.cos(a) * r2, Math.sin(a) * r2);
        }
        this.inner.fillPoints(pts(star), true);
        break;
      }
      case 'wall':
        this.inner.fillRect(-11, -11, 22, 22);
        break;
      default:
        this.inner.fillRect(-13, -13, 26, 26);
    }
  }

  startSellAnimation(onComplete: () => void): void {
    this.turretLine.setVisible(false);
    this.rangeCircle.setVisible(false);
    this.levelIndicators.forEach((d) => d.setVisible(false));
    this.scene.tweens.add({
      targets: [this.sprite, this.inner],
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete,
    });
  }

  showRange(): void {
    this.rangeCircle.setVisible(true);
  }

  hideRange(): void {
    this.rangeCircle.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.inner.destroy();
    this.turretLine.destroy();
    this.rangeCircle.destroy();
    this.levelIndicators.forEach((dot) => dot.destroy());
  }
}
