# Moss & Shadow

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/ryukiheun/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/ryukiheun/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An original top-down stealth game for the [best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) bounty on make.fun.

You are a fox spirit slipping through a moonlit shrine garden. Stone-lantern guardians patrol with golden vision cones. Hide in the bamboo, lure guards away with thrown pebbles, collect all 3 sacred orbs, then reach the torii gate EXIT. Three levels, rising difficulty.

## How to play

- **WASD / Arrow keys** — move
- **Shift** — sneak (slower, harder to spot, quieter: guards hear walking within 70 px but sneaking only within 26 px)
- **Click** — throw a pebble; guards investigate the CLANK
- **P** — pause, **M** — mute, **Esc** — main menu
- **Space / Enter** — advance: start the game, go to the next level, play again after victory, or retry after being caught. On the start screen, Up/Down (or W/S) move the menu selection; you can also click a menu row.

Guard states: **PATROL** (gold cone) → **SUSPICIOUS** (orange cone, `?`) → **CHASE** (red cone, `!`). Suspicion is a 0–1 meter per guard: it fills while you are inside a cone with line of sight, drains when you are unseen (faster in bamboo, which blocks sight), turns a guard suspicious above 0.35, and chases at 1. A chase gives up after 3.0 s without sight, and the guard returns to suspicious, then patrol. A guard that touches you catches you — hiding blocks sight only, never touch.

- **Bamboo thickets** — hide inside; guards cannot see you there, your footsteps are muffled, and guards walk around a thicket instead of through it. No patrol route runs right along a thicket edge, so hiding is safe — a guard will not brush past you.
- **Rocks** — block a guard's line of sight and block movement for you and for guards.
- **Ponds** — block movement, but not sight.
- **Pebbles** — 5 per level, one in flight at a time, 0.45 s flight, heard by guards within 330 px. A guard that hears a clank walks to the noise point and looks around. Clicks do nothing when you have no pebbles left or one is already flying.
- **Orbs and the exit** — collect all 3 orbs and the torii gate EXIT opens (its glow turns green). Touching the gate then finishes the level. There is no stealth check at the gate itself: a chased fox that reaches it still escapes, so the only lose condition is being touched.

The HUD shows the level (`LEVEL n OF 3`), the orb counter (`ORBS COLLECTED: n / 3`), a level timer, a sneak indicator (`SNEAK: ON/OFF`), five pebble slots, a live mini-map (guards as gold/orange/red dots, orbs, the exit, and you), and a DANGER METER that always shows the highest suspicion of any guard (`STATUS: PATROL / SUSPICIOUS / CHASE`). The game flows through eight screens: start, how to play, credits, play, paused, level complete, victory, caught.

Levels: **1 Moonlit Garden** (2 guards, 52 px/s patrol, 200 px/s chase, 215 px cones), **2 Bamboo Thicket** (3 guards, 68 px/s, 220 px/s chase, 255 px cones), **3 Shrine of Lanterns** (4 guards, 84 px/s, 240 px/s chase, 295 px cones). Chase speed is always above your 165 px/s walk speed, so a chase can catch a fox that only runs — break line of sight in bamboo or behind a rock instead. Bamboo cover is about the same area on levels 1 and 2 (56,500 vs 57,400 px²) and a little less on level 3 (53,600 px²).

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No runtime build step and no network requests: the game is plain static files, three.js is vendored locally in the repo, and all sounds are procedural WebAudio. `main.ts` is only the submission assembler — it copies `game/` and `screenshots/` into the output directory and writes `dossier.json`. All art is built from 3D primitives in code (three.js WebGL 3D) with a DOM HUD on top; all sounds are made with the WebAudio API.

## Layout

- `game/index.html` — the page: three.js canvas plus the DOM HUD and screens
- `game/vendor/three.module.min.js` — vendored three.js (minified build, MIT)
- `game/src/config.js` — the main tuned constants, each defined with units
- `game/src/levels.js` — the three shrine-garden layouts (guards, orbs, bamboo, rocks, ponds, exit, spawn)
- `game/src/guard.js` — guardian AI: patrol / suspicious / chase, vision cones, line of sight, footstep hearing, obstacle collision
- `game/src/player.js` — the fox: movement, sneaking, pebbles, orbs, noise radius
- `game/src/render.js` — the 3D garden: three.js scene, actors, cones, orbs, torii, moon, petals
- `game/src/hud.js` — DOM HUD, mini-map and full screens
- `game/src/audio.js` — procedural WebAudio sound effects (orb, clank, footsteps, alarm, chase, victory, caught)
- `game/src/input.js` — keyboard + mouse state
- `game/src/shots.js` — deterministic `?shot=` screenshot states
- `game/src/main.js` — game loop and screen states
- `serve.ts` — tiny static server for local play
- `shots.json` — the four screenshot names and their `?shot=` queries
- `main.ts` — builds `/output` (game + screenshots + dossier.json)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders of the game (see `shots.json`)

## Screenshots

`?shot=play`, `?shot=start`, `?shot=chase`, `?shot=victory` render frozen, reproducible scenes of the game itself. Shot mode freezes the animation clock, so the same query renders the same frame on every re-shoot.

## Notes on the code comments

Comments in the source cite short tags such as `(M1)` or `(N-a)`. Those are fix-round cross-references from the screenshot-critique rounds during development (M = a readability or staging fix, N = a nit, B = a blocker from the pre-submit review); they are internal notes, not gameplay terms.

## License

MIT — see [LICENSE](LICENSE).

Built by [ryukiheun](https://github.com/ryukiheun) for make.fun. Referral code: `r5cs55h2`.
