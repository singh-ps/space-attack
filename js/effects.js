"use strict";

// The same hulls are used for intact ships and their blast fragments.
const ShipHulls = {
  player: [[0, -24], [22, 18], [0, 9], [-22, 18]],
  delta: [[-18, -11], [0, -3], [18, -11], [11, 8], [0, 16], [-11, 8]],
  alpha: [[-21, -5], [-10, -14], [0, -8], [10, -14], [21, -5], [13, 12], [6, 3], [0, 18], [-6, 3], [-13, 12]],
  omega: [[-24, -7], [-12, -18], [12, -18], [24, -7], [21, 12], [11, 7], [0, 21], [-11, 7], [-21, 12]],
};

const GameEffects = (() => {
  function create(config) {
    return { config, blasts: [] };
  }

  function spawn(state, event) {
    const player = event.type === "player";
    const hull = ShipHulls[event.type];
    const duration = player ? state.config.effects.playerBlastDuration : state.config.effects.enemyBlastDuration;
    state.blasts.push({
      x: event.x, y: event.y, age: 0, duration,
      color: player ? "#70e6ef" : state.config.enemies[event.type].color,
      pieces: hull.map((point, index) => {
        const next = hull[(index + 1) % hull.length];
        const angle = Math.atan2(point[1] + next[1], point[0] + next[0]);
        return { points: [[0, 0], point, next], angle };
      }),
    });
  }

  function update(state, dt) {
    for (const blast of state.blasts) blast.age += dt;
    state.blasts = state.blasts.filter((blast) => blast.age < blast.duration);
  }

  function draw(state, ctx) {
    for (const blast of state.blasts) {
      const progress = blast.age / blast.duration;
      const travel = state.config.effects.fragmentSpeed * blast.age;
      ctx.save();
      ctx.translate(blast.x, blast.y);
      ctx.globalAlpha = (1 - progress) ** 2;
      ctx.strokeStyle = blast.color;
      ctx.lineWidth = 2 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, 5 + travel * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      for (const piece of blast.pieces) {
        ctx.save();
        ctx.translate(Math.cos(piece.angle) * travel, Math.sin(piece.angle) * travel);
        ctx.scale(1 - progress * 0.7, 1 - progress * 0.7);
        ctx.fillStyle = progress < 0.12 ? "#fff7db" : blast.color;
        ctx.beginPath();
        piece.points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#fff7db";
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, 9 * (1 - progress * 3)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return { create, spawn, update, draw };
})();

if (typeof module !== "undefined") module.exports = { ShipHulls, GameEffects };
