# Warborn commander update — October 7, 2026

## Systems changed

- Research keeps the selected branch, uses compact connected nodes and stationary full-menu artwork, and announces completion in a small fading corner notice. Research Available opens the team's research interface.
- Phalanx Warriors replaces Reconnaissance without changing its stable save ID. Dragon Corps moves to the end of Command, requiring Maneuver Warfare and Master Assassins. Old Mass Production keeps its material discount under Recycling and its original ID. New Mass Production (`rapid_mobilization`, 6 RP) requires Artillery and Recycling and permits half movement, rounded down, on construction turns; attacks remain unavailable.
- One shared combat calculation supplies attacks, fortress retaliation, AI estimates, and hover previews. Knights earn exactly one follow-up attack on their first kill. Catapults move or attack. Dragons cost 3 gold/7 material and deal double damage to Catapults. Spearman defense is 25%, or 40% with Phalanx and two adjacent friendly Spearmen.
- Swordsmen track kill-turn streaks independently: 40%, +10% for successive kill-turns up to 100%, then half after one missed kill-turn and zero after two. Their damage and red ripple visuals use that saved state.
- Territory is grassland 1, farms 3, desert/marsh 0 and other playable terrain 0.5. Fortresses can occupy every playable terrain except water and marsh, while retaining occupancy, settlement, and construction rules.
- A shared canvas renderer draws both battlefield units and enlarged info previews, including ranks, morale, health, readiness and effects. Broken morale suppresses readiness animations. Health bars sit higher and are thinner.
- Nation-colored cached variants cover every ordinary unit, structure and ship. Swordsmen, Assassins and Dragons intentionally retain one neutral silhouette per unit type, while their status effects remain on the team-colored hex below. Cloth, shields, robes, sails and siege pennants carry nation colors. Soldier artwork has no shield; Spearmen retain large shields. Sprite caches are bounded to 384 pixels per side.
- Diplomacy resets relationships, messages, pacts, attitudes and delayed callbacks on new games. Conversation history persists for resumed matches. Names use nation labels, messages use expanded pools, treaty offers have clickable alerts, pacts appear below nation names, and history scrolls independently of actions.
- Eliminated nations lose their territory, turns and diplomatic interactions once they have neither living units nor settlements. Undoing a move restores any capture-triggered diplomatic/elimination changes.
- Crusades require growing human military strength, a human army no more than 25% stronger, and either five consecutive attacked turns or five losses in five turns. They last five AI turns and make free forces prioritize nearby human threats, with one varied announcement.

## Architecture and compatibility

Existing research IDs remain stable. Existing saves without new fields receive normal defaults. Permanent doctrine stats are not reapplied on loading. Streak state, action flags, deployment movement limits, research, diplomacy and turn numbers serialize through level snapshots and multiplayer. New rendering and alert helpers are loaded by index.html; existing combat, movement, economy, AI and diplomacy systems remain authoritative.

Main files: combat-turns.js, economy-research.js, units-and-build.js, diplomacy.js, territory.js, ai-commander.js, ai-turn.js, level-state.js, multiplayer-sync.js, online-lobby.js, renderer.js, unit-presentation.js, battle-alerts.js, battle-guide.js, styles.css and related setup/input/UI integration.

## Verification

41 automated regression suites pass, covering combat, promotion, movement, research, save/load, multiplayer, diplomacy, territory, campaigns, Endless and cooperative Endless. Additional explicit checks cover the new combat modifiers, exact predicted damage across 27 combinations, streak growth/decay, Knight attack reuse, Catapult restrictions, deployment movement, dynamic Phalanx, crusade triggers/duration and elimination.

Browser checks: research purchase preserves Command; research alerts navigate correctly; nation elimination disables its card; treaty alerts open the proposing nation; a 150-message history leaves every diplomacy action within a 720px viewport. Manual fixtures are reproducible with `node tests/generate-preview.cjs` and a local server; the generated page is ignored and never loaded by the production game.

All requested numerical balance values are used. Dragon Corps retains its 6 RP price; its new Command prerequisites and new Mass Production's 6 RP price are implementation choices where no new price was specified. A kill after a broken Swordsman streak starts a new 40% streak.

## Artwork provenance

Built-in image generation was used, with these prompt specifications:

- Soldier edit: preserve the existing medieval painted unit style; remove the shield entirely; give the Soldier a sword and visible green cloth, full body, isolated transparent background.
- Sloop: isolated small medieval sailing vessel, green sails and flags, detailed painted game-unit style, transparent background, no text.
- Man-of-War: larger medieval warship with multiple green sails and flags, wooden hull, painted game-unit style, transparent background, no text.
- Battleship: imposing heavily armed medieval fantasy warship with green banners, painted game-unit style, transparent background, no text.
- Ship cleanup edits: remove all backdrop and glow while preserving the vessel, sails and rigging; transparent background and gaps.

Final assets: `assets/soldier.png`, `assets/sloop.png`, `assets/man_of_war.png`, `assets/battleship.png`. Existing remaining unit artwork is reused; team-color variants are computed and cached by `js/rendering/unit-presentation.js`.
