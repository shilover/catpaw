import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import ArcModeScene from './scenes/ArcModeScene.js';
import PauseScene from './scenes/PauseScene.js';
import FinalScoreScene from './scenes/FinalScoreScene.js';
import CoopModeScene from './scenes/CoopModeScene.js';
import VersusModeScene from './scenes/VersusModeScene.js';
import { LANDSCAPE_W, LANDSCAPE_H } from './data/displayConfig.js';

const config = {
  // Canvas renderer: the fish-slicing effect relies on GeometryMask, which
  // Phaser 4 only supports in Canvas (WebGL needs the newer Filter/Mask API).
  type: Phaser.CANVAS,
  parent: 'app',
  width: LANDSCAPE_W,
  height: LANDSCAPE_H,
  backgroundColor: '#0a2a4a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, ArcModeScene, CoopModeScene, VersusModeScene, PauseScene, FinalScoreScene],
};

const game = new Phaser.Game(config);

// Exposed for local debugging/tooling only (e.g. driving a headless smoke test).
window.__PHASER_GAME__ = game;
