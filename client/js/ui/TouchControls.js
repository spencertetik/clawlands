// Touch controls overlay for mobile — SNES controller layout
class TouchControls {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.activeDirections = new Set();
        this.enabled = false;
    }

    static isTouchDevice() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
    }

    init() {
        if (!TouchControls.isTouchDevice()) return;
        this.createControls();
        this.enabled = true;
    }

    show() { if (this.container) this.container.style.display = 'flex'; }
    hide() { if (this.container) this.container.style.display = 'none'; }
    hideDpad() { if (this.dpad) this.dpad.style.display = 'none'; }
    showDpad() { if (this.dpad) this.dpad.style.display = 'block'; }

    createControls() {
        // Full-width bar at the bottom — SNES controller layout
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
            align-items: center;
            padding: 10px 20px 20px;
            pointer-events: none;
            z-index: 1000;
            user-select: none;
            -webkit-user-select: none;
            background: linear-gradient(to bottom, rgba(13,8,6,0) 0%, rgba(13,8,6,0.6) 30%, rgba(13,8,6,0.85) 100%);
        `;

        // D-pad (left)
        this.dpad = this.createDpad();
        this.container.appendChild(this.dpad);

        // Center buttons (SELECT / START)
        const center = this.createCenterButtons();
        this.container.appendChild(center);

        // Action buttons — diamond (right)
        const actions = this.createActionDiamond();
        this.container.appendChild(actions);

        document.body.appendChild(this.container);
    }

    // ── D-PAD ──────────────────────────────────
    createDpad() {
        const dpad = document.createElement('div');
        dpad.style.cssText = `
            position: relative;
            width: 130px;
            height: 130px;
            pointer-events: auto;
        `;

        // Cross-shaped background
        const crossH = document.createElement('div');
        crossH.style.cssText = `
            position: absolute;
            top: 50%; left: 0;
            transform: translateY(-50%);
            width: 100%; height: 44px;
            background: rgba(40, 30, 25, 0.85);
            border-radius: 6px;
            border: 2px solid rgba(100, 80, 70, 0.5);
        `;
        dpad.appendChild(crossH);

        const crossV = document.createElement('div');
        crossV.style.cssText = `
            position: absolute;
            left: 50%; top: 0;
            transform: translateX(-50%);
            width: 44px; height: 100%;
            background: rgba(40, 30, 25, 0.85);
            border-radius: 6px;
            border: 2px solid rgba(100, 80, 70, 0.5);
        `;
        dpad.appendChild(crossV);

        // Center cap
        const cap = document.createElement('div');
        cap.style.cssText = `
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px;
            background: rgba(60, 45, 38, 0.9);
            border-radius: 50%;
            z-index: 2;
        `;
        dpad.appendChild(cap);

        // Invisible touch zones (larger than visual for easy tapping)
        const zones = [
            { dir: 'up',    css: 'top: 0; left: 50%; transform: translateX(-50%); width: 50px; height: 50px;' },
            { dir: 'down',  css: 'bottom: 0; left: 50%; transform: translateX(-50%); width: 50px; height: 50px;' },
            { dir: 'left',  css: 'left: 0; top: 50%; transform: translateY(-50%); width: 50px; height: 50px;' },
            { dir: 'right', css: 'right: 0; top: 50%; transform: translateY(-50%); width: 50px; height: 50px;' },
        ];

        const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };

        for (const z of zones) {
            const btn = document.createElement('div');
            btn.dataset.dir = z.dir;
            btn.style.cssText = `
                position: absolute; ${z.css}
                display: flex; align-items: center; justify-content: center;
                font-size: 14px; color: rgba(200, 180, 165, 0.6);
                z-index: 3;
                touch-action: none;
            `;
            btn.textContent = arrows[z.dir];

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.color = 'rgba(232, 213, 204, 0.95)';
                this.startDirection(z.dir);
            }, { passive: false });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                btn.style.color = 'rgba(200, 180, 165, 0.6)';
                this.stopDirection(z.dir);
            }, { passive: false });
            btn.addEventListener('touchcancel', () => {
                btn.style.color = 'rgba(200, 180, 165, 0.6)';
                this.stopDirection(z.dir);
            });

            dpad.appendChild(btn);
        }

        return dpad;
    }

    // ── CENTER (SELECT / START) ────────────────
    createCenterButtons() {
        const center = document.createElement('div');
        center.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            pointer-events: auto;
            margin-bottom: 10px;
        `;

        // MAP — toggle minimap expanded view
        const menu = this._makePillButton('MAP', () => {
            if (this.game && this.game.minimap) {
                // Show minimap on mobile and toggle expanded
                if (!this.game.minimap.visible) {
                    this.game.minimap.visible = true;
                    this.game.minimap.isShown = true;
                }
                this.game.minimap.toggleExpanded();
            }
        });
        center.appendChild(menu);

        return center;
    }

    _makePillButton(label, onTap) {
        const btn = document.createElement('div');
        btn.style.cssText = `
            width: 52px;
            height: 22px;
            background: rgba(60, 45, 38, 0.85);
            border: 1px solid rgba(100, 80, 70, 0.5);
            border-radius: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-family: monospace;
            font-weight: bold;
            letter-spacing: 1px;
            color: rgba(200, 180, 165, 0.7);
            touch-action: none;
            user-select: none;
        `;
        btn.textContent = label;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            btn.style.background = 'rgba(80, 60, 50, 0.95)';
            btn.style.color = 'rgba(232, 213, 204, 0.95)';
            onTap();
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.style.background = 'rgba(60, 45, 38, 0.85)';
            btn.style.color = 'rgba(200, 180, 165, 0.7)';
        }, { passive: false });

        return btn;
    }

    // ── ACTION DIAMOND (Y/B/X/A like SNES) ────
    createActionDiamond() {
        const diamond = document.createElement('div');
        diamond.style.cssText = `
            position: relative;
            width: 130px;
            height: 130px;
            pointer-events: auto;
        `;

        // Button configs: SNES diamond layout
        // X = top (Inventory), Y = left (Quest Log), B = bottom (Attack), A = right (Action/Interact)
        const buttons = [
            { label: 'X', pos: 'top: 0; left: 50%; transform: translateX(-50%);',    color: '#6b5b8a', action: 'inventory' },  // X (top) — purple
            { label: 'A', pos: 'right: 0; top: 50%; transform: translateY(-50%);',   color: '#8a3a3a', action: 'interact' },   // A (right) — red
            { label: 'B', pos: 'bottom: 0; left: 50%; transform: translateX(-50%);', color: '#3a6a3a', action: 'attack' },     // B (bottom) — green
            { label: 'Y', pos: 'left: 0; top: 50%; transform: translateY(-50%);',    color: '#3a5a8a', action: 'questlog' },   // Y (left) — blue
        ];

        for (const b of buttons) {
            const btn = document.createElement('div');
            btn.style.cssText = `
                position: absolute; ${b.pos}
                width: 46px;
                height: 46px;
                background: ${b.color}55;
                border: 2px solid ${b.color}99;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-family: monospace;
                font-weight: bold;
                color: rgba(232, 213, 204, 0.85);
                touch-action: none;
                user-select: none;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            `;
            btn.textContent = b.label;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.background = b.color + 'aa';
                btn.style.borderColor = b.color;
                this._handleAction(b.action, true);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                btn.style.background = b.color + '55';
                btn.style.borderColor = b.color + '99';
                this._handleAction(b.action, false);
            }, { passive: false });

            btn.addEventListener('touchcancel', () => {
                btn.style.background = b.color + '55';
                btn.style.borderColor = b.color + '99';
                this._handleAction(b.action, false);
            });

            diamond.appendChild(btn);
        }

        return diamond;
    }

    _handleAction(action, pressed) {
        switch (action) {
            case 'attack':
                if (pressed) this.pressAttack(); else this.releaseAttack();
                break;
            case 'interact':
                if (pressed) this.pressInteract(); else this.releaseInteract();
                break;
            case 'questlog':
                // Quest log (L key)
                if (pressed) {
                    this.pressKey('l');
                    setTimeout(() => this.releaseKey('l'), 100);
                }
                break;
            case 'inventory':
                // Inventory (I key)
                if (pressed) {
                    this.pressKey('i');
                    setTimeout(() => this.releaseKey('i'), 100);
                }
                break;
        }
    }

    // ── MOVEMENT ────────────────────────────────
    startDirection(dir) {
        this.activeDirections.add(dir);
        this.updateMovement();
    }

    stopDirection(dir) {
        this.activeDirections.delete(dir);
        this.updateMovement();
    }

    updateMovement() {
        if (!this.game || !this.game.inputManager) return;
        const input = this.game.inputManager;

        input.keys['w'] = false; input.keys['a'] = false;
        input.keys['s'] = false; input.keys['d'] = false;
        input.keys['ArrowUp'] = false; input.keys['ArrowDown'] = false;
        input.keys['ArrowLeft'] = false; input.keys['ArrowRight'] = false;

        if (this.activeDirections.has('up'))    { input.keys['w'] = true; input.keys['ArrowUp'] = true; }
        if (this.activeDirections.has('down'))  { input.keys['s'] = true; input.keys['ArrowDown'] = true; }
        if (this.activeDirections.has('left'))  { input.keys['a'] = true; input.keys['ArrowLeft'] = true; }
        if (this.activeDirections.has('right')) { input.keys['d'] = true; input.keys['ArrowRight'] = true; }
    }

    // ── INPUT HELPERS ───────────────────────────
    pressKey(key) {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys[key] = true;
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    releaseKey(key) {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys[key] = false;
        document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    }

    pressInteract() {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys[' '] = true;
        this.game.inputManager.justPressed[' '] = true;
    }

    releaseInteract() {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys[' '] = false;
    }

    pressAttack() {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys['x'] = true;
        this.game.inputManager.justPressed['x'] = true;
    }

    releaseAttack() {
        if (!this.game?.inputManager) return;
        this.game.inputManager.keys['x'] = false;
    }
}
