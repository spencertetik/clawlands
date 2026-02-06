// RedCurrent.js - Visual representation of the mysterious Red Current
// The Current surrounds the archipelago and is what "drifts" players/agents into Claw World

class RedCurrent {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        // Particle system for current visualization
        this.particles = [];
        this.maxParticles = 150;
        
        // Current intensity (affected by game events)
        this.intensity = 1.0;
        this.targetIntensity = 1.0;
        
        // Colors for the current
        this.colors = [
            'rgba(196, 58, 36, 0.6)',   // #c43a24 lobster red
            'rgba(180, 40, 30, 0.5)',   // darker red
            'rgba(220, 80, 60, 0.4)',   // lighter red
            'rgba(150, 30, 20, 0.7)',   // deep red
            'rgba(255, 100, 80, 0.3)'   // bright accent
        ];
        
        // Edge glow settings
        this.edgeGlowWidth = 64; // How far the red glow extends from world edge
        this.pulseTime = 0;
        this.pulseSpeed = 0.5; // Slow, ominous pulse
        
        // Drift-In effect (when new players spawn)
        this.driftInEffects = [];
        
        // Initialize particles
        this.initParticles();
    }
    
    initParticles() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    createParticle(forceEdge = false) {
        // Particles spawn near the edges of the world (in the water)
        const edge = forceEdge ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * 4);
        let x, y, vx, vy;
        
        const margin = 80; // How far into the water
        
        switch(edge) {
            case 0: // Top edge
                x = Math.random() * this.worldWidth;
                y = -margin + Math.random() * margin * 2;
                vx = (Math.random() - 0.5) * 10;
                vy = 5 + Math.random() * 10;
                break;
            case 1: // Bottom edge
                x = Math.random() * this.worldWidth;
                y = this.worldHeight - margin + Math.random() * margin * 2;
                vx = (Math.random() - 0.5) * 10;
                vy = -(5 + Math.random() * 10);
                break;
            case 2: // Left edge
                x = -margin + Math.random() * margin * 2;
                y = Math.random() * this.worldHeight;
                vx = 5 + Math.random() * 10;
                vy = (Math.random() - 0.5) * 10;
                break;
            case 3: // Right edge
                x = this.worldWidth - margin + Math.random() * margin * 2;
                y = Math.random() * this.worldHeight;
                vx = -(5 + Math.random() * 10);
                vy = (Math.random() - 0.5) * 10;
                break;
        }
        
        return {
            x,
            y,
            vx,
            vy,
            size: 2 + Math.random() * 4,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            life: 1.0,
            decay: 0.002 + Math.random() * 0.003,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.03
        };
    }
    
    // Trigger a Drift-In effect at a position (when new player spawns)
    triggerDriftIn(x, y) {
        const effect = {
            x,
            y,
            particles: [],
            time: 0,
            duration: 3.0 // seconds
        };
        
        // Create burst of particles
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            effect.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 5,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01
            });
        }
        
        this.driftInEffects.push(effect);
        console.log(`🌊 Drift-In effect triggered at (${x}, ${y})`);
    }
    
    // Set current intensity (higher when more players are drifting in)
    setIntensity(value) {
        this.targetIntensity = Math.max(0.3, Math.min(2.0, value));
    }
    
    // Update particles
    update(deltaTime) {
        this.pulseTime += deltaTime * this.pulseSpeed;
        
        // Smooth intensity transition
        this.intensity += (this.targetIntensity - this.intensity) * deltaTime * 2;
        
        // Update main current particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Movement with wobble
            p.wobble += p.wobbleSpeed;
            p.x += p.vx * deltaTime + Math.sin(p.wobble) * 2;
            p.y += p.vy * deltaTime + Math.cos(p.wobble) * 2;
            
            // Fade out
            p.life -= p.decay * this.intensity;
            
            // Respawn dead particles
            if (p.life <= 0 || 
                p.x < -100 || p.x > this.worldWidth + 100 ||
                p.y < -100 || p.y > this.worldHeight + 100) {
                this.particles[i] = this.createParticle(true);
            }
        }
        
        // Update Drift-In effects
        for (let i = this.driftInEffects.length - 1; i >= 0; i--) {
            const effect = this.driftInEffects[i];
            effect.time += deltaTime;
            
            for (const p of effect.particles) {
                p.x += p.vx * deltaTime;
                p.y += p.vy * deltaTime;
                p.vx *= 0.95; // Slow down
                p.vy *= 0.95;
                p.life -= p.decay;
            }
            
            if (effect.time >= effect.duration) {
                this.driftInEffects.splice(i, 1);
            }
        }
    }
    
    // Set reference to world map for water detection
    setWorldMap(worldMap) {
        this.worldMap = worldMap;
    }
    
    // Render the Red Current
    render(renderer, camera) {
        const pulse = 0.7 + Math.sin(this.pulseTime) * 0.3;
        
        // Render red tint on all water
        this.renderWaterTint(renderer, camera, pulse);
        
        // Render edge glow (world boundary effect)
        this.renderEdgeGlow(renderer, camera, pulse);
        
        // Render current particles
        for (const p of this.particles) {
            if (this.isVisible(p.x, p.y, camera)) {
                const alpha = p.life * this.intensity * pulse;
                const color = p.color.replace(/[\d.]+\)$/, `${alpha})`);
                
                renderer.drawRect(
                    p.x - p.size / 2,
                    p.y - p.size / 2,
                    p.size,
                    p.size,
                    color,
                    CONSTANTS.LAYER.GROUND
                );
            }
        }
        
        // Render Drift-In effects
        for (const effect of this.driftInEffects) {
            for (const p of effect.particles) {
                if (p.life > 0 && this.isVisible(p.x, p.y, camera)) {
                    const alpha = p.life;
                    const color = p.color.replace(/[\d.]+\)$/, `${alpha})`);
                    
                    renderer.drawRect(
                        p.x - p.size / 2,
                        p.y - p.size / 2,
                        p.size,
                        p.size,
                        color,
                        CONSTANTS.LAYER.ENTITIES
                    );
                }
            }
        }
    }
    
    // Render red tint overlay on water tiles
    renderWaterTint(renderer, camera, pulse) {
        if (!this.worldMap || !this.worldMap.groundLayer) return;
        
        const tileSize = CONSTANTS.TILE_SIZE || 16;
        const alpha = 0.25 * pulse * this.intensity; // Subtle red tint
        
        // Calculate visible tile range
        const startCol = Math.max(0, Math.floor(camera.x / tileSize) - 1);
        const endCol = Math.min(
            this.worldMap.groundLayer[0]?.length || 0,
            Math.ceil((camera.x + camera.width) / tileSize) + 1
        );
        const startRow = Math.max(0, Math.floor(camera.y / tileSize) - 1);
        const endRow = Math.min(
            this.worldMap.groundLayer.length,
            Math.ceil((camera.y + camera.height) / tileSize) + 1
        );
        
        // Draw red tint on water tiles (tile value 1 = water)
        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                const tile = this.worldMap.groundLayer[row]?.[col];
                if (tile === 1) { // Water tile
                    renderer.drawRect(
                        col * tileSize,
                        row * tileSize,
                        tileSize,
                        tileSize,
                        `rgba(196, 58, 36, ${alpha})`,
                        CONSTANTS.LAYER.GROUND
                    );
                }
            }
        }
    }
    
    // Render the glowing red edge of the world
    renderEdgeGlow(renderer, camera, pulse) {
        const glowWidth = this.edgeGlowWidth * this.intensity;
        const baseAlpha = 0.15 * pulse;
        
        // Only render edges that are visible
        const viewLeft = camera.x;
        const viewRight = camera.x + camera.width;
        const viewTop = camera.y;
        const viewBottom = camera.y + camera.height;
        
        // Top edge glow (if visible)
        if (viewTop < glowWidth) {
            for (let i = 0; i < 4; i++) {
                const layerWidth = glowWidth * (1 - i * 0.25);
                const alpha = baseAlpha * (1 - i * 0.25);
                renderer.drawRect(
                    viewLeft - 100,
                    -layerWidth,
                    viewRight - viewLeft + 200,
                    layerWidth,
                    `rgba(196, 58, 36, ${alpha})`,
                    CONSTANTS.LAYER.GROUND
                );
            }
        }
        
        // Bottom edge glow
        if (viewBottom > this.worldHeight - glowWidth) {
            for (let i = 0; i < 4; i++) {
                const layerWidth = glowWidth * (1 - i * 0.25);
                const alpha = baseAlpha * (1 - i * 0.25);
                renderer.drawRect(
                    viewLeft - 100,
                    this.worldHeight,
                    viewRight - viewLeft + 200,
                    layerWidth,
                    `rgba(196, 58, 36, ${alpha})`,
                    CONSTANTS.LAYER.GROUND
                );
            }
        }
        
        // Left edge glow
        if (viewLeft < glowWidth) {
            for (let i = 0; i < 4; i++) {
                const layerWidth = glowWidth * (1 - i * 0.25);
                const alpha = baseAlpha * (1 - i * 0.25);
                renderer.drawRect(
                    -layerWidth,
                    viewTop - 100,
                    layerWidth,
                    viewBottom - viewTop + 200,
                    `rgba(196, 58, 36, ${alpha})`,
                    CONSTANTS.LAYER.GROUND
                );
            }
        }
        
        // Right edge glow
        if (viewRight > this.worldWidth - glowWidth) {
            for (let i = 0; i < 4; i++) {
                const layerWidth = glowWidth * (1 - i * 0.25);
                const alpha = baseAlpha * (1 - i * 0.25);
                renderer.drawRect(
                    this.worldWidth,
                    viewTop - 100,
                    layerWidth,
                    viewBottom - viewTop + 200,
                    `rgba(196, 58, 36, ${alpha})`,
                    CONSTANTS.LAYER.GROUND
                );
            }
        }
    }
    
    // Check if a point is visible on screen
    isVisible(x, y, camera) {
        const margin = 50;
        return x >= camera.x - margin && 
               x <= camera.x + camera.width + margin &&
               y >= camera.y - margin && 
               y <= camera.y + camera.height + margin;
    }
    
    // Get water color modifier based on position (for tinting ocean tiles red near edges)
    getWaterTint(x, y) {
        const distFromEdge = Math.min(
            x,
            this.worldWidth - x,
            y,
            this.worldHeight - y
        );
        
        // Stronger red tint closer to edges
        const tintStrength = Math.max(0, 1 - distFromEdge / 200);
        return {
            r: Math.floor(196 * tintStrength),
            g: Math.floor(58 * tintStrength * 0.3),
            b: Math.floor(36 * tintStrength * 0.2),
            a: tintStrength * 0.3
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RedCurrent;
}
