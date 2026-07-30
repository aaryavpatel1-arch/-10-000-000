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

  // Hook up game event triggers to cinematic cutscene sequences
  callbacks.onDummyComplete = playShipWreckCutscene;
  callbacks.onEnemyDefeated = onEnemyDefeated;
  callbacks.onPlayerDead = playGameOverCutscene;
  callbacks.onTentacleSeen = onTentacleSeen;
  callbacks.onBossDefeated = playVictoryCutscene;

  if (startScreen) startScreen.style.display = 'none';
  if (hud) hud.classList.remove('hidden');

  playIntroCutscene();
}

/**
 * 1. INTRO CUTSCENE:
 * Smooth camera pan around the ship interior deck looking down at the training dummy.
 */
function playIntroCutscene() {
  setShipVisibility(true);
  setDungeonVisibility(false);
  setBossArenaVisibility(false);

  showBanner("TUTORIAL: SHIP DECK", "STRIKE THE DUMMY 5 TIMES TO PREPARE");

  // Cinematic Camera Sequence: Pan from ceiling down to player height facing dummy
  startCinematicSequence([
    {
      pos: { x: 0, y: 3.8, z: 2 },
      look: { x: 0, y: 1.2, z: -3 },
      duration: 2.5
    },
    {
      pos: { x: 0, y: 1.6, z: 2 },
      look: { x: 0, y: 1.4, z: -3 },
      duration: 1.5
    }
  ], () => {
    setPhase('tutorial');
    updateHUD();
  });
}

/**
 * 2. SHIPWRECK CUTSCENE:
 * Violent storm flashes, screen shake, crashing sound effect simulation, fog transition into the abyss.
 */
function playShipWreckCutscene() {
  setPhase('cutscene');
  showBanner("STORM APPROACHING!", "A ROGUE WAVE SHATTERS THE HULL");

  // Trigger storm lighting flashes & continuous camera shake
  triggerStorm(4000);
  triggerScreenShake(4.0, 0.4);

  // Cinematic Sequence: Camera tilts wildy as ship sinks, pans down into dark water
  startCinematicSequence([
    {
      pos: { x: -2, y: 1.2, z: 0 },
      look: { x: 2, y: 3.0, z: -5 },
      duration: 1.5
    },
    {
      pos: { x: 0, y: 0.2, z: -2 },
      look: { x: 0, y: -2.0, z: -10 },
      duration: 2.0
    }
  ], () => {
    // Transition scene environment to Arena / Dungeon Maze
    setShipVisibility(false);
    playDungeonArrivalCutscene();
  });
}

/**
 * 3. ARRIVAL AT ARENA MAZE:
 * Camera swoops low over the foggy stone floor showing the lurking shadows.
 */
function playDungeonArrivalCutscene() {
  setDungeonVisibility(true);
  state.level = 1;
  updateHUD();

  showBanner("ZONE 1: THE FOGGY MAZE", "SURVIVE THE LURKERS TO ESCAPE");

  startCinematicSequence([
    {
      pos: { x: 0, y: 8.0, z: 12 },
      look: { x: 0, y: 0.5, z: -8 },
      duration: 2.0
    },
    {
      pos: { x: 0, y: 1.6, z: 5 },
      look: { x: 0, y: 1.6, z: -5 },
      duration: 1.5
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

/**
 * 4. KRAKEN BOSS INTRO CUTSCENE:
 * Floor drops, camera flies over black ocean water as Kraken rises with red eye glow.
 */
function playBossIntroCutscene() {
  setPhase('cutscene');
  setDungeonVisibility(false);
  setBossArenaVisibility(true);
  spawnKraken();

  showBanner("FINAL BOSS: THE KRAKEN ABYSS", "DESTROY THE CRIMSON CORE");
  triggerScreenShake(3.5, 0.25);

  startCinematicSequence([
    {
      pos: { x: 0, y: 12.0, z: 15 },
      look: { x: 0, y: 2.0, z: -20 },
      duration: 3.0
    },
    {
      pos: { x: 0, y: 2.5, z: 8 },
      look: { x: 0, y: 3.0, z: -20 },
      duration: 2.0
    }
  ], () => {
    setPhase('boss');
    updateHUD();
  });
}

/**
 * 5. GAME OVER & VICTORY CUTSCENES
 */
function playVictoryCutscene() {
  setPhase('cutscene');
  showBanner("CONTRACT COMPLETE!", "YOU SURVIVED AND CLAIMED THE $10,000,000");

  startCinematicSequence([
    {
      pos: { x: 0, y: 1.6, z: -10 },
      look: { x: 0, y: 0.5, z: -25 },
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
      pos: { x: 0, y: 0.3, z: 2 },
      look: { x: 0, y: 4.0, z: -2 },
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
    hint.textContent = 'SOMETHING STIRRED IN THE FOG...';
    setTimeout(() => {
      if (hint) hint.textContent = 'WASD to MOVE | CLICK or SPACE to STRIKE';
    }, 3500);
  }
}

// Subtle non-blocking banner for cinematic atmosphere
function showBanner(title, subtitle) {
  const zd = document.getElementById('zone-display');
  const hint = document.getElementById('top-hint');
  if (zd) zd.textContent = title;
  if (hint) hint.textContent = subtitle;
}
