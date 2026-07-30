import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ==========================================
// GAME STATE & CALLBACKS
// ==========================================
export const state = {
  phase: 'start',
  level: 0,
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
  onAllTentaclesDead: null,
  onBossDefeated: null
};

// Engine & Scene References
let scene, camera, renderer;
let flashlight, lanternLight;
let clock = new THREE.Clock();
let keys = {};

// Game Groups & Meshes
const groups = {
  ship: null,
  dungeon: null,
  boss: null,
  player: null
};

const entities = {
  dummy: null,
  enemy: null,
  tentacle: null,
  kraken: null
};

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

// Tentacle Slither State
let tentacleSlitherProgress = 0;
let tentacleSlithering = false;

// ==========================================
// INITIALIZATION & ENGINE SETUP
// ==========================================
export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();

  const fogColor = 0x0a0c10;
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.FogExp2(fogColor, 0.035);

  // Grounded First-Person Perspective Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(fogColor, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambientLight = new THREE.AmbientLight(0xffebd2, 0.4);
  scene.add(ambientLight);

  setupPlayerAndFlashlight();
  setupShipDeck();
  setupDungeonMaze();
  setupBossArena();

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
  groups.player.add(camera);

  // Dynamic Spotlight bound directly to camera gaze
  flashlight = new THREE.SpotLight(0xfff5e0, 0, 35, Math.PI / 5, 0.4, 1);
  flashlight.position.set(0, 0, 0);

  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -5);
  camera.add(flashTarget);
  flashlight.target = flashTarget;

  camera.add(flashlight);
}

function setupShipDeck() {
  groups.ship = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.8, roughness: 0.4 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8c7961, roughness: 0.95 });

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

  lanternLight = new THREE.PointLight(0xffa542, 3.5, 18, 1.5);
  lanternLight.position.set(0, 3.6, -2);
  groups.ship.add(lanternLight);

  // Training Dummy Construction
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

  const armUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), woodDark);
  armUpper.rotation.set(0, 0.3, Math.PI / 2);
  armUpper.position.set(0.1, 1.7, 0.1);
  entities.dummy.add(armUpper);

  entities.dummy.position.set(0, 0, -3);
  groups.ship.add(entities.dummy);

  scene.add(groups.ship);
}

function setupDungeonMaze() {
  groups.dungeon = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  groups.dungeon.add(floor);

  // Maze Walls Generation
  for (let i = -24; i <= 24; i += 8) {
    for (let j = -24; j <= 24; j += 8) {
      if ((Math.abs(i) > 2 || Math.abs(j) > 2) && Math.random() > 0.35) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 6), wallMat);
        wall.position.set(i, 2.25, j);
        groups.dungeon.add(wall);
      }
    }
  }

  // Shadow Lurker Creature Construction
  entities.enemy = new THREE.Group();
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x030406, roughness: 0.1, metalness: 0.2 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.4 });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

  // Spine
  const spineGroup = new THREE.Group();
  spineGroup.name = 'lurker_spine';
  for (let s = 0; s < 5; s++) {
    const vertebra = new THREE.Mesh(new THREE.ConeGeometry(0.35 - s * 0.04, 0.5, 6), boneMat);
    vertebra.position.set(0, 1.2 + s * 0.3, -s * 0.08);
    vertebra.rotation.x = 0.25;
    spineGroup.add(vertebra);
  }
  entities.enemy.add(spineGroup);

  // Head & Eyes
  const headGroup = new THREE.Group();
  headGroup.name = 'lurker_head';
  headGroup.position.set(0, 2.7, -0.3);

  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 7), shadowMat);
  skull.rotation.x = -Math.PI / 2.2;
  headGroup.add(skull);

  const eyeOffsets = [
    { x: -0.12, y: 0.05, z: -0.35 },
    { x: 0.12, y: 0.05, z: -0.35 },
    { x: -0.07, y: -0.08, z: -0.32 },
    { x: 0.07, y: -0.08, z: -0.32 }
  ];
  eyeOffsets.forEach((pos, idx) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeGlowMat);
    eye.position.set(pos.x, pos.y, pos.z);
    eye.name = `lurker_eye_${idx}`;
    headGroup.add(eye);
  });
  entities.enemy.add(headGroup);

  // Claws / Limbs
  const armConfigs = [
    { side: -1, yPos: 2.3, rotZ: 0.8, length: 1.4, name: 'arm_L1' },
    { side: 1, yPos: 2.3, rotZ: -0.8, length: 1.4, name: 'arm_R1' },
    { side: -1, yPos: 1.8, rotZ: 1.2, length: 1.6, name: 'arm_L2' },
    { side: 1, yPos: 1.8, rotZ: -1.2, length: 1.6, name: 'arm_R2' }
  ];

  armConfigs.forEach(cfg => {
    const armGroup = new THREE.Group();
    armGroup.name = cfg.name;
    armGroup.position.set(cfg.side * 0.25, cfg.yPos, -0.1);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, cfg.length, 6), shadowMat);
    upper.position.set(cfg.side * (cfg.length / 2), -cfg.length / 3, 0);
    upper.rotation.z = cfg.rotZ;
    armGroup.add(upper);

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.2, 5), boneMat);
    claw.position.set(cfg.side * cfg.length, -cfg.length * 0.9, 0.3);
    claw.rotation.x = 0.6;
    claw.rotation.z = cfg.rotZ * 0.5;
    armGroup.add(claw);

    entities.enemy.add(armGroup);
  });

  const coreLight = new THREE.PointLight(0xff0022, 1.5, 6);
  coreLight.position.set(0, 1.8, -0.2);
  entities.enemy.add(coreLight);

  entities.enemy.position.set(0, 0, -10);
  groups.dungeon.add(entities.enemy);

  // Slithering Shadow Tentacle
  entities.tentacle = new THREE.Group();
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x08181c, roughness: 0.3 });

  for (let s = 0; s < 8; s++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2 - s * 0.018, 0.24 - s * 0.018, 0.5, 10),
      tentacleMat
    );
    seg.position.z = -s * 0.45;
    seg.name = `t_seg_${s}`;
    entities.tentacle.add(seg);
  }

  entities.tentacle.position.set(3.1, 0.2, -6);
  entities.tentacle.rotation.y = -Math.PI / 4;
  groups.dungeon.add(entities.tentacle);

  groups.dungeon.visible = false;
  scene.add(groups.dungeon);
}

function setupBossArena() {
  groups.boss = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x051318, roughness: 0.1 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), waterMat);
  water.rotation.x = -Math.PI / 2;
  groups.boss.add(water);

  entities.kraken = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0e2b30 }));
  head.position.y = 2;
  entities.kraken.add(head);

  const coreEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff1100 }));
  coreEye.position.set(0, 3, -3.2);
  entities.kraken.add(coreEye);

  entities.kraken.position.set(0, 0, -22);
  groups.boss.add(entities.kraken);

  groups.boss.visible = false;
  scene.add(groups.boss);
}

// ==========================================
// CONTROL & EVENT LISTENERS
// ==========================================
export function setupInput() {
  const canvas = document.getElementById('gl-canvas');
  
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (k === 'f') {
      state.flashlightOn = !state.flashlightOn;
      flashlight.intensity = state.flashlightOn ? 16 : 0;
      const statusEl = document.getElementById('fl-status');
      if (statusEl) statusEl.textContent = state.flashlightOn ? 'ON' : 'OFF';
    }
  });

  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas && state.phase !== 'cutscene') {
      groups.player.rotation.y -= e.movementX * 0.0025;
      camera.rotation.x -= e.movementY * 0.0025;
      camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camera.rotation.x));
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
  } else if (state.phase === 'arena' && entities.enemy) {
    if (groups.player.position.distanceTo(entities.enemy.position) < 3.5) {
      entities.enemy.position.z -= 4;
      if (entities.enemy.position.z < -28 && callbacks.onEnemyDefeated) {
        callbacks.onEnemyDefeated();
      }
    }
  } else if (state.phase === 'boss' && entities.kraken) {
    if (callbacks.onBossDefeated) callbacks.onBossDefeated();
  }
}

// ==========================================
// CINEMATICS & GAME LIFECYCLE
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
  if (entities.enemy) entities.enemy.position.set((Math.random() - 0.5) * 10, 0, -10);
}

export function spawnShadowTentacle() {
  if (entities.tentacle && callbacks.onTentacleSeen) {
    entities.tentacle.position.set(3.1, 0.2, groups.player.position.z - 6);
    entities.tentacle.visible = true;
    tentacleSlithering = false;
    tentacleSlitherProgress = 0;
  }
}

export function spawnKraken() { 
  if (entities.kraken) entities.kraken.position.set(0, 0, -20); 
}

export function triggerStorm(duration) {
  let count = 0;
  const interval = setInterval(() => {
    const stormHex = count % 2 === 0 ? 0x334466 : 0x0a0c10;
    scene.fog.color.setHex(stormHex);
    scene.background.setHex(stormHex);
    renderer.setClearColor(stormHex, 1);
    count++;
    if (count > 16) {
      clearInterval(interval);
      scene.fog.color.setHex(0x0a0c10);
      scene.background.setHex(0x0a0c10);
      renderer.setClearColor(0x0a0c10, 1);
    }
  }, duration / 16);
}

export function updateHUD() {
  const zd = document.getElementById('zone-display');
  const hb = document.getElementById('health-bar');
  if (zd) zd.textContent = state.phase === 'tutorial' ? 'ZONE: SHIP DECK' : `ZONE: ARENA LEVEL ${state.level} / 100`;
  if (hb) hb.style.width = `${Math.max(0, state.hp)}%`;
}

export function resetGame() {
  state.hp = 100;
  state.level = 0;
  state.dummyHits = 0;
  groups.player.position.set(0, 1.6, 5);
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
// MAIN ENGINE ANIMATION LOOP
// ==========================================
function animate() {
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. Procedural Shadow Lurker Animation
  if (entities.enemy && groups.dungeon.visible) {
    entities.enemy.position.y = Math.sin(time * 2.0) * 0.12 + 0.05;

    const head = entities.enemy.getObjectByName('lurker_head');
    if (head) {
      if (Math.random() < 0.04) {
        head.rotation.y = (Math.random() - 0.5) * 0.8;
        head.rotation.z = (Math.random() - 0.5) * 0.5;
      } else {
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, 0, 0.1);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, 0, 0.1);
      }
    }

    ['arm_L1', 'arm_R1', 'arm_L2', 'arm_R2'].forEach((armName, idx) => {
      const arm = entities.enemy.getObjectByName(armName);
      if (arm) {
        arm.rotation.x = Math.sin(time * 3 + idx * 1.2) * 0.15;
        if (Math.random() < 0.02) {
          arm.rotation.z += (Math.random() - 0.5) * 0.3;
        }
      }
    });

    entities.enemy.lookAt(groups.player.position.x, entities.enemy.position.y, groups.player.position.z);
  }

  // 2. Cutscene Interpolation Logic
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

  // 3. Corner Slithering Tentacle Mechanics
  if (entities.tentacle && groups.dungeon.visible && entities.tentacle.visible) {
    const dist = groups.player.position.distanceTo(entities.tentacle.position);
    if (dist < 8.0 && !tentacleSlithering) {
      tentacleSlithering = true;
      if (callbacks.onTentacleSeen) callbacks.onTentacleSeen();
    }

    if (tentacleSlithering) {
      tentacleSlitherProgress += delta * 2.2;

      for (let s = 0; s < 8; s++) {
        const seg = entities.tentacle.getObjectByName(`t_seg_${s}`);
        if (seg) {
          seg.position.x = Math.sin(tentacleSlitherProgress * 3 + s * 0.4) * 0.3;
          seg.position.z = -s * 0.45 - tentacleSlitherProgress * 1.8;
        }
      }

      if (tentacleSlitherProgress > 3.0) {
        entities.tentacle.visible = false;
      }
    }
  }

  // 4. Camera Shake Processing
  if (cutsceneState.shakeDuration > 0) {
    cutsceneState.shakeDuration -= delta;
    camera.position.x += (Math.random() - 0.5) * cutsceneState.shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * cutsceneState.shakeIntensity;
  }

  // 5. Player FPS Movement Update
  if (['tutorial', 'arena', 'boss'].includes(state.phase)) {
    const speed = 5.2 * delta;
    if (keys['w']) groups.player.translateZ(-speed);
    if (keys['s']) groups.player.translateZ(speed);
    if (keys['a']) groups.player.translateX(-speed);
    if (keys['d']) groups.player.translateX(speed);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
