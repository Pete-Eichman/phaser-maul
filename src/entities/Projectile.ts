import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { TowerDef } from '@/config/gameConfig';
import { distance, calculateDamage } from '@/utils/helpers';

export class Projectile {
  public sprite: Phaser.GameObjects.Arc;
  public alive: boolean = true;
  public onDamageDealt: ((x: number, y: number, damage: number, label?: string) => void) | null = null;

  private scene: Phaser.Scene;
  private target: Enemy;
  private speed: number;
  private damage: number;
  private damageType: string;
  private towerDef: TowerDef;
  private splashRadius: number = 0;
  private slowRadius: number = 0;
  private slowDuration: number = 0;
  private chainCount: number = 0;
  private chainRadius: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    towerDef: TowerDef,
    towerLevel: number
  ) {
    this.scene = scene;
    this.target = target;
    this.speed = towerDef.projectileSpeed;
    this.damage = damage;
    this.damageType = towerDef.damageType;
    this.towerDef = towerDef;

    if (towerDef.id === 'cannon') {
      this.splashRadius = 50;
    }

    if (towerDef.damageType === 'ice') {
      this.slowRadius = towerDef.slowRadius ?? 0;
      this.slowDuration = towerDef.levels[towerLevel].slowDuration ?? 2000;
    }

    if (towerDef.chainCount) {
      this.chainCount = towerDef.chainCount;
      this.chainRadius = towerDef.chainRadius ?? 80;
    }

    // Projectile visual — small circle
    const size = towerDef.id === 'cannon' ? 5 : 3;
    this.sprite = scene.add.circle(x, y, size, towerDef.projectileColor);
    this.sprite.setDepth(15);
  }

  update(delta: number, allEnemies: Enemy[]): void {
    if (!this.alive) return;

    // If target died, projectile fizzles
    if (!this.target.alive) {
      this.alive = false;
      return;
    }

    // Move toward target
    const targetX = this.target.sprite.x;
    const targetY = this.target.sprite.y;
    const dist = distance(this.sprite.x, this.sprite.y, targetX, targetY);
    const moveDistance = this.speed * (delta / 1000);

    if (dist <= moveDistance + this.target.def.size) {
      // HIT!
      this.onHit(allEnemies);
      this.alive = false;
    } else {
      const angle = Math.atan2(targetY - this.sprite.y, targetX - this.sprite.x);
      this.sprite.x += Math.cos(angle) * moveDistance;
      this.sprite.y += Math.sin(angle) * moveDistance;
    }
  }

  private onHit(allEnemies: Enemy[]): void {
    const hitX = this.target.sprite.x;
    const hitY = this.target.sprite.y;

    // Physical immunity check — ghost-type enemies
    if (this.damageType === 'physical' && this.target.def.physicalImmune) {
      this.onDamageDealt?.(hitX, hitY, 0, 'IMMUNE');
      return;
    }

    // Apply damage to primary target
    const dmg = calculateDamage(
      this.damage,
      this.damageType,
      this.target.armor,
      this.target.magicResist
    );
    this.target.takeDamage(dmg, this.damageType);
    this.onDamageDealt?.(hitX, hitY, Math.round(dmg));

    // Splash damage (cannon)
    if (this.splashRadius > 0) {
      for (const enemy of allEnemies) {
        if (enemy === this.target || !enemy.alive) continue;
        const dist = distance(hitX, hitY, enemy.sprite.x, enemy.sprite.y);
        if (dist <= this.splashRadius) {
          const splashDmg = calculateDamage(
            this.damage * 0.5, // 50% splash
            this.damageType,
            enemy.armor,
            enemy.magicResist
          );
          enemy.takeDamage(splashDmg, this.damageType);
        }
      }
    }

    // Ice tower: slow primary target, then all enemies within slowRadius
    if (this.towerDef.damageType === 'ice') {
      const slowEffect = { type: 'slow' as const, duration: this.slowDuration, value: 0.6 };
      this.target.applyEffect(slowEffect);

      if (this.slowRadius > 0) {
        for (const enemy of allEnemies) {
          if (enemy === this.target || !enemy.alive) continue;
          const dist = distance(hitX, hitY, enemy.sprite.x, enemy.sprite.y);
          if (dist <= this.slowRadius) {
            enemy.applyEffect(slowEffect);
          }
        }
      }
    }

    // Lightning tower: chain to nearby enemies
    if (this.chainCount > 0) {
      let source = this.target;
      let chainDamage = this.damage * 0.5;
      const chained = new Set<Enemy>([this.target]);

      for (let i = 0; i < this.chainCount; i++) {
        let next: Enemy | null = null;
        let nextDist = Infinity;

        for (const enemy of allEnemies) {
          if (chained.has(enemy) || !enemy.alive) continue;
          const d = distance(source.sprite.x, source.sprite.y, enemy.sprite.x, enemy.sprite.y);
          if (d <= this.chainRadius && d < nextDist) {
            nextDist = d;
            next = enemy;
          }
        }

        if (!next) break;

        // Brief arc flash between source and target
        const gfx = this.scene.add.graphics();
        gfx.lineStyle(2, 0xffee58, 1);
        gfx.lineBetween(source.sprite.x, source.sprite.y, next.sprite.x, next.sprite.y);
        gfx.setDepth(16);
        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 120,
          onComplete: () => gfx.destroy(),
        });

        const chainDmg = calculateDamage(chainDamage, this.damageType, next.armor, next.magicResist);
        next.takeDamage(chainDmg, this.damageType);
        chained.add(next);
        source = next;
        chainDamage *= 0.5;
      }
    }

    // Fire tower: apply burn
    if (this.towerDef.damageType === 'fire') {
      this.target.applyEffect({
        type: 'burn',
        duration: 3000,
        value: 5, // 5 DPS
      });
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
