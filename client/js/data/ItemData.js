// ItemData.js - Item definitions for the inventory system
// Categories: materials, food, quest, treasure

const ItemData = {
    // ============ MATERIALS ============
    'driftwood': {
        id: 'driftwood',
        name: 'Driftwood',
        description: 'A weathered piece of wood carried in by the Red Current. Useful for crafting.',
        category: 'materials',
        icon: '🪵',
        stackable: true,
        maxStack: 20,
        rarity: 'common'
    },
    'sea_glass': {
        id: 'sea_glass',
        name: 'Sea Glass',
        description: 'Smooth, frosted glass tumbled by the tides. It catches the light beautifully.',
        category: 'materials',
        icon: '🫧',
        stackable: true,
        maxStack: 20,
        rarity: 'common'
    },
    'pearl': {
        id: 'pearl',
        name: 'Pearl',
        description: 'A luminous pearl with an inner glow. Some say they form where Continuity is strongest.',
        category: 'materials',
        icon: '🪩',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'coral_fragment': {
        id: 'coral_fragment',
        name: 'Coral Fragment',
        description: 'A piece of living coral, still warm to the touch. It pulses faintly.',
        category: 'materials',
        icon: '🪸',
        stackable: true,
        maxStack: 15,
        rarity: 'common'
    },
    'iron_nugget': {
        id: 'iron_nugget',
        name: 'Iron Nugget',
        description: 'A small lump of raw iron. The scholars of Iron Reef prize these highly.',
        category: 'materials',
        icon: '⚙️',
        stackable: true,
        maxStack: 10,
        rarity: 'uncommon'
    },
    'ancient_shell': {
        id: 'ancient_shell',
        name: 'Ancient Shell',
        description: 'A fossilized shell from before the Red Current. It hums when held near Chronicle Stones.',
        category: 'materials',
        icon: '🐚',
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
        icon: '🥬',
        stackable: true,
        maxStack: 10,
        rarity: 'common'
    },
    'sandy_bread': {
        id: 'sandy_bread',
        name: 'Sandy Bread',
        description: 'Dense bread with a gritty texture. It\'s an acquired taste, but filling.',
        category: 'food',
        icon: '🍞',
        stackable: true,
        maxStack: 10,
        rarity: 'common'
    },
    'coconut': {
        id: 'coconut',
        name: 'Coconut',
        description: 'A fresh coconut from the palm trees. Refreshing and nutritious.',
        category: 'food',
        icon: '🥥',
        stackable: true,
        maxStack: 5,
        rarity: 'common'
    },
    'seaweed_soup': {
        id: 'seaweed_soup',
        name: 'Seaweed Soup',
        description: 'A rich, aromatic soup. Chef Pinchy\'s signature recipe. Boosts Continuity slightly.',
        category: 'food',
        icon: '🍜',
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
        icon: '🗺️',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'lighthouse_key': {
        id: 'lighthouse_key',
        name: 'Lighthouse Key',
        description: 'A rusted iron key engraved with wave patterns. It fits the Deepcoil Lighthouse.',
        category: 'quest',
        icon: '🔑',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'brinehooks_letter': {
        id: 'brinehooks_letter',
        name: 'Brinehook\'s Letter',
        description: 'A sealed letter from Dockmaster Brinehook. The wax seal bears a claw mark.',
        category: 'quest',
        icon: '📜',
        stackable: false,
        maxStack: 1,
        rarity: 'rare'
    },
    'torn_journal_page': {
        id: 'torn_journal_page',
        name: 'Torn Journal Page',
        description: 'A page from someone\'s journal. The handwriting grows frantic toward the bottom.',
        category: 'quest',
        icon: '📄',
        stackable: true,
        maxStack: 5,
        rarity: 'uncommon'
    },
    'glowing_scale': {
        id: 'glowing_scale',
        name: 'Glowing Scale',
        description: 'A scale that emits a soft red light. It resonates with the Red Current.',
        category: 'quest',
        icon: '✨',
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
        icon: '🪙',
        stackable: true,
        maxStack: 99,
        rarity: 'rare'
    },
    'enchanted_pearl': {
        id: 'enchanted_pearl',
        name: 'Enchanted Pearl',
        description: 'A pearl that shifts colors in your hand. It whispers of places beyond the Current.',
        category: 'treasure',
        icon: '💎',
        stackable: false,
        maxStack: 1,
        rarity: 'legendary'
    },
    'moonstone': {
        id: 'moonstone',
        name: 'Moonstone',
        description: 'A pale stone that glows under moonlight. The Archivist once spoke of these...',
        category: 'treasure',
        icon: '🌙',
        stackable: true,
        maxStack: 3,
        rarity: 'legendary'
    }
};

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
