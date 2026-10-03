# Space Attack

A five-level browser arcade game built with HTML5 canvas, vanilla JavaScript, and CSS.

**GitHub Pages:** https://singh-ps.github.io/space-attack/

## Local development

No dependencies or build step. Open `index.html` in your browser, or serve the directory:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000. Run simulation checks with:

```sh
node --test tests/*.test.js
```

## Controls

- Arrow keys or A / D: move left and right.
- Space: one shot per press, with a 350 ms cooldown. Holding does not fire repeatedly; presses during cooldown are discarded.
- Touch or mouse: drag to move; tap or click to fire.
- Escape or Pause: pause/resume. Switching tabs pauses automatically.

## Rules

Each level has six centered rows: 2 Omegas, 5 Alphas, and four rows of 7 Deltas. Up to three enemies detach and dive simultaneously. They travel down at constant speed, steering horizontally toward your position at intervals without rotating. Only diving enemies fire, straight down. Surviving enemies leave the bottom, wait, and return to their original formation slots. Destroyed enemies never return.

Every enemy takes one hit. Delta / Alpha / Omega kills award 100 / 250 / 500 points in formation, doubled in flight. Clear every enemy to advance. Five levels increase movement and projectile speed by 10% per level; clear level five to win.

You have three lives across the run. An enemy or enemy bullet costs one life. Projectiles are cleared and surviving enemies return to formation on death; score and kills persist. After a one-second respawn delay, the ship has two seconds of invulnerability, shown by blinking. No lives are refilled between levels. Losing all lives ends the game.

## Tuning and structure

- `js/config.js`: editable data object for player/enemy stats, weapons, cooldowns (seconds), scoring, formation, dive scheduling, respawns, and five difficulty multipliers. Distances use logical canvas pixels; speeds use pixels/second.
- `js/systems.js`: simulation systems operating on plain entity records and arrays. No classes or enemy inheritance. All tiers share dive/steer logic and use their own configuration.
- `js/game.js`: browser input, original canvas graphics, UI, and animation loop.
- `index.html` and `css/style.css`: page layout, HUD, and game-state overlays.
- `tests/systems.test.js`: automated gameplay checks using Node's built-in test runner.

Graphics use distinct silhouettes and colors for each tier. Tier-specific attack patterns can be added later to the shared systems.

## Deployment

GitHub Pages publishes the repository root from `main`. Push changes to `main` to update the site automatically. `.nojekyll` keeps the site as plain static files.
