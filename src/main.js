const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

canvas.width  = 800;
canvas.height = 500;
ctx.imageSmoothingEnabled = false; // pixel-art crispness

const VPORT_W = canvas.width / 2; // 400 — each player's viewport in 2P mode

const input = new Input();

let currentLevel  = 0;
let deaths        = [0, 0]; // per-player; deaths[1] unused in 1P mode
let gameState     = 'menu'; // 'menu' | 'playing' | 'paused' | 'won'
let twoPlayerMode = false;
let pauseStartMs  = 0;

let levelStartMs = 0;
let levelTimes   = [];

const CROWN_KEY = 'blakus_crown';
let hasCrown = false;
try { hasCrown = localStorage.getItem(CROWN_KEY) === 'true'; } catch (e) {}
let justEarnedCrown = false;
let cheated = false;

// 1P: full merged controls (arrows + WASD)
const P1_CONTROLS_1P = {
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up:    ['ArrowUp', 'KeyW', 'Space'],
  down:  ['ArrowDown', 'KeyS'],
};
// 2P: arrows only for P1, WASD + shift for P2
const P1_CONTROLS_2P = {
  left:  ['KeyA'],
  right: ['KeyD'],
  up:    ['KeyW', 'ShiftLeft'],
  down:  ['KeyS'],
};
const P2_CONTROLS = {
  left:  ['ArrowLeft'],
  right: ['ArrowRight'],
  up:    ['ArrowUp', 'Space'],
  down:  ['ArrowDown'],
};

function formatTime(ms) {
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
  return `${mins}:${secs}`;
}

let level, players, cameras;

function snapCameras() {
  const vw = twoPlayerMode ? VPORT_W : canvas.width;
  for (let i = 0; i < players.length; i++) {
    cameras[i].x = Math.max(0, Math.min(
      players[i].x + players[i].width  / 2 - vw / 2,
      level.width - vw
    ));
    cameras[i].y = Math.max(0, Math.min(
      players[i].y + players[i].height / 2 - canvas.height / 2,
      level.height - canvas.height
    ));
  }
}

function doRespawn(i) {
  deaths[i]++;
  players[i].respawn(level.spawnX, level.spawnY);
  const vw = twoPlayerMode ? VPORT_W : canvas.width;
  cameras[i].x = Math.max(0, Math.min(
    players[i].x + players[i].width  / 2 - vw / 2,
    level.width - vw
  ));
  cameras[i].y = Math.max(0, Math.min(
    players[i].y + players[i].height / 2 - canvas.height / 2,
    level.height - canvas.height
  ));
}

function loadLevel(n) {
  const wasInvincible = players ? players[0].invincible : false;
  currentLevel = n;
  level = new Level(n);

  if (twoPlayerMode) {
    players = [
      new Player(level.spawnX,      level.spawnY, P1_CONTROLS_2P),
      new Player(level.spawnX + 40, level.spawnY, P2_CONTROLS),
    ];
    cameras = [
      new Camera(VPORT_W,       canvas.height, level.width, level.height),
      new Camera(VPORT_W,       canvas.height, level.width, level.height),
    ];
    players[1].sprite   = PLAYER2_IMG;
    players[1].hasCrown = hasCrown;
  } else {
    players  = [new Player(level.spawnX, level.spawnY, P1_CONTROLS_1P)];
    cameras  = [new Camera(canvas.width, canvas.height, level.width, level.height)];
  }

  players[0].hasCrown   = hasCrown;
  players[0].invincible = wasInvincible;

  snapCameras();
}

function startGame() {
  deaths          = [0, 0];
  levelTimes      = [];
  justEarnedCrown = false;
  cheated         = false;
  levelStartMs    = performance.now();
  loadLevel(0);
  gameState = 'playing';
}

loadLevel(0); // initialize refs so state transitions are safe

let lastTime = null;

function drawBackground(cam) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const tileW = 400, tileH = 300;
  const dots  = [[40,30],[120,80],[200,50],[310,110],[70,170],[260,200],[350,60],[150,240],[380,180],[90,250]];
  const sx = Math.floor(cam.x / tileW);
  const sy = Math.floor(cam.y / tileH);
  for (let tx = sx - 1; tx <= sx + Math.ceil(cam.width / tileW) + 1; tx++) {
    for (let ty = sy - 1; ty <= sy + Math.ceil(cam.height / tileH) + 1; ty++) {
      for (const [dx, dy] of dots) ctx.fillRect(tx * tileW + dx, ty * tileH + dy, 2, 2);
    }
  }
}

function drawViewport(i, offsetX) {
  const cam = cameras[i];
  const vw  = twoPlayerMode ? VPORT_W : canvas.width;

  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, 0, vw, canvas.height);
  ctx.clip();

  ctx.fillStyle = level.bgColor;
  ctx.fillRect(offsetX, 0, vw, canvas.height);

  // Shift right by offsetX, then scroll by camera position
  ctx.translate(offsetX - Math.round(cam.x), -Math.round(cam.y));

  drawBackground(cam);
  for (const p of level.platforms) p.draw(ctx);
  for (const s of level.spikes)    s.draw(ctx);

  // In co-op, only show the E prompt when BOTH players are at the door
  const showPrompt = twoPlayerMode
    ? players.every(p => level.door.isNear(p))
    : level.door.isNear(players[0]);
  level.door.draw(ctx, showPrompt);

  for (const p of players) p.draw(ctx);

  ctx.restore();
}

function drawHUD() {
  const t = formatTime(performance.now() - levelStartMs);
  ctx.font = 'bold 13px monospace';

  if (twoPlayerMode) {
    // Left viewport — P1 info
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(5, 5, 240, 22);
    ctx.fillStyle = '#00d9a3';
    ctx.fillText(`LVL ${currentLevel + 1}/${Level.count}  ${t}  P1:${deaths[0]}`, 10, 21);

    // Right viewport — P2 info
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(VPORT_W + 5, 5, 80, 22);
    ctx.fillStyle = '#4499ff';
    ctx.fillText(`P2:${deaths[1]}`, VPORT_W + 10, 21);

    // Co-op door status — shown at bottom center when either player is waiting
    const p1At = level.door.isNear(players[0]);
    const p2At = level.door.isNear(players[1]);
    if (p1At || p2At) {
      const msg = (p1At && p2At)
        ? 'both at door — press E!'
        : p1At ? 'P1 at door · waiting for P2'
               : 'P2 at door · waiting for P1';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(canvas.width / 2 - 175, canvas.height - 26, 350, 20);
      ctx.fillStyle = (p1At && p2At) ? '#00ff88' : '#ffdd44';
      ctx.textAlign = 'center';
      ctx.fillText(msg, canvas.width / 2, canvas.height - 11);
      ctx.textAlign = 'left';
    }

  } else {
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 10, 370, 28);
    ctx.fillStyle = '#00d9a3';
    ctx.fillText(`LVL ${currentLevel + 1}/${Level.count}   TIME ${t}   DEATHS ${deaths[0]}`, 18, 29);

    if (players[0].invincible) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.fillRect(canvas.width - 160, 10, 150, 28);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('★ INVINCIBLE ★', canvas.width - 150, 29);
    }
  }
}

function drawGameScene() {
  if (twoPlayerMode) {
    drawViewport(0, 0);
    drawViewport(1, VPORT_W);
    // Center divider line
    ctx.fillStyle = '#000000';
    ctx.fillRect(VPORT_W - 1, 0, 2, canvas.height);
  } else {
    drawViewport(0, 0);
  }
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

  if (Math.floor(timestamp / 500) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px monospace';
    ctx.fillText('SPACE — 1 Player        ENTER — 2 Players', canvas.width / 2, canvas.height / 2 + 52);
  }

  ctx.fillStyle = '#3a3a5a';
  ctx.font = '11px monospace';
  ctx.fillText('1P: WASD to move · shift to jump    2P: arrows to move · space to jump',
               canvas.width / 2, canvas.height - 60);
  ctx.fillText('E at door to advance · 1P: Q to respawn · 2P: R to respawn',
               canvas.width / 2, canvas.height - 42);
  ctx.fillText('P to pause · M for menu',
               canvas.width / 2, canvas.height - 24);

  ctx.restore();
}

function returnToMenu() {
  deaths     = [0, 0];
  levelTimes = [];
  cheated    = false;
  if (players) players.forEach(p => p.invincible = false);
  gameState  = 'menu';
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

  const totalDeaths = deaths[0] + deaths[1];
  ctx.fillStyle = '#7a7a9a';
  ctx.font = '13px monospace';
  if (twoPlayerMode) {
    ctx.fillText(`P1 deaths: ${deaths[0]}  ·  P2 deaths: ${deaths[1]}  ·  total: ${totalDeaths}`,
                 canvas.width / 2, 95);
  } else {
    ctx.fillText(`deaths: ${deaths[0]}`, canvas.width / 2, 95);
  }

  if (cheated) {
    ctx.fillStyle = '#ff4455';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('TIME NOT VALID', canvas.width / 2, 150);
    ctx.fillStyle = '#7a4a4a';
    ctx.font = '13px monospace';
    ctx.fillText('cheats were used this run', canvas.width / 2, 178);
  } else {
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

    // Crown / flawless notification
    y += 40;
    ctx.textAlign = 'center';
    if (justEarnedCrown) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('♛  CROWN EARNED  ♛', canvas.width / 2, y);
    } else if (totalDeaths === 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '13px monospace';
      ctx.fillText('flawless run!', canvas.width / 2, y);
    }
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
    if (input.justPressed('Space')) { twoPlayerMode = false; startGame(); }
    if (input.justPressed('Enter')) { twoPlayerMode = true;  startGame(); }
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
    drawGameScene();
    drawPauseOverlay(timestamp);

    if (input.justPressed('KeyM')) {
      returnToMenu();
    } else if (input.justPressed('KeyP') || input.justPressed('Space')) {
      levelStartMs += performance.now() - pauseStartMs;
      gameState = 'playing';
    }
    input.clearFrame();
    requestAnimationFrame(gameLoop);
    return;
  }

  // ── Update ────────────────────────────────────────────────────────────
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

  // Secret cheats: Tab = P1 (WASD), Enter = P2 (arrows) in 2P / P1 in 1P
  if (input.justPressed('Tab')) {
    players[0].invincible = !players[0].invincible;
    if (players[0].invincible) cheated = true;
  }
  if (input.justPressed('Enter')) {
    const target = twoPlayerMode ? players[1] : players[0];
    target.invincible = !target.invincible;
    if (target.invincible) cheated = true;
  }

  // Secret: 1–5 jumps directly to that level
  for (let n = 1; n <= 5; n++) {
    if (input.justPressed(`Digit${n}`)) {
      cheated      = true;
      levelStartMs = performance.now();
      loadLevel(n - 1);
      break;
    }
  }

  // Advance moving platforms before player physics so vx/vy are current
  for (const p of level.platforms) { if (p.update) p.update(dt); }

  for (const p of players) p.update(dt, input, level.platforms);

  // Boundary clamp for invincible players (physics skips collision in fly mode)
  for (const p of players) {
    if (p.invincible) {
      if (p.x < 0) p.x = 0;
      if (p.x + p.width > level.width) p.x = level.width - p.width;
    }
  }

  // Manual respawns: P1 (WASD) = Q, P2/1P (arrows) = R
  if (input.justPressed('KeyR')) {
    if (twoPlayerMode) doRespawn(1); else doRespawn(0);
  }
  if (twoPlayerMode && input.justPressed('KeyQ')) doRespawn(0);

  // Fall-off and spike collisions — handled independently per player
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.y > level.height && !p.invincible) {
      doRespawn(i);
    } else if (!p.invincible) {
      for (const spike of level.spikes) {
        if (spike.collides(p)) { doRespawn(i); break; }
      }
    }
  }

  // Co-op door: both players must be near to advance
  const p1AtDoor = level.door.isNear(players[0]);
  const p2AtDoor = !twoPlayerMode || level.door.isNear(players[1]);
  if (p1AtDoor && p2AtDoor && input.justPressed('KeyE')) {
    levelTimes.push(performance.now() - levelStartMs);
    levelStartMs = performance.now();
    if (currentLevel + 1 < Level.count) {
      loadLevel(currentLevel + 1);
    } else {
      const totalDeaths = deaths[0] + deaths[1];
      if (totalDeaths === 0 && !hasCrown && !cheated) {
        hasCrown = true;
        justEarnedCrown = true;
        try { localStorage.setItem(CROWN_KEY, 'true'); } catch (e) {}
      }
      gameState = 'won';
    }
  }

  for (let i = 0; i < cameras.length; i++) {
    cameras[i].update(players[i], dt);
  }

  input.clearFrame();

  drawGameScene();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
