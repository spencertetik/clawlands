// LightingSystem - Time-based atmospheric lighting overlays
class LightingSystem {
    constructor() {
        // Time cycle: 1 full day = 20 minutes real time (1200 seconds)
        this.dayDuration = 20 * 60 * 1000; // 20 minutes in milliseconds
        this.timeOffset = 0; // For manual time adjustment
        this.isInterior = false;
        
        // Time periods and their colors (RGBA with alpha for overlay strength)
        this.timeData = {
            // Dawn: 5-7 AM (warm orange)
            dawn: {
                start: 5/24,
                end: 7/24,
                color: { r: 255, g: 180, b: 100, a: 0.08 },
                name: 'Dawn'
            },
            // Day: 7 AM - 6 PM (no tint)
            day: {
                start: 7/24,
                end: 18/24,
                color: { r: 255, g: 255, b: 255, a: 0 }, // No overlay
                name: 'Day'
            },
            // Dusk: 6-8 PM (warm purple-red)
            dusk: {
                start: 18/24,
                end: 20/24,
                color: { r: 180, g: 100, b: 150, a: 0.1 },
                name: 'Dusk'
            },
            // Night: 8 PM - 5 AM (blue)
            night: {
                start: 20/24,
                end: 1.0, // Wraps to next day
                color: { r: 30, g: 40, b: 80, a: 0.2 },
                name: 'Night'
            },
            // Night continues: 12 AM - 5 AM
            lateNight: {
                start: 0,
                end: 5/24,
                color: { r: 30, g: 40, b: 80, a: 0.2 },
                name: 'Night'
            }
        };
        
        // Interior lighting (warm amber)
        this.interiorLighting = {
            color: { r: 255, g: 200, b: 120, a: 0.15 },
            name: 'Interior'
        };
        
        // Cache current lighting state
        this.currentLighting = this.timeData.day;
        this.lastUpdateTime = Date.now();
        
        console.log('🌅 Lighting system initialized');
    }
    
    // Update lighting based on real time
    update(deltaTime) {
        // Get current time (0.0 to 1.0 representing 24 hours)
        const now = Date.now() + this.timeOffset;
        const timeOfDay = ((now % this.dayDuration) / this.dayDuration);
        
        // Find current time period
        this.currentLighting = this.getTimeData(timeOfDay);
        
        // Debug: Log time changes occasionally
        if (Date.now() - this.lastUpdateTime > 30000) { // Every 30 seconds
            this.lastUpdateTime = Date.now();
            const hours = Math.floor(timeOfDay * 24);
            const minutes = Math.floor((timeOfDay * 24 * 60) % 60);
            console.log(`🕐 Game time: ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')} (${this.currentLighting.name})`);
        }
    }
    
    // Get time data for a given time of day (0.0 to 1.0)
    getTimeData(timeOfDay) {
        // Check each time period
        for (const [key, period] of Object.entries(this.timeData)) {
            if (key === 'lateNight') continue; // Special case for night wrap-around
            
            // Handle night wrap-around (night goes from 20/24 to 1.0, then lateNight from 0 to 5/24)
            if (key === 'night') {
                if (timeOfDay >= period.start || timeOfDay <= 5/24) {
                    return timeOfDay >= period.start ? period : this.timeData.lateNight;
                }
            } else if (timeOfDay >= period.start && timeOfDay < period.end) {
                return period;
            }
        }
        
        // Default to day
        return this.timeData.day;
    }
    
    // Render lighting overlay AFTER all other rendering
    render(canvas) {
        const ctx = canvas.getContext('2d');
        
        // Use interior lighting when inside buildings
        const lighting = this.isInterior ? this.interiorLighting : this.currentLighting;
        
        // Skip overlay if no tint needed (day time outdoors)
        if (lighting.color.a === 0) return;
        
        // Full-screen color overlay
        ctx.save();
        ctx.fillStyle = `rgba(${lighting.color.r}, ${lighting.color.g}, ${lighting.color.b}, ${lighting.color.a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    
    // Set interior mode (warm amber lighting)
    setInterior(isInterior) {
        this.isInterior = isInterior;
        
        if (isInterior) {
            console.log('🏠 Switched to interior lighting');
        } else {
            console.log(`🌅 Switched to outdoor lighting (${this.currentLighting.name})`);
        }
    }
    
    // Get current time info for debugging/display
    getCurrentTimeInfo() {
        const now = Date.now() + this.timeOffset;
        const timeOfDay = ((now % this.dayDuration) / this.dayDuration);
        const hours = Math.floor(timeOfDay * 24);
        const minutes = Math.floor((timeOfDay * 24 * 60) % 60);
        
        return {
            timeOfDay: timeOfDay,
            hours: hours,
            minutes: minutes,
            period: this.currentLighting.name,
            isInterior: this.isInterior
        };
    }
    
    // Manually adjust time (for testing)
    setTimeOffset(offsetMinutes) {
        this.timeOffset = offsetMinutes * 60 * 1000; // Convert minutes to milliseconds
        console.log(`🕐 Time offset set to ${offsetMinutes} minutes`);
    }
    
    // Skip to specific time period (for testing)
    skipToTime(periodName) {
        const periods = {
            dawn: 6/24,
            day: 12/24, 
            dusk: 19/24,
            night: 22/24
        };
        
        if (periods[periodName] !== undefined) {
            const targetTime = periods[periodName] * this.dayDuration;
            this.timeOffset = targetTime - (Date.now() % this.dayDuration);
            console.log(`🕐 Skipped to ${periodName}`);
        }
    }
}