import Phaser from 'phaser';
import { EnemyDef } from '@/config/gameConfig';
import { tileToPixel, distance } from '@/utils/helpers';

export type Waypoint = { x: number; y: number };

export interface StatusEffect {
  type: 'slow' | 'burn' | 'poison';
  duration: number;    // remaining ms
  value: number;       // slow: multiplier (0.6 = 40% slow), burn/poison: DPS
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
  // True while the death shrink tween is running; false once it finishes.
  public dying: boolean = false;
  // Set to true the moment we kick off the death animation so rewards
  // are only processed once even though the enemy stays in the array.
  public deathAnimationStarted: boolean = false;
  public def: EnemyDef;
  public waypointIndex: number = 0;
  // Total pixel distance traveled along the path — used by tower targeting modes.
  public pathProgress: number = 0;

  private scene: Phaser.Scene;
  private waypoints: Waypoint[];
  private cumulativeLengths: number[] = [];
  private targetX: number = 0;
  private targetY: number = 0;
  private statusEffects: StatusEffect[] = [];
  private spawnTween: Phaser.Tweens.Tween | null = null;
  private wedge: Phaser.GameObjects.Graphics;
  private moveAngle: number = 0;
  private burnParticles: Phaser.GameObjects.Arc[] = [];
  private burnAngle: number = 0;
  private wasBurning: boolean = false;

  constructor(
    scene: Phaser.Scene,
    def: EnemyDef,
    waypoints: Waypoint[],
    startWaypointIndex: number = 1,
  ) {
    this.scene = scene;
    this.def = def;
    this.waypoints = waypoints;

    // Precompute cumulative pixel distances between waypoints for pathProgress tracking.
    this.cumulativeLengths = [0];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = tileToPixel(waypoints[i].x, waypoints[i].y);
      const to = tileToPixel(waypoints[i + 1].x, waypoints[i + 1].y);
      this.cumulativeLengths.push(this.cumulativeLengths[i] + distance(from.x, from.y, to.x, to.y));
    }

    this.health = def.health;
    this.maxHealth = def.health;
    this.speed = def.speed;
    this.baseSpeed = def.speed;
    this.reward = def.reward;
    this.armor = def.armor;
    this.magicResist = def.magicResist;

    // Spawn at the first waypoint (split children override position after construction)
    const spawn = tileToPixel(this.waypoints[0].x, this.waypoints[0].y);

    this.sprite = scene.add.circle(spawn.x, spawn.y, def.size, def.color);
    this.sprite.setDepth(10);

    // Fade in from invisible to the enemy's target alpha
    this.sprite.setAlpha(0);
    const targetAlpha = def.alpha ?? 1;
    this.spawnTween = scene.tweens.add({
      targets: this.sprite,
      alpha: targetAlpha,
      duration: 200,
      ease: 'Power1',
    });

    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(11);

    this.waypointIndex = startWaypointIndex;
    this.updateTarget();

    this.moveAngle = Math.atan2(
      this.targetY - this.sprite.y,
      this.targetX - this.sprite.x,
    );
    this.wedge = scene.add.graphics();
    this.wedge.setDepth(10.5);
  }

  private drawWedge(): void {
    this.wedge.clear();
    const tip = this.def.size + 6;
    const base = this.def.size;
    const hw = 4;
    this.wedge.fillStyle(this.def.color, 0.9);
    this.wedge.fillTriangle(tip, 0, base, -hw, base, hw);
    this.wedge.setPosition(this.sprite.x, this.sprite.y);
    this.wedge.setRotation(this.moveAngle);
  }

  private updateTarget(): void {
    if (this.waypointIndex >= this.waypoints.length) {
      this.reachedEnd = true;
      this.alive = false;
      return;
    }
    const wp = this.waypoints[this.waypointIndex];
    const pixel = tileToPixel(wp.x, wp.y);
    this.targetX = pixel.x;
    this.targetY = pixel.y;
  }

  update(delta: number): void {
    if (!this.alive) return;

    this.processStatusEffects(delta);

    if (this.burnParticles.length > 0) {
      this.burnAngle += delta * 0.0025;
      for (let i = 0; i < this.burnParticles.length; i++) {
        const a = this.burnAngle + (i / this.burnParticles.length) * Math.PI * 2;
        const r = this.def.size + 5;
        this.burnParticles[i].setPosition(
          this.sprite.x + Math.cos(a) * r,
          this.sprite.y + Math.sin(a) * r,
        );
      }
    }

    const dist = distance(this.sprite.x, this.sprite.y, this.targetX, this.targetY);
    const moveDistance = this.speed * (delta / 1000);

    if (dist <= moveDistance) {
      this.sprite.x = this.targetX;
      this.sprite.y = this.targetY;
      this.waypointIndex++;
      this.updateTarget();
    } else {
      const angle = Math.atan2(this.targetY - this.sprite.y, this.targetX - this.sprite.x);
      this.moveAngle = angle;
      this.sprite.x += Math.cos(angle) * moveDistance;
      this.sprite.y += Math.sin(angle) * moveDistance;
    }

    if (this.waypointIndex > 0 && this.waypointIndex <= this.waypoints.length) {
      const prev = tileToPixel(
        this.waypoints[this.waypointIndex - 1].x,
        this.waypoints[this.waypointIndex - 1].y,
      );
      this.pathProgress = (this.cumulativeLengths[this.waypointIndex - 1] ?? 0)
        + distance(prev.x, prev.y, this.sprite.x, this.sprite.y);
    }

    this.drawWedge();
    this.drawHealthBar();
  }

  private processStatusEffects(delta: number): void {
    let slowMultiplier = 1;
    let burnDPS = 0;
    let poisonDPS = 0;

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
      } else if (effect.type === 'poison') {
        poisonDPS += effect.value;
      }
    }

    this.speed = this.baseSpeed * slowMultiplier;

    if (burnDPS > 0) {
      this.takeDamage(burnDPS * (delta / 1000), 'fire');
    }
    if (poisonDPS > 0) {
      this.takeDamage(poisonDPS * (delta / 1000), 'poison');
    }

    if (slowMultiplier < 1) {
      this.sprite.setStrokeStyle(2, 0x4fc3f7);
    } else if (burnDPS > 0) {
      this.sprite.setStrokeStyle(2, 0xff6f00);
    } else if (poisonDPS > 0) {
      this.sprite.setStrokeStyle(2, 0x66bb6a);
    } else {
      this.sprite.setStrokeStyle(1.5, 0x111111);
    }

    const isBurning = burnDPS > 0;
    if (isBurning && !this.wasBurning) {
      for (let i = 0; i < 3; i++) {
        const p = this.scene.add.circle(this.sprite.x, this.sprite.y, 2.5, 0xff8c00);
        p.setDepth(10.4);
        this.burnParticles.push(p);
      }
    } else if (!isBurning && this.wasBurning) {
      this.burnParticles.forEach((p) => p.destroy());
      this.burnParticles = [];
    }
    this.wasBurning = isBurning;
  }

  applyEffect(effect: StatusEffect): void {
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

  startDeathAnimation(): void {
    this.deathAnimationStarted = true;
    this.dying = true;
    this.spawnTween?.stop();
    this.healthBar.setVisible(false);
    this.wedge.destroy();
    this.burnParticles.forEach((p) => p.destroy());
    this.burnParticles = [];
    // Flash white, then shrink and fade out
    this.sprite.setFillStyle(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => { this.dying = false; },
    });
  }

  private drawHealthBar(): void {
    this.healthBar.clear();
    if (!this.alive) return;

    const barWidth = this.def.size * 2.5;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - this.def.size - 8;
    const healthPct = this.health / this.maxHealth;

    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    let color = 0x4caf50;
    if (healthPct < 0.6) color = 0xffeb3b;
    if (healthPct < 0.3) color = 0xf44336;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, barWidth * healthPct, barHeight);
  }

  destroy(): void {
    this.spawnTween?.stop();
    this.sprite.destroy();
    this.healthBar.destroy();
    if (this.wedge.active) this.wedge.destroy();
    this.burnParticles.forEach((p) => { if (p.active) p.destroy(); });
  }
}
