// Character customization data persistence
// Stores and loads character configurations and position
class CustomizationData {
    constructor() {
        this.storageKey = 'lobster_rpg_character';
        this.positionKey = 'lobster_rpg_position';
    }

    save(config) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(config));
            console.log('💾 Character config saved');
        } catch (e) {
            console.error('Failed to save character config:', e);
        }
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load character config:', e);
        }
        return null;
    }

    savePosition(x, y) {
        try {
            localStorage.setItem(this.positionKey, JSON.stringify({ x, y, timestamp: Date.now() }));
        } catch (e) {
            console.error('Failed to save position:', e);
        }
    }

    loadPosition() {
        try {
            const data = localStorage.getItem(this.positionKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load position:', e);
        }
        return null;
    }

    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.positionKey);
        } catch (e) {
            console.error('Failed to clear character config:', e);
        }
    }
}
