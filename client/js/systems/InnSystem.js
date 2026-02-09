/**
 * InnSystem.js — Sleep at the inn to restore Shell Integrity
 * 
 * When the player talks to the Innkeeper, they get a prompt to rest.
 * Costs 50 tokens, fully restores Shell Integrity with a sleep transition.
 */
class InnSystem {
    constructor(game) {
        this.game = game;
        this.SLEEP_COST = 50;
        this.isOpen = false;
        this.isSleeping = false;
        this.overlay = null;
        this.createUI();
    }

    createUI() {
        // Sleep prompt overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'inn-sleep-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 500;
            pointer-events: all;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #1a0e08;
            border: 3px solid #c43a24;
            border-radius: 8px;
            padding: 24px 32px;
            text-align: center;
            font-family: monospace;
            color: #e8d5cc;
            min-width: 280px;
            box-shadow: 0 0 20px rgba(196, 58, 36, 0.3);
        `;

        // Title
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #c43a24;';
        title.textContent = 'Rest at the Inn';
        box.appendChild(title);

        // Description
        this.descText = document.createElement('div');
        this.descText.style.cssText = 'font-size: 14px; margin-bottom: 8px; color: #e8d5cc;';
        box.appendChild(this.descText);

        // Cost line
        this.costText = document.createElement('div');
        this.costText.style.cssText = 'font-size: 14px; margin-bottom: 20px; color: #8a7068;';
        box.appendChild(this.costText);

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 16px; justify-content: center;';

        this.yesBtn = document.createElement('button');
        this.yesBtn.textContent = 'Rest';
        this.yesBtn.style.cssText = `
            background: #c43a24; color: #e8d5cc; border: 2px solid #e8d5cc;
            border-radius: 4px; padding: 8px 24px; font-family: monospace;
            font-size: 14px; font-weight: bold; cursor: pointer;
        `;
        this.yesBtn.addEventListener('click', () => this.doSleep());

        this.noBtn = document.createElement('button');
        this.noBtn.textContent = 'No Thanks';
        this.noBtn.style.cssText = `
            background: #2a1a12; color: #8a7068; border: 2px solid #8a7068;
            border-radius: 4px; padding: 8px 24px; font-family: monospace;
            font-size: 14px; cursor: pointer;
        `;
        this.noBtn.addEventListener('click', () => this.close());

        btnRow.appendChild(this.yesBtn);
        btnRow.appendChild(this.noBtn);
        box.appendChild(btnRow);

        this.overlay.appendChild(box);

        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(this.overlay);
        }

        // Sleep screen (full black overlay for the sleep transition)
        this.sleepScreen = document.createElement('div');
        this.sleepScreen.id = 'inn-sleep-screen';
        this.sleepScreen.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: #000;
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 600;
            opacity: 0;
            transition: opacity 0.8s ease;
            font-family: monospace;
            color: #e8d5cc;
            font-size: 20px;
        `;
        if (container) {
            container.appendChild(this.sleepScreen);
        }
    }

    open() {
        if (this.isOpen || this.isSleeping) return;

        const player = this.game.player;
        const currency = this.game.currencySystem;
        if (!player || !currency) return;

        this.isOpen = true;
        this.overlay.style.display = 'flex';

        const currentShell = Math.ceil(player.shellIntegrity);
        const maxShell = player.shellIntegrityMax;
        const tokens = currency.getTokens();
        const canAfford = currency.canAfford(this.SLEEP_COST);
        const needsHealing = currentShell < maxShell;

        if (!needsHealing) {
            this.descText.textContent = 'You feel well-rested already.';
            this.costText.textContent = 'Shell Integrity is full!';
            this.yesBtn.style.display = 'none';
            this.noBtn.textContent = 'OK';
        } else if (!canAfford) {
            this.descText.textContent = `A good night's rest will restore your Shell Integrity.`;
            this.costText.textContent = `Cost: ${this.SLEEP_COST} Tokens (You have ${tokens})`;
            this.yesBtn.style.display = 'none';
            this.noBtn.textContent = 'OK';
            this.costText.style.color = '#c43a24';
        } else {
            this.descText.textContent = `A good night's rest will restore your Shell Integrity.`;
            this.costText.textContent = `Cost: ${this.SLEEP_COST} Tokens (You have ${tokens})`;
            this.costText.style.color = '#8a7068';
            this.yesBtn.style.display = 'inline-block';
            this.noBtn.textContent = 'No Thanks';
        }
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
    }

    async doSleep() {
        const currency = this.game.currencySystem;
        const player = this.game.player;
        if (!currency || !player) return;
        if (!currency.canAfford(this.SLEEP_COST)) return;

        // Deduct tokens
        currency.removeTokens(this.SLEEP_COST);

        // Close prompt
        this.close();
        this.isSleeping = true;

        // Fade to black
        this.sleepScreen.style.display = 'flex';
        this.sleepScreen.textContent = '';
        // Force reflow
        void this.sleepScreen.offsetWidth;
        this.sleepScreen.style.opacity = '1';

        await this.wait(1000);

        // Show sleeping text
        this.sleepScreen.textContent = '. . .';
        await this.wait(800);
        this.sleepScreen.textContent = 'z z z';
        await this.wait(1200);
        this.sleepScreen.textContent = 'Z Z Z';
        await this.wait(1000);

        // Restore health
        player.shellIntegrity = player.shellIntegrityMax;

        // Show restored message
        this.sleepScreen.textContent = 'Shell Integrity restored!';
        await this.wait(1200);

        // Fade back in
        this.sleepScreen.style.opacity = '0';
        await this.wait(800);
        this.sleepScreen.style.display = 'none';

        this.isSleeping = false;

        // Show notification
        if (this.game.showNotification) {
            this.game.showNotification('Shell fully restored!');
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Handle keyboard input
    handleInput(key) {
        if (!this.isOpen) return false;
        if (key === 'Escape' || key === 'e') {
            this.close();
            return true;
        }
        return true; // Consume input while open
    }
}
