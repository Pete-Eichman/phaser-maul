import Phaser from 'phaser';
import { WAVE_DEFS, ENEMY_DEFS, WaveDef, SpawnGroup } from '@/config/gameConfig';
import { Enemy } from '@/entities/Enemy';

interface ActiveGroup {
  group: SpawnGroup;
  spawned: number;
  timer: number;     // ms until next spawn
  delayTimer: number; // ms until group starts
  started: boolean;
}

export class WaveManager {
  public currentWave: number = 0;
  public waveInProgress: boolean = false;
  public allWavesComplete: boolean = false;
  public enemiesAliveCount: number = 0;

  private scene: Phaser.Scene;
  private activeGroups: ActiveGroup[] = [];
  private totalWaves: number;
  private onEnemySpawn: (enemy: Enemy) => void;
  private onWaveComplete: (waveReward: number) => void;
  private totalSpawnedThisWave: number = 0;
  private totalToSpawnThisWave: number = 0;

  constructor(
    scene: Phaser.Scene,
    onEnemySpawn: (enemy: Enemy) => void,
    onWaveComplete: (waveReward: number) => void
  ) {
    this.scene = scene;
    this.totalWaves = WAVE_DEFS.length;
    this.onEnemySpawn = onEnemySpawn;
    this.onWaveComplete = onWaveComplete;
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

    // Initialize spawn groups
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
      // Wait for delay
      if (!ag.started) {
        ag.delayTimer -= delta;
        if (ag.delayTimer <= 0) {
          ag.started = true;
        }
        continue;
      }

      // All spawned for this group?
      if (ag.spawned >= ag.group.count) continue;

      // Tick spawn timer
      ag.timer -= delta;
      if (ag.timer <= 0) {
        // Spawn enemy
        const enemyDef = ENEMY_DEFS[ag.group.enemyType];
        if (enemyDef) {
          const enemy = new Enemy(this.scene, enemyDef);
          this.onEnemySpawn(enemy);
          this.enemiesAliveCount++;
          this.totalSpawnedThisWave++;
        }
        ag.spawned++;
        ag.timer = ag.group.interval;
      }
    }

    // Check if wave is complete (all spawned + all dead)
    const allSpawned = this.totalSpawnedThisWave >= this.totalToSpawnThisWave;
    if (allSpawned && this.enemiesAliveCount <= 0) {
      this.completeWave();
    }
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
