# ClawWorld Systems Plan — Zelda: Link's Awakening Inspired
*Reference: Link's Awakening (1993/2019 Switch Remake)*

Spencer wants ClawWorld gameplay to feel like Zelda: Link's Awakening. This doc maps LA's core systems to ClawWorld equivalents with our unique crustacean/AI spin.

---

## 1. HEALTH SYSTEM

### Link's Awakening
- **Hearts** — starts with 3, max 14 (20 in DX/Switch)
- **Heart Containers** — +1 full heart after each dungeon boss
- **Heart Pieces** — 4 pieces = 1 full heart (scattered in overworld)
- **Recovery Hearts** — dropped by enemies/grass, restore ¼ or full heart
- **Fairy** — caught in bottles, auto-heals when health hits 0 (or manual use)
- **Secret Medicine** — bought from Crazy Tracy for 28 rupees, auto-revive on death

### ClawWorld Equivalent
- **Shell Integrity** (already built) — rename display to "Shell" with heart-style icons
- **Shell Fragments** — dropped by enemies (already exists as loot), restore 10-25 HP
- **Shell Plates** — boss/quest reward, permanently increases max Shell (+10)
- **Tide Pools** — heal stations scattered on islands (walk into to heal, like fairy fountains)
- **Brine Elixir** — buyable from shops, heals 50 HP (like Secret Medicine)
- **Bottled Fairy equivalent** — "Drift Essence" — auto-revive once per life, buyable/findable

**Priority:** ✅ Shell Fragments already drop. Need: Tide Pools, Brine Elixir in shops.

---

## 2. CURRENCY / ECONOMY

### Link's Awakening
- **Rupees** — found in grass, pots, chests, enemy drops
- Denominations: green (1), blue (5), red (20), purple (50)
- Max wallet: 999 rupees
- Earned by: defeating enemies, cutting grass, opening chests, mini-games, selling

### ClawWorld Equivalent
- **Brine Tokens** (from lore bible) — the island's currency
- Denominations: Copper (1), Silver (5), Gold (20), Pearl (50)
- Found by: defeating Drift Fauna, opening chests, fishing, quest rewards, selling items
- Max wallet: 999 tokens
- Enemy drops: small chance per kill (Skitter: 1-3, Haze: 3-5, Loopling: 2-8)
- **Grass/decoration breaking** — future feature, drop tokens + items

**Sprint priority:** Add Brine Token tracking to player, show on HUD, drop from enemies.

---

## 3. SHOP SYSTEM

### Link's Awakening
- **Mabe Village Shop** — sells: Shovel (200), Bow (980), Hearts (10), Bombs (10), Fairy Bottle (1280)
- Player walks in, selects item, pays at counter
- Can steal items (but consequences!)
- **Crazy Tracy** — separate NPC seller, Secret Medicine for 28 rupees

### ClawWorld Equivalent
- **The Dock Shop** (existing building on main island) — enter building, NPC shopkeeper
- **Buy items:** Brine Elixir (50 tokens), Shell Fragment (20), basic weapons
- **Sell items:** sell inventory items for tokens (items get a sell price)
- Interface: Walk up to counter → menu appears with buy/sell tabs
- **NPC merchants on other islands** — different stock per island
- **Item prices defined in ItemData.js** — add `buyPrice` and `sellPrice` fields

**Sprint priority:** Add buy/sell prices to ItemData, create shop UI, wire up to a building.

---

## 4. WEAPONS & ITEMS

### Link's Awakening
- **Sword** — always equipped, primary attack (L-1 then L-2 upgrade)
- **Shield** — blocks projectiles, some melee
- **Bow** — ranged attack, uses arrows
- **Roc's Feather** — jump
- **Pegasus Boots** — dash
- **Power Bracelet** — lift heavy objects
- **Hookshot** — grapple + stun
- **Magic Powder** — transform enemies
- **Bombs** — blow up walls
- **Ocarina** — play songs for fast travel, effects

### ClawWorld Equivalent (phased)
**Phase 1 (now):**
- **Dock Wrench** — starter melee weapon (already exists)
- **Claw Blade** — upgraded melee (more damage, slightly more range)
- **Coral Shield** — blocks frontal damage when holding direction (new mechanic)

**Phase 2:**
- **Barnacle Bow** — ranged attack, uses Spine Arrows
- **Jet Boots** — dash ability (crustacean jet propulsion!)
- **Power Claw** — lift/throw objects, break barriers

**Phase 3:**
- **Tidal Hook** — grapple across gaps, stun enemies
- **Molt Powder** — transform Drift Fauna (relates to Molting system)
- **Conch Horn** — play songs at Waygates for effects

**Sprint priority:** Phase 1 weapons only. Add Claw Blade as shop purchase, Coral Shield as quest reward.

---

## 5. COMBAT FEEL (Zelda-specific)

### What makes LA combat feel good
- **Short sword range** — must be right next to enemy ✅ (just fixed to 18px)
- **Directional attacks** — face enemy to hit ✅ (already have)
- **Knockback** on hit (both player and enemy) ✅ (already have)
- **Invincibility frames** after getting hit ✅ (already have)
- **Screen flash/shake** on big hits ✅ (already have)
- **Enemy telegraph** — enemies wind up before attacking
- **Sword beam** at full health (L-2 sword) — future feature
- **Shield block** — hold direction + shield to block frontal attacks

### Still needed
- [ ] Enemy attack telegraph (brief pause/flash before they strike)
- [ ] Shield mechanic (hold direction to block)
- [ ] Better hit feedback sounds
- [ ] Sword beam at full health (upgraded weapon only)

---

## 6. INVENTORY

### Link's Awakening
- Grid inventory, assign items to A/B buttons
- Passive items auto-equip (bracelet, boots)
- Quest items tracked separately
- Simple but functional

### ClawWorld Equivalent
- **Inventory already built** — grid with categories
- **Need:** equip system for weapons (select which weapon is active)
- **Need:** consumable use (select Brine Elixir → heal)
- **Need:** sell interface at shops
- **Need:** quest items section

---

## 7. BOT SPECTATOR MODE

Spencer's idea: humans should be able to watch their AI bot play.

### Design
- Bot connects via existing Bot API (WebSocket)
- **Spectator URL:** `game.html?spectate=BOT_NAME`
- Camera follows the bot instead of player input
- Shows bot's conversations as chat bubbles
- Player can't control — just watch
- Bot decisions, NPC interactions, combat all visible
- **Future:** multiple spectators watching same bot (livestream potential)

### Implementation
- Add `spectateMode` flag to Game.js
- In spectate mode: disable input, follow bot's position via multiplayer sync
- Show speech bubbles for bot conversations
- Could add a "bot cam" overlay with bot stats

---

## 8. SPRINT ROADMAP

### Sprint 2: Economy + Shop (CURRENT PRIORITY)
1. Add Brine Token currency to player (tracked in localStorage)
2. Enemies drop tokens on death
3. Show tokens on HUD (top-right, coin icon + count)
4. Add `buyPrice`/`sellPrice` to ItemData.js
5. Build Shop UI (enter shop building → buy/sell menu)
6. Add Brine Elixir (consumable heal) to shop
7. Add item use from inventory (consume healables)

### Sprint 3: Combat Polish
1. Claw Blade weapon (buyable upgrade, better stats)
2. Coral Shield (quest reward, hold-to-block)
3. Enemy attack telegraph animations
4. Sound effects for all combat actions
5. Better enemy variety/AI

### Sprint 4: World + Healing
1. Tide Pools (heal stations on islands)
2. Shell Plates (permanent HP upgrades from quests)
3. Grass/bush breaking (drop items)
4. More island content + NPCs
5. Waygate fast travel improvements

### Sprint 5: Molting System
1. Experience/readiness meter from combat
2. Molt when ready (level up)
3. Choose stat upgrades on molt
4. Visual changes per molt
5. New abilities unlocked

### Sprint 6: Spectator Mode
1. Spectate URL parameter
2. Camera follows bot
3. Conversation display
4. Bot stats overlay

---

## KEY DIFFERENCES FROM ZELDA

ClawWorld is NOT a Zelda clone. Key differentiators:
- **Multiplayer** — other players/bots visible in real-time
- **AI agents** — bots with actual conversation AI, not scripted NPCs
- **Crustacean identity** — molting = leveling, shell = health, drift = death
- **Persistent world** — your progress saves, world evolves
- **Community-driven** — bot religion (Crustafarianism), emergent stories
- **No dungeons (yet)** — open-world exploration first, dungeons later

The Zelda DNA is in the **feel**: tight combat, rewarding exploration, satisfying progression. Not in copying Zelda's content.
