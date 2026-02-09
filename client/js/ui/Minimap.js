// Minimap.js - Small overview map showing player position and nearby features
// Helps players navigate the archipelago

class Minimap {
    constructor(worldMap, worldWidth, worldHeight) {
        this.worldMap = worldMap;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        // Minimap display settings
        this.size = 120;  // Size in pixels
        this.margin = 15;
        this.scale = this.size / Math.max(worldWidth, worldHeight);
        
        // Canvas for rendering
        this.canvas = null;
        this.ctx = null;
        this.mapTexture = null; // Pre-rendered map texture
        
        // Visibility
        this.visible = true;
        this.expanded = false; // Toggle larger view
        this.expandedSize = 250;
        
        // Colors
        this.colors = {
            water: '#1e5f8a',
            land: '#e8d5bc',
            sand: '#f0dca8',
            building: '#8b5a2b',
            player: '#c43a24',
            playerGlow: 'rgba(196, 58, 36, 0.4)',
            npc: '#4ade80',
            waygate: '#4a9eff',
            border: 'rgba(0, 0, 0, 0.5)',
            background: 'rgba(0, 0, 0, 0.6)'
        };
        
        // Blip animations
        this.pulseTime = 0;
        
        this.init();
    }
    
    init() {
        // Detect mobile/touch device
        this.isMobile = ('ontouchstart' in window) || 
                        (navigator.maxTouchPoints > 0) || 
                        (navigator.msMaxTouchPoints > 0);
        
        // Hide minimap on mobile - screen too crowded with touch controls
        if (this.isMobile) {
            this.visible = false;
            return;
        }
        
        // Create container - bottom-right on desktop
        // Starts hidden until game is fully loaded and player enters world
        this.container = document.createElement('div');
        this.container.id = 'minimap-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: ${this.margin}px;
            right: ${this.margin}px;
            z-index: 1000;
            pointer-events: auto;
            cursor: pointer;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            display: none;
        `;
        
        this.isShown = false;
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.container.appendChild(this.canvas);
        
        // Click to expand/collapse
        this.container.addEventListener('click', () => {
            this.toggleExpanded();
        });
        
        document.body.appendChild(this.container);
        
        // Pre-render the map texture
        this.prerenderMap();
    }
    
    // Pre-render the static map (islands, water)
    prerenderMap() {
        // Use terrainMap (0=land, 1=water) instead of groundLayer (auto-tiled IDs)
        if (!this.worldMap || !this.worldMap.terrainMap) return;
        
        const terrainMap = this.worldMap.terrainMap;
        const rows = terrainMap.length;
        const cols = terrainMap[0]?.length || 0;
        
        // Create texture canvas at actual tile resolution
        const texCanvas = document.createElement('canvas');
        texCanvas.width = cols;
        texCanvas.height = rows;
        const texCtx = texCanvas.getContext('2d');
        texCtx.imageSmoothingEnabled = false;
        
        // Draw each tile as a single pixel
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isWater = terrainMap[r][c] === 1;
                if (isWater) {
                    // Deep vs shallow water based on distance from land
                    texCtx.fillStyle = this.colors.water;
                } else {
                    // Check if it's a beach tile (land adjacent to water)
                    let nearWater = false;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && terrainMap[nr][nc] === 1) {
                                nearWater = true;
                            }
                        }
                    }
                    texCtx.fillStyle = nearWater ? this.colors.sand : this.colors.land;
                }
                texCtx.fillRect(c, r, 1, 1);
            }
        }
        
        this.mapTexture = texCanvas;
    }
    
    // Toggle expanded view
    toggleExpanded() {
        this.expanded = !this.expanded;
        const size = this.expanded ? this.expandedSize : this.size;
        
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx.imageSmoothingEnabled = false;
    }
    
    // Show the minimap (only if not on mobile)
    show() {
        if (this.isMobile) return; // Stay hidden on mobile
        this.visible = true;
        this.isShown = true;
        // DOM container no longer used — minimap renders on game canvas
        if (this.container) this.container.style.display = 'none';
    }
    
    // Hide the minimap
    hide() {
        this.visible = false;
        this.isShown = false;
        if (this.container) this.container.style.display = 'none';
    }
    
    // Update minimap
    update(deltaTime, player, npcs, buildings, waygates, remotePlayers) {
        if (!this.visible) return;
        
        this.pulseTime += deltaTime * 3;
        
        // Store references for rendering
        this.player = player;
        this.npcs = npcs || [];
        this.buildings = buildings || [];
        this.waygates = waygates || [];
        this.remotePlayers = remotePlayers || [];
    }
    
    // Render the minimap
    render() {
        if (!this.visible || !this.ctx) return;
        
        const ctx = this.ctx;
        const size = this.expanded ? this.expandedSize : this.size;
        // worldWidth/worldHeight are already in pixels (tiles * TILE_SIZE)
        const worldPixelSize = Math.max(this.worldWidth, this.worldHeight);
        const scale = size / worldPixelSize;
        
        // Clear
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, size, size);
        
        // Draw pre-rendered map texture
        if (this.mapTexture) {
            ctx.drawImage(this.mapTexture, 0, 0, size, size);
        }
        
        // Draw buildings as small squares
        ctx.fillStyle = this.colors.building;
        for (const building of this.buildings) {
            const x = building.x * scale;
            const y = building.y * scale;
            const w = Math.max(3, building.width * scale);
            const h = Math.max(3, building.height * scale);
            ctx.fillRect(x, y, w, h);
        }
        
        // Draw waygates (if visible)
        for (const waygate of this.waygates) {
            if (waygate.visibility > 0.3) {
                const x = waygate.x * scale + 2;
                const y = waygate.y * scale + 2;
                const pulse = 0.5 + Math.sin(this.pulseTime) * 0.5;
                
                // Glow
                ctx.fillStyle = `rgba(74, 158, 255, ${waygate.visibility * 0.3 * pulse})`;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Core
                ctx.fillStyle = `rgba(74, 158, 255, ${waygate.visibility})`;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw NPCs as small dots
        ctx.fillStyle = this.colors.npc;
        for (const npc of this.npcs) {
            const x = npc.position.x * scale;
            const y = npc.position.y * scale;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw remote players (other humans/bots)
        for (const remote of this.remotePlayers) {
            const rx = remote.position.x * scale;
            const ry = remote.position.y * scale;
            
            if (remote.isBot) {
                // Bots: cyan dot
                ctx.fillStyle = 'rgba(94, 234, 212, 0.7)';
                ctx.beginPath();
                ctx.arc(rx, ry, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Other humans: yellow dot with pulse
                const pulse = 0.6 + Math.sin(this.pulseTime * 0.8) * 0.4;
                ctx.fillStyle = `rgba(255, 220, 100, ${pulse})`;
                ctx.beginPath();
                ctx.arc(rx, ry, 3, 0, Math.PI * 2);
                ctx.fill();
                // White core
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw player
        if (this.player) {
            const px = this.player.position.x * scale;
            const py = this.player.position.y * scale;
            const pulse = 0.7 + Math.sin(this.pulseTime) * 0.3;
            
            // Player glow
            ctx.fillStyle = this.colors.playerGlow;
            ctx.beginPath();
            ctx.arc(px, py, 6 * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Player dot
            ctx.fillStyle = this.colors.player;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Direction indicator
            const dirOffsets = {
                south: { x: 0, y: 1 },
                north: { x: 0, y: -1 },
                east: { x: 1, y: 0 },
                west: { x: -1, y: 0 }
            };
            const dir = dirOffsets[this.player.direction] || dirOffsets.south;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(px + dir.x * 5, py + dir.y * 5, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw border
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
        
        // Draw compass
        this.drawCompass(ctx, size);
    }
    
    drawCompass(ctx, size) {
        const cx = 15;
        const cy = 15;
        
        // N indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Minimap;
}
