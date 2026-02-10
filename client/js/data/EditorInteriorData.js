// EditorInteriorData.js - Interior map editor placements
// Spencer's hand-placed interiors + Frank's furnishing
// Updated: 2026-02-10

const EDITOR_INTERIOR_DATA = {

    // ===================================================================
    // MAIN ISLAND BUILDINGS
    // ===================================================================

    // The Drift-In Inn at (816,704) — 14×9 tiles = 224×144 px
    "interior_inn_816_704": [
        {type: "cabinet", x: 0, y: 0},
        {type: "bookshelf_potions", x: 48, y: 0},
        {type: "shelf_plant", x: 176, y: 0},
        {type: "shelf", x: 200, y: 0},
        {type: "bed", x: 192, y: 48},
        {type: "bed", x: 192, y: 80},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "rug", x: 96, y: 48, ground: true},
        {type: "table_long", x: 64, y: 64},
        {type: "bench", x: 48, y: 96},
        {type: "stool", x: 112, y: 80},
        {type: "barrel", x: 0, y: 48},
        {type: "barrel_large", x: 0, y: 80},
        {type: "jug", x: 0, y: 112},
        {type: "plant_bush3", x: 0, y: 128},
        {type: "plant_bush2", x: 208, y: 128},
        {type: "plant", x: 144, y: 0}
    ],

    // Continuity Goods (main shop) at (672,816) — 12×8 tiles = 192×128 px
    "interior_shop_672_816": [
        {type: "shelf", x: 0, y: 0},
        {type: "shelf_potions", x: 32, y: 0},
        {type: "cabinet", x: 64, y: 0},
        {type: "bookshelf_potions", x: 112, y: 0},
        {type: "shelf_plant", x: 160, y: 0},
        {type: "barrel", x: 176, y: 48},
        {type: "barrel_small", x: 176, y: 80},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "plant_bush3", x: 0, y: 96},
        {type: "plant", x: 176, y: 112},
        {type: "jug", x: 0, y: 48}
    ],

    // Current's Edge Light at (672,624) — 8×10 tiles = 128×160 px
    "interior_lighthouse_672_624": [
        {type: "shelf", x: 16, y: 0},
        {type: "shelf_potions", x: 80, y: 0},
        {type: "table", x: 32, y: 48},
        {type: "chair", x: 16, y: 64},
        {type: "rug", x: 48, y: 80, ground: true},
        {type: "barrel", x: 0, y: 32},
        {type: "barrel_small", x: 112, y: 32},
        {type: "jug", x: 112, y: 80},
        {type: "plant_bush", x: 0, y: 128},
        {type: "plant", x: 112, y: 128}
    ],

    // Anchor House at (832,560) — 10×7 tiles = 160×112 px
    "interior_house_832_560": [
        {type: "bed", x: 16, y: 16},
        {type: "dresser", x: 64, y: 0},
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "bookshelf", x: 112, y: 0},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "table_round", x: 64, y: 56},
        {type: "chair2", x: 96, y: 56},
        {type: "barrel", x: 0, y: 80},
        {type: "plant", x: 144, y: 80},
        {type: "jug", x: 0, y: 48}
    ],

    // Molting Den at (976,672) — 10×7 tiles = 160×112 px
    "interior_house_976_672": [
        {type: "bed", x: 128, y: 16},
        {type: "cabinet", x: 0, y: 0},
        {type: "shelf_potions", x: 48, y: 0},
        {type: "rug", x: 48, y: 40, ground: true},
        {type: "plant_bush2", x: 144, y: 80},
        {type: "plant_bush", x: 0, y: 80},
        {type: "table", x: 48, y: 64},
        {type: "chair", x: 32, y: 48},
        {type: "stool", x: 96, y: 64},
        {type: "barrel_small", x: 96, y: 0}
    ],

    // ===================================================================
    // SECONDARY ISLAND BUILDINGS
    // ===================================================================

    // Shell Cottage 1 at (1504,1152)
    "interior_house_1504_1152": [
        {type: "cabinet", x: 0, y: 0},
        {type: "rug", x: 56, y: 24, ground: true},
        {type: "shelf", x: 64, y: 0},
        {type: "shelf_potions", x: 112, y: 0},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "plant", x: 144, y: 80},
        {type: "table_round", x: 48, y: 56},
        {type: "chair2", x: 80, y: 56},
        {type: "stool", x: 32, y: 72},
        {type: "barrel", x: 0, y: 72}
    ],

    // Tide Shop 1 at (1616,1184) — 12×8 tiles = 192×128 px
    "interior_shop_1616_1184": [
        {type: "cabinet", x: 0, y: 0},
        {type: "shelf", x: 48, y: 0},
        {type: "bookshelf", x: 96, y: 0},
        {type: "shelf_plant", x: 160, y: 0},
        {type: "barrel_large", x: 176, y: 48},
        {type: "barrel", x: 176, y: 80},
        {type: "rug", x: 48, y: 48, ground: true},
        {type: "table_round", x: 64, y: 72},
        {type: "stool", x: 48, y: 88},
        {type: "plant_bush2", x: 0, y: 96},
        {type: "plant", x: 0, y: 48}
    ],

    // Tide Shop 2 at (736,1504)
    "interior_shop_736_1504": [
        {type: "shelf", x: 0, y: 0},
        {type: "shelf_potions", x: 32, y: 0},
        {type: "bookshelf_potions", x: 64, y: 0},
        {type: "shelf_plant", x: 112, y: 0},
        {type: "cabinet", x: 160, y: 0},
        {type: "barrel", x: 0, y: 48},
        {type: "barrel_small", x: 0, y: 80},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "table", x: 96, y: 64},
        {type: "plant_bush3", x: 176, y: 96},
        {type: "plant", x: 0, y: 112},
        {type: "jug", x: 176, y: 48}
    ],

    // Driftwood Cabin 2 at (880,1600)
    "interior_house_880_1600": [
        {type: "bed", x: 128, y: 16},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "dresser", x: 0, y: 0},
        {type: "shelf", x: 64, y: 0},
        {type: "plant_bush3", x: 144, y: 80},
        {type: "plant", x: 0, y: 80},
        {type: "table_round", x: 48, y: 56},
        {type: "chair2", x: 32, y: 40},
        {type: "barrel", x: 96, y: 0},
        {type: "jug", x: 144, y: 48}
    ],

    // Driftwood Cabin 3 at (1136,816) — cozy cabin vibe
    "interior_house_1136_816": [
        {type: "bed", x: 128, y: 16},
        {type: "rug", x: 48, y: 32, ground: true},
        {type: "dresser", x: 0, y: 0},
        {type: "bookshelf", x: 96, y: 0},
        {type: "plant_bush2", x: 144, y: 0},
        {type: "plant_bush", x: 0, y: 80},
        {type: "table", x: 48, y: 64},
        {type: "chair", x: 32, y: 48},
        {type: "barrel_small", x: 144, y: 80},
        {type: "jug", x: 0, y: 40}
    ],

    // Beach Hut 3 at (1248,864)
    "interior_house_1248_864": [
        {type: "bed", x: 16, y: 16},
        {type: "rug", x: 64, y: 32, ground: true},
        {type: "shelf_plant", x: 96, y: 0},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "barrel", x: 0, y: 80},
        {type: "table", x: 64, y: 56},
        {type: "chair2", x: 48, y: 72},
        {type: "jug", x: 144, y: 80},
        {type: "plant", x: 0, y: 48}
    ],

    // Beach Hut 4 at (1584,784) — simple beach living
    "interior_house_1584_784": [
        {type: "bed", x: 16, y: 16},
        {type: "rug", x: 64, y: 40, ground: true},
        {type: "barrel", x: 144, y: 0},
        {type: "barrel_small", x: 144, y: 80},
        {type: "plant_bush2", x: 0, y: 80},
        {type: "shelf_plant", x: 64, y: 0},
        {type: "table", x: 96, y: 48},
        {type: "chair", x: 80, y: 64},
        {type: "jug", x: 0, y: 48}
    ],

    // Shell Cottage 4 at (1696,832)
    "interior_house_1696_832": [
        {type: "bookshelf", x: 0, y: 0},
        {type: "shelf", x: 48, y: 0},
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "plant_bush", x: 144, y: 0},
        {type: "plant_bush3", x: 0, y: 80},
        {type: "table_round", x: 56, y: 56},
        {type: "chair2", x: 80, y: 40},
        {type: "barrel", x: 144, y: 80},
        {type: "dresser", x: 96, y: 0},
        {type: "jug", x: 0, y: 48}
    ],

    // Shell Cottage 5 at (352,1136) — herbalist's home
    "interior_house_352_1136": [
        {type: "bookshelf_potions", x: 0, y: 0},
        {type: "shelf_potions", x: 48, y: 0},
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "plant", x: 128, y: 0},
        {type: "plant_bush", x: 0, y: 80},
        {type: "plant_bush2", x: 144, y: 80},
        {type: "table_round", x: 64, y: 56},
        {type: "chair2", x: 48, y: 40},
        {type: "barrel", x: 0, y: 40}
    ],

    // Tide Shop 5 at (464,1184)
    "interior_shop_464_1184": [
        {type: "shelf", x: 0, y: 0},
        {type: "cabinet", x: 48, y: 0},
        {type: "shelf_potions", x: 96, y: 0},
        {type: "bookshelf_potions", x: 128, y: 0},
        {type: "shelf_plant", x: 160, y: 0},
        {type: "barrel", x: 0, y: 48},
        {type: "rug", x: 64, y: 48, ground: true},
        {type: "table", x: 80, y: 72},
        {type: "stool", x: 112, y: 80},
        {type: "plant_bush", x: 176, y: 96},
        {type: "jug", x: 176, y: 48},
        {type: "plant", x: 0, y: 96}
    ],

    // Tide Shop 6 at (1168,1552)
    "interior_shop_1168_1552": [
        {type: "cabinet", x: 0, y: 0},
        {type: "shelf", x: 48, y: 0},
        {type: "shelf_potions", x: 80, y: 0},
        {type: "bookshelf", x: 128, y: 0},
        {type: "shelf_plant", x: 160, y: 0},
        {type: "barrel_large", x: 176, y: 48},
        {type: "barrel", x: 176, y: 80},
        {type: "rug", x: 48, y: 48, ground: true},
        {type: "table_round", x: 64, y: 72},
        {type: "stool", x: 48, y: 88},
        {type: "plant_bush2", x: 0, y: 96},
        {type: "plant", x: 0, y: 48}
    ],

    // Driftwood Cabin 6 at (1312,1632)
    "interior_house_1312_1632": [
        {type: "bed", x: 16, y: 16},
        {type: "rug", x: 64, y: 32, ground: true},
        {type: "bookshelf", x: 64, y: 0},
        {type: "plant_bush2", x: 144, y: 0},
        {type: "barrel", x: 0, y: 80},
        {type: "table", x: 96, y: 56},
        {type: "chair", x: 80, y: 72},
        {type: "plant", x: 144, y: 80},
        {type: "shelf_potions", x: 112, y: 0},
        {type: "jug", x: 0, y: 48}
    ],

    // Driftwood Cabin 7 at (1536,384)
    "interior_house_1536_384": [
        {type: "bed", x: 16, y: 16},
        {type: "rug", x: 64, y: 32, ground: true},
        {type: "dresser", x: 64, y: 0},
        {type: "plant_bush3", x: 0, y: 80},
        {type: "barrel_large", x: 144, y: 0},
        {type: "jug", x: 144, y: 80},
        {type: "table", x: 96, y: 56},
        {type: "chair2", x: 80, y: 40},
        {type: "shelf", x: 112, y: 0}
    ],

    // Beach Hut 7 at (1648,432)
    "interior_house_1648_432": [
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "barrel", x: 0, y: 0},
        {type: "shelf_plant", x: 48, y: 0},
        {type: "plant_bush3", x: 144, y: 0},
        {type: "plant", x: 144, y: 80},
        {type: "table_round", x: 56, y: 56},
        {type: "chair2", x: 40, y: 72},
        {type: "barrel_small", x: 0, y: 80},
        {type: "jug", x: 0, y: 48}
    ],

    // Beach Hut 8 at (720,1184) — Spencer's hand-furnished example
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

    // Shell Cottage 8 at (832,1232)
    "interior_house_832_1232": [
        {type: "cabinet", x: 0, y: 0},
        {type: "bookshelf_potions", x: 48, y: 0},
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "plant_bush", x: 144, y: 0},
        {type: "plant_bush2", x: 0, y: 80},
        {type: "table", x: 56, y: 56},
        {type: "chair2", x: 96, y: 56},
        {type: "barrel_small", x: 144, y: 80},
        {type: "shelf", x: 96, y: 0},
        {type: "jug", x: 0, y: 48}
    ],

    // Shell Cottage 9 at (1152,416)
    "interior_house_1152_416": [
        {type: "cabinet", x: 0, y: 0},
        {type: "bookshelf", x: 48, y: 0},
        {type: "rug", x: 56, y: 32, ground: true},
        {type: "plant_bush", x: 144, y: 0},
        {type: "plant", x: 144, y: 80},
        {type: "barrel", x: 0, y: 80},
        {type: "table_round", x: 56, y: 56},
        {type: "chair", x: 40, y: 72},
        {type: "stool", x: 96, y: 64},
        {type: "jug", x: 0, y: 40}
    ],

    // Tide Shop 9 at (1264,480)
    "interior_shop_1264_480": [
        {type: "shelf", x: 0, y: 0},
        {type: "bookshelf_potions", x: 32, y: 0},
        {type: "cabinet", x: 80, y: 0},
        {type: "shelf_plant", x: 128, y: 0},
        {type: "shelf_potions", x: 160, y: 0},
        {type: "barrel", x: 0, y: 48},
        {type: "barrel_small", x: 0, y: 80},
        {type: "rug", x: 64, y: 56, ground: true},
        {type: "table_round", x: 96, y: 72},
        {type: "plant_bush3", x: 176, y: 96},
        {type: "jug", x: 176, y: 48},
        {type: "plant", x: 0, y: 112}
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = EDITOR_INTERIOR_DATA;
}
