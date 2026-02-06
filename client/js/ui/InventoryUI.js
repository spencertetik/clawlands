// InventoryUI.js - HTML overlay inventory panel
// Toggle with I/TAB, styled with red terminal theme

class InventoryUI {
    constructor(inventorySystem) {
        this.inventory = inventorySystem;
        this.visible = false;
        this.selectedSlot = -1;
        this.overlay = null;
        this.panel = null;
        this.slotsContainer = null;
        this.detailPanel = null;
        this.slotElements = [];
        
        this.buildUI();
        this.setupKeyBindings();
        
        // Listen for inventory changes to refresh
        if (this.inventory) {
            this.inventory.addListener(() => this.refresh());
        }
    }
    
    buildUI() {
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
        
        // Title
        const title = document.createElement('div');
        title.style.cssText = `
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            color: #c43a24;
            letter-spacing: 3px;
            margin-bottom: 12px;
            text-transform: uppercase;
            text-shadow: 0 0 8px rgba(196, 58, 36, 0.4);
        `;
        title.textContent = '🎒 INVENTORY';
        this.panel.appendChild(title);
        
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
                border: 1px solid rgba(138, 112, 104, 0.3);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                cursor: pointer;
                transition: border-color 0.15s, background 0.15s;
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
        
        // Close hint
        const hint = document.createElement('div');
        hint.style.cssText = `
            text-align: center;
            font-size: 11px;
            color: #8a7068;
            margin-top: 10px;
            letter-spacing: 0.5px;
        `;
        hint.textContent = 'Press I or ESC to close';
        this.panel.appendChild(hint);
        
        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);
    }
    
    setupKeyBindings() {
        window.addEventListener('keydown', (e) => {
            // Don't capture if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const key = e.key.toLowerCase();
            
            if (key === 'i' || key === 'tab') {
                // Don't toggle if dialog is open
                const dialogOpen = document.getElementById('dialog-box')?.style.display !== 'none' &&
                                   document.getElementById('dialog-box')?.style.display !== '';
                if (dialogOpen) return;
                
                // Don't toggle during welcome screen
                if (document.querySelector('.welcome-screen')) return;
                
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
        this.refresh();
    }
    
    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.overlay.style.display = 'none';
        this.selectedSlot = -1;
    }
    
    isOpen() {
        return this.visible;
    }
    
    // Refresh all slot visuals from inventory data
    refresh() {
        if (!this.inventory) return;
        
        const rarityColors = typeof RARITY_COLORS !== 'undefined' ? RARITY_COLORS : {
            common: '#8a7068',
            uncommon: '#4ade80',
            rare: '#4a9eff',
            legendary: '#f59e0b'
        };
        
        for (let i = 0; i < 20; i++) {
            const slot = this.slotElements[i];
            const data = this.inventory.getSlot(i);
            
            if (data && data.itemId) {
                const itemDef = typeof ItemData !== 'undefined' ? ItemData[data.itemId] : null;
                if (itemDef) {
                    const rarityColor = rarityColors[itemDef.rarity] || rarityColors.common;
                    
                    slot.innerHTML = '';
                    
                    // Icon
                    const icon = document.createElement('span');
                    icon.textContent = itemDef.icon;
                    icon.style.cssText = 'font-size: 26px; line-height: 1;';
                    slot.appendChild(icon);
                    
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
                        `;
                        slot.appendChild(badge);
                    }
                    
                    // Rarity border
                    slot.style.borderColor = rarityColor;
                    slot.style.background = `rgba(${this.hexToRgb(rarityColor)}, 0.08)`;
                } else {
                    slot.innerHTML = '';
                    slot.style.borderColor = 'rgba(138, 112, 104, 0.3)';
                    slot.style.background = 'rgba(138, 112, 104, 0.15)';
                }
            } else {
                slot.innerHTML = '';
                slot.style.borderColor = 'rgba(138, 112, 104, 0.3)';
                slot.style.background = 'rgba(138, 112, 104, 0.15)';
            }
            
            // Highlight selected
            if (i === this.selectedSlot) {
                slot.style.boxShadow = '0 0 8px rgba(196, 58, 36, 0.5)';
            } else {
                slot.style.boxShadow = 'none';
            }
        }
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
                const rarityColors = typeof RARITY_COLORS !== 'undefined' ? RARITY_COLORS : {};
                const color = rarityColors[itemDef.rarity] || '#8a7068';
                
                this.detailPanel.innerHTML = `
                    <div style="color: ${color}; font-weight: bold; font-size: 13px; margin-bottom: 4px;">
                        ${itemDef.icon} ${itemDef.name}
                        <span style="font-weight: normal; font-size: 10px; opacity: 0.7;">[${rarityLabel}]</span>
                    </div>
                    <div style="color: #e8d5cc; opacity: 0.85;">${itemDef.description}</div>
                    ${data.quantity > 1 ? `<div style="color: #8a7068; margin-top: 4px; font-size: 11px;">Quantity: ${data.quantity}</div>` : ''}
                `;
                return;
            }
        }
        
        this.detailPanel.innerHTML = '<span style="color: #8a7068;">Hover over an item to see details</span>';
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryUI;
}
