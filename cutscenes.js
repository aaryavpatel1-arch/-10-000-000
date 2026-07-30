import {
  initEngine, setupInput, state, callbacks,
  setPhase, setShipVisibility, setDungeonVisibility, setBossArenaVisibility,
  spawnEnemy, spawnShadowTentacle, spawnKraken, triggerStorm, startCinematicCam,
  updateHUD, resetGame
} from './game.js';
import * as THREE from 'three';

let dialogueOverlay, dialogueTitle, dialogueText, dialogueBtn;
let hud, startScreen;
let dialogueQueue = [];
let pendingContinue = null;
let targetPhaseAfterDialogue = 'tutorial';

export function initGame() {
  dialogueOverlay = document.getElementById('dialogue-overlay');
  dialogueTitle = document.getElementById('dialogue-title');
  dialogueText = document.getElementById('dialogue-text');
  dialogueBtn = document.getElementById('dialogue-btn');
  hud = document.getElementById('hud');
  startScreen = document.getElementById('start-screen');

  if (dialogueBtn) {
    dialogueBtn.removeEventListener('click', onDialogueContinue);
    dialogueBtn.addEventListener('click', onDialogueContinue);
  }

  initEngine();
  setupInput();

  callbacks.onDummyComplete = onTutorialComplete;
  callbacks.onEnemyDefeated = onEnemyDefeated;
  callbacks.onPlayerDead = onPlayerDead;
  callbacks.onTentacleSeen = onTentacleSeen;
  callbacks.onAllTentaclesDead = onAllTentaclesDead;
  callbacks.onBossDefeated = onBossDefeated;

  if (startScreen) startScreen.style.display = 'none';
  if (hud) hud.classList.remove('hidden');

  beginTutorial();
}

function showDialogue(title, text) {
  setPhase('cutscene');
  if (dialogueTitle) dialogueTitle.textContent = title;
  if (dialogueText) dialogueText.textContent = text;
  if (dialogueOverlay) dialogueOverlay.classList.remove('hidden');
  try { document.exitPointerLock(); } catch (e) {}
}

function hideDialogue() {
  if (dialogueOverlay) dialogueOverlay.classList.add('hidden');
  window.focus();
}

function onDialogueContinue() {
  if (state.phase !== 'cutscene') return;

  if (dialogueQueue.length > 0) {
    const next = dialogueQueue.shift();
    showDialogue(next.title, next.text);
    if (next.onShow) next.onShow();
  } else {
    hideDialogue();
    setPhase(targetPhaseAfterDialogue);

    const canvas = document.getElementById('gl-canvas');
    if (canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (e) {}
    }

    if (pendingContinue) {
      const cb = pendingContinue;
      pendingContinue = null;
      cb();
    }
  }
}

function queueDialogues(list, onDone) {
  dialogueQueue = [...list];
  pendingContinue = onDone;
  if (dialogueQueue.length > 0) {
    const first = dialogueQueue.shift();
    showDialogue(first.title, first.text);
    if (first.onShow) first.onShow();
  }
}

function beginTutorial() {
  targetPhaseAfterDialogue = 'tutorial';
  setShipVisibility(true);
  setDungeonVisibility(false);
  setBossArenaVisibility(false);
  state.dummyHits = 0;
  state.tutorialComplete = false;
  state.hp = 100;
  state.level = 0;
  updateHUD();

  // Cinematic Camera Pan across ship
  startCinematicCam(new THREE.Vector3(0, 2.5, 2), new THREE.Vector3(0, 1.2, -3), 2.5);

  showDialogue(
    'TUTORIAL: SHIP DECK', 
    'You are below deck of the merchant vessel Sable Crown. Use WASD to move and CLICK or SPACE near the sparring dummy to strike it 5 times.'
  );
  
  pendingContinue = () => {
    setPhase('tutorial');
    updateHUD();
  };
  dialogueQueue = [];
}

function onTutorialComplete() {
  setPhase('cutscene');
  try { document.exitPointerLock(); } catch (e) {}
  triggerStorm(3000);

  // Cinematic Ship Sinking Motion
  startCinematicCam(new THREE.Vector3(0, 4, -1), new THREE.Vector3(0, 0, -8), 3);

  setTimeout(() => {
    targetPhaseAfterDialogue = 'arena';
    queueDialogues([
      {
        title: 'WASHED UP',
        text: 'A rogue wave shatters the hull. You wash ashore into a foggy, hostile maze. Shadow lurkers stalk the darkness.'
      },
      {
        title: 'THE $10,000,000 CONTRACT',
        text: 'A shadowy broker offers a deadly contract: survive a hundred arena sectors, defeat the lurkers, and claim the prize.'
      }
    ], () => {
      setShipVisibility(false);
      beginArena();
    });
  }, 2800);
}

function beginArena() {
  targetPhaseAfterDialogue = 'arena';
  setPhase('arena');
  setDungeonVisibility(true);
  state.level = 1;
  nextArenaLevel();
  updateHUD();
}

function nextArenaLevel() {
  if (state.level > 99) {
    startBossPhase();
    return;
  }
  spawnEnemy(state.level);

  if (state.level <= 99) {
    spawnShadowTentacle();
  }

  updateHUD();
}

function onEnemyDefeated() {
  if (state.level >= 99) {
    targetPhaseAfterDialogue = 'boss';
    startCinematicCam(new THREE.Vector3(0, 10, -5), new THREE.Vector3(0, 0, -20), 3.5);
    showDialogue(
      'LEVEL 100: THE ABYSS GATEWAY', 
      'The arena floor drops away into a subterranean ocean pit. Something vast breaches the surface.'
    );
    pendingContinue = () => {
      startBossPhase();
    };
    dialogueQueue = [];
    return;
  }

  state.level++;
  nextArenaLevel();
}

function onTentacleSeen() {
  const hint = document.getElementById('top-hint');
  if (hint) {
    hint.textContent = 'DID SOMETHING MOVE IN THE SHADOWS?';
    setTimeout(() => { 
      if (hint) hint.textContent = 'WASD to MOVE | CLICK or SPACE to STRIKE'; 
    }, 3500);
  }
}

function startBossPhase() {
  targetPhaseAfterDialogue = 'boss';
  setPhase('boss');
  setDungeonVisibility(false);
  setBossArenaVisibility(true);
  spawnKraken();
  updateHUD();

  startCinematicCam(new THREE.Vector3(0, 6, 8), new THREE.Vector3(0, 2, -20), 4);
}

function onAllTentaclesDead() {
  targetPhaseAfterDialogue = 'boss';
  showDialogue(
    'THE CORE IS EXPOSED', 
    "All six tentacles collapse into twitching ruin. The Kraken's crimson eye boils with rage. Strike the core now before it recovers!"
  );
  pendingContinue = () => {
    setPhase('boss');
  };
  dialogueQueue = [];
}

function onBossDefeated() {
  targetPhaseAfterDialogue = 'tutorial';
  showDialogue(
    'CONTRACT COMPLETE', 
    'The beast sinks into the black water. The syndicate broker steps from the shadows and hands you the glowing briefcase.'
  );
  pendingContinue = () => {
    resetGame();
    beginTutorial();
  };
  dialogueQueue = [];
}

function onPlayerDead() {
  targetPhaseAfterDialogue = 'tutorial';
  showDialogue('KNOCKED OUT', 'The shadow lurker overwhelmed you. Arena medics drag you back to safety.');
  pendingContinue = () => {
    resetGame();
    beginTutorial();
  };
  dialogueQueue = [];
}
