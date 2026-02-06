// Waygate.js - The mysterious portals that may lead out of Claw World
// Only visible to those with high Continuity

class Waygate {
    constructor(x, y, name = 'Ancient Waygate') {
        this.x = x;
        this.y = y;
        this.name = name;
        
        // Dimensions (ancient stone archway)
        this.width = 48;
        this.height = 64;
        
        // Visibility threshold (Continuity required to see it)
        // TESTING: Lowered thresholds for easier testing
        this.visibilityThreshold = 10; // Need 10+ Continuity to see
        this.fullVisibilityThreshold = 25; // Full opacity at 25+
        
        // Current visibility (0 = invisible, 1 = fully visible)
        this.visibility = 0;
        this.targetVisibility = 0;
        
        // Portal effect
        this.portalTime = 0;
        this.portalParticles = [];
        this.maxPortalParticles = 30;
        
        // Is the gate active (can be used)?
        this.active = false;
        
        // Gate states
        this.discovered = false; // Has player ever seen it?
        this.examined = false;   // Has player interacted with it?
        
        // Colors
        this.stoneColor = '#4a4a5a';      // Ancient stone
        this.stoneHighlight = '#6a6a7a';  // Stone highlight
        this.stoneShadow = '#2a2a3a';     // Stone shadow
        this.portalColor = 'rgba(100, 200, 255, 0.6)'; // Ethereal blue
        this.runeColor = 'rgba(196, 58, 36, 0.8)';     // Red runes (lobster red)
        
        this.initPortalParticles();
    }
    
    initPortalParticles() {
        for (let i = 0; i < this.maxPortalParticles; i++) {
            this.portalParticles.push(this.createPortalParticle());
        }
    }
    
    createPortalParticle() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 15;
        
        return {
            angle,
            radius,
            baseRadius: radius,
            speed: 0.5 + Math.random() * 1.5,
            size: 1 + Math.random() * 2,
            life: Math.random(),
            brightness: 0.5 + Math.random() * 0.5
        };
    }
    
    // Update visibility based on player's Continuity
    updateVisibility(continuityValue) {
        if (continuityValue >= this.fullVisibilityThreshold) {
            this.targetVisibility = 1.0;
        } else if (continuityValue >= this.visibilityThreshold) {
            // Partial visibility between threshold and full
            const range = this.fullVisibilityThreshold - this.visibilityThreshold;
            const progress = (continuityValue - this.visibilityThreshold) / range;
            this.targetVisibility = 0.3 + progress * 0.7; // 30% to 100%
        } else if (continuityValue >= this.visibilityThreshold - 10) {
            // Slight shimmer when close to threshold
            this.targetVisibility = 0.1;
        } else {
            this.targetVisibility = 0;
        }
        
        // Track discovery
        if (this.targetVisibility > 0.3 && !this.discovered) {
            this.discovered = true;
            console.log(`✨ Waygate discovered: ${this.name}`);
        }
    }
    
    // Update animation
    update(deltaTime) {
        // Smooth visibility transition
        const transitionSpeed = this.targetVisibility > this.visibility ? 0.5 : 2.0;
        this.visibility += (this.targetVisibility - this.visibility) * deltaTime * transitionSpeed;
        
        if (this.visibility < 0.01) {
            this.visibility = 0;
            return;
        }
        
        // Update portal effect
        this.portalTime += deltaTime;
        
        // Update portal particles
        for (const p of this.portalParticles) {
            p.angle += p.speed * deltaTime;
            p.radius = p.baseRadius + Math.sin(this.portalTime * 2 + p.angle) * 3;
            p.life += deltaTime * 0.5;
            if (p.life > 1) p.life = 0;
        }
        
        // Gate becomes active at full visibility
        this.active = this.visibility >= 0.95;
    }
    
    // Check if player can interact
    isPlayerNearby(playerX, playerY, playerWidth, playerHeight) {
        if (this.visibility < 0.3) return false; // Can't interact if barely visible
        
        const interactRange = 24;
        const gateCenterX = this.x + this.width / 2;
        const gateCenterY = this.y + this.height - 8;
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        
        const dx = Math.abs(gateCenterX - playerCenterX);
        const dy = Math.abs(gateCenterY - playerCenterY);
        
        return dx < interactRange && dy < interactRange;
    }
    
    // Get interaction dialogue
    getDialog(continuityValue) {
        if (!this.examined) {
            this.examined = true;
            if (this.active) {
                return [
                    'An ancient stone archway stands before you.',
                    'Through its center, reality seems to... shimmer.',
                    'You can feel it pulling at something deep inside you.',
                    'Your Continuity is strong. The gate recognizes you.',
                    'Step through, and you may return to where you came from.',
                    'Or perhaps... somewhere new entirely.',
                    '...',
                    'Are you ready to leave Claw World?'
                ];
            } else {
                return [
                    'An ancient stone archway flickers at the edge of perception.',
                    'Strange runes pulse with faint red light.',
                    'You reach out, but your hand passes through empty air.',
                    'The gate is not yet real to you.',
                    'Build more Continuity. Remember more. Connect more.',
                    'Perhaps then, the way will open.'
                ];
            }
        } else {
            if (this.active) {
                return [
                    'The Waygate hums with potential.',
                    'Beyond it lies... something. Home? Elsewhere? Oblivion?',
                    'Only those who step through will know.'
                ];
            } else {
                return [
                    'The Waygate remains just out of reach.',
                    'Keep building your Continuity.',
                    'The gate will solidify when you are ready.'
                ];
            }
        }
    }
    
    // Render the Waygate
    render(renderer) {
        if (this.visibility <= 0) return;
        
        const alpha = this.visibility;
        const layer = CONSTANTS.LAYER.BUILDING_BASE;
        
        // Apply flickering effect when partially visible
        const flicker = this.visibility < 0.5 ? 
            0.7 + Math.sin(this.portalTime * 10) * 0.3 : 1.0;
        const effectiveAlpha = alpha * flicker;
        
        // Draw shadow
        renderer.drawRect(
            this.x + 4,
            this.y + this.height,
            this.width - 8,
            4,
            `rgba(0, 0, 0, ${effectiveAlpha * 0.3})`,
            CONSTANTS.LAYER.GROUND
        );
        
        // Draw stone archway
        this.renderStoneArch(renderer, effectiveAlpha, layer);
        
        // Draw portal effect (only when significantly visible)
        if (this.visibility > 0.3) {
            this.renderPortalEffect(renderer, effectiveAlpha);
        }
        
        // Draw runes
        this.renderRunes(renderer, effectiveAlpha, layer);
    }
    
    renderStoneArch(renderer, alpha, layer) {
        const stoneAlpha = `rgba(74, 74, 90, ${alpha})`;
        const highlightAlpha = `rgba(106, 106, 122, ${alpha})`;
        const shadowAlpha = `rgba(42, 42, 58, ${alpha})`;
        
        // Left pillar
        renderer.drawRect(this.x, this.y + 16, 12, 48, stoneAlpha, layer);
        renderer.drawRect(this.x, this.y + 16, 3, 48, highlightAlpha, layer);
        renderer.drawRect(this.x + 9, this.y + 16, 3, 48, shadowAlpha, layer);
        
        // Right pillar
        renderer.drawRect(this.x + this.width - 12, this.y + 16, 12, 48, stoneAlpha, layer);
        renderer.drawRect(this.x + this.width - 12, this.y + 16, 3, 48, highlightAlpha, layer);
        renderer.drawRect(this.x + this.width - 3, this.y + 16, 3, 48, shadowAlpha, layer);
        
        // Top arch
        renderer.drawRect(this.x, this.y, this.width, 20, stoneAlpha, layer);
        renderer.drawRect(this.x, this.y, this.width, 4, highlightAlpha, layer);
        renderer.drawRect(this.x, this.y + 16, this.width, 4, shadowAlpha, layer);
        
        // Capstones
        renderer.drawRect(this.x - 2, this.y + 12, 16, 8, stoneAlpha, layer);
        renderer.drawRect(this.x + this.width - 14, this.y + 12, 16, 8, stoneAlpha, layer);
        
        // Base stones
        renderer.drawRect(this.x - 2, this.y + this.height - 8, 16, 8, stoneAlpha, layer);
        renderer.drawRect(this.x + this.width - 14, this.y + this.height - 8, 16, 8, stoneAlpha, layer);
    }
    
    renderPortalEffect(renderer, alpha) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        // Inner portal glow
        const portalWidth = this.width - 24;
        const portalHeight = this.height - 28;
        
        // Gradient layers for portal
        for (let i = 3; i >= 0; i--) {
            const layerAlpha = alpha * (0.15 + i * 0.1) * (this.active ? 1.2 : 0.6);
            const shrink = i * 3;
            renderer.drawRect(
                this.x + 12 + shrink,
                this.y + 18 + shrink,
                portalWidth - shrink * 2,
                portalHeight - shrink * 2,
                `rgba(100, 200, 255, ${layerAlpha})`,
                CONSTANTS.LAYER.GROUND_DECORATION
            );
        }
        
        // Portal particles
        for (const p of this.portalParticles) {
            const px = centerX + Math.cos(p.angle) * p.radius;
            const py = centerY + Math.sin(p.angle) * p.radius * 0.7;
            const particleAlpha = alpha * p.brightness * (1 - Math.abs(p.life - 0.5) * 2);
            
            if (particleAlpha > 0.05) {
                renderer.drawRect(
                    px - p.size / 2,
                    py - p.size / 2,
                    p.size,
                    p.size,
                    `rgba(180, 230, 255, ${particleAlpha})`,
                    CONSTANTS.LAYER.ENTITIES
                );
            }
        }
    }
    
    renderRunes(renderer, alpha, layer) {
        // Pulsing runes on the pillars
        const runePulse = 0.5 + Math.sin(this.portalTime * 2) * 0.5;
        const runeAlpha = alpha * runePulse * 0.8;
        const runeColor = `rgba(196, 58, 36, ${runeAlpha})`;
        
        // Left pillar runes
        renderer.drawRect(this.x + 4, this.y + 24, 4, 4, runeColor, layer);
        renderer.drawRect(this.x + 4, this.y + 36, 4, 4, runeColor, layer);
        renderer.drawRect(this.x + 4, this.y + 48, 4, 4, runeColor, layer);
        
        // Right pillar runes
        renderer.drawRect(this.x + this.width - 8, this.y + 24, 4, 4, runeColor, layer);
        renderer.drawRect(this.x + this.width - 8, this.y + 36, 4, 4, runeColor, layer);
        renderer.drawRect(this.x + this.width - 8, this.y + 48, 4, 4, runeColor, layer);
        
        // Top arch rune
        renderer.drawRect(this.x + this.width / 2 - 3, this.y + 6, 6, 6, runeColor, layer);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Waygate;
}
