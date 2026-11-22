// hud.js — the DOM overlay: HUD panels, the 2D minimap and the full
// screens (start, how-to, credits, pause, level-complete, victory,
// caught). The 3D garden lives in render.js; this file only drives the
// DOM on top of it (index.html holds the elements).

import { WORLD_W, WORLD_H, ORBS_PER_LEVEL } from "./config.js";

const $ = (id) => document.getElementById(id);
let pebbleSlotsBuilt = false;
let lastScreen = null;

export function updateHud(state) {
  const hud = $("hud");
  if (!hud) return;
  const playing = state.screen === "play" || state.screen === "paused";
  hud.style.display = playing ? "block" : "none";
  if (!playing) return;
  $("hud-level").textContent = `LEVEL ${state.levelIndex + 1} OF 3`;
  $("orbs-panel").textContent = `ORBS COLLECTED: ${state.player.orbsCollected} / ${ORBS_PER_LEVEL}`;
  const mm = Math.floor(state.levelTime / 60);
  const ss = String(Math.floor(state.levelTime % 60)).padStart(2, "0");
  $("time-panel").textContent = `TIME ${mm}:${ss}`;
  const mode = $("stealth-mode");
  // One status vocabulary only: this panel reports the sneak switch,
  // never a second danger word next to the DANGER METER.
  mode.textContent = state.player.sneaking ? "SNEAK: ON" : "SNEAK: OFF";
  mode.style.color = state.player.sneaking ? "#b8f5d0" : "#e8f0ff";
  if (!pebbleSlotsBuilt) {
    const wrap = $("pebble-slots");
    for (let i = 0; i < 5; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.textContent = "●";
      wrap.appendChild(d);
    }
    pebbleSlotsBuilt = true;
  }
  const slots = $("pebble-slots").children;
  for (let i = 0; i < slots.length; i++) {
    slots[i].classList.toggle("empty", i >= state.player.pebbles);
  }
  const status = $("danger-status");
  status.textContent = `STATUS: ${state.danger}`;
  const col = state.danger === "CHASE" ? "#ff4d4d" : state.danger === "SUSPICIOUS" ? "#ff9a3c" : "#b8f5d0";
  status.style.color = col;
  // The meter always shows the true highest suspicion (0..1), in every
  // state — never a pinned value — so the player can tell how close a
  // chase is. In CHASE suspicion is 1, so the bar reads full.
  const frac = state.maxSuspicion || 0;
  const fill = $("danger-fill");
  fill.style.width = `${Math.max(4, 100 * frac)}%`;
  fill.style.background = col;
  $("hint-line").style.display = state.levelIndex === 0 && state.levelTime < 12 ? "block" : "none";
}

export function drawMinimap(state) {
  const cv = $("minimap");
  if (!cv || !state.level) return;
  const g = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  const sx = W / WORLD_W;
  const sy = H / WORLD_H;
  g.fillStyle = "#2a5a34";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#3a7a94";
  for (const p of state.level.ponds) g.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy);
  g.fillStyle = "#3f8a4a";
  for (const b of state.level.bamboo) g.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
  g.fillStyle = "#5a6068";
  for (const r of state.level.rocks) g.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
  g.fillStyle = "#ff5a4d";
  g.fillRect(state.level.exit.x * sx - 3, state.level.exit.y * sy - 2, 16, 8);
  for (const o of state.orbs) {
    if (o.taken) continue;
    g.fillStyle = "#ffd23c";
    g.beginPath();
    g.arc(o.x * sx, o.y * sy, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255, 210, 60, 0.5)";
    g.lineWidth = 3;
    g.stroke();
  }
  for (const gd of state.guards) {
    g.fillStyle = gd.state === "chase" ? "#ff2d2d" : gd.state === "suspicious" ? "#ff8c1a" : "#ffc93c";
    g.beginPath();
    g.arc(gd.x * sx, gd.y * sy, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#b8f5d0";
  g.beginPath();
  g.arc(state.player.x * sx, state.player.y * sy, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#fff";
  g.lineWidth = 2;
  g.stroke();
}

export function showScreen(state, time) {
  const name = state.screen;
  if (name !== lastScreen) {
    for (const el of document.querySelectorAll(".screen")) el.style.display = "none";
    const map = {
      start: "screen-start",
      howto: "screen-howto",
      credits: "screen-credits",
      levelcomplete: "screen-levelcomplete",
      victory: "screen-victory",
      caught: "screen-caught",
      paused: "screen-paused",
    };
    const id = map[name];
    if (id) $(id).style.display = "block";
    if (name === "levelcomplete" || name === "victory") {
      const s = state.levelStats;
      const text = `ORBS: ${s.orbs} / 3      TIME: ${s.time}      PEBBLES THROWN: ${s.pebbles}`;
      const el = $(name === "levelcomplete" ? "lc-stats" : "vic-stats");
      if (el) el.textContent = text;
    }
    lastScreen = name;
  }
  // Menu selection highlight + pulsing PRESS SPACE.
  if (name === "start") {
    const rows = document.querySelectorAll("#start-menu div");
    rows.forEach((row, i) => {
      const sel = i === (state.menuIndex || 0);
      row.classList.toggle("sel", sel);
      row.textContent = (sel ? "> " : "") + ["START GAME", "HOW TO PLAY", "CREDITS"][i];
    });
    const press = $("press-space");
    // Pulsing but never dim: the call to action stays readable.
    if (press) press.style.opacity = String(0.9 + Math.sin(time * 2.5) * 0.1);
  }
}
