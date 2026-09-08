// Keeps the fixed 1920x1080 stage scaled to fit the window (letterboxed), so
// every literal size from the Dart lands where it did on the kiosk.

import { SW, SH } from './widgets.js';

export function installStage() {
  const stage = document.getElementById('stage');

  const fit = () => {
    const scale = Math.min(window.innerWidth / SW, window.innerHeight / SH);
    stage.style.setProperty('--stage-scale', String(scale));
  };

  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
}
