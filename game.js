import * as THREE from 'three';

// ===== CONFIG =====
const ARENA_SIZE = 24;
const PLAYER_SPEED = 8.0;
const MOUSE_SENSITIVITY = 0.002;

// ===== STATE =====
export const state = {
  phase: 'menu',
  hp: 100,
  maxHp: 100,
  level: 0,
  dummyHits: 0,
  tutorialComplete: false,
  flashlightOn: true,
  locked: false,
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  activeEnemy: null,
  bossActive: false,
  krakenHead: null,
  tentacles: [],
  projectiles: [],
  shadowTentacle: null,
  shipGroup: null,
  dungeonGroup: null,
  bossArenaGroup: null,
  dummy: null,
  time: 0,
  shake: 0,
  coreExposed: false,
  mouseX: 0,
  mouseY: 0
};

// ===== CALLBACKS (populated by cutscenes.js) =====
export const callbacks = {
  onDummyComplete: null,
  onEnemyDefeated: null,
  onPlayerDead: null,
  onTentacleSeen: null,
  onAllTentaclesDead: null,
  onBossDefeated: null
};

// ===== ENGINE GLOBALS =====
let renderer, scene, camera, clock;
let flashlight, ambientLight;
let raycaster;
let cameraEuler;

// ===== INIT =====
export function initEngine() {
  const canvas = document.getElementById('gl-canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1118);
  scene.fog = new THREE.FogExp2(0x0e1118, 0.02);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 0);
  cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  // Lights
  ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);

  // Flashlight
  flashlight = new THREE.SpotLight(0xffffff, 3, 40, Math.PI / 5, 0.5, 1);
  flashlight.castShadow = true;
  scene.add(flashlight);
  scene.add(flashlight.target);

  // Environment builders
  buildShipDeck();
  buildDungeonArena();
  buildBossArena();

  // Events
  window.addEventListener('resize', onWindowResize);

  // Loop
  renderer.setAnimationLoop(animate);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== ENVIRONMENT BUILDERS =====
function buildShipDeck() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.2, 14),
    new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 })
  );
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a1b0e, roughness: 0.9 });
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 14), wallMat); w1.position.set(-4, 2, 0);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 14), wallMat); w2.position.set(4, 2, 0);
  const w3 = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.2), wallMat); w3.position.set(0, 2, -7);
  const w4 = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.2), wallMat); w4.position.set(0, 2, 7);
  [w1, w2, w3, w4].forEach(w => { w.castShadow = true; group.add(w); });

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 14), wallMat);
  ceil.position.y = 4;
  group.add(ceil);

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 12), barrelMat);
    b.position.set(-2 + i * 0.8, 0.6, -5);
    b.castShadow = true;
    group.add(b);
  }

  // Dummy
  const dummy = new THREE.Group();
  const dBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x8a7f6b }));
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), new THREE.MeshStandardMaterial({ color: 0x7a7060 }));
  dHead.position.y = 0.9;
  dummy.add(dBody, dHead);
  dummy.position.set(0, 0.8, -3);
  dummy.userData = { type: 'dummy', hp: 999 };
  group.add(dummy);
  state.dummy = dummy;

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), new THREE.MeshStandardMaterial({ color: 0x4a3520 }));
  mast.position.set(2, 4, -4);
  group.add(mast);

  group.visible = true;
  scene.add(group);
  state.shipGroup = group;
}

function buildDungeonArena() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE, 0.2, ARENA_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
  );
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
  const wallH = 5;
  const half = ARENA_SIZE / 2;

  const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallH, ARENA_SIZE), wallMat); w1.position.set(-half, wallH / 2, 0);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallH, ARENA_SIZE), wallMat); w2.position.set(half, wallH / 2, 0);
  const w3 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, wallH, 0.5), wallMat); w3.position.set(0, wallH / 2, -half);
  const w4 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, wallH, 0.5), wallMat); w4.position.set(0, wallH / 2, half);
  [w1, w2, w3, w4].forEach(w => { w.castShadow = true; group.add(w); });

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 0.2, ARENA_SIZE), new THREE.MeshStandardMaterial({ color: 0x080808 }));
  ceil.position.y = wallH;
  group.add(ceil);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let x of [-half + 1, half - 1]) {
    for (let z of [-half + 1, half - 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, wallH, 0.8), pillarMat);
      p.position.set(x, wallH / 2, z);
      p.castShadow = true;
      group.add(p);
    }
  }

  group.visible = false;
  scene.add(group);
  state.dungeonGroup = group;
}

function buildBossArena() {
  const group = new THREE.Group();

  // Water pit
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x051020, transparent: true, opacity: 0.85, roughness: 0.2 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2;
  group.add(water);

  // Ring platform
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x151515, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.1;
  group.add(ring);

  // Barriers  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x222 }));
    b.position.set(Math.cos(ang) * 8, 0.4, Math.sin(ang) * 8);
    group.add(b);
  }

  group.visible = false;
  scene.add(group);
  state.bossArenaGroup = group;
}

// ===== ENEMY SPAWNING =====
export function spawnEnemy(level) {
  if (state.activeEnemy) {
    scene.remove(state.activeEnemy);
    state.activeEnemy = null;
  }

  const hp = 50 + level * 15;
  const scale = Math.min(1 + level * 0.02, 3.5);
  const dark = Math.min(level * 0.008, 0.5);
  const color = new THREE.Color(0.8 - dark * 0.5, 0.15 - dark, 0.15 - dark);

  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000 }));
  head.position.y = 2.0;
  group.add(head);

  group.scale.setScalar(scale);

  const range = ARENA_SIZE / 2 - 3;
  group.position.set((Math.random() - 0.5) * range * 2, 0, (Math.random() - 0.5) * range * 2);
  if (group.position.length() < 4) group.position.set(0, 0, -6);

  group.userData = { type: 'enemy', hp, maxHp: hp, lastShot: 0, fireInterval: 2 + Math.random() * 1, speed: 2 + Math.random() };

  scene.add(group);
  state.activeEnemy = group;
}

// ===== SHADOW TENTACLE =====
export function spawnShadowTentacle() {
  if (state.shadowTentacle) {
    scene.remove(state.shadowTentacle);
    state.shadowTentacle = null;
  }

  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x030305 });

  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 - i * 0.02, 0.11 - i * 0.02, 0.55, 8), mat);
    seg.position.y = i * 0.52;
    seg.rotation.x = (Math.random() - 0.5) * 0.3;
    seg.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(seg);
  }

  group.position.set(-ARENA_SIZE / 2 + 0.6, 0, (Math.random() - 0.5) * 8);
  group.userData = { type: 'shadowTentacle', seen: false, retreating: false };
  scene.add(group);
  state.shadowTentacle = group;
}

// ===== KRAKEN BOSS =====
export function spawnKraken() {
  // Core head
  const headGroup = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.4, metalness: 0.3 })
  );
  head.castShadow = true;
  headGroup.add(head);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  eye.position.set(0, 0.5, 2.2);
  headGroup.add(eye);

  const glow = new THREE.PointLight(0xff0000, 3, 25);
  eye.add(glow);

  headGroup.position.set(0, 2, -12);
  headGroup.userData = { type: 'krakenHead', hp: 500, maxHp: 500 };
  scene.add(headGroup);
  state.krakenHead = headGroup;

  // Tentacles
  state.tentacles = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const tGroup = new THREE.Group();
    const segments = [];

    for (let j = 0; j < 8; j++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 - j * 0.03, 0.3 - j * 0.03, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a1538, roughness: 0.6 })
      );
 seg.geometry.translate(0, 0.6, 0);
      seg.position.y = j * 1.0;
      tGroup.add(seg);
      segments.push(seg);
    }

    const radius = 10;
    tGroup.position.set(Math.cos(angle) * radius, -3, Math.sin(angle) * radius);
    tGroup.lookAt(0, -3, 0);

    tGroup.userData = { type: 'tentacle', hp: 100, maxHp: 100, index: i, basePos: tGroup.position.clone(), angle, segments };
    scene.add(tGroup);
    state.tentacles.push(tGroup);
  }

  state.bossActive = true;
  state.coreExposed = false;
}

// ===== INPUT =====
export function setupInput() {
  const canvas = document.getElementById('gl-canvas');

  canvas.addEventListener('click', () => {
    if ((state.phase === 'tutorial' || state.phase === 'arena' || state.phase === 'boss') && !state.locked) {
      canvas.requestPointerLock();
    } else if (state.locked) {
      playerAttack();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    cameraEuler.y -= e.movementX * MOUSE_SENSITIVITY;
    cameraEuler.x -= e.movementY * MOUSE_SENSITIVITY;
    cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraEuler.x));
    camera.rotation.copy(cameraEuler);
  });

  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': state.moveForward = true; break;
      case 'KeyS': state.moveBackward = true; break;
      case 'KeyA': state.moveLeft = true; break;
      case 'KeyD': state.moveRight = true; break;
      case 'Space': if (state.locked) playerAttack(); break;
      case 'KeyF': toggleFlashlight(); break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': state.moveForward = false; break;
      case 'KeyS': state.moveBackward = false; break;
      case 'KeyA': state.moveLeft = false; break;
      case 'KeyD': state.moveRight = false; break;
    }
  });
}

export function toggleFlashlight() {
  state.flashlightOn = !state.flashlightOn;
  flashlight.intensity = state.flashlightOn ? 3 : 0;
  updateHUD();
}

// ===== GAME LOOP =====
function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  state.time += dt;

  // Ship ocean physics
  if (state.shipGroup && state.shipGroup.visible) {
    state.shipGroup.rotation.z = Math.sin(state.time * 1.5) * 0.08;
    state.shipGroup.rotation.x = Math.cos(state.time * 1.2) * 0.05;
  }

  // Player
  if (state.locked && (state.phase === 'tutorial' || state.phase === 'arena' || state.phase === 'boss')) {
    updatePlayer(dt);
  }

  // Flashlight follow
  if (camera) {
    flashlight.position.copy(camera.position);
    const targetPos = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    flashlight.target.position.copy(targetPos);
  }

  // Storm shake
  if (state.shake > 0) {
    const s = state.shake;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
    state.shake *= 0.92;
    if (state.shake < 0.01) state.shake = 0;
  }

  // Updates
  if (state.phase === 'arena' || state.phase === 'boss') {
    updateProjectiles(dt);
  }

  if (state.phase === 'arena' && state.activeEnemy) {
    updateEnemy(dt);
 checkShadowTentacle();
  }

  if (state.phase === 'boss') {
    updateKraken(dt);
  }

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  const speed = PLAYER_SPEED * dt;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  right.normalize();

  const move = new THREE.Vector3();
  if (state.moveForward) move.add(forward);
  if (state.moveBackward) move.sub(forward);
  if (state.moveLeft) move.sub(right);
  if (state.moveRight) move.add(right);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
  }

  // Bounds
  let limitX, limitZ;
  if (state.phase === 'tutorial') {
    limitX = 3.5;
    limitZ = 6.5;
    camera.position.x = Math.max(-limitX, Math.min(limitX, camera.position.x));
    camera.position.z = Math.max(-limitZ, Math.min(limitZ, camera.position.z));
  } else if (state.phase === 'boss') {
    const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
    if (dist > 9.2) {
      const angle = Math.atan2(camera.position.z, camera.position.x);
      camera.position.x = Math.cos(angle) * 9.2;
      camera.position.z = Math.sin(angle) * 9.2;
    }
    if (dist < 5) {
      const angle = Math.atan2(camera.position.z, camera.position.x);
      camera.position.x = Math.cos(angle) * 5;
      camera.position.z = Math.sin(angle) * 5;
    }
  } else {
    limitX = ARENA_SIZE / 2 - 0.6;
    limitZ = ARENA_SIZE / 2 - 0.6;
    camera.position.x = Math.max(-limitX, Math.min(limitX, camera.position.x));
    camera.position.z = Math.max(-limitZ, Math.min(limitZ, camera.position.z));
  }

  camera.position.y = 1.6;
}

// ===== COMBAT =====
export function playerAttack() {
  // Recoil
  cameraEuler.x += 0.06;
  setTimeout(() => { cameraEuler.x -= 0.06; camera.rotation.copy(cameraEuler); }, 60);

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  for (let hit of intersects) {
    let obj = hit.object;
    while (obj.parent && obj.parent !== scene && !obj.userData.type) {
      obj = obj.parent;
    }
    const type = obj.userData?.type;
    if (!type) continue;

    if (type === 'dummy' && hit.distance < 4) {
      state.dummyHits++;
      flashMesh(obj);
 if (state.dummyHits >= 5 && !state.tutorialComplete && callbacks.onDummyComplete) {
        state.tutorialComplete = true;
        callbacks.onDummyComplete();
      }
      return;
    }

    if (type === 'enemy' && hit.distance < 4) {
      damageEnemy(obj, 25);
      return;
    }

    if (type === 'tentacle' && hit.distance < 4) {
      damageTentacle(obj, 25);
      return;
    }

    if (type === 'krakenHead' && hit.distance < 7) {
      damageKrakenHead(25);
      return;
    }
  }
}

function flashMesh(mesh) {
  if (!mesh.material) return;
  const old = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
  if (mesh.material.emissive) mesh.material.emissive.setHex(0xffffff);
  setTimeout(() => {
    if (mesh.material && mesh.material.emissive) mesh.material.emissive.setHex(old);
  }, 80);
}

function damageEnemy(enemy, amt) {
  enemy.userData.hp -= amt;
  flashMesh(enemy.children[0]);
  if (enemy.userData.hp <= 0) {
    scene.remove(enemy);
    state.activeEnemy = null;
    if (callbacks.onEnemyDefeated) callbacks.onEnemyDefeated();
  }
}

function damageTentacle(tentacle, amt) {
  tentacle.userData.hp -= amt;
  tentacle.children.forEach(c => {
    if (c.material && c.material.emissive) {
      c.material.emissive.setHex(0x550000);
      setTimeout(() => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); }, 100);
    }
  });

  if (tentacle.userData.hp <= 0) {
    tentacle.visible = false;
    const allDead = state.tentacles.every(t => !t.visible || t.userData.hp <= 0);
    if (allDead && !state.coreExposed) {
      state.coreExposed = true;
      if (callbacks.onAllTentaclesDead) callbacks.onAllTentaclesDead();
    }
  }
}

function damageKrakenHead(amt) {
  if (!state.krakenHead) return;
  if (!state.coreExposed) {
    flashMesh(state.krakenHead.children[0]);
    return;
  }
  state.krakenHead.userData.hp -= amt;
  flashMesh(state.krakenHead.children[0]);
  if (state.krakenHead.userData.hp <= 0) {
    if (callbacks.onBossDefeated) callbacks.onBossDefeated();
  }
}

function updateEnemy(dt) {
  const enemy = state.activeEnemy;
  if (!enemy) return;

  const ePos = enemy.position;
  const cPos = camera.position;
  const dx = cPos.x - ePos.x;
  const dz = cPos.z - ePos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Face player
  enemy.lookAt(cPos.x, ePos.y, cPos.z);

  // Move toward if far
  if (dist > 8) {
    const speed = enemy.userData.speed * dt;
    ePos.x += (dx / dist) * speed;
    ePos.z += (dz / dist) * speed;
  }

  // Shoot
  enemy.userData.lastShot += dt;
  if (enemy.userData.lastShot >= enemy.userData.fireInterval) {
    enemy.userData.lastShot = 0;
    enemy.userData.fireInterval = 2 + Math.random() * 1;
    spawnProjectile(ePos.clone().add(new THREE.Vector3(0, 1.5, 0)), cPos.clone());
  }
}

function spawnProjectile(from, to) {
  const geo = new THREE.SphereGeometry(0.18, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00aa });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from);

  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  mesh.userData = { type: 'projectile', velocity: dir.multiplyScalar(10), life: 4 };
  scene.add(mesh);
  state.projectiles.push(mesh);
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.position.addScaledVector(p.userData.velocity, dt);
    p.userData.life -= dt;

    const distToPlayer = p.position.distanceTo(camera.position);
    if (distToPlayer < 1.2) {
      damagePlayer(10);
      scene.remove(p);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (p.userData.life <= 0) {
      scene.remove(p);
      state.projectiles.splice(i, 1);
    }
  }
}

function damagePlayer(amt) {
  state.hp -= amt;
  if (state.hp < 0) state.hp = 0;
  updateHUD();

  const flash = document.getElementById('damage-flash');
  if (flash) {
    flash.style.opacity = '1';
    setTimeout(() => { if (flash) flash.style.opacity = '0'; }, 120);
  }

  if (state.hp <= 0 && callbacks.onPlayerDead) {
    callbacks.onPlayerDead();
  }
}

// ===== SHADOW TENTACLE LOGIC =====
function checkShadowTentacle() {
  if (!state.shadowTentacle || state.shadowTentacle.userData.retreating) return;

  const t = state.shadowTentacle;
  const toTentacle = new THREE.Vector3().subVectors(t.position, camera.position).normalize();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const dot = forward.dot(toTentacle);

  if (dot > 0.5 && camera.position.distanceTo(t.position) < 16) {
    t.userData.retreating = true;
    if (callbacks.onTentacleSeen) callbacks.onTentacleSeen();

    let progress = 0;
    const startX = t.position.x;
    const intv = setInterval(() => {
      progress += 0.15;
      t.position.x = startX - progress * 3;
      t.scale.setScalar(1 - progress * 0.6);
      if (progress >= 1) {
        clearInterval(intv);
        t.visible = false;
      }
    }, 30);
  }
}

// ===== KRAKEN ANIMATION =====
function updateKraken(dt) {
  const time = state.time;

  // Head bob
  if (state.krakenHead) {
    state.krakenHead.position.y = 2 + Math.sin(time) * 0.6;
    state.krakenHead.rotation.z = Math.sin(time * 0.7) * 0.06;
  }

  // Tentacles
  state.tentacles.forEach(t => {
    if (!t.visible) return;
    const data = t.userData;
    const offset = data.angle * 3;

    const rise = Math.sin(time * 1.5 + offset) * 2.5 + Math.cos(time * 2.1 + offset) * 1.5;
    const baseY = data.basePos.y + rise + 1.2;
    t.position.y = baseY;

    // Reach / slam toward player
    const reach = Math.max(0, Math.sin(time * 1.2 + offset));
    t.position.x = THREE.MathUtils.lerp(data.basePos.x, camera.position.x, reach * 0.25);
    t.position.z = THREE.MathUtils.lerp(data.basePos.z, camera.position.z, reach * 0.25);

    // Face player roughly
    const targetRotY = Math.atan2(camera.position.x - t.position.x, camera.position.z - t.position.z);
    t.rotation.y = targetRotY + Math.PI;

    // Writhe segments
    data.segments.forEach((seg, j) => {
      seg.rotation.x = Math.sin(time * 3 + offset + j) * 0.5;
      seg.rotation.z = Math.cos(time * 2.5 + offset + j) * 0.5;
    });
  });
}

// ===== UTILS / STATE HELPERS =====
export function setPhase(phase) {
  state.phase = phase;
}

export function setShipVisibility(v) {
  if (state.shipGroup) state.shipGroup.visible = v;
}

export function setDungeonVisibility(v) {
  if (state.dungeonGroup) {
    state.dungeonGroup.visible = v;
    if (v) {
      const density = 0.02 + Math.floor((state.level - 1) / 10) * 0.005;
      scene.fog.density = Math.min(density, 0.08);
    }
  }
}

export function setBossArenaVisibility(v) {
  if (state.bossArenaGroup) state.bossArenaGroup.visible = v;
}

export function triggerStorm(duration = 2000) {
  state.shake = 0.5;
  const origBg = scene.background ? scene.background.getHex() : 0x0e1118;
  const flashInt = setInterval(() => {
    state.shake = 0.3 + Math.random() * 0.4;
    scene.background = new THREE.Color(Math.random() > 0.5 ? 0x1a2a3a : 0x050510);
  }, 80);

  setTimeout(() => {
    clearInterval(flashInt);
    state.shake = 0;
    scene.background = new THREE.Color(origBg);
  }, duration);
}

export function updateHUD() {
  const zone = document.getElementById('zone-display');
  const hpBar = document.getElementById('health-bar');
  const flStatus = document.getElementById('fl-status');

  if (zone) zone.textContent = state.phase === 'boss' ? 'ZONE: THE ABYSS GATEWAY' : `ZONE: ARENA LEVEL ${state.level} / 100`;
  if (hpBar) hpBar.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  if (flStatus) {
    flStatus.textContent = state.flashlightOn ? 'ON' : 'OFF';
    flStatus.style.color = state.flashlightOn ? '#ffd700' : '#555';
  }
}

export function resetGame() {
  // Cleanup entities
  if (state.activeEnemy) { scene.remove(state.activeEnemy); state.activeEnemy = null; }
  state.projectiles.forEach(p => scene.remove(p));
  state.projectiles = [];
  state.tentacles.forEach(t => scene.remove(t));
  state.tentacles = [];
  if (state.krakenHead) { scene.remove(state.krakenHead); state.krakenHead = null; }
  if (state.shadowTentacle) { scene.remove(state.shadowTentacle); state.shadowTentacle = null; }

  state.hp = 100;
  state.level = 0;
  state.dummyHits = 0;
  state.tutorialComplete = false;
  state.phase = 'menu';
  state.bossActive = false;
  state.coreExposed = false;

  camera.position.set(0, 1.6, 0);
  camera.rotation.set(0, 0, 0);
  cameraEuler.set(0, 0, 0);

  setShipVisibility(false);
  setDungeonVisibility(false);
  setBossArenaVisibility(false);

  updateHUD();
}

export function getState() { return state; }
export function getCamera() { return camera; }
export function getScene() { return scene; }
