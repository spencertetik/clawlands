// InventoryUI.js - HTML overlay inventory panel
// Toggle with I key, styled with red terminal theme
// Shows item sprites with emoji fallback, rarity borders, slot count

class InventoryUI {
    constructor(inventorySystem) {
        this.inventory = inventorySystem;
        this.visible = false;
        this.selectedSlot = -1;
        this.overlay = null;
        this.panel = null;
        this.slotsContainer = null;
        this.detailPanel = null;
        this.slotCountLabel = null;
        this.slotElements = [];
        
        // Sprite image cache: itemId -> { img, loaded }
        this.spriteCache = {};
        
        this.buildUI();
        this.setupKeyBindings();
        
        // Listen for inventory changes to refresh
        if (this.inventory) {
            this.inventory.addListener(() => this.refresh());
        }
    }
    
    buildUI() {
        // Inject CSS animation
        if (!document.getElementById('inventory-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'inventory-ui-styles';
            style.textContent = `
                @keyframes inventoryFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes inventoryFadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes inventoryPanelIn {
                    from { opacity: 0; transform: scale(0.92) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes inventoryPanelOut {
                    from { opacity: 1; transform: scale(1) translateY(0); }
                    to { opacity: 0; transform: scale(0.92) translateY(12px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Full-screen overlay (click to close)
        this.overlay = document.createElement('div');
        this.overlay.id = 'inventory-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            z-index: 4000;
            display: none;
            justify-content: center;
            align-items: center;
        `;
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
        
        // Main panel
        this.panel = document.createElement('div');
        this.panel.id = 'inventory-panel';
        this.panel.style.cssText = `
            width: 310px;
            background: rgba(13, 8, 6, 0.95);
            border: 2px solid #c43a24;
            border-radius: 8px;
            padding: 16px;
            font-family: 'Courier New', monospace;
            color: #e8d5cc;
            box-shadow: 0 0 30px rgba(196, 58, 36, 0.3), inset 0 0 60px rgba(13, 8, 6, 0.5);
            user-select: none;
        `;
        
        // Header row: title + close hint
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        `;
        
        // Title
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #c43a24;
            letter-spacing: 3px;
            text-transform: uppercase;
            text-shadow: 0 0 8px rgba(196, 58, 36, 0.4);
        `;
        title.textContent = 'INVENTORY';
        header.appendChild(title);
        
        // Close hint (top right)
        const closeHint = document.createElement('div');
        closeHint.style.cssText = `
            font-size: 10px;
            color: #8a7068;
            letter-spacing: 0.5px;
        `;
        closeHint.textContent = 'Press I to close';
        header.appendChild(closeHint);
        
        this.panel.appendChild(header);
        
        // Slot count label
        this.slotCountLabel = document.createElement('div');
        this.slotCountLabel.style.cssText = `
            text-align: right;
            font-size: 11px;
            color: #8a7068;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        `;
        this.slotCountLabel.textContent = '0/20 slots';
        this.panel.appendChild(this.slotCountLabel);
        
        // Slots grid (4x5)
        this.slotsContainer = document.createElement('div');
        this.slotsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin-bottom: 12px;
        `;
        
        // Create 20 slot elements
        for (let i = 0; i < 20; i++) {
            const slot = document.createElement('div');
            slot.dataset.index = i;
            slot.style.cssText = `
                width: 62px;
                height: 62px;
                background: rgba(138, 112, 104, 0.15);
                border: 2px solid rgba(138, 112, 104, 0.3);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                cursor: pointer;
                transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
                font-size: 26px;
            `;
            
            slot.addEventListener('mouseenter', () => this.onSlotHover(i));
            slot.addEventListener('click', () => this.onSlotClick(i));
            
            this.slotsContainer.appendChild(slot);
            this.slotElements.push(slot);
        }
        
        this.panel.appendChild(this.slotsContainer);
        
        // Detail panel (shows name + description of selected item)
        this.detailPanel = document.createElement('div');
        this.detailPanel.style.cssText = `
            min-height: 52px;
            padding: 10px;
            background: rgba(138, 112, 104, 0.1);
            border: 1px solid rgba(138, 112, 104, 0.2);
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.5;
            color: #8a7068;
        `;
        this.detailPanel.textContent = 'Hover over an item to see details';
        this.panel.appendChild(this.detailPanel);
        
        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);
    }
    
    setupKeyBindings() {
        window.addEventListener('keydown', (e) => {
            // Don't capture if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const key = e.key.toLowerCase();
            
            if (key === 'i') {
                // Don't toggle if dialog is open
                const dialogBox = document.getElementById('dialog-box');
                const dialogOpen = dialogBox && dialogBox.style.display !== 'none' && dialogBox.style.display !== '';
                if (dialogOpen) return;
                
                e.preventDefault();
                this.toggle();
            }
            
            if (key === 'escape' && this.visible) {
                e.preventDefault();
                this.hide();
            }
        });
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show() {
        if (this.visible) return;
        this.visible = true;
        this.selectedSlot = -1;
        this.overlay.style.display = 'flex';
        
        // Fade in animation
        this.overlay.style.animation = 'inventoryFadeIn 0.2s ease-out forwards';
        this.panel.style.animation = 'inventoryPanelIn 0.25s ease-out forwards';
        
        this.refresh();
    }
    
    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.selectedSlot = -1;
        
        // Fade out animation
        this.overlay.style.animation = 'inventoryFadeOut 0.2s ease-in forwards';
        this.panel.style.animation = 'inventoryPanelOut 0.2s ease-in forwards';
        
        setTimeout(() => {
            if (!this.visible) {
                this.overlay.style.display = 'none';
            }
        }, 220);
    }
    
    isOpen() {
        return this.visible;
    }
    
    // Try to load a sprite image for an item, cache the result
    getSpriteForItem(itemId) {
        if (this.spriteCache[itemId]) {
            return this.spriteCache[itemId];
        }
        
        const entry = { img: null, loaded: false, failed: false };
        this.spriteCache[itemId] = entry;
        
        const img = new Image();
        img.onload = () => {
            entry.img = img;
            entry.loaded = true;
            // Re-render if inventory is visible
            if (this.visible) this.refresh();
        };
        img.onerror = () => {
            entry.failed = true;
            entry.loaded = true;
        };
        img.src = `assets/sprites/items/${itemId}.png`;
        
        return entry;
    }
    
    // Refresh all slot visuals from inventory data
    refresh() {
        if (!this.inventory) return;
        
        const rarityColors = {
            common: '#8a7068',
            uncommon: '#4ade80',
            rare: '#4a9eff',
            legendary: '#fbbf24'
        };
        
        // Update slot count
        const usedSlots = this.inventory.getUsedSlots();
        if (this.slotCountLabel) {
            this.slotCountLabel.textContent = `${usedSlots}/20 slots`;
        }
        
        for (let i = 0; i < 20; i++) {
            const slot = this.slotElements[i];
            const data = this.inventory.getSlot(i);
            
            if (data && data.itemId) {
                const itemDef = typeof ItemData !== 'undefined' ? ItemData[data.itemId] : null;
                if (itemDef) {
                    const rarityColor = rarityColors[itemDef.rarity] || rarityColors.common;
                    
                    slot.innerHTML = '';
                    
                    // Try sprite image first, fall back to emoji
                    const spriteEntry = this.getSpriteForItem(data.itemId);
                    
                    if (spriteEntry.loaded && spriteEntry.img && !spriteEntry.failed) {
                        // Show sprite image
                        const imgEl = document.createElement('img');
                        imgEl.src = spriteEntry.img.src;
                        imgEl.style.cssText = `
                            width: 32px;
                            height: 32px;
                            image-rendering: pixelated;
                            pointer-events: none;
                        `;
                        slot.appendChild(imgEl);
                    } else {
                        // Colored dot based on rarity
                        const icon = document.createElement('span');
                        icon.textContent = itemDef.icon;
                        
                        // Color mapping based on rarity
                        const rarityColors = {
                            'common': '#8a7068',
                            'uncommon': '#4a9eff',
                            'rare': '#a855f7',
                            'epic': '#f59e0b',
                            'legendary': '#c43a24'
                        };
                        
                        const color = rarityColors[itemDef.rarity] || '#8a7068';
                        icon.style.cssText = `font-size: 26px; line-height: 1; pointer-events: none; color: ${color};`;
                        slot.appendChild(icon);
                    }
                    
                    // Quantity badge (if > 1)
                    if (data.quantity > 1) {
                        const badge = document.createElement('span');
                        badge.textContent = data.quantity;
                        badge.style.cssText = `
                            position: absolute;
                            bottom: 2px;
                            right: 4px;
                            font-size: 11px;
                            font-weight: bold;
                            color: #e8d5cc;
                            text-shadow: 0 0 3px #000, 0 0 3px #000;
                            pointer-events: none;
                        `;
                        slot.appendChild(badge);
                    }
                    
                    // Rarity border
                    slot.style.borderColor = rarityColor;
                    slot.style.background = `rgba(${this.hexToRgb(rarityColor)}, 0.08)`;
                } else {
                    this.clearSlot(slot);
                }
            } else {
                this.clearSlot(slot);
            }
            
            // Highlight selected
            if (i === this.selectedSlot) {
                slot.style.boxShadow = '0 0 8px rgba(196, 58, 36, 0.5), inset 0 0 4px rgba(196, 58, 36, 0.15)';
            } else {
                slot.style.boxShadow = 'none';
            }
        }
    }
    
    clearSlot(slot) {
        slot.innerHTML = '';
        slot.style.borderColor = 'rgba(138, 112, 104, 0.3)';
        slot.style.background = 'rgba(138, 112, 104, 0.15)';
    }
    
    onSlotHover(index) {
        this.showSlotDetails(index);
    }
    
    onSlotClick(index) {
        this.selectedSlot = index;
        this.showSlotDetails(index);
        this.refresh();
    }
    
    showSlotDetails(index) {
        if (!this.inventory) return;
        
        const data = this.inventory.getSlot(index);
        if (data && data.itemId) {
            const itemDef = typeof ItemData !== 'undefined' ? ItemData[data.itemId] : null;
            if (itemDef) {
                const rarityLabel = itemDef.rarity.charAt(0).toUpperCase() + itemDef.rarity.slice(1);
                const rarityColors = {
                    common: '#8a7068',
                    uncommon: '#4ade80',
                    rare: '#4a9eff',
                    legendary: '#fbbf24'
                };
                const color = rarityColors[itemDef.rarity] || '#8a7068';
                const categoryLabel = itemDef.category.charAt(0).toUpperCase() + itemDef.category.slice(1);
                
                // Usable/heal info
                let actionHTML = '';
                if (itemDef.usable && itemDef.healAmount) {
                    actionHTML = `<div style="margin-top: 6px;">
                        <span style="color: #44aa44; font-size: 11px;">Heals ${itemDef.healAmount} Shell</span>
                        <button id="inv-use-btn" style="
                            background: #44aa44; color: #fff; border: none; padding: 3px 12px;
                            font-family: monospace; font-size: 11px; cursor: pointer;
                            margin-left: 8px; border-radius: 2px;
                        ">USE</button>
                    </div>`;
                }
                // Sell price info
                let sellHTML = '';
                if (itemDef.sellPrice) {
                    sellHTML = `<span style="color: #f5c542; font-size: 10px; margin-left: 8px;">Sells: ${itemDef.sellPrice} BT</span>`;
                }

                this.detailPanel.innerHTML = `
                    <div style="color: ${color}; font-weight: bold; font-size: 13px; margin-bottom: 4px;">
                        ${itemDef.icon} ${itemDef.name}
                        <span style="font-weight: normal; font-size: 10px; opacity: 0.7;">[${rarityLabel}]</span>
                    </div>
                    <div style="color: #e8d5cc; opacity: 0.85;">${itemDef.description}</div>
                    <div style="color: #8a7068; margin-top: 4px; font-size: 11px;">
                        ${categoryLabel}${data.quantity > 1 ? ` · Qty: ${data.quantity}` : ''}${sellHTML}
                    </div>
                    ${actionHTML}
                `;

                // Wire up USE button
                const useBtn = this.detailPanel.querySelector('#inv-use-btn');
                if (useBtn) {
                    useBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.useItem(index, data.itemId);
                    });
                }
                return;
            }
        }
        
        this.detailPanel.innerHTML = '<span style="color: #8a7068;">Hover over an item to see details</span>';
    }
    
    // Use a consumable item (healing etc)
    useItem(slotIndex, itemId) {
        const itemDef = typeof ItemData !== 'undefined' ? ItemData[itemId] : null;
        if (!itemDef || !itemDef.usable) return;

        // Find the game reference
        const game = window.game;
        if (!game || !game.player) return;

        // Heal
        if (itemDef.healAmount) {
            const player = game.player;
            if (player.shellIntegrity >= player.shellIntegrityMax) {
                if (typeof gameNotifications !== 'undefined') {
                    gameNotifications.warn('Shell already full!');
                }
                return;
            }
            player.heal(itemDef.healAmount);
            if (typeof gameNotifications !== 'undefined') {
                gameNotifications.success(`${itemDef.icon} +${itemDef.healAmount} Shell`);
            }
        }

        // Remove 1 from inventory
        if (this.inventory) {
            this.inventory.removeItem(itemId, 1);
        }

        // Refresh UI
        this.refresh();
        this.showSlotDetails(slotIndex);
    }

    // Helper: convert hex color to r,g,b string
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
        }
        return '138, 112, 104';
    }
}

// Export
window.InventoryUI = InventoryUI;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryUI;
}
