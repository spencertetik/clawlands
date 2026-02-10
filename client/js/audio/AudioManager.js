// Audio Manager for Clawlands
// Handles music playback, crossfading, and location-based switching

class AudioManager {
    constructor() {
        this.tracks = {};
        this.currentTrack = null;
        this.currentAudio = null;
        this.volume = 0.08; // Music volume — background atmosphere, sits under everything
        this.fadeDuration = 1000; // ms
        this.muted = false;
        this.preloaded = false;
        this.pendingPlay = null; // Track to play once preloaded
        
        // Track mappings
        this.trackList = {
            title: 'Signal From The Dead Cartridge',
            loading: 'Lobster Island Loading Screen',
            overworld: 'Harbor Steps',
            inn: 'Safe Point Tavern',
            shop: 'Clockwork Glitch Parade',
            house: 'Forgotten Shells in Claw World',
            lighthouse: 'Signal From The Dead Cartridge',
            transition: 'Glitch Between Worlds',
            // Zone-specific overworld tracks
            zone_central: 'Harbor Steps',
            zone_north: 'Signal From The Dead Cartridge',
            zone_south: 'Forgotten Shells in Claw World',
            zone_east: 'Clockwork Glitch Parade',
            // Default fallback for unknown buildings
            default: 'Harbor Steps'
        };
        
        // Music zones (world coordinates) - 3200x3200 world divided into regions
        // Format: { x, y, width, height, track }
        this.musicZones = [
            // Northern mysterious region (top third)
            { x: 0, y: 0, width: 3200, height: 1000, track: 'zone_north', name: 'Northern Reaches' },
            // Eastern quirky region (right side, middle)
            { x: 2160, y: 1000, width: 1040, height: 1200, track: 'zone_east', name: 'Eastern Shores' },
            // Southern relaxed beaches (bottom third)
            { x: 0, y: 2200, width: 3200, height: 1000, track: 'zone_south', name: 'Southern Sands' },
            // Central/default - Harbor Steps (middle area)
            { x: 0, y: 1000, width: 2160, height: 1200, track: 'zone_central', name: 'Harbor District' }
        ];
        
        this.currentZone = null;
        
        this.basePath = 'assets/audio/music/';
    }

    /**
     * Preload all music tracks
     */
    async preload() {
        const promises = Object.values(this.trackList).map(name => this.loadTrack(name));
        await Promise.all(promises);
        this.preloaded = true;
        console.log('🎵 Audio Manager: All tracks preloaded');
        
        // If there was a pending play request, execute it now
        if (this.pendingPlay) {
            console.log(`🎵 Playing pending track: ${this.pendingPlay}`);
            this.play(this.pendingPlay, true, this.pendingStartOffset || 0);
            this.pendingPlay = null;
            this.pendingStartOffset = 0;
        }
    }

    /**
     * Load a single track
     */
    async loadTrack(name) {
        if (this.tracks[name]) return this.tracks[name];
        
        const audio = new Audio();
        audio.src = `${this.basePath}${name}.mp3`;
        audio.loop = true;
        audio.volume = 0;
        
        return new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => {
                this.tracks[name] = audio;
                console.log(`🎵 Loaded: ${name}`);
                resolve(audio);
            }, { once: true });
            
            audio.addEventListener('error', (e) => {
                console.warn(`⚠️ Failed to load: ${name}`, e);
                resolve(null); // Don't reject, just continue
            }, { once: true });
            
            audio.load();
        });
    }

    /**
     * Play a track by key (title, overworld, inn, etc.)
     * @param {string} key - Track key
     * @param {boolean} crossfade - Whether to crossfade from current track
     * @param {number} startOffset - Seconds to skip at the beginning (default 0)
     */
    play(key, crossfade = true, startOffset = 0) {
        const trackName = this.trackList[key] || this.trackList.default;
        
        // If not preloaded yet, queue this request
        if (!this.preloaded) {
            console.log(`🎵 Queuing ${key} - waiting for preload`);
            this.pendingPlay = key;
            this.pendingStartOffset = startOffset;
            return;
        }
        
        this.playTrack(trackName, crossfade, startOffset);
    }

    /**
     * Play a track by name with optional crossfade
     * @param {number} startOffset - Seconds to skip at the beginning (default 0)
     */
    playTrack(name, crossfade = true, startOffset = 0) {
        if (this.muted) return;
        if (this.currentTrack === name) return; // Already playing
        
        const newAudio = this.tracks[name];
        if (!newAudio) {
            console.warn(`🎵 Track not loaded: ${name}`);
            return;
        }

        // Skip ahead if startOffset specified (e.g. trim slow fade-in)
        if (startOffset > 0) {
            newAudio.currentTime = startOffset;
        }

        if (crossfade && this.currentAudio) {
            this.crossfade(this.currentAudio, newAudio);
        } else {
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
            }
            newAudio.volume = this.volume;
            newAudio.play().catch(e => console.warn('Autoplay blocked:', e));
        }

        this.currentTrack = name;
        this.currentAudio = newAudio;
    }

    /**
     * Crossfade between two tracks
     */
    crossfade(fromAudio, toAudio) {
        const steps = 20;
        const stepTime = this.fadeDuration / steps;
        const volumeStep = this.volume / steps;
        let step = 0;

        toAudio.volume = 0;
        toAudio.play().catch(e => console.warn('Autoplay blocked:', e));

        const fade = setInterval(() => {
            step++;
            
            // Fade out old track
            if (fromAudio) {
                fromAudio.volume = Math.max(0, this.volume - (volumeStep * step));
            }
            
            // Fade in new track
            toAudio.volume = Math.min(this.volume, volumeStep * step);

            if (step >= steps) {
                clearInterval(fade);
                if (fromAudio) {
                    fromAudio.pause();
                    fromAudio.currentTime = 0;
                }
            }
        }, stepTime);
    }

    /**
     * Fade out current track
     */
    fadeOut(duration = this.fadeDuration) {
        if (!this.currentAudio) return;
        
        const audio = this.currentAudio;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = audio.volume / steps;
        let step = 0;

        const fade = setInterval(() => {
            step++;
            audio.volume = Math.max(0, audio.volume - volumeStep);

            if (step >= steps) {
                clearInterval(fade);
                audio.pause();
                audio.currentTime = 0;
                this.currentTrack = null;
                this.currentAudio = null;
            }
        }, stepTime);
    }

    /**
     * Stop all audio immediately
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        this.currentTrack = null;
        this.currentAudio = null;
    }

    /**
     * Set master volume (0-1)
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.currentAudio) {
            this.currentAudio.pause();
        } else if (!this.muted && this.currentAudio) {
            this.currentAudio.play().catch(() => {});
        }
        return this.muted;
    }

    /**
     * Play music for a specific building type
     */
    playForBuilding(buildingType) {
        const key = this.trackList[buildingType] ? buildingType : 'default';
        this.play(key);
    }

    /**
     * Play overworld music (uses default zone)
     */
    playOverworld() {
        this.play('zone_central');
    }
    
    /**
     * Check player position and update music zone if needed
     * Call this periodically from the game update loop
     */
    updateZone(playerX, playerY) {
        if (this.muted) return;
        
        // Find which zone the player is in
        let newZone = null;
        for (const zone of this.musicZones) {
            if (playerX >= zone.x && playerX < zone.x + zone.width &&
                playerY >= zone.y && playerY < zone.y + zone.height) {
                newZone = zone;
                break;
            }
        }
        
        // If no zone found, use central
        if (!newZone) {
            newZone = this.musicZones.find(z => z.track === 'zone_central') || this.musicZones[0];
        }
        
        // Only change if we're in a different zone
        if (newZone && newZone !== this.currentZone) {
            const oldZoneName = this.currentZone?.name || 'none';
            this.currentZone = newZone;
            console.log(`🎵 Entering ${newZone.name} (from ${oldZoneName})`);
            this.play(newZone.track);
        }
    }
    
    /**
     * Get current zone name (for UI display if wanted)
     */
    getCurrentZoneName() {
        return this.currentZone?.name || 'Unknown';
    }

    /**
     * Play title screen music (skips first 3s — original track fades in too slowly)
     */
    playTitle() {
        this.play('title', true, 3);
    }
}

// Global instance
const audioManager = new AudioManager();
