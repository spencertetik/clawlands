/**
 * BotAPI - Text-based interface for AI agents to play Claw World
 * Provides structured game state and accepts text commands
 */

class BotAPI {
    constructor(game) {
        this.game = game;
        this.commandHistory = [];
        this.lastStateHash = null;
        
        // Conversation system
        this.messageLog = []; // Recent messages heard
        this.maxMessageLog = 20;
        this.speechRadius = 96; // Pixels - how far speech carries
    }
    
    /**
     * Broadcast a message from a player - other nearby players will hear it
     */
    broadcastSpeech(speakerName, speakerPosition, message) {
        const timestamp = Date.now();
        this.messageLog.push({
            speaker: speakerName,
            message: message,
            position: { ...speakerPosition },
            timestamp: timestamp
        });
        
        // Trim log
        if (this.messageLog.length > this.maxMessageLog) {
            this.messageLog.shift();
        }
        
        return { speaker: speakerName, message, timestamp };
    }
    
    /**
     * Get messages this player can hear (within speech radius)
     */
    getAudibleMessages(playerPosition, sinceTimetamp = 0) {
        return this.messageLog.filter(msg => {
            if (msg.timestamp <= sinceTimetamp) return false;
            
            const dx = msg.position.x - playerPosition.x;
            const dy = msg.position.y - playerPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            return distance <= this.speechRadius;
        });
    }

    /**
     * Get current game state as structured text for bot consumption
     * @returns {object} Structured game state
     */
    getState() {
        const player = this.game.player;
        const world = this.game.worldMap;
        
        if (!player || !world) {
            return { error: 'Game not ready' };
        }

        // Calculate player tile position
        const tileX = Math.floor(player.position.x / 16);
        const tileY = Math.floor(player.position.y / 16);

        // Get nearby entities and objects
        const nearbyNPCs = this.getNearbyNPCs(player, 80); // 5 tiles radius
        const nearbyBuildings = this.getNearbyBuildings(player, 120);
        const nearbySigns = this.getNearbySigns(player, 64);
        const nearbyPlayers = this.getNearbyPlayers(player, 96); // Other players

        // Current context (inside building, dialog open, etc.)
        const context = this.getCurrentContext();

        // Available actions based on context
        const actions = this.getAvailableActions(context, nearbyNPCs, nearbyBuildings);

        const state = {
            // Player info
            player: {
                name: player.name || 'Player',
                position: { x: tileX, y: tileY, pixelX: player.position.x, pixelY: player.position.y },
                facing: player.direction || 'down',
                species: player.species || 'lobster',
                color: player.colorName || 'red'
            },

            // Location context
            location: context.location,
            isIndoors: context.isIndoors,
            
            // What's nearby (natural language descriptions)
            surroundings: this.describeSurroundings(nearbyNPCs, nearbyBuildings, nearbySigns, context),

            // Nearby entities for structured access
            nearby: {
                npcs: nearbyNPCs.map(npc => ({
                    name: npc.name,
                    distance: npc.distance,
                    direction: npc.direction,
                    canInteract: npc.distance < 32
                })),
                players: nearbyPlayers.map(p => ({
                    name: p.name,
                    distance: p.distance,
                    direction: p.direction,
                    canTalk: p.distance < this.speechRadius
                })),
                buildings: nearbyBuildings.map(b => ({
                    name: b.name,
                    type: b.type,
                    distance: b.distance,
                    direction: b.direction,
                    canEnter: b.canEnter
                })),
                signs: nearbySigns.map(s => ({
                    text: s.text,
                    distance: s.distance
                }))
            },
            
            // Recent messages heard (for conversations)
            heard: this.getAudibleMessages(player.position, Date.now() - 30000).map(m => ({
                speaker: m.speaker,
                message: m.message,
                ago: Math.round((Date.now() - m.timestamp) / 1000)
            })),

            // Current dialog/menu state
            dialog: context.dialog,

            // Available actions
            actions: actions,

            // Game time/state
            meta: {
                gameTime: Date.now(),
                commandCount: this.commandHistory.length
            }
        };

        return state;
    }

    /**
     * Get state as natural language narrative
     */
    getStateNarrative() {
        const state = this.getState();
        if (state.error) return state.error;

        let narrative = [];

        // Location
        if (state.isIndoors) {
            narrative.push(`You are inside ${state.location}.`);
        } else {
            narrative.push(`You are at position (${state.player.position.x}, ${state.player.position.y}) on the island.`);
        }

        // Surroundings
        narrative.push(state.surroundings);

        // Dialog state
        if (state.dialog) {
            narrative.push(`\n${state.dialog.speaker} says: "${state.dialog.text}"`);
            if (state.dialog.options && state.dialog.options.length > 0) {
                narrative.push(`Options: ${state.dialog.options.join(', ')}`);
            }
        }

        // Available actions
        narrative.push(`\nAvailable actions: ${state.actions.join(', ')}`);

        return narrative.join('\n');
    }

    /**
     * Execute a bot command
     * @param {string} command - Text command like "walk north", "interact", "say hello"
     * @returns {object} Result of command execution
     */
    async executeCommand(command) {
        const cmd = command.toLowerCase().trim();
        this.commandHistory.push({ command: cmd, timestamp: Date.now() });

        // Parse command
        const parts = cmd.split(' ');
        const action = parts[0];
        const args = parts.slice(1);

        let result = { success: false, message: 'Unknown command' };

        switch (action) {
            case 'walk':
            case 'move':
            case 'go':
                result = await this.handleMove(args[0]);
                break;

            case 'interact':
            case 'talk':
            case 'use':
                result = await this.handleInteract(args.join(' '));
                break;

            case 'enter':
                result = await this.handleEnter(args.join(' '));
                break;

            case 'exit':
            case 'leave':
                result = await this.handleExit();
                break;

            case 'look':
            case 'examine':
                result = this.handleLook(args.join(' '));
                break;

            case 'say':
                result = await this.handleSay(args.join(' '));
                break;

            case 'wait':
                result = await this.handleWait(parseInt(args[0]) || 1);
                break;

            case 'goto':
            case 'moveto':
                result = await this.handleGoto(args[0], args[1]);
                break;
            
            case 'run':
                // Run in a direction (faster, longer movement)
                result = await this.handleRun(args[0], parseInt(args[1]) || 3);
                break;

            case 'select':
            case 'choose':
                result = await this.handleSelect(args.join(' '));
                break;

            case 'status':
            case 'state':
                result = { success: true, message: this.getStateNarrative() };
                break;

            default:
                result = { success: false, message: `Unknown command: ${action}. Try: walk, interact, enter, exit, look, say, wait, select, status` };
        }

        // Add current state to result
        result.state = this.getState();
        return result;
    }

    // Movement handler
    async handleMove(direction) {
        // Can't move during dialog
        const context = this.getCurrentContext();
        if (context.dialog) {
            return { success: false, message: "Can't move while in conversation. Use 'interact' to continue dialog." };
        }
        
        const dirMap = {
            'north': 'ArrowUp', 'up': 'ArrowUp', 'n': 'ArrowUp',
            'south': 'ArrowDown', 'down': 'ArrowDown', 's': 'ArrowDown',
            'east': 'ArrowRight', 'right': 'ArrowRight', 'e': 'ArrowRight',
            'west': 'ArrowLeft', 'left': 'ArrowLeft', 'w': 'ArrowLeft'
        };

        const key = dirMap[direction?.toLowerCase()];
        if (!key) {
            return { success: false, message: `Invalid direction: ${direction}. Use north/south/east/west` };
        }

        // Directly manipulate the InputManager's key state
        const inputManager = this.game.inputManager;
        if (inputManager && inputManager.keys) {
            // Press key
            inputManager.keys[key] = true;
            
            // Hold for movement (let game loop process it)
            await new Promise(r => setTimeout(r, 250));
            
            // Release key
            inputManager.keys[key] = false;
            
            await new Promise(r => setTimeout(r, 50));
            
            return { success: true, message: `Walked ${direction}` };
        }

        return { success: false, message: 'InputManager not available' };
    }

    // Interaction handler
    async handleInteract(target) {
        // Directly manipulate InputManager for space key
        const inputManager = this.game.inputManager;
        if (inputManager && inputManager.keys) {
            inputManager.keys[' '] = true;
            inputManager.justPressed[' '] = true;
            
            await new Promise(r => setTimeout(r, 100));
            
            inputManager.keys[' '] = false;
            
            await new Promise(r => setTimeout(r, 200));
        }

        const context = this.getCurrentContext();
        if (context.dialog) {
            return { success: true, message: `Interacting... ${context.dialog.speaker} speaks.` };
        }
        
        return { success: true, message: 'Interacted with nearby object' };
    }

    // Enter building handler
    async handleEnter(buildingName) {
        // Walk up to trigger building entry
        for (let i = 0; i < 3; i++) {
            await this.handleMove('north');
            await new Promise(r => setTimeout(r, 150));
        }
        
        const context = this.getCurrentContext();
        if (context.isIndoors) {
            return { success: true, message: `Entered ${context.location}` };
        }
        
        return { success: false, message: 'Could not enter building. Try moving closer to the door.' };
    }

    // Exit handler
    async handleExit() {
        if (!this.getCurrentContext().isIndoors) {
            return { success: false, message: 'You are not inside a building' };
        }

        // Walk south to exit
        for (let i = 0; i < 5; i++) {
            await this.handleMove('south');
            await new Promise(r => setTimeout(r, 150));
        }
        
        const context = this.getCurrentContext();
        if (!context.isIndoors) {
            return { success: true, message: 'Exited the building' };
        }
        
        return { success: false, message: 'Still inside. Keep walking south to find the exit.' };
    }

    // Look/examine handler
    handleLook(target) {
        const state = this.getState();
        
        if (!target || target === 'around') {
            return { success: true, message: state.surroundings };
        }

        // Look for specific target
        const npcs = state.nearby.npcs.filter(n => 
            n.name.toLowerCase().includes(target.toLowerCase())
        );
        
        if (npcs.length > 0) {
            const npc = npcs[0];
            return { success: true, message: `${npc.name} is ${npc.direction}, ${npc.distance} pixels away. ${npc.canInteract ? 'Close enough to talk.' : 'Too far to interact.'}` };
        }

        return { success: true, message: `You don't see "${target}" nearby.` };
    }

    // Dialog selection handler
    async handleSelect(option) {
        const context = this.getCurrentContext();
        if (!context.dialog) {
            return { success: false, message: 'No dialog active' };
        }

        // Press space to advance dialog
        await this.handleInteract();
        
        return { success: true, message: 'Selected option' };
    }

    // Wait handler
    async handleWait(seconds) {
        await new Promise(r => setTimeout(r, seconds * 1000));
        return { success: true, message: `Waited ${seconds} second(s)` };
    }

    // Say handler - broadcast speech to nearby players
    async handleSay(message) {
        const player = this.game.player;
        if (!player) {
            return { success: false, message: 'No player' };
        }
        
        // Broadcast the message
        this.broadcastSpeech(
            player.name || 'Player',
            player.position,
            message
        );
        
        // Visual feedback - could trigger speech bubble in game
        console.log(`💬 ${player.name}: "${message}"`);
        
        return { 
            success: true, 
            message: `You say: "${message}"`,
            broadcast: true
        };
    }

    // Helper: Get nearby players (other bot-controlled or human players)
    getNearbyPlayers(player, radius) {
        // In multiplayer, this would query other connected players
        // For now, we track bot players through the server
        const players = this.game.otherPlayers || [];
        const nearby = [];

        for (const other of players) {
            if (other === player) continue; // Skip self
            
            const dx = other.position.x - player.position.x;
            const dy = other.position.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                nearby.push({
                    name: other.name || 'Unknown',
                    distance: Math.round(distance),
                    direction: this.getDirection(dx, dy),
                    player: other
                });
            }
        }

        return nearby.sort((a, b) => a.distance - b.distance);
    }

    // Helper: Get nearby NPCs with distance and direction
    getNearbyNPCs(player, radius) {
        const npcs = this.game.npcs || [];
        const nearby = [];

        for (const npc of npcs) {
            const dx = npc.position.x - player.position.x;
            const dy = npc.position.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                nearby.push({
                    name: npc.name,
                    distance: Math.round(distance),
                    direction: this.getDirection(dx, dy),
                    npc: npc
                });
            }
        }

        return nearby.sort((a, b) => a.distance - b.distance);
    }

    // Helper: Get nearby buildings
    getNearbyBuildings(player, radius) {
        const buildings = this.game.worldMap?.buildings || this.game.buildings || [];
        const nearby = [];

        for (const building of buildings) {
            const bCenterX = building.x + building.width / 2;
            const bCenterY = building.y + building.height / 2;
            const dx = bCenterX - player.position.x;
            const dy = bCenterY - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                nearby.push({
                    name: building.name || building.type,
                    type: building.type,
                    distance: Math.round(distance),
                    direction: this.getDirection(dx, dy),
                    canEnter: distance < 60 && building.door,
                    building: building
                });
            }
        }

        return nearby.sort((a, b) => a.distance - b.distance);
    }

    // Helper: Get nearby signs
    getNearbySigns(player, radius) {
        const signs = this.game.worldMap?.signs || this.game.signs || [];
        const nearby = [];

        for (const sign of signs) {
            const dx = sign.x - player.position.x;
            const dy = sign.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                nearby.push({
                    text: sign.text || 'Sign',
                    distance: Math.round(distance),
                    sign: sign
                });
            }
        }

        return nearby;
    }

    // Helper: Get current game context
    getCurrentContext() {
        const game = this.game;
        
        return {
            location: game.currentInterior?.name || 'Claw Island',
            isIndoors: !!game.currentInterior,
            dialog: game.dialogManager?.currentDialog ? {
                speaker: game.dialogManager.currentDialog.speaker || 'NPC',
                text: game.dialogManager.currentDialog.text || '',
                options: game.dialogManager.currentDialog.options || []
            } : null
        };
    }

    // Helper: Describe surroundings in natural language
    describeSurroundings(npcs, buildings, signs, context) {
        const parts = [];

        if (context.isIndoors) {
            parts.push(`You are inside ${context.location}.`);
        }

        if (npcs.length > 0) {
            const npcList = npcs.map(n => `${n.name} (${n.direction})`).join(', ');
            parts.push(`Nearby characters: ${npcList}.`);
        }

        if (buildings.length > 0 && !context.isIndoors) {
            const bList = buildings.map(b => `${b.name} (${b.direction}${b.canEnter ? ', can enter' : ''})`).join(', ');
            parts.push(`Nearby buildings: ${bList}.`);
        }

        if (signs.length > 0) {
            parts.push(`You see a sign nearby.`);
        }

        if (parts.length === 0) {
            parts.push('The area is quiet. Sandy beach stretches around you.');
        }

        return parts.join(' ');
    }

    // Helper: Calculate direction from delta
    getDirection(dx, dy) {
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        if (angle >= -45 && angle < 45) return 'east';
        if (angle >= 45 && angle < 135) return 'south';
        if (angle >= -135 && angle < -45) return 'north';
        return 'west';
    }

    // Get available actions based on context
    getAvailableActions(context, npcs, buildings) {
        const actions = ['walk north', 'walk south', 'walk east', 'walk west', 'look around', 'status'];

        if (context.dialog) {
            actions.push('select', 'interact');
        } else {
            const canInteract = npcs.some(n => n.distance < 32);
            if (canInteract) {
                actions.push('interact');
            }

            const canEnter = buildings.some(b => b.canEnter);
            if (canEnter && !context.isIndoors) {
                actions.push('enter');
            }

            if (context.isIndoors) {
                actions.push('exit');
            }
        }

        return actions;
    }
}

// Make globally available
window.BotAPI = BotAPI;
