// Sound Effects & Ambient Audio for Clawlands
// All sounds synthesized via Web Audio API — no external files needed
// Covers: combat, interaction, UI, ambient (ocean, birds, wind)

class SoundEffects {
    constructor() {
        this.audioCtx = null;
        this.volume = 0.5;
        this.initialized = false;
        
        // Ambient state
        this._oceanRunning = false;
        this._oceanGain = null;
        this._windRunning = false;
        this._windGain = null;
        this._birdInterval = null;
        this._proximityInterval = null;
    }

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

    play(effectName) {
        if (!this.audioCtx) {
            this.init();
            if (!this.audioCtx) return;
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const gen = this.effects[effectName];
        if (gen) {
            gen.call(this);
        } else {
            console.warn(`🔊 Unknown sound: ${effectName}`);
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    createGain(vol) {
        const gain = this.audioCtx.createGain();
        gain.connect(this.audioCtx.destination);
        gain.gain.value = (vol !== undefined ? vol : 1) * this.volume;
        return gain;
    }

    // Helper: create noise buffer
    noiseBuffer(duration, shaper) {
        const sr = this.audioCtx.sampleRate;
        const len = sr * duration;
        const buf = this.audioCtx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = shaper ? shaper(i, len, sr) : (Math.random() * 2 - 1);
        }
        return buf;
    }

    // ========================================================
    //  EFFECT REGISTRY
    // ========================================================
    get effects() {
        return {
            // === COMBAT ===
            attack_swing:   this.attackSwing,
            enemy_hit:      this.enemyHit,
            enemy_death:    this.enemyDeath,
            player_hit:     this.playerHit,
            
            // Enemy-specific
            skitter_idle:   this.skitterIdle,
            haze_idle:      this.hazeIdle,
            loopling_idle:  this.looplingIdle,
            enemy_aggro:    this.enemyAggro,
            
            // === INTERACTION ===
            pickup:         this.itemPickup,
            npc_talk:       this.npcTalk,
            dialog_open:    this.dialogOpen,
            dialog_advance: this.dialogAdvance,
            chronicle_write:this.chronicleWrite,
            door_enter:     this.doorEnter,
            door_exit:      this.doorExit,
            quest_complete: this.questComplete,
            notification:   this.notification,
            bulletin_read:  this.bulletinRead,
            
            // === UI ===
            ui_click:       this.uiClick,
            ui_confirm:     this.uiConfirm,
            ui_back:        this.uiBack,
            menu_open:      this.menuOpen,
            menu_close:     this.menuClose,
            
            // === AMBIENT (one-shot) ===
            bird_chirp:     this.birdChirp,
            bird_call:      this.birdCall,
            insect_buzz:    this.insectBuzz,
        };
    }

    // ========================================================
    //  COMBAT SOUNDS
    // ========================================================

    // Attack swing — fast whoosh
    attackSwing() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.3);
        const buf = this.noiseBuffer(0.15, (i, len) => {
            const env = Math.sin(Math.PI * i / len);
            return (Math.random() * 2 - 1) * 0.3 * env;
        });
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(300, t);
        f.frequency.linearRampToValueAtTime(1400, t + 0.07);
        f.frequency.linearRampToValueAtTime(200, t + 0.15);
        f.Q.value = 2;
        src.connect(f); f.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        src.start(t); src.stop(t + 0.15);
    }

    // Enemy hit — crunchy thud
    enemyHit() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.45);
        // Low thud
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
        osc.connect(g);
        // Crunch noise
        const buf = this.noiseBuffer(0.08, (i, len) => (Math.random() * 2 - 1) * 0.4 * (1 - i / len));
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 900;
        src.connect(f); f.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
        src.start(t); src.stop(t + 0.08);
    }

    // Enemy death — dissolve burst
    enemyDeath() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.35);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.45);
        osc.connect(g);
        const buf = this.noiseBuffer(0.5, (i, len) => {
            const env = Math.pow(1 - i / len, 2);
            return (Math.random() * 2 - 1) * 0.2 * env;
        });
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2000, t);
        f.frequency.exponentialRampToValueAtTime(200, t + 0.45);
        src.connect(f); f.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.45);
        src.start(t); src.stop(t + 0.5);
    }

    // Player hit — sharp pain sting
    playerHit() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.5);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
        osc.connect(g);
        const buf = this.noiseBuffer(0.05, (i, len) => (Math.random() * 2 - 1) * 0.5 * (1 - i / len));
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf; src.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.12);
        src.start(t); src.stop(t + 0.05);
    }

    // === Enemy-specific ambient sounds ===

    // Skitter — rapid clicking/chittering (insect-like)
    skitterIdle() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.12);
        // Rapid clicks
        for (let i = 0; i < 5; i++) {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'square';
            const clickT = t + i * 0.04 + Math.random() * 0.01;
            osc.frequency.setValueAtTime(2000 + Math.random() * 1500, clickT);
            osc.connect(g);
            osc.start(clickT);
            osc.stop(clickT + 0.015);
        }
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    }

    // Haze Drifter — low eerie drone/hum
    hazeIdle() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.08);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90 + Math.random() * 30, t);
        osc.connect(g);
        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(93 + Math.random() * 30, t); // Slight detune for beating
        osc2.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(this.volume * 0.08, t + 0.3);
        g.gain.linearRampToValueAtTime(0, t + 0.8);
        osc.start(t); osc.stop(t + 0.8);
        osc2.start(t); osc2.stop(t + 0.8);
    }

    // Loopling — rhythmic pulsing beep (pattern creature)
    looplingIdle() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.1);
        const notes = [440, 554, 440, 660]; // Pattern loop
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'triangle';
            const nt = t + i * 0.12;
            osc.frequency.setValueAtTime(freq, nt);
            osc.connect(g);
            osc.start(nt);
            osc.stop(nt + 0.08);
        });
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    }

    // Enemy aggro — low warning growl/rumble (proximity warning)
    enemyAggro() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const buf = this.noiseBuffer(0.6, (i, len, sr) => {
            const env = i < len * 0.1 ? i / (len * 0.1) : 1 - (i - len * 0.1) / (len * 0.9);
            return (Math.random() * 2 - 1) * env * 0.3;
        });
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 200;
        src.connect(f); f.connect(g);
        // Rumbling bass tone underneath
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.setValueAtTime(50, t + 0.3);
        osc.frequency.setValueAtTime(60, t + 0.5);
        osc.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(this.volume * 0.2, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
        src.start(t); src.stop(t + 0.6);
    }

    // ========================================================
    //  INTERACTION SOUNDS
    // ========================================================

    // Item pickup — bright satisfying chime (two rising notes)
    itemPickup() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.35);
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        osc1.type = 'square'; osc2.type = 'square';
        osc1.frequency.setValueAtTime(659, t); // E5
        osc2.frequency.setValueAtTime(880, t + 0.06); // A5
        osc1.connect(g); osc2.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc1.start(t); osc1.stop(t + 0.08);
        osc2.start(t + 0.06); osc2.stop(t + 0.2);
    }

    // NPC talk — soft text blip (classic RPG dialog sound)
    npcTalk() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.15);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        // Slight random pitch for variety (like each "letter" is different)
        osc.frequency.setValueAtTime(380 + Math.random() * 120, t);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.04);
    }

    // Dialog open — soft pop
    dialogOpen() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.35);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(550, t + 0.06);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t); osc.stop(t + 0.1);
    }

    // Dialog advance — lighter click for page advance
    dialogAdvance() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, t);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.04);
    }

    // Chronicle Stone — scratchy carving sound
    chronicleWrite() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        // Multiple short scratches
        for (let i = 0; i < 6; i++) {
            const st = t + i * 0.08 + Math.random() * 0.02;
            const dur = 0.04 + Math.random() * 0.03;
            const buf = this.noiseBuffer(dur, (j, len) => {
                return (Math.random() * 2 - 1) * 0.3 * (1 - j / len);
            });
            const src = this.audioCtx.createBufferSource();
            src.buffer = buf;
            const f = this.audioCtx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = 1800 + Math.random() * 800;
            f.Q.value = 5;
            src.connect(f); f.connect(g);
            src.start(st); src.stop(st + dur);
        }
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    }

    // Door enter — whoosh transition
    doorEnter() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const buf = this.noiseBuffer(0.3, (i, len) => (Math.random() * 2 - 1) * 0.3);
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(400, t);
        src.connect(f); f.connect(g);
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(this.volume * 0.2, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        src.start(t); src.stop(t + 0.3);
    }

    // Door exit — reverse whoosh (higher pitch)
    doorExit() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const buf = this.noiseBuffer(0.25, (i, len) => (Math.random() * 2 - 1) * 0.25);
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(600, t);
        src.connect(f); f.connect(g);
        g.gain.setValueAtTime(this.volume * 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        src.start(t); src.stop(t + 0.25);
    }

    // Quest complete — triumphant ascending arpeggio
    questComplete() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.4);
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t + i * 0.08);
            osc.connect(g);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.12);
        });
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    }

    // Notification — subtle ping
    notification() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.25);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1318, t);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    }

    // Bulletin read — paper rustling
    bulletinRead() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const buf = this.noiseBuffer(0.2, (i, len) => (Math.random() * 2 - 1) * 0.15);
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const f = this.audioCtx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3;
        src.connect(f); f.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        src.start(t); src.stop(t + 0.2);
    }

    // ========================================================
    //  UI SOUNDS
    // ========================================================

    // UI click — tiny blip
    uiClick() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        osc.start(t); osc.stop(t + 0.03);
    }

    // UI confirm — two-note affirmative beep
    uiConfirm() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.3);
        const osc1 = this.audioCtx.createOscillator();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(523, t); // C5
        osc1.connect(g);
        osc1.start(t); osc1.stop(t + 0.06);
        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(784, t + 0.06); // G5
        osc2.connect(g);
        osc2.start(t + 0.06); osc2.stop(t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    }

    // UI back — descending tone
    uiBack() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t); osc.stop(t + 0.1);
    }

    // Menu open — soft rising chime
    menuOpen() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.25);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.1);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    }

    // Menu close — soft falling tone
    menuClose() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.2);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(700, t);
        osc.frequency.linearRampToValueAtTime(350, t + 0.1);
        osc.connect(g);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
    }

    // ========================================================
    //  AMBIENT ONE-SHOTS (called by ambient system)
    // ========================================================

    // Bird chirp — quick two-note trill
    birdChirp() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.1);
        const base = 1800 + Math.random() * 1200;
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.linearRampToValueAtTime(base * 1.3, t + 0.04);
        osc.frequency.linearRampToValueAtTime(base * 0.9, t + 0.08);
        osc.frequency.linearRampToValueAtTime(base * 1.15, t + 0.12);
        osc.frequency.linearRampToValueAtTime(base * 0.7, t + 0.18);
        osc.connect(g);
        g.gain.setValueAtTime(this.volume * 0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
    }

    // Bird call — longer melodic descending call (tropical)
    birdCall() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.08);
        const base = 2200 + Math.random() * 800;
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        // Descending tropical call: high → slide down → up → down
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.linearRampToValueAtTime(base * 0.7, t + 0.15);
        osc.frequency.linearRampToValueAtTime(base * 0.85, t + 0.25);
        osc.frequency.linearRampToValueAtTime(base * 0.5, t + 0.45);
        osc.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(this.volume * 0.08, t + 0.02);
        g.gain.setValueAtTime(this.volume * 0.06, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
    }

    // Insect buzz — very brief high-frequency trill
    insectBuzz() {
        const t = this.audioCtx.currentTime;
        const g = this.createGain(0.04);
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(3000 + Math.random() * 2000, t);
        osc.connect(g);
        // Very quiet, short
        const dur = 0.1 + Math.random() * 0.15;
        g.gain.setValueAtTime(this.volume * 0.04, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
    }

    // ========================================================
    //  AMBIENT SYSTEMS (continuous loops)
    // ========================================================

    // --- OCEAN ---
    startOceanAmbient() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this._oceanRunning) return;
        this._oceanRunning = true;

        const sr = this.audioCtx.sampleRate;
        const duration = 6; // seconds loop
        const len = sr * duration;
        const buf = this.audioCtx.createBuffer(2, len, sr);

        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            let last = 0;
            for (let i = 0; i < len; i++) {
                const t = i / sr;
                // Brown noise (random walk)
                last += (Math.random() * 2 - 1) * 0.035;
                last *= 0.998;
                // Slow wave envelope — surf rhythm
                const wave = 0.4 + 0.6 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 4.2 + ch * 0.8)), 1.5);
                // Occasional surf burst
                const surf = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 3.1 + ch * 1.5)), 4) * 0.5;
                data[i] = last * (wave + surf);
            }
        }

        this._oceanSource = this.audioCtx.createBufferSource();
        this._oceanSource.buffer = buf;
        this._oceanSource.loop = true;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;

        this._oceanGain = this.audioCtx.createGain();
        this._oceanGain.gain.value = 0;

        this._oceanSource.connect(filter);
        filter.connect(this._oceanGain);
        this._oceanGain.connect(this.audioCtx.destination);
        this._oceanSource.start();
        console.log('🌊 Ocean ambient started');
    }

    setOceanVolume(vol) {
        if (this._oceanGain) {
            const target = Math.max(0, Math.min(1, vol)) * this.volume * 0.5;
            this._oceanGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.5);
        }
    }

    stopOceanAmbient() {
        if (this._oceanSource) {
            try { this._oceanSource.stop(); } catch (e) {}
            this._oceanSource = null;
        }
        this._oceanRunning = false;
    }

    // --- WIND ---
    startWindAmbient() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this._windRunning) return;
        this._windRunning = true;

        const sr = this.audioCtx.sampleRate;
        const duration = 8;
        const len = sr * duration;
        const buf = this.audioCtx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);

        let last = 0;
        for (let i = 0; i < len; i++) {
            const t = i / sr;
            // Pink-ish noise for wind
            last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
            // Slow gusting envelope
            const gust = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 5.5)), 2);
            // Rustling effect (higher frequency modulation)
            const rustle = 1 + 0.2 * Math.sin(t * 40) * Math.sin(t * Math.PI * 2 / 2);
            data[i] = last * gust * rustle;
        }

        this._windSource = this.audioCtx.createBufferSource();
        this._windSource.buffer = buf;
        this._windSource.loop = true;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        this._windGain = this.audioCtx.createGain();
        this._windGain.gain.value = 0;

        this._windSource.connect(filter);
        filter.connect(this._windGain);
        this._windGain.connect(this.audioCtx.destination);
        this._windSource.start();
        console.log('🌬️ Wind ambient started');
    }

    setWindVolume(vol) {
        if (this._windGain) {
            const target = Math.max(0, Math.min(1, vol)) * this.volume * 0.15;
            this._windGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.8);
        }
    }

    stopWindAmbient() {
        if (this._windSource) {
            try { this._windSource.stop(); } catch (e) {}
            this._windSource = null;
        }
        this._windRunning = false;
    }

    // --- BIRDS & INSECTS ---
    startBirdAmbient() {
        if (this._birdInterval) return;

        const scheduleNext = () => {
            // Variable interval: 3-12 seconds between sounds
            const delay = 3000 + Math.random() * 9000;
            this._birdTimeout = setTimeout(() => {
                if (!this._birdInterval) return; // Stopped
                // Pick a random ambient sound
                const roll = Math.random();
                if (roll < 0.4) this.play('bird_chirp');
                else if (roll < 0.7) this.play('bird_call');
                else if (roll < 0.85) this.play('insect_buzz');
                // 15% chance of silence — natural gaps
                scheduleNext();
            }, delay);
        };

        this._birdInterval = true; // Flag
        scheduleNext();
        console.log('🐦 Bird/wildlife ambient started');
    }

    stopBirdAmbient() {
        this._birdInterval = false;
        if (this._birdTimeout) {
            clearTimeout(this._birdTimeout);
            this._birdTimeout = null;
        }
    }

    // --- ENEMY PROXIMITY ---
    // Plays enemy-specific sounds based on distance. Call from game update loop.
    updateEnemyProximity(enemies, playerX, playerY) {
        if (!this.audioCtx || !enemies || enemies.length === 0) return;

        // Throttle to ~2x per second
        const now = Date.now();
        if (this._lastProximityCheck && now - this._lastProximityCheck < 500) return;
        this._lastProximityCheck = now;

        let closestDist = Infinity;
        let closestType = null;

        for (const enemy of enemies) {
            if (!enemy.isAlive || !enemy.isAlive()) continue;
            const dx = enemy.position.x - playerX;
            const dy = enemy.position.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < closestDist) {
                closestDist = dist;
                closestType = enemy.typeData?.aiType || enemy.aiType || 'skitter';
            }
        }

        // Play proximity sound if enemy is within warning range (80-150px)
        // but not too close (already in combat range, other sounds play)
        if (closestDist < 150 && closestDist > 40) {
            // Only play occasionally — don't spam
            if (!this._lastProximitySound || now - this._lastProximitySound > 3000) {
                this._lastProximitySound = now;

                if (closestDist < 80) {
                    // Close — play aggro warning
                    this.play('enemy_aggro');
                } else {
                    // Medium range — play type-specific ambient
                    const soundMap = {
                        'skitter': 'skitter_idle',
                        'haze': 'haze_idle',
                        'loop': 'loopling_idle'
                    };
                    const sound = soundMap[closestType] || 'enemy_aggro';
                    this.play(sound);
                }
            }
        }
    }

    // Stop all ambient sounds
    stopAllAmbient() {
        this.stopOceanAmbient();
        this.stopWindAmbient();
        this.stopBirdAmbient();
    }
}
