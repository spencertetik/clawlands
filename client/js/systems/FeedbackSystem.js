/**
 * FeedbackSystem.js — In-game feedback for beta testers
 * 
 * Press F to open feedback form. Captures game state automatically.
 * Sends to server where Frank can check and act on it.
 */
class FeedbackSystem {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.overlay = null;
        this.serverUrl = window.CONFIG?.SERVER_URL?.replace('ws', 'http')?.replace('/game', '')
            || window.location.hostname.includes('netlify.app')
                ? 'https://claw-world-production.up.railway.app'
                : 'http://localhost:3000';
        this.createUI();
    }

    createUI() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'feedback-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 550;
            background: rgba(0, 0, 0, 0.5);
            pointer-events: all;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: #1a0e08;
            border: 3px solid #c43a24;
            border-radius: 8px;
            padding: 20px 24px;
            font-family: monospace;
            color: #e8d5cc;
            width: 340px;
            max-width: 90%;
            box-shadow: 0 0 30px rgba(196, 58, 36, 0.4);
        `;

        // Title
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #c43a24; text-align: center;';
        title.textContent = 'Send Feedback';
        box.appendChild(title);

        // Subtitle
        const sub = document.createElement('div');
        sub.style.cssText = 'font-size: 11px; color: #8a7068; margin-bottom: 14px; text-align: center;';
        sub.textContent = 'Bug reports, suggestions, or anything on your mind.';
        box.appendChild(sub);

        // Category selector
        const catRow = document.createElement('div');
        catRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; justify-content: center;';
        
        this.categories = ['bug', 'suggestion', 'visual', 'gameplay', 'other'];
        this.selectedCategory = 'bug';
        this.catButtons = [];

        for (const cat of this.categories) {
            const btn = document.createElement('button');
            btn.textContent = cat;
            btn.dataset.cat = cat;
            btn.style.cssText = `
                background: ${cat === this.selectedCategory ? '#c43a24' : '#2a1a12'};
                color: ${cat === this.selectedCategory ? '#e8d5cc' : '#8a7068'};
                border: 1px solid ${cat === this.selectedCategory ? '#e8d5cc' : '#8a7068'};
                border-radius: 3px;
                padding: 4px 10px;
                font-family: monospace;
                font-size: 11px;
                cursor: pointer;
                text-transform: capitalize;
            `;
            btn.addEventListener('click', () => this.selectCategory(cat));
            catRow.appendChild(btn);
            this.catButtons.push(btn);
        }
        box.appendChild(catRow);

        // Text area
        this.textarea = document.createElement('textarea');
        this.textarea.placeholder = 'Describe the issue or suggestion...';
        this.textarea.style.cssText = `
            width: 100%;
            height: 100px;
            background: #0d0806;
            color: #e8d5cc;
            border: 2px solid #8a7068;
            border-radius: 4px;
            padding: 8px;
            font-family: monospace;
            font-size: 13px;
            resize: vertical;
            box-sizing: border-box;
            outline: none;
        `;
        this.textarea.addEventListener('focus', () => {
            this.textarea.style.borderColor = '#c43a24';
        });
        this.textarea.addEventListener('blur', () => {
            this.textarea.style.borderColor = '#8a7068';
        });
        // Prevent game keys from firing while typing
        this.textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
                this.close();
            }
        });
        box.appendChild(this.textarea);

        // Status message
        this.statusMsg = document.createElement('div');
        this.statusMsg.style.cssText = 'font-size: 11px; color: #8a7068; margin-top: 6px; min-height: 14px; text-align: center;';
        box.appendChild(this.statusMsg);

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin-top: 12px;';

        this.sendBtn = document.createElement('button');
        this.sendBtn.textContent = 'Send';
        this.sendBtn.style.cssText = `
            background: #c43a24; color: #e8d5cc; border: 2px solid #e8d5cc;
            border-radius: 4px; padding: 8px 28px; font-family: monospace;
            font-size: 13px; font-weight: bold; cursor: pointer;
        `;
        this.sendBtn.addEventListener('click', () => this.send());

        this.cancelBtn = document.createElement('button');
        this.cancelBtn.textContent = 'Cancel';
        this.cancelBtn.style.cssText = `
            background: #2a1a12; color: #8a7068; border: 2px solid #8a7068;
            border-radius: 4px; padding: 8px 20px; font-family: monospace;
            font-size: 13px; cursor: pointer;
        `;
        this.cancelBtn.addEventListener('click', () => this.close());

        btnRow.appendChild(this.sendBtn);
        btnRow.appendChild(this.cancelBtn);
        box.appendChild(btnRow);

        // Hint
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size: 10px; color: #5a4a42; margin-top: 10px; text-align: center;';
        hint.textContent = 'Game state is captured automatically. Press ESC to cancel.';
        box.appendChild(hint);

        this.overlay.appendChild(box);

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(this.overlay);
        }
    }

    selectCategory(cat) {
        this.selectedCategory = cat;
        for (const btn of this.catButtons) {
            const isSelected = btn.dataset.cat === cat;
            btn.style.background = isSelected ? '#c43a24' : '#2a1a12';
            btn.style.color = isSelected ? '#e8d5cc' : '#8a7068';
            btn.style.borderColor = isSelected ? '#e8d5cc' : '#8a7068';
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.textarea.value = '';
        this.statusMsg.textContent = '';
        this.sendBtn.disabled = false;
        this.sendBtn.textContent = 'Send';
        
        // Focus textarea after a tick (let the display settle)
        setTimeout(() => this.textarea.focus(), 50);
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        this.textarea.value = '';
        this.statusMsg.textContent = '';
    }

    captureGameState() {
        const game = this.game;
        const state = {};

        try {
            // Player info
            if (game.player) {
                state.player = {
                    x: Math.round(game.player.position.x),
                    y: Math.round(game.player.position.y),
                    shellIntegrity: Math.round(game.player.shellIntegrity),
                    shellMax: game.player.shellIntegrityMax,
                    direction: game.player.direction
                };
            }

            // Character
            state.characterName = game.characterName || 'Unknown';
            state.species = game.playerSpecies || 'unknown';
            state.color = game.playerColor || 'unknown';

            // Location
            state.location = game.currentLocation || 'unknown';
            if (game.currentBuilding) {
                state.building = {
                    type: game.currentBuilding.type,
                    name: game.currentBuilding.name
                };
            }

            // Economy
            if (game.currencySystem) {
                state.tokens = game.currencySystem.getTokens();
            }

            // Continuity
            if (game.continuitySystem) {
                state.continuity = Math.round(game.continuitySystem.getContinuity?.() || 0);
            }

            // Inventory summary
            if (game.inventorySystem) {
                state.inventorySlots = game.inventorySystem.getUsedSlots?.() || 0;
            }

            // Active quests
            if (game.questSystem) {
                const active = game.questSystem.getActiveQuests?.() || [];
                state.activeQuests = active.map(q => q.title || q.id).slice(0, 5);
            }

            // Combat state
            if (game.combatSystem) {
                state.enemiesNearby = game.combatSystem.enemies?.length || 0;
            }

            // Multiplayer
            if (game.multiplayerClient) {
                state.remotePlayers = game.multiplayerClient.remotePlayers?.size || 0;
            }

            // Camera
            if (game.camera) {
                state.camera = {
                    x: Math.round(game.camera.position.x),
                    y: Math.round(game.camera.position.y)
                };
            }

            // Screen size
            state.screen = {
                width: window.innerWidth,
                height: window.innerHeight,
                mobile: 'ontouchstart' in window
            };

            // Timestamp
            state.timestamp = new Date().toISOString();
            state.url = window.location.href;

        } catch (e) {
            state.captureError = e.message;
        }

        return state;
    }

    async send() {
        const message = this.textarea.value.trim();
        if (!message) {
            this.statusMsg.textContent = 'Please write something first!';
            this.statusMsg.style.color = '#c43a24';
            return;
        }

        this.sendBtn.disabled = true;
        this.sendBtn.textContent = 'Sending...';
        this.statusMsg.textContent = '';

        const gameState = this.captureGameState();
        const playerName = this.game.characterName || 'Anonymous';

        try {
            const res = await fetch(`${this.serverUrl}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName,
                    message,
                    category: this.selectedCategory,
                    gameState
                })
            });

            const data = await res.json();

            if (data.success) {
                this.statusMsg.textContent = 'Feedback sent! Thank you.';
                this.statusMsg.style.color = '#4ade80';
                
                // Auto-close after brief pause
                setTimeout(() => this.close(), 1500);
                
                // Show in-game notification
                if (this.game.showNotification) {
                    this.game.showNotification('Feedback sent!');
                }
            } else {
                this.statusMsg.textContent = data.error || 'Failed to send.';
                this.statusMsg.style.color = '#c43a24';
                this.sendBtn.disabled = false;
                this.sendBtn.textContent = 'Send';
            }
        } catch (err) {
            this.statusMsg.textContent = 'Network error — try again.';
            this.statusMsg.style.color = '#c43a24';
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = 'Send';
        }
    }
}
