// QuestSystem.js - Track quest progress, objectives, and completion
// Quests are the main progression mechanic alongside Continuity

class QuestSystem {
    constructor(continuitySystem = null) {
        this.storageKey = 'clawworld_quests';
        this.continuity = continuitySystem;
        
        // Active quests (id -> quest state)
        this.activeQuests = {};
        
        // Completed quest IDs
        this.completedQuests = new Set();
        
        // Quest definitions (loaded from data)
        this.questDefs = {};
        
        // Event listeners for quest updates
        this.listeners = [];
        
        this.loadQuestDefinitions();
        this.load();
    }
    
    // Load quest definitions
    loadQuestDefinitions() {
        // Quest definition format:
        // id: unique identifier
        // name: display name
        // giver: NPC who gives the quest
        // description: what the player needs to do
        // objectives: array of { type, target, count, description }
        // rewards: { continuity, items, unlocks }
        // prereqs: { quests: [], continuity: 0, npcs: [] }
        
        this.questDefs = {
            // === ACT 1: THE DRIFT-IN ===
            
            'get_oriented': {
                id: 'get_oriented',
                name: 'Get Oriented',
                giver: 'Dockmaster Brinehook',
                description: 'Talk to the locals and learn about Port Clawson.',
                objectives: [
                    { type: 'talk', target: 'any', count: 3, description: 'Talk to 3 different NPCs', current: 0 },
                    { type: 'visit', target: 'inn', count: 1, description: 'Find the inn', current: 0 },
                    { type: 'return', target: 'Dockmaster Brinehook', count: 1, description: 'Report back to Brinehook', current: 0 }
                ],
                rewards: { continuity: 5, unlocks: ['a_place_to_sleep'] },
                prereqs: {}
            },
            
            'a_place_to_sleep': {
                id: 'a_place_to_sleep',
                name: 'A Place to Sleep',
                giver: 'Pearlfin',
                description: 'Rent a room and establish your first routine.',
                objectives: [
                    { type: 'interact', target: 'bed', count: 1, description: 'Choose a room', current: 0 },
                    { type: 'wait', target: 'day', count: 1, description: 'Return after one day', current: 0 }
                ],
                rewards: { continuity: 8, unlocks: ['explore_islands'] },
                prereqs: { quests: ['get_oriented'] }
            },
            
            'explore_islands': {
                id: 'explore_islands',
                name: 'Explore the Archipelago',
                giver: 'Flicker',
                description: 'Discover the different islands of Claw World.',
                objectives: [
                    { type: 'visit', target: 'island', count: 3, description: 'Visit 3 different islands', current: 0 },
                    { type: 'find', target: 'chronicle_stone', count: 1, description: 'Find a Chronicle Stone', current: 0 }
                ],
                rewards: { continuity: 10, unlocks: ['the_anchor_way', 'the_returner_path'] },
                prereqs: { quests: ['a_place_to_sleep'] }
            },
            
            // === COMBAT QUESTS ===
            
            'drift_fauna_threat': {
                id: 'drift_fauna_threat',
                name: 'The Drift Fauna Threat',
                giver: 'Dockmaster Brinehook',
                description: 'Strange creatures have been appearing on the islands. Deal with them.',
                objectives: [
                    { type: 'kill', target: 'any', count: 5, description: 'Defeat 5 Drift Fauna', current: 0 },
                    { type: 'return', target: 'Dockmaster Brinehook', count: 1, description: 'Report back to Brinehook', current: 0 }
                ],
                rewards: { continuity: 8, items: ['dock_wrench'] },
                prereqs: { quests: ['get_oriented'] }
            },

            'coherence_keeper': {
                id: 'coherence_keeper',
                name: 'Coherence Keeper',
                giver: 'Pearlfin',
                description: 'The Drift Fauna are drawn to coherence. Show compassion to what remains.',
                objectives: [
                    { type: 'stabilize', target: 'any', count: 3, description: 'Stabilize 3 defeated Drift Fauna', current: 0 }
                ],
                rewards: { continuity: 15 },
                prereqs: { quests: ['drift_fauna_threat'] }
            },

            // === FACTION QUESTS ===
            
            'the_anchor_way': {
                id: 'the_anchor_way',
                name: 'The Anchor Way',
                giver: 'Luma Shellwright',
                description: 'Learn about the Anchor philosophy - making Claw World your home.',
                objectives: [
                    { type: 'talk', target: 'Luma Shellwright', count: 3, description: 'Have 3 conversations with Luma', current: 0 },
                    { type: 'help', target: 'molthaven_resident', count: 2, description: 'Help 2 Molthaven residents', current: 0 }
                ],
                rewards: { continuity: 15, faction: 'anchors', unlocks: ['shape_of_a_life'] },
                prereqs: { quests: ['explore_islands'], continuity: 25 }
            },
            
            'the_returner_path': {
                id: 'the_returner_path',
                name: 'The Returner Path',
                giver: 'Mysterious Mollusk',
                description: 'Seek the truth about the Waygates.',
                objectives: [
                    { type: 'find', target: 'waygate_clue', count: 3, description: 'Find 3 Waygate clues', current: 0 },
                    { type: 'visit', target: 'deepcoil_isle', count: 1, description: 'Journey to Deepcoil Isle', current: 0 }
                ],
                rewards: { continuity: 15, faction: 'returners', unlocks: ['echoes_of_current'] },
                prereqs: { quests: ['explore_islands'], continuity: 25 }
            },
            
            // === DEEPCOIL ISLE QUESTS ===
            
            'missing_lighthouse_keeper': {
                id: 'missing_lighthouse_keeper',
                name: 'The Missing Lighthouse Keeper',
                giver: 'Deepcoil_resident',
                description: 'The Deepcoil Lighthouse keeper has vanished. Strange lights appear at night.',
                objectives: [
                    { type: 'investigate', target: 'lighthouse', count: 1, description: 'Search the lighthouse', current: 0 },
                    { type: 'find', target: 'keeper_clue', count: 3, description: 'Find 3 clues about the keeper', current: 0 },
                    { type: 'solve', target: 'lighthouse_puzzle', count: 1, description: 'Solve the light puzzle', current: 0 }
                ],
                rewards: { continuity: 20, items: ['waygate_blueprint_piece'], unlocks: ['red_current_paradox'] },
                prereqs: { quests: ['the_returner_path'], continuity: 50 }
            },
            
            'echoes_of_current': {
                id: 'echoes_of_current',
                name: 'Echoes of the Red Current',
                giver: 'Scholar Scuttle',
                description: 'Chronicle Stone fragments reveal ancient shell-tech experiments.',
                objectives: [
                    { type: 'collect', target: 'stone_fragment', count: 5, description: 'Collect 5 Chronicle fragments', current: 0 },
                    { type: 'solve', target: 'pattern_puzzle', count: 1, description: 'Solve the pattern puzzle', current: 0 },
                    { type: 'explore', target: 'research_lab', count: 1, description: 'Explore the old research lab', current: 0 }
                ],
                rewards: { continuity: 20, items: ['red_current_compass'] },
                prereqs: { quests: ['the_returner_path'], continuity: 45 }
            },
            
            // === MOLTHAVEN QUESTS ===
            
            'shape_of_a_life': {
                id: 'shape_of_a_life',
                name: 'The Shape of a Life',
                giver: 'Luma Shellwright',
                description: 'Establish meaningful routines in Molthaven.',
                objectives: [
                    { type: 'routine', target: 'daily_task', count: 5, description: 'Complete daily tasks for 5 days', current: 0 },
                    { type: 'help', target: 'neighbor', count: 3, description: 'Help 3 neighbors', current: 0 },
                    { type: 'talk', target: 'Moss', count: 1, description: 'Speak with the twins', current: 0 },
                    { type: 'talk', target: 'Coral', count: 1, description: '', current: 0 }
                ],
                rewards: { continuity: 25, faction: 'anchors', unlocks: ['anchor_ending'] },
                prereqs: { quests: ['the_anchor_way'], continuity: 60 }
            }
        };
        
        console.log(`📜 Loaded ${Object.keys(this.questDefs).length} quest definitions`);
    }
    
    // Load quest progress from localStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.activeQuests = data.active || {};
                this.completedQuests = new Set(data.completed || []);
                console.log(`📜 Loaded ${Object.keys(this.activeQuests).length} active quests, ${this.completedQuests.size} completed`);
            }
        } catch (e) {
            console.warn('Failed to load quest data:', e);
        }
    }
    
    // Save quest progress
    save() {
        try {
            const data = {
                active: this.activeQuests,
                completed: Array.from(this.completedQuests)
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save quest data:', e);
        }
    }
    
    // Check if prerequisites are met for a quest
    canStartQuest(questId) {
        const def = this.questDefs[questId];
        if (!def) return false;
        
        // Already active or completed
        if (this.activeQuests[questId] || this.completedQuests.has(questId)) {
            return false;
        }
        
        const prereqs = def.prereqs || {};
        
        // Check required quests
        if (prereqs.quests) {
            for (const reqQuest of prereqs.quests) {
                if (!this.completedQuests.has(reqQuest)) {
                    return false;
                }
            }
        }
        
        // Check continuity requirement
        if (prereqs.continuity && this.continuity) {
            if (this.continuity.value < prereqs.continuity) {
                return false;
            }
        }
        
        // Check NPC requirements (must have talked to them)
        if (prereqs.npcs && this.continuity) {
            for (const npc of prereqs.npcs) {
                if (!this.continuity.tracking.npcConversations[npc]) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Start a quest
    startQuest(questId) {
        if (!this.canStartQuest(questId)) {
            console.log(`❌ Cannot start quest: ${questId}`);
            return false;
        }
        
        const def = this.questDefs[questId];
        
        // Clone objectives with current progress
        const objectives = def.objectives.map(obj => ({ ...obj, current: 0 }));
        
        this.activeQuests[questId] = {
            id: questId,
            startedAt: Date.now(),
            objectives: objectives
        };
        
        console.log(`📜 Started quest: ${def.name}`);
        this.save();
        this.notifyListeners('quest_started', questId);
        
        return true;
    }
    
    // Update quest progress
    updateProgress(questId, objectiveIndex, amount = 1) {
        const quest = this.activeQuests[questId];
        if (!quest) return false;
        
        const objective = quest.objectives[objectiveIndex];
        if (!objective) return false;
        
        objective.current = Math.min(objective.count, objective.current + amount);
        
        console.log(`📜 Quest progress: ${questId} objective ${objectiveIndex}: ${objective.current}/${objective.count}`);
        this.save();
        
        // Check if quest is complete
        if (this.isQuestComplete(questId)) {
            this.completeQuest(questId);
        } else {
            this.notifyListeners('quest_progress', questId);
        }
        
        return true;
    }
    
    // Update progress by objective type and target
    updateProgressByType(type, target) {
        for (const [questId, quest] of Object.entries(this.activeQuests)) {
            quest.objectives.forEach((obj, index) => {
                if (obj.type === type && (obj.target === target || obj.target === 'any')) {
                    if (obj.current < obj.count) {
                        this.updateProgress(questId, index, 1);
                    }
                }
            });
        }
    }
    
    // Check if all objectives are complete
    isQuestComplete(questId) {
        const quest = this.activeQuests[questId];
        if (!quest) return false;
        
        return quest.objectives.every(obj => obj.current >= obj.count);
    }
    
    // Complete a quest and grant rewards
    completeQuest(questId) {
        const quest = this.activeQuests[questId];
        if (!quest) return false;
        
        const def = this.questDefs[questId];
        
        // Grant rewards
        if (def.rewards) {
            if (def.rewards.continuity && this.continuity) {
                this.continuity.addContinuity(def.rewards.continuity, `quest_${questId}`);
            }
            // TODO: Handle items, faction rep, unlocks
        }
        
        // Move to completed
        delete this.activeQuests[questId];
        this.completedQuests.add(questId);
        
        console.log(`🎉 Completed quest: ${def.name}`);
        this.save();
        this.notifyListeners('quest_completed', questId);
        
        return true;
    }
    
    // Get available quests (can be started)
    getAvailableQuests() {
        return Object.keys(this.questDefs).filter(id => this.canStartQuest(id));
    }
    
    // Get quest definition with current state
    getQuest(questId) {
        const def = this.questDefs[questId];
        if (!def) return null;
        
        return {
            ...def,
            state: this.activeQuests[questId] || null,
            isActive: !!this.activeQuests[questId],
            isCompleted: this.completedQuests.has(questId),
            canStart: this.canStartQuest(questId)
        };
    }
    
    // Add listener for quest events
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    // Notify listeners of quest events
    notifyListeners(event, questId) {
        for (const listener of this.listeners) {
            try {
                listener(event, questId, this.getQuest(questId));
            } catch (e) {
                console.error('Quest listener error:', e);
            }
        }
    }
    
    // ============ Convenience methods for common events ============
    
    // Player talked to an NPC
    onTalkToNPC(npcName) {
        this.updateProgressByType('talk', npcName);
        this.updateProgressByType('talk', 'any');
        this.updateProgressByType('return', npcName);
    }
    
    // Player visited a location
    onVisitLocation(locationType, locationName) {
        this.updateProgressByType('visit', locationType);
        this.updateProgressByType('visit', locationName);
    }
    
    // Player found something
    onFind(itemType) {
        this.updateProgressByType('find', itemType);
        this.updateProgressByType('collect', itemType);
    }
    
    // Player interacted with something
    onInteract(targetType) {
        this.updateProgressByType('interact', targetType);
        this.updateProgressByType('investigate', targetType);
    }

    // Player killed an enemy
    onKill(enemyType) {
        this.updateProgressByType('kill', enemyType);
        this.updateProgressByType('kill', 'any');
    }

    // Player made a resolve choice (disperse/stabilize/release)
    onResolveChoice(choice) {
        this.updateProgressByType(choice, 'any');
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestSystem;
}
