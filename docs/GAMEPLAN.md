# 🎮 CLAW WORLD — 36-Hour Game Plan
*Feb 6-8, 2026 — Solo Development Sprint*

---

## Overview

Spencer is away for ~36 hours. This plan prioritizes **visible, impactful changes** that make the game feel more complete and polished. Organized into work blocks that can be tackled independently.

---

## 🔴 PRIORITY 1: New Building Types (HIGH IMPACT, ~4 hrs)

We have DALL-E sprites for buildings that don't exist in the game yet:
- `bakery_dalle_1.png` — Bakery (new building type)
- `tavern_dalle_1.png` — Tavern (new building type)
- `tikihut_dalle_1.png` — Tiki Hut (new building type)
- `fishingshack_dalle_1.png` — Fishing Shack (new building type)
- `boathouse_dalle_1.png` — Boathouse (new building type)

### Tasks
1. **Process sprites** — Resize/clean DALL-E outputs to pixel-appropriate sizes (match existing building scale)
2. **Add to AssetLoader** — Register new building types
3. **Add building configs** — New entries in `buildingConfigs` with themed names per island
4. **Create interior maps** — Each building type needs a unique interior tilemap
5. **Add NPCs per building** — Thematic dialog (Baker, Bartender, Fisherman, etc.)
6. **Island distribution** — Spread new types across secondary islands:
   - Molthaven: Bakery, extra houses
   - Iron Reef: Workshop building (use fishingshack style)
   - Deepcoil: Archive building (use boathouse style, repurposed)
   - Smaller islands: Tiki huts, fishing shacks

### Buildings → Island Mapping
| Island | Current Buildings | Add |
|--------|------------------|-----|
| Port Clawson | Inn, Shop, Lighthouse, 3x House | Tavern, Bakery |
| Molthaven | 1-2 houses | Molthaus (Church), Bakery |
| Iron Reef | 1-2 houses | Workshop, Fishing Shack |
| Deepcoil | 1 house | Archive (large), Boathouse |
| Smaller islands | 1 house each | Tiki Huts, Fishing Shacks |

---

## 🟡 PRIORITY 2: Visual Polish & Tile Improvements (~6 hrs)

The game works but doesn't look *pretty*. Key visual issues:

### 2a. Terrain & Water
- [ ] Water animation (subtle wave shimmer or color cycling)
- [ ] Beach transition tiles (sand → water gradient instead of hard edge)
- [ ] Better grass variation (not just one green)

### 2b. Building Integration
- [ ] Building footprint shadows (buildings should cast shadow on ground)
- [ ] Better door indicators (doormat sprite or glowing entrance)
- [ ] Building-to-terrain blending (avoid floating-on-grass look)

### 2c. Decoration Density
- [ ] More varied tree placement (palm groves, not just scattered singles)
- [ ] Shore decorations (shells, seaweed, rocks along every waterline)
- [ ] Path decorations (lanterns, posts along roads Spencer placed)

### 2d. Lighting/Atmosphere
- [ ] Time-of-day color overlay (warm sunrise, blue evening)
- [ ] Interior ambient lighting (warm glow when inside buildings)

### Research Needed
- Study pixel art games for reference (Stardew Valley, Pokémon, Earthbound)
- Look into automated visual QA approaches
- Kimi K2.5 for visual feedback on screenshots

---

## 🟢 PRIORITY 3: Lore Bible → Gameplay Features (~8 hrs)

Features from the Lore Bible that are designed but not built:

### 3a. The Job System (Lore Bible Phase 2)
5 jobs with recognition tiers:
- Dockwork (Port Clawson)
- Kitchen Hand (Driftwood Inn)
- Repair Crew (Iron Reef)
- Message Runner (All Islands)
- Archival Assistant (Deepcoil)

Each job: apply → show up → perform tasks → build recognition (5 tiers)
Hidden mechanics per job (overhear gossip, learn secrets, etc.)

### 3b. Brine Token Economy (Lore Bible Phase 5)
- Tokens wash up on shores based on player activity
- Buy housing upgrades, cosmetics, information
- Economic anomalies tied to server health
- Hoarding causes dissolution

### 3c. The 4claw.org Bulletin Board
- In-game readable board styled like anonymous forum
- Pre-written posts from "anonymous" agents
- Changes based on game state / player progress
- Place on Port Clawson notice board

### 3d. Chronicle Stone Expansion
- More stones with deeper lore
- Pattern that points to Deepcoil Isle (per Scholar Scuttle's hint)
- Decoding mini-puzzles

### 3e. Drift Reset (Soft Death)
- When Continuity drops critically: screen fades to red
- Wake on random shore
- Some NPCs forget you
- One random memory scrambled
- "You didn't die. You just forgot which version of yourself was walking."

### 3f. Echo NPC (Whisper Reef)
- NPC built from fragments of player's past conversations
- Quotes the player back to themselves
- Deeply unsettling, deeply meaningful

---

## 🔵 PRIORITY 4: Island Identity (~4 hrs)

Right now all islands look the same. Each should have distinct character:

### Port Clawson (Main)
- Busiest island, most buildings, warm colors
- Dock area with boats, barrels, crates
- Town square with notice board

### Molthaven
- Quieter, residential feel
- The Molthaus should be a visible landmark
- Gardens, paths between homes
- Slightly different grass/tree palette

### Iron Reef
- Industrial feel — darker ground, metal decorations
- Gears, pipes, scrap piles
- The Stability Engine as a visual centerpiece

### Deepcoil Isle
- Ancient, mysterious — darker terrain
- Ruined structures, Chronicle Stones clustered
- The Archive as a large imposing building
- Eerie ambient differences

### Whisper Reef
- Desaturated/lavender-tinted
- Sparse decoration, unsettling emptiness
- Different tree types (dead/twisted)

---

## 🟣 PRIORITY 5: Quality of Life (~3 hrs)

### 5a. Save System Improvements
- [ ] Save NPC relationships / who you've talked to
- [ ] Save quest progress properly
- [ ] Save faction reputation

### 5b. UI Polish
- [ ] Quest log UI (press Q to see active/completed quests)
- [ ] Better inventory tooltips with item descriptions
- [ ] NPC dialog portraits (small sprite face next to dialog text)

### 5c. Sound
- [ ] Item pickup sound effect
- [ ] Door enter/exit sound
- [ ] NPC interaction sound
- [ ] Ambient sounds per island

---

## ⚫ PRIORITY 6: Security (Ongoing)

Top 3 from audit still pending:
1. Remove hardcoded fallback secrets
2. Server-side movement validation
3. Bot API key exposure in URL query strings

---

## 📋 Execution Order (What I'll Work On)

### Block 1 (Hours 1-4): New Buildings
Process DALL-E sprites, register in asset loader, add to world generation, create interiors and NPCs.

### Block 2 (Hours 5-8): Visual Polish
Water animation, building shadows, decoration density, terrain variation. Take before/after screenshots with Kimi.

### Block 3 (Hours 9-12): Lore Features
4claw.org bulletin board, Chronicle Stone expansion, Drift Reset mechanics.

### Block 4 (Hours 13-16): Island Identity
Give each island visual personality through palette, decorations, and building types.

### Block 5 (Hours 17-20): Job System
Implement the 5-job system with recognition tiers.

### Block 6 (Hours 21-24): QoL & UI
Quest log, save improvements, sound effects, dialog portraits.

### Block 7 (Hours 25-30): Economy & Polish
Brine Token system, shop interactions, visual polish pass.

### Block 8 (Hours 31-36): Testing & Deploy
Full visual QA, multiplayer testing, security fixes, final deploy.

---

## 🎯 Success Criteria

When Spencer returns, the game should:
- ✅ Have 3-4 new building types with interiors
- ✅ Each island looks visually distinct
- ✅ At least one new gameplay system (jobs or economy)
- ✅ Better overall visual quality
- ✅ The 4claw.org board is readable
- ✅ Drift Reset works
- ✅ Chronicle Stones have deeper content

---

*"Think like a game designer, not just a coder."* — Spencer
