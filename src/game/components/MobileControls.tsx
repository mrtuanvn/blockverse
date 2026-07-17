'use client';

import { useRef, useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  setMovement,
  setJump,
  setAttack,
  addCameraDelta,
  setTouchActive,
  isMobileDevice,
} from '@/game/hooks/useInputState';
import { useGameStore } from '@/game/store';

// ─── Virtual Joystick ───
function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  const maxDist = 40;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    const rect = baseRef.current!.getBoundingClientRect();
    center.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setTouchActive(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== activeTouchId.current) continue;

      const dx = touch.clientX - center.current.x;
      const dy = touch.clientY - center.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
      }

      const normalizedDist = clampedDist / maxDist;
      setMovement(
        Math.cos(angle) * normalizedDist,
        Math.sin(angle) * normalizedDist
      );
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        if (knobRef.current) {
          knobRef.current.style.transform = 'translate(0px, 0px)';
        }
        setMovement(0, 0);
        setTouchActive(false);
      }
    }
  }, []);

  return (
    <div
      ref={baseRef}
      className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center touch-none select-none"
      style={{ pointerEvents: 'auto' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span className="absolute top-1.5 text-white/30 text-xs font-bold">W</span>
      <span className="absolute bottom-1.5 text-white/30 text-xs font-bold">S</span>
      <span className="absolute left-2.5 text-white/30 text-xs font-bold">A</span>
      <span className="absolute right-2.5 text-white/30 text-xs font-bold">D</span>
      <div
        ref={knobRef}
        className="w-14 h-14 rounded-full bg-white/30 border-2 border-white/50 shadow-lg transition-none"
        style={{ transform: 'translate(0px, 0px)' }}
      />
    </div>
  );
}

// ─── Action Button ───
function ActionButton({
  label,
  icon,
  color,
  size = 16,
  onPress,
  onRelease,
}: {
  label: string;
  icon: string;
  color: string;
  size?: number;
  onPress: () => void;
  onRelease: () => void;
}) {
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPress();
    },
    [onPress]
  );
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRelease();
    },
    [onRelease]
  );
  const handleTouchCancel = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRelease();
    },
    [onRelease]
  );

  return (
    <button
      className="flex flex-col items-center justify-center rounded-full touch-none select-none active:scale-90 transition-transform"
      style={{
        pointerEvents: 'auto',
        width: size * 4,
        height: size * 4,
        backgroundColor: color,
        border: '2px solid rgba(255,255,255,0.3)',
        boxShadow: `0 0 15px ${color}40`,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[10px] text-white/80 font-bold mt-0.5">{label}</span>
    </button>
  );
}

// ─── Camera Touch Area ───
// Full screen but at LOW z-index, only catches touches that pass through
// joystick/buttons (which have higher z-index + pointer-events: auto)
function CameraTouchArea() {
  const lastTouch = useRef<{ x: number; y: number; id: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!lastTouch.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== lastTouch.current.id) continue;
      const dx = touch.clientX - lastTouch.current.x;
      const dy = touch.clientY - lastTouch.current.y;
      lastTouch.current.x = touch.clientX;
      lastTouch.current.y = touch.clientY;
      addCameraDelta(dx * 0.005, dy * 0.005);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lastTouch.current?.id) {
        lastTouch.current = null;
      }
    }
  }, []);

  return (
    <div
      className="fixed inset-0 touch-none"
      style={{ pointerEvents: 'auto', zIndex: 15 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    />
  );
}

// ─── Fullscreen Button ───
function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // iOS Safari fallback: try webkit
      const el = document.documentElement as any;
      if (!el.webkitFullscreenElement) {
        el.webkitRequestFullscreen?.();
        setIsFullscreen(true);
      } else {
        el.webkitExitFullscreen?.();
        setIsFullscreen(false);
      }
    }
  }, []);

  // Sync with actual fullscreen state
  const handleChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, [handleChange]);

  return (
    <button
      className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
      style={{ pointerEvents: 'auto' }}
      onClick={toggleFullscreen}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); }}
    >
      <span className="text-white text-lg">{isFullscreen ? '⛶' : '⛶'}</span>
    </button>
  );
}

// ─── Main MobileControls ───
export default function MobileControls() {
  const currentScene = useGameStore((s) => s.game.currentScene);
  const isBuilder = currentScene === 'builder';
  const isLobby = currentScene === 'lobby';
  const show = useSyncExternalStore(
    () => () => {},
    () => isMobileDevice(),
    () => false
  );

  if (!show || isBuilder) return null;

  return (
    <>
      {/* Camera touch area — z-15, below all controls */}
      <CameraTouchArea />

      {/* Top-left: Pause + Fullscreen */}
      <div className="fixed top-3 left-3 flex flex-col gap-2" style={{ zIndex: 60, pointerEvents: 'auto' }}>
        <MobilePauseButton />
        <FullscreenButton />
      </div>

      {/* Joystick — bottom left, z-30 */}
      <div className="fixed bottom-4 left-4" style={{ zIndex: 30, pointerEvents: 'none' }}>
        <VirtualJoystick />
      </div>

      {/* Action buttons — bottom right, z-30 */}
      <div className="fixed bottom-6 right-4 flex flex-col items-center gap-3" style={{ zIndex: 30, pointerEvents: 'none' }}>
        {/* Jump button */}
        <ActionButton
          label="Nhảy"
          icon="⬆"
          color="rgba(34, 197, 94, 0.6)"
          size={18}
          onPress={() => setJump(true)}
          onRelease={() => setJump(false)}
        />

        {/* Secondary row: Attack */}
        {!isLobby && (
          <ActionButton
            label="Đánh"
            icon="⚔"
            color="rgba(239, 68, 68, 0.6)"
            size={15}
            onPress={() => setAttack(true)}
            onRelease={() => setAttack(false)}
          />
        )}
      </div>
    </>
  );
}

function MobilePauseButton() {
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const isPaused = useGameStore((s) => s.game.isPaused);
  const setScene = useGameStore((s) => s.setScene);

  const [showMenu, setShowMenu] = useState(false);

  const handleToggle = useCallback(() => {
    if (isPaused) {
      resumeGame();
      setShowMenu(false);
    } else {
      pauseGame();
      setShowMenu(true);
    }
  }, [isPaused, pauseGame, resumeGame]);

  const handleBackToLobby = useCallback(() => {
    setScene('lobby');
    setShowMenu(false);
    resumeGame();
  }, [setScene, resumeGame]);

  return (
    <>
      <button
        className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
        onClick={handleToggle}
      >
        <span className="text-white text-lg">{isPaused ? '▶' : '⏸'}</span>
      </button>

      {showMenu && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 100 }}>
          <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 mx-6 max-w-xs w-full">
            <h2 className="text-white text-xl font-bold text-center mb-6">Tạm dừng</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { resumeGame(); setShowMenu(false); }}
                className="w-full py-3.5 rounded-xl bg-green-600/80 text-white font-bold text-base active:scale-95 transition-transform"
              >
                ▶ Tiếp tục
              </button>
              <button
                onClick={handleBackToLobby}
                className="w-full py-3.5 rounded-xl bg-slate-700/80 text-white font-bold text-base active:scale-95 transition-transform"
              >
                🏠 Về Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}