export const state = {
  phase: 'tutorial',
  level: 1,
  hp: 100,
  dummyHits: 0,
  choresDone: 0,
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

const player = {
  x: 2.5,
  y: 2.5,
  dirX: -1,
  dirY: 0,
  planeX: 0,
  planeY: 0.66,
  moveSpeed: 3.2,
  rotSpeed: 2.5
};

const keys = { w: false, s: false, a: false, d: false, left: false, right: false };

let mapWidth = 16;
let mapHeight = 16;
let worldMap = [];

let entities = [];
let ghostCaptain = { x: -1, y: -1, visible: false, timer: 0 };
let flashlightToggles = [];
let lastDamageTime = 0;

export function initEngine() {
  canvas = document.getElementById('gl-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  loadMapForPhase();
  setupInput();
  
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

function loadMapForPhase() {
  if (state.phase === 'tutorial') {
    worldMap = [
      [1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1]
    ];
    mapWidth = 8;
    mapHeight = 6;
    player.x = 2.5;
    player.y = 2.5;
    
    entities = [
      { x: 5.5, y: 2.5, type: 'dummy', hp: 5 },
      { x: 3.5, y: 4.5, type: 'crate' },
      { x: 4.5, y: 4.5, type: 'crate' },
      { x: 5.5, y: 4.5, type: 'crate' }
    ];
  } else {
    mapWidth = 16;
    mapHeight = 16;
    generateMaze(mapWidth, mapHeight);
  }
}

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
  worldMap[h - 3][w - 3] = 2;

  spawnEnemies();
}

function spawnEnemies() {
  entities = [];
  for (let i = 0; i < Math.min(state.level + 1, 4); i++) {
    let ex = Math.floor(Math.random() * (mapWidth - 4)) + 2;
    let ey = Math.floor(Math.random() * (mapHeight - 4)) + 2;
    if (worldMap[ey][ex] === 0) {
      entities.push({ x: ex + 0.5, y: ey + 0.5, type: 'stalker', hp: 40, speed: 1.2 });
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
      handleInteract();
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

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      rotatePlayer(-e.movementX * 0.003);
    }
  });

  canvas.addEventListener('click', () => {
    if (canvas.requestPointerLock) canvas.requestPointerLock();
    handleAttack();
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

function handleInteract() {
  if (state.phase === 'tutorial') {
    entities.forEach((ent, idx) => {
      if (ent.type === 'crate') {
        let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < 2.0) {
          entities.splice(idx, 1);
          state.choresDone++;
          if (state.choresDone >= 3 && callbacks.onChoresComplete) {
            callbacks.onChoresComplete();
          }
        }
      }
    });
  } else if (state.phase === 'arena') {
    let pGridX = Math.floor(player.x);
    let pGridY = Math.floor(player.y);
    if (worldMap[pGridY] && worldMap[pGridY][pGridX] === 2) {
      state.level++;
      showBanner(`Advanced to Level ${state.level}!`, 3000);
      player.x = 2.5;
      player.y = 2.5;
      generateMaze(mapWidth, mapHeight);
      updateHUD();
    }
  }
}

function handleAttack() {
  entities.forEach((ent, idx) => {
    let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
    if (dist < 2.5) {
      if (ent.type === 'dummy') {
        state.dummyHits++;
        if (state.dummyHits >= 5 && callbacks.onDummyComplete) {
          callbacks.onDummyComplete();
        }
      } else if (ent.type === 'stalker') {
        ent.hp -= 25;
        if (ent.hp <= 0) entities.splice(idx, 1);
      }
    }
  });
}

export function updateHUD() {
  const zd = document.getElementById('zone-display');
  const hb = document.getElementById('health-bar');
  const flStatus = document.getElementById('fl-status');

  if (zd) zd.textContent = state.phase === 'tutorial' ? 'SHIP DECK' : `LEVEL ${state.level} / 100`;
  if (hb) hb.style.width = `${Math.max(0, state.hp)}%`;
  if (flStatus) flStatus.textContent = `${state.flashlightOn ? 'ON' : 'OFF'}`;
}

export function showBanner(msg, duration = 3000) {
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

  renderDoomRaycaster();

  requestAnimationFrame(gameLoop);
}

function updatePlayer(dt) {
  let moveStep = player.moveSpeed * dt;
  let rotStep = player.rotSpeed * dt;

  if (keys.a || keys.left) rotatePlayer(rotStep);
  if (keys.d || keys.right) rotatePlayer(-rotStep);

  let dx = 0, dy = 0;
  if (keys.w) { dx += player.dirX * moveStep; dy += player.dirY * moveStep; }
  if (keys.s) { dx -= player.dirX * moveStep; dy -= player.dirY * moveStep; }

  let radius = 0.25;
  if (worldMap[Math.floor(player.y)] && worldMap[Math.floor(player.y)][Math.floor(player.x + dx + Math.sign(dx) * radius)] !== 1) {
    player.x += dx;
  }
  if (worldMap[Math.floor(player.y + dy + Math.sign(dy) * radius)] && worldMap[Math.floor(player.y + dy + Math.sign(dy) * radius)][Math.floor(player.x)] !== 1) {
    player.y += dy;
  }
}

function updateEntities(dt) {
  let now = Date.now();

  entities.forEach(enemy => {
    if (enemy.type !== 'stalker') return;

    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let dist = Math.hypot(dx, dy);

    if (dist > 0.6) {
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

function renderDoomRaycaster() {
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = state.flashlightOn ? '#1a222d' : '#05070a';
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = state.phase === 'tutorial' ? '#4a2c11' : '#11141a';
  ctx.fillRect(0, h / 2, w, h / 2);

  let zBuffer = new Array(w);

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
      if (worldMap[mapY] && worldMap[mapY][mapX] > 0) hit = worldMap[mapY][mapX];
    }

    let perpWallDist = side === 0 ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
    zBuffer[x] = perpWallDist;

    let lineHeight = Math.floor(h / perpWallDist);
    let drawStart = Math.max(0, -lineHeight / 2 + h / 2);
    let drawEnd = Math.min(h, lineHeight / 2 + h / 2);

    let wallX = side === 0 ? player.y + perpWallDist * rayDirY : player.x + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);

    let light = Math.min(1, 1.2 / perpWallDist);
    if (!state.flashlightOn && state.phase !== 'tutorial') light *= 0.25;

    let isMortar = (Math.floor(wallX * 16) % 4 === 0) || (Math.floor((drawStart / h) * 32) % 4 === 0);

    if (hit === 1) {
      let r = state.phase === 'tutorial' ? 120 : (side === 1 ? 40 : 60);
      let g = state.phase === 'tutorial' ? 70 : (side === 1 ? 50 : 75);
      let b = state.phase === 'tutorial' ? 30 : (side === 1 ? 70 : 100);

      if (isMortar) { r *= 0.5; g *= 0.5; b *= 0.5; }

      ctx.fillStyle = `rgb(${r * light}, ${g * light}, ${b * light})`;
    } else if (hit === 2) {
      ctx.fillStyle = `rgb(${200 * light}, ${140 * light}, ${40 * light})`;
    }

    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  renderSprites(w, h, zBuffer);
}

function renderSprites(w, h, zBuffer) {
  let spriteList = [...entities];
  if (ghostCaptain.visible) spriteList.push({ ...ghostCaptain, type: 'ghost' });

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

      let drawStartY = Math.max(0, -spriteHeight / 2 + h / 2);
      let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);

      if (spriteScreenX > 0 && spriteScreenX < w && transformY < zBuffer[spriteScreenX]) {
        if (sprite.type === 'dummy') ctx.fillStyle = '#b5835a';
        else if (sprite.type === 'crate') ctx.fillStyle = '#8b5a2b';
        else if (sprite.type === 'ghost') ctx.fillStyle = 'rgba(34, 255, 204, 0.8)';
        else ctx.fillStyle = 'rgb(180, 20, 20)';

        ctx.fillRect(drawStartX, drawStartY, spriteWidth * 0.4, spriteHeight * 0.8);

        if (sprite.type === 'stalker' || sprite.type === 'ghost') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(drawStartX + spriteWidth * 0.1, drawStartY + spriteHeight * 0.2, 5, 5);
          ctx.fillRect(drawStartX + spriteWidth * 0.25, drawStartY + spriteHeight * 0.2, 5, 5);
        }
      }
    }
  });
}

export function setCaptainSpeech(text) {
  const bubble = document.getElementById('captain-bubble');
  if (bubble) {
    if (text) {
      bubble.textContent = text;
      bubble.style.display = 'block';
    } else {
      bubble.style.display = 'none';
    }
  }
}

export function triggerStorm(duration) {
  let count = 0;
  const interval = setInterval(() => {
    count++;
    if (count > 8) {
      clearInterval(interval);
      if (callbacks.onShipCrash) callbacks.onShipCrash();
    }
  }, duration / 8);
}

export function setPhase(p) {
  state.phase = p;
  loadMapForPhase();
  updateHUD();
}

export function spawnEnemiesForLevel(lvl) {
  state.level = lvl;
  loadMapForPhase();
}

export function setShipVisibility() {}
export function setDungeonVisibility() {}
export function enableHorrorAtmosphere() {}
export function startCinematicSequence(seq, cb) { if (cb) cb(); }
