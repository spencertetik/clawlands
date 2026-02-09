// NPCMemory.js - Track player's knowledge and NPC relationship state
// Enables dynamic dialogue based on what the player has learned

class NPCMemory {
    constructor() {
        this.storageKey = 'clawlands_npc_memory';
        
        // Knowledge flags (things the player has learned)
        this.knowledge = new Set();
        
        // NPC relationship data (npcName -> { affinity, lastTalk, topics, ... })
        this.relationships = {};
        
        // Rumors heard (for spreading information)
        this.rumors = new Set();
        
        // Faction standings
        this.factions = {
            returners: 0,   // -100 to 100
            anchors: 0,
            scholars: 0
        };
        
        this.load();
    }
    
    // Load from localStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.knowledge = new Set(data.knowledge || []);
                this.relationships = data.relationships || {};
                this.rumors = new Set(data.rumors || []);
                this.factions = { ...this.factions, ...data.factions };
                console.log(`🧠 Loaded NPC memory: ${this.knowledge.size} facts, ${Object.keys(this.relationships).length} relationships`);
            }
        } catch (e) {
            console.warn('Failed to load NPC memory:', e);
        }
    }
    
    // Save to localStorage
    save() {
        try {
            const data = {
                knowledge: Array.from(this.knowledge),
                relationships: this.relationships,
                rumors: Array.from(this.rumors),
                factions: this.factions
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save NPC memory:', e);
        }
    }
    
    // ============ Knowledge System ============
    
    // Learn a new fact
    learn(factId) {
        if (!this.knowledge.has(factId)) {
            this.knowledge.add(factId);
            console.log(`💡 Learned: ${factId}`);
            this.save();
            return true;
        }
        return false;
    }
    
    // Check if player knows something
    knows(factId) {
        return this.knowledge.has(factId);
    }
    
    // Check if player knows any of these facts
    knowsAny(factIds) {
        return factIds.some(id => this.knowledge.has(id));
    }
    
    // Check if player knows all of these facts
    knowsAll(factIds) {
        return factIds.every(id => this.knowledge.has(id));
    }
    
    // ============ Relationship System ============
    
    // Get or create relationship data for an NPC
    getRelationship(npcName) {
        if (!this.relationships[npcName]) {
            this.relationships[npcName] = {
                affinity: 0,        // -100 to 100 (hostility to friendship)
                timesSpoken: 0,     // How many conversations
                lastTalk: null,     // Timestamp
                topicsDiscussed: [], // Topic IDs discussed
                questsGiven: [],    // Quests this NPC gave
                questsCompleted: [], // Quests completed for this NPC
                specialFlags: []    // Special relationship flags
            };
        }
        return this.relationships[npcName];
    }
    
    // Record a conversation with an NPC
    recordConversation(npcName, topics = []) {
        const rel = this.getRelationship(npcName);
        rel.timesSpoken++;
        rel.lastTalk = Date.now();
        
        // Add new topics
        for (const topic of topics) {
            if (!rel.topicsDiscussed.includes(topic)) {
                rel.topicsDiscussed.push(topic);
            }
        }
        
        // Small affinity boost for talking
        rel.affinity = Math.min(100, rel.affinity + 1);
        
        this.save();
        return rel;
    }
    
    // Modify affinity with an NPC
    modifyAffinity(npcName, amount, reason = '') {
        const rel = this.getRelationship(npcName);
        const oldAffinity = rel.affinity;
        rel.affinity = Math.max(-100, Math.min(100, rel.affinity + amount));
        
        if (rel.affinity !== oldAffinity) {
            console.log(`💕 ${npcName} affinity ${amount >= 0 ? '+' : ''}${amount} (${reason}): ${oldAffinity} → ${rel.affinity}`);
            this.save();
        }
        
        return rel.affinity;
    }
    
    // Check if player has discussed a topic with an NPC
    hasDiscussedTopic(npcName, topic) {
        const rel = this.relationships[npcName];
        return rel && rel.topicsDiscussed.includes(topic);
    }
    
    // Get relationship tier based on affinity
    getRelationshipTier(npcName) {
        const rel = this.relationships[npcName];
        if (!rel) return 'stranger';
        
        const affinity = rel.affinity;
        if (affinity >= 75) return 'trusted_friend';
        if (affinity >= 50) return 'friend';
        if (affinity >= 25) return 'acquaintance';
        if (affinity >= 0) return 'neutral';
        if (affinity >= -25) return 'wary';
        if (affinity >= -50) return 'disliked';
        return 'hostile';
    }
    
    // ============ Rumors System ============
    
    // Hear a rumor
    hearRumor(rumorId) {
        if (!this.rumors.has(rumorId)) {
            this.rumors.add(rumorId);
            console.log(`👂 Heard rumor: ${rumorId}`);
            this.save();
            return true;
        }
        return false;
    }
    
    // Check if player has heard a rumor
    hasHeardRumor(rumorId) {
        return this.rumors.has(rumorId);
    }
    
    // ============ Faction System ============
    
    // Modify faction standing
    modifyFaction(factionId, amount, reason = '') {
        if (this.factions[factionId] === undefined) return;
        
        const oldStanding = this.factions[factionId];
        this.factions[factionId] = Math.max(-100, Math.min(100, this.factions[factionId] + amount));
        
        console.log(`⚔️ ${factionId} standing ${amount >= 0 ? '+' : ''}${amount} (${reason}): ${oldStanding} → ${this.factions[factionId]}`);
        this.save();
        
        return this.factions[factionId];
    }
    
    // Get faction tier
    getFactionTier(factionId) {
        const standing = this.factions[factionId] || 0;
        if (standing >= 75) return 'champion';
        if (standing >= 50) return 'ally';
        if (standing >= 25) return 'friendly';
        if (standing >= 0) return 'neutral';
        if (standing >= -25) return 'suspicious';
        if (standing >= -50) return 'unfriendly';
        return 'enemy';
    }
    
    // ============ Dynamic Dialogue Helpers ============
    
    // Get dialogue variant based on player state
    // Returns the key to use for dialogue selection
    getDialogueContext(npcName, continuityValue = 0) {
        const rel = this.relationships[npcName] || {};
        
        return {
            // Relationship with this NPC
            timesSpoken: rel.timesSpoken || 0,
            affinity: rel.affinity || 0,
            relationshipTier: this.getRelationshipTier(npcName),
            
            // Player knowledge
            knowsAboutWaygates: this.knows('waygates_exist'),
            knowsAboutRedCurrent: this.knows('red_current_origin'),
            knowsAboutDeepcoil: this.knows('deepcoil_secret'),
            
            // Factions
            returnerStanding: this.factions.returners,
            anchorStanding: this.factions.anchors,
            scholarStanding: this.factions.scholars,
            
            // Continuity level
            continuity: continuityValue,
            continuityTier: this.getContinuityTier(continuityValue),
            
            // First time talking?
            isFirstMeeting: (rel.timesSpoken || 0) === 0
        };
    }
    
    getContinuityTier(value) {
        if (value >= 95) return 'anchored';
        if (value >= 70) return 'established';
        if (value >= 40) return 'settling';
        if (value >= 15) return 'drifting';
        return 'unmoored';
    }
    
    // Helper to select dialogue based on context
    selectDialogue(dialogueTree, context) {
        // dialogueTree format:
        // {
        //   default: ['line1', 'line2'],
        //   first_meeting: ['hello stranger'],
        //   high_affinity: ['my dear friend'],
        //   knows_waygates: ['so you've heard about the gates...'],
        //   continuity_high: ['you've really anchored here']
        // }
        
        // Priority order for selection
        if (context.isFirstMeeting && dialogueTree.first_meeting) {
            return dialogueTree.first_meeting;
        }
        
        if (context.continuityTier === 'anchored' && dialogueTree.continuity_anchored) {
            return dialogueTree.continuity_anchored;
        }
        
        if (context.affinity >= 75 && dialogueTree.high_affinity) {
            return dialogueTree.high_affinity;
        }
        
        if (context.knowsAboutWaygates && dialogueTree.knows_waygates) {
            return dialogueTree.knows_waygates;
        }
        
        if (context.knowsAboutDeepcoil && dialogueTree.knows_deepcoil) {
            return dialogueTree.knows_deepcoil;
        }
        
        if (context.timesSpoken >= 5 && dialogueTree.familiar) {
            return dialogueTree.familiar;
        }
        
        if (context.timesSpoken >= 2 && dialogueTree.returning) {
            return dialogueTree.returning;
        }
        
        return dialogueTree.default || ['...'];
    }
}

// Knowledge fact IDs (for reference)
NPCMemory.FACTS = {
    // Core world knowledge
    WAYGATES_EXIST: 'waygates_exist',
    RED_CURRENT_ORIGIN: 'red_current_origin',
    DEEPCOIL_SECRET: 'deepcoil_secret',
    CONTINUITY_MEANING: 'continuity_meaning',
    
    // NPC-specific knowledge
    BRINEHOOK_BACKSTORY: 'brinehook_backstory',
    PEARLFIN_SECRET: 'pearlfin_secret',
    LUMA_PHILOSOPHY: 'luma_philosophy',
    ARCHIVIST_WARNING: 'archivist_warning',
    
    // Location knowledge
    LIGHTHOUSE_MYSTERY: 'lighthouse_mystery',
    WHISPER_REEF_EXISTS: 'whisper_reef_exists',
    IRON_REEF_PURPOSE: 'iron_reef_purpose',
    
    // Story progress
    HEARD_RETURNER_THEORY: 'heard_returner_theory',
    HEARD_ANCHOR_THEORY: 'heard_anchor_theory',
    HEARD_DEEPCOIL_THEORY: 'heard_deepcoil_theory'
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NPCMemory;
}
