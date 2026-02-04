// Game constants
const CONSTANTS = {
    // Tile and sprite dimensions
    TILE_SIZE: 16,
    CHARACTER_WIDTH: 16, // Collision width
    CHARACTER_HEIGHT: 24, // Collision height
    CHARACTER_SPRITE_WIDTH: 24,
    CHARACTER_SPRITE_HEIGHT: 24,
    // Visual scale multiplier for rendering characters (keeps collisions at base size)
    // Note: DISPLAY_SCALE handles screen scaling, so this should be 1.0
    CHARACTER_RENDER_SCALE: 1.0,

    // Viewport dimensions (in tiles)
    VIEWPORT_TILES_WIDTH: 10,
    VIEWPORT_TILES_HEIGHT: 8,

    // Scale factor for modern displays
    DISPLAY_SCALE: 4, // 16px tiles become 64px on screen

    // Movement
    PLAYER_SPEED: 80, // pixels per second

    // Animation
    WALK_ANIMATION_FPS: 8,
    IDLE_ANIMATION_FPS: 2,

    // Network
    SERVER_URL: 'http://localhost:3000',
    SERVER_TICK_RATE: 20, // Hz (50ms updates)

    // Input keys
    KEYS: {
        W: 'w',
        A: 'a',
        S: 's',
        D: 'd',
        SPACE: ' ',
        UP: 'ArrowUp',
        LEFT: 'ArrowLeft',
        DOWN: 'ArrowDown',
        RIGHT: 'ArrowRight'
    },

    // Directions
    DIRECTION: {
        UP: 'up',
        DOWN: 'down',
        LEFT: 'left',
        RIGHT: 'right'
    },

    // Collision layers
    COLLISION_LAYER: {
        NONE: 0,
        SOLID: 1,
        WATER: 2,
        BUILDING: 3
    },

    // Render layers
    LAYER: {
        GROUND: 0,
        GROUND_DECORATION: 1,
        BUILDING_BASE: 2,
        ENTITIES: 3,
        BUILDING_UPPER: 4,
        EFFECTS: 5,
        UI: 6
    },

    // Character accessories (16x16 overlay sprites)
    ACCESSORY_CATALOG: [
        { id: 'baseball_cap', name: 'Baseball Cap', assetKey: 'accessory_baseball_cap', slot: 'head' },
        { id: 'beanie', name: 'Beanie', assetKey: 'accessory_beanie', slot: 'head' },
        { id: 'bucket_hat', name: 'Bucket Hat', assetKey: 'accessory_bucket_hat', slot: 'head' },
        { id: 'sunglasses', name: 'Sunglasses', assetKey: 'accessory_sunglasses', slot: 'eyes' },
        { id: 'square_glasses', name: 'Square Glasses', assetKey: 'accessory_square_glasses', slot: 'eyes' },
        { id: 'scarf', name: 'Scarf', assetKey: 'accessory_scarf', slot: 'neck' },
        { id: 'pirate_bandana', name: 'Pirate Bandana', assetKey: 'accessory_pirate_bandana', slot: 'head' }
    ],

    // Available character species
    SPECIES_CATALOG: [
        { id: 'lobster', name: 'Lobster', emoji: '🦞', description: 'Classic crustacean with big claws' },
        { id: 'crab', name: 'Crab', emoji: '🦀', description: 'Sideways walker with a round shell' },
        { id: 'shrimp', name: 'Shrimp', emoji: '🦐', description: 'Small but mighty swimmer' },
        { id: 'mantis_shrimp', name: 'Mantis Shrimp', emoji: '🌈', description: 'Colorful powerhouse with incredible vision' },
        { id: 'hermit_crab', name: 'Hermit Crab', emoji: '🐚', description: 'Cozy shell-dweller' }
    ]
};

// Calculate actual display dimensions
CONSTANTS.VIEWPORT_WIDTH = CONSTANTS.VIEWPORT_TILES_WIDTH * CONSTANTS.TILE_SIZE;
CONSTANTS.VIEWPORT_HEIGHT = CONSTANTS.VIEWPORT_TILES_HEIGHT * CONSTANTS.TILE_SIZE;
CONSTANTS.CANVAS_WIDTH = CONSTANTS.VIEWPORT_WIDTH * CONSTANTS.DISPLAY_SCALE;
CONSTANTS.CANVAS_HEIGHT = CONSTANTS.VIEWPORT_HEIGHT * CONSTANTS.DISPLAY_SCALE;
