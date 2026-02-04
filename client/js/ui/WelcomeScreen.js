// Welcome screen for character creation with live preview
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
     * Add CSS animations for ocean theme
     */
    addOceanAnimations() {
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
                50% { transform: translateY(-10px); }
            }
            
            @keyframes bubble-rise {
                0% { 
                    transform: translateY(0) translateX(0) scale(1);
                    opacity: 0.7;
                }
                50% { 
                    transform: translateY(-50vh) translateX(10px) scale(1.1);
                    opacity: 0.5;
                }
                100% { 
                    transform: translateY(-100vh) translateX(-5px) scale(0.8);
                    opacity: 0;
                }
            }
            
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            .ocean-bubble {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(100,200,255,0.3));
                animation: bubble-rise linear infinite;
                pointer-events: none;
            }
            
            .crustacean-border {
                position: absolute;
                font-size: 24px;
                animation: float 3s ease-in-out infinite;
                pointer-events: none;
                filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));
            }
            
            .title-shimmer {
                background: linear-gradient(
                    90deg,
                    #fff 0%,
                    #fbbf24 25%,
                    #fff 50%,
                    #fbbf24 75%,
                    #fff 100%
                );
                background-size: 200% auto;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: shimmer 3s linear infinite;
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
            
            // Add resize listener for uniform scaling
            if (!this._resizeHandler) {
                this._resizeHandler = () => this.fitToScreen();
                window.addEventListener('resize', this._resizeHandler);
            }
        }
        return this.overlay;
    }

    /**
     * Fit current container into screen overlay using uniform scaling.
     * Container must have fixed pixel dimensions - no responsive sizing.
     */
    fitToScreen() {
        if (!this.container) return;
        const root = this.getRoot();
        const bounds = root.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        // Reset transform to measure natural size
        this.container.style.transform = 'none';
        this.container.style.transformOrigin = 'center center';

        const rect = this.container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        // Add padding so it doesn't touch edges (smaller on mobile)
        const isMobile = bounds.width < 600;
        const padding = isMobile ? 10 : 20;
        const availW = bounds.width - padding * 2;
        const availH = bounds.height - padding * 2;

        // Uniform scale to fit (can scale up or down, no max limit on mobile)
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
     * Create animated bubbles
     */
    createBubbles(container) {
        const bubbleContainer = document.createElement('div');
        bubbleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            pointer-events: none;
        `;
        
        for (let i = 0; i < 12; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'ocean-bubble';
            const size = 10 + Math.random() * 20;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.bottom = `-${size}px`;
            bubble.style.animationDuration = `${5 + Math.random() * 10}s`;
            bubble.style.animationDelay = `${Math.random() * 5}s`;
            bubbleContainer.appendChild(bubble);
        }
        
        container.appendChild(bubbleContainer);
    }

    /**
     * Show the welcome screen
     */
    show(onComplete) {
        this.onComplete = onComplete;
        this.addOceanAnimations();
        
        // Start title music (preload if needed)
        if (typeof audioManager !== 'undefined') {
            audioManager.preload().then(() => {
                audioManager.playTitle();
            });
        }
        
        // Check for bot mode query param - skip mode selection
        const params = new URLSearchParams(window.location.search);
        if (params.get('quickStart') === 'true') {
            // Skip everything and go straight to game with default character
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
        // Use saved character or create a default one
        let savedData = localStorage.getItem('clawworld_character');
        let character;
        
        if (savedData) {
            character = JSON.parse(savedData);
        } else {
            // Create default character
            character = {
                species: 'lobster',
                color: 'red',
                name: 'Player'
            };
            localStorage.setItem('clawworld_character', JSON.stringify(character));
        }
        
        // Skip all UI and start game directly
        this.setGameVisibility(true);
        if (this.onComplete) {
            this.onComplete({ 
                config: { species: character.species, color: character.color },
                name: character.name 
            });
        }
    }

    /**
     * Mode selection screen - Human or AI Agent (pixel art style)
     */
    showModeSelection() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0a1628');
        this.setGameVisibility(false);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 320px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #fff;
            font-family: monospace;
            text-align: center;
            background: #1a2744;
            border: 3px solid #3d5a80;
            border-radius: 4px;
            box-shadow: 0 4px 0 #0f1a2e, 0 8px 20px rgba(0,0,0,0.5);
            padding: 24px 20px;
            image-rendering: pixelated;
            flex-shrink: 0;
        `;

        // Title with pixel border
        const title = document.createElement('div');
        title.textContent = 'CLAW WORLD';
        title.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            color: #5eead4;
            text-shadow: 2px 2px 0 #134e4a;
            letter-spacing: 2px;
            margin-bottom: 8px;
        `;
        this.container.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('div');
        subtitle.textContent = '~ Select Mode ~';
        subtitle.style.cssText = `
            font-size: 11px;
            color: #64748b;
            margin-bottom: 20px;
            letter-spacing: 1px;
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

        // Pixel button style helper
        const createPixelBtn = (emoji, label, color, hoverColor) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<span style="margin-right:8px">${emoji}</span>${label}`;
            btn.style.cssText = `
                width: 100%;
                padding: 14px 20px;
                font-size: 14px;
                font-family: monospace;
                font-weight: bold;
                background: ${color};
                color: white;
                border: none;
                border-bottom: 3px solid rgba(0,0,0,0.3);
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.1s;
                text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
                letter-spacing: 1px;
            `;
            btn.onmouseenter = () => {
                btn.style.background = hoverColor;
                btn.style.transform = 'translateY(-2px)';
            };
            btn.onmouseleave = () => {
                btn.style.background = color;
                btn.style.transform = 'translateY(0)';
            };
            btn.onmousedown = () => {
                btn.style.transform = 'translateY(1px)';
                btn.style.borderBottomWidth = '1px';
            };
            btn.onmouseup = () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.borderBottomWidth = '3px';
            };
            return btn;
        };

        // Human Player button
        const humanBtn = createPixelBtn('🎮', 'PLAY', '#2563eb', '#3b82f6');
        humanBtn.onclick = () => this.showStoryIntro();
        buttons.appendChild(humanBtn);

        // AI Agent button
        const agentBtn = createPixelBtn('🤖', 'AI AGENT', '#7c3aed', '#8b5cf6');
        agentBtn.onclick = () => this.showAgentWaiting();
        buttons.appendChild(agentBtn);

        this.container.appendChild(buttons);

        // Small hint
        const hint = document.createElement('div');
        hint.innerHTML = `<span style="color:#64748b;font-size:10px;margin-top:16px;display:block;">Humans & bots play together!</span>`;
        this.container.appendChild(hint);

        // Bot guide link
        const guideLink = document.createElement('a');
        guideLink.href = 'bot-guide.html';
        guideLink.target = '_blank';
        guideLink.textContent = '📖 AI Agent Guide';
        guideLink.style.cssText = `
            display: block;
            margin-top: 12px;
            font-size: 11px;
            color: #a78bfa;
            text-decoration: none;
            transition: color 0.2s;
        `;
        guideLink.onmouseenter = () => guideLink.style.color = '#c4b5fd';
        guideLink.onmouseleave = () => guideLink.style.color = '#a78bfa';
        this.container.appendChild(guideLink);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => this.fitToScreen());
    }

    /**
     * AI Agent waiting screen (pixel art style)
     */
    showAgentWaiting() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#0a1628');
        this.setGameVisibility(false);

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #fff;
            font-family: monospace;
            text-align: center;
            background: #1a2744;
            border: 3px solid #7c3aed;
            border-radius: 4px;
            box-shadow: 0 4px 0 #0f1a2e, 0 8px 20px rgba(0,0,0,0.5);
            padding: 24px 20px;
            flex-shrink: 0;
        `;

        // Icon with blink animation
        const icon = document.createElement('div');
        icon.textContent = '🤖';
        icon.style.cssText = `
            font-size: 36px;
            margin-bottom: 12px;
        `;
        this.container.appendChild(icon);

        // Title
        const title = document.createElement('div');
        title.textContent = 'AI AGENT MODE';
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #a78bfa;
            text-shadow: 1px 1px 0 #4c1d95;
            letter-spacing: 2px;
            margin-bottom: 16px;
        `;
        this.container.appendChild(title);

        // Status with blinking dots
        const status = document.createElement('div');
        status.innerHTML = 'Waiting for connection<span class="blink-dots">...</span>';
        status.style.cssText = `
            font-size: 11px;
            color: #94a3b8;
            margin-bottom: 16px;
        `;
        this.container.appendChild(status);

        // Add blinking animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
            .blink-dots { animation: blink 1s infinite; }
        `;
        this.container.appendChild(style);

        // Connection info box
        const info = document.createElement('div');
        const wsUrl = window.CONFIG?.BOT_SERVER_URL || 'ws://localhost:3001';
        info.style.cssText = `
            background: #0f172a;
            padding: 10px 14px;
            border: 2px solid #334155;
            border-radius: 3px;
            width: 100%;
            box-sizing: border-box;
        `;
        info.innerHTML = `
            <div style="color:#64748b;font-size:9px;margin-bottom:4px;">CONNECT TO:</div>
            <div style="color:#5eead4;font-size:11px;word-break:break-all;">${wsUrl}</div>
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
            color: #a78bfa;
            text-decoration: none;
            transition: color 0.2s;
        `;
        guideLink.onmouseenter = () => guideLink.style.color = '#c4b5fd';
        guideLink.onmouseleave = () => guideLink.style.color = '#a78bfa';
        this.container.appendChild(guideLink);

        // Back button
        const backBtn = document.createElement('button');
        backBtn.textContent = '← BACK';
        backBtn.style.cssText = `
            margin-top: 12px;
            padding: 8px 16px;
            font-size: 11px;
            font-family: monospace;
            font-weight: bold;
            background: #334155;
            color: #94a3b8;
            border: none;
            border-bottom: 2px solid rgba(0,0,0,0.3);
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.1s;
            letter-spacing: 1px;
        `;
        backBtn.onmouseenter = () => {
            backBtn.style.background = '#475569';
            backBtn.style.color = '#fff';
        };
        backBtn.onmouseleave = () => {
            backBtn.style.background = '#334155';
            backBtn.style.color = '#94a3b8';
        };
        backBtn.onclick = () => this.showModeSelection();
        this.container.appendChild(backBtn);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => this.fitToScreen());

        // Enable bot mode on the game
        if (window.game) {
            window.game.enableBotMode();
        }
    }

    /**
     * Story introduction screen
     */
    showStoryIntro() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('#000');
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
            color: #fff;
            font-family: monospace;
            text-align: center;
            overflow: hidden;
            pointer-events: auto;
            flex-shrink: 0;
        `;

        const screen = document.createElement('div');
        screen.style.cssText = `
            position: absolute;
            inset: 0;
            background: #000;
            border: 4px solid #1f2937;
            border-radius: 14px;
            box-shadow: 0 18px 45px rgba(0,0,0,0.7), inset 0 0 25px rgba(0,0,0,0.6);
            overflow: hidden;
            filter: brightness(0.35);
            transition: filter 0.8s ease;
        `;
        this.container.appendChild(screen);

        const scanlines = document.createElement('div');
        scanlines.style.cssText = `
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(
                to bottom,
                rgba(0,0,0,0.15) 0px,
                rgba(0,0,0,0.15) 1px,
                rgba(0,0,0,0) 2px,
                rgba(0,0,0,0) 4px
            );
            pointer-events: none;
            opacity: 0.35;
            mix-blend-mode: multiply;
            z-index: 5;
        `;
        screen.appendChild(scanlines);

        const bootFlash = document.createElement('div');
        bootFlash.style.cssText = `
            position: absolute;
            inset: 0;
            background: #000;
            opacity: 1;
            transition: opacity 0.9s ease;
            z-index: 4;
        `;
        screen.appendChild(bootFlash);

        const console = document.createElement('div');
        console.style.cssText = `
            position: absolute;
            inset: 22px;
            background: rgba(0, 0, 0, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.35);
            border-radius: 10px;
            padding: 18px 20px;
            font-size: 15px;
            line-height: 1.6;
            color: #a7f3d0;
            text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
            overflow: hidden;
            z-index: 6;
            text-align: left;
        `;

        const consoleText = document.createElement('div');
        consoleText.style.cssText = `
            white-space: pre-wrap;
            font-family: "Courier New", monospace;
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
        logoTitle.textContent = 'CLAW WORLD';
        logoTitle.style.cssText = `
            font-size: 54px;
            letter-spacing: 6px;
            color: #fbbf24;
            text-shadow: 4px 4px 0 #000, -2px -2px 0 #92400e;
            margin-bottom: 10px;
        `;
        logoPanel.appendChild(logoTitle);

        const logoSubtitle = document.createElement('div');
        logoSubtitle.textContent = 'AI Agent Archipelago';
        logoSubtitle.style.cssText = `
            font-size: 16px;
            color: #bae6fd;
            text-shadow: 2px 2px 0 #000;
            margin-bottom: 28px;
            letter-spacing: 1px;
        `;
        logoPanel.appendChild(logoSubtitle);

        const beginButton = document.createElement('button');
        beginButton.textContent = 'Press Start';
        beginButton.style.cssText = `
            padding: 14px 36px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border: 3px solid #fff;
            color: #000;
            font-size: 18px;
            font-family: monospace;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 5px 5px 0 rgba(0,0,0,0.35);
            border-radius: 10px;
            pointer-events: auto;
        `;
        beginButton.onmouseenter = () => {
            beginButton.style.transform = 'scale(1.04)';
        };
        beginButton.onmouseleave = () => {
            beginButton.style.transform = 'scale(1)';
        };
        beginButton.onclick = () => this.showCharacterCreation();
        logoPanel.appendChild(beginButton);

        screen.appendChild(logoPanel);

        overlay.appendChild(this.container);
        requestAnimationFrame(() => {
            this.fitToScreen();
            screen.style.filter = 'brightness(1)';
            bootFlash.style.opacity = '0';
        });

        const storyLines = [
            '>> Powering ClawWorld Terminal...',
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
            'Initializing bio-form selection...',
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

            this.sequenceTimers.push(setTimeout(() => {
                console.style.transition = 'opacity 0.8s ease';
                console.style.opacity = '0';
            }, 600));

            this.sequenceTimers.push(setTimeout(() => {
                logoPanel.style.opacity = '1';
                logoPanel.style.pointerEvents = 'auto';
            }, 1400));
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
     * Takes red-ish pixels and shifts their hue while preserving saturation/lightness
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

            if (a === 0) continue; // Skip transparent

            // Convert RGB to HSL
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;

            if (max === min) continue; // Gray, no hue to shift

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

            // Only shift reddish colors (hue near 0 or 1, i.e., red-orange range)
            // Red is at h=0, orange at h=0.08, pink at h=0.95
            const isReddish = h < 0.1 || h > 0.9;
            if (!isReddish) continue;

            // Apply hue shift
            h = (h + hueShift / 360) % 1;
            if (h < 0) h += 1;

            // Convert back to RGB
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

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 50, 80, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load species sprite
        const species = this.currentConfig.species || 'lobster';
        const spritePath = `assets/sprites/characters/${species}/south.png`;
        
        const sprite = await this.loadSprite(spritePath);
        if (thisRender !== this.renderVersion) return;
        
        if (sprite) {
            // Create temp canvas for the sprite
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sprite.width;
            tempCanvas.height = sprite.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(sprite, 0, 0);

            // Apply hue shift
            const shiftedCanvas = this.applyHueShift(tempCanvas, this.currentConfig.hueShift);

            // Draw centered
            const x = (canvas.width - spriteW * scale) / 2;
            const y = (canvas.height - spriteH * scale) / 2;
            
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(shiftedCanvas, x, y, spriteW * scale, spriteH * scale);
        }
    }

    /**
     * Character creation screen
     */
    showCharacterCreation() {
        this.clearSequenceTimers();
        if (this.container) {
            this.container.remove();
        }

        const overlay = this.ensureOverlay();
        this.setOverlayBackdrop('transparent');
        this.setGameVisibility(false);
        
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: relative;
            width: 400px;
            height: 340px;
            background: linear-gradient(135deg, #0c4a6e 0%, #134e4a 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2000;
            color: #fff;
            font-family: monospace;
            padding: 4px;
            overflow: hidden;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 14px;
            box-shadow: 0 18px 45px rgba(0,0,0,0.55);
            pointer-events: auto;
            flex-shrink: 0;
        `;

        this.createBubbles(this.container);

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
            padding: 4px 6px;
            margin-bottom: 3px;
            text-align: center;
            background: linear-gradient(90deg, rgba(7, 31, 49, 0.9), rgba(5, 20, 36, 0.9));
            border: 2px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
            position: relative;
            z-index: 10;
            flex-shrink: 0;
        `;

        const title = document.createElement('div');
        title.textContent = 'CLAW WORLD BIO-FORM SELECTION';
        title.style.cssText = `
            font-size: 11px;
            letter-spacing: 1.5px;
            color: #fbbf24;
            text-shadow: 2px 2px 0 #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        header.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Choose your crustacean and shell pattern.';
        subtitle.style.cssText = `
            font-size: 8px;
            color: #cbd5e1;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        header.appendChild(subtitle);
        scaleWrap.appendChild(header);

        // Layout grid (compact to fit CRT screen)
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
            background: linear-gradient(180deg, rgba(0, 50, 100, 0.6) 0%, rgba(0, 30, 60, 0.8) 100%);
            border: 2px solid #fbbf24;
            border-radius: 10px;
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

        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'PREVIEW';
        previewLabel.style.cssText = 'font-size: 9px; color: #fbbf24; letter-spacing: 1px;';
        previewBox.appendChild(previewLabel);

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.width = 80;
        this.previewCanvas.height = 80;
        this.previewCanvas.style.cssText = `
            background: linear-gradient(180deg, rgba(0, 100, 150, 0.6) 0%, rgba(194, 178, 128, 0.8) 85%);
            border-radius: 8px;
            image-rendering: pixelated;
        `;
        this.previewCtx = this.previewCanvas.getContext('2d');
        previewBox.appendChild(this.previewCanvas);
        content.appendChild(previewBox);

        // Color Selection (Hue Shift)
        const colorSection = document.createElement('div');
        colorSection.style.cssText = `
            width: 100%;
            background: rgba(0,0,0,0.3);
            padding: 6px;
            border-radius: 10px;
            grid-area: color;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        `;

        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Shell Color';
        colorLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; text-align: center; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        colorSection.appendChild(colorLabel);

        const colorGrid = document.createElement('div');
        colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;';

        // Color options with hue shifts from red (0)
        const colors = [
            { name: 'Red', hue: 0, color: '#ff4444' },
            { name: 'Orange', hue: 30, color: '#ff8844' },
            { name: 'Yellow', hue: 50, color: '#ffcc44' },
            { name: 'Green', hue: 120, color: '#44dd44' },
            { name: 'Teal', hue: 170, color: '#44ddaa' },
            { name: 'Blue', hue: 210, color: '#4488ff' },
            { name: 'Purple', hue: 270, color: '#aa44ff' },
            { name: 'Pink', hue: 320, color: '#ff44aa' }
        ];

        colors.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                width: 24px;
                height: 24px;
                background: ${c.color};
                border: 2px solid ${idx === 0 ? '#fbbf24' : '#fff'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.1s;
            `;
            btn.title = c.name;
            btn.dataset.hue = c.hue;
            btn.onclick = () => {
                this.currentConfig.hueShift = c.hue;
                colorGrid.querySelectorAll('button').forEach(b => b.style.borderColor = '#fff');
                btn.style.borderColor = '#fbbf24';
                this.renderPreview();
            };
            colorGrid.appendChild(btn);
        });
        colorSection.appendChild(colorGrid);
        content.appendChild(colorSection);

        // Species Selection (moved below color)
        const speciesSection = document.createElement('div');
        speciesSection.style.cssText = `
            width: 100%;
            background: rgba(0,0,0,0.3);
            padding: 4px;
            border-radius: 8px;
            grid-area: species;
        `;

        const speciesLabel = document.createElement('div');
        speciesLabel.textContent = 'Species';
        speciesLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; text-align: center; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        speciesSection.appendChild(speciesLabel);

        const speciesGrid = document.createElement('div');
        speciesGrid.style.cssText = 'display: flex; flex-wrap: nowrap; gap: 3px; justify-content: center;';

        const speciesList = CONSTANTS.SPECIES_CATALOG || [
            { id: 'lobster', name: 'Lobster', emoji: '🦞' },
            { id: 'crab', name: 'Crab', emoji: '🦀' },
            { id: 'shrimp', name: 'Shrimp', emoji: '🦐' },
            { id: 'mantis_shrimp', name: 'Mantis Shrimp', emoji: '🌈' },
            { id: 'hermit_crab', name: 'Hermit Crab', emoji: '🐚' }
        ];

        speciesList.forEach((species, idx) => {
            const btn = document.createElement('button');
            btn.textContent = species.name;
            const compactFontSize = species.name.length > 10 ? 7 : 8;
            btn.style.cssText = `
                height: 22px;
                padding: 0 8px;
                background: rgba(0,0,0,0.4);
                border: 2px solid ${idx === 0 ? '#fbbf24' : '#fff'};
                border-radius: 6px;
                color: #fff;
                font-family: monospace;
                font-size: ${compactFontSize}px;
                cursor: pointer;
                transition: all 0.1s;
                letter-spacing: 0;
                white-space: nowrap;
                text-shadow: 0 1px 2px rgba(0,0,0,0.6);
                flex-shrink: 0;
            `;
            btn.dataset.species = species.id;
            btn.onclick = () => {
                this.currentConfig.species = species.id;
                speciesGrid.querySelectorAll('button').forEach(b => b.style.borderColor = '#fff');
                btn.style.borderColor = '#fbbf24';
                this.renderPreview();
            };
            speciesGrid.appendChild(btn);
        });
        speciesSection.appendChild(speciesGrid);
        content.appendChild(speciesSection);

        // Name Input (moved under preview)
        const nameSection = document.createElement('div');
        nameSection.style.cssText = `
            width: 100%;
            text-align: center;
            background: rgba(0,0,0,0.3);
            padding: 6px;
            border-radius: 10px;
            grid-area: name;
            display: flex;
            flex-direction: column;
            justify-content: center;
        `;

        const nameLabel = document.createElement('div');
        nameLabel.textContent = 'Agent Name';
        nameLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        nameSection.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Agent name...';
        nameInput.maxLength = 20;
        nameInput.style.cssText = `
            padding: 5px 10px;
            font-size: 10px;
            font-family: monospace;
            border: 2px solid #fff;
            border-radius: 8px;
            background: rgba(255,255,255,0.95);
            text-align: center;
            width: 170px;
            color: #000;
            box-sizing: border-box;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        `;
        nameInput.addEventListener('keydown', (e) => e.stopPropagation());
        nameInput.addEventListener('keyup', (e) => e.stopPropagation());
        nameInput.addEventListener('keypress', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') enterBtn.click();
        });
        // Blur input when clicking elsewhere
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
            background: rgba(0,0,0,0.3);
            padding: 6px;
            border-radius: 10px;
            grid-area: actions;
            display: flex;
            flex-direction: column;
            justify-content: center;
        `;

        const actionsLabel = document.createElement('div');
        actionsLabel.textContent = 'Actions';
        actionsLabel.style.cssText = 'font-size: 9px; margin-bottom: 6px; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        actionsSection.appendChild(actionsLabel);

        const buttonsRow = document.createElement('div');
        buttonsRow.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

        const randomBtn = document.createElement('button');
        randomBtn.textContent = 'Randomize';
        randomBtn.style.cssText = `
            padding: 6px 10px;
            background: #8b5cf6;
            border: 2px solid #fff;
            border-radius: 8px;
            color: #fff;
            font-family: monospace;
            font-size: 10px;
            cursor: pointer;
            white-space: nowrap;
            text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        `;
        randomBtn.onclick = () => {
            // Random species
            const randSpecies = speciesList[Math.floor(Math.random() * speciesList.length)];
            this.currentConfig.species = randSpecies.id;
            speciesGrid.querySelectorAll('button').forEach(b => {
                b.style.borderColor = b.dataset.species === randSpecies.id ? '#fbbf24' : '#fff';
            });

            // Random color
            const randColor = colors[Math.floor(Math.random() * colors.length)];
            this.currentConfig.hueShift = randColor.hue;
            colorGrid.querySelectorAll('button').forEach(b => {
                b.style.borderColor = parseInt(b.dataset.hue) === randColor.hue ? '#fbbf24' : '#fff';
            });

            this.renderPreview();
        };
        buttonsRow.appendChild(randomBtn);

        const enterBtn = document.createElement('button');
        enterBtn.textContent = 'Enter World';
        enterBtn.style.cssText = `
            padding: 6px 12px;
            background: #10b981;
            border: 2px solid #fff;
            border-radius: 8px;
            color: #fff;
            font-family: monospace;
            font-weight: bold;
            font-size: 10px;
            cursor: pointer;
            white-space: nowrap;
        `;
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
        // Crossfade to overworld music
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
