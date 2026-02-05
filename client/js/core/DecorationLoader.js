// DecorationLoader.js - Loads and manages decoration sprite assets

class DecorationLoader {
    constructor() {
        this.sprites = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Decoration definitions with their sprite paths and sizes
    static DECORATIONS = {
        palm: {
            path: 'assets/sprites/decorations/palm_tree.png',
            width: 24,
            height: 48,
            collision: { width: 8, height: 8, offsetY: 40 } // Small collision at base
        },
        bush: {
            path: 'assets/sprites/decorations/bush_green.png',
            width: 16,
            height: 14,
            collision: null // No collision for small bushes
        },
        bush_flower: {
            path: 'assets/sprites/decorations/bush_flower.png',
            width: 18,
            height: 15,
            collision: null
        },
        seagrass: {
            path: 'assets/sprites/decorations/seagrass.png',
            width: 20,
            height: 16,
            collision: null
        },
        fern: {
            path: 'assets/sprites/decorations/fern.png',
            width: 18,
            height: 16,
            collision: null
        },
        shell_pink: {
            path: 'assets/sprites/decorations/shell_pink.png',
            width: 11,
            height: 10,
            collision: null
        },
        shell_spiral: {
            path: 'assets/sprites/decorations/shell_spiral.png',
            width: 10,
            height: 10,
            collision: null
        },
        rock: {
            path: 'assets/sprites/decorations/rock_gray.png',
            width: 13,
            height: 10,
            collision: { width: 10, height: 6, offsetY: 4 }
        },
        starfish: {
            path: 'assets/sprites/decorations/starfish.png',
            width: 10,
            height: 10,
            collision: null
        },
        coral: {
            path: 'assets/sprites/decorations/coral.png',
            width: 10,
            height: 10,
            collision: null
        },
        driftwood: {
            path: 'assets/sprites/decorations/driftwood.png',
            width: 12,
            height: 6,
            collision: null
        },
        treasure_chest: {
            path: 'assets/sprites/decorations/treasure_chest.png',
            width: 18,
            height: 14,
            collision: { width: 14, height: 8, offsetY: 6 }
        },
        lobster_statue: {
            path: 'assets/sprites/decorations/lobster_statue.png',
            width: 20,
            height: 20,
            collision: { width: 16, height: 12, offsetY: 8 }
        },
        wooden_sign: {
            path: 'assets/sprites/decorations/wooden_sign.png',
            width: 16,
            height: 14,
            collision: { width: 8, height: 4, offsetY: 10 }
        },
        anchor: {
            path: 'assets/sprites/decorations/anchor.png',
            width: 10,
            height: 16,
            collision: { width: 8, height: 6, offsetY: 10 }
        },
        campfire: {
            path: 'assets/sprites/decorations/campfire.png',
            width: 13,
            height: 15,
            collision: { width: 10, height: 8, offsetY: 7 }
        },
        fishing_net: {
            path: 'assets/sprites/decorations/fishing_net.png',
            width: 20,
            height: 18,
            collision: null
        },
        message_bottle: {
            path: 'assets/sprites/decorations/message_bottle.png',
            width: 11,
            height: 16,
            collision: null
        },
        // Ground decorations (rendered below entities)
        flower: {
            path: 'assets/sprites/decorations/bush_flower.png',
            width: 8,
            height: 8,
            collision: null,
            ground: true
        },
        grass: {
            path: 'assets/sprites/decorations/seagrass.png',
            width: 10,
            height: 12,
            collision: null,
            ground: true
        },
        // Path tile (ground layer, no collision)
        dirt_path: {
            path: 'assets/sprites/decorations/dirt_path.png',
            width: 16,
            height: 16,
            collision: null,
            ground: true
        }
    };

    // Load all decoration sprites
    async load() {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve) => {
            const decorTypes = Object.keys(DecorationLoader.DECORATIONS);
            let loadedCount = 0;

            for (const type of decorTypes) {
                const def = DecorationLoader.DECORATIONS[type];
                const img = new Image();
                
                img.onload = () => {
                    this.sprites[type] = img;
                    loadedCount++;
                    
                    if (loadedCount === decorTypes.length) {
                        this.loaded = true;
                        console.log(`🌴 Loaded ${loadedCount} decoration sprites`);
                        resolve();
                    }
                };
                
                img.onerror = () => {
                    console.warn(`Failed to load decoration: ${type}`);
                    loadedCount++;
                    
                    if (loadedCount === decorTypes.length) {
                        this.loaded = true;
                        resolve();
                    }
                };
                
                img.src = def.path;
            }
        });

        return this.loadPromise;
    }

    // Get sprite for a decoration type
    getSprite(type) {
        return this.sprites[type] || null;
    }

    // Get definition for a decoration type
    getDefinition(type) {
        return DecorationLoader.DECORATIONS[type] || null;
    }

    // Create a decoration object with proper sizing
    createDecoration(type, x, y) {
        const def = this.getDefinition(type);
        if (!def) {
            // Fallback to old style
            return {
                x, y,
                type,
                width: 10,
                height: 10,
                color: '#808080',
                useSprite: false
            };
        }

        return {
            x, y,
            type,
            width: def.width,
            height: def.height,
            collision: def.collision,
            ground: def.ground || false,
            useSprite: true
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DecorationLoader = DecorationLoader;
}
