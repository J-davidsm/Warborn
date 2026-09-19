# Warborn

A browser-based fantasy strategy game. No installation or server is needed to play.

**[Play Warborn](https://j-davidsm.github.io/Warborn/)**

## Play

- Choose **Play** for a quick battle against the AI.
- Click a unit, then a reachable tile to move or an enemy to attack. Choose **End Turn** when finished.
- Choose **Local 2-Player** in the game mode selector for a shared-screen match.
- Choose **Campaign → Start Campaign** to play the built-in campaign. For a generated battle, choose **Generate Scenario**, then **Test Scenario** on the new scenario card.
- Use the map zoom controls and arrow keys to navigate. The editor lets you build custom maps.
- Saves are stored in this browser. Use the in-game export controls to keep a portable copy.

Desktop browsers with a mouse or trackpad offer the best experience.

## Run locally

Serve this directory with any static HTTP server, for example:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. There are no build dependencies.

## GitHub Pages

In the repository's **Settings → Pages**, select **Deploy from a branch**, **main**, and **/(root)**, then save. The root `index.html` and `.nojekyll` make this repository directly deployable, including at a project subpath.

AI, campaign, map editor, and shared-screen multiplayer run entirely in the browser. Internet multiplayer is not offered by this static distribution because the original relay needs a separately hosted server.

## Artwork

Includes six distinct images for each of nine terrain families: grass, woods, mountains, swamp, desert, water, fountain, bridge, and farm. Terrain blends across tile boundaries, adjacent tiles use different variants, and bridges orient across surrounding water. Images are optimized for web delivery at the renderer's working resolution.

The browser source and bundled assets are derived from the Warborn desktop application. p5.js is bundled locally; its license notice remains in `vendor/p5.min.js`.
