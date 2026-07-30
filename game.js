import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ==========================================
// GAME STATE & CALLBACKS
// ==========================================
export const state = {
  phase: 'start',
  level: 1,
  hp: 100,
  dummyHits: 0,
  tutorialComplete: false,
  flashlightOn: false
};

export const callbacks = {
  onDummyComplete: null,
  onEnemyDefeated: null,
  onPlayerDead: null,
  onTentacleSeen: null,
  onBossDefeated: null
};

// Engine & Scene References
let scene, camera, renderer;
let flashlight, lanternLight, ambientLight;
let clock = new THREE.Clock();
let keys = {};

// Game Groups
const groups = {
  ship: null,
  dungeon: null,
  boss: null,
  player: null
};

// Entities & Mechanics
const entities = {
  dummy: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  tentacle: null,
  kraken: null,
  ladder: null,
  livingWall: null,
  livingWallDebris: []
};

const colliders = [];

// Cutscene & Motion State
const cutsceneState = {
  sequence: [],
  index: 0,
  progress: 0,
  onComplete: null,
  camStartPos: new THREE.Vector3(),
  camStartLook: new THREE.Vector3(),
  currentLookTarget: new THREE.Vector3(),
  shakeDuration: 0,
  shakeIntensity: 0
};

// Living Wall Dynamic Burst State
let livingWallState = {
  triggered: false,
  progress: 0,
  rebuilding: false
};

// Camera Pitch Control
let pitch = 0;

// ==========================================
// INITIALIZATION & ENGINE SETUP
// ==========================================
export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();

  const fogColor = 0x030406; // Pitch black fog
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.FogExp2(fogColor, 0.055);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(fogColor, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  ambientLight = new THREE.AmbientLight(0x1a202c, 0.15); // Ultra low ambient light for horror
  scene.add(ambientLight);

  setupPlayerAndFlashlight();
  setupShipDeck();
  setupDungeonMaze();
  setupBossArena();

  setupInput();
  window.addEventListener('resize', onResize);
  animate();
}

// ==========================================
// PLAYER & ENVIRONMENT CREATION
// ==========================================
function setupPlayerAndFlashlight() {
  groups.player = new THREE.Group();
  groups.player.position.set(0, 1.6, 5);
  scene.add(groups.player);

  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  groups.player.add(camera);

  // Narrower, spooiker flashlight cone
  flashlight = new THREE.SpotLight(0xfff5e0, 0, 28, Math.PI / 6, 0.5, 1);
  flashlight.position.set(0, 0, 0);

  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -5);
  camera.add(flashTarget);
  flashlight.target = flashTarget;

  camera.add(flashlight);
}

function setupShipDeck() {
  groups.ship = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x24150c, roughness: 0.9 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.4 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x4a4033, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 20), woodDark);
  floor.position.y = -0.2;
  groups.ship.add(floor);

  for (let z = -9; z <= 9; z += 3) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribL.position.set(-6.5, 2, z);
    ribL.rotation.z = -0.15;
    groups.ship.add(ribL);

    const ribR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribR.position.set(6.5, 2, z);
    ribR.rotation.z = 0.15;
    groups.ship.add(ribR);
  }

  lanternLight = new THREE.PointLight(0xff7700, 2.0, 14, 2.0);
  lanternLight.position.set(0, 3.6, -2);
  groups.ship.add(lanternLight);

  // Dummy Target
  entities.dummy = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.2, 16), ironMat);
  base.position.y = 0.1;
  entities.dummy.add(base);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.4, 12), woodLight);
  post.position.y = 1.2;
  entities.dummy.add(post);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 1.2, 12), clothMat);
  torso.position.y = 1.5;
  entities.dummy.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), woodLight);
  head.position.y = 2.3;
  entities.dummy.add(head);

  entities.dummy.position.set(0, 0, -3);
  groups.ship.add(entities.dummy);

  scene.add(groups.ship);
}

function setupDungeonMaze() {
  groups.dungeon = new THREE.Group();
  colliders.length = 0;
  
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.98 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  groups.dungeon.add(floor);

  // Outer Perimeter Walls
  const mapSize = 60;
  const wallHeight = 5;
  const wallThickness = 2;

  const perimeterWalls = [
    { pos: [0, wallHeight / 2, -mapSize / 2], size: [mapSize, wallHeight, wallThickness] },
    { pos: [0, wallHeight / 2, mapSize / 2], size: [mapSize, wallHeight, wallThickness] },
    { pos: [-mapSize / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, mapSize] },
    { pos: [mapSize / 2, wallHeight / 2, 0], size: [wallThickness, wallHeight, mapSize] }
  ];

  perimeterWalls.forEach(p => {
    const pWall = new THREE.Mesh(new THREE.BoxGeometry(...p.size), wallMat);
    pWall.position.set(...p.pos);
    groups.dungeon.add(pWall);

    const box = new THREE.Box3().setFromObject(pWall);
    colliders.push(box);
  });

  // Interior Maze Walls
  for (let i = -24; i <= 24; i += 8) {
    for (let j = -24; j <= 24; j += 8) {
      if ((Math.abs(i) > 4 || Math.abs(j) > 4) && Math.random() > 0.35) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 6), wallMat);
        wall.position.set(i, 2.25, j);
        groups.dungeon.add(wall);

        const box = new THREE.Box3().setFromObject(wall);
        colliders.push(box);
      }
    }
  }

  // Living Wall
  entities.livingWall = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 1.2), wallMat);
  entities.livingWall.position.set(0, 2.25, -6);
  groups.dungeon.add(entities.livingWall);

  const livingBox = new THREE.Box3().setFromObject(entities.livingWall);
  colliders.push(livingBox);

  for (let b = 0; b < 12; b++) {
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), wallMat);
    brick.position.set((Math.random() - 0.5) * 5, 0.2, -6 + (Math.random() - 0.5) * 2);
    brick.visible = false;
    entities.livingWallDebris.push(brick);
    groups.dungeon.add(brick);
  }

  // Giant Tentacle
  entities.tentacle = new THREE.Group();
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x020a0d, roughness: 0.1 });

  for (let s = 0; s < 14; s++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6 - s * 0.035, 0.7 - s * 0.035, 1.0, 12),
      tentacleMat
    );
    seg.position.z = s * 0.9;
    seg.name = `gt_seg_${s}`;
    entities.tentacle.add(seg);
  }

  entities.tentacle.position.set(0, 1.6, -6.5);
  entities.tentacle.visible = false;
  groups.dungeon.add(entities.tentacle);

  setupExitLadder();
  groups.dungeon.visible = false;
  scene.add(groups.dungeon);
}

function setupExitLadder() {
  entities.ladder = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), metalMat);
  railL.position.set(-0.4, 2.5, 0);
  const railR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), metalMat);
  railR.position.set(0.4, 2.5, 0);
  entities.ladder.add(railL, railR);

  for (let r = 0; r < 8; r++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), metalMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.6 + r * 0.55, 0);
    entities.ladder.add(rung);
  }

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glowMat);
  beacon.position.set(0, 5.2, 0);
  entities.ladder.add(beacon);

  const ladderLight = new THREE.PointLight(0x00ff88, 1.5, 6);
  ladderLight.position.set(0, 4.5, 0);
  entities.ladder.add(ladderLight);

  entities.ladder.position.set(18, 0, -18);
  groups.dungeon.add(entities.ladder);
}

function setupBossArena() {
  groups.boss = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x02070a, roughness: 0.1 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), waterMat);
  water.rotation.x = -Math.PI / 2;
  groups.boss.add(water);

  entities.kraken = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x071518 }));
  head.position.y = 2;
  entities.kraken.add(head);

  const coreEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  coreEye.position.set(0, 3, -3.2);
  entities.kraken.add(coreEye);

  entities.kraken.position.set(0, 0, -22);
  groups.boss.add(entities.kraken);

  groups.boss.visible = false;
  scene.add(groups.boss);
}

// ==========================================
// SPAWNING SYSTEM FOR ENEMIES & PICKUPS
// ==========================================
export function spawnEnemiesForLevel(count = 3) {
  entities.enemies.forEach(e => groups.dungeon.remove(e.mesh));
  entities.projectiles.forEach(p => groups.dungeon.remove(p.mesh));
  entities.pickups.forEach(p => groups.dungeon.remove(p.mesh));

  entities.enemies = [];
  entities.projectiles = [];
  entities.pickups = [];

  const playerPos = groups.player.position;

  for (let i = 0; i < count; i++) {
    const isRanged = i % 2 === 1;
    const enemyMesh = isRanged ? createSpitterEnemy() : createLurkerEnemy();

    let spawnX, spawnZ, distToPlayer;
    do {
      spawnX = (Math.random() - 0.5) * 40;
      spawnZ = (Math.random() - 0.5) * 40;
      distToPlayer = Math.hypot(spawnX - playerPos.x, spawnZ - playerPos.z);
    } while (distToPlayer < 14.0); // Keep safe initial distance

    enemyMesh.position.set(spawnX, 0, spawnZ);

    groups.dungeon.add(enemyMesh);
    entities.enemies.push({
      mesh: enemyMesh,
      type: isRanged ? 'spitter' : 'lurker',
      hp: isRanged ? 40 : 60,
      aggro: false,
      speed: isRanged ? 1.8 : 2.8,
      attackCooldown: 1.5,
      stunTime: 0
    });
  }

  spawnMapPickups(3);
}

function createLurkerEnemy() {
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x010203, roughness: 0.1 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.4 });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Intense Glowing Eyes

  const enemyGroup = new THREE.Group();

  for (let s = 0; s < 5; s++) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.35 - s * 0.04, 0.5, 6), boneMat);
    v.position.set(0, 1.2 + s * 0.3, -s * 0.08);
    v.rotation.x = 0.25;
    enemyGroup.add(v);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.7, -0.3);

  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 7), shadowMat);
  skull.rotation.x = -Math.PI / 2.2;
  headGroup.add(skull);

  [-0.14, 0.14].forEach(xOff => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeGlowMat);
    eye.position.set(xOff, 0.05, -0.35);
    headGroup.add(eye);
  });
  enemyGroup.add(headGroup);

  return enemyGroup;
}

function createSpitterEnemy() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14020a, roughness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 2.2, 8), bodyMat);
  body.position.y = 1.1;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), glowMat);
  head.position.y = 2.3;
  group.add(head);

  return group;
}

function spawnMapPickups(amount = 3) {
  for (let p = 0; p < amount; p++) {
    const itemGroup = new THREE.Group();

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    bottle.position.y = 0.5;
    itemGroup.add(bottle);

    const light = new THREE.PointLight(0x00ff88, 1.2, 4);
    light.position.y = 0.5;
    itemGroup.add(light);

    itemGroup.position.set((Math.random() - 0.5) * 32, 0, (Math.random() - 0.5) * 32);
    groups.dungeon.add(itemGroup);

    entities.pickups.push({
      mesh: itemGroup,
      type: 'health'
    });
  }
}

// ==========================================
// COLLISIONS & INPUT HANDLING
// ==========================================
function checkCollisions(newPosition) {
  if (!groups.dungeon.visible) return false;

  const playerRadius = 0.4;
  const playerBox = new THREE.Box3(
    new THREE.Vector3(newPosition.x - playerRadius, 0, newPosition.z - playerRadius),
    new THREE.Vector3(newPosition.x + playerRadius, 3.0, newPosition.z + playerRadius)
  );

  for (let box of colliders) {
    if (playerBox.intersectsBox(box)) return true;
  }
  return false;
}

export function setupInput() {
  const canvas = document.getElementById('gl-canvas');

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;

    if (e.key.toLowerCase() === 'f') {
      state.flashlightOn = !state.flashlightOn;
      flashlight.intensity = state.flashlightOn ? 16 : 0;
      updateHUD();
    }

    if (e.key.toLowerCase() === 'e' && state.phase === 'arena' && entities.ladder) {
      const distToLadder = groups.player.position.distanceTo(entities.ladder.position);
      if (distToLadder < 2.8) {
        if (callbacks.onEnemyDefeated) callbacks.onEnemyDefeated();
      }
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  });

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas && state.phase !== 'cutscene') {
      groups.player.rotation.y -= e.movementX * 0.0025;
      
      pitch -= e.movementY * 0.0025;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
      camera.rotation.set(pitch, 0, 0);
    }
  });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'cutscene' && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
    handleAttack();
  });
}

function handleAttack() {
  if (state.phase === 'cutscene') return;

  if (state.phase === 'tutorial' && entities.dummy) {
    if (groups.player.position.distanceTo(entities.dummy.position) < 4) {
      state.dummyHits++;
      entities.dummy.rotation.z = 0.18;
      setTimeout(() => { if (entities.dummy) entities.dummy.rotation.z = 0; }, 120);

      if (state.dummyHits >= 5 && callbacks.onDummyComplete) {
        callbacks.onDummyComplete();
      }
    }
  } else if (state.phase === 'arena') {
    entities.enemies.forEach((enemy, index) => {
      if (groups.player.position.distanceTo(enemy.mesh.position) < 3.5) {
        enemy.hp -= 35;
        enemy.mesh.position.z -= 1.5;

        if (enemy.hp <= 0) {
          groups.dungeon.remove(enemy.mesh);
          entities.enemies.splice(index, 1);
        }
      }
    });
  } else if (state.phase === 'boss' && entities.kraken) {
    if (callbacks.onBossDefeated) callbacks.onBossDefeated();
  }
}

// ==========================================
// GAME LIFECYCLE & CINEMATICS
// ==========================================
export function startCinematicSequence(keyframes, onComplete) {
  state.phase = 'cutscene';
  cutsceneState.sequence = keyframes;
  cutsceneState.index = 0;
  cutsceneState.progress = 0;
  cutsceneState.onComplete = onComplete;

  cutsceneState.camStartPos.copy(camera.position);
  cutsceneState.camStartLook.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
}

export function triggerScreenShake(duration = 1.0, intensity = 0.2) {
  cutsceneState.shakeDuration = duration;
  cutsceneState.shakeIntensity = intensity;
}

export function setPhase(p) { state.phase = p; }
export function setShipVisibility(v) { groups.ship.visible = v; }
export function setDungeonVisibility(v) { groups.dungeon.visible = v; }
export function setBossArenaVisibility(v) { groups.boss.visible = v; }

export function spawnEnemy(lvl) {
  spawnEnemiesForLevel(Math.min(2 + Math.floor(lvl / 2), 10));
}

export function spawnKraken() {
  if (entities.kraken) entities.kraken.position.set(0, 0, -20);
}

export function triggerStorm(duration) {
  let count = 0;
  const interval = setInterval(() => {
    const stormHex = count % 2 === 0 ? 0x223344 : 0x030406;
    scene.fog.color.setHex(stormHex);
    scene.background.setHex(stormHex);
    renderer.setClearColor(stormHex, 1);
    count++;
    if (count > 16) {
      clearInterval(interval);
      scene.fog.color.setHex(0x030406);
      scene.background.setHex(0x030406);
      renderer.setClearColor(0x030406, 1);
    }
  }, duration / 16);
}

export function updateHUD() {
  const zd = document.getElementById('zone-display');
  const hb = document.getElementById('health-bar');
  const flStatus = document.getElementById('fl-status');

  if (zd) {
    zd.textContent = state.phase === 'tutorial' 
      ? '10,000,000 - SHIP DECK' 
      : `10,000,000 - LEVEL ${state.level} / 100`;
  }
  if (hb) hb.style.width = `${Math.max(0, state.hp)}%`;
  if (flStatus) flStatus.textContent = `${state.flashlightOn ? 'ON' : 'OFF'}`;
}

export function resetGame() {
  state.hp = 100;
  state.level = 1;
  state.dummyHits = 0;
  pitch = 0;
  groups.player.position.set(0, 1.6, 5);
  groups.player.rotation.set(0, 0, 0);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  updateHUD();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================
// ENGINE LOOP
// ==========================================
function animate() {
  const delta = clock.getDelta();
  let nearestEnemyDist = 999;

  // 1. HORROR AI & ENEMY BEHAVIOR
  if (state.phase === 'arena' && groups.dungeon.visible && state.hp > 0) {
    entities.enemies.forEach(enemy => {
      const dist = groups.player.position.distanceTo(enemy.mesh.position);
      if (dist < nearestEnemyDist) nearestEnemyDist = dist;

      if (dist < 12.0) enemy.aggro = true;

      if (enemy.aggro) {
        enemy.mesh.lookAt(groups.player.position.x, enemy.mesh.position.y, groups.player.position.z);

        if (enemy.type === 'lurker') {
          // Stun briefly if illuminated directly
          if (state.flashlightOn && dist < 8.0) {
            enemy.stunTime -= delta;
          } else {
            enemy.stunTime = 0;
          }

          if (enemy.stunTime <= 0) {
            if (dist > 1.2) {
              const dir = new THREE.Vector3().subVectors(groups.player.position, enemy.mesh.position).normalize();
              enemy.mesh.position.addScaledVector(dir, enemy.speed * delta);
            } else {
              state.hp -= 15 * delta;
              updateHUD();
              triggerScreenShake(0.15, 0.08); // Jumpscare rumble
            }
          }
        } else if (enemy.type === 'spitter') {
          if (dist < 6.0) {
            const retreatDir = new THREE.Vector3().subVectors(enemy.mesh.position, groups.player.position).normalize();
            enemy.mesh.position.addScaledVector(retreatDir, enemy.speed * delta);
          }

          enemy.attackCooldown -= delta;
          if (enemy.attackCooldown <= 0) {
            enemy.attackCooldown = 2.5;

            const projMesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff0044 })
            );
            projMesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, 1.8, 0));

            const dir = new THREE.Vector3().subVectors(groups.player.position, projMesh.position).normalize();
            groups.dungeon.add(projMesh);

            entities.projectiles.push({ mesh: projMesh, dir: dir, life: 4.0 });
          }
        }

        if (state.hp <= 0 && callbacks.onPlayerDead) {
          state.hp = 0;
          callbacks.onPlayerDead();
        }
      }
    });

    // Dynamic Horror Flashlight Flickering
    if (state.flashlightOn) {
      if (nearestEnemyDist < 6.0) {
        // High panic flickering when enemies are close
        flashlight.intensity = Math.random() > 0.25 ? 16 : 1.5;
      } else if (Math.random() < 0.02) {
        // Random eerie flicker
        flashlight.intensity = 2;
        setTimeout(() => { flashlight.intensity = 16; }, 80);
      } else {
        flashlight.intensity = 16;
      }
    }

    // Active Projectiles
    entities.projectiles.forEach((p, idx) => {
      p.mesh.position.addScaledVector(p.dir, 8.0 * delta);
      p.life -= delta;

      if (groups.player.position.distanceTo(p.mesh.position) < 1.0) {
        state.hp -= 12;
        updateHUD();
        triggerScreenShake(0.25, 0.12);
        groups.dungeon.remove(p.mesh);
        entities.projectiles.splice(idx, 1);
        if (state.hp <= 0 && callbacks.onPlayerDead) {
          state.hp = 0;
          callbacks.onPlayerDead();
        }
      } else if (p.life <= 0) {
        groups.dungeon.remove(p.mesh);
        entities.projectiles.splice(idx, 1);
      }
    });

    // Item Pickups
    entities.pickups.forEach((pickup, idx) => {
      pickup.mesh.rotation.y += delta * 2.0;

      if (groups.player.position.distanceTo(pickup.mesh.position) < 1.2) {
        state.hp = Math.min(100, state.hp + 25);
        updateHUD();
        groups.dungeon.remove(pickup.mesh);
        entities.pickups.splice(idx, 1);
      }
    });
  }

  // 2. Frontal Tentacle Living Wall Mechanics
  if (entities.livingWall && groups.dungeon.visible) {
    const distToLivingWall = groups.player.position.distanceTo(entities.livingWall.position);

    if (distToLivingWall < 6.5 && !livingWallState.triggered) {
      livingWallState.triggered = true;
      entities.tentacle.visible = true;
      triggerScreenShake(1.8, 0.35);
      if (callbacks.onTentacleSeen) callbacks.onTentacleSeen();
    }

    if (livingWallState.triggered) {
      livingWallState.progress += delta * 2.2;

      if (livingWallState.progress < 2.5) {
        entities.livingWall.position.y = THREE.MathUtils.lerp(2.25, -2.5, livingWallState.progress / 2.5);

        entities.livingWallDebris.forEach(b => {
          b.visible = true;
          b.position.y = THREE.MathUtils.lerp(0.2, 0.8, Math.sin(livingWallState.progress * 4));
        });

        for (let s = 0; s < 14; s++) {
          const seg = entities.tentacle.getObjectByName(`gt_seg_${s}`);
          if (seg) {
            seg.position.x = Math.sin(livingWallState.progress * 6 + s * 0.4) * 0.6;
            seg.position.y = Math.cos(livingWallState.progress * 5 + s * 0.3) * 0.3;
          }
        }
      } else if (livingWallState.progress >= 2.5 && livingWallState.progress < 5.0) {
        const retractT = (livingWallState.progress - 2.5) / 2.5;
        entities.tentacle.position.z = THREE.MathUtils.lerp(-6.5, -16.0, retractT);
      } else {
        livingWallState.rebuilding = true;
        const rebuildProgress = Math.min((livingWallState.progress - 5.0) / 2.0, 1.0);

        entities.livingWall.position.y = THREE.MathUtils.lerp(-2.5, 2.25, rebuildProgress);

        if (rebuildProgress >= 1.0) {
          entities.tentacle.visible = false;
          entities.livingWallDebris.forEach(b => b.visible = false);
        }
      }
    }
  }

  // 3. Cutscene Motion Updates
  if (state.phase === 'cutscene' && cutsceneState.sequence.length > 0) {
    const targetKeyframe = cutsceneState.sequence[cutsceneState.index];
    cutsceneState.progress += delta / targetKeyframe.duration;

    const t = Math.min(cutsceneState.progress, 1.0);
    const easeT = t * t * (3 - 2 * t);

    const targetPos = new THREE.Vector3(targetKeyframe.pos.x, targetKeyframe.pos.y, targetKeyframe.pos.z);
    camera.position.lerpVectors(cutsceneState.camStartPos, targetPos, easeT);

    const targetLook = new THREE.Vector3(targetKeyframe.look.x, targetKeyframe.look.y, targetKeyframe.look.z);
    cutsceneState.currentLookTarget.lerpVectors(cutsceneState.camStartLook, targetLook, easeT);
    camera.lookAt(cutsceneState.currentLookTarget);

    if (t >= 1.0) {
      cutsceneState.index++;
      if (cutsceneState.index < cutsceneState.sequence.length) {
        cutsceneState.progress = 0;
        cutsceneState.camStartPos.copy(camera.position);
        cutsceneState.camStartLook.copy(cutsceneState.currentLookTarget);
      } else {
        cutsceneState.sequence = [];
        if (cutsceneState.onComplete) cutsceneState.onComplete();
      }
    }
  }

  // 4. Camera Shake
  if (cutsceneState.shakeDuration > 0) {
    cutsceneState.shakeDuration -= delta;
    camera.position.x += (Math.random() - 0.5) * cutsceneState.shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * cutsceneState.shakeIntensity;
  }

  // 5. FPS Movement (WASD)
  if (['start', 'tutorial', 'arena', 'boss'].includes(state.phase)) {
    const moveSpeed = 5.2 * delta;
    const moveDir = new THREE.Vector3();

    if (keys['w'] || keys['KeyW']) moveDir.z -= 1;
    if (keys['s'] || keys['KeyS']) moveDir.z += 1;
    if (keys['a'] || keys['KeyA']) moveDir.x -= 1;
    if (keys['d'] || keys['KeyD']) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();

      const forwardVec = new THREE.Vector3(0, 0, moveDir.z).applyQuaternion(groups.player.quaternion);
      const sideVec = new THREE.Vector3(moveDir.x, 0, 0).applyQuaternion(groups.player.quaternion);

      const targetPosX = groups.player.position.clone().addScaledVector(sideVec, moveSpeed);
      if (!checkCollisions(targetPosX)) {
        groups.player.position.x = targetPosX.x;
      }

      const targetPosZ = groups.player.position.clone().addScaledVector(forwardVec, moveSpeed);
      if (!checkCollisions(targetPosZ)) {
        groups.player.position.z = targetPosZ.z;
      }
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
