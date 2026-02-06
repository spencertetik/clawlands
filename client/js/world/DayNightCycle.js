// DayNightCycle.js - Visual day/night cycle with screen tinting
// Creates atmosphere and makes the world feel more alive

class DayNightCycle {
    constructor() {
        // Time settings (1 real minute = 1 in-game hour by default)
        this.timeScale = 1; // How fast time passes (1 = 1 real minute per game hour)
        this.currentHour = 12; // Start at noon
        this.currentMinute = 0;
        
        // Use real time for persistence across sessions
        this.useRealTime = true;
        
        // Tint colors for different times of day
        this.tints = {
            // Night (0:00 - 5:00)
            night: { r: 20, g: 30, b: 60, a: 0.35 },
            // Dawn (5:00 - 7:00)
            dawn: { r: 255, g: 180, b: 120, a: 0.15 },
            // Morning (7:00 - 10:00)
            morning: { r: 255, g: 250, b: 220, a: 0.05 },
            // Day (10:00 - 17:00)
            day: { r: 0, g: 0, b: 0, a: 0 },
            // Evening (17:00 - 19:00)
            evening: { r: 255, g: 150, b: 80, a: 0.12 },
            // Dusk (19:00 - 21:00)
            dusk: { r: 180, g: 100, b: 150, a: 0.2 },
            // Night again (21:00 - 24:00)
            lateNight: { r: 30, g: 30, b: 70, a: 0.3 }
        };
        
        // Current interpolated tint
        this.currentTint = { r: 0, g: 0, b: 0, a: 0 };
        
        // Canvas overlay for tinting
        this.overlay = null;
        this.overlayCtx = null;
        
        this.init();
    }
    
    init() {
        // Create overlay canvas
        this.overlay = document.createElement('canvas');
        this.overlay.id = 'day-night-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
            mix-blend-mode: multiply;
        `;
        this.overlayCtx = this.overlay.getContext('2d');
        
        // Sync with real time if enabled
        if (this.useRealTime) {
            this.syncWithRealTime();
        }
    }
    
    // Attach overlay to game container
    attachTo(container) {
        if (container && !container.contains(this.overlay)) {
            container.style.position = 'relative';
            container.appendChild(this.overlay);
            this.resize(container.clientWidth, container.clientHeight);
        }
    }
    
    // Resize overlay to match game
    resize(width, height) {
        if (this.overlay) {
            this.overlay.width = width;
            this.overlay.height = height;
        }
    }
    
    // Sync game time with real time
    syncWithRealTime() {
        const now = new Date();
        this.currentHour = now.getHours();
        this.currentMinute = now.getMinutes();
    }
    
    // Get time period based on current hour
    getTimePeriod() {
        const h = this.currentHour;
        if (h >= 0 && h < 5) return 'night';
        if (h >= 5 && h < 7) return 'dawn';
        if (h >= 7 && h < 10) return 'morning';
        if (h >= 10 && h < 17) return 'day';
        if (h >= 17 && h < 19) return 'evening';
        if (h >= 19 && h < 21) return 'dusk';
        return 'lateNight';
    }
    
    // Get transition progress within current period (0-1)
    getTransitionProgress() {
        const h = this.currentHour;
        const m = this.currentMinute;
        const totalMinutes = h * 60 + m;
        
        // Define period boundaries in minutes
        const periods = [
            { start: 0, end: 300, from: 'night', to: 'night' },       // 0:00-5:00
            { start: 300, end: 420, from: 'night', to: 'dawn' },      // 5:00-7:00
            { start: 420, end: 600, from: 'dawn', to: 'morning' },    // 7:00-10:00
            { start: 600, end: 1020, from: 'morning', to: 'day' },    // 10:00-17:00
            { start: 1020, end: 1140, from: 'day', to: 'evening' },   // 17:00-19:00
            { start: 1140, end: 1260, from: 'evening', to: 'dusk' },  // 19:00-21:00
            { start: 1260, end: 1440, from: 'dusk', to: 'night' }     // 21:00-24:00
        ];
        
        for (const period of periods) {
            if (totalMinutes >= period.start && totalMinutes < period.end) {
                const progress = (totalMinutes - period.start) / (period.end - period.start);
                return {
                    from: period.from,
                    to: period.to,
                    progress: progress
                };
            }
        }
        
        return { from: 'day', to: 'day', progress: 0 };
    }
    
    // Interpolate between two colors
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    // Update the day/night cycle
    update(deltaTime) {
        // Update time
        if (!this.useRealTime) {
            this.currentMinute += deltaTime * this.timeScale;
            while (this.currentMinute >= 60) {
                this.currentMinute -= 60;
                this.currentHour = (this.currentHour + 1) % 24;
            }
        } else {
            // Sync with real time periodically
            this.syncWithRealTime();
        }
        
        // Calculate current tint by interpolating
        const transition = this.getTransitionProgress();
        const fromTint = this.tints[transition.from] || this.tints.day;
        const toTint = this.tints[transition.to] || this.tints.day;
        const t = transition.progress;
        
        this.currentTint = {
            r: Math.round(this.lerp(fromTint.r, toTint.r, t)),
            g: Math.round(this.lerp(fromTint.g, toTint.g, t)),
            b: Math.round(this.lerp(fromTint.b, toTint.b, t)),
            a: this.lerp(fromTint.a, toTint.a, t)
        };
    }
    
    // Render the tint overlay
    render() {
        if (!this.overlayCtx || this.currentTint.a <= 0) {
            // Clear if no tint needed
            if (this.overlayCtx) {
                this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
            }
            return;
        }
        
        const ctx = this.overlayCtx;
        const { r, g, b, a } = this.currentTint;
        
        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.fillRect(0, 0, this.overlay.width, this.overlay.height);
    }
    
    // Get formatted time string
    getTimeString() {
        const h = this.currentHour.toString().padStart(2, '0');
        const m = Math.floor(this.currentMinute).toString().padStart(2, '0');
        return `${h}:${m}`;
    }
    
    // Get time period name for display
    getTimePeriodName() {
        const period = this.getTimePeriod();
        const names = {
            night: 'Night',
            dawn: 'Dawn',
            morning: 'Morning',
            day: 'Day',
            evening: 'Evening',
            dusk: 'Dusk',
            lateNight: 'Night'
        };
        return names[period] || 'Day';
    }
    
    // Set whether to use real time or game time
    setUseRealTime(useReal) {
        this.useRealTime = useReal;
        if (useReal) {
            this.syncWithRealTime();
        }
    }
    
    // Set time scale (for game time mode)
    setTimeScale(scale) {
        this.timeScale = Math.max(0.1, Math.min(60, scale));
    }
    
    // Set specific time (for testing/cinematics)
    setTime(hour, minute = 0) {
        this.currentHour = hour % 24;
        this.currentMinute = minute % 60;
        this.useRealTime = false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayNightCycle;
}
