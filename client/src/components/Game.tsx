import { useEffect, useRef, useState } from "react";
import GameCanvas from "./GameCanvas";
import GameUI from "./GameUI";
import PowerUpSelection from "./PowerUpSelection";
import CharacterSelection from "./CharacterSelection";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { CharacterType } from "./CharacterSelection";
import PauseMenu from "./PauseMenu";
import SettingsMenu from "./SettingsMenu";
import { GameEngine } from "../lib/game/GameEngine";
import GameOverScreen from "./GameOverScreen";
import StatisticsScreen from "./StatisticsScreen";
import LevelUpEffect from "./LevelUpEffect";
import UpgradeShop from "./UpgradeShop";
import DebugTestingScreen from "./DebugTestingScreen";
import { StatisticsSystem } from "../lib/game/systems/StatisticsSystem";

type ModalSource = "mainMenu" | "pauseMenu" | "gameplay" | null;

export default function Game() {
  const { phase, restart, resumeFromLevelUp, selectCharacter, resume, pause } = useGameState();
  const { setBackgroundMusic, setHitSound, setSuccessSound, toggleMute } = useAudio();
  const audioInitialized = useRef(false);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showUpgradeShop, setShowUpgradeShop] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [modalSource, setModalSource] = useState<ModalSource>(null);
  const wasPlayingBeforeDebugRef = useRef(false);

  // Recover any orphaned session from a previous crash/refresh
  useEffect(() => {
    const recovered = StatisticsSystem.recoverOrphanedSession();
    if (recovered) {
      console.log('[Game] Recovered orphaned session from previous run');
    }
  }, []);

  // Handle pause/resume when debug screen opens/closes
  useEffect(() => {
    if (showDebug) {
      // Opening debug screen - pause if we were playing
      if (wasPlayingBeforeDebugRef.current) {
        pause();
      }
    } else {
      // Closing debug screen - resume if we were playing before
      if (wasPlayingBeforeDebugRef.current) {
        wasPlayingBeforeDebugRef.current = false;
        resume();
      }
    }
  }, [showDebug, pause, resume]);

  useEffect(() => {
    const initAudio = async () => {
      if (audioInitialized.current) return;
      audioInitialized.current = true;
      console.log("Audio system initialized (files optional)");
    };

    const handleFirstInteraction = () => {
      initAudio();
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };

    const handleDebugKey = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        
        const gameState = useGameState.getState();
        
        if (!showDebug) {
          // Opening debug screen
          if (gameState.phase === "ready") {
            setModalSource("mainMenu");
          } else if (gameState.phase === "paused") {
            setModalSource("pauseMenu");
          } else if (gameState.phase === "playing") {
            setModalSource("gameplay");
            wasPlayingBeforeDebugRef.current = true;
          }
          setShowDebug(true);
        } else {
          // Closing debug screen
          setShowDebug(false);
        }
      }
    };

    document.addEventListener("click", handleFirstInteraction);
    document.addEventListener("keydown", handleFirstInteraction);
    document.addEventListener("keydown", handleDebugKey);

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
      document.removeEventListener("keydown", handleDebugKey);
    };
  }, []);

  const handlePowerUpSelect = (powerUp: any) => {
    if (engine?.getPlayer && powerUp.apply) {
      powerUp.apply(engine.getPlayer());
    }
    resumeFromLevelUp();
  };

  const handleCharacterSelect = (character: CharacterType) => {
    selectCharacter(character);
  };

  const handleCloseModal = () => {
    setShowStatistics(false);
    setShowUpgradeShop(false);
    setShowSettings(false);
    setShowDebug(false);
    setModalSource(null);
  };

  const openFromMainMenu = (modalType: "statistics" | "shop" | "settings" | "debug") => {
    setModalSource("mainMenu");
    if (modalType === "statistics") setShowStatistics(true);
    if (modalType === "shop") setShowUpgradeShop(true);
    if (modalType === "settings") setShowSettings(true);
    if (modalType === "debug") setShowDebug(true);
  };

  const openFromPauseMenu = (modalType: "statistics" | "shop" | "settings") => {
    setModalSource("pauseMenu");
    if (modalType === "statistics") setShowStatistics(true);
    if (modalType === "shop") setShowUpgradeShop(true);
    if (modalType === "settings") setShowSettings(true);
  };

  // Handle screens that should completely replace the game view
  if (phase === "gameOver" || phase === "ended") {
    return (
      <div className="relative w-full h-full">
        <GameOverScreen />
      </div>
    );
  }

  if (phase === "characterSelect") {
    return (
      <div className="relative w-full h-full">
        <CharacterSelection onSelect={handleCharacterSelect} onClose={resumeFromLevelUp} />
      </div>
    );
  }

  // Main game view with overlays
  return (
    <div className="relative w-full h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      <GameCanvas onEngineReady={setEngine} />
      <GameUI 
        onShowUpgradeShop={() => openFromMainMenu("shop")}
        onShowStatistics={() => openFromMainMenu("statistics")}
        onShowSettings={() => openFromMainMenu("settings")}
        onShowDebug={() => openFromMainMenu("debug")}
      />
      <LevelUpEffect />

      {phase === "levelUp" && (
        <PowerUpSelection
          onSelect={handlePowerUpSelect}
          onClose={resumeFromLevelUp}
        />
      )}

      {phase === "paused" && (
        <PauseMenu
          onShowSettings={() => openFromPauseMenu("settings")}
          onShowStatistics={() => openFromPauseMenu("statistics")}
          onShowUpgradeShop={() => openFromPauseMenu("shop")}
        />
      )}

      {showDebug && (
        <DebugTestingScreen onClose={handleCloseModal} engine={engine} />
      )}

      {showSettings && (
        <SettingsMenu onClose={handleCloseModal} />
      )}

      {showStatistics && (
        <StatisticsScreen onClose={handleCloseModal} />
      )}

      {showUpgradeShop && (
        <UpgradeShop onClose={handleCloseModal} />
      )}
    </div>
  );
}
