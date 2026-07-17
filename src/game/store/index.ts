// ===== BlockVerse Game Store (Zustand) =====
import { create } from 'zustand';
import type {
  GameScene,
  PlayerData,
  GameState,
  LeaderboardEntry,
  SceneConfig,
  Block,
} from '@/game/types';

// ===== Scene Configurations =====
export const SCENE_CONFIGS: Record<GameScene, SceneConfig> = {
  lobby: {
    id: 'lobby',
    name: 'BlockVerse Hub',
    description: 'Trung tâm thế giới BlockVerse - Chọn game để chơi!',
    icon: '🏠',
    color: '#8b5cf6',
    difficulty: 'easy',
    maxPlayers: 1,
    estimatedTime: '∞',
    highScore: 0,
    thumbnail: '/textures/lobby.jpg',
  },
  obby: {
    id: 'obby',
    name: 'Obby Runner',
    description: 'Nhảy qua các platform đầy thử thách! Đừng rơi xuống!',
    icon: '🏃',
    color: '#f59e0b',
    difficulty: 'medium',
    maxPlayers: 1,
    estimatedTime: '3-5 phút',
    highScore: 0,
    thumbnail: '/textures/obby.jpg',
  },
  battle: {
    id: 'battle',
    name: 'Battle Arena',
    description: 'Chiến đấu với kẻ thù, thu thập sức mạnh và sống sót!',
    icon: '⚔️',
    color: '#ef4444',
    difficulty: 'hard',
    maxPlayers: 1,
    estimatedTime: '5-8 phút',
    highScore: 0,
    thumbnail: '/textures/battle.jpg',
  },
  speedrun: {
    id: 'speedrun',
    name: 'Speed Run',
    description: 'Đua với thời gian! Vượt qua chướng ngại vật nhanh nhất có thể!',
    icon: '🏎️',
    color: '#06b6d4',
    difficulty: 'medium',
    maxPlayers: 1,
    estimatedTime: '2-3 phút',
    highScore: 0,
    thumbnail: '/textures/speedrun.jpg',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Khám phá thế giới mở, thu thập kho báu và phát hiện bí mật!',
    icon: '🌍',
    color: '#22c55e',
    difficulty: 'easy',
    maxPlayers: 1,
    estimatedTime: '5-10 phút',
    highScore: 0,
    thumbnail: '/textures/explorer.jpg',
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'Xây dựng thế giới riêng của bạn với các khối màu sắc!',
    icon: '🏗️',
    color: '#a855f7',
    difficulty: 'easy',
    maxPlayers: 1,
    estimatedTime: '∞',
    highScore: 0,
    thumbnail: '/textures/builder.jpg',
  },
};

// ===== Default Player =====
const DEFAULT_PLAYER: PlayerData = {
  id: 'player_1',
  name: 'BlockPlayer',
  avatar: '🟦',
  coins: 0,
  totalScore: 0,
  gamesPlayed: 0,
  level: 1,
  xp: 0,
  selectedSkin: 'default',
  unlockedSkins: ['default'],
  highScores: {
    lobby: 0,
    obby: 0,
    battle: 0,
    speedrun: 0,
    explorer: 0,
    builder: 0,
  },
};

// ===== Default Game State =====
const DEFAULT_GAME: GameState = {
  currentScene: 'lobby',
  previousScene: null,
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  score: 0,
  timeElapsed: 0,
  lives: 3,
  health: 100,
  maxHealth: 100,
  coins: 0,
  combo: 0,
  comboTimer: 0,
  showHUD: true,
  showMinimap: false,
  isLoading: false,
  loadingProgress: 0,
  notification: null,
  transitionProgress: 0,
  isTransitioning: false,
};

// ===== Main Game Store =====
interface GameStore {
  // Player
  player: PlayerData;
  updatePlayer: (data: Partial<PlayerData>) => void;
  addCoins: (amount: number) => void;
  addXP: (amount: number) => void;
  setHighScore: (scene: GameScene, score: number) => void;

  // Game State
  game: GameState;
  setScene: (scene: GameScene) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  addScore: (points: number) => void;
  setScore: (score: number) => void;
  setTime: (time: number) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  setHealth: (health: number) => void;
  loseLife: () => void;
  addCombo: () => void;
  resetCombo: () => void;
  setNotification: (msg: string | null) => void;
  setLoading: (loading: boolean, progress?: number) => void;
  startTransition: () => void;
  updateTransition: (progress: number) => void;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  fetchLeaderboard: (scene?: GameScene) => Promise<void>;
  submitScore: (scene: GameScene, score: number, time: number) => Promise<void>;

  // Builder
  builderBlocks: Block[];
  addBlock: (block: Block) => void;
  removeBlock: (id: string) => void;
  clearBlocks: () => void;
  selectedBlockColor: string;
  setSelectedBlockColor: (color: string) => void;
  selectedBlockType: string;
  setSelectedBlockType: (type: string) => void;

  // Audio
  isMuted: boolean;
  toggleMute: () => void;
  playSound: (sound: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Player
  player: DEFAULT_PLAYER,
  updatePlayer: (data) =>
    set((s) => ({ player: { ...s.player, ...data } })),
  addCoins: (amount) =>
    set((s) => ({ player: { ...s.player, coins: s.player.coins + amount } })),
  addXP: (amount) =>
    set((s) => {
      const newXp = s.player.xp + amount;
      const xpPerLevel = s.player.level * 100;
      if (newXp >= xpPerLevel) {
        return {
          player: {
            ...s.player,
            xp: newXp - xpPerLevel,
            level: s.player.level + 1,
          },
        };
      }
      return { player: { ...s.player, xp: newXp } };
    }),
  setHighScore: (scene, score) =>
    set((s) => ({
      player: {
        ...s.player,
        highScores: {
          ...s.player.highScores,
          [scene]: Math.max(s.player.highScores[scene], score),
        },
      },
    })),

  // Game State
  game: DEFAULT_GAME,
  setScene: (scene) =>
    set((s) => ({
      game: {
        ...DEFAULT_GAME,
        currentScene: scene,
        previousScene: s.game.currentScene,
        showHUD: scene !== 'lobby' && scene !== 'builder',
      },
    })),
  startGame: () =>
    set((s) => ({
      game: { ...s.game, isPlaying: true, isPaused: false, isGameOver: false },
    })),
  pauseGame: () =>
    set((s) => ({ game: { ...s.game, isPaused: true } })),
  resumeGame: () =>
    set((s) => ({ game: { ...s.game, isPaused: false } })),
  endGame: () =>
    set((s) => ({
      game: { ...s.game, isPlaying: false, isGameOver: true, isPaused: false },
      player: {
        ...s.player,
        totalScore: s.player.totalScore + s.game.score,
        coins: s.player.coins + s.game.coins,
        gamesPlayed: s.player.gamesPlayed + 1,
      },
    })),
  addScore: (points) =>
    set((s) => ({
      game: {
        ...s.game,
        score: s.game.score + points * (1 + s.game.combo * 0.1),
      },
    })),
  setScore: (score) =>
    set((s) => ({ game: { ...s.game, score } })),
  setTime: (time) =>
    set((s) => ({ game: { ...s.game, timeElapsed: time } })),
  takeDamage: (amount) =>
    set((s) => {
      const newHealth = Math.max(0, s.game.health - amount);
      return {
        game: {
          ...s.game,
          health: newHealth,
          ...(newHealth <= 0 ? { isGameOver: true, isPlaying: false } : {}),
        },
      };
    }),
  heal: (amount) =>
    set((s) => ({
      game: {
        ...s.game,
        health: Math.min(s.game.maxHealth, s.game.health + amount),
      },
    })),
  setHealth: (health) =>
    set((s) => ({ game: { ...s.game, health: Math.min(s.game.maxHealth, health) } })),
  loseLife: () =>
    set((s) => ({
      game: {
        ...s.game,
        lives: Math.max(0, s.game.lives - 1),
        health: s.game.maxHealth,
        ...(s.game.lives - 1 <= 0
          ? { isGameOver: true, isPlaying: false }
          : {}),
      },
    })),
  addCombo: () =>
    set((s) => ({
      game: { ...s.game, combo: s.game.combo + 1, comboTimer: 3 },
    })),
  resetCombo: () =>
    set((s) => ({ game: { ...s.game, combo: 0, comboTimer: 0 } })),
  setNotification: (msg) =>
    set((s) => ({ game: { ...s.game, notification: msg } })),
  setLoading: (loading, progress = 0) =>
    set((s) => ({
      game: { ...s.game, isLoading: loading, loadingProgress: progress },
    })),
  startTransition: () =>
    set((s) => ({ game: { ...s.game, isTransitioning: true, transitionProgress: 0 } })),
  updateTransition: (progress) =>
    set((s) => ({
      game: {
        ...s.game,
        transitionProgress: progress,
        isTransitioning: progress < 1,
      },
    })),

  // Leaderboard
  leaderboard: [],
  fetchLeaderboard: async (scene) => {
    try {
      const params = scene ? `?scene=${scene}` : '';
      const res = await fetch(`/api/leaderboard${params}`);
      const data = await res.json();
      set({ leaderboard: data.entries || [] });
    } catch {
      // Use mock data if API fails
      const mockEntries: LeaderboardEntry[] = Array.from({ length: 10 }, (_, i) => ({
        id: `mock_${i}`,
        playerName: ['ProGamer', 'BlockMaster', 'SpeedKing', 'ObbyGod', 'ExplorerX', 'BuildPro', 'ArenaStar', 'NinjaRun', 'CoinHunter', 'JumpKing'][i],
        scene: scene || 'obby',
        score: 1000 - i * 80,
        time: 30 + i * 15,
        date: new Date().toISOString(),
      }));
      set({ leaderboard: mockEntries });
    }
  },
  submitScore: async (scene, score, time) => {
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: get().player.name,
          scene,
          score,
          time,
        }),
      });
    } catch {
      // Silently fail - scores are tracked locally
    }
    get().setHighScore(scene, score);
    get().addXP(Math.floor(score / 10));
    get().addCoins(Math.floor(score / 5));
  },

  // Builder
  builderBlocks: [],
  addBlock: (block) =>
    set((s) => ({ builderBlocks: [...s.builderBlocks, block] })),
  removeBlock: (id) =>
    set((s) => ({
      builderBlocks: s.builderBlocks.filter((b) => b.id !== id),
    })),
  clearBlocks: () => set({ builderBlocks: [] }),
  selectedBlockColor: '#ef4444',
  setSelectedBlockColor: (color) =>
    set({ selectedBlockColor: color }),
  selectedBlockType: 'normal',
  setSelectedBlockType: (type) =>
    set({ selectedBlockType: type }),

  // Audio
  isMuted: false,
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  playSound: (_sound: string) => {
    // Sound effects handled by audio engine
    const { isMuted } = get();
    if (isMuted) return;
    // Web Audio API sounds are played via the AudioEngine component
  },
}));