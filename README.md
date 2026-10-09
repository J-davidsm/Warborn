# Warborn

A browser-based fantasy strategy game. No installation or server is needed to play.

**[Play Warborn](https://j-davidsm.github.io/Warborn/)**

## Desktop app: Windows, Ubuntu and Mac

Download an installer from [GitHub Releases](https://github.com/J-davidsm/Warborn/releases/latest), or use the [platform-detecting terminal installer](docs/desktop-install.md). Desktop builds share the website's multiplayer lobby. Release checks cover Windows x64, Ubuntu x64/ARM64 and Mac Intel/Apple Silicon.

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
2. To host, choose **Kingdoms · Competitive** or **Cooperative Endless**, then **2, 3, or 4 players** and **Create room**. Players can also join using the 8-character room code or **Copy invite link**.
3. Everyone chooses **Ready**; the host chooses **Generate & start** once all seats are filled.
4. Each competitive match generates fresh terrain: highlands, desert, islands, ancient forest, flooded marsh, or open frontier, with 3–5 settlements. Two-player maps use a 20×16 board with rotational symmetry. Three-player maps use a hexagonal board with 120-degree symmetry; four-player boards use matching reflected territories. Each kingdom starts with an identical five-unit army, a capital, and **0 gold and 0 materials**. Capitals connect through fair routes and the first player is randomized.
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

## Cooperative Endless

Choose **Multiplayer → Cooperative Endless**, select Easy, Medium, Hard, or Impossible, and create a room for 2–4 players. Join through the public lobby or a room code, then everyone readies up. Human kingdoms are permanently allied: they can move through and heal allied units and cannot attack allies or capture their towns.

Each player gets the same starting army, a city, and zero resources. The shared corridor remains 20 rows tall and widens to 18, 26, or 34 columns for 2, 3, or 4 players. Every extra player adds an eight-column front, a matching enemy wave, and recurring capturable settlements. Difficulty controls each front’s wave size and escalation, so total enemy pressure and AI settlement income grow with the party.

Players take turns, followed by one host-controlled AI turn. The map scrolls once per full round; movement, damage effects, recruitment, resources, and waves synchronize. Any enemy reaching the back edge defeats the team. Losing one player’s army and towns does not end the run while another ally survives; eliminated players watch the remaining allies. Keep the host connected. Return to the lobby to start another run.

## Field training and controls

The first battle on a browser or desktop profile opens Captain Garran’s guided training. The black-bearded captain explains the actual mission and points out your troops, objective, settlements and terrain. Use Next/Back, finish or skip, and replay it at any time from **?**. The field manual also contains all terrain effects and a unit reference with illustrated matchups.

Click any tile or unit to inspect it at bottom right. The sidebar uses stat symbols with hover labels and lists special abilities. To manage an occupied settlement, select its garrison and click it again. Upgrades show gold/material income increases and use the settlement’s configured cost. Villages are visibly smaller than towns, and cities larger.

The top cloth banner shows the active commander. Turn changes show an income receipt and announce the next commander, including online turns. Map zoom follows the pointer, stops at whole-map fit, respects the sidebar, and is disabled in settlement menus. H has no shortcut binding. **← Menu** returns from AI battles to the main menu.

Marsh attacks now deal 50% damage for every unit; the old attack prohibition is removed. Marsh art uses water, reeds and cattails, while forests use the original painting set. Connected bridges use one painting and a shared crossing direction.

Online matches resynchronize with their host when a tab becomes visible again, restoring authoritative unit readiness without granting extra actions. Browsers may still suspend a tab or device entirely; keep the host available. The desktop build disables Electron background throttling.

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

## Army doctrines

Research is a 28-node battlefield doctrine tree available through Research Points (RP) or timed study, with Warfare, Command, Defense, and Engineering branches. Gold and materials still fund units and settlement upgrades. `RESEARCH_TREE`, `researchedTechs`, `researchPoints`, and `RESEARCH_REWARDS` in `js/systems/economy-research.js` centralize costs, prerequisite paths, unlocks, stat effects, purchases, and rewards. The settlement Research tab shows the whole tree, including locked and unaffordable doctrines, and the main resource banner shows unspent RP.

Enemy kills earn 1 RP; Stockade/ Castle/ Heavy Fortress destruction earns 1/2/3 RP total (legacy Fortress earns 2). Neutral/enemy settlement captures earn 1/2 RP, only once per team per settlement. Successful upgrades earn 1 RP. Capture history travels with settlements through upgrades, saves, synchronization, and Endless scrolling. Move Undo restores both points and history. Ordinary damage, healing, movement, income, recruitment, allied kills and own losses earn nothing. Nonblocking battle notices show rewards to the local player.

`researchTech()` applies only the purchased node's permanent effects to existing living units. `makeUnit()` uses doctrine-adjusted defaults for new units; explicitly serialized stats override those defaults on load, preserving promotions and preventing repeated bonuses. Heavy Cavalry and Maneuver Warfare raise Knight movement to 3 without adding together; pre-existing promotion movement above that remains intact. Existing promotion mechanics are unchanged.

Snapshots carry `researchedTechs`, separate unspent `researchPoints`, feedback receipts, and a legacy unit-unlock mirror. Old `research` arrays migrate to doctrine IDs and ancestors without altering saved unit stats; missing RP defaults to zero. Custom scenarios can specify `startingResearchPoints: {PLAYER: 5, AI: 2}` (or `researchPoints`). Scenario creation, replay, campaign editing/loading, Endless starts, movement undo, modern multiplayer, and legacy synchronization carry or reset state as appropriate. Only the acting multiplayer authority awards points; snapshot receivers restore balances without awarding again. Normal battle research does not carry between campaign missions unless stored in that scenario.

Doctrine costs use the requested RP values. Longbows deals 25% less final damage at exactly range 3 (rounded down). The retired ship doctrines remain replaced by Siege Mobility (2 RP, requires Siege Engineering, Catapult movement floor 2), Counterweight Engines (4 RP, requires Reinforced Carriages, Catapult range +1 to 4), and Reinforced Carriages (6 RP, requires Siege Mobility, Catapult +30 HP). Ships are available without research, retaining normal costs and port placement rules. Obsolete ship doctrine IDs are ignored on saved-state import; they never grant unrelated siege bonuses. Swordsman remains controlled by settlement eligibility without research. Existing settlement upgrades currently cost zero materials, so Engineering Corps cannot reduce those prices further; its centralized discount applies if a material cost is introduced. Unit discounts do not affect RP or settlement eligibility.

AI doctrine priorities reuse diplomacy personalities and react to Knights, Dragons, fortresses, wounded armies, and Catapult specialization. The AI saves RP for its preferred next legal prerequisite instead of spending on cheaper weak choices. Research never reserves gold. Separate, bounded economic goals fund unlocked counter-units and settlement upgrades, yielding to emergency defense. AI fortresses and naval production use the same unlocks and discounted costs as players.

Run `node tests/research-points.cjs`, `node tests/doctrines.cjs`, `node tests/doctrine-sync.cjs`, and `node tests/research-menu.cjs`, or run all `tests/*.cjs` except the shared multiplayer harness. These cover currency isolation, exact kill rewards and fortress retaliation, all capture paths, recapture protection, upgrade failure, Undo, editor restrictions, starting RP, authoritative synchronization, costs/stats, prerequisites, Dragon Corps parents, unit unlocks, repeated load, migration, promotions, Knight caps, healing, defense, AI choices, and naval production.

## Commander AI

`js/systems/ai-commander.js` builds persistent objectives, task groups, territorial reserves, coordinated firing orders, and short-lived economic goals before the existing tactical turn executes. It uses cached terrain route fields for strategy and the existing movement checks for every actual move. Economic goals expire after three saving turns and are abandoned under immediate settlement threat. No new resource or combat bonuses are applied.

Diplomacy personalities also affect military behavior: Aggressive favors assaults and smaller reserves, Defensive holds more territory, Trader uses the Economic style, and Ideological uses the Cunning style. Campaign and Endless difficulty control target valuation and coordination; Easy omits planned focus fire, Normal coordinates lethal attacks, and Hard/Brutal also coordinate crippling attacks across more candidates. Composition observations track Dragons, fortresses, ranged armies, defensive concentration, and recent settlement losses.

Set `AICommander.debug = true` in the developer console to print each kingdom's objectives, assigned unit IDs, firing orders, observations, and economic goal. `AICommander.snapshot()` returns the same plain data saved and synchronized with the game. Route caches are not serialized. Old saves rebuild orders on the next AI turn. Run `node tests/ai-commander.cjs` for planning and large-map regression checks.

## Artwork

Includes six distinct images for each of nine terrain families: grass, woods, mountains, swamp, desert, water, fountain, bridge, and farm. Terrain blends across tile boundaries, adjacent tiles use different variants, and bridges orient across surrounding water. Images are optimized for web delivery at the renderer's working resolution.

The browser source and bundled assets are derived from the Warborn desktop application. p5.js is bundled locally; its license notice remains in `vendor/p5.min.js`.

### Timed doctrine study and Retaliation

Choose one legal doctrine to study per kingdom. Its RP cost is also its duration in your own turns (2 RP = 2 turns); progress advances when you end your turn. Switching discards all progress. Instant research still costs the full RP price. Active study and progress persist in saves, scenarios and multiplayer, and the AI uses study while retaining its RP priorities.

Fieldworks now only unlocks Stockades (new Stockades have base 50 HP). Retaliation replaces Garrison Training’s settlement defense bonus while retaining its stable saved ID. Only surviving fortresses with this doctrine counterattack, within their actual attack range; both sides show floating damage numbers. Explicit stats in older saves are preserved, including previously earned Stockade HP.

The research menu displays one selectable themed path at a time with actual prerequisite arrows, including both Dragon Corps prerequisites.

The four research branch selectors use distinct generated button paintings and full illustrated backgrounds (swords, standards, shields, and cogs). Warfare starts with Spear Doctrine, which leads to Steel Arms and Archery; Steel Arms leads to Cavalry Training. The siege chain ends with Siege Mobility → Reinforced Carriages → Counterweight Engines. Costs and effects stay attached to their doctrines. Older saves repair missing prerequisite ancestors without reapplying saved unit stats.
