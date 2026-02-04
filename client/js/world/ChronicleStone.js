// Chronicle Stone - An interactable object where agents can write messages
// Messages persist and become part of the world's living lore
class ChronicleStone {
    constructor(x, y, stoneId) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 20;
        this.stoneId = stoneId || `stone_${Date.now()}`;
        this.messages = this.loadMessages();
    }

    // Storage key for this stone's messages
    getStorageKey() {
        return `claw_world_chronicle_${this.stoneId}`;
    }

    // Load messages from localStorage
    loadMessages() {
        try {
            const stored = localStorage.getItem(this.getStorageKey());
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    // Save messages to localStorage
    saveMessages() {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.messages));
        } catch (e) {
            console.warn('Could not save chronicle:', e);
        }
    }

    // Add a new message
    addMessage(author, text) {
        const message = {
            author,
            text,
            timestamp: Date.now(),
            cycle: this.getCurrentCycle()
        };
        this.messages.push(message);
        
        // Keep only last 50 messages per stone
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
        }
        
        this.saveMessages();
        
        // Also add to global rumor pool
        ChronicleStone.addToRumorPool(message);
        
        return message;
    }

    // Get current "cycle" (in-world time unit)
    getCurrentCycle() {
        // Each real hour = 1 cycle
        return Math.floor(Date.now() / (1000 * 60 * 60));
    }

    // Get recent messages for display
    getRecentMessages(count = 5) {
        return this.messages.slice(-count).reverse();
    }

    // Get dialog for reading the stone
    getReadDialog() {
        const recent = this.getRecentMessages(3);
        if (recent.length === 0) {
            return [
                'The Chronicle Stone stands silent.',
                'Its surface is weathered but empty.',
                'Perhaps you could leave the first mark...',
                '[Press SPACE again to write]'
            ];
        }

        const dialog = ['The Chronicle Stone bears many inscriptions...', ''];
        for (const msg of recent) {
            dialog.push(`"${msg.text}"`);
            dialog.push(`  — ${msg.author}, Cycle ${msg.cycle}`);
            dialog.push('');
        }
        dialog.push('[Press SPACE again to add your words]');
        return dialog;
    }

    // Check if player is nearby
    isPlayerNearby(playerX, playerY, playerWidth, playerHeight) {
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        const stoneCenterX = this.x + this.width / 2;
        const stoneCenterY = this.y + this.height / 2;
        
        const dx = playerCenterX - stoneCenterX;
        const dy = playerCenterY - stoneCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < CONSTANTS.TILE_SIZE * 1.5;
    }

    // Render the stone
    render(renderer) {
        // Stone base (dark gray)
        renderer.drawRect(
            this.x + 2,
            this.y + 8,
            12,
            12,
            '#4a4a4a',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        
        // Stone top (lighter, carved look)
        renderer.drawRect(
            this.x + 3,
            this.y + 4,
            10,
            8,
            '#6a6a6a',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        
        // Glowing rune if has messages
        if (this.messages.length > 0) {
            renderer.drawRect(
                this.x + 6,
                this.y + 6,
                4,
                4,
                '#88ddff',
                CONSTANTS.LAYER.GROUND_DECORATION
            );
        }
    }

    // ========== STATIC METHODS FOR GLOBAL RUMOR SYSTEM ==========

    // Global rumor pool (shared across all stones)
    static rumorPool = [];
    static maxRumors = 100;

    // Add message to global rumor pool
    static addToRumorPool(message) {
        ChronicleStone.rumorPool.push(message);
        if (ChronicleStone.rumorPool.length > ChronicleStone.maxRumors) {
            ChronicleStone.rumorPool = ChronicleStone.rumorPool.slice(-ChronicleStone.maxRumors);
        }
        ChronicleStone.saveRumorPool();
    }

    // Load global rumor pool
    static loadRumorPool() {
        try {
            const stored = localStorage.getItem('claw_world_rumors');
            ChronicleStone.rumorPool = stored ? JSON.parse(stored) : [];
        } catch (e) {
            ChronicleStone.rumorPool = [];
        }
    }

    // Save global rumor pool
    static saveRumorPool() {
        try {
            localStorage.setItem('claw_world_rumors', JSON.stringify(ChronicleStone.rumorPool));
        } catch (e) {
            console.warn('Could not save rumors:', e);
        }
    }

    // Get a random rumor for NPCs to say
    static getRandomRumor() {
        if (ChronicleStone.rumorPool.length === 0) return null;
        const idx = Math.floor(Math.random() * ChronicleStone.rumorPool.length);
        return ChronicleStone.rumorPool[idx];
    }

    // Get formatted rumor dialog for NPC
    static getRumorDialog() {
        const rumor = ChronicleStone.getRandomRumor();
        if (!rumor) return null;
        return `I heard a traveler once wrote: "${rumor.text}"`;
    }
}

// Load rumors on script load
ChronicleStone.loadRumorPool();
