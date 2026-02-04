#!/usr/bin/env node
/**
 * OpenClaw Player - Bridges OpenClaw AI to Claw World
 * 
 * This bot reads commands from stdin and outputs game state to stdout,
 * allowing OpenClaw (Claude) to play the game directly.
 * 
 * Usage: node openclaw-player.js --name "Claude"
 * 
 * Input (from OpenClaw):
 *   walk north
 *   say Hello everyone!
 *   interact
 *   status
 * 
 * Output (to OpenClaw):
 *   [STATE] You are at (28, 62)...
 *   [HEARD] Pinchy: "Hey there!"
 *   [RESULT] Walked north successfully
 */

const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const BOT_SERVER = process.env.BOT_SERVER || 'ws://localhost:3001';

// Parse args
const args = process.argv.slice(2);
let botName = 'Claude';
const nameIdx = args.indexOf('--name');
if (nameIdx !== -1 && args[nameIdx + 1]) {
    botName = args[nameIdx + 1];
}

// Load instructions
const INSTRUCTIONS_PATH = path.join(__dirname, 'BOT_INSTRUCTIONS.md');
let instructions = '';
try {
    instructions = fs.readFileSync(INSTRUCTIONS_PATH, 'utf-8');
} catch (e) {}

class OpenClawPlayer {
    constructor(name) {
        this.name = name;
        this.ws = null;
        this.state = null;
        this.connected = false;
        this.lastStateTime = 0;
    }

    connect() {
        this.log(`Connecting to Claw World as "${this.name}"...`);
        
        this.ws = new WebSocket(BOT_SERVER);

        this.ws.on('open', () => {
            this.connected = true;
            this.log(`Connected! You are ${this.name} on Claw Island.`);
            this.ws.send(JSON.stringify({ 
                type: 'identify', 
                name: this.name, 
                position: { x: 0, y: 0 } 
            }));
            
            // Print instructions on first connect
            this.output('\n' + '='.repeat(60));
            this.output('CLAW WORLD - AI Player Interface');
            this.output('='.repeat(60));
            this.output('\nYou are a crustacean living on Claw Island.');
            this.output('Explore, meet NPCs, and talk to other players you encounter.');
            this.output('\nCommands: walk <dir>, say <msg>, interact, enter, exit, look, status');
            this.output('='.repeat(60) + '\n');
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data);
            this.handleMessage(msg);
        });

        this.ws.on('close', () => {
            this.connected = false;
            this.log('Disconnected from Claw World');
            // Reconnect after delay
            setTimeout(() => this.connect(), 5000);
        });

        this.ws.on('error', (err) => {
            this.output(`[ERROR] Connection failed: ${err.message}`);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'state':
                this.state = msg.data;
                this.updatePosition();
                // Only output state if enough time passed or first time
                const now = Date.now();
                if (now - this.lastStateTime > 2000) {
                    this.outputState();
                    this.lastStateTime = now;
                }
                break;
                
            case 'result':
                this.output(`[RESULT] ${msg.message}`);
                // Output state after action
                setTimeout(() => this.outputState(), 100);
                break;
                
            case 'heard':
                // Important! Someone is talking to us
                this.output(`\n[HEARD] ${msg.speaker}: "${msg.message}"`);
                this.output('[TIP] Use "say <message>" to respond!\n');
                break;
                
            case 'waiting':
                this.output(`[WAITING] ${msg.message}`);
                break;
                
            case 'game_disconnected':
                this.output('[GAME] Game client disconnected. Waiting for reconnect...');
                break;
                
            case 'error':
                this.output(`[ERROR] ${msg.message}`);
                break;
        }
    }

    updatePosition() {
        if (this.state?.player?.position && this.connected) {
            this.ws.send(JSON.stringify({ 
                type: 'identify', 
                name: this.name, 
                position: {
                    x: this.state.player.position.pixelX || 0,
                    y: this.state.player.position.pixelY || 0
                }
            }));
        }
    }

    outputState() {
        if (!this.state) return;
        const s = this.state;
        
        let lines = [];
        lines.push('\n[STATE]');
        lines.push(`Location: ${s.location}${s.isIndoors ? ' (inside)' : ''}`);
        lines.push(`Position: (${s.player?.position?.x}, ${s.player?.position?.y}) facing ${s.player?.facing}`);
        lines.push(`Surroundings: ${s.surroundings}`);
        
        // Nearby players (important for conversations!)
        const players = s.nearby?.players || [];
        if (players.length > 0) {
            lines.push(`Nearby players: ${players.map(p => `${p.name} (${p.direction}, ${p.distance}px)`).join(', ')}`);
        }
        
        // Nearby NPCs
        const npcs = s.nearby?.npcs || [];
        if (npcs.length > 0) {
            lines.push(`Nearby NPCs: ${npcs.map(n => `${n.name} (${n.direction}${n.canInteract ? ', can talk' : ''})`).join(', ')}`);
        }
        
        // Buildings
        const buildings = s.nearby?.buildings || [];
        if (buildings.length > 0 && !s.isIndoors) {
            lines.push(`Nearby buildings: ${buildings.map(b => `${b.name} (${b.direction}${b.canEnter ? ', can enter' : ''})`).join(', ')}`);
        }
        
        // Dialog
        if (s.dialog) {
            lines.push(`\n[DIALOG] ${s.dialog.speaker}: "${s.dialog.text}"`);
        }
        
        // Recent messages heard
        const heard = s.heard || [];
        if (heard.length > 0) {
            lines.push('\n[RECENT MESSAGES]');
            for (const h of heard.slice(-3)) {
                lines.push(`  ${h.speaker} (${h.ago}s ago): "${h.message}"`);
            }
        }
        
        lines.push(`\nAvailable actions: ${s.actions?.join(', ')}`);
        
        this.output(lines.join('\n'));
    }

    sendCommand(command) {
        if (!this.connected) {
            this.output('[ERROR] Not connected to game');
            return;
        }
        
        this.log(`> ${command}`);
        this.ws.send(JSON.stringify({
            type: 'command',
            command: command
        }));
    }

    // Output to stdout (for OpenClaw to read)
    output(text) {
        console.log(text);
    }
    
    // Log (less important, could go to stderr)
    log(text) {
        console.error(`[${this.name}] ${text}`);
    }

    // Start listening for commands from stdin
    startListening() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        rl.on('line', (line) => {
            const cmd = line.trim();
            if (!cmd) return;
            
            if (cmd === 'help') {
                this.output('\n--- COMMANDS ---');
                this.output('walk north/south/east/west - Move in a direction');
                this.output('say <message> - Speak (nearby players will hear)');
                this.output('interact - Talk to nearby NPC or use object');
                this.output('enter - Enter a building');
                this.output('exit - Leave a building');
                this.output('look - Look around');
                this.output('status - Show current state');
                this.output('instructions - Show full game instructions');
                this.output('');
            } else if (cmd === 'status' || cmd === 'state') {
                this.outputState();
            } else if (cmd === 'instructions') {
                this.output('\n' + instructions);
            } else {
                this.sendCommand(cmd);
            }
        });

        rl.on('close', () => {
            this.output('[EXIT] Goodbye!');
            process.exit(0);
        });
    }
}

// Start the player
const player = new OpenClawPlayer(botName);
player.connect();
player.startListening();
