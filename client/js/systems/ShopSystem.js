// ShopSystem.js - Full-screen shop overlay for buying and selling items
// Red terminal theme matching existing UI

class ShopSystem {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.currentTab = 'buy'; // 'buy' or 'sell'
        this.container = null;
        
        // Shop inventory (items available for purchase)
        this.shopInventory = [
            'kelp_salve',
            'brine_elixir', 
            'coconut_water',
            'drift_essence',
            'dock_wrench',
            'claw_blade',
            'tide_hammer',
            'sandy_bread',
            'kelp_wrap'
        ];
        
        this.init();
    }
    
    init() {
        this.createUI();
    }
    
    createUI() {
        const isMobile = 'ontouchstart' in window || window.innerWidth < 600;
        this.isMobile = isMobile;
        
        // Overlay background — covers game container
        this.overlay = document.createElement('div');
        this.overlay.id = 'shop-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            z-index: 3000;
            display: none;
            justify-content: center;
            align-items: center;
        `;
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        
        // Main container — centered panel instead of full-screen
        this.container = document.createElement('div');
        this.container.id = 'shop-container';
        this.container.style.cssText = `
            width: ${isMobile ? '80%' : '90%'};
            max-width: ${isMobile ? '340px' : '520px'};
            max-height: ${isMobile ? '80%' : '85%'};
            background: rgba(13, 8, 6, 0.95);
            border: 2px solid #c43a24;
            border-radius: 8px;
            color: #e8d5cc;
            display: flex;
            flex-direction: column;
            font-family: 'Courier New', monospace;
            box-shadow: 0 0 30px rgba(196, 58, 36, 0.3);
            overflow: hidden;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: ${isMobile ? '10px 12px' : '16px 20px'};
            border-bottom: 2px solid #c43a24;
            background: rgba(196, 58, 36, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: ${isMobile ? '16px' : '24px'};
            font-weight: bold;
            color: #c43a24;
            text-transform: uppercase;
            letter-spacing: ${isMobile ? '1px' : '2px'};
        `;
        title.textContent = 'BRINE MARKET';
        
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: transparent;
            border: 1px solid #c43a24;
            color: #c43a24;
            padding: ${isMobile ? '4px 10px' : '8px 16px'};
            cursor: pointer;
            font-family: inherit;
            font-size: ${isMobile ? '11px' : '14px'};
        `;
        closeBtn.textContent = isMobile ? 'CLOSE' : '[ESC] CLOSE';
        closeBtn.onclick = () => this.close();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Tab navigation
        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            background: rgba(0, 0, 0, 0.3);
            flex-shrink: 0;
        `;
        
        const buyTab = document.createElement('button');
        buyTab.style.cssText = `
            flex: 1;
            padding: ${isMobile ? '10px' : '15px'};
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            color: #8a7068;
            cursor: pointer;
            font-family: inherit;
            font-size: ${isMobile ? '13px' : '16px'};
            font-weight: bold;
        `;
        buyTab.textContent = 'BUY';
        buyTab.onclick = () => this.switchTab('buy');
        
        const sellTab = document.createElement('button');
        sellTab.style.cssText = buyTab.style.cssText;
        sellTab.textContent = 'SELL';
        sellTab.onclick = () => this.switchTab('sell');
        
        tabBar.appendChild(buyTab);
        tabBar.appendChild(sellTab);
        
        // Content area — scrollable list
        const content = document.createElement('div');
        content.id = 'shop-content';
        content.style.cssText = `
            flex: 1;
            padding: ${isMobile ? '8px' : '15px'};
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            display: flex;
            flex-direction: column;
            gap: ${isMobile ? '6px' : '10px'};
        `;
        
        this.container.appendChild(header);
        this.container.appendChild(tabBar);
        this.container.appendChild(content);
        
        // Mount overlay (with container inside) in game container
        this.overlay.appendChild(this.container);
        const gameContainer = document.getElementById('game-container') || document.body;
        gameContainer.appendChild(this.overlay);
        
        // Store references
        this.buyTabBtn = buyTab;
        this.sellTabBtn = sellTab;
        this.contentArea = content;
        
        // Add keyboard event listeners
        this.keyHandler = (e) => {
            if (this.isOpen && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }
    
    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.switchTab('buy');
        if (window.game && window.game.sfx) window.game.sfx.play('menu_open');
        
        // Pause game if needed
        if (this.game && this.game.inputManager) {
            this.game.inputManager.isShopOpen = true;
        }
    }
    
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.overlay.style.display = 'none';
        if (window.game && window.game.sfx) window.game.sfx.play('menu_close');
        
        // Resume game
        if (this.game && this.game.inputManager) {
            this.game.inputManager.isShopOpen = false;
        }
    }
    
    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab styling
        this.buyTabBtn.style.borderBottomColor = tab === 'buy' ? '#c43a24' : 'transparent';
        this.buyTabBtn.style.color = tab === 'buy' ? '#c43a24' : '#8a7068';
        
        this.sellTabBtn.style.borderBottomColor = tab === 'sell' ? '#c43a24' : 'transparent';
        this.sellTabBtn.style.color = tab === 'sell' ? '#c43a24' : '#8a7068';
        
        // Update content
        this.refreshContent();
    }
    
    refreshContent() {
        this.contentArea.innerHTML = '';
        
        if (this.currentTab === 'buy') {
            this.renderBuyTab();
        } else {
            this.renderSellTab();
        }
    }
    
    renderBuyTab() {
        this.shopInventory.forEach(itemId => {
            const itemDef = ItemData[itemId];
            if (!itemDef || !itemDef.buyPrice) return;
            
            const itemCard = this.createItemCard(itemDef, 'buy');
            this.contentArea.appendChild(itemCard);
        });
    }
    
    renderSellTab() {
        if (!this.game.inventorySystem) return;
        
        const playerInventory = this.game.inventorySystem.getItems();
        playerInventory.forEach(slot => {
            if (slot.itemId) {
                const itemDef = ItemData[slot.itemId];
                if (itemDef && itemDef.sellPrice) {
                    const itemCard = this.createItemCard(itemDef, 'sell', slot.quantity);
                    this.contentArea.appendChild(itemCard);
                }
            }
        });
    }
    
    createItemCard(itemDef, mode, quantity = 1) {
        const isMobile = this.isMobile;
        const card = document.createElement('div');
        card.style.cssText = `
            border: 1px solid #8a7068;
            background: rgba(196, 58, 36, 0.05);
            padding: ${isMobile ? '8px 10px' : '15px'};
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
        `;
        
        const price = mode === 'buy' ? itemDef.buyPrice : itemDef.sellPrice;
        const canAfford = mode === 'buy' ? 
            (this.game.currencySystem && this.game.currencySystem.canAfford(price)) : true;
        
        if (isMobile) {
            // Compact row layout for mobile
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; color: ${canAfford ? '#e8d5cc' : '#8a7068'};">
                    <span style="font-size: 13px;">${itemDef.icon} ${itemDef.name}${quantity > 1 ? ` x${quantity}` : ''}</span>
                    <span style="color: #f5c542; font-size: 12px; font-weight: bold; white-space: nowrap; margin-left: 8px;">${price} tokens</span>
                </div>
                <div style="font-size: 10px; color: #8a7068; margin-top: 3px; line-height: 1.3;">${itemDef.description}</div>
            `;
        } else {
            card.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 8px; color: ${canAfford ? '#e8d5cc' : '#8a7068'};">
                    ${itemDef.icon} ${itemDef.name}
                </div>
                <div style="font-size: 12px; color: #8a7068; margin-bottom: 10px; line-height: 1.4;">
                    ${itemDef.description}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #f5c542; font-weight: bold;">
                        ${price} tokens
                    </span>
                    ${quantity > 1 ? `<span style="color: #8a7068;">x${quantity}</span>` : ''}
                </div>
            `;
        }
        
        if (canAfford) {
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = '#c43a24';
                card.style.background = 'rgba(196, 58, 36, 0.1)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.borderColor = '#8a7068';
                card.style.background = 'rgba(196, 58, 36, 0.05)';
            });
            
            card.onclick = () => this.handleTransaction(itemDef, mode);
        }
        
        return card;
    }
    
    handleTransaction(itemDef, mode) {
        if (mode === 'buy') {
            // Buy item
            if (this.game.currencySystem && this.game.currencySystem.removeTokens(itemDef.buyPrice)) {
                if (this.game.inventorySystem && this.game.inventorySystem.addItem(itemDef.id)) {
                    if (typeof gameNotifications !== 'undefined' && gameNotifications) {
                        gameNotifications.success(`Purchased ${itemDef.name}`);
                    }
                } else {
                    // Refund if inventory full
                    this.game.currencySystem.addTokens(itemDef.buyPrice);
                    if (typeof gameNotifications !== 'undefined' && gameNotifications) {
                        gameNotifications.warning('Inventory full!');
                    }
                }
            }
        } else {
            // Sell item
            if (this.game.inventorySystem && this.game.inventorySystem.removeItem(itemDef.id, 1)) {
                if (this.game.currencySystem) {
                    this.game.currencySystem.addTokens(itemDef.sellPrice);
                    if (typeof gameNotifications !== 'undefined' && gameNotifications) {
                        gameNotifications.success(`Sold ${itemDef.name} for ${itemDef.sellPrice} tokens`);
                    }
                }
            }
        }
        
        // Refresh display
        this.refreshContent();
    }
}