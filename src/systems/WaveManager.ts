import Phaser from 'phaser';
import { WAVE_DEFS, ENEMY_DEFS, EnemyDef, SpawnGroup } from '@/config/gameConfig';
import { Enemy, Waypoint } from '@/entities/Enemy';

interface ActiveGroup {
  group: SpawnGroup;
  spawned: number;
  timer: number;      // ms until next spawn
  delayTimer: number; // ms until group starts
  started: boolean;
}

export class WaveManager {
  public currentWave: number = 0;
  public waveInProgress: boolean = false;
  public allWavesComplete: boolean = false;
  public enemiesAliveCount: number = 0;

  private scene: Phaser.Scene;
  private waypoints: Waypoint[];
  private activeGroups: ActiveGroup[] = [];
  private totalWaves: number;
  private onEnemySpawn: (enemy: Enemy) => void;
  private onWaveComplete: (waveReward: number) => void;
  private totalSpawnedThisWave: number = 0;
  private totalToSpawnThisWave: number = 0;
  private hpMult: number;
  private speedMult: number;
  private goldMult: number;

  constructor(
    scene: Phaser.Scene,
    waypoints: Waypoint[],
    onEnemySpawn: (enemy: Enemy) => void,
    onWaveComplete: (waveReward: number) => void,
    hpMult: number = 1,
    speedMult: number = 1,
    goldMult: number = 1,
  ) {
    this.scene = scene;
    this.waypoints = waypoints;
    this.totalWaves = WAVE_DEFS.length;
    this.onEnemySpawn = onEnemySpawn;
    this.onWaveComplete = onWaveComplete;
    this.hpMult = hpMult;
    this.speedMult = speedMult;
    this.goldMult = goldMult;
  }

  startNextWave(): boolean {
    if (this.waveInProgress) return false;
    if (this.currentWave >= this.totalWaves) {
      this.allWavesComplete = true;
      return false;
    }

    const waveDef = WAVE_DEFS[this.currentWave];
    this.waveInProgress = true;
    this.totalSpawnedThisWave = 0;
    this.totalToSpawnThisWave = waveDef.groups.reduce((sum, g) => sum + g.count, 0);

    this.activeGroups = waveDef.groups.map((group) => ({
      group,
      spawned: 0,
      timer: 0,
      delayTimer: group.delay,
      started: group.delay === 0,
    }));

    return true;
  }

  update(delta: number): void {
    if (!this.waveInProgress) return;

    for (const ag of this.activeGroups) {
      if (!ag.started) {
        ag.delayTimer -= delta;
        if (ag.delayTimer <= 0) ag.started = true;
        continue;
      }

      if (ag.spawned >= ag.group.count) continue;

      ag.timer -= delta;
      if (ag.timer <= 0) {
        const baseDef = ENEMY_DEFS[ag.group.enemyType];
        if (baseDef) {
          const enemy = new Enemy(this.scene, this.scaleDef(baseDef), this.waypoints);
          this.onEnemySpawn(enemy);
          this.enemiesAliveCount++;
          this.totalSpawnedThisWave++;
        }
        ag.spawned++;
        ag.timer = ag.group.interval;
      }
    }

    const allSpawned = this.totalSpawnedThisWave >= this.totalToSpawnThisWave;
    if (allSpawned && this.enemiesAliveCount <= 0) {
      this.completeWave();
    }
  }

  // Apply difficulty multipliers to a base enemy def. Also used by GameScene
  // when spawning splitter children so they inherit the same scaling.
  scaleDef(base: EnemyDef): EnemyDef {
    return {
      ...base,
      health: Math.round(base.health * this.hpMult),
      speed: base.speed * this.speedMult,
      reward: Math.round(base.reward * this.goldMult),
    };
  }

  updateWaypoints(newWaypoints: Waypoint[]): void {
    this.waypoints = newWaypoints;
  }

  // Called when a splitter child is spawned mid-wave so wave-completion
  // accounting stays correct.
  addEnemy(): void {
    this.enemiesAliveCount++;
  }

  onEnemyDied(): void {
    this.enemiesAliveCount--;
  }

  onEnemyReachedEnd(): void {
    this.enemiesAliveCount--;
  }

  private completeWave(): void {
    const waveDef = WAVE_DEFS[this.currentWave];
    this.waveInProgress = false;
    this.currentWave++;
    this.activeGroups = [];
    this.onWaveComplete(waveDef.reward);

    if (this.currentWave >= this.totalWaves) {
      this.allWavesComplete = true;
    }
  }

  getTotalWaves(): number {
    return this.totalWaves;
  }

  getWaveProgress(): string {
    if (!this.waveInProgress) return 'Ready';
    return `${this.totalSpawnedThisWave}/${this.totalToSpawnThisWave} spawned`;
  }
}
