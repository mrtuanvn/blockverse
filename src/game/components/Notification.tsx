'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/game/store';

function getNotificationStyle(msg: string): { bg: string; border: string; icon: string } {
  const lower = msg.toLowerCase();
  if (lower.includes('score') || lower.includes('point') || lower.includes('+') || lower.includes('coin')) {
    return { bg: 'bg-yellow-900/80', border: 'border-yellow-500/50', icon: '⭐' };
  }
  if (lower.includes('achievement') || lower.includes('unlock') || lower.includes('complete')) {
    return { bg: 'bg-emerald-900/80', border: 'border-emerald-500/50', icon: '🏆' };
  }
  if (lower.includes('warning') || lower.includes('danger') || lower.includes('beware') || lower.includes('hurt')) {
    return { bg: 'bg-red-900/80', border: 'border-red-500/50', icon: '⚠️' };
  }
  return { bg: 'bg-gray-900/80', border: 'border-gray-500/50', icon: 'ℹ️' };
}

export default function Notification() {
  const notification = useGameStore((s) => s.game.notification);
  const setNotification = useGameStore((s) => s.setNotification);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer - only interacts with Zustand store, not React state
  useEffect(() => {
    if (notification) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, setNotification]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification}
            className={`px-5 py-3 rounded-xl border backdrop-blur-md ${getNotificationStyle(notification).bg} ${getNotificationStyle(notification).border}`}
            initial={{ y: -20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{getNotificationStyle(notification).icon}</span>
              <span className="text-white font-semibold text-sm">{notification}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}