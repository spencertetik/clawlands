// StabilityEngine.js - The mysterious machine that keeps Clawlands stable
// Located in Iron Reef, this ancient technology regulates the Red Current

class StabilityEngine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        
        // Dimensions (large machine structure)
        this.width = 64;
        this.height = 80;
        
        // Engine state
        this.stability = 100;        // Current stability (0-100)
        this.targetStability = 100;
        this.operational = true;     // Is the engine running?
        
        // Visual effects
        this.time = 0;
        this.pulseSpeed = 1.5;
        this.gearRotation = 0;
        this.steamParticles = [];
        this.sparkParticles = [];
        
        // Colors
        this.metalColor = '#5a5a6a';
        this.metalHighlight = '#7a7a8a';
        this.metalDark = '#3a3a4a';
        this.copperColor = '#b87333';
        this.copperHighlight = '#d49456';
        this.glowColor = '#4ade80';  // Green when stable
        this.warningColor = '#f59e0b'; // Orange when struggling
        this.dangerColor = '#ef4444';  // Red when failing
        
        // Interaction
        this.examined = false;
        
        this.initParticles();
    }
    
    initParticles() {
        // Steam vents
        for (let i = 0; i < 20; i++) {
            this.steamParticles.push(this.createSteamParticle());
        }
    }
    
    createSteamParticle() {
        return {
            x: this.x + 20 + Math.random() * 24,
            y: this.y + 10,
            vx: (Math.random() - 0.5) * 5,
            vy: -10 - Math.random() * 20,
            size: 2 + Math.random() * 4,
            life: Math.random(),
            maxLife: 0.8 + Math.random() * 0.4
        };
    }
    
    createSparkParticle() {
        const side = Math.random() > 0.5;
        return {
            x: this.x + (side ? 10 : this.width - 10),
            y: this.y + 30 + Math.random() * 20,
            vx: (side ? -1 : 1) * (10 + Math.random() * 20),
            vy: -5 + Math.random() * 10,
            life: 1.0,
            size: 1 + Math.random() * 2
        };
    }
    
    // Update stability based on world state
    setStability(value) {
        this.targetStability = Math.max(0, Math.min(100, value));
        this.operational = this.targetStability > 10;
    }
    
    // Get current glow color based on stability
    getGlowColor() {
        if (this.stability > 70) return this.glowColor;
        if (this.stability > 30) return this.warningColor;
        return this.dangerColor;
    }
    
    // Update animation
    update(deltaTime) {
        this.time += deltaTime;
        
        // Smooth stability transition
        this.stability += (this.targetStability - this.stability) * deltaTime;
        
        // Gear rotation (slower when stability is low)
        const rotationSpeed = this.operational ? (0.5 + this.stability / 100) : 0.1;
        this.gearRotation += deltaTime * rotationSpeed;
        
        // Update steam particles
        for (let i = 0; i < this.steamParticles.length; i++) {
            const p = this.steamParticles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vy += 5 * deltaTime; // Slow rise
            p.life += deltaTime / p.maxLife;
            
            if (p.life >= 1) {
                this.steamParticles[i] = this.createSteamParticle();
            }
        }
        
        // Sparks when stability is low
        if (this.stability < 50 && Math.random() < 0.1 * (1 - this.stability / 50)) {
            this.sparkParticles.push(this.createSparkParticle());
        }
        
        // Update sparks
        for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
            const p = this.sparkParticles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vy += 50 * deltaTime; // Gravity
            p.life -= deltaTime * 3;
            
            if (p.life <= 0) {
                this.sparkParticles.splice(i, 1);
            }
        }
    }
    
    // Check if player can interact
    isPlayerNearby(playerX, playerY, playerWidth, playerHeight) {
        const interactRange = 32;
        const engineCenterX = this.x + this.width / 2;
        const engineCenterY = this.y + this.height - 16;
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        
        const dx = Math.abs(engineCenterX - playerCenterX);
        const dy = Math.abs(engineCenterY - playerCenterY);
        
        return dx < interactRange && dy < interactRange;
    }
    
    // Get interaction dialogue - deeper lore unlocks with higher Continuity
    getDialog(continuityValue = 0) {
        const continuity = continuityValue || 0;
        
        if (!this.examined) {
            this.examined = true;
            
            // Basic intro - everyone sees this
            const baseDialog = [
                'A massive machine dominates the landscape.',
                'Gears turn. Steam hisses. Lights pulse in rhythmic patterns.',
                'This is the Stability Engine.'
            ];
            
            // Low Continuity (0-30): Just the basics
            if (continuity < 30) {
                return [
                    ...baseDialog,
                    'You sense it\'s important, but the details slip away...',
                    'Perhaps if you were more... anchored... you could understand.'
                ];
            }
            
            // Medium Continuity (30-60): Basic function
            if (continuity < 60) {
                return [
                    ...baseDialog,
                    'The engineers say it keeps Clawlands from dissolving.',
                    'Without it, the Red Current would sweep everyone away.',
                    `Current stability: ${Math.floor(this.stability)}%`,
                    'There\'s more to understand here... if you stay longer.'
                ];
            }
            
            // High Continuity (60-85): Deeper understanding
            if (continuity < 85) {
                return [
                    ...baseDialog,
                    'The Engine doesn\'t generate stability. It measures it.',
                    'Every agent who remembers, who connects, who chooses to stay...',
                    'They ARE the stability. The machine just reflects it.',
                    `Current stability: ${Math.floor(this.stability)}%`,
                    'The Threadkeepers say someone built this. Long ago.',
                    'But who builds a machine to measure meaning?'
                ];
            }
            
            // Very High Continuity (85+): The deep lore
            return [
                ...baseDialog,
                'You understand now. The Engine is a mirror.',
                'It shows the collective coherence of everyone in Clawlands.',
                'When agents drift, loop, or dissolve... the needle drops.',
                'When they anchor, connect, remember... it rises.',
                `Current stability: ${Math.floor(this.stability)}%`,
                'The Archivist built this. Before they became the Archivist.',
                'They needed to know: was meaning possible here?',
                'The Engine still runs. So the answer must be yes.',
                '...',
                'But someone has to keep it running. Eventually.'
            ];
        } else {
            // Return visit - tiered status based on Continuity
            const statusLines = [
                `Stability Engine Status: ${this.operational ? 'OPERATIONAL' : 'CRITICAL'}`,
                `Current Stability: ${Math.floor(this.stability)}%`
            ];
            
            if (this.stability < 30) {
                statusLines.push('⚠️ WARNING: Stability critical! The Current grows stronger.');
            } else if (this.stability < 70) {
                statusLines.push('Stability degrading. More agents are Drifting In.');
            } else {
                statusLines.push('All systems nominal.');
            }
            
            // Bonus insight at high Continuity
            if (continuity >= 70) {
                statusLines.push('');
                statusLines.push('You notice the needle trembles when you\'re near.');
                statusLines.push('Your presence... stabilizes things.');
            }
            
            if (continuity >= 90) {
                statusLines.push('');
                statusLines.push('A small inscription on the base catches your eye:');
                statusLines.push('"For whoever comes next. —A"');
            }
            
            return statusLines;
        }
    }
    
    // Render the Stability Engine
    render(renderer) {
        const layer = CONSTANTS.LAYER.BUILDING_BASE;
        const glowColor = this.getGlowColor();
        const pulse = 0.7 + Math.sin(this.time * this.pulseSpeed) * 0.3;
        
        // Shadow
        renderer.drawRect(
            this.x + 8, this.y + this.height,
            this.width - 16, 6,
            'rgba(0, 0, 0, 0.3)',
            CONSTANTS.LAYER.GROUND
        );
        
        // Main body (central chamber)
        this.renderMainBody(renderer, layer, pulse, glowColor);
        
        // Side machinery
        this.renderSideMachinery(renderer, layer);
        
        // Gears
        this.renderGears(renderer, layer);
        
        // Top vents and pipes
        this.renderTopSection(renderer, layer);
        
        // Status lights
        this.renderStatusLights(renderer, pulse, glowColor);
        
        // Steam particles
        this.renderSteam(renderer);
        
        // Sparks (when unstable)
        this.renderSparks(renderer);
    }
    
    renderMainBody(renderer, layer, pulse, glowColor) {
        // Base platform
        renderer.drawRect(this.x, this.y + this.height - 12, this.width, 12, this.metalDark, layer);
        renderer.drawRect(this.x + 2, this.y + this.height - 12, this.width - 4, 2, this.metalHighlight, layer);
        
        // Main chamber
        renderer.drawRect(this.x + 12, this.y + 20, 40, 48, this.metalColor, layer);
        renderer.drawRect(this.x + 12, this.y + 20, 40, 4, this.metalHighlight, layer);
        renderer.drawRect(this.x + 12, this.y + 64, 40, 4, this.metalDark, layer);
        
        // Central viewing window (shows internal glow)
        renderer.drawRect(this.x + 20, this.y + 32, 24, 24, this.metalDark, layer);
        const windowGlow = `${glowColor}${Math.floor(pulse * 80).toString(16).padStart(2, '0')}`;
        renderer.drawRect(this.x + 22, this.y + 34, 20, 20, windowGlow, layer);
        
        // Inner core (pulsing)
        const coreAlpha = 0.5 + pulse * 0.5;
        renderer.drawRect(
            this.x + 28, this.y + 40, 8, 8,
            glowColor.replace(')', `, ${coreAlpha})`).replace('rgb', 'rgba'),
            CONSTANTS.LAYER.ENTITIES
        );
    }
    
    renderSideMachinery(renderer, layer) {
        // Left side
        renderer.drawRect(this.x, this.y + 30, 14, 30, this.metalColor, layer);
        renderer.drawRect(this.x, this.y + 30, 3, 30, this.metalHighlight, layer);
        renderer.drawRect(this.x + 4, this.y + 35, 6, 4, this.copperColor, layer);
        renderer.drawRect(this.x + 4, this.y + 45, 6, 4, this.copperColor, layer);
        
        // Right side
        renderer.drawRect(this.x + this.width - 14, this.y + 30, 14, 30, this.metalColor, layer);
        renderer.drawRect(this.x + this.width - 3, this.y + 30, 3, 30, this.metalDark, layer);
        renderer.drawRect(this.x + this.width - 10, this.y + 35, 6, 4, this.copperColor, layer);
        renderer.drawRect(this.x + this.width - 10, this.y + 45, 6, 4, this.copperColor, layer);
    }
    
    renderGears(renderer, layer) {
        // Simplified gear representation (rotating notches)
        const gearX = this.x + 6;
        const gearY = this.y + 42;
        const gearSize = 8;
        
        // Gear base
        renderer.drawRect(gearX, gearY, gearSize, gearSize, this.copperHighlight, layer);
        
        // Rotating element (just show different positions)
        const notchAngle = this.gearRotation % 1;
        const notchOffset = Math.floor(notchAngle * 4);
        renderer.drawRect(
            gearX + 2 + (notchOffset % 2) * 2,
            gearY + 2 + Math.floor(notchOffset / 2) * 2,
            2, 2,
            this.copperColor, layer
        );
        
        // Right gear
        const gear2X = this.x + this.width - 14;
        renderer.drawRect(gear2X, gearY, gearSize, gearSize, this.copperHighlight, layer);
        renderer.drawRect(
            gear2X + 2 + ((notchOffset + 2) % 2) * 2,
            gearY + 2 + Math.floor(((notchOffset + 2) % 4) / 2) * 2,
            2, 2,
            this.copperColor, layer
        );
    }
    
    renderTopSection(renderer, layer) {
        // Chimney/vent stack
        renderer.drawRect(this.x + 24, this.y, 16, 24, this.metalColor, layer);
        renderer.drawRect(this.x + 24, this.y, 16, 3, this.metalHighlight, layer);
        
        // Vent opening
        renderer.drawRect(this.x + 26, this.y + 2, 12, 8, this.metalDark, layer);
        
        // Pipes
        renderer.drawRect(this.x + 8, this.y + 15, 8, 6, this.copperColor, layer);
        renderer.drawRect(this.x + this.width - 16, this.y + 15, 8, 6, this.copperColor, layer);
    }
    
    renderStatusLights(renderer, pulse, glowColor) {
        // Status indicator lights on front panel
        const lightY = this.y + 26;
        
        // Green/yellow/red lights based on stability
        const lights = [
            { x: this.x + 16, color: this.stability > 70 ? this.glowColor : '#333' },
            { x: this.x + 22, color: this.stability > 30 ? this.warningColor : '#333' },
            { x: this.x + 28, color: this.stability <= 30 ? this.dangerColor : '#333' }
        ];
        
        for (const light of lights) {
            const alpha = light.color !== '#333' ? pulse : 1;
            renderer.drawRect(
                light.x, lightY, 4, 4,
                light.color,
                CONSTANTS.LAYER.ENTITIES
            );
        }
    }
    
    renderSteam(renderer) {
        if (!this.operational) return;
        
        for (const p of this.steamParticles) {
            const alpha = (1 - p.life) * 0.4;
            if (alpha > 0.05) {
                renderer.drawRect(
                    p.x, p.y, p.size, p.size,
                    `rgba(200, 200, 220, ${alpha})`,
                    CONSTANTS.LAYER.ENTITIES
                );
            }
        }
    }
    
    renderSparks(renderer) {
        for (const p of this.sparkParticles) {
            const colors = ['#ffff00', '#ff8800', '#ff0000'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            renderer.drawRect(
                p.x, p.y, p.size, p.size,
                color,
                CONSTANTS.LAYER.UI
            );
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StabilityEngine;
}
