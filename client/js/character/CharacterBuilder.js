// Character customization builder
// Creates UI for customizing character appearance
class CharacterBuilder {
    constructor() {
        this.config = {
            species: 'lobster', // Default species
            bodyColor: '#ff4520', // Default lobster orange-red
            shellColor: '#d02010', // Default darker red
            clawColor: '#c03020',  // Default claw red
            accessories: []
        };

        // Available character species (from CONSTANTS or fallback)
        this.availableSpecies = CONSTANTS.SPECIES_CATALOG || [
            { id: 'lobster', name: 'Lobster', emoji: '🦞', description: 'Classic crustacean with big claws' },
            { id: 'crab', name: 'Crab', emoji: '🦀', description: 'Sideways walker with a round shell' },
            { id: 'shrimp', name: 'Shrimp', emoji: '🦐', description: 'Small but mighty swimmer' },
            { id: 'mantis_shrimp', name: 'Mantis Shrimp', emoji: '🌈', description: 'Colorful powerhouse with incredible vision' },
            { id: 'hermit_crab', name: 'Hermit Crab', emoji: '🐚', description: 'Cozy shell-dweller' }
        ];

        this.availableColors = [
            { name: 'Red', body: '#ff4520', shell: '#d02010', claw: '#c03020' },
            { name: 'Blue', body: '#4080ff', shell: '#2050d0', claw: '#3070e0' },
            { name: 'Orange', body: '#ff8040', shell: '#e06020', claw: '#f07030' },
            { name: 'Purple', body: '#b040ff', shell: '#8020d0', claw: '#9030e0' },
            { name: 'Green', body: '#40ff80', shell: '#20d050', claw: '#30e070' },
            { name: 'Pink', body: '#ff80c0', shell: '#e060a0', claw: '#f070b0' },
            { name: 'Yellow', body: '#ffd040', shell: '#e0b020', claw: '#f0c030' },
            { name: 'White', body: '#f0f0f0', shell: '#c0c0c0', claw: '#d0d0d0' }
        ];

        this.availableAccessories = [
            ...(CONSTANTS.ACCESSORY_CATALOG || [])
        ];
    }

    /**
     * Set character species
     * @param {string} speciesId - Species ID to set
     */
    setSpecies(speciesId) {
        const species = this.availableSpecies.find(s => s.id === speciesId);
        if (species) {
            this.config.species = speciesId;
        }
    }

    /**
     * Get current species
     */
    getSpecies() {
        return this.availableSpecies.find(s => s.id === this.config.species);
    }

    /**
     * Get current customization config
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Set color preset
     * @param {number} index - Index in availableColors
     */
    setColorPreset(index) {
        if (index >= 0 && index < this.availableColors.length) {
            const preset = this.availableColors[index];
            this.config.bodyColor = preset.body;
            this.config.shellColor = preset.shell;
            this.config.clawColor = preset.claw;
        }
    }

    /**
     * Set custom body color
     * @param {string} color - Hex color
     */
    setBodyColor(color) {
        this.config.bodyColor = color;
    }

    /**
     * Set custom shell color
     * @param {string} color - Hex color
     */
    setShellColor(color) {
        this.config.shellColor = color;
    }

    /**
     * Set custom claw color
     * @param {string} color - Hex color
     */
    setClawColor(color) {
        this.config.clawColor = color;
    }

    /**
     * Toggle accessory
     * @param {string} accessoryId - Accessory ID to toggle
     */
    toggleAccessory(accessoryId) {
        const index = this.config.accessories.indexOf(accessoryId);
        if (index >= 0) {
            this.config.accessories.splice(index, 1);
        } else {
            this.config.accessories.push(accessoryId);
        }
    }

    /**
     * Generate a random character configuration
     */
    randomize() {
        // Random species
        const randomSpecies = Math.floor(Math.random() * this.availableSpecies.length);
        this.setSpecies(this.availableSpecies[randomSpecies].id);

        // Random color
        const randomPreset = Math.floor(Math.random() * this.availableColors.length);
        this.setColorPreset(randomPreset);

        // Randomly add accessories (when available)
        this.config.accessories = [];
        for (let accessory of this.availableAccessories) {
            if (Math.random() < 0.3) { // 30% chance for each accessory
                this.config.accessories.push(accessory.id);
            }
        }

        return this.getConfig();
    }

    /**
     * Create a simple HTML UI for character customization
     * @param {Function} onUpdate - Callback when config changes
     * @returns {HTMLElement} UI container
     */
    createUI(onUpdate) {
        const container = document.createElement('div');
        container.className = 'character-builder';
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border: 4px solid #fff;
            padding: 20px;
            color: #fff;
            font-family: monospace;
            z-index: 1000;
            max-width: 400px;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Customize Your Lobster';
        title.style.marginTop = '0';
        container.appendChild(title);

        // Color presets
        const presetsLabel = document.createElement('div');
        presetsLabel.textContent = 'Color Presets:';
        presetsLabel.style.marginBottom = '10px';
        container.appendChild(presetsLabel);

        const presetsContainer = document.createElement('div');
        presetsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 20px;';

        this.availableColors.forEach((preset, index) => {
            const button = document.createElement('button');
            button.textContent = preset.name;
            button.style.cssText = `
                padding: 8px;
                background: ${preset.body};
                border: 2px solid #fff;
                color: #fff;
                cursor: pointer;
                font-family: monospace;
                text-shadow: 1px 1px 0 #000;
            `;
            button.onclick = () => {
                this.setColorPreset(index);
                onUpdate(this.getConfig());
            };
            presetsContainer.appendChild(button);
        });
        container.appendChild(presetsContainer);

        // Random button
        const randomButton = document.createElement('button');
        randomButton.textContent = '🎲 Randomize';
        randomButton.style.cssText = `
            padding: 10px;
            background: #8040ff;
            border: 2px solid #fff;
            color: #fff;
            cursor: pointer;
            font-family: monospace;
            width: 100%;
            margin-bottom: 20px;
            font-size: 14px;
        `;
        randomButton.onclick = () => {
            this.randomize();
            onUpdate(this.getConfig());
        };
        container.appendChild(randomButton);

        // Accessories
        if (this.availableAccessories.length > 0) {
            const accessoryLabel = document.createElement('div');
            accessoryLabel.textContent = 'Accessories:';
            accessoryLabel.style.marginBottom = '10px';
            container.appendChild(accessoryLabel);

            const accessoryContainer = document.createElement('div');
            accessoryContainer.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 20px;';

            this.availableAccessories.forEach((accessory) => {
                const button = document.createElement('button');
                button.textContent = accessory.name;
                button.style.cssText = `
                    padding: 8px;
                    background: #1f2937;
                    border: 2px solid #fff;
                    color: #fff;
                    cursor: pointer;
                    font-family: monospace;
                    text-shadow: 1px 1px 0 #000;
                `;
                button.onclick = () => {
                    this.toggleAccessory(accessory.id);
                    const active = this.config.accessories.includes(accessory.id);
                    button.style.borderColor = active ? '#fbbf24' : '#fff';
                    onUpdate(this.getConfig());
                };
                accessoryContainer.appendChild(button);
            });

            container.appendChild(accessoryContainer);
        }

        // Done button
        const doneButton = document.createElement('button');
        doneButton.textContent = '✓ Done';
        doneButton.style.cssText = `
            padding: 10px;
            background: #40ff80;
            border: 2px solid #fff;
            color: #000;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
            width: 100%;
            font-size: 16px;
        `;
        doneButton.onclick = () => {
            container.remove();
        };
        container.appendChild(doneButton);

        return container;
    }

    /**
     * Show character builder UI
     * @param {Function} onUpdate - Callback when config changes
     * @param {Function} onComplete - Callback when done
     */
    show(onUpdate, onComplete) {
        const ui = this.createUI((config) => {
            if (onUpdate) onUpdate(config);
        });

        // Add to document
        document.body.appendChild(ui);

        // Add done callback
        const doneButton = ui.querySelector('button:last-child');
        const originalOnClick = doneButton.onclick;
        doneButton.onclick = () => {
            originalOnClick();
            if (onComplete) onComplete(this.getConfig());
        };

        return ui;
    }
}
