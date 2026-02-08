// Entry point - initialize and start the game
window.addEventListener('DOMContentLoaded', () => {
    console.log('🦀 Claw World Loading...');

    const detectFrameScreen = () => {
        const frameScene = document.getElementById('frame-scene');
        const frameArt = document.getElementById('frame-art');
        if (!frameScene || !frameArt) return;

        const applyBounds = () => {
            const img = frameArt;
            if (!img.naturalWidth || !img.naturalHeight) return;

            const scale = 0.25;
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, w, h);

            const data = ctx.getImageData(0, 0, w, h).data;
            const visited = new Uint8Array(w * h);
            const isWhite = (idx) => {
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];
                if (a <= 200) return false;
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const brightness = (r + g + b) / 3;
                // Accept pure white or warm off-white (monitor glow) by brightness + low color variance
                if (brightness >= 235 && (max - min) <= 20) return true;
                if (brightness >= 220 && (max - min) <= 35) return true;
                return false;
            };

            let best = null;
            const queue = [];
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    if (visited[i]) continue;
                    const di = i * 4;
                    if (!isWhite(di)) {
                        visited[i] = 1;
                        continue;
                    }
                    let minX = x, maxX = x, minY = y, maxY = y, area = 0;
                    queue.length = 0;
                    queue.push(i);
                    visited[i] = 1;
                    while (queue.length) {
                        const idx = queue.pop();
                        const cy = Math.floor(idx / w);
                        const cx = idx - cy * w;
                        area += 1;
                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
                        for (const n of neighbors) {
                            if (n < 0 || n >= w * h) continue;
                            if (visited[n]) continue;
                            const ni = n * 4;
                            if (!isWhite(ni)) {
                                visited[n] = 1;
                                continue;
                            }
                            visited[n] = 1;
                            queue.push(n);
                        }
                    }

                    if (!best || area > best.area) {
                        best = { minX, maxX, minY, maxY, area };
                    }
                }
            }

            const minArea = Math.floor(w * h * 0.05);
            if (!best || best.area < minArea) {
                // Fallback for the retro frame asset if detection fails.
                // Use natural image size so values scale with the frame.
                const fallbackW = 470 * 1.04;
                const fallbackH = 330 * 1.04;
                const leftPx = (img.naturalWidth / 2) - 275 - 17;
                const topPx = (img.naturalHeight / 2) - 280 - 29;

                frameScene.style.setProperty('--screen-x', `${(leftPx / img.naturalWidth) * 100}%`);
                frameScene.style.setProperty('--screen-y', `${(topPx / img.naturalHeight) * 100}%`);
                frameScene.style.setProperty('--screen-w', `${(fallbackW / img.naturalWidth) * 100}%`);
                frameScene.style.setProperty('--screen-h', `${(fallbackH / img.naturalHeight) * 100}%`);
                return;
            }

            const padding = 3;
            const minX = Math.max(0, best.minX + padding);
            const maxX = Math.min(w - 1, best.maxX - padding);
            const minY = Math.max(0, best.minY + padding);
            const maxY = Math.min(h - 1, best.maxY - padding);

            const sceneRect = frameScene.getBoundingClientRect();
            const imgRect = frameArt.getBoundingClientRect();
            const scaleX = imgRect.width / img.naturalWidth;
            const scaleY = imgRect.height / img.naturalHeight;

            const screenLeft = (minX / scale) * scaleX + (imgRect.left - sceneRect.left);
            const screenTop = (minY / scale) * scaleY + (imgRect.top - sceneRect.top);
            const screenWidth = ((maxX - minX) / scale) * scaleX;
            const screenHeight = ((maxY - minY) / scale) * scaleY;

            const xPct = (screenLeft / sceneRect.width) * 100;
            const yPct = (screenTop / sceneRect.height) * 100;
            const wPct = (screenWidth / sceneRect.width) * 100;
            const hPct = (screenHeight / sceneRect.height) * 100;

            frameScene.style.setProperty('--screen-x', `${xPct}%`);
            frameScene.style.setProperty('--screen-y', `${yPct}%`);
            frameScene.style.setProperty('--screen-w', `${wPct}%`);
            frameScene.style.setProperty('--screen-h', `${hPct}%`);
        };

        if (frameArt.complete) {
            applyBounds();
        } else {
            frameArt.onload = applyBounds;
        }
    };

    detectFrameScreen();

    // Make music hint clickable
    const musicHint = document.querySelector('.music-hint');
    if (musicHint) {
        musicHint.addEventListener('click', () => {
            if (typeof audioManager !== 'undefined') {
                const muted = audioManager.toggleMute();
                musicHint.innerHTML = muted 
                    ? '<kbd>M</kbd> Music OFF' 
                    : '<kbd>M</kbd> Toggle Music';
            }
        });
    }

    // Get canvas element
    const canvas = document.getElementById('game-canvas');

    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    // Create game instance
    const game = new Game(canvas);
    window.game = game; // expose for debugging

    // Start game
    game.start();

    // Initialize Map Editor (press E to toggle)
    if (typeof MapEditor !== 'undefined') {
        const mapEditor = new MapEditor(game);
        window.mapEditor = mapEditor;
        game.mapEditor = mapEditor; // Store reference on game for interior loading
        console.log('🗺️ Map Editor loaded - Press E to toggle');
    }

    console.log('🦀 Claw World Started!');
    console.log('Controls: WASD to move, Space to interact');
    console.log('Press ` (backtick) to toggle debug mode');
    console.log('Press M to toggle music');
    console.log('Press B to toggle bot mode (AI players)');
    console.log('Press E to toggle Map Editor');

    // Setup keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            e.preventDefault();
            game.toggleDebug();
        }
        // Toggle numbered tileset for debugging
        else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            if (game && typeof game.toggleNumberedTileset === 'function') {
                game.toggleNumberedTileset();
            }
        }
        // Debug: Hold Shift+R to reset character (clear localStorage)
        else if (e.key === 'R' && e.shiftKey) {
            e.preventDefault();
            if (confirm('Reset your character? This will delete your saved data.')) {
                localStorage.removeItem('lobster_rpg_character');
                location.reload();
            }
        }
        // Force reload character sprites (Shift+L)
        else if ((e.key === 'L' || e.key === 'l') && e.shiftKey) {
            e.preventDefault();
            if (game && typeof game.reloadCharacterAssets === 'function') {
                game.reloadCharacterAssets();
            }
        }
        // Toggle music (M)
        else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            if (typeof audioManager !== 'undefined') {
                const muted = audioManager.toggleMute();
                console.log(`🎵 Music ${muted ? 'muted' : 'unmuted'}`);
                const hint = document.querySelector('.music-hint');
                if (hint) {
                    hint.innerHTML = muted 
                        ? '<kbd>M</kbd> Music OFF' 
                        : '<kbd>M</kbd> Toggle Music';
                }
            }
        }
        // Volume controls (+ / -)
        else if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            if (typeof audioManager !== 'undefined') {
                audioManager.setVolume(audioManager.volume + 0.1);
                console.log(`🔊 Volume: ${Math.round(audioManager.volume * 100)}%`);
            }
        }
        else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            if (typeof audioManager !== 'undefined') {
                audioManager.setVolume(audioManager.volume - 0.1);
                console.log(`🔉 Volume: ${Math.round(audioManager.volume * 100)}%`);
            }
        }
        // Toggle bot mode (B)
        else if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            if (game) {
                if (game.botEnabled) {
                    game.disableBotMode();
                } else {
                    game.enableBotMode();
                }
            }
        }
        // Toggle faction UI (F)
        else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (game && game.factionUI) {
                game.factionUI.toggle();
            }
        }
    });

    // Make game accessible for debugging
    window.game = game;

    // Initialize touch controls for mobile
    if (typeof TouchControls !== 'undefined') {
        const touchControls = new TouchControls(game);
        touchControls.init();
        window.touchControls = touchControls;
        
        // Show touch controls when player enters game
        const checkTouchReady = setInterval(() => {
            if (game.player && game.characterName) {
                clearInterval(checkTouchReady);
                touchControls.show();
            }
        }, 500);
    }

    // Check for auto bot mode via query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('botMode') === 'true') {
        console.log('🤖 Auto bot mode enabled via query param');
        // Wait for game to be ready, then enable bot mode
        const checkReady = setInterval(() => {
            if (game.player && game.worldMap) {
                clearInterval(checkReady);
                game.enableBotMode();
                console.log('🤖 Bot mode activated - ready for connections');
            }
        }, 500);
    }

    // Auto-connect to multiplayer when player enters world
    if (window.CONFIG?.MULTIPLAYER_ENABLED !== false) {
        console.log('🌐 Multiplayer auto-connect enabled');
        const checkMultiplayerReady = setInterval(() => {
            // Wait for characterName to be set (means player finished character creation)
            if (game.player && game.characterName && game.worldMap) {
                clearInterval(checkMultiplayerReady);
                console.log(`🌐 Character ready: ${game.characterName}`);
                game.enableMultiplayer();
                // Small delay to ensure connection is established
                setTimeout(() => game.joinMultiplayer(), 1000);
            }
        }, 500);
    }

    // Deterministic stepping hook for automated tests
    window.advanceTime = (ms) => {
        if (game && typeof game.advanceTime === 'function') {
            game.advanceTime(ms);
        }
    };

    // Text state snapshot for automated tests
    window.render_game_to_text = () => {
        if (game && typeof game.getTextState === 'function') {
            return game.getTextState();
        }
        return JSON.stringify({ error: 'Game not ready' });
    };
});
