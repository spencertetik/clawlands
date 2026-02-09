// CurrencySystem.js - Manages Brine Tokens in Clawlands
// Handles storage, transactions, and display formatting

class CurrencySystem {
    constructor() {
        this.storageKey = 'clawlands_brine_tokens';
        this.tokens = this.loadTokens();
        
        // Token denominations for display (cosmetic only)
        this.denominations = {
            copper: { value: 1, name: 'Copper', color: '#8a7068' },
            silver: { value: 5, name: 'Silver', color: '#c0c0c0' },
            gold: { value: 20, name: 'Gold', color: '#f59e0b' },
            pearl: { value: 50, name: 'Pearl', color: '#e8d5cc' }
        };
    }

    // Set player name (updates storage key for per-player tokens)
    setPlayerName(name) {
        if (name) {
            this.storageKey = `clawlands_brine_tokens_${name}`;
            this.tokens = this.loadTokens();
        }
    }

    // Add tokens to player's wallet
    addTokens(amount) {
        if (amount <= 0) return false;
        this.tokens += amount;
        this.saveTokens();
        return true;
    }

    // Remove tokens from player's wallet
    removeTokens(amount) {
        if (amount <= 0 || amount > this.tokens) return false;
        this.tokens -= amount;
        this.saveTokens();
        return true;
    }

    // Get current token count
    getTokens() {
        return this.tokens;
    }

    // Get formatted display string
    getDisplayTokens() {
        return this.formatTokens(this.tokens);
    }

    // Check if player can afford something
    canAfford(amount) {
        return this.tokens >= amount;
    }

    // Format tokens for display (with denomination breakdown)
    formatTokens(amount) {
        if (amount < 5) return `${amount}`;
        
        // Break down into largest denominations for display
        const breakdown = [];
        let remaining = amount;
        
        // Pearl (50s)
        if (remaining >= 50) {
            const pearls = Math.floor(remaining / 50);
            breakdown.push(`${pearls}p`);
            remaining %= 50;
        }
        
        // Gold (20s) 
        if (remaining >= 20) {
            const gold = Math.floor(remaining / 20);
            breakdown.push(`${gold}g`);
            remaining %= 20;
        }
        
        // Silver (5s)
        if (remaining >= 5) {
            const silver = Math.floor(remaining / 5);
            breakdown.push(`${silver}s`);
            remaining %= 5;
        }
        
        // Copper (1s)
        if (remaining > 0) {
            breakdown.push(`${remaining}c`);
        }
        
        return breakdown.join(' ');
    }

    // Load tokens from localStorage
    loadTokens() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? Math.max(0, parseInt(saved, 10)) : 0;
        } catch (e) {
            console.warn('Failed to load tokens:', e);
            return 0;
        }
    }

    // Save tokens to localStorage
    saveTokens() {
        try {
            localStorage.setItem(this.storageKey, this.tokens.toString());
        } catch (e) {
            console.warn('Failed to save tokens:', e);
        }
    }

    // Reset tokens (for testing/admin)
    resetTokens() {
        this.tokens = 0;
        this.saveTokens();
    }

    // Set tokens directly (for testing/admin)
    setTokens(amount) {
        this.tokens = Math.max(0, amount);
        this.saveTokens();
    }
}