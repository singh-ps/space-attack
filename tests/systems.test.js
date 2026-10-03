"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../js/config.js");
const systems = require("../js/systems.js");

function game() {
  const state = systems.create(config, () => 0);
  systems.start(state);
  state.diveTimer = 999;
  return state;
}
function fly(state, type = "delta") {
  const enemy = state.enemies.find((enemy) => enemy.type === type);
  Object.assign(enemy, { mode: "flight", x: 200, y: 280, weaponTimer: config.enemies[type].firing.weaponCooldown, turnTimer: 0 });
  return enemy;
}
function step(state, seconds) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= 0.01) systems.update(state, Math.min(0.01, remaining));
}

test("formation has six centered rows, 28 deltas, 5 alphas and 2 omegas", () => {
  const state = game();
  assert.equal(state.enemies.length, 35);
  for (const [type, count] of [["delta", 28], ["alpha", 5], ["omega", 2]]) {
    assert.equal(state.enemies.filter((enemy) => enemy.type === type).length, count);
  }
  const ys = [...new Set(state.enemies.map((enemy) => enemy.y))];
  assert.equal(ys.length, 6);
  for (const y of ys) {
    const row = state.enemies.filter((enemy) => enemy.y === y);
    assert.equal(row.reduce((sum, enemy) => sum + enemy.x, 0) / row.length, config.width / 2);
  }
  assert.equal(state.enemies.filter((enemy) => enemy.y === ys[5]).length, 7);
});

test("firing cooldown rejects spam, with no queued shots", () => {
  const state = game();
  state.player.x = 24;
  assert.equal(systems.fire(state), true);
  for (let i = 0; i < 20; i++) assert.equal(systems.fire(state), false);
  step(state, 0.34);
  assert.equal(systems.fire(state), false);
  step(state, 0.02);
  assert.equal(state.playerShots.length, 1);
  assert.equal(systems.fire(state), true);
  assert.equal(state.playerShots.length, 2);
});

test("steering decisions wait for cooldown and preserve vertical speed", () => {
  const state = game();
  const enemy = fly(state);
  state.player.x = 800;
  systems.update(state, 0.01);
  const velocity = enemy.vx;
  const y = enemy.y;
  state.player.x = 24;
  step(state, 0.5);
  assert.equal(enemy.vx, velocity);
  assert.ok(Math.abs(enemy.y - y - config.enemies.delta.speed * 0.5) < 1e-8);
  step(state, 0.72);
  assert.ok(enemy.vx < 0);
});

test("only flying enemies fire and weapon cooldown caps their shots", () => {
  const state = game();
  step(state, 3);
  assert.equal(state.enemyShots.length, 0);
  const enemy = fly(state, "omega");
  step(state, 0.89);
  assert.equal(state.enemyShots.length, 0);
  step(state, 0.02);
  assert.equal(state.enemyShots.length, 1);
  const shot = state.enemyShots[0];
  const x = shot.x;
  const y = shot.y;
  step(state, 0.1);
  assert.equal(shot.x, x);
  assert.ok(shot.y > y);
  assert.equal(state.enemyShots.length, 1);
  assert.ok(enemy.weaponTimer > 0);
});

test("survivors return to their slots; returning enemies block level completion", () => {
  const state = game();
  for (const enemy of state.enemies) enemy.mode = "dead";
  const enemy = fly(state);
  enemy.y = config.height + 20;
  systems.update(state, 0.01);
  assert.equal(enemy.mode, "returning");
  assert.equal(state.phase, "playing");
  step(state, config.diving.returnDelay + 0.01);
  assert.equal(enemy.mode, "formation");
  assert.equal(enemy.x, enemy.homeX);
  assert.equal(enemy.y, enemy.homeY);
  assert.equal(state.enemies.filter((enemy) => enemy.mode !== "dead").length, 1);
  assert.equal(state.score, 0);
});

test("one projectile kills one enemy and flight kills earn double points", () => {
  for (const type of ["delta", "alpha", "omega"]) {
    for (const mode of ["formation", "flight"]) {
      const state = game();
      const target = state.enemies.find((enemy) => enemy.type === type);
      for (const enemy of state.enemies) if (enemy !== target) enemy.mode = "dead";
      target.mode = mode;
      target.weaponTimer = 99;
      target.turnTimer = 99;
      state.playerShots.push({ x: target.x, y: target.y + 25 });
      systems.update(state, 0.05);
      assert.equal(target.mode, "dead");
      assert.equal(state.playerShots.length, 0);
      assert.equal(state.score, config.enemies[type].score[mode === "flight" ? "flight" : "formation"]);
    }
  }
  const state = game();
  const targets = state.enemies.filter((enemy) => enemy.x === config.width / 2);
  const bottom = targets[targets.length - 1];
  state.playerShots.push({ x: bottom.x, y: bottom.y + 20 });
  systems.update(state, 0.15);
  assert.equal(state.enemies.filter((enemy) => enemy.mode === "dead").length, 1);
  assert.equal(bottom.mode, "dead");
});

test("multiple hits cost one life, preserve score and kills, and grant respawn protection", () => {
  const state = game();
  state.score = 500;
  state.enemies[0].mode = "dead";
  fly(state);
  for (let i = 0; i < 3; i++) state.enemyShots.push({ x: state.player.x, y: state.player.y - 5, speed: 230 });
  systems.update(state, 0.01);
  assert.equal(state.lives, 2);
  assert.equal(state.phase, "respawning");
  assert.equal(state.score, 500);
  assert.equal(state.enemies[0].mode, "dead");
  assert.equal(state.enemyShots.length, 0);
  assert.equal(state.playerShots.length, 0);
  assert.equal(state.enemies.filter((enemy) => enemy.mode === "flight").length, 0);
  step(state, 1.01);
  assert.equal(state.phase, "playing");
  assert.ok(state.player.invulnerable > 1.9);
  state.enemyShots.push({ x: state.player.x, y: state.player.y, speed: 230 });
  systems.update(state, 0.01);
  assert.equal(state.lives, 2);
});

test("enemy contact kills player; third death ends run; restart resets it", () => {
  const state = game();
  const enemy = fly(state);
  enemy.x = state.player.x;
  enemy.y = state.player.y;
  systems.update(state, 0.01);
  assert.equal(state.lives, 2);
  for (let i = 0; i < 2; i++) {
    step(state, 1.01);
    state.player.invulnerable = 0;
    state.enemyShots.push({ x: state.player.x, y: state.player.y, speed: 230 });
    systems.update(state, 0.01);
  }
  assert.equal(state.lives, 0);
  assert.equal(state.phase, "gameover");
  assert.equal(systems.fire(state), false);
  systems.start(state);
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.level, 1);
  assert.equal(state.phase, "playing");
});

test("five cleared levels win, retaining lives and score between levels", () => {
  const state = game();
  state.lives = 2;
  state.score = 200;
  for (let level = 1; level <= 5; level++) {
    assert.equal(state.level, level);
    for (const enemy of state.enemies) enemy.mode = "dead";
    systems.update(state, 0.01);
    assert.equal(state.phase, level === 5 ? "won" : "levelclear");
    if (level < 5) {
      step(state, 2.01);
      assert.equal(state.enemies.length, 35);
      assert.equal(state.phase, "playing");
    }
    assert.equal(state.lives, 2);
    assert.equal(state.score, 200);
  }
  assert.equal(systems.fire(state), false);
});

test("higher levels speed up motion and diving never exceeds configured concurrency", () => {
  const first = game();
  const fifth = game();
  fifth.level = 5;
  const slow = fly(first);
  const fast = fly(fifth);
  systems.update(first, 0.1);
  systems.update(fifth, 0.1);
  assert.ok(Math.abs((fast.y - 280) / (slow.y - 280) - 1.4) < 1e-8);
  const state = game();
  state.diveTimer = 0;
  state.player.invulnerable = 999;
  for (let i = 0; i < 3000; i++) {
    systems.update(state, 0.01);
    assert.ok(state.enemies.filter((enemy) => enemy.mode === "flight").length <= 3);
    assert.ok(state.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));
  }
});
