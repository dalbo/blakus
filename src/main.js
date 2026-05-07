const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

canvas.width  = 800;
canvas.height = 500;
ctx.imageSmoothingEnabled = false; // pixel-art crispness

const input = new Input();

let currentLevel = 0;
let respawns     = 0;
let gameState    = 'menu'; // 'menu' | 'playing' | 'paused' | 'won'
let pauseStartMs = 0;      // when the current pause began (for timer offset)

// Timer state — times are in ms, converted on display
let levelStartMs = 0;
let levelTimes   = []; // filled in as each level's door is entered

// Crown: earned by beating level 5 with 0 respawns. Persists across sessions.
const CROWN_KEY = 'blakus_crown';
let hasCrown = false;
try { hasCrown = localStorage.getItem(CROWN_KEY) === 'true'; } catch (e) {}
let justEarnedCrown = false; // set on the run that unlocks it

function formatTime(ms) {
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
  return `${mins}:${secs}`;
}

let level, player, camera;

function snapCamera() {
  camera.x = Math.max(0, Math.min(player.x + player.width  / 2 - canvas.width  / 2, level.width  - canvas.width));
  camera.y = Math.max(0, Math.min(player.y + player.height / 2 - canvas.height / 2, level.height - canvas.height));
}

function doRespawn() {
  respawns++;
  player.respawn(level.spawnX, level.spawnY);
  snapCamera();
}

function loadLevel(n) {
  const wasInvincible = player ? player.invincible : false;
  currentLevel = n;
  level  = new Level(n);
  player = new Player(level.spawnX, level.spawnY);
  player.hasCrown = hasCrown;
  player.invincible = wasInvincible;
  camera = new Camera(canvas.width, canvas.height, level.width, level.height);
  snapCamera();
}

function startGame() {
  respawns        = 0;
  levelTimes      = [];
  justEarnedCrown = false;
  levelStartMs    = performance.now();
  loadLevel(0);
  gameState = 'playing';
}

loadLevel(0); // initialize refs so state transitions are safe

let lastTime = null;

function drawBackground() {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const tileW = 400, tileH = 300;
  const dots  = [[40,30],[120,80],[200,50],[310,110],[70,170],[260,200],[350,60],[150,240],[380,180],[90,250]];
  const sx = Math.floor(camera.x / tileW);
  const sy = Math.floor(camera.y / tileH);
  for (let tx = sx - 1; tx <= sx + Math.ceil(canvas.width  / tileW) + 1; tx++) {
    for (let ty = sy - 1; ty <= sy + Math.ceil(canvas.height / tileH) + 1; ty++) {
      for (const [dx, dy] of dots) ctx.fillRect(tx * tileW + dx, ty * tileH + dy, 2, 2);
    }
  }
}

function drawHUD() {
  const t = formatTime(performance.now() - levelStartMs);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(10, 10, 370, 28);
  ctx.fillStyle = '#00d9a3';
  ctx.fillText(`LVL ${currentLevel + 1}/${Level.count}   TIME ${t}   DEATHS ${respawns}`, 18, 29);

  if (player.invincible) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
    ctx.fillRect(canvas.width - 160, 10, 150, 28);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('★ INVINCIBLE ★', canvas.width - 150, 29);
  }
}

function drawMenuScreen(timestamp) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.fillStyle = '#5a5a7a';
  ctx.font = '18px monospace';
  ctx.fillText('welcome to', canvas.width / 2, canvas.height / 2 - 80);

  ctx.fillStyle = '#00d9a3';
  ctx.font = 'bold 78px monospace';
  ctx.fillText('BLAKUS', canvas.width / 2, canvas.height / 2 - 10);

  if (hasCrown) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '13px monospace';
    ctx.fillText('♛  crowned  ♛', canvas.width / 2, canvas.height / 2 + 20);
  }

  // Blinking prompt (toggles every 500ms)
  if (Math.floor(timestamp / 500) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText('press SPACE to start', canvas.width / 2, canvas.height / 2 + 50);
  }

  ctx.fillStyle = '#3a3a5a';
  ctx.font = '11px monospace';
  ctx.fillText('arrows / WASD to move  ·  space / up / W to jump',
               canvas.width / 2, canvas.height - 60);
  ctx.fillText('E at door to advance  ·  R to respawn',
               canvas.width / 2, canvas.height - 42);
  ctx.fillText('P to pause  ·  M for menu',
               canvas.width / 2, canvas.height - 24);

  ctx.restore();
}

function returnToMenu() {
  respawns   = 0;
  levelTimes = [];
  if (player) player.invincible = false;
  gameState  = 'menu';
}

function drawGameScene() {
  ctx.fillStyle = level.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  camera.apply(ctx);
  drawBackground();
  for (const p of level.platforms) p.draw(ctx);
  for (const s of level.spikes)    s.draw(ctx);
  level.door.draw(ctx, level.door.isNear(player));
  player.draw(ctx);
  ctx.restore();

  drawHUD();
}

function drawPauseOverlay(timestamp) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('Game Paused', canvas.width / 2, canvas.height / 2 - 10);

  if (Math.floor(timestamp / 500) % 2 === 0) {
    ctx.fillStyle = '#00d9a3';
    ctx.font = '14px monospace';
    ctx.fillText('press P or SPACE to resume', canvas.width / 2, canvas.height / 2 + 30);
  }

  ctx.fillStyle = '#5a5a7a';
  ctx.font = '11px monospace';
  ctx.fillText('M for menu', canvas.width / 2, canvas.height / 2 + 60);

  ctx.restore();
}

function drawWinScreen(timestamp) {
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00d9a3';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('YOU WIN!', canvas.width / 2, 70);

  ctx.fillStyle = '#7a7a9a';
  ctx.font = '13px monospace';
  ctx.fillText(`deaths: ${respawns}`, canvas.width / 2, 95);

  // Per-level breakdown
  const leftX  = canvas.width / 2 - 80;
  const rightX = canvas.width / 2 + 80;
  let total = 0;
  let y = 140;

  ctx.font = '15px monospace';
  for (let i = 0; i < levelTimes.length; i++) {
    total += levelTimes[i];
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`Level ${i + 1}`, leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b0b0d0';
    ctx.fillText(formatTime(levelTimes[i]), rightX, y);
    y += 24;
  }

  // Divider
  ctx.strokeStyle = '#3a3a5a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, y - 6);
  ctx.lineTo(rightX, y - 6);
  ctx.stroke();
  y += 14;

  // Total
  ctx.fillStyle = '#00d9a3';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Total', leftX, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(total), rightX, y);

  // Crown notification (first-time flawless clear)
  y += 40;
  ctx.textAlign = 'center';
  if (justEarnedCrown) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('♛  CROWN EARNED  ♛', canvas.width / 2, y);
  } else if (respawns === 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '13px monospace';
    ctx.fillText('flawless run!', canvas.width / 2, y);
  }

  // Restart prompt
  ctx.textAlign = 'center';
  if (Math.floor(timestamp / 500) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText('press SPACE to restart', canvas.width / 2, canvas.height - 40);
  }

  ctx.restore();
}

function gameLoop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (gameState === 'menu') {
    drawMenuScreen(timestamp);
    if (input.justPressed('Space')) startGame();
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (gameState === 'won') {
    drawWinScreen(timestamp);
    if (input.justPressed('Space')) returnToMenu();
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (gameState === 'paused') {
    // Keep the frozen scene visible, overlay the pause modal.
    drawGameScene();
    drawPauseOverlay(timestamp);

    if (input.justPressed('KeyM')) {
      returnToMenu();
    } else if (input.justPressed('KeyP') || input.justPressed('Space')) {
      // Shift level start time forward by however long we were paused
      // so the timer doesn't count the pause.
      levelStartMs += performance.now() - pauseStartMs;
      gameState = 'playing';
    }
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }

  // ── Update ────────────────────────────────────────────────────────────
  // Pause or menu hotkeys intercept before any physics runs this frame.
  if (input.justPressed('KeyP')) {
    pauseStartMs = performance.now();
    gameState = 'paused';
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }
  if (input.justPressed('KeyM')) {
    returnToMenu();
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }

  // Secret: Enter toggles invincible/fly mode
  if (input.justPressed('Enter')) {
    player.invincible = !player.invincible;
  }

  player.update(dt, input, level.platforms);

  // Boundary walls still apply in fly mode (player.update skips collision
  // when invincible, so clamp the horizontal position here).
  if (player.invincible) {
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > level.width) {
      player.x = level.width - player.width;
    }
  }

  // Manual respawn: R key counts as a death
  if (input.justPressed('KeyR')) {
    doRespawn();
  }

  // Fall off world
  if (player.y > level.height && !player.invincible) {
    doRespawn();
  }

  // Spike collision (harmless when invincible)
  if (!player.invincible) {
    for (const spike of level.spikes) {
      if (spike.collides(player)) {
        doRespawn();
        break;
      }
    }
  }

  // Door interaction
  if (level.door.isNear(player) && input.justPressed('KeyE')) {
    levelTimes.push(performance.now() - levelStartMs);
    levelStartMs = performance.now();
    if (currentLevel + 1 < Level.count) {
      loadLevel(currentLevel + 1);
    } else {
      // Flawless run — grant the crown (persist across sessions)
      if (respawns === 0 && !hasCrown) {
        hasCrown = true;
        justEarnedCrown = true;
        try { localStorage.setItem(CROWN_KEY, 'true'); } catch (e) {}
      }
      gameState = 'won';
    }
  }

  camera.update(player, dt);
  input.clearFrame();

  drawGameScene();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
