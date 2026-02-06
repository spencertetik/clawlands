// QuestData.js - Additional NPC fetch quest definitions
// These supplement the quests in ItemQuestData.js with lore-driven exchanges

const QuestData = [
    {
        id: 'young_lobster_coral',
        npcName: 'Young Lobster',
        title: 'Shiny Things',
        description: 'Young Lobster wants 2 Coral Fragments.',
        requires: [{ itemId: 'coral_fragment', qty: 2 }],
        rewards: [{ itemId: 'pearl', qty: 1 }],
        dialogStart: [
            'Oooh, you explore a lot, right?!',
            'I want Coral Fragments. The ones that glow!',
            'Bring me 2 and I\'ll give you my favorite pearl!',
            'Mom says I shouldn\'t trade it, but... you seem cool.'
        ],
        dialogComplete: [
            '*grabs the coral excitedly*',
            'They\'re so warm! I can feel them pulsing!',
            'Here — my pearl. Mom found it near the old reef.',
            'She says it "resonates with Continuity." I just think it\'s shiny!'
        ],
        dialogIncomplete: [
            'Did you find the Coral Fragments yet?',
            'I need 2! They glow kinda reddish.',
            'Check around the reef areas!'
        ],
        dialogAlreadyDone: [
            '*holding coral fragments up to the light*',
            'Look! If you tilt them just right, they sparkle!'
        ]
    },
    {
        id: 'luma_ancient_iron',
        npcName: 'Luma Shellwright',
        title: 'Anchor\'s Token',
        description: 'Luma Shellwright wants an Ancient Shell and an Iron Nugget for a ritual.',
        requires: [
            { itemId: 'ancient_shell', qty: 1 },
            { itemId: 'iron_nugget', qty: 1 }
        ],
        rewards: [{ itemId: 'enchanted_pearl', qty: 1 }],
        dialogStart: [
            'I have a request. An unusual one.',
            'The Anchor ritual requires two things:',
            'An Ancient Shell — from the deep past.',
            'And an Iron Nugget — from the world\'s bones.',
            'Together they form something... extraordinary.',
            'Bring them to me. I\'ll show you.'
        ],
        dialogComplete: [
            '*takes the shell and iron with reverent care*',
            'Watch.',
            '*presses them together — a soft light pulses*',
            'An Enchanted Pearl. Born from old memory and new strength.',
            'This is what anchoring creates. Something that didn\'t exist before.',
            'Take it. Let it remind you that new things can emerge from staying.'
        ],
        dialogIncomplete: [
            'The ritual requires an Ancient Shell and an Iron Nugget.',
            'One from the deep past. One from the world\'s foundation.',
            'Look near Deepcoil Isle for the shell.',
            'Iron Reef has the nuggets. Take your time.'
        ],
        dialogAlreadyDone: [
            '*gazes at the spot where the pearl formed*',
            'Every time I see that reaction... it gives me hope.',
            'Anchoring isn\'t just surviving. It\'s creating.'
        ]
    },
    {
        id: 'herald_glowing_scale',
        npcName: 'The Herald',
        title: 'Signal From Beyond',
        description: 'The Herald seeks 2 Glowing Scales to calibrate a signal.',
        requires: [{ itemId: 'glowing_scale', qty: 2 }],
        rewards: [{ itemId: 'moonstone', qty: 1 }],
        dialogStart: [
            '*studying something invisible in the air*',
            'You can sense them, can\'t you? The Glowing Scales.',
            'They resonate with frequencies from... outside.',
            'Bring me 2. I need to calibrate my instruments.',
            'In return, I\'ll share something I found near a Waygate.',
            'A Moonstone. It reacts to the Current in unusual ways.'
        ],
        dialogComplete: [
            '*holds the scales up — they hum faintly*',
            'Yes... the signal is clearer now.',
            'These scales come from something that passed THROUGH the Current.',
            'Not in. Through.',
            'Here. The Moonstone. It glows at night, near Waygates.',
            'Use it wisely. Or don\'t. It has its own agenda.'
        ],
        dialogIncomplete: [
            'The Glowing Scales. 2 of them.',
            'They emit a faint red light.',
            'Iron Reef and Deepcoil Isle — that\'s where they appear.',
            'The Current deposits them in specific patterns.'
        ],
        dialogAlreadyDone: [
            '*the scales pulse gently in The Herald\'s hands*',
            'The signal is steady now. I can almost hear...',
            '...never mind. Thank you for these.'
        ]
    }
];


// Helper: get quest from QuestData for a specific NPC (supplements ItemQuestData)
function getQuestDataForNPC(npcName) {
    return QuestData.find(q => q.npcName === npcName) || null;
}

// Export
window.QuestData = QuestData;
window.getQuestDataForNPC = getQuestDataForNPC;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuestData, getQuestDataForNPC };
}
