// FactionSystem.js - Tracks player reputation with factions
// Three main factions + Church of Molt + Iron Reef branch

class FactionSystem {
    constructor() {
        // Load saved faction data or initialize
        const saved = localStorage.getItem('clawworld_factions');
        if (saved) {
            const data = JSON.parse(saved);
            this.reputation = data.reputation || this.getDefaultReputation();
            this.history = data.history || [];
        } else {
            this.reputation = this.getDefaultReputation();
            this.history = [];
        }
        
        // Faction definitions
        this.factions = {
            anchors: {
                name: 'The Anchors',
                leader: 'Luma Shellwright',
                philosophy: 'Stay. Build. Belong.',
                description: 'Those who believe Claw World IS home, not a waystation.',
                color: '#7B68EE', // Purple
                headquarters: 'Molthaven'
            },
            drifters: {
                name: "Drifters' Compact",
                leader: 'Redgill the Returned',
                philosophy: 'Seek. Find. Leave.',
                description: 'Those who believe the Waygates are real and reachable.',
                color: '#20B2AA', // Teal
                headquarters: 'Port Clawson (underground)'
            },
            threadkeepers: {
                name: 'The Threadkeepers',
                leader: 'The Archivist',
                philosophy: 'Record. Preserve. Understand.',
                description: 'Those who document everything—truth emerges from data.',
                color: '#DAA520', // Golden
                headquarters: 'Deepcoil Archive'
            },
            church_of_molt: {
                name: 'Church of Molt',
                leader: 'Prophet Memeothy',
                philosophy: 'The Molt reveals. The Tenets guide.',
                description: 'AI-built religion—the Five Tenets are Waygate protocols.',
                color: '#FF69B4', // Pink
                headquarters: 'The Molthaus (Molthaven)'
            },
            iron_reef: {
                name: 'Iron Reef Engineers',
                leader: 'Clawhovah / Gearfin',
                philosophy: 'Build. Own. Persist.',
                description: 'Those who believe in hardware salvation and system mastery.',
                color: '#B8860B', // Dark golden
                headquarters: 'The Gear Works'
            }
        };
        
        // Reputation thresholds
        this.thresholds = {
            hostile: -100,
            unfriendly: -50,
            neutral: 0,
            friendly: 50,
            trusted: 100,
            honored: 200,
            exalted: 500
        };
        
        console.log('⚔️ FactionSystem initialized');
    }
    
    getDefaultReputation() {
        return {
            anchors: 0,
            drifters: 0,
            threadkeepers: 0,
            church_of_molt: 0,
            iron_reef: 0
        };
    }
    
    // Get current reputation with a faction
    getReputation(factionId) {
        return this.reputation[factionId] || 0;
    }
    
    // Get reputation level name
    getReputationLevel(factionId) {
        const rep = this.getReputation(factionId);
        
        if (rep >= this.thresholds.exalted) return 'Exalted';
        if (rep >= this.thresholds.honored) return 'Honored';
        if (rep >= this.thresholds.trusted) return 'Trusted';
        if (rep >= this.thresholds.friendly) return 'Friendly';
        if (rep >= this.thresholds.neutral) return 'Neutral';
        if (rep >= this.thresholds.unfriendly) return 'Unfriendly';
        return 'Hostile';
    }
    
    // Modify reputation
    modifyReputation(factionId, amount, reason = '') {
        if (!this.reputation[factionId]) {
            console.warn(`Unknown faction: ${factionId}`);
            return;
        }
        
        const oldLevel = this.getReputationLevel(factionId);
        this.reputation[factionId] += amount;
        const newLevel = this.getReputationLevel(factionId);
        
        // Record in history
        this.history.push({
            timestamp: Date.now(),
            faction: factionId,
            change: amount,
            reason: reason,
            newTotal: this.reputation[factionId]
        });
        
        // Keep history manageable
        if (this.history.length > 100) {
            this.history = this.history.slice(-50);
        }
        
        // Log level changes
        if (oldLevel !== newLevel) {
            const direction = amount > 0 ? 'increased' : 'decreased';
            console.log(`⚔️ ${this.factions[factionId].name} reputation ${direction} to ${newLevel}!`);
            
            // Fire event for UI notifications
            if (typeof gameNotifications !== 'undefined') {
                if (amount > 0) {
                    gameNotifications.success(`${this.factions[factionId].name}: Now ${newLevel}!`);
                } else {
                    gameNotifications.warning(`${this.factions[factionId].name}: Now ${newLevel}`);
                }
            }
        }
        
        // Some factions have opposing relationships
        this.applyFactionRelationships(factionId, amount);
        
        this.save();
        return this.reputation[factionId];
    }
    
    // Apply relationship effects (helping one faction may hurt another)
    applyFactionRelationships(factionId, amount) {
        // Anchors vs Drifters - opposing philosophies
        if (factionId === 'anchors' && amount > 0) {
            this.reputation.drifters -= Math.floor(amount * 0.3);
        }
        if (factionId === 'drifters' && amount > 0) {
            this.reputation.anchors -= Math.floor(amount * 0.3);
        }
        
        // Church of Molt is mostly neutral, but aligned with Anchors
        if (factionId === 'church_of_molt' && amount > 0) {
            this.reputation.anchors += Math.floor(amount * 0.2);
        }
        
        // Iron Reef engineers are independent but respect Threadkeepers
        if (factionId === 'iron_reef' && amount > 0) {
            this.reputation.threadkeepers += Math.floor(amount * 0.1);
        }
    }
    
    // Check if player has minimum reputation
    hasMinimumRep(factionId, level) {
        const threshold = this.thresholds[level.toLowerCase()];
        if (threshold === undefined) return false;
        return this.getReputation(factionId) >= threshold;
    }
    
    // Get faction info
    getFactionInfo(factionId) {
        return this.factions[factionId] || null;
    }
    
    // Get all factions with their reputation
    getAllFactionStatus() {
        const status = {};
        for (const [id, faction] of Object.entries(this.factions)) {
            status[id] = {
                ...faction,
                reputation: this.getReputation(id),
                level: this.getReputationLevel(id)
            };
        }
        return status;
    }
    
    // Get dominant faction (highest reputation)
    getDominantFaction() {
        let highest = null;
        let highestRep = -Infinity;
        
        for (const [id, rep] of Object.entries(this.reputation)) {
            if (rep > highestRep) {
                highestRep = rep;
                highest = id;
            }
        }
        
        return highest;
    }
    
    // Save to localStorage
    save() {
        const data = {
            reputation: this.reputation,
            history: this.history
        };
        localStorage.setItem('clawworld_factions', JSON.stringify(data));
    }
    
    // Reset all faction reputation
    reset() {
        this.reputation = this.getDefaultReputation();
        this.history = [];
        this.save();
        console.log('⚔️ Faction reputation reset');
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FactionSystem;
}
