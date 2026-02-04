// Asset loader for sprites and tilesets
class AssetLoader {
    constructor() {
        this.images = new Map();
        this.loadQueue = [];
        this.loadedCount = 0;
        this.totalCount = 0;
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
    }

    // Add an image to the load queue
    loadImage(key, path) {
        this.loadQueue.push({ key, path, optional: false });
        this.totalCount++;
        return this;
    }

    // Add an optional image (missing file won't fail the load)
    loadImageOptional(key, path) {
        this.loadQueue.push({ key, path, optional: true });
        this.totalCount++;
        return this;
    }

    // Set progress callback
    onProgress(callback) {
        this.onProgressCallback = callback;
        return this;
    }

    // Set complete callback
    onComplete(callback) {
        this.onCompleteCallback = callback;
        return this;
    }

    // Start loading all queued assets
    async load() {
        if (this.loadQueue.length === 0) {
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            return;
        }

        const promises = this.loadQueue.map(item => this.loadSingleImage(item));

        try {
            await Promise.all(promises);
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
        } catch (error) {
            console.error('Failed to load assets:', error);
        }
    }

    // Load a single image
    loadSingleImage({ key, path, optional }) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.images.set(key, img);
                this.loadedCount++;

                if (this.onProgressCallback) {
                    this.onProgressCallback(this.loadedCount, this.totalCount);
                }

                resolve(img);
            };

            img.onerror = () => {
                if (optional) {
                    console.warn(`Optional image not found: ${path}`);
                    this.loadedCount++;
                    if (this.onProgressCallback) {
                        this.onProgressCallback(this.loadedCount, this.totalCount);
                    }
                    resolve(null);
                    return;
                }

                console.error(`Failed to load image: ${path}`);
                reject(new Error(`Failed to load: ${path}`));
            };

            const cacheBust = `?v=${Date.now()}`;
            img.src = `${path}${cacheBust}`;
        });
    }

    // Get a loaded image
    getImage(key) {
        return this.images.get(key);
    }

    // Check if an image is loaded
    hasImage(key) {
        return this.images.has(key);
    }

    // Store a generated image (e.g. combined sheet)
    setImage(key, image) {
        this.images.set(key, image);
    }

    // Get loading progress (0-1)
    getProgress() {
        return this.totalCount > 0 ? this.loadedCount / this.totalCount : 0;
    }

    // Create a test character sprite (placeholder until PixelLab is available)
    createTestCharacterSprite() {
        const canvas = document.createElement('canvas');
        const frameWidth = CONSTANTS.CHARACTER_WIDTH;
        const frameHeight = CONSTANTS.CHARACTER_HEIGHT;

        canvas.width = frameWidth * 4; // 4 directions
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d');

        // Disable smoothing for pixel-perfect
        ctx.imageSmoothingEnabled = false;

        // Draw 4 simple lobster-character sprites (down, up, left, right)
        const directions = ['down', 'up', 'left', 'right'];

        for (let i = 0; i < 4; i++) {
            const x = i * frameWidth;

            // Body (red-orange lobster color)
            ctx.fillStyle = '#ff4520';
            ctx.fillRect(x + 6, 12, 12, 14);

            // Head
            ctx.fillStyle = '#ff6040';
            ctx.fillRect(x + 7, 8, 10, 8);

            // Lobster claws (darker red)
            ctx.fillStyle = '#d02010';
            // Left claw
            ctx.fillRect(x + 2, 16, 4, 4);
            // Right claw
            ctx.fillRect(x + 18, 16, 4, 4);

            // Tail/shell on back (darker)
            ctx.fillStyle = '#c03020';
            ctx.fillRect(x + 8, 14, 8, 6);

            // Eyes (black dots)
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 9, 10, 2, 2);
            ctx.fillRect(x + 13, 10, 2, 2);

            // Direction indicator
            ctx.fillStyle = '#fff';
            switch(i) {
                case 0: // down
                    ctx.fillRect(x + 11, 26, 2, 3);
                    break;
                case 1: // up
                    ctx.fillRect(x + 11, 5, 2, 3);
                    break;
                case 2: // left
                    ctx.fillRect(x + 3, 16, 3, 2);
                    break;
                case 3: // right
                    ctx.fillRect(x + 18, 16, 3, 2);
                    break;
            }
        }

        this.images.set('character_placeholder', canvas);
        return canvas;
    }

    // Create a test tileset (placeholder until PixelLab is available)
    createTestTileset() {
        const tileSize = CONSTANTS.TILE_SIZE;
        const columns = 8;
        const rows = 4;

        const canvas = document.createElement('canvas');
        canvas.width = columns * tileSize;
        canvas.height = rows * tileSize;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false;

        // Create Pokémon-style tiles based on reference colors
        const tileTypes = [
            { name: 'grass', colors: ['#30B048', '#48D060', '#78F098'] },
            { name: 'sand', colors: ['#D0B078', '#E8C890', '#F0D8A8'] },
            { name: 'water', colors: ['#1850A0', '#50A0F0', '#78D8FF'] },
            { name: 'dark_grass', colors: ['#189030', '#30B048', '#48D060'] },
            { name: 'light_sand', colors: ['#E8C890', '#F0D8A8', '#FFF8E0'] },
            { name: 'deep_water', colors: ['#0040A0', '#1850A0', '#2870C8'] },
            { name: 'dirt', colors: ['#8b6f47', '#a0855c', '#b59a70'] },
            { name: 'stone', colors: ['#606060', '#808080', '#a0a0a0'] }
        ];

        let tileIndex = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                const x = col * tileSize;
                const y = row * tileSize;
                const type = tileTypes[tileIndex % tileTypes.length];

                // Fill base color
                ctx.fillStyle = type.colors[1];
                ctx.fillRect(x, y, tileSize, tileSize);

                // Add shading detail
                ctx.fillStyle = type.colors[0];
                ctx.fillRect(x, y + tileSize - 2, tileSize, 2);

                ctx.fillStyle = type.colors[2];
                ctx.fillRect(x, y, tileSize, 2);

                // Add texture dots
                ctx.fillStyle = type.colors[0];
                for (let i = 0; i < 4; i++) {
                    const px = x + (i * 4) + 2;
                    const py = y + (i % 2) * 8 + 4;
                    ctx.fillRect(px, py, 1, 1);
                }

                tileIndex++;
            }
        }

        this.images.set('tileset_placeholder', canvas);
        return canvas;
    }

    // Create a simple beach decoration tileset (shells, rocks, seaweed, etc)
    createBeachDecorTileset() {
        const tileSize = CONSTANTS.TILE_SIZE;
        const columns = 4;
        const rows = 4;

        const canvas = document.createElement('canvas');
        canvas.width = columns * tileSize;
        canvas.height = rows * tileSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const drawAt = (index, drawFn) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = col * tileSize;
            const y = row * tileSize;
            drawFn(x, y);
        };

        const pixel = (x, y, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        };

        const rect = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        };

        // Tile 0: Empty (transparent)

        // Tile 1: Small shell
        drawAt(1, (x, y) => {
            rect(x + 6, y + 9, 4, 2, '#f2e2d5');
            rect(x + 5, y + 10, 6, 2, '#e6c9b3');
            rect(x + 7, y + 8, 2, 1, '#ffffff');
        });

        // Tile 2: Large shell
        drawAt(2, (x, y) => {
            rect(x + 4, y + 8, 8, 3, '#f5e6da');
            rect(x + 3, y + 10, 10, 2, '#e3c5ad');
            rect(x + 6, y + 7, 4, 1, '#ffffff');
        });

        // Tile 3: Starfish
        drawAt(3, (x, y) => {
            rect(x + 7, y + 7, 2, 6, '#f08a4b');
            rect(x + 5, y + 9, 6, 2, '#f08a4b');
            pixel(x + 6, y + 8, '#f7b27a');
            pixel(x + 8, y + 8, '#f7b27a');
        });

        // Tile 4: Pebble cluster
        drawAt(4, (x, y) => {
            rect(x + 5, y + 9, 3, 2, '#8f8f8f');
            rect(x + 9, y + 10, 2, 2, '#7a7a7a');
            rect(x + 7, y + 11, 2, 2, '#a0a0a0');
        });

        // Tile 5: Driftwood
        drawAt(5, (x, y) => {
            rect(x + 4, y + 10, 8, 2, '#b07a4a');
            rect(x + 10, y + 9, 2, 2, '#8b5a32');
            rect(x + 4, y + 9, 2, 2, '#8b5a32');
        });

        // Tile 6: Seaweed
        drawAt(6, (x, y) => {
            rect(x + 7, y + 7, 2, 6, '#2fa84f');
            pixel(x + 6, y + 8, '#2fa84f');
            pixel(x + 8, y + 9, '#2fa84f');
            pixel(x + 6, y + 10, '#2fa84f');
        });

        // Tile 7: Dune grass
        drawAt(7, (x, y) => {
            rect(x + 6, y + 10, 1, 4, '#6bbf4a');
            rect(x + 8, y + 9, 1, 5, '#5aa83c');
            rect(x + 10, y + 10, 1, 4, '#6bbf4a');
        });

        // Tile 8: Coral
        drawAt(8, (x, y) => {
            rect(x + 7, y + 8, 2, 5, '#d94b4b');
            rect(x + 5, y + 9, 2, 2, '#d94b4b');
            rect(x + 9, y + 10, 2, 2, '#d94b4b');
            pixel(x + 6, y + 8, '#f06b6b');
            pixel(x + 9, y + 9, '#f06b6b');
        });

        // Tile 9: Small rock
        drawAt(9, (x, y) => {
            rect(x + 6, y + 10, 4, 2, '#707070');
            rect(x + 7, y + 9, 2, 1, '#8a8a8a');
        });

        // Tile 10: Double shell
        drawAt(10, (x, y) => {
            rect(x + 5, y + 9, 3, 2, '#f2e2d5');
            rect(x + 9, y + 10, 3, 2, '#e6c9b3');
            pixel(x + 6, y + 8, '#ffffff');
            pixel(x + 10, y + 9, '#ffffff');
        });

        // Tile 11: Tiny crab
        drawAt(11, (x, y) => {
            rect(x + 7, y + 10, 2, 2, '#d24a3a');
            rect(x + 5, y + 10, 2, 1, '#d24a3a');
            rect(x + 9, y + 10, 2, 1, '#d24a3a');
            pixel(x + 7, y + 9, '#1a1a1a');
            pixel(x + 8, y + 9, '#1a1a1a');
        });

        // Tiles 12-15: leave empty for now

        this.images.set('tileset_beach_decor', canvas);
        return canvas;
    }

    // Create a simple interior tileset (floor, wall, door, furniture)
    createInteriorTileset() {
        const tileSize = CONSTANTS.TILE_SIZE;
        const columns = 4;
        const rows = 4;

        const canvas = document.createElement('canvas');
        canvas.width = columns * tileSize;
        canvas.height = rows * tileSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const drawAt = (index, drawFn) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = col * tileSize;
            const y = row * tileSize;
            drawFn(x, y);
        };

        const rect = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        };

        // Tile 0: Wooden floor
        drawAt(0, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x, y + 12, tileSize, 2, '#b78b57');
            rect(x, y + 6, tileSize, 1, '#d5b07a');
        });

        // Tile 1: Wall
        drawAt(1, (x, y) => {
            rect(x, y, tileSize, tileSize, '#6c6c74');
            rect(x, y, tileSize, 3, '#7f7f88');
            rect(x, y + 12, tileSize, 2, '#5b5b62');
        });

        // Tile 2: Door
        drawAt(2, (x, y) => {
            rect(x, y, tileSize, tileSize, '#6c6c74');
            rect(x + 4, y + 4, 8, 10, '#8b5a2b');
            rect(x + 5, y + 5, 6, 8, '#a06a35');
            rect(x + 9, y + 9, 1, 1, '#f5d47a');
        });

        // Tile 3: Counter
        drawAt(3, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x + 2, y + 8, 12, 6, '#7a4b2a');
            rect(x + 3, y + 9, 10, 4, '#8b5a32');
        });

        // Tile 4: Bed
        drawAt(4, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x + 2, y + 6, 12, 8, '#d94b4b');
            rect(x + 3, y + 7, 10, 6, '#e26a6a');
            rect(x + 3, y + 5, 6, 2, '#f2f2f2');
        });

        // Tile 5: Rug
        drawAt(5, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x + 3, y + 4, 10, 8, '#3b82f6');
            rect(x + 4, y + 5, 8, 6, '#60a5fa');
        });

        // Tile 6: Plant
        drawAt(6, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x + 6, y + 10, 4, 4, '#7c4a2d');
            rect(x + 7, y + 7, 2, 4, '#2faa4a');
            rect(x + 6, y + 6, 4, 2, '#35c760');
        });

        // Tile 7: Table
        drawAt(7, (x, y) => {
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x + 4, y + 8, 8, 4, '#8b5a32');
            rect(x + 5, y + 12, 6, 2, '#704021');
        });

        // Tile 8: Exit doormat (reddish-brown mat on floor - matches outside)
        drawAt(8, (x, y) => {
            // Floor background
            rect(x, y, tileSize, tileSize, '#c9a26b');
            rect(x, y + 12, tileSize, 2, '#b78b57');
            // Mat - reddish brown to match exterior mats
            rect(x + 1, y + 3, 14, 10, '#4a3728'); // Dark border
            rect(x + 2, y + 4, 12, 8, '#8b4513');  // Saddle brown main
            rect(x + 3, y + 6, 10, 1, '#a0522d');  // Light stripe
            rect(x + 3, y + 9, 10, 1, '#a0522d');  // Light stripe
        });

        this.images.set('tileset_interior', canvas);
        return canvas;
    }

    // Create simple building sprites for exterior placeholders
    createBuildingSprites() {
        const tileSize = CONSTANTS.TILE_SIZE;

        const createSprite = (widthTiles, heightTiles, baseColor, roofColor, accentColor, doorColor) => {
            const baseCanvas = document.createElement('canvas');
            baseCanvas.width = widthTiles * tileSize;
            baseCanvas.height = heightTiles * tileSize;
            const baseCtx = baseCanvas.getContext('2d');
            baseCtx.imageSmoothingEnabled = false;

            // Base walls
            baseCtx.fillStyle = baseColor;
            baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

            // Bottom trim
            baseCtx.fillStyle = accentColor;
            baseCtx.fillRect(0, baseCanvas.height - 3, baseCanvas.width, 3);

            // Door
            const doorWidth = tileSize;
            const doorHeight = tileSize + 2;
            const doorX = Math.floor(baseCanvas.width / 2 - doorWidth / 2);
            const doorY = baseCanvas.height - doorHeight;
            baseCtx.fillStyle = doorColor;
            baseCtx.fillRect(doorX, doorY, doorWidth, doorHeight);
            baseCtx.fillStyle = '#f5d47a';
            baseCtx.fillRect(doorX + doorWidth - 3, doorY + 6, 2, 2);

            // Windows
            baseCtx.fillStyle = '#8fd3ff';
            if (widthTiles >= 3) {
                baseCtx.fillRect(4, 6, 6, 4);
                baseCtx.fillRect(baseCanvas.width - 10, 6, 6, 4);
            } else {
                baseCtx.fillRect(4, 6, 6, 4);
            }

            // Roof
            const roofCanvas = document.createElement('canvas');
            const roofHeight = tileSize * 2;
            roofCanvas.width = baseCanvas.width;
            roofCanvas.height = roofHeight;
            const roofCtx = roofCanvas.getContext('2d');
            roofCtx.imageSmoothingEnabled = false;

            roofCtx.fillStyle = roofColor;
            roofCtx.fillRect(0, 0, roofCanvas.width, roofCanvas.height);
            roofCtx.fillStyle = accentColor;
            roofCtx.fillRect(0, roofCanvas.height - 3, roofCanvas.width, 3);

            return { baseCanvas, roofCanvas };
        };

        const sprites = {};

        // Inn
        {
            const { baseCanvas, roofCanvas } = createSprite(4, 3, '#ff6b6b', '#c03030', '#7a1f1f', '#8b5a2b');
            sprites.building_inn_base = baseCanvas;
            sprites.building_inn_roof = roofCanvas;
        }

        // Shop
        {
            const { baseCanvas, roofCanvas } = createSprite(3, 2, '#6cb4ff', '#2f5fb7', '#1b3f7a', '#8b5a2b');
            sprites.building_shop_base = baseCanvas;
            sprites.building_shop_roof = roofCanvas;
        }

        // House
        {
            const { baseCanvas, roofCanvas } = createSprite(2, 2, '#f4a261', '#c07830', '#7a4b2a', '#8b5a2b');
            sprites.building_house_base = baseCanvas;
            sprites.building_house_roof = roofCanvas;
        }

        // Lighthouse
        {
            const { baseCanvas, roofCanvas } = createSprite(2, 4, '#f5f5f5', '#d0d0d0', '#9a9a9a', '#8b5a2b');
            sprites.building_lighthouse_base = baseCanvas;
            sprites.building_lighthouse_roof = roofCanvas;
        }

        Object.entries(sprites).forEach(([key, canvas]) => {
            this.images.set(key, canvas);
        });

        return sprites;
    }

    // Initialize with placeholder assets
    initPlaceholders() {
        console.log('📦 Creating placeholder assets (until PixelLab is available)...');
        this.createTestCharacterSprite();
        this.createTestTileset();
        console.log('✅ Placeholder assets created');
    }
}
