# Consolidated review report — Moss & Shadow (best-stealth-game-20261121-1759)

- Entry: `~/workspace/makefun/best-stealth-game-20261121-1759/`, HEAD `836b73f`
- Date: 2026-11-22 ~05:30 KST (deadline 14:59 KST same day)
- Reviewers: 8 fresh-context EGM Goldfish leaves, read-only, no code executed
  (zoom-out, inventive-catalyst, comprehension, design critic, structural,
  style, implementation-readiness, codebase-details)
- Target: `README.md` + game source (`game/`, `main.ts`, `shots.json`) + 4 screenshots

## Verdict: NOT submittable as-is — fix the Blockers first

- **Blocker: 11 / Major: 30 / Nit: 11 / False alarms (adjudicated): 7**
- The game is complete and playable, and no gate rule fails on what reading
  can establish (static files, no network, vendored three.js, LICENSE, badges).
  What blocks submission is not the gate — it is (a) the README flatly
  misdescribing the technology, (b) four small real bugs that are each a
  one-line to one-hour fix, (c) two level-design bugs (guard spawn /
  waypoint placement), and (d) staging: the signature pebble lure appears
  in none of the 4 screenshots, and the fox is hard to read in the play shot.
- The two big design items (chase speed, footstep noise) need a builder
  session + a playtest; everything else on the Blocker list is cheap.
- **Do not fix code in this review session.** Fixes need a builder session
  (its transcript goes into the bundle). After fixes: re-shoot screenshots,
  re-run `main.ts`, re-run bundle + kit check + presubmit.

## How to read this report

- **REAL BUG** = code is wrong; the quoted lines prove it.
- **DOC DEFECT** = code is correct, README/comment is wrong.
- **DESIGN** = works as written, but the design choice hurts the score.
- Every finding was checked against the code (오답노트 rule 10). Claims
  the reviewers made that do not survive a code check are in
  "False alarms" at the end — do not "fix" those.

## Blockers (fix before submit)

### B1 — README tech stack is false [DOC DEFECT]
- `README.md` "Run it": "All art is drawn in code on canvas … Vanilla
  JavaScript + Canvas 2D." And Layout: "`game/index.html` — the page,
  canvas only."
- Code: `game/index.html:7-9` import map `"three": "./vendor/three.module.min.js"`;
  `game/src/render.js:1` `import * as THREE from "three"` + `THREE.WebGLRenderer`,
  `PerspectiveCamera`, shadows, fog, ACES tone mapping. The in-game credits
  screen itself says "All art built from 3D primitives in code."
- All 8 reviewers found this independently. A judge comparing the README to
  the dossier outline sees a false claim about the core tech.
- Fix: rewrite the Run-it paragraph and Layout lines to "three.js WebGL 3D
  + DOM HUD", list `game/vendor/three.module.min.js`, `serve.ts`,
  `shots.json`, root `vendor/makefun-game.ts` in Layout. Also fix
  "No build step" → "no runtime build step; three.js is vendored locally;
  `main.ts` assembles the submission output", and "no external assets" →
  "no network requests; three.js is vendored in-repo".

### B2 — Chase can never catch a walking player [REAL BUG, tuning]
- `game/src/config.js`: `PLAYER_WALK_SPEED = 165` px/s.
  `game/src/levels.js`: patrol 52 / 68 / 84 px/s.
  `CHASE_SPEED_MULT = 1.55` → chase 80.6 / 105.4 / 130.2 px/s on all
  three levels — slower than walking on every level. Chase also targets
  `lastSeen`, not an intercept point (`guard.js`, chase branch).
- Consequence: on detection the optimal play is "walk away in a straight
  line". The fail state is reachable only if the player stands still or
  is cornered. Criteria (2) and (3) lose their teeth.
- Fix (builder decision + playtest required): make chase faster than walk
  on all levels, e.g. chase speed = `max(patrol × 1.55, 185)` px/s, and
  playtest level 1 to confirm it stays escapable via bamboo / line of
  sight rather than raw speed. Do not just raise the multiplier to 3.2 —
  that makes level 1 brutal. Verify with a real playthrough after the change.

### B3 — Esc on the pause screen resumes play instead of going to the menu [REAL BUG]
- `game/src/main.js`, paused branch:
  `if (input.pressed("KeyP") || input.pressed("Escape")) state.screen = "play";`
- `game/index.html` pause screen says "Press P to resume • Esc for the
  main menu", and `README.md` says "Esc — main menu". Esc → menu works
  only from the play screen. From pause, Esc silently resumes — possibly
  mid-chase.
- Fix: in the paused branch, `KeyP` resumes, `Escape` goes to start/menu.

### B4 — Level-2 guard 1 spawns inside a rock [REAL BUG]
- `game/src/levels.js`, level 2 guards[1]:
  waypoints `[[760, 520], [760, 220], [1080, 220], [1080, 520]]`, `start: 1`
  → spawn `(760, 220)`. Level 2 rocks: `{ x: 730, y: 180, w: 70, h: 70 }`
  → x 730–800, y 180–250. The spawn is inside it.
- Side effect: `guard.js` `hasLineOfSight` — a segment starting inside a
  rock hits it, so this guard's sight is blocked until it walks out.
- Fix: move the spawn/waypoint out of the rock (and check all 9 guard
  starts — reviewers checked, only this one is inside a rock/pond).

### B5 — Level-2 patrol waypoint sits 20 px from the player spawn [REAL BUG]
- `game/src/levels.js`, level 2 guard 3: waypoints `[[640, 90], [640, 640]]`;
  player spawn `{ x: 640, y: 660 }` — 20 px from the `(640, 640)` waypoint.
- `CATCH_DISTANCE = 26` (`config.js`); `main.js` checks `g.catches(player)`
  every frame. An idle player at spawn is caught ~8 s after level start
  (guard walks 550 px at 68 px/s). Detection precedes the catch (the cone
  faces the player on approach), so it is a spawn-placement defect, not an
  unseen insta-catch — still a defect.
- Fix: move the waypoint (or the spawn) so no patrol route passes within
  catch distance of the spawn.

### B6 — Shipped debug/cheat handle `window.__moss` [REAL BUG]
- `game/src/main.js` (`main()`): `window.__moss = { state, input, startLevel }`.
  Anyone opening the console can inspect and mutate live state and drive
  levels. Remove before submission.

### B7 — Guards walk through rocks, ponds and bamboo; waypoints sit inside obstacles [REAL BUG]
- `game/src/guard.js` `moveToward()` / `walkWaypoints()` have no obstacle
  check; `game/src/player.js` `blocked()` stops the player at rocks/ponds/
  border. Rocks block guard *sight* (`hasLineOfSight`) but not guard
  *movement*. A chasing guard cuts straight through the rock the player
  just used as cover, and `catches()` (pure distance) can catch the player
  through a rock it never saw through.
- Concrete crossings (`levels.js`):
  - L1 guard 2 `(1120, 250) → (1120, 480)` crosses pond `{x:1080, y:420, w:130, h:80}`;
    waypoint `(1120, 480)` is inside that pond.
  - L2 guard 1 `(760, 220) → (1080, 220)` crosses rock `{x:730, y:180, w:70, h:70}`
    (starts inside it — see B4); waypoint `(560, 180)` sits inside bamboo
    `{x:380, y:90, w:200, h:110}`.
  - L3 guard 4 `(1100, 620) → (1100, 120)` crosses pond `{x:1050, y:500, w:140, h:90}`;
    its `(180, 120) → (180, 620)` leg crosses pond `{x:90, y:120, w:140, h:90}`;
    paths graze rock edges (`y=120` vs rock `{x:860, y:120, …}`).
  - L3 guard 3 diagonal `(640, 80) → (240, 640)` crosses bamboo
    `{x:430, y:260, w:180, h:110}`.
- Fix, minimum: move every waypoint/path leg off obstacles (the list above)
  so no patrol route crosses a rock/pond/bamboo. Fix, ideal: give guards
  the same collision as the player (shared `blocked()` helper + a
  steer/slide fallback so a chasing guard does not get stuck on a corner).
  The ideal fix is the better one, but it needs a playtest; the minimum
  fix is required either way.

### B8 — Footstep-noise system is built but never wired; README "quieter" is false [REAL BUG + DOC DEFECT]
- `game/src/config.js`: `PLAYER_NOISE_WALK = 70` / `PLAYER_NOISE_SNEAK = 26`.
  `game/src/player.js` computes `player.noiseRadius` every frame. Nothing
  ever reads it: `guard.js` `seesPlayer()` is vision-only, `hearNoise()` is
  pebble-only, `main.js` never consults it. `game/src/audio.js` has no
  footstep sound (orb/clank/suspicious/chase/victory/caught/click only).
- Walking at full speed 15 px behind a guard is exactly as quiet as
  sneaking. Bounty criterion (3) explicitly lists "footsteps".
- Fix, either (builder decision): (a) wire it — guards within `noiseRadius`
  turn toward the noise / gain suspicion, plus a footstep sound and a
  visible noise ring; needs tuning so normal walking is not punished
  everywhere; or (b) remove the claim and the dead constants — delete
  "quieter" from the README and `noiseRadius`/`PLAYER_NOISE_*` from the
  code. Do not ship a dead system presented as a feature.

### B9 — The signature pebble lure is invisible in all 4 screenshots [STAGING]
- The pebble is the one mechanic that distinguishes this from "walk behind
  cones" clones. `game/src/shots.js` `buildShotState` sets no
  `pebbleFlight`/`pebbleLand` for `play` or `chase`, and `1-play.jpg` /
  `3-chase.jpg` show no pebble, no CLANK ring, no guard turning toward a
  noise point.
- Fix (staging only, no feature work): stage the `play` shot with a pebble
  mid-flight and the guard's cone swinging toward the clank point. The
  machinery exists (`render.js` draws `pebbleMesh`/`clankRing` from state).
  Keep the pose reachable in real play.

### B10 — Victory shot: fox is a thin sliver, third orb not separable [STAGING]
- `screenshots/4-victory.jpg` + `shots.js` victory block (orb ring
  `[535,260],[640,130],[745,260]`, fox at `640,220`) + `render.js` `sync()`:
  victory camera pulls back, fox `baseScale` drops to `1.0` (vs `1.35` in
  play), cones hidden. Result: fox nearly invisible, only 2 orbs clearly
  visible (third hides behind the torii/title glow), "LEVEL COMPLETE" /
  stats text sits across the torii.
- Fix: re-stage the victory shot — fox larger/closer, orbs separated from
  the torii glow — and re-shoot.

### B11 — Play shot: fox and guard unreadable at a glance [STAGING]
- `screenshots/1-play.jpg` (`shots.js` play block: fox `720,580`, guard0
  `760,390`, suspicious): the fox reads as a white triangle with no
  visible ears/legs/tail from the oblique camera, and the `?` bubble floats
  over bamboo with its guard hard to locate. The cone reads; the actors
  do not. Criteria (1) and (4) are judged largely from this image.
- Fix: re-stage / adjust fox scale/pose or camera for the play shot and
  re-shoot; verify by viewing the new shot shrunk (the judge sees a
  contact sheet).

## Majors

### M1 — `render.js` is the god file: 3D scene + DOM HUD + minimap + screens [REAL, structure]
- `game/src/render.js` (~1000 lines, ~4–5× the next-largest file) builds the
  3D scene (`buildLevel`), per-frame `sync()`, DOM HUD (`updateHud`),
  minimap (`drawMinimap`), screen switching (`showScreen`). `README.md`
  Layout calls it just "all drawing". Criterion (5) wants one job per file.
- Fix: split the DOM part into `hud.js` (or `screens.js`) if a builder
  session can do it safely with a playtest; at minimum correct the README
  line to describe what the file actually does. Do not split without
  re-testing — a late refactor that breaks the game is worse than a big file.

### M2 — Dead export: `COLORS` in `config.js` is imported by nothing [REAL, dead code]
- 24-entry `COLORS` object ("Colours (hex strings, canvas fills)") is never
  imported. `render.js` imports only `WORLD_W, WORLD_H, ORBS_PER_LEVEL` and
  hardcodes its own hex values — and they diverge: cone `0xffc93c` vs
  `COLORS.gold #ffd76a`; orb mesh `0xffb300` vs `COLORS.orb #ffe98a`;
  ground `0x2a4d33` vs `COLORS.grass #1d3a28`. `goldDim` is an `rgba()`
  string, not a hex string as the comment claims.
- Fix: delete `COLORS` (cheapest) or use it as the single palette source.

### M3 — Dead code: `makeStars()` / `state.stars` never read [REAL, dead code]
- `game/src/main.js` `makeStars()` builds 70 stars into `state.stars`;
  nothing reads it — `render.js` `buildLevel` builds its own 120-star
  `THREE.Points` sky. Fix: delete the function and the state field.

### M4 — Detection-time comment wrong by ~2× [DOC DEFECT in code]
- `game/src/config.js` comment: "running close fills in ~1 s, sneaking far
  away in ~4 s." Math from the same file: close `1.1`/s → ~0.9 s ✓.
  Sneaking far: `0.28 × 0.45 = 0.126`/s → ~7.9 s to fill (5.7 s even with
  the suspicious 1.4×). "~4 s" matches *walking* far (1/0.28 ≈ 3.6 s).
- Fix: correct the comment to ~8 s sneaking far / ~3.6 s walking far.

### M5 — Start-menu mouse clicks assume a fixed 1280×720 window [REAL BUG]
- `game/src/main.js` `handleMenuKeys`: `row = Math.floor((clickY - 380) / 44)`,
  `|clickX - WORLD_W/2| < 140`, with `clickY/clickX` scaled in `input.js`
  as if the window were exactly 1280×720. The menu is responsive DOM, so
  on any other window size clicks land on the wrong row or miss. Keyboard
  (Space/arrows) still works, so play is not blocked.
- Fix: compute the row from the DOM menu rows' `getBoundingClientRect()`
  instead of hardcoded world-y bands.

### M6 — Danger meter lies in SUSPICIOUS [REAL BUG]
- `game/src/render.js` `updateHud`:
  `frac = danger === "CHASE" ? 1 : danger === "SUSPICIOUS" ? 0.55 : maxSuspicion`.
  In SUSPICIOUS the bar is pinned at 55% whether real suspicion is 0.36
  or 0.99 — the player cannot tell how close a chase is. In PATROL it
  shows the true value, so the meter's meaning changes silently by state.
- Fix: always show `maxSuspicion`.

### M7 — Bamboo is a perfect, unsearchable safe-room [REAL, design]
- `guard.js` `seesPlayer()`: `if (player.hidden) return 0`. A guard in
  chase moves only to `lastSeen`, which is only ever set when the player
  was visible — never inside bamboo — so no guard ever enters bamboo to
  search. Suspicion drains there for free. Hiding is also binary on the
  centre point: 1 px inside = fully hidden.
- Fix (optional, moderate): guards investigate the last-seen point near
  bamboo / sweep a thicket after losing the player. Or accept as a known
  limitation and do not claim otherwise.

### M8 — Suspicious guard stands and stares; no rear/proximity awareness [REAL, design]
- Suspicious only turns to face `lastSeen` and waits; it never walks to
  investigate what it saw unless a pebble set `investigate`. And
  `seesPlayer()` returns 0 outside the cone with no proximity radius, so
  standing 30 px directly behind a guard (outside the 26 px catch distance)
  is permanently invisible and inaudible. Patrol keeps walking waypoints
  while suspicion fills, so the cone can sweep away from a half-seen
  player on its own.
- Fix (optional, moderate): suspicious walks toward `lastSeen`; add a small
  proximity sense. Or accept.

### M9 — Pebbles are useless exactly when needed, and unlimited-range everywhere else [REAL, design]
- `guard.js` `hearNoise()`: `if (this.state === "chase") return` — during a
  chase the only distraction tool does nothing. `throwPebble()` has no
  range limit and `main.js` raycasts any click to the floor, so one pebble
  can pull a guard from 1,000 px away in a fixed 0.45 s. Hear radius is
  330 px (~26% of map width). A pebble never raises suspicion, so after
  arriving the guard stares 2.2 s and walks back.
- Fix (small): cap throw range, add a suspicion bump on arrival so the
  lure has a cost/aftermath. Whether pebbles should distract a chasing
  guard is a design decision — decide it and document it.

### M10 — Pebbles are never required and are too plentiful [REAL, design]
- 5 pebbles per level, refreshed every level, no pickups, no carryover. No
  orb sits in permanent cone coverage, so every orb can be taken by timing
  alone. The pebble is optional convenience in all 3 levels.
- Accept as a known limitation, or make one orb per level require a lure.
  (Scope decision — do not redesign levels this late without a playtest.)

### M11 — Difficulty curve is non-monotonic and parameter-only [REAL, design]
- Guard speed/cone/count rise (L1 2×52 px/s, 215 px, 0.48 rad; L2 3×68,
  255, 0.62; L3 4×84, 295, 0.72), but bamboo cover area goes
  L1 56,500 px² → L2 83,500 px² (+48%) → L3 53,600 px². Level 2 gives far
  *more* hiding cover than level 1 while adding only one guard. No level
  adds a mechanic, enemy type, or objective. L3 orbs sit almost on patrol
  routes (e.g. L3 orb `(640,130)` is 10 px from guard 4's top edge `y=120`;
  orb `(130,330)` is 50 px from its `x=180` edge). `config.js` admits
  playtesting covered only levels 1–2 — level 3 is the untested level.
- Fix (small): cut L2 bamboo area and/or move the two L3 orbs a little off
  the patrol lines; playtest level 3 at least once.

### M12 — Detection timing is binary; no graduated warning [REAL, design]
- Close walking: suspicion hits 0.35 in 0.32 s and chase in ~0.74 s
  (suspicious fill ×1.4). Far sneaking: full meter ~7.9 s. The near-miss
  band is either a sub-second ambush or a ~6.5 s far sneak with no
  pressure. No feedback before the 0.35 threshold: `main.js` plays
  `audio.suspicious()` only once `suspicion > 0.35`, and a brief far-edge
  graze that never reaches 0.35 produces no feedback at all (and drains at
  0.35/s, faster than the 0.28/s far fill rate).
- Accept, or add earlier feedback (e.g. a soft tick as suspicion rises).
  Small fix, optional.

### M13 — Perfect information removes the need to learn patrols [DESIGN, accept]
- `drawMinimap()` plots every guard (colour-coded by state), every untaken
  orb, the exit and the player live, with no delay or fog — plus always-
  visible cones and the danger meter. The player reads dots instead of
  observing patrols. This is a design choice; the minimap is also a
  judge-visible feature. Accept, or add fog/delay. Do not remove it late.

### M14 — One touch = full level restart, no lives or checkpoint [DESIGN, accept]
- `main.js` `caught()` → Space restarts the whole level: orbs, pebbles,
  time reset. No HP, no mercy invulnerability, no checkpoint after 2/3
  orbs. A late catch erases a full clear plus a cross-map return trip.
  Harshness paired with B2/B8 (the game is otherwise easy to escape) makes
  failure feel arbitrary rather than earned. Accept as a design choice, or
  add a checkpoint. Do not redesign this late without a playtest.

### M15 — No time, score or stealth-rating pressure: waiting is costless [DESIGN]
- `levelTime` is displayed only; victory stats report orbs/time/pebbles,
  no grade, par time, or detection count. Patrols are fixed loops with no
  randomisation, dwell, or escalation, so waiting indefinitely is optimal.
- Accept, or add an "Unseen" grade (finish without a chase) on the victory
  screen — cheap, and it prices patience. Optional.

### M16 — All 4 screenshots show the same level; victory has no cones [STAGING]
- `shots.js`: play and chase are both level 2; start is a level-1 backdrop;
  victory is level 2 with orbs repositioned. The difficulty curve and the
  L1 opening are invisible to a judge scoring on screenshots + outline.
  `render.js` `sync()` hides all cones on the victory screen, so 1 of 4
  shots shows no stealth elements. In both gameplay shots the two
  non-featured guards face north/off-frame, so only one cone reads clearly
  per shot — criterion (1)'s "guards with vision cones" (plural) is
  under-evidenced in the images.
- Fix (staging): pose the non-featured guards so at least two cones read
  per gameplay shot; keep level 2 for the gameplay shots (it shows the
  most), and describe levels 1/3 in the README so the outline carries them.

### M17 — Guard cone snaps 90° instantly at waypoints [REAL, small]
- `faceTarget()` sets `angle` directly to the next waypoint; `moveToward()`
  sets `angle = atan2(dy, dx)` every step. No turn rate or sweep — the cone
  teleports across a corner with no telegraph. Accept, or add turn-rate
  smoothing (moderate). Optional.

### M18 — Chase-alarm cooldown does nothing for the chase sound [REAL, dead logic]
- `main.js` `updatePlay()`: on chase start it sets `alarmCooldown = 1.5`,
  but the chase sound already fired via the `onChaseStart` callback inside
  `guard.update()` earlier in the same iteration; the cooldown only gates
  the suspicious beep. Simultaneous chases overlap their alarms.
- Fix: delete the dead cooldown or gate the chase sound through it.

### M19 — Stale investigate point survives a chase [REAL, minor]
- `hearNoise()` sets `this.investigate`; the chase branch never clears it.
  When a chase ends (`loseTime > 3.0` → suspicious, suspicion 0.5), the
  guard resumes walking to the pre-chase noise point, which may be long stale.
- Fix: clear `investigate` on chase start (one line).

### M20 — README omits HUD features, menu flow, investigate, ponds, pebble limits [DOC DEFECT]
- Never mentioned: mini-map, danger meter / STATUS, level timer, orb
  counter, pebble slots, sneak indicator (all in `index.html` HUD and
  `render.js` `updateHud`/`drawMinimap`, all visible in `1-play.jpg` /
  `3-chase.jpg`); the 8-screen flow and menu navigation (arrows/WASD,
  Space/Enter, click a row); the investigate behaviour (4th guard
  behaviour — pebble sends a suspicious guard walking to the noise point);
  suspicion as a 0..1 meter (chase at 1, suspicious above 0.35, drains
  when unseen, chase gives up after 3.0 s); ponds block *movement* but not
  sight; pebble limits (5/level, one in flight, 0.45 s flight, 330 px hear
  radius, clicks do nothing with no pebbles left).
- Fix: expand "How to play" to cover all of the above. Cheap, high value —
  the README is what a human reviewer reads first.

### M21 — README Layout omits files the entry ships [DOC DEFECT]
- Lists 11 entries but omits `serve.ts` (the file "Run it" tells the reader
  to run), `game/vendor/three.module.min.js`, `shots.json`, and root
  `vendor/makefun-game.ts` (imported by `main.ts` as `buildDossier`).
- Fix: list them (part of B1's README rewrite).

### M22 — "No build step" / "no external assets" mislead [DOC DEFECT]
- `main.ts` *is* a build/assembly step (copies `game/` + `screenshots/`,
  writes `dossier.json` via `vendor/makefun-game.ts`). three.js is an
  external library, vendored locally. "No build step" is true only of the
  game at runtime; "no network requests" holds only because it is vendored.
- Fix: reword (part of B1's README rewrite).

### M23 — "Slip through the torii gate EXIT unseen" overstates the win condition [DOC DEFECT]
- `main.js` exit check is purely positional: once `exitOpen` (3 orbs),
  touching the torii rectangle calls `finishLevel()`. No stealth check at
  the exit — a player being actively chased can run through the gate and
  win. The only lose condition is a guard touching the player.
- Fix: reword the README intro to "collect all 3 orbs, then reach the
  torii gate EXIT". (Or add a stealth requirement at the exit — a design
  change; do not do it late.)

### M24 — `?shot=` scenes are not frozen; `&seed=` is dead [DOC DEFECT + minor code]
- `README.md` "frozen, reproducible scenes"; `shots.js` header "shows the
  same frame every time". But `main.js` `frame()` does `time += dt`
  unconditionally, and `render.js` `sync(state, time)` animates petals,
  fireflies, lantern flicker, orb bob, `?`/`!` bob and exit glow off `time`
  in shot mode too. Guard/player *state* is deterministic; pixels are not.
  `parseShot()` returns `seed`, `buildShotState()` never uses it, `main.js`
  destructures only `{ shot }`; header "`&seed=`, ignored except for
  reproducibility" is self-contradictory.
- Fix (cheap, either): freeze time in shot mode (fixed `time` in `frame()`
  when `shotMode`), or correct the README/`shots.js` claims to "same
  layout every time". Note: the gate does not re-render the game (RULES:
  gate reads files only), so this is not a gate risk — it is a truthfulness
  fix. Prefer freezing time; it is one line and makes re-shoots exact.

### M25 — Tuned constants live outside `config.js` [DOC DEFECT]
- `README.md` Layout: "`config.js` — all tuned constants, each defined
  with units." Hardcoded elsewhere: suspicious fill multiplier `1.4`
  (`guard.js`), suspicion threshold `0.35` (twice in `guard.js`, once in
  `main.js`), close-range fraction `0.4` (`guard.js`), pebble-land lifetime
  `1.2` s (`player.js`, mirrored as `/1.2` in `render.js`). Suspicious drain
  is half-rate (`DETECT_DRAIN * 0.5`) with no mention in `config.js`.
- Fix: move the literals into `config.js` with definitions, or correct the
  README line to "the main tuned constants".

### M26 — Review codes `(M1)–(M9)`, `(N-a)–(N-e)`, `(B1)` have no legend [DOC DEFECT]
- `render.js`, `shots.js`, `index.html` comments cite codes with no defining
  file or README section. A fresh reader cannot decode them.
- Fix: add a one-paragraph legend to the README, or strip the codes.

### M27 — Playtest claim is uncalibrated [DOC DEFECT]
- `config.js` header: "±20% on the detection rates was hand-checked in
  playtests of level 1 and 2." No evidence in the repo, and level 3 — the
  tightest level — is explicitly excluded. Narrow the claim to what was
  actually checked, or drop it.

### M28 — `buildLevel` leaks materials/textures [REAL, minor]
- `render.js` `buildLevel` disposes geometries on rebuild but never
  disposes materials or `CanvasTexture`s — repeated level restarts
  accumulate GPU memory. Fix: dispose materials/textures alongside
  geometries. Optional; one play session will not notice.

### M29 — Player collision is centre-point only [REAL, minor]
- `player.js` `blocked()` tests the fox's centre against rocks/ponds,
  ignoring `PLAYER_RADIUS = 14`. The body can visibly overlap an obstacle
  edge by up to 14 px. Fix: radius-aware `blocked()`. Optional.

### M30 — Unknown `?shot=` silently falls back to live play [REAL, minor]
- `shots.js` `buildShotState` returns `null` for an unrecognised value and
  `main.js` loads the live start screen with no error. Fix: fall back to
  the `start` shot explicitly or show an error. Optional.

## Nits

### N1 — "Each defined with units" is not true of `config.js`
- `LEVEL_COUNT = 3`, `ORBS_PER_LEVEL = 3` carry no unit or reason;
  `CHASE_SPEED_MULT` and `DETECT_FILL_SNEAK_MULT` are unitless ratios,
  also unannotated — despite the file header promising "definition, unit
  and the reason for the value" for "every tunable number". Fix the header
  or annotate the ratios.

### N2 — Space/Enter are the advance keys but are undocumented in README controls
- Space/Enter advance start, level-complete, victory and caught screens
  (`main.js` frame handler; `index.html` "PRESS SPACE…" prompts), but the
  README control list omits them. Add one line (part of M20).

### N3 — Pebble at the player's own feet; sky clicks silent; no out-of-pebbles feedback
- `screenToWorld` returns `null` on sky clicks → silent no-op. Clicking on
  the fox throws a pebble at the player's own feet, luring guards to the
  player (no minimum throw distance). Clicks during flight or with 0
  pebbles are silently ignored (`throwPebble()` returns false; `main.js`
  ignores the return — no sound, only HUD slots emptying). Optional fixes:
  minimum throw distance; a click sound / shake on empty.

### N4 — `shots.js` duplicates `startLevel` state assembly
- Both `buildShotState` and `main.js` `startLevel` construct
  `{player, guards, orbs, exitOpen, levelTime, danger, …}` by hand. The
  `"start"` branch builds level-1 state, then rebuilds everything for
  level 0. Accept the duplication; do not refactor late.

### N5 — No aim preview for the pebble throw
- Click-to-throw has no trajectory preview, range ring, or landing marker
  before the click; in an oblique 3D view the player cannot reliably judge
  where a screen click lands. Optional: a faint landing marker while aiming.

### N6 — Minimap shows guard dots but no facing/cones
- `render.js` `drawMinimap` draws guard dots only. Optional: draw small
  cone wedges so facing reads on the minimap too.

### N7 — No ambient audio loop; SFX only
- `audio.js` has seven one-shot SFX and no music/ambience. Optional: one
  precomputed ambient loop (wind/insect drone).

### N8 — No persistence: no best time, no replay hook
- Stats live only in `state.levelStats`. Optional: a local best-time line
  on the victory screen.

### N9 — Pebble ignores obstacles; hearing ignores occlusion
- `throwPebble` flight is a straight lerp; `hearNoise` is distance-only.
  A pebble can be thrown through a rock and heard through a wall. Accept,
  or add line-of-sight/range falloff to the clank. Optional.

### N10 — Two orbs in the same frame collect one per frame
- `collectOrbs` returns after the first orb; the second is collected on the
  next frame. Harmless. Accept.

### N11 — No favicon
- `game/index.html` declares none; browsers request `/favicon.ico` and get
  a 404. Harmless, not a game-initiated fetch. Fix: add
  `<link rel="icon" href="data:,">` (one line).

## False alarms — checked against the code, do NOT "fix" these

### F1 — "`game/index.html` cannot be opened by double-click (file://)"
- Zoom-out reviewer's Blocker. Wrong: RULES.txt says the game is "served by
  any static HTTP server, game/index.html opens in desktop Chrome" — the
  gate serves over HTTP, and the kit's own starter uses the same module
  scripts. `README.md` itself gives the run path (`node serve.ts` →
  `http://localhost:8080`). No fix. Do not add a non-module fallback.

### F2 — Suspicion stuck / chase never ends / pebble lure freezes a guard
- Verified correct: patrol drains at 0.35/s when unseen; suspicious drains
  at 0.175/s and exits when `stateTime > 2.2` s and suspicion < 0.35;
  investigate always resolves (monotonic `moveToward`, arrival < 18 px
  clears it); chase exits when `loseTime > 3.0` s → suspicious at 0.5.
  The `guard.js` comment "a pebble lure on its own must not freeze a
  guard forever" holds.

### F3 — Slab-test `dx/dy ≈ 0` branches in `segmentHitsRect`
- Verified correct: containment test on the degenerate axis, `tmin/tmax`
  intact, t-swap logic right, segments starting inside a rect return true.

### F4 — Referral code in the README
- The playbook's README template requires `{referral_code}` filled
  (`r5cs55h2`). It is part of the submission, not promotion. Keep it.

### F5 — `main.ts` vs `game/src/main.js` name collision
- `main.ts` at the repo root is the entrypoint name the bounty mandates;
  it cannot be renamed. `shots.js` vs `shots.json` is fine. No fix.

### F6 — `catches()` ignores `player.hidden`
- A guard whose patrol passes within 26 px of a player hidden in bamboo
  still catches them. Consistent with the README's unconditional "A guard
  that touches you catches you" — hiding blocks sight only, never touch.
  Accepted behaviour, not a bug. (If B7's guard collision is ever built,
  revisit: a guard should not path into bamboo at all.)

### F7 — No WebGL fallback / AudioContext failure handling
- `new THREE.WebGLRenderer` throws with no fallback message; audio failure
  degrades to silent no-ops (`audio.js` `ensure()` catches and returns
  null). Acceptable for a desktop-Chrome target. Note only.

## Verified consistent (not findings)

- 3 levels / 3 orbs per level; guard counts 2/3/4, speeds 52/68/84,
  cone ranges 215/255/295, half-angles 0.48/0.62/0.72, rising per level.
- Sneak slower (88 vs 165 px/s), harder to spot (×0.45 fill), quieter
  *claimed* (see B8 — the quieter half is not wired).
- 5 pebbles per level; `?shot=` names match `shots.json` and the four
  files in `screenshots/`; `node serve.ts` → `http://localhost:8080`.
- No network references: every script/link/import resolves inside `game/`
  or is a `data:` URI; import map maps `"three"` to
  `./vendor/three.module.min.js`; only `render.js` imports `"three"`.
- Vendor minified: `game/vendor/three.module.min.js` is a single ~675 KiB
  line, SPDX MIT license header; `game/vendor/` holds only that file.
- `LICENSE` carries `SPDX-License-Identifier: MIT` + full MIT text.
- README has all three make.fun badges with the correct slug and no
  unfilled placeholders.
- `main.ts` is deterministic as far as reading establishes: no timestamps
  or random; `rmSync`s output, copies `game/` + `screenshots/`, writes
  the dossier via vendored `buildDossier` (sorted traversal, SHA-256,
  canonical JSON).
- Screenshots byte sizes: 1-play 103,975; 2-start 92,392; 3-chase 91,722;
  4-victory 91,417 — all ≤ 262,144. Pixel dimensions not verifiable by
  reading alone (see "Not verifiable" below).

## Not verifiable by reading alone

- Screenshot pixel dimensions (reader returned byte sizes only). The
  `render.js` comment asserts shipped shots are 1280×520 (long side
  ≤ 1280, short side ≥ 480) — a comment, not a measurement. The gate's
  own check measures this; confirm with `file`/`identify` before submit.
- Dossier 160 KiB text-cap fit: total source bytes vs
  `text_max_bytes: 163840` cannot be computed from read output. If over,
  `buildDossier` truncates with a cut line rather than failing — inspect
  the fresh build for the cut line.

## Traceability matrix (raw finding → consolidated item)

| Raw | Consolidated |
|---|---|
| Comprehension B1–B4, Structural M1, Style B1–B3, Zoom-out Major (README), Readiness N1, Design N1 | B1, M21, M22 |
| Inventive B1, Design B1, Zoom-out Major (chase), Codebase false-alarm (numbers) | B2 |
| Codebase B1, Readiness M7, Style M4 | B3 |
| Codebase M1, Readiness M5 (part) | B4 |
| Codebase M3 | B5 |
| Readiness M3 | B6 |
| Design B3, Inventive M2, Codebase M2, Readiness M5, Zoom-out Major (guards) | B7 |
| Design B2, Inventive M1, Zoom-out Major (footsteps), Readiness M4 | B8 |
| Inventive B2 | B9 |
| Zoom-out Major (victory), Readiness N10 | B10 |
| Zoom-out Major (play) | B11 |
| Structural M2, Zoom-out Major (render.js) | M1 |
| Structural M3, Zoom-out Nit (COLORS), Style M2 | M2 |
| Structural M4, Readiness N8 | M3 |
| Style M3, Codebase M4, Design M5 (comment) | M4 |
| Zoom-out Major (menu click), Readiness M6 | M5 |
| Design M6 | M6 |
| Design M1 | M7 |
| Design B4 | M8 |
| Design M2 | M9 |
| Design M3, Inventive M6 | M10 |
| Design M4 | M11 |
| Design M5 | M12 |
| Design M7 | M13 |
| Design M8 | M14 |
| Design M9, Inventive M6 | M15 |
| Design M10 | M16 |
| Design N2 | M17 |
| Zoom-out Nit, Readiness N2 | M18 |
| Codebase N2 | M19 |
| Comprehension M2–M7 | M20 |
| Comprehension B4, Structural N1, Style M1 | M21 (with B1) |
| Comprehension M1, Style B2 | M22 (with B1) |
| Comprehension M5, Design N2, Codebase N7 | M23 |
| Style M5, Codebase M5, Readiness M1, Zoom-out Nit (shots) | M24 |
| Codebase M6 | M25 |
| Style M7 | M26 |
| Style M8 | M27 |
| Readiness N3 | M28 |
| Readiness N4, Design N3 | M29 |
| Readiness N5 | M30 |
| Comprehension N1, Style N1 | N1 |
| Style M4 (part) | N2 |
| Readiness N6 | N3 |
| Structural N4 | N4 |
| Inventive N5, Design M11 | N5 |
| Inventive N2 | N6 |
| Inventive N3 | N7 |
| Inventive N4 | N8 |
| Inventive N1 | N9 |
| Readiness edge cases (orbs) | N10 |
| Zoom-out Blocker (file://) | F1 |
| Codebase false alarms (suspicion/chase/freeze) | F2 |
| Codebase false alarm (slab test) | F3 |
| Zoom-out Nit, Readiness N9 (referral) | F4 |
| Structural N2 (main.ts rename) | F5 |
| Codebase N5 | F6 |
| Readiness edge cases (WebGL/audio) | F7 |

## Must-do before submit (in order)

1. Builder session: fix B1, B3, B4, B5, B6, B7-minimum (waypoints), B9, B10,
   B11, M2, M3, M4, M6, M18, M19, M20–M24, N1, N2, N11. Decide B2 (chase speed — needs playtest),
   B7-ideal vs minimum, B8 (wire noise vs remove claim), M1 (split vs
   document), M11 (L2 bamboo / L3 orbs). Do NOT touch F1–F7.
2. Re-shoot all 4 screenshots from the fixed game; view each shrunk.
3. Re-run `main.ts` fresh (`out/` is stale — `out/dossier.json` predates
   the current screenshots; `out/` is gitignored build output, not the
   submission, but the dossier must be regenerated).
4. Confirm screenshot pixel dimensions (long side ≤ 1280, short side ≥ 480)
   and check the fresh dossier for a text-cap cut line.
5. Commit `bundle-inputs/` + `reviews/` (working tree must be clean for
   presubmit; a real bundle + kit check + presubmit still have to run —
   see gate status below).
6. Re-run bundle (real, same flags as the dry-run) + kit check with
   `--transcripts` + presubmit gate, then submit with `submit-v2.mjs`.

## Gate status at the time of this report (parent: read before submit)

- **bundle --dry-run: PASS (exit 0).** 4 sessions, 354 turns, 1200 lines;
  4 usage rows attached; prompt typed; system prompt uploaded; instruction
  files collected; MCP none. Warning only: repo dirty (bundle-inputs/
  uncommitted — fixed by step 5 above).
- **kit check: NOT RUN.** **presubmit.sh: NOT RUN.** The exec result
  immediately before this review failed an execution-risk check
  (system security notice), which bars running, testing, or issuing git
  commands against the entry's content from this session. The parent must
  run these two itself (or explicitly approve proceeding) — they are the
  remaining gate evidence. Direct kit check with `--transcripts
  <bundle.tar.gz>` is the authoritative result; presubmit.sh's kit-check
  step only passes transcripts if `$ENTRY/bundle.tar.gz` exists.
- **egm-review: DONE** — this report.
  `reviews/consolidated_review_report.md`.
