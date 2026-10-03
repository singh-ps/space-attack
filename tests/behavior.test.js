"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../js/config.js");
const systems = require("../js/systems.js");

function scenario(type, x = 480) {
  const state = systems.create(config, () => 0);
  systems.start(state);
  state.diveTimer = 999;
  state.player.invulnerable = 999;
  const enemy = state.enemies.find((entity) => entity.type === type);
  Object.assign(enemy, { mode: "flight", x, y: 60, weaponTimer: config.enemies[type].firing.weaponCooldown });
  return { state, enemy };
}

function step(state, duration) {
  for (let remaining = duration; remaining > 1e-9; remaining -= 0.01) {
    systems.update(state, Math.min(remaining, 0.01));
  }
}

test("Delta tracks current position while Omega leads a moving player", () => {
  for (const direction of [-1, 1]) {
    const x = direction === 1 ? 500 : 460;
    const delta = scenario("delta", x);
    const omega = scenario("omega", x);
    systems.update(delta.state, 0.01, direction);
    systems.update(omega.state, 0.01, direction);
    assert.equal(Math.sign(delta.enemy.vx), -direction);
    assert.equal(Math.sign(omega.enemy.vx), direction);
    assert.equal(delta.enemy.targetX, delta.state.player.x);
    assert.equal(Math.sign(omega.enemy.targetX - omega.state.player.x), direction);
  }
});

test("Alpha alternates weaving direction around a stationary player", () => {
  const { state, enemy } = scenario("alpha");
  systems.update(state, 0.01);
  const firstTarget = enemy.targetX;
  const firstDirection = Math.sign(enemy.vx);
  step(state, 0.4);
  assert.equal(enemy.targetX, firstTarget);
  assert.equal(Math.sign(enemy.vx), firstDirection);
  step(state, 0.41);
  assert.equal(Math.sign(enemy.vx), -firstDirection);
  assert.equal(Math.sign(enemy.targetX - state.player.x), -Math.sign(firstTarget - state.player.x));
  step(state, 0.8);
  assert.equal(Math.sign(enemy.vx), firstDirection);
  assert.equal(enemy.targetX, firstTarget);
});

test("every pattern holds decisions through its cooldown and descends at constant speed", () => {
  for (const type of ["delta", "alpha", "omega"]) {
    const { state, enemy } = scenario(type, 300);
    systems.update(state, 0.01);
    const target = enemy.targetX;
    const vx = enemy.vx;
    const y = enemy.y;
    state.player.x = 24;
    const duration = config.enemies[type].turnCooldown / 2;
    step(state, duration);
    assert.equal(enemy.targetX, target);
    assert.equal(enemy.vx, vx);
    assert.equal(enemy.turnCount, 1);
    assert.ok(Math.abs(enemy.y - y - duration * config.enemies[type].speed) < 1e-8);
    step(state, duration + 0.02);
    assert.equal(enemy.turnCount, 2);
    assert.notEqual(enemy.targetX, target);
  }
});

test("Omega predicts pointer movement, limits jumps, and stops leading a stationary ship", () => {
  const { state, enemy } = scenario("omega", 500);
  state.player.x += 20;
  systems.update(state, 0.05);
  assert.ok(state.player.vx > 0);
  assert.ok(enemy.targetX > state.player.x);
  state.player.x = 900;
  enemy.turnTimer = 0;
  systems.update(state, 0.01);
  assert.equal(state.player.vx, config.player.speed);
  assert.equal(enemy.targetX, config.width - config.enemies.omega.radius);
  enemy.turnTimer = 0;
  systems.update(state, 0.01);
  assert.equal(state.player.vx, 0);
  assert.equal(enemy.targetX, state.player.x);
  state.player.x = 24;
  enemy.turnTimer = 0;
  systems.update(state, 0.01);
  assert.equal(state.player.vx, -config.player.speed);
  assert.equal(enemy.targetX, config.enemies.omega.radius);
});

test("Alpha targets remain within the arena at either edge", () => {
  for (const side of [-1, 1]) {
    const { state, enemy } = scenario("alpha");
    state.player.x = side < 0 ? 24 : config.width - 24;
    enemy.weaveSide = side;
    systems.update(state, 0.01);
    assert.equal(enemy.targetX, side < 0 ? config.enemies.alpha.radius : config.width - config.enemies.alpha.radius);
  }
});

test("Delta fires more often, with higher tiers retaining faster capped rates", () => {
  assert.ok(config.enemies.delta.firing.weaponCooldown < 2);
  assert.ok(config.enemies.alpha.firing.weaponCooldown < config.enemies.delta.firing.weaponCooldown);
  assert.ok(config.enemies.omega.firing.weaponCooldown < config.enemies.alpha.firing.weaponCooldown);
  for (const type of ["delta", "alpha", "omega"]) {
    const { state } = scenario(type);
    const cooldown = config.enemies[type].firing.weaponCooldown;
    step(state, cooldown - 0.01);
    assert.equal(state.enemyShots.length, 0);
    step(state, 0.02);
    assert.equal(state.enemyShots.length, 1);
    const shot = state.enemyShots[0];
    const x = shot.x;
    const y = shot.y;
    step(state, 0.2);
    assert.equal(state.enemyShots.length, 1);
    assert.equal(shot.x, x);
    assert.ok(shot.y > y);
  }
});

test("return and death reset behavior state and player prediction", () => {
  const { state, enemy } = scenario("alpha");
  systems.update(state, 0.01, 1);
  assert.equal(enemy.turnCount, 1);
  enemy.y = config.height + 30;
  systems.update(state, 0.01);
  step(state, config.diving.returnDelay + 0.01);
  assert.equal(enemy.mode, "formation");
  assert.equal(enemy.turnCount, 0);
  assert.equal(enemy.targetX, enemy.homeX);
  state.player.invulnerable = 0;
  state.enemyShots.push({ x: state.player.x, y: state.player.y, speed: 230 });
  systems.update(state, 0.01);
  assert.equal(state.phase, "respawning");
  assert.equal(state.player.vx, 0);
  assert.equal(state.player.previousX, state.player.x);
});
