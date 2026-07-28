/* 10,000,000 - ENGINE & KRAKEN BOSS CODE */

const state = {
  screen: 'title',
  hp: 100,
  hits: 0,
  inTutorial: true,
  inKrakenBoss: false,
  krakenHp: 100,
  eventTriggered: false
};

const hudHp = document.getElementById('hud-hp');
const hudHits = document.getElementById('hud-hits');
const hudZone = document.getElementById('hud-zone');
const screenTitle = document.getElementById('screen-title');

let scene, camera, renderer;
let player, opponent, npc, wallTentacle, krakenBoss;
let keys = {};
let clock = new THREE.Clock();

function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050403, 0.08);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth / 2, window.innerHeight / 2, false);
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0x221c16, 1.2);
  scene.add(ambient);

  const torchLight = new THREE.PointLight(0xd92b2b, 1.5, 12);
  torchLight.position.set(0, 3, 0);
  scene.add(torchLight);

  buildDungeonEnvironment();
  createPlayer();
  createOpponent();
  createNPC();
  createWallTentacle();

  window.addEventListener('resize', onWindowResize);
  setupControls();
}

function buildDungeonEnvironment() {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x161310, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Ceiling
  const ceiling = floor.clone();
  ceiling.position.y = 5;
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.8 });
  
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 1), wallMat);
  backWall.position.set(0, 2.5, -20);
  scene.add(backWall);

  const frontWall = backWall.clone();
  frontWall.position.z = 20;
  scene.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 40), wallMat);
  leftWall.position.set(-15, 2.5, 0);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 40), wallMat);
  rightWall.position.set(15, 2.5, 0);
  scene.add(rightWall);
}

function createPlayer() {
  player = new THREE.Group();
  player.position.set(0, 1.6, 10);
  scene.add(player);
  player.add(camera);
}

function createOpponent() {
  opponent = new THREE.Group();
  
  const bodyGeo = new THREE.BoxGeometry(0.8, 1.8, 0.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a3030 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  opponent.add(body);

  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc9c2ab });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.0;
  opponent.add(head);

  opponent.position.set(0, 0, 2);
  scene.add(opponent);
}

function createNPC() {
  npc = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.5), bodyMat);
  body.position.y = 0.85;
  npc.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x8f8975 }));
  head.position.y = 1.9;
  npc.add(head);

  npc.position.set(12, 0, -8);
  scene.add(npc);
}

function createWallTentacle() {
  wallTentacle = new THREE.Group();
  const segmentCount = 6;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f5c66, roughness: 0.3 });

  for (let i = 0; i < segmentCount; i++) {
    const radius = 0.35 - (i * 0.04);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.05, 0.8, 8), mat);
    seg.position.y = i * 0.7;
    wallTentacle.add(seg);
  }

  wallTentacle.position.set(16, 1.5, -8);
  wallTentacle.rotation.z = Math.PI / 2;
  scene.add(wallTentacle);
}

// Spawn Giant Kraken Boss Entity
function spawnKrakenBoss() {
  krakenBoss = new THREE.Group();
  const krakenMat = new THREE.MeshStandardMaterial({ color: 0x123138, roughness: 0.4 });

  // Kraken Head/Mantle
  const headGeo = new THREE.SphereGeometry(3, 16, 16);
  const head = new THREE.Mesh(headGeo, krakenMat);
  head.position.y = 3;
  krakenBoss.add(head);

  // Glowing Eye
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd92b2b });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), eyeMat);
  eye.position.set(0, 3, 2.8);
  krakenBoss.add(eye);

  // Massive Boss Tentacles
  for (let i = 0; i < 4; i++) {
    const tGroup = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.4 - j*0.06, 0.5 - j*0.06, 1.2, 8), krakenMat);
      seg.position.y = j * 1.0;
      tGroup.add(seg);
    }
    tGroup.position.set((i - 1.5) * 2.5, 0, 1.5);
    krakenBoss.add(tGroup);
  }

  krakenBoss.position.set(0, 0, -12);
  scene.add(krakenBoss);
}

function setupControls() {
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === document.body) {
      player.rotation.y -= e.movementX * 0.003;
    }
  });

  window.addEventListener('click', () => {
    if (state.screen === 'game') {
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      } else {
        registerStrike();
      }
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth / 2, window.innerHeight / 2, false);
}

function updateGameLoop() {
  const delta = clock.getDelta();

  if (state.screen === 'game') {
    const speed = 4.0 * delta;
    if (keys['w']) player.translateZ(-speed);
    if (keys['s']) player.translateZ(speed);
    if (keys['a']) player.translateX(-speed);
    if (keys['d']) player.translateX(speed);

    player.position.x = Math.max(-13, Math.min(13, player.position.x));
    player.position.z = Math.max(-18, Math.min(18, player.position.z));

    if (opponent && state.inTutorial) {
      opponent.lookAt(player.position.x, opponent.position.y, player.position.z);
    }

    // Animate Kraken Boss
    if (krakenBoss && state.inKrakenBoss) {
      krakenBoss.position.y = Math.sin(clock.getElapsedTime() * 2) * 0.5;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(updateGameLoop);
}

document.getElementById('btn-start').onclick = () => {
  screenTitle.classList.add('hidden');
  startStoryIntro();
};
