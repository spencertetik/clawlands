// ContinuityMeter.js - Simple visual feedback for player's Continuity level
// Shows as a small bar that fills as Continuity increases

class ContinuityMeter {
    constructor() {
        this.container = null;
        this.fillElement = null;
        this.labelElement = null;
        
        // Current display value (smoothly animated)
        this.displayValue = 0;
        this.targetValue = 0;
        
        // Visibility
        this.visible = false;
        this.showLabel = false;
        this.labelTimer = 0;
        
        // Colors based on tier
        this.tierColors = {
            'new': '#888888',        // Gray - just arrived
            exploring: '#4a9eff',   // Blue - finding footing
            familiar: '#4ade80',    // Green - getting known
            known: '#f59e0b',       // Gold - solid reputation
            rooted: '#c43a24'       // Lobster red - fully present
        };
        
        this.currentColor = this.tierColors.exploring;
        
        this.init();
    }
    
    init() {
        // Create container - simple horizontal bar
        this.container = document.createElement('div');
        this.container.id = 'continuity-meter';
        this.container.style.cssText = `
            position: absolute;
            top: 50px;
            left: 15px;
            z-index: 1000;
            pointer-events: auto;
            cursor: help;
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = `
            font-size: 16px;
        `;
        icon.textContent = '~';
        this.container.appendChild(icon);
        
        // Bar background
        const barBg = document.createElement('div');
        barBg.style.cssText = `
            width: 60px;
            height: 8px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        this.container.appendChild(barBg);
        
        // Bar fill
        this.fillElement = document.createElement('div');
        this.fillElement.style.cssText = `
            width: 0%;
            height: 100%;
            background: ${this.currentColor};
            border-radius: 4px;
            transition: width 0.3s ease, background 0.3s ease;
        `;
        barBg.appendChild(this.fillElement);
        
        // Label (shows on hover or change)
        this.labelElement = document.createElement('div');
        this.labelElement.style.cssText = `
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        `;
        this.container.appendChild(this.labelElement);
        
        // Hover events
        this.container.addEventListener('mouseenter', () => {
            this.showLabel = true;
            this.labelElement.style.opacity = '1';
        });
        this.container.addEventListener('mouseleave', () => {
            this.showLabel = false;
            this.labelElement.style.opacity = '0';
        });
        
        // Mount inside game container
        const gameContainer = document.getElementById('game-container') || document.body;
        gameContainer.appendChild(this.container);
    }
    
    // Set continuity value (0-100)
    setValue(value, tier = 'exploring') {
        const oldTarget = this.targetValue;
        this.targetValue = Math.max(0, Math.min(100, value));
        
        // Show label briefly when value increases
        if (this.targetValue > oldTarget + 0.5) {
            this.flashLabel();
        }
        
        // Update color based on tier
        this.currentColor = this.tierColors[tier] || this.tierColors.exploring;
        this.fillElement.style.background = this.currentColor;
        
        // Update label text
        this.labelElement.innerHTML = `<span style="color: ${this.currentColor}">${Math.floor(this.targetValue)}%</span> ${tier}`;
    }
    
    // Flash the label briefly
    flashLabel() {
        this.labelElement.style.opacity = '1';
        this.labelTimer = 2.0;
    }
    
    // Show the meter
    show() {
        this.visible = true;
        this.container.style.opacity = '1';
    }
    
    // Hide the meter
    hide() {
        this.visible = false;
        this.container.style.opacity = '0';
    }
    
    // Update animation
    update(deltaTime) {
        // Smooth value transition
        const diff = this.targetValue - this.displayValue;
        if (Math.abs(diff) > 0.1) {
            this.displayValue += diff * deltaTime * 3;
        } else {
            this.displayValue = this.targetValue;
        }
        
        // Update fill width
        this.fillElement.style.width = `${this.displayValue}%`;
        
        // Hide label after timer
        if (this.labelTimer > 0) {
            this.labelTimer -= deltaTime;
            if (this.labelTimer <= 0 && !this.showLabel) {
                this.labelElement.style.opacity = '0';
            }
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinuityMeter;
}
