import { LevelConfig, NotePattern, NoteType } from '../types';

// Seeded random for consistent level generation
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
}

// Generate level config for any level number (infinite)
export function generateLevel(levelNum: number): LevelConfig {
  const rng = new SeededRandom(levelNum * 12345);

  // BPM increases with level: starts at 80, increases by ~5 per level, caps at 200
  const baseBpm = 80;
  const bpmIncrease = Math.min(levelNum * 5, 120);
  const bpm = baseBpm + bpmIncrease;

  // Duration: 20-60 seconds, longer at higher levels
  const duration = Math.min(20 + levelNum * 2, 60);

  // Difficulty scales with level (1.0 to 5.0+)
  const difficulty = 1 + (levelNum - 1) * 0.15;

  // Generate patterns
  const patterns = generatePatterns(bpm, duration, difficulty, rng);

  return { bpm, duration, difficulty, patterns };
}

function generatePatterns(bpm: number, duration: number, difficulty: number, rng: SeededRandom): NotePattern[] {
  const patterns: NotePattern[] = [];
  const beatDuration = 60 / bpm;
  const totalBeats = Math.floor(duration / beatDuration);

  // Note density increases with difficulty
  const baseNoteChance = 0.5 + Math.min(difficulty * 0.08, 0.4);
  // Double note chance
  const doubleChance = Math.min(0.05 + difficulty * 0.05, 0.4);
  // Off-beat note chance
  const offBeatChance = Math.min(difficulty * 0.08, 0.5);

  for (let beat = 0; beat < totalBeats; beat++) {
    const time = (beat * beatDuration) / duration;

    // Skip first 4 beats for warm-up
    if (beat < 4) continue;

    // Main beat notes
    if (rng.next() < baseNoteChance) {
      const lanes = [Math.floor(rng.next() * 4)];

      // Chance for double note
      if (rng.next() < doubleChance) {
        let secondLane: number;
        do {
          secondLane = Math.floor(rng.next() * 4);
        } while (secondLane === lanes[0]);
        lanes.push(secondLane);
      }

      patterns.push({
        time,
        lanes,
        type: NoteType.Normal,
      });
    }

    // Off-beat notes (half-beat)
    if (rng.next() < offBeatChance) {
      const offBeatTime = time + (0.5 * beatDuration) / duration;
      if (offBeatTime < 0.95) {
        patterns.push({
          time: offBeatTime,
          lanes: [Math.floor(rng.next() * 4)],
          type: NoteType.Normal,
        });
      }
    }

    // At high difficulty, add triplets occasionally
    if (difficulty > 2 && rng.next() < 0.1) {
      for (let t = 1; t <= 2; t++) {
        const tripletTime = time + (t * beatDuration / 3) / duration;
        if (tripletTime < 0.95) {
          patterns.push({
            time: tripletTime,
            lanes: [Math.floor(rng.next() * 4)],
            type: NoteType.Normal,
          });
        }
      }
    }
  }

  // Sort by time
  patterns.sort((a, b) => a.time - b.time);

  return patterns;
}

// Get level name based on level number
export function getLevelName(levelNum: number): string {
  const names = [
    'First Steps', 'Warm Up', 'Getting Started', 'Neon Nights',
    'Electric Dreams', 'Cyber Rush', 'Synthwave', 'Overdrive',
    'Hyperspeed', 'Lightspeed', 'Warp Zone', 'Infinity',
    'Beyond', 'Transcend', 'Ascension', 'Godlike'
  ];

  if (levelNum <= names.length) {
    return names[levelNum - 1];
  }

  // For levels beyond the name list
  return `Level ${levelNum}`;
}
