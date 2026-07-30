import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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

let scene, camera, renderer, player, flashlight, lanternLight;
let shipGroup, dungeonGroup, bossGroup;
let dummyMesh, enemyMesh, shadowTentacleMesh, krakenMesh;
let tentaclesList = [];
let keys = {};
let clock = new THREE.Clock();

// Cutscene & Animation state
let activeSequence = [];
let sequenceIndex = 0;
let sequenceProgress = 0;
let sequenceOnComplete = null;
let camStartPos = new THREE.Vector3();
let camStartLook = new THREE.Vector3();
let currentLookTarget = new THREE.Vector3();
let shakeDuration = 0;
let shakeIntensity = 0;

export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();

  const fogColor = 0x0a0c10;
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.FogExp2(fogColor, 0.035);

  // FIX: Proper First-Person FOV (70deg) & tight near-plane (0.05) to stop 3rd-person feel
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(fogColor, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.AmbientLight(0xffebd2, 0.4);
  scene.add(ambient);

  createPlayerAndFlashlight();
  createShipDeck();
  createDungeonMaze();
  createBossArena();

  window.addEventListener('resize', onResize);
  animate();
}

function createPlayerAndFlashlight() {
  player = new THREE.Group();
  player.position.set(0, 1.6, 5);
  scene.add(player);

  // Position camera directly inside player group head position
  camera.position.set(0, 0, 0);
  player.add(camera);

  // FIX: Flashlight locked to camera view, pointing straight forward
  flashlight = new THREE.SpotLight(0xfff5e0, 0, 35, Math.PI / 5, 0.4, 1);
  flashlight.position.set(0, 0, 0);
  
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -5);
  camera.add(flashTarget);
  flashlight.target = flashTarget;
  
  camera.add(flashlight);
}

function createShipDeck() {
  shipGroup = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a6f47, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.8, roughness: 0.4 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8c7961, roughness: 0.95 });

  // Deck Floor & Hull
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 20), woodDark);
  floor.position.y = -0.2;
  shipGroup.add(floor);

  for (let z = -9; z <= 9; z += 3) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribL.position.set(-6.5, 2, z);
    ribL.rotation.z = -0.15;
    shipGroup.add(ribL);

    const ribR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribR.position.set(6.5, 2, z);
    ribR.rotation.z = 0.15;
    shipGroup.add(ribR);
  }

  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallL.position.set(-6.8, 2, 0);
  shipGroup.add(wallL);

  const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallR.position.set(6.8, 2, 0);
  shipGroup.add(wallR);

  lanternLight = new THREE.PointLight(0xffa542, 3.5, 18, 1.5);
  lanternLight.position.set(0, 3.6, -2);
  shipGroup.add(lanternLight);

  // FIX: Detailed Martial Arts Training Dummy
  dummyMesh = new THREE.Group();

  // Heavy Metal Base Plate
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.2, 16), ironMat);
  base.position.y = 0.1;
  dummyMesh.add(base);

  // Wooden Main Post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.4, 12), woodLight);
  post.position.y = 1.2;
  dummyMesh.add(post);

  // Woven Straw Torso Target
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 1.2, 12), clothMat);
  torso.position.y = 1.5;
  dummyMesh.add(torso);

  // Carved Head Piece
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), woodLight);
  head.position.y = 2.3;
  dummyMesh.add(head);

  // Staggered Wooden Sparring Arms
  const armUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), woodDark);
  armUpper.rotation.z = Math.PI / 2;
  armUpper.rotation.y = 0.3;
  armUpper.position.set(0.1, 1.7, 0.1);
  dummyMesh.add(armUpper);

  const armLower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), woodDark);
  armLower.rotation.z = Math.PI / 2;
  armLower.rotation.y = -0.3;
  armLower.position.set(-0.1, 1.4, -0.1);
  dummyMesh.add(armLower);

  // Rope Bindings around Torso
  for (let r = 0; r < 3; r++) {
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 8, 16), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 1.1 + r * 0.35;
    dummyMesh.add(rope);
  }

  dummyMesh.position.set(0, 0, -3);
  shipGroup.add(dummyMesh);

  scene.add(shipGroup);
}

function createDungeonMaze() {
  dungeonGroup = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  dungeonGroup.add(floor);

  for (let i = -24; i <= 24; i += 8) {
    for (let j = -24; j <= 24; j += 8) {
      if (Math.abs(i) > 2 || Math.abs(j) > 2) {
        if (Math.random() > 0.35) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 6), wallMat);
          wall.position.set(i, 2.25, j);
          dungeonGroup.add(wall);
        }
      }
    }
  }

  // Enemy Lurker
  enemyMesh = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.1, 2.2, 8), darkMat);
  body.position.y = 1.1;
  enemyMesh.add(body);
  enemyMesh.position.set(0, 0, -10);
  dungeonGroup.add(enemyMesh);

  // FIX: Wall-Mounted Slithering Shadow Tentacle
  shadowTentacleMesh = new THREE.Group();
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x0a1e24, roughness: 0.3 });

  const segmentCount = 6;
  for (let s = 0; s < segmentCount; s++) {
    const segGeo = new THREE.CylinderGeometry(0.25 - s * 0.03, 0.3 - s * 0.03, 0.8, 10);
    const seg = new THREE.Mesh(segGeo, tentacleMat);
    seg.position.y = s * 0.7;
    seg.name = `tentacle_seg_${s}`;
    shadowTentacleMesh.add(seg);
  }

  // Emerge horizontally from stone wall side
  shadowTentacleMesh.rotation.x = Math.PI / 2;
  shadowTentacleMesh.position.set(2.9, 1.8, -8);
  dungeonGroup.add(shadowTentacleMesh);

  dungeonGroup.visible = false;
  scene.add(dungeonGroup);
}

function createBossArena() {
  bossGroup = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x051318, roughness: 0.1 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), waterMat);
  water.rotation.x = -Math.PI / 2;
  bossGroup.add(water);

  krakenMesh = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0e2b30 }));
  head.position.y = 2;
  krakenMesh.add(head);

  const coreEye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff1100 }));
  coreEye.position.set(0, 3, -3.2);
  krakenMesh.add(coreEye);

  krakenMesh.position.set(0, 0, -22);
  bossGroup.add(krakenMesh);

  bossGroup.visible = false;
  scene.add(bossGroup);
}

export function startCinematicSequence(keyframes, onComplete) {
  state.phase = 'cutscene';
  activeSequence = keyframes;
  sequenceIndex = 0;
  sequenceProgress = 0;
  sequenceOnComplete = onComplete;

  camStartPos.copy(camera.position);
  camStartLook.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
}

export function triggerScreenShake(duration = 1.0, intensity = 0.2) {
  shakeDuration = duration;
  shakeIntensity = intensity;
}

export function setupInput() {
  const canvas = document.getElementById('gl-canvas');
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    // FIX: Toggle Flashlight ON / OFF with 'F'
    if (k === 'f') {
      state.flashlightOn = !state.flashlightOn;
      flashlight.intensity = state.flashlightOn ? 14 : 0;
      const el = document.getElementById('fl-status');
      if (el) el.textContent = state.flashlightOn ? 'ON' : 'OFF';
    }
  });

  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas && state.phase !== 'cutscene') {
      player.rotation.y -= e.movementX * 0.0025;
      camera.rotation.x -= e.movementY * 0.0025;
      camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camera.rotation.x));
    }
  });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'cutscene' && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
    onStrike();
  });
}

function onStrike() {
  if (state.phase === 'cutscene') return;
  if (state.phase === 'tutorial' && dummyMesh) {
    if (player.position.distanceTo(dummyMesh.position) < 4) {
      state.dummyHits++;
      dummyMesh.rotation.z = 0.18;
      setTimeout(() => dummyMesh.rotation.z = 0, 120);

      if (state.dummyHits >= 5 && callbacks.onDummyComplete) {
        callbacks.onDummyComplete();
      }
    }
  } else if (state.phase === 'arena' && enemyMesh) {
    if (player.position.distanceTo(enemyMesh.position) < 3.5) {
      enemyMesh.position.z -= 4;
      if (enemyMesh.position.z < -28 && callbacks.onEnemyDefeated) callbacks.onEnemyDefeated();
    }
  } else if (state.phase === 'boss' && krakenMesh) {
    if (callbacks.onBossDefeated) callbacks.onBossDefeated();
  }
}

export function setPhase(p) { state.phase = p; }
export function setShipVisibility(v) { shipGroup.visible = v; }
export function setDungeonVisibility(v) { dungeonGroup.visible = v; }
export function setBossArenaVisibility(v) { bossGroup.visible = v; }

export function spawnEnemy(lvl) {
  if (enemyMesh) enemyMesh.position.set((Math.random() - 0.5) * 10, 0, -10);
}

export function spawnShadowTentacle() {
  if (shadowTentacleMesh && callbacks.onTentacleSeen) {
    shadowTentacleMesh.position.set(2.9, 1.8, player.position.z - 8);
    callbacks.onTentacleSeen();
  }
}

export function spawnKraken() { if (krakenMesh) krakenMesh.position.set(0, 0, -20); }

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
  player.position.set(0, 1.6, 5);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  updateHUD();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Cutscene Interpolation
  if (state.phase === 'cutscene' && activeSequence.length > 0) {
    const targetKeyframe = activeSequence[sequenceIndex];
    sequenceProgress += delta / targetKeyframe.duration;

    const t = Math.min(sequenceProgress, 1.0);
    const easeT = t * t * (3 - 2 * t);

    const targetPos = new THREE.Vector3(targetKeyframe.pos.x, targetKeyframe.pos.y, targetKeyframe.pos.z);
    camera.position.lerpVectors(camStartPos, targetPos, easeT);

    const targetLook = new THREE.Vector3(targetKeyframe.look.x, targetKeyframe.look.y, targetKeyframe.look.z);
    currentLookTarget.lerpVectors(camStartLook, targetLook, easeT);
    camera.lookAt(currentLookTarget);

    if (t >= 1.0) {
      sequenceIndex++;
      if (sequenceIndex < activeSequence.length) {
        sequenceProgress = 0;
        camStartPos.copy(camera.position);
        camStartLook.copy(currentLookTarget);
      } else {
        activeSequence = [];
        if (sequenceOnComplete) sequenceOnComplete();
      }
    }
  }

  // FIX: Animated Slithering Wall Tentacle (Withdraws back into the wall)
  if (shadowTentacleMesh && dungeonGroup.visible) {
    for (let s = 0; s < 6; s++) {
      const child = shadowTentacleMesh.getObjectByName(`tentacle_seg_${s}`);
      if (child) {
        child.rotation.z = Math.sin(time * 4 + s * 0.5) * 0.15;
        child.rotation.x = Math.cos(time * 3 + s * 0.5) * 0.12;
      }
    }
    shadowTentacleMesh.position.x = 2.9 + Math.sin(time * 1.5) * 0.8;
  }

  // Screen Shake
  if (shakeDuration > 0) {
    shakeDuration -= delta;
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  }

  // First-Person Player Movement
  if (state.phase === 'tutorial' || state.phase === 'arena' || state.phase === 'boss') {
    const speed = 5.2 * delta;
    if (keys['w']) player.translateZ(-speed);
    if (keys['s']) player.translateZ(speed);
    if (keys['a']) player.translateX(-speed);
    if (keys['d']) player.translateX(speed);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
