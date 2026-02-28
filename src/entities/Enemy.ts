import Phaser from 'phaser';
import { EnemyDef, PATH_WAYPOINTS, TILE_SIZE } from '@/config/gameConfig';
import { tileToPixel, distance } from '@/utils/helpers';

export interface StatusEffect {
  type: 'slow' | 'burn';
  duration: number;    // remaining ms
  value: number;       // slow: multiplier (0.6 = 40% slow), burn: DPS
}

export class Enemy {
  public sprite: Phaser.GameObjects.Arc;
  public healthBar: Phaser.GameObjects.Graphics;
  public health: number;
  public maxHealth: number;
  public speed: number;
  public baseSpeed: number;
  public reward: number;
  public armor: number;
  public magicResist: number;
  public alive: boolean = true;
  public reachedEnd: boolean = false;
  public def: EnemyDef;

  private scene: Phaser.Scene;
  private waypointIndex: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private statusEffects: StatusEffect[] = [];

  constructor(scene: Phaser.Scene, def: EnemyDef) {
    this.scene = scene;
    this.def = def;
    this.health = def.health;
    this.maxHealth = def.health;
    this.speed = def.speed;
    this.baseSpeed = def.speed;
    this.reward = def.reward;
    this.armor = def.armor;
    this.magicResist = def.magicResist;

    // Spawn at first waypoint
    const spawn = tileToPixel(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);

    // Create circle sprite (procedural — no assets needed)
    this.sprite = scene.add.circle(spawn.x, spawn.y, def.size, def.color);
    this.sprite.setDepth(10);

    // Health bar (drawn above enemy)
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(11);

    // Set first target
    this.waypointIndex = 1;
    this.updateTarget();
  }

  private updateTarget(): void {
    if (this.waypointIndex >= PATH_WAYPOINTS.length) {
      this.reachedEnd = true;
      this.alive = false;
      return;
    }
    const wp = PATH_WAYPOINTS[this.waypointIndex];
    const pixel = tileToPixel(wp.x, wp.y);
    this.targetX = pixel.x;
    this.targetY = pixel.y;
  }

  update(delta: number): void {
    if (!this.alive) return;

    // Process status effects
    this.processStatusEffects(delta);

    // Move toward current waypoint
    const dist = distance(this.sprite.x, this.sprite.y, this.targetX, this.targetY);
    const moveDistance = this.speed * (delta / 1000);

    if (dist <= moveDistance) {
      // Reached waypoint — move to next
      this.sprite.x = this.targetX;
      this.sprite.y = this.targetY;
      this.waypointIndex++;
      this.updateTarget();
    } else {
      // Move toward target
      const angle = Math.atan2(this.targetY - this.sprite.y, this.targetX - this.sprite.x);
      this.sprite.x += Math.cos(angle) * moveDistance;
      this.sprite.y += Math.sin(angle) * moveDistance;
    }

    // Update health bar position
    this.drawHealthBar();
  }

  private processStatusEffects(delta: number): void {
    let slowMultiplier = 1;
    let burnDPS = 0;

    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.duration -= delta;

      if (effect.duration <= 0) {
        this.statusEffects.splice(i, 1);
        continue;
      }

      if (effect.type === 'slow') {
        slowMultiplier = Math.min(slowMultiplier, effect.value);
      } else if (effect.type === 'burn') {
        burnDPS += effect.value;
      }
    }

    // Apply slow
    this.speed = this.baseSpeed * slowMultiplier;

    // Apply burn damage
    if (burnDPS > 0) {
      this.takeDamage(burnDPS * (delta / 1000), 'fire');
    }

    // Visual feedback for status effects
    if (slowMultiplier < 1) {
      this.sprite.setStrokeStyle(2, 0x4fc3f7); // Blue outline when slowed
    } else if (burnDPS > 0) {
      this.sprite.setStrokeStyle(2, 0xff6f00); // Orange outline when burning
    } else {
      this.sprite.setStrokeStyle(0);
    }
  }

  applyEffect(effect: StatusEffect): void {
    // For slow, replace if stronger; for burn, stack
    if (effect.type === 'slow') {
      const existing = this.statusEffects.find((e) => e.type === 'slow');
      if (existing) {
        existing.duration = effect.duration;
        existing.value = Math.min(existing.value, effect.value);
      } else {
        this.statusEffects.push({ ...effect });
      }
    } else {
      this.statusEffects.push({ ...effect });
    }
  }

  takeDamage(amount: number, _damageType?: string): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  private drawHealthBar(): void {
    this.healthBar.clear();
    if (!this.alive) return;

    const barWidth = this.def.size * 2.5;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - this.def.size - 8;
    const healthPct = this.health / this.maxHealth;

    // Background
    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Health fill (green → yellow → red)
    let color = 0x4caf50;
    if (healthPct < 0.6) color = 0xffeb3b;
    if (healthPct < 0.3) color = 0xf44336;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, barWidth * healthPct, barHeight);
  }

  destroy(): void {
    this.sprite.destroy();
    this.healthBar.destroy();
  }
}
