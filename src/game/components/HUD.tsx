'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, SCENE_CONFIGS } from '@/game/store';
import { Pause, Heart, Coins, RotateCcw, Home } from 'lucide-react';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HUD() {
  const game = useGameStore((s) => s.game);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const setScene = useGameStore((s) => s.setScene);
  const endGame = useGameStore((s) => s.endGame);
  const startGame = useGameStore((s) => s.startGame);

  const comboAnimKey = game.combo;

  const healthPercent = (game.health / game.maxHealth) * 100;
  const healthColor =
    healthPercent > 50 ? 'bg-green-500' : healthPercent > 25 ? 'bg-amber-500' : 'bg-red-500';

  const sceneConfig = SCENE_CONFIGS[game.currentScene];

  const handlePause = () => {
    if (game.isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  };

  const handleBackToLobby = () => {
    resumeGame();
    setScene('lobby');
  };

  const handlePlayAgain = () => {
    endGame();
    startGame();
  };

  if (!game.showHUD) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Score */}
        <motion.div
          className="rounded-xl bg-black/50 backdrop-blur-sm px-4 py-2 flex items-center gap-2"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-bold text-sm sm:text-lg tabular-nums">
            {Math.floor(game.score)}
          </span>
        </motion.div>

        {/* Scene Name */}
        <motion.div
          className="rounded-xl bg-black/50 backdrop-blur-sm px-4 py-2 text-center"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <span className="text-white font-bold text-sm sm:text-lg">
            {sceneConfig.icon} {sceneConfig.name}
          </span>
        </motion.div>

        {/* Timer */}
        <motion.div
          className="rounded-xl bg-black/50 backdrop-blur-sm px-4 py-2 flex items-center gap-2"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-white font-mono font-bold text-sm sm:text-lg tabular-nums">
            {formatTime(game.timeElapsed)}
          </span>
        </motion.div>
      </div>

      {/* Bottom Bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 sm:px-6 sm:pb-6"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="flex items-end justify-between gap-3">
          {/* Health Bar */}
          <div className="flex-1 max-w-xs">
            <div className="rounded-xl bg-black/50 backdrop-blur-sm p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="text-white/80 text-xs font-medium">HP</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${healthColor}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${healthPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>

          {/* Lives */}
          <div className="rounded-xl bg-black/50 backdrop-blur-sm px-3 py-2.5 flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 ${i < game.lives ? 'text-red-400 fill-red-400' : 'text-gray-600'}`}
              />
            ))}
          </div>

          {/* Coins */}
          <div className="rounded-xl bg-black/50 backdrop-blur-sm px-3 py-2.5 flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-bold text-sm tabular-nums">{game.coins}</span>
          </div>

          {/* Combo */}
          <AnimatePresence mode="wait">
            {game.combo > 1 && (
              <motion.div
                key={comboAnimKey}
                className="rounded-xl bg-black/50 backdrop-blur-sm px-4 py-2.5"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <span className="text-yellow-400 font-black text-lg">x{game.combo}!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Pause Button */}
      <button
        onClick={handlePause}
        className="absolute top-3 right-3 sm:top-4 sm:right-20 pointer-events-auto rounded-lg bg-black/50 backdrop-blur-sm p-2 hover:bg-black/70 transition-colors"
      >
        <Pause className="w-5 h-5 text-white" />
      </button>

      {/* Pause Overlay */}
      <AnimatePresence>
        {game.isPaused && (
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-gray-900/90 rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-4 min-w-[280px]"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <h2 className="text-white text-2xl font-bold">Paused</h2>
              <button
                onClick={handlePause}
                className="w-full py-3 px-6 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-colors"
              >
                Resume
              </button>
              <button
                onClick={handleBackToLobby}
                className="w-full py-3 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {game.isGameOver && (
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-gray-900/90 rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-4 min-w-[300px]"
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 250, damping: 20 }}
            >
              <h2 className="text-red-400 text-3xl font-black">Game Over</h2>
              <div className="text-center space-y-1">
                <p className="text-white/60 text-sm">Final Score</p>
                <p className="text-white text-4xl font-black tabular-nums">
                  {Math.floor(game.score)}
                </p>
                <div className="flex items-center justify-center gap-4 mt-2 text-white/60 text-sm">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-yellow-400" />
                    {game.coins} coins
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    {game.lives} lives
                  </span>
                </div>
              </div>
              <button
                onClick={handlePlayAgain}
                className="w-full py-3 px-6 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
              <button
                onClick={handleBackToLobby}
                className="w-full py-3 px-6 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}