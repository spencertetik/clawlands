// WorldItem.js - Collectible items that spawn in the game world
// Players walk over them to auto-pickup, with bobbing animation and respawn

class WorldItem {
    constructor(itemId, x, y, respawnTime) {
        this.itemId = itemId;
        this.x = x;
        this.y = y;
        this.baseY = y; // For bobbing animation
        this.respawnTime = respawnTime || 300000; // 5 minutes default
        this.collected = false;
        this.collectTime = 0;
        this.width = 14;
        this.height = 14;
        
        // Bobbing animation
        this.bobTimer = Math.random() * Math.PI * 2; // Random phase offset
        this.bobSpeed = 1.8 + Math.random() * 0.6;
        this.bobAmplitude = 2.5;
        
        // Glow pulse
        this.glowTimer = Math.random() * Math.PI * 2;
        
        // Cache item data
        this.itemDef = typeof ItemData !== 'undefined' ? ItemData[itemId] : null;
        
        // Pre-render emoji to canvas for performance
        this.emojiCanvas = null;
        this.prerenderEmoji();
    }
    
    prerenderEmoji() {
        if (!this.itemDef) return;
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 20;
            canvas.height = 20;
            const ctx = canvas.getContext('2d');
            ctx.font = '16px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.itemDef.icon, 10, 11);
            this.emojiCanvas = canvas;
        } catch (e) {
            // Fallback: just draw colored dot
            this.emojiCanvas = null;
        }
    }
    
    update(deltaTime) {
        if (this.collected) {
            // Check respawn
            if (Date.now() - this.collectTime >= this.respawnTime) {
                this.collected = false;
            }
            return;
        }
        
        // Update bobbing
        this.bobTimer += deltaTime * this.bobSpeed;
        this.y = this.baseY + Math.sin(this.bobTimer) * this.bobAmplitude;
        
        // Update glow
        this.glowTimer += deltaTime * 2;
    }
    
    // Render the world item using the game's renderer
    render(renderer) {
        if (this.collected) return;
        if (!this.itemDef) return;
        
        // Draw glow circle underneath
        const glowAlpha = 0.15 + Math.sin(this.glowTimer) * 0.08;
        const rarityColors = {
            common: `rgba(138, 112, 104, ${glowAlpha})`,
            uncommon: `rgba(74, 222, 128, ${glowAlpha})`,
            rare: `rgba(74, 158, 255, ${glowAlpha})`,
            legendary: `rgba(245, 158, 11, ${glowAlpha})`
        };
        const glowColor = rarityColors[this.itemDef.rarity] || rarityColors.common;
        
        renderer.drawRect(
            this.x - 2,
            this.y + this.height - 3,
            this.width + 4,
            5,
            glowColor,
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        
        // Draw the emoji sprite if we have one
        if (this.emojiCanvas) {
            renderer.drawSprite(
                this.emojiCanvas,
                0, 0,
                this.emojiCanvas.width,
                this.emojiCanvas.height,
                this.x - 3,
                this.y - 3,
                20,
                20,
                CONSTANTS.LAYER.ENTITIES
            );
        } else {
            // Fallback: colored rectangle
            const fallbackColors = {
                common: '#8a7068',
                uncommon: '#4ade80',
                rare: '#4a9eff',
                legendary: '#f59e0b'
            };
            renderer.drawRect(
                this.x + 2,
                this.y + 2,
                this.width - 4,
                this.height - 4,
                fallbackColors[this.itemDef.rarity] || '#8a7068',
                CONSTANTS.LAYER.ENTITIES
            );
        }
    }
    
    // Check if player is close enough to pick up
    isPlayerNearby(playerX, playerY, playerWidth, playerHeight) {
        if (this.collected) return false;
        
        const pickupRange = 18;
        const itemCenterX = this.x + this.width / 2;
        const itemCenterY = this.baseY + this.height / 2;
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        
        const dx = itemCenterX - playerCenterX;
        const dy = itemCenterY - playerCenterY;
        return (dx * dx + dy * dy) < (pickupRange * pickupRange);
    }
    
    // Mark as collected
    collect() {
        this.collected = true;
        this.collectTime = Date.now();
    }
    
    // Check if within camera viewport (performance: skip render if off-screen)
    isVisible(cameraX, cameraY, viewportW, viewportH) {
        const margin = 32;
        return this.x + this.width > cameraX - margin &&
               this.x < cameraX + viewportW + margin &&
               this.baseY + this.height > cameraY - margin &&
               this.baseY < cameraY + viewportH + margin;
    }
}


// ============ World Item Spawn Data ============
// Define where items spawn across the world
// These are placed relative to island centers during world generation

const WorldItemSpawns = {
    // Spawn configs per island index
    // { itemId, offsetX, offsetY (tile offsets from island center), respawnTime (ms) }
    // Items pushed to island edges/beaches — encourage exploration away from town center
    
    island_0: [ // Port Clawson (main island) — items along coastline
        { itemId: 'driftwood', offsetX: -9, offsetY: 7, respawnTime: 180000 },
        { itemId: 'driftwood', offsetX: 10, offsetY: 5, respawnTime: 180000 },
        { itemId: 'sea_glass', offsetX: -8, offsetY: -6, respawnTime: 240000 },
        { itemId: 'sea_glass', offsetX: 7, offsetY: -8, respawnTime: 240000 },
        { itemId: 'sea_glass', offsetX: 11, offsetY: 2, respawnTime: 240000 },
        { itemId: 'coconut', offsetX: 6, offsetY: -9, respawnTime: 300000 },
        { itemId: 'sandy_bread', offsetX: -7, offsetY: 8, respawnTime: 300000 },
        { itemId: 'coral_fragment', offsetX: -10, offsetY: 3, respawnTime: 240000 },
        { itemId: 'kelp_wrap', offsetX: 8, offsetY: 9, respawnTime: 300000 },
        { itemId: 'torn_journal_page', offsetX: -6, offsetY: -9, respawnTime: 600000 },
    ],
    
    island_1: [ // Molthaven — scattered along shores
        { itemId: 'coral_fragment', offsetX: -7, offsetY: 6, respawnTime: 240000 },
        { itemId: 'ancient_shell', offsetX: 8, offsetY: -5, respawnTime: 360000 },
        { itemId: 'kelp_wrap', offsetX: -6, offsetY: -7, respawnTime: 300000 },
        { itemId: 'kelp_wrap', offsetX: 9, offsetY: 4, respawnTime: 300000 },
        { itemId: 'pearl', offsetX: 5, offsetY: 8, respawnTime: 480000 },
        { itemId: 'driftwood', offsetX: -9, offsetY: 2, respawnTime: 180000 },
        { itemId: 'coconut', offsetX: 7, offsetY: -7, respawnTime: 300000 },
    ],
    
    island_2: [ // Iron Reef — minerals near rocky edges
        { itemId: 'iron_nugget', offsetX: -6, offsetY: 7, respawnTime: 360000 },
        { itemId: 'iron_nugget', offsetX: -8, offsetY: -4, respawnTime: 360000 },
        { itemId: 'coral_fragment', offsetX: 7, offsetY: 6, respawnTime: 240000 },
        { itemId: 'ancient_shell', offsetX: -5, offsetY: -7, respawnTime: 360000 },
        { itemId: 'driftwood', offsetX: 9, offsetY: -2, respawnTime: 180000 },
        { itemId: 'glowing_scale', offsetX: -3, offsetY: 8, respawnTime: 600000 },
    ],
    
    island_3: [ // Deepcoil Isle — rare items on remote beaches
        { itemId: 'ancient_shell', offsetX: 6, offsetY: -6, respawnTime: 360000 },
        { itemId: 'moonstone', offsetX: -4, offsetY: 7, respawnTime: 900000 },
        { itemId: 'torn_journal_page', offsetX: -7, offsetY: 3, respawnTime: 600000 },
        { itemId: 'old_map_fragment', offsetX: 8, offsetY: -4, respawnTime: 900000 },
        { itemId: 'glowing_scale', offsetX: -5, offsetY: -7, respawnTime: 600000 },
        { itemId: 'pearl', offsetX: 7, offsetY: 5, respawnTime: 480000 },
    ],
    
    island_4: [ // Smaller island — edges are close
        { itemId: 'sea_glass', offsetX: 5, offsetY: 4, respawnTime: 240000 },
        { itemId: 'driftwood', offsetX: -5, offsetY: 5, respawnTime: 180000 },
        { itemId: 'coconut', offsetX: 3, offsetY: -5, respawnTime: 300000 },
        { itemId: 'coral_fragment', offsetX: 6, offsetY: -3, respawnTime: 240000 },
    ],
    
    island_5: [ // Whisper Reef area — hidden treasures on far shores
        { itemId: 'sea_glass', offsetX: -5, offsetY: 6, respawnTime: 240000 },
        { itemId: 'enchanted_pearl', offsetX: 6, offsetY: -5, respawnTime: 1200000 },
        { itemId: 'ancient_shell', offsetX: -7, offsetY: -3, respawnTime: 360000 },
        { itemId: 'golden_doubloon', offsetX: 4, offsetY: -7, respawnTime: 900000 },
    ],
    
    // Generic spawns for islands 6+ — beach items
    generic: [
        { itemId: 'driftwood', offsetX: -5, offsetY: 6, respawnTime: 180000 },
        { itemId: 'sea_glass', offsetX: 6, offsetY: -4, respawnTime: 240000 },
        { itemId: 'coral_fragment', offsetX: 7, offsetY: 3, respawnTime: 240000 },
    ]
};


// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorldItem, WorldItemSpawns };
}
