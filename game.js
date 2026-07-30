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

let scene, camera, renderer, player, flashlight, lanternLight;
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

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const ambient = new THREE.AmbientLight(0xffebd2, 0.6);
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

    const beam = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.4, 0.5), woodDark);
    beam.position.set(0, 4.1, z);
    shipGroup.add(beam);
  }

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallLeft.position.set(-6.8, 2, 0);
  shipGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 20), woodDark);
  wallRight.position.set(6.8, 2, 0);
  shipGroup.add(wallRight);

  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.4), woodDark);
  wallBack.position.set(0, 2, -10);
  shipGroup.add(wallBack);

  lanternLight = new THREE.PointLight(0xffa542, 3.5, 18, 1.5);
  lanternLight.position.set(0, 3.6, -2);
  shipGroup.add(lanternLight);

  const lanternGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8);
  const lanternMesh = new THREE.Mesh(lanternGeo, ironMat);
  lanternMesh.position.set(0, 3.8, -2);
  shipGroup.add(lanternMesh);

  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), woodLight);
    crate.position.set(-4.8 + (i % 2) * 1.3, 0.6, -7 + Math.floor(i / 2) * 1.3);
    shipGroup.add(crate);
  }

  const barrelGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12);
  const barrel = new THREE.Mesh(barrelGeo, woodDark);
  barrel.position.set(5.2, 0.7, -6);
  shipGroup.add(barrel);

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

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), clothMat);
  head.position.y = 2.35;
  dummyMesh.add(head);

  const arms = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.2), woodDark);
  arms.position.y = 1.8;
  dummyMesh.add(arms);

  dummyMesh.position.set(0, 0, -3);
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
  const canvas = document.getElementById('gl-canvas');

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

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
  });

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas || document.pointerLockElement === document.body) {
      player.rotation.y -= e.movementX * 0.003;
    }
  });

  // Canvas Click Handler: Locks mouse & guarantees keyboard focus
  canvas.addEventListener('click', () => {
    window.focus();
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
      dummyMesh.rotation.z = 0.15;
      setTimeout(() => dummyMesh.rotation.z = 0, 120);

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

  if (lanternLight && shipGroup.visible) {
    lanternLight.intensity = 3.2 + Math.sin(time * 12) * 0.3;
  }

  // Active player movement logic
  if (state.phase === 'tutorial' || state.phase === 'arena' || state.phase === 'boss') {
    const speed = 5.0 * delta;
    if (keys['w'] || keys['arrowup']) player.translateZ(-speed);
    if (keys['s'] || keys['arrowdown']) player.translateZ(speed);
    if (keys['a'] || keys['arrowleft']) player.translateX(-speed);
    if (keys['d'] || keys['arrowright']) player.translateX(speed);
    

    if (state.phase === 'tutorial') {
      player.position.x = Math.max(-5.5, Math.min(5.5, player.position.x));
      player.position.z = Math.max(-8.5, Math.min(8.5, player.position.z));
    }

    if (state.phase === 'boss' && krakenMesh) {
      krakenMesh.position.y = Math.sin(time * 2) * 0.5;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
