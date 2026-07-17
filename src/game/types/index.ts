// ===== BlockVerse Game Types =====

export type GameScene = 'lobby' | 'obby' | 'battle' | 'speedrun' | 'explorer' | 'builder';

export interface PlayerData {
  id: string;
  name: string;
  avatar: string;
  coins: number;
  totalScore: number;
  gamesPlayed: number;
  level: number;
  xp: number;
  selectedSkin: string;
  unlockedSkins: string[];
  highScores: Record<GameScene, number>;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  scene: GameScene;
  score: number;
  time: number;
  date: string;
}

export interface GameState {
  currentScene: GameScene;
  previousScene: GameScene | null;
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  score: number;
  timeElapsed: number;
  lives: number;
  health: number;
  maxHealth: number;
  coins: number;
  combo: number;
  comboTimer: number;
  showHUD: boolean;
  showMinimap: boolean;
  isLoading: boolean;
  loadingProgress: number;
  notification: string | null;
  transitionProgress: number;
  isTransitioning: boolean;
}

export interface SceneConfig {
  id: GameScene;
  name: string;
  description: string;
  icon: string;
  color: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxPlayers: number;
  estimatedTime: string;
  highScore: number;
  thumbnail: string;
}

export interface PlayerSkin {
  id: string;
  name: string;
  color: string;
  headColor: string;
  bodyColor: string;
  legColor: string;
  accessory: string | null;
  price: number;
  unlocked: boolean;
}

export interface ObbyPlatform {
  id: number;
  position: [number, number, number];
  size: [number, number, number];
  type: 'static' | 'moving' | 'falling' | 'bouncy' | 'ice';
  color: string;
  moveAxis?: 'x' | 'y' | 'z';
  moveRange?: number;
  moveSpeed?: number;
}

export interface Enemy {
  id: string;
  type: 'melee' | 'ranged' | 'boss';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  color: string;
  size: number;
  patrolRange: number;
}

export interface Collectible {
  id: string;
  type: 'coin' | 'gem' | 'heart' | 'powerup';
  position: [number, number, number];
  value: number;
  collected: boolean;
}

export interface Checkpoint {
  id: number;
  position: [number, number, number];
  reached: boolean;
}

export interface Block {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  type: 'normal' | 'wood' | 'stone' | 'metal' | 'glass';
  placed: boolean;
}

export interface SpeedRunTrack {
  checkpoints: Checkpoint[];
  obstacles: Array<{
    position: [number, number, number];
    size: [number, number, number];
    type: 'wall' | 'ramp' | 'gap' | 'spinner';
    speed: number;
  }>;
  boostPads: Array<{
    position: [number, number, number];
    direction: [number, number, number];
    strength: number;
  }>;
}

export interface ExplorerWorld {
  collectibles: Collectible[];
  enemies: Enemy[];
  structures: Array<{
    position: [number, number, number];
    size: [number, number, number];
    color: string;
    type: 'tree' | 'rock' | 'house' | 'tower' | 'chest';
  }>;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  spawnPoint: [number, number, number];
}

export interface Particle {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number;
  maxLife: number;
}