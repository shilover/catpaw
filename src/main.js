import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import ArcModeScene from './scenes/ArcModeScene.js';
import DailyChallengeScene from './scenes/DailyChallengeScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import LevelScene from './scenes/LevelScene.js';
import PauseScene from './scenes/PauseScene.js';
import FinalScoreScene from './scenes/FinalScoreScene.js';
import CoopModeScene from './scenes/CoopModeScene.js';
import VersusModeScene from './scenes/VersusModeScene.js';
import { LANDSCAPE_W, LANDSCAPE_H } from './data/displayConfig.js';

const config = {
  // WebGL wherever it is available. The slicing effect used to force Canvas
  // because it relied on GeometryMask, which Phaser 4 only supports there; the
  // pieces are now baked into their own textures at cut time (see
  // utils/pieceTexture.js), so nothing in the game is renderer-specific.
  type: Phaser.AUTO,
  parent: 'app',
  width: LANDSCAPE_W,
  height: LANDSCAPE_H,
  backgroundColor: '#0a2a4a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    // Co-op and Versus put two players on one screen at the same time. Phaser
    // creates a single touch pointer by default (see
    // node_modules/phaser/src/core/Config.js — `input.activePointers`), which
    // means the second player's finger produced no events at all: whoever
    // touched down first owned the whole device.
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene, MainMenuScene, TutorialScene, LevelSelectScene, LevelScene,
    ArcModeScene, DailyChallengeScene,
    CoopModeScene, VersusModeScene, PauseScene, FinalScoreScene,
  ],
};

const game = new Phaser.Game(config);

// Debug/tooling handle, used by the Playwright screenshot harness to jump
// scenes and read game state. Dev builds only — it must not ship.
if (import.meta.env.DEV) {
  window.__PHASER_GAME__ = game;
}
