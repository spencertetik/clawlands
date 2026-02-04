// Transition overlay for building entry/exit
// Simple fade within the game canvas

class TransitionOverlay {
    constructor() {
        this.container = null;
        this.isAnimating = false;
    }

    /**
     * Add transition CSS if not present
     */
    addStyles() {
        if (document.getElementById('transition-overlay-styles')) return;

        const style = document.createElement('style');
        style.id = 'transition-overlay-styles';
        style.textContent = `
            @keyframes transition-fade-in-out {
                0% { opacity: 0; }
                40% { opacity: 1; }
                60% { opacity: 1; }
                100% { opacity: 0; }
            }

            @keyframes text-fade-in {
                0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                40% { opacity: 1; transform: translateX(-50%) translateY(0); }
                70% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get the game container bounds
     */
    getGameBounds() {
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            return {
                top: rect.top + 'px',
                left: rect.left + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px'
            };
        }
        // Fallback to game-container
        const container = document.getElementById('game-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            return {
                top: rect.top + 'px',
                left: rect.left + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px'
            };
        }
        // Last fallback
        return { top: '0', left: '0', width: '100%', height: '100%' };
    }

    /**
     * Show entering building transition
     */
    async enterBuilding(buildingName, buildingType) {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.addStyles();

        const bounds = this.getGameBounds();

        return new Promise((resolve) => {
            this.container = document.createElement('div');
            this.container.style.cssText = `
                position: fixed;
                top: ${bounds.top};
                left: ${bounds.left};
                width: ${bounds.width};
                height: ${bounds.height};
                background: #000;
                z-index: 3000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                animation: transition-fade-in-out 0.8s ease-in-out forwards;
                pointer-events: none;
            `;

            // Add building name
            const nameEl = document.createElement('div');
            nameEl.textContent = buildingName;
            nameEl.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                font-size: 24px;
                font-family: monospace;
                font-weight: bold;
                color: #fff;
                text-shadow: 2px 2px 0 #333;
                animation: text-fade-in 0.8s ease-out forwards;
                white-space: nowrap;
            `;
            this.container.appendChild(nameEl);

            document.body.appendChild(this.container);

            // Resolve halfway through for the actual transition
            setTimeout(() => {
                resolve();
            }, 350);

            // Clean up after animation
            setTimeout(() => {
                this.cleanup();
            }, 800);
        });
    }

    /**
     * Show exiting building transition
     */
    async exitBuilding() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.addStyles();

        const bounds = this.getGameBounds();

        return new Promise((resolve) => {
            this.container = document.createElement('div');
            this.container.style.cssText = `
                position: fixed;
                top: ${bounds.top};
                left: ${bounds.left};
                width: ${bounds.width};
                height: ${bounds.height};
                background: #000;
                z-index: 3000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                animation: transition-fade-in-out 0.6s ease-in-out forwards;
                pointer-events: none;
            `;

            document.body.appendChild(this.container);

            // Resolve halfway through
            setTimeout(() => {
                resolve();
            }, 250);

            // Clean up after animation
            setTimeout(() => {
                this.cleanup();
            }, 600);
        });
    }

    /**
     * Clean up the overlay
     */
    cleanup() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.isAnimating = false;
    }
}

// Global instance
const transitionOverlay = new TransitionOverlay();
