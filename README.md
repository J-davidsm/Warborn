# Warborn

A browser-based fantasy strategy game. No installation or server is needed to play.

**[Play Warborn](https://j-davidsm.github.io/Warborn/)**

## Play

- Choose **Play** for a quick battle against the AI.
- Click a unit, then a reachable tile to move or an enemy to attack. Choose **End Turn** when finished.
- Choose **Endless Mode** for a scrolling survival battle on Easy, Medium, Hard, or Impossible.
- Choose **Multiplayer** to find other visitors or join a room with a code.
- Choose **Campaign → Start Campaign** to play the built-in campaign. For a generated battle, choose **Generate Scenario**, then **Test Scenario** on the new scenario card.
- Use the mouse wheel and arrow keys to navigate. The editor lets you build custom maps.
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

1. Choose **Multiplayer** to see visitors currently on the website. Enter your display name, **Join** an open room, or **Invite** an available commander.
2. To host, choose **2, 3, or 4 players** and **Create room**. Players can also join using the 8-character room code or **Copy invite link**.
3. Everyone chooses **Ready**; the host chooses **Generate & start** once all seats are filled.
4. Each match generates fresh terrain: highlands, desert, islands, ancient forest, flooded marsh, or open frontier, with 3–5 settlements. Two-player maps use a 20×16 board with rotational symmetry. Three-player maps use a hexagonal board with 120-degree symmetry; four-player boards use matching reflected territories. Each kingdom starts with an identical five-unit army, a capital, and **0 gold and 0 materials**. Capitals connect through fair routes and the first player is randomized.
5. **Return to lobby** ends the current match for everyone. Ready up again for a newly generated map.

Keep the host's game tab open. Closing it ends the room; reloads do not resume a match. Disconnects pause input, and a new match requires all seats to be filled and everyone to ready up again. Editor and saved-map loading are unavailable during online matches.

The live visitor directory is coordinated by an elected visitor's browser and recovers when that visitor leaves. Presence is temporary, with stale entries expiring after about 65 seconds. Visitors receive a generated commander name until they choose their own. No separate account is required.

The host coordinates numbered state revisions and turn ownership. Complete unit stats, research, resources, settlements, and victory results synchronize. This is casual multiplayer between trusted players, not a server-validated competitive anti-cheat system.

Some restrictive networks cannot establish direct WebRTC connections without a separately configured TURN relay. PeerJS Cloud availability is an external dependency. No private server credentials are included in this repository. See [PeerJS connection requirements](https://peerjs.com/client/faq).

## Endless Mode

Choose **Endless Mode** on the main menu and select a difficulty. The map is exactly 10 columns by 20 rows, including water along both side columns. A five-unit army (six on Easy) and a city give you a foothold; both kingdoms begin with zero gold and materials.

After each full round (your turn and the AI turn), the bottom row disappears, everything else shifts down, and a new enemy row enters from the top. Your units on the removed row are lost. Any living enemy reaching the red bottom row ends the run. Clearing the current enemies does not end the invasion.

Capture villages and cities for income and recruitment. New enemy settlements arrive every four waves on Easy, every three on Medium and Hard, and every two on Impossible. The AI continues defending, researching, recruiting, healing and attacking. Invasion enemies stay at war. Terrain changes between grassland, forest, desert, mountains and marsh, with clear central routes.

Easy gives you an extra knight, Archer and Cleric research, and a position four rows farther from the back edge. Its first ten waves contain only soldiers, wave size stays at one until wave 23, and elites begin at wave 36. Medium, Hard and Impossible also have delayed escalation, with elites beginning at waves 18, 10 and 6. Waves grow to at most three incoming units on Easy, five on Medium, and six on Hard and Impossible, in addition to AI recruitment. The HUD counts survived rounds and warns about endangered units. **Restart** repeats the same seed and difficulty with zero resources. **Menu → Play** returns to your previous ordinary scenario.

## Trading with AI kingdoms

Open **Diplomacy**, select an AI kingdom, and choose **Negotiate Trade**. Build a two-sided offer combining gold, materials, units, and settlements. No treaty is required, even during war. The menu shows acceptance chances and explains refusals. Friendly kingdoms tolerate a small disadvantage; enemies demand a premium and often refuse anyway. AI valuation considers unit health, morale, experience, and settlement income, and protects essential defenses and the last settlement.

Crowns and mission targets are protected. Transfer occupying units together with a settlement; transferred units stay on their tiles and act on their next turn. Ownership and balances are rechecked before the complete exchange. Repeating an offer in the same turn does not reroll acceptance.

## Tests

AI commanders defend threatened settlements, reinforce allies without abandoning their last garrison, protect mission targets, and use clerics. Recruitment balances counters, elite-unit research and saving, with at most three mobile units per owned settlement. Fortifications do not count toward that cap. Anchored land units can cross water and return to land; ships stay on water and dragons fly over every terrain. Fortresses remain immobile at every rank. The economy uses gold and materials only; old food values are ignored when loading saves.

```sh
node tests/fair-map.cjs
node tests/online-lobby.cjs
node tests/fair-multiplayer.cjs
node tests/multiplayer-four.cjs
node tests/public-lobby.cjs
node tests/crown.cjs
node tests/trade.cjs
node tests/endless.cjs
node tests/scenario-restart.cjs
node tests/research-menu.cjs
node tests/purchase-refresh.cjs
node tests/movement-rules.cjs
node tests/tactics.cjs
node tests/terrain.cjs
```

Tests cover 550 map seeds, all six terrain themes, 3–5 reachable settlements, geometry and resource symmetry, zero-resource multiplayer starts, movement terrain and occupancy restrictions, public discovery and invitations, directory takeover, 2–4-player readiness, state/research synchronization, turn locking, stale revisions, disconnects, and fresh rematches. PeerJS's MIT license is included in `vendor/peerjs-LICENSE`.

## Artwork

Includes six distinct images for each of nine terrain families: grass, woods, mountains, swamp, desert, water, fountain, bridge, and farm. Terrain blends across tile boundaries, adjacent tiles use different variants, and bridges orient across surrounding water. Images are optimized for web delivery at the renderer's working resolution.

The browser source and bundled assets are derived from the Warborn desktop application. p5.js is bundled locally; its license notice remains in `vendor/p5.min.js`.
