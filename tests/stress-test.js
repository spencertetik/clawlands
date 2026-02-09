/**
 * Clawlands Multiplayer Stress Test
 * 
 * Connects N concurrent bots to the Railway server,
 * simulates movement, chat, and measures:
 * - Connection success/failure rates
 * - Message latency (ping/pong round trip)
 * - Broadcast delivery time
 * - Memory/connection stability over time
 * - Disconnect/reconnect handling
 */

const WebSocket = require('ws');

// ============================================
// Configuration
// ============================================

const SERVER_URL = process.env.SERVER_URL || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.BOT_KEY || 'dev-key';
const NUM_BOTS = parseInt(process.env.NUM_BOTS) || 10;
const TEST_DURATION_MS = parseInt(process.env.DURATION) || 60000; // 60 seconds
const MOVE_INTERVAL_MS = 500; // Move every 500ms
const CHAT_INTERVAL_MS = 5000; // Chat every 5 seconds
const PING_INTERVAL_MS = 3000; // Ping every 3 seconds
const STAGGER_CONNECT_MS = 200; // Stagger connections by 200ms

const SPECIES = ['lobster', 'crab', 'shrimp', 'crawfish', 'hermit_crab'];
const COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'yellow', 'cyan', 'white'];
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// ============================================
// Metrics
// ============================================

const metrics = {
    connectAttempts: 0,
    connectSuccess: 0,
    connectFailed: 0,
    connectErrors: [],
    
    messagesSent: 0,
    messagesReceived: 0,
    
    movesSent: 0,
    movesReceived: 0, // broadcast moves from other bots (individual)
    batchedPositionsReceived: 0, // batched tick messages received
    batchedPlayersReceived: 0, // total player updates via batched ticks
    
    chatsSent: 0,
    chatsReceived: 0,
    
    pingsSent: 0,
    pongsReceived: 0,
    latencies: [],
    
    disconnects: 0,
    errors: [],
    
    startTime: null,
    endTime: null,
    
    playerJoinedEvents: 0,
    playerLeftEvents: 0,
    
    bytesReceived: 0,
    bytesSent: 0
};

// ============================================
// Bot class
// ============================================

class StressBot {
    constructor(id) {
        this.id = id;
        this.name = `StressBot-${id}`;
        this.species = SPECIES[id % SPECIES.length];
        this.color = COLORS[id % COLORS.length];
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.joined = false;
        this.x = 700 + (id % 10) * 32;
        this.y = 650 + Math.floor(id / 10) * 32;
        this.moveInterval = null;
        this.chatInterval = null;
        this.pingInterval = null;
        this.pingTimestamps = new Map(); // pingId -> sentTime
        this.receivedPlayerCount = 0;
    }

    connect() {
        return new Promise((resolve) => {
            metrics.connectAttempts++;
            
            const url = `${SERVER_URL}/bot?key=${BOT_KEY}`;
            
            try {
                this.ws = new WebSocket(url, {
                    headers: { 'User-Agent': `StressBot/${this.id}` },
                    handshakeTimeout: 10000
                });
            } catch (err) {
                metrics.connectFailed++;
                metrics.connectErrors.push({ bot: this.id, error: err.message });
                resolve(false);
                return;
            }

            const connectTimeout = setTimeout(() => {
                if (!this.connected) {
                    metrics.connectFailed++;
                    metrics.connectErrors.push({ bot: this.id, error: 'Connection timeout (10s)' });
                    this.ws.terminate();
                    resolve(false);
                }
            }, 10000);

            this.ws.on('open', () => {
                clearTimeout(connectTimeout);
                this.connected = true;
                metrics.connectSuccess++;
                resolve(true);
            });

            this.ws.on('message', (data) => {
                const bytes = typeof data === 'string' ? data.length : data.byteLength;
                metrics.bytesReceived += bytes;
                metrics.messagesReceived++;
                
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMessage(msg);
                } catch (e) {
                    metrics.errors.push({ bot: this.id, error: `Parse error: ${e.message}` });
                }
            });

            this.ws.on('close', (code, reason) => {
                this.connected = false;
                this.joined = false;
                metrics.disconnects++;
                this.stopIntervals();
            });

            this.ws.on('error', (err) => {
                if (!this.connected) {
                    clearTimeout(connectTimeout);
                    metrics.connectFailed++;
                    metrics.connectErrors.push({ bot: this.id, error: err.message });
                    resolve(false);
                } else {
                    metrics.errors.push({ bot: this.id, error: err.message });
                }
            });
        });
    }

    handleMessage(msg) {
        // Handle compressed batched positions: { t: 'p', p: [...] }
        if (msg.t === 'p') {
            metrics.batchedPositionsReceived++;
            metrics.batchedPlayersReceived += (msg.p ? msg.p.length : 0);
            return;
        }

        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                this.join();
                break;
            case 'joined':
                this.joined = true;
                this.receivedPlayerCount = msg.players?.length || 0;
                this.startIntervals();
                break;
            case 'player_moved':
                metrics.movesReceived++;
                break;
            case 'chat':
                metrics.chatsReceived++;
                break;
            case 'player_joined':
                metrics.playerJoinedEvents++;
                break;
            case 'player_left':
                metrics.playerLeftEvents++;
                break;
            case 'pong':
                metrics.pongsReceived++;
                break;
            case 'moved':
                // Ack from server for our move
                break;
            case 'error':
                metrics.errors.push({ bot: this.id, error: `Server: ${msg.message}` });
                break;
        }
    }

    join() {
        this.send({
            command: 'join',
            data: {
                name: this.name,
                species: this.species,
                color: this.color
            }
        });
    }

    send(msg) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const data = JSON.stringify(msg);
            metrics.bytesSent += data.length;
            metrics.messagesSent++;
            this.ws.send(data);
        }
    }

    startIntervals() {
        // Movement
        this.moveInterval = setInterval(() => {
            if (!this.joined) return;
            const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
            this.send({ command: 'move', data: { direction: dir } });
            metrics.movesSent++;
        }, MOVE_INTERVAL_MS);

        // Chat (less frequent)
        this.chatInterval = setInterval(() => {
            if (!this.joined) return;
            this.send({ command: 'chat', data: { message: `Stress test msg from ${this.name}` } });
            metrics.chatsSent++;
        }, CHAT_INTERVAL_MS + Math.random() * 2000);

        // Ping for latency measurement (use type: 'ping' not command: 'ping')
        this.pingInterval = setInterval(() => {
            if (!this.connected) return;
            const pingStart = Date.now();
            this.send({ type: 'ping' });
            this._lastPingSent = pingStart;
            metrics.pingsSent++;
        }, PING_INTERVAL_MS);

        // Override pong handler to measure latency
        const origHandler = this.handleMessage.bind(this);
        this.handleMessage = (msg) => {
            if (msg.type === 'pong' && this._lastPingSent) {
                const latency = Date.now() - this._lastPingSent;
                metrics.latencies.push(latency);
                this._lastPingSent = null;
            }
            origHandler(msg);
        };
    }

    stopIntervals() {
        if (this.moveInterval) clearInterval(this.moveInterval);
        if (this.chatInterval) clearInterval(this.chatInterval);
        if (this.pingInterval) clearInterval(this.pingInterval);
    }

    disconnect() {
        this.stopIntervals();
        if (this.ws) {
            this.ws.close(1000, 'Test complete');
        }
    }
}

// ============================================
// Main Test Runner
// ============================================

async function runStressTest() {
    console.log(`
╔══════════════════════════════════════════════════╗
║        CLAWLANDS MULTIPLAYER STRESS TEST         ║
╠══════════════════════════════════════════════════╣
║  Server:    ${SERVER_URL.padEnd(36)}║
║  Bots:      ${String(NUM_BOTS).padEnd(36)}║
║  Duration:  ${(TEST_DURATION_MS / 1000 + 's').padEnd(36)}║
║  Move freq: ${(MOVE_INTERVAL_MS + 'ms').padEnd(36)}║
║  Chat freq: ${(CHAT_INTERVAL_MS + 'ms').padEnd(36)}║
╚══════════════════════════════════════════════════╝
`);

    // Check server health first
    console.log('🔍 Checking server health...');
    try {
        const healthUrl = SERVER_URL.replace('wss://', 'https://').replace('ws://', 'http://') + '/health';
        const resp = await fetch(healthUrl);
        const health = await resp.json();
        console.log(`   Server status: ${health.status}, current players: ${health.players}, DB: ${health.database}`);
    } catch (err) {
        console.error(`   ⚠️ Health check failed: ${err.message}`);
        console.log('   Proceeding anyway...\n');
    }

    metrics.startTime = Date.now();
    const bots = [];

    // Stagger connections
    console.log(`\n🤖 Connecting ${NUM_BOTS} bots (staggered ${STAGGER_CONNECT_MS}ms)...`);
    for (let i = 0; i < NUM_BOTS; i++) {
        const bot = new StressBot(i);
        bots.push(bot);
        const success = await bot.connect();
        console.log(`   Bot ${i}: ${success ? '✅' : '❌'}`);
        
        if (i < NUM_BOTS - 1) {
            await new Promise(r => setTimeout(r, STAGGER_CONNECT_MS));
        }
    }

    const connectedBots = bots.filter(b => b.connected).length;
    console.log(`\n✅ ${connectedBots}/${NUM_BOTS} bots connected`);

    if (connectedBots === 0) {
        console.error('❌ No bots connected. Aborting test.');
        process.exit(1);
    }

    // Wait for all joins to process
    await new Promise(r => setTimeout(r, 2000));
    const joinedBots = bots.filter(b => b.joined).length;
    console.log(`✅ ${joinedBots}/${connectedBots} bots joined the game`);

    // Progress reporting
    console.log(`\n⏱️  Running test for ${TEST_DURATION_MS / 1000}s...\n`);
    
    const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - metrics.startTime) / 1000).toFixed(0);
        const alive = bots.filter(b => b.connected).length;
        const avgLatency = metrics.latencies.length > 0 
            ? (metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(1)
            : 'N/A';
        
        process.stdout.write(`\r   [${elapsed}s] Alive: ${alive}/${NUM_BOTS} | Msgs: ↑${metrics.messagesSent} ↓${metrics.messagesReceived} | Moves: ↑${metrics.movesSent} ↓${metrics.movesReceived} | Latency: ${avgLatency}ms | Errors: ${metrics.errors.length}`);
    }, 2000);

    // Run for duration
    await new Promise(r => setTimeout(r, TEST_DURATION_MS));

    clearInterval(progressInterval);
    console.log('\n');

    // Disconnect all bots
    console.log('🔌 Disconnecting bots...');
    for (const bot of bots) {
        bot.disconnect();
    }
    await new Promise(r => setTimeout(r, 2000));

    metrics.endTime = Date.now();

    // ============================================
    // Results
    // ============================================
    
    const duration = (metrics.endTime - metrics.startTime) / 1000;
    const latencies = metrics.latencies.sort((a, b) => a - b);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;

    // Calculate expected broadcast messages
    // Each move from 1 bot should broadcast to (N-1) other bots
    // With batching, individual player_moved are replaced by batched position ticks
    const totalMoveUpdatesReceived = metrics.movesReceived + metrics.batchedPlayersReceived;
    const expectedMovesBroadcast = metrics.movesSent * (connectedBots - 1);
    const moveDeliveryRate = expectedMovesBroadcast > 0 
        ? ((totalMoveUpdatesReceived / expectedMovesBroadcast) * 100).toFixed(1) 
        : 'N/A';

    console.log(`
╔══════════════════════════════════════════════════════════╗
║                    STRESS TEST RESULTS                    ║
╠══════════════════════════════════════════════════════════╣
║  Duration:          ${(duration.toFixed(1) + 's').padEnd(38)}║
║  Bots attempted:    ${String(NUM_BOTS).padEnd(38)}║
║  Connected:         ${String(metrics.connectSuccess).padEnd(38)}║
║  Failed:            ${String(metrics.connectFailed).padEnd(38)}║
║  Disconnects:       ${String(metrics.disconnects).padEnd(38)}║
╠══════════════════════════════════════════════════════════╣
║  MESSAGES                                                 ║
║  Sent:              ${String(metrics.messagesSent).padEnd(38)}║
║  Received:          ${String(metrics.messagesReceived).padEnd(38)}║
║  Throughput (out):   ${((metrics.messagesSent / duration).toFixed(1) + ' msg/s').padEnd(37)}║
║  Throughput (in):    ${((metrics.messagesReceived / duration).toFixed(1) + ' msg/s').padEnd(37)}║
╠══════════════════════════════════════════════════════════╣
║  BANDWIDTH                                                ║
║  Sent:              ${((metrics.bytesSent / 1024).toFixed(1) + ' KB').padEnd(38)}║
║  Received:          ${((metrics.bytesReceived / 1024).toFixed(1) + ' KB').padEnd(38)}║
║  Rate (out):         ${((metrics.bytesSent / duration / 1024).toFixed(1) + ' KB/s').padEnd(37)}║
║  Rate (in):          ${((metrics.bytesReceived / duration / 1024).toFixed(1) + ' KB/s').padEnd(37)}║
╠══════════════════════════════════════════════════════════╣
║  MOVEMENT                                                 ║
║  Moves sent:        ${String(metrics.movesSent).padEnd(38)}║
║  Moves (individual):${String(metrics.movesReceived).padEnd(38)}║
║  Batched ticks:     ${String(metrics.batchedPositionsReceived).padEnd(38)}║
║  Batched updates:   ${String(metrics.batchedPlayersReceived).padEnd(38)}║
║  Total received:    ${String(totalMoveUpdatesReceived).padEnd(38)}║
║  Expected bcast:    ${String(expectedMovesBroadcast).padEnd(38)}║
║  Delivery rate:     ${(moveDeliveryRate + '%').padEnd(38)}║
╠══════════════════════════════════════════════════════════╣
║  CHAT                                                     ║
║  Sent:              ${String(metrics.chatsSent).padEnd(38)}║
║  Received:          ${String(metrics.chatsReceived).padEnd(38)}║
╠══════════════════════════════════════════════════════════╣
║  LATENCY (ping/pong round trip)                           ║
║  Samples:           ${String(latencies.length).padEnd(38)}║
║  Average:           ${(avgLatency.toFixed(1) + 'ms').padEnd(38)}║
║  P50:               ${(p50 + 'ms').padEnd(38)}║
║  P95:               ${(p95 + 'ms').padEnd(38)}║
║  P99:               ${(p99 + 'ms').padEnd(38)}║
║  Max:               ${(maxLatency + 'ms').padEnd(38)}║
╠══════════════════════════════════════════════════════════╣
║  EVENTS                                                   ║
║  Player joins:      ${String(metrics.playerJoinedEvents).padEnd(38)}║
║  Player leaves:     ${String(metrics.playerLeftEvents).padEnd(38)}║
║  Errors:            ${String(metrics.errors.length).padEnd(38)}║
╚══════════════════════════════════════════════════════════╝
`);

    // Print errors if any
    if (metrics.errors.length > 0) {
        console.log('ERRORS:');
        const uniqueErrors = {};
        metrics.errors.forEach(e => {
            const key = e.error;
            uniqueErrors[key] = (uniqueErrors[key] || 0) + 1;
        });
        Object.entries(uniqueErrors).forEach(([err, count]) => {
            console.log(`  [${count}x] ${err}`);
        });
    }

    if (metrics.connectErrors.length > 0) {
        console.log('\nCONNECTION ERRORS:');
        metrics.connectErrors.forEach(e => {
            console.log(`  Bot ${e.bot}: ${e.error}`);
        });
    }

    // Health assessment
    console.log('\n📊 ASSESSMENT:');
    
    if (metrics.connectSuccess === NUM_BOTS) {
        console.log('  ✅ All bots connected successfully');
    } else {
        console.log(`  ⚠️ ${metrics.connectFailed} bots failed to connect`);
    }
    
    if (metrics.disconnects === 0) {
        console.log('  ✅ No unexpected disconnects');
    } else {
        console.log(`  ⚠️ ${metrics.disconnects} unexpected disconnects`);
    }
    
    if (avgLatency < 100) {
        console.log(`  ✅ Average latency excellent (${avgLatency.toFixed(1)}ms)`);
    } else if (avgLatency < 200) {
        console.log(`  ⚠️ Average latency acceptable (${avgLatency.toFixed(1)}ms)`);
    } else {
        console.log(`  ❌ Average latency too high (${avgLatency.toFixed(1)}ms)`);
    }
    
    const deliveryPct = parseFloat(moveDeliveryRate);
    if (!isNaN(deliveryPct)) {
        if (deliveryPct > 95) {
            console.log(`  ✅ Move broadcast delivery excellent (${moveDeliveryRate}%)`);
        } else if (deliveryPct > 80) {
            console.log(`  ⚠️ Move broadcast delivery acceptable (${moveDeliveryRate}%)`);
        } else {
            console.log(`  ❌ Move broadcast delivery poor (${moveDeliveryRate}%) — messages being dropped`);
        }
    }
    
    if (metrics.errors.length === 0) {
        console.log('  ✅ No runtime errors');
    } else {
        console.log(`  ⚠️ ${metrics.errors.length} runtime errors`);
    }

    console.log('');
    process.exit(0);
}

runStressTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
