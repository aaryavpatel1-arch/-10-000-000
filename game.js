import * as THREE from 'three';

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

let scene, camera, renderer, player, flashlight;
let shipGroup, dungeonGroup, bossGroup;
let dummyMesh, enemyMesh, shadowTentacleMesh, krakenMesh;
let tentaclesList = [];
let keys = {};
let clock = new THREE.Clock();

export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e1118, 0.035);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const ambient = new THREE.AmbientLight(0xfff5e6, 1.5);
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

  const floorGeo = new THREE.BoxGeometry(12, 0.4, 16);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18 });
  const floor = new THREE.Mesh(floorGeo, woodMat);
  floor.position.y = -0.2;
  shipGroup.add(floor);

  const dummyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 12);
  const dummyMat = new THREE.MeshStandardMaterial({ color: 0x8a6f47 });
  dummyMesh = new THREE.Mesh(dummyGeo, dummyMat);
  dummyMesh.position.set(0, 0.9, -3);
  shipGroup.add(dummyMesh);

  scene.add(shipGroup);
}

function createDungeonMaze() {
  dungeonGroup = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x22252e });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111318 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
  floor.rotation.x = -Math.PI / 2;
  dungeonGroup.add(floor);

  for (let i = -20; i <= 20; i += 8) {
    for (let j = -20; j <= 20; j += 8) {
      if (Math.random() > 0.4) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), wallMat);
        wall.position.set(i, 2, j);
        dungeonGroup.add(wall);
      }
    }
  }

  const enemyGeo = new THREE.BoxGeometry(1, 2, 1);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0x8c2b2b });
  enemyMesh = new THREE.Mesh(enemyGeo, enemyMat);
  enemyMesh.position.set(0, 1, -8);
  dungeonGroup.add(enemyMesh);

  const tentacleGeo = new THREE.CylinderGeometry(0.2, 0.5, 5, 8);
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x1f5c66 });
  shadowTentacleMesh = new THREE.Mesh(tentacleGeo, tentacleMat);
  shadowTentacleMesh.position.set(12, 2.5, -12);
  shadowTentacleMesh.rotation.z = Math.PI / 4;
  dungeonGroup.add(shadowTentacleMesh);

  dungeonGroup.visible = false;
  scene.add(dungeonGroup);
}

function createBossArena() {
  bossGroup = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x091d24, roughness: 0.1 });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  bossGroup.add(water);

  krakenMesh = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshStandardMaterial({ color: 0x123138 }));
  head.position.y = 2;
  krakenMesh.add(head);

  tentaclesList = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1f5c66 }));
    const angle = (i / 6) * Math.PI * 2;
    t.position.set(Math.cos(angle) * 10, 2, Math.sin(angle) * 10 - 15);
    krakenMesh.add(t);
    tentaclesList.push(t);
  }

  krakenMesh.position.set(0, 0, -20);
  bossGroup.add(krakenMesh);

  bossGroup.visible = false;
  scene.add(bossGroup);
}

export function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (k === 'f') {
      state.flashlightOn = !state.flashlightOn;
      flashlight.intensity = state.flashlightOn ? 10 : 0;
      const el = document.getElementById('fl-status');
      if (el) el.textContent = state.flashlightOn ? 'ON' : 'OFF';
    }
  });

  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.getElementById('gl-canvas') || document.pointerLockElement === document.body) {
      player.rotation.y -= e.movementX * 0.003;
    }
  });

  window.addEventListener('click', onStrike);
}

function onStrike() {
  if (state.phase === 'cutscene') return;

  if (state.phase === 'tutorial' && dummyMesh) {
    if (player.position.distanceTo(dummyMesh.position) < 4) {
      state.dummyHits++;
      dummyMesh.rotation.x = 0.2;
      setTimeout(() => dummyMesh.rotation.x = 0, 100);

      if (state.dummyHits >= 5 && callbacks.onDummyComplete) {
        callbacks.onDummyComplete();
      }
    }
  } else if (state.phase === 'arena' && enemyMesh) {
    if (player.position.distanceTo(enemyMesh.position) < 4) {
      enemyMesh.position.z -= 2;
      if (enemyMesh.position.z < -25 && callbacks.onEnemyDefeated) {
        callbacks.onEnemyDefeated();
      }
    }
  } else if (state.phase === 'boss' && krakenMesh) {
    if (callbacks.onBossDefeated) {
      callbacks.onBossDefeated();
    }
  }
}

export function setPhase(p) { state.phase = p; }
export function setShipVisibility(v) { shipGroup.visible = v; }
export function setDungeonVisibility(v) { dungeonGroup.visible = v; }
export function setBossArenaVisibility(v) { bossGroup.visible = v; }

export function spawnEnemy(lvl) {
  if (enemyMesh) {
    enemyMesh.position.set((Math.random() - 0.5) * 10, 1, -6 - Math.random() * 5);
  }
}

export function spawnShadowTentacle() {
  if (shadowTentacleMesh && callbacks.onTentacleSeen) {
    shadowTentacleMesh.position.x = (Math.random() - 0.5) * 20;
    callbacks.onTentacleSeen();
  }
}

export function spawnKraken() {
  if (krakenMesh) krakenMesh.position.set(0, 0, -20);
}

export function triggerStorm(duration) {
  let count = 0;
  const interval = setInterval(() => {
    scene.fog.color.setHex(count % 2 === 0 ? 0x333b4d : 0x0e1118);
    count++;
    if (count > 10) {
      clearInterval(interval);
      scene.fog.color.setHex(0x0e1118);
    }
  }, duration / 10);
}

export function updateHUD() {
  const zd = document.getElementById('zone-display');
  const pd = document.getElementById('prize-display');
  const hb = document.getElementById('health-bar');

  if (zd) zd.textContent = state.phase === 'tutorial' ? 'ZONE: SHIP DECK' : `ZONE: ARENA LEVEL ${state.level} / 100`;
  if (pd) pd.textContent = 'PRIZE: $10,000,000';
  if (hb) hb.style.width = `${state.hp}%`;
}

export function resetGame() {
  state.hp = 100;
  state.level = 0;
  state.dummyHits = 0;
  player.position.set(0, 1.6, 5);
  player.rotation.set(0, 0, 0);
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

  if (state.phase !== 'cutscene') {
    const speed = 4.5 * delta;
    if (keys['w']) player.translateZ(-speed);
    if (keys['s']) player.translateZ(speed);
    if (keys['a']) player.translateX(-speed);
    if (keys['d']) player.translateX(speed);

    if (state.phase === 'boss' && krakenMesh) {
      krakenMesh.position.y = Math.sin(time * 2) * 0.5;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
