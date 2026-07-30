import {
  initEngine, setupInput, state, callbacks,
  setPhase, setShipVisibility, setDungeonVisibility, setBossArenaVisibility,
  spawnEnemy, spawnShadowTentacle, spawnKraken, triggerStorm,
  updateHUD, resetGame
} from './game.js';

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

// ===== DIALOGUE SYSTEM =====
function showDialogue(title, text) {
  setPhase('cutscene');
  if (dialogueTitle) dialogueTitle.textContent = title;
  if (dialogueText) dialogueText.textContent = text;
  if (dialogueOverlay) dialogueOverlay.classList.remove('hidden');
  try { document.exitPointerLock(); } catch (e) { /* ignore pointer lock errors */ }
}

function hideDialogue() {
  if (dialogueOverlay) dialogueOverlay.classList.add('hidden');
}

function onDialogueContinue() {
  if (state.phase !== 'cutscene') return;

  if (dialogueQueue.length > 0) {
    const next = dialogueQueue.shift();
    showDialogue(next.title, next.text);
    if (next.onShow) next.onShow();
  } else {
    hideDialogue();
    // Restore playable phase so WASD movement works
    setPhase(targetPhaseAfterDialogue);

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

// ===== TUTORIAL =====
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

  showDialogue(
    'TUTORIAL: SHIP DECK', 
    'You are below deck of the merchant vessel Sable Crown. Use WASD to move and CLICK or SPACE near the sparring dummy to strike it 5 times.'
  );
  
  pendingContinue = () => {
    setPhase('tutorial');
    const canvas = document.getElementById('gl-canvas');
    if (canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch(e) {}
    }
    updateHUD();
  };
  dialogueQueue = [];
}

function onTutorialComplete() {
  setPhase('cutscene');
  try { document.exitPointerLock(); } catch (e) {}
  triggerStorm(2500);

  setTimeout(() => {
    targetPhaseAfterDialogue = 'arena';
    queueDialogues([
      {
        title: 'WASHED UP',
        text: 'A rogue wave shatters the hull. You wash ashore into a foggy, hostile world. Prepare yourself for the arena.'
      },
      {
        title: 'THE $10,000,000 CONTRACT',
        text: 'A shadowy broker offers a deadly contract: survive a hundred arena sectors and claim the prize.'
      }
    ], () => {
      setShipVisibility(false);
      beginArena();
    });
  }, 2500);
}

// ===== ARENA =====
function beginArena() {
  targetPhaseAfterDialogue = 'arena';
  setPhase('arena');
  setDungeonVisibility(true);
  state.level = 1;
  nextArenaLevel();
  updateHUD();

  const canvas = document.getElementById('gl-canvas');
  if (canvas && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch(e) {}
  }
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
      if (hint) hint.textContent = 'CLICK or SPACE to STRIKE'; 
    }, 3500);
  }
}

// ===== BOSS =====
function startBossPhase() {
  targetPhaseAfterDialogue = 'boss';
  setPhase('boss');
  setDungeonVisibility(false);
  setBossArenaVisibility(true);
  spawnKraken();
  updateHUD();

  const canvas = document.getElementById('gl-canvas');
  if (canvas && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch(e) {}
  }
}

function onAllTentaclesDead() {
  targetPhaseAfterDialogue = 'boss';
  showDialogue(
    'THE CORE IS EXPOSED', 
    "All six tentacles collapse into twitching ruin. The Kraken's crimson eye boils with rage. Strike the core now before it recovers!"
  );
  pendingContinue = () => {
    setPhase('boss');
    const canvas = document.getElementById('gl-canvas');
    if (canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch(e) {}
    }
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

// ===== DEATH / RESET =====
function onPlayerDead() {
  targetPhaseAfterDialogue = 'tutorial';
  showDialogue('KNOCKED OUT', 'You collapse in the dust. Arena medics drag you to the infirmary.');
  pendingContinue = () => {
    resetGame();
    beginTutorial();
  };
  dialogueQueue = [];
}
