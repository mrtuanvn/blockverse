'use client';

import { Suspense, useState, useCallback, useSyncExternalStore, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import dynamic from 'next/dynamic';
import { useGameStore, SCENE_CONFIGS } from '@/game/store';
import type { GameScene } from '@/game/types';

// Dynamic import all scenes (SSR disabled for Three.js)
const LobbyScene = dynamic(() => import('@/game/scenes/LobbyScene'), { ssr: false });
const ObbyScene = dynamic(() => import('@/game/scenes/ObbyScene'), { ssr: false });
const BattleScene = dynamic(() => import('@/game/scenes/BattleScene'), { ssr: false });
const SpeedRunScene = dynamic(() => import('@/game/scenes/SpeedRunScene'), { ssr: false });
const ExplorerScene = dynamic(() => import('@/game/scenes/ExplorerScene'), { ssr: false });
const BuilderScene = dynamic(() => import('@/game/scenes/BuilderScene'), { ssr: false });

const HUD = dynamic(() => import('@/game/components/HUD'), { ssr: false });
const Notification = dynamic(() => import('@/game/components/Notification'), { ssr: false });
const SceneTransition = dynamic(() => import('@/game/components/SceneTransition'), { ssr: false });

const SCENE_COMPONENTS: Record<GameScene, React.LazyExoticComponent<() => JSX.Element>> = {
  lobby: LobbyScene,
  obby: ObbyScene,
  battle: BattleScene,
  speedrun: SpeedRunScene,
  explorer: ExplorerScene,
  builder: BuilderScene,
};

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 z-[200]">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-sm opacity-20"
            style={{
              width: 10 + Math.random() * 30,
              height: 10 + Math.random() * 30,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#fbbf24', '#ef4444', '#22c55e', '#a855f7', '#06b6d4'][i % 5],
              animation: `floatBlock ${3 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Spinning cube */}
        <div className="relative">
          <div
            className="w-20 h-20 border-4 border-yellow-500/30 rounded-lg"
            style={{ animation: 'spinCube 2s ease-in-out infinite' }}
          />
          <div
            className="absolute inset-2 border-4 border-orange-500/50 rounded-lg"
            style={{ animation: 'spinCube 2s ease-in-out infinite reverse' }}
          />
          <div className="absolute inset-4 bg-yellow-500/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🎮</span>
          </div>
        </div>

        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 tracking-wider">
          BLOCKVERSE
        </h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase">Loading your adventure...</p>

        {/* Progress bar */}
        <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
            style={{ animation: 'loadProgress 2s ease-in-out forwards' }}
          />
        </div>

        <div className="flex gap-3 mt-2">
          {['🏃', '⚔️', '🏎️', '🌍', '🏗️'].map((icon, i) => (
            <span
              key={i}
              className="text-2xl opacity-0"
              style={{ animation: `fadeInUp 0.5s ease forwards ${0.8 + i * 0.2}s` }}
            >
              {icon}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spinCube {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
        }
        @keyframes floatBlock {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.1; }
          50% { transform: translateY(-30px) rotate(180deg); opacity: 0.3; }
        }
        @keyframes loadProgress {
          0% { width: 0%; }
          60% { width: 70%; }
          100% { width: 100%; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function GameCanvas() {
  const currentScene = useGameStore((s) => s.game.currentScene);
  const isPlaying = useGameStore((s) => s.game.isPlaying);
  const setScene = useGameStore((s) => s.setScene);
  const startGame = useGameStore((s) => s.startGame);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentScene !== 'lobby' && !isPlaying) {
      startGame();
    }
  }, [currentScene, isPlaying, startGame]);

  const SceneComponent = SCENE_COMPONENTS[currentScene];

  const handleCreated = useCallback((state: any) => {
    state.gl.setClearColor('#1e1b4b');
  }, []);

  if (!isReady) return <LoadingScreen />;

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 relative">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 500, position: [0, 10, 20] }}
        style={{ width: '100%', height: '100%' }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={handleCreated}
      >
        <Physics gravity={[0, -20, 0]} debug={false}>
          <Suspense fallback={null}>
            <SceneComponent />
          </Suspense>
        </Physics>
      </Canvas>

      {/* HTML Overlays */}
      <HUD />
      <Notification />
      <SceneTransition />

      {/* Scene-specific overlays for builder (toolbar handled inside BuilderScene) */}
      {currentScene === 'lobby' && <LobbyInfoBar />}
    </div>
  );
}

function LobbyInfoBar() {
  const player = useGameStore((s) => s.player);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 px-6 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 font-bold text-lg">⭐</span>
        <span className="text-white font-bold">{player.totalScore}</span>
      </div>
      <div className="w-px h-5 bg-white/20" />
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 font-bold text-lg">🪙</span>
        <span className="text-white font-bold">{player.coins}</span>
      </div>
      <div className="w-px h-5 bg-white/20" />
      <div className="flex items-center gap-2">
        <span className="text-purple-400 font-bold text-lg">Lv.{player.level}</span>
        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-400 rounded-full transition-all duration-300"
            style={{ width: `${(player.xp / (player.level * 100)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SceneSelector({ onSelect }: { onSelect: (scene: GameScene) => void }) {
  const currentScene = useGameStore((s) => s.game.currentScene);
  const player = useGameStore((s) => s.player);
  const scenes = Object.values(SCENE_CONFIGS).filter((s) => s.id !== 'lobby');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/80 to-transparent pt-16 pb-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => onSelect(scene.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                currentScene === scene.id
                  ? 'bg-white/20 scale-110 ring-2 ring-white/30'
                  : 'bg-white/5 hover:bg-white/10 hover:scale-105'
              }`}
            >
              <span className="text-2xl">{scene.icon}</span>
              <span className="text-white text-xs font-medium whitespace-nowrap">{scene.name}</span>
              {player.highScores[scene.id] > 0 && (
                <span className="text-yellow-400 text-[10px] font-bold">
                  🏆 {player.highScores[scene.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950">
      <Suspense fallback={<LoadingScreen />}>
        <GameCanvas />
      </Suspense>
    </div>
  );
}