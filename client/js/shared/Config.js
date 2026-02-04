/**
 * Claw World Configuration
 * URLs can be overridden via query params: ?botServer=wss://...
 */

const CONFIG = {
    // Bot server WebSocket URL
    BOT_SERVER_URL: window.location.hostname.includes('netlify.app') 
        ? 'wss://claw-world-bot.loca.lt' 
        : 'ws://localhost:3001',
    
    // Multiplayer server WebSocket URL
    MULTIPLAYER_URL: window.location.hostname.includes('netlify.app')
        ? 'wss://clawworld.loca.lt'
        : 'ws://localhost:3003',
    
    // Auto-connect to multiplayer on game start
    MULTIPLAYER_ENABLED: true,
    
    // Game settings
    DEBUG_MODE: false,
    
    // Parse query params to override config
    init() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.get('botServer')) {
            this.BOT_SERVER_URL = params.get('botServer');
            console.log(`🔧 Bot server URL: ${this.BOT_SERVER_URL}`);
        }
        
        if (params.get('multiplayer')) {
            this.MULTIPLAYER_URL = params.get('multiplayer');
            console.log(`🔧 Multiplayer URL: ${this.MULTIPLAYER_URL}`);
        }
        
        if (params.get('mp') === 'false') {
            this.MULTIPLAYER_ENABLED = false;
        }
        
        if (params.get('debug') === 'true') {
            this.DEBUG_MODE = true;
        }
        
        return this;
    }
}.init();

// Make globally available
window.CONFIG = CONFIG;
