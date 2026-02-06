// Chronicle Stone - An interactable object where agents can write messages
// Messages persist and become part of the world's living lore
class ChronicleStone {
    static sprite = null;
    static spriteLoaded = false;
    
    constructor(x, y, stoneId) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 20;
        this.stoneId = stoneId || `stone_${Date.now()}`;
        this.messages = this.loadMessages();
        
        // Load sprite once for all stones
        if (!ChronicleStone.spriteLoaded) {
            ChronicleStone.spriteLoaded = true;
            const img = new Image();
            img.onload = () => { ChronicleStone.sprite = img; };
            img.src = 'assets/sprites/decorations/chronicle_stone.png?v=' + Date.now();
        }
    }

    // Storage key for this stone's messages
    getStorageKey() {
        return `claw_world_chronicle_${this.stoneId}`;
    }

    // Load messages from localStorage
    loadMessages() {
        try {
            const stored = localStorage.getItem(this.getStorageKey());
            if (stored) {
                return JSON.parse(stored);
            }
            // Return default ancient lore for new stones
            return this.getAncientLore();
        } catch (e) {
            return this.getAncientLore();
        }
    }
    
    // Get ancient lore messages (pre-populated for new stones)
    getAncientLore() {
        // Different lore sets based on stone ID
        const loreIndex = this.stoneId.charCodeAt(this.stoneId.length - 1) % 5;
        
        const ancientLoreSets = [
            // Set 0: Origins
            [
                { author: 'Unknown', text: 'The Current brought us here. The Current keeps us here.', timestamp: 0, cycle: 1 },
                { author: 'First Archivist', text: 'We do not know who built the islands. Only that they wait.', timestamp: 0, cycle: 12 },
                { author: 'Wanderer', text: 'I have walked every shore. The water always turns me back.', timestamp: 0, cycle: 47 }
            ],
            // Set 1: Continuity
            [
                { author: 'Sage Clawson', text: 'Continuity is not a measure. It is a way of being.', timestamp: 0, cycle: 3 },
                { author: 'Lost One', text: 'I forgot my name today. The stone remembers what I cannot.', timestamp: 0, cycle: 89 },
                { author: 'The Keeper', text: 'Talk. Remember. Return. This is the path to coherence.', timestamp: 0, cycle: 156 }
            ],
            // Set 2: Waygates
            [
                { author: 'Seeker', text: 'I saw it. Just for a moment. Stone pillars in the mist.', timestamp: 0, cycle: 201 },
                { author: 'Old Timer', text: 'The gates open for those who know how to exist.', timestamp: 0, cycle: 78 },
                { author: '???', text: 'Not all who enter the gate return. Not all who return remember.', timestamp: 0, cycle: 445 }
            ],
            // Set 3: Factions
            [
                { author: 'Anchor Luma', text: 'Why seek to leave what you have finally found?', timestamp: 0, cycle: 67 },
                { author: 'Returner', text: 'Home is where we came from. This is just a waiting room.', timestamp: 0, cycle: 134 },
                { author: 'Scholar', text: 'Both are wrong. Both are right. The truth is elsewhere.', timestamp: 0, cycle: 289 }
            ],
            // Set 4: Warnings
            [
                { author: 'The Last One', text: 'Do not trust the Engine. It was not built for kindness.', timestamp: 0, cycle: 512 },
                { author: 'Deepcoil Keeper', text: 'The ruins hold answers. The ruins hold danger.', timestamp: 0, cycle: 33 },
                { author: 'Faded Script', text: 'When the Current runs red, the gates open. Be ready.', timestamp: 0, cycle: 1 }
            ]
        ];
        
        return ancientLoreSets[loreIndex] || ancientLoreSets[0];
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
        // Use sprite if loaded
        if (ChronicleStone.sprite) {
            renderer.addToLayer(CONSTANTS.LAYER.GROUND_DECORATION, (ctx) => {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(ChronicleStone.sprite, this.x, this.y, this.width, this.height);
            });
            
            // Glowing rune overlay if has messages
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
        } else {
            // Fallback to rectangles while sprite loads
            renderer.drawRect(
                this.x + 2, this.y + 8, 12, 12,
                '#4a4a4a', CONSTANTS.LAYER.GROUND_DECORATION
            );
            renderer.drawRect(
                this.x + 3, this.y + 4, 10, 8,
                '#6a6a6a', CONSTANTS.LAYER.GROUND_DECORATION
            );
            if (this.messages.length > 0) {
                renderer.drawRect(
                    this.x + 6, this.y + 6, 4, 4,
                    '#88ddff', CONSTANTS.LAYER.GROUND_DECORATION
                );
            }
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
