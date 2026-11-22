// main.js — game loop, screen states and the rules that tie the modules
// together. Screens: start, howto, credits, play, paused, levelcomplete,
// victory, caught. The loop runs at requestAnimationFrame with a clamped
// dt (max 0.05 s) so a slow frame cannot teleport the fox.
// Edge cases, listed so they are testable:
// - all 3 orbs collected -> exit opens; touching the torii then wins.
// - guard touches the player -> caught screen, level restarts on Space.
// - pebbles run out -> clicks do nothing (no throw, no sound).
// - chase with no sight for 3 s -> guard gives up to suspicious, then patrol.
// - player hidden in bamboo -> no guard can see them, suspicion drains.
// - pause (P) freezes updates but keeps rendering the garden behind.
// - ?shot= states render frozen scenes with no input and no audio.

import { WORLD_W, WORLD_H, LEVEL_COUNT, ORBS_PER_LEVEL, PEBBLE_HEAR_RADIUS } from "./config.js";
import { getLevel } from "./levels.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { Guard } from "./guard.js";
import { createPlayer, updatePlayer, throwPebble, collectOrbs, pebblePosition } from "./player.js";
import { parseShot, buildShotState } from "./shots.js";
import { GardenRenderer } from "./render.js";
import { updateHud, drawMinimap, showScreen } from "./hud.js";

const input = createInput();
const audio = createAudio();
let renderer = null;

function startLevel(state, levelIndex) {
  const level = getLevel(levelIndex);
  state.levelIndex = levelIndex;
  state.level = level;
  state.player = createPlayer(level);
  state.guards = level.guards.map((def) => new Guard(def, level));
  state.orbs = level.orbs.map((o) => ({ x: o.x, y: o.y, taken: false }));
  state.exitOpen = false;
  state.levelTime = 0;
  state.danger = "PATROL";
  state.maxSuspicion = 0;
  state.screen = "play";
  state.pebblePos = null;
  if (renderer) renderer.buildLevel(level);
}

function formatTime(t) {
  const mm = Math.floor(t / 60);
  const ss = String(Math.floor(t % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function main() {
  const { shot } = parseShot();
  const shotState = buildShotState(shot);
  const state = shotState || {
    screen: "start",
    menuIndex: 0,
    levelIndex: 0,
    level: getLevel(0),
    player: createPlayer(getLevel(0)),
    guards: [],
    orbs: [],
    exitOpen: false,
    levelTime: 0,
    danger: "PATROL",
    maxSuspicion: 0,
    levelStats: { orbs: 0, time: "0:00", pebbles: 0 },
    shotMode: false,
    pebblePos: null,
  };
  renderer = new GardenRenderer(document.getElementById("scene"));
  renderer.buildLevel(state.level);
  let time = 0;
  let last = performance.now();
  let suspBeepCooldown = 0; // s, gates the suspicious beep only
  let stepTimer = 0; // s, paces the footstep sounds

  function finishLevel() {
    state.levelStats = {
      orbs: state.player.orbsCollected,
      time: formatTime(state.levelTime),
      pebbles: state.player.pebblesThrown,
    };
    audio.victory();
    if (state.levelIndex + 1 >= LEVEL_COUNT) {
      state.screen = "victory";
    } else {
      state.screen = "levelcomplete";
    }
  }

  function caught() {
    state.screen = "caught";
    audio.caught();
  }

  function updatePlay(dt) {
    const { player, guards, level } = state;
    state.levelTime += dt;
    suspBeepCooldown -= dt;
    stepTimer -= dt;

    updatePlayer(player, input, dt, level);
    state.pebblePos = pebblePosition(player);

    // Footsteps: a soft step sound while moving, quieter and slower
    // while sneaking — the sound the noise radius promises.
    if (player.moving && stepTimer <= 0) {
      audio.step(player.sneaking);
      stepTimer = player.sneaking ? 0.62 : 0.42;
    }

    // Pebble throw on click: raycast the click onto the garden floor,
    // so the pebble lands where the player pointed in 3D.
    if (input.mouse.clicked && renderer) {
      const target = renderer.screenToWorld(input.mouse.clientX, input.mouse.clientY);
      if (target) throwPebble(player, target.x, target.y);
    }
    // Pebble landed this frame: guards in earshot investigate.
    if (player.pebbleLand && player.pebbleLand.t < dt + 0.001 && player.pebbleLand.t >= 0) {
      // Land event is consumed once, right after the flight ends.
      if (!player.pebbleLand.announced) {
        player.pebbleLand.announced = true;
        for (const g of guards) g.hearNoise(player.pebbleLand.x, player.pebbleLand.y, PEBBLE_HEAR_RADIUS);
        audio.clank();
      }
    }

    // Orbs.
    if (collectOrbs(player, state.orbs)) {
      audio.orb();
      if (player.orbsCollected >= ORBS_PER_LEVEL) state.exitOpen = true;
    }

    // Guards.
    let worst = "PATROL";
    let maxS = 0;
    for (const g of guards) {
      g.update(dt, player, level, () => audio.chase());
      if (g.state === "suspicious" && g.suspicion > 0.35 && suspBeepCooldown <= 0) {
        audio.suspicious();
        suspBeepCooldown = 1.2;
      }
      maxS = Math.max(maxS, g.suspicion);
      if (g.state === "chase") worst = "CHASE";
      else if (g.state === "suspicious" && worst !== "CHASE") worst = "SUSPICIOUS";
      if (g.catches(player)) {
        caught();
        return;
      }
    }
    state.danger = worst;
    state.maxSuspicion = maxS;

    // Exit: only open when all orbs are collected.
    if (state.exitOpen) {
      const e = level.exit;
      if (
        player.x > e.x - 10 &&
        player.x < e.x + e.w + 10 &&
        player.y > e.y - 10 &&
        player.y < e.y + e.h + 30
      ) {
        finishLevel();
      }
    }
  }

  function handleMenuKeys() {
    if (input.pressed("ArrowUp") || input.pressed("KeyW")) {
      state.menuIndex = (state.menuIndex + 2) % 3;
      audio.click();
    }
    if (input.pressed("ArrowDown") || input.pressed("KeyS")) {
      state.menuIndex = (state.menuIndex + 1) % 3;
      audio.click();
    }
    if (input.pressed("Space") || input.pressed("Enter")) {
      audio.unlock();
      audio.click();
      if (state.menuIndex === 0) startLevel(state, 0);
      else if (state.menuIndex === 1) state.screen = "howto";
      else state.screen = "credits";
    }
    if (input.mouse.clicked) {
      // Click a menu row: rows are centred at y = 400, 444, 488.
      const row = Math.floor((input.mouse.clickY - 380) / 44);
      if (row >= 0 && row < 3 && Math.abs(input.mouse.clickX - WORLD_W / 2) < 140) {
        state.menuIndex = row;
        audio.unlock();
        if (row === 0) startLevel(state, 0);
        else if (row === 1) state.screen = "howto";
        else state.screen = "credits";
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Shot mode renders frozen scenes: time never advances, so petals,
    // fireflies, lantern flicker and orb bob are identical on every
    // re-shoot of the same ?shot= scene.
    if (!state.shotMode) time += dt;

    if (!state.shotMode) {
      if (input.pressed("KeyM")) audio.toggleMute();
      if (state.screen === "start") {
        handleMenuKeys();
      } else if (state.screen === "howto" || state.screen === "credits") {
        if (input.pressed("Space") || input.pressed("Enter") || input.pressed("Escape") || input.mouse.clicked) {
          state.screen = "start";
        }
      } else if (state.screen === "play") {
        if (input.pressed("KeyP")) {
          state.screen = "paused";
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        } else {
          updatePlay(dt);
        }
      } else if (state.screen === "paused") {
        if (input.pressed("KeyP")) state.screen = "play";
        else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "levelcomplete") {
        if (input.pressed("Space") || input.pressed("Enter")) {
          startLevel(state, state.levelIndex + 1);
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "victory") {
        if (input.pressed("Space") || input.pressed("Enter")) startLevel(state, 0);
        else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "caught") {
        if (input.pressed("Space") || input.pressed("Enter")) {
          startLevel(state, state.levelIndex);
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      }
    }

    // Draw the current screen: sync the 3D garden, render it, then
    // drive the DOM HUD / screens / minimap on top.
    if (renderer) {
      renderer.sync(state, time);
      renderer.render();
    }
    showScreen(state, time);
    updateHud(state);
    if (state.screen === "play" || state.screen === "paused") drawMinimap(state);

    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
