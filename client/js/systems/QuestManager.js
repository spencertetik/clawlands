// QuestManager.js - Unified fetch quest manager
// Combines ItemQuestData and QuestData into a single system
// Tracks quest states: available, active, complete (persisted to localStorage)

class QuestManager {
    constructor(playerName) {
        this.playerName = playerName || 'default';
        this.storageKey = `clawworld_questmgr_${this.playerName}`;
        
        // Merge all quest sources into one lookup
        this.allQuests = {};
        this.npcQuestMap = {}; // npcName -> [questId, ...]
        
        this.loadQuestDefinitions();
        
        // Quest states: 'available' (default), 'active', 'complete'
        this.questStates = {};
        this.load();
    }
    
    // Merge ItemQuestData + QuestData into unified lookup
    loadQuestDefinitions() {
        // From ItemQuestData (already loaded globally)
        if (typeof ItemQuestData !== 'undefined') {
            for (const quest of ItemQuestData) {
                this.allQuests[quest.id] = quest;
                if (!this.npcQuestMap[quest.npcName]) {
                    this.npcQuestMap[quest.npcName] = [];
                }
                this.npcQuestMap[quest.npcName].push(quest.id);
            }
        }
        
        // From QuestData (supplemental quests)
        if (typeof QuestData !== 'undefined') {
            for (const quest of QuestData) {
                this.allQuests[quest.id] = quest;
                if (!this.npcQuestMap[quest.npcName]) {
                    this.npcQuestMap[quest.npcName] = [];
                }
                this.npcQuestMap[quest.npcName].push(quest.id);
            }
        }
        
        const count = Object.keys(this.allQuests).length;
        console.log(`📦 QuestManager: loaded ${count} fetch quests`);
    }
    
    // Get the quest state for a quest ID
    getState(questId) {
        return this.questStates[questId] || 'available';
    }
    
    // Set quest state
    setState(questId, state) {
        this.questStates[questId] = state;
        this.save();
    }
    
    // Check NPC for a quest and return appropriate dialog
    // Returns dialog array or null if NPC has no quest
    checkNPCQuest(npcName, inventory) {
        const questIds = this.npcQuestMap[npcName];
        if (!questIds || questIds.length === 0) return null;
        
        // Check each quest this NPC offers
        for (const questId of questIds) {
            const quest = this.allQuests[questId];
            if (!quest) continue;
            
            const state = this.getState(questId);
            
            if (state === 'complete') {
                // Show post-completion dialog
                return quest.dialogAlreadyDone || null;
            }
            
            // Check if player can complete (has all required items)
            if (inventory) {
                let hasAllItems = true;
                for (const req of quest.requires) {
                    if (!inventory.hasItem(req.itemId, req.qty)) {
                        hasAllItems = false;
                        break;
                    }
                }
                
                if (hasAllItems) {
                    // Can complete! Return completion dialog
                    // (actual item exchange handled by tryCompleteQuest)
                    return { type: 'completable', questId: questId, dialog: quest.dialogComplete };
                }
            }
            
            if (state === 'active') {
                // Already started, show incomplete dialog
                return quest.dialogIncomplete || null;
            }
            
            // First time: start the quest
            this.setState(questId, 'active');
            return quest.dialogStart || null;
        }
        
        return null;
    }
    
    // Try to complete a quest (checks items, removes them, adds rewards)
    // Returns true if completed, false if can't
    tryCompleteQuest(questId, inventory) {
        const quest = this.allQuests[questId];
        if (!quest || !inventory) return false;
        
        if (this.getState(questId) === 'complete') return false;
        
        // Verify player has all items
        for (const req of quest.requires) {
            if (!inventory.hasItem(req.itemId, req.qty)) {
                return false;
            }
        }
        
        // Remove required items
        for (const req of quest.requires) {
            inventory.removeItem(req.itemId, req.qty);
        }
        
        // Add reward items
        for (const reward of quest.rewards) {
            const added = inventory.addItem(reward.itemId, reward.qty);
            if (added > 0) {
                const itemDef = typeof ItemData !== 'undefined' ? ItemData[reward.itemId] : null;
                if (itemDef && typeof gameNotifications !== 'undefined') {
                    const rarityTag = itemDef.rarity !== 'common' ? ` [${itemDef.rarity}]` : '';
                    gameNotifications.quest(`${itemDef.icon} Received ${itemDef.name}${reward.qty > 1 ? ' x' + reward.qty : ''}${rarityTag}`);
                }
            }
        }
        
        // Mark complete
        this.setState(questId, 'complete');
        
        console.log(`✅ QuestManager: completed quest "${questId}"`);
        
        if (typeof gameNotifications !== 'undefined') {
            gameNotifications.achievement(`Quest complete: ${quest.description || quest.title || questId}`);
        }
        
        return true;
    }
    
    // Get all quests for a given NPC
    getQuestsForNPC(npcName) {
        const ids = this.npcQuestMap[npcName] || [];
        return ids.map(id => ({
            ...this.allQuests[id],
            state: this.getState(id)
        }));
    }
    
    // Get count of completed quests
    getCompletedCount() {
        return Object.values(this.questStates).filter(s => s === 'complete').length;
    }
    
    // Persistence
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.questStates));
        } catch (e) {
            console.warn('QuestManager: save failed:', e);
        }
    }
    
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.questStates = JSON.parse(saved);
                console.log(`📦 QuestManager: loaded ${Object.keys(this.questStates).length} quest states`);
            }
        } catch (e) {
            console.warn('QuestManager: load failed:', e);
        }
        
        // Also sync with legacy completedItemQuests storage
        if (typeof loadCompletedItemQuests !== 'undefined') {
            const legacy = loadCompletedItemQuests();
            for (const id of legacy) {
                if (!this.questStates[id]) {
                    this.questStates[id] = 'complete';
                }
            }
        }
    }
    
    // Update player name (when character is created)
    setPlayerName(name) {
        this.playerName = name;
        this.storageKey = `clawworld_questmgr_${this.playerName}`;
        this.load();
    }
}

// Export
window.QuestManager = QuestManager;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestManager;
}
