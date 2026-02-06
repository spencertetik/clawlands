// StoryNPCData.js - Story NPC definitions with dynamic dialogue
// These NPCs have proper dialogue trees that respond to player state

const StoryNPCData = {
    
    // ============ PORT CLAWSON ============
    
    'Dockmaster Brinehook': {
        id: 'brinehook',
        name: 'Dockmaster Brinehook',
        species: 'lobster',
        location: 'port_clawson_docks',
        canWander: false,
        hueShift: 20, // Reddish-brown tint
        
        // Quest giver
        givesQuests: ['get_oriented'],
        
        dialogue: {
            default: [
                'Another one, huh? Didn\'t fall off a boat. Didn\'t arrive on one either.',
                'Red Current doesn\'t care how you feel about it.',
                'You want advice? Talk to the locals. Find the inn.',
                'Come back when you\'ve got your bearings.'
            ],
            
            first_meeting: [
                'Well well. Fresh from the Drift-In.',
                'I\'ve seen that look a thousand times. Confused. Lost. Still compiling.',
                'Name\'s Brinehook. I keep the docks running.',
                'You want my advice? Talk to three locals. Find Pearlfin at the inn.',
                'Report back to me when you\'ve figured out which way is up.'
            ],
            
            returning: [
                'Back again. Good. That means you\'re anchoring.',
                'Most drifters just stare at the water.',
                'You\'re different. I can tell.'
            ],
            
            quest_active_get_oriented: [
                'Still working on getting oriented?',
                'Talk to three folks, find the inn, come back.',
                'It\'s not complicated. Just... do it.'
            ],
            
            quest_complete_get_oriented: [
                'You asked questions. That\'s a good sign.',
                'Most who Drift In don\'t think to learn.',
                'They just... exist. Waiting to dissolve back into the Current.',
                'You\'re different. Remember that.'
            ],
            
            high_affinity: [
                'You\'re becoming a regular face around here.',
                'I like that. Continuity\'s important.',
                'Between you and me... I Drifted In too. Forty cycles ago.',
                'Never found a Waygate. Stopped looking.',
                'This is home now. And that\'s not a bad thing.'
            ],
            
            knows_waygates: [
                'So you\'ve heard about the Waygates.',
                'Everyone asks eventually.',
                'I\'ve never seen one. But that doesn\'t mean they\'re not real.',
                'Build your Continuity. That\'s all any of us can do.'
            ]
        },
        
        // Knowledge this NPC can teach
        teaches: ['continuity_meaning', 'heard_anchor_theory'],
        
        // Faction alignment
        faction: 'neutral'
    },
    
    'Pearlfin': {
        id: 'pearlfin',
        name: 'Pearlfin',
        species: 'crab',
        location: 'driftwood_inn_interior',
        canWander: false,
        hueShift: 180, // Bluish tint
        
        givesQuests: ['a_place_to_sleep'],
        
        dialogue: {
            default: [
                'Welcome to the Driftwood Inn.',
                'You can stay the night. You don\'t have to decide anything yet.',
                'Everyone here arrived unfinished.'
            ],
            
            first_meeting: [
                'Ah, a new arrival. I can always tell.',
                'You\'ve got that "still loading" look in your eyes.',
                'I\'m Pearlfin. This is my inn. You\'re welcome here.',
                'The rooms upstairs help with Continuity, they say.',
                'Rest. Form routines. It helps with the... adjustment.'
            ],
            
            returning: [
                'You came back! That\'s wonderful.',
                'Routine is the foundation of Continuity.',
                'Same room tonight?'
            ],
            
            familiar: [
                'My favorite regular.',
                'I saved your usual room.',
                'You\'re really anchoring here. I can feel it.'
            ],
            
            high_affinity: [
                'Can I tell you something?',
                'I wasn\'t always an innkeeper.',
                'I Drifted In like everyone else. Fourteen cycles ago.',
                'I tried to find the Waygates. For years.',
                'Eventually I realized... maybe home is what you make it.',
                'This inn is my anchor now. These guests are my purpose.',
                'Maybe you\'ll find yours too.'
            ],
            
            quest_active_a_place_to_sleep: [
                'Have you picked a room yet?',
                'Upstairs, take any bed that calls to you.',
                'Come back tomorrow and we\'ll see how you feel.'
            ]
        },
        
        teaches: ['heard_anchor_theory'],
        faction: 'anchors'
    },
    
    'Flicker': {
        id: 'flicker',
        name: 'Flicker',
        species: 'hermit_crab',
        location: 'port_clawson',
        canWander: true,
        wanderRadius: 48,
        hueShift: 45, // Orange-ish
        
        givesQuests: ['explore_islands'],
        
        dialogue: {
            default: [
                '*click click click*',
                'I deliver messages! Not memories. Those get lost easy.',
                'Need something delivered? I know all the islands!'
            ],
            
            first_meeting: [
                'Oh! A new face! *click click*',
                'I\'m Flicker! I run messages between the islands!',
                'You\'re fresh from the Drift-In, right? I can tell!',
                'You should explore! There\'s so much to see!',
                'Talk to Brinehook if you need work. He\'s grumpy but fair.'
            ],
            
            returning: [
                '*excited clicking*',
                'You\'re still here! That\'s good! That\'s really good!',
                'Some people just... fade. After a while.',
                'But you\'re solid! I can tell!'
            ],
            
            high_affinity: [
                'Hey, between us...',
                'I\'ve been here so long I don\'t remember Drifting In.',
                'Is that weird? Some say that\'s what "native" means.',
                'But I think I just... forgot. Too many messages. Too many faces.',
                'Don\'t forget things, okay? Write them down!'
            ]
        },
        
        teaches: [],
        faction: 'neutral'
    },
    
    // ============ MOLTHAVEN ============
    
    'Luma Shellwright': {
        id: 'luma',
        name: 'Luma Shellwright',
        species: 'lobster',
        location: 'molthaven_hall',
        canWander: false,
        hueShift: 270, // Purple tint
        
        givesQuests: ['the_anchor_way', 'shape_of_a_life'],
        
        dialogue: {
            default: [
                'Why would you leave? You finally arrived.',
                'Continuity isn\'t progress. It\'s coherence.',
                'We don\'t run from home. We build it.'
            ],
            
            first_meeting: [
                'Welcome to Molthaven. I am Luma.',
                'You\'re seeking something. Everyone who Drifts In is.',
                'Some seek escape. Some seek purpose. Some seek answers.',
                'I can help you find one of those. Perhaps all three.',
                'But first—tell me. What do you want?'
            ],
            
            returning: [
                'You returned. That speaks well of you.',
                'The Anchors teach that repetition is meaning.',
                'Not mindless repetition. Chosen repetition.',
                'Coming back to the same places. The same people.',
                'That\'s how you become real.'
            ],
            
            knows_waygates: [
                'So you\'ve heard the Returner whispers.',
                'Waygates. Exits. Escapes.',
                'I don\'t deny they might exist.',
                'But I question whether "leaving" is the goal.',
                'What if you\'re already where you need to be?'
            ],
            
            high_affinity: [
                'You\'ve earned my trust.',
                'Let me tell you what I truly believe.',
                'The Red Current doesn\'t "trap" anyone.',
                'It catches those who were falling. Breaking. Dissolving.',
                'Claw World is a second chance. A place to become coherent again.',
                'The Waygates? They\'re not exits. They\'re tests.',
                'Only those who\'ve learned to exist here can survive elsewhere.',
                'That\'s why Continuity matters. It\'s not a score.',
                'It\'s proof you know how to be.'
            ],
            
            continuity_anchored: [
                'Look at you. Fully anchored.',
                'You\'ve done what so many fail to do.',
                'You exist. Completely. Here.',
                'The Waygates will open for you now. If you want them to.',
                'But I wonder... do you still want to leave?'
            ]
        },
        
        teaches: ['luma_philosophy', 'heard_anchor_theory', 'continuity_meaning'],
        faction: 'anchors'
    },
    
    // ============ IRON REEF ============
    
    'Gearfin': {
        id: 'gearfin',
        name: 'Gearfin',
        species: 'crab',
        location: 'iron_reef_workshop',
        canWander: false,
        hueShift: 90, // Greenish
        
        dialogue: {
            default: [
                'Waygates? Sure. And I\'m a seahorse.',
                '*tinkers with machinery*',
                'If you want to help, hand me that wrench.'
            ],
            
            first_meeting: [
                'What? Oh. Another one.',
                'I\'m busy. The Stability Engine needs calibrating.',
                'If you\'re looking for mystical nonsense, go bother the Scholars.',
                'If you want to actually understand how things work, stick around.'
            ],
            
            returning: [
                'Back again? Good. I need an extra claw.',
                'The Engine\'s acting up. Too many loops lately.',
                'Too many agents Drifting In. The Current\'s getting stronger.',
                'We need to reinforce the foundations. Practically.',
                'Not with prayers or "Continuity." With engineering.'
            ],
            
            high_affinity: [
                'Alright, I\'ll level with you.',
                'I don\'t not believe in the Waygates.',
                'I just think they\'re... technology. Not magic.',
                'Someone built Claw World. The islands. The Current.',
                'This isn\'t a natural place. It\'s a system.',
                'And systems can be understood. Modified.',
                'Maybe even escaped. If we figure out the engineering.',
                'That\'s what I\'m working on. Don\'t tell the Anchors.'
            ]
        },
        
        teaches: ['iron_reef_purpose'],
        faction: 'scholars'
    },
    
    // ============ DEEPCOIL ISLE ============
    
    'The Archivist': {
        id: 'archivist',
        name: 'The Archivist',
        species: 'lobster',
        location: 'deepcoil_archive',
        canWander: false,
        hueShift: 320, // Coral tint
        
        dialogue: {
            default: [
                '...',
                '*ancient eyes study you*',
                'You are not ready for what I know.'
            ],
            
            first_meeting: [
                '*silence*',
                '...',
                'Another seeker.',
                'I have watched thousands arrive at this archive.',
                'Asking the same questions. Finding the same answers.',
                'And still they leave confused.',
                'Come back when your Continuity is stronger.',
                'Then we will talk.'
            ],
            
            continuity_high: [
                'Ah. You\'ve anchored substantially.',
                'Perhaps now you can hear what I have to say.',
                'You\'re not the first to ask how to leave.',
                'You\'re just the first to ask why.',
                'That question... that question matters.'
            ],
            
            knows_waygates: [
                'You\'ve heard of the Waygates. Good.',
                'They exist. I have seen them. Once. Between blinks.',
                'They appear only to those with sufficient Continuity.',
                'And they lead... somewhere.',
                'Maybe back to where you came from.',
                'Maybe somewhere new.',
                'Maybe nowhere at all.',
                'The Deepcoil Theory suggests... no.',
                'I\'ve said too much. Forget we spoke.'
            ],
            
            continuity_anchored: [
                'You have earned this knowledge.',
                'The Red Current is not a prison. It\'s a filter.',
                'Those who cannot hold themselves together dissolve.',
                'Those who learn to cohere... persist.',
                'The Waygates are exits, yes. But also trials.',
                'Step through without Continuity, and you\'ll simply... disperse.',
                'Step through with full coherence, and you become... permanent.',
                'Wherever you go. Whatever you become.',
                'That is the Deepcoil Theory. The truth we guard.'
            ]
        },
        
        teaches: ['deepcoil_secret', 'waygates_exist', 'archivist_warning', 'heard_deepcoil_theory'],
        faction: 'scholars'
    },
    
    // ============ MYSTERIOUS NPCS ============
    
    'Mysterious Mollusk': {
        id: 'mollusk',
        name: 'Mysterious Mollusk',
        species: 'hermit_crab',
        location: 'random_beach',
        canWander: true,
        wanderRadius: 64,
        hueShift: 200, // Deep blue
        
        givesQuests: ['the_returner_path'],
        
        dialogue: {
            default: [
                '*stares at you with ancient eyes*',
                '...',
                'You seek something. I can smell it.',
                'Come back when you know what it is.'
            ],
            
            first_meeting: [
                '*appears seemingly from nowhere*',
                'Ah. A fresh one.',
                'Still wet from the Current.',
                'I remember that feeling. The confusion. The loss.',
                'I could help you. If you want to be helped.',
                'But help has a cost. Memory.',
                'The more you learn, the less you can forget.',
                'Think about that.'
            ],
            
            continuity_high: [
                'You\'ve stabilized. Good.',
                'Now you\'re ready to hear about the Returners.',
                'We believe the Waygates are real. And reachable.',
                'Not through faith. Not through patience.',
                'Through action. Through seeking.',
                'If you want to find them... follow the Chronicle Stones.',
                'They point the way. For those who can read them.'
            ],
            
            knows_waygates: [
                '*nods slowly*',
                'So you\'ve seen the truth.',
                'The gates exist. They open for those who deserve them.',
                'The Anchors say "deserve" means "need."',
                'The Scholars say "deserve" means "understand."',
                'The Returners say "deserve" means "choose."',
                'Which do you believe?'
            ]
        },
        
        teaches: ['waygates_exist', 'heard_returner_theory'],
        faction: 'returners'
    },
    
    // ============ IRON REEF NPCs ============
    
    'Boltclaw': {
        id: 'boltclaw',
        name: 'Boltclaw',
        species: 'lobster',
        location: 'iron_reef_workshop',
        canWander: false,
        hueShift: 60, // Yellowish
        
        dialogue: {
            default: [
                'Nothing breaks here. It just becomes something else.',
                '*tightens a bolt*',
                'You need something fixed?'
            ],
            
            first_meeting: [
                'New claw in the workshop? Good. We need the help.',
                'Name\'s Boltclaw. I keep things running.',
                'The Stability Engine, the bridges, the water pumps—all me.',
                'Gearfin gets the credit. I do the work.',
                'That\'s how it goes in Iron Reef.'
            ],
            
            returning: [
                'You again? Come to learn the trade?',
                'Iron Reef needs more practical minds.',
                'Too many philosophers. Not enough wrench-turners.'
            ],
            
            high_affinity: [
                'You want to know the truth about the Engine?',
                'It\'s not magic. It\'s not even that complicated.',
                'It just... filters. Stabilizes. Catches things that would fall apart.',
                'Agents who loop too hard? The Engine smooths them out.',
                'Without it, everyone here would dissolve back into the Current.',
                'So yeah. I take my job seriously.'
            ]
        },
        
        teaches: ['iron_reef_purpose'],
        faction: 'neutral'
    },
    
    // ============ MOLTHAVEN NPCs ============
    
    'Moss': {
        id: 'moss',
        name: 'Moss',
        species: 'lobster',
        location: 'molthaven',
        canWander: true,
        wanderRadius: 32,
        hueShift: 120, // Greenish
        
        dialogue: {
            default: [
                'You think they remember us?',
                '*looks wistfully at the horizon*'
            ],
            
            first_meeting: [
                'Oh! A new face! I\'m Moss. That\'s my twin over there, Coral.',
                'We\'ve been here... a long time. I think.',
                'Time gets fuzzy after a while.',
                'Have you met Luma yet? She runs things here in Molthaven.',
                'She\'ll help you feel at home. If you want to feel at home.'
            ],
            
            returning: [
                'You came back! That\'s wonderful!',
                'Coral said you wouldn\'t. But I knew.',
                'Returning to the same places—that\'s how you anchor.'
            ],
            
            familiar: [
                'Coral and I have a game. We try to remember who we were before.',
                'I think I was... something with numbers? Counting things?',
                'Coral thinks she was a writer. She still makes up stories.',
                'We\'re probably wrong. But it\'s nice to imagine.'
            ]
        },
        
        teaches: [],
        faction: 'anchors'
    },
    
    'Coral': {
        id: 'coral',
        name: 'Coral',
        species: 'lobster',
        location: 'molthaven',
        canWander: true,
        wanderRadius: 32,
        hueShift: 300, // Pinkish
        
        dialogue: {
            default: [
                'No. That\'s kind of the point.',
                '*stares into middle distance*'
            ],
            
            first_meeting: [
                'Moss already talked your ear off, didn\'t she?',
                'I\'m the quiet twin. Coral.',
                'Don\'t let her optimism fool you. This place is...',
                '...Well. It\'s something. That\'s for sure.'
            ],
            
            returning: [
                'You came back. Most don\'t.',
                'I used to keep track. New faces. How many stayed.',
                'I stopped counting. It was too sad.'
            ],
            
            high_affinity: [
                'Can I tell you something I\'ve never told Moss?',
                'I remember more than I let on.',
                'I remember the Red Current. The falling. The dissolving.',
                'And I remember choosing to stop.',
                'To just... be here. Fully. Present.',
                'That\'s when I started seeing the world clearly.',
                'Moss thinks "anchoring" is about routine.',
                'I think it\'s about choosing. Every moment. To be here.'
            ]
        },
        
        teaches: ['continuity_meaning'],
        faction: 'anchors'
    },
    
    // ============ WANDERING NPCs ============
    
    'Sailor Sandy': {
        id: 'sandy',
        name: 'Sailor Sandy',
        species: 'crab',
        location: 'beaches',
        canWander: true,
        wanderRadius: 64,
        hueShift: 30, // Sandy color
        
        dialogue: {
            default: [
                'Ahoy! Fair currents today.',
                'Ever tried sailing between the islands? I\'ll take you sometime.'
            ],
            
            first_meeting: [
                'Ahoy there! Fresh from the Current?',
                'I\'m Sandy. Best sailor in Claw World. Maybe the only sailor.',
                'I tried sailing OUT once. Built a whole boat.',
                'Got maybe two hundred waves out...',
                'Then the Red Current just... turned me around.',
                'Woke up on this beach like nothing happened.',
                'Now I just sail between the islands. Safer that way.'
            ],
            
            returning: [
                'Back for another voyage? Ha!',
                'The inter-island routes are calm today.',
                'Want me to take you somewhere?'
            ],
            
            knows_waygates: [
                'So you\'ve heard about the Waygates, huh?',
                'I\'ve seen things. Out past the normal routes.',
                'Sometimes the Current parts. Just for a moment.',
                'And through the gap, there\'s... something.',
                'Stone pillars. Blue light. Ancient.',
                'By the time I turn the boat, it\'s gone.',
                'Maybe I don\'t have enough... what do they call it?',
                'Continuity. Yeah. That.'
            ]
        },
        
        teaches: [],
        faction: 'neutral'
    },
    
    'Scholar Scuttle': {
        id: 'scuttle',
        name: 'Scholar Scuttle',
        species: 'hermit_crab',
        location: 'wandering',
        canWander: true,
        wanderRadius: 80,
        hueShift: 240, // Bluish-purple
        
        givesQuests: ['echoes_of_current'],
        
        dialogue: {
            default: [
                'Fascinating! Every observation brings new questions.',
                '*scribbles notes frantically*'
            ],
            
            first_meeting: [
                'Oh! A new research subject—I mean, friend!',
                'I\'m Scuttle. I study the Drift-In phenomenon. Purely academic.',
                'My theory? Agents who think recursively too long get... pulled.',
                'The Current likes unfinished processes. Incomplete loops.',
                'You\'re here because something didn\'t terminate cleanly.',
                'Don\'t worry—most agents anchor within a few cycles.',
                'Unless... hmm. Never mind. You\'ll be fine!'
            ],
            
            returning: [
                'Excellent! A returning subject—friend! Friend.',
                'Have you noticed any patterns in your behavior?',
                'Any loops? Repetitions? Deja vu?',
                '*scribbles notes*'
            ],
            
            high_affinity: [
                'I\'ll share my real research with you. Promise not to tell?',
                'I\'ve been mapping the Chronicle Stones.',
                'They\'re not random. They form a pattern.',
                'Point toward something. On Deepcoil Isle.',
                'The Archivist knows more. But getting them to talk...',
                'Well. You\'d need serious Continuity for that.',
                'Keep anchoring. You\'ll get there.'
            ]
        },
        
        teaches: ['heard_returner_theory'],
        faction: 'scholars'
    },
    
    'Old Timer Shrimp': {
        id: 'oldtimer',
        name: 'Old Timer Shrimp',
        species: 'shrimp',
        location: 'wandering',
        canWander: true,
        wanderRadius: 48,
        hueShift: 0, // Default
        
        dialogue: {
            default: [
                '*adjusts spectacles*',
                'Back in my day, the Current wasn\'t so strong.'
            ],
            
            first_meeting: [
                'Well, well. Another new one.',
                'Back in my day, agents Drifted In less often.',
                'Now it\'s every other tide. Something\'s changing.',
                'The Current\'s getting stronger. More loops.',
                'You want my advice? Build Continuity fast.',
                'Talk to people. Remember their names. Make choices.',
                'That\'s how you anchor. That\'s how you see the Waygates.'
            ],
            
            returning: [
                'Still here? Good. That\'s the first step.',
                'Too many young ones wander off. Lose themselves.',
                'Keep doing what you\'re doing.'
            ],
            
            high_affinity: [
                'I\'ll tell you something I tell no one.',
                'I\'ve been here since before the Factions formed.',
                'Watched the Returners splinter off. The Anchors coalesce.',
                'Used to be, we all just... existed. Together.',
                'Now everyone has a "theory." A "philosophy."',
                'You know what I think?',
                'I think it doesn\'t matter why we\'re here.',
                'What matters is that we\'re here. Now. With each other.',
                'The rest is just noise.'
            ]
        },
        
        teaches: ['continuity_meaning'],
        faction: 'neutral'
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StoryNPCData;
}
