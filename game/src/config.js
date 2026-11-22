// config.js — the main tuned numbers for Moss & Shadow, each with its
// definition, unit and the reason for the value. Units: px = canvas
// pixels (world is 1280 x 720), px/s = pixels per second, s = seconds,
// rad = radians. Counts and unitless ratios are marked as such.
// Playtest note: level 1 is checked end-to-end by playtest-stealth.mjs
// (real keys and mouse in headless Chromium); levels 2–3 are checked by
// a scripted simulation of the same guard code, which walks a careful
// fox through every orb and confirms it can finish without being caught.
export const WORLD_W = 1280; // canvas width in px
export const WORLD_H = 720; // canvas height in px

// --- Player movement (px/s) ---
export const PLAYER_WALK_SPEED = 165; // px/s, normal move speed
export const PLAYER_SNEAK_SPEED = 88; // px/s, while Shift is held
export const PLAYER_RADIUS = 14; // px, collision circle of the fox
export const PLAYER_NOISE_WALK = 70; // px, radius in which guards hear walking
export const PLAYER_NOISE_SNEAK = 26; // px, radius in which guards hear sneaking

// --- Pebbles ---
export const PEBBLES_PER_LEVEL = 5; // pebbles given at the start of each level
export const PEBBLE_HEAR_RADIUS = 330; // px, guards inside hear the clank
export const PEBBLE_FLIGHT_TIME = 0.45; // s, pebble travel time to the click point

// --- Vision cones ---
// Detection fills 0..1. Rate scales with closeness and with the player's
// speed: walking close fills in ~0.9 s (1.1/s), walking far in ~3.6 s
// (0.28/s), sneaking far in ~7.9 s (0.28 x 0.45 = 0.126/s).
export const DETECT_FILL_CLOSE = 1.1; // per s, player within 40% of cone range
export const DETECT_FILL_FAR = 0.28; // per s, player near the cone edge
export const DETECT_FILL_SNEAK_MULT = 0.45; // unitless ratio while sneaking
export const DETECT_DRAIN = 0.35; // per s, suspicion drains when unseen
export const HEAR_FILL = 0.6; // per s, suspicion gained while a guard hears footsteps
export const SUSPICIOUS_TIME = 2.2; // s, guard stares at last seen spot
export const CHASE_LOSE_TIME = 3.0; // s without sight before chase gives up
// Chase speed is set per level in levels.js (200/220/240 px/s), always
// above the 165 px/s walk speed so a chase can catch a fleeing fox.
export const CATCH_DISTANCE = 26; // px, guard-to-player distance = caught
export const INVESTIGATE_ARRIVE = 18; // px, close enough to the noise point

// --- Level structure ---
export const ORBS_PER_LEVEL = 3; // count of sacred orbs per level (no unit)
export const LEVEL_COUNT = 3; // count of levels (no unit)
