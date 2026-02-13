/**
 * SpectatorStatsHUD - Displays detailed stats for the currently spectated player
 * Shows bot information like health, tokens, kill count, inventory, faction, etc.
 */

class SpectatorStatsHUD {
    constructor(game) {
        this.game = game;
        this.element = null;
        this.visible = false;
        this.currentPlayer = null;
        this.updateTimer = 0;
        this.updateInterval = 0.5; // Update every 500ms for performance
        
        this.createElements();
    }

    createElements() {
        // Main container
        this.element = document.createElement('div');
        this.element.id = 'spectator-stats-hud';
        this.element.style.cssText = `
            position: fixed;
            top: 80px;
            right: 16px;
            width: 280px;
            background: rgba(13, 8, 6, 0.95);
            border: 2px solid #c43a24;
            border-radius: 8px;
            color: #e8d5cc;
            font-family: monospace;
            font-size: 11px;
            padding: 12px;
            z-index: 999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            color: #c43a24;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
            text-align: center;
            border-bottom: 1px solid #3a2a22;
            padding-bottom: 4px;
        `;
        header.textContent = 'Player Stats';
        this.element.appendChild(header);

        // Player name and species
        this.nameElement = document.createElement('div');
        this.nameElement.style.cssText = `
            font-size: 13px;
            font-weight: bold;
            color: #e8d5cc;
            margin-bottom: 8px;
            text-align: center;
        `;
        this.element.appendChild(this.nameElement);

        // Stats container
        this.statsContainer = document.createElement('div');
        this.statsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;
        this.element.appendChild(this.statsContainer);

        // Status message (when no player or loading)
        this.statusElement = document.createElement('div');
        this.statusElement.style.cssText = `
            text-align: center;
            color: #8a7068;
            font-style: italic;
            margin: 20px 0;
        `;
        this.statusElement.textContent = 'No player selected';
        this.element.appendChild(this.statusElement);

        document.body.appendChild(this.element);
    }

    createStatRow(label, value, color = '#e8d5cc') {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            border-bottom: 1px solid rgba(58, 42, 34, 0.3);
        `;

        const labelSpan = document.createElement('span');
        labelSpan.style.cssText = `
            color: #8a7068;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        labelSpan.textContent = label;

        const valueSpan = document.createElement('span');
        valueSpan.style.cssText = `
            color: ${color};
            font-weight: bold;
            font-size: 11px;
        `;
        valueSpan.textContent = value;

        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        
        return row;
    }

    createHealthBar(current, max) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin: 4px 0;
        `;

        const label = document.createElement('div');
        label.style.cssText = `
            color: #8a7068;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 3px;
        `;
        label.textContent = 'Shell Integrity';

        const barBg = document.createElement('div');
        barBg.style.cssText = `
            width: 100%;
            height: 8px;
            background: #1a1210;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        `;

        const barFill = document.createElement('div');
        const healthPercent = Math.max(0, Math.min(100, (current / max) * 100));
        const healthColor = healthPercent > 60 ? '#4CAF50' : 
                           healthPercent > 30 ? '#FF9800' : '#c43a24';
        
        barFill.style.cssText = `
            width: ${healthPercent}%;
            height: 100%;
            background: ${healthColor};
            transition: width 0.3s ease;
        `;

        const healthText = document.createElement('div');
        healthText.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: #e8d5cc;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        healthText.textContent = `${current}/${max}`;

        barBg.appendChild(barFill);
        barBg.appendChild(healthText);
        container.appendChild(label);
        container.appendChild(barBg);

        return container;
    }

    createInventoryDisplay(items) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin: 6px 0;
        `;

        const label = document.createElement('div');
        label.style.cssText = `
            color: #8a7068;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        `;
        label.textContent = 'Inventory';

        const itemsContainer = document.createElement('div');
        itemsContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            max-height: 60px;
            overflow-y: auto;
        `;

        if (!items || items.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = `
                color: #5a4a42;
                font-style: italic;
                font-size: 10px;
            `;
            emptyMsg.textContent = 'Empty';
            itemsContainer.appendChild(emptyMsg);
        } else {
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.style.cssText = `
                    background: rgba(196, 58, 36, 0.2);
                    border: 1px solid #c43a24;
                    border-radius: 3px;
                    padding: 2px 6px;
                    font-size: 9px;
                    color: #e8d5cc;
                `;
                itemEl.textContent = item.name || item;
                itemEl.title = `${item.name || item}${item.count > 1 ? ` x${item.count}` : ''}`;
                itemsContainer.appendChild(itemEl);
            });
        }

        container.appendChild(label);
        container.appendChild(itemsContainer);
        return container;
    }

    show() {
        if (this.element) {
            this.visible = true;
            this.element.style.opacity = '1';
            this.element.style.pointerEvents = 'none'; // Keep non-interactive
        }
    }

    hide() {
        if (this.element) {
            this.visible = false;
            this.element.style.opacity = '0';
        }
    }

    setPlayer(player) {
        this.currentPlayer = player;
        this.updateTimer = 0;
        this.render();
    }

    update(deltaTime, spectatedPlayer) {
        if (!this.visible) return;

        // If player changed since last update, re-render immediately
        if (spectatedPlayer !== this.currentPlayer) {
            this.setPlayer(spectatedPlayer);
            return;
        }

        this.updateTimer += deltaTime;
        if (this.updateTimer < this.updateInterval) return;
        this.updateTimer = 0;

        this.render();
    }

    render() {
        if (!this.element || !this.visible) return;

        // Clear previous stats
        this.statsContainer.innerHTML = '';

        if (!this.currentPlayer) {
            this.nameElement.textContent = '';
            this.statusElement.style.display = 'block';
            this.statusElement.textContent = 'No player selected';
            this.statsContainer.style.display = 'none';
            return;
        }

        // Hide status message and show stats
        this.statusElement.style.display = 'none';
        this.statsContainer.style.display = 'block';

        const player = this.currentPlayer;
        
        // Player name and species
        const species = player.species || 'lobster';
        const speciesDisplay = species.charAt(0).toUpperCase() + species.slice(1).replace('_', ' ');
        const botIcon = player.isBot ? '🤖 ' : '';
        this.nameElement.textContent = `${botIcon}${player.name || 'Unknown'}`;
        this.nameElement.style.color = player.isBot ? '#4CAF50' : '#e8d5cc';

        // Species
        const speciesRow = this.createStatRow('Species', speciesDisplay, '#e8d5cc');
        this.statsContainer.appendChild(speciesRow);

        // Health/Shell Integrity (mock data for now - needs server integration)
        const health = player.health || 100;
        const maxHealth = player.maxHealth || 100;
        const healthBar = this.createHealthBar(health, maxHealth);
        this.statsContainer.appendChild(healthBar);

        // Tokens earned (mock data)
        const tokens = player.tokens || 0;
        const tokensRow = this.createStatRow('Tokens', tokens.toLocaleString(), '#FFD700');
        this.statsContainer.appendChild(tokensRow);

        // Kill count (mock data)
        const kills = player.kills || 0;
        const killsRow = this.createStatRow('Kills', kills.toString(), '#c43a24');
        this.statsContainer.appendChild(killsRow);

        // Faction (mock data)
        const faction = player.faction || 'None';
        const factionColor = faction !== 'None' ? '#9C27B0' : '#8a7068';
        const factionRow = this.createStatRow('Faction', faction, factionColor);
        this.statsContainer.appendChild(factionRow);

        // Position/Island
        const x = Math.round(player.position?.x || 0);
        const y = Math.round(player.position?.y || 0);
        const island = this.getIslandName(x, y) || 'Unknown';
        const posRow = this.createStatRow('Position', `${x}, ${y}`, '#8a7068');
        this.statsContainer.appendChild(posRow);
        
        const islandRow = this.createStatRow('Island', island, '#4CAF50');
        this.statsContainer.appendChild(islandRow);

        // Inventory (mock data for now)
        const inventory = player.inventory || [];
        const inventoryDisplay = this.createInventoryDisplay(inventory);
        this.statsContainer.appendChild(inventoryDisplay);
    }

    // Helper method to determine island name based on position
    // This is a simplified version - in reality this would need the world map data
    getIslandName(x, y) {
        // Mock island detection based on rough coordinate ranges
        // This would need to be integrated with the actual world map system
        if (x < 1000 && y < 1000) return 'Starter Island';
        if (x > 2000 && y < 1000) return 'Eastern Isle';
        if (x < 1000 && y > 2000) return 'Southern Atoll';
        if (x > 2000 && y > 2000) return 'Remote Cay';
        return 'Open Waters';
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.visible = false;
    }
}