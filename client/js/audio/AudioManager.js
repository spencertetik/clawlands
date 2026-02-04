// Audio Manager for Claw World
// Handles music playback, crossfading, and location-based switching

class AudioManager {
    constructor() {
        this.tracks = {};
        this.currentTrack = null;
        this.currentAudio = null;
        this.volume = 0.5;
        this.fadeDuration = 1000; // ms
        this.muted = false;
        
        // Track mappings
        this.trackList = {
            title: 'Welcome to Lobster Isle',
            loading: 'Lobster Island Loading Screen',
            overworld: 'Harbor Steps',
            inn: 'Safe Point Tavern',
            shop: 'Clockwork Glitch Parade',
            house: 'Forgotten Shells in Claw World',
            lighthouse: 'Signal From The Dead Cartridge',
            transition: 'Glitch Between Worlds',
            // Default fallback for unknown buildings
            default: 'Harbor Steps'
        };
        
        this.basePath = 'assets/audio/music/';
    }

    /**
     * Preload all music tracks
     */
    async preload() {
        const promises = Object.values(this.trackList).map(name => this.loadTrack(name));
        await Promise.all(promises);
        console.log('🎵 Audio Manager: All tracks preloaded');
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
     */
    play(key, crossfade = true) {
        const trackName = this.trackList[key] || this.trackList.default;
        this.playTrack(trackName, crossfade);
    }

    /**
     * Play a track by name with optional crossfade
     */
    playTrack(name, crossfade = true) {
        if (this.muted) return;
        if (this.currentTrack === name) return; // Already playing
        
        const newAudio = this.tracks[name];
        if (!newAudio) {
            console.warn(`🎵 Track not loaded: ${name}`);
            return;
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
     * Play overworld music
     */
    playOverworld() {
        this.play('overworld');
    }

    /**
     * Play title screen music
     */
    playTitle() {
        this.play('title');
    }
}

// Global instance
const audioManager = new AudioManager();
