import {
  GameState,
  GameConfig,
  DEFAULT_CONFIG,
  Note,
  NoteType,
  Lane,
  Level,
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
import { generateLevels } from './levels';

let noteIdCounter = 0;

const SAVE_KEY = 'combo_surge_save';

interface SaveData {
  totalPoints: number;
  upgrades: { id: string; level: number }[];
  levels: { id: number; unlocked: boolean; highScore: number; maxCombo: number }[];
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
      currentLevel: null,
      gameTime: 0,
      notes: [],
      lanes,
      combo: { current: 0, max: 0, multiplier: 1 },
      score: { current: 0, display: 0, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0 },
      particles: [],
      floatingTexts: [],
      totalPoints: 0,
      upgrades,
      levels: generateLevels(),
      isPaused: false,
      hitWindow: this.config.baseHitWindow,
      noteSpeed: this.config.baseNoteSpeed,
      beatPulse: 0,
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
    render(this.ctx, this.state, this.config);

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
    const level = this.state.currentLevel;
    if (!level) return;

    this.state.gameTime += deltaTime;

    // Apply upgrades to note speed
    const slowUpgrade = this.state.upgrades.find(u => u.id === 'slow_notes');
    const speedMultiplier = slowUpgrade ? 1 - (slowUpgrade.currentLevel * slowUpgrade.effect) : 1;
    const effectiveSpeed = this.config.baseNoteSpeed * speedMultiplier;

    // Spawn notes based on patterns
    const hitLineY = this.canvas.height * this.config.hitLineY;
    const travelTime = hitLineY / effectiveSpeed;

    for (const pattern of level.patterns) {
      const patternTime = pattern.time * level.duration;
      const spawnTime = patternTime - travelTime;

      // Check if we should spawn this pattern
      if (this.state.gameTime >= spawnTime && this.state.gameTime < spawnTime + deltaTime) {
        for (const laneIndex of pattern.lanes) {
          if (laneIndex >= 0 && laneIndex < this.config.laneCount) {
            const note: Note = {
              id: `note_${noteIdCounter++}`,
              lane: laneIndex,
              type: pattern.type,
              spawnTime: spawnTime,
              hitTime: patternTime,
              holdDuration: pattern.holdDuration,
              y: -30,
              hit: false,
              missed: false,
            };
            this.state.notes.push(note);
          }
        }
      }
    }

    // Update note positions
    for (const note of this.state.notes) {
      if (!note.hit && !note.missed) {
        note.y += effectiveSpeed * deltaTime;

        // Check if note is missed (passed the hit line by too much)
        const hitLineY = this.canvas.height * this.config.hitLineY;
        if (note.y > hitLineY + 50) {
          this.missNote(note);
        }
      }
    }

    // Clean up old notes
    this.state.notes = this.state.notes.filter(n => n.y < this.canvas.height + 50);

    // Update beat pulse based on BPM
    const beatInterval = 60 / level.bpm;
    const beatPhase = (this.state.gameTime % beatInterval) / beatInterval;
    if (beatPhase < 0.1) {
      this.state.beatPulse = Math.max(this.state.beatPulse, 1 - beatPhase * 10);
    }

    // Check if level is complete
    if (this.state.gameTime >= level.duration + 2) {
      this.endLevel();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toUpperCase();

    if (this.state.screen === 'playing') {
      // Check if it's a lane key
      const laneIndex = LANE_KEYS.indexOf(key);
      if (laneIndex !== -1 && !this.state.lanes[laneIndex].pressed) {
        this.state.lanes[laneIndex].pressed = true;
        this.tryHitNote(laneIndex);
      }

      // Escape to pause
      if (e.key === 'Escape') {
        this.state.isPaused = !this.state.isPaused;
      }
    } else if (this.state.screen === 'menu') {
      // Space to start first unlocked level
      if (e.key === ' ') {
        const firstLevel = this.state.levels.find(l => l.unlocked);
        if (firstLevel) {
          this.startLevel(firstLevel);
        }
      }
    } else if (this.state.screen === 'results') {
      // Space to return to menu
      if (e.key === ' ') {
        this.state.screen = 'menu';
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toUpperCase();
    const laneIndex = LANE_KEYS.indexOf(key);
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
      // Click anywhere to continue
      this.state.screen = 'menu';
    } else if (this.state.screen === 'upgrades') {
      this.handleUpgradeClick(x, y);
    }
  }

  private handleMenuClick(x: number, y: number): void {
    const centerX = this.canvas.width / 2;
    const startY = 280;
    const buttonHeight = 60;
    const buttonWidth = 300;
    const spacing = 20;

    // Check level buttons
    for (let i = 0; i < this.state.levels.length; i++) {
      const level = this.state.levels[i];
      const btnY = startY + i * (buttonHeight + spacing);
      const btnX = centerX - buttonWidth / 2;

      if (x >= btnX && x <= btnX + buttonWidth && y >= btnY && y <= btnY + buttonHeight) {
        if (level.unlocked) {
          this.startLevel(level);
        } else if (this.state.totalPoints >= level.unlockCost) {
          // Unlock the level
          this.state.totalPoints -= level.unlockCost;
          level.unlocked = true;
          this.saveProgress();
        }
        return;
      }
    }

    // Check upgrades button
    const upgradeBtnY = startY + this.state.levels.length * (buttonHeight + spacing) + 20;
    const upgradeBtnX = centerX - buttonWidth / 2;
    if (x >= upgradeBtnX && x <= upgradeBtnX + buttonWidth && y >= upgradeBtnY && y <= upgradeBtnY + buttonHeight) {
      this.state.screen = 'upgrades';
    }
  }

  private handleUpgradeClick(x: number, y: number): void {
    const centerX = this.canvas.width / 2;
    const startY = 180;
    const buttonHeight = 70;
    const buttonWidth = 400;
    const spacing = 15;

    // Check upgrade buttons
    for (let i = 0; i < this.state.upgrades.length; i++) {
      const upgrade = this.state.upgrades[i];
      const btnY = startY + i * (buttonHeight + spacing);
      const btnX = centerX - buttonWidth / 2;

      if (x >= btnX && x <= btnX + buttonWidth && y >= btnY && y <= btnY + buttonHeight) {
        if (upgrade.currentLevel < upgrade.maxLevel) {
          const cost = this.getUpgradeCost(upgrade);
          if (this.state.totalPoints >= cost) {
            this.state.totalPoints -= cost;
            upgrade.currentLevel++;
            this.saveProgress();
          }
        }
        return;
      }
    }

    // Check back button
    const backBtnY = startY + this.state.upgrades.length * (buttonHeight + spacing) + 20;
    const backBtnX = centerX - 100;
    if (x >= backBtnX && x <= backBtnX + 200 && y >= backBtnY && y <= backBtnY + 50) {
      this.state.screen = 'menu';
    }
  }

  private getUpgradeCost(upgrade: Upgrade): number {
    return Math.floor(upgrade.cost * Math.pow(1.5, upgrade.currentLevel));
  }

  private tryHitNote(laneIndex: number): void {
    const hitLineY = this.canvas.height * this.config.hitLineY;

    // Apply timing upgrade
    const timingUpgrade = this.state.upgrades.find(u => u.id === 'timing');
    const windowMultiplier = timingUpgrade ? 1 + (timingUpgrade.currentLevel * timingUpgrade.effect) : 1;
    const effectiveWindow = this.config.baseHitWindow * windowMultiplier;

    // Find the closest note in this lane that can be hit
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
      // Pressed with no note nearby - could add a penalty here
      this.state.lanes[laneIndex].hitEffect = 0.3;
    }
  }

  private hitNote(note: Note, distance: number): void {
    note.hit = true;

    // Determine rating based on timing
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

    // Perfect bonus
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

    // Spawn particles
    this.spawnHitParticles(lane.x + lane.width / 2, this.canvas.height * this.config.hitLineY, lane.color);

    // Floating text
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

    // Show score
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

    // Check combo shield
    const shieldUpgrade = this.state.upgrades.find(u => u.id === 'combo_shield');
    const shieldChance = shieldUpgrade ? shieldUpgrade.currentLevel * shieldUpgrade.effect : 0;

    if (Math.random() < shieldChance) {
      // Combo saved!
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

  private startLevel(level: Level): void {
    this.state.currentLevel = { ...level };
    this.state.screen = 'playing';
    this.state.gameTime = -2; // Countdown before start
    this.state.notes = [];
    this.state.combo = { current: 0, max: 0, multiplier: 1 };
    this.state.score = { current: 0, display: 0, perfectCount: 0, greatCount: 0, goodCount: 0, missCount: 0 };
    this.state.isPaused = false;
  }

  private endLevel(): void {
    const level = this.state.currentLevel;
    if (!level) return;

    // Update level stats
    const levelData = this.state.levels.find(l => l.id === level.id);
    if (levelData) {
      if (this.state.score.current > levelData.highScore) {
        levelData.highScore = this.state.score.current;
      }
      if (this.state.combo.max > levelData.maxCombo) {
        levelData.maxCombo = this.state.combo.max;
      }
    }

    // Award points (score / 10)
    const pointsEarned = Math.floor(this.state.score.current / 10);
    this.state.totalPoints += pointsEarned;

    this.state.screen = 'results';
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
      p.vy += 200 * deltaTime; // Gravity
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.state.particles.splice(i, 1);
      }
    }

    // Cap particles
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
    // Animate display score towards actual score
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
        upgrades: this.state.upgrades.map(u => ({ id: u.id, level: u.currentLevel })),
        levels: this.state.levels.map(l => ({
          id: l.id,
          unlocked: l.unlocked,
          highScore: l.highScore,
          maxCombo: l.maxCombo,
        })),
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

      // Restore upgrades
      for (const savedUpgrade of data.upgrades || []) {
        const upgrade = this.state.upgrades.find(u => u.id === savedUpgrade.id);
        if (upgrade) {
          upgrade.currentLevel = savedUpgrade.level;
        }
      }

      // Restore level progress
      for (const savedLevel of data.levels || []) {
        const level = this.state.levels.find(l => l.id === savedLevel.id);
        if (level) {
          level.unlocked = savedLevel.unlocked;
          level.highScore = savedLevel.highScore;
          level.maxCombo = savedLevel.maxCombo;
        }
      }
    } catch (e) {
      console.warn('Failed to load progress:', e);
    }
  }
}
