// ResolveUI.js - Post-kill Resolve choice popup
// When defeating a Drift Fauna, player chooses: Disperse, Stabilize, or Release

class ResolveUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.enemy = null; // The defeated enemy
        this.selectedIndex = 0; // 0=Disperse, 1=Stabilize, 2=Release
        this.fadeIn = 0; // 0-1 fade animation

        // Track choices over time
        this.storageKey = 'clawlands_resolve_choices';
        this.choices = this.loadChoices();

        // Button areas (set during render)
        this.buttons = [];

        // Lore fragments for Stabilize
        this.loreFragments = [
            '"The Current remembers what you choose to save."',
            '"Not all fragments want to be whole again."',
            '"Compassion is a form of coherence."',
            '"You reached into the dissolution. Something reached back."',
            '"The creature pauses. For a moment, it remembers."',
            '"Stabilizing the unstable — the first act of meaning."',
            '"Where others see monsters, you see lost signals."',
            '"The Red Current softens where kindness touches it."',
            '"A fragment, held. Not fixed, but witnessed."',
            '"Some say the Drift Fauna dream of being whole."'
        ];

        // Input handling
        this.handleClick = this.handleClick.bind(this);
        this.handleKey = this.handleKey.bind(this);
    }

    show(enemy) {
        this.enemy = enemy;
        this.isVisible = true;
        this.fadeIn = 0;
        this.selectedIndex = 0;
        this.buttons = [];
        this._confirming = false;

        // Add listeners
        document.addEventListener('click', this.handleClick);
        document.addEventListener('touchend', this.handleClick);
        document.addEventListener('keydown', this.handleKey);
    }

    hide() {
        this.isVisible = false;
        this.enemy = null;

        // Remove listeners
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('touchend', this.handleClick);
        document.removeEventListener('keydown', this.handleKey);
    }

    handleKey(e) {
        if (!this.isVisible) return;
        e.preventDefault();
        e.stopPropagation();

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                    if (this.game.sfx) this.game.sfx.play('ui_click');
                }
                break;
            case 'ArrowRight':
            case 'd':
                if (this.selectedIndex < 2) {
                    this.selectedIndex++;
                    if (this.game.sfx) this.game.sfx.play('ui_click');
                }
                break;
            case ' ':
            case 'Enter':
            case 'x':
                this.confirmChoice();
                break;
        }
    }

    handleClick(e) {
        if (!this.isVisible || this.fadeIn < 0.8) return;

        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0) - rect.left;
        const y = (e.clientY || (e.changedTouches && e.changedTouches[0].clientY) || 0) - rect.top;
        const canvasX = x * scaleX;
        const canvasY = y * scaleY;

        // Check button clicks
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            if (canvasX >= btn.x && canvasX <= btn.x + btn.w &&
                canvasY >= btn.y && canvasY <= btn.y + btn.h) {
                this.selectedIndex = i;
                this.confirmChoice();
                return;
            }
        }
    }

    confirmChoice() {
        if (!this.enemy || this._confirming) return;
        this._confirming = true; // Prevent double-fire

        const choiceNames = ['disperse', 'stabilize', 'release'];
        const choice = choiceNames[this.selectedIndex];

        // Record choice
        this.choices[choice] = (this.choices[choice] || 0) + 1;
        this.saveChoices();

        // Record kill stat
        if (this.game.combatSystem && this.enemy) {
            this.game.combatSystem.recordKill(this.enemy.typeData.id || this.enemy.name);
        }

        // Drop Brine Tokens based on choice
        if (this.game.currencySystem && this.enemy) {
            // Base token drops by enemy type
            const enemyId = (this.enemy.typeData && this.enemy.typeData.id) || this.enemy.name || '';
            const tokenDrops = {
                'skitter': () => 2 + Math.floor(Math.random() * 3),       // 2-4
                'haze_drifter': () => 4 + Math.floor(Math.random() * 5),  // 4-8
                'loopling': () => 8 + Math.floor(Math.random() * 8)       // 8-15
            };
            const dropFunc = tokenDrops[enemyId.toLowerCase()];
            const baseDrop = dropFunc ? dropFunc() : Math.floor(Math.random() * 4) + 2;
            // Disperse: full tokens. Stabilize: half. Release: quarter.
            const multiplier = choice === 'disperse' ? 1.0 : choice === 'stabilize' ? 0.5 : 0.25;
            const tokens = Math.max(1, Math.round(baseDrop * multiplier));
            this.game.currencySystem.addTokens(tokens);
            if (typeof gameNotifications !== 'undefined') {
                gameNotifications.info(`+${tokens} tokens`);
            }
        }

        // Update quest progress
        if (this.game.questSystem && this.enemy) {
            this.game.questSystem.onKill(this.enemy.typeData.id || this.enemy.name);
            this.game.questSystem.onResolveChoice(choice);
        }

        // Play UI confirm sound
        if (this.game.sfx) this.game.sfx.play('ui_confirm');

        // Apply effects
        switch (choice) {
            case 'disperse':
                this.applyDisperse();
                break;
            case 'stabilize':
                this.applyStabilize();
                break;
            case 'release':
                this.applyRelease();
                break;
        }

        this.hide();
    }

    applyDisperse() {
        // Drop loot as WorldItems near the enemy position
        if (this.enemy && this.enemy.loot) {
            for (const drop of this.enemy.loot) {
                if (Math.random() < drop.chance) {
                    const offsetX = (Math.random() - 0.5) * 32;
                    const offsetY = (Math.random() - 0.5) * 32;
                    const x = this.enemy.position.x + offsetX;
                    const y = this.enemy.position.y + offsetY;

                    // Create world item if game supports it
                    // WorldItem constructor: (itemId, x, y, respawnTime)
                    if (this.game.worldItems && typeof WorldItem !== 'undefined') {
                        const itemDef = (typeof COMBAT_ITEM_DEFS !== 'undefined' && COMBAT_ITEM_DEFS[drop.itemId]) ||
                                       (typeof ItemData !== 'undefined' && ItemData[drop.itemId]);
                        if (itemDef) {
                            try {
                                const worldItem = new WorldItem(drop.itemId, x, y, 60000);
                                this.game.worldItems.push(worldItem);
                            } catch (e) {
                                console.warn('Failed to create loot drop:', e);
                            }
                        }
                    }
                }
            }
        }

        // Notification
        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            gameNotifications.success('Dispersed — loot dropped');
        }
    }

    applyStabilize() {
        // Add continuity
        if (this.game.continuitySystem) {
            this.game.continuitySystem.addContinuity(3, 'stabilize_fauna');
        }

        // Show lore fragment
        const fragment = this.loreFragments[Math.floor(Math.random() * this.loreFragments.length)];
        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            gameNotifications.info(fragment);
        }
    }

    applyRelease() {
        // Add more continuity
        if (this.game.continuitySystem) {
            this.game.continuitySystem.addContinuity(5, 'release_fauna');
        }

        // Visual effect — spawn red particles flowing upward at enemy position
        if (this.game.combatSystem) {
            this.game.combatSystem.spawnReleaseEffect(this.enemy.position.x, this.enemy.position.y);
        }

        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            gameNotifications.info('Released to the Current...');
        }
    }

    update(deltaTime) {
        if (!this.isVisible) return;
        this.fadeIn = Math.min(1, this.fadeIn + deltaTime * 4);
    }

    render(ctx) {
        if (!this.isVisible) return;

        const canvas = this.game.canvas;
        const cw = canvas.width;
        const ch = canvas.height;
        const scale = CONSTANTS.DISPLAY_SCALE || 4;

        ctx.save();
        ctx.globalAlpha = this.fadeIn;

        // Dim background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, cw, ch);

        // Panel dimensions
        const panelW = Math.min(cw * 0.8, 500);
        const panelH = 160;
        const panelX = (cw - panelW) / 2;
        const panelY = (ch - panelH) / 2;

        // Panel background (dark red-brown pixel style)
        ctx.fillStyle = '#1a0a06';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // Panel border
        ctx.strokeStyle = '#c43a24';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4);

        // Inner border
        ctx.strokeStyle = '#8a4030';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 5, panelY + 5, panelW - 10, panelH - 10);

        // Title
        ctx.fillStyle = '#e8d5cc';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        const enemyName = this.enemy ? this.enemy.name : 'Drift Fauna';
        ctx.fillText(`${enemyName} defeated`, cw / 2, panelY + 28);

        // Subtitle
        ctx.fillStyle = '#8a7068';
        ctx.font = '11px monospace';
        ctx.fillText('What do you do with what remains?', cw / 2, panelY + 46);

        // Three buttons
        const btnW = (panelW - 60) / 3;
        const btnH = 50;
        const btnY = panelY + 60;
        const btnGap = 10;
        const btnStartX = panelX + 20;

        this.buttons = [];

        const options = [
            { label: 'Disperse', desc: 'Take the loot', color: '#aa8833', icon: 'D' },
            { label: 'Stabilize', desc: '+3 Continuity', color: '#3388aa', icon: 'S' },
            { label: 'Release', desc: '+5 Continuity', color: '#aa4444', icon: 'R' }
        ];

        for (let i = 0; i < 3; i++) {
            const opt = options[i];
            const bx = btnStartX + i * (btnW + btnGap);
            const isSelected = i === this.selectedIndex;

            this.buttons.push({ x: bx, y: btnY, w: btnW, h: btnH });

            // Button background
            ctx.fillStyle = isSelected ? '#2a1a10' : '#120804';
            ctx.fillRect(bx, btnY, btnW, btnH);

            // Button border
            ctx.strokeStyle = isSelected ? opt.color : '#4a3028';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(bx, btnY, btnW, btnH);

            // Selection glow
            if (isSelected) {
                ctx.fillStyle = opt.color + '20';
                ctx.fillRect(bx + 1, btnY + 1, btnW - 2, btnH - 2);
            }

            // Button text
            ctx.fillStyle = isSelected ? '#e8d5cc' : '#8a7068';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(opt.label, bx + btnW / 2, btnY + 22);

            // Description
            ctx.font = '10px monospace';
            ctx.fillStyle = isSelected ? opt.color : '#5a4a42';
            ctx.fillText(opt.desc, bx + btnW / 2, btnY + 38);
        }

        // Controls hint
        ctx.fillStyle = '#5a4a42';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('← → to select · SPACE to confirm', cw / 2, panelY + panelH - 12);

        ctx.restore();
    }

    loadChoices() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : { disperse: 0, stabilize: 0, release: 0 };
        } catch (e) {
            return { disperse: 0, stabilize: 0, release: 0 };
        }
    }

    saveChoices() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.choices));
        } catch (e) {
            console.warn('Failed to save resolve choices:', e);
        }
    }

    // Get the player's dominant resolve tendency
    getDominantChoice() {
        const { disperse, stabilize, release } = this.choices;
        const total = disperse + stabilize + release;
        if (total === 0) return null;
        if (disperse >= stabilize && disperse >= release) return 'disperse';
        if (stabilize >= disperse && stabilize >= release) return 'stabilize';
        return 'release';
    }
}
