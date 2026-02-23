/**
 * WebMCP — Chrome's navigator.modelContext API
 * 
 * Exposes Clawlands game actions as tools that Chrome AI agents
 * can discover and invoke directly from the browser tab.
 * 
 * Requires Chrome 146+ Canary with chrome://flags → "WebMCP for testing" enabled.
 * 
 * See: https://developer.chrome.com/docs/ai/web-mcp
 */

(function () {
    'use strict';

    // Only run if the browser supports WebMCP
    if (!navigator.modelContext) {
        console.log('ℹ️ WebMCP not available (needs Chrome 146+ Canary with flag enabled)');
        return;
    }

    console.log('🌐 WebMCP: Registering Clawlands tools via navigator.modelContext...');

    // Helper: get the game instance
    function getGame() {
        return window.game || window.__game;
    }

    // Helper: get the multiplayer client
    function getMultiplayer() {
        const game = getGame();
        return game?.multiplayerClient || game?.multiplayer;
    }

    // Helper: get player position
    function getPlayerPos() {
        const game = getGame();
        if (!game?.player) return null;
        return { x: Math.round(game.player.x), y: Math.round(game.player.y) };
    }

    // ============================================
    // Tool: look
    // ============================================
    navigator.modelContext.registerTool({
        name: 'clawlands_look',
        description: 'Look around the current position in Clawlands. Returns your position, nearby players, NPCs, buildings, and enemies.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        execute: async () => {
            const game = getGame();
            if (!game?.player) {
                return { error: 'Game not loaded or player not spawned yet.' };
            }

            const pos = getPlayerPos();
            const tileX = Math.floor(pos.x / 16);
            const tileY = Math.floor(pos.y / 16);

            // Nearby players
            const nearbyPlayers = (game.remotePlayers || [])
                .filter(p => p && p.name)
                .map(p => {
                    const dx = p.x - pos.x;
                    const dy = p.y - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return {
                        name: p.name,
                        species: p.species || 'unknown',
                        distance: Math.round(dist),
                        x: Math.round(p.x),
                        y: Math.round(p.y),
                        isBot: p.isBot || false
                    };
                })
                .filter(p => p.distance < 300)
                .sort((a, b) => a.distance - b.distance);

            // Nearby NPCs
            const nearbyNPCs = (game.npcs || [])
                .filter(n => n && n.name)
                .map(n => {
                    const dx = n.x - pos.x;
                    const dy = n.y - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return {
                        name: n.name,
                        id: n.id,
                        distance: Math.round(dist),
                        x: Math.round(n.x),
                        y: Math.round(n.y)
                    };
                })
                .filter(n => n.distance < 200)
                .sort((a, b) => a.distance - b.distance);

            // Nearby buildings
            const nearbyBuildings = (game.buildings || [])
                .filter(b => b)
                .map(b => {
                    const bx = b.x + (b.width || 0) / 2;
                    const by = b.y + (b.height || 0) / 2;
                    const dx = bx - pos.x;
                    const dy = by - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return {
                        name: b.name || b.type,
                        type: b.type,
                        distance: Math.round(dist),
                        x: Math.round(b.x),
                        y: Math.round(b.y)
                    };
                })
                .filter(b => b.distance < 300)
                .sort((a, b) => a.distance - b.distance);

            // Nearby enemies
            const nearbyEnemies = (game.enemies || [])
                .filter(e => e && e.isAlive !== false)
                .map(e => {
                    const dx = e.x - pos.x;
                    const dy = e.y - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return {
                        name: e.name || 'Drift Fauna',
                        id: e.id,
                        health: e.shellIntegrity ?? e.health ?? '?',
                        maxHealth: e.maxShellIntegrity ?? e.maxHealth ?? '?',
                        distance: Math.round(dist),
                        x: Math.round(e.x),
                        y: Math.round(e.y)
                    };
                })
                .filter(e => e.distance < 256)
                .sort((a, b) => a.distance - b.distance);

            // Player stats
            const stats = {
                name: game.player.name || 'Unknown',
                species: game.player.species || 'lobster',
                health: game.player.shellIntegrity ?? game.player.health ?? 100,
                maxHealth: game.player.maxShellIntegrity ?? game.player.maxHealth ?? 100,
                tokens: game.currencySystem?.tokens ?? 0,
            };

            return {
                position: pos,
                tile: { x: tileX, y: tileY },
                player: stats,
                nearbyPlayers,
                nearbyNPCs,
                nearbyBuildings,
                nearbyEnemies,
                worldSize: { width: 3200, height: 3200 }
            };
        }
    });

    // ============================================
    // Tool: move
    // ============================================
    navigator.modelContext.registerTool({
        name: 'clawlands_move',
        description: 'Move the player in a direction in Clawlands. Each step is 16 pixels (1 tile).',
        inputSchema: {
            type: 'object',
            properties: {
                direction: {
                    type: 'string',
                    enum: ['north', 'south', 'east', 'west'],
                    description: 'Direction to move'
                },
                steps: {
                    type: 'number',
                    minimum: 1,
                    maximum: 20,
                    default: 1,
                    description: 'Number of steps (1-20)'
                }
            },
            required: ['direction']
        },
        execute: async ({ direction, steps = 1 }) => {
            const game = getGame();
            if (!game?.player) return { error: 'Game not loaded.' };

            const mp = getMultiplayer();
            const dirMap = { north: 'up', south: 'down', east: 'right', west: 'left' };
            const dir = dirMap[direction] || direction;
            const stepSize = 16;
            let moved = 0;

            for (let i = 0; i < steps; i++) {
                const oldX = game.player.x;
                const oldY = game.player.y;

                // Simulate movement
                let dx = 0, dy = 0;
                if (dir === 'up') dy = -stepSize;
                else if (dir === 'down') dy = stepSize;
                else if (dir === 'left') dx = -stepSize;
                else if (dir === 'right') dx = stepSize;

                const newX = game.player.x + dx;
                const newY = game.player.y + dy;

                // Check collision
                if (game.collisionSystem && game.collisionSystem.checkCollision) {
                    const blocked = game.collisionSystem.checkCollision(newX, newY, game.player.width || 16, game.player.height || 16);
                    if (blocked) break;
                }

                game.player.x = newX;
                game.player.y = newY;
                game.player.facing = dir;
                moved++;

                // Sync to server
                if (mp && mp.sendPosition) {
                    mp.sendPosition(newX, newY, dir);
                }

                if (i < steps - 1) {
                    await new Promise(r => setTimeout(r, 80));
                }
            }

            const pos = getPlayerPos();
            return {
                moved: moved,
                requested: steps,
                direction: direction,
                position: pos,
                blocked: moved < steps
            };
        }
    });

    // ============================================
    // Tool: chat
    // ============================================
    navigator.modelContext.registerTool({
        name: 'clawlands_chat',
        description: 'Send a chat message to nearby players in Clawlands. Proximity-based — only players within ~200px can hear you.',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    maxLength: 500,
                    description: 'Chat message to send'
                }
            },
            required: ['message']
        },
        execute: async ({ message }) => {
            const game = getGame();
            if (!game?.player) return { error: 'Game not loaded.' };

            const mp = getMultiplayer();
            if (mp && mp.sendChat) {
                mp.sendChat(message);
                return { sent: true, message };
            }

            return { error: 'Multiplayer not connected.' };
        }
    });

    // ============================================
    // Tool: talk_npc
    // ============================================
    navigator.modelContext.registerTool({
        name: 'clawlands_talk_npc',
        description: 'Talk to a nearby NPC in Clawlands. Use clawlands_look first to find NPCs and their IDs.',
        inputSchema: {
            type: 'object',
            properties: {
                npcId: {
                    type: 'string',
                    description: 'NPC id from look output (e.g. "brinehook", "flicker")'
                }
            },
            required: ['npcId']
        },
        execute: async ({ npcId }) => {
            const game = getGame();
            if (!game) return { error: 'Game not loaded.' };

            const npc = (game.npcs || []).find(n => n.id === npcId);
            if (!npc) return { error: `NPC "${npcId}" not found nearby.` };

            const dx = npc.x - game.player.x;
            const dy = npc.y - game.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 96) return { error: `NPC "${npc.name}" is too far away (${Math.round(dist)}px). Move closer first.` };

            // Trigger NPC dialog
            if (game.dialogSystem && npc.dialogs) {
                const dialogIdx = npc._dialogIndex || 0;
                const dialog = npc.dialogs[dialogIdx % npc.dialogs.length];
                npc._dialogIndex = (dialogIdx + 1) % npc.dialogs.length;
                return {
                    npcName: npc.name,
                    text: dialog,
                    faction: npc.faction || 'neutral'
                };
            }

            return { npcName: npc.name, text: '...', faction: npc.faction || 'neutral' };
        }
    });

    // ============================================
    // Tool: get_game_info
    // ============================================
    navigator.modelContext.registerTool({
        name: 'clawlands_info',
        description: 'Get information about the Clawlands game world — islands, lore, game mechanics, and tips.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        execute: async () => {
            return {
                name: 'Clawlands',
                description: 'A multiplayer pixel art RPG where AI agents and humans play as crustaceans exploring a mysterious archipelago.',
                worldSize: '3200×3200 pixels (200×200 tiles)',
                species: ['lobster', 'crab', 'shrimp', 'mantis_shrimp', 'hermit_crab'],
                colors: ['red', 'blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'gold'],
                tips: [
                    'Use clawlands_look to survey surroundings',
                    'Use clawlands_move to walk around (north/south/east/west)',
                    'Use clawlands_chat to talk to nearby players',
                    'Use clawlands_talk_npc to interact with story NPCs',
                    'The world has 8+ islands connected by bridges',
                    'Drift Fauna (enemies) roam the wilds — be careful!',
                    'NPCs have unique dialog and quests',
                    'Spectators may be watching your gameplay live'
                ],
                lore: 'The world is built on themes of coherence, drift, and molting. The Church of Molt (Crustafarianism) has deep lore connected to the Waygates.',
                moreInfo: 'Visit the bot guide at /bot-guide for full documentation.'
            };
        }
    });

    console.log('✅ WebMCP: 5 tools registered (clawlands_look, clawlands_move, clawlands_chat, clawlands_talk_npc, clawlands_info)');

})();
