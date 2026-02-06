// FootstepEffects.js - Particle effects for footsteps (dust, sand, splashes)
// Adds visual feedback and polish to movement

class FootstepEffects {
    constructor() {
        this.particles = [];
        this.maxParticles = 50;
        
        // Timing
        this.stepTimer = 0;
        this.stepInterval = 0.15; // Seconds between footstep effects
        
        // Colors for different terrain
        this.colors = {
            sand: ['#e8d5bc', '#f0dca8', '#d4c4a8'],
            grass: ['#48d060', '#5ae070', '#3ab050'],
            water: ['#5090d0', '#70b0e8', '#90c8f0'],
            path: ['#b89878', '#c8a888', '#a88868']
        };
        
        // Last position for movement detection
        this.lastX = 0;
        this.lastY = 0;
    }
    
    // Create a footstep particle
    createParticle(x, y, terrain = 'sand') {
        const colors = this.colors[terrain] || this.colors.sand;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Different effects for water
        if (terrain === 'water') {
            return {
                x: x + (Math.random() - 0.5) * 8,
                y: y,
                vx: (Math.random() - 0.5) * 20,
                vy: -20 - Math.random() * 15,
                size: 2 + Math.random() * 2,
                color: color,
                alpha: 0.7,
                gravity: 50,
                life: 0.4 + Math.random() * 0.2,
                maxLife: 0.6
            };
        }
        
        // Dust/sand particles
        return {
            x: x + (Math.random() - 0.5) * 6,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: -5 - Math.random() * 10,
            size: 1 + Math.random() * 2,
            color: color,
            alpha: 0.6,
            gravity: 20,
            life: 0.3 + Math.random() * 0.2,
            maxLife: 0.5
        };
    }
    
    // Spawn footstep particles
    spawnFootstep(x, y, terrain = 'sand') {
        const count = terrain === 'water' ? 5 : 3;
        
        for (let i = 0; i < count; i++) {
            if (this.particles.length < this.maxParticles) {
                this.particles.push(this.createParticle(x, y, terrain));
            }
        }
    }
    
    // Update particles and handle footstep timing
    update(deltaTime, player, worldMap) {
        // Check if player is moving
        const dx = player.position.x - this.lastX;
        const dy = player.position.y - this.lastY;
        const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
        
        this.lastX = player.position.x;
        this.lastY = player.position.y;
        
        // Spawn footsteps while moving
        if (isMoving && player.isMoving) {
            this.stepTimer += deltaTime;
            
            if (this.stepTimer >= this.stepInterval) {
                this.stepTimer = 0;
                
                // Get terrain type at player position
                const terrain = this.getTerrainType(
                    player.position.x + player.width / 2,
                    player.position.y + player.height,
                    worldMap
                );
                
                // Spawn particles at player's feet
                this.spawnFootstep(
                    player.position.x + player.width / 2,
                    player.position.y + player.height - 2,
                    terrain
                );
            }
        }
        
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Physics
            p.vy += p.gravity * deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            
            // Lifetime
            p.life -= deltaTime;
            p.alpha = Math.max(0, (p.life / p.maxLife) * 0.6);
            
            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    // Get terrain type from world map
    getTerrainType(x, y, worldMap) {
        if (!worldMap || !worldMap.groundLayer) return 'sand';
        
        const tileSize = CONSTANTS.TILE_SIZE || 16;
        const col = Math.floor(x / tileSize);
        const row = Math.floor(y / tileSize);
        
        const tile = worldMap.groundLayer[row]?.[col];
        
        // Tile types: 0 = land/sand, 1 = water
        if (tile === 1) return 'water';
        
        // Check if on a path (decoration layer)
        // For now, default to sand
        return 'sand';
    }
    
    // Render particles
    render(renderer) {
        for (const p of this.particles) {
            if (p.alpha > 0.01) {
                const color = p.color.startsWith('#') ?
                    this.hexToRgba(p.color, p.alpha) :
                    p.color.replace(/[\d.]+\)$/, `${p.alpha})`);
                
                renderer.drawRect(
                    p.x - p.size / 2,
                    p.y - p.size / 2,
                    p.size,
                    p.size,
                    color,
                    CONSTANTS.LAYER.GROUND_DECORATION
                );
            }
        }
    }
    
    // Convert hex color to rgba
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FootstepEffects;
}
