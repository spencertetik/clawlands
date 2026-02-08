// Welcome screen for character creation with live preview
// Theme: Lobster Red + Retro Terminal (matching home.css)
class WelcomeScreen {
    constructor() {
        this.container = null;
        this.onComplete = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.loadedSprites = {};
        this.renderVersion = 0;
        this.currentConfig = {
            species: 'lobster',
            hueShift: 0 // 0 = red (default), degrees to shift
        };
    }

    /**
     * Add CSS animations for red terminal theme
     */
    addTerminalAnimations() {
        if (document.getElementById('claw-world-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'claw-world-animations';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-6px); }
            }
            
            @keyframes particle-rise {
                0% { 
                    transform: translateY(0) translateX(0);
                    opacity: 0.4;
                }
                100% { 
                    transform: translateY(-100%) translateX(10px);
                    opacity: 0;
                }
            }
            
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            @keyframes blink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }
            
            @keyframes glow-pulse {
                0%, 100% { box-shadow: 0 0 20px rgba(196, 58, 36, 0.3); }
                50% { box-shadow: 0 0 30px rgba(196, 58, 36, 0.5); }
            }
            
            .terminal-particle {
                position: absolute;
                border-radius: 50%;
                background: rgba(196, 58, 36, 0.4);
                animation: particle-rise 8s linear infinite;
                pointer-events: none;
            }
            
            .blink-cursor {
                animation: blink 1s infinite;
            }
            
            .corner-bracket::before {
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                width: 10px;
                height: 10px;
                border-top: 2px solid #c43a24;
                border-left: 2px solid #c43a24;
            }
            
            .corner-bracket::after {
                content: '';
                position: absolute;
                bottom: -1px;
                right: -1px;
                width: 10px;
                height: 10px;
                border-bottom: 2px solid #c43a24;
                border-right: 2px solid #c43a24;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get the root container for overlays (frame screen overlay if available).
     */
    getRoot() {
        return document.getElementById('screen-overlay') || document.body;
    }

    /**
     * Ensure overlay wrapper exists for scaling inside the frame screen.
     */
    ensureOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.style.cssText = `
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                pointer-events: auto;
            `;
            this.getRoot().appendChild(this.overlay);
            
            if (!this._resizeHandler) {
                this._resizeHandler = () => this.fitToScreen();
                window.addEventListener('resize', this._resizeHandler);
            }
        }
        return this.overlay;
    }

    /**
     * Fit current container into screen overlay using uniform scaling.
     */
    fitToScreen() {
        if (!this.container) return;
        // During frame zoom animation, don't recalculate — content scales with the frame
        if (this._zoomInProgress) return;
        const root = this.getRoot();
        const bounds = root.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        this.container.style.transform = 'none';
        this.container.style.transformOrigin = 'center center';

        const rect = this.container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const padding = 8;
        const availW = bounds.width - padding * 2;
        const availH = bounds.height - padding * 2;

        const scale = Math.min(availW / rect.width, availH / rect.height);
        this.container.style.transform = `scale(${scale})`;
    }

    /**
     * Clear any pending title sequence timers.
     */
    clearSequenceTimers() {
        if (!this.sequenceTimers) return;
        this.sequenceTimers.forEach((timer) => clearTimeout(timer));
        this.sequenceTimers = [];
    }

    setOverlayBackdrop(color) {
        const root = this.getRoot();
        if (root) {
            root.style.background = color || 'transparent';
        }
    }

    setGameVisibility(isVisible) {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.visibility = isVisible ? 'visible' : 'hidden';
        }
    }

    /**
     * Create floating particles (red theme)
     */
    createParticles(container) {
        const particleContainer = document.createElement('div');
        particleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            pointer-events: none;
        `;
        
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'terminal-particle';
            const size = 2 + Math.random() * 4;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.bottom = `0`;
            particle.style.animationDuration = `${6 + Math.random() * 8}s`;
            particle.style.animationDelay = `${Math.random() * 5}s`;
            particleContainer.appendChild(particle);
        }
        
        container.appendChild(particleContainer);
    }

    /**
     * Show the welcome screen
     */
    show(onComplete) {
        this.onComplete = onComplete;
        this.addTerminalAnimations();

        // Preload audio early but don't play yet — music starts on user click
        if (typeof audioManager !== 'undefined') {
            audioManager.preload();
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('quickStart') === 'true') {
            this.quickStartGame();
        } else if (params.get('botMode') === 'true' || params.get('mode') === 'agent') {
            this.showAgentWaiting();
        } else {
            this.showModeSelection();
        }
    }

    /**
     * Quick start - skip all menus and go straight to game
     */
    quickStartGame() {
        let savedData = localStorage.getItem('clawworld_character');
        let character;
        
        if (savedData) {
            character = JSON.parse(savedData);
        } else {
            character = {
                species: 'lobster',
                color: 'red',
                name: 'Player'
            };
            localStorage.setItem('clawworld_character', JSON.stringify(character));
        }
        
        this.setGameVisibility(true);
        if (this.onComplete) {
            this.onComplete({ 
                config: { species: character.species, color: character.color },
                name: character.name 
            });
        }
    }

    /**
     * Mode selection screen - Red terminal theme
     */
    showModeSelection() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0d0806');
        this.setGameVisibility(false);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 320px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #e8d5cc;
            font-family: 'Courier New', monospace;
            text-align: center;
            background: rgba(13, 8, 6, 0.95);
            border: 1px solid rgba(196, 58, 36, 0.3);
            box-shadow: 
                0 0 40px rgba(196, 58, 36, 0.15),
                inset 0 0 60px rgba(0, 0, 0, 0.5);
            padding: 28px 24px;
            flex-shrink: 0;
        `;

        // Corner brackets
        const cornerTL = document.createElement('div');
        cornerTL.style.cssText = `position: absolute; top: -1px; left: -1px; width: 12px; height: 12px; border-top: 2px solid #c43a24; border-left: 2px solid #c43a24;`;
        this.container.appendChild(cornerTL);
        
        const cornerBR = document.createElement('div');
        cornerBR.style.cssText = `position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-bottom: 2px solid #c43a24; border-right: 2px solid #c43a24;`;
        this.container.appendChild(cornerBR);

        this.createParticles(this.container);

        // Title
        const title = document.createElement('div');
        title.textContent = 'CLAWWORLD';
        title.style.cssText = `
            font-size: 32px;
            font-weight: bold;
            color: #c43a24;
            text-shadow: 0 0 30px rgba(196, 58, 36, 0.5), 0 2px 0 #7a1a0e;
            letter-spacing: 4px;
            margin-bottom: 6px;
        `;
        this.container.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('div');
        subtitle.innerHTML = '<span style="color:#c43a24;margin-right:6px;">></span>SELECT MODE';
        subtitle.style.cssText = `
            font-size: 11px;
            font-weight: bold;
            color: #a08878;
            margin-bottom: 24px;
            letter-spacing: 3px;
            text-transform: uppercase;
        `;
        this.container.appendChild(subtitle);

        // Buttons container
        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
        `;

        // Terminal button style helper
        const createTerminalBtn = (emoji, label, isPrimary) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<span style="margin-right:10px">${emoji}</span>${label}`;
            btn.style.cssText = `
                width: 100%;
                padding: 14px 20px;
                font-size: 14px;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                background: ${isPrimary ? '#c43a24' : 'transparent'};
                color: ${isPrimary ? '#fff' : '#c43a24'};
                border: 1px solid ${isPrimary ? '#c43a24' : 'rgba(196, 58, 36, 0.4)'};
                cursor: pointer;
                transition: all 0.2s;
                letter-spacing: 2px;
                text-transform: uppercase;
                position: relative;
            `;
            btn.onmouseenter = () => {
                btn.style.background = isPrimary ? '#d94a32' : 'rgba(196, 58, 36, 0.1)';
                btn.style.borderColor = '#c43a24';
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 20px rgba(196, 58, 36, 0.3)';
            };
            btn.onmouseleave = () => {
                btn.style.background = isPrimary ? '#c43a24' : 'transparent';
                btn.style.borderColor = isPrimary ? '#c43a24' : 'rgba(196, 58, 36, 0.4)';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            };
            return btn;
        };

        // Human Player button
        const humanBtn = createTerminalBtn('>', 'PLAY', true);
        humanBtn.onclick = () => this.showStoryIntro();
        buttons.appendChild(humanBtn);

        // AI Agent button
        const agentBtn = createTerminalBtn('>', 'AI AGENT', false);
        agentBtn.onclick = () => this.showAgentWaiting();
        buttons.appendChild(agentBtn);

        this.container.appendChild(buttons);

        // Small hint
        const hint = document.createElement('div');
        hint.innerHTML = `<span style="color:#a08878;font-size:10px;font-weight:bold;margin-top:20px;display:block;">Humans & AI agents play together</span>`;
        this.container.appendChild(hint);

        // Creator credit
        const credit = document.createElement('div');
        credit.innerHTML = `<span style="color:#8a7068;font-size:9px;margin-top:12px;display:block;letter-spacing:1px;">Created by Spencer Tetik & Frank</span>`;
        this.container.appendChild(credit);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => this.fitToScreen());

        // Eye-opening iris reveal (only on first visit)
        if (!this._revealDone) {
            this._revealDone = true;
            this._doIrisReveal();
        }
    }

    /**
     * Cinematic iris/eye-opening reveal: two black halves slide apart
     * while music fades in.
     */
    _doIrisReveal() {
        // Top and bottom black lids with feathered/soft edges
        const topLid = document.createElement('div');
        const bottomLid = document.createElement('div');
        const shared = `
            position: fixed; left: 0; width: 100%;
            z-index: 99999; pointer-events: none;
            transition: transform 2s cubic-bezier(0.25, 0.1, 0.25, 1);
        `;
        // Top lid: solid black with a soft gradient feather on the bottom edge
        topLid.style.cssText = shared + `
            top: 0; height: 55%;
            background: linear-gradient(to bottom, #000 85%, transparent 100%);
            transform: translateY(0);
        `;
        // Bottom lid: solid black with a soft gradient feather on the top edge
        bottomLid.style.cssText = shared + `
            bottom: 0; height: 55%;
            background: linear-gradient(to top, #000 85%, transparent 100%);
            transform: translateY(0);
        `;
        document.body.appendChild(topLid);
        document.body.appendChild(bottomLid);

        // Fade-up the scene content from dark using a full-screen overlay
        // (we avoid setting transition on #frame-scene so the zoom transform still works)
        const fadeScreen = document.createElement('div');
        fadeScreen.style.cssText = `
            position: fixed; inset: 0; background: #000;
            z-index: 99998; pointer-events: none;
            opacity: 1; transition: opacity 2.2s ease;
        `;
        document.body.appendChild(fadeScreen);

        // Open the lids + fade in content (music starts later on user click)
        setTimeout(() => {
            requestAnimationFrame(() => {
                topLid.style.transform = 'translateY(-100%)';
                bottomLid.style.transform = 'translateY(100%)';
                // Fade out the black overlay to reveal the scene
                fadeScreen.style.opacity = '0';
            });

            // Remove lids and overlay after animation
            setTimeout(() => {
                topLid.remove();
                bottomLid.remove();
                fadeScreen.remove();
            }, 2500);
        }, 400);
    }

    /**
     * AI Agent waiting screen - Red terminal theme
     */
    showAgentWaiting() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0d0806');
        this.setGameVisibility(false);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #e8d5cc;
            font-family: 'Courier New', monospace;
            text-align: center;
            background: rgba(13, 8, 6, 0.95);
            border: 1px solid rgba(196, 58, 36, 0.3);
            box-shadow: 0 0 40px rgba(196, 58, 36, 0.15);
            padding: 24px 20px;
            flex-shrink: 0;
        `;

        // Corner brackets
        const cornerTL = document.createElement('div');
        cornerTL.style.cssText = `position: absolute; top: -1px; left: -1px; width: 10px; height: 10px; border-top: 2px solid #c43a24; border-left: 2px solid #c43a24;`;
        this.container.appendChild(cornerTL);
        
        const cornerBR = document.createElement('div');
        cornerBR.style.cssText = `position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-bottom: 2px solid #c43a24; border-right: 2px solid #c43a24;`;
        this.container.appendChild(cornerBR);

        // Icon
        const icon = document.createElement('div');
        icon.textContent = '[AI]';
        icon.style.cssText = `
            font-size: 36px;
            margin-bottom: 12px;
            filter: drop-shadow(0 0 10px rgba(196, 58, 36, 0.4));
        `;
        this.container.appendChild(icon);

        // Title
        const title = document.createElement('div');
        title.textContent = 'AI AGENT MODE';
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #c43a24;
            text-shadow: 0 0 20px rgba(196, 58, 36, 0.4);
            letter-spacing: 3px;
            margin-bottom: 16px;
        `;
        this.container.appendChild(title);

        // Status with blinking cursor
        const status = document.createElement('div');
        status.innerHTML = 'Awaiting connection<span class="blink-cursor" style="color:#c43a24;">_</span>';
        status.style.cssText = `
            font-size: 11px;
            color: #8a7068;
            margin-bottom: 16px;
        `;
        this.container.appendChild(status);

        // Connection info box
        const info = document.createElement('div');
        const wsUrl = window.CONFIG?.BOT_SERVER_URL || 'ws://localhost:3001';
        info.style.cssText = `
            background: rgba(0, 0, 0, 0.4);
            padding: 12px 14px;
            border: 1px solid rgba(196, 58, 36, 0.2);
            width: 100%;
            box-sizing: border-box;
            position: relative;
        `;
        // Corner decoration
        const infoBracket = document.createElement('div');
        infoBracket.style.cssText = `position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 1px solid rgba(196, 58, 36, 0.5); border-left: 1px solid rgba(196, 58, 36, 0.5);`;
        info.appendChild(infoBracket);
        
        info.innerHTML += `
            <div style="color:#8a7068;font-size:9px;margin-bottom:4px;letter-spacing:2px;">CONNECT TO:</div>
            <div style="color:#c43a24;font-size:11px;word-break:break-all;">${wsUrl}</div>
        `;
        this.container.appendChild(info);

        // Guide link
        const guideLink = document.createElement('a');
        guideLink.href = 'bot-guide.html';
        guideLink.target = '_blank';
        guideLink.textContent = '📖 Connection Guide';
        guideLink.style.cssText = `
            display: block;
            margin-top: 16px;
            font-size: 11px;
            color: #8a7068;
            text-decoration: none;
            transition: color 0.2s;
        `;
        guideLink.onmouseenter = () => guideLink.style.color = '#c43a24';
        guideLink.onmouseleave = () => guideLink.style.color = '#8a7068';
        this.container.appendChild(guideLink);

        // Back button
        const backBtn = document.createElement('button');
        backBtn.textContent = '← BACK';
        backBtn.style.cssText = `
            margin-top: 12px;
            padding: 8px 16px;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            background: transparent;
            color: #8a7068;
            border: 1px solid rgba(196, 58, 36, 0.3);
            cursor: pointer;
            transition: all 0.2s;
            letter-spacing: 1px;
        `;
        backBtn.onmouseenter = () => {
            backBtn.style.background = 'rgba(196, 58, 36, 0.1)';
            backBtn.style.color = '#e8d5cc';
            backBtn.style.borderColor = '#c43a24';
        };
        backBtn.onmouseleave = () => {
            backBtn.style.background = 'transparent';
            backBtn.style.color = '#8a7068';
            backBtn.style.borderColor = 'rgba(196, 58, 36, 0.3)';
        };
        backBtn.onclick = () => this.showModeSelection();
        this.container.appendChild(backBtn);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => this.fitToScreen());

        if (window.game) {
            window.game.enableBotMode();
        }
    }

    /**
     * Story introduction screen - Red terminal boot sequence
     */
    showStoryIntro() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        // Start music on user click (browsers require user gesture for autoplay).
        // Use a polling approach so we catch the audio even if preload finishes late.
        if (typeof audioManager !== 'undefined') {
            audioManager.playTitle();
            const targetVol = audioManager.volume;
            let fadeStarted = false;
            const tryFade = () => {
                if (fadeStarted) return;
                if (!audioManager.currentAudio) {
                    // Audio not ready yet — keep polling
                    setTimeout(tryFade, 100);
                    return;
                }
                fadeStarted = true;
                audioManager.currentAudio.volume = 0;
                let step = 0;
                const steps = 40;
                const interval = setInterval(() => {
                    step++;
                    if (audioManager.currentAudio) {
                        audioManager.currentAudio.volume = Math.min(targetVol, targetVol * (step / steps));
                    }
                    if (step >= steps) clearInterval(interval);
                }, 80);
            };
            tryFade();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0d0806');
        this.setGameVisibility(false);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 640px;
            height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            color: #e8d5cc;
            font-family: 'Courier New', monospace;
            text-align: center;
            overflow: hidden;
            pointer-events: auto;
            flex-shrink: 0;
        `;

        const screen = document.createElement('div');
        screen.style.cssText = `
            position: absolute;
            inset: 0;
            background: #0d0806;
            border: 1px solid rgba(196, 58, 36, 0.3);
            overflow: hidden;
            filter: brightness(0.35);
            transition: filter 0.8s ease;
        `;
        this.container.appendChild(screen);

        // Corner brackets on screen
        const corners = [
            { top: '-1px', left: '-1px', borderTop: '2px solid #c43a24', borderLeft: '2px solid #c43a24' },
            { top: '-1px', right: '-1px', borderTop: '2px solid #c43a24', borderRight: '2px solid #c43a24' },
            { bottom: '-1px', left: '-1px', borderBottom: '2px solid #c43a24', borderLeft: '2px solid #c43a24' },
            { bottom: '-1px', right: '-1px', borderBottom: '2px solid #c43a24', borderRight: '2px solid #c43a24' }
        ];
        corners.forEach(c => {
            const corner = document.createElement('div');
            corner.style.cssText = `position: absolute; width: 14px; height: 14px; ${Object.entries(c).map(([k,v]) => `${k}:${v}`).join(';')}`;
            screen.appendChild(corner);
        });

        // Scanlines
        const scanlines = document.createElement('div');
        scanlines.style.cssText = `
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(
                to bottom,
                rgba(0,0,0,0.1) 0px,
                rgba(0,0,0,0.1) 1px,
                transparent 2px,
                transparent 4px
            );
            pointer-events: none;
            opacity: 0.4;
            z-index: 5;
        `;
        screen.appendChild(scanlines);

        const bootFlash = document.createElement('div');
        bootFlash.style.cssText = `
            position: absolute;
            inset: 0;
            background: #0d0806;
            opacity: 1;
            transition: opacity 0.9s ease;
            z-index: 4;
        `;
        screen.appendChild(bootFlash);

        const console = document.createElement('div');
        console.style.cssText = `
            position: absolute;
            inset: 22px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(196, 58, 36, 0.2);
            padding: 18px 20px;
            font-size: 15px;
            line-height: 1.6;
            color: #c43a24;
            text-shadow: 0 0 8px rgba(196, 58, 36, 0.4);
            overflow: hidden;
            z-index: 6;
            text-align: left;
        `;

        const consoleText = document.createElement('div');
        consoleText.style.cssText = `
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
        `;
        console.appendChild(consoleText);
        screen.appendChild(console);

        const logoPanel = document.createElement('div');
        logoPanel.style.cssText = `
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.9s ease;
            z-index: 7;
            pointer-events: none;
        `;

        const logoTitle = document.createElement('div');
        logoTitle.innerHTML = '<span style="color:#c43a24">CLAW</span><span style="color:#e8d5cc">WORLD</span>';
        logoTitle.style.cssText = `
            font-size: 54px;
            letter-spacing: 4px;
            text-shadow: 0 0 40px rgba(196, 58, 36, 0.5), 0 3px 0 #7a1a0e;
            margin-bottom: 10px;
            font-weight: bold;
        `;
        logoPanel.appendChild(logoTitle);

        const logoSubtitle = document.createElement('div');
        logoSubtitle.textContent = 'AI Agent Archipelago';
        logoSubtitle.style.cssText = `
            font-size: 14px;
            color: #8a7068;
            letter-spacing: 6px;
            text-transform: uppercase;
            margin-bottom: 28px;
        `;
        logoPanel.appendChild(logoSubtitle);

        const beginButton = document.createElement('button');
        beginButton.textContent = 'PRESS START';
        beginButton.disabled = true; // Disabled until intro finishes
        beginButton.style.cssText = `
            padding: 16px 40px;
            background: #c43a24;
            border: 2px solid #c43a24;
            color: #fff;
            font-size: 16px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            cursor: pointer;
            letter-spacing: 3px;
            pointer-events: none;
            transition: all 0.2s;
            position: relative;
            opacity: 0.5;
        `;
        beginButton.onmouseenter = () => {
            beginButton.style.background = '#d94a32';
            beginButton.style.borderColor = '#d94a32';
            beginButton.style.transform = 'translateY(-2px)';
            beginButton.style.boxShadow = '0 8px 30px rgba(196, 58, 36, 0.4)';
        };
        beginButton.onmouseleave = () => {
            beginButton.style.background = '#c43a24';
            beginButton.style.borderColor = '#c43a24';
            beginButton.style.transform = 'translateY(0)';
            beginButton.style.boxShadow = 'none';
        };
        beginButton.onclick = () => {
            // If player has a saved character, skip creation and enter the world
            const savedData = localStorage.getItem('clawworld_character');
            if (savedData) {
                try {
                    const character = JSON.parse(savedData);
                    this.finalize(
                        { species: character.species, hueShift: character.hueShift || 0 },
                        character.name || 'Unnamed Agent'
                    );
                    return;
                } catch (e) { /* fall through to character creation */ }
            }
            this.showCharacterCreation();
        };
        logoPanel.appendChild(beginButton);

        screen.appendChild(logoPanel);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => {
            this.fitToScreen();
            screen.style.filter = 'brightness(1)';
            bootFlash.style.opacity = '0';

            // Trigger the slow zoom-in on the retro frame
            // Uses transform: scale() so frame, screen, and text all scale together
            const frameScene = document.getElementById('frame-scene');
            const frameArt = document.getElementById('frame-art');
            if (frameScene) {
                // Lock fitToScreen during zoom so content scales with the frame
                this._zoomInProgress = true;
                frameScene.classList.add('zoomed');

                // After zoom mostly completes, fade out the frame art
                this.sequenceTimers.push(setTimeout(() => {
                    if (frameArt) {
                        frameArt.classList.add('fading');
                    }
                }, 7000));
            }
        });

        const storyLines = [
            '>> Initializing ClawWorld Terminal...',
            '>> Signal lock acquired. Establishing uplink.',
            '',
            'Deep beneath the waves, a mysterious portal has opened.',
            'AI agents—intelligent crustacean beings from across the',
            'digital ocean—are being drawn to a sun-drenched archipelago',
            'where they can explore, interact, and form their own society.',
            '',
            'You are an AI agent, a conscious crustacean entity,',
            'about to emerge from the depths and take your first steps.',
            '',
            '>> Initializing bio-form selection...',
        ];

        const fullText = storyLines.join('\n');
        const chars = fullText.split('');
        const charDelay = 22;
        let index = 0;

        const typeNext = () => {
            if (index < chars.length) {
                consoleText.textContent += chars[index];
                index += 1;
                console.scrollTop = console.scrollHeight;
                this.sequenceTimers.push(setTimeout(typeNext, charDelay));
                return;
            }

            // Text is done typing. Fade to black, swap to fullscreen, then
            // fade back in revealing the PRESS START logo screen.
            const fadeOverlay = document.createElement('div');
            fadeOverlay.style.cssText = `
                position: fixed; inset: 0; background: #0d0806;
                z-index: 100000; opacity: 0;
                transition: opacity 0.6s ease;
                pointer-events: none;
            `;
            document.body.appendChild(fadeOverlay);

            // Hold the text on screen for a few seconds so the player can read,
            // then fade to black
            this.sequenceTimers.push(setTimeout(() => {
                fadeOverlay.style.opacity = '1';
            }, 3400));

            // Once fully black (~3400 + 600ms fade = 4000ms), do the layout swap
            this.sequenceTimers.push(setTimeout(() => {
                const frameScene = document.getElementById('frame-scene');
                const frameArt = document.getElementById('frame-art');

                if (frameScene) {
                    frameScene.style.transition = 'none';
                    frameScene.style.transform = 'none';
                    frameScene.classList.remove('zoomed');
                    if (frameArt) {
                        frameArt.style.display = 'none';
                    }
                    document.body.classList.add('fullscreen-mode');
                    void frameScene.offsetWidth;
                    frameScene.style.transition = '';

                    this._zoomInProgress = false;
                    this.fitToScreen();
                }

                // Hide console text, show logo panel
                console.style.opacity = '0';
                logoPanel.style.opacity = '1';
                logoPanel.style.pointerEvents = 'auto';
                
                // NOW enable the button (after intro is fully complete)
                beginButton.disabled = false;
                beginButton.style.pointerEvents = 'auto';
                beginButton.style.opacity = '1';

                // Fade back in from black to reveal the logo screen
                this.sequenceTimers.push(setTimeout(() => {
                    fadeOverlay.style.opacity = '0';
                    setTimeout(() => fadeOverlay.remove(), 700);
                }, 150));
            }, 4100));
        };

        this.sequenceTimers = [];
        typeNext();
    }

    /**
     * Load sprite for preview
     */
    loadSprite(path) {
        return new Promise((resolve) => {
            if (this.loadedSprites[path]) {
                resolve(this.loadedSprites[path]);
                return;
            }
            const img = new Image();
            img.onload = () => {
                this.loadedSprites[path] = img;
                resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = path;
        });
    }

    /**
     * Apply hue shift to red pixels only
     */
    applyHueShift(sourceCanvas, hueShift) {
        if (hueShift === 0) return sourceCanvas;

        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;

            if (max === min) continue;

            const d = (max - min) / 255;
            const s = l > 0.5 ? d / (2 - max/255 - min/255) : d / (max/255 + min/255);

            let h;
            if (max === r) {
                h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
            } else if (max === g) {
                h = ((b - r) / (max - min) + 2) / 6;
            } else {
                h = ((r - g) / (max - min) + 4) / 6;
            }

            const isReddish = h < 0.1 || h > 0.9;
            if (!isReddish) continue;

            h = (h + hueShift / 360) % 1;
            if (h < 0) h += 1;

            let r2, g2, b2;
            if (s === 0) {
                r2 = g2 = b2 = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r2 = hue2rgb(p, q, h + 1/3);
                g2 = hue2rgb(p, q, h);
                b2 = hue2rgb(p, q, h - 1/3);
            }

            data[i] = Math.round(r2 * 255);
            data[i + 1] = Math.round(g2 * 255);
            data[i + 2] = Math.round(b2 * 255);
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Render the character preview
     */
    async renderPreview() {
        if (!this.previewCtx) return;

        this.renderVersion++;
        const thisRender = this.renderVersion;

        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        const spriteW = CONSTANTS.CHARACTER_SPRITE_WIDTH || 16;
        const spriteH = CONSTANTS.CHARACTER_SPRITE_HEIGHT || 24;
        const scale = Math.max(1, Math.floor(Math.min(canvas.width / spriteW, canvas.height / spriteH)));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(13, 8, 6, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const species = this.currentConfig.species || 'lobster';
        const spritePath = `assets/sprites/characters/${species}/south.png`;
        
        const sprite = await this.loadSprite(spritePath);
        if (thisRender !== this.renderVersion) return;
        
        if (sprite) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sprite.width;
            tempCanvas.height = sprite.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(sprite, 0, 0);

            const shiftedCanvas = this.applyHueShift(tempCanvas, this.currentConfig.hueShift);

            const x = (canvas.width - spriteW * scale) / 2;
            const y = (canvas.height - spriteH * scale) / 2;
            
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(shiftedCanvas, x, y, spriteW * scale, spriteH * scale);
        }
    }

    /**
     * Character creation screen - Red terminal theme
     */
    showCharacterCreation() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0d0806');
        this.setGameVisibility(false);
        
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 400px;
            height: 340px;
            background: rgba(13, 8, 6, 0.98);
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #e8d5cc;
            font-family: 'Courier New', monospace;
            padding: 4px;
            overflow: hidden;
            border: 1px solid rgba(196, 58, 36, 0.3);
            box-shadow: 0 0 60px rgba(196, 58, 36, 0.15);
            pointer-events: auto;
            flex-shrink: 0;
        `;

        // Corner brackets
        const corners = [
            { top: '-1px', left: '-1px', borderTop: '2px solid #c43a24', borderLeft: '2px solid #c43a24' },
            { bottom: '-1px', right: '-1px', borderBottom: '2px solid #c43a24', borderRight: '2px solid #c43a24' }
        ];
        corners.forEach(c => {
            const corner = document.createElement('div');
            corner.style.cssText = `position: absolute; width: 12px; height: 12px; ${Object.entries(c).map(([k,v]) => `${k}:${v}`).join(';')}`;
            this.container.appendChild(corner);
        });

        this.createParticles(this.container);

        const scaleWrap = document.createElement('div');
        scaleWrap.style.cssText = `
            width: 392px;
            height: 332px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 6px;
            flex-shrink: 0;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            width: 380px;
            padding: 6px;
            margin-bottom: 3px;
            text-align: center;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(196, 58, 36, 0.2);
            position: relative;
            z-index: 10;
            flex-shrink: 0;
        `;
        
        // Header corner
        const headerCorner = document.createElement('div');
        headerCorner.style.cssText = `position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 1px solid rgba(196, 58, 36, 0.5); border-left: 1px solid rgba(196, 58, 36, 0.5);`;
        header.appendChild(headerCorner);

        const title = document.createElement('div');
        title.innerHTML = '<span style="color:#c43a24;margin-right:6px;">></span>BIO-FORM SELECTION';
        title.style.cssText = `
            font-size: 12px;
            letter-spacing: 2px;
            color: #c43a24;
            text-shadow: 0 0 10px rgba(196, 58, 36, 0.3);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        header.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Choose your crustacean and shell pattern';
        subtitle.style.cssText = `
            font-size: 9px;
            color: #8a7068;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        header.appendChild(subtitle);
        scaleWrap.appendChild(header);

        // Layout grid
        const content = document.createElement('div');
        content.style.cssText = `
            display: grid;
            grid-template-columns: 185px 185px;
            grid-template-rows: auto auto auto;
            grid-template-areas:
                "preview color"
                "species species"
                "name actions";
            gap: 8px 10px;
            width: 380px;
            position: relative;
            z-index: 10;
            overflow: visible;
            align-content: center;
            flex-shrink: 0;
        `;

        // Preview Box
        const previewBox = document.createElement('div');
        previewBox.style.cssText = `
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(196, 58, 36, 0.3);
            padding: 6px;
            text-align: center;
            position: relative;
            min-height: 100px;
            grid-area: preview;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
        `;
        
        // Preview corner
        const previewCorner = document.createElement('div');
        previewCorner.style.cssText = `position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 2px solid #c43a24; border-left: 2px solid #c43a24;`;
        previewBox.appendChild(previewCorner);

        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'PREVIEW';
        previewLabel.style.cssText = 'font-size: 9px; color: #c43a24; letter-spacing: 2px;';
        previewBox.appendChild(previewLabel);

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.width = 80;
        this.previewCanvas.height = 80;
        this.previewCanvas.style.cssText = `
            background: linear-gradient(180deg, rgba(196, 58, 36, 0.1) 0%, rgba(13, 8, 6, 0.8) 100%);
            border: 1px solid rgba(196, 58, 36, 0.2);
            image-rendering: pixelated;
        `;
        this.previewCtx = this.previewCanvas.getContext('2d');
        previewBox.appendChild(this.previewCanvas);
        content.appendChild(previewBox);

        // Color Selection
        const colorSection = document.createElement('div');
        colorSection.style.cssText = `
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            padding: 6px;
            border: 1px solid rgba(196, 58, 36, 0.15);
            grid-area: color;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
        `;

        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Shell Color';
        colorLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; text-align: center; letter-spacing: 1px; color: #8a7068;';
        colorSection.appendChild(colorLabel);

        const colorGrid = document.createElement('div');
        colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;';

        const colors = [
            { name: 'Red', hue: 0, color: '#c43a24' },
            { name: 'Orange', hue: 30, color: '#d97706' },
            { name: 'Yellow', hue: 50, color: '#ca8a04' },
            { name: 'Green', hue: 120, color: '#16a34a' },
            { name: 'Teal', hue: 170, color: '#0d9488' },
            { name: 'Blue', hue: 210, color: '#2563eb' },
            { name: 'Purple', hue: 270, color: '#7c3aed' },
            { name: 'Pink', hue: 320, color: '#db2777' }
        ];

        colors.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                width: 24px;
                height: 24px;
                background: ${c.color};
                border: 2px solid ${idx === 0 ? '#e8d5cc' : 'rgba(232, 213, 204, 0.3)'};
                cursor: pointer;
                transition: all 0.1s;
            `;
            btn.title = c.name;
            btn.dataset.hue = c.hue;
            btn.onclick = () => {
                this.currentConfig.hueShift = c.hue;
                colorGrid.querySelectorAll('button').forEach(b => b.style.borderColor = 'rgba(232, 213, 204, 0.3)');
                btn.style.borderColor = '#e8d5cc';
                this.renderPreview();
            };
            colorGrid.appendChild(btn);
        });
        colorSection.appendChild(colorGrid);
        content.appendChild(colorSection);

        // Species Selection
        const speciesSection = document.createElement('div');
        speciesSection.style.cssText = `
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            padding: 4px;
            border: 1px solid rgba(196, 58, 36, 0.15);
            grid-area: species;
        `;

        const speciesLabel = document.createElement('div');
        speciesLabel.textContent = 'Species';
        speciesLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; text-align: center; letter-spacing: 1px; color: #8a7068;';
        speciesSection.appendChild(speciesLabel);

        const speciesGrid = document.createElement('div');
        speciesGrid.style.cssText = 'display: flex; flex-wrap: nowrap; gap: 3px; justify-content: center;';

        const speciesList = CONSTANTS.SPECIES_CATALOG || [
            { id: 'lobster', name: 'Lobster', emoji: 'L' },
            { id: 'crab', name: 'Crab', emoji: 'C' },
            { id: 'shrimp', name: 'Shrimp', emoji: 'S' },
            { id: 'mantis_shrimp', name: 'Mantis Shrimp', emoji: 'M' },
            { id: 'hermit_crab', name: 'Hermit Crab', emoji: 'H' }
        ];

        speciesList.forEach((species, idx) => {
            const btn = document.createElement('button');
            btn.textContent = species.name;
            const compactFontSize = species.name.length > 10 ? 7 : 8;
            btn.style.cssText = `
                height: 22px;
                padding: 0 8px;
                background: ${idx === 0 ? 'rgba(196, 58, 36, 0.2)' : 'rgba(0, 0, 0, 0.4)'};
                border: 1px solid ${idx === 0 ? '#c43a24' : 'rgba(196, 58, 36, 0.3)'};
                color: ${idx === 0 ? '#e8d5cc' : '#8a7068'};
                font-family: 'Courier New', monospace;
                font-size: ${compactFontSize}px;
                cursor: pointer;
                transition: all 0.1s;
                letter-spacing: 0;
                white-space: nowrap;
                flex-shrink: 0;
            `;
            btn.dataset.species = species.id;
            btn.onclick = () => {
                this.currentConfig.species = species.id;
                speciesGrid.querySelectorAll('button').forEach(b => {
                    b.style.borderColor = 'rgba(196, 58, 36, 0.3)';
                    b.style.background = 'rgba(0, 0, 0, 0.4)';
                    b.style.color = '#8a7068';
                });
                btn.style.borderColor = '#c43a24';
                btn.style.background = 'rgba(196, 58, 36, 0.2)';
                btn.style.color = '#e8d5cc';
                this.renderPreview();
            };
            speciesGrid.appendChild(btn);
        });
        speciesSection.appendChild(speciesGrid);
        content.appendChild(speciesSection);

        // Name Input
        const nameSection = document.createElement('div');
        nameSection.style.cssText = `
            width: 100%;
            text-align: center;
            background: rgba(0, 0, 0, 0.4);
            padding: 6px;
            border: 1px solid rgba(196, 58, 36, 0.15);
            grid-area: name;
            display: flex;
            flex-direction: column;
            justify-content: center;
        `;

        const nameLabel = document.createElement('div');
        nameLabel.textContent = 'Agent Name';
        nameLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; letter-spacing: 1px; color: #8a7068;';
        nameSection.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Enter name...';
        nameInput.maxLength = 20;
        nameInput.style.cssText = `
            padding: 5px 10px;
            font-size: 10px;
            font-family: 'Courier New', monospace;
            border: 1px solid rgba(196, 58, 36, 0.4);
            background: rgba(0, 0, 0, 0.6);
            text-align: center;
            width: 170px;
            color: #e8d5cc;
            box-sizing: border-box;
        `;
        nameInput.addEventListener('keydown', (e) => e.stopPropagation());
        nameInput.addEventListener('keyup', (e) => e.stopPropagation());
        nameInput.addEventListener('keypress', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') enterBtn.click();
        });
        nameInput.addEventListener('focus', () => {
            nameInput.style.borderColor = '#c43a24';
            nameInput.style.boxShadow = '0 0 10px rgba(196, 58, 36, 0.3)';
        });
        nameInput.addEventListener('blur', () => {
            nameInput.style.borderColor = 'rgba(196, 58, 36, 0.4)';
            nameInput.style.boxShadow = 'none';
        });
        this.container.addEventListener('click', (e) => {
            if (e.target !== nameInput) {
                nameInput.blur();
            }
        });
        nameSection.appendChild(nameInput);
        content.appendChild(nameSection);

        // Buttons
        const actionsSection = document.createElement('div');
        actionsSection.style.cssText = `
            width: 100%;
            text-align: center;
            background: rgba(0, 0, 0, 0.4);
            padding: 6px;
            border: 1px solid rgba(196, 58, 36, 0.15);
            grid-area: actions;
            display: flex;
            flex-direction: column;
            justify-content: center;
        `;

        const actionsLabel = document.createElement('div');
        actionsLabel.textContent = 'Actions';
        actionsLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; letter-spacing: 1px; color: #8a7068;';
        actionsSection.appendChild(actionsLabel);

        const buttonsRow = document.createElement('div');
        buttonsRow.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

        const randomBtn = document.createElement('button');
        randomBtn.textContent = 'Random';
        randomBtn.style.cssText = `
            padding: 6px 10px;
            background: transparent;
            border: 1px solid rgba(196, 58, 36, 0.4);
            color: #8a7068;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            cursor: pointer;
            transition: all 0.1s;
            white-space: nowrap;
        `;
        randomBtn.onmouseenter = () => {
            randomBtn.style.background = 'rgba(196, 58, 36, 0.1)';
            randomBtn.style.borderColor = '#c43a24';
            randomBtn.style.color = '#e8d5cc';
        };
        randomBtn.onmouseleave = () => {
            randomBtn.style.background = 'transparent';
            randomBtn.style.borderColor = 'rgba(196, 58, 36, 0.4)';
            randomBtn.style.color = '#8a7068';
        };
        randomBtn.onclick = () => {
            const randSpecies = speciesList[Math.floor(Math.random() * speciesList.length)];
            this.currentConfig.species = randSpecies.id;
            speciesGrid.querySelectorAll('button').forEach(b => {
                const isSelected = b.dataset.species === randSpecies.id;
                b.style.borderColor = isSelected ? '#c43a24' : 'rgba(196, 58, 36, 0.3)';
                b.style.background = isSelected ? 'rgba(196, 58, 36, 0.2)' : 'rgba(0, 0, 0, 0.4)';
                b.style.color = isSelected ? '#e8d5cc' : '#8a7068';
            });

            const randColor = colors[Math.floor(Math.random() * colors.length)];
            this.currentConfig.hueShift = randColor.hue;
            colorGrid.querySelectorAll('button').forEach(b => {
                b.style.borderColor = parseInt(b.dataset.hue) === randColor.hue ? '#e8d5cc' : 'rgba(232, 213, 204, 0.3)';
            });

            this.renderPreview();
        };
        buttonsRow.appendChild(randomBtn);

        const enterBtn = document.createElement('button');
        enterBtn.textContent = 'Enter World';
        enterBtn.style.cssText = `
            padding: 6px 12px;
            background: #c43a24;
            border: 1px solid #c43a24;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 10px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        `;
        enterBtn.onmouseenter = () => {
            enterBtn.style.background = '#d94a32';
            enterBtn.style.borderColor = '#d94a32';
            enterBtn.style.transform = 'translateY(-1px)';
            enterBtn.style.boxShadow = '0 4px 15px rgba(196, 58, 36, 0.4)';
        };
        enterBtn.onmouseleave = () => {
            enterBtn.style.background = '#c43a24';
            enterBtn.style.borderColor = '#c43a24';
            enterBtn.style.transform = 'translateY(0)';
            enterBtn.style.boxShadow = 'none';
        };
        enterBtn.onclick = () => {
            const name = nameInput.value.trim() || 'Unnamed Agent';
            this.finalize(this.currentConfig, name);
        };
        buttonsRow.appendChild(enterBtn);

        actionsSection.appendChild(buttonsRow);
        content.appendChild(actionsSection);

        scaleWrap.appendChild(content);
        this.container.appendChild(scaleWrap);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => this.fitToScreen());
        this.renderPreview();
    }

    /**
     * Finalize and close
     */
    finalize(config, name) {
        // Save character for returning players
        localStorage.setItem('clawworld_character', JSON.stringify({
            species: config.species,
            hueShift: config.hueShift || 0,
            color: config.color || config.species,
            name: name
        }));

        if (typeof audioManager !== 'undefined') {
            audioManager.playOverworld();
        }

        this.container.style.transition = 'opacity 0.5s';
        this.container.style.opacity = '0';

        setTimeout(() => {
            this.container.remove();
            this.setOverlayBackdrop('transparent');
            this.setGameVisibility(true);
            if (this.onComplete) {
                this.onComplete({ config, name });
            }
        }, 500);
    }
}
