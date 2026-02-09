// Handles keyboard input for WASD + Space (OpenClaw compatible)
class InputManager {
    constructor() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ' ': false, // space (interact)
            x: false,   // attack
            j: false,   // attack (IJKL layout)
            k: false,   // interact (IJKL layout)
            l: false,   // quest log (IJKL layout)
            ArrowUp: false,
            ArrowLeft: false,
            ArrowDown: false,
            ArrowRight: false
        };

        this.justPressed = {
            ' ': false,
            x: false,
            j: false,
            k: false,
            l: false
        };

        this.prevKeys = { ...this.keys };
        
        // When disabled, keyboard input is ignored (but direct key manipulation still works for bots)
        this.disabled = false;

        this.setupEventListeners();
    }
    
    // Enable/disable keyboard input (bots can still control via direct key manipulation)
    setDisabled(disabled) {
        this.disabled = disabled;
        if (disabled) {
            // Clear all keys when disabling
            Object.keys(this.keys).forEach(k => this.keys[k] = false);
        }
        console.log(`🎮 Player controls ${disabled ? 'disabled' : 'enabled'}`);
    }

    setupEventListeners() {
        // Keydown event
        window.addEventListener('keydown', (e) => {
            if (this.disabled) return; // Ignore keyboard when disabled
            
            const key = e.key.toLowerCase();

            if (key in this.keys) {
                // Prevent default browser behavior for game keys
                e.preventDefault();
                this.keys[key] = true;
            } else if (e.key in this.keys) {
                e.preventDefault();
                this.keys[e.key] = true;
            }
        });

        // Keyup event
        window.addEventListener('keyup', (e) => {
            if (this.disabled) return; // Ignore keyboard when disabled
            
            const key = e.key.toLowerCase();

            if (key in this.keys) {
                e.preventDefault();
                this.keys[key] = false;
            } else if (e.key in this.keys) {
                e.preventDefault();
                this.keys[e.key] = false;
            }
        });

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Update just pressed states
    update() {
        // Check for space bar "just pressed" (for interactions)
        this.justPressed[' '] = this.keys[' '] && !this.prevKeys[' '];
        // Check for X key "just pressed" (for attacks)
        this.justPressed['x'] = this.keys['x'] && !this.prevKeys['x'];
        // IJKL layout: J = attack, K = interact, L = quest log
        this.justPressed['j'] = this.keys['j'] && !this.prevKeys['j'];
        this.justPressed['k'] = this.keys['k'] && !this.prevKeys['k'];
        this.justPressed['l'] = this.keys['l'] && !this.prevKeys['l'];

        // Copy current state to previous
        this.prevKeys = { ...this.keys };
    }

    // Get movement direction as normalized vector
    getMovementVector() {
        const movement = new Vector2(0, 0);

        // WASD movement
        if (this.keys.w || this.keys.ArrowUp) movement.y -= 1;
        if (this.keys.s || this.keys.ArrowDown) movement.y += 1;
        if (this.keys.a || this.keys.ArrowLeft) movement.x -= 1;
        if (this.keys.d || this.keys.ArrowRight) movement.x += 1;

        // Normalize to prevent faster diagonal movement
        if (movement.length() > 0) {
            movement.normalize();
        }

        return movement;
    }

    // Check if moving
    isMoving() {
        return this.keys.w || this.keys.s || this.keys.a || this.keys.d ||
               this.keys.ArrowUp || this.keys.ArrowDown ||
               this.keys.ArrowLeft || this.keys.ArrowRight;
    }

    // Check if space or K was just pressed (interact)
    isInteractPressed() {
        return this.justPressed[' '] || this.justPressed['k'];
    }

    // Check if X or J was just pressed (attack)
    isAttackPressed() {
        return this.justPressed['x'] || this.justPressed['j'];
    }

    // Get movement direction name for animations
    getDirection() {
        if (this.keys.w || this.keys.ArrowUp) return CONSTANTS.DIRECTION.UP;
        if (this.keys.s || this.keys.ArrowDown) return CONSTANTS.DIRECTION.DOWN;
        if (this.keys.a || this.keys.ArrowLeft) return CONSTANTS.DIRECTION.LEFT;
        if (this.keys.d || this.keys.ArrowRight) return CONSTANTS.DIRECTION.RIGHT;
        return null;
    }
}
