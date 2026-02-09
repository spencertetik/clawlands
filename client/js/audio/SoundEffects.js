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
}