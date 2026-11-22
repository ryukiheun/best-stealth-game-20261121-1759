// guard.js — stone-lantern guardian AI and its vision cone.
// States: "patrol" (walk waypoints, gold cone) -> "suspicious" (orange
// cone, "?", stares at the last seen / heard spot) -> "chase" (red cone,
// "!", runs at the player). A pebble clank sends guards to "investigate"
// the noise point. Suspicion is a 0..1 meter per guard; it fills while the
// player is inside the cone with line of sight, drains otherwise. Hiding
// inside bamboo breaks line of sight, so suspicion drains there.
// Line of sight is blocked by rocks (and the world border); bamboo also
// blocks sight from outside. Ponds do not block sight.

import {
  WORLD_W,
  WORLD_H,
  DETECT_FILL_CLOSE,
  DETECT_FILL_FAR,
  DETECT_FILL_SNEAK_MULT,
  DETECT_DRAIN,
  HEAR_FILL,
  SUSPICIOUS_TIME,
  CHASE_LOSE_TIME,
  CATCH_DISTANCE,
  INVESTIGATE_ARRIVE,
} from "./config.js";

// Does segment (x1,y1)-(x2,y2) cross rectangle r? Slab test.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// True when nothing (rock / bamboo) stands between guard and target.
export function hasLineOfSight(gx, gy, tx, ty, level) {
  for (const r of level.rocks) {
    if (segmentHitsRect(gx, gy, tx, ty, r)) return false;
  }
  // Bamboo hides: sight into or out of a thicket is blocked, unless the
  // viewer is inside the same thicket.
  for (const b of level.bamboo) {
    const viewerIn = pointInRect(gx, gy, b);
    const targetIn = pointInRect(tx, ty, b);
    if (viewerIn === targetIn) continue;
    if (segmentHitsRect(gx, gy, tx, ty, b)) return false;
  }
  return true;
}

export function isHiddenInBamboo(x, y, level) {
  return level.bamboo.some((b) => pointInRect(x, y, b));
}

// True when the point (x, y) is blocked for movement: outside the
// garden border or inside a rock or pond rect expanded by `radius` px.
// With `bambooSolid` true the point is also blocked inside a bamboo
// rect: guards use that (they walk around a thicket instead of through
// it, so hiding in bamboo is a real escape), while the player passes
// through bamboo to hide inside it (bambooSolid false).
export function blockedAt(x, y, level, radius, bambooSolid) {
  if (x < 24 + radius || x > WORLD_W - 24 - radius || y < 24 + radius || y > WORLD_H - 24 - radius) return true;
  for (const r of level.rocks) {
    if (x >= r.x - radius && x <= r.x + r.w + radius && y >= r.y - radius && y <= r.y + r.h + radius) return true;
  }
  for (const p of level.ponds) {
    if (x >= p.x - radius && x <= p.x + p.w + radius && y >= p.y - radius && y <= p.y + p.h + radius) return true;
  }
  if (bambooSolid) {
    for (const b of level.bamboo) {
      if (x >= b.x - radius && x <= b.x + b.w + radius && y >= b.y - radius && y <= b.y + b.h + radius) return true;
    }
  }
  return false;
}

export class Guard {
  constructor(def, level) {
    this.waypoints = def.waypoints;
    this.wpIndex = def.start || 0;
    this.x = def.waypoints[this.wpIndex][0];
    this.y = def.waypoints[this.wpIndex][1];
    this.speed = level.guardSpeed;
    this.chaseSpeed = level.chaseSpeed; // px/s, always above walk speed
    this.coneRange = level.coneRange;
    this.coneHalf = level.coneHalfAngle;
    this.angle = 0;
    this.state = "patrol";
    this.suspicion = 0; // 0..1; 1 triggers chase
    this.stateTime = 0; // s spent in the current state
    this.loseTime = 0; // s since last seeing the player while chasing
    this.stuckTime = 0; // s spent not moving while walking waypoints
    this.investigate = null; // {x, y} noise point, or null
    this.lastSeen = null;
    this.faceTarget();
  }

  faceTarget() {
    const wp = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    this.angle = Math.atan2(wp[1] - this.y, wp[0] - this.x);
  }

  // Can this guard see the player right now? Returns a fill rate (per s)
  // or 0 when the player is out of the cone, out of range, or hidden.
  seesPlayer(player, level) {
    if (player.hidden) return 0;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.coneRange) return 0;
    let diff = Math.atan2(dy, dx) - this.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > this.coneHalf) return 0;
    if (!hasLineOfSight(this.x, this.y, player.x, player.y, level)) return 0;
    let rate = dist < this.coneRange * 0.4 ? DETECT_FILL_CLOSE : DETECT_FILL_FAR;
    if (player.sneaking) rate *= DETECT_FILL_SNEAK_MULT;
    return rate;
  }

  // Footstep hearing: a moving fox inside its noise radius is heard.
  // Walking is heard within 70 px, sneaking within 26 px; standing
  // still and hiding in bamboo (which muffles steps) are silent.
  // Returns a suspicion fill rate (per s), or 0 when unheard.
  hearsPlayer(player) {
    if (player.hidden || player.noiseRadius <= 0) return 0;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    return dist < player.noiseRadius ? HEAR_FILL : 0;
  }

  hearNoise(x, y, radius) {
    if (this.state === "chase") return;
    if (Math.hypot(x - this.x, y - this.y) > radius) return;
    this.investigate = { x, y };
    this.state = "suspicious";
    this.stateTime = 0;
    this.angle = Math.atan2(y - this.y, x - this.x);
  }

  update(dt, player, level, onChaseStart) {
    this.stateTime += dt;
    const seen = this.seesPlayer(player, level);

    if (this.state === "patrol") {
      // Vision and footsteps both feed suspicion; hearing a step also
      // tells the guard where the sound came from.
      const heard = this.hearsPlayer(player);
      const fill = seen + heard;
      if (fill > 0) {
        this.suspicion = Math.min(1, this.suspicion + fill * dt);
        this.lastSeen = { x: player.x, y: player.y };
        if (this.suspicion >= 1) {
          this.investigate = null;
          this.state = "chase";
          this.stateTime = 0;
          this.loseTime = 0;
          if (onChaseStart) onChaseStart();
        } else if (this.suspicion > 0.35) {
          this.state = "suspicious";
          this.stateTime = 0;
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - DETECT_DRAIN * dt);
      }
      this.walkWaypoints(dt, level);
    } else if (this.state === "suspicious") {
      const heard = this.hearsPlayer(player);
      if (seen > 0 || heard > 0) {
        this.suspicion = Math.min(1, this.suspicion + (seen * 1.4 + heard) * dt);
        this.lastSeen = { x: player.x, y: player.y };
        if (this.suspicion >= 1) {
          this.investigate = null;
          this.state = "chase";
          this.stateTime = 0;
          this.loseTime = 0;
          if (onChaseStart) onChaseStart();
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - DETECT_DRAIN * 0.5 * dt);
      }
      // Stare at the last seen spot, or walk to a noise point. Once the
      // guard has stared long enough with suspicion drained, it gives up
      // and resumes its patrol — even when it never saw the player
      // (a pebble lure on its own must not freeze a guard forever).
      if (this.investigate) {
        this.moveToward(this.investigate.x, this.investigate.y, this.speed * 0.9, dt, level);
        if (Math.hypot(this.investigate.x - this.x, this.investigate.y - this.y) < INVESTIGATE_ARRIVE) {
          this.investigate = null;
          this.stateTime = 0;
        }
      } else {
        if (this.lastSeen) {
          this.angle = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        }
        if (this.stateTime > SUSPICIOUS_TIME && this.suspicion < 0.35) {
          this.state = "patrol";
          this.stateTime = 0;
          this.faceTarget();
        }
      }
    } else if (this.state === "chase") {
      if (seen > 0) {
        this.loseTime = 0;
        this.lastSeen = { x: player.x, y: player.y };
      } else {
        this.loseTime += dt;
      }
      const tx = this.lastSeen ? this.lastSeen.x : player.x;
      const ty = this.lastSeen ? this.lastSeen.y : player.y;
      this.moveToward(tx, ty, this.chaseSpeed, dt, level);
      if (this.loseTime > CHASE_LOSE_TIME) {
        this.state = "suspicious";
        this.stateTime = 0;
        this.suspicion = 0.5;
      }
    }
  }

  walkWaypoints(dt, level) {
    const wp = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    const bx = this.x;
    const by = this.y;
    const arrived = this.moveToward(wp[0], wp[1], this.speed, dt, level);
    if (arrived) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.faceTarget();
      this.stuckTime = 0;
    } else if (Math.hypot(this.x - bx, this.y - by) < 0.5) {
      // No progress: a corner the slide could not get around. Give up
      // on this waypoint after 2 s rather than standing there forever.
      this.stuckTime += dt;
      if (this.stuckTime > 2) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        this.faceTarget();
        this.stuckTime = 0;
      }
    } else {
      this.stuckTime = 0;
    }
  }

  // Step toward (tx,ty) at speed, sliding along rocks, ponds and
  // bamboo instead of walking through them. Moves axis by axis so the
  // guard slides along an obstacle edge; if both axes are blocked it
  // sidesteps perpendicular, and if that fails too it stands still
  // (the waypoint watchdog above then skips the waypoint).
  // Returns true when arrived.
  moveToward(tx, ty, speed, dt, level) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const ux = dx / dist;
    const uy = dy / dist;
    const ox = this.x;
    const oy = this.y;
    if (!blockedAt(this.x + ux * step, this.y, level, 16, true)) this.x += ux * step;
    if (!blockedAt(this.x, this.y + uy * step, level, 16, true)) this.y += uy * step;
    if (this.x === ox && this.y === oy) {
      if (!blockedAt(this.x - uy * step * 0.5, this.y + ux * step * 0.5, level, 16, true)) {
        this.x += -uy * step * 0.5;
        this.y += ux * step * 0.5;
      }
    }
    this.angle = Math.atan2(dy, dx);
    return Math.hypot(tx - this.x, ty - this.y) < 4;
  }

  catches(player) {
    return Math.hypot(player.x - this.x, player.y - this.y) < CATCH_DISTANCE;
  }
}
