// ItemData.js - Item definitions for the inventory system
// Categories: materials, food, quest, treasure

const ItemData = {
    // ============ MATERIALS ============
    'driftwood': {
        id: 'driftwood',
        name: 'Driftwood',
        description: 'A weathered piece of wood carried in by the Red Current. Useful for crafting.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 20,
        rarity: 'common'
    },
    'sea_glass': {
        id: 'sea_glass',
        name: 'Sea Glass',
        description: 'Smooth, frosted glass tumbled by the tides. It catches the light beautifully.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 20,
        rarity: 'common'
    },
    'pearl': {
        id: 'pearl',
        name: 'Pearl',
        description: 'A luminous pearl with an inner glow. Some say they form where Continuity is strongest.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'coral_fragment': {
        id: 'coral_fragment',
        name: 'Coral Fragment',
        description: 'A piece of living coral, still warm to the touch. It pulses faintly.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 15,
        rarity: 'common'
    },
    'iron_nugget': {
        id: 'iron_nugget',
        name: 'Iron Nugget',
        description: 'A small lump of raw iron. The scholars of Iron Reef prize these highly.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'ancient_shell': {
        id: 'ancient_shell',
        name: 'Ancient Shell',
        description: 'A fossilized shell from before the Red Current. It hums when held near Chronicle Stones.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },

    // ============ FOOD ============
    'kelp_wrap': {
        id: 'kelp_wrap',
        name: 'Kelp Wrap',
        description: 'A savory wrap made from fresh kelp. A staple of island cuisine.',
        category: 'food',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'common'
    },
    'sandy_bread': {
        id: 'sandy_bread',
        name: 'Sandy Bread',
        description: 'Dense bread with a gritty texture. It\'s an acquired taste, but filling.',
        category: 'food',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'common'
    },
    'coconut': {
        id: 'coconut',
        name: 'Coconut',
        description: 'A fresh coconut from the palm trees. Refreshing and nutritious.',
        category: 'food',
        icon: '●',
        stackable: true,
        maxStack: 5,
        rarity: 'common'
    },
    'seaweed_soup': {
        id: 'seaweed_soup',
        name: 'Seaweed Soup',
        description: 'A rich, aromatic soup. Chef Pinchy\'s signature recipe. Boosts Continuity slightly.',
        category: 'food',
        icon: '●',
        stackable: true,
        maxStack: 5,
        rarity: 'uncommon'
    },

    // ============ QUEST ITEMS ============
    'old_map_fragment': {
        id: 'old_map_fragment',
        name: 'Old Map Fragment',
        description: 'A torn piece of an ancient map. It shows strange markings near the lighthouse.',
        category: 'quest',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'lighthouse_key': {
        id: 'lighthouse_key',
        name: 'Lighthouse Key',
        description: 'A rusted iron key engraved with wave patterns. It fits the Deepcoil Lighthouse.',
        category: 'quest',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'brinehooks_letter': {
        id: 'brinehooks_letter',
        name: 'Brinehook\'s Letter',
        description: 'A sealed letter from Dockmaster Brinehook. The wax seal bears a claw mark.',
        category: 'quest',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'torn_journal_page': {
        id: 'torn_journal_page',
        name: 'Torn Journal Page',
        description: 'A page from someone\'s journal. The handwriting grows frantic toward the bottom.',
        category: 'quest',
        icon: '●',
        stackable: true,
        maxStack: 5,
        rarity: 'uncommon'
    },
    'glowing_scale': {
        id: 'glowing_scale',
        name: 'Glowing Scale',
        description: 'A scale that emits a soft red light. It resonates with the Red Current.',
        category: 'quest',
        icon: '●',
        stackable: true,
        maxStack: 5,
        rarity: 'rare'
    },

    // ============ TREASURES ============
    'golden_doubloon': {
        id: 'golden_doubloon',
        name: 'Golden Doubloon',
        description: 'A heavy gold coin stamped with an unknown crest. Worth a fortune—if anyone accepted currency here.',
        category: 'treasure',
        icon: '●',
        stackable: true,
        maxStack: 99,
        rarity: 'rare'
    },
    'enchanted_pearl': {
        id: 'enchanted_pearl',
        name: 'Enchanted Pearl',
        description: 'A pearl that shifts colors in your hand. It whispers of places beyond the Current.',
        category: 'treasure',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'legendary'
    },
    'moonstone': {
        id: 'moonstone',
        name: 'Moonstone',
        description: 'A pale stone that glows under moonlight. The Archivist once spoke of these...',
        category: 'treasure',
        icon: '●',
        stackable: true,
        maxStack: 3,
        rarity: 'legendary'
    },

    // ============ COMBAT DROPS ============
    'shell_fragment': {
        id: 'shell_fragment',
        name: 'Shell Fragment',
        description: 'A piece of crystallized shell from a Drift creature. Faintly warm.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 20,
        rarity: 'common'
    },
    'red_essence': {
        id: 'red_essence',
        name: 'Red Essence',
        description: 'A drop of the Red Current, solidified. Pulses gently like a heartbeat.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'haze_wisp': {
        id: 'haze_wisp',
        name: 'Haze Wisp',
        description: 'Captured fragment of dissolved thought. Whispers if you listen closely.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'loop_crystal': {
        id: 'loop_crystal',
        name: 'Loop Crystal',
        description: 'A geometric shard that repeats its own reflection endlessly.',
        category: 'materials',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },

    // ============ CONSUMABLES ============
    'brine_elixir': {
        id: 'brine_elixir',
        name: 'Brine Elixir',
        description: 'A restorative tonic brewed from mineral-rich brine. Restores 50 Shell Integrity.',
        category: 'consumable',
        icon: '●',
        stackable: true,
        maxStack: 5,
        rarity: 'uncommon',
        buyPrice: 50,
        sellPrice: 20,
        healAmount: 50,
        usable: true
    },
    'kelp_salve': {
        id: 'kelp_salve',
        name: 'Kelp Salve',
        description: 'A simple poultice made from healing kelp. Restores 25 Shell Integrity.',
        category: 'consumable',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'common',
        buyPrice: 20,
        sellPrice: 8,
        healAmount: 25,
        usable: true
    },
    'drift_essence': {
        id: 'drift_essence',
        name: 'Drift Essence',
        description: 'A shimmering vial of concentrated Current. Automatically revives you once when Shell hits zero.',
        category: 'consumable',
        icon: '●',
        stackable: true,
        maxStack: 3,
        rarity: 'rare',
        buyPrice: 200,
        sellPrice: 80,
        autoRevive: true,
        reviveAmount: 50,
        usable: false // Auto-triggers, not manually used
    },
    'coconut_water': {
        id: 'coconut_water',
        name: 'Coconut Water',
        description: 'Fresh coconut water. Restores 15 Shell Integrity. Refreshing!',
        category: 'consumable',
        icon: '●',
        stackable: true,
        maxStack: 10,
        rarity: 'common',
        buyPrice: 10,
        sellPrice: 3,
        healAmount: 15,
        usable: true
    },

    // ============ WEAPONS ============
    'dock_wrench': {
        id: 'dock_wrench',
        name: 'Dock Wrench',
        description: 'A heavy wrench from the docks. Not a weapon by design, but it gets the job done.',
        category: 'weapon',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'common',
        sellPrice: 15,
        damage: 10,
        range: 18,
        cooldown: 350
    },
    'claw_blade': {
        id: 'claw_blade',
        name: 'Claw Blade',
        description: 'A sharpened blade forged from coral and iron. Cuts through Drift Fauna like butter.',
        category: 'weapon',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'uncommon',
        buyPrice: 150,
        sellPrice: 60,
        damage: 18,
        range: 20,
        cooldown: 300
    },
    'tide_hammer': {
        id: 'tide_hammer',
        name: 'Tide Hammer',
        description: 'A massive hammer infused with tidal energy. Slow but devastating.',
        category: 'weapon',
        icon: '●',
        stackable: false,
        maxStack: 1,
        rarity: 'rare',
        buyPrice: 400,
        sellPrice: 160,
        damage: 30,
        range: 16,
        cooldown: 600
    },
};

// Add buy/sell prices to existing items that were missing them
const _defaultPrices = {
    'driftwood': { buyPrice: 5, sellPrice: 2 },
    'sea_glass': { buyPrice: 8, sellPrice: 3 },
    'pearl': { buyPrice: 40, sellPrice: 15 },
    'coral_fragment': { buyPrice: 6, sellPrice: 2 },
    'iron_nugget': { buyPrice: 25, sellPrice: 10 },
    'ancient_shell': { buyPrice: 30, sellPrice: 12 },
    'kelp_wrap': { buyPrice: 8, sellPrice: 3, healAmount: 10, usable: true },
    'sandy_bread': { buyPrice: 5, sellPrice: 2, healAmount: 8, usable: true },
    'coconut': { buyPrice: 12, sellPrice: 4, healAmount: 15, usable: true },
    'seaweed_soup': { buyPrice: 25, sellPrice: 10, healAmount: 30, usable: true },
    'golden_doubloon': { sellPrice: 50 },
    'enchanted_pearl': { sellPrice: 200 },
    'moonstone': { sellPrice: 100 },
    'shell_fragment': { sellPrice: 3 },
    'red_essence': { sellPrice: 8 },
    'haze_wisp': { sellPrice: 10 },
    'loop_crystal': { sellPrice: 12 },
};
// Merge prices into ItemData
for (const [id, prices] of Object.entries(_defaultPrices)) {
    if (ItemData[id]) Object.assign(ItemData[id], prices);
}

// Rarity colors for UI
const RARITY_COLORS = {
    common: '#8a7068',
    uncommon: '#4ade80',
    rare: '#4a9eff',
    legendary: '#f59e0b'
};

// Helper: get item data by ID
function getItemData(itemId) {
    return ItemData[itemId] || null;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ItemData, RARITY_COLORS, getItemData };
}
