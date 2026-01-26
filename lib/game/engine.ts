import {
  GameState,
  GameConfig,
  DEFAULT_CONFIG,
  Note,
  NoteType,
  Lane,
  LevelConfig,
  Upgrade,
  HitRating,
  Particle,
  FloatingText,
  LANE_COLORS,
  LANE_KEYS,
  UPGRADE_DEFINITIONS,
  NEON_COLORS,
} from '../types';
import { render } from './renderer';
import { generateLevel } from './levels';

let noteIdCounter = 0;

const SAVE_KEY = 'combo_surge_save_v2';

// Seeded random for consistent note generation
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

interface SaveData {
  totalPoints: number;
  highestLevel: number;
  upgrades: { id: string; level: number }[];
  levelHighScores: [number, number][];
  levelMaxCombos: [number, number][];
  keybinds?: string[];
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private config: GameConfig;
  private lastTime: number = 0;
  private animationId: number = 0;
  private keyDownHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: MouseEvent) => void;
  private currentLevelConfig: LevelConfig | null = null;
  private nextBeatTime: number = 0;
  private levelRng: { next: () => number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = { ...DEFAULT_CONFIG };

    // Initialize lanes
    const lanes: Lane[] = [];
    const laneWidth = 80;
    const totalWidth = laneWidth * this.config.laneCount;
    const startX = (canvas.width - totalWidth) / 2;

    for (let i = 0; i < this.config.laneCount; i++) {
      lanes.push({
        x: startX + i * laneWidth,
        width: laneWidth,
        key: LANE_KEYS[i],
        color: LANE_COLORS[i].color,
        glowColor: LANE_COLORS[i].glow,
        pressed: false,
        hitEffect: 0,
      });
    }

    // Initialize upgrades
    const upgrades: Upgrade[] = UPGRADE_DEFINITIONS.map(def => ({
      ...def,
      currentLevel: 0,
    }));

    // Initialize game state
    this.state = {
      screen: 'menu',
      currentLevelNum: 1,
      highestLevel: 1,
      gameTime: 0,
      notes: [],
      lanes,
      combo: { current: 0, max: 0, multiplier: 1 },
      score: { current: 0, display: 0, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0 },
      particles: [],
      floatingTexts: [],
      totalPoints: 0,
      upgrades,
      isPaused: false,
      hitWindow: this.config.baseHitWindow,
      noteSpeed: this.config.baseNoteSpeed,
      beatPulse: 0,
      levelHighScores: new Map(),
      levelMaxCombos: new Map(),
      keybinds: [...LANE_KEYS],
      rebindingLane: null,
    };

    // Load saved progress
    this.loadProgress();

    // Setup input handlers
    this.keyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.keyUpHandler = (e: KeyboardEvent) => this.handleKeyUp(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    this.canvas.addEventListener('click', this.clickHandler);
  }

  start(): void {
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    this.saveProgress();
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.canvas.removeEventListener('click', this.clickHandler);
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.updateLanePositions();
  }

  private updateLanePositions(): void {
    const laneWidth = 80;
    const totalWidth = laneWidth * this.config.laneCount;
    const startX = (this.canvas.width - totalWidth) / 2;

    for (let i = 0; i < this.state.lanes.length; i++) {
      this.state.lanes[i].x = startX + i * laneWidth;
    }
  }

  private gameLoop = (currentTime: number): void => {
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime);
    render(this.ctx, this.state, this.config, this.currentLevelConfig);

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    if (this.state.screen === 'playing' && !this.state.isPaused) {
      this.updateGameplay(deltaTime);
    }

    // Always update visual effects
    this.updateParticles(deltaTime);
    this.updateFloatingTexts(deltaTime);
    this.updateDisplayScore(deltaTime);

    // Update beat pulse
    if (this.state.beatPulse > 0) {
      this.state.beatPulse = Math.max(0, this.state.beatPulse - deltaTime * 4);
    }

    // Update lane hit effects
    for (const lane of this.state.lanes) {
      if (lane.hitEffect > 0) {
        lane.hitEffect = Math.max(0, lane.hitEffect - deltaTime * 5);
      }
    }
  }

  private updateGameplay(deltaTime: number): void {
    const levelConfig = this.currentLevelConfig;
    if (!levelConfig || !this.levelRng) return;

    this.state.gameTime += deltaTime;

    // Apply upgrades to note speed
    const slowUpgrade = this.state.upgrades.find(u => u.id === 'slow_notes');
    const speedMultiplier = slowUpgrade ? 1 - (slowUpgrade.currentLevel * slowUpgrade.effect) : 1;
    const effectiveSpeed = this.config.baseNoteSpeed * speedMultiplier;

    // Calculate beat timing
    const beatInterval = 60 / levelConfig.bpm;
    const hitLineY = this.canvas.height * this.config.hitLineY;
    const travelTime = hitLineY / effectiveSpeed;

    // Spawn notes dynamically based on beats
    while (this.nextBeatTime < this.state.gameTime + travelTime + beatInterval) {
      // Skip first few beats for warmup
      if (this.nextBeatTime > 0) {
        // Note density based on difficulty
        const noteChance = 0.5 + Math.min(levelConfig.difficulty * 0.08, 0.4);
        const doubleChance = Math.min(0.05 + levelConfig.difficulty * 0.05, 0.4);
        const offBeatChance = Math.min(levelConfig.difficulty * 0.08, 0.5);

        // Main beat note
        if (this.levelRng.next() < noteChance) {
          const lanes = [Math.floor(this.levelRng.next() * 4)];

          // Chance for double note
          if (this.levelRng.next() < doubleChance) {
            let secondLane: number;
            do {
              secondLane = Math.floor(this.levelRng.next() * 4);
            } while (secondLane === lanes[0]);
            lanes.push(secondLane);
          }

          for (const laneIndex of lanes) {
            const note: Note = {
              id: `note_${noteIdCounter++}`,
              lane: laneIndex,
              type: NoteType.Normal,
              spawnTime: this.nextBeatTime - travelTime,
              hitTime: this.nextBeatTime,
              y: -30,
              hit: false,
              missed: false,
            };
            this.state.notes.push(note);
          }
        }

        // Off-beat note (half-beat)
        if (this.levelRng.next() < offBeatChance) {
          const offBeatTime = this.nextBeatTime + beatInterval / 2;
          const note: Note = {
            id: `note_${noteIdCounter++}`,
            lane: Math.floor(this.levelRng.next() * 4),
            type: NoteType.Normal,
            spawnTime: offBeatTime - travelTime,
            hitTime: offBeatTime,
            y: -30,
            hit: false,
            missed: false,
          };
          this.state.notes.push(note);
        }
      }

      this.nextBeatTime += beatInterval;
    }

    // Update note positions
    for (const note of this.state.notes) {
      if (!note.hit && !note.missed) {
        const timeSinceSpawn = this.state.gameTime - note.spawnTime;
        note.y = -30 + timeSinceSpawn * effectiveSpeed;

        if (note.y > hitLineY + 50) {
          this.missNote(note);
        }
      }
    }

    // Clean up old notes
    this.state.notes = this.state.notes.filter(n => n.y < this.canvas.height + 50);

    // Update beat pulse based on BPM
    const beatPhase = (this.state.gameTime % beatInterval) / beatInterval;
    if (beatPhase < 0.1) {
      this.state.beatPulse = Math.max(this.state.beatPulse, 1 - beatPhase * 10);
    }

    // Level ends when you get 10 misses
    if (this.state.score.missCount >= 10) {
      this.endLevel();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toUpperCase();

    // Handle keybind rebinding
    if (this.state.rebindingLane !== null) {
      e.preventDefault();
      if (e.key !== 'Escape') {
        // Set the new keybind
        this.state.keybinds[this.state.rebindingLane] = key;
        this.state.lanes[this.state.rebindingLane].key = key;
        this.saveProgress();
      }
      this.state.rebindingLane = null;
      return;
    }

    if (this.state.screen === 'playing') {
      const laneIndex = this.state.keybinds.indexOf(key);
      if (laneIndex !== -1 && !this.state.lanes[laneIndex].pressed) {
        this.state.lanes[laneIndex].pressed = true;
        this.tryHitNote(laneIndex);
      }

      if (e.key === 'Escape') {
        this.state.isPaused = !this.state.isPaused;
      }
    } else if (this.state.screen === 'menu') {
      if (e.key === ' ') {
        this.startLevel(this.state.currentLevelNum);
      } else if (e.key === 'ArrowUp' || key === 'W') {
        this.state.currentLevelNum = Math.min(this.state.currentLevelNum + 1, this.state.highestLevel);
      } else if (e.key === 'ArrowDown' || key === 'S') {
        this.state.currentLevelNum = Math.max(1, this.state.currentLevelNum - 1);
      }
    } else if (this.state.screen === 'results') {
      if (e.key === ' ') {
        this.state.screen = 'menu';
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toUpperCase();
    const laneIndex = this.state.keybinds.indexOf(key);
    if (laneIndex !== -1) {
      this.state.lanes[laneIndex].pressed = false;
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.state.screen === 'menu') {
      this.handleMenuClick(x, y);
    } else if (this.state.screen === 'results') {
      this.state.screen = 'menu';
    }
  }

  private handleMenuClick(x: number, y: number): void {
    const centerX = this.canvas.width / 2;
    const leftPanelX = 40;
    const rightPanelX = this.canvas.width - 240;

    // Check PLAY button (center)
    const playBtnY = 280;
    const playBtnW = 250;
    const playBtnH = 60;
    if (x >= centerX - playBtnW / 2 && x <= centerX + playBtnW / 2 &&
        y >= playBtnY && y <= playBtnY + playBtnH) {
      this.startLevel(this.state.currentLevelNum);
      return;
    }

    // Check level navigation arrows
    const arrowY = 370;
    const arrowSize = 40;
    // Left arrow (decrease level)
    if (x >= centerX - 100 && x <= centerX - 60 && y >= arrowY && y <= arrowY + arrowSize) {
      this.state.currentLevelNum = Math.max(1, this.state.currentLevelNum - 1);
      return;
    }
    // Right arrow (increase level)
    if (x >= centerX + 60 && x <= centerX + 100 && y >= arrowY && y <= arrowY + arrowSize) {
      this.state.currentLevelNum = Math.min(this.state.currentLevelNum + 1, this.state.highestLevel);
      return;
    }

    // Check upgrade buttons (left panel)
    const upgradeStartY = 180;
    const upgradeH = 50;
    const upgradeW = 200;
    const upgradeSpacing = 8;

    for (let i = 0; i < this.state.upgrades.length; i++) {
      const upgrade = this.state.upgrades[i];
      const btnY = upgradeStartY + i * (upgradeH + upgradeSpacing);

      if (x >= leftPanelX && x <= leftPanelX + upgradeW &&
          y >= btnY && y <= btnY + upgradeH) {
        if (upgrade.currentLevel < upgrade.maxLevel) {
          const cost = this.getUpgradeCost(upgrade);
          if (this.state.totalPoints >= cost) {
            this.state.totalPoints -= cost;
            upgrade.currentLevel++;
            this.addFloatingText(leftPanelX + upgradeW / 2, btnY, 'UPGRADED!', NEON_COLORS.green, 1);
            this.saveProgress();
          } else {
            this.addFloatingText(leftPanelX + upgradeW / 2, btnY, 'Need more points!', NEON_COLORS.red, 0.8);
          }
        }
        return;
      }
    }

    // Check keybind buttons (right panel)
    const keybindStartY = 180;
    const keybindH = 50;
    const keybindW = 200;
    const keybindSpacing = 8;

    for (let i = 0; i < this.state.keybinds.length; i++) {
      const btnY = keybindStartY + i * (keybindH + keybindSpacing);

      if (x >= rightPanelX && x <= rightPanelX + keybindW &&
          y >= btnY && y <= btnY + keybindH) {
        // Start rebinding this lane
        this.state.rebindingLane = i;
        return;
      }
    }
  }

  getUpgradeCost(upgrade: Upgrade): number {
    return Math.floor(upgrade.baseCost * Math.pow(1.5, upgrade.currentLevel));
  }

  private tryHitNote(laneIndex: number): void {
    const hitLineY = this.canvas.height * this.config.hitLineY;

    const timingUpgrade = this.state.upgrades.find(u => u.id === 'timing');
    const windowMultiplier = timingUpgrade ? 1 + (timingUpgrade.currentLevel * timingUpgrade.effect) : 1;
    const effectiveWindow = this.config.baseHitWindow * windowMultiplier;

    let closestNote: Note | null = null;
    let closestDist = Infinity;

    for (const note of this.state.notes) {
      if (note.lane === laneIndex && !note.hit && !note.missed) {
        const dist = Math.abs(note.y - hitLineY);
        if (dist < closestDist && dist < effectiveWindow) {
          closestDist = dist;
          closestNote = note;
        }
      }
    }

    if (closestNote) {
      this.hitNote(closestNote, closestDist);
    } else {
      this.state.lanes[laneIndex].hitEffect = 0.3;
    }
  }

  private hitNote(note: Note, distance: number): void {
    note.hit = true;

    let rating: HitRating;
    let baseScore: number;

    if (distance <= this.config.perfectWindow) {
      rating = HitRating.Perfect;
      baseScore = 100;
      this.state.score.perfectCount++;
    } else if (distance <= this.config.greatWindow) {
      rating = HitRating.Great;
      baseScore = 75;
      this.state.score.greatCount++;
    } else {
      rating = HitRating.Good;
      baseScore = 50;
      this.state.score.goodCount++;
    }

    note.rating = rating;

    // Update combo
    this.state.combo.current++;
    this.state.combo.max = Math.max(this.state.combo.max, this.state.combo.current);
    this.state.combo.multiplier = 1 + Math.floor(this.state.combo.current / 10) * 0.1;

    // Calculate final score with upgrades
    let scoreMultiplier = 1;
    const boostUpgrade = this.state.upgrades.find(u => u.id === 'multiplier');
    if (boostUpgrade) {
      scoreMultiplier += boostUpgrade.currentLevel * boostUpgrade.effect;
    }

    if (rating === HitRating.Perfect) {
      const perfectUpgrade = this.state.upgrades.find(u => u.id === 'perfect_bonus');
      if (perfectUpgrade) {
        scoreMultiplier += perfectUpgrade.currentLevel * perfectUpgrade.effect;
      }
    }

    const finalScore = Math.floor(baseScore * this.state.combo.multiplier * scoreMultiplier);
    this.state.score.current += finalScore;

    // Visual effects
    const lane = this.state.lanes[note.lane];
    lane.hitEffect = 1;
    this.state.beatPulse = Math.min(1, this.state.beatPulse + 0.3);

    this.spawnHitParticles(lane.x + lane.width / 2, this.canvas.height * this.config.hitLineY, lane.color);

    const ratingColors: Record<HitRating, string> = {
      [HitRating.Perfect]: NEON_COLORS.yellow,
      [HitRating.Great]: NEON_COLORS.cyan,
      [HitRating.Good]: NEON_COLORS.green,
      [HitRating.Miss]: NEON_COLORS.red,
    };

    this.addFloatingText(
      lane.x + lane.width / 2,
      this.canvas.height * this.config.hitLineY - 40,
      rating.toUpperCase(),
      ratingColors[rating],
      rating === HitRating.Perfect ? 1.5 : 1
    );

    this.addFloatingText(
      lane.x + lane.width / 2,
      this.canvas.height * this.config.hitLineY - 70,
      `+${finalScore}`,
      '#ffffff',
      0.8
    );
  }

  private missNote(note: Note): void {
    note.missed = true;
    note.rating = HitRating.Miss;
    this.state.score.missCount++;

    const shieldUpgrade = this.state.upgrades.find(u => u.id === 'combo_shield');
    const shieldChance = shieldUpgrade ? shieldUpgrade.currentLevel * shieldUpgrade.effect : 0;

    if (Math.random() < shieldChance) {
      this.addFloatingText(
        this.canvas.width / 2,
        this.canvas.height / 2,
        'COMBO SAVED!',
        NEON_COLORS.purple,
        1.5
      );
    } else {
      this.state.combo.current = 0;
      this.state.combo.multiplier = 1;
    }

    const lane = this.state.lanes[note.lane];
    this.addFloatingText(
      lane.x + lane.width / 2,
      this.canvas.height * this.config.hitLineY - 40,
      'MISS',
      NEON_COLORS.red,
      1
    );
  }

  private startLevel(levelNum: number): void {
    this.currentLevelConfig = generateLevel(levelNum);
    this.levelRng = new SeededRandom(levelNum * 12345);
    this.nextBeatTime = 0;
    this.state.currentLevelNum = levelNum;
    this.state.screen = 'playing';
    this.state.gameTime = -2;
    this.state.notes = [];
    this.state.combo = { current: 0, max: 0, multiplier: 1 };
    this.state.score = { current: 0, display: 0, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0 };
    this.state.isPaused = false;
  }

  private endLevel(): void {
    const levelNum = this.state.currentLevelNum;

    // Update high scores
    const currentHigh = this.state.levelHighScores.get(levelNum) || 0;
    if (this.state.score.current > currentHigh) {
      this.state.levelHighScores.set(levelNum, this.state.score.current);
    }

    const currentMaxCombo = this.state.levelMaxCombos.get(levelNum) || 0;
    if (this.state.combo.max > currentMaxCombo) {
      this.state.levelMaxCombos.set(levelNum, this.state.combo.max);
    }

    // Unlock next level if score is high enough (1000 * level number)
    const unlockThreshold = 1000 * levelNum;
    if (levelNum >= this.state.highestLevel && this.state.score.current >= unlockThreshold) {
      this.state.highestLevel = levelNum + 1;
    }

    // Award points
    const pointsEarned = Math.floor(this.state.score.current / 10);
    this.state.totalPoints += pointsEarned;

    this.state.screen = 'results';
    this.currentLevelConfig = null;
    this.saveProgress();
  }

  private spawnHitParticles(x: number, y: number, color: string): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 150 + Math.random() * 100;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, scale: number = 1): void {
    this.state.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 1,
      maxLife: 1,
      scale,
    });
  }

  private updateParticles(deltaTime: number): void {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy += 200 * deltaTime;
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.state.particles.splice(i, 1);
      }
    }

    while (this.state.particles.length > 200) {
      this.state.particles.shift();
    }
  }

  private updateFloatingTexts(deltaTime: number): void {
    for (let i = this.state.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.state.floatingTexts[i];
      t.y -= 50 * deltaTime;
      t.life -= deltaTime;

      if (t.life <= 0) {
        this.state.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateDisplayScore(deltaTime: number): void {
    const diff = this.state.score.current - this.state.score.display;
    if (Math.abs(diff) < 1) {
      this.state.score.display = this.state.score.current;
    } else {
      this.state.score.display += diff * deltaTime * 5;
    }
  }

  private saveProgress(): void {
    try {
      const saveData: SaveData = {
        totalPoints: this.state.totalPoints,
        highestLevel: this.state.highestLevel,
        upgrades: this.state.upgrades.map(u => ({ id: u.id, level: u.currentLevel })),
        levelHighScores: Array.from(this.state.levelHighScores.entries()),
        levelMaxCombos: Array.from(this.state.levelMaxCombos.entries()),
        keybinds: this.state.keybinds,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  private loadProgress(): void {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return;

      const data: SaveData = JSON.parse(saved);
      this.state.totalPoints = data.totalPoints || 0;
      this.state.highestLevel = data.highestLevel || 1;

      for (const savedUpgrade of data.upgrades || []) {
        const upgrade = this.state.upgrades.find(u => u.id === savedUpgrade.id);
        if (upgrade) {
          upgrade.currentLevel = savedUpgrade.level;
        }
      }

      if (data.levelHighScores) {
        this.state.levelHighScores = new Map(data.levelHighScores);
      }
      if (data.levelMaxCombos) {
        this.state.levelMaxCombos = new Map(data.levelMaxCombos);
      }

      // Load keybinds and sync to lanes
      if (data.keybinds && data.keybinds.length === this.config.laneCount) {
        this.state.keybinds = data.keybinds;
        for (let i = 0; i < this.state.lanes.length; i++) {
          this.state.lanes[i].key = data.keybinds[i];
        }
      }
    } catch (e) {
      console.warn('Failed to load progress:', e);
    }
  }
}
