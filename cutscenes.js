import { 
  initEngine, 
  state, 
  callbacks, 
  triggerStorm, 
  setPhase, 
  setShipVisibility, 
  setDungeonVisibility, 
  spawnEnemy,
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

  // 1. INTRO CUTSCENE PLAYS FIRST
  startCinematicSequence([
    { pos: { x: 0, y: 8, z: 14 }, look: { x: 0, y: 1.6, z: 0 }, duration: 2.5 },
    { pos: { x: -2, y: 3, z: 3 }, look: { x: -2, y: 2, z: -1 }, duration: 2.0 },
    { pos: { x: 0, y: 1.6, z: 5 }, look: { x: 0, y: 1.6, z: 0 }, duration: 1.5 }
  ], () => {
    // Cutscene finishes -> Start training course
    setPhase('tutorial');
    setCaptainSpeech("Welcome aboard, boy! Go hit that dummy 5 times!");
    showBannerHint("Click on the practice dummy to attack!", 4000);
  });

  // 2. DUMMY TRAINING COMPLETE
  callbacks.onDummyComplete = () => {
    setCaptainSpeech("Good swings! Now clean up those 3 crates on deck!");
    showBannerHint("Walk up to the 3 crates and press 'E' to clean them up.", 5000);
  };

  // 3. CHORES COMPLETE -> STORM CRASH
  callbacks.onChoresComplete = () => {
    setCaptainSpeech("STORM COMING! HOLD ON TO SOMETHING!");
    showBannerHint("A massive wave hits the ship!", 3000);
    triggerStorm(3000);
  };

  // 4. SHIP CRASHES INTO DUNGEON
  callbacks.onShipCrash = () => {
    setCaptainSpeech(null); // Remove speech bubble
    setShipVisibility(false);
    setDungeonVisibility(true);
    setPhase('arena');
    spawnEnemy(1);
    updateHUD();
    showBannerHint("Press 'F' to switch on your flashlight!", 5000);
  };
});
