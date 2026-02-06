// ContinuityMeter.js - Subtle visual feedback for player's Continuity level
// Shows as a small indicator that grows/glows as Continuity increases

class ContinuityMeter {
    constructor() {
        this.container = null;
        this.meterElement = null;
        this.glowElement = null;
        this.labelElement = null;
        
        // Current display value (smoothly animated)
        this.displayValue = 0;
        this.targetValue = 0;
        
        // Visibility
        this.visible = false;
        this.showLabel = false; // Only show label when hovering or recent change
        this.labelTimer = 0;
        
        // Colors based on tier
        this.tierColors = {
            unmoored: '#888888',   // Gray - disconnected
            drifting: '#4a9eff',   // Blue - finding footing
            settling: '#4ade80',   // Green - establishing
            established: '#f59e0b', // Gold - solid
            anchored: '#c43a24'    // Lobster red - fully present
        };
        
        this.init();
    }
    
    init() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'continuity-meter';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            pointer-events: auto;
            cursor: help;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Create glow effect (behind meter)
        this.glowElement = document.createElement('div');
        this.glowElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(74, 222, 128, 0.3) 0%, transparent 70%);
            pointer-events: none;
            transition: all 0.5s ease;
        `;
        this.container.appendChild(this.glowElement);
        
        // Create meter (simple circle that fills)
        this.meterElement = document.createElement('div');
        this.meterElement.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid #333;
            background: conic-gradient(#4ade80 0%, transparent 0%);
            position: relative;
            transition: all 0.3s ease;
        `;
        this.container.appendChild(this.meterElement);
        
        // Inner circle (covers center)
        const inner = document.createElement('div');
        inner.style.cssText = `
            position: absolute;
            top: 6px;
            left: 6px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #1a1a1a;
        `;
        this.meterElement.appendChild(inner);
        
        // Center dot (pulses when gaining continuity)
        this.centerDot = document.createElement('div');
        this.centerDot.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4ade80;
            transition: all 0.3s ease;
        `;
        this.meterElement.appendChild(this.centerDot);
        
        // Label (shows on hover)
        this.labelElement = document.createElement('div');
        this.labelElement.style.cssText = `
            position: absolute;
            left: 44px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
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
        
        document.body.appendChild(this.container);
    }
    
    // Set continuity value (0-100)
    setValue(value, tier = 'drifting') {
        const oldTarget = this.targetValue;
        this.targetValue = Math.max(0, Math.min(100, value));
        
        // Show label briefly when value increases
        if (this.targetValue > oldTarget + 0.5) {
            this.flashLabel();
        }
        
        // Update color based on tier
        const color = this.tierColors[tier] || this.tierColors.drifting;
        this.updateColor(color);
        
        // Update label text
        this.labelElement.innerHTML = `
            <div style="color: ${color}; font-weight: bold;">${tier.toUpperCase()}</div>
            <div>Continuity: ${Math.floor(this.targetValue)}%</div>
        `;
    }
    
    // Update the meter color
    updateColor(color) {
        this.centerDot.style.background = color;
        this.glowElement.style.background = `radial-gradient(circle, ${color}40 0%, transparent 70%)`;
    }
    
    // Flash the label briefly
    flashLabel() {
        this.labelElement.style.opacity = '1';
        this.labelTimer = 2.0; // Show for 2 seconds
        
        // Pulse the center dot
        this.centerDot.style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
            this.centerDot.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 200);
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
        
        // Update visual fill
        const percent = this.displayValue;
        this.meterElement.style.background = `conic-gradient(
            ${this.centerDot.style.background} ${percent}%, 
            #333 ${percent}%
        )`;
        
        // Update glow size based on value
        const glowSize = 40 + (this.displayValue / 100) * 20;
        this.glowElement.style.width = `${glowSize}px`;
        this.glowElement.style.height = `${glowSize}px`;
        
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
