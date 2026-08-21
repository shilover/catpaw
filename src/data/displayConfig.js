// Every layout constant the game shares across scenes lives here. Anything a
// second file needs to agree on — canvas sizes, the split-screen divider, the
// fish texture size the cut geometry assumes — belongs in this file rather than
// being redeclared (or kept in sync by comment) on both sides.

// Solo play (menu + Arc Mode) is landscape; Co-op/Versus switch the canvas to
// portrait for their top/bottom split-screen layout and hand it back on the way
// out. Every scene sets its own size on entry.
export const LANDSCAPE_W = 1280;
export const LANDSCAPE_H = 720;

export const PORTRAIT_W = 540;
export const PORTRAIT_H = 960;
export const SPLIT_Y = PORTRAIT_H / 2;

// Split-screen lanes are half the height of a solo screen, so the fish (sized
// for the full-height layout) shrink to fit.
export const SPLIT_FISH_SCALE = 0.4;

// --- lane layout ----------------------------------------------------------

// Height of a lane's own HUD strip (score / stage label / target bar).
export const HUD_HEIGHT = 96;
// Gap between the bottom of a lane and where fish are allowed to sit.
export const FLOOR_MARGIN = 20;
// Slim header above the solo lane's HUD, holding the round timer + pause.
export const HEADER_HEIGHT = 44;

// --- fish textures --------------------------------------------------------

// The fish "design" size: all layout and spawn maths is expressed in these
// units, and BootScene draws each fish centred on this box (the cut geometry
// assumes fish.x/fish.y is that centre).
export const FISH_TEXTURE_W = 140;
export const FISH_TEXTURE_H = 96;

// Fish are displayed at roughly 4x their design size, so a 1:1 texture is
// visibly soft on any screen — and worse again on a high-DPI one, where the
// canvas is stretched further still. The textures are therefore rasterised at
// this multiple of the design size and the sprites scaled back down, which costs
// memory (a few MB for the whole cast) and buys real edge detail.
export const FISH_SUPERSAMPLE = 3;
export const FISH_PIXEL_W = FISH_TEXTURE_W * FISH_SUPERSAMPLE;
export const FISH_PIXEL_H = FISH_TEXTURE_H * FISH_SUPERSAMPLE;

// The on-screen scale to give a sprite using a supersampled fish texture, for a
// fish whose configured `size` is expressed in design units.
export function fishSpriteScale(size) {
  return size / FISH_SUPERSAMPLE;
}

// Breathing room between a fish and its countdown ring.
export const RING_PADDING = 8;

// Height of the sea floor strip drawn into the solo background texture.
export const SAND_HEIGHT = 22;
