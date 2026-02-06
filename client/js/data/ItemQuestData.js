// ItemQuestData.js - NPC fetch quests (trade items for rewards)
// These are separate from the main story quests — they're item-based exchanges

const ItemQuestData = [
    {
        id: 'hermit_sea_glass',
        npcName: 'Hermit Harold',
        description: 'Hermit Harold wants 3 Sea Glass for his collection.',
        requires: [
            { itemId: 'sea_glass', qty: 3 }
        ],
        rewards: [
            { itemId: 'golden_doubloon', qty: 1 }
        ],
        dialogStart: [
            'You again. Hmm.',
            'You know... I\'ve been collecting things. Smooth things.',
            'Sea Glass. Three pieces. That\'s all I need.',
            'Bring me 3 Sea Glass and I\'ll give you something valuable.',
            'Don\'t ask where I got it. Just bring the glass.'
        ],
        dialogComplete: [
            '*examines the glass carefully*',
            'Yes... yes, these are perfect.',
            'Smooth. Frosted. Tumbled by the Current itself.',
            'Here. A Golden Doubloon. Don\'t spend it all in one place.',
            'Ha. As if there\'s anywhere to spend it.',
            '*retreats into shell*'
        ],
        dialogIncomplete: [
            'Still need that Sea Glass.',
            'Three pieces. Smooth ones. Check the beaches.',
            'The Current washes them up all the time.'
        ],
        dialogAlreadyDone: [
            '*admires his sea glass collection*',
            'Beautiful, aren\'t they?',
            'Thanks again for bringing these.'
        ]
    },
    {
        id: 'bob_map_fragment',
        npcName: 'Barnacle Bob',
        description: 'Barnacle Bob lost his Old Map Fragment somewhere near the far islands.',
        requires: [
            { itemId: 'old_map_fragment', qty: 1 }
        ],
        rewards: [
            { itemId: 'lighthouse_key', qty: 1 }
        ],
        dialogStart: [
            'Oi! You look like someone who gets around.',
            'I lost something important. A map fragment.',
            'Old thing—shows markings near the lighthouse.',
            'Must\'ve dropped it on one of the far islands.',
            'Bring it back and I\'ll give you the Lighthouse Key.',
            'Yeah, I have one. Don\'t ask how.'
        ],
        dialogComplete: [
            'That\'s it! That\'s my map!',
            '*unfolds it carefully*',
            'These markings... they\'re older than I thought.',
            'Here, take this key. The Deepcoil Lighthouse.',
            'Maybe you\'ll have better luck with it than I did.',
            'I never could figure out what was up there.'
        ],
        dialogIncomplete: [
            'Still looking for that map?',
            'Old Map Fragment. Torn, yellowed, strange markings.',
            'Try the far islands. Deepcoil direction.'
        ],
        dialogAlreadyDone: [
            '*studying the map intently*',
            'These markings... I\'ve been trying to decode them.',
            'No luck yet. But I\'m close. I can feel it.'
        ]
    },
    {
        id: 'pinchy_recipe',
        npcName: 'Chef Pinchy',
        description: 'Chef Pinchy needs 2 Kelp Wraps and a Coconut for a special recipe.',
        requires: [
            { itemId: 'kelp_wrap', qty: 2 },
            { itemId: 'coconut', qty: 1 }
        ],
        rewards: [
            { itemId: 'seaweed_soup', qty: 1 },
            { itemId: 'pearl', qty: 1 }
        ],
        dialogStart: [
            'A customer! Finally!',
            'Listen, I\'m working on my masterpiece.',
            'Seaweed Soup Supreme! But I\'m missing ingredients.',
            'I need 2 Kelp Wraps and 1 Coconut.',
            'Bring those and I\'ll cook you a bowl PLUS a little bonus.',
            'Trust me—my soup boosts Continuity. Probably.'
        ],
        dialogComplete: [
            '*grabs the ingredients excitedly*',
            'Perfect! The kelp is fresh, the coconut is—*sniff*—ripe!',
            '*furious cooking montage*',
            'Here! One bowl of Seaweed Soup Supreme!',
            'And this pearl I found in one of the coconuts.',
            'Happens more often than you\'d think.',
            'Enjoy! Tell your friends!'
        ],
        dialogIncomplete: [
            'Still need those ingredients!',
            '2 Kelp Wraps and 1 Coconut.',
            'Check the beaches and jungle areas.',
            'A chef can\'t cook without supplies!'
        ],
        dialogAlreadyDone: [
            '*stirring a massive pot*',
            'Come back anytime! The kitchen\'s always open!',
            'Well, when I have ingredients, that is.'
        ]
    },
    {
        id: 'scuttle_fragments',
        npcName: 'Scholar Scuttle',
        description: 'Scholar Scuttle needs Torn Journal Pages for his research.',
        requires: [
            { itemId: 'torn_journal_page', qty: 2 }
        ],
        rewards: [
            { itemId: 'brinehooks_letter', qty: 1 }
        ],
        dialogStart: [
            'Oh! You look like someone who explores!',
            'I\'m researching the old journals—pre-Current writings.',
            'I need 2 Torn Journal Pages for my studies.',
            'They blow around the islands sometimes.',
            'Bring me pages and I\'ll share something interesting.',
            'A letter from Brinehook. Very... revealing.'
        ],
        dialogComplete: [
            '*carefully unfolds the pages*',
            'Yes! YES! Look at this handwriting!',
            'This confirms my theory about the early Drift-Ins!',
            'As promised—Brinehook\'s Letter.',
            'He wrote it before he became Dockmaster.',
            'Back when he was still looking for a way out.',
            'Fascinating, isn\'t it? How people change.'
        ],
        dialogIncomplete: [
            'The journal pages! Have you found them yet?',
            '2 Torn Journal Pages—they\'re scattered across the islands.',
            'Sometimes near old buildings or chronicle stones.',
            '*scribbles notes impatiently*'
        ],
        dialogAlreadyDone: [
            '*buried in research papers*',
            'These pages are incredible.',
            'The things early Drift-Ins wrote... they knew so much.'
        ]
    },
    {
        id: 'gearfin_iron',
        npcName: 'Gearfin',
        description: 'Gearfin needs Iron Nuggets for the Stability Engine repairs.',
        requires: [
            { itemId: 'iron_nugget', qty: 2 }
        ],
        rewards: [
            { itemId: 'ancient_shell', qty: 2 },
            { itemId: 'golden_doubloon', qty: 1 }
        ],
        dialogStart: [
            'Wait. Are you useful?',
            'The Stability Engine needs repairs. Again.',
            'I need Iron Nuggets. 2 of them. Good quality.',
            'They\'re scattered around Iron Reef mostly.',
            'Bring me the iron and I\'ll compensate you.',
            'I found some interesting shells during excavation.'
        ],
        dialogComplete: [
            '*tests the iron carefully*',
            'Good density. Minimal rust. This\'ll work.',
            '*immediately starts hammering*',
            'Here—some Ancient Shells from the dig site.',
            'And a Doubloon. Don\'t say I never paid anyone.',
            'Now leave me alone. I have work to do.'
        ],
        dialogIncomplete: [
            'Iron. Nuggets. Two of them.',
            'Iron Reef is your best bet.',
            'The Engine won\'t fix itself.',
            '*returns to tinkering*'
        ],
        dialogAlreadyDone: [
            '*sparks fly from the Engine*',
            'The repairs are holding. For now.',
            'Thanks to your iron. Decent stuff.'
        ]
    }
];

// Storage key for completed item quests
const ITEM_QUEST_STORAGE_KEY = 'clawworld_item_quests';

// Helper: get quest for a specific NPC
function getItemQuestForNPC(npcName) {
    return ItemQuestData.find(q => q.npcName === npcName) || null;
}

// Helper: load completed quest IDs from localStorage
function loadCompletedItemQuests() {
    try {
        const saved = localStorage.getItem(ITEM_QUEST_STORAGE_KEY);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
        return new Set();
    }
}

// Helper: save completed quest IDs to localStorage
function saveCompletedItemQuests(completedSet) {
    try {
        localStorage.setItem(ITEM_QUEST_STORAGE_KEY, JSON.stringify(Array.from(completedSet)));
    } catch (e) {
        console.warn('Failed to save item quest progress:', e);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ItemQuestData, getItemQuestForNPC, loadCompletedItemQuests, saveCompletedItemQuests };
}
