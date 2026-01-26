import { Level, NotePattern, NoteType } from '../types';

// Generate patterns for a level based on BPM and difficulty
function generatePatterns(bpm: number, duration: number, difficulty: number): NotePattern[] {
  const patterns: NotePattern[] = [];
  const beatDuration = 60 / bpm;
  const totalBeats = Math.floor(duration / beatDuration);

  // Difficulty affects:
  // - Pattern density (more notes per beat at higher difficulty)
  // - Multi-lane patterns
  // - Hold notes

  for (let beat = 0; beat < totalBeats; beat++) {
    const time = (beat * beatDuration) / duration;

    // Skip first few beats
    if (beat < 4) continue;

    // Basic rhythm: every beat has a chance of notes
    const roll = Math.random();

    if (difficulty <= 1) {
      // Easy: Single notes on main beats
      if (beat % 2 === 0 && roll < 0.7) {
        patterns.push({
          time,
          lanes: [Math.floor(Math.random() * 4)],
          type: NoteType.Normal,
        });
      }
    } else if (difficulty <= 2) {
      // Medium: Notes on every beat, occasional doubles
      if (roll < 0.8) {
        const lanes = [Math.floor(Math.random() * 4)];
        // 20% chance of double
        if (Math.random() < 0.2) {
          let secondLane;
          do {
            secondLane = Math.floor(Math.random() * 4);
          } while (secondLane === lanes[0]);
          lanes.push(secondLane);
        }
        patterns.push({
          time,
          lanes,
          type: NoteType.Normal,
        });
      }
    } else if (difficulty <= 3) {
      // Hard: Faster patterns, more doubles
      if (roll < 0.85) {
        const lanes = [Math.floor(Math.random() * 4)];
        if (Math.random() < 0.35) {
          let secondLane;
          do {
            secondLane = Math.floor(Math.random() * 4);
          } while (secondLane === lanes[0]);
          lanes.push(secondLane);
        }
        patterns.push({
          time,
          lanes,
          type: NoteType.Normal,
        });
      }
      // Off-beat notes
      if (Math.random() < 0.3) {
        const offBeatTime = time + (0.5 * beatDuration) / duration;
        if (offBeatTime < 1) {
          patterns.push({
            time: offBeatTime,
            lanes: [Math.floor(Math.random() * 4)],
            type: NoteType.Normal,
          });
        }
      }
    } else {
      // Expert: Very dense patterns
      if (roll < 0.9) {
        const lanes = [Math.floor(Math.random() * 4)];
        if (Math.random() < 0.45) {
          let secondLane;
          do {
            secondLane = Math.floor(Math.random() * 4);
          } while (secondLane === lanes[0]);
          lanes.push(secondLane);
        }
        patterns.push({
          time,
          lanes,
          type: NoteType.Normal,
        });
      }
      // Off-beat notes
      if (Math.random() < 0.5) {
        const offBeatTime = time + (0.5 * beatDuration) / duration;
        if (offBeatTime < 1) {
          patterns.push({
            time: offBeatTime,
            lanes: [Math.floor(Math.random() * 4)],
            type: NoteType.Normal,
          });
        }
      }
      // Triplets occasionally
      if (Math.random() < 0.15) {
        for (let t = 1; t <= 2; t++) {
          const tripletTime = time + (t * beatDuration / 3) / duration;
          if (tripletTime < 1) {
            patterns.push({
              time: tripletTime,
              lanes: [Math.floor(Math.random() * 4)],
              type: NoteType.Normal,
            });
          }
        }
      }
    }
  }

  // Sort by time
  patterns.sort((a, b) => a.time - b.time);

  return patterns;
}

export function generateLevels(): Level[] {
  const levels: Level[] = [
    {
      id: 1,
      name: 'First Steps',
      bpm: 90,
      duration: 30,
      unlockCost: 0,
      unlocked: true,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 2,
      name: 'Warm Up',
      bpm: 100,
      duration: 40,
      unlockCost: 200,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 3,
      name: 'Getting Started',
      bpm: 110,
      duration: 45,
      unlockCost: 500,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 4,
      name: 'Neon Nights',
      bpm: 120,
      duration: 50,
      unlockCost: 1000,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 5,
      name: 'Electric Dreams',
      bpm: 130,
      duration: 55,
      unlockCost: 2000,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 6,
      name: 'Cyber Rush',
      bpm: 140,
      duration: 60,
      unlockCost: 4000,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 7,
      name: 'Synthwave Storm',
      bpm: 150,
      duration: 70,
      unlockCost: 7500,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
    {
      id: 8,
      name: 'Maximum Overdrive',
      bpm: 165,
      duration: 80,
      unlockCost: 15000,
      unlocked: false,
      highScore: 0,
      maxCombo: 0,
      patterns: [],
    },
  ];

  // Generate patterns for each level
  for (let i = 0; i < levels.length; i++) {
    const difficulty = 1 + (i / (levels.length - 1)) * 3; // 1 to 4
    levels[i].patterns = generatePatterns(levels[i].bpm, levels[i].duration, difficulty);
  }

  return levels;
}
