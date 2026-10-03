"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../js/config.js");
const systems = require("../js/systems.js");
const { ShipHulls, GameEffects } = require("../js/effects.js");

function game() {
  const state = systems.create(config, () => 0);
  systems.start(state);
  state.diveTimer = 999;
  systems.takeEvents(state);
  return state;
}

test("accepted shots emit one cue; cooldown rejects remain silent; events drain once", () => {
  const state = game();
  systems.fire(state);
  systems.fire(state);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "playerFire" }]);
  assert.deepEqual(systems.takeEvents(state), []);
  const enemy = state.enemies[0];
  Object.assign(enemy, { mode: "flight", weaponTimer: 0 });
  systems.update(state, 0.01);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "enemyFire", type: "omega" }]);
});

test("kills emit blasts with original tier and location, including the last enemy", () => {
  for (const type of ["delta", "alpha", "omega"]) {
    const state = game();
    const target = state.enemies.find((enemy) => enemy.type === type);
    for (const enemy of state.enemies) if (enemy !== target) enemy.mode = "dead";
    state.playerShots.push({ x: target.x, y: target.y + 25 });
    systems.update(state, 0.05);
    assert.deepEqual(systems.takeEvents(state), [
      { kind: "blast", type, x: target.x, y: target.y }, { kind: "levelup" },
    ]);
  }
});

test("player blast stays at impact location and simultaneous hits emit only one", () => {
  const state = game();
  state.player.x = 24;
  for (let i = 0; i < 3; i++) state.enemyShots.push({ x: 24, y: state.player.y, speed: 230 });
  systems.update(state, 0.01);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "blast", type: "player", x: 24, y: state.player.y }]);
  assert.equal(state.player.x, config.width / 2);
  systems.update(state, config.player.respawnDelay + 0.01);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "respawn" }]);
});

test("game-over, victory and restart emit one cue and discard old events", () => {
  const state = game();
  state.lives = 1;
  state.enemyShots.push({ x: state.player.x, y: state.player.y, speed: 230 });
  systems.update(state, 0.01);
  assert.deepEqual(systems.takeEvents(state).map((event) => event.kind), ["blast", "gameover"]);
  systems.update(state, 0.01);
  assert.deepEqual(systems.takeEvents(state), []);
  systems.start(state);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "start" }]);
  state.level = 5;
  for (const enemy of state.enemies) enemy.mode = "dead";
  systems.update(state, 0.01);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "victory" }]);
  systems.fire(state);
  systems.start(state);
  assert.deepEqual(systems.takeEvents(state), [{ kind: "start" }]);
});

test("blast fragments match hull and color, animate then expire independently of gameplay", () => {
  for (const type of ["player", "delta", "alpha", "omega"]) {
    const effects = GameEffects.create(config);
    GameEffects.spawn(effects, { type, x: 100, y: 200 });
    const blast = effects.blasts[0];
    assert.equal(blast.color, type === "player" ? "#70e6ef" : config.enemies[type].color);
    assert.equal(blast.pieces.length, ShipHulls[type].length);
    assert.deepEqual(blast.pieces[0].points[1], ShipHulls[type][0]);
    GameEffects.update(effects, blast.duration / 2);
    assert.equal(effects.blasts.length, 1);
    assert.ok(blast.age > 0);
    GameEffects.update(effects, blast.duration);
    assert.equal(effects.blasts.length, 0);
  }
});
