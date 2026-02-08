// Touch controls overlay for mobile devices
class TouchControls {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.activeDirections = new Set();
        this.enabled = false;
    }

    /**
     * Check if device supports touch
     */
    static isTouchDevice() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
    }

    /**
     * Initialize touch controls if on touch device
     */
    init() {
        if (!TouchControls.isTouchDevice()) {
            return;
        }
        
        this.createControls();
        this.enabled = true;
    }

    /**
     * Show the controls
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    /**
     * Hide the controls
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Hide just the d-pad (keep ACT button for dialog)
     */
    hideDpad() {
        if (this.dpad) {
            this.dpad.style.display = 'none';
        }
    }

    /**
     * Show the d-pad again
     */
    showDpad() {
        if (this.dpad) {
            this.dpad.style.display = 'block';
        }
    }

    /**
     * Create the control overlay
     */
    createControls() {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'touch-controls';
        this.container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 180px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding: 20px;
            pointer-events: none;
            z-index: 1000;
            user-select: none;
            -webkit-user-select: none;
        `;

        // D-pad container (left side)
        this.dpad = this.createDpad();
        this.container.appendChild(this.dpad);

        // Action buttons (right side)
        const actions = this.createActionButtons();
        this.container.appendChild(actions);

        document.body.appendChild(this.container);
    }

    /**
     * Create the D-pad
     */
    createDpad() {
        const dpad = document.createElement('div');
        dpad.style.cssText = `
            position: relative;
            width: 140px;
            height: 140px;
            pointer-events: auto;
        `;

        const buttonStyle = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.25);
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: rgba(255, 255, 255, 0.8);
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        `;

        const activeStyle = `
            background: rgba(255, 255, 255, 0.5);
            border-color: rgba(255, 255, 255, 0.8);
        `;

        // Up button
        const up = document.createElement('div');
        up.style.cssText = buttonStyle + 'top: 0; left: 50%; transform: translateX(-50%);';
        up.innerHTML = '▲';
        up.dataset.dir = 'up';
        dpad.appendChild(up);

        // Down button
        const down = document.createElement('div');
        down.style.cssText = buttonStyle + 'bottom: 0; left: 50%; transform: translateX(-50%);';
        down.innerHTML = '▼';
        down.dataset.dir = 'down';
        dpad.appendChild(down);

        // Left button
        const left = document.createElement('div');
        left.style.cssText = buttonStyle + 'left: 0; top: 50%; transform: translateY(-50%);';
        left.innerHTML = '◀';
        left.dataset.dir = 'left';
        dpad.appendChild(left);

        // Right button
        const right = document.createElement('div');
        right.style.cssText = buttonStyle + 'right: 0; top: 50%; transform: translateY(-50%);';
        right.innerHTML = '▶';
        right.dataset.dir = 'right';
        dpad.appendChild(right);

        // Add touch handlers to all d-pad buttons
        [up, down, left, right].forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.background = 'rgba(255, 255, 255, 0.5)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.8)';
                this.startDirection(btn.dataset.dir);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                btn.style.background = 'rgba(255, 255, 255, 0.25)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                this.stopDirection(btn.dataset.dir);
            }, { passive: false });

            btn.addEventListener('touchcancel', (e) => {
                btn.style.background = 'rgba(255, 255, 255, 0.25)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                this.stopDirection(btn.dataset.dir);
            }, { passive: false });
        });

        return dpad;
    }

    /**
     * Create action buttons
     */
    createActionButtons() {
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
            pointer-events: auto;
        `;

        // Inventory button (I key equivalent)
        const inventory = document.createElement('div');
        inventory.style.cssText = `
            width: 44px;
            height: 44px;
            background: rgba(196, 58, 36, 0.3);
            border: 2px solid rgba(196, 58, 36, 0.7);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        `;
        inventory.innerHTML = '🎒';

        inventory.addEventListener('touchstart', (e) => {
            e.preventDefault();
            inventory.style.background = 'rgba(196, 58, 36, 0.6)';
            // Simulate pressing I key
            this.pressKey('i');
            setTimeout(() => this.releaseKey('i'), 100);
        }, { passive: false });

        inventory.addEventListener('touchend', (e) => {
            e.preventDefault();
            inventory.style.background = 'rgba(196, 58, 36, 0.3)';
        }, { passive: false });

        actions.appendChild(inventory);

        // Interact button (Space key equivalent)
        const interact = document.createElement('div');
        interact.style.cssText = `
            width: 70px;
            height: 70px;
            background: rgba(94, 234, 212, 0.3);
            border: 3px solid rgba(94, 234, 212, 0.7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-family: monospace;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.9);
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        `;
        interact.innerHTML = 'ACT';

        interact.addEventListener('touchstart', (e) => {
            e.preventDefault();
            interact.style.background = 'rgba(94, 234, 212, 0.6)';
            this.pressInteract();
        }, { passive: false });

        interact.addEventListener('touchend', (e) => {
            e.preventDefault();
            interact.style.background = 'rgba(94, 234, 212, 0.3)';
            this.releaseInteract();
        }, { passive: false });

        actions.appendChild(interact);

        // Attack button (X key equivalent) — red, below interact
        const attack = document.createElement('div');
        attack.style.cssText = `
            width: 56px;
            height: 56px;
            background: rgba(196, 58, 36, 0.3);
            border: 3px solid rgba(196, 58, 36, 0.7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-family: monospace;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.9);
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        `;
        attack.innerHTML = '⚔';

        attack.addEventListener('touchstart', (e) => {
            e.preventDefault();
            attack.style.background = 'rgba(196, 58, 36, 0.6)';
            this.pressAttack();
        }, { passive: false });

        attack.addEventListener('touchend', (e) => {
            e.preventDefault();
            attack.style.background = 'rgba(196, 58, 36, 0.3)';
            this.releaseAttack();
        }, { passive: false });

        actions.appendChild(attack);

        return actions;
    }

    /**
     * Start moving in a direction
     */
    startDirection(dir) {
        this.activeDirections.add(dir);
        this.updateMovement();
    }

    /**
     * Stop moving in a direction
     */
    stopDirection(dir) {
        this.activeDirections.delete(dir);
        this.updateMovement();
    }

    /**
     * Update player movement based on active directions
     */
    updateMovement() {
        if (!this.game || !this.game.inputManager) return;

        const input = this.game.inputManager;
        
        // Clear all directions first
        input.keys['w'] = false;
        input.keys['a'] = false;
        input.keys['s'] = false;
        input.keys['d'] = false;
        input.keys['ArrowUp'] = false;
        input.keys['ArrowDown'] = false;
        input.keys['ArrowLeft'] = false;
        input.keys['ArrowRight'] = false;

        // Set active directions
        if (this.activeDirections.has('up')) {
            input.keys['w'] = true;
            input.keys['ArrowUp'] = true;
        }
        if (this.activeDirections.has('down')) {
            input.keys['s'] = true;
            input.keys['ArrowDown'] = true;
        }
        if (this.activeDirections.has('left')) {
            input.keys['a'] = true;
            input.keys['ArrowLeft'] = true;
        }
        if (this.activeDirections.has('right')) {
            input.keys['d'] = true;
            input.keys['ArrowRight'] = true;
        }
    }

    /**
     * Simulate key press
     */
    pressKey(key) {
        if (!this.game || !this.game.inputManager) return;
        this.game.inputManager.keys[key] = true;
        
        // Also dispatch a keydown event for systems that listen to events
        const event = new KeyboardEvent('keydown', { key: key, bubbles: true });
        document.dispatchEvent(event);
    }

    /**
     * Simulate key release
     */
    releaseKey(key) {
        if (!this.game || !this.game.inputManager) return;
        this.game.inputManager.keys[key] = false;
        
        // Also dispatch a keyup event
        const event = new KeyboardEvent('keyup', { key: key, bubbles: true });
        document.dispatchEvent(event);
    }

    /**
     * Press interact (space bar) - needs special handling for "just pressed" detection
     */
    pressInteract() {
        if (!this.game || !this.game.inputManager) return;
        const input = this.game.inputManager;
        
        // Set the key state
        input.keys[' '] = true;
        
        // Directly set justPressed since we're between frames
        input.justPressed[' '] = true;
    }

    /**
     * Release interact (space bar)
     */
    releaseInteract() {
        if (!this.game || !this.game.inputManager) return;
        const input = this.game.inputManager;
        
        // Clear the key state
        input.keys[' '] = false;
    }

    /**
     * Press attack (X key) - same justPressed pattern as interact
     */
    pressAttack() {
        if (!this.game || !this.game.inputManager) return;
        const input = this.game.inputManager;
        input.keys['x'] = true;
        input.justPressed['x'] = true;
    }

    /**
     * Release attack (X key)
     */
    releaseAttack() {
        if (!this.game || !this.game.inputManager) return;
        const input = this.game.inputManager;
        input.keys['x'] = false;
    }
}
