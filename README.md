# Space Attack

A browser game built with HTML5 canvas, vanilla JavaScript, and CSS.

**Play:** https://singh-ps.github.io/space-attack/

The initial flight test has an animated starfield, a movable ship, and firing controls. Gameplay will be built on this foundation.

## Local development

No dependencies or build step. Open `index.html` in your browser, or serve the directory:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Controls

- Arrow keys or A / D: move left and right.
- Space: fire.
- Touch or mouse: drag to move; tap or click to fire.

## Project files

- `index.html`: page and canvas.
- `css/style.css`: layout and styling.
- `js/game.js`: input, update loop, and canvas rendering.

## Deployment

GitHub Pages publishes the repository root from `main`. Push changes to `main` to update the site automatically. `.nojekyll` keeps the site as plain static files.
