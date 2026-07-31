import { 
  initEngine, 
  state, 
  callbacks, 
  triggerStorm, 
  setPhase, 
  setShipVisibility, 
  setDungeonVisibility, 
  spawnEnemiesForLevel,
  updateHUD,
  startCinematicSequence,
  setCaptainSpeech
} from './game.js';

export function showBannerHint(text, duration = 3000) {
  const banner = document.getElementById('banner-message');
  if (banner) {
    banner.textContent = text;
    banner.style.display = 'block';
    if (duration > 0) {
      setTimeout(() => { banner.style.display = 'none'; }, duration);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  updateHUD();

  // Eye-level cutscene sequence inside local player space
  startCinematicSequence([
    { pos: { x: 0, y: 0.2, z: 3 }, look: { x: -2, y: 0, z: -1 }, duration: 2.0 },
    { pos: { x: -1, y: 0, z: 1 }, look: { x: -2, y: 0, z: -1 }, duration: 2.0 },
    { pos: { x: 0, y: 0, z: 0 }, look: { x: 2, y: -0.2, z: -3 }, duration: 1.5 }
  ], () => {
    setPhase('tutorial');
    setCaptainSpeech("Welcome aboard, boy! Go hit that dummy 5 times!");
    showBannerHint("Click on the practice dummy to attack!", 4000);
  });

  // Dummy Training Complete
  callbacks.onDummyComplete = () => {
    setCaptainSpeech("Good swings! Now clean up those 3 crates on deck!");
    showBannerHint("Walk up to the 3 crates and press 'E' to clean them up.", 5000);
  };

  // Chores Complete -> Storm Crash
  callbacks.onChoresComplete = () => {
    setCaptainSpeech("STORM COMING! HOLD ON TO SOMETHING!");
    showBannerHint("A massive wave hits the ship!", 3000);
    triggerStorm(3000);
  };

  // Ship Crashes into Dungeon
  callbacks.onShipCrash = () => {
    setCaptainSpeech(null);
    setShipVisibility(false);
    setDungeonVisibility(true);
    setPhase('arena');
    spawnEnemiesForLevel(state.level);
    updateHUD();
    showBannerHint("Press 'F' for Flashlight. Find the ladder in the maze and press 'E' to ascend!", 6000);
  };
});
