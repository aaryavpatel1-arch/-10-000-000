export const state = {
  phase: 'tutorial',
  level: 1,
  hp: 100,
  maxHp: 100,
  dummyHits: 0,
  choresDone: 0,
  totalChoresNeeded: 5, // Expanded deck duties!
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
  moveSpeed: 3.5,
  rotSpeed: 2.8,
  swingAnim: 0
};

const keys = { w: false, s: false, a: false, d: false, left: false, right: false };

let mapWidth = 10;
let mapHeight = 10;
let worldMap = [];

let entities = [];
let ghostCaptain = { x: -1, y: -1, visible: false, timer: 0 };
let flashlightToggles = [];
let lastDamageTime = 0;
let promptText = "";

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
    // Ship Deck Layout (Wooden Planks, Cabin Walls)
    worldMap = [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ];
    mapWidth = 10;
    mapHeight = 7;
    player.x = 2.5;
    player.y = 3.5;
    
    // Detailed Pre-Storm Deck Environment with NPCs & Chores
    entities = [
      // NPCs
      { x: 7.5, y: 1.8, type: 'captain', name: 'Captain Vance' },
      { x: 2.5, y: 1.8, type: 'crew', name: 'Deckhand Barnaby' },

      // Training Dummy
      { x: 7.5, y: 3.5, type: 'dummy', hp: 5 },

      // Deck Duties / Chores
      { x: 4.5, y: 5.2, type: 'crate', name: 'Cargo Crate' },
      { x: 5.5, y: 5.2, type: 'crate', name: 'Cargo Crate' },
      { x: 3.5, y: 2.2, type: 'barrel', name: 'Loose Oil Barrel' },
      { x: 6.5, y: 5.2, type: 'mop', name: 'Deck Spill' },
      { x: 8.2, y: 5.0, type: 'rope', name: 'Tangled Rope' }
    ];
  } else {
    // Dungeon Maze Map (Scaling with level)
    mapWidth = Math.min(22, 10 + Math.floor(state.level * 1.2));
    mapHeight = Math.min(22, 10 + Math.floor(state.level * 1.2));
    if (mapWidth % 2 === 0) mapWidth++;
    if (mapHeight % 2 === 0) mapHeight++;

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
  worldMap[h - 3][w - 3] = 2; // Ladder Exit

  spawnEnemies();
}

function spawnEnemies() {
  entities = [];
  const enemyCount = Math.min(12, 1 + Math.floor(state.level * 0.9));
  const baseSpeed = 0.8 + Math.min(1.8, state.level * 0.15);
  const baseHp = 30 + (state.level * 10);

  for (let i = 0; i < enemyCount; i++) {
    let ex = Math.floor(Math.random() * (mapWidth - 4)) + 2;
    let ey = Math.floor(Math.random() * (mapHeight - 4)) + 2;
    
    if (worldMap[ey] && worldMap[ey][ex] === 0 && (ex !== 2 || ey !== 2)) {
      entities.push({
        x: ex + 0.5,
        y: ey + 0.5,
        type: 'stalker',
        hp: baseHp,
        speed: baseSpeed
      });
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
    player.swingAnim = 1.0;
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
  let interacted = false;

  if (state.phase === 'tutorial') {
    entities.forEach((ent, idx) => {
      if (['crate', 'barrel', 'mop', 'rope'].includes(ent.type)) {
        let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < 2.0 && !interacted) {
          interacted = true;
          entities.splice(idx, 1);
          state.choresDone++;
          showBanner(`Task completed: Cleaned ${ent.name}! (${state.choresDone}/${state.totalChoresNeeded})`, 2500);

          if (state.choresDone >= state.totalChoresNeeded && callbacks.onChoresComplete) {
            callbacks.onChoresComplete();
          }
        }
      } else if (ent.type === 'crew') {
        let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < 2.2) {
          showBanner("Barnaby: 'Storm clouds are brewing on the horizon, lad! Best hurry!'", 3500);
        }
      } else if (ent.type === 'captain') {
        let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < 2.2) {
          showBanner("Captain Vance: 'Keep at it, sailor! Secure the deck before the tempest strikes!'", 3500);
        }
      }
    });
  } else if (state.phase === 'arena') {
    let pGridX = Math.floor(player.x);
    let pGridY = Math.floor(player.y);
    if (worldMap[pGridY] && worldMap[pGridY][pGridX] === 2) {
      state.level++;
      state.hp = Math.min(state.maxHp, state.hp + 30);
      showBanner(`Ascended to Level ${state.level}! Enemies grow fiercer!`, 3000);
      player.x = 2.5;
      player.y = 2.5;
      loadMapForPhase();
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
        showBanner(`Hit the training dummy! (${state.dummyHits}/5)`, 1500);
        if (state.dummyHits >= 5 && callbacks.onDummyComplete) {
          callbacks.onDummyComplete();
        }
      } else if (ent.type === 'stalker') {
        ent.hp -= 35;
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

  if (player.swingAnim > 0) player.swingAnim = Math.max(0, player.swingAnim - dt * 4);

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
  const attackDamage = Math.min(30, 5 + state.level * 2);
  promptText = "";

  entities.forEach(ent => {
    let dist = Math.hypot(player.x - ent.x, player.y - ent.y);

    // Interactive Prompts
    if (dist < 2.2) {
      if (['crate', 'barrel', 'mop', 'rope'].includes(ent.type)) {
        promptText = `[E] Clean ${ent.name}`;
      } else if (ent.type === 'dummy') {
        promptText = `[LEFT CLICK] Attack Training Dummy`;
      } else if (ent.type === 'captain' || ent.type === 'crew') {
        promptText = `[E] Talk to ${ent.name}`;
      }
    }

    if (ent.type !== 'stalker') return;

    let dx = player.x - ent.x;
    let dy = player.y - ent.y;

    if (dist > 0.6) {
      ent.x += (dx / dist) * ent.speed * dt;
      ent.y += (dy / dist) * ent.speed * dt;
    } else if (now - lastDamageTime > 1200) {
      state.hp -= attackDamage;
      lastDamageTime = now;
      updateHUD();
      showBanner(`THE ENTITY SLASHED YOU! (-${attackDamage} HP)`, 1200);

      if (state.hp <= 0) {
        showBanner("YOU DIED...", 5000);
        setTimeout(() => location.reload(), 2500);
      }
    }
  });

  if (ghostCaptain.visible && now - ghostCaptain.timer > 2500) {
    ghostCaptain.visible = false;
  }
}

// RETRO RAYCASTING RENDER ENGINE
function renderDoomRaycaster() {
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Sky / Atmospheric Ceiling
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h / 2);
  skyGrad.addColorStop(0, '#020305');
  skyGrad.addColorStop(1, state.phase === 'tutorial' ? '#1c2838' : (state.flashlightOn ? '#1a2332' : '#080c14'));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h / 2);

  // Textured Floor / Deck Planks
  const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h);
  floorGrad.addColorStop(0, state.phase === 'tutorial' ? '#321f0e' : '#0d1117');
  floorGrad.addColorStop(1, state.phase === 'tutorial' ? '#6e451f' : '#1b2230');
  ctx.fillStyle = floorGrad;
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
    else { stepX = 1; stepX = 1; sideDistX = (mapX + 1.0 - player.x) * deltaDistX; }

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

    let light = Math.min(1, 1.8 / (perpWallDist * 0.8));
    if (!state.flashlightOn && state.phase !== 'tutorial') light *= 0.2;

    let isPlank = (Math.floor(wallX * 16) % 4 === 0) || (Math.floor((drawStart / h) * 32) % 4 === 0);

    if (hit === 1) {
      let r = state.phase === 'tutorial' ? 140 : (side === 1 ? 45 : 70);
      let g = state.phase === 'tutorial' ? 85 : (side === 1 ? 55 : 85);
      let b = state.phase === 'tutorial' ? 40 : (side === 1 ? 80 : 120);

      if (isPlank) { r *= 0.6; g *= 0.6; b *= 0.6; }

      ctx.fillStyle = `rgb(${Math.floor(r * light)}, ${Math.floor(g * light)}, ${Math.floor(b * light)})`;
    } else if (hit === 2) { // Ladder Exit
      ctx.fillStyle = `rgb(${Math.floor(220 * light)}, ${Math.floor(160 * light)}, ${Math.floor(40 * light)})`;
    }

    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }

  renderSprites(w, h, zBuffer);
  renderOverlay(w, h);
}

// PROCEDURAL SPRITE RENDERER FOR DETAILED OBJECTS & NPCS
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
        drawDetailedSprite(sprite.type, drawStartX, drawStartY, spriteWidth, spriteHeight, transformY);
      }
    }
  });
}

function drawDetailedSprite(type, x, y, width, height, depth) {
  const alpha = Math.min(1, 2.8 / depth);
  ctx.save();

  if (type === 'dummy') {
    // Training Dummy (Wooden Post with Target Rings & Padded Arms)
    ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
    ctx.fillRect(x + width * 0.4, y + height * 0.1, width * 0.2, height * 0.8); // Center pole
    ctx.fillRect(x + width * 0.15, y + height * 0.35, width * 0.7, height * 0.12); // Cross arms

    // Target Chest
    ctx.fillStyle = `rgba(220, 50, 50, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.4, width * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.4, width * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Head Straw Ball
    ctx.fillStyle = `rgba(210, 180, 120, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.18, width * 0.12, 0, Math.PI * 2);
    ctx.fill();

  } else if (type === 'crate') {
    // Cargo Wooden Crate with Metallic Corner Braces & Cross Beam
    ctx.fillStyle = `rgba(120, 75, 35, ${alpha})`;
    ctx.fillRect(x + width * 0.1, y + height * 0.3, width * 0.8, height * 0.6);

    ctx.strokeStyle = `rgba(60, 35, 15, ${alpha})`;
    ctx.lineWidth = Math.max(1, width * 0.04);
    ctx.strokeRect(x + width * 0.1, y + height * 0.3, width * 0.8, height * 0.6);

    // Cross Beams
    ctx.beginPath();
    ctx.moveTo(x + width * 0.1, y + height * 0.3);
    ctx.lineTo(x + width * 0.9, y + height * 0.9);
    ctx.moveTo(x + width * 0.9, y + height * 0.3);
    ctx.lineTo(x + width * 0.1, y + height * 0.9);
    ctx.stroke();

  } else if (type === 'barrel') {
    // Oil Barrel with Steel Rings
    ctx.fillStyle = `rgba(40, 45, 55, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, y + height * 0.6, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(180, 190, 200, ${alpha})`;
    ctx.fillRect(x + width * 0.22, y + height * 0.4, width * 0.56, height * 0.05);
    ctx.fillRect(x + width * 0.22, y + height * 0.75, width * 0.56, height * 0.05);

  } else if (type === 'mop') {
    // Sea Spill & Mop
    ctx.fillStyle = `rgba(60, 120, 180, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, y + height * 0.8, width * 0.35, height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(200, 160, 100, ${alpha})`;
    ctx.lineWidth = Math.max(2, width * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y + height * 0.2);
    ctx.lineTo(x + width * 0.5, y + height * 0.8);
    ctx.stroke();

  } else if (type === 'rope') {
    // Coiled Rope
    ctx.strokeStyle = `rgba(190, 150, 90, ${alpha})`;
    ctx.lineWidth = Math.max(2, width * 0.06);
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.75, width * 0.25, 0, Math.PI * 2);
    ctx.arc(x + width * 0.5, y + height * 0.75, width * 0.15, 0, Math.PI * 2);
    ctx.stroke();

  } else if (type === 'captain') {
    // Captain Vance NPC (Coat, Captain Hat, Beard)
    ctx.fillStyle = `rgba(15, 30, 60, ${alpha})`; // Blue Coat
    ctx.fillRect(x + width * 0.25, y + height * 0.3, width * 0.5, height * 0.6);

    ctx.fillStyle = `rgba(235, 190, 150, ${alpha})`; // Face
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.22, width * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`; // Beard
    ctx.fillRect(x + width * 0.4, y + height * 0.25, width * 0.2, height * 0.1);

    ctx.fillStyle = `rgba(10, 15, 30, ${alpha})`; // Captain Hat
    ctx.fillRect(x + width * 0.25, y + height * 0.08, width * 0.5, height * 0.08);
    ctx.fillRect(x + width * 0.2, y + height * 0.14, width * 0.6, height * 0.04);

  } else if (type === 'crew') {
    // Crewmate Barnaby NPC (Vest & Bandana)
    ctx.fillStyle = `rgba(160, 40, 40, ${alpha})`; // Red Vest
    ctx.fillRect(x + width * 0.28, y + height * 0.32, width * 0.44, height * 0.58);

    ctx.fillStyle = `rgba(235, 190, 150, ${alpha})`; // Face
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.24, width * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(20, 20, 20, ${alpha})`; // Bandana
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.18, width * 0.15, Math.PI, 0);
    ctx.fill();

  } else if (type === 'stalker') {
    // Horror Stalker Sprite (Demon Silhouette with Red Glowing Eyes)
    ctx.fillStyle = `rgba(15, 10, 20, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, y + height * 0.45, width * 0.25, height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Crimson Eyes
    ctx.fillStyle = `rgba(255, 30, 30, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x + width * 0.42, y + height * 0.25, width * 0.05, 0, Math.PI * 2);
    ctx.arc(x + width * 0.58, y + height * 0.25, width * 0.05, 0, Math.PI * 2);
    ctx.fill();

  } else if (type === 'ghost') {
    // Spectral Ghost Captain
    ctx.fillStyle = `rgba(34, 255, 204, ${alpha * 0.75})`;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, y + height * 0.45, width * 0.3, height * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `#ffffff`;
    ctx.beginPath();
    ctx.arc(x + width * 0.4, y + height * 0.28, width * 0.06, 0, Math.PI * 2);
    ctx.arc(x + width * 0.6, y + height * 0.28, width * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// OVERLAY, WEAPON HAND & PROMPTS
function renderOverlay(w, h) {
  // Flashlight Vignette
  if (state.flashlightOn) {
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
    vig.addColorStop(0, 'rgba(255, 255, 200, 0.08)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, h / 2);
  ctx.lineTo(w / 2 + 8, h / 2);
  ctx.moveTo(w / 2, h / 2 - 8);
  ctx.lineTo(w / 2, h / 2 + 8);
  ctx.stroke();

  // Draw Retro Doom Fist / Club Weapon at Bottom Screen
  const swingOffset = Math.sin(player.swingAnim * Math.PI) * 40;
  ctx.fillStyle = '#8b5a2b'; // Wooden Club
  ctx.fillRect(w / 2 + 20 - swingOffset, h - 160 + swingOffset, 45, 180);
  ctx.fillStyle = '#d2b48c'; // Hand Grip
  ctx.beginPath();
  ctx.arc(w / 2 + 42 - swingOffset, h - 20 + swingOffset, 30, 0, Math.PI * 2);
  ctx.fill();

  // Floating Context Interaction Prompt
  if (promptText) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(w / 2 - 140, h / 2 + 40, 280, 32);
    ctx.strokeStyle = '#00ffcc';
    ctx.strokeRect(w / 2 - 140, h / 2 + 40, 280, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(promptText, w / 2, h / 2 + 61);
  }
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
