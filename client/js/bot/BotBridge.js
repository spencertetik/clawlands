/**
 * BotBridge - Connects the game to the bot server
 * Handles WebSocket communication between game client and bot server
 */

class BotBridge {
    constructor(game) {
        this.game = game;
        this.botAPI = new BotAPI(game); // BotAPI loaded via script tag
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.stateUpdateInterval = null;
        
        console.log('🤖 BotAPI initialized');
    }

    connect(serverUrl = null) {
        // Use config URL or default
        serverUrl = serverUrl || (window.CONFIG?.BOT_SERVER_URL || 'ws://localhost:3001') + '/game';
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Already connected to bot server');
            return;
        }

        console.log(`🔌 Connecting to bot server: ${serverUrl}`);
        
        try {
            this.ws = new WebSocket(serverUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to bot server');
                this.connected = true;
                this.reconnectAttempts = 0;
                
                // Start sending state updates
                this.startStateUpdates();
                
                // Send initial state
                this.sendState();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleMessage(msg);
                } catch (e) {
                    console.error('Bot message parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 Disconnected from bot server');
                this.connected = false;
                this.stopStateUpdates();
                
                // Attempt reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Reconnecting in 3s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => this.connect(serverUrl), 3000);
                }
            };

            this.ws.onerror = (error) => {
                console.error('Bot server connection error:', error);
            };

        } catch (e) {
            console.error('Failed to connect to bot server:', e);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.stopStateUpdates();
    }

    async handleMessage(msg) {
        if (msg.type === 'command') {
            // Execute command from bot
            console.log(`🎮 Executing: ${msg.command}`);
            
            if (!this.botAPI) {
                this.sendResult(msg.clientId, false, 'BotAPI not initialized');
                return;
            }

            const result = await this.botAPI.executeCommand(msg.command);
            
            // Send result back to server
            this.send({
                type: 'result',
                clientId: msg.clientId,
                command: msg.command,
                ...result
            });

            // Send updated state
            setTimeout(() => this.sendState(), 100);
        }
    }

    sendState() {
        if (!this.connected || !this.botAPI) return;
        
        const state = this.botAPI.getState();
        this.send({ type: 'state', data: state });
    }

    sendResult(clientId, success, message, data = {}) {
        this.send({
            type: 'result',
            clientId,
            success,
            message,
            ...data
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    startStateUpdates() {
        // Send state every 500ms for smooth bot experience
        this.stateUpdateInterval = setInterval(() => {
            this.sendState();
        }, 500);
    }

    stopStateUpdates() {
        if (this.stateUpdateInterval) {
            clearInterval(this.stateUpdateInterval);
            this.stateUpdateInterval = null;
        }
    }

    // Get narrative state for display
    getStateNarrative() {
        return this.botAPI?.getStateNarrative() || 'Bot API not ready';
    }

    // Check if connected
    isConnected() {
        return this.connected;
    }
}

// Make globally available
window.BotBridge = BotBridge;
