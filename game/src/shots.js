// shots.js — deterministic screenshot states from the URL query.
// ?shot=start | play | chase | victory. Each shot sets up a frozen,
// input-free scene so a screenshot taken in a headless browser shows
// the same frame every time: the title screen, a mid-level stealth
// moment, a chase, or the victory screen. No user input is needed for
// any of them. Time is frozen in shot mode (see main.js), so the pixels
// are identical on every re-shoot, not just the layout.

import { createPlayer } from "./player.js";
import { Guard } from "./guard.js";
import { getLevel } from "./levels.js";

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get("shot") || null };
}

// Build the full game state for a named shot. Returns null for live play.
export function buildShotState(shot) {
  if (!shot) return null;
  const levelIndex = 1; // level 2: three guards, wide cones, four bamboo patches
  const level = getLevel(levelIndex);
  const player = createPlayer(level);
  const guards = level.guards.map((def) => new Guard(def, level));
  const orbs = level.orbs.map((o) => ({ x: o.x, y: o.y, taken: false }));
  const state = {
    screen: "play",
    levelIndex,
    level,
    player,
    guards,
    orbs,
    exitOpen: false,
    levelTime: 75,
    danger: "PATROL",
    maxSuspicion: 0,
    levelStats: { orbs: 3, time: "2:45", pebbles: 4 },
    shotMode: true,
  };

  if (shot === "start") {
    // Title screen: level 1 garden as the backdrop, menu over it.
    // The fox sits at the right, clear of the centred menu, facing left.
    const level0 = getLevel(0);
    state.screen = "start";
    state.menuIndex = 0;
    state.levelIndex = 0;
    state.level = level0;
    state.player = createPlayer(level0);
    state.guards = level0.guards.map((def) => new Guard(def, level0));
    state.orbs = level0.orbs.map((o) => ({ x: o.x, y: o.y, taken: false }));
    state.player.x = 920;
    state.player.y = 500;
    state.player.facing = Math.PI;
    return state;
  }
  if (shot === "victory") {
    state.screen = "victory";
    state.levelStats = { orbs: 3, time: "2:45", pebbles: 4 };
    // The fox stands on the open path below the torii in side profile
    // (facing east, body across the frame, ears and tail all visible)
    // at near-play size, with the three orbs in a wide ring around it:
    // two low at its sides, one high between fox and torii — none of
    // them inside the torii glow, all three clearly separable.
    state.exitOpen = true;
    state.player.x = 640;
    state.player.y = 300;
    state.player.facing = 0.1;
    const ring = [
      [500, 310],
      [640, 190],
      [780, 310],
    ];
    orbs.forEach((o, i) => {
      o.taken = false;
      o.x = ring[i][0];
      o.y = ring[i][1];
    });
    state.player.orbsCollected = 3;
    return state;
  }
  if (shot === "play") {
    // Mid-play: 1 orb collected, the fox in side profile on the open
    // grass east of the bottom bamboo (whole silhouette: head, ears,
    // body, legs, tail), sneaking past the thicket. The signature
    // pebble lure is mid-flight toward a clank point north-east, the
    // CLANK ring is already ringing there, and the suspicious guard has
    // turned its orange cone toward the noise instead of the fox.
    orbs[0].taken = true;
    orbs[2].x = 1060;
    orbs[2].y = 540;
    player.orbsCollected = 1;
    player.x = 700;
    player.y = 520;
    player.sneaking = true;
    player.facing = 0.1;
    player.pebbles = 4;
    player.pebblesThrown = 1;
    // Pebble mid-flight (t=0.5 of the 0.45 s flight) toward the clank
    // point, and the landed clank itself, fresh (t=0.15 of 1.2 s) so
    // the ring is bright and tight. The clank point is open grass
    // south-east of the guard — nothing between it and the camera —
    // so the ring and the gold pool read clearly.
    player.pebbleFlight = { sx: 700, sy: 520, tx: 860, ty: 430, t: 0.5 };
    player.pebbleLand = { x: 860, y: 430, t: 0.15 };
    // The suspicious guard stands east of the fox with a clear sightline
    // (no bamboo between it and the camera), orange cone swung toward
    // the clank point it is investigating.
    guards[0].x = 760;
    guards[0].y = 390;
    guards[0].angle = Math.atan2(430 - 390, 860 - 760);
    guards[0].state = "suspicious";
    guards[0].suspicion = 0.55;
    guards[0].investigate = { x: 860, y: 430 };
    guards[0].lastSeen = { x: 860, y: 430 };
    // Guard 1 looks north, guard 2 looks south: cones stay apart and
    // at least two cones read in the frame.
    guards[1].x = 1000;
    guards[1].y = 260;
    guards[1].angle = -Math.PI / 2;
    guards[2].x = 640;
    guards[2].y = 200;
    guards[2].angle = Math.PI / 2;
    state.danger = "SUSPICIOUS";
    state.maxSuspicion = 0.55;
    state.levelTime = 75;
    return state;
  }
  if (shot === "chase") {
    // Chase moment: red cone, big "!" over the guard, fox fleeing toward
    // bamboo. The chasing guard is close and warm-lit; the other two
    // guards look away so their cones never muddy the red one.
    orbs[0].taken = true;
    orbs[1].taken = true;
    player.orbsCollected = 2;
    player.x = 700;
    player.y = 520;
    player.facing = Math.PI / 4;
    player.pebbles = 3;
    player.pebblesThrown = 2;
    guards[0].x = 680;
    guards[0].y = 430;
    guards[0].angle = Math.atan2(player.y - 430, player.x - 680);
    guards[0].state = "chase";
    guards[0].suspicion = 1;
    guards[0].lastSeen = { x: player.x, y: player.y };
    guards[1].x = 1010;
    guards[1].y = 280;
    guards[1].angle = -Math.PI / 2;
    guards[2].x = 640;
    guards[2].y = 150;
    guards[2].angle = Math.PI;
    state.danger = "CHASE";
    state.maxSuspicion = 1;
    state.levelTime = 132;
    return state;
  }
  return null;
}
