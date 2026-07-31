import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export const state = {
  phase: 'start',
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
  onPlayerDead: null,
  onTentacleSeen: null,
  onBossDefeated: null
};

let scene, camera, renderer;
let flashlight, ambientLight, sunLight;
let clock = new THREE.Clock();
let keys = {};

const groups = { ship: null, dungeon: null, boss: null, player: null };
const entities = {
  dummy: null,
  captain: null,
  ghostCaptain: null,
  chores: [],
  enemies: [],
  projectiles: [],
  pickups: [],
  tentacle: null,
  kraken: null,
  ladder: null,
  livingWall: null
};

const colliders = [];

const cutsceneState = {
  sequence: [],
  index: 0,
  progress: 0,
  onComplete: null,
  camStartPos: new THREE.Vector3(),
  camStartLook: new THREE.Vector3(),
  currentLookTarget: new THREE.Vector3()
};

let tentacleTimer = Math.random() * 15 + 10;
let livingWallState = { triggered: false, progress: 0 };
let pitch = 0;
let captainText = "Welcome aboard, boy!";

// Flashlight Spam Detection
let flashlightToggles = [];

export function initEngine() {
  const canvas = document.getElementById('gl-canvas');
  scene = new THREE.Scene();

  const skyColor = 0xa0c4ff;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, 0.002);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(skyColor, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  sunLight.position.set(10, 20, 10);
  scene.add(sunLight);

  setupPlayerAndFlashlight();
  setupShipDeck();
  setupDungeonMaze();
  setupBossArena();

  setupInput();
  window.addEventListener('resize', onResize);
  animate();
}

function setupPlayerAndFlashlight() {
  groups.player = new THREE.Group();
  groups.player.position.set(0, 1.6, 5);
  scene.add(groups.player);

  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  groups.player.add(camera);

  flashlight = new THREE.SpotLight(0xffffff, 0, 32, Math.PI / 4, 0.3, 1);
  flashlight.position.set(0, 0, 0);

  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -5);
  camera.add(flashTarget);
  flashlight.target = flashTarget;

  camera.add(flashlight);
}

function setupShipDeck() {
  groups.ship = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6e4327, roughness: 0.5 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0xa66e38, roughness: 0.4 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 });
  const captainMat = new THREE.MeshStandardMaterial({ color: 0x1b263b, roughness: 0.5 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 22), woodDark);
  floor.position.y = -0.2;
  groups.ship.add(floor);

  for (let z = -9; z <= 9; z += 3) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribL.position.set(-7.5, 2, z);
    ribL.rotation.z = -0.15;
    groups.ship.add(ribL);

    const ribR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 0.6), woodLight);
    ribR.position.set(7.5, 2, z);
    ribR.rotation.z = 0.15;
    groups.ship.add(ribR);
  }

  // Captain NPC
  entities.captain = new THREE.Group();
  const capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 12), captainMat);
  capBody.position.y = 0.8;
  entities.captain.add(capBody);

  const capHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), woodLight);
  capHead.position.y = 1.8;
  entities.captain.add(capHead);

  const capHat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.25, 12), ironMat);
  capHat.position.y = 2.1;
  entities.captain.add(capHat);

  entities.captain.position.set(-2, 0, -1);
  groups.ship.add(entities.captain);

  // Training Dummy
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

  entities.dummy.position.set(2, 0, -3);
  groups.ship.add(entities.dummy);

  // Chores (Crates)
  for (let c = 0; c < 3; c++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), woodLight);
    crate.position.set(-3 + c * 1.5, 0.4, 1);
    groups.ship.add(crate);
    entities.chores.push(crate);
  }

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

  const mapSize = 60;
  const wallHeight = 5;

  const perimeterWalls = [
    { pos: [0, wallHeight / 2, -mapSize / 2], size: [mapSize, wallHeight, 1.0] },
    { pos: [0, wallHeight / 2, mapSize / 2], size: [mapSize, wallHeight, 1.0] },
    { pos: [-mapSize / 2, wallHeight / 2, 0], size: [1.0, wallHeight, mapSize] },
    { pos: [mapSize / 2, wallHeight / 2, 0], size: [1.0, wallHeight, mapSize] }
  ];

  perimeterWalls.forEach(p => {
    const pWall = new THREE.Mesh(new THREE.BoxGeometry(...p.size), wallMat);
    pWall.position.set(...p.pos);
    groups.dungeon.add(pWall);
    colliders.push(new THREE.Box3().setFromObject(pWall));
  });

  // MAZE WALLS WITH BALANCED HITBOX SIZING
  for (let i = -24; i <= 24; i += 8) {
    for (let j = -24; j <= 24; j += 8) {
      if ((Math.abs(i) > 4 || Math.abs(j) > 4) && Math.random() > 0.35) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.5, 3.8), wallMat);
        wall.position.set(i, 2.25, j);
        groups.dungeon.add(wall);
        colliders.push(new THREE.Box3().setFromObject(wall));
      }
    }
  }

  entities.livingWall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.5, 1.0), wallMat);
  entities.livingWall.position.set(0, 2.25, -6);
  groups.dungeon.add(entities.livingWall);
  colliders.push(new THREE.Box3().setFromObject(entities.livingWall));

  entities.tentacle = new THREE.Group();
  const tentacleMat = new THREE.MeshStandardMaterial({ color: 0x020a0d, roughness: 0.1 });

  for (let s = 0; s < 14; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.6 - s * 0.035, 0.7 - s * 0.035, 1.0, 12), tentacleMat);
    seg.position.z = s * 0.9;
    seg.name = `gt_seg_${s}`;
    entities.tentacle.add(seg);
  }

  entities.tentacle.position.set(0, 1.6, -6.5);
  entities.tentacle.visible = false;
  groups.dungeon.add(entities.tentacle);

  // SETUP GHOST CAPTAIN MODEL
  setupGhostCaptain();

  spawnLadder();

  groups.dungeon.visible = false;
  scene.add(groups.dungeon);
}

function setupGhostCaptain() {
  entities.ghostCaptain = new THREE.Group();

  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x113333, wireframe: true, transparent: true, opacity: 0.75 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 1.8, 10), ghostMat);
  body.position.y = 0.9;
  entities.ghostCaptain.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), ghostMat);
  head.position.y = 2.0;
  entities.ghostCaptain.add(head);

  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.3, 10), ghostMat);
  hat.position.y = 2.3;
  entities.ghostCaptain.add(hat);

  // Glowing white ghostly eyes
  [-0.12, 0.12].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eye.position.set(x, 2.05, -0.28);
    entities.ghostCaptain.add(eye);
  });

  entities.ghostCaptain.visible = false;
  groups.dungeon.add(entities.ghostCaptain);
}

function triggerGhostCaptainJumpscare() {
  if (!entities.ghostCaptain || state.phase !== 'arena') return;

  // Position ghost directly in front of camera
  const forward = new THREE.Vector3(0, 0, -2.5).applyQuaternion(camera.quaternion);
  entities.ghostCaptain.position.copy(groups.player.position).add(forward);
  entities.ghostCaptain.position.y = 0.2;
  entities.ghostCaptain.lookAt(groups.player.position);

  entities.ghostCaptain.visible = true;

  showBanner("THE CAPTAIN'S SPIRIT IS WATCHING YOU...", 3500);

  setTimeout(() => {
    if (entities.ghostCaptain) entities.ghostCaptain.visible = false;
  }, 2500);
}

function spawnLadder() {
  if (entities.ladder) {
    groups.dungeon.remove(entities.ladder);
  }

  entities.ladder = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xa66e38, roughness: 0.5 });

  const leftRail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5), woodMat);
  leftRail.position.set(-0.4, 2.25, 0);
  entities.ladder.add(leftRail);

  const rightRail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5), woodMat);
  rightRail.position.set(0.4, 2.25, 0);
  entities.ladder.add(rightRail);

  for (let r = 0.5; r <= 4.0; r += 0.5) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), woodMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, r, 0);
    entities.ladder.add(rung);
  }

  const randX = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 12);
  const randZ = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 12);

  entities.ladder.position.set(randX, 0, randZ);
  groups.dungeon.add(entities.ladder);
}

function interactWithLadder() {
  if (!entities.ladder || state.phase !== 'arena') return;

  const playerPos = groups.player.position;
  const dist = playerPos.distanceTo(entities.ladder.position);

  if (dist < 3.0) {
    const ladderBreaks = Math.random() < 0.30;

    if (ladderBreaks) {
      showBanner("The ladder broke! Search the maze for another one!", 4000);
      spawnLadder();
    } else {
      state.level++;
      updateHUD();
      showBanner(`Advanced to Level ${state.level}!`, 3000);
      
      groups.player.position.set(0, 1.6, 5);
      spawnEnemiesForLevel(state.level);
      spawnLadder();
    }
  }
}

function showBanner(msg, duration = 3000) {
  const banner = document.getElementById('banner-message');
  if (banner) {
    banner.textContent = msg;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, duration);
  }
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

  entities.kraken.position.set(0, 0, -22);
  groups.boss.add(entities.kraken);

  groups.boss.visible = false;
  scene.add(groups.boss);
}

export function setCaptainSpeech(text) {
  captainText = text;
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

function update3DSpeechBubble() {
  const bubble = document.getElementById('captain-bubble');
  if (!bubble || !entities.captain || !groups.ship.visible || !captainText) {
    if (bubble) bubble.style.display = 'none';
    return;
  }

  const captainPos = new THREE.Vector3();
  entities.captain.getWorldPosition(captainPos);
  captainPos.y += 2.6;

  const screenPos = captainPos.clone().project(camera);

  if (screenPos.z < 1) {
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.style.display = 'block';
  } else {
    bubble.style.display = 'none';
  }
}

export function spawnEnemiesForLevel(count = 2) {
  entities.enemies.forEach(e => groups.dungeon.remove(e.mesh));
  entities.enemies = [];

  for (let i = 0; i < count; i++) {
    const stalkerGroup = new THREE.Group();

    const entityMat = new THREE.MeshBasicMaterial({ color: 0x050505, wireframe: true });
    const glowEyeMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 2.6, 6), entityMat);
    torso.position.y = 1.6;
    torso.rotation.z = 0.1;
    stalkerGroup.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), entityMat);
    head.position.set(0.1, 3.0, 0.05);
    stalkerGroup.add(head);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), glowEyeMat);
    eye.position.set(0.1, 3.0, -0.18);
    stalkerGroup.add(eye);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 2.2), entityMat);
    leftArm.position.set(-0.35, 1.7, 0);
    leftArm.rotation.z = 0.25;
    stalkerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 2.8), entityMat);
    rightArm.position.set(0.4, 1.4, 0.1);
    rightArm.rotation.z = -0.15;
    stalkerGroup.add(rightArm);

    const angle = Math.random() * Math.PI * 2;
    const distance = 16 + Math.random() * 10;
    stalkerGroup.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);

    groups.dungeon.add(stalkerGroup);
    entities.enemies.push({ mesh: stalkerGroup, hp: 60, speed: 1.8, jitterTime: Math.random() * 10 });
  }
}

export function enableHorrorAtmosphere() {
  const darkFog = 0x030406;
  scene.background.setHex(darkFog);
  scene.fog = new THREE.FogExp2(darkFog, 0.055);
  renderer.setClearColor(darkFog, 1);
  ambientLight.color.setHex(0x1a202c);
  ambientLight.intensity = 0.15;
  if (sunLight) sunLight.intensity = 0;
}

// ACCURATE & SLIDING COLLISION SYSTEM
function checkCollisions(newPosition) {
  if (!groups.dungeon.visible) return false;
  const playerRadius = 0.15; // Tightened hitbox
  const playerBox = new THREE.Box3(
    new THREE.Vector3(newPosition.x - playerRadius, 0.4, newPosition.z - playerRadius),
    new THREE.Vector3(newPosition.x + playerRadius, 1.8, newPosition.z + playerRadius)
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
      flashlight.intensity = state.flashlightOn ? 25 : 0;
      updateHUD();

      // Track spam toggles
      const now = Date.now();
      flashlightToggles.push(now);
      flashlightToggles = flashlightToggles.filter(t => now - t < 2500);

      if (flashlightToggles.length >= 5) {
        triggerGhostCaptainJumpscare();
        flashlightToggles = [];
      }
    }

    if (e.key.toLowerCase() === 'e') {
      if (state.phase === 'tutorial') {
        entities.chores.forEach((crate) => {
          if (groups.player.position.distanceTo(crate.position) < 2.5 && crate.visible !== false) {
            crate.visible = false;
            state.choresDone++;
            if (state.choresDone >= 3 && callbacks.onChoresComplete) {
              callbacks.onChoresComplete();
            }
          }
        });
      } else if (state.phase === 'arena') {
        interactWithLadder();
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
        if (enemy.hp <= 0) {
          groups.dungeon.remove(enemy.mesh);
          entities.enemies.splice(index, 1);
        }
      }
    });
  }
}

export function startCinematicSequence(keyframes, onComplete) {
  state.phase = 'cutscene';
  cutsceneState.sequence = keyframes;
  cutsceneState.index = 0;
  cutsceneState.progress = 0;
  cutsceneState.onComplete = onComplete;
  cutsceneState.camStartPos.copy(camera.position);
  cutsceneState.camStartLook.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
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
      enableHorrorAtmosphere();
      if (callbacks.onShipCrash) callbacks.onShipCrash();
    }
  }, duration / 16);
}

export function setPhase(p) { state.phase = p; }
export function setShipVisibility(v) { groups.ship.visible = v; }
export function setDungeonVisibility(v) { groups.dungeon.visible = v; }

export function updateHUD() {
  const zd = document.getElementById('zone-display');
  const hb = document.getElementById('health-bar');
  const flStatus = document.getElementById('fl-status');

  if (zd) zd.textContent = state.phase === 'tutorial' ? 'SHIP DECK' : `LEVEL ${state.level} / 100`;
  if (hb) hb.style.width = `${Math.max(0, state.hp)}%`;
  if (flStatus) flStatus.textContent = `${state.flashlightOn ? 'ON' : 'OFF'}`;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = clock.getDelta();

  update3DSpeechBubble();

  // BACKROOMS ENTITY STALKING & JITTER ANIMATION
  if (groups.dungeon.visible && state.phase === 'arena') {
    entities.enemies.forEach(enemy => {
      enemy.jitterTime += delta * 12.0;

      enemy.mesh.rotation.y = Math.sin(enemy.jitterTime * 0.5) * 0.15;
      enemy.mesh.position.y = Math.sin(enemy.jitterTime * 2.0) * 0.05;

      const dirToPlayer = new THREE.Vector3().subVectors(groups.player.position, enemy.mesh.position);
      dirToPlayer.y = 0;

      if (dirToPlayer.length() > 2.0) {
        dirToPlayer.normalize();
        enemy.mesh.position.addScaledVector(dirToPlayer, enemy.speed * delta);
      }
    });

    tentacleTimer -= delta;
    if (tentacleTimer <= 0 && !livingWallState.triggered) {
      livingWallState.triggered = true;
      entities.tentacle.visible = true;
      livingWallState.progress = 0;
    }

    if (livingWallState.triggered) {
      livingWallState.progress += delta * 2.0;

      if (livingWallState.progress < 2.5) {
        entities.livingWall.position.y = THREE.MathUtils.lerp(2.25, -2.5, livingWallState.progress / 2.5);
      } else if (livingWallState.progress >= 2.5 && livingWallState.progress < 5.0) {
        const retractT = (livingWallState.progress - 2.5) / 2.5;
        entities.tentacle.position.z = THREE.MathUtils.lerp(-6.5, -16.0, retractT);
      } else {
        entities.livingWall.position.y = 2.25;
        entities.tentacle.visible = false;
        livingWallState.triggered = false;
        tentacleTimer = Math.random() * 20 + 15;
      }
    }
  }

  // Camera cutscenes
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
        
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        pitch = 0;
        camera.updateProjectionMatrix();

        if (cutsceneState.onComplete) cutsceneState.onComplete();
      }
    }
  }

  // Smooth WASD Movement with Axis Sliding
  if (['tutorial', 'arena'].includes(state.phase)) {
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

      // Smooth wall sliding check
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
