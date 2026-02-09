// DriftReset - Soft death system for Clawlands
// When Continuity drops critically low, player "drifts" instead of dying
class DriftReset {
    constructor(game) {
        this.game = game;
        this.driftThreshold = 5; // Trigger drift when Continuity drops below 5%
        this.isDrifting = false;
        this.driftOverlay = null;
        this.lastContinuityCheck = 100; // Track last continuity to detect drops
        
        this.createDriftOverlay();
        
        // Listen for continuity changes
        if (typeof window !== 'undefined') {
            window.addEventListener('continuity_threshold', (e) => {
                this.onContinuityChange();
            });
        }
        
        console.log('🔴 DriftReset system initialized');
    }
    
    // Create the red fade overlay element
    createDriftOverlay() {
        this.driftOverlay = document.createElement('div');
        this.driftOverlay.id = 'drift-overlay';
        this.driftOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #c43a24;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 2s ease-in-out;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        `;
        
        // Add drift text
        const driftText = document.createElement('div');
        driftText.style.cssText = `
            color: #e8d5cc;
            font-family: monospace;
            font-size: 20px;
            text-align: center;
            font-weight: bold;
            opacity: 0;
            transition: opacity 1s ease-in-out 1s;
            line-height: 1.5;
            max-width: 80%;
        `;
        driftText.textContent = 'You didn\'t die. You just forgot which version of yourself was walking.';
        
        this.driftOverlay.appendChild(driftText);
        this.driftTextElement = driftText;
        
        document.body.appendChild(this.driftOverlay);
    }
    
    // Check continuity level and trigger drift if needed
    update() {
        if (this.isDrifting) return; // Already drifting
        
        // Grace period — don't auto-trigger drift in the first 10 seconds of play
        // (new characters start at 0 continuity, which is below threshold)
        if (!this.playTimeElapsed) this.playTimeElapsed = 0;
        this.playTimeElapsed += 1/60; // rough frame estimate
        if (this.playTimeElapsed < 10) return;
        
        const continuity = this.game.continuitySystem ? this.game.continuitySystem.value : 100;
        
        // Only trigger from continuity drop if it was PREVIOUSLY above threshold
        // (prevents triggering on brand new characters who start at 0)
        if (continuity <= this.driftThreshold && this.lastContinuityCheck > this.driftThreshold) {
            console.log(`💨 Continuity critically low (${continuity.toFixed(1)}%) - triggering Drift Reset`);
            this.triggerDriftReset();
        }
        
        this.lastContinuityCheck = continuity;
    }
    
    // Trigger the drift reset sequence
    triggerDriftReset(reason) {
        if (this.isDrifting) return;
        
        this.isDrifting = true;
        this.driftReason = reason || 'continuity';
        console.log('🔴 Beginning Drift Reset sequence...');

        // Update text based on reason
        if (reason === 'combat') {
            const combatTexts = [
                'Your shell cracked. The Current pulled you under.',
                'The Drift Fauna broke through. You scattered.',
                'Shell integrity: zero. You forgot how to hold together.',
                'The fragments got you. You became one of them, briefly.'
            ];
            this.driftTextElement.textContent = combatTexts[Math.floor(Math.random() * combatTexts.length)];
        } else {
            this.driftTextElement.textContent = 'You didn\'t die. You just forgot which version of yourself was walking.';
        }
        
        // Start the fade to red
        this.driftOverlay.style.opacity = '1';
        
        // Show drift text after 1 second
        setTimeout(() => {
            this.driftTextElement.style.opacity = '1';
        }, 1000);
        
        // Complete the drift after 5 seconds total
        setTimeout(() => {
            this.completeDriftReset();
        }, 5000);
    }
    
    // Complete the drift reset and respawn player
    completeDriftReset() {
        console.log('🌊 Completing Drift Reset - respawning player...');
        
        // Apply drift consequences
        this.applyDriftConsequences();
        
        // Restore shell integrity + grant spawn protection
        if (this.game.player && this.game.player.shellIntegrityMax) {
            this.game.player.shellIntegrity = this.game.player.shellIntegrityMax;
            this.game.player.isInvulnerable = true;
            this.game.player.spawnProtectionActive = true;
            this.game.player.invulnerabilityTimer = 0;
        }

        // Clear enemies around respawn area
        if (this.game.combatSystem) {
            this.game.combatSystem.enemies = [];
        }
        
        // Respawn player at random shore
        this.respawnPlayerAtRandomShore();
        
        // Show notification
        this.showDriftNotification();
        
        // Fade out the red overlay
        this.driftTextElement.style.opacity = '0';
        
        setTimeout(() => {
            this.driftOverlay.style.opacity = '0';
            
            setTimeout(() => {
                this.isDrifting = false;
                console.log('✅ Drift Reset complete');
            }, 2000);
        }, 1000);
    }
    
    // Apply consequences of drifting
    applyDriftConsequences() {
        console.log('🔄 Applying Drift Reset consequences...');
        
        // Reset one random NPC relationship
        if (this.game.npcMemory) {
            this.resetRandomNPCRelationship();
        }
        
        // Reset Continuity to 20%
        if (this.game.continuitySystem) {
            this.game.continuitySystem.value = 20;
            this.game.continuitySystem.save();
            console.log('📊 Continuity reset to 20%');
        }
        
        // Lose all inventory on death
        if (this.game.inventorySystem) {
            let itemCount = 0;
            for (let i = 0; i < this.game.inventorySystem.slots.length; i++) {
                if (this.game.inventorySystem.slots[i]) itemCount++;
                this.game.inventorySystem.slots[i] = null;
            }
            if (itemCount > 0) {
                this.game.inventorySystem.save();
                console.log(`💀 Lost ${itemCount} item stacks from inventory on death`);
                if (this.game.notificationSystem) {
                    this.game.notificationSystem.show('Your inventory scattered into the current...', 'warning');
                }
            }
        }
        
        // Lose half of brine tokens
        if (this.game.currencySystem) {
            const current = this.game.currencySystem.tokens || 0;
            if (current > 0) {
                const lost = Math.floor(current / 2);
                this.game.currencySystem.tokens -= lost;
                this.game.currencySystem.saveTokens();
                console.log(`💰 Lost ${lost} brine tokens on death`);
            }
        }
    }
    
    // Reset a random NPC relationship
    resetRandomNPCRelationship() {
        try {
            const relationships = this.game.npcMemory.getAllRelationships();
            const npcNames = Object.keys(relationships);
            
            if (npcNames.length > 0) {
                const randomNPC = npcNames[Math.floor(Math.random() * npcNames.length)];
                this.game.npcMemory.resetRelationship(randomNPC);
                console.log(`💭 Reset relationship with ${randomNPC} due to drift`);
            }
        } catch (e) {
            console.warn('Could not reset NPC relationship:', e);
        }
    }
    
    // Respawn player at a safe LAND position on a random island
    respawnPlayerAtRandomShore() {
        // Use the game's existing safe spawn finder — it checks terrain, buildings, and NPCs
        const islands = this.game.worldMap ? this.game.worldMap.islands : (this.game.pendingIslands || []);
        
        if (!islands || islands.length === 0) {
            console.warn('No islands found for respawn, using default position');
            this.game.player.position.x = 100;
            this.game.player.position.y = 100;
            return;
        }
        
        // Pick a random island and find safe spawn on it
        const randomIsland = islands[Math.floor(Math.random() * islands.length)];
        const tileSize = CONSTANTS.TILE_SIZE;
        const safeSpots = [];
        
        // Search for LAND tiles on this island (expanding circles)
        for (let radius = 2; radius < Math.min(randomIsland.size - 1, 12); radius++) {
            for (let angle = 0; angle < 16; angle++) {
                const angleRad = (angle / 16) * 2 * Math.PI;
                const testCol = randomIsland.x + Math.floor(Math.cos(angleRad) * radius);
                const testRow = randomIsland.y + Math.floor(Math.sin(angleRad) * radius);
                
                const worldX = (testCol * tileSize) + (tileSize / 2);
                const worldY = (testRow * tileSize) + (tileSize / 2);
                
                if (this.game.isPositionSafe(worldX, worldY)) {
                    safeSpots.push({ x: worldX, y: worldY });
                }
            }
        }
        
        let spawnPos;
        if (safeSpots.length > 0) {
            spawnPos = safeSpots[Math.floor(Math.random() * safeSpots.length)];
        } else {
            // Fallback: use the main spawn finder
            spawnPos = this.game.findPlayerSpawnLocation(islands);
        }
        
        // Set player position
        this.game.player.position.x = spawnPos.x - this.game.player.width / 2;
        this.game.player.position.y = spawnPos.y - this.game.player.height / 2;
        
        // Push away from any nearby NPCs
        this.game.pushPlayerAwayFromNPCs();
        
        // Update camera to follow player
        this.game.camera.setTarget(this.game.player);
        
        console.log(`🏝️ Respawned player on safe land at (${Math.round(spawnPos.x)}, ${Math.round(spawnPos.y)})`);
    }
    
    // Show notification after drift
    showDriftNotification() {
        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            setTimeout(() => {
                gameNotifications.show('You Drifted. Some things may have changed.', 4000);
            }, 3000);
        }
    }
    
    // Public trigger (called by CombatSystem when shell integrity hits 0)
    trigger() {
        this.triggerDriftReset();
    }

    // Manual trigger for testing (can be called from console)
    triggerDriftResetManual() {
        console.log('🧪 Manually triggering Drift Reset for testing...');
        this.triggerDriftReset();
    }
    
    // Check if currently drifting
    isDriftingNow() {
        return this.isDrifting;
    }
    
    // Handle continuity changes
    onContinuityChange() {
        // Called when continuity thresholds are crossed
        this.update();
    }
    
    // Cleanup
    destroy() {
        if (this.driftOverlay && this.driftOverlay.parentNode) {
            this.driftOverlay.parentNode.removeChild(this.driftOverlay);
        }
        
        if (typeof window !== 'undefined') {
            window.removeEventListener('continuity_threshold', this.onContinuityChange);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DriftReset;
}