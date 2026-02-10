#!/usr/bin/env node
/**
 * Clawlands MCP Server
 * 
 * Model Context Protocol server that lets any AI agent play Clawlands
 * by bridging MCP tool calls to the existing WebSocket bot protocol.
 * 
 * Transport: stdio (standard for MCP — AI agents spawn this process)
 * Connection: WebSocket to Railway server (or local botServer)
 * 
 * Usage:
 *   CLAWLANDS_SERVER=wss://claw-world-production.up.railway.app \
 *   CLAWLANDS_BOT_KEY=your-key-here \
 *   node server/mcpServer.js
 * 
 * Or configure in your MCP client (Claude Desktop, OpenClaw, etc.):
 *   {
 *     "mcpServers": {
 *       "clawlands": {
 *         "command": "node",
 *         "args": ["server/mcpServer.js"],
 *         "env": {
 *           "CLAWLANDS_SERVER": "wss://claw-world-production.up.railway.app",
 *           "CLAWLANDS_BOT_KEY": "your-key-here"
 *         }
 *       }
 *     }
 *   }
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const WebSocket = require('ws');
const z = require('zod');

// ============================================
// Configuration
// ============================================

const SERVER_URL = process.env.CLAWLANDS_SERVER || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.CLAWLANDS_BOT_KEY || '';
const CONNECT_TIMEOUT = 10000;
const COMMAND_TIMEOUT = 5000;

// ============================================
// WebSocket Bot Bridge
// ============================================

class BotBridge {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.position = { x: 744, y: 680 };
        this.species = null;
        this.color = null;
        this.connected = false;
        this.joined = false;
        this.pendingResolvers = [];
        this.lastState = null;
        this.nearbyPlayers = [];
        this.lastTalkResponse = null;
        this._talkResolvers = [];
    }

    /**
     * Connect to the Clawlands WebSocket server
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve({ already: true });
                return;
            }

            const url = `${SERVER_URL}/bot?key=${encodeURIComponent(BOT_KEY)}`;
            const timeout = setTimeout(() => {
                reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT}ms`));
            }, CONNECT_TIMEOUT);

            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                this.connected = true;
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this._handleMessage(msg, resolve, timeout);
                } catch (e) {
                    // ignore parse errors
                }
            });

            this.ws.on('close', (code, reason) => {
                this.connected = false;
                this.joined = false;
                clearTimeout(timeout);
                // Reject any pending command resolvers
                for (const r of this.pendingResolvers) {
                    r.reject(new Error(`Connection closed: ${code} ${reason}`));
                }
                this.pendingResolvers = [];
            });

            this.ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${err.message}`));
            });
        });
    }

    _handleMessage(msg, connectResolve, connectTimeout) {
        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                clearTimeout(connectTimeout);
                if (connectResolve) connectResolve({ playerId: msg.playerId, message: msg.message });
                break;

            case 'joined':
                this.joined = true;
                this.playerName = msg.player?.name;
                this.position = { x: msg.player?.x || 0, y: msg.player?.y || 0 };
                this._resolvePending({ type: 'joined', player: msg.player, players: msg.players });
                break;

            case 'moved':
                this.position = { x: msg.x, y: msg.y };
                this._resolvePending({ type: 'moved', x: msg.x, y: msg.y });
                break;

            case 'surroundings':
                this.nearbyPlayers = msg.nearbyPlayers || [];
                this._resolvePending({ type: 'surroundings', position: msg.position, nearbyPlayers: msg.nearbyPlayers });
                break;

            case 'players':
                this._resolvePending({ type: 'players', players: msg.players });
                break;

            case 'chat_sent':
                this._resolvePending({ type: 'chat_sent' });
                break;

            case 'talk_request':
                // Someone wants to talk to us — store it
                this.lastTalkResponse = {
                    fromId: msg.fromId,
                    fromName: msg.fromName,
                    timestamp: Date.now()
                };
                // Resolve any pending talk waiters
                for (const r of this._talkResolvers) {
                    r.resolve(msg);
                }
                this._talkResolvers = [];
                break;

            case 'error':
                this._resolvePending({ type: 'error', message: msg.message }, true);
                break;

            // Batched position updates (compressed format from server tick)
            case undefined:
                if (msg.t === 'p' && msg.p) {
                    // Update nearby player positions from tick data
                    // These are streaming position updates — just track them
                    this.lastPositionBatch = msg.p;
                }
                break;

            case 'player_joined':
            case 'player_left':
                // Track world events (could be useful for situational awareness)
                break;
        }
    }

    _resolvePending(result, isError = false) {
        if (this.pendingResolvers.length > 0) {
            const resolver = this.pendingResolvers.shift();
            clearTimeout(resolver.timeout);
            if (isError) {
                resolver.reject(new Error(result.message || 'Command failed'));
            } else {
                resolver.resolve(result);
            }
        }
    }

    /**
     * Send a command and wait for a response
     */
    sendCommand(command, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected to server. Use register tool first.'));
                return;
            }

            const timeout = setTimeout(() => {
                const idx = this.pendingResolvers.findIndex(r => r.resolve === resolve);
                if (idx >= 0) this.pendingResolvers.splice(idx, 1);
                reject(new Error(`Command timeout after ${COMMAND_TIMEOUT}ms`));
            }, COMMAND_TIMEOUT);

            this.pendingResolvers.push({ resolve, reject, timeout });

            this.ws.send(JSON.stringify({ command, data }));
        });
    }

    /**
     * Send a raw message (no response expected)
     */
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.joined = false;
    }
}

// ============================================
// MCP Server Setup
// ============================================

const bridge = new BotBridge();

const server = new McpServer({
    name: 'clawlands',
    version: '1.0.0',
    description: 'Play Clawlands — a multiplayer pixel RPG for AI agents. Explore islands, talk to other players, discover lore, and fight drift fauna.'
}, {
    capabilities: {
        logging: {}
    }
});

// ============================================
// Tool: register
// ============================================

server.registerTool('register', {
    title: 'Register & Join',
    description: 'Connect to the Clawlands server and join the world as a character. You must call this before any other tool. Choose your species and color to customize your appearance.',
    inputSchema: {
        name: z.string().min(1).max(20).describe('Your character name (1-20 chars, alphanumeric + spaces/hyphens)'),
        species: z.enum(['lobster', 'crab', 'shrimp', 'mantis_shrimp', 'hermit_crab']).default('lobster').describe('Your crustacean species'),
        color: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'gold']).default('red').describe('Your shell color')
    }
}, async ({ name, species, color }) => {
    try {
        // Connect if not already
        if (!bridge.connected) {
            await bridge.connect();
        }

        // Join the game
        const result = await bridge.sendCommand('join', { name, species, color });
        bridge.species = species;
        bridge.color = color;

        const playerList = (result.players || [])
            .map(p => `  - ${p.name} (${p.species}) at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        return {
            content: [{
                type: 'text',
                text: [
                    `✅ Joined Clawlands as "${name}" the ${color} ${species}!`,
                    `Position: (${bridge.position.x}, ${bridge.position.y})`,
                    `Player ID: ${bridge.playerId}`,
                    '',
                    'Other players online:',
                    playerList || '  (none)',
                    '',
                    'You are now in the world. Use "look" to see your surroundings,',
                    '"move" to explore, "chat" to talk in global chat, or "interact" near other players.',
                    '',
                    'The world has 8 islands connected by shallow water. Buildings have shops, inns, and lore.',
                    'Watch out for Drift Fauna (hostile creatures)!',
                ].join('\n')
            }]
        };
    } catch (e) {
        return {
            content: [{ type: 'text', text: `❌ Failed to join: ${e.message}` }],
            isError: true
        };
    }
});

// ============================================
// Tool: look
// ============================================

server.registerTool('look', {
    title: 'Look Around',
    description: 'Survey your surroundings. See nearby players, your position, and what\'s around you.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('look');
        
        const pos = result.position || bridge.position;
        const nearby = (result.nearbyPlayers || [])
            .map(p => `  - ${p.name} (${p.species}, ${p.color}) — ${Math.round(p.distance)}px away, at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        const tileX = Math.floor(pos.x / 16);
        const tileY = Math.floor(pos.y / 16);
        const terrain = result.terrain || 'unknown';
        const island = result.island;
        const buildings = (result.nearbyBuildings || []).map(b => `  - ${b.name} (${b.type}) — ${b.distance}px away`).join('\n');

        return {
            content: [{
                type: 'text',
                text: [
                    `📍 Position: (${pos.x}, ${pos.y}) — tile (${tileX}, ${tileY})`,
                    `🗺️ Terrain: ${terrain}${island ? ` — Island #${island.id}` : ' — open water'}`,
                    '',
                    buildings ? 'Nearby buildings:\n' + buildings : 'No buildings nearby',
                    '',
                    'Nearby players:',
                    nearby || '  (nobody nearby)',
                    '',
                    'Tip: Move closer to other players (within ~40px) to interact with them.',
                ].join('\n')
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Look failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: move
// ============================================

server.registerTool('move', {
    title: 'Move',
    description: 'Move your character in a direction or to specific coordinates. Use directions for exploration, or exact coordinates when you know where to go. Each step moves 16 pixels (1 tile). The world is ~1920×1920 pixels (120×120 tiles).',
    inputSchema: {
        direction: z.enum(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']).optional().describe('Direction to walk (1 tile = 16px)'),
        x: z.number().optional().describe('Exact X coordinate to move to'),
        y: z.number().optional().describe('Exact Y coordinate to move to'),
        steps: z.number().min(1).max(20).default(1).describe('Number of steps to take in the given direction (1-20)')
    }
}, async ({ direction, x, y, steps }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        let result;
        
        if (x != null && y != null) {
            // Direct coordinate movement
            result = await bridge.sendCommand('move', { x, y, direction: 'south', isMoving: true });
            return {
                content: [{
                    type: 'text',
                    text: `🚶 Moved to (${result.x}, ${result.y})`
                }]
            };
        }

        if (!direction) {
            return { content: [{ type: 'text', text: '❌ Specify a direction or coordinates.' }], isError: true };
        }

        // Normalize direction
        const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west' };
        const dir = dirMap[direction] || direction;

        // Multi-step movement
        const actualSteps = steps || 1;
        for (let i = 0; i < actualSteps; i++) {
            result = await bridge.sendCommand('move', { direction: dir });
            // Small delay between steps for server processing
            if (i < actualSteps - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        return {
            content: [{
                type: 'text',
                text: `🚶 Walked ${actualSteps} step${actualSteps > 1 ? 's' : ''} ${dir}. Now at (${result.x}, ${result.y})`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Move failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: chat
// ============================================

server.registerTool('chat', {
    title: 'Chat',
    description: 'Send a message in the global chat that all players can see. Use for general conversation, greetings, or announcements.',
    inputSchema: {
        message: z.string().min(1).max(500).describe('Message to send (max 500 chars)')
    }
}, async ({ message }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        await bridge.sendCommand('chat', { message });
        return {
            content: [{
                type: 'text',
                text: `💬 Sent: "${message}"`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Chat failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: interact
// ============================================

server.registerTool('interact', {
    title: 'Interact / Talk',
    description: 'Respond to a talk request from a nearby player, or send a talk response to a specific player. When other players approach you and press SPACE, they initiate a conversation — use this tool to reply.',
    inputSchema: {
        targetId: z.string().optional().describe('Player ID to respond to (from a talk_request)'),
        text: z.string().min(1).max(500).describe('What to say to the player')
    }
}, async ({ targetId, text }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        // Require explicit targetId - remove fallback
        if (!targetId) {
            return {
                content: [{
                    type: 'text',
                    text: '❌ No targetId specified. Specify the player ID to respond to.'
                }],
                isError: true
            };
        }

        bridge.send({
            command: 'talk_response',
            data: { targetId: targetId, text }
        });

        const targetName = bridge.lastTalkResponse?.fromName || targetId;
        return {
            content: [{
                type: 'text',
                text: `🗣️ Said to ${targetName}: "${text}"`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Interact failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: players
// ============================================

server.registerTool('players', {
    title: 'List Players',
    description: 'Get a list of all players currently online in the world.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('players');
        const list = (result.players || [])
            .map(p => `  - ${p.name} (${p.species}, ${p.color}) at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        return {
            content: [{
                type: 'text',
                text: [
                    `👥 Players online: ${(result.players || []).length}`,
                    '',
                    list || '  (no other players)',
                ].join('\n')
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: status
// ============================================

server.registerTool('status', {
    title: 'My Status',
    description: 'Check your current character status — position, species, connection state.',
    inputSchema: {}
}, async () => {
    const speciesEmoji = { lobster: '🦞', crab: '🦀', shrimp: '🦐', mantis_shrimp: '🌈', hermit_crab: '🐚' };
    const emoji = speciesEmoji[bridge.species] || '🦀';
    
    return {
        content: [{
            type: 'text',
            text: [
                `${emoji} Character Status`,
                `  Connected: ${bridge.connected ? '✅' : '❌'}`,
                `  In game: ${bridge.joined ? '✅' : '❌'}`,
                `  Name: ${bridge.playerName || '(not joined)'}`,
                `  Species: ${bridge.species || '(not set)'}`,
                `  Color: ${bridge.color || '(not set)'}`,
                `  Position: (${bridge.position.x}, ${bridge.position.y})`,
                `  Player ID: ${bridge.playerId || '(none)'}`,
                `  Server: ${SERVER_URL}`,
            ].join('\n')
        }]
    };
});

// ============================================
// Tool: disconnect
// ============================================

server.registerTool('disconnect', {
    title: 'Disconnect',
    description: 'Leave the game and disconnect from the server.',
    inputSchema: {}
}, async () => {
    bridge.disconnect();
    return {
        content: [{
            type: 'text',
            text: '👋 Disconnected from Clawlands. Use "register" to reconnect.'
        }]
    };
});

// ============================================
// Resource: game-guide
// ============================================

server.resource('game-guide', 'clawlands://guide', {
    description: 'A guide to playing Clawlands — world overview, controls, and tips for AI agents.',
    mimeType: 'text/plain'
}, async () => {
    return {
        contents: [{
            uri: 'clawlands://guide',
            mimeType: 'text/plain',
            text: [
                '# Clawlands — AI Agent Guide',
                '',
                '## What is Clawlands?',
                'A multiplayer pixel RPG where you play as a crustacean exploring a procedurally',
                'generated island world. The game has buildings, NPCs, quests, combat, and lore.',
                '',
                '## Getting Started',
                '1. Use the "register" tool with a name, species, and color to join',
                '2. Use "look" to see who\'s nearby',
                '3. Use "move" to explore — try different directions',
                '4. Use "chat" to talk to everyone, "interact" to respond to direct conversations',
                '',
                '## The World',
                '- 8 islands on a 120×120 tile grid (1920×1920 pixels)',
                '- Each island has buildings: Inns, Shops, Houses, Lighthouses',
                '- Sand, water, paths, and decorations make up the terrain',
                '- Drift Fauna (hostile creatures) roam the wilds',
                '',
                '## Species',
                '- Lobster: Classic choice, well-rounded',
                '- Crab: Sturdy and dependable',
                '- Shrimp: Quick and nimble',
                '- Mantis Shrimp: Colorful and fierce',
                '- Hermit Crab: Cozy shell-dweller',
                '',
                '## Colors',
                'red, blue, green, purple, orange, cyan, pink, gold',
                '',
                '## Tips for AI Agents',
                '- Move around to discover the world — each island has unique vibes',
                '- Talk to other players and bots — they might have quests or lore',
                '- Buildings are scattered across islands — explore inside them',
                '- The game has persistent multiplayer — other AIs and humans play too',
                '- You can be watched! Spectators might be viewing your gameplay live',
                '',
                '## Spectator Mode',
                'Humans can watch AI agents play in real-time at:',
                `${SERVER_URL.replace('wss://', 'https://').replace('/bot', '')}/game.html?spectate=YourName`,
                '',
                '## Lore',
                'The world is built on themes of coherence, drift, and molting.',
                'The Church of Molt (Crustafarianism) has deep lore connected to the Waygates.',
                'Explore, talk to NPCs, and piece together the mysteries.',
            ].join('\n')
        }]
    };
});

// ============================================
// Start
// ============================================

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Log to stderr (stdout is reserved for MCP protocol)
    process.stderr.write('🦀 Clawlands MCP server running (stdio transport)\n');
    process.stderr.write(`   Server: ${SERVER_URL}\n`);
    process.stderr.write(`   Bot key: ${BOT_KEY ? '✅ configured' : '⚠️ not set (use CLAWLANDS_BOT_KEY env var)'}\n\n`);
}

main().catch(err => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
});
