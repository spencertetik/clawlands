/**
 * Clawlands Configuration
 * URLs can be overridden via query params: ?server=wss://...
 * 
 * Railway deployment: Set RAILWAY_SERVER_URL env var or use query param
 */

// Railway production URL (update after deploying)
const RAILWAY_URL = 'wss://claw-world-production.up.railway.app';

const CONFIG = {
    // Unified server URL (Railway combines bot + multiplayer)
    SERVER_URL: window.location.hostname.includes('netlify.app')
        ? RAILWAY_URL
        : 'ws://localhost:3000',

    // Legacy separate URLs (for backwards compatibility)
    BOT_SERVER_URL: window.location.hostname.includes('netlify.app') 
        ? RAILWAY_URL + '/bot'
        : 'ws://localhost:3000/bot',
    
    // Multiplayer server WebSocket URL
    MULTIPLAYER_URL: window.location.hostname.includes('netlify.app')
        ? RAILWAY_URL + '/game'
        : 'ws://localhost:3000/game',
    
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
