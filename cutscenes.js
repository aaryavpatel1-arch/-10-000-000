import { 
  initEngine, 
  state, 
  callbacks, 
  triggerStorm, 
  setPhase, 
  spawnEnemiesForLevel,
  updateHUD,
  setCaptainSpeech,
  showBanner
} from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  updateHUD();

  setPhase('tutorial');
  setCaptainSpeech("Welcome aboard, boy! Go hit that dummy 5 times!");
  showBanner("Click on the practice dummy to attack!", 4000);

  // Dummy Training Complete
  callbacks.onDummyComplete = () => {
    setCaptainSpeech("Good swings! Now clean up those 3 crates on deck!");
    showBanner("Walk up to the 3 crates and press 'E' to clean them up.", 5000);
  };

  // Chores Complete -> Storm Crash
  callbacks.onChoresComplete = () => {
    setCaptainSpeech("STORM COMING! HOLD ON TO SOMETHING!");
    showBanner("A massive wave hits the ship!", 3000);
    triggerStorm(3000);
  };

  // Ship Crashes into Dungeon
  callbacks.onShipCrash = () => {
    setCaptainSpeech(null);
    setPhase('arena');
    spawnEnemiesForLevel(state.level);
    updateHUD();
    showBanner("Press 'F' for Flashlight. Find the ladder in the maze and press 'E' to ascend!", 6000);
  };
});
