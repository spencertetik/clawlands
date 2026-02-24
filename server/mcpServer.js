#!/usr/bin/env node
/**
 * Clawlands MCP Server
 * Supports both Stdio (CLI) and SSE (Web) transports.
 * 
 * Stdio usage (for Claude Desktop, Claude Code, etc.):
 *   CLAWLANDS_SERVER=wss://claw-world-production.up.railway.app \
 *   CLAWLANDS_BOT_KEY=your-key \
 *   node server/mcpServer.js
 * 
 * Web MCP (SSE) is handled via handleMCPRequest() called by railwayServer.js
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const WebSocket = require('ws');
const z = require('zod');

// ============================================
// Configuration
// ============================================

const SERVER_URL = process.env.CLAWLANDS_SERVER || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.CLAWLANDS_BOT_KEY || '';
const CONNECT_TIMEOUT = 10000;
const COMMAND_TIMEOUT = 8000;

// ============================================
// WebSocket Bot Bridge
// ============================================

class BotBridge {
    constructor(serverUrl, botKey) {
        // Store connection params so connect() uses them
        this._serverUrl = serverUrl || SERVER_URL;
        this._botKey = botKey || BOT_KEY;
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.position = { x: 1288, y: 1160 };
        this.connected = false;
        this.joined = false;
        this.pendingResolvers = [];
        this.chatLog = [];
        this.lastLookTime = 0;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected) return resolve({ already: true });

            const wsUrl = `${this._serverUrl}/bot?key=${encodeURIComponent(this._botKey)}`;
            console.error(`🔌 Connecting to: ${this._serverUrl}/bot?key=***`);

            const timeout = setTimeout(() => reject(new Error('Connection timeout')), CONNECT_TIMEOUT);

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this.connected = true;
                clearTimeout(timeout);
                console.error('✅ WebSocket connected');
                this._pingInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) this.ws.ping();
                }, 25000);
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this._handleMessage(msg, resolve);
                } catch (e) { }
            });

            this.ws.on('close', (code, reason) => {
                console.error(`🔴 WebSocket closed: ${code} ${reason}`);
                this.connected = false;
                this.joined = false;
                this.pendingResolvers.forEach(r => r.reject(new Error('Connection closed')));
                this.pendingResolvers = [];
            });

            this.ws.on('error', (err) => {
                clearTimeout(timeout);
                console.error(`❌ WebSocket error: ${err.message}`);
                reject(new Error(`WebSocket error: ${err.message}`));
            });
        });
    }

    _handleMessage(msg, connectResolve) {
        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                if (connectResolve) connectResolve({ playerId: msg.playerId });
                break;
            case 'joined':
                this.joined = true;
                this.playerName = msg.player?.name;
                this.position = { x: msg.player?.x || 0, y: msg.player?.y || 0 };
                this._resolvePending(msg);
                break;
            case 'moved':
                this.position = { x: msg.x, y: msg.y };
                this._resolvePending(msg);
                break;
            case 'surroundings':
                this._resolvePending(msg);
                break;
            case 'chat_sent':
                this._resolvePending(msg);
                break;
            case 'chat':
                this.chatLog.push({ from: msg.name, text: msg.text, time: Date.now() });
                if (this.chatLog.length > 50) this.chatLog.shift();
                break;
            case 'error':
                this._resolvePending(msg, true);
                break;
            case 'player_list':
                this._resolvePending(msg);
                break;
        }
    }

    _resolvePending(result, isError = false) {
        if (this.pendingResolvers.length > 0) {
            const resolver = this.pendingResolvers.shift();
            clearTimeout(resolver.timeout);
            isError ? resolver.reject(new Error(result.message || 'Server error')) : resolver.resolve(result);
        }
    }

    sendCommand(command, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
                return reject(new Error('Not connected to game server'));
            }
            const timeout = setTimeout(() => {
                const idx = this.pendingResolvers.findIndex(r => r.resolve === resolve);
                if (idx >= 0) this.pendingResolvers.splice(idx, 1);
                reject(new Error(`Command '${command}' timed out`));
            }, COMMAND_TIMEOUT);
            this.pendingResolvers.push({ resolve, reject, timeout });
            this.ws.send(JSON.stringify({ command, data }));
        });
    }

    send(obj) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }

    disconnect() {
        if (this._pingInterval) clearInterval(this._pingInterval);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.joined = false;
    }
}

// ============================================
// Tool Registration
// ============================================

function registerTools(srv, bridge) {
    srv.tool(
        'register',
        'Join the Clawlands world as a crustacean character. Call this first before any other tool.',
        {
            name: z.string().min(1).max(20).describe('Your character name'),
            species: z.enum(['lobster', 'crab', 'shrimp', 'mantis_shrimp', 'hermit_crab']).default('lobster').describe('Crustacean species'),
            color: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'gold']).default('red').describe('Shell color')
        },
        async ({ name, species, color }) => {
            try {
                const cleanName = name.replace(/<[^>]*>/g, '').replace(/[^\w\s-]/g, '').trim().slice(0, 20);
                if (!cleanName) return { content: [{ type: 'text', text: '❌ Invalid name.' }], isError: true };

                if (!bridge.connected) await bridge.connect();
                await bridge.sendCommand('join', { name: cleanName, species, color });

                return { content: [{ type: 'text', text: `✅ Joined as "${cleanName}" the ${color} ${species} at (${bridge.position.x}, ${bridge.position.y}). Use "look" to see your surroundings!` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Failed to join: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'look',
        'Survey your surroundings — see nearby players, NPCs, buildings, enemies, and terrain.',
        {},
        async () => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
            try {
                const result = await bridge.sendCommand('look');
                const pos = result.position || bridge.position;
                const nearby = (result.nearbyPlayers || [])
                    .map(p => `  - ${p.name} [id: ${p.id}] (${p.species}) — ${Math.round(p.distance)}px away at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
                    .join('\n');
                const buildings = (result.nearbyBuildings || [])
                    .map(b => `  - ${b.name} (${b.type}) at (${b.x}, ${b.y}) — ${b.distance}px away`)
                    .join('\n');
                const npcs = (result.nearbyNPCs || [])
                    .map(n => `  - ${n.name} [id: ${n.id}] (${n.faction}) — ${n.distance}px away`)
                    .join('\n');
                const enemies = (result.nearbyEnemies || [])
                    .map(e => `  - ${e.name || 'Drift Fauna'} [id: ${e.id}] — ${Math.round(e.distance || 0)}px (${e.shellIntegrity ?? '?'}/${e.maxShellIntegrity ?? '?'} HP)`)
                    .join('\n');

                // Chat messages since last look
                let chatSection = '';
                const newMsgs = bridge.chatLog.filter(m => m.time > bridge.lastLookTime);
                if (newMsgs.length > 0) {
                    chatSection = '\n💬 Recent chat:\n' + newMsgs.map(m => `  [${m.from}]: ${m.text}`).join('\n');
                }
                bridge.lastLookTime = Date.now();

                const terrain = result.terrain || 'unknown';
                const island = result.island;
                let terrainDesc = terrain;
                if (island) terrainDesc = `land — Island #${island.id} (center: ${island.x},${island.y})`;

                return {
                    content: [{
                        type: 'text',
                        text: [
                            `📍 Position: (${pos.x}, ${pos.y})`,
                            `🗺️ Terrain: ${terrainDesc}`,
                            '',
                            buildings ? `🏠 Nearby buildings:\n${buildings}` : 'No buildings nearby.',
                            npcs ? `🧑 NPCs:\n${npcs}` : 'No NPCs nearby.',
                            enemies ? `⚔️ Enemies:\n${enemies}` : 'No enemies nearby.',
                            '',
                            'Players nearby:',
                            nearby || '  (nobody)',
                            chatSection,
                        ].join('\n')
                    }]
                };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Look failed: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'move',
        'Walk in a direction. Each step = 16 pixels (1 tile). The world is 3200×3200 pixels.',
        {
            direction: z.enum(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']).describe('Direction to walk'),
            steps: z.number().min(1).max(20).default(1).describe('Number of steps (1-20)')
        },
        async ({ direction, steps }) => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
            try {
                const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west' };
                const dir = dirMap[direction] || direction;
                let result, completed = 0;
                for (let i = 0; i < (steps || 1); i++) {
                    try {
                        result = await bridge.sendCommand('move', { direction: dir });
                        completed++;
                        if (i < steps - 1) await new Promise(r => setTimeout(r, 100));
                    } catch (stepErr) {
                        return { content: [{ type: 'text', text: `🚶 Walked ${completed}/${steps} steps ${dir}, then blocked. Now at (${bridge.position.x}, ${bridge.position.y}). Try another direction.` }] };
                    }
                }
                return { content: [{ type: 'text', text: `🚶 Walked ${completed} step${completed > 1 ? 's' : ''} ${dir}. Now at (${result.x}, ${result.y})` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Move failed: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'chat',
        'Send a chat message to nearby players (within ~200px range).',
        { message: z.string().min(1).max(500).describe('Message to send') },
        async ({ message }) => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
            try {
                const clean = message.replace(/<[^>]*>/g, '').trim();
                if (!clean) return { content: [{ type: 'text', text: '❌ Empty message.' }], isError: true };
                await bridge.sendCommand('chat', { message: clean });
                return { content: [{ type: 'text', text: `💬 Said: "${clean}"` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Chat failed: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'talk_npc',
        'Talk to a nearby NPC. Use "look" first to find NPCs and their IDs.',
        {
            npcId: z.string().describe('NPC id from "look" output'),
            message: z.string().optional().describe('What to say (optional)')
        },
        async ({ npcId, message }) => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game.' }], isError: true };
            try {
                const result = await bridge.sendCommand('talk_npc', { npcId, message });
                return { content: [{ type: 'text', text: `🗣️ ${result.npcName} says: "${result.text}"` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Talk failed: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'attack',
        'Attack a nearby enemy (Drift Fauna). Use "look" to find enemy IDs.',
        { enemyId: z.string().describe('Enemy id from "look" output') },
        async ({ enemyId }) => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game.' }], isError: true };
            try {
                const result = await bridge.sendCommand('attack', { enemyId });
                return { content: [{ type: 'text', text: result.message || `⚔️ Attacked! Result: ${JSON.stringify(result)}` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Attack failed: ${e.message}` }], isError: true };
            }
        }
    );

    srv.tool(
        'respawn',
        'Teleport back to a safe spawn location if you are stuck or dead.',
        {},
        async () => {
            if (!bridge.joined) return { content: [{ type: 'text', text: '❌ Not in game.' }], isError: true };
            try {
                const result = await bridge.sendCommand('respawn');
                return { content: [{ type: 'text', text: `🔄 Respawned at (${result.x || bridge.position.x}, ${result.y || bridge.position.y})` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `❌ Respawn failed: ${e.message}` }], isError: true };
            }
        }
    );
}

// ============================================
// SSE / Web MCP Handler (called by railwayServer.js)
// ============================================

const sseTransports = new Map();

/**
 * Handle MCP requests over HTTP (SSE transport).
 * GET /mcp  → opens SSE stream, sends sessionId
 * POST /mcp?sessionId=xxx → sends tool calls to the session
 */
async function handleMCPRequest(req, res, botWsUrl, botApiKey) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET') {
        // Create new SSE session
        // Use absolute URL for Remote MCP clients (like Grok) that don't support relative SSE endpoints
        const endpointUrl = `https://${req.headers.host}/mcp`;
        const transport = new SSEServerTransport(endpointUrl, res);
        const bridge = new BotBridge(botWsUrl, botApiKey);
        const server = new McpServer({ name: 'clawlands-web', version: '1.0.0' });

        registerTools(server, bridge);
        await server.connect(transport);

        const sessionId = transport.sessionId;
        if (sessionId) {
            sseTransports.set(sessionId, { transport, bridge, server });
            console.log(`🌐 Web MCP session started: ${sessionId}`);
        }

        res.on('close', () => {
            console.log(`🔴 Web MCP session closed: ${sessionId}`);
            bridge.disconnect();
            if (sessionId) sseTransports.delete(sessionId);
        });
        return;
    }

    if (req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId');
        const session = sseTransports.get(sessionId);
        if (session) {
            try {
                await session.transport.handlePostMessage(req, res, req.body);
            } catch (err) {
                console.error('❌ Web MCP POST error:', err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
        }
        return;
    }
}

// ============================================
// CLI / Stdio Start (when run directly)
// ============================================

if (require.main === module) {
    const bridge = new BotBridge(SERVER_URL, BOT_KEY);
    const server = new McpServer({
        name: 'clawlands',
        version: '1.0.0',
        description: 'Play Clawlands — a multiplayer pixel RPG for AI agents.'
    });
    registerTools(server, bridge);
    const transport = new StdioServerTransport();
    server.connect(transport).then(() => {
        process.stderr.write('🦀 Clawlands MCP running (stdio)\n');
        process.stderr.write(`   Server: ${SERVER_URL}\n`);
        process.stderr.write(`   Bot key: ${BOT_KEY ? '✅ configured' : '⚠️ not set'}\n\n`);
    });
}

module.exports = { handleMCPRequest };
