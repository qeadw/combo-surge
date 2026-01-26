import { GameState, GameConfig, Note, Lane, HitRating, LevelConfig, NEON_COLORS } from '../types';
import { getLevelName, generateLevel } from './levels';

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
  levelConfig: LevelConfig | null
): void {
  const { width, height } = ctx.canvas;

  // Clear with dark background
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  // Draw based on current screen
  switch (state.screen) {
    case 'menu':
      drawMenu(ctx, state);
      break;
    case 'playing':
      drawGameplay(ctx, state, config, levelConfig);
      break;
    case 'results':
      drawResults(ctx, state);
      break;
  }

  // Always draw particles and floating texts
  drawParticles(ctx, state);
  drawFloatingTexts(ctx, state);
}

function drawMenu(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = ctx.canvas;
  const centerX = width / 2;

  drawGrid(ctx, width, height, state.beatPulse);

  // Title with glow
  ctx.save();
  ctx.shadowColor = NEON_COLORS.pink;
  ctx.shadowBlur = 30;
  ctx.fillStyle = NEON_COLORS.pink;
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('COMBO SURGE', centerX, 80);
  ctx.restore();

  // Points display
  ctx.save();
  ctx.shadowColor = NEON_COLORS.yellow;
  ctx.shadowBlur = 15;
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`POINTS: ${state.totalPoints}`, centerX, 120);
  ctx.restore();

  // === LEFT PANEL: UPGRADES ===
  const leftPanelX = 40;
  ctx.fillStyle = NEON_COLORS.purple;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('UPGRADES', leftPanelX, 160);

  const upgradeStartY = 180;
  const upgradeH = 50;
  const upgradeW = 200;
  const upgradeSpacing = 8;

  for (let i = 0; i < state.upgrades.length; i++) {
    const upgrade = state.upgrades[i];
    const btnY = upgradeStartY + i * (upgradeH + upgradeSpacing);
    const cost = Math.floor(upgrade.baseCost * Math.pow(1.5, upgrade.currentLevel));
    const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;
    const canAfford = state.totalPoints >= cost;

    // Button background
    ctx.fillStyle = isMaxed ? 'rgba(0, 255, 0, 0.1)' : canAfford ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(leftPanelX, btnY, upgradeW, upgradeH);

    // Border
    ctx.strokeStyle = isMaxed ? NEON_COLORS.green : canAfford ? NEON_COLORS.cyan : '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftPanelX, btnY, upgradeW, upgradeH);

    // Name
    ctx.fillStyle = isMaxed ? NEON_COLORS.green : '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(upgrade.name, leftPanelX + 8, btnY + 18);

    // Level bar
    const barX = leftPanelX + 8;
    const barY = btnY + 26;
    const barW = upgradeW - 16;
    const barH = 6;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.fillRect(barX, barY, barW * (upgrade.currentLevel / upgrade.maxLevel), barH);

    // Cost or MAXED
    ctx.font = '11px Arial';
    if (isMaxed) {
      ctx.fillStyle = NEON_COLORS.green;
      ctx.fillText('MAXED', leftPanelX + 8, btnY + 45);
    } else {
      ctx.fillStyle = canAfford ? NEON_COLORS.green : NEON_COLORS.red;
      ctx.fillText(`Cost: ${cost}`, leftPanelX + 8, btnY + 45);
    }

    // Level text
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText(`Lv ${upgrade.currentLevel}/${upgrade.maxLevel}`, leftPanelX + upgradeW - 8, btnY + 45);
  }

  // === CENTER: PLAY BUTTON & LEVEL SELECT ===
  const playBtnY = 280;
  const playBtnW = 250;
  const playBtnH = 60;

  // Play button
  ctx.save();
  ctx.shadowColor = NEON_COLORS.green;
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
  ctx.fillRect(centerX - playBtnW / 2, playBtnY, playBtnW, playBtnH);
  ctx.strokeStyle = NEON_COLORS.green;
  ctx.lineWidth = 3;
  ctx.strokeRect(centerX - playBtnW / 2, playBtnY, playBtnW, playBtnH);
  ctx.fillStyle = NEON_COLORS.green;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PLAY', centerX, playBtnY + 40);
  ctx.restore();

  // Level selector
  const levelY = 380;
  const currentLevel = generateLevel(state.currentLevelNum);
  const levelName = getLevelName(state.currentLevelNum);

  // Arrows
  ctx.fillStyle = state.currentLevelNum > 1 ? NEON_COLORS.cyan : '#333';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('<', centerX - 80, levelY + 10);

  ctx.fillStyle = state.currentLevelNum < state.highestLevel ? NEON_COLORS.cyan : '#333';
  ctx.fillText('>', centerX + 80, levelY + 10);

  // Level info
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Level ${state.currentLevelNum}`, centerX, levelY);

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial';
  ctx.fillText(levelName, centerX, levelY + 30);

  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.font = '14px Arial';
  ctx.fillText(`${currentLevel.bpm} BPM | Endless`, centerX, levelY + 55);

  // High score for this level
  const highScore = state.levelHighScores.get(state.currentLevelNum) || 0;
  const maxCombo = state.levelMaxCombos.get(state.currentLevelNum) || 0;
  if (highScore > 0) {
    ctx.fillStyle = NEON_COLORS.yellow;
    ctx.fillText(`Best: ${highScore} | Max Combo: ${maxCombo}x`, centerX, levelY + 80);
  }

  // Highest level unlocked
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.fillText(`Highest Level Unlocked: ${state.highestLevel}`, centerX, levelY + 110);

  // === RIGHT PANEL: KEYBINDS ===
  const rightPanelX = width - 240;
  ctx.fillStyle = NEON_COLORS.orange;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('KEYBINDS', rightPanelX, 160);

  const keybindStartY = 180;
  const keybindH = 50;
  const keybindW = 200;
  const keybindSpacing = 8;
  const laneNames = ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'];

  for (let i = 0; i < state.keybinds.length; i++) {
    const btnY = keybindStartY + i * (keybindH + keybindSpacing);
    const isRebinding = state.rebindingLane === i;

    // Button background
    ctx.fillStyle = isRebinding ? 'rgba(255, 136, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(rightPanelX, btnY, keybindW, keybindH);

    // Border
    ctx.strokeStyle = isRebinding ? NEON_COLORS.orange : state.lanes[i].color;
    ctx.lineWidth = isRebinding ? 3 : 2;
    ctx.strokeRect(rightPanelX, btnY, keybindW, keybindH);

    // Lane name
    ctx.fillStyle = state.lanes[i].color;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(laneNames[i], rightPanelX + 10, btnY + 22);

    // Current key or "Press any key"
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    if (isRebinding) {
      ctx.fillStyle = NEON_COLORS.orange;
      ctx.fillText('Press key...', rightPanelX + keybindW - 10, btnY + 32);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.keybinds[i], rightPanelX + keybindW - 10, btnY + 32);
    }
  }

  // Controls hint
  ctx.fillStyle = '#555';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SPACE to play | W/S or Arrows to change level', centerX, height - 60);
  ctx.fillText(`${state.keybinds.join(', ')} to hit notes | ESC to pause`, centerX, height - 40);
}

function drawGameplay(ctx: CanvasRenderingContext2D, state: GameState, config: GameConfig, levelConfig: LevelConfig | null): void {
  const { width, height } = ctx.canvas;
  const hitLineY = height * config.hitLineY;

  drawGrid(ctx, width, height, state.beatPulse);

  // Draw lanes
  for (const lane of state.lanes) {
    drawLane(ctx, lane, height, hitLineY, state.beatPulse);
  }

  // Draw hit line
  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10 + state.beatPulse * 10;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(state.lanes[0].x - 10, hitLineY);
  ctx.lineTo(state.lanes[state.lanes.length - 1].x + state.lanes[0].width + 10, hitLineY);
  ctx.stroke();
  ctx.restore();

  // Draw notes
  for (const note of state.notes) {
    if (!note.hit) {
      drawNote(ctx, note, state.lanes[note.lane], hitLineY);
    }
  }

  // Draw UI
  drawGameUI(ctx, state, width, levelConfig);

  // Countdown
  if (state.gameTime < 0) {
    ctx.save();
    ctx.fillStyle = NEON_COLORS.yellow;
    ctx.shadowColor = NEON_COLORS.yellow;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    const countdown = Math.ceil(-state.gameTime);
    ctx.fillText(countdown > 0 ? countdown.toString() : 'GO!', width / 2, height / 2);
    ctx.restore();
  }

  // Pause overlay
  if (state.isPaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.shadowColor = NEON_COLORS.cyan;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', width / 2, height / 2);
    ctx.font = '24px Arial';
    ctx.fillText('Press ESC to resume', width / 2, height / 2 + 50);
    ctx.restore();
  }
}

function drawLane(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  height: number,
  hitLineY: number,
  beatPulse: number
): void {
  // Lane background
  const gradient = ctx.createLinearGradient(lane.x, 0, lane.x, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fillRect(lane.x, 0, lane.width, height);

  // Lane borders
  ctx.strokeStyle = lane.glowColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lane.x, 0);
  ctx.lineTo(lane.x, height);
  ctx.moveTo(lane.x + lane.width, 0);
  ctx.lineTo(lane.x + lane.width, height);
  ctx.stroke();

  // Hit zone circle
  const hitZoneRadius = 25 + lane.hitEffect * 15 + beatPulse * 5;
  ctx.save();
  ctx.shadowColor = lane.color;
  ctx.shadowBlur = 15 + lane.hitEffect * 20;
  ctx.strokeStyle = lane.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(lane.x + lane.width / 2, hitLineY, hitZoneRadius, 0, Math.PI * 2);
  ctx.stroke();

  if (lane.pressed || lane.hitEffect > 0.5) {
    ctx.fillStyle = lane.color + '44';
    ctx.fill();
  }
  ctx.restore();

  // Key label
  ctx.fillStyle = lane.pressed ? lane.color : '#666666';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(lane.key, lane.x + lane.width / 2, height - 20);
}

function drawNote(ctx: CanvasRenderingContext2D, note: Note, lane: Lane, hitLineY: number): void {
  const x = lane.x + lane.width / 2;
  const y = note.y;
  const size = 20;

  ctx.save();
  ctx.shadowColor = lane.color;
  ctx.shadowBlur = 15;

  ctx.fillStyle = lane.color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - 5, y - 5, size / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (note.y > hitLineY + 20 && !note.missed) {
    ctx.fillStyle = NEON_COLORS.red + '88';
    ctx.beginPath();
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGameUI(ctx: CanvasRenderingContext2D, state: GameState, width: number, levelConfig: LevelConfig | null): void {
  const padding = 20;

  // Score (top right)
  ctx.save();
  ctx.shadowColor = NEON_COLORS.yellow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(Math.floor(state.score.display).toString(), width - padding, 50);
  ctx.restore();

  ctx.fillStyle = '#888888';
  ctx.font = '16px Arial';
  ctx.fillText('SCORE', width - padding, 70);

  // Level info
  ctx.fillStyle = '#666';
  ctx.font = '14px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Level ${state.currentLevelNum}`, width - padding, 95);

  // Combo (top left)
  if (state.combo.current > 0) {
    ctx.save();
    const comboScale = 1 + Math.min(state.combo.current / 100, 0.5);
    ctx.shadowColor = NEON_COLORS.cyan;
    ctx.shadowBlur = 15;
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.font = `bold ${Math.floor(48 * comboScale)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`${state.combo.current}x`, padding, 55);
    ctx.restore();

    ctx.fillStyle = '#888888';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Multiplier: ${state.combo.multiplier.toFixed(1)}x`, padding, 80);
  }

  // Miss counter (top center) - 10 misses = game over
  const maxMisses = 10;
  const missBarWidth = 200;
  const missBarHeight = 12;
  const missBarX = (width - missBarWidth) / 2;
  const missBarY = 20;

  ctx.fillStyle = '#333333';
  ctx.fillRect(missBarX, missBarY, missBarWidth, missBarHeight);

  const missProgress = state.score.missCount / maxMisses;
  ctx.fillStyle = missProgress > 0.7 ? NEON_COLORS.red : missProgress > 0.4 ? NEON_COLORS.orange : NEON_COLORS.green;
  ctx.fillRect(missBarX, missBarY, missBarWidth * missProgress, missBarHeight);

  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(missBarX, missBarY, missBarWidth, missBarHeight);

  ctx.fillStyle = '#888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.score.missCount} / ${maxMisses} misses`, width / 2, missBarY + 26);
}

function drawResults(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = ctx.canvas;
  const centerX = width / 2;

  drawGrid(ctx, width, height, 0);

  // Title
  ctx.save();
  ctx.shadowColor = NEON_COLORS.red;
  ctx.shadowBlur = 30;
  ctx.fillStyle = NEON_COLORS.red;
  ctx.font = 'bold 52px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', centerX, 100);
  ctx.restore();

  // Level name
  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.font = '24px Arial';
  ctx.fillText(`Level ${state.currentLevelNum} - ${getLevelName(state.currentLevelNum)}`, centerX, 145);

  // Stats
  const statsY = 200;
  const lineHeight = 45;

  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.fillText(`Final Score: ${state.score.current}`, centerX, statsY);

  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.fillText(`Max Combo: ${state.combo.max}x`, centerX, statsY + lineHeight);

  ctx.font = '22px Arial';
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.fillText(`Perfect: ${state.score.perfectCount}`, centerX - 100, statsY + lineHeight * 2);
  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.fillText(`Great: ${state.score.greatCount}`, centerX, statsY + lineHeight * 2);
  ctx.fillStyle = NEON_COLORS.green;
  ctx.fillText(`Good: ${state.score.goodCount}`, centerX + 100, statsY + lineHeight * 2);

  ctx.fillStyle = NEON_COLORS.red;
  ctx.fillText(`Miss: ${state.score.missCount}`, centerX, statsY + lineHeight * 3);

  // Points earned
  const pointsEarned = Math.floor(state.score.current / 10);
  ctx.save();
  ctx.shadowColor = NEON_COLORS.purple;
  ctx.shadowBlur = 20;
  ctx.fillStyle = NEON_COLORS.purple;
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`+${pointsEarned} POINTS`, centerX, statsY + lineHeight * 4.5);
  ctx.restore();

  // New high score indicator
  const isNewHighScore = state.score.current > (state.levelHighScores.get(state.currentLevelNum) || 0);
  if (isNewHighScore && state.score.current > 0) {
    ctx.fillStyle = NEON_COLORS.yellow;
    ctx.font = 'bold 20px Arial';
    ctx.fillText('NEW HIGH SCORE!', centerX, statsY + lineHeight * 5.5);
  }

  // Level unlock info
  const unlockThreshold = 1000 * state.currentLevelNum;
  const unlockedNext = state.score.current >= unlockThreshold && state.currentLevelNum >= state.highestLevel - 1;
  ctx.font = '16px Arial';
  if (unlockedNext) {
    ctx.fillStyle = NEON_COLORS.green;
    ctx.fillText(`Level ${state.currentLevelNum + 1} Unlocked!`, centerX, statsY + lineHeight * 6.2);
  } else if (state.currentLevelNum >= state.highestLevel) {
    ctx.fillStyle = '#666';
    ctx.fillText(`Need ${unlockThreshold} pts to unlock Level ${state.currentLevelNum + 1}`, centerX, statsY + lineHeight * 6.2);
  }

  // Continue hint
  ctx.fillStyle = '#666666';
  ctx.font = '18px Arial';
  ctx.fillText('Click or press SPACE to continue', centerX, height - 50);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, pulse: number): void {
  const gridSize = 50;
  const alpha = 0.1 + pulse * 0.1;

  ctx.strokeStyle = `rgba(100, 100, 150, ${alpha})`;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const horizonGradient = ctx.createLinearGradient(0, height - 200, 0, height);
  horizonGradient.addColorStop(0, 'rgba(255, 0, 255, 0)');
  horizonGradient.addColorStop(0.5, `rgba(255, 0, 255, ${0.1 + pulse * 0.1})`);
  horizonGradient.addColorStop(1, `rgba(0, 255, 255, ${0.2 + pulse * 0.1})`);
  ctx.fillStyle = horizonGradient;
  ctx.fillRect(0, height - 200, width, 200);
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.floatingTexts) {
    const alpha = t.life / t.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = t.color;
    ctx.font = `bold ${Math.floor(24 * t.scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}
