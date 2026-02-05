// InteriorLoader.js - Loads and manages interior furniture sprite assets

class InteriorLoader {
    constructor() {
        this.sprites = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Furniture definitions with their sprite paths and sizes
    static FURNITURE = {
        table: {
            path: 'assets/sprites/interior/table.png',
            width: 14,
            height: 11,
            collision: true
        },
        chair: {
            path: 'assets/sprites/interior/chair.png',
            width: 9,
            height: 11,
            collision: false
        },
        bed: {
            path: 'assets/sprites/interior/bed.png',
            width: 18,
            height: 16,
            collision: true
        },
        barrel: {
            path: 'assets/sprites/interior/barrel.png',
            width: 10,
            height: 11,
            collision: true
        },
        bookshelf: {
            path: 'assets/sprites/interior/bookshelf.png',
            width: 15,
            height: 17,
            collision: true
        },
        cabinet: {
            path: 'assets/sprites/interior/cabinet.png',
            width: 15,
            height: 17,
            collision: true
        },
        plant_pot: {
            path: 'assets/sprites/interior/plant_pot.png',
            width: 11,
            height: 13,
            collision: false
        },
        wood_floor: {
            path: 'assets/sprites/interior/wood_floor.png',
            width: 16,
            height: 16,
            collision: false,
            isTile: true
        },
        stone_wall: {
            path: 'assets/sprites/interior/stone_wall.png',
            width: 16,
            height: 16,
            collision: true,
            isTile: true
        },
        rug: {
            path: 'assets/sprites/interior/rug.png',
            width: 20,
            height: 20,
            collision: false
        }
    };

    // Load all interior sprites
    async load() {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve) => {
            const furnitureTypes = Object.keys(InteriorLoader.FURNITURE);
            let loadedCount = 0;

            for (const type of furnitureTypes) {
                const def = InteriorLoader.FURNITURE[type];
                const img = new Image();
                
                img.onload = () => {
                    this.sprites[type] = img;
                    loadedCount++;
                    
                    if (loadedCount === furnitureTypes.length) {
                        this.loaded = true;
                        console.log(`🪑 Loaded ${loadedCount} interior sprites`);
                        resolve();
                    }
                };
                
                img.onerror = () => {
                    console.warn(`Failed to load interior: ${type}`);
                    loadedCount++;
                    
                    if (loadedCount === furnitureTypes.length) {
                        this.loaded = true;
                        resolve();
                    }
                };
                
                img.src = def.path;
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
        return InteriorLoader.FURNITURE[type] || null;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.InteriorLoader = InteriorLoader;
}
