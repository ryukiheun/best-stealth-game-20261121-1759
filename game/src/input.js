// input.js — keyboard + mouse state, nothing else.
// Keys are tracked by e.code so WASD and arrows both work. A "pressed"
// edge (justPressed) is consumed by the game loop each frame.
// Mouse position is reported in 2D world px (1280 x 720): the game fills
// the browser window, so client coordinates scale directly to the world.

import { WORLD_W, WORLD_H } from "./config.js";

export function createInput() {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0, clientX: 0, clientY: 0 };

  function onKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) justPressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    mouse.clientX = e.clientX;
    mouse.clientY = e.clientY;
    mouse.x = (e.clientX / window.innerWidth) * WORLD_W;
    mouse.y = (e.clientY / window.innerHeight) * WORLD_H;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);

  return {
    // Held keys.
    down(code) {
      return keys.has(code);
    },
    // True once, on the frame the key went down.
    pressed(code) {
      return justPressed.has(code);
    },
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sneaking() {
      return keys.has("ShiftLeft") || keys.has("ShiftRight");
    },
    mouse,
    // Call at the end of every frame to clear one-shot edges.
    endFrame() {
      justPressed.clear();
      mouse.clicked = false;
    },
  };
}
