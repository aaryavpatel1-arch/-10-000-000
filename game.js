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

// Cinematic Sequence Manager
let activeSequence = [];
let sequenceIndex = 0;
let sequenceProgress = 0;
let sequenceOnComplete = null;
let camStartPos = new THREE.Vector3();
let camStartLook = new THREE.Vector3();
let currentLookTarget = new THREE.Vector3();

// Screen Shake State
let shakeDuration = 0;
let shakeIntensity = 0;

export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();

  const fogColor = 0x0a0c10;
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.FogExp2(fogColor, 0.035);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(fogColor, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.AmbientLight(0xffebd2, 0.5);
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
  player.add(camera);

  flashlight = new THREE.SpotLight(0xfffaed, 0, 45, Math.PI / 4, 0.3, 1);
  flashlight.position.set(0.3, -0.2, -0.2);
  const target = new THREE.Object3D();
  target.position.set(0, 0, -5);
  camera.add(target);
  flashlight.target = target;
  camera.add(flashlight);
}

function createShipDeck() {
  shipGroup = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.8, roughness: 0.4 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8a6f47, roughness: 0.9 });

  const floorGeo = new THREE.BoxGeometry(14, 0.4, 20);
  const floor = new THREE.Mesh(floorGeo, woodDark);
  floor.position.y = -0.2;
  shipGroup.add(floor);

  for (let z = -9; z <= 9; z += 3) {
    const ribLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribLeft.position.set(-6.5, 2, z);
    ribLeft.rotation.z = -0.15;
    shipGroup.add(ribLeft);

    const ribRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribRight.position.set(6.5, 2, z);
    ribRight.rotation.z = 0.15;
    shipGroup.add(ribRight);
  }

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallLeft.position.set(-6.8, 2, 0);
  shipGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallRight.position.set(6.8, 2, 0);
  shipGroup.add(wallRight);

  lanternLight = new THREE.PointLight(0xffa542, 3.5, 18, 1.5);
  lanternLight.position.set(0, 3.6, -2);
  shipGroup.add(lanternLight);

  dummyMesh = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.2, 16), ironMat);
  base.position.y = 0.1;
  dummyMesh.add(base);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.2, 12), woodLight);
  post.position.y = 1.1;
  dummyMesh.add(post);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.3, 12), clothMat);
  torso.position.y = 1.55;
  dummyMesh.add(torso);

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

  enemyMesh = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.1, 2.2, 8), darkMat);
  body.position.y = 1.1;
  enemyMesh.add(body);
  enemyMesh.position.set(0, 0, -10);
  dungeonGroup.add(enemyMesh);

  const tentacleGeo = new THREE.CylinderGeometry(0.15, 0.45, 6, 12);
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x0d282e, roughness: 0.4 });
  shadowTentacleMesh = new THREE.Mesh(tentacleGeo, tentacleMat);
  shadowTentacleMesh.position.set(8, 2, -12);
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

/**
 * CUTSCENE ENGINE: Smoothly interpolates camera position & target over timed keyframes
 */
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
  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas && state.phase !== 'cutscene') {
      player.rotation.y -= e.movementX * 0.003;
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
  if (shadowTentacleMesh && callbacks.onTentacleSeen) callbacks.onTentacleSeen();
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

  // Process Cutscene Keyframes & Smooth Camera Motion
  if (state.phase === 'cutscene' && activeSequence.length > 0) {
    const targetKeyframe = activeSequence[sequenceIndex];
    sequenceProgress += delta / targetKeyframe.duration;

    const t = Math.min(sequenceProgress, 1.0);
    const easeT = t * t * (3 - 2 * t); // Smooth step easing

    // Interpolate camera position
    const targetPos = new THREE.Vector3(targetKeyframe.pos.x, targetKeyframe.pos.y, targetKeyframe.pos.z);
    camera.position.lerpVectors(camStartPos, targetPos, easeT);

    // Interpolate lookAt target
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

  // Apply Screen Shake during impacts/storms
  if (shakeDuration > 0) {
    shakeDuration -= delta;
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  }

  // Regular Player Controls during Gameplay
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
