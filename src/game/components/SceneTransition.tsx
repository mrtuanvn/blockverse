'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, SCENE_CONFIGS } from '@/game/store';
import type { GameScene } from '@/game/types';

interface SceneTransitionProps {
  onTransitionComplete?: (scene: GameScene) => void;
}

export default function SceneTransition({ onTransitionComplete }: SceneTransitionProps) {
  const game = useGameStore((s) => s.game);
  const updateTransition = useGameStore((s) => s.updateTransition);
  const previousScene = useGameStore((s) => s.game.previousScene);
  const animationRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const sceneConfig = SCENE_CONFIGS[game.currentScene];

  useEffect(() => {
    if (!game.isTransitioning) {
      completedRef.current = false;
      return;
    }

    completedRef.current = false;
    const startTime = performance.now();
    const duration = 1500;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      updateTransition(progress);

      if (progress >= 1 && !completedRef.current) {
        completedRef.current = true;
        if (onTransitionComplete) {
          onTransitionComplete(game.currentScene);
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [game.isTransitioning, game.currentScene, updateTransition, onTransitionComplete]);

  // Fade in: 0-0.5, Hold: 0.5-0.8, Fade out: 0.8-1.0
  let opacity = 0;
  if (game.transitionProgress < 0.5) {
    opacity = game.transitionProgress / 0.5;
  } else if (game.transitionProgress < 0.8) {
    opacity = 1;
  } else {
    opacity = 1 - (game.transitionProgress - 0.8) / 0.2;
  }

  const showContent = game.transitionProgress > 0.3 && game.transitionProgress < 0.9;

  return (
    <AnimatePresence>
      {game.isTransitioning && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <AnimatePresence>
            {showContent && (
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <motion.div
                  className="text-6xl"
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {sceneConfig.icon}
                </motion.div>
                <motion.h2
                  className="text-white text-3xl sm:text-4xl font-black"
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {sceneConfig.name}
                </motion.h2>
                <motion.p
                  className="text-white/60 text-sm sm:text-base max-w-xs text-center"
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {sceneConfig.description}
                </motion.p>
                <motion.div
                  className="mt-2"
                  initial={{ width: 0 }}
                  animate={{ width: 120 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="h-1 rounded-full overflow-hidden bg-white/20">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: sceneConfig.color }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ delay: 0.3, duration: 1, ease: 'linear' }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}