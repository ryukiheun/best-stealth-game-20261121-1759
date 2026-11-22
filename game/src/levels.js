// levels.js — the three shrine-garden layouts.
// One level = { name, guardSpeed, chaseSpeed, coneRange, coneHalfAngle,
// guards, orbs, bamboo, rocks, ponds, exit, spawn }.
// Coordinates are canvas px in a 1280 x 720 world. "rocks" and "ponds"
// block movement; "rocks" also block a guard's line of sight, "bamboo"
// blocks line of sight AND hides the player inside it. The exit (torii)
// stays shut until all 3 orbs of the level are collected.
// Every guard waypoint sits in open ground and every patrol leg clears
// every obstacle by at least the guard's 16 px collision radius —
// verified by /tmp/check-levels.mjs (run it after any layout edit).
// Difficulty: level 1 has 2 slow guards with narrow cones, level 2 has
// 3 faster guards with wider cones, level 3 has 4 fast guards with long
// wide cones and less bamboo to hide in. Chase speed is set per level
// (always above the 165 px/s walk speed, so a chase can catch a fox
// that only runs — see config.js).

export const LEVELS = [
  {
    name: "Moonlit Garden",
    guardSpeed: 52, // px/s patrol speed (level 1: slow, learnable)
    chaseSpeed: 200, // px/s, faster than the 165 px/s walk
    coneRange: 215, // px vision-cone length
    coneHalfAngle: 0.48, // rad, half-angle of the cone (narrow)
    guards: [
      // West-centre rectangle; the west leg runs at x=360 so it clears
      // the rock at x=250..340 by 20 px.
      { waypoints: [[360, 210], [620, 210], [620, 430], [360, 430]], start: 0 },
      // East loop; the top leg runs at y=280 (50 px below the bamboo
      // at y=120..230) and the south-east corner is pulled up to
      // (1120, 400) and back through (1000, 400) so no leg enters the
      // pond at x=1080..1210, y=420..500 or the bamboo at x=980..1130,
      // y=480..580.
      { waypoints: [[900, 480], [900, 280], [1120, 280], [1120, 400], [1000, 400]], start: 2 },
    ],
    orbs: [
      { x: 180, y: 560 },
      { x: 640, y: 120 },
      { x: 1150, y: 600 },
    ],
    bamboo: [
      { x: 430, y: 470, w: 190, h: 120 },
      { x: 760, y: 120, w: 170, h: 110 },
      { x: 980, y: 480, w: 150, h: 100 },
    ],
    rocks: [
      { x: 250, y: 330, w: 90, h: 60 },
      { x: 700, y: 330, w: 80, h: 80 },
      { x: 1050, y: 130, w: 90, h: 55 },
    ],
    ponds: [
      { x: 90, y: 120, w: 150, h: 90 },
      { x: 1080, y: 420, w: 130, h: 80 },
    ],
    exit: { x: 570, y: 30, w: 140, h: 56 },
    spawn: { x: 640, y: 660 },
  },
  {
    name: "Bamboo Thicket",
    guardSpeed: 68,
    chaseSpeed: 220, // px/s, faster than the 165 px/s walk
    coneRange: 255,
    coneHalfAngle: 0.62,
    guards: [
      // West rectangle; the top leg runs at y=230 so it clears the
      // bamboo at y=90..190 by 40 px.
      { waypoints: [[280, 230], [560, 230], [560, 420], [280, 420]], start: 0 },
      // East rectangle; the top leg runs at y=280 so it clears the
      // rock at y=180..250 by 30 px, and the bottom leg at y=470 so it
      // clears the bamboo at y=520..610 by 50 px (a leg any closer
      // lets a patrolling guard touch a fox hiding at the thicket edge).
      { waypoints: [[760, 470], [760, 280], [1080, 280], [1080, 470]], start: 1 },
      // Centre sweeper at x=700: 30 px west of the rock at x=730..800,
      // and its south end (700, 640) stays 63 px from the player spawn.
      { waypoints: [[700, 90], [700, 640]], start: 0 },
    ],
    orbs: [
      { x: 150, y: 150 },
      { x: 640, y: 360 },
      { x: 1150, y: 620 },
    ],
    // Total bamboo 57,400 px^2 — about the same cover as level 1
    // (56,500), not the 83,500 the first layout gave level 2.
    bamboo: [
      { x: 380, y: 90, w: 150, h: 100 },
      { x: 820, y: 90, w: 140, h: 100 },
      { x: 420, y: 520, w: 160, h: 110 },
      { x: 880, y: 520, w: 120, h: 90 },
    ],
    rocks: [
      { x: 300, y: 330, w: 100, h: 60 },
      { x: 880, y: 330, w: 100, h: 60 },
      { x: 730, y: 180, w: 70, h: 70 },
    ],
    ponds: [
      { x: 80, y: 480, w: 150, h: 100 },
      { x: 1060, y: 110, w: 140, h: 90 },
    ],
    exit: { x: 570, y: 30, w: 140, h: 56 },
    spawn: { x: 640, y: 660 },
  },
  {
    name: "Shrine of Lanterns",
    guardSpeed: 84,
    chaseSpeed: 240, // px/s, faster than the 165 px/s walk
    coneRange: 295,
    coneHalfAngle: 0.72,
    guards: [
      // West-centre rectangle; the top leg runs at y=210 (50 px above
      // the bamboo at y=260..370, 30 px below the rock at y=120..180)
      // and the east leg at x=640 (30 px east of that bamboo, 40 px
      // west of the bamboo at x=680..860).
      { waypoints: [[260, 210], [640, 210], [640, 470], [260, 470]], start: 0 },
      // East rectangle; the top leg runs at y=340 (40 px below the
      // bamboo at y=200..300, 20 px above the rock at y=360..420), the
      // west leg at x=645 (35 px from the bamboo on either side) and
      // the east leg at x=1020 (30 px west of the pond at x=1050..1190).
      // The bottom leg runs at y=590 (40 px below the bamboo at
      // y=440..550).
      { waypoints: [[645, 340], [1020, 340], [1020, 590], [645, 590]], start: 0 },
      // Centre sweeper at x=640, from (640, 110) — 24 px below the
      // torii exit — down to (640, 420).
      { waypoints: [[640, 110], [640, 420]], start: 0 },
      // West sweeper at x=180: 30 px east of the pond at x=90..230.
      { waypoints: [[180, 340], [180, 600]], start: 0 },
    ],
    orbs: [
      // Each orb sits at least 60 px from every patrol leg, so picking
      // one up never puts the fox inside a guard's catch distance.
      { x: 110, y: 330 },
      { x: 560, y: 180 },
      { x: 1150, y: 330 },
    ],
    bamboo: [
      { x: 430, y: 260, w: 180, h: 110 },
      { x: 680, y: 440, w: 180, h: 110 },
      { x: 900, y: 200, w: 140, h: 100 },
    ],
    rocks: [
      { x: 330, y: 120, w: 90, h: 60 },
      { x: 860, y: 120, w: 90, h: 60 },
      { x: 720, y: 360, w: 100, h: 60 },
      { x: 330, y: 560, w: 90, h: 60 },
    ],
    ponds: [
      { x: 90, y: 120, w: 140, h: 90 },
      { x: 1050, y: 500, w: 140, h: 90 },
    ],
    exit: { x: 570, y: 30, w: 140, h: 56 },
    spawn: { x: 640, y: 660 },
  },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}
