// InventorySystem.js - Player inventory management
// Manages item slots, add/remove, save/load to localStorage

class InventorySystem {
    constructor(playerName) {
        this.playerName = playerName || 'default';
        this.storageKey = `clawworld_inventory_${this.playerName}`;
        this.maxSlots = 20;
        this.slots = []; // Array of { itemId, quantity } or null for empty
        this.listeners = [];
        
        // Initialize empty slots
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots.push(null);
        }
        
        this.load();
    }
    
    // Set player name (used when player logs in / creates character)
    setPlayerName(name) {
        this.playerName = name;
        this.storageKey = `clawworld_inventory_${this.playerName}`;
        this.load();
    }
    
    // Add item(s) to inventory. Returns number actually added.
    addItem(itemId, qty = 1) {
        if (!itemId || qty <= 0) return 0;
        
        const itemDef = typeof ItemData !== 'undefined' ? ItemData[itemId] : null;
        if (!itemDef) {
            console.warn(`InventorySystem: Unknown item "${itemId}"`);
            return 0;
        }
        
        let remaining = qty;
        
        // First: try to stack into existing slots
        if (itemDef.stackable) {
            for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
                const slot = this.slots[i];
                if (slot && slot.itemId === itemId) {
                    const canAdd = itemDef.maxStack - slot.quantity;
                    if (canAdd > 0) {
                        const toAdd = Math.min(canAdd, remaining);
                        slot.quantity += toAdd;
                        remaining -= toAdd;
                    }
                }
            }
        }
        
        // Second: place in empty slots
        while (remaining > 0) {
            const emptyIndex = this.slots.findIndex(s => s === null);
            if (emptyIndex === -1) break; // Inventory full
            
            const stackSize = itemDef.stackable ? Math.min(remaining, itemDef.maxStack) : 1;
            this.slots[emptyIndex] = { itemId: itemId, quantity: stackSize };
            remaining -= stackSize;
        }
        
        const added = qty - remaining;
        if (added > 0) {
            this.save();
            this.notify('item_added', { itemId, quantity: added });
        }
        
        return added;
    }
    
    // Remove item(s) from inventory. Returns number actually removed.
    removeItem(itemId, qty = 1) {
        if (!itemId || qty <= 0) return 0;
        
        let remaining = qty;
        
        // Remove from slots (last to first to preserve earlier stacks)
        for (let i = this.maxSlots - 1; i >= 0 && remaining > 0; i--) {
            const slot = this.slots[i];
            if (slot && slot.itemId === itemId) {
                const toRemove = Math.min(slot.quantity, remaining);
                slot.quantity -= toRemove;
                remaining -= toRemove;
                
                if (slot.quantity <= 0) {
                    this.slots[i] = null;
                }
            }
        }
        
        const removed = qty - remaining;
        if (removed > 0) {
            this.save();
            this.notify('item_removed', { itemId, quantity: removed });
        }
        
        return removed;
    }
    
    // Check if player has at least qty of an item
    hasItem(itemId, qty = 1) {
        return this.getItemCount(itemId) >= qty;
    }
    
    // Get total count of an item across all slots
    getItemCount(itemId) {
        let total = 0;
        for (const slot of this.slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total;
    }
    
    // Check if inventory is completely full (no empty slots and all stacks maxed)
    isFull() {
        return this.slots.every(s => s !== null);
    }
    
    // Get number of occupied slots
    getUsedSlots() {
        return this.slots.filter(s => s !== null).length;
    }
    
    // Get a slot by index
    getSlot(index) {
        if (index < 0 || index >= this.maxSlots) return null;
        return this.slots[index];
    }
    
    // Get all non-null slots with their indices
    getOccupiedSlots() {
        const result = [];
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i]) {
                result.push({ index: i, ...this.slots[i] });
            }
        }
        return result;
    }
    
    // Save to localStorage
    save() {
        try {
            const data = {
                slots: this.slots,
                version: 1
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('InventorySystem: Failed to save:', e);
        }
    }
    
    // Load from localStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.slots && Array.isArray(data.slots)) {
                    // Restore slots, padding to maxSlots if needed
                    for (let i = 0; i < this.maxSlots; i++) {
                        this.slots[i] = (data.slots[i] && data.slots[i].itemId) ? data.slots[i] : null;
                    }
                    console.log(`🎒 Loaded inventory: ${this.getUsedSlots()}/${this.maxSlots} slots used`);
                }
            }
        } catch (e) {
            console.warn('InventorySystem: Failed to load:', e);
        }
    }
    
    // Event listener system
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }
    
    notify(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (e) {
                console.error('InventorySystem listener error:', e);
            }
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventorySystem;
}
