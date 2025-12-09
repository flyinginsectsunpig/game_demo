
import { useState, useEffect } from "react";
import { useGameState } from "../lib/stores/useGameState";
import { PersistentProgressionSystem } from "../lib/game/systems/PersistentProgressionSystem";
import { StatisticsSystem } from "../lib/game/systems/StatisticsSystem";
import { GameEngine } from "../lib/game/GameEngine";

interface DebugTestingScreenProps {
  onClose: () => void;
  engine: GameEngine | null;
}

export default function DebugTestingScreen({ onClose, engine }: DebugTestingScreenProps) {
  const gameState = useGameState.getState();
  const [persistentData, setPersistentData] = useState(PersistentProgressionSystem.load());
  const [statistics, setStatistics] = useState(StatisticsSystem.load());

  const refresh = () => {
    setPersistentData(PersistentProgressionSystem.load());
    setStatistics(StatisticsSystem.load());
  };

  useEffect(() => {
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  // Test functions
  const addGold = (amount: number) => {
    PersistentProgressionSystem.addCurrency(amount);
    refresh();
  };

  const addHealth = (amount: number) => {
    gameState.heal(amount);
  };

  const setMaxHealth = (amount: number) => {
    gameState.setMaxHealth(amount);
    gameState.heal(amount);
  };

  const addExperience = (amount: number) => {
    gameState.addExperience(amount);
  };

  const setLevel = (level: number) => {
    useGameState.setState({ level, experience: 0, experienceToNext: Math.floor(100 * Math.pow(1.5, level - 1)) });
  };

  const setWave = (wave: number) => {
    gameState.setWave(wave);
  };

  const simulateBossKill = () => {
    gameState.addBossKill();
    gameState.addScore(1000);
    addGold(100);
    refresh();
  };

  const addKills = (amount: number) => {
    // Add to current game state
    for (let i = 0; i < amount; i++) {
      gameState.addKill();
    }
    
    // Also update persistent progression
    const persistentData = PersistentProgressionSystem.load();
    persistentData.totalKills += amount;
    PersistentProgressionSystem.save(persistentData);
    
    // Update statistics system as well
    const stats = StatisticsSystem.load();
    stats.totalKills += amount;
    StatisticsSystem.save(stats);
    
    refresh();
  };

  const resetAllProgress = () => {
    if (confirm("Are you sure you want to reset ALL progress? This cannot be undone!")) {
      PersistentProgressionSystem.reset();
      StatisticsSystem.reset();
      localStorage.clear();
      refresh();
      alert("All progress reset!");
    }
  };

  const spawnBoss = (bossType: "necromancer" | "vampire_lord" | "ancient_golem") => {
    if (!engine) {
      alert("Game engine not ready!");
      return;
    }
    engine.spawnDebugBoss(bossType);
  };

  const maxOutUpgrade = (upgrade: keyof typeof persistentData.permanentUpgrades) => {
    for (let i = 0; i < 10; i++) {
      PersistentProgressionSystem.upgradePermanent(upgrade);
    }
    refresh();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ background: 'linear-gradient(180deg, rgba(10, 6, 8, 0.95) 0%, rgba(18, 9, 18, 0.98) 100%)' }}>
      <div className="gothic-vignette" />
      <div className="gothic-panel p-8 rounded-lg max-w-6xl w-full my-8 relative z-10 max-h-[90vh] overflow-y-auto">
        <div className="gothic-divider mb-6" />
        
        <h1 className="gothic-title text-4xl font-bold text-center mb-8" style={{ color: '#c9a23f' }}>
          DEBUG / TESTING PANEL
        </h1>

        {/* Current State */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="gothic-panel p-4 rounded-lg" style={{ borderColor: '#2b193d' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#9b7cb8', fontFamily: 'Cinzel, serif' }}>
              Current Game State
            </h3>
            <div className="space-y-1 text-sm" style={{ color: '#d9d1c5' }}>
              <div>Health: {Math.floor(gameState.health)}/{gameState.maxHealth}</div>
              <div>Level: {gameState.level}</div>
              <div>XP: {gameState.experience}/{gameState.experienceToNext}</div>
              <div>Wave: {gameState.wave}</div>
              <div>Score: {gameState.score}</div>
              <div>Kills: {gameState.totalKills}</div>
              <div>Bosses: {gameState.bossesDefeated}</div>
              <div>Combo: {gameState.comboCount}x ({gameState.comboMultiplier.toFixed(1)}x)</div>
            </div>
          </div>

          <div className="gothic-panel p-4 rounded-lg" style={{ borderColor: '#2b193d' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#c9a23f', fontFamily: 'Cinzel, serif' }}>
              Persistent Progress
            </h3>
            <div className="space-y-1 text-sm" style={{ color: '#d9d1c5' }}>
              <div>Gold: {persistentData.currency}</div>
              <div>Total Runs: {persistentData.totalRuns}</div>
              <div>Total Kills: {persistentData.totalKills}</div>
              <div>High Score: {persistentData.highScore}</div>
              <div>Max Wave: {persistentData.statistics.maxWave}</div>
              <div>Max Combo: {persistentData.statistics.maxCombo}</div>
            </div>
          </div>

          <div className="gothic-panel p-4 rounded-lg" style={{ borderColor: '#2b193d' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#7cb87c', fontFamily: 'Cinzel, serif' }}>
              Statistics
            </h3>
            <div className="space-y-1 text-sm" style={{ color: '#d9d1c5' }}>
              <div>Total Runs: {statistics.totalRuns}</div>
              <div>Total Kills: {statistics.totalKills}</div>
              <div>Bosses Defeated: {statistics.bossesDefeated}</div>
              <div>Highest Wave: {statistics.highestWave}</div>
              <div>Damage Dealt: {Math.floor(statistics.totalDamageDealt)}</div>
              <div>Damage Taken: {Math.floor(statistics.totalDamageTaken)}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3" style={{ color: '#c9a23f', fontFamily: 'Cinzel, serif' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={() => addGold(100)} className="gothic-button gothic-button-primary text-xs py-2">
              +100 Gold
            </button>
            <button onClick={() => addGold(1000)} className="gothic-button gothic-button-primary text-xs py-2">
              +1000 Gold
            </button>
            <button onClick={() => addHealth(50)} className="gothic-button text-xs py-2" style={{ background: '#1f4d1f', borderColor: '#2d7d2d' }}>
              +50 Health
            </button>
            <button onClick={() => setMaxHealth(200)} className="gothic-button text-xs py-2" style={{ background: '#1f4d1f', borderColor: '#2d7d2d' }}>
              Max Health 200
            </button>
            <button onClick={() => addExperience(100)} className="gothic-button text-xs py-2" style={{ background: '#4d3d1f', borderColor: '#7d6d2d' }}>
              +100 XP
            </button>
            <button onClick={() => setLevel(10)} className="gothic-button text-xs py-2" style={{ background: '#4d3d1f', borderColor: '#7d6d2d' }}>
              Set Level 10
            </button>
            <button onClick={() => setWave(5)} className="gothic-button text-xs py-2" style={{ background: '#4d1f1f', borderColor: '#7d2d2d' }}>
              Jump to Wave 5
            </button>
            <button onClick={() => setWave(10)} className="gothic-button text-xs py-2" style={{ background: '#4d1f1f', borderColor: '#7d2d2d' }}>
              Jump to Wave 10
            </button>
            <button onClick={() => addKills(50)} className="gothic-button text-xs py-2" style={{ background: '#3d1f4d', borderColor: '#5d2d7d' }}>
              +50 Kills
            </button>
            <button onClick={simulateBossKill} className="gothic-button text-xs py-2" style={{ background: '#3d1f4d', borderColor: '#5d2d7d' }}>
              Simulate Boss Kill
            </button>
            <button onClick={() => spawnBoss("necromancer")} className="gothic-button text-xs py-2" style={{ background: '#1f1f4d', borderColor: '#2d2d7d' }}>
              Summon Necromancer
            </button>
            <button onClick={() => spawnBoss("vampire_lord")} className="gothic-button text-xs py-2" style={{ background: '#4d1f1f', borderColor: '#7d2d2d' }}>
              Summon Vampire Lord
            </button>
            <button onClick={() => spawnBoss("ancient_golem")} className="gothic-button text-xs py-2" style={{ background: '#1f4d1f', borderColor: '#2d7d2d' }}>
              Summon Ancient Golem
            </button>
            <button onClick={() => gameState.showLevelUp()} className="gothic-button text-xs py-2" style={{ background: '#4d3d1f', borderColor: '#7d6d2d' }}>
              Trigger Level Up
            </button>
          </div>
        </div>

        {/* Upgrade Testing */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3" style={{ color: '#c9a23f', fontFamily: 'Cinzel, serif' }}>
            Upgrade Testing
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <button onClick={() => maxOutUpgrade('maxHealth')} className="gothic-button text-xs py-2">
              Max Health +10
            </button>
            <button onClick={() => maxOutUpgrade('damage')} className="gothic-button text-xs py-2">
              Max Damage +10
            </button>
            <button onClick={() => maxOutUpgrade('speed')} className="gothic-button text-xs py-2">
              Max Speed +10
            </button>
            <button onClick={() => maxOutUpgrade('pickupRange')} className="gothic-button text-xs py-2">
              Max Pickup +10
            </button>
            <button onClick={() => maxOutUpgrade('luck')} className="gothic-button text-xs py-2">
              Max Luck +10
            </button>
          </div>
          <div className="mt-2 text-xs" style={{ color: '#8b8b8b' }}>
            Current Upgrades: Health {persistentData.permanentUpgrades.maxHealth}, 
            Damage {persistentData.permanentUpgrades.damage}, 
            Speed {persistentData.permanentUpgrades.speed}, 
            Pickup {persistentData.permanentUpgrades.pickupRange}, 
            Luck {persistentData.permanentUpgrades.luck}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3" style={{ color: '#8b2635', fontFamily: 'Cinzel, serif' }}>
            Danger Zone
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button onClick={resetAllProgress} className="gothic-button text-xs py-2" style={{ background: '#5c1f2a', borderColor: '#8b2635' }}>
              ⚠️ Reset ALL Progress (Irreversible!)
            </button>
            <button onClick={() => { localStorage.clear(); refresh(); alert("LocalStorage cleared!"); }} className="gothic-button text-xs py-2" style={{ background: '#5c1f2a', borderColor: '#8b2635' }}>
              Clear LocalStorage
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="gothic-button gothic-button-primary flex-1 px-6 py-3 rounded-lg text-sm">
            Close
          </button>
          <button onClick={refresh} className="gothic-button px-6 py-3 rounded-lg text-sm">
            Refresh Data
          </button>
        </div>
        
        <div className="gothic-divider mt-6" />
      </div>
    </div>
  );
}
