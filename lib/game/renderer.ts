import { GameState, GameConfig, Note, Lane, HitRating, NEON_COLORS } from '../types';

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig
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
      drawGameplay(ctx, state, config);
      break;
    case 'results':
      drawResults(ctx, state);
      break;
    case 'upgrades':
      drawUpgrades(ctx, state);
      break;
  }

  // Always draw particles and floating texts
  drawParticles(ctx, state);
  drawFloatingTexts(ctx, state);
}

function drawMenu(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = ctx.canvas;
  const centerX = width / 2;

  // Background grid effect
  drawGrid(ctx, width, height, state.beatPulse);

  // Title with glow
  ctx.save();
  ctx.shadowColor = NEON_COLORS.pink;
  ctx.shadowBlur = 30;
  ctx.fillStyle = NEON_COLORS.pink;
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('COMBO SURGE', centerX, 120);
  ctx.restore();

  // Subtitle
  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.font = '24px Arial';
  ctx.fillText('Build combos. Get points. Unlock everything.', centerX, 170);

  // Points display
  ctx.save();
  ctx.shadowColor = NEON_COLORS.yellow;
  ctx.shadowBlur = 15;
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(`POINTS: ${state.totalPoints}`, centerX, 220);
  ctx.restore();

  // Level buttons
  const startY = 280;
  const buttonHeight = 60;
  const buttonWidth = 300;
  const spacing = 20;

  for (let i = 0; i < state.levels.length; i++) {
    const level = state.levels[i];
    const btnY = startY + i * (buttonHeight + spacing);
    const btnX = centerX - buttonWidth / 2;

    drawButton(ctx, btnX, btnY, buttonWidth, buttonHeight, level.unlocked, () => {
      // Button content
      if (level.unlocked) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(level.name, btnX + 15, btnY + 25);

        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.font = '14px Arial';
        ctx.fillText(`${level.bpm} BPM`, btnX + 15, btnY + 45);

        if (level.highScore > 0) {
          ctx.fillStyle = NEON_COLORS.yellow;
          ctx.textAlign = 'right';
          ctx.fillText(`Best: ${level.highScore}`, btnX + buttonWidth - 15, btnY + 25);
          ctx.fillStyle = NEON_COLORS.green;
          ctx.fillText(`Max Combo: ${level.maxCombo}`, btnX + buttonWidth - 15, btnY + 45);
        }
      } else {
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(level.name, btnX + 15, btnY + 25);

        ctx.fillStyle = state.totalPoints >= level.unlockCost ? NEON_COLORS.green : NEON_COLORS.red;
        ctx.font = '14px Arial';
        ctx.fillText(`Unlock: ${level.unlockCost} points`, btnX + 15, btnY + 45);
      }
    });
  }

  // Upgrades button
  const upgradeBtnY = startY + state.levels.length * (buttonHeight + spacing) + 20;
  drawButton(ctx, centerX - buttonWidth / 2, upgradeBtnY, buttonWidth, buttonHeight, true, () => {
    ctx.fillStyle = NEON_COLORS.purple;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADES', centerX, upgradeBtnY + 38);
  });

  // Controls hint
  ctx.fillStyle = '#666666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Use D, F, J, K to hit notes | SPACE to quick start', centerX, height - 30);
}

function drawGameplay(ctx: CanvasRenderingContext2D, state: GameState, config: GameConfig): void {
  const { width, height } = ctx.canvas;
  const hitLineY = height * config.hitLineY;

  // Background with beat pulse
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
  drawGameUI(ctx, state, width);

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

  // Fill when pressed
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

  // Note glow
  ctx.save();
  ctx.shadowColor = lane.color;
  ctx.shadowBlur = 15;

  // Note body
  ctx.fillStyle = lane.color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - 5, y - 5, size / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Miss indicator (turn red when past hit line)
  if (note.y > hitLineY + 20 && !note.missed) {
    ctx.fillStyle = NEON_COLORS.red + '88';
    ctx.beginPath();
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGameUI(ctx: CanvasRenderingContext2D, state: GameState, width: number): void {
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

  // Progress bar (top center)
  if (state.currentLevel) {
    const barWidth = 300;
    const barHeight = 8;
    const barX = (width - barWidth) / 2;
    const barY = 20;
    const progress = Math.max(0, state.gameTime / state.currentLevel.duration);

    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    gradient.addColorStop(0, NEON_COLORS.pink);
    gradient.addColorStop(1, NEON_COLORS.cyan);
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth * Math.min(1, progress), barHeight);
  }
}

function drawResults(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = ctx.canvas;
  const centerX = width / 2;

  drawGrid(ctx, width, height, 0);

  // Title
  ctx.save();
  ctx.shadowColor = NEON_COLORS.green;
  ctx.shadowBlur = 30;
  ctx.fillStyle = NEON_COLORS.green;
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL COMPLETE!', centerX, 100);
  ctx.restore();

  // Level name
  if (state.currentLevel) {
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.font = '28px Arial';
    ctx.fillText(state.currentLevel.name, centerX, 150);
  }

  // Stats
  const statsY = 220;
  const lineHeight = 50;

  ctx.font = 'bold 32px Arial';

  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.fillText(`Final Score: ${state.score.current}`, centerX, statsY);

  ctx.fillStyle = NEON_COLORS.cyan;
  ctx.fillText(`Max Combo: ${state.combo.max}x`, centerX, statsY + lineHeight);

  ctx.font = '24px Arial';
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.fillText(`Perfect: ${state.score.perfectCount}`, centerX - 120, statsY + lineHeight * 2);
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

  // Continue hint
  ctx.fillStyle = '#666666';
  ctx.font = '20px Arial';
  ctx.fillText('Click or press SPACE to continue', centerX, height - 50);
}

function drawUpgrades(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = ctx.canvas;
  const centerX = width / 2;

  drawGrid(ctx, width, height, 0);

  // Title
  ctx.save();
  ctx.shadowColor = NEON_COLORS.purple;
  ctx.shadowBlur = 30;
  ctx.fillStyle = NEON_COLORS.purple;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('UPGRADES', centerX, 80);
  ctx.restore();

  // Points
  ctx.fillStyle = NEON_COLORS.yellow;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Available Points: ${state.totalPoints}`, centerX, 130);

  // Upgrade buttons
  const startY = 180;
  const buttonHeight = 70;
  const buttonWidth = 400;
  const spacing = 15;

  for (let i = 0; i < state.upgrades.length; i++) {
    const upgrade = state.upgrades[i];
    const btnY = startY + i * (buttonHeight + spacing);
    const btnX = centerX - buttonWidth / 2;
    const cost = Math.floor(upgrade.cost * Math.pow(1.5, upgrade.currentLevel));
    const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;
    const canAfford = state.totalPoints >= cost;

    drawButton(ctx, btnX, btnY, buttonWidth, buttonHeight, !isMaxed && canAfford, () => {
      ctx.textAlign = 'left';

      // Name
      ctx.fillStyle = isMaxed ? NEON_COLORS.green : '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(upgrade.name, btnX + 15, btnY + 25);

      // Description
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial';
      ctx.fillText(upgrade.description, btnX + 15, btnY + 45);

      // Level
      ctx.textAlign = 'right';
      ctx.fillStyle = NEON_COLORS.cyan;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`Lv ${upgrade.currentLevel}/${upgrade.maxLevel}`, btnX + buttonWidth - 15, btnY + 25);

      // Cost
      if (!isMaxed) {
        ctx.fillStyle = canAfford ? NEON_COLORS.green : NEON_COLORS.red;
        ctx.font = '14px Arial';
        ctx.fillText(`Cost: ${cost}`, btnX + buttonWidth - 15, btnY + 50);
      } else {
        ctx.fillStyle = NEON_COLORS.green;
        ctx.fillText('MAXED', btnX + buttonWidth - 15, btnY + 50);
      }
    });
  }

  // Back button
  const backBtnY = startY + state.upgrades.length * (buttonHeight + spacing) + 20;
  drawButton(ctx, centerX - 100, backBtnY, 200, 50, true, () => {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BACK', centerX, backBtnY + 32);
  });
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  active: boolean,
  drawContent: () => void
): void {
  // Background
  ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = active ? NEON_COLORS.cyan : '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Glow effect for active buttons
  if (active) {
    ctx.save();
    ctx.shadowColor = NEON_COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  // Draw content
  drawContent();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, pulse: number): void {
  const gridSize = 50;
  const alpha = 0.1 + pulse * 0.1;

  ctx.strokeStyle = `rgba(100, 100, 150, ${alpha})`;
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Horizon glow at bottom
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
