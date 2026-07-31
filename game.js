// Pure 2D Top-Down / Classic Arcade Doom Engine
export const state = {
  phase: 'arena',
  level: 1,
  hp: 100,
  flashlightOn: false
};

export const callbacks = {
  onDummyComplete: null,
  onChoresComplete: null,
  onShipCrash: null,
  onEnemyDefeated: null,
  onPlayerDead: null
};

let canvas, ctx;
let lastTime = performance.now();

// Player
const player = {
  x: 2.5,
  y: 2.5,
  angle: 0, // In radians
  speed: 3.5,
  rotSpeed: 3.0,
  radius: 0.3
};

// Input handling
const keys = { w: false, s: false, a: false, d: false, left: false, right: false };

// Maze Grid (1 = Wall, 0 = Path, 2 = Ladder Exit)
let mapWidth = 15;
let mapHeight = 15;
let worldMap = [];

// Entities & Easter Eggs
let entities = [];
let ghostCaptain = { x: -1, y: -1, visible: false, timer: 0 };
let flashlightToggles = [];
let lastDamageTime = 0;

export function initEngine() {
  canvas = document.getElementById('gl-canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  generateMaze(mapWidth, mapHeight);
  setupInput();

  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Generate Maze
function generateMaze(w, h) {
  worldMap = Array.from({ length: h }, () => Array(w).fill(1));

  function carve(x, y) {
    worldMap[y][x] = 0;
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);

    for (let [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && worldMap[ny][nx] === 1) {
        worldMap[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(2, 2);
  worldMap[2][2] = 0;
  worldMap[h - 3][w - 3] = 2; // Exit Ladder

  spawnEnemies();
}

function spawnEnemies() {
  entities = [];
  for (let i = 0; i < Math.min(state.level + 1, 4); i++) {
    let ex = Math.floor(Math.random() * (mapWidth - 4)) + 2;
    let ey = Math.floor(Math.random() * (mapHeight - 4)) + 2;
    if (worldMap[ey][ex] === 0) {
      entities.push({ x: ex + 0.5, y: ey + 0.5, hp: 40, speed: 1.5 });
    }
  }
}

function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = true;
    if (k === 's') keys.s = true;
    if (k === 'a') keys.a = true; // Turn Left
    if (k === 'd') keys.d = true; // Turn Right
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;

    if (k === 'f') {
      state.flashlightOn = !state.flashlightOn;
      updateHUD();

      const now = Date.now();
      flashlightToggles.push(now);
      flashlightToggles = flashlightToggles.filter(t => now - t < 2500);

      if (flashlightToggles.length >= 5) {
        triggerGhostCaptain();
        flashlightToggles = [];
      }
    }

    if (k === 'e') {
      let pGridX = Math.floor(player.x);
      let pGridY = Math.floor(player.y);
      if (worldMap[pGridY][pGridX] === 2) {
        state.level++;
        showBanner(`Advanced to Level ${state.level}!`, 3000);
        player.x = 2.5;
        player.y = 2.5;
        generateMaze(mapWidth, mapHeight);
        updateHUD();
      }
    }
  });

  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = false;
    if (k === 's') keys.s = false;
    if (k === 'a') keys.a = false;
    if (k === 'd') keys.d = false;
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });

  canvas.addEventListener('click', () => attackEnemy());
}

function triggerGhostCaptain() {
  ghostCaptain.x = player.x + Math.cos(player.angle) * 1.5;
  ghostCaptain.y = player.y + Math.sin(player.angle) * 1.5;
  ghostCaptain.visible = true;
  ghostCaptain.timer = Date.now();
  showBanner("THE CAPTAIN'S SPIRIT IS WATCHING YOU...", 3000);
}

function attackEnemy() {
  entities.forEach((enemy, idx) => {
    let dx = enemy.x - player.x;
    let dy = enemy.y - player.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2.0) {
      enemy.hp -= 25;
      if (enemy.hp <= 0) entities.splice(idx, 1);
    }
  });
}

function updateHUD() {
  const zd = document.getElementById('zone-display');
  const hb = document.getElementById('health-bar');
  const flStatus = document.getElementById('fl-status');

  if (zd) zd.textContent = `LEVEL ${state.level} / 100`;
  if (hb) hb.style.width = `${Math.max(0, state.hp)}%`;
  if (flStatus) flStatus.textContent = `${state.flashlightOn ? 'ON' : 'OFF'}`;
}

function showBanner(msg, duration = 3000) {
  const banner = document.getElementById('banner-message');
  if (banner) {
    banner.textContent = msg;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, duration);
  }
}

function gameLoop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  updatePlayer(dt);
  updateEntities(dt);

  render2DGame();

  requestAnimationFrame(gameLoop);
}

function updatePlayer(dt) {
  // Turning
  if (keys.a || keys.left) player.angle -= player.rotSpeed * dt;
  if (keys.d || keys.right) player.angle += player.rotSpeed * dt;

  // Forward / Backward Movement
  let moveStep = 0;
  if (keys.w) moveStep = player.speed * dt;
  if (keys.s) moveStep = -player.speed * dt;

  let newX = player.x + Math.cos(player.angle) * moveStep;
  let newY = player.y + Math.sin(player.angle) * moveStep;

  // Smooth Grid Collision
  if (worldMap[Math.floor(player.y)][Math.floor(newX + Math.sign(Math.cos(player.angle)) * player.radius)] !== 1) {
    player.x = newX;
  }
  if (worldMap[Math.floor(newY + Math.sign(Math.sin(player.angle)) * player.radius)][Math.floor(player.x)] !== 1) {
    player.y = newY;
  }
}

function updateEntities(dt) {
  let now = Date.now();

  entities.forEach(enemy => {
    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    } else if (now - lastDamageTime > 1500) {
      state.hp -= 12;
      lastDamageTime = now;
      updateHUD();
      showBanner("THE ENTITY SLASHED YOU!", 1500);

      if (state.hp <= 0) {
        showBanner("YOU DIED...", 5000);
        setTimeout(() => location.reload(), 3000);
      }
    }
  });

  if (ghostCaptain.visible && now - ghostCaptain.timer > 2500) {
    ghostCaptain.visible = false;
  }
}

// 2D TOP-DOWN DOOM-STYLE RENDERER
function render2DGame() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, w, h);

  const cellSize = Math.min(w / mapWidth, h / mapHeight) * 0.9;
  const offsetX = (w - mapWidth * cellSize) / 2;
  const offsetY = (h - mapHeight * cellSize) / 2;

  // Draw 2D Maze
  for (let r = 0; r < mapHeight; r++) {
    for (let c = 0; c < mapWidth; c++) {
      let x = offsetX + c * cellSize;
      let y = offsetY + r * cellSize;

      if (worldMap[r][c] === 1) { // Wall
        ctx.fillStyle = '#1c2331';
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = '#0d1117';
        ctx.strokeRect(x, y, cellSize, cellSize);
      } else if (worldMap[r][c] === 2) { // Ladder Exit
        ctx.fillStyle = '#d97706';
        ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
      }
    }
  }

  // Draw Flashlight Cone
  if (state.flashlightOn) {
    let px = offsetX + player.x * cellSize;
    let py = offsetY + player.y * cellSize;

    ctx.fillStyle = 'rgba(255, 255, 200, 0.25)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, cellSize * 3.5, player.angle - 0.4, player.angle + 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // Draw Enemies (Red Doom Stalkers)
  entities.forEach(enemy => {
    let ex = offsetX + enemy.x * cellSize;
    let ey = offsetY + enemy.y * cellSize;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(ex, ey, cellSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Ghost Captain
  if (ghostCaptain.visible) {
    let gx = offsetX + ghostCaptain.x * cellSize;
    let gy = offsetY + ghostCaptain.y * cellSize;

    ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
    ctx.beginPath();
    ctx.arc(gx, gy, cellSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Player (Green Arrow / Circle)
  let px = offsetX + player.x * cellSize;
  let py = offsetY + player.y * cellSize;

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(px, py, cellSize * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Facing directional indicator line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(player.angle) * cellSize * 0.6, py + Math.sin(player.angle) * cellSize * 0.6);
  ctx.stroke();
}

// Unused compatibility stubs
export function setPhase(p) { state.phase = p; }
export function setShipVisibility() {}
export function setDungeonVisibility() {}
export function spawnEnemiesForLevel() {}
export function enableHorrorAtmosphere() {}
export function startCinematicSequence() {}
export function triggerStorm() {}
export function setCaptainSpeech() {}
