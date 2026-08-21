// Reusable rounded-rect button, replicating the UMG Button widgets used across
// BPUI_MainMenu / BPUI_ArcMode / BPUI_Pause / BPUI_FinalScore.

import Phaser from 'phaser';
import { playSfx, SFX } from '../audio/audio.js';

export function createButton(scene, x, y, w, h, label, { color = 0x2f9fe0, textColor = '#ffffff', fontSize = 24, disabled = false } = {}) {
  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const draw = (fillColor, alpha = 1) => {
    bg.clear();
    bg.fillStyle(0x00121f, 0.25);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, h / 2);
    bg.fillStyle(fillColor, alpha);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  };
  draw(color, disabled ? 0.4 : 1);

  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: disabled ? '#dddddd' : textColor,
  }).setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(w, h);

  if (!disabled) {
    // Phaser's own hit-test always adds the Container's displayOrigin
    // (width/2, height/2 — see Container.js, not overridable) to the click
    // point before comparing it against the hit area. Since our visuals are
    // drawn centered on (0,0), the hit area must be authored "un-centered"
    // (0,0 to w,h) so that shift cancels out — a centered rectangle here
    // silently shifts the real clickable hotspot a full half-width to the
    // left of the visible button (invisible on narrow buttons, glaring on
    // wide ones).
    container.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(0, 0, w, h), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    container.on('pointerover', () => draw(color, 0.85));
    container.on('pointerout', () => draw(color, 1));
    container.on('pointerdown', () => {
      container.setScale(0.94);
      playSfx(scene, SFX.BUTTON);
    });
    container.on('pointerup', () => {
      container.setScale(1);
      draw(color, 1);
    });
  }

  return container;
}
