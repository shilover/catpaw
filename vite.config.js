import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The prebuilt Arcade-Physics distribution, resolved as a file path rather than
// a package specifier: phaser's package.json `exports` map only exposes the
// package root, so a bare 'phaser/dist/...' alias is rejected outright. Using
// the prebuilt file rather than phaser's `src/` entry keeps the build flags and
// the optional WebGL-inspector dependency exactly as Phaser shipped them.
const phaserArcadeEntry = fileURLToPath(
  new URL('./node_modules/phaser/dist/phaser-arcade-physics.js', import.meta.url),
);

export default defineConfig({
  // Relative asset URLs so the build works when it is served from a sub-path
  // (GitHub Pages project sites, an /games/tinyfish/ folder, an itch.io zip).
  // With Vite's default of '/', every one of those serves a blank page.
  base: './',

  // This project always serves on 8095. `strictPort` is the part that makes
  // that true: without it Vite quietly moves to the next free port when 8095 is
  // taken, which is exactly the situation where a fixed port matters.
  server: {
    port: 8095,
    strictPort: true,
  },

  resolve: {
    alias: {
      // The Arcade Physics entry point, which drops Matter.js. This game only
      // uses Arcade (gravity on cut debris and the bonus octopus), and Matter is
      // a large chunk of the default bundle.
      phaser: phaserArcadeEntry,
    },
  },

  build: {
    // Phaser dwarfs the game code and changes only when the dependency is
    // upgraded, so give it its own long-lived chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: [phaserArcadeEntry],
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
