// CurrencySystem.js - Manages Tokens in Clawlands
// Simple single-currency system

class CurrencySystem {
    constructor() {
        this.storageKey = 'clawlands_brine_tokens';
        this.tokens = this.loadTokens();
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

    // Get formatted display string (just the number)
    getDisplayTokens() {
        return this.tokens.toString();
    }

    // Check if player can afford something
    canAfford(amount) {
        return this.tokens >= amount;
    }

    // Format tokens for display (just the number)
    formatTokens(amount) {
        return amount.toString();
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