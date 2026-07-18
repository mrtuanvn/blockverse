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

// ─── Haptic feedback helper ───
function vibrate(ms = 15) {
  try { navigator.vibrate?.(ms); } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// DYNAMIC JOYSTICK — appears wherever you touch on the LEFT half
// (like Fortnite / PUBG mobile)
// ═══════════════════════════════════════════════════════════════════
function DynamicJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const maxDist = 50;
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    // Only handle touches on the left 45% of the screen
    if (touch.clientX > window.innerWidth * 0.45) return;

    activeTouchId.current = touch.identifier;
    origin.current = { x: touch.clientX, y: touch.clientY };
    setPos({ x: touch.clientX, y: touch.clientY });
    setVisible(true);
    setTouchActive(true);
    vibrate(10);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== activeTouchId.current) continue;

      const dx = touch.clientX - origin.current.x;
      const dy = touch.clientY - origin.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
      }

      const normalizedDist = clampedDist / maxDist;
      // Dead zone: ignore tiny movements
      if (normalizedDist < 0.12) {
        setMovement(0, 0);
      } else {
        const strength = Math.min(1, (normalizedDist - 0.12) / 0.88);
        setMovement(
          Math.cos(angle) * strength,
          Math.sin(angle) * strength
        );
      }
    }
  }, []);

  const resetJoystick = useCallback(() => {
    activeTouchId.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    setVisible(false);
    setMovement(0, 0);
    setTouchActive(false);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        resetJoystick();
      }
    }
  }, [resetJoystick]);

  // Full-screen left-half capture zone (invisible)
  return (
    <>
      {/* Touch capture area — left 45% of screen */}
      <div
        className="fixed inset-0 touch-none"
        style={{ pointerEvents: 'auto', zIndex: 20, clipPath: 'inset(0 55% 0 0)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Visual joystick (follows finger) */}
      {visible && (
        <div
          ref={baseRef}
          className="fixed w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/25 flex items-center justify-center touch-none select-none"
          style={{
            pointerEvents: 'none',
            zIndex: 25,
            left: pos.x - 64,
            top: pos.y - 64,
          }}
        >
          {/* Direction arrows */}
          <div className="absolute top-1 text-white/25 text-sm">▲</div>
          <div className="absolute bottom-1 text-white/25 text-sm">▼</div>
          <div className="absolute left-2 text-white/25 text-sm">◀</div>
          <div className="absolute right-2 text-white/25 text-sm">▶</div>
          <div
            ref={knobRef}
            className="w-14 h-14 rounded-full bg-white/30 border-2 border-white/50 shadow-lg"
            style={{ transform: 'translate(0px, 0px)', transition: 'none' }}
          />
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACTION BUTTON — with press glow effect
// ═══════════════════════════════════════════════════════════════════
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
  const [pressed, setPressed] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      touchIdRef.current = e.changedTouches[0].identifier;
      setPressed(true);
      onPress();
      vibrate(12);
    },
    [onPress]
  );
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPressed(false);
      touchIdRef.current = null;
      onRelease();
    },
    [onRelease]
  );
  const handleTouchCancel = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPressed(false);
      touchIdRef.current = null;
      onRelease();
    },
    [onRelease]
  );

  const dim = size * 4;

  return (
    <button
      className="flex flex-col items-center justify-center rounded-full touch-none select-none active:scale-90 transition-transform"
      style={{
        pointerEvents: 'auto',
        width: dim,
        height: dim,
        backgroundColor: pressed ? color.replace('0.6', '0.9') : color,
        border: pressed ? '3px solid rgba(255,255,255,0.7)' : '2px solid rgba(255,255,255,0.3)',
        boxShadow: pressed
          ? `0 0 25px ${color}, 0 0 50px ${color}60`
          : `0 0 15px ${color}40`,
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <span className="leading-none" style={{ fontSize: size * 1.6 }}>{icon}</span>
      <span className="text-white/90 font-bold mt-0.5" style={{ fontSize: size * 0.65 }}>{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAMERA TOUCH AREA — right half of screen, higher sensitivity
// ═══════════════════════════════════════════════════════════════════
function CameraTouchArea() {
  const lastTouch = useRef<{ x: number; y: number; id: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    // Only capture touches on the RIGHT half (left is for joystick)
    if (touch.clientX < window.innerWidth * 0.45) return;
    // Skip if touching a button area (bottom-right corner)
    if (touch.clientY > window.innerHeight - 200 && touch.clientX > window.innerWidth - 200) return;
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
      // Higher sensitivity for easier camera control
      addCameraDelta(dx * 0.008, dy * 0.008);
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
      style={{ pointerEvents: 'auto', zIndex: 10, clipPath: 'inset(0 0 0 45%)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// FULLSCREEN BUTTON
// ═══════════════════════════════════════════════════════════════════
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
      const el = document.documentElement as any;
      if (!el.webkitFullscreenElement) {
        el.webkitRequestFullscreen?.();
        setIsFullscreen(true);
      } else {
        el.webkitExitFullscreen?.();
        setIsFullscreen(false);
      }
    }
    vibrate(8);
  }, []);

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
      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/15 flex items-center justify-center active:scale-90 transition-transform"
      style={{ pointerEvents: 'auto' }}
      onClick={toggleFullscreen}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); }}
    >
      <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isFullscreen ? (
          <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4m6 10l5 5m0 0v-4m0 4h-4" />
          </>
        ) : (
          <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </>
        )}
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MOBILE CONTROLS
// ═══════════════════════════════════════════════════════════════════
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
      {/* Camera: right half, z-10 (lowest) */}
      <CameraTouchArea />

      {/* Joystick: left half dynamic, z-20-25 */}
      <DynamicJoystick />

      {/* ─── Top-left: Pause + Fullscreen ─── */}
      <div className="fixed top-3 left-3 flex flex-col gap-2" style={{ zIndex: 60, pointerEvents: 'auto' }}>
        <MobilePauseButton />
        <FullscreenButton />
      </div>

      {/* ─── Bottom-right: Action buttons ─── */}
      <div
        className="fixed bottom-8 right-3 flex flex-col items-center gap-2.5"
        style={{ zIndex: 30, pointerEvents: 'none' }}
      >
        {/* Jump — biggest, most accessible */}
        <ActionButton
          label="Nhảy"
          icon="▲"
          color="rgba(34, 197, 94, 0.6)"
          size={20}
          onPress={() => setJump(true)}
          onRelease={() => setJump(false)}
        />

        {/* Attack — only in non-lobby scenes */}
        {!isLobby && (
          <ActionButton
            label="Đánh"
            icon="⚔"
            color="rgba(239, 68, 68, 0.6)"
            size={16}
            onPress={() => setAttack(true)}
            onRelease={() => setAttack(false)}
          />
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAUSE MENU
// ═══════════════════════════════════════════════════════════════════
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
    vibrate(10);
  }, [isPaused, pauseGame, resumeGame]);

  const handleBackToLobby = useCallback(() => {
    setScene('lobby');
    setShowMenu(false);
    resumeGame();
  }, [setScene, resumeGame]);

  return (
    <>
      <button
        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/15 flex items-center justify-center active:scale-90 transition-transform"
        onClick={handleToggle}
      >
        <span className="text-white/80 text-base">{isPaused ? '▶' : '⏸'}</span>
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