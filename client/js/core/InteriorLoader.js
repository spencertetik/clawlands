// InteriorLoader.js - Loads and manages interior/furniture sprite assets
// Updated 2026-02-05 with clean extracted sprites

class InteriorLoader {
    constructor() {
        this.sprites = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Interior furniture definitions
    static FURNITURE = {
        // === TABLES ===
        table: {
            path: 'assets/sprites/interior/table_wooden.png',
            width: 28, height: 24,
            collision: { width: 24, height: 12, offsetY: 12 }
        },
        table_long: {
            path: 'assets/sprites/interior/table_long.png',
            width: 32, height: 27,
            collision: { width: 28, height: 14, offsetY: 13 }
        },
        table_round: {
            path: 'assets/sprites/interior/table_round.png',
            width: 28, height: 24,
            collision: { width: 24, height: 12, offsetY: 12 }
        },
        
        // === SEATING ===
        chair: {
            path: 'assets/sprites/interior/chair_1.png',
            width: 19, height: 28,
            collision: { width: 14, height: 10, offsetY: 18 }
        },
        chair2: {
            path: 'assets/sprites/interior/chair_2.png',
            width: 18, height: 28,
            collision: { width: 14, height: 10, offsetY: 18 }
        },
        couch: {
            path: 'assets/sprites/interior/couch.png',
            width: 32, height: 24,
            collision: { width: 28, height: 14, offsetY: 10 }
        },
        bench: {
            path: 'assets/sprites/interior/bench_wooden.png',
            width: 27, height: 28,
            collision: { width: 24, height: 10, offsetY: 18 }
        },
        bench_ornate: {
            path: 'assets/sprites/interior/bench_ornate.png',
            width: 26, height: 28,
            collision: { width: 22, height: 10, offsetY: 18 }
        },
        stool: {
            path: 'assets/sprites/interior/stool.png',
            width: 32, height: 26,
            collision: { width: 12, height: 8, offsetY: 18 }
        },
        
        // === BEDS ===
        bed: {
            path: 'assets/sprites/interior/bed.png',
            width: 20, height: 32,
            collision: { width: 18, height: 24, offsetY: 8 }
        },
        
        // === STORAGE ===
        cabinet: {
            path: 'assets/sprites/interior/cabinet_bottles.png',
            width: 32, height: 30,
            collision: { width: 28, height: 16, offsetY: 14 }
        },
        dresser: {
            path: 'assets/sprites/interior/dresser.png',
            width: 28, height: 19,
            collision: { width: 24, height: 12, offsetY: 7 }
        },
        bookshelf: {
            path: 'assets/sprites/interior/bookshelf_tall.png',
            width: 23, height: 32,
            collision: { width: 20, height: 14, offsetY: 18 }
        },
        bookshelf_potions: {
            path: 'assets/sprites/interior/bookshelf_potions.png',
            width: 20, height: 32,
            collision: { width: 18, height: 14, offsetY: 18 }
        },
        shelf: {
            path: 'assets/sprites/interior/shelf_books.png',
            width: 21, height: 24,
            collision: { width: 18, height: 12, offsetY: 12 }
        },
        shelf_plant: {
            path: 'assets/sprites/interior/shelf_plant.png',
            width: 25, height: 32,
            collision: { width: 22, height: 14, offsetY: 18 }
        },
        shelf_potions: {
            path: 'assets/sprites/interior/shelf_potions.png',
            width: 17, height: 28,
            collision: { width: 14, height: 12, offsetY: 16 }
        },
        counter: {
            path: 'assets/sprites/interior/counter.png',
            width: 17, height: 28,
            collision: { width: 14, height: 14, offsetY: 14 }
        },
        
        // === CONTAINERS ===
        barrel: {
            path: 'assets/sprites/interior/barrel.png',
            width: 22, height: 28,
            collision: { width: 18, height: 14, offsetY: 14 }
        },
        barrel_small: {
            path: 'assets/sprites/interior/barrel_small.png',
            width: 21, height: 24,
            collision: { width: 16, height: 12, offsetY: 12 }
        },
        barrel_large: {
            path: 'assets/sprites/interior/barrel_large.png',
            width: 22, height: 28,
            collision: { width: 18, height: 14, offsetY: 14 }
        },
        jug: {
            path: 'assets/sprites/interior/jug.png',
            width: 20, height: 28,
            collision: null
        },
        
        // === PLANTS ===
        plant: {
            path: 'assets/sprites/interior/plant_flower.png',
            width: 15, height: 28,
            collision: null
        },
        plant_bush: {
            path: 'assets/sprites/interior/plant_bush_1.png',
            width: 20, height: 28,
            collision: null
        },
        plant_bush2: {
            path: 'assets/sprites/interior/plant_bush_2.png',
            width: 21, height: 28,
            collision: null
        },
        plant_bush3: {
            path: 'assets/sprites/interior/plant_bush_3.png',
            width: 20, height: 28,
            collision: null
        },
        
        // === DECOR ===
        rug: {
            path: 'assets/sprites/interior/rug.png',
            width: 32, height: 48,
            collision: null,
            ground: true
        }
    };

    // Floor tile definitions
    static FLOORS = {
        wood: {
            path: 'assets/sprites/interior/wood_floor.png',
            width: 16, height: 16
        },
        stone: {
            path: 'assets/sprites/interior/stone_floor.png',
            width: 16, height: 16
        }
    };

    // Get random furniture of a category
    static getRandomType(category) {
        const categories = {
            table: ['table', 'table_long', 'table_round'],
            chair: ['chair', 'chair2'],
            seating: ['couch', 'bench', 'bench_ornate', 'stool'],
            storage: ['cabinet', 'dresser', 'bookshelf', 'bookshelf_potions', 'shelf', 'shelf_plant'],
            container: ['barrel', 'barrel_small', 'barrel_large', 'jug'],
            plant: ['plant', 'plant_bush', 'plant_bush2', 'plant_bush3']
        };
        
        const types = categories[category];
        if (!types) return category;
        return types[Math.floor(Math.random() * types.length)];
    }

    // Load all interior sprites
    async load() {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve) => {
            const allItems = { ...InteriorLoader.FURNITURE, ...InteriorLoader.FLOORS };
            const itemTypes = Object.keys(allItems);
            let loadedCount = 0;

            for (const type of itemTypes) {
                const def = allItems[type];
                const img = new Image();
                
                img.onload = () => {
                    this.sprites[type] = img;
                    loadedCount++;
                    
                    if (loadedCount === itemTypes.length) {
                        this.loaded = true;
                        console.log(`🪑 Loaded ${loadedCount} interior sprites`);
                        resolve();
                    }
                };
                
                img.onerror = () => {
                    console.warn(`Failed to load interior: ${type} (${def.path})`);
                    loadedCount++;
                    
                    if (loadedCount === itemTypes.length) {
                        this.loaded = true;
                        resolve();
                    }
                };
                
                img.src = `${def.path}?v=${Date.now()}`;
            }
        });

        return this.loadPromise;
    }

    // Get sprite for a furniture type
    getSprite(type) {
        return this.sprites[type] || null;
    }

    // Get definition for a furniture type
    getDefinition(type) {
        return InteriorLoader.FURNITURE[type] || InteriorLoader.FLOORS[type] || null;
    }

    // Create a furniture object
    createFurniture(type, x, y) {
        const def = this.getDefinition(type);
        if (!def) {
            return {
                x, y,
                type,
                width: 16,
                height: 16,
                useSprite: false
            };
        }

        // Apply interior scaling to collision boxes to match visual scaling
        const interiorScale = def.ground ? 0.6 : 0.5; // Same as visual scaling
        let scaledCollision = null;
        if (def.collision) {
            scaledCollision = {
                width: Math.round(def.collision.width * interiorScale),
                height: Math.round(def.collision.height * interiorScale),
                offsetY: Math.round((def.collision.offsetY || 0) * interiorScale)
            };
        }

        return {
            x, y,
            type,
            width: def.width,
            height: def.height,
            collision: scaledCollision,
            ground: def.ground || false,
            useSprite: true
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.InteriorLoader = InteriorLoader;
}
