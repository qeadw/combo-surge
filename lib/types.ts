// Game type definitions

export enum NoteType {
  Normal = 'normal',
  Double = 'double',    // Hit two keys at once
  Hold = 'hold',        // Hold the key
}

export enum HitRating {
  Perfect = 'perfect',
  Great = 'great',
  Good = 'good',
  Miss = 'miss',
}

export interface Note {
  id: string;
  lane: number;         // 0-3 for 4 lanes
  type: NoteType;
  spawnTime: number;    // When the note spawns (game time)
  hitTime: number;      // When the note should be hit (game time)
  holdDuration?: number; // For hold notes
  y: number;            // Current y position
  hit: boolean;         // Was this note hit
  missed: boolean;      // Was this note missed
  rating?: HitRating;   // Hit rating if hit
}

export interface Lane {
  x: number;
  width: number;
  key: string;          // Keyboard key for this lane
  color: string;        // Neon color
  glowColor: string;    // Glow effect color
  pressed: boolean;     // Is the key currently pressed
  hitEffect: number;    // Timer for hit effect animation
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
  display: number;      // Animated display score
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  effect: number;       // Effect per level
}

export interface Level {
  id: number;
  name: string;
  bpm: number;
  duration: number;     // Seconds
  unlockCost: number;
  unlocked: boolean;
  highScore: number;
  maxCombo: number;
  patterns: NotePattern[];
}

export interface NotePattern {
  time: number;         // When to spawn (0-1 normalized to duration)
  lanes: number[];      // Which lanes get notes
  type: NoteType;
  holdDuration?: number;
}

export interface GameState {
  screen: 'menu' | 'playing' | 'results' | 'upgrades';
  currentLevel: Level | null;
  gameTime: number;
  notes: Note[];
  lanes: Lane[];
  combo: ComboState;
  score: ScoreState;
  particles: Particle[];
  floatingTexts: FloatingText[];
  totalPoints: number;  // Currency for unlocks
  upgrades: Upgrade[];
  levels: Level[];
  isPaused: boolean;
  hitWindow: number;    // Base timing window (ms)
  noteSpeed: number;    // How fast notes fall
  beatPulse: number;    // Visual beat pulse effect
}

export interface GameConfig {
  laneCount: number;
  hitLineY: number;     // Y position of the hit line (0-1)
  baseHitWindow: number;
  baseNoteSpeed: number;
  perfectWindow: number;
  greatWindow: number;
  goodWindow: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  laneCount: 4,
  hitLineY: 0.85,
  baseHitWindow: 150,   // ms
  baseNoteSpeed: 400,   // pixels per second
  perfectWindow: 40,    // ms - tight timing
  greatWindow: 80,
  goodWindow: 120,
};

// Neon color palette
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

// Upgrade definitions
export const UPGRADE_DEFINITIONS: Omit<Upgrade, 'currentLevel'>[] = [
  {
    id: 'timing',
    name: 'Better Timing',
    description: 'Increases hit window by 10% per level',
    cost: 500,
    maxLevel: 5,
    effect: 0.1,
  },
  {
    id: 'multiplier',
    name: 'Score Boost',
    description: 'Increases base score by 15% per level',
    cost: 750,
    maxLevel: 5,
    effect: 0.15,
  },
  {
    id: 'combo_shield',
    name: 'Combo Shield',
    description: 'Chance to save combo on miss (10% per level)',
    cost: 1000,
    maxLevel: 5,
    effect: 0.1,
  },
  {
    id: 'perfect_bonus',
    name: 'Perfect Master',
    description: 'Bonus points for perfect hits (+20% per level)',
    cost: 1200,
    maxLevel: 5,
    effect: 0.2,
  },
  {
    id: 'slow_notes',
    name: 'Focus Mode',
    description: 'Notes move 5% slower per level',
    cost: 600,
    maxLevel: 5,
    effect: 0.05,
  },
];
