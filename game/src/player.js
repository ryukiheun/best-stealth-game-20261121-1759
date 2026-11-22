// player.js — the fox spirit: movement, sneaking, pebble throws,
// orb collection and the noise ring guards can hear.
// Movement is blocked by rocks, ponds and the world border; bamboo
// slows nothing but hides the fox (see guard.js isHiddenInBamboo).

import {
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  PLAYER_RADIUS,
  PLAYER_NOISE_WALK,
  PLAYER_NOISE_SNEAK,
  PEBBLES_PER_LEVEL,
  PEBBLE_FLIGHT_TIME,
} from "./config.js";
import { isHiddenInBamboo, blockedAt } from "./guard.js";

export function createPlayer(level) {
  return {
    x: level.spawn.x,
    y: level.spawn.y,
    radius: PLAYER_RADIUS,
    sneaking: false,
    moving: false,
    facing: -Math.PI / 2, // start facing up, toward the garden
    pebbles: PEBBLES_PER_LEVEL,
    pebblesThrown: 0,
    orbsCollected: 0,
    hidden: false,
    noiseRadius: 0,
    // Active pebble flight, or null: {sx, sy, tx, ty, t}
    pebbleFlight: null,
    // Last landed pebble, for the CLANK ring: {x, y, t} (t = age in s)
    pebbleLand: null,
  };
}

function blocked(x, y, level) {
  // Centre-point collision, as before; guards use the same test with
  // their 16 px radius (see blockedAt in guard.js).
  return blockedAt(x, y, level, 0);
}

export function updatePlayer(player, input, dt, level) {
  const v = input.moveVector();
  player.sneaking = input.sneaking();
  player.moving = v.x !== 0 || v.y !== 0;
  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  if (player.moving) {
    player.facing = Math.atan2(v.y, v.x);
    // Move axis by axis so the fox slides along obstacles.
    const nx = player.x + v.x * speed * dt;
    if (!blocked(nx, player.y, level)) player.x = nx;
    const ny = player.y + v.y * speed * dt;
    if (!blocked(player.x, ny, level)) player.y = ny;
  }
  player.hidden = isHiddenInBamboo(player.x, player.y, level);
  player.noiseRadius = player.moving
    ? player.sneaking
      ? PLAYER_NOISE_SNEAK
      : PLAYER_NOISE_WALK
    : 0;

  // Pebble flight: parabolic hop, then a landing that guards can hear.
  if (player.pebbleFlight) {
    const f = player.pebbleFlight;
    f.t += dt / PEBBLE_FLIGHT_TIME;
    if (f.t >= 1) {
      player.pebbleLand = { x: f.tx, y: f.ty, t: 0 };
      player.pebbleFlight = null;
    }
  }
  if (player.pebbleLand) {
    player.pebbleLand.t += dt;
    if (player.pebbleLand.t > 1.2) player.pebbleLand = null;
  }
}

// Start a pebble throw toward (tx, ty). Returns false with no pebbles left.
export function throwPebble(player, tx, ty) {
  if (player.pebbles <= 0 || player.pebbleFlight) return false;
  player.pebbles -= 1;
  player.pebblesThrown += 1;
  player.pebbleFlight = { sx: player.x, sy: player.y, tx, ty, t: 0 };
  return true;
}

// Current pebble position (for drawing), or null when none is flying.
export function pebblePosition(player) {
  const f = player.pebbleFlight;
  if (!f) return null;
  const hop = Math.sin(f.t * Math.PI) * 26; // px, arc height
  return { x: f.sx + (f.tx - f.sx) * f.t, y: f.sy + (f.ty - f.sy) * f.t - hop };
}

// Collect any orb within reach. Returns the orb collected, or null.
export function collectOrbs(player, orbs) {
  for (const orb of orbs) {
    if (orb.taken) continue;
    if (Math.hypot(orb.x - player.x, orb.y - player.y) < player.radius + 20) {
      orb.taken = true;
      player.orbsCollected += 1;
      return orb;
    }
  }
  return null;
}
