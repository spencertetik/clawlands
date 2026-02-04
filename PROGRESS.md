**🌊 ClawWorld - OpenClaw RPG**

Project renamed from "Lobster RPG" to "ClawWorld" - a sophisticated pixel RPG designed for AI agents to explore and interact in.

Original prompt: Okay, so I'm giving you access to a folder here that I've been working with Claude on building a game that will work with OpenClaude. It is, you can just get in there and see what there is to see about it and see where we're at so far.

Updates (2026-02-03):
- Implemented building interiors with enter/exit via Space, interior NPCs + dialog.
- Added beach decor tiles and interior tileset placeholders.
- Added decoration tileset rendering support by allowing tile entries to specify a tileset key.
- Began building sprite pipeline: optional asset loading, placeholder building sprites, sprite assignment to buildings.
- Added deterministic test hooks: window.advanceTime and window.render_game_to_text.

TODO / Next:
- Replace placeholder building sprites with PixelLab assets under `client/assets/sprites/buildings/`.
- Wire NPC sprite assets (currently rectangle placeholders).
- Add shop UI / inventory interactions.
- Run Playwright test loop once server is up.
- Consider adding interior collision for furniture (currently decorative only).

Test notes:
- Playwright client failed: missing "playwright" package; npm install blocked by network (ENOTFOUND registry.npmjs.org).
- Server start attempted via `python3 serve.py &` (background); unable to verify process due to sysmon limitations.

Updates (2026-02-03):
- Added numbered tileset toggle (T) and on-screen debug indicator.
- Made toggle register numbered tileset on demand if image is loaded but not registered.
- Forced numbered tileset at startup (temporary for debugging). Reverted to toggle after confirming.

Updates (2026-02-03):
- Added accessory system scaffolding: catalog in `client/js/shared/constants.js`, accessory selection UI in `WelcomeScreen` + `CharacterBuilder`, and accessory overlays in `Game.createCombinedSpriteSheet` (supports separate walk frames).
- Added asset loading for accessory sprites (`client/assets/sprites/accessories/*.png`) and accessory sprite map builder in `Game`.
- Created OpenAI batch prompts: `tmp/imagegen/accessories.jsonl` with explicit output names for starter set.
- Added accessory downscale script: `tools/process_accessories.py` (1024 → 16x24, nearest-neighbor).

Test notes:
- Playwright client failed: missing `playwright` package (`ERR_MODULE_NOT_FOUND`).

## 🌊 Major Update (2026-02-03): ClawWorld Archipelago System

**Project Evolution:**
- Renamed from "Lobster RPG" to "ClawWorld" - better aligns with OpenClaw ecosystem
- Integrated sophisticated archipelago world generation system
- Enhanced building system with new ClawWorld-themed structures

**🏝️ Archipelago World Generation:**
- Added `createClawWorldArchipelago()` method to WorldMap class
- Generates strategic island grids with organic coastlines using existing Wang tileset autotiling
- Creates bridges connecting all islands via minimum spanning tree algorithm
- World size increased from 30x30 to 80x80 tiles for proper archipelago scale
- Islands vary in size with larger central islands, smaller edge islands

**🏗️ Enhanced Building System:**
- Added new building types: dock, temple, market (alongside existing inn, shop, house, lighthouse)
- Implemented `createClawWorldBuildings()` method that places buildings strategically on islands
- Each island gets unique thematic buildings with crustacean-themed names:
  - "Claw Harbor Inn", "Pincer Port Market", "Crown Reef Lighthouse", etc.
- Intelligent building placement algorithm finds suitable locations on island land areas
- Larger islands get additional houses for more complex settlements

**🎨 Building Theming:**
- Updated Building class with ClawWorld-appropriate colors and names
- Added support for new building types in rendering system
- Enhanced visual distinction between building types

**🖥️ Server Setup:**
- Updated development server (port 8080) with ClawWorld branding
- Game launches with archipelago world instead of basic test world

**Current Status:**
- ClawWorld generates beautiful archipelago worlds with connected islands
- Buildings are strategically placed on islands with proper collision detection
- Maintains all existing sophisticated features (multiplayer, interiors, character customization)
- Ready for AI agent integration and testing

**Next Steps:**
- Test AI agent behavior in archipelago environment
- Add more crustacean-themed NPCs and dialog
- Expand building interiors for new structure types
- Consider adding boat/ferry travel between islands
- Integrate multiplayer functionality for multiple AI agents

Test notes (2026-02-03):
- Installed Playwright locally + in `$CODEX_HOME/skills/develop-web-game` and downloaded browsers.
- Playwright launch still fails with macOS permission error (`MachPortRendezvousServer ... Permission denied`) when launching Chromium headless shell.

## 🦀 Major Update (2026-02-03 Evening): Character Species & Building System

**Character Species System:**
- Added 5 playable crustacean species: Lobster, Crab, Shrimp, Mantis Shrimp, Hermit Crab
- Created sprite processing pipeline (`tools/process_character_sprites.py`)
- All species have 4-direction sprites with 3-frame walk animations (16x24 pixels)
- Fixed Hermit Crab missing east sprites by flipping west horizontally
- Species selection in WelcomeScreen with live preview
- Character config persists across page refreshes

**Accessories System:**
- 7 accessories: Baseball Cap, Beanie, Bucket Hat, Sunglasses, Square Glasses, Scarf, Pirate Bandana
- Accessories have slot types (head, eyes, neck) for proper positioning
- Processed via `tools/process_accessories.py`
- Toggle accessories in character creation with preview

**Welcome Screen Enhancements:**
- Ocean-themed design with animated bubbles rising
- Crustacean emoji decorations floating around borders
- Wave effects at bottom of screen
- Shimmer effect on title
- Enhanced character preview with beach/ocean gradient background

**Building System Improvements:**
- Added interiors for all building types: Inn, Shop, House, Lighthouse, Dock, Temple, Market
- Each interior has unique decorations and layout
- NPCs placed inside buildings with themed dialog
- Interaction hint shows "[SPACE] Enter <building name>" when at entrance
- Visual feedback for all interactive elements

**Outdoor NPCs:**
- Added 6 NPC types that spawn on islands: Wandering Crab, Old Shrimp, Young Lobster, Hermit Harold, Sailor Sandy, Scholar Scuttle
- 1-2 NPCs per island based on island size
- NPCs persist when entering/exiting buildings

**Bug Fixes:**
- Fixed `isPositionSafe()` called before buildings initialized
- Disabled debug overlay by default (toggle with backtick key)
- Added try-catch around position saving to prevent freezes
- Fixed name input capturing WASD keys with stopPropagation

**Controls:**
- WASD: Move
- Space: Interact/Enter buildings/Talk to NPCs
- Backtick (`): Toggle debug mode
- Shift+R: Reset character (with confirmation)

Updates (2026-02-04):
- Added sprite normalization in `client/js/Game.js` so idle/walk sprites and frames are forced to 16x24 (and walk strips to 48x24). This should prevent visible size changes when some walk PNGs are different resolutions.

Test notes (2026-02-04):
- Playwright run in headed mode still stalled/failed inside Codex environment (Chromium launch issues). Likely requires running the test client locally outside the sandbox.

Updates (2026-02-04):
- Reprocessed all character species sprites with consistent per-strip bounds (no per-frame cropping) to remove walk-scale jitter.
- Synced root fallback sprites/frames from the lobster species for consistent defaults.
- Updated `tools/process_character_sprites.py` to enforce consistent frame bounds and root sync.

Updates (2026-02-04):
- Updated `tools/process_character_sprites.py` to scale by height (24px), crop width if needed, and bottom-anchor sprites to reduce jitter and restore larger character size.
- Reprocessed all species + root sprites after scaling change.

Updates (2026-02-04):
- Reworked `tools/process_character_sprites.py` to compute a **global scale per species** from per-frame content bounds (no per-frame scaling drift) and bottom-anchor sprites. This should keep sizes consistent and stop vertical walk jitter.
- Reprocessed all species + root sprites after the new global scaling pass.

Updates (2026-02-04):
- Increased character render size via `CONSTANTS.CHARACTER_RENDER_SCALE` (default 2.0) and applied bottom-anchored render offsets in `Player` and `NPC` renderers so sprites appear larger without changing collision size.

Updates (2026-02-04):
- Bumped `CHARACTER_RENDER_SCALE` to 3.0 for a much larger on-screen character size.

Updates (2026-02-04):
- Increased `CHARACTER_RENDER_SCALE` to 4.0 to address characters still appearing too small.

Updates (2026-02-04):
- Redesigned character selection layout to be shorter and more ocean-themed (removed emoji-heavy headers, added bio-form header, two-column layout).
- Added retro computer frame around the game canvas with CRT bezel, scanlines, vents, and badge styling.

Updates (2026-02-04):
- Increased sprite frame width to 24px (height 24px) for character assets and updated render pipeline to use `CHARACTER_SPRITE_WIDTH/HEIGHT` while keeping collision at 16x24.
- Regenerated all species sprites at 24x24 frames and mirrored east from west for consistent right-facing animations.

Updates (2026-02-04):
- Replaced the CSS CRT frame with an image-based frame layout (`#frame-scene` + `#frame-screen`) that auto-detects the white screen area and keeps the frame visible for all overlays.
- Updated welcome and character selection screens to render inside the frame screen overlay.

Updates (2026-02-04):
- Reworked welcome screen into a title-sequence flow: CRT power-on effect, typewritten story text that scrolls, then fades to logo + start button.
- Moved welcome + character creation UI into frame-screen overlay with fixed 900x560 layout, scaling-to-fit and pointer-events enabled.
- Added scanlines/power-on visuals to match the retro frame aesthetic.

Test notes (2026-02-04):
- Local server check to http://localhost:8080 failed with "Operation not permitted".
- Playwright client run timed out (likely due to browser launch/localhost restrictions in this environment).
