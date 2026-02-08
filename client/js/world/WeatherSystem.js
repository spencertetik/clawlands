// WeatherSystem.js - Dynamic weather effects (rain, storms, fog)
// Adds atmosphere and variety to the world

class WeatherSystem {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        // Current weather state
        this.currentWeather = 'clear';
        this.targetWeather = 'clear';
        this.transitionProgress = 1.0;
        this.transitionSpeed = 0.3; // How fast weather changes
        
        // Weather probabilities (checked every weatherCheckInterval)
        this.weatherCheckInterval = 60; // seconds
        this.weatherTimer = 30; // Start partway through
        this.weatherProbabilities = {
            clear: 0.6,     // 60% chance of clear
            light_rain: 0.2, // 20% chance of light rain
            rain: 0.1,      // 10% chance of rain
            storm: 0.05,    // 5% chance of storm
            fog: 0.05       // 5% chance of fog
        };
        
        // Weather duration (seconds)
        this.weatherDuration = {
            clear: [120, 300],      // 2-5 minutes
            light_rain: [60, 180],  // 1-3 minutes
            rain: [60, 120],        // 1-2 minutes
            storm: [30, 90],        // 0.5-1.5 minutes
            fog: [60, 180]          // 1-3 minutes
        };
        this.currentDuration = 0;
        this.durationTimer = 0;
        
        // Particle systems
        this.raindrops = [];
        this.maxRaindrops = 200;
        this.lightningFlash = 0;
        this.lightningTimer = 0;
        
        // Fog overlay
        this.fogDensity = 0;
        this.fogOffset = 0;
        
        // Colors
        this.rainColor = 'rgba(180, 200, 220, 0.6)';
        this.stormRainColor = 'rgba(150, 170, 200, 0.8)';
        this.fogColor = 'rgba(200, 210, 220, 0.3)';
        
        this.initRaindrops();
    }
    
    initRaindrops() {
        for (let i = 0; i < this.maxRaindrops; i++) {
            this.raindrops.push(this.createRaindrop());
        }
    }
    
    createRaindrop() {
        return {
            x: Math.random() * this.worldWidth,
            y: Math.random() * -100,
            speed: 200 + Math.random() * 150,
            length: 4 + Math.random() * 6,
            wind: (Math.random() - 0.3) * 30
        };
    }
    
    // Set weather manually (for events/story)
    setWeather(weather, duration = null) {
        this.targetWeather = weather;
        this.transitionProgress = 0;
        
        if (duration) {
            this.currentDuration = duration;
        } else {
            const range = this.weatherDuration[weather] || [60, 120];
            this.currentDuration = range[0] + Math.random() * (range[1] - range[0]);
        }
        this.durationTimer = 0;
        
        console.log(`🌤️ Weather changing to: ${weather} (${Math.round(this.currentDuration)}s)`);
    }
    
    // Pick random weather based on probabilities
    pickRandomWeather() {
        const roll = Math.random();
        let cumulative = 0;
        
        for (const [weather, prob] of Object.entries(this.weatherProbabilities)) {
            cumulative += prob;
            if (roll < cumulative) {
                return weather;
            }
        }
        
        return 'clear';
    }
    
    // Check if it's raining
    isRaining() {
        return ['light_rain', 'rain', 'storm'].includes(this.currentWeather);
    }
    
    // Get rain intensity (0-1)
    getRainIntensity() {
        const intensities = {
            clear: 0,
            light_rain: 0.3,
            rain: 0.7,
            storm: 1.0,
            fog: 0
        };
        return intensities[this.currentWeather] || 0;
    }
    
    // Update weather system
    update(deltaTime) {
        // Weather duration timer
        this.durationTimer += deltaTime;
        if (this.durationTimer >= this.currentDuration) {
            // Time to potentially change weather
            this.weatherTimer = 0;
            const newWeather = this.pickRandomWeather();
            if (newWeather !== this.currentWeather) {
                this.setWeather(newWeather);
            } else {
                // Same weather, reset duration
                const range = this.weatherDuration[this.currentWeather] || [60, 120];
                this.currentDuration = range[0] + Math.random() * (range[1] - range[0]);
                this.durationTimer = 0;
            }
        }
        
        // Weather transition
        if (this.transitionProgress < 1.0) {
            this.transitionProgress += deltaTime * this.transitionSpeed;
            if (this.transitionProgress >= 1.0) {
                this.transitionProgress = 1.0;
                this.currentWeather = this.targetWeather;
            }
        }
        
        // Update rain
        if (this.isRaining()) {
            this.updateRain(deltaTime);
        }
        
        // Update lightning (storms only)
        if (this.currentWeather === 'storm') {
            this.updateLightning(deltaTime);
        } else {
            this.lightningFlash = Math.max(0, this.lightningFlash - deltaTime * 5);
        }
        
        // Update fog
        if (this.currentWeather === 'fog') {
            this.fogDensity = Math.min(1, this.fogDensity + deltaTime * 0.5);
            this.fogOffset += deltaTime * 10;
        } else {
            this.fogDensity = Math.max(0, this.fogDensity - deltaTime * 0.5);
        }
    }
    
    updateRain(deltaTime) {
        const intensity = this.getRainIntensity();
        const activeDrops = Math.floor(this.maxRaindrops * intensity);
        
        for (let i = 0; i < activeDrops; i++) {
            const drop = this.raindrops[i];
            
            drop.y += drop.speed * deltaTime;
            drop.x += drop.wind * deltaTime;
            
            // Reset if off screen
            if (drop.y > this.worldHeight + 50) {
                drop.y = -10 - Math.random() * 50;
                drop.x = Math.random() * this.worldWidth;
            }
            if (drop.x < -50) drop.x = this.worldWidth + 50;
            if (drop.x > this.worldWidth + 50) drop.x = -50;
        }
    }
    
    updateLightning(deltaTime) {
        this.lightningTimer -= deltaTime;
        
        if (this.lightningTimer <= 0) {
            // Random lightning strike
            if (Math.random() < 0.02) { // 2% chance per frame during storm
                this.lightningFlash = 1.0;
                this.lightningTimer = 3 + Math.random() * 5; // 3-8 seconds between strikes
            }
        }
        
        // Fade lightning
        this.lightningFlash = Math.max(0, this.lightningFlash - deltaTime * 3);
    }
    
    // Render weather effects
    render(renderer, camera) {
        // Render rain
        if (this.isRaining()) {
            this.renderRain(renderer, camera);
        }
        
        // Render lightning flash
        if (this.lightningFlash > 0) {
            this.renderLightning(renderer, camera);
        }
        
        // Render fog
        if (this.fogDensity > 0) {
            this.renderFog(renderer, camera);
        }
    }
    
    renderRain(renderer, camera) {
        const intensity = this.getRainIntensity();
        const activeDrops = Math.floor(this.maxRaindrops * intensity);
        const color = this.currentWeather === 'storm' ? this.stormRainColor : this.rainColor;
        
        for (let i = 0; i < activeDrops; i++) {
            const drop = this.raindrops[i];
            
            // Only render if in view
            if (drop.x >= camera.x - 50 && drop.x <= camera.x + camera.width + 50 &&
                drop.y >= camera.y - 50 && drop.y <= camera.y + camera.height + 50) {
                
                renderer.drawRect(
                    drop.x,
                    drop.y,
                    1,
                    drop.length,
                    color,
                    CONSTANTS.LAYER.UI
                );
            }
        }
    }
    
    renderLightning(renderer, camera) {
        const alpha = this.lightningFlash * 0.3;
        renderer.drawRect(
            camera.x,
            camera.y,
            camera.width,
            camera.height,
            `rgba(255, 255, 255, ${alpha})`,
            CONSTANTS.LAYER.UI
        );
    }
    
    renderFog(renderer, camera) {
        // Render fog patches
        const alpha = this.fogDensity * 0.15;
        const patchSize = 80;
        const cols = Math.ceil(camera.width / patchSize) + 2;
        const rows = Math.ceil(camera.height / patchSize) + 2;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = camera.x + c * patchSize + Math.sin(this.fogOffset + r * 0.5) * 20;
                const y = camera.y + r * patchSize + Math.cos(this.fogOffset + c * 0.3) * 15;
                const sizeVar = 0.8 + Math.sin(this.fogOffset * 0.5 + c + r) * 0.2;
                
                renderer.drawRect(
                    x,
                    y,
                    patchSize * sizeVar,
                    patchSize * sizeVar * 0.6,
                    `rgba(200, 210, 220, ${alpha * (0.5 + sizeVar * 0.5)})`,
                    CONSTANTS.LAYER.ENTITIES
                );
            }
        }
    }
    
    // Get weather for display
    getWeatherName() {
        const names = {
            clear: 'Clear',
            light_rain: 'Light Rain',
            rain: 'Rain',
            storm: 'Storm',
            fog: 'Fog'
        };
        return names[this.currentWeather] || 'Unknown';
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherSystem;
}
