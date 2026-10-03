"use strict";

// Fixed logical dimensions keep game coordinates independent of screen size.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const { width, height } = canvas;
const keys = new Set();
const ship = { x: width / 2, y: height - 58, speed: 420 };
const stars = Array.from({ length: 100 }, () => ({
  x: Math.random() * width,
  y: Math.random() * height,
  speed: 15 + Math.random() * 45,
  size: .5 + Math.random() * 1.5,
}));
let shots = [];
let lastFrame = 0;
let cooldown = 0;

function fire() {
  if (cooldown > 0) return;
  shots.push({ x: ship.x, y: ship.y - 24 });
  cooldown = .18;
}

window.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
});

function movePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  ship.x = Math.max(24, Math.min(width - 24, (event.clientX - bounds.left) * width / bounds.width));
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  canvas.setPointerCapture(event.pointerId);
  movePointer(event);
  fire();
});
canvas.addEventListener("pointermove", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) movePointer(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

function update(dt) {
  cooldown = Math.max(0, cooldown - dt);
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  ship.x = Math.max(24, Math.min(width - 24, ship.x + (Number(right) - Number(left)) * ship.speed * dt));
  if (keys.has("Space")) fire();
  for (const star of stars) star.y = (star.y + star.speed * dt) % height;
  for (const shot of shots) shot.y -= 620 * dt;
  shots = shots.filter((shot) => shot.y > -12);
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  for (const star of stars) {
    ctx.fillStyle = "#9ab6dc";
    ctx.globalAlpha = star.size / 2;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#70e6ef";
  for (const shot of shots) ctx.fillRect(shot.x - 2, shot.y, 4, 12);

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.fillStyle = "#ffb45e";
  ctx.beginPath();
  ctx.moveTo(-7, 16);
  ctx.lineTo(0, 25 + Math.random() * 10);
  ctx.lineTo(7, 16);
  ctx.fill();
  ctx.fillStyle = "#70e6ef";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(22, 18);
  ctx.lineTo(0, 9);
  ctx.lineTo(-22, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8fbff";
  ctx.fillRect(-3, -9, 6, 14);
  ctx.restore();

  ctx.fillStyle = "#7891b4";
  ctx.font = "12px monospace";
  ctx.fillText("SYSTEM ONLINE / FLIGHT TEST", 24, 32);
}

function frame(timestamp) {
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
  lastFrame = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
