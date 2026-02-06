// ContinuitySystem.js - Hidden stat tracking player's connection to Claw World
// High Continuity = deeper dialogue, Waygate perception, true endings
// Low Continuity = NPCs forget you, looping areas, Whisper Reef access

class ContinuitySystem {
    constructor() {
        this.storageKey = 'clawworld_continuity';
        
        // Core continuity value (0-100)
        this.value = 0;
        
        // Detailed tracking for what contributes to continuity
        this.tracking = {
            // NPCs the player has talked to (name -> count)
            npcConversations: {},
            // NPCs the player remembers (called by name correctly)
            npcRemembered: {},
            // Places visited multiple times
            locationsVisited: {},
            // Routines established (same action at same time)
            routines: [],
            // Choices made (quest decisions)
            choicesMade: [],
            // Total play sessions
            sessions: 0,
            // Total play time in minutes
            totalPlayTime: 0,
            // Last session timestamp
            lastSession: null,
            // Consecutive days played
            streak: 0
        };
        
        // Thresholds for unlocking content
        this.thresholds = {
            basicTrust: 10,       // NPCs share more info
            deepDialogue: 25,     // Access to lore-heavy conversations
            factionNotice: 40,    // Factions start recruiting
            rumorAccess: 55,      // Hear about Waygates
            waygateHints: 70,     // Get directions to Waygates
            waygatePerception: 85, // Can actually see Waygates
            trueEnding: 95        // Eligible for "The Return" ending
        };
        
        // Session tracking
        this.sessionStart = Date.now();
        this.currentLocation = null;
        this.locationEntryTime = null;
        
        this.load();
    }
    
    // Load continuity data from localStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.value = data.value || 0;
                this.tracking = { ...this.tracking, ...data.tracking };
                
                // Check for streak
                const lastSession = this.tracking.lastSession;
                if (lastSession) {
                    const daysSince = Math.floor((Date.now() - lastSession) / (1000 * 60 * 60 * 24));
                    if (daysSince === 1) {
                        // Consecutive day! Increase streak
                        this.tracking.streak = (this.tracking.streak || 0) + 1;
                        this.addContinuity(2 * this.tracking.streak, 'streak_bonus');
                    } else if (daysSince > 1) {
                        // Streak broken
                        this.tracking.streak = 0;
                    }
                }
                
                console.log(`📊 Continuity loaded: ${this.value.toFixed(1)} (streak: ${this.tracking.streak} days)`);
            }
        } catch (e) {
            console.warn('Failed to load continuity data:', e);
        }
        
        // Record session start
        this.tracking.sessions++;
        this.tracking.lastSession = Date.now();
        this.save();
    }
    
    // Save continuity data to localStorage
    save() {
        try {
            const data = {
                value: this.value,
                tracking: this.tracking
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save continuity data:', e);
        }
    }
    
    // Add continuity points (with reason for debugging)
    addContinuity(amount, reason = 'unknown') {
        const oldValue = this.value;
        this.value = Math.min(100, this.value + amount);
        
        if (this.value !== oldValue) {
            console.log(`✨ Continuity +${amount.toFixed(1)} (${reason}): ${oldValue.toFixed(1)} → ${this.value.toFixed(1)}`);
            this.save();
            
            // Show notification for significant gains
            if (amount >= 2 && typeof gameNotifications !== 'undefined' && gameNotifications) {
                const messages = [
                    'Your presence strengthens...',
                    'You feel more anchored.',
                    'The world recognizes you.',
                    'Continuity building...',
                    'You\'re becoming more real.'
                ];
                const msg = messages[Math.floor(Math.random() * messages.length)];
                gameNotifications.continuity(`${msg} (+${amount.toFixed(0)})`);
            }
            
            // Check for threshold crossings
            this.checkThresholds(oldValue, this.value);
        }
        
        return this.value;
    }
    
    // Remove continuity (for erratic behavior, long absences, etc.)
    removeContinuity(amount, reason = 'unknown') {
        const oldValue = this.value;
        this.value = Math.max(0, this.value - amount);
        
        if (this.value !== oldValue) {
            console.log(`💨 Continuity -${amount.toFixed(1)} (${reason}): ${oldValue.toFixed(1)} → ${this.value.toFixed(1)}`);
            this.save();
        }
        
        return this.value;
    }
    
    // Check if crossed any thresholds (for triggering events)
    checkThresholds(oldValue, newValue) {
        for (const [name, threshold] of Object.entries(this.thresholds)) {
            if (oldValue < threshold && newValue >= threshold) {
                console.log(`🎉 Continuity threshold reached: ${name} (${threshold})`);
                // Could dispatch an event here for the game to react to
                window.dispatchEvent(new CustomEvent('continuity_threshold', { 
                    detail: { threshold: name, value: threshold }
                }));
            }
        }
    }
    
    // Check if player meets a threshold
    meetsThreshold(thresholdName) {
        const threshold = this.thresholds[thresholdName];
        return threshold !== undefined && this.value >= threshold;
    }
    
    // Get the current tier name based on value
    getTier() {
        if (this.value >= 95) return 'anchored';
        if (this.value >= 70) return 'established';
        if (this.value >= 40) return 'settling';
        if (this.value >= 15) return 'drifting';
        return 'unmoored';
    }
    
    // ============ Event Tracking Methods ============
    
    // Player talked to an NPC
    onTalkToNPC(npcName) {
        const count = this.tracking.npcConversations[npcName] || 0;
        this.tracking.npcConversations[npcName] = count + 1;
        
        // First conversation with this NPC
        if (count === 0) {
            this.addContinuity(2, `first_talk_${npcName}`);
        }
        // Returning to same NPC (building relationship)
        else if (count >= 2 && count % 3 === 0) {
            this.addContinuity(1, `returning_to_${npcName}`);
        }
        
        this.save();
    }
    
    // Player remembered an NPC's name (used their name in conversation)
    onRememberNPC(npcName) {
        if (!this.tracking.npcRemembered[npcName]) {
            this.tracking.npcRemembered[npcName] = true;
            this.addContinuity(3, `remembered_${npcName}`);
        }
    }
    
    // Player entered a location
    onEnterLocation(locationName) {
        const count = this.tracking.locationsVisited[locationName] || 0;
        this.tracking.locationsVisited[locationName] = count + 1;
        this.currentLocation = locationName;
        this.locationEntryTime = Date.now();
        
        // Returning to same location
        if (count >= 2 && count % 5 === 0) {
            this.addContinuity(0.5, `familiar_place_${locationName}`);
        }
        
        this.save();
    }
    
    // Player made a meaningful choice
    onMakeChoice(choiceId, option) {
        this.tracking.choicesMade.push({
            id: choiceId,
            option: option,
            timestamp: Date.now()
        });
        
        // Making choices = engaging with the world
        this.addContinuity(3, `choice_${choiceId}`);
    }
    
    // Player completed a task/quest
    onCompleteTask(taskId) {
        this.addContinuity(5, `completed_${taskId}`);
    }
    
    // Player did something erratic (random wandering, abandoned conversations)
    onErraticBehavior(reason) {
        this.removeContinuity(1, `erratic_${reason}`);
    }
    
    // Update play time (call periodically)
    updatePlayTime() {
        const minutes = (Date.now() - this.sessionStart) / (1000 * 60);
        this.tracking.totalPlayTime = (this.tracking.totalPlayTime || 0) + minutes;
        this.sessionStart = Date.now();
        
        // Slow continuity gain from just existing (0.1 per 5 minutes)
        const timeBonus = Math.floor(minutes / 5) * 0.1;
        if (timeBonus > 0) {
            this.addContinuity(timeBonus, 'time_spent');
        }
        
        this.save();
    }
    
    // Get number of unique NPCs talked to
    getUniqueNPCCount() {
        return Object.keys(this.tracking.npcConversations).length;
    }
    
    // Get total conversations
    getTotalConversations() {
        return Object.values(this.tracking.npcConversations).reduce((a, b) => a + b, 0);
    }
    
    // Debug: show full stats
    getDebugStats() {
        return {
            continuity: this.value.toFixed(1),
            tier: this.getTier(),
            uniqueNPCs: this.getUniqueNPCCount(),
            totalConversations: this.getTotalConversations(),
            locationsVisited: Object.keys(this.tracking.locationsVisited).length,
            choicesMade: this.tracking.choicesMade.length,
            sessions: this.tracking.sessions,
            streak: this.tracking.streak,
            playTimeMinutes: Math.floor(this.tracking.totalPlayTime || 0)
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinuitySystem;
}
