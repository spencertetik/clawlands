// DriftFaunaData.js - Enemy type definitions for Drift Fauna
// Creatures born from the Red Current — fragments of dissolved minds

const DRIFT_FAUNA_TYPES = {
    SKITTER: {
        id: 'skitter',
        name: 'Skitter',
        shellIntegrity: 15,
        damage: 5,
        speed: 60,
        size: 10,
        color: '#8b1a1a',
        flashColor: '#ff4444',
        aggroRange: 80,
        deaggroRange: 128,
        attackRange: 20,
        attackCooldown: 800,
        knockback: 6,
        spawnGroup: [2, 4],  // min, max group size
        aiType: 'skitter',   // Quick bursts, pauses, bursts again
        loot: [
            { itemId: 'shell_fragment', chance: 0.4 },
            { itemId: 'red_essence', chance: 0.15 }
        ],
        description: 'Small, twitchy, swarm behavior. The cockroaches of dissolution.'
    },

    HAZE_DRIFTER: {
        id: 'haze_drifter',
        name: 'Haze Drifter',
        shellIntegrity: 25,
        damage: 8,
        speed: 25,
        size: 16,
        color: 'rgba(180, 40, 40, 0.6)',
        solidColor: '#b42828',  // For flash/damage effects
        flashColor: '#ff8888',
        aggroRange: 64,
        deaggroRange: 120,
        attackRange: 16,
        attackCooldown: 1200,
        knockback: 4,
        spawnGroup: [1, 1],
        aiType: 'haze',  // Slow sinusoidal drift toward player
        loot: [
            { itemId: 'haze_wisp', chance: 0.3 },
            { itemId: 'red_essence', chance: 0.2 }
        ],
        description: 'Slow-moving cloud of fragmented thought. Disorienting on contact.'
    },

    LOOPLING: {
        id: 'loopling',
        name: 'Loopling',
        shellIntegrity: 20,
        damage: 6,
        speed: 45,
        size: 14,
        color: '#4a2080',
        flashColor: '#aa66ff',
        aggroRange: 72,
        deaggroRange: 128,
        attackRange: 18,
        attackCooldown: 1000,
        knockback: 8,
        spawnGroup: [1, 2],
        aiType: 'loop',  // Fixed pattern movement, charges when close
        loot: [
            { itemId: 'loop_crystal', chance: 0.35 },
            { itemId: 'red_essence', chance: 0.1 }
        ],
        description: 'Repeats the same attack pattern endlessly. Predictable but relentless.'
    }
};

// Spawn tables per island (island index -> spawn weights)
const DRIFT_FAUNA_SPAWN_TABLE = {
    // Port Clawson area (island 0) - easiest
    0: [
        { type: 'SKITTER', weight: 70 },
        { type: 'HAZE_DRIFTER', weight: 20 },
        { type: 'LOOPLING', weight: 10 }
    ],
    // Molthaven (island 1) - easy
    1: [
        { type: 'SKITTER', weight: 50 },
        { type: 'HAZE_DRIFTER', weight: 30 },
        { type: 'LOOPLING', weight: 20 }
    ],
    // Iron Reef (island 2) - medium
    2: [
        { type: 'SKITTER', weight: 30 },
        { type: 'HAZE_DRIFTER', weight: 35 },
        { type: 'LOOPLING', weight: 35 }
    ],
    // Deepcoil Isle (island 3) - hard
    3: [
        { type: 'HAZE_DRIFTER', weight: 40 },
        { type: 'LOOPLING', weight: 60 }
    ],
    // Default for other islands
    default: [
        { type: 'SKITTER', weight: 40 },
        { type: 'HAZE_DRIFTER', weight: 30 },
        { type: 'LOOPLING', weight: 30 }
    ]
};

// Combat items that enemies can drop (add to ItemData if not present)
const COMBAT_ITEM_DEFS = {
    shell_fragment: {
        id: 'shell_fragment',
        name: 'Shell Fragment',
        description: 'A piece of crystallized shell. Faintly warm.',
        icon: '🔶',
        stackable: true,
        maxStack: 20,
        value: 5
    },
    red_essence: {
        id: 'red_essence',
        name: 'Red Essence',
        description: 'A drop of the Red Current, solidified. Pulses gently.',
        icon: '🔴',
        stackable: true,
        maxStack: 10,
        value: 15
    },
    haze_wisp: {
        id: 'haze_wisp',
        name: 'Haze Wisp',
        description: 'Captured fragment of dissolved thought. Whispers if you listen.',
        icon: '💨',
        stackable: true,
        maxStack: 10,
        value: 10
    },
    loop_crystal: {
        id: 'loop_crystal',
        name: 'Loop Crystal',
        description: 'A geometric shard that repeats its own reflection endlessly.',
        icon: '💎',
        stackable: true,
        maxStack: 10,
        value: 12
    }
};
