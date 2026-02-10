// EditorInteriorData.js - Interior map editor placements
// Spencer's hand-placed interiors + Frank's furnishing (redesigned 02-10)
// Design principles: fewer items, wall-hugged furniture, clear walking paths
// Room coords are INTERIOR-relative (0,0 = top-left of interior floor)

const EDITOR_INTERIOR_DATA = {

    // ===================================================================
    // MAIN ISLAND BUILDINGS
    // ===================================================================

    // The Drift-In Inn at (816,704) — 14×9 tiles = 224×144 px
    // Layout: tavern area left, sleeping area right, bar counter center-back
    "interior_inn_816_704": [
        {type: "bed", x: 176, y: 16},
        {type: "bed", x: 176, y: 64},
        {type: "table_long", x: 48, y: 64},
        {type: "stool", x: 32, y: 80},
        {type: "stool", x: 96, y: 80},
        {type: "shelf", x: 0, y: 0},
        {type: "shelf_potions", x: 80, y: 0},
        {type: "barrel", x: 144, y: 0},
        {type: "rug", x: 80, y: 48, ground: true},
        {type: "plant", x: 0, y: 112}
    ],

    // Continuity Goods (main shop) at (672,816) — 12×8 tiles = 192×128 px
    // Layout: counter along back wall, open floor for customers
    "interior_shop_672_816": [
        {type: "shelf", x: 0, y: 0},
        {type: "shelf_potions", x: 48, y: 0},
        {type: "cabinet", x: 112, y: 0},
        {type: "shelf_plant", x: 160, y: 0},
        {type: "barrel", x: 160, y: 64},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "plant", x: 0, y: 96}
    ],

    // Current's Edge Light at (672,624) — lighthouse 8×10 tiles = 128×160 px
    // Layout: sparse utility room, lantern keeper's quarters
    "interior_lighthouse_672_624": [
        {type: "shelf", x: 16, y: 0},
        {type: "table", x: 48, y: 48},
        {type: "chair", x: 32, y: 64},
        {type: "barrel", x: 96, y: 32},
        {type: "rug", x: 48, y: 96, ground: true},
        {type: "plant", x: 96, y: 128}
    ],

    // Anchor House at (832,560) — 10×7 tiles = 160×112 px
    // Layout: bed top-left, small dining area center-right
    "interior_house_832_560": [
        {type: "bed", x: 0, y: 16},
        {type: "dresser", x: 48, y: 0},
        {type: "table_round", x: 96, y: 48},
        {type: "chair2", x: 80, y: 64},
        {type: "rug", x: 64, y: 32, ground: true},
        {type: "plant", x: 128, y: 0}
    ],

    // Molting Den at (976,672) — 10×7 tiles = 160×112 px
    // Layout: bed top-right, study area left
    "interior_house_976_672": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf_potions", x: 0, y: 0},
        {type: "table", x: 48, y: 48},
        {type: "chair", x: 32, y: 64},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "plant_bush2", x: 128, y: 80}
    ],

    // ===================================================================
    // SECONDARY ISLAND BUILDINGS
    // ===================================================================

    // Shell Cottage 1 at (1504,1152) — 10×7 tiles
    "interior_house_1504_1152": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf", x: 0, y: 0},
        {type: "table_round", x: 48, y: 48},
        {type: "stool", x: 32, y: 64},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "barrel", x: 128, y: 80}
    ],

    // Tide Shop 1 at (1616,1184) — 12×8 tiles
    "interior_shop_1616_1184": [
        {type: "cabinet", x: 0, y: 0},
        {type: "shelf", x: 48, y: 0},
        {type: "shelf_potions", x: 128, y: 0},
        {type: "barrel", x: 160, y: 48},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "plant", x: 0, y: 96}
    ],

    // Harbor Shop at (736,1504) — 12×8 tiles
    "interior_shop_736_1504": [
        {type: "shelf_plant", x: 0, y: 0},
        {type: "cabinet", x: 48, y: 0},
        {type: "shelf", x: 128, y: 0},
        {type: "rug", x: 80, y: 48, ground: true},
        {type: "barrel_small", x: 160, y: 80},
        {type: "plant", x: 0, y: 96}
    ],

    // Driftwood Cottage at (880,1600) — 10×7 tiles
    "interior_house_880_1600": [
        {type: "bed", x: 0, y: 16},
        {type: "bookshelf", x: 96, y: 0},
        {type: "table_round", x: 80, y: 56},
        {type: "chair2", x: 112, y: 56},
        {type: "rug", x: 48, y: 32, ground: true}
    ],

    // ===================================================================
    // PORT CLAWSON BUILDINGS (Island 3)
    // ===================================================================

    // Lookout House at (1136,816) — 10×7 tiles
    "interior_house_1136_816": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf_potions", x: 0, y: 0},
        {type: "dresser", x: 48, y: 0},
        {type: "table", x: 32, y: 56},
        {type: "chair", x: 16, y: 72},
        {type: "rug", x: 64, y: 40, ground: true}
    ],

    // Wave House at (1248,864) — 10×7 tiles
    "interior_house_1248_864": [
        {type: "bed", x: 0, y: 16},
        {type: "shelf", x: 64, y: 0},
        {type: "table_round", x: 96, y: 48},
        {type: "stool", x: 80, y: 64},
        {type: "rug", x: 48, y: 40, ground: true},
        {type: "plant_bush", x: 128, y: 80}
    ],

    // ===================================================================
    // NORTH ISLAND BUILDINGS (Island 4)
    // ===================================================================

    // Harbor House 1 at (1584,784) — 10×7 tiles
    "interior_house_1584_784": [
        {type: "bed", x: 0, y: 16},
        {type: "cabinet", x: 80, y: 0},
        {type: "table", x: 96, y: 48},
        {type: "chair", x: 112, y: 64},
        {type: "rug", x: 48, y: 32, ground: true}
    ],

    // Harbor House 2 at (1696,832) — 10×7 tiles
    "interior_house_1696_832": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf_potions", x: 0, y: 0},
        {type: "barrel", x: 0, y: 64},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "table_round", x: 48, y: 56},
        {type: "plant", x: 128, y: 80}
    ],

    // ===================================================================
    // WEST ISLAND BUILDINGS
    // ===================================================================

    // Hermit House at (352,1136) — 10×7 tiles
    "interior_house_352_1136": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf", x: 0, y: 0},
        {type: "barrel", x: 0, y: 64},
        {type: "table_round", x: 48, y: 48},
        {type: "rug", x: 48, y: 32, ground: true}
    ],

    // West Shop at (464,1184) — 12×8 tiles
    "interior_shop_464_1184": [
        {type: "shelf", x: 0, y: 0},
        {type: "shelf_potions", x: 48, y: 0},
        {type: "cabinet", x: 128, y: 0},
        {type: "rug", x: 80, y: 48, ground: true},
        {type: "barrel", x: 160, y: 64},
        {type: "plant_bush", x: 0, y: 96}
    ],

    // ===================================================================
    // SOUTH ISLAND BUILDINGS
    // ===================================================================

    // South Shop at (1168,1552) — 12×8 tiles
    "interior_shop_1168_1552": [
        {type: "cabinet", x: 0, y: 0},
        {type: "shelf_plant", x: 48, y: 0},
        {type: "shelf", x: 128, y: 0},
        {type: "barrel", x: 160, y: 48},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "plant", x: 0, y: 96}
    ],

    // South Cottage at (1312,1632) — 10×7 tiles
    "interior_house_1312_1632": [
        {type: "bed", x: 0, y: 16},
        {type: "dresser", x: 48, y: 0},
        {type: "table", x: 96, y: 48},
        {type: "chair", x: 80, y: 64},
        {type: "rug", x: 64, y: 32, ground: true}
    ],

    // ===================================================================
    // FAR NORTH BUILDINGS
    // ===================================================================

    // North House 1 at (1536,384) — 10×7 tiles
    "interior_house_1536_384": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf_potions", x: 0, y: 0},
        {type: "table_round", x: 48, y: 48},
        {type: "stool", x: 32, y: 64},
        {type: "rug", x: 48, y: 32, ground: true}
    ],

    // North House 2 at (1648,432) — 10×7 tiles
    "interior_house_1648_432": [
        {type: "bed", x: 0, y: 16},
        {type: "cabinet", x: 64, y: 0},
        {type: "barrel_small", x: 128, y: 0},
        {type: "table", x: 80, y: 56},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "plant", x: 128, y: 80}
    ],

    // ===================================================================
    // SPENCER'S BEACH HUT + NEIGHBORS
    // ===================================================================

    // Spencer's Beach Hut at (720,1184) — 10×7 tiles
    // Spencer's hand-placed interior — PRESERVE EXACTLY
    "interior_house_720_1184": [
        {type: "bookshelf_potions", x: 32, y: 0},
        {type: "rug", x: 64, y: 32, ground: true},
        {type: "barrel", x: 0, y: 0},
        {type: "barrel", x: 0, y: 96},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "plant_bush3", x: 144, y: 96},
        {type: "shelf_plant", x: 96, y: 0},
        {type: "plant", x: 64, y: 0},
        {type: "jug", x: 0, y: 64},
        {type: "table_round", x: 32, y: 48},
        {type: "chair2", x: 16, y: 32}
    ],

    // Shell Cottage 8 at (832,1232) — 10×7 tiles
    "interior_house_832_1232": [
        {type: "bed", x: 112, y: 16},
        {type: "shelf", x: 0, y: 0},
        {type: "table_round", x: 48, y: 48},
        {type: "chair2", x: 32, y: 64},
        {type: "rug", x: 48, y: 32, ground: true}
    ],

    // ===================================================================
    // DEEPCOIL ISLE
    // ===================================================================

    // Deepcoil House at (1152,416) — 10×7 tiles
    "interior_house_1152_416": [
        {type: "bed", x: 0, y: 16},
        {type: "bookshelf", x: 96, y: 0},
        {type: "table", x: 64, y: 56},
        {type: "chair", x: 48, y: 72},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "barrel_small", x: 128, y: 80}
    ],

    // Deepcoil Shop at (1264,480) — 12×8 tiles
    "interior_shop_1264_480": [
        {type: "shelf", x: 0, y: 0},
        {type: "cabinet", x: 48, y: 0},
        {type: "shelf_potions", x: 128, y: 0},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "barrel", x: 160, y: 64},
        {type: "plant_bush2", x: 0, y: 96}
    ]
};

// Export for use
if (typeof module !== "undefined" && module.exports) {
    module.exports = EDITOR_INTERIOR_DATA;
}
