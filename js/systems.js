"use strict";

// Plain entity records and shared systems. No enemy classes or inheritance.
const GameSystems = (() => {
  function interval(state) {
    const { intervalMin, intervalMax } = state.config.diving;
    return intervalMin + state.random() * (intervalMax - intervalMin);
  }

  function create(config, random = Math.random) {
    return {
      config, random, phase: "ready", level: 1, score: 0,
      lives: config.player.lives, enemies: [], playerShots: [], enemyShots: [],
      player: { x: config.width / 2, previousX: config.width / 2, vx: 0,
        y: config.height - 48, cooldown: 0, invulnerable: 0 },
      timer: 0, diveTimer: 0,
    };
  }

  function formation(state) {
    const { config } = state;
    state.enemies = [];
    for (const [row, layout] of config.formation.rows.entries()) {
      for (let column = 0; column < layout.count; column++) {
        const x = config.width / 2 + (column - (layout.count - 1) / 2) * config.formation.columnSpacing;
        const y = config.formation.top + row * config.formation.rowSpacing;
        state.enemies.push({
          type: layout.type, x, y, homeX: x, homeY: y,
          mode: "formation", vx: 0, weaponTimer: 0, turnTimer: 0, returnTimer: 0,
          turnCount: 0, weaveSide: column % 2 === 0 ? -1 : 1, targetX: x,
        });
      }
    }
    state.playerShots = [];
    state.enemyShots = [];
    state.diveTimer = interval(state);
  }

  function start(state) {
    state.level = 1;
    state.score = 0;
    state.lives = state.config.player.lives;
    state.phase = "playing";
    state.timer = 0;
    Object.assign(state.player, { x: state.config.width / 2, previousX: state.config.width / 2,
      vx: 0, cooldown: 0, invulnerable: 0 });
    formation(state);
  }

  function fire(state) {
    if (state.phase !== "playing" || state.player.cooldown > 0) return false;
    state.playerShots.push({ x: state.player.x, y: state.player.y - 24 });
    state.player.cooldown = state.config.player.firing.weaponCooldown;
    return true;
  }

  function home(enemy) {
    Object.assign(enemy, { x: enemy.homeX, y: enemy.homeY, mode: "formation", vx: 0,
      turnCount: 0, targetX: enemy.homeX });
  }

  function loseLife(state) {
    state.lives--;
    state.playerShots = [];
    state.enemyShots = [];
    for (const enemy of state.enemies) if (enemy.mode !== "dead") home(enemy);
    state.player.x = state.config.width / 2;
    state.player.previousX = state.player.x;
    state.player.vx = 0;
    state.player.cooldown = 0;
    state.diveTimer = interval(state);
    state.phase = state.lives === 0 ? "gameover" : "respawning";
    state.timer = state.config.player.respawnDelay;
  }

  function advance(state) {
    state.phase = state.level === state.config.levels.length ? "won" : "levelclear";
    state.timer = state.config.levelDelay;
    state.playerShots = [];
    state.enemyShots = [];
  }

  function decideTurn(state, enemy, stats, multiplier) {
    const behavior = stats.behavior;
    let targetX = state.player.x;
    if (behavior.pattern === "weave") {
      const side = enemy.turnCount % 2 === 0 ? enemy.weaveSide : -enemy.weaveSide;
      targetX += side * behavior.weaveOffset;
    } else if (behavior.pattern === "predict") {
      targetX += state.player.vx * behavior.lookAhead;
    }
    enemy.targetX = Math.max(stats.radius, Math.min(state.config.width - stats.radius, targetX));
    const distance = enemy.targetX - enemy.x;
    enemy.vx = Math.abs(distance) < behavior.deadZone ? 0 : Math.sign(distance) * stats.steerSpeed * multiplier;
    enemy.turnCount++;
    enemy.turnTimer = stats.turnCooldown;
  }

  function updateEnemies(state, dt) {
    const { config } = state;
    const multiplier = config.levels[state.level - 1];
    state.diveTimer -= dt;
    const flying = state.enemies.filter((enemy) => enemy.mode === "flight").length;
    if (state.diveTimer <= 0 && flying < config.diving.maxConcurrent) {
      const candidates = state.enemies.filter((enemy) => enemy.mode === "formation");
      if (candidates.length) {
        const enemy = candidates[Math.floor(state.random() * candidates.length)];
        enemy.mode = "flight";
        enemy.turnTimer = 0;
        enemy.turnCount = 0;
        enemy.weaponTimer = config.enemies[enemy.type].firing.weaponCooldown;
      }
      state.diveTimer = interval(state);
    }
    for (const enemy of state.enemies) {
      const stats = config.enemies[enemy.type];
      if (enemy.mode === "returning") {
        enemy.returnTimer -= dt;
        if (enemy.returnTimer <= 0) home(enemy);
        continue;
      }
      if (enemy.mode !== "flight") continue;
      enemy.turnTimer -= dt;
      if (enemy.turnTimer <= 0) {
        decideTurn(state, enemy, stats, multiplier);
      }
      enemy.x = Math.max(stats.radius, Math.min(config.width - stats.radius, enemy.x + enemy.vx * dt));
      // Steering never changes the constant vertical velocity.
      enemy.y += stats.speed * multiplier * dt;
      if (enemy.y - stats.radius > config.height) {
        enemy.mode = "returning";
        enemy.returnTimer = config.diving.returnDelay;
        continue;
      }
      enemy.weaponTimer -= dt;
      if (enemy.weaponTimer <= 0) {
        state.enemyShots.push({ x: enemy.x, y: enemy.y + stats.radius, speed: stats.firing.speed * multiplier });
        enemy.weaponTimer = stats.firing.weaponCooldown;
      }
    }
  }

  // Swept checks prevent a fast projectile skipping targets between frames.
  function shotHits(shot, target, radius) {
    return Math.abs(shot.x - target.x) <= radius + 2 &&
      Math.min(shot.previousY, shot.y) <= target.y + radius &&
      Math.max(shot.previousY, shot.y) >= target.y - radius;
  }

  function updateProjectiles(state, dt) {
    for (const shot of state.playerShots) {
      shot.previousY = shot.y;
      shot.y -= state.config.player.firing.speed * dt;
      let closest = null;
      for (const enemy of state.enemies) {
        if (enemy.mode !== "formation" && enemy.mode !== "flight") continue;
        if (shotHits(shot, enemy, state.config.enemies[enemy.type].radius) && (!closest || enemy.y > closest.y)) closest = enemy;
      }
      if (closest) {
        state.score += state.config.enemies[closest.type].score[closest.mode === "flight" ? "flight" : "formation"];
        closest.mode = "dead";
        shot.dead = true;
      }
    }
    state.playerShots = state.playerShots.filter((shot) => !shot.dead && shot.y > -16);
    for (const shot of state.enemyShots) {
      shot.previousY = shot.y;
      shot.y += shot.speed * dt;
    }
    if (state.player.invulnerable <= 0) {
      const hitByShot = state.enemyShots.some((shot) => shotHits(shot, state.player, state.config.player.radius));
      const hitByEnemy = state.enemies.some((enemy) => enemy.mode === "flight" &&
        Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < state.config.player.radius + state.config.enemies[enemy.type].radius);
      if (hitByShot || hitByEnemy) {
        loseLife(state);
        return;
      }
    }
    state.enemyShots = state.enemyShots.filter((shot) => shot.y < state.config.height + 16);
  }

  function update(state, dt, direction = 0) {
    if (state.phase === "respawning" || state.phase === "levelclear") {
      state.timer -= dt;
      if (state.timer > 0) return;
      if (state.phase === "levelclear") {
        state.level++;
        formation(state);
      } else if (state.enemies.every((enemy) => enemy.mode === "dead")) {
        advance(state);
        return;
      }
      state.phase = "playing";
      state.player.invulnerable = state.config.player.invulnerability;
      state.player.previousX = state.player.x;
      state.player.vx = 0;
      return;
    }
    if (state.phase !== "playing") return;
    const { player, config } = state;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.x = Math.max(24, Math.min(config.width - 24, player.x + direction * config.player.speed * dt));
    // Sample actual movement for keyboard and pointer input. Clamp pointer jumps
    // to the ship's speed so prediction remains fair for every input method.
    const velocity = dt > 0 ? (player.x - player.previousX) / dt : 0;
    player.vx = Math.max(-config.player.speed, Math.min(config.player.speed, velocity));
    player.previousX = player.x;
    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    if (state.phase === "playing" && state.enemies.every((enemy) => enemy.mode === "dead")) advance(state);
  }

  return { create, start, fire, update };
})();

if (typeof module !== "undefined") module.exports = GameSystems;
