// DecorationLoader.js - Loads and manages decoration sprite assets
// Updated 2026-02-05 with clean extracted sprites

class DecorationLoader {
    constructor() {
        this.sprites = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Decoration definitions with their sprite paths and sizes
    // Sprites extracted from cleaned sheets
    static DECORATIONS = {
        // === PALM TREES ===
        palm: {
            path: 'assets/sprites/decorations/palm_tree_1.png',
            width: 37, height: 48,
            collision: { width: 10, height: 10, offsetY: 38 }
        },
        palm2: {
            path: 'assets/sprites/decorations/palm_tree_2.png',
            width: 33, height: 48,
            collision: { width: 10, height: 10, offsetY: 38 }
        },
        
        // === BUSHES & PLANTS ===
        bush: {
            path: 'assets/sprites/decorations/plant_2.png',
            width: 24, height: 23,
            collision: { width: 6, height: 4, offsetY: 11 }
        },
        bush_flower: {
            path: 'assets/sprites/decorations/plant_11.png',
            width: 24, height: 24,
            collision: { width: 6, height: 4, offsetY: 12 }
        },
        bush_flower2: {
            path: 'assets/sprites/decorations/plant_12.png',
            width: 24, height: 21,
            collision: { width: 6, height: 4, offsetY: 10 }
        },
        fern: {
            path: 'assets/sprites/decorations/plant_4.png',
            width: 24, height: 19,
            collision: null
        },
        fern2: {
            path: 'assets/sprites/decorations/plant_7.png',
            width: 24, height: 22,
            collision: null
        },
        seagrass: {
            path: 'assets/sprites/decorations/plant_16.png',
            width: 15, height: 24,
            collision: null
        },
        seagrass_tall: {
            path: 'assets/sprites/decorations/plant_18.png',
            width: 24, height: 23,
            collision: null
        },
        tropical_plant: {
            path: 'assets/sprites/decorations/plant_6.png',
            width: 24, height: 23,
            collision: null
        },
        flower_stem: {
            path: 'assets/sprites/decorations/plant_15.png',
            width: 14, height: 24,
            collision: null
        },
        small_plant: {
            path: 'assets/sprites/decorations/plant_17.png',
            width: 9, height: 24,
            collision: null
        },
        tree_bush: {
            path: 'assets/sprites/decorations/plant_6.png',
            width: 24, height: 23,
            collision: { width: 6, height: 4, offsetY: 13 }
        },
        
        // === SHELLS ===
        shell_pink: {
            path: 'assets/sprites/decorations/beach_1.png',
            width: 20, height: 17,
            collision: null
        },
        shell_fan: {
            path: 'assets/sprites/decorations/beach_6.png',
            width: 20, height: 17,
            collision: null
        },
        shell_spiral: {
            path: 'assets/sprites/decorations/beach_32.png',
            width: 14, height: 20,
            collision: null
        },
        shell_white: {
            path: 'assets/sprites/decorations/beach_17.png',
            width: 20, height: 15,
            collision: null
        },
        shell_striped: {
            path: 'assets/sprites/decorations/beach_24.png',
            width: 20, height: 17,
            collision: null
        },
        
        // === ROCKS ===
        rock: {
            path: 'assets/sprites/decorations/beach_10.png',
            width: 20, height: 20,
            collision: { width: 16, height: 10, offsetY: 10 }
        },
        rock2: {
            path: 'assets/sprites/decorations/beach_12.png',
            width: 20, height: 20,
            collision: { width: 16, height: 10, offsetY: 10 }
        },
        rock_small: {
            path: 'assets/sprites/decorations/beach_19.png',
            width: 20, height: 13,
            collision: null  // Small rocks are walkable — only large rocks block
        },
        
        // === STARFISH ===
        starfish: {
            path: 'assets/sprites/decorations/beach_43.png',
            width: 17, height: 20,
            collision: null
        },
        starfish2: {
            path: 'assets/sprites/decorations/beach_45.png',
            width: 17, height: 20,
            collision: null
        },
        starfish3: {
            path: 'assets/sprites/decorations/beach_46.png',
            width: 17, height: 20,
            collision: null
        },
        
        // === CORAL ===
        coral: {
            path: 'assets/sprites/decorations/beach_50.png',
            width: 20, height: 18,
            collision: null
        },
        coral2: {
            path: 'assets/sprites/decorations/beach_51.png',
            width: 20, height: 19,
            collision: null
        },
        coral3: {
            path: 'assets/sprites/decorations/beach_52.png',
            width: 20, height: 18,
            collision: null
        },
        
        // === DRIFTWOOD ===
        driftwood: {
            path: 'assets/sprites/decorations/beach_33.png',
            width: 20, height: 16,
            collision: null
        },
        driftwood2: {
            path: 'assets/sprites/decorations/beach_40.png',
            width: 20, height: 16,
            collision: null
        },
        
        // === OCEAN DECOR (larger items) ===
        treasure_chest: {
            path: 'assets/sprites/decorations/decor_1.png',
            width: 27, height: 28,
            collision: { width: 22, height: 14, offsetY: 2 }
        },
        treasure_chest2: {
            path: 'assets/sprites/decorations/decor_2.png',
            width: 28, height: 28,
            collision: { width: 22, height: 14, offsetY: 2 }
        },
        lobster_statue: {
            path: 'assets/sprites/decorations/decor_4.png',
            width: 17, height: 28,
            collision: { width: 14, height: 12, offsetY: 16 }
        },
        wooden_sign: {
            path: 'assets/sprites/decorations/decor_5.png',
            width: 28, height: 28,
            collision: { width: 12, height: 8, offsetY: 20 }
        },
        anchor: {
            path: 'assets/sprites/decorations/decor_8.png',
            width: 21, height: 28,
            collision: { width: 16, height: 12, offsetY: 16 }
        },
        campfire: {
            path: 'assets/sprites/decorations/decor_11.png',
            width: 16, height: 22,
            collision: { width: 14, height: 10, offsetY: 12 }
        },
        fishing_net: {
            path: 'assets/sprites/decorations/decor_12.png',
            width: 28, height: 23,
            collision: null
        },
        fishing_net2: {
            path: 'assets/sprites/decorations/decor_16.png',
            width: 26, height: 28,
            collision: null
        },
        message_bottle: {
            path: 'assets/sprites/decorations/message_bottle.png',
            width: 12, height: 16,
            collision: null
        },
        // potion_bottle removed — decor_7.png is a mismatched sprite (dress, not potion)
        scroll: {
            path: 'assets/sprites/decorations/decor_19.png',
            width: 20, height: 28,
            collision: null
        },
        buoy: {
            path: 'assets/sprites/decorations/decor_24.png',
            width: 23, height: 28,
            collision: { width: 18, height: 12, offsetY: 16 }
        },
        log_pile: {
            path: 'assets/sprites/decorations/decor_17.png',
            width: 28, height: 26,
            collision: { width: 24, height: 14, offsetY: 12 }
        },
        
        // === GROUND / PATH ===
        dirt_path: {
            path: 'assets/sprites/decorations/dirt_path.png',
            width: 16, height: 16,
            collision: null,
            ground: true
        },
        cobblestone_path: {
            path: 'assets/sprites/decorations/cobblestone_path.png',
            width: 16, height: 16,
            collision: null,
            ground: true
        },
        // brick_path removed — only dirt_path and cobblestone_path in use
        
        // Ground decorations (rendered below entities)
        flower: {
            path: 'assets/sprites/decorations/plant_5.png',
            width: 24, height: 24,
            collision: null,
            ground: true
        },
        grass: {
            path: 'assets/sprites/decorations/plant_14.png',
            width: 24, height: 20,
            collision: null,
            ground: true
        },
        
        // === BRIDGES ===
        bridge_wood_v: {
            path: 'assets/sprites/decorations/bridge_wood_v.png',
            width: 16, height: 32,
            collision: null,
            ground: true,
            bridge: true
        },
        bridge_wood_h: {
            path: 'assets/sprites/decorations/bridge_wood_h.png',
            width: 32, height: 16,
            collision: null,
            ground: true,
            bridge: true
        }
    };

    // Get random decoration of a category
    static getRandomType(category) {
        const categories = {
            palm: ['palm', 'palm2'],
            bush: ['bush', 'bush_flower', 'bush_flower2', 'fern', 'fern2', 'tropical_plant'],
            plant: ['seagrass', 'seagrass_tall', 'flower_stem', 'small_plant'],
            shell: ['shell_pink', 'shell_fan', 'shell_spiral', 'shell_white', 'shell_striped'],
            rock: ['rock', 'rock2', 'rock_small'],
            starfish: ['starfish', 'starfish2', 'starfish3'],
            coral: ['coral', 'coral2', 'coral3'],
            wood: ['driftwood', 'driftwood2'],
            rare: ['treasure_chest', 'lobster_statue', 'anchor', 'campfire', 'wooden_sign']
        };
        
        const types = categories[category];
        if (!types) return category; // Return as-is if not a category
        return types[Math.floor(Math.random() * types.length)];
    }

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
                    console.warn(`Failed to load decoration: ${type} (${def.path})`);
                    loadedCount++;
                    
                    if (loadedCount === decorTypes.length) {
                        this.loaded = true;
                        resolve();
                    }
                };
                
                img.src = `${def.path}?v=${Date.now()}`;
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
                width: 16,
                height: 16,
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
