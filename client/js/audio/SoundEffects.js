// Sound Effects for Clawlands
// Generates short retro sound effects using Web Audio API

class SoundEffects {
    constructor() {
        this.audioCtx = null;
        this.volume = 0.5; // SFX volume (boosted above music)
        this.initialized = false;
    }

    // Initialize AudioContext on first user interaction (Chrome autoplay policy)
    init() {
        if (this.audioCtx) return;
        
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('🔊 Sound Effects initialized');
        } catch (e) {
            console.warn('🔊 Sound Effects initialization failed:', e);
        }
    }

    // Play a named sound effect
    play(effectName) {
        if (!this.audioCtx) {
            this.init(); // Lazy init
            if (!this.audioCtx) return;
        }

        // Resume context if suspended (autoplay policy)
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const generator = this.getEffectGenerator(effectName);
        if (generator) {
            generator();
        }
    }

    // Set master volume (0-1)
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    // Get the sound generator function for a given effect name
    getEffectGenerator(effectName) {
        switch (effectName) {
            case 'pickup': return () => this.generatePickup();
            case 'door_enter': return () => this.generateDoorEnter();
            case 'door_exit': return () => this.generateDoorExit();
            case 'dialog_open': return () => this.generateDialogOpen();
            case 'dialog_advance': return () => this.generateDialogAdvance();
            case 'quest_complete': return () => this.generateQuestComplete();
            case 'notification': return () => this.generateNotification();
            case 'bulletin_read': return () => this.generateBulletinRead();
            // Combat sounds
            case 'enemy_hit': return () => this.generateEnemyHit();
            case 'enemy_death': return () => this.generateEnemyDeath();
            case 'player_hit': return () => this.generatePlayerHit();
            case 'attack_swing': return () => this.generateAttackSwing();
            // Ambient birds (single chirp burst)
            case 'bird_chirp': return () => this.generateBirdChirp();
            default:
                console.warn(`🔊 Unknown sound effect: ${effectName}`);
                return null;
        }
    }

    // Create a basic gain node for volume control
    createGain() {
        const gain = this.audioCtx.createGain();
        gain.connect(this.audioCtx.destination);
        gain.gain.value = this.volume;
        return gain;
    }

    // Pickup sound - Short bright chime (rising two-note beep)
    generatePickup() {
        const gain = this.createGain();
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        
        osc1.type = 'square';
        osc2.type = 'square';
        
        osc1.frequency.setValueAtTime(659, this.audioCtx.currentTime); // E5
        osc2.frequency.setValueAtTime(830, this.audioCtx.currentTime); // G#5
        
        osc1.connect(gain);
        osc2.connect(gain);
        
        // Quick fade out
        gain.gain.setValueAtTime(this.volume * 0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.audioCtx.currentTime + 0.2);
        osc2.stop(this.audioCtx.currentTime + 0.2);
    }

    // Door enter - Soft whoosh/transition sound (noise burst with fade)
    generateDoorEnter() {
        const gain = this.createGain();
        const bufferSize = this.audioCtx.sampleRate * 0.3; // 300ms
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate filtered noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        
        const source = this.audioCtx.createBufferSource();
        const filter = this.audioCtx.createBiquadFilter();
        
        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        
        source.connect(filter);
        filter.connect(gain);
        
        // Fade in and out
        gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(this.volume * 0.2, this.audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
        
        source.start();
        source.stop(this.audioCtx.currentTime + 0.3);
    }

    // Door exit - Reverse of enter (slightly different pitch)
    generateDoorExit() {
        const gain = this.createGain();
        const bufferSize = this.audioCtx.sampleRate * 0.25; // 250ms
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate filtered noise (slightly higher frequency)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.25;
        }
        
        const source = this.audioCtx.createBufferSource();
        const filter = this.audioCtx.createBiquadFilter();
        
        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, this.audioCtx.currentTime); // Higher than enter
        
        source.connect(filter);
        filter.connect(gain);
        
        // Quick fade out
        gain.gain.setValueAtTime(this.volume * 0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);
        
        source.start();
        source.stop(this.audioCtx.currentTime + 0.25);
    }

    // Dialog open - Soft pop/click (short blip)
    generateDialogOpen() {
        const gain = this.createGain();
        const osc = this.audioCtx.createOscillator();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.audioCtx.currentTime + 0.05);
        
        osc.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.4, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.08);
    }

    // Dialog advance - Lighter click for advancing dialog pages
    generateDialogAdvance() {
        const gain = this.createGain();
        const osc = this.audioCtx.createOscillator();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
        
        osc.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }

    // Quest complete - Triumphant short fanfare (ascending 3-note arpeggio)
    generateQuestComplete() {
        const gain = this.createGain();
        
        // Three note ascending arpeggio: C5, E5, G5
        const notes = [523, 659, 784];
        const noteLength = 0.12;
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.08);
            osc.connect(gain);
            
            osc.start(this.audioCtx.currentTime + i * 0.08);
            osc.stop(this.audioCtx.currentTime + i * 0.08 + noteLength);
        });
        
        gain.gain.setValueAtTime(this.volume * 0.4, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
    }

    // Notification - Subtle ping (single clean tone)
    generateNotification() {
        const gain = this.createGain();
        const osc = this.audioCtx.createOscillator();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1318, this.audioCtx.currentTime); // E6
        
        osc.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
    }

    // Bulletin read - Paper rustling (short filtered noise)
    generateBulletinRead() {
        const gain = this.createGain();
        const bufferSize = this.audioCtx.sampleRate * 0.2; // 200ms
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate paper-like noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        
        const source = this.audioCtx.createBufferSource();
        const filter = this.audioCtx.createBiquadFilter();
        
        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
        filter.Q.setValueAtTime(3, this.audioCtx.currentTime);
        
        source.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
        
        source.start();
        source.stop(this.audioCtx.currentTime + 0.2);
    }

    // ============ COMBAT SOUNDS ============

    // Enemy hit - Crunchy impact (noise burst + low thud)
    generateEnemyHit() {
        const t = this.audioCtx.currentTime;
        const gain = this.createGain();
        
        // Low thud
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
        osc.connect(gain);
        
        // Noise crunch
        const bufferSize = this.audioCtx.sampleRate * 0.08;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.4 * (1 - i / bufferSize);
        }
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;
        noiseSource.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        
        osc.start(t);
        osc.stop(t + 0.12);
        noiseSource.start(t);
        noiseSource.stop(t + 0.08);
    }

    // Enemy death - Dissolving burst (descending noise + tone)
    generateEnemyDeath() {
        const t = this.audioCtx.currentTime;
        const gain = this.createGain();
        
        // Descending tone
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.4);
        osc.connect(gain);
        
        // Dissolve noise
        const bufferSize = this.audioCtx.sampleRate * 0.5;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const env = Math.pow(1 - i / bufferSize, 2);
            data[i] = (Math.random() * 2 - 1) * 0.2 * env;
        }
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.4);
        noiseSource.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        
        osc.start(t);
        osc.stop(t + 0.45);
        noiseSource.start(t);
        noiseSource.stop(t + 0.5);
    }

    // Player hit - Short sharp pain sting
    generatePlayerHit() {
        const t = this.audioCtx.currentTime;
        const gain = this.createGain();
        
        // Sharp descending sting
        const osc = this.audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        osc.connect(gain);
        
        // Noise impact
        const bufferSize = this.audioCtx.sampleRate * 0.05;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5 * (1 - i / bufferSize);
        }
        const src = this.audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        osc.start(t);
        osc.stop(t + 0.12);
        src.start(t);
        src.stop(t + 0.05);
    }

    // Attack swing - Quick whoosh
    generateAttackSwing() {
        const t = this.audioCtx.currentTime;
        const gain = this.createGain();
        
        // Filtered noise swoosh
        const bufferSize = this.audioCtx.sampleRate * 0.15;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const env = Math.sin(Math.PI * i / bufferSize); // Bell envelope
            data[i] = (Math.random() * 2 - 1) * 0.3 * env;
        }
        const src = this.audioCtx.createBufferSource();
        src.buffer = buffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.linearRampToValueAtTime(1200, t + 0.08);
        filter.frequency.linearRampToValueAtTime(200, t + 0.15);
        filter.Q.value = 2;
        src.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        src.start(t);
        src.stop(t + 0.15);
    }

    // Bird chirp - Quick two-note trill
    generateBirdChirp() {
        const t = this.audioCtx.currentTime;
        const gain = this.createGain();
        
        // Random bird pitch variation
        const basePitch = 1800 + Math.random() * 1200;
        
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        // Quick up-down chirp pattern
        osc.frequency.setValueAtTime(basePitch, t);
        osc.frequency.linearRampToValueAtTime(basePitch * 1.3, t + 0.04);
        osc.frequency.linearRampToValueAtTime(basePitch * 0.9, t + 0.08);
        osc.frequency.linearRampToValueAtTime(basePitch * 1.2, t + 0.12);
        osc.frequency.linearRampToValueAtTime(basePitch * 0.7, t + 0.18);
        osc.connect(gain);
        
        gain.gain.setValueAtTime(this.volume * 0.12, t);
        gain.gain.setValueAtTime(this.volume * 0.08, t + 0.06);
        gain.gain.setValueAtTime(this.volume * 0.1, t + 0.10);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // ============ AMBIENT SYSTEM ============
    // Continuous background loops for ocean and environment

    // Start ambient ocean loop
    startOceanAmbient() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this._oceanRunning) return;
        this._oceanRunning = true;
        
        // Create a looping ocean buffer (brown noise + gentle modulation)
        const duration = 4; // seconds
        const sampleRate = this.audioCtx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(2, bufferSize, sampleRate); // Stereo
        
        // Generate wave-like noise (brown noise with LFO-like volume shaping)
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            let lastSample = 0;
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                // Brown noise (random walk)
                lastSample += (Math.random() * 2 - 1) * 0.04;
                lastSample *= 0.998; // Decay
                
                // Wave-like volume envelope (slow sine modulation)
                const waveEnv = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 3.5 + ch * 0.5);
                
                // Surf-like bursts
                const surf = Math.max(0, Math.sin(t * Math.PI * 2 / 2.8 + ch * 1.2)) ** 3;
                
                data[i] = lastSample * (0.3 + waveEnv * 0.4 + surf * 0.3);
            }
        }
        
        this._oceanSource = this.audioCtx.createBufferSource();
        this._oceanSource.buffer = buffer;
        this._oceanSource.loop = true;
        
        // Low-pass filter for deep ocean feel
        this._oceanFilter = this.audioCtx.createBiquadFilter();
        this._oceanFilter.type = 'lowpass';
        this._oceanFilter.frequency.value = 400;
        
        this._oceanGain = this.audioCtx.createGain();
        this._oceanGain.gain.value = 0; // Start silent, will be controlled externally
        
        this._oceanSource.connect(this._oceanFilter);
        this._oceanFilter.connect(this._oceanGain);
        this._oceanGain.connect(this.audioCtx.destination);
        
        this._oceanSource.start();
        console.log('🌊 Ocean ambient started');
    }

    // Set ocean volume (0-1) — call from game based on distance to water
    setOceanVolume(vol) {
        if (this._oceanGain) {
            const target = Math.max(0, Math.min(1, vol)) * this.volume * 0.4;
            this._oceanGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.3);
        }
    }

    // Stop ocean ambient
    stopOceanAmbient() {
        if (this._oceanSource) {
            try { this._oceanSource.stop(); } catch (e) {}
            this._oceanSource = null;
        }
        this._oceanRunning = false;
    }

    // Start random bird chirps (timer-based)
    startBirdAmbient() {
        if (this._birdInterval) return;
        this._birdInterval = setInterval(() => {
            // Random chance each interval — sparser, more natural
            if (Math.random() < 0.3) {
                this.play('bird_chirp');
            }
        }, 4000 + Math.random() * 6000); // Every 4-10 seconds
        console.log('🐦 Bird ambient started');
    }

    // Stop bird ambient
    stopBirdAmbient() {
        if (this._birdInterval) {
            clearInterval(this._birdInterval);
            this._birdInterval = null;
        }
    }
}