/* 10,000,000 - WASHED-UP FIGHTER STORY & CUTSCENE EVENTS */

const screenDialogue = document.getElementById('screen-dialogue');
const dialogueText = document.getElementById('dialogue-text');

// Story Intro: Washed-up fighter entering Black-Market game
function startStoryIntro() {
  showCutsceneDialogue(
    "CONTRACT SIGNED: $10,000,000",
    "Once a top-tier fighter, your career ended in scandal. Broke and out of options, you signed a dark-web contract promising $10,000,000. As the digital ink dried, the floor vanished—and you were sucked into an underground arena with only a heavy flashlight.",
    () => {
      state.screen = 'game';
      init3D();
      updateGameLoop();
    }
  );
}

function registerStrike() {
  state.hits++;

  // Warm-up sparring in the virtual ring
  if (state.inTutorial && player.position.distanceTo(opponent.position) < 3) {
    opponent.position.z -= 0.3;
    if (state.hits >= 5) {
      concludeMMATutorial();
    }
  }

  // Final Kraken Boss Phase
  if (state.inKrakenBoss && player.position.distanceTo(krakenBoss.position) < 8) {
    state.krakenHp -= 20;
    if (state.krakenHp <= 0) {
      triggerKrakenVictory();
    }
  }
}

function concludeMMATutorial() {
  state.inTutorial = false;
  hudZone.textContent = "CORRIDOR SECTOR 4";

  showCutsceneDialogue(
    "LEVEL 1 COMPLETE",
    "Your virtual opponent dissolves. You switch on your heavy flashlight and shine it down the narrow black corridor, searching for the prize gateway.",
    () => {
      state.screen = 'game';
      runWallTentacleAmbush();
    }
  );
}

function runWallTentacleAmbush() {
  state.eventTriggered = true;
  let progress = 0;

  const eventInterval = setInterval(() => {
    progress += 0.05;

    // Tentacle reaches out of wall
    if (progress <= 1.0) {
      wallTentacle.position.x = 16 - (progress * 4.5);
    } 
    // Snatches another trapped contender into wall
    else if (progress <= 2.0) {
      const pull = progress - 1.0;
      npc.position.x = 11.5 + (pull * 4.5);
      wallTentacle.position.x = 11.5 + (pull * 4.5);
    } 
    // Trigger Kraken Abyss Final Boss
    else {
      scene.remove(npc);
      scene.remove(wallTentacle);
      scene.remove(opponent);
      clearInterval(eventInterval);

      showCutsceneDialogue(
        "THE $10,000,000 BOSS: KRAKEN LAIR",
        "Your flashlight beam catches a massive black tentacle dragging another contender into the wall! The arena floor collapses into an underground abyss—a giant Kraken rises to claim the final purse!",
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

function triggerKrakenVictory() {
  scene.remove(krakenBoss);
  showCutsceneDialogue(
    "CONTRACT FULFILLED",
    "The giant Kraken falls back into the abyss. The simulation destabilizes and ejects you back into the real world—with $10,000,000 wired straight into your bank account.",
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
