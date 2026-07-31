// DOOM-style Pseudo-3D Raycasting Engine
export const state = {
  phase: 'arena', // 'tutorial', 'arena', 'cutscene'
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

// Player state
const player = {
  x: 2.5,
  y: 2.5,
  dirX: -1,
  dirY: 0,
  planeX: 0,
  planeY: 0.66, // FOV
  moveSpeed: 3.0,
  rotSpeed: 2.0
};

// Input handling
const keys = { w: false, a: false, s: false, d: false, left: false, right: false };

// Maze Grid (1 = Wall, 0 = Empty Space, 2 = Exit Ladder)
let mapWidth = 16;
let mapHeight = 16;
let worldMap = [];

// Entities (Doom-style 2D Sprites in 3D Space)
let entities = [];
let ghostCaptain = { x: -1, y: -1, visible: false, timer: 0 };

// Flashlight spam detector
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

// Generate classic 2D maze grid
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
  worldMap[2][2] = 0; // Spawn point
  worldMap[h - 3][w - 3] = 2; // Ladder exit

  // Spawn Backrooms Stalkers
  spawnEnemies();
}

function spawnEnemies() {
  entities = [];
  for (let i = 0; i < Math.min(state.level + 1, 4); i++) {
    let ex = Math.floor(Math.random() * (mapWidth - 4)) + 2;
    let ey = Math.floor(Math.random() * (mapHeight - 4)) + 2;
    if (worldMap[ey][ex] === 0) {
      entities.push({ x: ex + 0.5, y: ey + 0.5, hp: 40, speed: 1.2 });
    }
  }
}

function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = true;
    if (k === 's') keys.s = true;
    if (k === 'a') keys.a = true;
    if (k === 'd') keys.d = true;
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
      // Check ladder interaction
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

  // Mouse look controls
  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      let rot = -e.movementX * 0.003;
      rotatePlayer(rot);
    }
  });

  canvas.addEventListener('click', () => {
    if (canvas.requestPointerLock) canvas.requestPointerLock();
    attackEnemy();
  });
}

function rotatePlayer(rot) {
  let oldDirX = player.dirX;
  player.dirX = player.dirX * Math.cos(rot) - player.dirY * Math.sin(rot);
  player.dirY = oldDirX * Math.sin(rot) + player.dirY * Math.cos(rot);

  let oldPlaneX = player.planeX;
  player.planeX = player.planeX * Math.cos(rot) - player.planeY * Math.sin(rot);
  player.planeY = oldPlaneX * Math.sin(rot) + player.planeY * Math.cos(rot);
}

function triggerGhostCaptain() {
  ghostCaptain.x = player.x + player.dirX * 1.5;
  ghostCaptain.y = player.y + player.dirY * 1.5;
  ghostCaptain.visible = true;
  ghostCaptain.timer = Date.now();
  showBanner("THE CAPTAIN'S SPIRIT IS WATCHING YOU...", 3000);
}

function attackEnemy() {
  entities.forEach((enemy, idx) => {
    let dx = enemy.x - player.x;
    let dy = enemy.y - player.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2.5) {
      enemy.hp -= 25;
      if (enemy.hp <= 0) {
        entities.splice(idx, 1);
      }
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

// MAIN ENGINE LOOP (RAYCASTING & RENDERING)
function gameLoop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  updatePlayer(dt);
  updateEntities(dt);

  renderRaycaster();

  requestAnimationFrame(gameLoop);
}

function updatePlayer(dt) {
  let moveStep = player.moveSpeed * dt;
  let rotStep = player.rotSpeed * dt;

  if (keys.left) rotatePlayer(rotStep);
  if (keys.right) rotatePlayer(-rotStep);

  let dx = 0, dy = 0;
  if (keys.w) { dx += player.dirX * moveStep; dy += player.dirY * moveStep; }
  if (keys.s) { dx -= player.dirX * moveStep; dy -= player.dirY * moveStep; }
  if (keys.a) { dx -= player.planeX * moveStep; dy -= player.planeY * moveStep; }
  if (keys.d) { dx += player.planeX * moveStep; dy += player.planeY * moveStep; }

  // Collision with 2D Grid
  let radius = 0.25;
  if (worldMap[Math.floor(player.y)][Math.floor(player.x + dx + Math.sign(dx) * radius)] !== 1) {
    player.x += dx;
  }
  if (worldMap[Math.floor(player.y + dy + Math.sign(dy) * radius)][Math.floor(player.x)] !== 1) {
    player.y += dy;
  }
}

function updateEntities(dt) {
  let now = Date.now();

  entities.forEach(enemy => {
    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.6) {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    } else {
      // Balanced damage (12 HP every 1.5 seconds)
      if (now - lastDamageTime > 1500) {
        state.hp -= 12;
        lastDamageTime = now;
        updateHUD();
        showBanner("THE ENTITY SLASHED YOU!", 1500);

        if (state.hp <= 0) {
          showBanner("YOU DIED...", 5000);
          setTimeout(() => location.reload(), 3000);
        }
      }
    }
  });

  if (ghostCaptain.visible && now - ghostCaptain.timer > 2500) {
    ghostCaptain.visible = false;
  }
}

// 2D TO pseudo-3D PROJECTION ENGINE (DOOM STYLE)
function renderRaycaster() {
  const w = canvas.width;
  const h = canvas.height;

  // Background (Ceiling & Floor)
  ctx.fillStyle = state.flashlightOn ? '#0d1117' : '#030406';
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = '#080a0f';
  ctx.fillRect(0, h / 2, w, h / 2);

  let zBuffer = new Array(w);

  // RAYCASTING WALLS
  for (let x = 0; x < w; x++) {
    let cameraX = 2 * x / w - 1;
    let rayDirX = player.dirX + player.planeX * cameraX;
    let rayDirY = player.dirY + player.planeY * cameraX;

    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);

    let deltaDistX = Math.abs(1 / rayDirX);
    let deltaDistY = Math.abs(1 / rayDirY);

    let stepX, stepY;
    let sideDistX, sideDistY;

    if (rayDirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1.0 - player.x) * deltaDistX; }

    if (rayDirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1.0 - player.y) * deltaDistY; }

    let hit = 0, side = 0;
    while (hit === 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (worldMap[mapY][mapX] > 0) hit = worldMap[mapY][mapX];
    }

    let perpWallDist = side === 0 ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
    zBuffer[x] = perpWallDist;

    let lineHeight = Math.floor(h / perpWallDist);
    let drawStart = -lineHeight / 2 + h / 2;
    let drawEnd = lineHeight / 2 + h / 2;

    // Lighting falloff
    let darkness = Math.min(1, 1 / (perpWallDist * 0.4));
    if (!state.flashlightOn) darkness *= 0.2;

    if (hit === 1) { // Wall
      ctx.fillStyle = side === 1 
        ? `rgba(20, 25, 35, ${darkness})` 
        : `rgba(35, 45, 60, ${darkness})`;
    } else if (hit === 2) { // Ladder Exit
      ctx.fillStyle = `rgba(180, 120, 40, ${darkness})`;
    }

    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  // DRAW BILLBOARD SPRITES (STALKER & GHOST CAPTAIN)
  renderSprites(w, h, zBuffer);
}

function renderSprites(w, h, zBuffer) {
  let spriteList = [...entities];
  if (ghostCaptain.visible) spriteList.push({ ...ghostCaptain, isGhost: true });

  // Sort back to front
  spriteList.sort((a, b) => {
    let distA = (player.x - a.x) ** 2 + (player.y - a.y) ** 2;
    let distB = (player.x - b.x) ** 2 + (player.y - b.y) ** 2;
    return distB - distA;
  });

  spriteList.forEach(sprite => {
    let spriteX = sprite.x - player.x;
    let spriteY = sprite.y - player.y;

    let invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
    let transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY);
    let transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY);

    if (transformY > 0) {
      let spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));
      let spriteHeight = Math.abs(Math.floor(h / transformY));
      let spriteWidth = Math.abs(Math.floor(h / transformY));

      let drawStartY = -spriteHeight / 2 + h / 2;
      let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);

      if (spriteScreenX > 0 && spriteScreenX < w && transformY < zBuffer[spriteScreenX]) {
        // Draw Backrooms Entity / Ghost Captain Billboard Sprite
        ctx.fillStyle = sprite.isGhost ? '#22ffcc' : '#ff1111';
        ctx.fillRect(drawStartX, drawStartY, spriteWidth * 0.4, spriteHeight * 0.8);

        // Glowing eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(drawStartX + spriteWidth * 0.1, drawStartY + spriteHeight * 0.2, 4, 4);
      }
    }
  });
}

// Unused Three.js stubs to maintain compatibility
export function setPhase(p) { state.phase = p; }
export function setShipVisibility() {}
export function setDungeonVisibility() {}
export function spawnEnemiesForLevel() {}
export function enableHorrorAtmosphere() {}
export function startCinematicSequence() {}
export function triggerStorm() {}
export function setCaptainSpeech() {}
