/* 10,000,000 - STORY CUTSCENES & KRAKEN EVENT LOGIC */

const screenDialogue = document.getElementById('screen-dialogue');
const dialogueText = document.getElementById('dialogue-text');

// Story Cutscene 1: MMA Intro
function startStoryIntro() {
  showCutsceneDialogue(
    "ACT I: THE $10,000,000 BOUT",
    "You are Marcus 'The Anchor' Vance, an underground MMA fighter competing for a $10,000,000 prize. Your coach sends you into the ring for your warm-up against Kovac.",
    () => {
      state.screen = 'game';
      init3D();
      updateGameLoop();
    }
  );
}

// Attack Registration logic
function registerStrike() {
  state.hits++;
  hudHits.textContent = state.hits;

  // MMA Sparring phase
  if (state.inTutorial && player.position.distanceTo(opponent.position) < 3) {
    opponent.position.z -= 0.3;
    if (state.hits >= 5) {
      concludeMMATutorial();
    }
  }

  // Final Boss Kraken Fight Phase
  if (state.inKrakenBoss && player.position.distanceTo(krakenBoss.position) < 8) {
    state.krakenHp -= 20;
    if (state.krakenHp <= 0) {
      triggerKrakenVictory();
    }
  }
}

// Story Cutscene 2: Post-Fight / Wall Event Transition
function concludeMMATutorial() {
  state.inTutorial = false;
  hudZone.textContent = "CORRIDOR SECTOR 4";

  showCutsceneDialogue(
    "ACT II: SHADOWS IN THE WALL",
    "Kovac yields and retreats into the darkness. As you step out of the ring to claim your stake in the $10,000,000 tournament, a heavy rumble shakes the basement corridor.",
    () => {
      state.screen = 'game';
      runWallTentacleAmbush();
    }
  );
}

// Story Cutscene 3: Wall Tentacle Grab Event
function runWallTentacleAmbush() {
  state.eventTriggered = true;
  let progress = 0;

  const eventInterval = setInterval(() => {
    progress += 0.05;

    // Tentacle extends from wall
    if (progress <= 1.0) {
      wallTentacle.position.x = 16 - (progress * 4.5);
    } 
    // Tentacle snatches the NPC mechanic into the wall
    else if (progress <= 2.0) {
      const pull = progress - 1.0;
      npc.position.x = 11.5 + (pull * 4.5);
      wallTentacle.position.x = 11.5 + (pull * 4.5);
    } 
    // Trigger Final Boss Phase
    else {
      scene.remove(npc);
      scene.remove(wallTentacle);
      scene.remove(opponent);
      clearInterval(eventInterval);

      showCutsceneDialogue(
        "ACT III: THE ABYSS OPENS",
        "The wall crumbles into a flooding abyss. From the dark waters below, a giant Kraken rises! Defeat the beast to claim the $10,000,000 and escape!",
        () => {
          state.screen = 'game';
          state.inKrakenBoss = true;
          hudZone.textContent = "ABYSS: KRAKEN LAIR";
          spawnKrakenBoss();
        }
      );
    }
  }, 30);
}

// Story Cutscene 4: Ending
function triggerKrakenVictory() {
  scene.remove(krakenBoss);
  showCutsceneDialogue(
    "EPILOGUE: $10,000,000 VICTOR",
    "The giant Kraken slumps into the flooded depths. You break through the upper iron hatch back into daylight—walking away with the $10,000,000 prize and your life.",
    () => {
      window.location.reload();
    }
  );
}

function showCutsceneDialogue(title, message, callback) {
  state.screen = 'dialogue';
  document.exitPointerLock();
  
  document.getElementById('dialogue-label').textContent = title;
  dialogueText.textContent = message;
  screenDialogue.classList.remove('hidden');

  document.getElementById('btn-dialogue-next').onclick = () => {
    screenDialogue.classList.add('hidden');
    if (callback) callback();
  };
}
