import { Enemy } from "../entities/enemies/Enemy";
import { BossEnemy, BossType } from "../entities/enemies/BossEnemy";
import { FlyingEnemy } from "../entities/enemies/FlyingEnemy";
import { RangedEnemy } from "../entities/enemies/RangedEnemy";
import { TeleportingEnemy } from "../entities/enemies/TeleportingEnemy";
import { SplittingEnemy } from "../entities/enemies/SplittingEnemy";
import { ShieldedEnemy } from "../entities/enemies/ShieldedEnemy";
import { EnemyFactory, EnemyType } from "../factories/EnemyFactory";
import { IEnemy } from "../core/interfaces/IEnemy";

export class WaveManager {
  private currentWave = 1;
  private spawnTimer = 0;
  private spawnInterval = 2;
  private waveStartTime = 0;
  private waveDuration = 30;
  private maxActiveEnemies = 25;
  private maxEnemiesCap = 80;
  
  private bossSpawnInterval = 5;
  private bossSpawned = false;
  private bossDefeated = false;
  private bossWarningTriggered = false;
  private bossWarningTime = 5;
  private timeUntilBoss = 0;
  
  private onBossWarning: (() => void) | null = null;
  private onBossSpawn: ((boss: BossEnemy) => void) | null = null;

  public update(deltaTime: number) {
    this.waveStartTime += deltaTime;
    this.spawnTimer += deltaTime;
    
    if (this.isBossWave() && !this.bossSpawned) {
      this.timeUntilBoss = Math.max(0, this.bossWarningTime - this.waveStartTime);
      
      if (this.waveStartTime >= (this.bossWarningTime - 5) && !this.bossWarningTriggered) {
        this.bossWarningTriggered = true;
        if (this.onBossWarning) {
          this.onBossWarning();
        }
      }
    }
  }

  public spawnEnemies(
    canvasWidth: number,
    canvasHeight: number,
    currentEnemyCount: number,
    playerPos?: { x: number; y: number }
  ): Enemy[] {
    const enemies: Enemy[] = [];

    if (this.isBossWave()) {
      if (!this.bossSpawned && this.waveStartTime >= this.bossWarningTime) {
        const boss = this.spawnBoss(canvasWidth, canvasHeight, playerPos);
        enemies.push(boss);
        this.bossSpawned = true;
        
        if (this.onBossSpawn) {
          this.onBossSpawn(boss);
        }
      }
      
      if (this.bossSpawned && !this.bossDefeated) {
        return enemies;
      }
      
      if (this.bossDefeated) {
        if (this.waveStartTime >= this.waveDuration) {
          this.advanceWave();
        }
      }
      
      return enemies;
    }

    if (this.waveStartTime >= this.waveDuration) {
      this.advanceWave();
    }

    if (this.spawnTimer >= this.spawnInterval && currentEnemyCount < this.maxActiveEnemies) {
      const enemy = this.createRandomEnemy(canvasWidth, canvasHeight, playerPos);
      enemies.push(enemy as Enemy);
      this.spawnTimer = 0;
    }

    return enemies;
  }

  public spawnBoss(canvasWidth: number, canvasHeight: number, playerPos?: { x: number; y: number }): BossEnemy {
    const bossTypes: BossType[] = ["necromancer", "vampire_lord", "ancient_golem"];
    const bossIndex = Math.floor((this.currentWave / this.bossSpawnInterval) - 1) % bossTypes.length;
    const bossType = bossTypes[bossIndex];
    
    let x: number, y: number;
    const margin = 200;
    
    if (playerPos) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 400 + Math.random() * 200;
      x = playerPos.x + Math.cos(angle) * distance;
      y = playerPos.y + Math.sin(angle) * distance;
    } else {
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0:
          x = Math.random() * canvasWidth;
          y = -margin;
          break;
        case 1:
          x = canvasWidth + margin;
          y = Math.random() * canvasHeight;
          break;
        case 2:
          x = Math.random() * canvasWidth;
          y = canvasHeight + margin;
          break;
        case 3:
          x = -margin;
          y = Math.random() * canvasHeight;
          break;
        default:
          x = canvasWidth / 2;
          y = -margin;
      }
    }
    
    console.log(`Boss spawned: ${bossType} at wave ${this.currentWave}`);
    return new BossEnemy(x, y, bossType, this.currentWave);
  }

  // Debug method to spawn a specific boss type
  public spawnSpecificBoss(canvasWidth: number, canvasHeight: number, bossType: BossType, playerPos?: { x: number; y: number }): BossEnemy {
    let x: number, y: number;
    const margin = 200;
    
    if (playerPos) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 400 + Math.random() * 200;
      x = playerPos.x + Math.cos(angle) * distance;
      y = playerPos.y + Math.sin(angle) * distance;
    } else {
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0:
          x = Math.random() * canvasWidth;
          y = -margin;
          break;
        case 1:
          x = canvasWidth + margin;
          y = Math.random() * canvasHeight;
          break;
        case 2:
          x = Math.random() * canvasWidth;
          y = canvasHeight + margin;
          break;
        case 3:
          x = -margin;
          y = Math.random() * canvasHeight;
          break;
        default:
          x = canvasWidth / 2;
          y = -margin;
      }
    }
    
    console.log(`Debug boss spawned: ${bossType}`);
    return new BossEnemy(x, y, bossType, this.currentWave);
  }

  public isBossWave(): boolean {
    return this.currentWave % this.bossSpawnInterval === 0;
  }

  public onBossDefeated() {
    this.bossDefeated = true;
    console.log(`Boss defeated at wave ${this.currentWave}!`);
  }

  public isBossActive(): boolean {
    return this.isBossWave() && this.bossSpawned && !this.bossDefeated;
  }

  public getTimeUntilBoss(): number {
    if (!this.isBossWave() || this.bossSpawned) return 0;
    return Math.max(0, this.bossWarningTime - this.waveStartTime);
  }

  public setOnBossWarning(callback: () => void) {
    this.onBossWarning = callback;
  }

  public setOnBossSpawn(callback: (boss: BossEnemy) => void) {
    this.onBossSpawn = callback;
  }

  private advanceWave() {
    this.currentWave++;
    this.waveStartTime = 0;
    this.spawnInterval = Math.max(1, this.spawnInterval * 0.97);
    this.maxActiveEnemies = Math.min(this.maxEnemiesCap, this.maxActiveEnemies + 5);
    
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossWarningTriggered = false;
    this.timeUntilBoss = 0;
    
    console.log(`Wave ${this.currentWave} started!`);
  }

  private getSpawnPosition(canvasWidth: number, canvasHeight: number, playerPos?: { x: number; y: number }): { x: number; y: number } {
    const margin = 50;
    
    if (playerPos) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 300 + Math.random() * 200;
      return {
        x: playerPos.x + Math.cos(angle) * distance,
        y: playerPos.y + Math.sin(angle) * distance
      };
    } else {
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0:
          return { x: Math.random() * canvasWidth, y: -margin };
        case 1:
          return { x: canvasWidth + margin, y: Math.random() * canvasHeight };
        case 2:
          return { x: Math.random() * canvasWidth, y: canvasHeight + margin };
        case 3:
          return { x: -margin, y: Math.random() * canvasHeight };
        default:
          return { x: canvasWidth / 2, y: -margin };
      }
    }
  }

  private createRandomEnemy(canvasWidth: number, canvasHeight: number, playerPos?: { x: number; y: number }): IEnemy {
    const pos = this.getSpawnPosition(canvasWidth, canvasHeight, playerPos);
    return EnemyFactory.createRandomEnemy(pos.x, pos.y, this.currentWave);
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public reset() {
    this.currentWave = 1;
    this.spawnTimer = 0;
    this.waveStartTime = 0;
    this.spawnInterval = 2;
    this.maxActiveEnemies = 25;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossWarningTriggered = false;
    this.timeUntilBoss = 0;
  }
}
