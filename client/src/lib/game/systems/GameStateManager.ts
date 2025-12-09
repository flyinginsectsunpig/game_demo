
import { ComboSystem } from './ComboSystem';
import { ScreenShakeSystem } from '../rendering/ScreenShake';
import { StatisticsSystem } from './StatisticsSystem';
import { PersistentProgressionSystem } from './PersistentProgressionSystem';
import { InputManager } from './InputManager';
import { useGameState } from '../../stores/useGameState';
import { useAudio } from '../../stores/useAudio';

export class GameStateManager {
  private comboSystem: ComboSystem;
  private screenShake: ScreenShakeSystem;
  private gameStartTime: number;
  private totalDamageDealt: number = 0;
  private totalDamageTaken: number = 0;
  private lastStatsSaveTime: number = 0;
  private readonly STATS_SAVE_INTERVAL: number = 30000;
  private lastPauseState: boolean = false;

  constructor() {
    this.comboSystem = new ComboSystem();
    this.screenShake = new ScreenShakeSystem();
    this.gameStartTime = Date.now();
  }

  public reset() {
    this.comboSystem = new ComboSystem();
    this.gameStartTime = Date.now();
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    
    const gameState = useGameState.getState();
    gameState.setBossActive(false);
    gameState.hideBossWarning();
    gameState.resetCombo();
    
    const persistentData = PersistentProgressionSystem.load();
    useGameState.setState({ currency: persistentData.currency });
  }

  public update(deltaTime: number) {
    this.comboSystem.update(deltaTime);
    const comboCount = this.comboSystem.getComboCount();
    const comboMultiplier = this.comboSystem.getComboMultiplier();
    const comboTimeRemaining = this.comboSystem.getTimeRemaining();
    
    const gameState = useGameState.getState();
    gameState.updateCombo(comboCount, comboMultiplier);
    gameState.setCombo(comboCount, comboMultiplier, comboTimeRemaining);
    
    this.screenShake.update(deltaTime);

    // Periodically save session stats
    const now = Date.now();
    if (now - this.lastStatsSaveTime >= this.STATS_SAVE_INTERVAL) {
      this.saveCurrentSessionStats();
    }
  }

  public setupInputHandlers(inputManager: InputManager, resetCallback: () => void) {
    const handleStart = (e: Event) => {
      if (e instanceof MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.tagName === "BUTTON" || target.closest("button")) {
          return;
        }
      }
      
      const gameState = useGameState.getState();
      if (gameState.phase === "ready") {
        gameState.start();
        const audioState = useAudio.getState();
        if (audioState.backgroundMusic && !audioState.isMuted) {
          audioState.backgroundMusic.play().catch(console.warn);
        }
      }
    };

    const handleRestart = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        const gameState = useGameState.getState();
        if (gameState.phase === "gameOver" || gameState.phase === "playing") {
          gameState.restart();
          resetCallback();
        }
      }
    };

    const handleSoundToggle = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        const audioState = useAudio.getState();
        audioState.toggleMute();

        if (audioState.backgroundMusic) {
          if (audioState.isMuted) {
            audioState.backgroundMusic.pause();
          } else {
            audioState.backgroundMusic.play().catch(console.warn);
          }
        }
      }
    };

    const handleWindowBlur = () => {
      const gameState = useGameState.getState();
      if (gameState.phase === "playing") {
        gameState.pause();
      }
    };

    document.addEventListener("keydown", handleStart);
    document.addEventListener("click", handleStart);
    document.addEventListener("keydown", handleRestart);
    document.addEventListener("keydown", handleSoundToggle);
    window.addEventListener("blur", handleWindowBlur);
  }

  public handlePauseInput(input: any, inputManager?: InputManager): boolean {
    const gameState = useGameState.getState();

    if (input.pause && !this.lastPauseState) {
      if (gameState.phase === "playing") {
        this.saveCurrentSessionStats();
        gameState.pause();
        this.lastPauseState = input.pause;
        return true;
      } else if (gameState.phase === "paused") {
        gameState.resume();
        this.lastPauseState = input.pause;
        return true;
      }
    }
    this.lastPauseState = input.pause;
    return false;
  }

  public checkPlayerDeath(): boolean {
    const gameState = useGameState.getState();
    return gameState.health <= 0 && gameState.phase === "playing";
  }

  public handlePlayerDeath(player: any, createDeathParticles: () => void) {
    const gameState = useGameState.getState();
    const audioState = useAudio.getState();
    
    createDeathParticles();
    
    const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const characterId = gameState.selectedCharacter?.id || "guardian";
    const currencyEarned = Math.floor(gameState.score / 100) + (gameState.wave * 10);
    
    StatisticsSystem.recordRun({
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
      bossesDefeated: gameState.bossesDefeated
    });
    
    PersistentProgressionSystem.recordRunEnd(
      gameState.score,
      gameState.wave,
      gameState.totalKills,
      gameState.maxCombo,
      gameState.bossesDefeated,
      playTime
    );
    
    PersistentProgressionSystem.addCurrency(currencyEarned);
    
    const savedProgression = PersistentProgressionSystem.load();
    useGameState.setState({ currency: savedProgression.currency });
    
    StatisticsSystem.clearSessionSnapshot();
    
    if (!audioState.isMuted) {
      audioState.playPlayerHurt();
    }
    
    setTimeout(() => {
      gameState.end();
    }, 50);
  }

  public handleBossWarning(wave: number) {
    const bossTypes = ["necromancer", "vampire_lord", "ancient_golem"];
    const bossIndex = Math.floor((wave / 5) - 1) % bossTypes.length;
    
    const bossInfo = {
      necromancer: { name: "The Necromancer", description: "Master of death, commands the undead" },
      vampire_lord: { name: "Vampire Lord", description: "Ancient bloodsucker with supernatural speed" },
      ancient_golem: { name: "Ancient Golem", description: "Stone guardian with impenetrable defense" }
    };
    
    const info = bossInfo[bossTypes[bossIndex] as keyof typeof bossInfo];
    const gameState = useGameState.getState();
    gameState.triggerBossWarning(info.name, info.description);
  }

  public handleBossSpawn(boss: any) {
    const gameState = useGameState.getState();
    gameState.setBossActive(true);
    gameState.setBossInfo(boss.getBossName(), boss.getBossDescription());
    gameState.updateBossHealth(boss.getHealth(), boss.getMaxHealth());
  }

  private saveCurrentSessionStats() {
    const gameState = useGameState.getState();
    
    if (gameState.phase !== "playing" && gameState.phase !== "paused") {
      return;
    }
    
    const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const characterId = gameState.selectedCharacter?.id || "guardian";
    
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

  public addKill() {
    this.comboSystem.addKill();
    useGameState.getState().addKill();
  }

  public getComboMultiplier(): number {
    return this.comboSystem.getComboMultiplier();
  }

  public addDamageDealt(damage: number) {
    this.totalDamageDealt += damage;
  }

  public addDamageTaken(damage: number) {
    this.totalDamageTaken += damage;
  }

  public getScreenShake() {
    return this.screenShake;
  }
}
