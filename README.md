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

AI, campaigns, the map editor, and local play run entirely in the browser. Online rooms use the bundled PeerJS 1.5.5 library and the free PeerJS Cloud signaling service to establish a browser-to-browser WebRTC data channel.

## Online multiplayer

1. Choose **Multiplayer**, enter your display name, and **Create room**.
2. Share the 8-character room code or **Copy invite link**. Your friend opens the game, enters their name and code, and chooses **Join room**.
3. Both names appear in the room. Both players choose **Ready**; the host chooses **Generate & start**.
4. Each new match uses a fresh seed and a 20×16 hex map. It selects a distinct setting—highlands, desert, islands, ancient forest, flooded marsh, or open frontier—and places 3–5 settlements. Terrain is mirrored by a 180-degree rotation; armies are identical, capitals are connected, neutral objectives are equally reachable, the first player is randomized, and both players begin with 0 gold and 0 materials.
5. **Return to lobby** ends the current match for both players. Ready up again for a newly generated map.

Keep both game tabs open. Rooms have two seats and are joined by invitation, not through a public room directory. Closing the host tab ends the room; reloads do not resume a match. Disconnects pause input, and a new match requires both players to ready up again. Editor and saved-map loading are unavailable during online matches.

The host coordinates numbered state revisions and turn ownership. Complete unit stats, research, resources, settlements, and victory results synchronize. This is casual multiplayer between trusted players, not a server-validated competitive anti-cheat system.

Some restrictive networks cannot establish direct WebRTC connections without a separately configured TURN relay. PeerJS Cloud availability is an external dependency. No private server credentials are included in this repository. See [PeerJS connection requirements](https://peerjs.com/client/faq).

## Tests

AI commanders defend threatened settlements, reinforce allies without abandoning their last garrison, protect mission targets, and use clerics. Recruitment balances counters, elite-unit research and saving, with at most three mobile units per owned settlement. Fortifications do not count toward that cap. Anchored land units can cross water and return to land; ships stay on water and dragons fly over every terrain. Fortresses remain immobile at every rank. The economy uses gold and materials only; old food values are ignored when loading saves.

```sh
node tests/fair-map.cjs
node tests/online-lobby.cjs
node tests/movement-rules.cjs
node tests/tactics.cjs
node tests/terrain.cjs
```

Tests cover 250 map seeds, all six terrain themes, 3–5 reachable settlements, geometry and resource symmetry, zero-resource multiplayer starts, movement terrain and occupancy restrictions, readiness, state/research synchronization, turn locking, stale revisions, disconnects, and fresh rematches. PeerJS's MIT license is included in `vendor/peerjs-LICENSE`.

## Artwork

Includes six distinct images for each of nine terrain families: grass, woods, mountains, swamp, desert, water, fountain, bridge, and farm. Terrain blends across tile boundaries, adjacent tiles use different variants, and bridges orient across surrounding water. Images are optimized for web delivery at the renderer's working resolution.

The browser source and bundled assets are derived from the Warborn desktop application. p5.js is bundled locally; its license notice remains in `vendor/p5.min.js`.
