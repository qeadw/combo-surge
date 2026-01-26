// Game type definitions

export enum NoteType {
  Normal = 'normal',
  Double = 'double',
  Hold = 'hold',
}

export enum HitRating {
  Perfect = 'perfect',
  Great = 'great',
  Good = 'good',
  Miss = 'miss',
}

export interface Note {
  id: string;
  lane: number;
  type: NoteType;
  spawnTime: number;
  hitTime: number;
  holdDuration?: number;
  y: number;
  hit: boolean;
  missed: boolean;
  rating?: HitRating;
}

export interface Lane {
  x: number;
  width: number;
  key: string;
  color: string;
  glowColor: string;
  pressed: boolean;
  hitEffect: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ComboState {
  current: number;
  max: number;
  multiplier: number;
}

export interface ScoreState {
  current: number;
  display: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  maxLevel: number;
  currentLevel: number;
  effect: number;
}

export interface NotePattern {
  time: number;
  lanes: number[];
  type: NoteType;
  holdDuration?: number;
}

export interface GameState {
  screen: 'menu' | 'playing' | 'results';
  currentLevelNum: number;
  highestLevel: number;
  gameTime: number;
  notes: Note[];
  lanes: Lane[];
  combo: ComboState;
  score: ScoreState;
  particles: Particle[];
  floatingTexts: FloatingText[];
  totalPoints: number;
  upgrades: Upgrade[];
  isPaused: boolean;
  hitWindow: number;
  noteSpeed: number;
  beatPulse: number;
  levelHighScores: Map<number, number>;
  levelMaxCombos: Map<number, number>;
  keybinds: string[];  // Custom keys for lanes
  rebindingLane: number | null;  // Which lane is being rebound (-1 = none)
}

export interface LevelConfig {
  bpm: number;
  duration: number;
  difficulty: number;
  patterns: NotePattern[];
}

export interface GameConfig {
  laneCount: number;
  hitLineY: number;
  baseHitWindow: number;
  baseNoteSpeed: number;
  perfectWindow: number;
  greatWindow: number;
  goodWindow: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  laneCount: 4,
  hitLineY: 0.85,
  baseHitWindow: 150,
  baseNoteSpeed: 400,
  perfectWindow: 40,
  greatWindow: 80,
  goodWindow: 120,
};

export const NEON_COLORS = {
  pink: '#ff00ff',
  cyan: '#00ffff',
  yellow: '#ffff00',
  green: '#00ff00',
  orange: '#ff8800',
  purple: '#aa00ff',
  blue: '#0088ff',
  red: '#ff0044',
};

export const LANE_COLORS = [
  { color: NEON_COLORS.pink, glow: '#ff00ff44' },
  { color: NEON_COLORS.cyan, glow: '#00ffff44' },
  { color: NEON_COLORS.yellow, glow: '#ffff0044' },
  { color: NEON_COLORS.green, glow: '#00ff0044' },
];

export const LANE_KEYS = ['D', 'F', 'J', 'K'];

export const UPGRADE_DEFINITIONS: Omit<Upgrade, 'currentLevel'>[] = [
  {
    id: 'timing',
    name: 'Better Timing',
    description: '+10% hit window',
    baseCost: 100,
    maxLevel: 10,
    effect: 0.1,
  },
  {
    id: 'multiplier',
    name: 'Score Boost',
    description: '+15% base score',
    baseCost: 150,
    maxLevel: 10,
    effect: 0.15,
  },
  {
    id: 'combo_shield',
    name: 'Combo Shield',
    description: '+8% save chance',
    baseCost: 200,
    maxLevel: 10,
    effect: 0.08,
  },
  {
    id: 'perfect_bonus',
    name: 'Perfect Master',
    description: '+20% perfect pts',
    baseCost: 250,
    maxLevel: 10,
    effect: 0.2,
  },
  {
    id: 'slow_notes',
    name: 'Focus Mode',
    description: '-5% note speed',
    baseCost: 120,
    maxLevel: 10,
    effect: 0.05,
  },
];
