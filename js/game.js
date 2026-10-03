"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const state = GameSystems.create(GAME_CONFIG);
const keys = new Set();
const overlay = document.querySelector("#overlay");
const title = document.querySelector("#status-title");
const kicker = document.querySelector("#status-kicker");
const message = document.querySelector("#status-message");
const action = document.querySelector("#start-game");
const pauseButton = document.querySelector("#pause-game");
const scoreDisplay = document.querySelector("#score");
const livesDisplay = document.querySelector("#lives");
const levelDisplay = document.querySelector("#level");
let paused = false;
let lastFrame = 0;
let displayedStatus = "";
let displayedLives = -1;
canvas.width = GAME_CONFIG.width;
canvas.height = GAME_CONFIG.height;
const stars = Array.from({ length: 100 }, () => ({
  x: Math.random() * canvas.width, y: Math.random() * canvas.height,
  speed: 15 + Math.random() * 45, size: 0.5 + Math.random() * 1.5,
}));

function start() {
  GameSystems.start(state);
  keys.clear();
  paused = false;
  canvas.focus();
  syncUI();
}

function togglePause() {
  if (!["playing", "respawning", "levelclear"].includes(state.phase)) return;
  paused = !paused;
  keys.clear();
  syncUI();
}

action.addEventListener("click", () => {
  if (paused) togglePause();
  else start();
  canvas.focus();
});
pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space", "Escape"].includes(event.code)) return;
  // Preserve normal keyboard activation of buttons.
  if (event.target instanceof HTMLButtonElement && event.code === "Space") return;
  event.preventDefault();
  if (event.code === "Escape") {
    if (!event.repeat) togglePause();
    return;
  }
  if (event.code === "Space" && !event.repeat && !keys.has("Space") && !paused) GameSystems.fire(state);
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
function suspend() {
  keys.clear();
  if (!paused && ["playing", "respawning", "levelclear"].includes(state.phase)) togglePause();
}
window.addEventListener("blur", suspend);
document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); });

function movePointer(event) {
  if (paused || state.phase !== "playing") return;
  const bounds = canvas.getBoundingClientRect();
  state.player.x = Math.max(24, Math.min(canvas.width - 24, (event.clientX - bounds.left) * canvas.width / bounds.width));
}
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  canvas.setPointerCapture(event.pointerId);
  movePointer(event);
  if (!paused) GameSystems.fire(state);
});
canvas.addEventListener("pointermove", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) movePointer(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}

function drawEnemy(enemy) {
  const stats = GAME_CONFIG.enemies[enemy.type];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  // Distinct silhouettes facing down. Steering never rotates the sprite.
  if (enemy.type === "delta") {
    polygon([[-18, -11], [0, -3], [18, -11], [11, 8], [0, 16], [-11, 8]], stats.color);
    polygon([[-6, -4], [6, -4], [0, 10]], "#15392e");
  } else if (enemy.type === "alpha") {
    polygon([[-21, -5], [-10, -14], [0, -8], [10, -14], [21, -5], [13, 12], [6, 3], [0, 18], [-6, 3], [-13, 12]], stats.color);
    polygon([[-4, -4], [4, -4], [4, 6], [-4, 6]], "#302154");
  } else {
    polygon([[-24, -7], [-12, -18], [12, -18], [24, -7], [21, 12], [11, 7], [0, 21], [-11, 7], [-21, 12]], stats.color);
    polygon([[-10, -7], [10, -7], [6, 5], [-6, 5]], "#6b381a");
    ctx.fillStyle = "#fff2c7";
    ctx.fillRect(-3, -5, 6, 9);
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const star of stars) {
    ctx.fillStyle = "#9ab6dc";
    ctx.globalAlpha = star.size / 2;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  for (const enemy of state.enemies) {
    if (enemy.mode === "formation" || enemy.mode === "flight") drawEnemy(enemy);
  }
  ctx.fillStyle = "#70e6ef";
  for (const shot of state.playerShots) ctx.fillRect(shot.x - 2, shot.y - 6, 4, 12);
  ctx.fillStyle = "#ff6f89";
  for (const shot of state.enemyShots) ctx.fillRect(shot.x - 2, shot.y - 5, 4, 10);
  if (state.phase !== "respawning" && state.phase !== "gameover" &&
      !(state.player.invulnerable > 0 && Math.floor(state.player.invulnerable * 10) % 2)) {
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    polygon([[-7, 16], [0, 29], [7, 16]], "#ffb45e");
    polygon([[0, -24], [22, 18], [0, 9], [-22, 18]], "#70e6ef");
    ctx.fillStyle = "#e8fbff";
    ctx.fillRect(-3, -9, 6, 14);
    ctx.restore();
  }
}

function syncUI() {
  scoreDisplay.textContent = String(state.score).padStart(6, "0");
  if (displayedLives !== state.lives) {
    displayedLives = state.lives;
    livesDisplay.innerHTML = Array.from({ length: GAME_CONFIG.player.lives }, (_, index) =>
      `<img class="life-icon${index >= state.lives ? " is-lost" : ""}" src="./assets/ship.svg" alt="">`).join("");
    livesDisplay.setAttribute("aria-label", `${state.lives} ${state.lives === 1 ? "ship" : "ships"} remaining`);
  }
  levelDisplay.textContent = `${state.level} / ${GAME_CONFIG.levels.length}`;
  pauseButton.disabled = !["playing", "respawning", "levelclear"].includes(state.phase);
  pauseButton.textContent = paused ? "Resume" : "Pause";
  overlay.hidden = !paused && state.phase === "playing";
  action.hidden = !paused && ["respawning", "levelclear"].includes(state.phase);
  const statusKey = `${paused}:${state.phase}:${state.level}:${state.lives}:${state.score}`;
  if (displayedStatus === statusKey) return;
  displayedStatus = statusKey;
  overlay.dataset.state = paused ? "paused" : state.phase;
  if (paused) {
    kicker.textContent = "FLIGHT ON HOLD";
    title.textContent = "Paused";
    message.textContent = "Take a breath. Resume when you’re ready.";
    action.textContent = "Resume game";
  } else {
    const statuses = {
      ready: ["MISSION BRIEFING", "Ready, pilot?", "Clear five formations. Three ships. Make every shot count.", "Launch"],
      respawning: ["HULL BREACH", "Ship lost", `${state.lives} ${state.lives === 1 ? "ship" : "ships"} left. Relaunching with shields.`, ""],
      levelclear: ["SECTOR SECURED", `Level ${state.level} complete`, `Formation eliminated. Level ${state.level + 1} incoming. Stay sharp.`, ""],
      gameover: ["MISSION ENDED", "Game over", `Fleet lost in level ${state.level}. Final score: ${state.score.toLocaleString()}.`, "Try again"],
      won: ["MISSION ACCOMPLISHED", "Sector secured", `All five levels cleared! Final score: ${state.score.toLocaleString()}.`, "Fly again"],
    };
    const status = statuses[state.phase];
    if (status) [kicker.textContent, title.textContent, message.textContent, action.textContent] = status;
  }
}

function frame(timestamp) {
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
  lastFrame = timestamp;
  if (!paused) {
    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    GameSystems.update(state, dt, Number(right) - Number(left));
    for (const star of stars) star.y = (star.y + star.speed * dt) % canvas.height;
  }
  draw();
  syncUI();
  requestAnimationFrame(frame);
}

syncUI();
requestAnimationFrame(frame);
