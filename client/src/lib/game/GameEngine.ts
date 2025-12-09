import { Player } from './entities/characters/Player';
import { AssassinPlayer } from './entities/characters/AssassinPlayer';
import { Enemy } from './entities/enemies/Enemy';
import { BossEnemy } from './entities/enemies/BossEnemy';
import { FlyingEnemy } from './entities/enemies/FlyingEnemy';
import { RangedEnemy } from './entities/enemies/RangedEnemy';
import { TeleportingEnemy } from './entities/enemies/TeleportingEnemy';
import { SplittingEnemy } from './entities/enemies/SplittingEnemy';
import { ShieldedEnemy } from './entities/enemies/ShieldedEnemy';
import { EnemyProjectile } from './entities/enemies/EnemyProjectile';
import { Projectile } from './weapons/projectiles/Projectile';
import { IProjectile } from './core/interfaces/IProjectile';
import { ExperienceOrb } from './entities/collectibles/ExperienceOrb';
import { SylphBloomsWeapon } from './weapons/SylphBloomsWeapon';
import { OrbitalWeapon } from './weapons/OrbitalWeapon';
import { CollisionDetection } from './systems/CollisionDetection';
import { WaveManager } from './managers/WaveManager';
import { SpriteManager } from './rendering/SpriteManager';
import { CameraSystem } from './rendering/CameraSystem';
import { InfiniteTileRenderer } from './rendering/InfiniteTileRenderer';
import { Particle } from './rendering/Particle';
import { InputManager } from './systems/InputManager';
import { useGameState, GamePhase } from "../stores/useGameState";
import { useAudio } from "../stores/useAudio";
import { useGameStore } from "../stores/useGame";
import { WeaponEvolutionSystem } from './systems/WeaponEvolution';
import { ComboSystem } from './systems/ComboSystem';
import { PassiveItemManager } from './entities/collectibles/PassiveItem';
import { DamageNumberManager } from './rendering/DamageNumber';
import { BossLoot, generateBossLoot } from './entities/collectibles/BossLoot';
import { ScreenShakeSystem } from './rendering/ScreenShake';
import { PersistentProgressionSystem } from './systems/PersistentProgressionSystem';
import { StatisticsSystem } from './systems/StatisticsSystem';
import { GameLoopController } from './systems/GameLoopController';
import { EntityManager } from './managers/EntityManager';
import { CollisionHandler } from './systems/CollisionHandler';
import { RenderSystem } from './rendering/RenderSystem';
import { GameStateManager } from './systems/GameStateManager';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Delegated systems
  private gameLoop: GameLoopController;
  private entityManager: EntityManager;
  private collisionHandler: CollisionHandler;
  private renderSystem: RenderSystem;
  private gameStateManager: GameStateManager;
  private waveManager: WaveManager;
  private inputManager: InputManager;
  private spriteManager: SpriteManager;
  private camera: CameraSystem;
  private infiniteTileRenderer: InfiniteTileRenderer;

  private currentBoss: BossEnemy | null = null;
  private isBossActive: boolean = false;
  private bossDefeatedCelebrationTimer: number = 0;
  private bossLoot: BossLoot[] = [];
  private gameStartTime: number = 0;
  private totalDamageDealt: number = 0;
  private totalDamageTaken: number = 0;
  private lastStatsSaveTime: number = 0;
  private readonly STATS_SAVE_INTERVAL: number = 30000;
  private isPaused: boolean = false;
  private previousPhase: GamePhase = "ready";

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.gameStartTime = Date.now();
    this.canvas = canvas;
    this.ctx = ctx;

    // Initialize core systems
    this.spriteManager = SpriteManager.getInstance();
    this.infiniteTileRenderer = new InfiniteTileRenderer();
    this.camera = new CameraSystem(canvas.width, canvas.height);
    this.inputManager = new InputManager();
    this.waveManager = new WaveManager();

    // Initialize delegated systems
    this.entityManager = new EntityManager(canvas, this.infiniteTileRenderer);
    this.gameStateManager = new GameStateManager();
    this.collisionHandler = new CollisionHandler(this.entityManager, this.gameStateManager);
    this.renderSystem = new RenderSystem(ctx, this.camera, this.infiniteTileRenderer, this.entityManager);
    this.renderSystem.setGameStateManager(this.gameStateManager);
    this.gameLoop = new GameLoopController(this.update.bind(this), this.render.bind(this));

    this.setupBossCallbacks();
    this.setupInput();
    this.initializeSprites();

    // Setup player with selected character
    this.entityManager.setupPlayer();
  }

  private setupBossCallbacks() {
    this.waveManager.setOnBossWarning(() => {
      this.gameStateManager.handleBossWarning(this.waveManager.getCurrentWave());
    });

    this.waveManager.setOnBossSpawn((boss) => {
      this.entityManager.addBoss(boss);
      this.gameStateManager.handleBossSpawn(boss);
      this.currentBoss = boss; // Keep track of the current boss for logic within GameEngine if needed
      this.isBossActive = true;
    });
  }

  private setupInput() {
    this.inputManager.addEventListeners();
    // GameStateManager now handles its own input setup for pause, restart, etc.
    this.gameStateManager.setupInputHandlers(this.inputManager, () => this.resetGame());
  }

  private resetGame() {
    this.entityManager.reset();
    this.waveManager.reset();
    this.gameStateManager.reset();
    this.entityManager.setupPlayer(); // Ensure player is re-initialized
    this.currentBoss = null;
    this.isBossActive = false;
    this.bossLoot = [];
    this.gameStartTime = Date.now();
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.lastStatsSaveTime = 0;
  }

  public start() {
    this.gameLoop.start();
    // Ensure event listeners are attached (safe to call multiple times)
    this.inputManager.addEventListeners();
  }

  public stop() {
    this.gameLoop.stop();
    // Don't remove event listeners - we want to keep listening even when paused
    // this.inputManager.removeEventListeners();
  }

  private update = (deltaTime: number) => {
    // Handle pause input toggle (get input without pause check first for pause detection)
    const input = this.inputManager.getInput();
    const pauseStateChanged = this.gameStateManager.handlePauseInput(input, this.inputManager);

    // Get game state for checks
    const gameState = useGameState.getState();
    
    // Track previous pause state for detecting transitions
    const wasPaused = this.isPaused;
    
    // Update local pause state to match game state
    const isPausedOrLevelUp = (gameState.phase === "paused" || gameState.phase === "levelUp");
    this.isPaused = (gameState.phase === "paused");
    
    // Update InputManager pause state to prevent movement key registration during pause/levelUp
    this.inputManager.setPaused(isPausedOrLevelUp);
    
    // Clear movement keys when transitioning from paused or levelUp to playing
    // This handles resume from pause menu button and level up screen
    if ((this.previousPhase === "paused" || this.previousPhase === "levelUp") && gameState.phase === "playing") {
      this.inputManager.clearMovementKeys();
    }
    
    // Update previous phase for next frame
    this.previousPhase = gameState.phase;

    // Check if game is currently paused using local state
    if (this.isPaused) {
      // During pause, update player with empty input to prevent movement,
      // and update entity manager to keep animations going
      const player = this.entityManager.getPlayer();
      const emptyInput = { left: false, right: false, up: false, down: false, weapon1: false, weapon2: false, weapon3: false, weapon4: false, weapon5: false, mute: false, restart: false, pause: false };
      player.update(deltaTime, emptyInput, this.canvas.width, this.canvas.height, this.infiniteTileRenderer);
      this.entityManager.update(deltaTime, { x: player.x, y: player.y });

      // Fire player weapon during pause to keep weapon animations going
      const newProjectiles = player.fireWeapon(deltaTime);
      this.entityManager.addProjectiles(newProjectiles);

      // Don't update waveManager during pause to avoid timer advancement
      return;
    } else if (gameState.phase === "gameOver") {
      // Update entity manager to keep enemies alive, and continue wave manager updates
      const player = this.entityManager.getPlayer();
      this.entityManager.update(deltaTime, { x: player.x, y: player.y });
      this.waveManager.update(deltaTime);
      return;
    }

    // Don't update game if leveling up
    if (gameState.phase === "levelUp") {
      // Update entity manager to keep enemies alive, and continue wave manager updates
      const player = this.entityManager.getPlayer();
      const emptyInput = { left: false, right: false, up: false, down: false, weapon1: false, weapon2: false, weapon3: false, weapon4: false, weapon5: false, mute: false, restart: false, pause: false };
      player.update(deltaTime, emptyInput, this.canvas.width, this.canvas.height, this.infiniteTileRenderer);
      this.entityManager.update(deltaTime, { x: player.x, y: player.y });
      this.waveManager.update(deltaTime);
      return;
    }

    // Periodically save session stats during gameplay
    const now = Date.now();
    if (now - this.lastStatsSaveTime >= this.STATS_SAVE_INTERVAL) {
      this.saveCurrentSessionStats();
    }

    // Check for player death
    if (this.gameStateManager.checkPlayerDeath()) {
      this.handlePlayerDeath();
      return;
    }

    const player = this.entityManager.getPlayer();

    // Update player
    const playerInput = this.inputManager.getInput(this.isPaused);
    player.update(deltaTime, playerInput, this.canvas.width, this.canvas.height, this.infiniteTileRenderer);

    // Update camera
    this.camera.update(player.x + player.width / 2, player.y + player.height / 2, deltaTime);
    if (this.camera.width !== this.canvas.width || this.camera.height !== this.canvas.height) {
      this.camera.setSize(this.canvas.width, this.canvas.height);
    }

    // Update wave system and spawn enemies
    this.waveManager.update(deltaTime);
    const currentEnemyCount = this.entityManager.getEnemies().length;
    const newEnemies = this.waveManager.spawnEnemies(
      this.canvas.width,
      this.canvas.height,
      currentEnemyCount,
      player.getPosition()
    );
    this.entityManager.addEnemies(newEnemies);

    gameState.setWave(this.waveManager.getCurrentWave());

    // Fire player weapon and add projectiles
    const newProjectiles = player.fireWeapon(deltaTime);
    this.entityManager.addProjectiles(newProjectiles);

    // Update all entities managed by EntityManager
    this.entityManager.update(deltaTime, player.getPosition());

    // Handle collisions
    this.collisionHandler.handleAllCollisions();

    // Update game state specific logic (like combo, screen shake, etc.)
    this.gameStateManager.update(deltaTime);

    // Handle boss defeat logic
    if (this.currentBoss && !this.currentBoss.isAlive() && this.isBossActive) {
      this.handleBossDefeated();
    }
  }

  private handlePlayerDeath() {
    const player = this.entityManager.getPlayer();
    this.gameStateManager.handlePlayerDeath(
      player,
      () => {
        this.entityManager.createDeathParticles(player.x, player.y);
        // Also handle player death specific particle effects if any
      }
    );
    // Potentially clear session stats snapshot here or let GameStateManager handle it
  }

  private handleBossDefeated() {
    const gameState = useGameState.getState();
    const audioState = useAudio.getState();

    // Generate boss loot
    const bossLoot = generateBossLoot(this.currentBoss!.x, this.currentBoss!.y, this.currentBoss!.getBossType());
    this.entityManager.addBossLoot(bossLoot);

    // Add experience orbs
    const expValue = Math.max(50, Math.floor(this.currentBoss!.getScoreValue() * 2));
    this.entityManager.addExperienceOrb(new ExperienceOrb(this.currentBoss!.x, this.currentBoss!.y, expValue));

    // Add currency
    const goldValue = Math.max(50, Math.floor(this.currentBoss!.getScoreValue() * 1.5));
    gameState.addCurrency(goldValue);

    // Update boss defeat stats
    gameState.addBossKill();

    // Trigger boss defeated event
    gameState.onBossDefeated();

    if (!audioState.isMuted) {
      audioState.playSuccess();
    }

    this.currentBoss = null;
    this.isBossActive = false;
  }

  private saveCurrentSessionStats() {
    const gameState = useGameState.getState();
    const characterId = gameState.selectedCharacter?.id || "guardian";

    const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);

    StatisticsSystem.saveSessionSnapshot({
      characterId,
      kills: gameState.totalKills,
      wave: gameState.wave,
      level: gameState.level,
      score: gameState.score,
      playTime,
      damageTaken: this.totalDamageTaken,
      damageDealt: this.totalDamageDealt,
      experienceGained: gameState.experience,
      maxCombo: gameState.maxCombo,
      bossesDefeated: gameState.bossesDefeated,
      startTime: this.gameStartTime
    });

    this.lastStatsSaveTime = Date.now();
  }

  private render = (deltaTime: number) => {
    // RenderSystem handles all rendering logic
    this.renderSystem.render(deltaTime);
  }

  private async initializeSprites() {
    await this.spriteManager.loadAllSprites();
  }

  public getPlayer() {
    return this.entityManager.getPlayer();
  }

  public getEnemies() {
    return this.entityManager.getEnemies().map(enemy => ({
      x: enemy.x,
      y: enemy.y,
      isBoss: enemy instanceof BossEnemy // Check against BossEnemy class directly
    }));
  }

  // Debug method to spawn a specific boss
  public spawnDebugBoss(bossType: "necromancer" | "vampire_lord" | "ancient_golem") {
    const player = this.entityManager.getPlayer();
    const boss = this.waveManager.spawnSpecificBoss(
      this.canvas.width,
      this.canvas.height,
      bossType,
      { x: player.x, y: player.y }
    );
    this.entityManager.addEnemies([boss]);
    this.isBossActive = true;
    this.currentBoss = boss;
    
    // Trigger boss warning
    const gameState = useGameState.getState();
    const bossNames = {
      necromancer: "The Necromancer",
      vampire_lord: "Vampire Lord",
      ancient_golem: "Ancient Golem"
    };
    gameState.triggerBossWarning(bossNames[bossType], `A powerful ${bossNames[bossType]} has appeared!`);
  }
}
