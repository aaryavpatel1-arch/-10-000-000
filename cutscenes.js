import {
  initEngine, setupInput, state, callbacks,
  setPhase, setShipVisibility, setDungeonVisibility, setBossArenaVisibility,
  spawnEnemy, spawnShadowTentacle, spawnKraken, triggerStorm, startCinematicSequence,
  updateHUD, resetGame, triggerScreenShake
} from './game.js';

let hud, startScreen;

export function initGame() {
  hud = document.getElementById('hud');
  startScreen = document.getElementById('start-screen');

  initEngine();
  setupInput();

  callbacks.onDummyComplete = playShipWreckCutscene;
  callbacks.onEnemyDefeated = onEnemyDefeated;
  callbacks.onPlayerDead = playGameOverCutscene;
  callbacks.onTentacleSeen = onTentacleSeen;
  callbacks.onBossDefeated = playVictoryCutscene;

  if (startScreen) startScreen.style.display = 'none';
  if (hud) hud.classList.remove('hidden');

  playIntroCutscene();
}

function playIntroCutscene() {
  setShipVisibility(true);
  setDungeonVisibility(false);
  setBossArenaVisibility(false);

  showBanner("TUTORIAL: SHIP DECK", "STRIKE THE DUMMY 5 TIMES TO PREPARE");

  startCinematicSequence([
    {
      pos: { x: 0, y: 1.8, z: 2 },
      look: { x: 0, y: 1.5, z: -3 },
      duration: 2.0
    },
    {
      pos: { x: 0, y: 0, z: 0 },
      look: { x: 0, y: 0, z: -5 },
      duration: 1.0
    }
  ], () => {
    setPhase('tutorial');
    updateHUD();
  });
}

function playShipWreckCutscene() {
  setPhase('cutscene');
  showBanner("STORM APPROACHING!", "A ROGUE WAVE SHATTERS THE HULL");

  triggerStorm(4000);
  triggerScreenShake(4.0, 0.4);

  startCinematicSequence([
    {
      pos: { x: -1.5, y: 0.5, z: 1 },
      look: { x: 2, y: 2.0, z: -5 },
      duration: 1.5
    },
    {
      pos: { x: 0, y: -1.0, z: -2 },
      look: { x: 0, y: -2.0, z: -10 },
      duration: 2.0
    }
  ], () => {
    setShipVisibility(false);
    playDungeonArrivalCutscene();
  });
}

function playDungeonArrivalCutscene() {
  setDungeonVisibility(true);
  state.level = 1;
  updateHUD();

  showBanner("ZONE 1: THE FOGGY MAZE", "SURVIVE THE LURKERS TO ESCAPE");

  startCinematicSequence([
    {
      pos: { x: 0, y: 3.0, z: 8 },
      look: { x: 0, y: 0.5, z: -8 },
      duration: 2.0
    },
    {
      pos: { x: 0, y: 0, z: 0 },
      look: { x: 0, y: 0, z: -5 },
      duration: 1.2
    }
  ], () => {
    setPhase('arena');
    nextArenaLevel();
  });
}

function nextArenaLevel() {
  if (state.level > 99) {
    playBossIntroCutscene();
    return;
  }
  spawnEnemy(state.level);
  if (state.level <= 99) spawnShadowTentacle();
  updateHUD();
}

function onEnemyDefeated() {
  if (state.level >= 99) {
    playBossIntroCutscene();
    return;
  }
  state.level++;
  nextArenaLevel();
}

function playBossIntroCutscene() {
  setPhase('cutscene');
  setDungeonVisibility(false);
  setBossArenaVisibility(true);
  spawnKraken();

  showBanner("FINAL BOSS: THE KRAKEN ABYSS", "DESTROY THE CRIMSON CORE");
  triggerScreenShake(3.5, 0.25);

  startCinematicSequence([
    {
      pos: { x: 0, y: 8.0, z: 12 },
      look: { x: 0, y: 2.0, z: -20 },
      duration: 3.0
    },
    {
      pos: { x: 0, y: 0, z: 0 },
      look: { x: 0, y: 0, z: -20 },
      duration: 1.5
    }
  ], () => {
    setPhase('boss');
    updateHUD();
  });
}

function playVictoryCutscene() {
  setPhase('cutscene');
  showBanner("CONTRACT COMPLETE!", "YOU SURVIVED AND CLAIMED THE $10,000,000");

  startCinematicSequence([
    {
      pos: { x: 0, y: 0, z: -10 },
      look: { x: 0, y: 0, z: -25 },
      duration: 4.0
    }
  ], () => {
    resetGame();
    playIntroCutscene();
  });
}

function playGameOverCutscene() {
  setPhase('cutscene');
  showBanner("YOU DIED", "RECOVERING AT ARENA BASE...");

  startCinematicSequence([
    {
      pos: { x: 0, y: -1.0, z: 1 },
      look: { x: 0, y: 2.0, z: -2 },
      duration: 3.0
    }
  ], () => {
    resetGame();
    playIntroCutscene();
  });
}

function onTentacleSeen() {
  const hint = document.getElementById('top-hint');
  if (hint) {
    hint.textContent = 'SOMETHING SLITHERED AROUND THE CORNER!';
    setTimeout(() => {
      if (hint) hint.textContent = 'WASD to MOVE | PRESS F FOR FLASHLIGHT';
    }, 3500);
  }
}

function showBanner(title, subtitle) {
  const zd = document.getElementById('zone-display');
  const hint = document.getElementById('top-hint');
  if (zd) zd.textContent = title;
  if (hint) hint.textContent = subtitle;
}
