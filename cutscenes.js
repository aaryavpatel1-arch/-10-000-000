import {
  initEngine, setupInput, state, callbacks,
  setPhase, setShipVisibility, setDungeonVisibility, setBossArenaVisibility,
  spawnEnemy, spawnShadowTentacle, spawnKraken, triggerStorm,
  updateHUD, resetGame
} from './engine.js';

let dialogueOverlay, dialogueTitle, dialogueText, dialogueBtn;
let hud, startScreen;
let dialogueQueue = [];
let pendingContinue = null;

export function initGame() {
  dialogueOverlay = document.getElementById('dialogue-overlay');
  dialogueTitle = document.getElementById('dialogue-title');
  dialogueText = document.getElementById('dialogue-text');
  dialogueBtn = document.getElementById('dialogue-btn');
  hud = document.getElementById('hud');
  startScreen = document.getElementById('start-screen');

  dialogueBtn.addEventListener('click', onDialogueContinue);

  initEngine();
  setupInput();

  callbacks.onDummyComplete = onTutorialComplete;
  callbacks.onEnemyDefeated = onEnemyDefeated;
  callbacks.onPlayerDead = onPlayerDead;
  callbacks.onTentacleSeen = onTentacleSeen;
  callbacks.onAllTentaclesDead = onAllTentaclesDead;
  callbacks.onBossDefeated = onBossDefeated;

  startScreen.style.display = 'none';
  hud.classList.remove('hidden');

  beginTutorial();
}

// ===== DIALOGUE SYSTEM =====
function showDialogue(title, text) {
  setPhase('cutscene');
  dialogueTitle.textContent = title;
  dialogueText.textContent = text;
  dialogueOverlay.classList.remove('hidden');
  document.exitPointerLock();
}

function hideDialogue() {
  dialogueOverlay.classList.add('hidden');
}

function onDialogueContinue() {
  if (state.phase !== 'cutscene') return;

  if (dialogueQueue.length > 0) {
    const next = dialogueQueue.shift();
    showDialogue(next.title, next.text);
    if (next.onShow) next.onShow();
  } else {
    hideDialogue();
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
  setPhase('tutorial');
  setShipVisibility(true);
  setDungeonVisibility(false);
  setBossArenaVisibility(false);
  state.dummyHits = 0;
  state.tutorialComplete = false;
  state.hp = 100;
  state.level = 0;
  updateHUD();

  showDialogue('TUTORIAL: SHIP DECK', 'You are below deck of the merchant vessel Sable Crown. The lantern swings with the swell. Land 5 strikes on the sparring dummy to complete your warm-up. Use LEFT CLICK or SPACE to strike, and move with WASD. Press F to toggle your flashlight.');
  pendingContinue = () => {
    const canvas = document.getElementById('gl-canvas');
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
    updateHUD();
  };
  dialogueQueue = [];
}

function onTutorialComplete() {
  setPhase('cutscene');
  document.exitPointerLock();
  triggerStorm(2500);

  setTimeout(() => {
    queueDialogues([
      {
        title: 'WASHED UP',
        text: 'A rogue wave shatters the hull with the sound of a world ending. Splinters and black water swallow the hold. You wake up gasping on a pitch-black beach, salt burning your lungs. The ship is gone and a fog hangs low over the water.'
      },
      {
        title: 'THE $10,000,000 CONTRACT',
        text: 'A figure in an obsidian duster approaches through the fog. He opens a briefcase pulsing with pale green light. "Syndicate needs a cleaner. One hundred arena sectors. Survive, and ten million is yours."'
      }
    ], () => {
      setShipVisibility(false);
      beginArena();
    });
  }, 2500);
}

// ===== ARENA =====
function beginArena() {
  setPhase('arena');
  setDungeonVisibility(true);
  state.level = 1;
  nextArenaLevel();
  updateHUD();

  const canvas = document.getElementById('gl-canvas');
  if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
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
    setPhase('cutscene');
    document.exitPointerLock();
    showDialogue('LEVEL 100: THE ABYSS GATEWAY', 'The arena floor drops away into a subterranean ocean pit. Salt spray drenches the air. Chains snap like twigs. Something vast and ancient breaches the surface, and a low, hungry roar fills the chamber.');
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
    setTimeout(() => { if (hint) hint.textContent = 'CLICK or SPACE to STRIKE'; }, 3500);
  }
}

// ===== BOSS =====
function startBossPhase() {
  setPhase('boss');
  setDungeonVisibility(false);
  setBossArenaVisibility(true);
  spawnKraken();
  updateHUD();

  const canvas = document.getElementById('gl-canvas');
  if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
}

function onAllTentaclesDead() {
  showDialogue('THE CORE IS EXPOSED', 'All six tentacles collapse into twitching ruin. The Kraken\'s crimson eye boils with rage. Strike the core now before it recovers!');
  pendingContinue = () => {
    const canvas = document.getElementById('gl-canvas');
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  };
  dialogueQueue = [];
}

function onBossDefeated() {
  setPhase('cutscene');
  document.exitPointerLock();
  showDialogue('CONTRACT COMPLETE', 'The beast sinks into the black water with a deafening roar that seals the abyss. The syndicate broker steps from the shadows and hands you the glowing briefcase. The prize is yours.');
  pendingContinue = () => {
    resetGame();
    beginTutorial();
  };
  dialogueQueue = [];
}

// ===== DEATH / RESET =====
function onPlayerDead() {
  setPhase('cutscene');
  document.exitPointerLock();
  showDialogue('KNOCKED OUT', 'You collapse in the dust, your vision swimming. Arena medics drag you to the infirmary. The contract is still waiting, but the prize just got farther away.');
  pendingContinue = () => {
    resetGame();
    beginTutorial();
  };
  dialogueQueue = [];
}
