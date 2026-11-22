// render.js — the whole 3D look of Moss & Shadow, built with three.js.
// Every model is low-poly primitives built in code: no model files, no
// textures loaded from disk, no network. The 2D game world (1280 x 720 px)
// maps to a 32 x 18 unit garden: 1 unit = 40 px, x to the right, z down
// the screen (so 2D angle a becomes 3D direction (cos a, 0, sin a)).
// Camera: high oblique top-down, like the mockup gameplay view.
// HUD and full screens are DOM overlays (index.html) driven by hud.js;
// this file only builds and syncs the 3D garden.

import * as THREE from "three";
import { WORLD_W, WORLD_H } from "./config.js";
import { pebblePosition } from "./player.js";

const S = 40; // px per 3D unit
const HALF_W = WORLD_W / 2 / S; // 16
const HALF_H = WORLD_H / 2 / S; // 9

// 2D px -> 3D ground point (y = 0 plane).
export function to3(x, y) {
  return { x: (x - WORLD_W / 2) / S, z: (y - WORLD_H / 2) / S };
}
// 3D ground point -> 2D px.
export function to2(x, z) {
  return { x: x * S + WORLD_W / 2, y: z * S + WORLD_H / 2 };
}

function mat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...(opts || {}) });
}

function glowTexture(text, fg, bg) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg;
  g.font = "bold 52px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft radial glow with no hard edge — used for the moon's halo, so it
// can never read as a grey ring around the disc (N-a).
function radialGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.35, "rgba(200,220,255,0.35)");
  grad.addColorStop(1, "rgba(200,220,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class GardenRenderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e2242);
    this.scene.fog = new THREE.Fog(0x0e2242, 35, 75);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 140);
    this.camera.position.set(0, 12, 22);
    this.camera.lookAt(0, 0, -3);

    // Moonlight: pale blue directional light + soft ambient + hemisphere.
    const moon = new THREE.DirectionalLight(0xbfd4ff, 1.8);
    moon.position.set(-10, 18, -6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -20;
    moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 14;
    moon.shadow.camera.bottom = -14;
    this.scene.add(moon);
    this.scene.add(new THREE.AmbientLight(0x4a5a7d, 1.4));
    const hemi = new THREE.HemisphereLight(0x35507a, 0x142e1a, 0.9);
    this.scene.add(hemi);

    this.levelGroup = null;
    this.fox = null;
    this.guards3d = [];
    this.orbs3d = [];
    this.pebbleMesh = null;
    this.clankRing = null;
    this.exitGlow = null;
    this.exitLight = null;
    this.petals = [];
    this.fireflies = [];
    this.foxLight = null;
    this.lanternLights = [];
    this.moonMesh = null;
    this.moonGlow = null;
    this.foreBamboo = [];
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Screen pixel (clientX, clientY) -> 2D world px where a pebble lands.
  screenToWorld(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const p = to2(THREE.MathUtils.clamp(hit.x, -HALF_W, HALF_W), THREE.MathUtils.clamp(hit.z, -HALF_H, HALF_H));
    return p;
  }

  buildLevel(level) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    const g = new THREE.Group();
    this.levelGroup = g;
    this.guards3d = [];
    this.orbs3d = [];
    this.petals = [];
    this.fireflies = [];
    this.lanternLights = [];
    this.foreBamboo = [];
    this.scene.add(g);

    // --- ground: mossy lawn, bright enough to read at a glance ---
    // The lawn is far bigger than the playfield and a dark skirt plane
    // sits under it, so the garden fills the frame to a fogged horizon
    // instead of ending in a hard trapezoid edge against the void (M2).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 95), mat(0x2a4d33));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(280, 220), mat(0x12241a));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = -0.06;
    g.add(skirt);
    // --- distant scenery: shrine wall, far trees and hills (M2) ---
    // A wall closes the far edge of the garden, trees and hills rise
    // behind it, and the fog hazes them into the night sky.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(38, 1.5, 0.5), mat(0x4a3d2c));
    wall.position.set(0, 0.75, -11.8);
    g.add(wall);
    const wallRoof = new THREE.Mesh(new THREE.BoxGeometry(39, 0.28, 1.5), mat(0x31473a));
    wallRoof.position.set(0, 1.65, -11.8);
    g.add(wallRoof);
    const wallRidge = new THREE.Mesh(new THREE.BoxGeometry(39, 0.18, 0.35), mat(0x3a5546));
    wallRidge.position.set(0, 1.86, -11.8);
    g.add(wallRidge);
    for (const [wx, wz] of [[-16, -10.6], [-9, -10.4], [-3, -10.7], [4, -10.5], [10, -10.6], [15.5, -10.4]]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(0x1e4d26));
      bush.scale.set(1, 0.55, 1);
      bush.position.set(wx, 0.3, wz);
      g.add(bush);
    }
    const farTrees = [
      [-17, -16, 4.6], [-13.5, -19, 3.8], [6, -17, 5.2], [10, -20, 4.0], [14, -16, 4.4], [18, -19, 3.6],
    ];
    for (const [tx, tz, th] of farTrees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, th * 0.55, 6), mat(0x2a1e16));
      trunk.position.set(tx, th * 0.27, tz);
      g.add(trunk);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(th * 0.42, 0), mat(0x1c3a26));
      top.position.set(tx, th * 0.72, tz);
      g.add(top);
      const top2 = new THREE.Mesh(new THREE.IcosahedronGeometry(th * 0.3, 0), mat(0x22452c));
      top2.position.set(tx + 0.7, th * 0.55, tz + 0.3);
      g.add(top2);
    }
    for (const [hx, hz, hr] of [[-20, -30, 10], [0, -34, 12], [20, -30, 10]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 12, 8), mat(0x10233a));
      hill.scale.set(1, 0.22, 1);
      hill.position.set(hx, 0, hz);
      g.add(hill);
    }
    // Lighter grass patches.
    for (let i = 0; i < 16; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1.2 + ((i * 37) % 10) / 8, 10),
        mat(i % 2 ? 0x33593c : 0x24492f)
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(-14 + ((i * 211) % 280) / 10, 0.01, -8 + ((i * 97) % 160) / 10);
      g.add(patch);
    }
    // Low shrubs and grass tufts so no corner of the garden is bare.
    for (let i = 0; i < 12; i++) {
      const sx = -14 + ((i * 137) % 280) / 10;
      const sz = -8 + ((i * 211) % 160) / 10;
      if (Math.abs(sx) < 1.6 && sz > -8) continue; // keep the main path clear
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.5 + ((i * 29) % 10) / 25, 8, 6), mat(i % 2 ? 0x2f6b3a : 0x3a7d46));
      shrub.scale.set(1, 0.45, 1);
      shrub.position.set(sx, 0.18, sz);
      shrub.castShadow = true;
      g.add(shrub);
    }
    for (let i = 0; i < 26; i++) {
      const tx = -15 + ((i * 89) % 300) / 10;
      const tz = -8.5 + ((i * 149) % 170) / 10;
      if (Math.abs(tx) < 1.4) continue;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), mat(0x4c9455));
      tuft.position.set(tx, 0.21, tz);
      g.add(tuft);
    }
    // Flower clusters: tiny pink and white dots near the paths.
    for (let i = 0; i < 36; i++) {
      const fx = -14 + ((i * 113) % 280) / 10;
      const fz = -8 + ((i * 167) % 160) / 10;
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        mat(i % 3 ? 0xf2a7c3 : 0xfff6e0, { emissive: i % 3 ? 0x903a5e : 0x8a7a4a, emissiveIntensity: 0.35 })
      );
      fl.position.set(fx, 0.08, fz);
      g.add(fl);
    }

    // Foreground shrubs near the bottom edge, so the near ground is
    // never an empty dark band (M3).
    for (const [fx, fz] of [[-5, 8], [5.5, 8], [-9.5, 7.6], [9.5, 7.6]]) {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x2f6b3a));
      shrub.scale.set(1, 0.5, 1);
      shrub.position.set(fx, 0.2, fz);
      shrub.castShadow = true;
      g.add(shrub);
    }

    // --- stone path: spawn (bottom centre) up to the torii gate ---
    const pathMat = mat(0x8a7f68);
    const path = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, HALF_H * 2), pathMat);
    path.position.set(0, 0.04, 0.4);
    path.receiveShadow = true;
    g.add(path);
    for (let i = 0; i < 9; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.1), mat(0x9a8d72));
      slab.position.set(0, 0.05, -8 + i * 1.9);
      slab.receiveShadow = true;
      g.add(slab);
    }
    // Cross path: a second stone walkway across the middle of the garden.
    const cross = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 - 4, 0.07, 1.3), mat(0x7d7462));
    cross.position.set(0, 0.04, 0);
    cross.receiveShadow = true;
    g.add(cross);
    for (let i = 0; i < 10; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 1.0), mat(0x8a7f68));
      step.position.set(-13 + i * 2.9, 0.045, 0);
      g.add(step);
    }

    // --- ponds: dark blue water, never white — ripples + moon shimmer ---
    for (const p of level.ponds) {
      const c = to3(p.x + p.w / 2, p.y + p.h / 2);
      const pr = Math.max(p.w, p.h) / 2 / S;
      const pond = new THREE.Mesh(new THREE.CircleGeometry(pr, 20), mat(0x1a4a68, { roughness: 1.0 }));
      pond.rotation.x = -Math.PI / 2;
      pond.scale.set(p.w / Math.max(p.w, p.h), p.h / Math.max(p.w, p.h), 1);
      pond.position.set(c.x, 0.03, c.z);
      g.add(pond);
      // Soft broken ripples: short faint arcs, never full concentric
      // rings, so the pond never reads as an archery target (N-c).
      for (const [rr, start, len, op] of [[0.45, 0.4, 2.1, 0.28], [0.72, 3.4, 1.5, 0.2]]) {
        const arc = new THREE.Mesh(
          new THREE.RingGeometry(pr * rr - 0.03, pr * rr + 0.03, 28, 1, start, len),
          new THREE.MeshBasicMaterial({ color: 0x7fb8d9, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })
        );
        arc.rotation.x = -Math.PI / 2;
        arc.scale.set(p.w / Math.max(p.w, p.h), p.h / Math.max(p.w, p.h), 1);
        arc.position.set(c.x, 0.045, c.z);
        g.add(arc);
      }
      // Moonlight shimmer on the water, offset toward the moon (upper-left).
      const shim = new THREE.Mesh(
        new THREE.CircleGeometry(pr * 0.45, 16),
        new THREE.MeshBasicMaterial({ color: 0xbfd9ff, transparent: true, opacity: 0.12, depthWrite: false })
      );
      shim.rotation.x = -Math.PI / 2;
      shim.position.set(c.x - pr * 0.3, 0.05, c.z - pr * 0.25);
      g.add(shim);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(pr, 0.08, 8, 24), mat(0x3a4a55));
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(p.w / Math.max(p.w, p.h), p.h / Math.max(p.w, p.h), 1);
      rim.position.set(c.x, 0.05, c.z);
      g.add(rim);
    }

    // --- rocks: LOW and flat, dark blue-grey — never guard-sized (M5) ---
    level.rocks.forEach((r, i) => {
      const c = to3(r.x + r.w / 2, r.y + r.h / 2);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(r.w, r.h) / 2 / S, 0), mat(0x4a5560));
      rock.scale.set(1, 0.38, r.h / r.w);
      rock.position.set(c.x, 0.16, c.z);
      rock.rotation.y = i * 1.3;
      rock.castShadow = true;
      rock.receiveShadow = true;
      g.add(rock);
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat(0x4d7a4a));
      moss.scale.set(1, 0.35, 1);
      moss.position.set(c.x - 0.2, 0.5, c.z + 0.1);
      g.add(moss);
    });

    // --- bamboo thickets: tall, dense, BRIGHT green stalks (M4) ---
    // A low dark-green ground patch (never a black slab) + many lit stalks.
    for (const b of level.bamboo) {
      const c = to3(b.x + b.w / 2, b.y + b.h / 2);
      const base = new THREE.Mesh(new THREE.CircleGeometry(Math.max(b.w, b.h) / 2 / S, 14), mat(0x1e4d26));
      base.rotation.x = -Math.PI / 2;
      base.scale.set(b.w / Math.max(b.w, b.h), b.h / Math.max(b.w, b.h), 1);
      base.position.set(c.x, 0.02, c.z);
      g.add(base);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const bx = b.x + 8 + ((i * 37) % Math.max(10, b.w - 16));
        const bz = b.y + 10 + ((i * 53) % Math.max(10, b.h - 20));
        const p = to3(bx, bz);
        const h = 3.1 + ((i * 13) % 10) / 10;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), mat(i % 3 ? 0x4da34d : 0x66bb55));
        stalk.position.set(p.x, h / 2, p.z);
        stalk.rotation.z = Math.sin(i * 2.1) * 0.06;
        stalk.castShadow = true;
        g.add(stalk);
        // Leaf tuft at the top, bright and clearly a leaf.
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), mat(0x7ed67a));
        leaf.position.set(p.x + 0.14, h - 0.25, p.z);
        leaf.rotation.z = -0.5;
        g.add(leaf);
        const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 4), mat(0x5fb85e));
        leaf2.position.set(p.x - 0.12, h - 0.5, p.z + 0.1);
        leaf2.rotation.z = 0.55;
        g.add(leaf2);
        // Foreground patches (near the bottom edge, y >= 400): their tall
        // stalks and leaf cones loom large in the bottom corners on the
        // victory camera. Remember them so the victory screen can hide
        // just the spikes; gameplay is untouched (N-2).
        if (b.y >= 400) this.foreBamboo.push(stalk, leaf, leaf2);
      }
    }

    // --- cherry trees: dark trunk + PINK blossom canopy (N3) ---
    const treeSpots = [
      { x: -12.5, z: -5.5 },
      { x: 12.8, z: 5 },
      { x: -12.5, z: 6 },
    ];
    for (const t of treeSpots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6), mat(0x4a3226));
      trunk.position.set(t.x, 0.9, t.z);
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.95 - (i % 3) * 0.18, 0),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff9ec4 : 0xffc2d8, emissive: 0xd1507a, emissiveIntensity: 0.55, roughness: 0.9 })
        );
        blob.position.set(t.x + (i - 2) * 0.5, 2.0 + (i % 2) * 0.4, t.z + (i % 3 === 0 ? 0.35 : -0.3));
        blob.castShadow = true;
        g.add(blob);
      }
      // Fallen pink petals on the ground around the trunk.
      for (let i = 0; i < 10; i++) {
        const pd = new THREE.Mesh(new THREE.CircleGeometry(0.13, 6), mat(0xf5a8c8));
        pd.rotation.x = -Math.PI / 2;
        pd.position.set(t.x - 1.2 + ((i * 71) % 24) / 10, 0.03, t.z - 1 + ((i * 47) % 20) / 10);
        g.add(pd);
      }
    }

    // --- torii gate (EXIT) at the top centre ---
    const e = to3(level.exit.x + level.exit.w / 2, level.exit.y + level.exit.h / 2);
    const torii = new THREE.Group();
    torii.position.set(e.x, 0, e.z);
    const pillarMat = mat(0xb8433a);
    for (const px of [-1.35, 1.35]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.6, 10), pillarMat);
      pillar.position.set(px, 1.3, 0);
      pillar.castShadow = true;
      torii.add(pillar);
    }
    const beamTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 0.3), pillarMat);
    beamTop.position.set(0, 2.55, 0);
    beamTop.castShadow = true;
    torii.add(beamTop);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.18, 0.26), pillarMat);
    beam2.position.set(0, 2.05, 0);
    torii.add(beam2);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.56),
      new THREE.MeshBasicMaterial({ map: glowTexture("EXIT", "#b8f5d0", "#123324"), transparent: true })
    );
    sign.position.set(0, 1.55, 0.22);
    torii.add(sign);
    g.add(torii);
    this.exitGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 4),
      new THREE.MeshBasicMaterial({ color: 0x8ff5bd, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    this.exitGlow.rotation.x = -Math.PI / 2;
    this.exitGlow.position.set(e.x, 0.06, e.z + 1.2);
    g.add(this.exitGlow);
    this.exitLight = new THREE.PointLight(0x8ff5bd, 0, 9);
    this.exitLight.position.set(e.x, 1.6, e.z + 1);
    g.add(this.exitLight);

    // --- paper lanterns on posts: gate, corners and mid-garden (M3) ---
    // Each lantern is a warm glowing lamp + a pool of warm light on the
    // ground, so the garden is never a black void.
    const lanternSpots = [
      { x: e.x - 2.4, z: e.z + 0.6 },
      { x: e.x + 2.4, z: e.z + 0.6 },
      { x: -13.5, z: 7.5 },
      { x: 13.5, z: 7.5 },
      { x: -11.5, z: -5.5 },
      { x: 11.5, z: -5.5 },
      { x: -7, z: 2.5 },
      { x: 7, z: -2.5 },
    ];
    for (const s of lanternSpots) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), mat(0x3a3f46));
      post.position.set(s.x, 0.55, s.z);
      g.add(post);
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xffd682, emissive: 0xffb84d, emissiveIntensity: 2.2, roughness: 0.6 })
      );
      lamp.position.set(s.x, 1.3, s.z);
      g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.18, 8), mat(0x2c3036));
      cap.position.set(s.x, 1.62, s.z);
      g.add(cap);
      // Warm pool of light on the ground under the lantern.
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 16),
        new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.22, depthWrite: false })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(s.x, 0.05, s.z);
      g.add(pool);
    }
    const gateLight = new THREE.PointLight(0xffc86e, 12, 12, 1.8);
    gateLight.position.set(e.x, 2, e.z + 1.5);
    gateLight.userData.base = 12;
    g.add(gateLight);
    this.lanternLights.push(gateLight);
    // Warm lights at the four corner lanterns.
    for (const [lx, lz] of [[-13.5, 7.5], [13.5, 7.5], [-11.5, -5.5], [11.5, -5.5]]) {
      const cl = new THREE.PointLight(0xffc86e, 5, 7, 1.8);
      cl.position.set(lx, 1.4, lz);
      cl.userData.base = 5;
      g.add(cl);
      this.lanternLights.push(cl);
    }

    // --- moon: ONE bright white disc + a soft gradient glow sprite,
    // the same in every shot — no hard grey ring, no dull grey disc (N-a).
    // toneMapped:false keeps the disc pure white even under ACES.
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false })
    );
    moon.position.set(-9, 4.2, -23);
    g.add(moon);
    const moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialGlowTexture(), color: 0xbfd4ff, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false,
      })
    );
    moonGlow.scale.set(12, 12, 1);
    moonGlow.position.copy(moon.position);
    g.add(moonGlow);
    // Kept so sync() can lift the moon clear of the big titles on the
    // start and victory screens (N-5, N-1); gameplay keeps the default.
    this.moonMesh = moon;
    this.moonGlow = moonGlow;
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 120; i++) {
      starPos.push(-28 + ((i * 173) % 560) / 10, 12 + ((i * 97) % 120) / 10, -24 + ((i * 61) % 80) / 10);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.14, fog: false })));

    // --- drifting cherry petals ---
    for (let i = 0; i < 14; i++) {
      const petal = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), mat(0xe8a7c3, { side: THREE.DoubleSide }));
      petal.position.set(-14 + ((i * 173) % 280) / 10, 1 + ((i * 37) % 20) / 10, -8 + ((i * 97) % 160) / 10);
      g.add(petal);
      this.petals.push(petal);
    }

    // --- fireflies: tiny drifting green-gold lights over the garden ---
    for (let i = 0; i < 18; i++) {
      const ff = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xd8ffa8, transparent: true, opacity: 0.9 })
      );
      ff.position.set(-13 + ((i * 149) % 260) / 10, 0.8 + ((i * 41) % 12) / 10, -7 + ((i * 83) % 140) / 10);
      ff.userData.base = ff.position.clone();
      ff.userData.phase = i * 1.3;
      g.add(ff);
      this.fireflies.push(ff);
    }

    // --- sacred orbs: saturated GOLD, emissive, halo + ground glow (M2) ---
    level.orbs.forEach((o) => {
      const p = to3(o.x, o.y);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.18, 10), mat(0x5a6068));
      base.position.set(p.x, 0.09, p.z);
      base.receiveShadow = true;
      g.add(base);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xff9500, emissiveIntensity: 2.8, roughness: 0.25 })
      );
      orb.position.set(p.x, 0.76, p.z);
      orb.castShadow = true;
      g.add(orb);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.28, depthWrite: false })
      );
      halo.position.copy(orb.position);
      g.add(halo);
      // Pool of gold light on the ground so the orb reads from far away.
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 16),
        new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.3, depthWrite: false })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(p.x, 0.05, p.z);
      g.add(pool);
      this.orbs3d.push({ orb, halo, base, pool });
    });

    // --- robed lantern-bearer guardians + their vision cones (B1/M5/M6) ---
    // Guards are TALL, warm ochre-robed, carry a glowing lantern with its
    // own light and a warm pool on the floor — nothing like the low flat
    // blue-grey rocks. Each cone starts exactly at the guard's lantern
    // and has a hard arc edge so it reads at a glance.
    level.guards.forEach((def) => {
      const start = def.waypoints[def.start || 0];
      const p = to3(start[0], start[1]);
      const guard = new THREE.Group();
      guard.position.set(p.x, 0, p.z);
      // Robe: tapered warm ochre, wide at the hem.
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.55, 1.15, 10), mat(0x9a7440));
      robe.position.y = 0.58;
      robe.castShadow = true;
      guard.add(robe);
      // Warm sash.
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.16, 10), mat(0xc23b2e));
      sash.position.y = 0.95;
      guard.add(sash);
      // Head + wide-brim hat.
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), mat(0xd9a066));
      head.position.y = 1.35;
      head.castShadow = true;
      guard.add(head);
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.3, 10), mat(0x4a3226));
      hat.position.y = 1.62;
      hat.castShadow = true;
      guard.add(hat);
      // Lantern held out in front (+x side): glowing amber lamp on a pole.
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), mat(0x3a2c1c));
      pole.position.set(0.5, 1.0, 0);
      pole.rotation.z = 0.35;
      guard.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.34, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb300, emissiveIntensity: 2.6 })
      );
      lamp.position.set(0.62, 1.28, 0);
      guard.add(lamp);
      const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), mat(0x2c3036));
      lampCap.position.set(0.62, 1.52, 0);
      lampCap.rotation.y = Math.PI / 4;
      guard.add(lampCap);
      // The guard's own warm light + pool on the floor under it.
      const guardLight = new THREE.PointLight(0xffb84d, 6, 6, 1.8);
      guardLight.position.set(0.62, 1.3, 0);
      guard.add(guardLight);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.35, 16),
        new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.26, depthWrite: false })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.06;
      guard.add(pool);
      // Glowing eyes on the front (+x side).
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      for (const ez of [-0.11, 0.11]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
        eye.position.set(0.26, 1.38, ez);
        guard.add(eye);
      }
      g.add(guard);
      // Vision cone: a group at the guard, so cone + edges + apex light
      // all move and turn with it. Outer sector (fading) + inner sector
      // (bright near the guard) + hard arc and edge lines (M6).
      const range = level.coneRange / S;
      const half = level.coneHalfAngle;
      const coneGroup = new THREE.Group();
      coneGroup.position.set(p.x, 0.07, p.z);
      const coneGeo = new THREE.CircleGeometry(range, 24, -half, half * 2);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffc93c, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide,
      });
      coneGroup.add(new THREE.Mesh(coneGeo, coneMat));
      const innerGeo = new THREE.CircleGeometry(range * 0.55, 16, -half, half * 2);
      innerGeo.rotateX(-Math.PI / 2);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffc93c, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
      });
      coneGroup.add(new THREE.Mesh(innerGeo, innerMat));
      const arcPts = [];
      for (let i = 0; i <= 16; i++) {
        const phi = -half + (2 * half * i) / 16;
        arcPts.push(new THREE.Vector3(range * Math.cos(phi), 0.09, -range * Math.sin(phi)));
      }
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9 });
      coneGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), lineMat));
      for (const sgn of [-1, 1]) {
        const edgePts = [
          new THREE.Vector3(0, 0.09, 0),
          new THREE.Vector3(range * Math.cos(sgn * half), 0.09, -range * Math.sin(sgn * half)),
        ];
        coneGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts), lineMat));
      }
      // Bright apex dot where the cone leaves the lantern.
      const apex = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
      );
      apex.position.set(0.62, 0.1, 0);
      coneGroup.add(apex);
      g.add(coneGroup);
      // "?" / "!" mark: a big billboard above the guard with a dark disc
      // behind the letter so it reads at contact-sheet size (M8).
      const markCanvas = document.createElement("canvas");
      markCanvas.width = 128;
      markCanvas.height = 128;
      const markTex = new THREE.CanvasTexture(markCanvas);
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 1.25),
        new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false })
      );
      mark.position.set(p.x, 2.5, p.z);
      g.add(mark);
      this.guards3d.push({ group: guard, coneGroup, coneMat, innerMat, lineMat, mark, markCanvas, markTex, eyeMat });
    });

    // --- the fox spirit: glowing pale-green fox, built to read as a fox
    // at small size — pointed ears, snout, four legs, big curled tail (M1).
    const fox = new THREE.Group();
    // Muted glow: the old bright emissive washed every part to the same
    // flat white, which is why the body read as beads. Lower emissive
    // lets the shape shading do the talking (M1).
    const fur = new THREE.MeshStandardMaterial({ color: 0xd8f7e3, emissive: 0x5fd39a, emissiveIntensity: 0.55, roughness: 0.7 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf2ffe9, emissive: 0x8fe6b0, emissiveIntensity: 0.45, roughness: 0.7 });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x5e9a72, emissive: 0x2a6a44, emissiveIntensity: 0.3, roughness: 0.8 });
    // Body: ONE solid capsule lying horizontal — a single elongated
    // piece, never a chain of spheres (M1). Raised so the legs show.
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), fur);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.55;
    body.castShadow = true;
    fox.add(body);
    // Head.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), fur);
    head.position.set(0.66, 0.66, 0);
    head.castShadow = true;
    fox.add(head);
    // Snout: a cream cone pointing forward (+x).
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.38, 8), cream);
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.95, 0.6, 0);
    fox.add(snout);
    // Pointed ears, tall and splayed so they read from above (M1).
    for (const ez of [-0.15, 0.15]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 4), fur);
      ear.position.set(0.58, 1.08, ez);
      ear.rotation.z = -0.1;
      ear.rotation.x = ez > 0 ? -0.35 : 0.35;
      fox.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 4), new THREE.MeshStandardMaterial({ color: 0xf2a7c3, emissive: 0x903a5e, emissiveIntensity: 0.6 }));
      inner.position.set(0.58, 1.02, ez);
      inner.rotation.z = -0.1;
      inner.rotation.x = ez > 0 ? -0.35 : 0.35;
      fox.add(inner);
    }
    // Dark eyes on the head.
    for (const ez of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x1c2b22 }));
      eye.position.set(0.86, 0.72, ez);
      fox.add(eye);
    }
    // Four legs: long dark stubs, clearly visible below the raised body.
    for (const [lx, lz] of [[0.38, -0.22], [0.38, 0.22], [-0.38, -0.22], [-0.38, 0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 6), darkFur);
      leg.position.set(lx, 0.25, lz);
      leg.rotation.x = lz > 0 ? 0.12 : -0.12;
      fox.add(leg);
    }
    // Tail: ONE big tapered plume — a single flattened cone sweeping
    // up and back from the rear, wider than the body, with a pale tip
    // cone. One piece, never beads (M1).
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 8), fur);
    tail.rotation.z = 0.8;
    tail.scale.set(1, 1, 0.45);
    tail.position.set(-0.85, 0.95, 0.1);
    tail.castShadow = true;
    fox.add(tail);
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 8), cream);
    tailTip.rotation.z = 0.8;
    tailTip.scale.set(1, 1, 0.45);
    tailTip.position.set(-1.38, 1.5, 0.1);
    fox.add(tailTip);
    // Soft glow halo + the fox's own green light, so it pops off the floor.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8ff5bd, transparent: true, opacity: 0.14, depthWrite: false })
    );
    halo.scale.set(1.35, 0.6, 0.95);
    halo.position.y = 0.5;
    fox.add(halo);
    const foxLight = new THREE.PointLight(0x8ff5bd, 4, 5, 1.8);
    foxLight.position.set(0, 1.0, 0);
    fox.add(foxLight);
    g.add(fox);
    this.fox = fox;

    // --- pebble + CLANK ring + footstep noise ring ---
    this.pebbleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xf2f4f6));
    this.pebbleMesh.visible = false;
    g.add(this.pebbleMesh);
    // The CLANK ring is the visible half of the pebble lure: a thick
    // gold ring that blooms outward from the landing point, over a soft
    // gold pool so it reads on dark grass. It must read at
    // contact-sheet size, so it grows to ~1 unit radius.
    this.clankRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe68c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.clankDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe68c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.clankRing.rotation.x = -Math.PI / 2;
    this.clankRing.position.y = 0.08;
    g.add(this.clankRing);
    this.clankDisc.rotation.x = -Math.PI / 2;
    this.clankDisc.position.y = 0.07;
    g.add(this.clankDisc);
    // Faint ring showing how far the fox's footsteps carry right now
    // (walk 70 px, sneak 26 px, still 0) — the sound made visible.
    this.noiseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xb8f5d0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.noiseRing.rotation.x = -Math.PI / 2;
    this.noiseRing.position.y = 0.07;
    g.add(this.noiseRing);
  }

  sync(state, time) {
    if (!this.levelGroup) return;
    const { player, guards, orbs, level } = state;
    // Camera per screen: pulled in closer than before, so the garden
    // fills the frame and the sky band stays small (M2). The extended
    // ground + wall + far trees do the rest of the filling.
    if (state.screen === "start") {
      this.camera.position.set(0, 12, 20);
      this.camera.lookAt(0, 1, -4.5);
    } else if (state.screen === "victory") {
      // Pulled back a little: the fox must not dominate the frame (M1).
      this.camera.position.set(0, 9.5, 11);
      this.camera.lookAt(0, 1.2, -7);
    } else {
      this.camera.position.set(0, 11, 20);
      this.camera.lookAt(0, 0.5, -2.5);
    }

    // Moon height per screen, measured off the shipped screenshots
    // (1280x520): the disc is ~70 px wide, and at the default height
    // its bottom edge grazed the big titles. Lifting it ~3 units puts
    // the disc ~45 px higher on screen, clear of the title tops.
    // Gameplay (play/chase) keeps the default moon.
    if (this.moonMesh) {
      const mp =
        state.screen === "start" ? [-11, 7.5, -23] :
        state.screen === "victory" ? [-9, 6.8, -23] : [-9, 4.2, -23];
      this.moonMesh.position.set(mp[0], mp[1], mp[2]);
      if (this.moonGlow) this.moonGlow.position.copy(this.moonMesh.position);
    }
    // Victory screen: hide the foreground bamboo spikes (the tall
    // stalks + leaf cones of the bottom patches) so the bottom corners
    // are clean garden, not green spikes (N-2). Their flat ground beds
    // stay. Gameplay screens are untouched.
    if (this.foreBamboo) {
      const show = state.screen !== "victory";
      for (const m of this.foreBamboo) m.visible = show;
    }

    // Fox.
    if (this.fox && player) {
      const p = to3(player.x, player.y);
      this.fox.position.set(p.x, 0, p.z);
      this.fox.rotation.y = -player.facing;
      const bob = player.moving ? Math.abs(Math.sin(time * 10)) * 0.06 : Math.sin(time * 2) * 0.02;
      this.fox.position.y = bob;
      // Hidden in bamboo: smaller, dimmer, light off — still visible.
      // Base scale 1.35: the fox must read at contact-sheet size (M1).
      // On the victory screen it is 1.3, close to play size, so the fox
      // reads whole next to the torii instead of as a thin sliver.
      const baseScale = state.screen === "victory" ? 1.3 : 1.35;
      this.fox.scale.setScalar((player.hidden ? 0.85 : 1) * baseScale);
      const fl = this.fox.children.find((c) => c.isPointLight);
      if (fl) fl.intensity = player.hidden ? 1.2 : 4;
    }

    // Guards + cones + marks.
    guards.forEach((gd, i) => {
      const g3 = this.guards3d[i];
      if (!g3) return;
      const p = to3(gd.x, gd.y);
      g3.group.position.set(p.x, 0, p.z);
      g3.group.rotation.y = -gd.angle;
      g3.coneGroup.position.set(p.x, 0.07, p.z);
      g3.coneGroup.rotation.y = -gd.angle;
      // Victory screen: no vision cones at all — the guards are
      // celebrating, not patrolling, and the cones only bleached the
      // floor (M3). Gameplay cones are untouched.
      g3.coneGroup.visible = state.screen !== "victory";
      // Saturated cone colours: gold patrol, orange suspicious, red chase.
      const col = gd.state === "chase" ? 0xff2d2d : gd.state === "suspicious" ? 0xff8c1a : 0xffc93c;
      g3.coneMat.color.setHex(col);
      g3.coneMat.opacity = gd.state === "patrol" ? 0.34 : 0.46;
      g3.innerMat.color.setHex(col);
      g3.innerMat.opacity = gd.state === "patrol" ? 0.5 : 0.6;
      g3.lineMat.color.setHex(col);
      // Mark billboard: always faces the camera, big, dark disc behind.
      // Offset up and to the side so the bubble never covers the guard
      // beneath it (N-b); hidden entirely on the victory screen (M3).
      g3.mark.position.set(p.x + 0.95, 2.95 + Math.sin(time * 2 + i) * 0.06, p.z);
      g3.mark.quaternion.copy(this.camera.quaternion);
      const markChar = gd.state === "chase" ? "!" : gd.state === "suspicious" ? "?" : "";
      const cv = g3.markCanvas.getContext("2d");
      cv.clearRect(0, 0, 128, 128);
      if (markChar && state.screen !== "victory") {
        cv.beginPath();
        cv.arc(64, 64, 56, 0, Math.PI * 2);
        cv.fillStyle = "rgba(6, 10, 18, 0.85)";
        cv.fill();
        cv.lineWidth = 5;
        cv.strokeStyle = gd.state === "chase" ? "#ff2d2d" : "#ff8c1a";
        cv.stroke();
        cv.font = "bold 84px Georgia, serif";
        cv.textAlign = "center";
        cv.textBaseline = "middle";
        cv.fillStyle = gd.state === "chase" ? "#ff2d2d" : "#ff8c1a";
        cv.fillText(markChar, 64, 68);
        g3.markTex.needsUpdate = true;
        g3.mark.visible = true;
      } else {
        g3.mark.visible = false;
      }
      g3.eyeMat.color.setHex(gd.state === "chase" ? 0xff4d4d : gd.state === "suspicious" ? 0xff9a3c : 0xffe9a8);
    });

    // Orbs bob + spin, hidden once taken. Positions follow state.orbs,
    // so staged shots can move them (the meshes are built at the level
    // positions and must not stay stale).
    orbs.forEach((o, i) => {
      const o3 = this.orbs3d[i];
      if (!o3) return;
      const p = to3(o.x, o.y);
      o3.orb.visible = !o.taken;
      o3.halo.visible = !o.taken;
      // Victory screen: the orbs float in a ring around the fox — no
      // pedestals, no ground pools — so they read as celebration, not
      // furniture (M3).
      const celebrating = state.screen === "victory";
      o3.pool.visible = !o.taken && !celebrating;
      o3.base.visible = !celebrating;
      o3.orb.position.x = p.x;
      o3.orb.position.z = p.z;
      o3.halo.position.x = p.x;
      o3.halo.position.z = p.z;
      o3.base.position.x = p.x;
      o3.base.position.z = p.z;
      o3.pool.position.x = p.x;
      o3.pool.position.z = p.z;
      if (!o.taken) {
        o3.orb.position.y = (celebrating ? 1.5 : 0.76) + Math.sin(time * 2.5 + i * 2) * 0.08;
        o3.halo.position.y = o3.orb.position.y;
        o3.halo.material.opacity = (celebrating ? 0.34 : 0.22) + Math.sin(time * 3 + i) * 0.06;
      }
    });

    // Pebble flight + CLANK ring. In live play state.pebblePos is set
    // by the game loop; in a staged ?shot= scene the loop never runs,
    // so fall back to the pebble flight stored on the player.
    const peb = state.pebblePos || pebblePosition(player);
    if (peb) {
      const p = to3(peb.x, peb.y);
      this.pebbleMesh.visible = true;
      this.pebbleMesh.position.set(p.x, 0.35, p.z);
    } else {
      this.pebbleMesh.visible = false;
    }
    if (player.pebbleLand) {
      const p = to3(player.pebbleLand.x, player.pebbleLand.y);
      const age = player.pebbleLand.t / 1.2;
      const s = 1 + age * 3;
      this.clankRing.position.set(p.x, 0.08, p.z);
      this.clankRing.scale.setScalar(s);
      this.clankRing.material.opacity = Math.max(0, 0.9 * (1 - age));
      this.clankDisc.position.set(p.x, 0.07, p.z);
      this.clankDisc.scale.setScalar(s * 0.9);
      this.clankDisc.material.opacity = Math.max(0, 0.28 * (1 - age));
    } else {
      this.clankRing.material.opacity = 0;
      this.clankDisc.material.opacity = 0;
    }

    // Footstep noise ring: centred on the fox, sized to the current
    // noise radius, visible only while the fox is moving.
    if (this.noiseRing && player) {
      const p = to3(player.x, player.y);
      this.noiseRing.position.set(p.x, 0.07, p.z);
      this.noiseRing.scale.setScalar(Math.max(0.01, (player.noiseRadius || 0) / S));
      this.noiseRing.material.opacity = player.moving && player.noiseRadius > 0 ? 0.28 : 0;
    }

    // Exit glow when open.
    const open = !!state.exitOpen;
    this.exitGlow.material.opacity = open ? 0.22 + Math.sin(time * 3) * 0.08 : 0;
    this.exitLight.intensity = open ? 14 : 0;

    // Petals drift.
    this.petals.forEach((pt, i) => {
      pt.position.x += Math.sin(time * 0.7 + i) * 0.0012;
      pt.position.y = 1 + ((i * 37) % 20) / 10 + Math.sin(time + i * 1.7) * 0.25;
      pt.rotation.z = time * 0.5 + i;
    });

    // Lantern flicker (each light keeps its own base intensity).
    this.lanternLights.forEach((l, i) => {
      l.intensity = (l.userData.base || 12) + Math.sin(time * 3 + i * 2) * 1.2;
    });
    // Fireflies drift and blink.
    this.fireflies.forEach((ff, i) => {
      const ph = time * 0.6 + ff.userData.phase;
      ff.position.set(
        ff.userData.base.x + Math.sin(ph) * 0.5,
        ff.userData.base.y + Math.sin(ph * 1.7) * 0.25,
        ff.userData.base.z + Math.cos(ph * 0.8) * 0.5
      );
      ff.material.opacity = 0.45 + Math.abs(Math.sin(time * 2 + i)) * 0.5;
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
