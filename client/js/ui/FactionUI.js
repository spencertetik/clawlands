// FactionUI.js - Displays faction reputation status
// Shows compact faction standings, expandable with F key

class FactionUI {
    constructor(factionSystem) {
        this.factionSystem = factionSystem;
        this.isExpanded = false;
        this.fadeTimer = 0;
        this.recentChange = null;
        
        // Position (top-left, below other UI)
        this.x = 10;
        this.y = 80;
        
        // Colors matching the red terminal theme
        this.colors = {
            bg: 'rgba(13, 8, 6, 0.85)',
            border: '#c43a24',
            text: '#e8d5cc',
            muted: '#8a7068',
            highlight: '#c43a24'
        };
        
        // Faction icons/symbols
        this.factionIcons = {
            anchors: '⚓',
            drifters: '🌀',
            threadkeepers: '📜',
            church_of_molt: '🦞',
            iron_reef: '⚙️'
        };
    }
    
    // Show a recent rep change notification
    showChange(factionId, amount) {
        this.recentChange = {
            faction: factionId,
            amount: amount,
            timer: 3
        };
        this.fadeTimer = 5; // Show UI for 5 seconds after change
    }
    
    update(deltaTime) {
        if (this.fadeTimer > 0) {
            this.fadeTimer -= deltaTime;
        }
        if (this.recentChange) {
            this.recentChange.timer -= deltaTime;
            if (this.recentChange.timer <= 0) {
                this.recentChange = null;
            }
        }
    }
    
    toggle() {
        this.isExpanded = !this.isExpanded;
        if (this.isExpanded) {
            this.fadeTimer = 999; // Keep visible while expanded
        } else {
            this.fadeTimer = 3;
        }
    }
    
    render(ctx) {
        if (!this.factionSystem) return;
        
        // Only show if expanded or recently changed
        const shouldShow = this.isExpanded || this.fadeTimer > 0 || this.recentChange;
        if (!shouldShow) return;
        
        const alpha = this.isExpanded ? 1 : Math.min(1, this.fadeTimer);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        if (this.isExpanded) {
            this.renderExpanded(ctx);
        } else {
            this.renderCompact(ctx);
        }
        
        ctx.restore();
    }
    
    renderCompact(ctx) {
        // Just show the recent change notification
        if (!this.recentChange) return;
        
        const faction = this.factionSystem.factions[this.recentChange.faction];
        if (!faction) return;
        
        const icon = this.factionIcons[this.recentChange.faction] || '•';
        const amount = this.recentChange.amount;
        const sign = amount > 0 ? '+' : '';
        const color = amount > 0 ? '#4CAF50' : '#F44336';
        
        // Draw notification box
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(this.x, this.y, 200, 30);
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, 200, 30);
        
        // Draw text
        ctx.font = '12px monospace';
        ctx.fillStyle = this.colors.text;
        ctx.fillText(`${icon} ${faction.name}`, this.x + 8, this.y + 19);
        
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(`${sign}${amount}`, this.x + 192, this.y + 19);
        ctx.textAlign = 'left';
    }
    
    renderExpanded(ctx) {
        const allFactions = this.factionSystem.getAllFactionStatus();
        const factionIds = Object.keys(allFactions);
        const lineHeight = 28;
        const width = 220;
        const height = 40 + factionIds.length * lineHeight;
        
        // Background
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(this.x, this.y, width, height);
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, width, height);
        
        // Header
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = this.colors.highlight;
        ctx.fillText('⚔️ FACTION STANDING', this.x + 10, this.y + 22);
        
        // Faction lines
        let yPos = this.y + 45;
        for (const factionId of factionIds) {
            const faction = allFactions[factionId];
            const icon = this.factionIcons[factionId] || '•';
            
            // Icon and name
            ctx.font = '12px monospace';
            ctx.fillStyle = this.colors.text;
            ctx.fillText(`${icon} ${faction.name}`, this.x + 10, yPos);
            
            // Reputation level
            const levelColor = this.getLevelColor(faction.level);
            ctx.fillStyle = levelColor;
            ctx.textAlign = 'right';
            ctx.fillText(faction.level, this.x + width - 10, yPos);
            ctx.textAlign = 'left';
            
            // Small rep number
            ctx.fillStyle = this.colors.muted;
            ctx.font = '10px monospace';
            ctx.fillText(`(${faction.reputation})`, this.x + width - 70, yPos);
            
            yPos += lineHeight;
        }
        
        // Footer hint
        ctx.font = '10px monospace';
        ctx.fillStyle = this.colors.muted;
        ctx.fillText('[F] to close', this.x + 10, this.y + height - 8);
    }
    
    getLevelColor(level) {
        switch (level) {
            case 'Exalted': return '#FFD700';
            case 'Honored': return '#9370DB';
            case 'Trusted': return '#4CAF50';
            case 'Friendly': return '#8BC34A';
            case 'Neutral': return '#9E9E9E';
            case 'Unfriendly': return '#FF9800';
            case 'Hostile': return '#F44336';
            default: return '#9E9E9E';
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FactionUI;
}
