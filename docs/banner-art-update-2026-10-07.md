# Banner and fortress artwork update

- Research Available now lives immediately above Undo Move, retaining its existing doctrine navigation and eligibility rules.
- Resources, editor/Endless status, turn notices and army upkeep flow in a top-left stack bounded by the action dock. Short windows can scroll the stack.
- Diplomacy uses the existing painted menu scene with lighter shading, readable message bubbles and modal layering above battle controls.
- Castle, legacy Fortress and Heavy Fortress use new transparent sprites. Only emerald fabric pixels receive nation colors; masonry, roofs, wood, metal and trim retain their original artwork. The board and info previews share this cached renderer.
- The three neutral elite unit types remain untinted.

Verification: all 43 Node test scripts passed; new fortress-art regression checks five nation colors, unchanged stone/wood, alpha, and neutral Dragon art. Browser gallery passed all nation variants. Visually checked both buildings, HUD layout at desktop and narrower window sizes, Research Available navigation, and long diplomacy history with controls fully visible.

## Artwork generation

Mode: new generation, built-in image generation, transparent background; no edit references. Original generated files retained.

Castle output: `assets/castle.png` (1312 × 1199).

Prompt: Use case: stylized-concept. Asset: transparent isolated medieval fantasy strategy-game building sprite. A compact square gray stone CASTLE, three-quarter isometric view, tall central keep, four crenellated corner towers, wooden gate, crisp detailed painted realism matching dark medieval Warborn unit art. Several LARGE saturated emerald-green fabric banners hanging vertically off the outer stone walls and green flags on tower poles, readable at tiny icon size. All stone and roofing strictly neutral gray, wood brown, metal steel; ONLY fabric is green, no moss, vegetation, green light or color spill on stone. Whole building centered with margin, no ground scene, no text, no border. Genuine transparent background.

Heavy Fortress output: `assets/heavy_fortress.png` (1536 × 1024).

Prompt: Use case: stylized-concept. Asset: transparent isolated medieval fantasy strategy-game building sprite. A massive broad gray stone HEAVY FORTRESS, three-quarter isometric view, layered thick defensive walls, six squat fortified towers, imposing armored gate and central bastion, crisp detailed painted realism matching dark medieval Warborn unit art. Several LARGE saturated emerald-green fabric banners hanging vertically off the outer stone walls and green flags on tower poles, readable at tiny icon size. All stone and roofing strictly neutral gray, wood brown, metal steel; ONLY fabric is green, no moss, vegetation, green light or color spill on stone. Whole building centered with margin, no ground scene, no text, no border. Genuine transparent background.
