// DriftReset - Soft death system for Claw World
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
        
        const continuity = this.game.continuitySystem ? this.game.continuitySystem.value : 100;
        
        // Check for critical drop
        if (continuity <= this.driftThreshold) {
            console.log(`💨 Continuity critically low (${continuity.toFixed(1)}%) - triggering Drift Reset`);
            this.triggerDriftReset();
        }
        
        this.lastContinuityCheck = continuity;
    }
    
    // Trigger the drift reset sequence
    triggerDriftReset() {
        if (this.isDrifting) return;
        
        this.isDrifting = true;
        console.log('🔴 Beginning Drift Reset sequence...');
        
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
    
    // Respawn player at a random shore position on a random island
    respawnPlayerAtRandomShore() {
        // Get world dimensions and islands
        const worldMap = this.game.worldMap;
        const islands = this.game.pendingIslands || [];
        
        if (islands.length === 0) {
            console.warn('No islands found for respawn, using default position');
            this.game.player.position.x = 100;
            this.game.player.position.y = 100;
            return;
        }
        
        // Pick a random island
        const randomIsland = islands[Math.floor(Math.random() * islands.length)];
        
        // Find shore tiles around the island
        const shorePositions = [];
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Check tiles around the island perimeter for water/shore adjacency
        for (let offsetY = -2; offsetY <= 2; offsetY++) {
            for (let offsetX = -2; offsetX <= 2; offsetX++) {
                // Only check perimeter
                if (offsetY !== -2 && offsetY !== 2 && offsetX !== -2 && offsetX !== 2) {
                    continue;
                }
                
                const checkCol = randomIsland.centerX + offsetX;
                const checkRow = randomIsland.centerY + offsetY;
                
                // Make sure it's in bounds
                if (checkCol >= 0 && checkCol < worldMap.tilesWide && 
                    checkRow >= 0 && checkRow < worldMap.tilesHigh) {
                    
                    const tile = worldMap.getTile(worldMap.terrainLayer, checkCol, checkRow);
                    // Look for water/shore tiles (water=1, shore=2)
                    if (tile === 1 || tile === 2) {
                        shorePositions.push({
                            x: checkCol * tileSize + tileSize / 2,
                            y: checkRow * tileSize + tileSize / 2
                        });
                    }
                }
            }
        }
        
        // If no shore found, just use island center
        let spawnPos;
        if (shorePositions.length > 0) {
            spawnPos = shorePositions[Math.floor(Math.random() * shorePositions.length)];
        } else {
            spawnPos = {
                x: randomIsland.centerX * tileSize,
                y: randomIsland.centerY * tileSize
            };
        }
        
        // Set player position
        this.game.player.position.x = spawnPos.x - this.game.player.width / 2;
        this.game.player.position.y = spawnPos.y - this.game.player.height / 2;
        
        // Update camera to follow player
        this.game.camera.setTarget(this.game.player);
        
        console.log(`🏝️ Respawned player on random shore at (${Math.round(spawnPos.x)}, ${Math.round(spawnPos.y)})`);
    }
    
    // Show notification after drift
    showDriftNotification() {
        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            setTimeout(() => {
                gameNotifications.show('You Drifted. Some things may have changed.', 4000);
            }, 3000);
        }
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