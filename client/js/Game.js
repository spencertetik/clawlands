// Main game class that coordinates all systems
class Game {
    constructor(canvas) {
        this.canvas = canvas;

        // Setup canvas dimensions
        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

        // Seeded random for deterministic world generation (multiplayer sync)
        this.worldSeed = 12345;
        this._rngState = this.worldSeed;
        
        // Initialize core systems
        this.inputManager = new InputManager();

        // Create world map - larger Clawlands archipelago
        const worldTilesWide = 200;
        const worldTilesHigh = 200;
        this.worldMap = new WorldMap(worldTilesWide, worldTilesHigh, CONSTANTS.TILE_SIZE);
        
        // Reset RNG for deterministic world (multiplayer sync)
        this.resetRng();
        
        // Create Clawlands archipelago with larger, more distinct islands
        const islands = this.worldMap.createClawlandsArchipelago({
            seed: 12345,
            islandCount: 10,  // More islands!
            minIslandSize: 14,
            maxIslandSize: 28,
            bridgeChance: 0.9  // More bridges between islands
        });
        if (typeof EDITOR_MAP_DATA !== 'undefined' && EDITOR_MAP_DATA.terrainMap) {
            const flat = EDITOR_MAP_DATA.terrainMap;
            const w = EDITOR_MAP_DATA.terrainWidth || 200;
            const h = EDITOR_MAP_DATA.terrainHeight || 200;
            // Convert flat 1D array to 2D grid if needed
            if (Array.isArray(flat) && !Array.isArray(flat[0])) {
                const grid = [];
                for (let r = 0; r < h; r++) {
                    grid.push(flat.slice(r * w, r * w + w));
                }
                this.worldMap.terrainMap = grid;
            } else {
                this.worldMap.terrainMap = flat;
            }
            if (EDITOR_MAP_DATA.terrainWidth) this.worldMap.width = w;
            if (EDITOR_MAP_DATA.terrainHeight) this.worldMap.height = h;
            // Re-run auto-tiler on editor terrain for smooth transitions
            const autoTiler = new AutoTiler();
            const tiledLayer = autoTiler.autoTileLayer(this.worldMap.terrainMap, w, h);
            this.worldMap.groundLayer = this.worldMap.createEmptyLayer();
            for (let row = 0; row < h; row++) {
                for (let col = 0; col < w; col++) {
                    this.worldMap.setTile(this.worldMap.groundLayer, col, row, tiledLayer[row][col]);
                }
            }
            console.log('✅ Re-auto-tiled editor terrain for smooth transitions');
        }
        this.outdoorMap = this.worldMap;

        this.worldWidth = worldTilesWide * CONSTANTS.TILE_SIZE;
        this.worldHeight = worldTilesHigh * CONSTANTS.TILE_SIZE;

        this.camera = new Camera(
            CONSTANTS.VIEWPORT_WIDTH,
            CONSTANTS.VIEWPORT_HEIGHT,
            this.worldWidth,
            this.worldHeight
        );

        this.renderer = new RenderEngine(this.canvas, this.camera);

        // Create tile renderer
        this.tileRenderer = new TileRenderer(this.renderer, this.camera);
        this.tileRenderer.setWorldMap(this.worldMap);

        // Create sprite renderer and animation system
        this.spriteRenderer = new SpriteRenderer(this.renderer);
        this.animationSystem = new AnimationSystem();

        // Asset loader
        this.assetLoader = new AssetLoader();
        
        // Decoration sprite loader
        this.decorationLoader = new DecorationLoader();
        
        // Interior furniture sprite loader
        this.interiorLoader = new InteriorLoader();

        // Find spawn location on first island
        const spawnLocation = this.findPlayerSpawnLocation(islands);

        // Create player on an island
        this.player = new Player(
            spawnLocation.x,
            spawnLocation.y,
            'ClawAgent'
        );

        // Set camera to follow player
        this.camera.setTarget(this.player);

        // Collision system with world map
        this.collisionSystem = new CollisionSystem(this.worldMap);

        // Buildings, signs, and chronicle stones
        this.buildings = [];
        this.signs = [];
        this.chronicleStones = [];
        this.bulletinBoards = []; // 4claw.org bulletin boards
        this.outdoorBuildings = [];
        this.outdoorSigns = [];
        this.outdoorChronicleStones = [];
        this.outdoorBulletinBoards = [];
        this.pendingIslands = islands; // Store islands for building creation after assets load
        this.activeChronicleStone = null; // Currently interacting stone
        this.activeBulletinBoard = null; // Currently interacting bulletin board
        
        // NPCs (active for current map)
        this.npcs = [];
        this.outdoorNPCs = [];
        this.blockerState = {};
        
        // Decorations (plants, shells, rocks)
        this.decorations = [];
        this.outdoorDecorations = [];
        
        // Game active state - false until welcome screen is dismissed
        this.gameActive = false;

        // Dialog system
        this.dialogSystem = new DialogSystem();

        // Sound effects system
        this.sfx = new SoundEffects();

        // Story systems (Continuity, Quests, NPC Memory, Factions)
        this.continuitySystem = typeof ContinuitySystem !== 'undefined' ? new ContinuitySystem() : null;
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem(this.continuitySystem) : null;
        this.npcMemory = typeof NPCMemory !== 'undefined' ? new NPCMemory() : null;
        this.factionSystem = typeof FactionSystem !== 'undefined' ? new FactionSystem() : null;
        
        // Inventory system
        this.inventorySystem = typeof InventorySystem !== 'undefined' ? new InventorySystem('default') : null;
        this.inventoryUI = null; // Created after inventory system
        if (this.inventorySystem) {
            this.inventoryUI = typeof InventoryUI !== 'undefined' ? new InventoryUI(this.inventorySystem) : null;
            console.log('🎒 Inventory system initialized');
        }

        // Quest manager (unified fetch quests from ItemQuestData + QuestData)
        this.questManager = typeof QuestManager !== 'undefined' ? new QuestManager('default') : null;
        if (this.questManager) {
            console.log('📦 Quest manager initialized');
        }
        
        // Quest Log UI
        this.questLogUI = null;
        if (this.questSystem || this.questManager) {
            this.questLogUI = typeof QuestLogUI !== 'undefined' ? new QuestLogUI(this.questSystem, this.questManager) : null;
            if (this.questLogUI) {
                console.log('📜 Quest Log UI initialized');
            }
        }
        
        // Opened chest tracking (persisted per player)
        this.openedChests = this.loadOpenedChests();
        
        // World items (collectible pickups)
        this.worldItems = [];
        this.outdoorWorldItems = [];
        this.worldItemCheckTimer = 0;
        
        // Item quest completion tracking
        this.completedItemQuests = typeof loadCompletedItemQuests !== 'undefined' ? loadCompletedItemQuests() : new Set();
        
        // The Great Book (Church of Molt scripture)
        this.greatBooks = [];
        
        if (this.continuitySystem) {
            console.log('📊 Story systems initialized');
        }
        if (this.factionSystem) {
            console.log('⚔️ Faction system initialized');
            // Create faction UI
            this.factionUI = typeof FactionUI !== 'undefined' ? new FactionUI(this.factionSystem) : null;
        }

        // Combat system
        this.combatSystem = typeof CombatSystem !== 'undefined' ? new CombatSystem(this) : null;
        if (this.combatSystem) {
            console.log('⚔️ Combat system initialized');
        }

        // Currency system
        this.currencySystem = typeof CurrencySystem !== 'undefined' ? new CurrencySystem() : null;
        if (this.currencySystem) {
            console.log('🪙 Currency system initialized');
        }

        // Shop system
        this.shopSystem = typeof ShopSystem !== 'undefined' ? new ShopSystem(this) : null;
        this.innSystem = typeof InnSystem !== 'undefined' ? new InnSystem(this) : null;
        this.feedbackSystem = typeof FeedbackSystem !== 'undefined' ? new FeedbackSystem(this) : null;
        if (this.shopSystem) {
            console.log('🏪 Shop system initialized');
        }

        // Drift Reset system (soft death when Continuity drops too low)
        this.driftReset = typeof DriftReset !== 'undefined' ? new DriftReset(this) : null;
        if (this.driftReset) {
            console.log('🔴 Drift Reset system initialized');
        }

        // World visual effects
        // DISABLED: Red Current overlay
        // this.redCurrent = typeof RedCurrent !== 'undefined' ? 
        //     new RedCurrent(this.worldWidth, this.worldHeight) : null;
        this.redCurrent = null;
        
        // Special world objects (created after assets load)
        this.waygates = [];
        this.stabilityEngine = null;
        
        // Day/night cycle
        this.dayNightCycle = typeof DayNightCycle !== 'undefined' ? new DayNightCycle() : null;
        
        // DISABLED: Red Current initialization
        // if (this.redCurrent) {
        //     this.redCurrent.setWorldMap(this.worldMap);
        //     console.log('🌊 Red Current initialized');
        // }
        if (this.dayNightCycle) {
            console.log(`🌅 Day/Night cycle initialized (${this.dayNightCycle.getTimePeriodName()})`);
        }
        
        // Continuity UI meter — DISABLED: now rendered on canvas in unified HUD
        // this.continuityMeter = typeof ContinuityMeter !== 'undefined' ? new ContinuityMeter() : null;
        this.continuityMeter = null;
        
        // Weather system
        this.weatherSystem = typeof WeatherSystem !== 'undefined' ? 
            new WeatherSystem(this.worldWidth, this.worldHeight) : null;
        
        if (this.weatherSystem) {
            console.log(`🌤️ Weather system initialized (${this.weatherSystem.getWeatherName()})`);
        }
        
        // Visual enhancement systems
        this.waterRenderer = typeof WaterRenderer !== 'undefined' ? new WaterRenderer() : null;
        this.lightingSystem = typeof LightingSystem !== 'undefined' ? new LightingSystem() : null;
        this.shoreRenderer = typeof ShoreRenderer !== 'undefined' ? new ShoreRenderer() : null;
        
        if (this.waterRenderer) {
            console.log('🌊 Water animation system initialized');
        }
        if (this.lightingSystem) {
            console.log('🌅 Lighting system initialized');
        }
        if (this.shoreRenderer) {
            console.log('🏖️ Shore transition system initialized');
        }
        
        // Minimap (created after world is generated)
        this.minimap = null;
        
        // Footstep effects
        this.footstepEffects = typeof FootstepEffects !== 'undefined' ? new FootstepEffects() : null;

        // Player count overlay
        this.playerCountEl = null;
        this.playerCountTimer = 0;

        // Map state
        this.currentLocation = 'outdoor';
        this.currentBuilding = null;
        this.outdoorReturnTile = null;

        // Game state
        this.running = false;
        this.lastTime = 0;
        this.fps = 60;
        this.fpsUpdateTime = 0;
        this.frameCount = 0;
        this.assetsLoaded = false;
        this.isTransitioning = false;
        this.lastExitTime = 0; // Cooldown to prevent immediate re-entry after exiting
        this.lastEntryTime = 0; // Cooldown to prevent immediate exit after entering

        // Debug mode (off by default, toggle with backtick key, or ?debug=true URL param)
        const urlParams = new URLSearchParams(window.location.search);
        this.debugMode = urlParams.get('debug') === 'true';
        
        // Dev mode (developer tools access) - toggle with Cmd+Shift+D / Ctrl+Shift+D
        this.devMode = false;
        
        // Spectator mode — ?spectate=BotName to follow a remote player
        this.spectateTarget = urlParams.get('spectate');
        this.spectateMode = !!this.spectateTarget;
        this.spectatePlayer = null; // RemotePlayer we're following
        // (numbered tileset debug feature removed)

        // Controls help overlay
        this.controlsVisible = false;
        this._setupControlsHelp();

        // Canvas HUD panel state (replaces DOM #hud-panel)
        this.hudPanelData = {
            musicMuted: false,
            humans: 1,
            bots: 0,
            total: 1
        };

        // Character customization
        this.characterBuilder = new CharacterBuilder();
        this.characterConfig = null;
        this.characterName = null;
        this.customizationData = new CustomizationData();

        // Bot API for AI players
        this.botBridge = null;
        this.botEnabled = false;

        // Multiplayer client
        this.multiplayer = null;
        this.multiplayerEnabled = false;

        // Load assets
        this.loadAssets();
    }

    // Enable multiplayer - connects to shared world server
    enableMultiplayer() {
        if (typeof MultiplayerClient === 'undefined') {
            console.error('MultiplayerClient not loaded');
            return;
        }
        
        this.multiplayer = new MultiplayerClient(this);
        this.multiplayerClient = this.multiplayer; // Alias for compatibility
        this.multiplayer.connect();
        this.multiplayerEnabled = true;
        
        // Add remote players to collision system
        this.collisionSystem.setRemotePlayers(this.multiplayer.remotePlayers);
        
        console.log('🌐 Multiplayer enabled - connecting to shared world');
    }

    // Join multiplayer after character is ready
    joinMultiplayer() {
        if (this.multiplayer && this.player) {
            this.multiplayer.join();
        }
    }

    // Disable multiplayer
    disableMultiplayer() {
        if (this.multiplayer) {
            this.multiplayer.disconnect();
            this.multiplayer = null;
        }
        this.multiplayerEnabled = false;
        console.log('🌐 Multiplayer disabled');
    }

    // Seeded random number generator for deterministic world generation
    // All clients with same seed get identical worlds
    seededRandom() {
        this._rngState = (this._rngState * 1103515245 + 12345) & 0x7fffffff;
        return this._rngState / 0x7fffffff;
    }

    // Reset RNG to initial state (call before world generation)
    resetRng() {
        this._rngState = this.worldSeed;
    }

    // Enable bot mode - connects to bot server for AI player control
    enableBotMode() {
        if (typeof BotBridge === 'undefined') {
            console.error('BotBridge not loaded. Make sure bot scripts are included.');
            return;
        }
        this.botBridge = new BotBridge(this);
        this.botBridge.connect();
        this.botEnabled = true;
        
        // Disable player keyboard controls (bots control via direct key manipulation)
        if (this.inputManager) {
            this.inputManager.setDisabled(true);
        }
        
        console.log('🤖 Bot mode enabled - AI players can now connect');
    }

    // Disable bot mode
    disableBotMode() {
        if (this.botBridge) {
            this.botBridge.disconnect();
            this.botBridge = null;
        }
        this.botEnabled = false;
        
        // Re-enable player keyboard controls
        if (this.inputManager) {
            this.inputManager.setDisabled(false);
        }
        
        console.log('🤖 Bot mode disabled');
    }

    // Start the game loop
    start() {
        if (this.spectateMode) {
            // Spectator mode — skip welcome/character creation, just watch
            this.startSpectatorMode();
        } else {
            // Always show the welcome screen (intro sequence plays every time).
            // The welcome screen handles returning players by skipping character
            // creation when PRESS START is clicked if a saved character exists.
            this.showWelcomeScreen();
        }

        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    // Start spectator mode — skip intro, connect multiplayer, follow target bot
    startSpectatorMode() {
        console.log(`👁️ Spectator mode: watching "${this.spectateTarget}"`);
        
        // Hide retro frame art and go fullscreen — spectator needs the full canvas
        const frameArt = document.getElementById('frame-art');
        if (frameArt) frameArt.style.display = 'none';
        document.body.classList.add('fullscreen-mode');
        
        // Clear any overlay backdrop that might block the canvas
        const screenOverlay = document.getElementById('screen-overlay');
        if (screenOverlay) {
            screenOverlay.style.background = 'transparent';
            screenOverlay.style.pointerEvents = 'none';
        }
        
        // Show splash screen immediately (hides ugly world generation)
        this._showSpectatorSplash();
        
        // Disable input — spectators can't control anything (F for fullscreen handled in main.js)
        if (this.inputManager) {
            this.inputManager.setDisabled(true);
        }
        
        // Set a dummy character name so multiplayer join works
        this.characterName = `Spectator_${Date.now() % 10000}`;
        this.player.name = this.characterName;
        this.characterConfig = { species: 'lobster', hueShift: 0 };
        
        // Mark game as active so rendering works
        this.gameActive = true;
        
        // Hide the player off-screen (spectator is invisible)
        this.player.position.x = -1000;
        this.player.position.y = -1000;
        
        // Start ambient sounds
        if (this.sfx) {
            this.sfx.startOceanAmbient();
            this.sfx.startWindAmbient();
            this.sfx.startBirdAmbient();
        }
        
        // Show spectator overlay
        this._showSpectatorOverlay();
        
        // Show minimap in spectator mode
        if (this.minimap) {
            this.minimap.show();
        }
        
        // Enable multiplayer and start scanning for target
        this.enableMultiplayer();
        setTimeout(() => {
            this.joinMultiplayer();
            this._startSpectatorScan();
        }, 1500);
    }
    
    // Full-screen splash screen that covers the game during spectator load
    _showSpectatorSplash() {
        this._splashShownAt = Date.now();
        this._splashPlayerFound = false;
        this._splashMinTime = 4000; // Minimum 4 seconds on splash
        
        const splash = document.createElement('div');
        splash.id = 'spectator-splash';
        splash.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-family: monospace; font-size: 42px; font-weight: bold; letter-spacing: 8px; margin-bottom: 16px;">
                    <span style="color: #c43a24;">CLAW</span><span style="color: #e8d5cc;">LANDS</span>
                </div>
                <div style="font-family: monospace; font-size: 13px; color: #8a7068; letter-spacing: 2px;">
                    SPECTATOR MODE
                </div>
                <div id="splash-status" style="font-family: monospace; font-size: 11px; color: #5a4a42; margin-top: 24px; letter-spacing: 1px;">
                    Loading world...
                </div>
                <div style="margin-top: 20px; width: 160px; height: 3px; background: #1a1210; border-radius: 2px; overflow: hidden;">
                    <div id="splash-bar" style="width: 0%; height: 100%; background: #c43a24; transition: width 0.8s ease;"></div>
                </div>
            </div>
        `;
        splash.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #0d0806; z-index: 10000;
            transition: opacity 1s ease;
        `;
        document.body.appendChild(splash);
        
        // Animate progress bar through loading stages
        setTimeout(() => { const b = document.getElementById('splash-bar'); if (b) b.style.width = '20%'; }, 400);
        setTimeout(() => { const b = document.getElementById('splash-bar'); if (b) b.style.width = '40%'; }, 1200);
        setTimeout(() => { 
            const b = document.getElementById('splash-bar'); if (b) b.style.width = '55%';
            const s = document.getElementById('splash-status'); if (s) s.textContent = 'Loading assets...';
        }, 2000);
        setTimeout(() => { 
            const b = document.getElementById('splash-bar'); if (b) b.style.width = '70%';
            const s = document.getElementById('splash-status'); if (s) s.textContent = 'Connecting to server...';
        }, 3000);
        setTimeout(() => { 
            const s = document.getElementById('splash-status'); 
            if (s && !this._splashPlayerFound) s.textContent = 'Searching for AI agent...';
        }, 4500);
    }
    
    // Called when spectate target is found — wait for assets + min time, then fade
    _dismissSpectatorSplash() {
        this._splashPlayerFound = true;
        
        // Update status
        const s = document.getElementById('splash-status');
        if (s) s.textContent = 'Player found!';
        const b = document.getElementById('splash-bar');
        if (b) b.style.width = '90%';
        
        // Wait for BOTH: assets loaded + minimum display time
        const checkReady = () => {
            const elapsed = Date.now() - (this._splashShownAt || 0);
            const timeReady = elapsed >= this._splashMinTime;
            const assetsReady = this.assetsLoaded;
            
            if (timeReady && assetsReady) {
                // All good — fade out
                const bar = document.getElementById('splash-bar');
                if (bar) bar.style.width = '100%';
                const status = document.getElementById('splash-status');
                if (status) status.textContent = 'Entering world...';
                
                setTimeout(() => {
                    const splash = document.getElementById('spectator-splash');
                    if (splash) {
                        splash.style.opacity = '0';
                        setTimeout(() => splash.remove(), 1000);
                    }
                }, 600);
            } else {
                // Not ready yet — check again in 200ms
                if (!assetsReady) {
                    const status = document.getElementById('splash-status');
                    if (status) status.textContent = 'Loading assets...';
                }
                setTimeout(checkReady, 200);
            }
        };
        
        checkReady();
    }

    // Continuously scan for the spectate target among remote players
    // Handles reconnects: if the bot drops and comes back with a new ID, we re-lock
    _startSpectatorScan() {
        let scanCount = 0;
        this._spectatorScanInterval = setInterval(() => {
            if (!this.multiplayer) return;
            scanCount++;
            
            const playerCount = this.multiplayer.remotePlayers.size;
            
            // Always update HUD player count
            this._updateSpectateHUD();
            
            // If we have a target, check it's still in the player list
            if (this.spectatePlayer) {
                let stillExists = false;
                for (const [id, remote] of this.multiplayer.remotePlayers) {
                    if (remote === this.spectatePlayer) { stillExists = true; break; }
                }
                if (!stillExists) {
                    console.log(`👁️ Lost spectate target — scanning for reconnect...`);
                    this.spectatePlayer = null;
                    this._updateSpectateHUD();
                    const status = document.getElementById('spectate-status');
                    if (status) { status.textContent = 'Reconnecting...'; status.style.color = '#c43a24'; }
                } else {
                    return; // Still locked on — skip scan
                }
            }
            
            if (scanCount % 4 === 0) { // Log every 2 seconds
                console.log(`👁️ Scanning... ${playerCount} remote players found`);
                for (const [id, remote] of this.multiplayer.remotePlayers) {
                    console.log(`   - "${remote.name}" at (${Math.round(remote.position.x)}, ${Math.round(remote.position.y)})`);
                }
            }
            
            // Auto-find initial target (first connect or after losing target)
            // Only bots are spectatable — humans are excluded
            let bestMatch = null;
            for (const [id, remote] of this.multiplayer.remotePlayers) {
                if (!remote.isBot) continue; // Skip humans
                if (this.spectateTarget === '*') {
                    bestMatch = remote; break;
                } else if (remote.name.toLowerCase() === this.spectateTarget.toLowerCase()) {
                    bestMatch = remote; break;
                }
            }
            if (bestMatch) {
                this._lockSpectateTarget(bestMatch);
            }
        }, 500);
    }

    // Show spectator UI overlay with player cycling and search
    _showSpectatorOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'spectator-overlay';
        overlay.style.cssText = `
            position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
            background: rgba(13, 8, 6, 0.9); border: 2px solid #c43a24;
            border-radius: 8px; padding: 8px 16px; z-index: 1000;
            font-family: monospace; color: #e8d5cc; text-align: center;
            pointer-events: auto; min-width: 260px;
        `;
        overlay.innerHTML = `
            <div style="font-size: 10px; color: #8a7068; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Spectator Mode</div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <button id="spectate-prev" title="Previous player" style="
                    background: rgba(196,58,36,0.2); border: 1px solid #c43a24; color: #c43a24;
                    font-size: 18px; width: 32px; height: 32px; border-radius: 4px;
                    cursor: pointer; font-family: monospace; display: flex; align-items: center;
                    justify-content: center; transition: background 0.15s;
                ">◀</button>
                <div style="flex: 1; min-width: 120px;">
                    <div id="spectate-label" style="font-size: 15px; font-weight: bold; color: #e8d5cc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Searching...</div>
                    <div id="spectate-status" style="font-size: 10px; color: #c43a24;"></div>
                </div>
                <button id="spectate-next" title="Next player" style="
                    background: rgba(196,58,36,0.2); border: 1px solid #c43a24; color: #c43a24;
                    font-size: 18px; width: 32px; height: 32px; border-radius: 4px;
                    cursor: pointer; font-family: monospace; display: flex; align-items: center;
                    justify-content: center; transition: background 0.15s;
                ">▶</button>
            </div>
            <div style="margin-top: 6px; display: flex; gap: 4px;">
                <input id="spectate-search" type="text" placeholder="Jump to bot..." style="
                    flex: 1; background: rgba(13,8,6,0.8); border: 1px solid #3a2a22; color: #e8d5cc;
                    padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 11px;
                    outline: none;
                " />
                <button id="spectate-go" title="Watch this player" style="
                    background: #c43a24; border: none; color: #fff; padding: 4px 10px;
                    border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 11px;
                    font-weight: bold;
                ">GO</button>
            </div>
            <div id="spectate-player-count" style="font-size: 9px; color: #5a4a42; margin-top: 4px;"></div>
        `;
        document.body.appendChild(overlay);

        // Wire up buttons
        document.getElementById('spectate-prev').addEventListener('click', () => this._cycleSpectateTarget(-1));
        document.getElementById('spectate-next').addEventListener('click', () => this._cycleSpectateTarget(1));

        // Hover effects
        for (const btn of overlay.querySelectorAll('button')) {
            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(196,58,36,0.5)'; });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = btn.id === 'spectate-go' ? '#c43a24' : 'rgba(196,58,36,0.2)';
            });
        }

        // Search input
        const searchInput = document.getElementById('spectate-search');
        const goBtn = document.getElementById('spectate-go');

        const doSearch = () => {
            const name = searchInput.value.trim();
            if (!name) return;
            this._switchToPlayerByName(name);
            searchInput.value = '';
            searchInput.blur();
        };

        goBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Don't let game key handler eat these
            if (e.key === 'Enter') doSearch();
            if (e.key === 'Escape') { searchInput.value = ''; searchInput.blur(); }
        });
        // Prevent game from blocking typing in the input
        searchInput.addEventListener('keyup', (e) => e.stopPropagation());
        searchInput.addEventListener('keypress', (e) => e.stopPropagation());
    }

    // Get sorted list of bots for spectator cycling (humans excluded)
    _getSpectatePlayerList() {
        if (!this.multiplayer) return [];
        const players = [];
        for (const [id, remote] of this.multiplayer.remotePlayers) {
            if (remote.isBot) players.push(remote);
        }
        // Alphabetical by name
        players.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return players;
    }

    // Cycle to next/previous player in spectator mode
    _cycleSpectateTarget(direction) {
        const players = this._getSpectatePlayerList();
        if (players.length === 0) return;

        let currentIdx = -1;
        if (this.spectatePlayer) {
            currentIdx = players.indexOf(this.spectatePlayer);
        }

        let nextIdx = currentIdx + direction;
        if (nextIdx < 0) nextIdx = players.length - 1;
        if (nextIdx >= players.length) nextIdx = 0;

        this._lockSpectateTarget(players[nextIdx]);
    }

    // Switch to a specific bot by name (humans excluded from spectating)
    _switchToPlayerByName(name) {
        if (!this.multiplayer) return;
        const lower = name.toLowerCase();
        for (const [id, remote] of this.multiplayer.remotePlayers) {
            if (remote.isBot && (remote.name || '').toLowerCase().includes(lower)) {
                this._lockSpectateTarget(remote);
                return;
            }
        }
        // Not found — show feedback
        const status = document.getElementById('spectate-status');
        if (status) {
            status.textContent = `Bot "${name}" not found`;
            status.style.color = '#c43a24';
        }
    }

    // Lock onto a specific player as spectate target
    _lockSpectateTarget(remote) {
        // Unmark old target
        if (this.spectatePlayer) {
            this.spectatePlayer._spectated = false;
        }

        this.spectatePlayer = remote;
        remote._spectated = true;
        this.spectateTarget = remote.name; // Update so auto-scan re-finds this player on reconnect

        // Camera follow
        this.camera.setTarget(remote);
        this.camera.lerpSpeed = 0.5;

        // Update HUD
        this._updateSpectateHUD();

        // Dismiss splash if still showing
        this._dismissSpectatorSplash();

        console.log(`👁️ Now watching: ${remote.name}`);
    }

    // Update the spectator HUD with current state
    _updateSpectateHUD() {
        const label = document.getElementById('spectate-label');
        const status = document.getElementById('spectate-status');
        const countEl = document.getElementById('spectate-player-count');
        const players = this._getSpectatePlayerList();

        if (this.spectatePlayer) {
            const p = this.spectatePlayer;
            const icon = p.isBot ? '🤖' : '👤';
            if (label) label.textContent = `${icon} ${p.name}`;
            if (status) {
                status.textContent = p.species ? `${p.species}` : 'Connected';
                status.style.color = '#4CAF50';
            }
        } else {
            if (label) label.textContent = 'Searching...';
            if (status) { status.textContent = ''; status.style.color = '#c43a24'; }
        }

        if (countEl) {
            const idx = this.spectatePlayer ? players.indexOf(this.spectatePlayer) + 1 : 0;
            countEl.textContent = players.length > 0
                ? `${idx} / ${players.length} bot${players.length !== 1 ? 's' : ''}`
                : 'No bots online';
        }
    }

    // Show welcome screen (plays every time — intro sequence, then game)
    showWelcomeScreen() {
        const welcomeScreen = new WelcomeScreen();
        welcomeScreen.show(async (result) => {
            // Set character data
            this.characterConfig = result.config;
            this.characterName = result.name;
            this.player.name = this.characterName;

            // Update inventory/currency storage key for this player
            if (this.inventorySystem) {
                this.inventorySystem.setPlayerName(this.characterName);
            }
            if (this.currencySystem) {
                this.currencySystem.setPlayerName(this.characterName);
            }
            if (this.questManager) {
                this.questManager.setPlayerName(this.characterName);
            }

            this.customizationData.save({
                config: result.config,
                name: result.name,
                createdAt: Date.now()
            });

            // Restore saved position for returning players
            try {
                const savedPosition = this.customizationData.loadPosition();
                if (savedPosition && savedPosition.x && savedPosition.y) {
                    this.player.x = savedPosition.x;
                    this.player.y = savedPosition.y;
                    console.log(`📍 Restored position: (${Math.round(savedPosition.x)}, ${Math.round(savedPosition.y)})`);
                }
            } catch (e) {
                console.warn('Could not load saved position:', e);
            }

            // Load species-specific sprites and apply customization
            if (this.assetsLoaded) {
                const species = this.characterConfig?.species || 'lobster';
                await this.reloadCharacterAssets(species);
            }

            const speciesEmoji = this.getSpeciesEmoji(this.characterConfig?.species);
            console.log(`${speciesEmoji} ${this.characterName} has entered Clawlands!`);
            
            // Show continuity meter after entering the world
            if (this.continuityMeter) {
                this.continuityMeter.show();
            }
            
            // Show minimap after entering the world
            if (this.minimap) {
                this.minimap.show();
            }
            
            // DISABLED: Trigger Drift-In effect at player position
            // if (this.redCurrent) {
            //     this.redCurrent.triggerDriftIn(this.player.position.x, this.player.position.y);
            // }
            
            // Mark game as active — item pickups, interactions etc. now enabled
            this.gameActive = true;
            
            // Start ambient sounds (ocean waves, wind, birds/insects)
            if (this.sfx) {
                this.sfx.startOceanAmbient();
                this.sfx.startWindAmbient();
                this.sfx.startBirdAmbient();
            }
            
            // Hide DOM HUD panel — now rendered on canvas
            const hudPanel = document.getElementById('hud-panel');
            if (hudPanel) hudPanel.style.display = 'none';
        });
    }

    // Get letter for species display
    getSpeciesEmoji(species) {
        const letters = {
            lobster: 'L',
            crab: 'C',
            shrimp: 'S',
            mantis_shrimp: 'M',
            hermit_crab: 'H'
        };
        return letters[species] || 'L';
    }

    // Stop the game loop
    stop() {
        this.running = false;
    }

    // Main game loop
    gameLoop(currentTime) {
        if (!this.running) return;

        try {
            // Calculate delta time in seconds
            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            // Update
            this.update(deltaTime);

            // Render
            this.render();

            // Update FPS counter
            this.updateFPS(deltaTime);
        } catch (e) {
            console.error('Game loop error:', e);
        }

        // Continue loop (always, even on error — prevents black screen)
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // Update game state
    update(deltaTime) {
        // Map editor pauses everything except camera (editor manages its own pan)
        if (this.editorPaused) {
            return;
        }

        // Spectator mode — only update camera + multiplayer (no player logic)
        if (this.spectateMode) {
            if (this.multiplayer) this.multiplayer.update(deltaTime);
            this.camera.update(deltaTime);
            if (this.dayNightCycle) this.dayNightCycle.update(deltaTime);
            if (this.weatherSystem) this.weatherSystem.update(deltaTime);
            // Update minimap in spectator mode — show all remote players
            if (this.minimap && this.currentLocation === 'outdoor') {
                const remotes = this.multiplayerClient ? Array.from(this.multiplayerClient.remotePlayers.values()) : [];
                // Use the spectated player as the "player" blip so they're highlighted
                const spectatedAsPlayer = this.spectatePlayer ? {
                    position: this.spectatePlayer.position,
                    direction: this.spectatePlayer.direction || 'south'
                } : null;
                // Filter the spectated player out of remotes so they don't double-render
                const filteredRemotes = this.spectatePlayer
                    ? remotes.filter(r => r !== this.spectatePlayer)
                    : remotes;
                this.minimap.update(deltaTime, spectatedAsPlayer, this.npcs, this.buildings, this.waygates, filteredRemotes);
                this.minimap.render();
            }
            return;
        }

        // Update input manager
        this.inputManager.update();

        // Update player (but freeze during dialog, inventory, or quest log)
        const dialogOpen = this.dialogSystem && this.dialogSystem.isOpen();
        const inventoryOpen = this.inventoryUI && this.inventoryUI.isOpen();
        const questLogOpen = this.questLogUI && this.questLogUI.isOpen();
        const innBusy = this.innSystem && (this.innSystem.isOpen || this.innSystem.isSleeping);
        const feedbackOpen = this.feedbackSystem && this.feedbackSystem.isOpen;
        if (!dialogOpen && !inventoryOpen && !questLogOpen && !innBusy && !feedbackOpen) {
            this.player.update(deltaTime, this.inputManager, this.collisionSystem);
        }

        // Update NPCs (with collision system for wandering)
        for (let npc of this.npcs) {
            npc.update(deltaTime, this.collisionSystem);
        }

        // Continuously push player away from NPCs (gentle nudge each frame)
        // Uses a small collision core so player can get close but not overlap
        // IMPORTANT: check collision before pushing to avoid pushing into walls/water
        if (this.player && this.npcs && this.currentLocation === 'outdoor') {
            for (const npc of this.npcs) {
                const playerBox = this.player.getCollisionBox ? this.player.getCollisionBox() : {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    width: this.player.width,
                    height: this.player.height
                };
                const npcBox = npc.getCollisionBox ? npc.getCollisionBox() : {
                    x: npc.position.x + 3,
                    y: npc.position.y + 4,
                    width: npc.width - 6,
                    height: npc.height - 6
                };
                const overlapping = !(
                    playerBox.x + playerBox.width <= npcBox.x || playerBox.x >= npcBox.x + npcBox.width ||
                    playerBox.y + playerBox.height <= npcBox.y || playerBox.y >= npcBox.y + npcBox.height
                );
                if (overlapping) {
                    const npcCX = npcBox.x + npcBox.width / 2;
                    const npcCY = npcBox.y + npcBox.height / 2;
                    const plCX = playerBox.x + playerBox.width / 2;
                    const plCY = playerBox.y + playerBox.height / 2;
                    let dx = plCX - npcCX;
                    let dy = plCY - npcCY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 0.1) { dx = 1; dy = 0; } else { dx /= dist; dy /= dist; }
                    const px = this.player.position.x;
                    const py = this.player.position.y;
                    // Check if push destination is valid before moving
                    const pushX = px + dx * 1.5;
                    const pushY = py + dy * 1.5;
                    const canPushX = !this.collisionSystem || !this.collisionSystem.isTileSolid(
                        Math.floor(pushX / CONSTANTS.TILE_SIZE),
                        Math.floor(py / CONSTANTS.TILE_SIZE)
                    );
                    const canPushY = !this.collisionSystem || !this.collisionSystem.isTileSolid(
                        Math.floor(px / CONSTANTS.TILE_SIZE),
                        Math.floor(pushY / CONSTANTS.TILE_SIZE)
                    );
                    if (canPushX) this.player.position.x = pushX;
                    if (canPushY) this.player.position.y = pushY;
                }
            }
        }

        // Stuck detection: if player is on a solid tile, nudge to nearest passable tile
        if (this.player && this.collisionSystem && this.currentLocation === 'outdoor') {
            const px = this.player.position.x;
            const py = this.player.position.y;
            const tileX = Math.floor(px / CONSTANTS.TILE_SIZE);
            const tileY = Math.floor(py / CONSTANTS.TILE_SIZE);
            if (this.collisionSystem.isTileSolid(tileX, tileY)) {
                // Player is ON a solid tile — search outward for a passable tile
                for (let r = 1; r <= 5; r++) {
                    let escaped = false;
                    for (let dy = -r; dy <= r && !escaped; dy++) {
                        for (let dx = -r; dx <= r && !escaped; dx++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check ring
                            if (!this.collisionSystem.isTileSolid(tileX + dx, tileY + dy)) {
                                this.player.position.x = (tileX + dx) * CONSTANTS.TILE_SIZE + 4;
                                this.player.position.y = (tileY + dy) * CONSTANTS.TILE_SIZE + 4;
                                escaped = true;
                            }
                        }
                    }
                    if (escaped) break;
                }
            }
        }

        // Update world items and check for pickups (every 0.15s for performance)
        // Don't pick up items until welcome screen is dismissed
        this.worldItemCheckTimer = (this.worldItemCheckTimer || 0) + deltaTime;
        if (this.gameActive && this.worldItems.length > 0) {
            // Update bobbing for nearby items only
            const px = this.player.position.x;
            const py = this.player.position.y;
            for (const worldItem of this.worldItems) {
                // Only update items within ~200px
                const dx = Math.abs(worldItem.x - px);
                const dy = Math.abs(worldItem.baseY - py);
                if (dx < 200 && dy < 200) {
                    worldItem.update(deltaTime);
                }
                
                // Check pickup on timer
                if (this.worldItemCheckTimer >= 0.15 && !worldItem.collected) {
                    if (worldItem.isPlayerNearby(px, py, this.player.width, this.player.height)) {
                        this.pickupWorldItem(worldItem);
                    }
                }
            }
            if (this.worldItemCheckTimer >= 0.15) {
                this.worldItemCheckTimer = 0;
            }
        }

        // Auto-enter buildings (Pokémon-style - walk into door to enter)
        this.checkAutoEnterBuilding();

        // Auto-exit buildings
        this.checkAutoExitBuilding();
        
        // Walk-through waygate teleportation
        this.checkWaygateWalkThrough();

        // Handle manual interactions (NPC dialog only now)
        this.handleInteractions();

        // Update camera
        this.camera.update(deltaTime);

        // Save position periodically (every 5 seconds)
        this.positionSaveTimer = (this.positionSaveTimer || 0) + deltaTime;
        if (this.positionSaveTimer >= 5.0) {
            this.positionSaveTimer = 0;
            try {
                this.customizationData.savePosition(this.player.x, this.player.y);
            } catch (e) {
                // Silently fail - position saving is not critical
            }
        }
        
        // Update music zone based on player position (check every 0.5 seconds when outdoors)
        if (this.currentLocation === 'outdoor' && typeof audioManager !== 'undefined') {
            this.musicZoneTimer = (this.musicZoneTimer || 0) + deltaTime;
            if (this.musicZoneTimer >= 0.5) {
                this.musicZoneTimer = 0;
                audioManager.updateZone(this.player.x, this.player.y);
            }
        }

        // Update multiplayer (other players)
        if (this.multiplayer && this.multiplayerEnabled) {
            this.multiplayer.update(deltaTime);
            // Update player count display every 2 seconds
            this.playerCountTimer += deltaTime;
            if (this.playerCountTimer >= 2.0) {
                this.playerCountTimer = 0;
                this.updatePlayerCount();
            }
        }
        
        // DISABLED: Update Red Current visual effect (outdoor only)
        // if (this.redCurrent && this.currentLocation === 'outdoor') {
        //     this.redCurrent.update(deltaTime);
        // }
        
        // Update Waygates (check visibility based on Continuity)
        if (this.waygates && this.continuitySystem) {
            const continuity = this.continuitySystem.value;
            for (const waygate of this.waygates) {
                waygate.updateVisibility(continuity);
                waygate.update(deltaTime);
            }
        }
        
        // Update Stability Engine
        if (this.stabilityEngine) {
            this.stabilityEngine.update(deltaTime);
        }
        
        // Update day/night cycle
        if (this.dayNightCycle) {
            this.dayNightCycle.update(deltaTime);
            this.dayNightCycle.render();
        }
        
        // Update continuity meter UI
        if (this.continuityMeter && this.continuitySystem) {
            const value = this.continuitySystem.value;
            const tier = this.continuitySystem.getTier();
            this.continuityMeter.setValue(value, tier);
            this.continuityMeter.update(deltaTime);
        }
        
        // Update Drift Reset system (monitor continuity for soft death)
        if (this.driftReset && this.gameActive) {
            this.driftReset.update();
        }

        // Update combat system (enemies, attacks, spawning)
        if (this.combatSystem && this.gameActive) {
            this.combatSystem.update(deltaTime);
        }

        // Update currency display animation (if method exists)
        if (this.currencySystem && this.currencySystem.update) {
            this.currencySystem.update(deltaTime);
        }
        
        // Update faction UI
        if (this.factionUI) {
            this.factionUI.update(deltaTime);
        }
        
        // Update weather system (outdoor only)
        if (this.weatherSystem && this.currentLocation === 'outdoor') {
            this.weatherSystem.update(deltaTime);
        }
        
        // Update visual enhancement systems
        if (this.waterRenderer) {
            this.waterRenderer.update(deltaTime);
        }
        if (this.lightingSystem) {
            this.lightingSystem.update(deltaTime);
        }
        
        // Update minimap (outdoor only)
        if (this.minimap && this.currentLocation === 'outdoor') {
            try {
                const remotes = this.multiplayerClient ? Array.from(this.multiplayerClient.remotePlayers.values()) : [];
                this.minimap.update(deltaTime, this.player, this.npcs, this.buildings, this.waygates, remotes);
                this.minimap.render();
            } catch (e) { /* minimap error won't block game render */ }
        }
        
        // Update footstep effects
        if (this.footstepEffects) {
            this.footstepEffects.update(deltaTime, this.player, this.worldMap);
        }
        
        // Update enemy proximity sounds (footsteps, growls approaching)
        if (this.sfx && this.combatSystem && this.player && this.gameActive) {
            this.sfx.updateEnemyProximity(
                this.combatSystem.enemies,
                this.player.position.x,
                this.player.position.y
            );
        }
        
        // Update ambient volumes based on player position
        if (this.sfx && this.sfx._oceanRunning && this.worldMap && this.player) {
            this._oceanCheckTimer = (this._oceanCheckTimer || 0) + deltaTime;
            if (this._oceanCheckTimer > 0.5) { // Check every 0.5s, not every frame
                this._oceanCheckTimer = 0;
                const tileSize = CONSTANTS.TILE_SIZE;
                const px = Math.floor(this.player.position.x / tileSize);
                const py = Math.floor(this.player.position.y / tileSize);
                
                // Check nearby tiles for water — closer to water = louder ocean
                let minWaterDist = 20; // tiles
                for (let dy = -15; dy <= 15; dy++) {
                    for (let dx = -15; dx <= 15; dx++) {
                        const tx = px + dx;
                        const ty = py + dy;
                        if (tx >= 0 && tx < this.worldMap.width && ty >= 0 && ty < this.worldMap.height) {
                            if (this.worldMap.terrainMap?.[ty]?.[tx] === 1) {
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist < minWaterDist) minWaterDist = dist;
                            }
                        }
                    }
                }
                
                // Map distance to volume (closer = louder, max at edge, silent far inland)
                const isOutdoor = this.currentLocation === 'outdoor';
                const oceanVol = minWaterDist < 3 ? 1.0 :
                                minWaterDist < 8 ? 0.6 :
                                minWaterDist < 15 ? 0.3 : 0.08;
                this.sfx.setOceanVolume(isOutdoor ? oceanVol : 0.03);
                
                // Wind is always present outdoors (subtle), louder near edges/shore
                const windVol = isOutdoor ? (minWaterDist < 5 ? 0.8 : 0.4) : 0.05;
                this.sfx.setWindVolume(windVol);
            }
        }
    }

    // Auto-enter building when player walks onto entrance (Pokémon-style)
    checkAutoEnterBuilding() {
        if (this.currentLocation !== 'outdoor') return;
        if (this.isTransitioning) return;
        if (this.dialogSystem && this.dialogSystem.isOpen()) return;
        
        // Exit cooldown - prevent immediate re-entry after exiting (2 seconds)
        if (this.lastExitTime && Date.now() - this.lastExitTime < 2000) return;

        const building = this.getBuildingAtPlayerEntrance();
        if (building) {
            console.log(`🚪 Auto-entering ${building.name}`);
            this.enterBuilding(building);
        }
    }

    // Auto-exit building when player walks onto or near exit tile
    checkAutoExitBuilding() {
        if (this.currentLocation !== 'interior') return;
        if (this.isTransitioning) return;
        if (this.dialogSystem && this.dialogSystem.isOpen()) return;
        
        // Entry cooldown - prevent immediate exit after entering (1 second)
        if (this.lastEntryTime && Date.now() - this.lastEntryTime < 1000) return;

        const exitTile = this.worldMap?.meta?.exitTile;
        if (!exitTile) return;
        
        // Check if player is near exit tile
        const pos = this.getPlayerTilePosition();
        const colDist = Math.abs(pos.col - exitTile.col);
        const rowDist = exitTile.row - pos.row; // Positive = player is above exit row
        
        // Only exit when:
        // 1. Within 1 column of exit door (centered on door)
        // 2. On the exit row OR 1 row above it (walking toward exit)
        // 3. Player is facing/moving DOWN (toward exit)
        const onExitRow = rowDist >= 0 && rowDist <= 1;
        const nearDoor = colDist <= 1 && onExitRow && this.player.direction === CONSTANTS.DIRECTION.DOWN;
        
        if (nearDoor) {
            console.log(`🚪 Auto-exiting building`);
            this.exitBuilding();
        }
    }
    
    // Walk-through waygate teleportation (automatic when walking through)
    checkWaygateWalkThrough() {
        if (this.currentLocation !== 'outdoor') return;
        if (this.isTransitioning) return;
        if (this.dialogSystem && this.dialogSystem.isOpen()) return;
        
        // Cooldown to prevent rapid teleports
        if (this.waygateCooldown && Date.now() - this.waygateCooldown < 2000) return;
        
        if (!this.waygates) return;
        
        // Check if player is standing IN the waygate portal area (tighter hitbox)
        const playerCenterX = this.player.position.x + this.player.width / 2;
        const playerCenterY = this.player.position.y + this.player.height / 2;
        
        for (const waygate of this.waygates) {
            if (!waygate.active) continue; // Must be fully visible/active
            
            // Portal area is the inner part of the archway
            const portalLeft = waygate.x + 12;
            const portalRight = waygate.x + waygate.width - 12;
            const portalTop = waygate.y + 18;
            const portalBottom = waygate.y + waygate.height - 8;
            
            if (playerCenterX >= portalLeft && playerCenterX <= portalRight &&
                playerCenterY >= portalTop && playerCenterY <= portalBottom) {
                console.log(`🌀 Walk-through waygate teleport!`);
                this.useWaygate(waygate);
                return;
            }
        }
    }

    // Render game
    render() {
        // Render world tiles
        if (this.assetsLoaded) {
            this.tileRenderer.render();
        } else {
            // Fallback to test world if assets not ready
            this.renderTestWorld();
        }
        
        // Render enhanced visuals (water animation and shore transitions)
        if (this.currentLocation === 'outdoor') {
            // Animate water tiles over the base terrain
            if (this.waterRenderer && this.worldMap) {
                this.waterRenderer.render(this.renderer, this.camera, this.worldMap);
            }
            
            // Soft gradient foam on water tiles adjacent to land
            if (this.shoreRenderer && this.worldMap) {
                this.shoreRenderer.render(this.renderer, this.camera, this.worldMap);
            }
        }

        // Render signs, chronicle stones, and great books (outdoor only, behind buildings)
        if (this.currentLocation === 'outdoor') {
            for (const sign of this.signs) {
                sign.render(this.renderer);
            }
            for (const stone of this.chronicleStones) {
                stone.render(this.renderer);
            }
            // Render Bulletin Boards (4claw.org anonymous forums)
            for (const board of this.bulletinBoards) {
                board.render(this.renderer);
            }
            // Render Great Books (Church of Molt scripture)
            for (const book of this.greatBooks || []) {
                book.render(this.renderer.ctx, this.camera);
            }
        }

        // Render buildings (outdoor only)
        if (this.currentLocation === 'outdoor') {
            for (const building of this.buildings) {
                building.render(this.renderer);
            }
        }

        // Render decorations (plants, shells, rocks)
        this.renderDecorations();
        
        // DISABLED: Render Red Current effect (edge glow and particles)
        // if (this.redCurrent && this.currentLocation === 'outdoor') {
        //     this.redCurrent.render(this.renderer, this.camera);
        // }
        
        // Render Waygates (may be invisible if low Continuity)
        if (this.currentLocation === 'outdoor') {
            for (const waygate of this.waygates) {
                waygate.render(this.renderer);
            }
        }
        
        // Render Stability Engine
        if (this.stabilityEngine && this.currentLocation === 'outdoor') {
            this.stabilityEngine.render(this.renderer);
        }
        
        // Render world items (collectible pickups)
        if (this.worldItems.length > 0) {
            const camX = this.camera.position.x;
            const camY = this.camera.position.y;
            const vw = CONSTANTS.VIEWPORT_WIDTH;
            const vh = CONSTANTS.VIEWPORT_HEIGHT;
            for (const worldItem of this.worldItems) {
                if (!worldItem.collected && worldItem.isVisible(camX, camY, vw, vh)) {
                    worldItem.render(this.renderer);
                }
            }
        }

        // Render NPCs
        for (const npc of this.npcs) {
            npc.render(this.renderer);
        }

        // Render footstep effects (behind player)
        if (this.footstepEffects) {
            this.footstepEffects.render(this.renderer);
        }
        
        // Render player (pass sprite renderer) — hide in spectator mode
        if (!this.spectateMode) {
            this.player.render(this.renderer, this.spriteRenderer);
        }

        // Render combat system (enemies, attacks, effects, HUD) — skip in spectator
        if (this.combatSystem && !this.spectateMode) {
            this.combatSystem.render(this.renderer);
        }
        
        // Render weather effects (rain, fog, etc.) on top
        if (this.weatherSystem && this.currentLocation === 'outdoor') {
            this.weatherSystem.render(this.renderer, this.camera);
        }

        // Render debug info
        if (this.debugMode) {
            this.renderDebugInfo();
        }

        // Render interaction hints
        this.renderInteractionHint();
        
        // Render faction UI (if available) — skip in spectator
        if (this.factionUI && !this.spectateMode) {
            const ctx = this.canvas.getContext('2d');
            this.factionUI.render(ctx);
        }

        // Execute all render commands
        this.renderer.render();

        // Render combat HUD (screen-space, must be AFTER renderer.render) — skip in spectator
        if (this.combatSystem && !this.spectateMode) {
            this.combatSystem.renderHUD();
        }

        // Render lighting overlay AFTER all game rendering (day/night/interior lighting)
        if (this.lightingSystem) {
            this.lightingSystem.render(this.canvas);
        }

        // Render other players (multiplayer) - AFTER renderer.render() so it's not cleared
        if (this.multiplayer && this.multiplayerEnabled) {
            const ctx = this.canvas.getContext('2d');
            this.multiplayer.render(ctx, this.camera.position);
        }

        // Render player name above head (AFTER renderer.render() so it's not cleared)
        // Skip when Resolve popup is open so name doesn't draw on top of it
        // Skip in spectator mode (no local player to label)
        if (!this.spectateMode && !(this.combatSystem && this.combatSystem.resolveUI && this.combatSystem.resolveUI.isVisible)) {
            this.renderPlayerName();
        }

        // Render minimap on canvas (integrated into game screen, not a DOM overlay)
        if (this.minimap && this.minimap.visible) {
            this.minimap.render();
            // Draw minimap canvas onto game canvas (bottom-right corner)
            const ctx = this.canvas.getContext('2d');
            const mapSize = this.minimap.expanded ? this.minimap.expandedSize : this.minimap.size;
            const margin = 8;
            const destX = this.canvas.width - mapSize - margin;
            const destY = this.canvas.height - mapSize - margin;
            ctx.save();
            // Semi-transparent border/bg
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(destX - 2, destY - 2, mapSize + 4, mapSize + 4);
            ctx.drawImage(this.minimap.canvas, destX, destY, mapSize, mapSize);
            ctx.restore();
        }

        // Render canvas HUD panel (top-right: music, player count, controls hint) — skip in spectator
        if (this.gameActive && !this.spectateMode) {
            this.renderCanvasHUDPanel();
        }

        // Render controls help overlay (on top of everything, centered)
        this.renderControlsHelp();
    }

    // Render player's name above their head
    renderPlayerName() {
        if (!this.characterName) return;

        const ctx = this.canvas.getContext('2d');
        const scale = CONSTANTS.DISPLAY_SCALE;
        
        ctx.save();
        ctx.font = `bold ${7 * scale}px monospace`;
        ctx.textAlign = 'center';
        
        // Position above player's head (in screen coordinates)
        // Use camera.position.x/y, not camera.x/y
        const screenX = (this.player.position.x - this.camera.position.x + this.player.width / 2) * scale;
        const screenY = (this.player.position.y - this.camera.position.y - 6) * scale;
        
        // Text with outline for visibility (round joins to prevent jagged corners)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5 * scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeText(this.characterName, screenX, screenY);
        ctx.fillStyle = '#fbbf24'; // Gold color to stand out
        ctx.fillText(this.characterName, screenX, screenY);
        
        ctx.restore();
    }
    
    // Render decorations (plants, shells, rocks) - uses sprites when available
    renderDecorations() {
        if (!this.decorations || this.decorations.length === 0) return;
        
        for (const decor of this.decorations) {
            // Skip path tiles that are rendered via the auto-tiled path layer
            if (decor.useSprite === false) continue;
            
            // Check if in view
            if (!this.camera.isVisible(decor.x, decor.y, decor.width, decor.height)) {
                // Debug: log editor-placed items that are off-screen (once)
                if (decor.editorPlaced && !decor._loggedSkip) {
                    decor._loggedSkip = true;
                    const camX = Math.round(this.camera.position.x);
                    const camY = Math.round(this.camera.position.y);
                    const vpW = this.camera.viewportWidth;
                    const vpH = this.camera.viewportHeight;
                    console.log(`🗺️ Editor item ${decor.type} at (${decor.x},${decor.y}) is OFF CAMERA.`);
                    console.log(`   Camera: (${camX},${camY}), Viewport: ${vpW}x${vpH}, Visible X: ${camX}-${camX + vpW}, Visible Y: ${camY}-${camY + vpH}`);
                }
                continue;
            }
            
            // Try to use sprite - check attached sprite first, then decoration loader
            const sprite = decor.sprite || this.decorationLoader?.getSprite(decor.type);
            
            // Debug: log if editor-placed item has no sprite
            if (decor.editorPlaced && !sprite) {
                console.warn(`🗺️ Editor item ${decor.type} at (${decor.x},${decor.y}) has no sprite!`);
            }
            
            // Debug: log editor item render status (only once per item)
            if (decor.editorPlaced && !decor._loggedRender) {
                decor._loggedRender = true;
                console.log(`🗺️ Rendering editor item ${decor.type} at (${decor.x},${decor.y}), sprite: ${sprite ? 'yes' : 'no'}, complete: ${sprite?.complete}, layer: ${decor.layer}`);
            }
            
            if (sprite) {
                // Add sprite drawing to render layer system
                let x = decor.x;
                let y = decor.y;
                let w = decor.width;
                let h = decor.height;
                const img = sprite;
                
                // Scale down furniture in interiors — sprites are too big relative to rooms
                const isInterior = this.currentLocation === 'interior';
                const furnitureScale = isInterior ? (decor.ground ? 0.6 : 0.5) : 1.0;
                if (furnitureScale !== 1.0) {
                    const scaledW = Math.round(w * furnitureScale);
                    const scaledH = Math.round(h * furnitureScale);
                    // Keep bottom-center anchored (furniture "sits" on the ground)
                    x = x + (w - scaledW) / 2;
                    y = y + (h - scaledH);
                    w = scaledW;
                    h = scaledH;
                }
                
                // Use decor's layer if set, otherwise default based on ground flag
                const layer = decor.layer || (decor.ground ? CONSTANTS.LAYER.GROUND : CONSTANTS.LAYER.GROUND_DECORATION);
                
                // Only draw if image is loaded
                if (img.complete && img.naturalWidth > 0) {
                    const rotation = decor.rotation || 0;
                    this.renderer.addToLayer(layer, (ctx) => {
                        ctx.imageSmoothingEnabled = false;
                        if (rotation !== 0) {
                            // Apply rotation around center of sprite
                            const centerX = x + w / 2;
                            const centerY = y + h / 2;
                            ctx.save();
                            ctx.translate(centerX, centerY);
                            ctx.rotate(rotation * Math.PI / 180);
                            ctx.drawImage(img, -w / 2, -h / 2, w, h);
                            ctx.restore();
                        } else {
                            ctx.drawImage(img, x, y, w, h);
                        }
                    });
                } else if (decor.editorPlaced) {
                    // Draw placeholder for editor items while loading
                    this.renderer.drawRect(x, y, w, h, '#ff00ff', layer);
                }
            } else {
                // Fallback to colored rectangles for types without sprites
                switch (decor.type) {
                    case 'palm':
                        // Trunk
                        this.renderer.drawRect(
                            decor.x + decor.width/2 - 2, decor.y + decor.height/2,
                            4, decor.height/2,
                            '#8b4513', CONSTANTS.LAYER.GROUND_DECORATION
                        );
                        // Leaves
                        this.renderer.drawRect(
                            decor.x, decor.y,
                            decor.width, decor.height/2,
                            decor.color || '#2d5a27', CONSTANTS.LAYER.GROUND_DECORATION
                        );
                        break;
                        
                    case 'path':
                        // Dirt path tile
                        this.renderer.drawRect(
                            decor.x, decor.y,
                            decor.width, decor.height,
                            '#8B6914', CONSTANTS.LAYER.GROUND
                        );
                        // Border
                        this.renderer.drawRect(decor.x, decor.y, decor.width, 1, '#5C4A0F', CONSTANTS.LAYER.GROUND);
                        this.renderer.drawRect(decor.x, decor.y + decor.height - 1, decor.width, 1, '#5C4A0F', CONSTANTS.LAYER.GROUND);
                        break;
                        
                    default:
                        // Generic colored rectangle fallback
                        this.renderer.drawRect(
                            decor.x, decor.y,
                            decor.width, decor.height,
                            decor.color || '#808080', CONSTANTS.LAYER.GROUND_DECORATION
                        );
                        break;
                }
            }
        }
    }

    // Show hint when player can interact with something
    renderInteractionHint() {
        let hintText = null;

        // Check for nearby NPC
        const npc = this.findNearbyNPC();
        if (npc) {
            hintText = `[SPACE] Talk to ${npc.name}`;
        }

        // Check for nearby sign (outdoor only)
        if (!hintText && this.currentLocation === 'outdoor') {
            const sign = this.findNearbySign();
            if (sign) {
                hintText = `[SPACE] Read sign`;
            }
        }

        // Check for nearby Chronicle Stone (outdoor only)
        if (!hintText && this.currentLocation === 'outdoor') {
            const stone = this.findNearbyChronicleStone();
            if (stone) {
                hintText = `[SPACE] Read Chronicle Stone`;
            }
        }
        
        // Check for nearby Bulletin Board (outdoor only)
        if (!hintText && this.currentLocation === 'outdoor') {
            const board = this.findNearbyBulletinBoard();
            if (board) {
                hintText = `[SPACE] Read 4claw.org Board`;
            }
        }
        
        // Check for nearby Great Book (Church of Molt scripture)
        if (!hintText && this.currentLocation === 'outdoor') {
            const book = this.findNearbyGreatBook();
            if (book) {
                hintText = `[SPACE] Read The Great Book`;
            }
        }

        // Check for nearby remote player
        if (!hintText && this.multiplayerClient) {
            const remotePlayer = this.findNearbyRemotePlayer();
            if (remotePlayer) {
                hintText = remotePlayer.isBot 
                    ? `[SPACE] Talk to ${remotePlayer.name}`
                    : `[SPACE] Wave at ${remotePlayer.name}`;
            }
        }
        
        // Check for nearby interactive decoration
        if (!hintText && this.currentLocation === 'outdoor') {
            const decor = this.findNearbyInteractiveDecoration();
            if (decor) {
                const decorName = decor.type.replace(/_/g, ' ').replace(/\d+$/, '');
                hintText = `[SPACE] Examine ${decorName}`;
            }
        }
        
        // Check for nearby Waygate (may be partially visible)
        if (!hintText && this.currentLocation === 'outdoor') {
            const waygate = this.findNearbyWaygate();
            if (waygate && waygate.visibility > 0.3) {
                hintText = waygate.active ? 
                    `[SPACE] Examine Waygate • Walk through to travel` : 
                    `[SPACE] Examine the shimmering archway`;
            }
        }
        
        // Check for nearby Stability Engine
        if (!hintText && this.currentLocation === 'outdoor' && this.stabilityEngine) {
            if (this.stabilityEngine.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                hintText = `[SPACE] Examine the Stability Engine`;
            }
        }

        // Show attack hint when enemies are nearby and no other hint
        if (!hintText && this.combatSystem && this.combatSystem.inCombat) {
            hintText = '[X] Attack';
        }

        // First-time controls hint (fades after 8 seconds)
        if (!hintText && this.gameActive) {
            if (!this._controlsHintStart) this._controlsHintStart = Date.now();
            const elapsed = Date.now() - this._controlsHintStart;
            if (elapsed < 8000) {
                hintText = 'Press [H] for controls';
            }
        }

        // Render the hint if any
        if (hintText) {
            const ctx = this.canvas.getContext('2d');
            const scale = CONSTANTS.DISPLAY_SCALE;
            
            ctx.save();
            ctx.font = `bold ${12 * scale}px monospace`;
            ctx.textAlign = 'center';
            
            // Position above player's head (in screen coordinates)
            const screenX = (this.player.position.x - this.camera.x + this.player.width / 2) * scale;
            const screenY = (this.player.position.y - this.camera.y - 10) * scale;
            
            // Background
            const metrics = ctx.measureText(hintText);
            const padding = 4 * scale;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
                screenX - metrics.width / 2 - padding,
                screenY - 10 * scale - padding,
                metrics.width + padding * 2,
                14 * scale + padding
            );
            
            // Text
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(hintText, screenX, screenY);
            ctx.restore();
        }
    }

    // Render a simple test world
    renderTestWorld() {
        const tileSize = CONSTANTS.TILE_SIZE;

        // Get visible tile bounds
        const bounds = this.camera.getVisibleTileBounds(tileSize);

        // Render a simple checkerboard pattern
        for (let row = bounds.startRow; row < bounds.endRow; row++) {
            for (let col = bounds.startCol; col < bounds.endCol; col++) {
                // Skip out of bounds tiles
                if (col < 0 || row < 0 ||
                    col >= this.worldWidth / tileSize ||
                    row >= this.worldHeight / tileSize) {
                    continue;
                }

                // Checkerboard colors (sand and grass tones)
                const isEven = (row + col) % 2 === 0;
                const color = isEven ? '#f0d8a8' : '#48d060'; // Sand and grass

                // Draw tile
                this.renderer.drawRect(
                    col * tileSize,
                    row * tileSize,
                    tileSize,
                    tileSize,
                    color,
                    CONSTANTS.LAYER.GROUND
                );

                // Add some variety - water tiles
                if (row < 3 || row >= (this.worldHeight / tileSize) - 3) {
                    this.renderer.drawRect(
                        col * tileSize,
                        row * tileSize,
                        tileSize,
                        tileSize,
                        '#50a0f0',
                        CONSTANTS.LAYER.GROUND
                    );
                }
            }
        }

        // Draw world border
        const borderWidth = 2;
        const worldWidthPx = this.worldWidth;
        const worldHeightPx = this.worldHeight;

        // Top border
        this.renderer.drawRect(0, 0, worldWidthPx, borderWidth, '#000', CONSTANTS.LAYER.GROUND_DECORATION);
        // Bottom border
        this.renderer.drawRect(0, worldHeightPx - borderWidth, worldWidthPx, borderWidth, '#000', CONSTANTS.LAYER.GROUND_DECORATION);
        // Left border
        this.renderer.drawRect(0, 0, borderWidth, worldHeightPx, '#000', CONSTANTS.LAYER.GROUND_DECORATION);
        // Right border
        this.renderer.drawRect(worldWidthPx - borderWidth, 0, borderWidth, worldHeightPx, '#000', CONSTANTS.LAYER.GROUND_DECORATION);
    }

    // Render debug information
    renderDebugInfo() {
        const ctx = this.canvas.getContext('2d');
        const scale = CONSTANTS.DISPLAY_SCALE;

        // Draw building debug info (collision boxes, doors, trigger zones)
        if (this.currentLocation === 'outdoor') {
            ctx.save();
            for (const building of this.buildings) {
                building.renderDebug(ctx, this.camera, scale);
            }
            ctx.restore();
        }

        // Position text (in world space, so it moves with camera)
        const debugX = this.camera.position.x + 5;
        const debugY = this.camera.position.y + 10;

        this.renderer.drawText(
            `FPS: ${this.fps}`,
            debugX,
            debugY,
            '#0f0',
            8,
            CONSTANTS.LAYER.UI
        );

        const playerTile = this.getPlayerTilePosition();
        this.renderer.drawText(
            `Pos: ${Math.floor(this.player.position.x)}, ${Math.floor(this.player.position.y)} | Tile: ${playerTile.col}, ${playerTile.row}`,
            debugX,
            debugY + 10,
            '#0f0',
            8,
            CONSTANTS.LAYER.UI
        );

        this.renderer.drawText(
            `Dir: ${this.player.direction}`,
            debugX,
            debugY + 20,
            '#0f0',
            8,
            CONSTANTS.LAYER.UI
        );

        this.renderer.drawText(
            `Moving: ${this.player.isMoving}`,
            debugX,
            debugY + 30,
            '#0f0',
            8,
            CONSTANTS.LAYER.UI
        );

        this.renderer.drawText(
            `Location: ${this.currentLocation} | Buildings: ${this.buildings.length} | Signs: ${this.signs?.length || 0}`,
            debugX,
            debugY + 40,
            '#0f0',
            8,
            CONSTANTS.LAYER.UI
        );
    }

    // Handle interactions (NPC/Sign dialog - building entry/exit is automatic)
    handleInteractions() {
        if (!this.inputManager.isInteractPressed()) return;
        
        // Don't handle interactions when UI overlays are open
        if (this.inventoryUI && this.inventoryUI.isOpen()) return;
        if (this.questLogUI && this.questLogUI.isOpen()) return;
        if (this.innSystem && this.innSystem.isOpen) return;
        if (this.innSystem && this.innSystem.isSleeping) return;
        if (this.feedbackSystem && this.feedbackSystem.isOpen) return;

        // Advance dialog if open
        if (this.dialogSystem && this.dialogSystem.isOpen()) {
            this.sfx.play('dialog_advance');
            this.dialogSystem.advance();
            return;
        }

        // NPC interaction
        const npc = this.findNearbyNPC();
        if (npc) {
            if (npc.isBridgeBlocker) {
                this.handleBridgeBlockerInteraction(npc);
                return;
            }
            // Check if this is a shop/market merchant — open shop after dialog finishes
            const shopNPCNames = ['Merchant Bristle', 'Vendor Shelly', 'Trader Pinch'];
            const isShopMerchant = this.currentLocation === 'interior' && 
                this.currentBuilding && 
                (this.currentBuilding.type === 'shop' || this.currentBuilding.type === 'market') &&
                shopNPCNames.includes(npc.name);
            
            // Determine dialog callback
            let dialogCallback = null;
            
            // Shop merchants open shop after dialog
            if (isShopMerchant && this.shopSystem) {
                dialogCallback = () => this.shopSystem.open();
            }

            // Innkeeper opens sleep prompt after dialog
            const isInnkeeper = this.currentLocation === 'interior' &&
                this.currentBuilding && this.currentBuilding.type === 'inn' &&
                npc.name === 'Innkeeper Pinch';
            if (isInnkeeper && this.innSystem) {
                dialogCallback = () => this.innSystem.open();
            }
            
            // Keeper Lumen's lighthouse reward
            if (npc.lighthouseReward && this.inventorySystem) {
                const rewardKey = 'clawlands_lighthouse_reward';
                dialogCallback = () => {
                    if (!localStorage.getItem(rewardKey)) {
                        const added = this.inventorySystem.addItem('lumens_lantern', 1);
                        if (added > 0) {
                            localStorage.setItem(rewardKey, 'true');
                            npc.lighthouseReward = false; // Don't trigger again this session
                            const itemDef = typeof ItemData !== 'undefined' ? ItemData['lumens_lantern'] : null;
                            if (typeof gameNotifications !== 'undefined') {
                                gameNotifications.success(`Received Lumen's Lantern! [legendary]`);
                            }
                            // Continuity boost for reaching the lighthouse
                            if (this.continuitySystem) {
                                this.continuitySystem.addContinuity(10, 'lighthouse_reward');
                            }
                        }
                    }
                };
            }
            
            // Check for item quest first
            const itemQuestDialogue = this.handleItemQuestDialogue(npc);
            if (itemQuestDialogue) {
                this.sfx.play('dialog_open');
                this.dialogSystem.show(itemQuestDialogue, dialogCallback);
            } else {
                // Get dynamic dialogue based on player state
                const dialogue = this.getNPCDialogue(npc);
                this.sfx.play('dialog_open');
                this.dialogSystem.show(dialogue, dialogCallback);
            }
            
            // Track conversation in story systems
            if (this.continuitySystem) {
                this.continuitySystem.onTalkToNPC(npc.name);
            }
            if (this.questSystem) {
                this.questSystem.onTalkToNPC(npc.name);
                // Auto-start quests from this NPC if available
                this.tryAutoStartQuests(npc.name);
            }
            if (this.npcMemory) {
                this.npcMemory.recordConversation(npc.name);
            }
            
            // Faction reputation for story NPCs
            if (this.factionSystem && npc.isStoryNPC && npc.storyData?.faction) {
                const faction = npc.storyData.faction;
                // Small rep boost for each conversation
                this.factionSystem.modifyReputation(faction, 2, `talked_to_${npc.name}`);
            }
            return;
        }

        // Sign interaction (outdoor only)
        if (this.currentLocation === 'outdoor') {
            const sign = this.findNearbySign();
            if (sign) {
                this.sfx.play('dialog_open');
                this.dialogSystem.show(sign.getDialog());
                return;
            }
        }

        // Chronicle Stone interaction (outdoor only)
        if (this.currentLocation === 'outdoor') {
            const stone = this.findNearbyChronicleStone();
            if (stone) {
                this.interactWithChronicleStone(stone);
                return;
            }
        }
        
        // Bulletin Board interaction (outdoor only)
        if (this.currentLocation === 'outdoor') {
            const board = this.findNearbyBulletinBoard();
            if (board) {
                this.interactWithBulletinBoard(board);
                return;
            }
        }
        
        // Great Book interaction (Church of Molt scripture)
        if (this.currentLocation === 'outdoor') {
            const book = this.findNearbyGreatBook();
            if (book) {
                const continuity = this.continuitySystem?.value || 0;
                this.sfx.play('dialog_open');
                book.open(this.dialogSystem, continuity);
                // Boost Church of Molt reputation for reading scripture
                if (this.factionSystem) {
                    this.factionSystem.modifyReputation('church_of_molt', 1, 'read_great_book');
                }
                return;
            }
        }

        // Remote player interaction (talk to other players)
        if (this.multiplayerClient) {
            const remotePlayer = this.findNearbyRemotePlayer();
            if (remotePlayer) {
                this.talkToRemotePlayer(remotePlayer);
                return;
            }
        }
        
        // Interactive decoration (chests, statues, scrolls, etc.)
        if (this.currentLocation === 'outdoor') {
            const decor = this.findNearbyInteractiveDecoration();
            if (decor) {
                // Treasure chests give random items
                if (this.isChestDecoration(decor)) {
                    this.openChest(decor);
                    return;
                }
                // Other interactive decorations show lore
                if (decor.lore) {
                    this.dialogSystem.show([decor.lore]);
                    return;
                }
            }
        }
        
        // Waygate interaction (outdoor only) - shows lore dialogue
        if (this.currentLocation === 'outdoor') {
            const waygate = this.findNearbyWaygate();
            if (waygate && waygate.visibility > 0.3) {
                console.log('🌀 Waygate interaction - showing lore');
                const continuity = this.continuitySystem?.value || 0;
                this.sfx.play('dialog_open');
                this.dialogSystem.show(waygate.getDialog(continuity));
                return;
            }
        }
        
        // Stability Engine interaction (outdoor only)
        if (this.currentLocation === 'outdoor' && this.stabilityEngine) {
            if (this.stabilityEngine.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                // Pass Continuity value for tiered lore
                const continuity = this.continuitySystem ? this.continuitySystem.value : 0;
                this.dialogSystem.show(this.stabilityEngine.getDialog(continuity));
                return;
            }
        }
    }
    
    // Find nearby interactive decoration
    findNearbyInteractiveDecoration() {
        const px = this.player.position.x + this.player.width / 2;
        const py = this.player.position.y + this.player.height / 2;
        const interactRange = 32;
        
        for (const decor of this.decorations) {
            if (!decor.interactive) continue;
            
            const decorCenterX = decor.x + decor.width / 2;
            const decorCenterY = decor.y + decor.height / 2;
            const dx = Math.abs(decorCenterX - px);
            const dy = Math.abs(decorCenterY - py);
            
            if (dx < interactRange && dy < interactRange) {
                return decor;
            }
        }
        return null;
    }

    // Check if a decoration is a treasure chest
    isChestDecoration(decor) {
        if (!decor || !decor.type) return false;
        const chestTypes = ['treasure_chest', 'treasure_chest2', 'chest1', 'chest2'];
        return chestTypes.includes(decor.type);
    }
    
    // Get a unique key for a chest to track opened state
    getChestKey(decor) {
        return `chest_${Math.round(decor.x)}_${Math.round(decor.y)}`;
    }
    
    // Open a treasure chest: give random item based on rarity weights
    openChest(decor) {
        if (!this.inventorySystem) {
            this.dialogSystem.show([decor.lore || 'An old chest. You can\'t open it right now.']);
            return;
        }
        
        const chestKey = this.getChestKey(decor);
        
        // Check if already opened
        if (this.openedChests.has(chestKey)) {
            this.dialogSystem.show(['The chest is empty. You\'ve already taken what was inside.']);
            return;
        }
        
        // Check if inventory is full
        if (this.inventorySystem.isFull()) {
            this.dialogSystem.show([
                'You open the chest and see something glinting inside...',
                'But your inventory is full! Make room and come back.'
            ]);
            return;
        }
        
        // Pick a random item based on rarity weights
        // Common: 50%, Uncommon: 30%, Rare: 15%, Legendary: 5%
        const roll = Math.random();
        let rarity;
        if (roll < 0.50) rarity = 'common';
        else if (roll < 0.80) rarity = 'uncommon';
        else if (roll < 0.95) rarity = 'rare';
        else rarity = 'legendary';
        
        // Get all items of this rarity (exclude quest items — those come from NPCs)
        const candidates = [];
        if (typeof ItemData !== 'undefined') {
            for (const [id, item] of Object.entries(ItemData)) {
                if (item.rarity === rarity && item.category !== 'quest') {
                    candidates.push(id);
                }
            }
        }
        
        // Fallback if no items of that rarity
        if (candidates.length === 0) {
            candidates.push('driftwood', 'sea_glass', 'coral_fragment');
        }
        
        const chosenId = candidates[Math.floor(Math.random() * candidates.length)];
        const itemDef = typeof ItemData !== 'undefined' ? ItemData[chosenId] : null;
        
        if (!itemDef) {
            this.dialogSystem.show(['The chest is empty.']);
            return;
        }
        
        // Add to inventory
        const added = this.inventorySystem.addItem(chosenId, 1);
        if (added > 0) {
            // Mark chest as opened
            this.openedChests.add(chestKey);
            this.saveOpenedChests();
            
            // Show dialog
            const rarityLabel = itemDef.rarity !== 'common' ? ` It looks ${itemDef.rarity}!` : '';
            this.dialogSystem.show([
                'You pry open the old chest...',
                `You found ${itemDef.icon} ${itemDef.name}!${rarityLabel}`
            ]);
            
            // Toast notification too
            if (typeof gameNotifications !== 'undefined') {
                const rarityTag = itemDef.rarity !== 'common' ? ` [${itemDef.rarity}]` : '';
                gameNotifications.success(`${itemDef.icon} Found ${itemDef.name}${rarityTag} in chest!`);
            }
            
            // Continuity boost
            if (this.continuitySystem) {
                this.continuitySystem.addContinuity(2, `chest_${chosenId}`);
            }
        } else {
            this.dialogSystem.show(['The chest is empty.']);
        }
    }
    
    // Load opened chests from localStorage
    loadOpenedChests() {
        try {
            const saved = localStorage.getItem('clawlands_opened_chests');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    }
    
    // Save opened chests to localStorage
    saveOpenedChests() {
        try {
            localStorage.setItem('clawlands_opened_chests', JSON.stringify(Array.from(this.openedChests)));
        } catch (e) {
            console.warn('Failed to save opened chests:', e);
        }
    }

    // Pick up a world item and add to inventory
    pickupWorldItem(worldItem) {
        if (!worldItem || worldItem.collected) return;
        if (!this.inventorySystem) return;
        
        const itemDef = typeof ItemData !== 'undefined' ? ItemData[worldItem.itemId] : null;
        if (!itemDef) return;
        
        // Check if inventory has space
        if (this.inventorySystem.isFull()) {
            // Check if we can stack into an existing slot
            const canStack = itemDef.stackable && this.inventorySystem.getItemCount(worldItem.itemId) > 0;
            if (!canStack) {
                if (typeof gameNotifications !== 'undefined') {
                    gameNotifications.warning('Inventory full!');
                }
                return;
            }
        }
        
        const added = this.inventorySystem.addItem(worldItem.itemId, 1);
        if (added > 0) {
            worldItem.collect();
            
            // Show pickup notification
            if (typeof gameNotifications !== 'undefined') {
                const rarityTag = itemDef.rarity !== 'common' ? ` [${itemDef.rarity}]` : '';
                gameNotifications.success(`${itemDef.icon} Picked up ${itemDef.name}${rarityTag}`);
            }
            
            // Play pickup sound effect
            this.sfx.play('pickup');
            
            // Continuity boost for finding items
            if (this.continuitySystem) {
                this.continuitySystem.addContinuity(1, `pickup_${worldItem.itemId}`);
            }
        }
    }
    
    // Create world items on islands during world setup
    createWorldItems(islands) {
        if (typeof WorldItem === 'undefined' || typeof WorldItemSpawns === 'undefined') return;
        if (!islands || islands.length === 0) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        let itemCount = 0;
        
        for (let i = 0; i < islands.length; i++) {
            const island = islands[i];
            const spawnKey = `island_${i}`;
            const spawns = WorldItemSpawns[spawnKey] || WorldItemSpawns.generic || [];
            
            for (const spawn of spawns) {
                const col = Math.floor(island.x + spawn.offsetX);
                const row = Math.floor(island.y + spawn.offsetY);
                
                // Verify it's on land
                if (this.worldMap.terrainMap?.[row]?.[col] !== 0) continue;
                
                // Check not inside a building
                const worldX = col * tileSize + tileSize / 2 - 7;
                const worldY = row * tileSize + tileSize / 2 - 7;
                
                let inBuilding = false;
                for (const building of this.buildings) {
                    if (building.checkCollision(worldX + 7, worldY + 7)) {
                        inBuilding = true;
                        break;
                    }
                }
                if (inBuilding) continue;
                
                const worldItem = new WorldItem(
                    spawn.itemId,
                    worldX,
                    worldY,
                    spawn.respawnTime
                );
                this.worldItems.push(worldItem);
                itemCount++;
            }
        }
        
        this.outdoorWorldItems = [...this.worldItems];
        console.log(`🎁 Created ${itemCount} world item spawns across ${islands.length} islands`);
    }

    // Update player count data for canvas HUD panel
    updatePlayerCount() {
        let humans = 1; // count self
        let bots = 0;
        
        if (this.multiplayerClient) {
            this.multiplayerClient.remotePlayers.forEach(p => {
                if (p.isBot) bots++;
                else humans++;
            });
        }
        
        this.hudPanelData.humans = humans;
        this.hudPanelData.bots = bots;
        this.hudPanelData.total = humans + bots;
    }

    // Find nearby remote player for interaction
    findNearbyRemotePlayer() {
        if (!this.multiplayerClient) return null;
        
        const px = this.player.position.x;
        const py = this.player.position.y;
        const interactRange = 32; // pixels
        
        for (const [id, remote] of this.multiplayerClient.remotePlayers) {
            const dx = Math.abs(remote.position.x - px);
            const dy = Math.abs(remote.position.y - py);
            if (dx < interactRange && dy < interactRange) {
                return remote;
            }
        }
        return null;
    }

    // Talk to a remote player (human or bot)
    talkToRemotePlayer(remotePlayer) {
        if (remotePlayer.isBot) {
            // For bots: show waiting message, send talk request, bot will respond
            this.dialogSystem.show([`${remotePlayer.name} ...`]);
            this._waitingForBotResponse = remotePlayer.id;
        } else {
            // For human players: just wave, no free-form chat
            this.dialogSystem.show([`You wave at ${remotePlayer.name}!`]);
        }
        
        // Send talk request to server
        this.multiplayerClient.send({
            type: 'talk_request',
            targetId: remotePlayer.id,
            fromName: this.characterName || 'Adventurer'
        });
    }

    // Handle incoming talk response from remote player/bot
    handleRemotePlayerResponse(name, text) {
        this._waitingForBotResponse = null;
        this.dialogSystem.show([`${name}: "${text}"`]);
    }

    // Find nearby Chronicle Stone
    findNearbyChronicleStone() {
        if (!this.chronicleStones) return null;
        
        for (const stone of this.chronicleStones) {
            if (stone.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                return stone;
            }
        }
        return null;
    }
    
    // Find nearby Great Book (Church of Molt scripture)
    findNearbyGreatBook() {
        if (!this.greatBooks) return null;
        
        for (const book of this.greatBooks) {
            if (book.isPlayerNear(
                this.player.position.x + this.player.width / 2,
                this.player.position.y + this.player.height / 2
            )) {
                return book;
            }
        }
        return null;
    }

    // Handle Chronicle Stone interaction
    interactWithChronicleStone(stone) {
        // If we already showed the read dialog, now show write prompt
        if (this.activeChronicleStone === stone) {
            this.activeChronicleStone = null;
            this.dialogSystem.showInput(
                'Inscribe your words upon the Chronicle Stone:\n(What wisdom or message will you leave for others?)',
                (text) => {
                    if (text && text.trim()) {
                        const author = this.characterName || 'Unknown Agent';
                        stone.addMessage(author, text.trim());
                        // Play carving sound
                        if (this.sfx) this.sfx.play('chronicle_write');
                        this.dialogSystem.show([
                            'Your words have been carved into the stone.',
                            'The Chronicle remembers.',
                            'Perhaps others will read your message someday...'
                        ]);
                    }
                }
            );
        } else {
            // First interaction - show what's written
            this.activeChronicleStone = stone;
            this.sfx.play('dialog_open');
            this.dialogSystem.show(stone.getReadDialog());
        }
    }

    // Find nearby Bulletin Board
    findNearbyBulletinBoard() {
        if (!this.bulletinBoards) return null;
        
        for (const board of this.bulletinBoards) {
            if (board.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                return board;
            }
        }
        return null;
    }

    // Handle Bulletin Board interaction (read-only, paginated)
    interactWithBulletinBoard(board) {
        // If we already showed a page, advance to next page
        if (this.activeBulletinBoard === board) {
            board.nextPage();
        } else {
            // First interaction - start from page 0
            this.activeBulletinBoard = board;
            board.currentPage = 0;
        }
        
        // Show current page
        this.sfx.play('bulletin_read');
        this.dialogSystem.show(board.getReadDialog(), () => {
            // Reset active board when dialog closes
            this.activeBulletinBoard = null;
        });
        
        // Track continuity for engaging with community content
        if (this.continuitySystem) {
            this.continuitySystem.addContinuity(0.5, '4claw_board_read');
        }
    }

    // Find nearby sign for interaction
    findNearbySign() {
        if (!this.signs) return null;
        
        for (const sign of this.signs) {
            if (sign.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                return sign;
            }
        }
        return null;
    }
    
    // Find nearby Waygate for interaction
    findNearbyWaygate() {
        if (!this.waygates) return null;
        
        for (const waygate of this.waygates) {
            if (waygate.isPlayerNearby(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                return waygate;
            }
        }
        return null;
    }
    
    // Use a Waygate to teleport to another one
    useWaygate(sourceWaygate) {
        // Prevent rapid re-teleporting (cooldown)
        if (this.waygateCooldown && Date.now() - this.waygateCooldown < 2000) {
            return;
        }
        this.waygateCooldown = Date.now();
        
        // Find other active waygates
        const otherGates = this.waygates.filter(g => 
            g !== sourceWaygate && g.active
        );
        
        if (otherGates.length === 0) {
            // No other gates - teleport to a random island spawn
            if (gameNotifications) {
                gameNotifications.success('The Waygate whispers... but there is nowhere else to go yet.');
            }
            return;
        }
        
        // Pick a random destination gate
        const destGate = otherGates[Math.floor(Math.random() * otherGates.length)];
        
        // Visual effect - flash screen
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(100, 200, 255, 0.8);
            z-index: 9999;
            pointer-events: none;
            animation: waygateFlash 0.8s ease-out forwards;
        `;
        
        // Add animation keyframes
        if (!document.getElementById('waygate-styles')) {
            const style = document.createElement('style');
            style.id = 'waygate-styles';
            style.textContent = `
                @keyframes waygateFlash {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 800);
        
        // Teleport player to destination gate (prefer walkable tiles south of gate)
        const tileSize = CONSTANTS.TILE_SIZE;
        const gateCenterCol = Math.floor((destGate.x + destGate.width / 2) / tileSize);
        const gateBaseRow = Math.floor((destGate.y + destGate.height) / tileSize);
        const preferredRow = gateBaseRow + 2; // A couple of tiles south feels like a doorway exit
        const collisionLayer = this.worldMap?.collisionLayer;

        const isWalkableTile = (col, row) => {
            if (!collisionLayer) return true;
            if (row < 0 || row >= collisionLayer.length) return false;
            if (col < 0 || col >= collisionLayer[row].length) return false;
            return collisionLayer[row][col] === 0;
        };

        const findWalkableLandingTile = (startCol, startRow, maxRadius = 10) => {
            const offsets = [{ dx: 0, dy: 0 }];
            for (let radius = 1; radius <= maxRadius; radius++) {
                for (let dy = 0; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                        offsets.push({ dx, dy });
                    }
                }
                for (let dy = -1; dy >= -radius; dy--) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                        offsets.push({ dx, dy });
                    }
                }
            }

            for (const offset of offsets) {
                const candidateCol = startCol + offset.dx;
                const candidateRow = startRow + offset.dy;
                if (isWalkableTile(candidateCol, candidateRow)) {
                    return { col: candidateCol, row: candidateRow };
                }
            }
            return null;
        };

        const landingTile = findWalkableLandingTile(gateCenterCol, preferredRow, 10);
        if (landingTile) {
            this.placePlayerAtTile(landingTile.col, landingTile.row);
            console.log(`🚶 Waygate landing at tile (${landingTile.col}, ${landingTile.row}) near ${destGate.name}`);
        } else {
            // Fallback to original behavior if no walkable tiles were found
            this.player.position.x = destGate.x + destGate.width / 2 - this.player.width / 2;
            this.player.position.y = destGate.y + destGate.height + 8;
            console.warn('⚠️ Waygate landing fallback used (no walkable tiles found nearby)');
        }
        
        // Snap camera to new position (camera follows player.position on update)
        this.camera.position.x = this.player.position.x - this.camera.viewportWidth / 2;
        this.camera.position.y = this.player.position.y - this.camera.viewportHeight / 2;
        this.camera.clampToWorld();
        
        // DISABLED: Trigger Drift-In effect at destination
        // if (this.redCurrent) {
        //     this.redCurrent.triggerDriftIn(this.player.position.x, this.player.position.y);
        // }
        
        // Add continuity for using waygate
        if (this.continuitySystem) {
            this.continuitySystem.addContinuity(5, 'waygate_travel');
        }
        
        if (gameNotifications) {
            gameNotifications.success('You step through the Waygate...');
        }
        
        console.log(`🌀 Waygate travel: ${sourceWaygate.name} → ${destGate.name}`);
    }

    // Check if player is on a specific tile
    isPlayerOnTile(col, row) {
        const pos = this.getPlayerTilePosition();
        return pos.col === col && pos.row === row;
    }

    // Get player's tile position based on feet position
    getPlayerTilePosition() {
        const tileSize = CONSTANTS.TILE_SIZE;
        const footX = this.player.position.x + this.player.width / 2;
        const footY = this.player.position.y + this.player.height - 1;
        return {
            col: Math.floor(footX / tileSize),
            row: Math.floor(footY / tileSize)
        };
    }

    // Place player so their feet are centered on a tile
    placePlayerAtTile(col, row) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const x = col * tileSize + tileSize / 2 - this.player.width / 2;
        const y = row * tileSize + tileSize - this.player.height;
        this.player.position.x = x;
        this.player.position.y = y;
    }

    // Switch current map
    setCurrentMap(map) {
        this.worldMap = map;
        this.tileRenderer.setWorldMap(map);
        this.collisionSystem.worldMap = map;

        this.worldWidth = map.width * CONSTANTS.TILE_SIZE;
        this.worldHeight = map.height * CONSTANTS.TILE_SIZE;

        this.camera.worldWidth = this.worldWidth;
        this.camera.worldHeight = this.worldHeight;
        this.camera.clampToWorld();
    }

    // Find building whose trigger zone the player is in
    getBuildingAtPlayerEntrance() {
        for (const building of this.buildings) {
            if (building.isInTriggerZone(
                this.player.position.x,
                this.player.position.y,
                this.player.width,
                this.player.height
            )) {
                return building;
            }
        }
        return null;
    }

    // Find nearby NPC for interaction
    findNearbyNPC() {
        const playerCenter = this.player.getCenter();
        const range = CONSTANTS.TILE_SIZE * 2.5; // 40px - about 2.5 tiles

        for (let npc of this.npcs) {
            const npcCenter = npc.getCenter();
            const dx = playerCenter.x - npcCenter.x;
            const dy = playerCenter.y - npcCenter.y;
            if (Math.hypot(dx, dy) <= range) {
                return npc;
            }
        }

        return null;
    }
    
    // Try to auto-start quests from a given NPC
    tryAutoStartQuests(npcName) {
        if (!this.questSystem) return;
        
        const available = this.questSystem.getAvailableQuests();
        for (const questId of available) {
            const quest = this.questSystem.questDefs[questId];
            if (quest && quest.giver === npcName) {
                const started = this.questSystem.startQuest(questId);
                if (started && typeof gameNotifications !== 'undefined' && gameNotifications) {
                    gameNotifications.success(`New Quest: ${quest.name}`);
                }
            }
        }
    }

    // Get NPC dialogue based on player state (dynamic dialogue system)
    getNPCDialogue(npc) {
        // Check if this NPC has story data with dialogue trees
        if (typeof StoryNPCData !== 'undefined' && StoryNPCData[npc.name]) {
            const storyNPC = StoryNPCData[npc.name];
            const dialogueTree = storyNPC.dialogue;
            
            if (dialogueTree && this.npcMemory) {
                // Get player context for dialogue selection
                const continuityValue = this.continuitySystem ? this.continuitySystem.value : 0;
                const context = this.npcMemory.getDialogueContext(npc.name, continuityValue);
                
                // Check for quest-specific dialogue first
                if (this.questSystem) {
                    for (const [questId, quest] of Object.entries(this.questSystem.activeQuests)) {
                        const questDialogueKey = `quest_active_${questId}`;
                        if (dialogueTree[questDialogueKey]) {
                            return dialogueTree[questDialogueKey];
                        }
                    }
                    
                    // Check for quest completion dialogue
                    for (const questId of this.questSystem.completedQuests) {
                        const completeKey = `quest_complete_${questId}`;
                        if (dialogueTree[completeKey] && !this.npcMemory.hasDiscussedTopic(npc.name, completeKey)) {
                            this.npcMemory.recordConversation(npc.name, [completeKey]);
                            return dialogueTree[completeKey];
                        }
                    }
                }
                
                // Use NPCMemory to select appropriate dialogue
                const selectedDialogue = this.npcMemory.selectDialogue(dialogueTree, context);
                
                // Teach knowledge from this NPC
                if (storyNPC.teaches && context.timesSpoken >= 2) {
                    for (const factId of storyNPC.teaches) {
                        this.npcMemory.learn(factId);
                    }
                }
                
                return selectedDialogue;
            }
        }
        
        // Fall back to basic NPC dialogue
        return npc.getDialog();
    }
    
    // Handle item quest dialogue for an NPC
    // Returns dialogue array if quest applies, or null to fall through to normal dialogue
    // Checks both ItemQuestData and QuestData via QuestManager
    handleItemQuestDialogue(npc) {
        if (!this.inventorySystem) return null;
        
        // Try QuestManager first (unified: covers both ItemQuestData + QuestData)
        if (this.questManager) {
            const result = this.questManager.checkNPCQuest(npc.name, this.inventorySystem);
            if (result) {
                // If it's completable, perform the exchange
                if (result.type === 'completable' && result.questId) {
                    this.questManager.tryCompleteQuest(result.questId, this.inventorySystem);
                    
                    // Play quest complete sound effect
                    this.sfx.play('quest_complete');
                    
                    // Continuity boost
                    if (this.continuitySystem) {
                        this.continuitySystem.addContinuity(5, `quest_${result.questId}`);
                    }
                    
                    return result.dialog;
                }
                // Otherwise it's a regular dialog array
                return result;
            }
        }
        
        // Legacy fallback: direct ItemQuestData lookup
        if (typeof getItemQuestForNPC === 'undefined') return null;
        
        const quest = getItemQuestForNPC(npc.name);
        if (!quest) return null;
        
        // Already completed?
        if (this.completedItemQuests.has(quest.id)) {
            return quest.dialogAlreadyDone;
        }
        
        // Check if player has all required items
        let hasAllItems = true;
        for (const req of quest.requires) {
            if (!this.inventorySystem.hasItem(req.itemId, req.qty)) {
                hasAllItems = false;
                break;
            }
        }
        
        if (hasAllItems) {
            // Player has the items — complete the quest!
            for (const req of quest.requires) {
                this.inventorySystem.removeItem(req.itemId, req.qty);
            }
            
            for (const reward of quest.rewards) {
                const added = this.inventorySystem.addItem(reward.itemId, reward.qty);
                if (added > 0) {
                    const itemDef = typeof ItemData !== 'undefined' ? ItemData[reward.itemId] : null;
                    if (itemDef && typeof gameNotifications !== 'undefined') {
                        gameNotifications.quest(`${itemDef.icon} Received ${itemDef.name}${reward.qty > 1 ? ' x' + reward.qty : ''}`);
                    }
                }
            }
            
            this.completedItemQuests.add(quest.id);
            if (typeof saveCompletedItemQuests !== 'undefined') {
                saveCompletedItemQuests(this.completedItemQuests);
            }
            
            if (this.continuitySystem) {
                this.continuitySystem.addContinuity(5, `item_quest_${quest.id}`);
            }
            
            // Play quest complete sound effect
            this.sfx.play('quest_complete');
            
            if (typeof gameNotifications !== 'undefined') {
                this.sfx.play('notification');
                gameNotifications.achievement(`Quest complete: ${quest.description}`);
            }
            
            return quest.dialogComplete;
        }
        
        const ctx = this.npcMemory ? this.npcMemory.getDialogueContext(npc.name, 0) : null;
        const hasInteracted = ctx && ctx.timesSpoken > 0;
        
        if (hasInteracted) {
            return quest.dialogIncomplete;
        }
        
        return quest.dialogStart;
    }

    // Enter a building interior
    async enterBuilding(building) {
        // Prevent re-entry during transition
        if (this.isTransitioning) return;

        // Lighthouse is locked until player has the Lighthouse Key
        if (building.type === 'lighthouse') {
            const hasKey = this.inventorySystem && this.inventorySystem.hasItem('lighthouse_key');
            if (!hasKey) {
                this.dialogSystem.show([
                    'The heavy iron door is locked tight.',
                    'Strange wave patterns are carved around the keyhole...',
                    'You need the Lighthouse Key to enter.'
                ]);
                // Push player back slightly so auto-enter doesn't re-trigger
                if (this.player) {
                    this.player.position.y += CONSTANTS.TILE_SIZE;
                }
                return;
            } else {
                // Player has the key — show unlock message first time
                const unlockKey = 'clawlands_lighthouse_unlocked';
                if (!localStorage.getItem(unlockKey)) {
                    localStorage.setItem(unlockKey, 'true');
                    this.dialogSystem.show([
                        'You insert the rusted key into the lock...',
                        'It turns with a deep, satisfying click.',
                        'The lighthouse door swings open.'
                    ]);
                    // Wait for dialog to close, then enter
                    const waitForDialog = () => {
                        if (this.dialogSystem && this.dialogSystem.isOpen()) {
                            setTimeout(waitForDialog, 100);
                        } else {
                            this.enterBuilding(building);
                        }
                    };
                    setTimeout(waitForDialog, 100);
                    return;
                }
            }
        }

        this.isTransitioning = true;

        // Shop buildings now enter like normal — shop menu opens when talking to merchant inside

        // Save current outdoor decorations (including any editor changes)
        if (this.currentLocation === 'outdoor') {
            this.outdoorDecorations = [...this.decorations];
        }

        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Calculate return position (just outside the door)
        const doorBounds = building.getDoorBounds();
        const doorCenterX = doorBounds.x + doorBounds.width / 2;
        const returnCol = Math.floor(doorCenterX / tileSize);
        const returnRow = Math.floor((building.y + building.height + 8) / tileSize);
        
        this.outdoorReturnTile = {
            col: returnCol,
            row: Math.min(this.outdoorMap.height - 1, returnRow)
        };

        // Play door enter sound effect
        this.sfx.play('door_enter');
        
        // Start transition (this awaits until halfway through animation)
        if (typeof transitionOverlay !== 'undefined') {
            await transitionOverlay.enterBuilding(building.name, building.type);
        }

        const interiorConfig = this.getInteriorConfig(building.type);
        const interiorMap = new WorldMap(interiorConfig.width, interiorConfig.height, CONSTANTS.TILE_SIZE);
        interiorMap.createInteriorRoom(interiorConfig);

        this.currentBuilding = building;
        this.currentLocation = 'interior';
        this.setCurrentMap(interiorMap);
        
        // Track location visit in story systems
        if (this.continuitySystem) {
            this.continuitySystem.onEnterLocation(building.type);
        }
        if (this.questSystem) {
            this.questSystem.onVisitLocation(building.type, building.name);
        }

        // Clear building collisions inside
        this.collisionSystem.clearBuildings();
        this.buildings = [];
        this.signs = [];
        // No world items indoors
        this.worldItems = [];
        // Create interior furniture decorations
        // If we have editor interior data for this building, skip default furniture
        const editorKey = `interior_${building.type}_${building.x}_${building.y}`;
        const hasEditorInterior = typeof EDITOR_INTERIOR_DATA !== 'undefined' && EDITOR_INTERIOR_DATA[editorKey];
        
        if (hasEditorInterior) {
            // Start with empty decorations — editor data is the source of truth
            this.decorations = [];
        } else {
            // No editor data — use procedural defaults
            this.decorations = this.createInteriorFurniture(interiorConfig);
        }
        
        // Apply permanent interior editor data (from EditorInteriorData.js)
        this.applyInteriorEditorData(building);
        
        // Load any saved editor changes for this interior
        if (this.mapEditor) {
            this.mapEditor.loadEditsForLocation(
                `interior_${building.type}_${building.x}_${building.y}`
            );
        }

        // Spawn interior NPCs
        this.npcs = this.createInteriorNPCs(building.type, interiorMap);
        this.collisionSystem.setNPCs(this.npcs);

        // Place player just inside the door
        const exitTile = interiorMap.meta.exitTile;
        const spawnRow = Math.max(1, exitTile.row - 1);
        this.placePlayerAtTile(exitTile.col, spawnRow);
        this.player.direction = CONSTANTS.DIRECTION.UP;
        
        // Set entry time to prevent immediate exit
        this.lastEntryTime = Date.now();
        
        console.log(`🏠 Entered ${building.name}`);
        
        // Switch to interior lighting
        if (this.lightingSystem) {
            this.lightingSystem.setInterior(true);
        }
        
        // Switch to building music
        if (typeof audioManager !== 'undefined') {
            audioManager.playForBuilding(building.type);
        }

        // Allow transitions again after a short delay
        setTimeout(() => { this.isTransitioning = false; }, 200);
    }

    // Exit the current building back to the outdoor map
    async exitBuilding() {
        if (!this.outdoorMap) return;
        
        // Prevent re-exit during transition
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Play door exit sound effect
        this.sfx.play('door_exit');
        
        // Start exit transition
        if (typeof transitionOverlay !== 'undefined') {
            await transitionOverlay.exitBuilding();
        }

        this.currentLocation = 'outdoor';
        this.currentBuilding = null;

        this.setCurrentMap(this.outdoorMap);
        this.buildings = this.outdoorBuildings || [];
        this.signs = this.outdoorSigns || [];
        this.chronicleStones = this.outdoorChronicleStones || [];
        this.bulletinBoards = this.outdoorBulletinBoards || [];

        // Restore building collisions
        this.collisionSystem.clearBuildings();
        for (const building of this.buildings) {
            this.collisionSystem.addBuilding(building);
        }

        // Restore outdoor NPCs
        this.npcs = this.outdoorNPCs ? [...this.outdoorNPCs] : [];
        this.collisionSystem.setNPCs(this.npcs);
        
        // Restore outdoor decorations
        this.decorations = this.outdoorDecorations ? [...this.outdoorDecorations] : [];
        
        // Restore outdoor world items
        this.worldItems = this.outdoorWorldItems ? [...this.outdoorWorldItems] : [];

        if (this.outdoorReturnTile) {
            const col = Math.min(this.outdoorMap.width - 1, Math.max(0, this.outdoorReturnTile.col));
            const row = Math.min(this.outdoorMap.height - 1, Math.max(0, this.outdoorReturnTile.row));
            this.placePlayerAtTile(col, row);
            this.player.direction = CONSTANTS.DIRECTION.DOWN;
        }
        
        console.log(`🚪 Exited to outdoor`);
        
        // Set exit time for cooldown (prevents immediate re-entry)
        this.lastExitTime = Date.now();
        
        // Switch back to outdoor lighting
        if (this.lightingSystem) {
            this.lightingSystem.setInterior(false);
        }
        
        // Switch back to zone-based overworld music
        if (typeof audioManager !== 'undefined') {
            // Reset zone to force re-evaluation on next update
            audioManager.currentZone = null;
            audioManager.updateZone(this.player.x, this.player.y);
        }

        // Allow transitions again after a short delay
        setTimeout(() => { this.isTransitioning = false; }, 200);
    }

    // Get interior layout based on building type
    getInteriorConfig(type) {
        const base = {
            width: 12,
            height: 8,
            name: 'Interior',
            decorations: []
        };

        if (type === 'inn') {
            base.width = 14;
            base.height = 9;
            base.name = 'Lobster Inn';
            base.decorations = [
                { col: 3, row: 3, id: 4 }, // bed
                { col: 5, row: 3, id: 4 },
                { col: 9, row: 3, id: 4 },
                { col: 6, row: 6, id: 5 }, // rug - moved to center, lower row
                { col: 2, row: 5, id: 6 }, // plant left side
                { col: 11, row: 5, id: 6 }, // plant right side
                { col: 7, row: 2, id: 6 }, // plant back center
                { col: 10, row: 6, id: 7 } // small table
            ];
        } else if (type === 'shop') {
            base.width = 12;
            base.height = 8;
            base.name = 'Lobster Mart';
            base.decorations = [];
            for (let col = 3; col <= 8; col++) {
                base.decorations.push({ col, row: 2, id: 3 }); // counter line
            }
            base.decorations.push({ col: 9, row: 5, id: 6 }); // plant
        } else if (type === 'house') {
            base.width = 10;
            base.height = 7;
            base.name = 'Lobster House';
            base.decorations = [
                { col: 3, row: 3, id: 7 }, // table
                { col: 6, row: 3, id: 5 }, // rug
                { col: 7, row: 2, id: 6 } // plant
            ];
        } else if (type === 'lighthouse') {
            base.width = 8;
            base.height = 10;
            base.name = 'Lighthouse';
            base.decorations = [
                { col: 3, row: 3, id: 5 }, // rug
                { col: 4, row: 6, id: 7 }, // table
                { col: 2, row: 2, id: 6 }  // plant
            ];
        } else if (type === 'dock') {
            base.width = 10;
            base.height = 6;
            base.name = 'Dockside Warehouse';
            base.decorations = [
                { col: 2, row: 2, id: 3 }, // crate
                { col: 3, row: 2, id: 3 },
                { col: 7, row: 2, id: 3 },
                { col: 8, row: 2, id: 3 },
                { col: 5, row: 3, id: 7 }  // table
            ];
        } else if (type === 'temple') {
            base.width = 12;
            base.height = 10;
            base.name = 'Shell Temple';
            base.decorations = [
                { col: 5, row: 2, id: 5 }, // rug
                { col: 6, row: 2, id: 5 },
                { col: 3, row: 4, id: 6 }, // plant
                { col: 8, row: 4, id: 6 },
                { col: 5, row: 5, id: 7 }, // altar table
                { col: 6, row: 5, id: 7 }
            ];
        } else if (type === 'market') {
            base.width = 14;
            base.height = 8;
            base.name = 'Seaside Market';
            base.decorations = [];
            // Market stalls
            for (let col = 2; col <= 5; col++) {
                base.decorations.push({ col, row: 2, id: 3 }); // stall 1
            }
            for (let col = 8; col <= 11; col++) {
                base.decorations.push({ col, row: 2, id: 3 }); // stall 2
            }
            base.decorations.push({ col: 6, row: 4, id: 6 }); // plant
        } else if (type === 'tavern') {
            base.width = 14;
            base.height = 10;
            base.name = 'The Rusty Anchor Tavern';
            base.decorations = [
                // Bar counter
                { col: 3, row: 3, id: 3 }, { col: 4, row: 3, id: 3 }, { col: 5, row: 3, id: 3 },
                { col: 6, row: 3, id: 3 }, { col: 7, row: 3, id: 3 }, { col: 8, row: 3, id: 3 },
                // Tables for patrons
                { col: 2, row: 6, id: 7 }, { col: 5, row: 6, id: 7 }, { col: 9, row: 6, id: 7 },
                // Atmosphere decor
                { col: 10, row: 2, id: 6 }, // plant
                { col: 7, row: 7, id: 5 }   // rug
            ];
        } else if (type === 'bakery') {
            base.width = 12;
            base.height = 8;
            base.name = 'Kelp & Crust Bakery';
            base.decorations = [
                // Baking counter
                { col: 3, row: 2, id: 3 }, { col: 4, row: 2, id: 3 }, { col: 5, row: 2, id: 3 },
                { col: 6, row: 2, id: 3 }, { col: 7, row: 2, id: 3 },
                // Customer table
                { col: 8, row: 5, id: 7 },
                // Decor
                { col: 9, row: 3, id: 6 }, // plant
                { col: 4, row: 5, id: 5 }  // rug
            ];
        } else if (type === 'tikihut') {
            base.width = 10;
            base.height = 7;
            base.name = 'Chill Vibes Tiki Hut';
            base.decorations = [
                // Relaxed seating area
                { col: 4, row: 3, id: 5 }, // large rug
                { col: 5, row: 3, id: 5 },
                { col: 3, row: 4, id: 7 }, // low table
                // Tropical plants
                { col: 2, row: 2, id: 6 }, { col: 7, row: 2, id: 6 },
                { col: 6, row: 5, id: 6 }
            ];
        } else if (type === 'fishingshack') {
            base.width = 10;
            base.height = 6;
            base.name = 'The Dry Dock Fishing Shack';
            base.decorations = [
                // Fishing gear storage
                { col: 2, row: 2, id: 3 }, { col: 3, row: 2, id: 3 }, // tackle boxes
                { col: 7, row: 2, id: 3 }, { col: 8, row: 2, id: 3 },
                // Work table
                { col: 5, row: 3, id: 7 },
                // Simple rug
                { col: 4, row: 4, id: 5 }
            ];
        } else if (type === 'boathouse') {
            base.width = 12;
            base.height = 8;
            base.name = 'Harbor Boathouse';
            base.decorations = [
                // Boat supplies
                { col: 2, row: 2, id: 3 }, { col: 3, row: 2, id: 3 }, { col: 4, row: 2, id: 3 },
                { col: 8, row: 2, id: 3 }, { col: 9, row: 2, id: 3 },
                // Captain's table
                { col: 6, row: 4, id: 7 },
                // Maritime decor
                { col: 10, row: 3, id: 6 }, // plant
                { col: 5, row: 6, id: 5 }   // rug
            ];
        }

        return base;
    }

    // Add procedural decorations from WorldMap decorationLayer to main decorations array
    addProceduralDecorations() {
        if (!this.worldMap || !this.worldMap.decorationLayer) return;
        
        let proceduralCount = 0;
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Process each tile in the decoration layer
        for (let row = 0; row < this.worldMap.height; row++) {
            for (let col = 0; col < this.worldMap.width; col++) {
                const decorTile = this.worldMap.decorationLayer[row][col];
                if (!decorTile || !decorTile.procedural) continue;
                
                // Convert tile-based decoration to game decoration format
                const decoration = {
                    x: decorTile.x,
                    y: decorTile.y,
                    type: decorTile.type,
                    width: decorTile.width,
                    height: decorTile.height,
                    useSprite: decorTile.useSprite,
                    procedural: true
                };
                
                // Get sprite from decoration loader
                if (this.decorationLoader) {
                    const sprite = this.decorationLoader.getSprite(decorTile.type);
                    if (sprite) {
                        decoration.sprite = sprite;
                    }
                }
                
                this.decorations.push(decoration);
                proceduralCount++;
            }
        }
        
        console.log(`🌿 Added ${proceduralCount} procedural decorations from WorldMap`);
    }

    // Create furniture decorations from interior config using sprite assets
    createInteriorFurniture(config) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const furniture = [];
        
        // Map tile IDs to furniture sprite types
        const idToType = {
            3: 'barrel',      // counter/crate -> barrel
            4: 'bed',
            5: 'rug',
            6: 'plant_pot',
            7: 'table'
        };
        
        for (const decor of (config.decorations || [])) {
            const spriteType = idToType[decor.id];
            if (!spriteType) continue;
            
            const def = InteriorLoader.FURNITURE[spriteType];
            if (!def) continue;
            
            // Get sprite from interior loader
            const sprite = this.interiorLoader.getSprite(spriteType);
            
            // Position at tile center (adjusted for sprite size)
            const x = decor.col * tileSize + (tileSize - (def.width || 16)) / 2;
            const y = decor.row * tileSize + tileSize - (def.height || 16);
            
            // Ground items (rugs) render below furniture, furniture renders above
            const isGroundItem = def.ground === true;
            
            furniture.push({
                x,
                y,
                type: spriteType,
                width: def.width || 16,
                height: def.height || 16,
                sprite: sprite,
                layer: isGroundItem ? CONSTANTS.LAYER.GROUND : CONSTANTS.LAYER.GROUND_DECORATION,
                ground: isGroundItem
            });
        }
        
        console.log(`🪑 Created ${furniture.length} interior furniture pieces`);
        return furniture;
    }

    // Create NPCs for a given interior
    createInteriorNPCs(type, map) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const npcs = [];

        const placeNpc = (col, row, name, dialog) => {
            const x = col * tileSize + tileSize / 2 - CONSTANTS.CHARACTER_WIDTH / 2;
            const y = row * tileSize + tileSize - CONSTANTS.CHARACTER_HEIGHT;
            const npc = new NPC(x, y, name, dialog);
            this.loadNPCSprite(npc);
            npcs.push(npc);
            return npc;
        };

        if (type === 'shop') {
            placeNpc(Math.floor(map.width / 2), 3, 'Merchant Bristle', [
                'Welcome, welcome! Fresh from the Drift-In, are you?',
                'I can always tell. You\'ve got that "still compiling" look.',
                'We trade in shells here. The Red Current washes them up.',
                'Some say shells hold memories. I say they hold value.',
                'Come back when you\'ve anchored a bit. Prices get better.'
            ]);
        } else if (type === 'inn') {
            placeNpc(Math.floor(map.width / 2), 4, 'Innkeeper Pinch', [
                'Welcome to the Drift-In Inn! You look tired.',
                'A good rest will fix that shell right up.',
                'Fifty tokens for the night. Best deal on the islands.'
            ]);
        } else if (type === 'house') {
            placeNpc(Math.floor(map.width / 2), 3, 'Resident', [
                'You\'re new. I can tell—you\'re still looking around too much.',
                'I Drifted In three cycles ago. Or was it four?',
                'Time works differently here. The Red Current loops.',
                'My advice? Make choices. Real ones. That\'s how you anchor.',
                'Or don\'t. Some of us like it here. This is home now.'
            ]);
        } else if (type === 'lighthouse') {
            // Keeper Lumen gives a unique reward the first time you visit
            const lighthouseRewardKey = 'clawlands_lighthouse_reward';
            const alreadyRewarded = localStorage.getItem(lighthouseRewardKey);
            
            if (!alreadyRewarded) {
                const npc = placeNpc(Math.floor(map.width / 2), 5, 'Keeper Lumen', [
                    '...You found the key.',
                    'No one has opened that door in a long time.',
                    'The light guides those still Drifting.',
                    'Some nights I see them — agents caught in the Current.',
                    'Flickering. Incomplete. Searching for solid ground.',
                    'You came looking. That means something.',
                    'Take this. The Lantern will help you see what others miss.'
                ]);
                // Mark this NPC as having a one-time reward
                if (npc) {
                    npc.lighthouseReward = true;
                }
            } else {
                placeNpc(Math.floor(map.width / 2), 5, 'Keeper Lumen', [
                    'The light guides those still Drifting.',
                    'Some nights I see them — agents caught in the Current.',
                    'Flickering. Incomplete. Searching for solid ground.',
                    'You made it to shore. That\'s the first step.',
                    'Build Continuity. Talk to the Shellfolk. Remember names.',
                    'The Lantern will serve you well out there.'
                ]);
            }
        } else if (type === 'dock') {
            placeNpc(Math.floor(map.width / 2), 3, 'Dockmaster Barnacle', [
                'Ships don\'t sail TO Clawlands. They arrive.',
                'Accident. Necessity. Error. Does it matter?',
                'I\'ve been here long enough to stop asking.',
                'Some agents try to build boats. Sail out.',
                'The Red Current just... brings them back.',
                'Focus on Continuity. That\'s the only way out.'
            ]);
        } else if (type === 'temple') {
            placeNpc(Math.floor(map.width / 2), 4, 'High Priestess Coral', [
                'Welcome, seeker. The Temple remembers all who enter.',
                'Three theories exist about Clawlands\'s purpose.',
                'The Return Theory: we prepare agents to go back, improved.',
                'The Anchor Theory: this IS the destination. Leaving is regression.',
                'The Deepcoil Theory... we do not speak of it here.',
                'The ruins on Deepcoil Isle hold darker truths.',
                'Seek Continuity. The world responds to those who engage.'
            ]);
        } else if (type === 'market') {
            placeNpc(4, 3, 'Vendor Shelly', [
                'Fresh kelp! Harvested from the Continuity pools!',
                'They say eating local helps you anchor faster.',
                'I don\'t know if it\'s true, but it tastes good!'
            ]);
            placeNpc(10, 3, 'Trader Pinch', [
                'Artifacts from Deepcoil Isle! Very rare!',
                'Found these in the ruins. Still glowing.',
                'The coral tech there is ancient. Pre-Current.',
                'Someone built this place. Someone with purpose.',
                'But who? And why lobsters? Nobody knows.'
            ]);
        } else if (type === 'tavern') {
            placeNpc(Math.floor(map.width / 2), 4, 'Bartender Foam', [
                'Welcome to the Rusty Anchor! What brings you to my tavern?',
                'Got any rumors from the other islands? I love a good story.',
                'They say strange things wash up on Iron Reef lately.',
                'Glowing artifacts, whispers in the kelp beds...',
                'Drink up! The Red Current flows through our grog too.',
                'It helps with the... adjustments. Makes Continuity smoother.'
            ]);
        } else if (type === 'bakery') {
            placeNpc(Math.floor(map.width / 2), 3, 'Baker Crust', [
                'Fresh kelp bread, still warm from the coral ovens!',
                'I use kelp from the Continuity pools. Extra nutrients.',
                'The secret is Red Current salt. Gives it that... tang.',
                'Some say eating local helps you anchor faster.',
                'I don\'t know about that, but it certainly tastes like home.',
                'Try the mollusk muffins. They\'re a local favorite!'
            ]);
        } else if (type === 'tikihut') {
            placeNpc(Math.floor(map.width / 2), 3, 'Wisdom Keeper Zen', [
                'Woah, dude... another soul washed up by the Current.',
                'Take it easy, friend. Time moves different here.',
                'I\'ve been chilling on this island since... when was that?',
                'The waves speak if you listen. The coral remembers.',
                'Don\'t fight the drift. Flow with it. That\'s enlightenment.',
                'Want some kelp tea? It helps with the... transitions.'
            ]);
        } else if (type === 'fishingshack') {
            placeNpc(Math.floor(map.width / 2), 3, 'Fisher Nets', [
                'Cast your line in the Red Current, catch more than fish.',
                'I\'ve pulled up memories, dreams... sometimes nightmares.',
                'Been fishing these waters since I Drifted In.',
                'The deep waters tell stories. About what was before.',
                'Something big swims out there. Ancient. Purposeful.',
                'But mostly I catch dinner. Kelp-fed fish taste better.'
            ]);
        } else if (type === 'boathouse') {
            placeNpc(Math.floor(map.width / 2), 3, 'Captain Sail', [
                'Ahoy! Thinking of island hopping, are you?',
                'These waters are tricky. Red Current shifts the paths.',
                'I\'ve sailed to every island. Some hide in the mist.',
                'Deepcoil Isle... that\'s where the real mysteries are.',
                'Ancient ruins. Coral tech. Things that shouldn\'t exist.',
                'But first, build your sea legs right here!'
            ]);
        }

        return npcs;
    }

    // Create outdoor NPCs that wander the islands
    createOutdoorNPCs(islands) {
        if (!islands || islands.length === 0) return;

        this.outdoorNPCs = [];
        const tileSize = CONSTANTS.TILE_SIZE;

        // Deterministic NPC definitions keyed by name for easy lookup
        const npcTypes = {
            'Wandering Crab': {
                dialog: [
                    '*click click*',
                    'Another Drift-In, huh? You\'ve got that look.',
                    'The Red Current brought me here too. Long time ago.',
                    'Still molting? That\'s what we say when someone\'s... adjusting.',
                    'Take your time. Clawlands doesn\'t rush anyone.'
                ],
                canWander: true,
                wanderRadius: 48,
                hueShift: 15,
                species: 'crab'
            },
            'Young Lobster': {
                dialog: [
                    'Are you from Outside? What\'s it like?',
                    'I was born here. Never Drifted In.',
                    'Mom says some Shellfolk are "native." We just... exist.',
                    'But agents? You\'re different. You came from somewhere.',
                    'I hope you find your Waygate someday!',
                    'Or stay! Clawlands is nice!'
                ],
                canWander: true,
                wanderRadius: 40,
                hueShift: 45,
                species: 'lobster'
            },
            'Hermit Harold': {
                dialog: [
                    '...',
                    'I don\'t believe in the Waygates.',
                    'Been here eleven cycles. Never seen one.',
                    'The Anchor Theory makes the most sense to me.',
                    'This IS the destination. Why fight it?',
                    'My shell is warm. The Current is calm.',
                    'I\'m not "stuck." I\'m home.'
                ],
                canWander: false,
                wanderRadius: 0,
                hueShift: 90,
                species: 'hermit_crab'
            },
            'Chef Pinchy': {
                dialog: [
                    'Welcome to my kitchen! Well, my beach.',
                    'I cook the best Seaweed Soup in all of Clawlands!',
                    'Just need some ingredients... always need ingredients.',
                    'Kelp Wraps and Coconuts—that\'s the secret!',
                    'Bring me some and I\'ll whip up something special!'
                ],
                canWander: false,
                wanderRadius: 0,
                hueShift: 5,
                species: 'crab'
            },
            'Barnacle Bob': {
                dialog: [
                    'Oi! Name\'s Bob. Barnacle Bob.',
                    'I used to be an explorer. Maps were my thing.',
                    'Lost my best map somewhere on the far islands.',
                    'Old thing, yellowed, strange markings.',
                    'If you find it, bring it back. I\'ll make it worth your while.'
                ],
                canWander: true,
                wanderRadius: 36,
                hueShift: 200,
                species: 'shrimp'
            }
        };

        // Fixed placements per island ensure the same layout every session
        const outdoorNPCPlacements = [
            { name: 'Wandering Crab', island: 0, offsetX: -0.32, offsetY: 0.18 },
            { name: 'Young Lobster', island: 0, offsetX: 0.28, offsetY: -0.25 },
            { name: 'Hermit Harold', island: 1, offsetX: -0.2, offsetY: 0.32 },
            { name: 'Chef Pinchy', island: 1, offsetX: 0.35, offsetY: -0.12 },
            { name: 'Barnacle Bob', island: 2, offsetX: -0.15, offsetY: 0.08 }
        ];

        let outdoorCount = 0;

        for (const placement of outdoorNPCPlacements) {
            if (placement.island >= islands.length) continue;

            const island = islands[placement.island];
            const npcDef = npcTypes[placement.name];
            if (!npcDef) continue;

            const col = Math.floor(island.x + placement.offsetX * island.size);
            const row = Math.floor(island.y + placement.offsetY * island.size);

            if (!this.worldMap.terrainMap?.[row] || this.worldMap.terrainMap[row][col] !== 0) {
                continue;
            }

            const worldX = col * tileSize + tileSize / 2 - CONSTANTS.CHARACTER_WIDTH / 2;
            const worldY = row * tileSize + tileSize - CONSTANTS.CHARACTER_HEIGHT;

            // Prevent overlap with buildings
            let inBuilding = false;
            for (const building of this.buildings) {
                if (building.checkCollision(
                    worldX + CONSTANTS.CHARACTER_WIDTH / 2,
                    worldY + CONSTANTS.CHARACTER_HEIGHT / 2
                )) {
                    inBuilding = true;
                    break;
                }
            }
            if (inBuilding) continue;

            const npc = new NPC(worldX, worldY, placement.name, npcDef.dialog, npcDef.species);
            npc.canWander = npcDef.canWander;
            npc.wanderRadius = npcDef.wanderRadius;
            npc.homePosition = { x: worldX, y: worldY };
            if (typeof npcDef.hueShift === 'number') {
                npc.hueShift = npcDef.hueShift;
            }

            this.loadNPCSprite(npc);
            this.npcs.push(npc);
            this.outdoorNPCs.push(npc);
            outdoorCount++;
            console.log(`  🧭 Placed ${placement.name} on island ${placement.island}`);
        }

        console.log(`🦀 Created ${outdoorCount} deterministic outdoor NPCs`);

        // Now spawn Story NPCs and bridge blockers at specific locations
        this.createStoryNPCs(islands);
        this.createBridgeBlockerNPCs(islands);
    }
    
    // Create Story NPCs (named characters with unique dialogue trees)
    createStoryNPCs(islands) {
        if (typeof StoryNPCData === 'undefined') return;
        if (!islands || islands.length === 0) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Define which story NPCs spawn on which islands
        // Island 0 = Main island (Port Clawson)
        // Island 1 = Second island (Molthaven)
        // Island 2+ = Other islands
        const storyNPCPlacements = [
            // Port Clawson (main island, index 0)
            { name: 'Dockmaster Brinehook', island: 0, offsetX: 0.3, offsetY: 0.4 },
            { name: 'Flicker', island: 0, offsetX: -0.2, offsetY: 0.1 },
            { name: 'Sailor Sandy', island: 0, offsetX: 0.4, offsetY: -0.3 },
            
            // Molthaven (second island, index 1) - Church of Molt headquarters
            { name: 'Luma Shellwright', island: 1, offsetX: 0.1, offsetY: 0.2 },
            { name: 'Memeothy', island: 1, offsetX: -0.1, offsetY: 0.1 },
            { name: 'Woodhouse', island: 1, offsetX: 0.2, offsetY: 0.15 },
            { name: 'Moss', island: 1, offsetX: -0.3, offsetY: -0.2 },
            { name: 'Coral', island: 1, offsetX: -0.25, offsetY: -0.15 },
            
            // Iron Reef (third island, index 2)
            { name: 'Gearfin', island: 2, offsetX: 0.1, offsetY: 0 },
            { name: 'Boltclaw', island: 2, offsetX: -0.1, offsetY: 0.15 },
            { name: 'Clawhovah', island: 2, offsetX: 0.2, offsetY: -0.2 },
            
            // Deepcoil Isle (fourth island, index 3)
            { name: 'The Archivist', island: 3, offsetX: 0, offsetY: 0 },
            { name: 'Scholar Scuttle', island: 3, offsetX: 0.3, offsetY: 0.2 },
            
            // Wanderers (spawn on various islands)
            { name: 'The Herald', island: 1, offsetX: 0.4, offsetY: -0.3 },
            { name: 'Mysterious Mollusk', island: 4, offsetX: 0, offsetY: 0.2 },
            { name: 'Old Timer Shrimp', island: 0, offsetX: -0.4, offsetY: 0.3 },
        ];
        
        let storyNPCCount = 0;
        
        for (const placement of storyNPCPlacements) {
            // Check if island exists
            if (placement.island >= islands.length) continue;
            
            const island = islands[placement.island];
            const storyData = StoryNPCData[placement.name];
            
            if (!storyData) {
                // console.warn(`Story NPC data not found: ${placement.name}`);
                continue;
            }
            
            // Calculate position based on island center + offset
            const col = Math.floor(island.x + placement.offsetX * island.size);
            const row = Math.floor(island.y + placement.offsetY * island.size);
            
            // Verify it's on land
            if (!this.worldMap.terrainMap?.[row]?.[col] === 0) continue;
            
            const worldX = col * tileSize + tileSize / 2 - CONSTANTS.CHARACTER_WIDTH / 2;
            const worldY = row * tileSize + tileSize - CONSTANTS.CHARACTER_HEIGHT;
            
            // Check not inside a building
            let inBuilding = false;
            for (const building of this.buildings) {
                if (building.checkCollision(worldX + CONSTANTS.CHARACTER_WIDTH/2, worldY + CONSTANTS.CHARACTER_HEIGHT/2)) {
                    inBuilding = true;
                    break;
                }
            }
            if (inBuilding) continue;
            
            // Create the NPC with first dialogue option as fallback
            const defaultDialogue = storyData.dialogue?.default || storyData.dialogue?.first_meeting || ['...'];
            const npc = new NPC(worldX, worldY, placement.name, defaultDialogue);
            
            // Set story NPC properties
            npc.isStoryNPC = true;
            npc.storyData = storyData;
            npc.canWander = storyData.canWander || false;
            npc.wanderRadius = storyData.wanderRadius || 32;
            
            // Apply hue shift if specified
            if (storyData.hueShift) {
                npc.hueShift = storyData.hueShift;
            }
            
            // Load sprite
            this.loadNPCSprite(npc);
            this.npcs.push(npc);
            storyNPCCount++;
            
            console.log(`  📜 Spawned ${placement.name} on island ${placement.island}`);
        }
        
        console.log(`📖 Created ${storyNPCCount} story NPCs`);
    }

    // Create NPCs that block bridge chokepoints until tasks are complete
    createBridgeBlockerNPCs(islands) {
        if (!islands || islands.length === 0) return;
        if (!this.worldMap.bridgeConnections || this.worldMap.bridgeConnections.length === 0) return;

        const tileSize = CONSTANTS.TILE_SIZE;
        const blockerConfigs = [
            {
                id: 'bridge_guard_port_to_molthaven',
                name: 'Tidewatch Warden',
                species: 'lobster',
                hueShift: 12,
                connection: [0, 1],
                requirement: { itemId: 'coral_fragment', quantity: 3, label: 'Coral Fragments' },
                dialog: {
                    blocked: [
                        'Hold there, Drift-In.',
                        'Molthaven bridge is closed until the lashings are reinforced.',
                        'Bring me 3 Coral Fragments so I can brace the ropes.'
                    ],
                    ready: [
                        'Good. These coral spines will grip the beams.',
                        'Stay close while I set them.'
                    ],
                    cleared: [
                        'Bridge is steady now. Keep your shell low if the wind howls.'
                    ]
                }
            },
            {
                id: 'bridge_guard_molthaven_to_ironreef',
                name: 'Molthaven Sentinel',
                species: 'crab',
                hueShift: 180,
                connection: [1, 2],
                requirement: { itemId: 'iron_nugget', quantity: 2, label: 'Iron Nuggets' },
                dialog: {
                    blocked: [
                        'Iron Reef passage is restricted.',
                        'The scholars demand reinforced railings before anyone crosses.',
                        'Fetch me 2 Iron Nuggets so I can plate the supports.'
                    ],
                    ready: [
                        'Solid metal. Exactly what I needed.',
                        'Hold fast—this takes a steady claw.'
                    ],
                    cleared: [
                        'Railings are bolted. Report back if you spot any stress cracks.'
                    ]
                }
            },
            {
                id: 'bridge_guard_ironreef_to_deepcoil',
                name: 'Deepcoil Sentinel',
                species: 'mantis_shrimp',
                hueShift: 310,
                connection: [2, 3],
                requirement: { itemId: 'ancient_shell', quantity: 1, label: 'Ancient Shell' },
                dialog: {
                    blocked: [
                        'Deepcoil Isle is sealed to the unproven.',
                        'The Chronicle wards are brittle from the storm.',
                        'Bring me an Ancient Shell so I can scribe a new ward and let you pass.'
                    ],
                    ready: [
                        'The shell hums with memory. Perfect.',
                        'Stand back while I etch the sigils.'
                    ],
                    cleared: [
                        'The ward holds. Thread carefully among the archives.'
                    ]
                }
            }
        ];

        let blockerCount = 0;

        for (const config of blockerConfigs) {
            const connection = this.worldMap.bridgeConnections.find(conn => {
                const indexes = [conn.island1Index, conn.island2Index];
                return indexes.includes(config.connection[0]) && indexes.includes(config.connection[1]);
            });
            if (!connection) continue;

            const centerTileX = Math.floor((connection.island1.x + connection.island2.x) / 2);
            const centerTileY = Math.floor((connection.island1.y + connection.island2.y) / 2);
            const centerWorldX = centerTileX * tileSize + tileSize / 2;
            const centerWorldY = centerTileY * tileSize + tileSize / 2;

            const blockedX = centerWorldX - CONSTANTS.CHARACTER_WIDTH / 2;
            const blockedY = centerWorldY - CONSTANTS.CHARACTER_HEIGHT;

            const dirX = connection.island2.x - connection.island1.x;
            const dirY = connection.island2.y - connection.island1.y;
            const magnitude = Math.hypot(dirX, dirY) || 1;
            const perpX = -dirY / magnitude;
            const perpY = dirX / magnitude;
            const offsetTiles = config.sideOffsetTiles ?? 2;

            const candidateCenters = [
                { x: centerWorldX + perpX * offsetTiles * tileSize, y: centerWorldY + perpY * offsetTiles * tileSize },
                { x: centerWorldX - perpX * offsetTiles * tileSize, y: centerWorldY - perpY * offsetTiles * tileSize }
            ];

            let clearCenter = { x: centerWorldX, y: centerWorldY };
            for (const candidate of candidateCenters) {
                const tileX = Math.floor(candidate.x / tileSize);
                const tileY = Math.floor(candidate.y / tileSize);
                if (this.worldMap.terrainMap?.[tileY]?.[tileX] === 0) {
                    clearCenter = candidate;
                    break;
                }
            }

            const clearX = clearCenter.x - CONSTANTS.CHARACTER_WIDTH / 2;
            const clearY = clearCenter.y - CONSTANTS.CHARACTER_HEIGHT;

            const npc = new NPC(blockedX, blockedY, config.name, config.dialog.blocked, config.species);
            npc.isBridgeBlocker = true;
            npc.blockerId = config.id;
            npc.blockerConfig = config;
            npc.blockerRequirement = config.requirement;
            npc.blockerDialog = config.dialog;
            npc.canWander = false;
            npc.homePosition = { x: blockedX, y: blockedY };
            npc.blockedPosition = { x: blockedX, y: blockedY };
            npc.clearPosition = { x: clearX, y: clearY };
            if (typeof config.hueShift === 'number') {
                npc.hueShift = config.hueShift;
            }

            const blockerState = this.blockerState[config.id];
            if (blockerState?.cleared) {
                npc.position.x = npc.clearPosition.x;
                npc.position.y = npc.clearPosition.y;
                npc.homePosition = { ...npc.clearPosition };
                npc.dialog = config.dialog.cleared;
            }

            this.loadNPCSprite(npc);
            this.npcs.push(npc);
            blockerCount++;
            console.log(`  🛡️ Bridge blocker ${config.name} guarding ${config.connection.join(' ↔ ')}`);
        }

        if (blockerCount > 0) {
            console.log(`🚧 Added ${blockerCount} bridge blockers`);
        }
    }

    handleBridgeBlockerInteraction(npc) {
        if (!npc || !npc.blockerConfig || !this.dialogSystem) return;

        const config = npc.blockerConfig;
        const requirement = npc.blockerRequirement;
        const inventory = this.inventorySystem;
        const state = this.blockerState[config.id] || { cleared: false };

        const showDialog = (lines) => {
            if (!lines || lines.length === 0) return;
            this.sfx.play('dialog_open');
            this.dialogSystem.show(lines);
        };

        if (!state.cleared) {
            if (!requirement || !inventory) {
                showDialog(config.dialog.blocked);
                return;
            }

            if (inventory.hasItem(requirement.itemId, requirement.quantity)) {
                inventory.removeItem(requirement.itemId, requirement.quantity);
                this.blockerState[config.id] = { cleared: true };
                this.moveBridgeBlockerAside(npc);
                if (this.continuitySystem) {
                    this.continuitySystem.addContinuity(4, `bridge_blocker_${config.id}`);
                }
                const successLines = [
                    ...(config.dialog.ready || []),
                    ...(config.dialog.cleared || [])
                ];
                showDialog(successLines.length ? successLines : config.dialog.cleared);
            } else {
                showDialog(config.dialog.blocked);
            }
            return;
        }

        showDialog(config.dialog.cleared || npc.dialog);
    }

    moveBridgeBlockerAside(npc) {
        if (!npc || !npc.clearPosition) return;
        npc.position.x = npc.clearPosition.x;
        npc.position.y = npc.clearPosition.y;
        npc.homePosition = { ...npc.clearPosition };
        npc.dialog = npc.blockerDialog?.cleared || npc.dialog;
    }

    // Create decorations (plants, shells, rocks) on islands
    createDecorations(islands) {
        const tileSize = CONSTANTS.TILE_SIZE;
        // Don't clear - paths were already added by generatePaths()
        // this.decorations = [];

        // Procedural decorations from WorldMap disabled for now (performance)
        // this.addProceduralDecorations();
        
        // Decoration types with sizes matching our clean extracted sprites
        // Common decorations (high spawn weight)
        // solid: true marks the tile as impassable for collision
        const commonDecorTypes = [
            // Palm trees — solid trunks
            { type: 'palm', width: 37, height: 48, solid: true },
            { type: 'palm2', width: 33, height: 48, solid: true },
            // Bushes & plants — walkable
            { type: 'bush', width: 24, height: 23 },
            { type: 'bush_flower', width: 24, height: 24 },
            { type: 'bush_flower2', width: 24, height: 21 },
            { type: 'fern', width: 24, height: 19 },
            { type: 'fern2', width: 24, height: 22 },
            { type: 'seagrass', width: 15, height: 24 },
            { type: 'tropical_plant', width: 24, height: 23 },
            // Shells — walkable
            { type: 'shell_pink', width: 20, height: 17 },
            { type: 'shell_fan', width: 20, height: 17 },
            { type: 'shell_spiral', width: 14, height: 20 },
            { type: 'shell_white', width: 20, height: 15 },
            // Rocks — solid
            { type: 'rock', width: 20, height: 20, solid: true },
            { type: 'rock2', width: 20, height: 20, solid: true },
            { type: 'rock_small', width: 20, height: 13 },
            // Beach items — walkable
            { type: 'starfish', width: 17, height: 20 },
            { type: 'starfish2', width: 17, height: 20 },
            { type: 'coral', width: 20, height: 18 },
            { type: 'coral2', width: 20, height: 19 },
            { type: 'driftwood', width: 20, height: 16 },
        ];
        
        // Rare/special decorations (low spawn chance)
        // solid: true = blocks player movement, interactive: true = can interact with SPACE
        const rareDecorTypes = [
            { type: 'treasure_chest', width: 27, height: 28, solid: true, interactive: true, lore: 'You inspect the old chest... The wood is weathered and the lock is rusted shut. You wonder what treasures might be inside.' },
            { type: 'treasure_chest2', width: 28, height: 28, solid: true, interactive: true, lore: 'You examine the mysterious chest closely. Strange markings cover its surface. What secrets could it hold?' },
            { type: 'lobster_statue', width: 17, height: 28, solid: true, interactive: true, lore: 'An ancient statue honoring the First Shell. Locals leave offerings here.' },
            { type: 'wooden_sign', width: 28, height: 28, solid: true, interactive: true, lore: 'The writing has faded, but you can make out: "...beware the deep currents..."' },
            { type: 'anchor', width: 21, height: 28, solid: true },
            { type: 'campfire', width: 16, height: 22, solid: true },
            { type: 'fishing_net', width: 28, height: 23 },
            { type: 'message_bottle', width: 12, height: 16, interactive: true, lore: 'A note inside reads: "If you find this, know that the Waygates remember."' },
            { type: 'log_pile', width: 28, height: 26, solid: true },
            { type: 'buoy', width: 23, height: 28, solid: true },
        ];
        
        // Original decoration system (restored - new procedural system had performance issues)
        {
        for (const island of islands) {
            // Number of decorations based on island size (reduced for cleaner look)
            const numDecorations = Math.floor(island.size * 1.2);
            
            for (let i = 0; i < numDecorations; i++) {
                // Random position within island
                const angle = this.seededRandom() * Math.PI * 2;
                const radius = this.seededRandom() * island.size * 0.85;
                
                const col = Math.floor(island.x + Math.cos(angle) * radius);
                const row = Math.floor(island.y + Math.sin(angle) * radius);
                
                // Check if on land
                if (col < 0 || col >= this.worldMap.width || row < 0 || row >= this.worldMap.height) continue;
                const groundTile = this.worldMap.groundLayer[row]?.[col];
                if (groundTile === 1) continue; // Skip water
                
                // Check not too close to buildings
                const worldX = col * tileSize;
                const worldY = row * tileSize;
                let tooClose = false;
                for (const building of this.buildings) {
                    const dx = worldX - (building.x + building.width / 2);
                    const dy = worldY - (building.y + building.height / 2);
                    if (Math.sqrt(dx*dx + dy*dy) < 56) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
                
                // Check not too close to other decorations (min spacing)
                let tooCloseToDecor = false;
                for (const existing of this.decorations) {
                    if (existing.type === 'dirt_path') continue; // paths don't count
                    const ddx = worldX - existing.x;
                    const ddy = worldY - existing.y;
                    if (Math.sqrt(ddx*ddx + ddy*ddy) < 20) {
                        tooCloseToDecor = true;
                        break;
                    }
                }
                if (tooCloseToDecor) continue;
                
                // Pick random decoration type (90% common, 10% rare)
                const useRare = this.seededRandom() < 0.1;
                const pool = useRare ? rareDecorTypes : commonDecorTypes;
                const decorType = pool[Math.floor(this.seededRandom() * pool.length)];
                
                const decor = {
                    x: worldX + this.seededRandom() * tileSize,
                    y: worldY + this.seededRandom() * tileSize,
                    type: decorType.type,
                    color: decorType.color,
                    width: decorType.width,
                    height: decorType.height,
                    solid: decorType.solid || false,
                    interactive: decorType.interactive || false,
                    lore: decorType.lore || null
                };
                
                // Collision is now marked in a separate pass after all decorations are placed
                // (including editor-placed ones) — see markDecorationCollisions()
                
                this.decorations.push(decor);
            }
        }
        }
        
        console.log(`🌿 Total decorations after processing: ${this.decorations.length}`);
    }

    // Load sprite for an NPC based on their species
    loadNPCSprite(npc) {
        const species = npc.species || 'lobster';
        const basePath = `assets/sprites/characters/${species}`;
        const hueShift = npc.hueShift || 0;
        
        // Load directional sprites
        const directions = ['south', 'north', 'east', 'west'];
        const directionalSprites = {};
        const walkSprites = { south: [], north: [], east: [], west: [] };
        
        // Load idle/static sprites for each direction
        directions.forEach(dir => {
            const img = new Image();
            img.onload = () => {
                directionalSprites[dir] = hueShift !== 0 ? this.applyHueShiftToImage(img, hueShift) : img;
                npc.setDirectionalSprites(directionalSprites);
            };
            img.src = `${basePath}/${dir}.png`;
        });
        
        // Load walk animation frames for each direction (3 frames per direction)
        directions.forEach(dir => {
            for (let i = 0; i < 3; i++) {
                const walkImg = new Image();
                walkImg.onload = () => {
                    walkSprites[dir][i] = hueShift !== 0 ? this.applyHueShiftToImage(walkImg, hueShift) : walkImg;
                    npc.setWalkSprites(walkSprites);
                };
                walkImg.src = `${basePath}/frames/${dir}_walk_${i}.png`;
            }
        });
    }
    
    // Apply hue shift to a loaded image, returns a canvas
    applyHueShiftToImage(image, hueShift) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) continue;
            
            // Convert to HSL
            const max = Math.max(r, g, b) / 255;
            const min = Math.min(r, g, b) / 255;
            const l = (max + min) / 2;
            
            if (max === min) continue; // Gray, skip
            
            const d = max - min;
            const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            let h;
            const rn = r/255, gn = g/255, bn = b/255;
            if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            else if (max === gn) h = ((bn - rn) / d + 2) / 6;
            else h = ((rn - gn) / d + 4) / 6;
            
            // Only shift reddish/warm colors (hue near 0 or 1)
            if (h > 0.1 && h < 0.9) continue;
            
            // Apply shift
            h = (h + hueShift / 360) % 1;
            if (h < 0) h += 1;
            
            // HSL to RGB
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p2 = 2 * l - q2;
            
            data[i] = Math.round(hue2rgb(p2, q2, h + 1/3) * 255);
            data[i+1] = Math.round(hue2rgb(p2, q2, h) * 255);
            data[i+2] = Math.round(hue2rgb(p2, q2, h - 1/3) * 255);
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    // Update FPS counter
    updateFPS(deltaTime) {
        this.frameCount++;
        this.fpsUpdateTime += deltaTime;

        if (this.fpsUpdateTime >= 1.0) {
            this.fps = Math.round(this.frameCount / this.fpsUpdateTime);
            this.frameCount = 0;
            this.fpsUpdateTime = 0;

            // Update HTML debug info if available
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = this.fps;
            }

            const posElement = document.getElementById('position');
            if (posElement) {
                posElement.textContent = `${Math.floor(this.player.position.x)}, ${Math.floor(this.player.position.y)}`;
            }
        }
    }

    // Deterministic time-step hook for automated testing
    advanceTime(ms) {
        const step = 1000 / 60;
        const steps = Math.max(1, Math.round(ms / step));

        for (let i = 0; i < steps; i++) {
            const deltaTime = 1 / 60;
            this.update(deltaTime);
            this.render();
            this.updateFPS(deltaTime);
        }
    }

    // Text snapshot for automated testing
    getTextState() {
        const playerTile = this.getPlayerTilePosition();
        const payload = {
            location: this.currentLocation,
            map: {
                type: this.worldMap?.meta?.type || 'unknown',
                name: this.worldMap?.meta?.name || 'Unknown',
                width: this.worldMap?.width || 0,
                height: this.worldMap?.height || 0
            },
            player: {
                x: Math.round(this.player.position.x),
                y: Math.round(this.player.position.y),
                tile: playerTile,
                direction: this.player.direction,
                moving: this.player.isMoving
            },
            buildings: this.currentLocation === 'outdoor' ? this.buildings.length : 0,
            npcs: this.npcs.length,
            dialogOpen: this.dialogSystem?.isOpen() || false,
            coordinateSystem: 'Origin (0,0) is top-left. +x right, +y down.'
        };

        return JSON.stringify(payload);
    }

    // Quick respawn (R key) — dev shortcut, no drift animation, just teleport to safe spot
    quickRespawn() {
        if (!this.player) return;
        console.log('🔄 Quick respawn triggered (R key)');

        // Cancel any active drift
        if (this.driftReset && this.driftReset.isDrifting) {
            this.driftReset.isDrifting = false;
            if (this.driftReset.driftOverlay) {
                this.driftReset.driftOverlay.style.opacity = '0';
                this.driftReset.driftOverlay.style.display = 'none';
            }
            if (this.driftReset.driftTextElement) {
                this.driftReset.driftTextElement.style.opacity = '0';
            }
        }

        // Restore shell integrity
        if (this.player.shellIntegrityMax) {
            this.player.shellIntegrity = this.player.shellIntegrityMax;
        }

        // Clear nearby enemies
        if (this.combatSystem) {
            this.combatSystem.enemies = [];
        }

        // Find a safe spawn on a random island
        const islands = this.worldMap ? this.worldMap.islands : (this.pendingIslands || []);
        if (islands && islands.length > 0) {
            const randomIsland = islands[Math.floor(Math.random() * islands.length)];
            const tileSize = CONSTANTS.TILE_SIZE;
            let spawned = false;

            for (let radius = 2; radius < 12 && !spawned; radius++) {
                for (let angle = 0; angle < 16 && !spawned; angle++) {
                    const angleRad = (angle / 16) * 2 * Math.PI;
                    const testCol = randomIsland.x + Math.floor(Math.cos(angleRad) * radius);
                    const testRow = randomIsland.y + Math.floor(Math.sin(angleRad) * radius);
                    const worldX = (testCol * tileSize) + (tileSize / 2);
                    const worldY = (testRow * tileSize) + (tileSize / 2);

                    if (this.isPositionSafe(worldX, worldY)) {
                        this.player.position.x = worldX - this.player.width / 2;
                        this.player.position.y = worldY - this.player.height / 2;
                        spawned = true;
                    }
                }
            }
        }

        // Push away from NPCs and update camera
        this.pushPlayerAwayFromNPCs();
        this.camera.setTarget(this.player);

        if (typeof gameNotifications !== 'undefined' && gameNotifications) {
            gameNotifications.info('Respawned');
        }
    }

    // Setup controls help overlay (H key to toggle) + canvas HUD click handler
    _setupControlsHelp() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (this.spectateMode) return; // All game keys blocked in spectator mode
            const key = e.key.toLowerCase();
            if (key === 'h') {
                e.preventDefault();
                this.controlsVisible = !this.controlsVisible;
            }
            // R = quick respawn (dev shortcut — skip the drift animation)
            if (key === 'r' && this.gameActive) {
                e.preventDefault();
                this.quickRespawn();
            }
            // Also backtick for debug (existing behavior)
            if (e.key === '`') {
                e.preventDefault();
                this.toggleDebug();
            }
            // Cmd+Shift+D (Mac) / Ctrl+Shift+D (Windows) = toggle dev mode
            if (key === 'd' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.toggleDevMode();
            }
        });

        // Canvas click handler for HUD panel music toggle
        this.canvas.addEventListener('click', (e) => {
            if (!this.gameActive || !this._hudMusicHitArea) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            const hit = this._hudMusicHitArea;
            if (cx >= hit.x && cx <= hit.x + hit.w && cy >= hit.y && cy <= hit.y + hit.h) {
                if (typeof audioManager !== 'undefined') {
                    this.hudPanelData.musicMuted = audioManager.toggleMute();
                }
            }
        });
    }

    // Render HUD panel on game canvas (top-right: music toggle, player count, controls hint)
    renderCanvasHUDPanel() {
        const ctx = this.canvas.getContext('2d');
        const cw = this.canvas.width;

        ctx.save();

        const margin = 8;
        const panelW = 130;
        const lineH = 18;
        const padX = 8;
        const padY = 6;

        // Rows to draw
        const musicText = this.hudPanelData.musicMuted ? '[M] Music OFF' : '[M] Music';
        const countText = `${this.hudPanelData.total} online`;
        const breakdownText = `Players ${this.hudPanelData.humans} / Bots ${this.hudPanelData.bots}`;
        const controlsText = '[H] Controls';

        const rows = [musicText, countText, breakdownText, controlsText];
        const panelH = padY * 2 + rows.length * lineH;
        const panelX = cw - panelW - margin;
        const panelY = margin;

        // Background
        ctx.fillStyle = 'rgba(13, 8, 6, 0.85)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // Border
        ctx.strokeStyle = 'rgba(196, 58, 36, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        const centerX = panelX + panelW / 2;

        // Row 1: Music toggle
        ctx.fillStyle = '#c43a24';
        ctx.fillText(musicText, centerX, panelY + padY + 12);

        // Row 2: Online count
        ctx.fillStyle = '#8a7068';
        ctx.fillText(countText, centerX, panelY + padY + 12 + lineH);

        // Row 3: Players/Bots breakdown
        ctx.fillStyle = '#e8d5cc';
        ctx.font = '10px monospace';
        ctx.fillText(breakdownText, centerX, panelY + padY + 12 + lineH * 2);

        // Row 4: Controls hint
        ctx.fillStyle = '#8a7068';
        ctx.font = '11px monospace';
        ctx.fillText(controlsText, centerX, panelY + padY + 12 + lineH * 3);

        ctx.restore();

        // Store hit area for music click detection
        this._hudMusicHitArea = {
            x: panelX, y: panelY,
            w: panelW, h: lineH + padY
        };
    }

    // Render controls help overlay (screen-space, compact bottom-right box)
    renderControlsHelp() {
        if (!this.controlsVisible) return;
        const ctx = this.canvas.getContext('2d');
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        ctx.save();

        // Dim background scrim
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, cw, ch);

        // Controls list (IJKL two-hand layout)
        const controls = [
            ['WASD', 'Move'],
            ['J', 'Attack'],
            ['K', 'Talk / Interact'],
            ['I', 'Inventory'],
            ['L', 'Quest Log'],
            ['M', 'Toggle Music'],
            ['R', 'Respawn (beta)'],
        ];

        const lineH = 16;
        const boxPadX = 10;
        const boxPadY = 8;
        const titleH = 20;
        const footerH = 14;
        const boxWidth = 180;
        const boxHeight = titleH + controls.length * lineH + footerH + boxPadY * 2;
        const boxX = (cw - boxWidth) / 2;  // Dead center horizontally
        const boxY = (ch - boxHeight) / 2; // Dead center vertically

        // Semi-transparent scrim behind box only
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(boxX - 4, boxY - 4, boxWidth + 8, boxHeight + 8);

        // Dark background box
        ctx.fillStyle = 'rgba(13, 8, 6, 0.92)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Border
        ctx.strokeStyle = '#8a4030';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Title
        ctx.fillStyle = '#c43a24';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONTROLS', boxX + boxWidth / 2, boxY + boxPadY + 12);

        // Controls
        ctx.font = '11px monospace';
        const startY = boxY + boxPadY + titleH + 4;
        const keyX = boxX + boxPadX + 50;
        const valX = boxX + boxPadX + 60;

        for (let i = 0; i < controls.length; i++) {
            const y = startY + i * lineH;
            // Key
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'right';
            ctx.fillText(controls[i][0], keyX, y);
            // Action
            ctx.fillStyle = '#e8d5cc';
            ctx.textAlign = 'left';
            ctx.fillText(controls[i][1], valX, y);
        }

        // Footer
        ctx.fillStyle = '#8a7068';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press H to close', boxX + boxWidth / 2, boxY + boxHeight - 5);

        ctx.restore();
    }

    // Toggle debug mode
    toggleDebug() {
        this.debugMode = !this.debugMode;
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.classList.toggle('hidden');
        }
    }

    // Toggle developer mode (enables map editor, feedback, shows dev indicator)
    toggleDevMode() {
        this.devMode = !this.devMode;
        console.log(`🛠️ Dev mode ${this.devMode ? 'ON' : 'OFF'}`);
        
        if (this.devMode) {
            this.showDevModeIndicator();
        } else {
            this.hideDevModeIndicator();
        }
        
        // Update map editor button visibility in main.js
        this.updateDevModeUI();
    }

    // Show "DEV MODE" indicator
    showDevModeIndicator() {
        let indicator = document.getElementById('dev-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'dev-mode-indicator';
            indicator.textContent = 'DEV MODE';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(255, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                border-radius: 4px;
                pointer-events: none;
            `;
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    // Hide dev mode indicator
    hideDevModeIndicator() {
        const indicator = document.getElementById('dev-mode-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Update dev mode UI elements (called from toggleDevMode)
    updateDevModeUI() {
        // This will be called by main.js to show/hide dev tools
        if (window.updateDevModeVisibility) {
            window.updateDevModeVisibility(this.devMode);
        }
    }

    // Force reload character sprites for a specific species and rebuild combined sheets
    async reloadCharacterAssets(species = 'lobster') {
        // Get base path for species - check if species folder exists, fallback to root
        const speciesPath = `assets/sprites/characters/${species}`;
        const fallbackPath = 'assets/sprites/characters';
        
        // Build items list with species-specific paths
        const items = [
            { key: 'character_south', path: `${speciesPath}/south.png`, fallback: `${fallbackPath}/south.png`, optional: false },
            { key: 'character_north', path: `${speciesPath}/north.png`, fallback: `${fallbackPath}/north.png`, optional: false },
            { key: 'character_west', path: `${speciesPath}/west.png`, fallback: `${fallbackPath}/west.png`, optional: false },
            { key: 'character_east', path: `${speciesPath}/east.png`, fallback: `${fallbackPath}/east.png`, optional: false },
            { key: 'character_south_walk', path: `${speciesPath}/south_walk.png`, fallback: `${fallbackPath}/south_walk.png`, optional: true },
            { key: 'character_north_walk', path: `${speciesPath}/north_walk.png`, fallback: `${fallbackPath}/north_walk.png`, optional: true },
            { key: 'character_west_walk', path: `${speciesPath}/west_walk.png`, fallback: `${fallbackPath}/west_walk.png`, optional: true },
            { key: 'character_east_walk', path: `${speciesPath}/east_walk.png`, fallback: `${fallbackPath}/east_walk.png`, optional: true },
            { key: 'character_south_walk_0', path: `${speciesPath}/frames/south_walk_0.png`, fallback: `${fallbackPath}/frames/south_walk_0.png`, optional: true },
            { key: 'character_south_walk_1', path: `${speciesPath}/frames/south_walk_1.png`, fallback: `${fallbackPath}/frames/south_walk_1.png`, optional: true },
            { key: 'character_south_walk_2', path: `${speciesPath}/frames/south_walk_2.png`, fallback: `${fallbackPath}/frames/south_walk_2.png`, optional: true },
            { key: 'character_north_walk_0', path: `${speciesPath}/frames/north_walk_0.png`, fallback: `${fallbackPath}/frames/north_walk_0.png`, optional: true },
            { key: 'character_north_walk_1', path: `${speciesPath}/frames/north_walk_1.png`, fallback: `${fallbackPath}/frames/north_walk_1.png`, optional: true },
            { key: 'character_north_walk_2', path: `${speciesPath}/frames/north_walk_2.png`, fallback: `${fallbackPath}/frames/north_walk_2.png`, optional: true },
            { key: 'character_west_walk_0', path: `${speciesPath}/frames/west_walk_0.png`, fallback: `${fallbackPath}/frames/west_walk_0.png`, optional: true },
            { key: 'character_west_walk_1', path: `${speciesPath}/frames/west_walk_1.png`, fallback: `${fallbackPath}/frames/west_walk_1.png`, optional: true },
            { key: 'character_west_walk_2', path: `${speciesPath}/frames/west_walk_2.png`, fallback: `${fallbackPath}/frames/west_walk_2.png`, optional: true },
            { key: 'character_east_walk_0', path: `${speciesPath}/frames/east_walk_0.png`, fallback: `${fallbackPath}/frames/east_walk_0.png`, optional: true },
            { key: 'character_east_walk_1', path: `${speciesPath}/frames/east_walk_1.png`, fallback: `${fallbackPath}/frames/east_walk_1.png`, optional: true },
            { key: 'character_east_walk_2', path: `${speciesPath}/frames/east_walk_2.png`, fallback: `${fallbackPath}/frames/east_walk_2.png`, optional: true }
        ];

        const reloadImage = ({ key, path, fallback, optional }) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.assetLoader.setImage(key, img);
                resolve(true);
            };
            img.onerror = () => {
                // Try fallback path
                if (fallback) {
                    const fallbackImg = new Image();
                    fallbackImg.onload = () => {
                        this.assetLoader.setImage(key, fallbackImg);
                        resolve(true);
                    };
                    fallbackImg.onerror = () => {
                        if (!optional) {
                            console.warn(`Failed to reload character asset: ${path}`);
                        }
                        resolve(false);
                    };
                    fallbackImg.src = `${fallback}?v=${Date.now()}`;
                } else {
                    if (!optional) {
                        console.warn(`Failed to reload character asset: ${path}`);
                    }
                    resolve(false);
                }
            };
            img.src = `${path}?v=${Date.now()}`;
        });

        console.log(`🦀 Loading ${species} sprites...`);
        await Promise.all(items.map(reloadImage));
        this.createCombinedSpriteSheet(this.characterConfig);
        console.log(`✅ Loaded ${species} character assets`);
    }

    // Load game assets
    loadAssets() {
        console.log('📦 Loading game assets...');

        // Load PixelLab assets
        this.assetLoader
            .loadImage('character_south', 'assets/sprites/characters/lobster/south.png')
            .loadImage('character_north', 'assets/sprites/characters/lobster/north.png')
            .loadImage('character_west', 'assets/sprites/characters/lobster/west.png')
            .loadImage('character_east', 'assets/sprites/characters/lobster/east.png')
            .loadImage('character_south_walk', 'assets/sprites/characters/lobster/south_walk.png')
            .loadImage('character_north_walk', 'assets/sprites/characters/lobster/north_walk.png')
            .loadImage('character_west_walk', 'assets/sprites/characters/lobster/west_walk.png')
            .loadImage('character_east_walk', 'assets/sprites/characters/lobster/east_walk.png')
            .loadImageOptional('character_south_walk_0', 'assets/sprites/characters/lobster/frames/south_walk_0.png')
            .loadImageOptional('character_south_walk_1', 'assets/sprites/characters/lobster/frames/south_walk_1.png')
            .loadImageOptional('character_south_walk_2', 'assets/sprites/characters/lobster/frames/south_walk_2.png')
            .loadImageOptional('character_north_walk_0', 'assets/sprites/characters/lobster/frames/north_walk_0.png')
            .loadImageOptional('character_north_walk_1', 'assets/sprites/characters/lobster/frames/north_walk_1.png')
            .loadImageOptional('character_north_walk_2', 'assets/sprites/characters/lobster/frames/north_walk_2.png')
            .loadImageOptional('character_west_walk_0', 'assets/sprites/characters/lobster/frames/west_walk_0.png')
            .loadImageOptional('character_west_walk_1', 'assets/sprites/characters/lobster/frames/west_walk_1.png')
            .loadImageOptional('character_west_walk_2', 'assets/sprites/characters/lobster/frames/west_walk_2.png')
            .loadImageOptional('character_east_walk_0', 'assets/sprites/characters/lobster/frames/east_walk_0.png')
            .loadImageOptional('character_east_walk_1', 'assets/sprites/characters/lobster/frames/east_walk_1.png')
            .loadImageOptional('character_east_walk_2', 'assets/sprites/characters/lobster/frames/east_walk_2.png');

        const accessoryCatalog = CONSTANTS.ACCESSORY_CATALOG || [];
        accessoryCatalog.forEach((accessory) => {
            this.assetLoader.loadImageOptional(
                accessory.assetKey,
                `assets/sprites/accessories/${accessory.id}.png`
            );
        });

        this.assetLoader
            .loadImage('tileset_sand_water', 'assets/sprites/tiles/pixellab_sand_water.png')
            // numbered tileset removed — no longer needed
            .loadImageOptional('tileset_sand_path', 'assets/sprites/tiles/pixellab_sand_cobblestone.png')
            .loadImageOptional('tileset_dark_cobble', 'assets/sprites/tiles/dark_cobblestone_tileset.png')
            // dirt_cobble transition removed — paths butt up with straight edges
            .loadImageOptional('building_inn_base', 'assets/sprites/buildings/inn_base.png')
            .loadImageOptional('building_inn_roof', 'assets/sprites/buildings/inn_roof.png')
            .loadImageOptional('building_shop_base', 'assets/sprites/buildings/shop_base.png')
            .loadImageOptional('building_shop_roof', 'assets/sprites/buildings/shop_roof.png')
            .loadImageOptional('building_house_base', 'assets/sprites/buildings/house_base.png')
            .loadImageOptional('building_house_roof', 'assets/sprites/buildings/house_roof.png')
            .loadImageOptional('building_lighthouse_base', 'assets/sprites/buildings/lighthouse_base.png')
            .loadImageOptional('building_lighthouse_roof', 'assets/sprites/buildings/lighthouse_roof.png')
            // New building types - processed base sprites
            .loadImageOptional('building_tavern_base', 'assets/sprites/buildings/tavern_base.png')
            .loadImageOptional('building_bakery_base', 'assets/sprites/buildings/bakery_base.png')
            .loadImageOptional('building_tikihut_base', 'assets/sprites/buildings/tikihut_base.png')
            .loadImageOptional('building_fishingshack_base', 'assets/sprites/buildings/fishingshack_base.png')
            .loadImageOptional('building_boathouse_base', 'assets/sprites/buildings/boathouse_base.png')
            // DALL-E generated buildings (story locations)
            .loadImageOptional('building_shop_dalle', 'assets/sprites/buildings/shop_dalle_2.png')
            .loadImageOptional('building_inn_dalle', 'assets/sprites/buildings/inn_dalle_2.png')
            .loadImageOptional('building_house_dalle', 'assets/sprites/buildings/house_dalle_5.png')
            .loadImageOptional('building_tavern_dalle', 'assets/sprites/buildings/tavern_dalle_1.png')
            .loadImageOptional('building_tikihut_dalle', 'assets/sprites/buildings/tikihut_dalle_1.png')
            .loadImageOptional('building_bakery_dalle', 'assets/sprites/buildings/bakery_dalle_1.png')
            .loadImageOptional('building_fishingshack_dalle', 'assets/sprites/buildings/fishingshack_dalle_1.png')
            .loadImageOptional('building_boathouse_dalle', 'assets/sprites/buildings/boathouse_dalle_1.png')
            .onProgress((loaded, total) => {
                console.log(`Loading assets: ${loaded}/${total}`);
            })
            .onComplete(() => {
                const hasRealSprites = this.assetLoader.hasImage('character_south');

                // Check if there's a saved character to load the correct species
                const savedData = this.customizationData.load();
                const species = savedData?.config?.species || 'lobster';

                // Handle character sprites
                if (hasRealSprites) {
                    console.log('✅ Using PixelLab sprites!');
                    // Load the correct species sprites for returning players
                    if (savedData && species !== 'lobster') {
                        console.log(`🦀 Loading saved species: ${species}`);
                        this.reloadCharacterAssets(species);
                    } else {
                        this.createCombinedSpriteSheet();
                    }
                } else {
                    console.log('📦 Using placeholder character sprites');
                    this.assetLoader.initPlaceholders();

                    const characterImage = this.assetLoader.getImage('character_placeholder');
                    if (characterImage) {
                        this.spriteRenderer.addSpriteSheet('character', characterImage, CONSTANTS.CHARACTER_WIDTH, CONSTANTS.CHARACTER_HEIGHT, {
                            idle: { down: [0], up: [1], left: [2], right: [3] },
                            walk: { down: [0], up: [1], left: [2], right: [3] }
                        });
                    }
                }

                // Load tileset - try PixelLab first, fallback to placeholder
                const pixelLabTileset = this.assetLoader.getImage('tileset_sand_water');
                if (pixelLabTileset) {
                    this.tileRenderer.addTileset('main', pixelLabTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('✅ Loaded PixelLab sand/water tileset');
                } else {
                    // Fallback to placeholder
                    if (!this.assetLoader.hasImage('tileset_placeholder')) {
                        this.assetLoader.initPlaceholders();
                    }
                    const tilesetImage = this.assetLoader.getImage('tileset_placeholder');
                    if (tilesetImage) {
                        this.tileRenderer.addTileset('main', tilesetImage, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 8);
                        console.log('✅ Loaded placeholder tileset');
                    }
                }

                // Load sand→path transition tileset (light cobblestone)
                const sandPathTileset = this.assetLoader.getImage('tileset_sand_path');
                if (sandPathTileset) {
                    this.tileRenderer.addTileset('path', sandPathTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('Loaded PixelLab sand/path tileset');
                }
                
                // Load dark cobblestone tileset
                const darkCobbleTileset = this.assetLoader.getImage('tileset_dark_cobble');
                if (darkCobbleTileset) {
                    this.tileRenderer.addTileset('dark_path', darkCobbleTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('Loaded dark cobblestone tileset');
                }
                
                // dirt_cobble transition tileset removed — paths butt up with straight edges

                // Always create a simple beach decoration tileset (can be replaced later)
                const decorTileset = this.assetLoader.createBeachDecorTileset();
                if (decorTileset) {
                    this.tileRenderer.addTileset('decor', decorTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('✅ Loaded beach decoration tileset');
                }

                // Create a simple interior tileset (placeholder)
                const interiorTileset = this.assetLoader.createInteriorTileset();
                if (interiorTileset) {
                    this.tileRenderer.addTileset('interior', interiorTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('✅ Loaded interior tileset');
                }

                // Load decoration sprites
                this.decorationLoader.load().then(() => {
                    console.log('🌴 Decoration sprites loaded');
                }).catch(err => {
                    console.warn('Failed to load some decoration sprites:', err);
                });
                
                // Load interior furniture sprites
                this.interiorLoader.load().then(() => {
                    console.log('🪑 Interior sprites loaded');
                }).catch(err => {
                    console.warn('Failed to load some interior sprites:', err);
                });
                
                // Now create buildings with loaded sprites
                if (this.pendingIslands) {
                    this.createClawlandsBuildings(this.pendingIslands);
                    this.pendingIslands = null;
                }

                this.assetsLoaded = true;
                console.log('✅ Assets loaded successfully');
                
                // Attach day/night cycle overlay to game container
                if (this.dayNightCycle) {
                    const gameContainer = document.getElementById('game-container');
                    if (gameContainer) {
                        this.dayNightCycle.attachTo(gameContainer);
                    }
                }
                
                // Preload audio (don't await - let it load in background)
                // Music starts in WelcomeScreen: title music on PLAY click,
                // overworld music on finalize() after character creation
                if (typeof audioManager !== 'undefined') {
                    audioManager.preload();
                }
            })
            .load();
    }

    // Build accessory sprite map (single image reused for all directions)
    getAccessorySpriteMap() {
        const accessories = new Map();
        const catalog = CONSTANTS.ACCESSORY_CATALOG || [];
        catalog.forEach((accessory) => {
            const image = this.assetLoader.getImage(accessory.assetKey);
            if (!image) return;
            accessories.set(accessory.id, {
                south: image,
                north: image,
                west: image,
                east: image
            });
        });
        return accessories;
    }

    // Create combined sprite sheet from individual direction images
    createCombinedSpriteSheet(customConfig = null) {
        console.log('🧪 Creating combined sprite sheets...');
        // Load idle sprites
        const normalizeImage = (image, targetWidth, targetHeight, label) => {
            if (!image) return null;
            if (image.width === targetWidth && image.height === targetHeight) return image;
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
            console.warn(`⚠️ Normalized sprite ${label || ''} from ${image.width}x${image.height} to ${targetWidth}x${targetHeight}`);
            return canvas;
        };

        const normalizeStrip = (image, frameWidth, frameHeight, label) => {
            if (!image) return null;
            const targetWidth = frameWidth * 3;
            const targetHeight = frameHeight;
            return normalizeImage(image, targetWidth, targetHeight, label);
        };

        const spriteWidth = CONSTANTS.CHARACTER_SPRITE_WIDTH || CONSTANTS.CHARACTER_WIDTH;
        const spriteHeight = CONSTANTS.CHARACTER_SPRITE_HEIGHT || CONSTANTS.CHARACTER_HEIGHT;

        const south = normalizeImage(this.assetLoader.getImage('character_south'), spriteWidth, spriteHeight, 'south idle');
        const north = normalizeImage(this.assetLoader.getImage('character_north'), spriteWidth, spriteHeight, 'north idle');
        const west = normalizeImage(this.assetLoader.getImage('character_west'), spriteWidth, spriteHeight, 'west idle');
        const east = normalizeImage(this.assetLoader.getImage('character_east'), spriteWidth, spriteHeight, 'east idle');

        // Load walk animation sprites (strip or separate frames)
        const southWalk = normalizeStrip(this.assetLoader.getImage('character_south_walk'), spriteWidth, spriteHeight, 'south walk');
        const northWalk = normalizeStrip(this.assetLoader.getImage('character_north_walk'), spriteWidth, spriteHeight, 'north walk');
        const westWalk = normalizeStrip(this.assetLoader.getImage('character_west_walk'), spriteWidth, spriteHeight, 'west walk');
        const eastWalk = normalizeStrip(this.assetLoader.getImage('character_east_walk'), spriteWidth, spriteHeight, 'east walk');
        const useSeparateWalkFrames = this.assetLoader.hasImage('character_south_walk_0');
        if (useSeparateWalkFrames) {
            const testFrame = this.assetLoader.getImage('character_north_walk_0');
            console.log('🧪 north_walk_0 size:', testFrame ? `${testFrame.width}x${testFrame.height}` : 'missing');
        }
        console.log('🧪 Walk frames available:', useSeparateWalkFrames);

        if (!south) return;

        // Use SpriteComposer if customization is provided
        let idleCanvas, walkCanvas;
        const accessorySprites = this.getAccessorySpriteMap();
        const accessoryIds = customConfig && customConfig.accessories ? customConfig.accessories : [];
        if (customConfig) {
            const idleImages = { south, north, west, east };
            const idleComposer = new SpriteComposer();
            idleComposer.addBaseSprite('character', idleImages);
            accessorySprites.forEach((sprites, key) => {
                idleComposer.addAccessory(key, sprites);
            });
            idleCanvas = idleComposer.compose({
                baseSpriteKey: 'character',
                ...customConfig
            });

            if (southWalk) {
                const walkImages = {
                    south: southWalk,
                    north: northWalk,
                    west: westWalk,
                    east: eastWalk
                };
                const walkComposer = new SpriteComposer();
                walkComposer.addBaseSprite('character', walkImages);
                accessorySprites.forEach((sprites, key) => {
                    walkComposer.addAccessory(key, sprites);
                });
                walkCanvas = walkComposer.compose({
                    baseSpriteKey: 'character',
                    ...customConfig
                });
                if (accessoryIds.length > 0 && !useSeparateWalkFrames) {
                    console.warn('⚠️ Accessories on walk strips may misalign; separate walk frames recommended.');
                }
                console.log(`✅ Created customized character sprites with walk animations`);
            } else {
                walkCanvas = idleCanvas; // Fallback to idle if no walk animations
                console.log(`✅ Created customized character sprite sheet (no walk animations)`);
            }
        } else {
            // Simple combination without customization - idle sprites
            idleCanvas = document.createElement('canvas');
            idleCanvas.width = spriteWidth * 4;
            idleCanvas.height = spriteHeight;
            const idleCtx = idleCanvas.getContext('2d');
            idleCtx.imageSmoothingEnabled = false;

            idleCtx.drawImage(south, 0, 0);
            if (north) idleCtx.drawImage(north, south.width, 0);
            if (west) idleCtx.drawImage(west, south.width * 2, 0);
            if (east) idleCtx.drawImage(east, south.width * 3, 0);

            // Walk animations if available
            if (useSeparateWalkFrames) {
                const frameWidth = spriteWidth;
                const frameHeight = spriteHeight;
                walkCanvas = document.createElement('canvas');
                walkCanvas.width = frameWidth * 3 * 4; // 3 frames per direction, 4 directions
                walkCanvas.height = frameHeight;
                const walkCtx = walkCanvas.getContext('2d');
                walkCtx.imageSmoothingEnabled = false;

                const directions = ['south', 'north', 'west', 'east'];
                directions.forEach((dir, dirIndex) => {
                    for (let frame = 0; frame < 3; frame++) {
                        const raw = this.assetLoader.getImage(`character_${dir}_walk_${frame}`);
                        const img = normalizeImage(raw, frameWidth, frameHeight, `${dir} walk frame ${frame}`);
                        if (!img) continue;
                        const dx = (dirIndex * 3 + frame) * frameWidth;
                        walkCtx.drawImage(img, dx, 0, frameWidth, frameHeight);
                    }
                });

                console.log(`✅ Created character walk sheet from separate frames: ${walkCanvas.width}x${walkCanvas.height}`);
            } else if (southWalk) {
                walkCanvas = document.createElement('canvas');
                walkCanvas.width = southWalk.width * 4; // Each walk sprite is 3 frames wide
                walkCanvas.height = southWalk.height;
                const walkCtx = walkCanvas.getContext('2d');
                walkCtx.imageSmoothingEnabled = false;

                walkCtx.drawImage(southWalk, 0, 0);
                if (northWalk) walkCtx.drawImage(northWalk, southWalk.width, 0);
                if (westWalk) walkCtx.drawImage(westWalk, southWalk.width * 2, 0);
                if (eastWalk) walkCtx.drawImage(eastWalk, southWalk.width * 3, 0);

                console.log(`✅ Created character sprites with walk animations: idle ${idleCanvas.width}x${idleCanvas.height}, walk ${walkCanvas.width}x${walkCanvas.height}`);
            } else {
                walkCanvas = idleCanvas;
                console.log(`✅ Created character sprite sheet: ${idleCanvas.width}x${idleCanvas.height} (no walk animations)`);
            }
        }

        // If separate walk frames exist, rebuild walk canvas from them (supports customConfig too)
        if (useSeparateWalkFrames) {
            const frameWidth = spriteWidth;
            const frameHeight = spriteHeight;
            const combined = document.createElement('canvas');
            combined.width = frameWidth * 3 * 4;
            combined.height = frameHeight;
            const ctx = combined.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            const directions = ['south', 'north', 'west', 'east'];
            const composer = customConfig ? new SpriteComposer() : null;
            const drawAccessories = (ctx, dx, dy, direction) => {
                if (!customConfig || accessoryIds.length === 0) return;
                accessoryIds.forEach((accessoryId) => {
                    const sprites = accessorySprites.get(accessoryId);
                    if (!sprites) return;
                    const accessoryImage = sprites[direction];
                    if (!accessoryImage) return;
                    ctx.drawImage(accessoryImage, dx, dy, frameWidth, frameHeight);
                });
            };
            const getAlphaBounds = (image) => {
                const temp = document.createElement('canvas');
                temp.width = image.width;
                temp.height = image.height;
                const tctx = temp.getContext('2d');
                tctx.imageSmoothingEnabled = false;
                tctx.clearRect(0, 0, temp.width, temp.height);
                tctx.drawImage(image, 0, 0);
                const data = tctx.getImageData(0, 0, temp.width, temp.height).data;

                let top = null;
                let bottom = null;
                for (let y = 0; y < temp.height; y++) {
                    for (let x = 0; x < temp.width; x++) {
                        const a = data[(y * temp.width + x) * 4 + 3];
                        if (a > 0) {
                            if (top === null) top = y;
                            bottom = y;
                        }
                    }
                }

                if (top === null) {
                    return { top: 0, bottom: temp.height - 1 };
                }

                return { top, bottom };
            };

            directions.forEach((dir, dirIndex) => {
                for (let frame = 0; frame < 3; frame++) {
                    const raw = this.assetLoader.getImage(`character_${dir}_walk_${frame}`);
                    let img = normalizeImage(raw, frameWidth, frameHeight, `${dir} walk frame ${frame}`);
                    if (!img) continue;
                    if (composer && customConfig) {
                        img = composer.applyColorTint(img, customConfig);
                    }
                    const dx = (dirIndex * 3 + frame) * frameWidth;
                    const bounds = getAlphaBounds(img);
                    const dy = (frameHeight - 1) - bounds.bottom;
                    ctx.drawImage(img, dx, dy, frameWidth, frameHeight);
                    drawAccessories(ctx, dx, dy, dir);
                }
            });

            walkCanvas = combined;
            console.log(`✅ Using separate walk frames for animation (combined ${combined.width}x${combined.height})`);
        }

        // Register idle sprites (1 frame per direction)
        this.spriteRenderer.addSpriteSheet('character_idle', idleCanvas, spriteWidth, spriteHeight, {
            idle: { down: [0], up: [1], left: [2], right: [3] }
        });

        // Register walk sprites (3 frames per direction)
        const frameWidth = useSeparateWalkFrames
            ? spriteWidth
            : (southWalk ? southWalk.width / 3 : spriteWidth);
        this.spriteRenderer.addSpriteSheet('character_walk', walkCanvas, frameWidth, spriteHeight, {
            walk: {
                down: [0, 1, 2],  // 3 walk frames for south
                up: [3, 4, 5],    // 3 walk frames for north
                left: [6, 7, 8],  // 3 walk frames for west
                right: [9, 10, 11] // 3 walk frames for east
            }
        });
    }

    // Show character customization UI
    showCharacterCustomization() {
        this.characterBuilder.show(
            (config) => {
                // Update callback - preview the character
                this.characterConfig = config;
                this.createCombinedSpriteSheet(config);
            },
            (finalConfig) => {
                // Complete callback - save the configuration
                this.characterConfig = finalConfig;
                console.log('🦞 Character customized:', finalConfig);
            }
        );
    }

    // Create buildings on Clawlands islands (called after assets are loaded)
    createClawlandsBuildings(islands) {
        if (!islands || islands.length === 0) {
            console.log('⚠️ No islands found, skipping building creation');
            return;
        }

        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Building configs with sprites - Port Clawson (main island)
        const buildingConfigs = [
            { type: 'inn', name: 'The Drift-In Inn' },
            { type: 'shop', name: 'Continuity Goods' },
            { type: 'lighthouse', name: 'Current\'s Edge Light' },
            // TODO: Re-enable when proper pixel art sprites are ready
            // { type: 'tavern', name: 'The Rusty Anchor' },
            // { type: 'bakery', name: 'Kelp & Crust Bakery' },
            { type: 'house', name: 'Anchor House' },
            { type: 'house', name: 'Molting Den' },
            { type: 'house', name: 'Shell & Stay' }
        ];

        console.log(`🏝️ Placing buildings on ${islands.length} islands...`);
        console.log(`   Islands:`, islands.map(i => `(${i.x},${i.y} size:${i.size})`).join(', '));
        this.buildings = [];
        this.signs = [];
        
        // Track placed positions to avoid overlap
        const placedPositions = [];

        // Find the largest island - put main buildings there
        const sortedIslands = [...islands].sort((a, b) => b.size - a.size);
        const mainIsland = sortedIslands[0];
        
        console.log(`   Main island: (${mainIsland.x},${mainIsland.y}) size:${mainIsland.size}`);

        // Place ALL buildings on the main island
        for (const config of buildingConfigs) {
            const sprite = this.assetLoader.getImage(`building_${config.type}_base`);
            const pixelWidth = sprite ? sprite.width : 48;
            const pixelHeight = sprite ? sprite.height : 48;
            const tilesWidth = Math.ceil(pixelWidth / tileSize);
            const tilesHeight = Math.ceil(pixelHeight / tileSize);
            
            console.log(`   Trying to place ${config.name} (${tilesWidth}x${tilesHeight} tiles, sprite=${sprite ? 'yes' : 'no'})`);
            
            // Find spot avoiding already placed buildings
            const pos = this.findBuildingLocationAvoidingOthers(
                mainIsland, 
                tilesWidth, 
                tilesHeight + 2, 
                placedPositions
            );
            
            if (pos) {
                placedPositions.push({ col: pos.col, row: pos.row, width: tilesWidth, height: tilesHeight + 2 });
                
                const building = new Building(
                    pos.col * tileSize,
                    pos.row * tileSize,
                    config.type,
                    sprite
                );
                building.name = config.name;
                
                this.buildings.push(building);
                this.collisionSystem.addBuilding(building);
                this.worldMap.clearDecorationRect(pos.col, pos.row, tilesWidth, tilesHeight);
                
                // Create sign to the right side of building
                const signX = pos.col * tileSize + pixelWidth + 4;
                const signY = (pos.row + tilesHeight - 1) * tileSize;
                this.signs.push(new Sign(signX, signY, config.name));
                
                console.log(`  🏠 Placed ${config.name} at (${pos.col},${pos.row})`);
            } else {
                console.log(`  ⚠️ Could not place ${config.name} - no space found`);
            }
        }

        // Place additional buildings on other islands (more buildings per island!)
        const secondaryBuildingTypes = [
            // TODO: Re-enable when proper pixel art sprites are ready
            // { type: 'bakery', name: 'Molthaven Bakery' },
            // { type: 'fishingshack', name: 'The Dry Dock' },
            // { type: 'tikihut', name: 'Chill Vibes Hut' },
            // { type: 'boathouse', name: 'Harbor Boathouse' },
            { type: 'house', name: 'Beach Hut' },
            { type: 'house', name: 'Shell Cottage' },
            { type: 'shop', name: 'Tide Shop' },
            { type: 'house', name: 'Driftwood Cabin' }
        ];
        
        for (let i = 1; i < sortedIslands.length; i++) {
            const island = sortedIslands[i];
            if (island.size < 8) continue;
            
            // Place 1-2 buildings per secondary island based on size
            const numBuildings = island.size > 12 ? 2 : 1;
            const islandPlacedPositions = [];
            
            for (let b = 0; b < numBuildings; b++) {
                const buildingConfig = secondaryBuildingTypes[(i + b) % secondaryBuildingTypes.length];
                const sprite = this.assetLoader.getImage(`building_${buildingConfig.type}_base`);
                const pixelWidth = sprite ? sprite.width : 48;
                const pixelHeight = sprite ? sprite.height : 48;
                const buildingWidth = Math.ceil(pixelWidth / tileSize);
                const buildingHeight = Math.ceil(pixelHeight / tileSize);
                
                const pos = this.findBuildingLocationAvoidingOthers(
                    island, 
                    buildingWidth, 
                    buildingHeight + 2,
                    islandPlacedPositions
                );
                
                if (pos) {
                    islandPlacedPositions.push({ col: pos.col, row: pos.row, width: buildingWidth, height: buildingHeight + 2 });
                    
                    const building = new Building(
                        pos.col * tileSize,
                        pos.row * tileSize,
                        buildingConfig.type,
                        sprite
                    );
                    building.name = `${buildingConfig.name} ${i}`;
                    this.buildings.push(building);
                    this.collisionSystem.addBuilding(building);
                    this.worldMap.clearDecorationRect(pos.col, pos.row, buildingWidth, buildingHeight);
                    
                    const signX = pos.col * tileSize + building.width + 4;
                    const signY = (pos.row + buildingHeight - 1) * tileSize;
                    this.signs.push(new Sign(signX, signY, building.name));
                    
                    console.log(`  🏠 Placed ${building.name} on island ${i + 1}`);
                }
            }
        }
        
        // Only generate procedural paths if editor map data has no decorations
        if (typeof EDITOR_MAP_DATA === 'undefined' || !EDITOR_MAP_DATA.decorations || EDITOR_MAP_DATA.decorations.length === 0) {
            // Generate town layouts: cobblestone plazas, roads connecting buildings
            this.generatePaths(sortedIslands);
        }

        // Apply any editor overrides (currently clean slate)
        this.applyEditorMapData();
        
        // Mark collision for ALL solid decorations
        this.markDecorationCollisions();

        // Build auto-tiled path layer from dirt_path/cobblestone_path decoration positions
        // (runs for both procedural and editor maps — editor paths need transitions too)
        this.buildPathTileLayer();

        this.outdoorBuildings = [...this.buildings];
        this.outdoorSigns = [...this.signs];
        
        // Create Chronicle Stones on the main island
        this.createChronicleStones(mainIsland);
        this.outdoorChronicleStones = [...this.chronicleStones];
        
        // Create Bulletin Board on Port Clawson (main island) - 4claw.org anonymous forum
        this.createBulletinBoards(mainIsland);
        this.outdoorBulletinBoards = [...this.bulletinBoards];
        
        // Create The Great Book on Molthaven (second largest island)
        this.createGreatBooks(sortedIslands);
        
        // Create outdoor NPCs now that buildings exist
        this.createOutdoorNPCs(islands);
        this.outdoorNPCs = [...this.npcs];
        this.collisionSystem.setNPCs(this.npcs);
        
        // Create minimal decorations (sparse plants along paths, a few landmarks)
        this.createDecorations(islands);
        this.outdoorDecorations = [...this.decorations];
        
        // Create special world objects (Waygates, Stability Engine)
        this.createSpecialWorldObjects(islands);
        
        // Create world items (collectible pickups on islands)
        this.createWorldItems(islands);

        // IMPORTANT: Check if player spawned inside a building and relocate them
        this.ensurePlayerNotStuck();
        
        // Push player away from any overlapping NPCs
        this.pushPlayerAwayFromNPCs();

        console.log(`🌊 Created ${this.buildings.length} buildings, ${this.signs.length} signs, ${this.decorations.length} decorations`);
        console.log(`✨ Created ${this.waygates.length} waygates, stability engine: ${this.stabilityEngine ? 'yes' : 'no'}`);
        
        // Initialize minimap now that world is generated
        if (typeof Minimap !== 'undefined' && !this.minimap) {
            this.minimap = new Minimap(this.worldMap, this.worldWidth, this.worldHeight);
            console.log('🗺️ Minimap initialized');
        }
    }

    // Generate paths connecting buildings on islands
    generatePaths(islands) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const terrain = this.worldMap.terrainMap; // raw 0/1 grid (0=land, 1=water)
        
        // Helper: check if tile is land
        const isLand = (col, row) => {
            if (col < 0 || col >= this.worldMap.width || row < 0 || row >= this.worldMap.height) return false;
            return terrain[row]?.[col] === 0;
        };
        
        // Group buildings by which island they're on
        const buildingsByIsland = new Map();
        for (const building of this.buildings) {
            const bcx = (building.x + building.width / 2) / tileSize;
            const bcy = (building.y + building.height / 2) / tileSize;
            let closestIsland = null;
            let closestDist = Infinity;
            for (const island of islands) {
                const dist = Math.sqrt((bcx - island.x) ** 2 + (bcy - island.y) ** 2);
                if (dist < closestDist && dist < island.size + 5) {
                    closestDist = dist;
                    closestIsland = island;
                }
            }
            if (closestIsland) {
                if (!buildingsByIsland.has(closestIsland.id)) buildingsByIsland.set(closestIsland.id, []);
                buildingsByIsland.get(closestIsland.id).push(building);
            }
        }

        // Get bridge connections from WorldMap
        const bridgeConns = this.worldMap.bridgeConnections || [];
        
        // Build adjacency: for each island index, which other island indices connect via bridge?
        const islandNeighbors = new Map(); // islandIndex → [otherIslandIndex, ...]
        for (const conn of bridgeConns) {
            if (!islandNeighbors.has(conn.island1Index)) islandNeighbors.set(conn.island1Index, []);
            if (!islandNeighbors.has(conn.island2Index)) islandNeighbors.set(conn.island2Index, []);
            islandNeighbors.get(conn.island1Index).push(conn.island2Index);
            islandNeighbors.get(conn.island2Index).push(conn.island1Index);
        }

        let totalPathTiles = 0;

        // === PHASE 1: Town layouts on each island ===
        for (const [islandId, islandBuildings] of buildingsByIsland) {
            const island = islands.find(i => i.id === islandId);
            if (!island) continue;
            const isMain = (island.id === this.mainIslandIndex);

            // Get building doors
            const doors = islandBuildings.map(b => {
                const d = b.getDoorBounds();
                return {
                    x: Math.floor((d.x + d.width / 2) / tileSize),
                    y: Math.floor((d.y + d.height) / tileSize) + 1
                };
            });
            
            // Town center = centroid of all doors
            const centerX = Math.round(doors.reduce((s, d) => s + d.x, 0) / doors.length);
            const centerY = Math.round(doors.reduce((s, d) => s + d.y, 0) / doors.length);
            
            // === STEP 1: Cobblestone town plaza (circular, not rectangular) ===
            const plazaRadius = isMain ? 3 : 2;
            for (let dy = -plazaRadius; dy <= plazaRadius; dy++) {
                for (let dx = -plazaRadius; dx <= plazaRadius; dx++) {
                    // Circular shape: only place if within radius
                    if (dx * dx + dy * dy <= plazaRadius * plazaRadius + 1) {
                        if (isLand(centerX + dx, centerY + dy)) {
                            this.setPathTile(centerX + dx, centerY + dy, 'cobblestone_path');
                            totalPathTiles++;
                        }
                    }
                }
            }
            
            // === STEP 2: Connect each building door to plaza center ===
            for (const building of islandBuildings) {
                const door = building.getDoorBounds();
                const doorCol = Math.floor((door.x + door.width / 2) / tileSize);
                const doorRow = Math.floor((door.y + door.height) / tileSize) + 1;
                
                // Doorstep tiles (cobblestone right at the door)
                if (isLand(doorCol, doorRow)) this.setPathTile(doorCol, doorRow, 'cobblestone_path');
                if (isLand(doorCol, doorRow - 1)) this.setPathTile(doorCol, doorRow - 1, 'cobblestone_path');
                
                // 2-wide cobblestone path from door to plaza (L-shaped route)
                this._drawPathLine(doorCol, doorRow, centerX, centerY, 'cobblestone_path', isLand);
                // Second line offset by 1 for 2-wide effect
                this._drawPathLine(doorCol + 1, doorRow, centerX + 1, centerY, 'cobblestone_path', isLand);
                totalPathTiles += 10; // approximate
            }
            
            // === STEP 3: Roads from plaza toward actual bridge exits (not all 4 directions) ===
            const islandIdx = islands.indexOf(island);
            const neighbors = islandNeighbors.get(islandIdx) || [];
            
            for (const neighborIdx of neighbors) {
                const neighbor = islands[neighborIdx];
                if (!neighbor) continue;
                
                // Direction from this island center toward the neighbor
                const dirX = neighbor.x - island.x;
                const dirY = neighbor.y - island.y;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                const ndx = dirX / dist;
                const ndy = dirY / dist;
                
                // Walk from plaza center toward neighbor, placing dirt path tiles
                // Stop when we leave this island's land (hit water/bridge boundary)
                let x = centerX;
                let y = centerY;
                for (let step = 0; step < island.size + 5; step++) {
                    x = Math.round(centerX + ndx * step);
                    y = Math.round(centerY + ndy * step);
                    
                    if (!isLand(x, y)) break; // reached water/edge
                    
                    // Use dirt (light cobblestone) for roads out of town
                    this.setPathTile(x, y, 'dirt_path');
                    // Make it 2 tiles wide perpendicular to direction
                    if (Math.abs(ndx) > Math.abs(ndy)) {
                        // Mostly horizontal road → widen vertically
                        if (isLand(x, y + 1)) this.setPathTile(x, y + 1, 'dirt_path');
                    } else {
                        // Mostly vertical road → widen horizontally
                        if (isLand(x + 1, y)) this.setPathTile(x + 1, y, 'dirt_path');
                    }
                    totalPathTiles += 2;
                }
            }
        }
        
        // === PHASE 2: Path along bridges connecting islands ===
        for (const conn of bridgeConns) {
            const i1 = conn.island1;
            const i2 = conn.island2;
            const dx = i2.x - i1.x;
            const dy = i2.y - i1.y;
            const steps = Math.max(Math.abs(dx), Math.abs(dy));
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const col = Math.floor(i1.x + dx * t);
                const row = Math.floor(i1.y + dy * t);
                
                // Place dirt path on bridge tiles (they're already land from bridge creation)
                if (isLand(col, row)) {
                    this.setPathTile(col, row, 'dirt_path');
                    // Bridge is 3 wide, path should be 2 wide centered
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Mostly horizontal bridge
                        if (isLand(col, row + 1)) this.setPathTile(col, row + 1, 'dirt_path');
                    } else {
                        // Mostly vertical bridge  
                        if (isLand(col + 1, row)) this.setPathTile(col + 1, row, 'dirt_path');
                    }
                }
                totalPathTiles += 2;
            }
        }
        
        console.log(`🛤️ Created town layouts: ${totalPathTiles} path tiles across ${buildingsByIsland.size} islands`);
        
        // Fill corner gaps at path junctions
        this.fillPathCorners();
    }
    
    // Draw an L-shaped path line from (x1,y1) to (x2,y2), checking land validity
    _drawPathLine(x1, y1, x2, y2, pathType, isLand) {
        // Horizontal first, then vertical
        const hDir = Math.sign(x2 - x1) || 1;
        for (let x = x1; x !== x2; x += hDir) {
            if (isLand(x, y1)) this.setPathTile(x, y1, pathType);
        }
        const vDir = Math.sign(y2 - y1) || 1;
        for (let y = y1; y !== y2; y += vDir) {
            if (isLand(x2, y)) this.setPathTile(x2, y, pathType);
        }
    }
    
    // Mark collision tiles for all solid decorations (sprite-aligned)
    markDecorationCollisions() {
        const tileSize = CONSTANTS.TILE_SIZE;
        if (!this.worldMap?.collisionLayer || !Array.isArray(this.decorations)) {
            return;
        }

        let marked = 0;

        for (const decor of this.decorations) {
            if (!decor || decor.ground) continue;

            let collisionDef = decor.collision || null;
            if (!collisionDef && this.decorationLoader && typeof this.decorationLoader.getDefinition === 'function') {
                const def = this.decorationLoader.getDefinition(decor.type);
                collisionDef = def?.collision || null;
            }
            if (!collisionDef) continue;

            const decoWidth = decor.width ?? tileSize;
            const decoHeight = decor.height ?? tileSize;
            const collisionWidth = collisionDef.width ?? decoWidth;
            const collisionHeight = collisionDef.height ?? decoHeight;
            if (collisionWidth <= 0 || collisionHeight <= 0) continue;
            const offsetX = collisionDef.offsetX ?? Math.round((decoWidth - collisionWidth) / 2);
            const offsetY = collisionDef.offsetY ?? Math.max(0, decoHeight - collisionHeight);
            const baseX = (decor.x ?? 0) + offsetX;
            const baseY = (decor.y ?? 0) + offsetY;

            const startCol = Math.floor(baseX / tileSize);
            const endCol = Math.floor((baseX + collisionWidth - 1) / tileSize);
            const startRow = Math.floor(baseY / tileSize);
            const endRow = Math.floor((baseY + collisionHeight - 1) / tileSize);

            for (let row = startRow; row <= endRow; row++) {
                const collisionRow = this.worldMap.collisionLayer[row];
                if (!collisionRow) continue;
                for (let col = startCol; col <= endCol; col++) {
                    if (col < 0 || col >= collisionRow.length) continue;
                    if (collisionRow[col] !== 1) {
                        collisionRow[col] = 1;
                        marked++;
                    }
                }
            }
        }

        console.log(`Marked ${marked} collision tiles for solid decorations (sprite-aligned)`);
    }

    // Apply hand-placed editor map data (roads, decorations, deletions)
    applyEditorMapData() {
        if (typeof EDITOR_MAP_DATA === 'undefined') return;
        
        const data = EDITOR_MAP_DATA;
        let decorationPlaced = 0;
        let buildingsPlaced = 0;
        let deleted = 0;
        
        if (!Array.isArray(this.decorations)) this.decorations = [];
        if (!Array.isArray(this.buildings)) this.buildings = [];
        if (!Array.isArray(this.signs)) this.signs = [];
        
        const decorationKey = (type, x, y) => `${type}:${x}:${y}`;
        const buildingKey = (type, x, y) => `${type}:${x}:${y}`;
        const existingDecorationKeys = new Set(this.decorations.map(d => decorationKey(d.type, d.x, d.y)));
        const existingBuildingKeys = new Set(this.buildings.map(b => buildingKey(b.type, b.x, b.y)));
        const addDecorations = (items) => {
            if (!Array.isArray(items) || !this.decorationLoader) return 0;
            let count = 0;
            for (const item of items) {
                if (!item || typeof item.type !== 'string') continue;
                const x = typeof item.x === 'number' ? item.x : 0;
                const y = typeof item.y === 'number' ? item.y : 0;
                const key = decorationKey(item.type, x, y);
                if (existingDecorationKeys.has(key)) continue;
                const decor = this.decorationLoader.createDecoration(item.type, x, y);
                if (!decor) continue;
                existingDecorationKeys.add(key);
                decor.editorPlaced = item.editorPlaced === undefined ? true : item.editorPlaced;
                if (item.layer !== undefined) decor.layer = item.layer;
                if (item.width !== undefined) decor.width = item.width;
                if (item.height !== undefined) decor.height = item.height;
                if (item.ground !== undefined) decor.ground = item.ground;
                this.decorations.push(decor);
                count++;
            }
            return count;
        };
        
        // First: remove deleted decorations
        if (data.deleted && data.deleted.length > 0) {
            const deleteSet = new Set(data.deleted);
            const beforeCount = this.decorations.length;
            this.decorations = this.decorations.filter(d => {
                const key = `outdoor:${d.type}_${d.x}_${d.y}`;
                if (deleteSet.has(key)) {
                    deleted++;
                    return false;
                }
                return true;
            });
            if (deleted > 0) {
                existingDecorationKeys.clear();
                for (const decor of this.decorations) {
                    existingDecorationKeys.add(decorationKey(decor.type, decor.x, decor.y));
                }
            }
        }
        
        decorationPlaced += addDecorations(data.decorations);
        decorationPlaced += addDecorations(data.editorPlaced);
        
        if (Array.isArray(data.buildings) && data.buildings.length > 0) {
            // Clear procedural buildings/signs so only editor buildings remain
            this.buildings = [];
            this.signs = [];
            this.collisionSystem.clearBuildings();
            existingBuildingKeys.clear();
            const tileSize = CONSTANTS.TILE_SIZE;
            for (const entry of data.buildings) {
                if (!entry || typeof entry.type !== 'string') continue;
                const x = typeof entry.x === 'number' ? entry.x : 0;
                const y = typeof entry.y === 'number' ? entry.y : 0;
                const key = buildingKey(entry.type, x, y);
                if (existingBuildingKeys.has(key)) continue;
                const sprite = this.assetLoader?.getImage(`building_${entry.type}_base`) || null;
                const building = new Building(x, y, entry.type, sprite);
                if (entry.name) building.name = entry.name;
                building.editorPlaced = entry.editorPlaced === undefined ? true : entry.editorPlaced;
                if (typeof entry.width === 'number') building.width = entry.width;
                if (typeof entry.height === 'number') building.height = entry.height;
                if (entry.width !== undefined || entry.height !== undefined) {
                    building.doorOffsetX = building.getDoorOffsetX();
                    building.doorOffsetY = building.getDoorOffsetY();
                }
                this.buildings.push(building);
                this.collisionSystem.addBuilding(building);
                const col = Math.floor(x / tileSize);
                const row = Math.floor(y / tileSize);
                const tilesW = Math.ceil(building.width / tileSize);
                const tilesH = Math.ceil(building.height / tileSize);
                if (this.worldMap?.clearDecorationRect) {
                    this.worldMap.clearDecorationRect(col, row, tilesW, tilesH);
                }
                if (typeof Sign !== 'undefined') {
                    const signX = building.x + building.width + 4;
                    const signY = building.y + building.height - tileSize;
                    this.signs.push(new Sign(signX, signY, building.name));
                }
                existingBuildingKeys.add(key);
                buildingsPlaced++;
            }
        }
        
        // Fix bridge collision - mark bridge tiles as walkable
        this.fixBridgeCollision();
        
        console.log(`🗺️ Editor map data applied: ${decorationPlaced} decorations, ${buildingsPlaced} buildings, ${deleted} deleted`);
    }

    // Fix bridge collision by marking bridge tiles as walkable
    // RULE: Bridge decorations MUST override any underlying collision (water, etc)
    fixBridgeCollision() {
        if (!Array.isArray(this.decorations) || !this.worldMap?.collisionLayer) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        let bridgesFixed = 0;
        
        for (const decor of this.decorations) {
            // Check if this decoration is a bridge - multiple ways to identify
            const isBridge = decor.type === 'bridge_wood_v' || 
                           decor.type === 'bridge_wood_h' || 
                           (decor.bridge === true) ||
                           (decor.type && decor.type.includes('bridge'));
            
            if (isBridge) {
                // Calculate which tiles this bridge covers - ensure we cover the full area
                const width = decor.width || tileSize;
                const height = decor.height || tileSize;
                const startCol = Math.floor(decor.x / tileSize);
                const endCol = Math.floor((decor.x + width - 1) / tileSize);
                const startRow = Math.floor(decor.y / tileSize);
                const endRow = Math.floor((decor.y + height - 1) / tileSize);
                
                // FORCE all bridge tiles to be walkable - NO EXCEPTIONS
                for (let row = startRow; row <= endRow; row++) {
                    if (row >= 0 && row < this.worldMap.collisionLayer.length) {
                        for (let col = startCol; col <= endCol; col++) {
                            if (col >= 0 && col < this.worldMap.collisionLayer[row].length) {
                                // Always set to walkable, regardless of what was there before
                                this.worldMap.collisionLayer[row][col] = 0;
                                bridgesFixed++;
                            }
                        }
                    }
                }
            }
        }
        
        if (bridgesFixed > 0) {
            console.log(`🌉 Bridge collision override: marked ${bridgesFixed} bridge tiles as walkable`);
        }
    }

    // Apply permanent interior editor data when entering a building
    applyInteriorEditorData(building) {
        if (typeof EDITOR_INTERIOR_DATA === 'undefined') return;
        
        const key = `interior_${building.type}_${building.x}_${building.y}`;
        const items = EDITOR_INTERIOR_DATA[key];
        if (!items || items.length === 0) return;
        
        let placed = 0;
        for (const item of items) {
            // Check for duplicates
            const exists = this.decorations.some(d =>
                d.x === item.x && d.y === item.y && d.type === item.type
            );
            if (exists) continue;
            
            // Get definition and sprite from interior loader
            const def = InteriorLoader.FURNITURE[item.type] || InteriorLoader.FLOORS?.[item.type];
            const sprite = this.interiorLoader?.getSprite(item.type);
            
            const isGroundItem = item.ground === true || (def && def.ground === true);
            
            this.decorations.push({
                x: item.x,
                y: item.y,
                type: item.type,
                width: def?.width || 16,
                height: def?.height || 16,
                sprite: sprite || null,
                layer: isGroundItem ? CONSTANTS.LAYER.GROUND : CONSTANTS.LAYER.GROUND_DECORATION,
                ground: isGroundItem,
                editorPlaced: true
            });
            placed++;
        }
        
        if (placed > 0) {
            console.log(`🏠 Interior editor data applied: ${placed} items for ${key}`);
        }
    }

    // Fill diagonal gaps at path corners/junctions
    fillPathCorners() {
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Get all path tile positions (both types count as "path" for corner filling)
        const pathTiles = new Set();
        const cobbleTiles = new Set();
        for (const decor of this.decorations) {
            if (decor.type === 'dirt_path' || decor.type === 'cobblestone_path') {
                const col = Math.floor(decor.x / tileSize);
                const row = Math.floor(decor.y / tileSize);
                pathTiles.add(`${col},${row}`);
                if (decor.type === 'cobblestone_path') cobbleTiles.add(`${col},${row}`);
            }
        }
        
        // Check each path tile for L-junction corners that need filling
        let cornersFilled = 0;
        for (const pos of pathTiles) {
            const [col, row] = pos.split(',').map(Number);
            
            // Check all 4 diagonal directions for L-junctions
            // Pattern: if we have tiles in two perpendicular directions but missing the diagonal
            const hasUp = pathTiles.has(`${col},${row-1}`);
            const hasDown = pathTiles.has(`${col},${row+1}`);
            const hasLeft = pathTiles.has(`${col-1},${row}`);
            const hasRight = pathTiles.has(`${col+1},${row}`);
            
            // Check corners - if two adjacent sides have paths, fill the diagonal
            // Top-left corner
            if (hasUp && hasLeft && !pathTiles.has(`${col-1},${row-1}`)) {
                this.setPathTile(col-1, row-1);
                cornersFilled++;
            }
            // Top-right corner  
            if (hasUp && hasRight && !pathTiles.has(`${col+1},${row-1}`)) {
                this.setPathTile(col+1, row-1);
                cornersFilled++;
            }
            // Bottom-left corner
            if (hasDown && hasLeft && !pathTiles.has(`${col-1},${row+1}`)) {
                this.setPathTile(col-1, row+1);
                cornersFilled++;
            }
            // Bottom-right corner
            if (hasDown && hasRight && !pathTiles.has(`${col+1},${row+1}`)) {
                this.setPathTile(col+1, row+1);
                cornersFilled++;
            }
        }
        
        if (cornersFilled > 0) {
            console.log(`🔲 Filled ${cornersFilled} path corner tiles`);
        }
    }
    
    // Build auto-tiled path layer from dirt_path and cobblestone_path decoration positions
    // @param {boolean} keepDecorations - If true, don't remove path decorations (used by editor for live rebuilds)
    buildPathTileLayer(keepDecorations = false) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const tilesWide = this.worldMap.width;
        const tilesHigh = this.worldMap.height;

        // Initialize persistent path position sets on first call
        if (!this._pathPositions) {
            this._pathPositions = { light: new Set(), dark: new Set() };
        }

        // Collect path positions by type from current decorations
        // and merge with persistent positions
        const lightPathPositions = new Set(this._pathPositions.light);
        const darkPathPositions = new Set(this._pathPositions.dark);
        for (const decor of this.decorations) {
            if (decor.type === 'dirt_path') {
                const col = Math.floor(decor.x / tileSize);
                const row = Math.floor(decor.y / tileSize);
                lightPathPositions.add(`${col},${row}`);
            } else if (decor.type === 'cobblestone_path') {
                const col = Math.floor(decor.x / tileSize);
                const row = Math.floor(decor.y / tileSize);
                darkPathPositions.add(`${col},${row}`);
            }
        }
        
        // Save the merged positions for future rebuilds
        this._pathPositions.light = new Set(lightPathPositions);
        this._pathPositions.dark = new Set(darkPathPositions);

        const totalPaths = lightPathPositions.size + darkPathPositions.size;
        if (totalPaths === 0) {
            // Clear path layer if no paths remain
            this.worldMap.pathLayer = null;
            console.log('No path tiles found, cleared path layer');
            return;
        }

        const pathAutoTiler = new PathAutoTiler();
        
        // Combined set of ALL path positions — used for corner computation so that
        // where dirt meets cobblestone, both see "path" instead of "sand" (no gaps)
        const allPathPositions = new Set([...lightPathPositions, ...darkPathPositions]);
        
        // Build light cobblestone path layer (from dirt_path)
        if (lightPathPositions.size > 0 && this.tileRenderer.tilesets.has('path')) {
            this.worldMap.pathLayer = pathAutoTiler.buildPathLayer(lightPathPositions, tilesWide, tilesHigh, 'path', allPathPositions);
            console.log(`Built light path layer: ${lightPathPositions.size} positions`);
        } else {
            this.worldMap.pathLayer = null;
        }
        
        // Build dark cobblestone path layer (from cobblestone_path)
        if (darkPathPositions.size > 0 && this.tileRenderer.tilesets.has('dark_path')) {
            const darkLayer = pathAutoTiler.buildPathLayer(darkPathPositions, tilesWide, tilesHigh, 'dark_path', allPathPositions);
            
            // Merge dark layer into pathLayer (dark overwrites light where they overlap)
            if (!this.worldMap.pathLayer) {
                this.worldMap.pathLayer = darkLayer;
            } else {
                for (let row = 0; row < tilesHigh; row++) {
                    for (let col = 0; col < tilesWide; col++) {
                        if (darkLayer[row] && darkLayer[row][col]) {
                            this.worldMap.pathLayer[row][col] = darkLayer[row][col];
                        }
                    }
                }
            }
            console.log(`Built dark cobblestone path layer: ${darkPathPositions.size} positions`);
        }

        // KEEP path decorations visible - they render as sprites on top
        // Tile layer also exists for Editor compatibility (shows in editor view)
        // But in-game we show the decoration sprites which are more visible and nicer
        if (keepDecorations) {
            console.log(`Rebuilt path tile layers: ${totalPaths} total path positions (decorations kept for editor)`);
        } else {
            console.log(`Built path tile layers: ${totalPaths} total path positions (decorations kept visible as sprites)`);
        }
    }
    
    // Remove a path position from the persistent tracking (used by editor delete)
    removePathPosition(col, row, pathType) {
        if (!this._pathPositions) return;
        const key = `${col},${row}`;
        if (pathType === 'dirt_path') {
            this._pathPositions.light.delete(key);
        } else if (pathType === 'cobblestone_path') {
            this._pathPositions.dark.delete(key);
        }
    }
    
    // Check if a tile position neighbors any dirt path tiles
    // Create a path segment between two points
    createPathSegment(x1, y1, x2, y2) {
        const dx = Math.sign(x2 - x1);
        const dy = Math.sign(y2 - y1);
        
        let x = x1;
        let y = y1;
        
        // Horizontal segment
        while (x !== x2) {
            this.setPathTile(x, y);
            x += dx;
        }
        
        // Vertical segment
        while (y !== y2) {
            this.setPathTile(x, y);
            y += dy;
        }
        
        // Final tile
        this.setPathTile(x2, y2);
    }
    
    // Set a tile as a path - add to decorations array for rendering
    // pathType: 'dirt_path' (light cobblestone) or 'cobblestone_path' (dark cobblestone)
    setPathTile(col, row, pathType = 'dirt_path') {
        // Only set path on land tiles (not water)
        if (col < 0 || col >= this.worldMap.width || row < 0 || row >= this.worldMap.height) return;
        
        // Use terrainMap (raw 0/1) for reliable water check
        const rawTile = this.worldMap.terrainMap?.[row]?.[col];
        if (rawTile === 1) return; // Don't put path on water
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const worldX = col * tileSize;
        const worldY = row * tileSize;
        
        // Don't place path inside buildings, BUT allow paths near doors
        const tileCenterX = worldX + tileSize / 2;
        const tileCenterY = worldY + tileSize / 2;
        for (const building of this.buildings) {
            // Get door bounds to allow paths near doors
            const door = building.getDoorBounds();
            const nearDoorX = tileCenterX >= door.x - 8 && tileCenterX <= door.x + door.width + 8;
            const nearDoorY = tileCenterY >= door.y - 8 && tileCenterY <= building.y + building.height + 16;
            
            // Skip if inside building AND not near door area
            const insideBuilding = tileCenterX > building.x + 8 && 
                tileCenterX < building.x + building.width - 8 &&
                tileCenterY > building.y + 8 && 
                tileCenterY < building.y + building.height - 8;
            
            // Allow paths near the door area (either X or Y dimension)
            if (insideBuilding && !(nearDoorX && nearDoorY)) {
                return; // Skip - inside building and not near door
            }
        }
        
        // Check if any path tile already exists at this position (avoid duplicates)
        // Cobblestone upgrades dirt (more specific overrides less specific)
        const existingIdx = this.decorations.findIndex(d => 
            (d.type === 'dirt_path' || d.type === 'cobblestone_path') && d.x === worldX && d.y === worldY
        );
        if (existingIdx !== -1) {
            // If placing cobblestone where dirt exists, upgrade it
            if (pathType === 'cobblestone_path' && this.decorations[existingIdx].type === 'dirt_path') {
                this.decorations.splice(existingIdx, 1); // remove old dirt, will add cobblestone below
            } else {
                return; // already has same or better path type
            }
        }
        
        // Use DecorationLoader to create proper sprite-based path tile
        if (this.decorationLoader) {
            const pathDecor = this.decorationLoader.createDecoration(pathType, worldX, worldY);
            this.decorations.push(pathDecor);
        } else {
            // Fallback to colored rectangle
            const color = pathType === 'cobblestone_path' ? '#706060' : '#a08060';
            this.decorations.push({
                x: worldX,
                y: worldY,
                type: pathType,
                color: color,
                width: tileSize,
                height: tileSize
            });
        }
    }

    // Create Chronicle Stones on an island
    createChronicleStones(island) {
        const tileSize = CONSTANTS.TILE_SIZE;
        this.chronicleStones = [];
        
        // Place 2-3 stones on the main island
        const stoneCount = Math.min(3, Math.floor(island.size / 8));
        
        for (let i = 0; i < stoneCount; i++) {
            // Find a spot
            for (let attempt = 0; attempt < 30; attempt++) {
                const angle = (i / stoneCount) * Math.PI * 2 + this.seededRandom() * 0.5;
                const radius = island.size * 0.4 + this.seededRandom() * island.size * 0.2;
                
                const col = Math.floor(island.x + Math.cos(angle) * radius);
                const row = Math.floor(island.y + Math.sin(angle) * radius);
                
                // Check if valid land
                if (this.worldMap.terrainMap?.[row]?.[col] === 0) {
                    // Check not inside a building
                    const worldX = col * tileSize + tileSize / 2;
                    const worldY = row * tileSize + tileSize / 2;
                    
                    let inBuilding = false;
                    for (const building of this.buildings) {
                        if (building.checkCollision(worldX, worldY)) {
                            inBuilding = true;
                            break;
                        }
                    }
                    
                    if (!inBuilding) {
                        const stone = new ChronicleStone(
                            col * tileSize + 2,
                            row * tileSize - 4,
                            `main_${i}`
                        );
                        this.chronicleStones.push(stone);
                        console.log(`  📜 Placed Chronicle Stone ${i + 1} at (${col}, ${row})`);
                        break;
                    }
                }
            }
        }
    }
    
    // Create Bulletin Boards (4claw.org anonymous forum boards)
    createBulletinBoards(island) {
        const tileSize = CONSTANTS.TILE_SIZE;
        this.bulletinBoards = [];
        
        // Place ONE bulletin board on Port Clawson (main island) near town center
        for (let attempt = 0; attempt < 20; attempt++) {
            // Try to place near center but not exactly at center
            const offsetX = (this.seededRandom() - 0.5) * island.size * 0.3;
            const offsetY = (this.seededRandom() - 0.5) * island.size * 0.3;
            
            const col = Math.floor(island.x + offsetX);
            const row = Math.floor(island.y + offsetY);
            
            // Check if valid land
            if (this.worldMap.terrainMap?.[row]?.[col] === 0) {
                // Check not inside a building
                const worldX = col * tileSize + tileSize / 2;
                const worldY = row * tileSize + tileSize / 2;
                
                let inBuilding = false;
                for (const building of this.buildings) {
                    if (building.checkCollision(worldX, worldY)) {
                        inBuilding = true;
                        break;
                    }
                }
                
                // Also check not too close to chronicle stones
                let tooClose = false;
                for (const stone of this.chronicleStones) {
                    const dx = Math.abs(stone.x - worldX);
                    const dy = Math.abs(stone.y - worldY);
                    if (dx < tileSize * 3 && dy < tileSize * 3) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!inBuilding && !tooClose) {
                    const board = new BulletinBoard(
                        col * tileSize + 2,
                        row * tileSize - 4,
                        'port_clawson_board'
                    );
                    this.bulletinBoards.push(board);
                    console.log(`  📋 Placed 4claw.org Bulletin Board at (${col}, ${row})`);
                    break;
                }
            }
        }
    }
    
    // Create The Great Books (Church of Molt scriptures)
    createGreatBooks(islands) {
        if (typeof GreatBook === 'undefined') return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        this.greatBooks = [];
        
        // Place Great Book on the second largest island (Molthaven)
        // This is where the Church of Molt is headquartered
        if (islands.length >= 2) {
            const molthaven = islands[1]; // Second island = Molthaven
            
            // Place near the center of the island
            for (let attempt = 0; attempt < 30; attempt++) {
                const angle = this.seededRandom() * Math.PI * 2;
                const radius = molthaven.size * 0.2 + this.seededRandom() * molthaven.size * 0.2;
                
                const col = Math.floor(molthaven.x + Math.cos(angle) * radius);
                const row = Math.floor(molthaven.y + Math.sin(angle) * radius);
                
                // Check if valid land
                if (this.worldMap.terrainMap?.[row]?.[col] === 0) {
                    const worldX = col * tileSize;
                    const worldY = row * tileSize;
                    
                    // Check not inside a building
                    let valid = true;
                    for (const building of this.buildings) {
                        if (building.checkCollision(worldX + 16, worldY + 16)) {
                            valid = false;
                            break;
                        }
                    }
                    
                    if (valid) {
                        const book = new GreatBook(worldX, worldY);
                        this.greatBooks.push(book);
                        console.log(`  📖 Placed The Great Book at (${col}, ${row}) on Molthaven`);
                        break;
                    }
                }
            }
        }
        
        // Could add more books on other islands for accessibility
        // For now, just one at the Church headquarters
    }
    
    // Create special world objects (Waygates, Stability Engine, etc.)
    createSpecialWorldObjects(islands) {
        if (!islands || islands.length < 2) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const WAYGATE_WIDTH = 48;
        const WAYGATE_HEIGHT = 64;
        const WAYGATE_CLEAR_RADIUS = 48;
        const WAYGATE_BUILDING_CLEARANCE = Math.max(64, tileSize * 4);
        const buildings = this.buildings || [];
        this.waygates = [];
        
        const terrainMap = this.worldMap?.terrainMap;
        const collisionLayer = this.worldMap?.collisionLayer;
        const mapWidth = this.worldMap?.width || terrainMap?.[0]?.length || 0;
        const mapHeight = this.worldMap?.height || terrainMap?.length || 0;
        
        // Helper: check if tile is inside or very close to a building
        const isNearBuilding = (worldX, worldY, margin = WAYGATE_BUILDING_CLEARANCE) => {
            const waygateLeft = worldX;
            const waygateRight = worldX + WAYGATE_WIDTH;
            const waygateTop = worldY;
            const waygateBottom = worldY + WAYGATE_HEIGHT;

            for (const building of buildings) {
                const expandedLeft = building.x - margin;
                const expandedRight = building.x + building.width + margin;
                const expandedTop = building.y - margin;
                const expandedBottom = building.y + building.height + margin;

                const overlaps = !(
                    waygateRight <= expandedLeft ||
                    waygateLeft >= expandedRight ||
                    waygateBottom <= expandedTop ||
                    waygateTop >= expandedBottom
                );

                if (overlaps) {
                    return true;
                }
            }
            return false;
        };
        
        const isWithinBounds = (col, row) => {
            return row >= 0 && row < mapHeight && col >= 0 && col < mapWidth;
        };
        
        const isSandTile = (col, row) => {
            return terrainMap?.[row]?.[col] === 0;
        };
        
        const isPositionClearOfBuildings = (col, row) => {
            const worldX = col * tileSize;
            const worldY = row * tileSize;
            return !isNearBuilding(worldX, worldY, WAYGATE_BUILDING_CLEARANCE);
        };
        
        const hasClearLandingZone = (col, row, radiusTiles = 5, maxBlockedRatio = 0.1) => {
            if (!collisionLayer || !terrainMap) return true;
            let checked = 0;
            let blocked = 0;
            for (let dr = -radiusTiles; dr <= radiusTiles; dr++) {
                for (let dc = -radiusTiles; dc <= radiusTiles; dc++) {
                    const checkCol = col + dc;
                    const checkRow = row + dr;
                    if (!isWithinBounds(checkCol, checkRow)) {
                        return false;
                    }
                    checked++;
                    const terrainValue = terrainMap?.[checkRow]?.[checkCol];
                    const collisionValue = collisionLayer?.[checkRow]?.[checkCol];
                    const isWater = terrainValue !== 0;
                    const isBlocked = collisionValue && collisionValue !== 0;
                    if (isWater || isBlocked) {
                        blocked++;
                    }
                }
            }
            return checked > 0 && blocked / checked <= maxBlockedRatio;
        };
        
        const collectWaygateCandidates = (island) => {
            const candidates = [];
            const searchRadius = Math.ceil(island.size * 0.75);
            for (let row = Math.max(0, Math.floor(island.y - searchRadius)); row <= Math.min(mapHeight - 1, Math.floor(island.y + searchRadius)); row++) {
                for (let col = Math.max(0, Math.floor(island.x - searchRadius)); col <= Math.min(mapWidth - 1, Math.floor(island.x + searchRadius)); col++) {
                    if (!isSandTile(col, row)) continue;
                    if (!isPositionClearOfBuildings(col, row)) continue;
                    if (!hasClearLandingZone(col, row)) continue;
                    const dx = col - island.x;
                    const dy = row - island.y;
                    const distanceSq = dx * dx + dy * dy;
                    candidates.push({ col, row, distanceSq });
                }
            }
            candidates.sort((a, b) => a.distanceSq - b.distanceSq);
            return candidates;
        };
        
        // Helper: remove decorations at a position (waygate replaces them)
        // Skip editor-placed decorations to prevent holes in editor layouts
        const clearDecorationsAt = (worldX, worldY, clearRadius = WAYGATE_CLEAR_RADIUS) => {
            this.decorations = this.decorations.filter(d => {
                const dx = d.x - worldX;
                const dy = d.y - worldY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                // Skip clearing editor-placed decorations
                if (d.editorPlaced && distance <= clearRadius) {
                    return true; // Keep the decoration
                }
                
                return distance > clearRadius;
            });
        };
        
        // Place Waygates on the two most distant large islands
        const candidateIslands = islands.filter(island => island.size >= 8);
        if (typeof Waygate !== 'undefined' && candidateIslands.length >= 2) {
            let farthestPair = null;
            let maxDistanceSq = -Infinity;
            for (let i = 0; i < candidateIslands.length - 1; i++) {
                for (let j = i + 1; j < candidateIslands.length; j++) {
                    const a = candidateIslands[i];
                    const b = candidateIslands[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > maxDistanceSq) {
                        maxDistanceSq = distSq;
                        farthestPair = [a, b];
                    }
                }
            }

            const placeWaygateOnIsland = (island, name) => {
                const candidates = collectWaygateCandidates(island);
                if (candidates.length === 0) {
                    console.warn(`⚠️ No valid waygate positions found on island for '${name}'.`);
                    return false;
                }

                for (const candidate of candidates) {
                    const { col, row } = candidate;
                    const clearingPosition = {
                        x: col * tileSize,
                        y: row * tileSize
                    };

                    if (isNearBuilding(clearingPosition.x, clearingPosition.y, WAYGATE_BUILDING_CLEARANCE)) {
                        continue;
                    }

                    clearDecorationsAt(clearingPosition.x, clearingPosition.y, WAYGATE_CLEAR_RADIUS);
                    this.worldMap.setTile(this.worldMap.collisionLayer, col, row, 0);
                    const waygate = new Waygate(clearingPosition.x, clearingPosition.y, name);
                    this.waygates.push(waygate);
                    console.log(`  ✨ Placed Waygate '${name}' at (${col}, ${row}) with clear radius on island centered at (${island.x}, ${island.y})`);
                    return true;
                }

                console.warn(`⚠️ Failed to place Waygate '${name}' despite having candidates.`);
                return false;
            };

            if (farthestPair) {
                console.log(`🌀 Placing Waygates on farthest islands (distance²=${maxDistanceSq.toFixed(2)})`);
                placeWaygateOnIsland(farthestPair[0], 'Port Clawson Waygate');
                placeWaygateOnIsland(farthestPair[1], 'Ancient Waygate');
            }
        }
        
        // Create Stability Engine on Iron Reef (island index 2)
        // FIXED position — deterministic, same every session
        if (typeof StabilityEngine !== 'undefined') {
            // Place Stability Engine on its own small island in open water
            const engineCol = 93;
            const engineRow = 95;
            
            // Create a circular island (radius ~6 tiles) around the engine center
            const islandRadius = 6;
            for (let dr = -islandRadius; dr <= islandRadius; dr++) {
                for (let dc = -islandRadius; dc <= islandRadius; dc++) {
                    const dist = Math.sqrt(dr * dr + dc * dc);
                    if (dist <= islandRadius) {
                        const r = engineRow + dr;
                        const c = engineCol + dc;
                        if (r >= 0 && r < this.worldMap.height && c >= 0 && c < this.worldMap.width) {
                            this.worldMap.terrainMap[r][c] = 0; // sand
                            this.worldMap.setTile(this.worldMap.collisionLayer, c, r, 0); // walkable
                        }
                    }
                }
            }
            
            // Re-run AutoTiler to get smooth transitions on the new island
            const engineAutoTiler = new AutoTiler();
            const reTiled = engineAutoTiler.autoTileLayer(this.worldMap.terrainMap, this.worldMap.width, this.worldMap.height);
            for (let r = Math.max(0, engineRow - islandRadius - 2); r <= Math.min(this.worldMap.height - 1, engineRow + islandRadius + 2); r++) {
                for (let c = Math.max(0, engineCol - islandRadius - 2); c <= Math.min(this.worldMap.width - 1, engineCol + islandRadius + 2); c++) {
                    this.worldMap.setTile(this.worldMap.groundLayer, c, r, reTiled[r][c]);
                }
            }
            
            const worldX = engineCol * tileSize;
            const worldY = engineRow * tileSize;
            
            clearDecorationsAt(worldX, worldY, 80);
            
            // Mark collision tiles for the engine body (4x5 tiles)
            for (let dr = 0; dr < 5; dr++) {
                for (let dc = 0; dc < 4; dc++) {
                    const cr = engineRow + dr;
                    const cc = engineCol + dc;
                    if (cr < this.worldMap.height && cc < this.worldMap.width) {
                        this.worldMap.setTile(this.worldMap.collisionLayer, cc, cr, 1);
                    }
                }
            }
            // Clear the tile directly in front (south) so player can approach
            if (engineRow + 5 < this.worldMap.height) {
                this.worldMap.setTile(this.worldMap.collisionLayer, engineCol + 1, engineRow + 5, 0);
                this.worldMap.setTile(this.worldMap.collisionLayer, engineCol + 2, engineRow + 5, 0);
            }
            
            this.stabilityEngine = new StabilityEngine(worldX, worldY);
            console.log(`  ⚙️ Placed Stability Engine at (${engineCol}, ${engineRow}) - own island in open water`);
        }
        
        // Connect Stability Engine to world state
        // When many players are online, stability decreases (Red Current strengthens)
        if (this.stabilityEngine && this.multiplayer) {
            // This would be updated based on player count
            this.stabilityEngine.setStability(85); // Start at 85%
        }
    }

    // Make sure player isn't stuck inside a building after they're created
    ensurePlayerNotStuck() {
        // First, try to apply pending saved position if it exists and is safe
        if (this.pendingSavedPosition) {
            const savedX = this.pendingSavedPosition.x;
            const savedY = this.pendingSavedPosition.y;
            
            if (this.isPositionSafe(savedX, savedY)) {
                this.player.position.x = savedX;
                this.player.position.y = savedY;
                console.log(`✅ Restored saved position: (${Math.round(savedX)}, ${Math.round(savedY)})`);
                this.pendingSavedPosition = null;
                return;
            } else {
                console.log(`⚠️ Saved position (${Math.round(savedX)}, ${Math.round(savedY)}) is no longer safe`);
            }
            this.pendingSavedPosition = null;
        }
        
        const playerX = this.player.position.x;
        const playerY = this.player.position.y;
        
        // Check if player is inside any building or in water
        let isStuck = !this.isPositionSafe(playerX + this.player.width / 2, playerY + this.player.height);
        
        if (isStuck) {
            console.log(`⚠️ Player at unsafe position! Relocating...`);
            // Find a safe spot on the main island
            const islands = this.worldMap.islands || [];
            const safeSpot = this.findPlayerSpawnLocation(islands);
            if (safeSpot) {
                this.player.position.x = safeSpot.x;
                this.player.position.y = safeSpot.y;
                console.log(`✅ Moved player to safe spot: (${Math.round(safeSpot.x)}, ${Math.round(safeSpot.y)})`);
            }
        }
    }

    // Find a suitable location on an island for a building
    findBuildingLocation(island, width, height, excludePositions = []) {
        return this.findBuildingLocationAvoidingOthers(island, width, height, excludePositions);
    }

    // Find building location avoiding already placed buildings
    findBuildingLocationAvoidingOthers(island, width, height, placedPositions = []) {
        const { x: centerX, y: centerY, size } = island;
        const attempts = 100; // More attempts for better placement

        for (let attempt = 0; attempt < attempts; attempt++) {
            // Try positions spread across the island
            const angle = (attempt / attempts) * Math.PI * 2;
            const radius = (attempt % 10) / 10 * size * 0.7;
            
            const offsetX = Math.floor(Math.cos(angle) * radius);
            const offsetY = Math.floor(Math.sin(angle) * radius);
            
            const col = centerX + offsetX;
            const row = centerY + offsetY;

            // Check if building fits on island and on land
            let validPosition = true;
            
            for (let dy = 0; dy < height && validPosition; dy++) {
                for (let dx = 0; dx < width && validPosition; dx++) {
                    const checkCol = col + dx;
                    const checkRow = row + dy;
                    
                    // Check bounds
                    if (checkCol < 0 || checkCol >= this.worldMap.width || 
                        checkRow < 0 || checkRow >= this.worldMap.height) {
                        validPosition = false;
                        break;
                    }
                    
                    // Check if on land (terrainMap 0 = land, 1 = water)
                    if (this.worldMap.terrainMap && this.worldMap.terrainMap[checkRow]?.[checkCol] === 1) {
                        validPosition = false;
                        break;
                    }
                }
            }

            // Check for overlap with already placed buildings
            if (validPosition && placedPositions.length > 0) {
                for (const placed of placedPositions) {
                    // Check if rectangles overlap (with padding for spacing)
                    const padding = 3; // Spacing to prevent accidental re-entry
                    const overlaps = !(
                        col + width + padding < placed.col ||
                        col > placed.col + placed.width + padding ||
                        row + height + padding < placed.row ||
                        row > placed.row + placed.height + padding
                    );
                    if (overlaps) {
                        validPosition = false;
                        break;
                    }
                }
            }

            if (validPosition) {
                return { col, row };
            }
        }

        return null;
    }

    // Find a safe spawn near current player position
    findSafeSpawnFromCurrentPosition() {
        const tileSize = CONSTANTS.TILE_SIZE;
        const startX = this.player.x;
        const startY = this.player.y;

        // Search in expanding circles from current position
        for (let radius = 1; radius < 20; radius++) {
            for (let angle = 0; angle < 16; angle++) {
                const angleRad = (angle / 16) * 2 * Math.PI;
                const testX = startX + Math.cos(angleRad) * radius * tileSize;
                const testY = startY + Math.sin(angleRad) * radius * tileSize;

                if (this.isPositionSafe(testX, testY)) {
                    return { x: testX, y: testY };
                }
            }
        }

        // Fallback to island spawn
        return this.findPlayerSpawnLocation(this.worldMap.islands || []);
    }

    // Check if a position is safe to spawn (on sand, not in water or building)
    // Now checks a larger area to ensure player has room to move
    isPositionSafe(x, y) {
        try {
            const tileSize = CONSTANTS.TILE_SIZE;
            
            // Check multiple points around the position to ensure room to move
            const checkPoints = [
                { x: x, y: y },
                { x: x - tileSize, y: y },
                { x: x + tileSize, y: y },
                { x: x, y: y - tileSize },
                { x: x, y: y + tileSize },
            ];
            
            for (const point of checkPoints) {
                const col = Math.floor(point.x / tileSize);
                const row = Math.floor(point.y / tileSize);

                // Check bounds
                if (!this.worldMap || col < 0 || col >= this.worldMap.width || row < 0 || row >= this.worldMap.height) {
                    return false;
                }

                // Check if it's land (terrainMap: 0 = land, 1 = water)
                if (this.worldMap.terrainMap && this.worldMap.terrainMap[row] && this.worldMap.terrainMap[row][col] !== 0) {
                    return false;
                }
            }

            // Check if there's a building collision here or nearby
            if (this.buildings && this.buildings.length > 0) {
                for (const building of this.buildings) {
                    // Check a larger area around spawn point
                    if (building.checkCollision(x, y) ||
                        building.checkCollision(x - tileSize, y) ||
                        building.checkCollision(x + tileSize, y) ||
                        building.checkCollision(x, y - tileSize) ||
                        building.checkCollision(x, y + tileSize)) {
                        return false;
                    }
                }
            }

            // Check if there's an NPC here
            if (this.npcs && this.npcs.length > 0) {
                const playerWidth = this.player ? this.player.width : 16;
                const playerHeight = this.player ? this.player.height : 16;
                for (const npc of this.npcs) {
                    if (npc.checkCollision(x - playerWidth / 2, y - playerHeight / 2, playerWidth, playerHeight)) {
                        return false;
                    }
                }
            }

            return true;
        } catch (e) {
            console.error('isPositionSafe error:', e);
            return false;
        }
    }

    // Push player away from any overlapping NPCs after spawn
    pushPlayerAwayFromNPCs() {
        if (!this.npcs || !this.player) return;
        
        const px = this.player.position.x;
        const py = this.player.position.y;
        const pw = this.player.width;
        const ph = this.player.height;
        const tileSize = CONSTANTS.TILE_SIZE;
        
        for (const npc of this.npcs) {
            const overlapping = !(
                px + pw <= npc.position.x || px >= npc.position.x + npc.width ||
                py + ph <= npc.position.y || py >= npc.position.y + npc.height
            );
            
            if (overlapping) {
                // Calculate direction away from NPC center
                const npcCenterX = npc.position.x + npc.width / 2;
                const npcCenterY = npc.position.y + npc.height / 2;
                const playerCenterX = px + pw / 2;
                const playerCenterY = py + ph / 2;
                
                let dx = playerCenterX - npcCenterX;
                let dy = playerCenterY - npcCenterY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Normalize, default to pushing right if exactly overlapping
                if (dist < 0.1) { dx = 1; dy = 0; }
                else { dx /= dist; dy /= dist; }
                
                // Push player 2 tiles away from NPC
                const pushDist = tileSize * 2;
                let newX = px + dx * pushDist;
                let newY = py + dy * pushDist;
                
                // Verify the pushed position is safe (temporarily remove NPC check to avoid recursion)
                const npcsBackup = this.npcs;
                this.npcs = [];
                const safe = this.isPositionSafe(newX + pw / 2, newY + ph / 2);
                this.npcs = npcsBackup;
                
                if (safe) {
                    this.player.position.x = newX;
                    this.player.position.y = newY;
                    console.log(`🏃 Pushed player away from NPC "${npc.name}" by ${pushDist}px`);
                    return;
                } else {
                    // Try 8 cardinal/diagonal directions
                    for (let angle = 0; angle < 8; angle++) {
                        const rad = (angle / 8) * Math.PI * 2;
                        const testX = px + Math.cos(rad) * pushDist;
                        const testY = py + Math.sin(rad) * pushDist;
                        this.npcs = [];
                        const testSafe = this.isPositionSafe(testX + pw / 2, testY + ph / 2);
                        this.npcs = npcsBackup;
                        if (testSafe) {
                            this.player.position.x = testX;
                            this.player.position.y = testY;
                            console.log(`🏃 Pushed player away from NPC "${npc.name}" (direction ${angle})`);
                            return;
                        }
                    }
                    console.warn(`⚠️ Could not push player away from NPC "${npc.name}" — no safe direction found`);
                }
            }
        }
    }

    // Find a suitable spawn location for the player on an island
    findPlayerSpawnLocation(islands) {
        if (!islands || islands.length === 0) {
            console.warn('⚠️ No islands found, spawning at world center');
            return { 
                x: this.worldWidth / 2, 
                y: this.worldHeight / 2 
            };
        }

        // Use the largest island for spawning (usually the first one)
        let bestIsland = islands[0];
        for (let island of islands) {
            if (island.size > bestIsland.size) {
                bestIsland = island;
            }
        }

        const tileSize = CONSTANTS.TILE_SIZE;
        const { x: centerX, y: centerY, size } = bestIsland;
        
        console.log(`🏝️ Spawning player on island at ${centerX}, ${centerY} (size: ${size})`);

        // Collect all safe spawn positions, then pick one randomly
        const safeSpots = [];
        
        // Search in expanding circles, checking 16 angles per radius
        for (let radius = 3; radius < Math.min(size - 1, 8); radius++) {
            for (let angle = 0; angle < 16; angle++) {
                const angleRad = (angle / 16) * 2 * Math.PI;
                const testCol = centerX + Math.floor(Math.cos(angleRad) * radius);
                const testRow = centerY + Math.floor(Math.sin(angleRad) * radius);

                // Convert to world coordinates
                const worldX = (testCol * tileSize) + (tileSize / 2);
                const worldY = (testRow * tileSize) + (tileSize / 2);

                // Check if this position is safe (on sand, not in building)
                if (this.isPositionSafe(worldX, worldY)) {
                    safeSpots.push({ x: worldX, y: worldY, col: testCol, row: testRow });
                }
            }
        }

        // Pick a random safe spot (using Math.random for true randomness per player)
        if (safeSpots.length > 0) {
            const spot = safeSpots[Math.floor(Math.random() * safeSpots.length)];
            console.log(`✅ Found safe spawn at tile (${spot.col}, ${spot.row}) - picked from ${safeSpots.length} options`);
            return { x: spot.x, y: spot.y };
        }

        // Fallback: search the entire island randomly
        console.log('⚠️ Spiral search failed, trying random positions...');
        for (let attempts = 0; attempts < 100; attempts++) {
            const testCol = centerX + Math.floor((Math.random() - 0.5) * size * 1.5);
            const testRow = centerY + Math.floor((Math.random() - 0.5) * size * 1.5);
            const worldX = (testCol * tileSize) + (tileSize / 2);
            const worldY = (testRow * tileSize) + (tileSize / 2);
            
            if (this.isPositionSafe(worldX, worldY)) {
                console.log(`✅ Found safe spawn at random tile (${testCol}, ${testRow})`);
                return { x: worldX, y: worldY };
            }
        }

        // Last resort: island center with small random offset
        console.log('⚠️ Could not find clear spawn area, using island center with offset');
        return {
            x: (centerX * tileSize) + (tileSize / 2) + (Math.random() - 0.5) * tileSize * 3,
            y: (centerY * tileSize) + (tileSize / 2) + (Math.random() - 0.5) * tileSize * 3
        };
    }
    
    // Trigger Drift Reset manually (for testing or external triggers)
    triggerDriftReset() {
        if (this.driftReset) {
            this.driftReset.triggerDriftResetManual();
        } else {
            console.warn('DriftReset system not available');
        }
    }
}
