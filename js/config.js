"use strict";

// Pixels, pixels/second, and seconds. All gameplay tuning lives here.
const GAME_CONFIG = {
  width: 960, height: 540,
  player: {
    type: "player", speed: 420, radius: 16, lives: 3, turnCooldown: 0,
    firing: { speed: 620, weaponCooldown: 0.35 },
    respawnDelay: 1, invulnerability: 2,
  },
  enemies: {
    delta: {
      type: "delta", color: "#79f2bd", radius: 15, speed: 105, steerSpeed: 85,
      firing: { speed: 230, weaponCooldown: 2 }, turnCooldown: 1.2,
      score: { formation: 100, flight: 200 },
    },
    alpha: {
      type: "alpha", color: "#b9a0ff", radius: 17, speed: 105, steerSpeed: 85,
      firing: { speed: 230, weaponCooldown: 1.4 }, turnCooldown: 0.8,
      score: { formation: 250, flight: 500 },
    },
    omega: {
      type: "omega", color: "#ffb45e", radius: 20, speed: 105, steerSpeed: 85,
      firing: { speed: 230, weaponCooldown: 0.9 }, turnCooldown: 0.5,
      score: { formation: 500, flight: 1000 },
    },
  },
  formation: {
    rows: [
      { type: "omega", count: 2 }, { type: "alpha", count: 5 },
      { type: "delta", count: 7 }, { type: "delta", count: 7 },
      { type: "delta", count: 7 }, { type: "delta", count: 7 },
    ],
    top: 52, columnSpacing: 56, rowSpacing: 36,
  },
  diving: { maxConcurrent: 3, intervalMin: 0.9, intervalMax: 1.6, returnDelay: 1.5 },
  levels: [1, 1.1, 1.2, 1.3, 1.4], levelDelay: 2,
};

if (typeof module !== "undefined") module.exports = GAME_CONFIG;
