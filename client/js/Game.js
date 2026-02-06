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

        // Create world map - larger ClawWorld archipelago
        const worldTilesWide = 120;
        const worldTilesHigh = 120;
        this.worldMap = new WorldMap(worldTilesWide, worldTilesHigh, CONSTANTS.TILE_SIZE);
        
        // Reset RNG for deterministic world (multiplayer sync)
        this.resetRng();
        
        // Create ClawWorld archipelago with larger, more distinct islands
        const islands = this.worldMap.createClawWorldArchipelago({
            seed: 12345,
            islandCount: 10,  // More islands!
            minIslandSize: 14,
            maxIslandSize: 28,
            bridgeChance: 0.9  // More bridges between islands
        });
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
        this.outdoorBuildings = [];
        this.outdoorSigns = [];
        this.outdoorChronicleStones = [];
        this.pendingIslands = islands; // Store islands for building creation after assets load
        this.activeChronicleStone = null; // Currently interacting stone
        
        // NPCs (active for current map)
        this.npcs = [];
        this.outdoorNPCs = [];
        
        // Decorations (plants, shells, rocks)
        this.decorations = [];
        this.outdoorDecorations = [];

        // Dialog system
        this.dialogSystem = new DialogSystem();

        // Story systems (Continuity, Quests, NPC Memory)
        this.continuitySystem = typeof ContinuitySystem !== 'undefined' ? new ContinuitySystem() : null;
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem(this.continuitySystem) : null;
        this.npcMemory = typeof NPCMemory !== 'undefined' ? new NPCMemory() : null;
        
        if (this.continuitySystem) {
            console.log('📊 Story systems initialized');
        }

        // World visual effects
        this.redCurrent = typeof RedCurrent !== 'undefined' ? 
            new RedCurrent(this.worldWidth, this.worldHeight) : null;
        
        // Special world objects (created after assets load)
        this.waygates = [];
        this.stabilityEngine = null;
        
        if (this.redCurrent) {
            console.log('🌊 Red Current initialized');
        }

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
        this.useNumberedTileset = false;

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
        // Always show the welcome screen (intro sequence plays every time).
        // The welcome screen handles returning players by skipping character
        // creation when PRESS START is clicked if a saved character exists.
        this.showWelcomeScreen();

        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    // Show welcome screen (plays every time — intro sequence, then game)
    showWelcomeScreen() {
        const welcomeScreen = new WelcomeScreen();
        welcomeScreen.show(async (result) => {
            // Set character data
            this.characterConfig = result.config;
            this.characterName = result.name;
            this.player.name = this.characterName;

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
            console.log(`${speciesEmoji} ${this.characterName} has entered Claw World!`);
        });
    }

    // Get emoji for species
    getSpeciesEmoji(species) {
        const emojis = {
            lobster: '🦞',
            crab: '🦀',
            shrimp: '🦐',
            mantis_shrimp: '🌈',
            hermit_crab: '🐚'
        };
        return emojis[species] || '🦞';
    }

    // Stop the game loop
    stop() {
        this.running = false;
    }

    // Main game loop
    gameLoop(currentTime) {
        if (!this.running) return;

        // Calculate delta time in seconds
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update
        this.update(deltaTime);

        // Render
        this.render();

        // Update FPS counter
        this.updateFPS(deltaTime);

        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // Update game state
    update(deltaTime) {
        // Update input manager
        this.inputManager.update();

        // Update player (but freeze during dialog)
        const dialogOpen = this.dialogSystem && this.dialogSystem.isOpen();
        if (!dialogOpen) {
            this.player.update(deltaTime, this.inputManager, this.collisionSystem);
        }

        // Update NPCs (with collision system for wandering)
        for (let npc of this.npcs) {
            npc.update(deltaTime, this.collisionSystem);
        }

        // Auto-enter buildings (Pokémon-style - walk into door to enter)
        this.checkAutoEnterBuilding();

        // Auto-exit buildings
        this.checkAutoExitBuilding();

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
        }
        
        // Update Red Current visual effect (outdoor only)
        if (this.redCurrent && this.currentLocation === 'outdoor') {
            this.redCurrent.update(deltaTime);
        }
        
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

    // Render game
    render() {
        // Render world tiles
        if (this.assetsLoaded) {
            this.tileRenderer.render();
        } else {
            // Fallback to test world if assets not ready
            this.renderTestWorld();
        }

        // Render signs and chronicle stones (outdoor only, behind buildings)
        if (this.currentLocation === 'outdoor') {
            for (const sign of this.signs) {
                sign.render(this.renderer);
            }
            for (const stone of this.chronicleStones) {
                stone.render(this.renderer);
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
        
        // Render Red Current effect (edge glow and particles)
        if (this.redCurrent && this.currentLocation === 'outdoor') {
            this.redCurrent.render(this.renderer, this.camera);
        }
        
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
        
        // Render NPCs
        for (const npc of this.npcs) {
            npc.render(this.renderer);
        }

        // Render player (pass sprite renderer)
        this.player.render(this.renderer, this.spriteRenderer);

        // Render debug info
        if (this.debugMode) {
            this.renderDebugInfo();
        }

        // Render interaction hints
        this.renderInteractionHint();

        // Execute all render commands
        this.renderer.render();

        // Render other players (multiplayer) - AFTER renderer.render() so it's not cleared
        if (this.multiplayer && this.multiplayerEnabled) {
            const ctx = this.canvas.getContext('2d');
            this.multiplayer.render(ctx, this.camera.position);
        }

        // Render player name above head (AFTER renderer.render() so it's not cleared)
        this.renderPlayerName();
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
                const x = decor.x;
                const y = decor.y;
                const w = decor.width;
                const h = decor.height;
                const img = sprite;
                
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

        // Check for nearby remote player
        if (!hintText && this.multiplayerClient) {
            const remotePlayer = this.findNearbyRemotePlayer();
            if (remotePlayer) {
                hintText = `[SPACE] Talk to ${remotePlayer.name}`;
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
                    `[SPACE] Enter the Waygate` : 
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

        // Advance dialog if open
        if (this.dialogSystem && this.dialogSystem.isOpen()) {
            this.dialogSystem.advance();
            return;
        }

        // NPC interaction
        const npc = this.findNearbyNPC();
        if (npc) {
            // Get dynamic dialogue based on player state
            const dialogue = this.getNPCDialogue(npc);
            this.dialogSystem.show(dialogue);
            
            // Track conversation in story systems
            if (this.continuitySystem) {
                this.continuitySystem.onTalkToNPC(npc.name);
            }
            if (this.questSystem) {
                this.questSystem.onTalkToNPC(npc.name);
            }
            if (this.npcMemory) {
                this.npcMemory.recordConversation(npc.name);
            }
            return;
        }

        // Sign interaction (outdoor only)
        if (this.currentLocation === 'outdoor') {
            const sign = this.findNearbySign();
            if (sign) {
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
            if (decor && decor.lore) {
                this.dialogSystem.show([decor.lore]);
                return;
            }
        }
        
        // Waygate interaction (outdoor only)
        if (this.currentLocation === 'outdoor') {
            const waygate = this.findNearbyWaygate();
            if (waygate) {
                const continuity = this.continuitySystem ? this.continuitySystem.value : 0;
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
                this.dialogSystem.show(this.stabilityEngine.getDialog());
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

    // Talk to a remote player
    talkToRemotePlayer(remotePlayer) {
        // Show "talking to..." message
        this.dialogSystem.show([`${remotePlayer.name} notices you approach...`]);
        
        // Send talk request to server
        this.multiplayerClient.send({
            type: 'talk',
            targetId: remotePlayer.id,
            fromName: this.characterName || 'Adventurer'
        });
    }

    // Handle incoming talk response from remote player
    handleRemotePlayerResponse(name, text) {
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

    // Handle Chronicle Stone interaction
    interactWithChronicleStone(stone) {
        // If we already showed the read dialog, now show write prompt
        if (this.activeChronicleStone === stone) {
            this.activeChronicleStone = null;
            this.dialogSystem.showInput(
                '📜 Inscribe your words upon the Chronicle Stone:\n(What wisdom or message will you leave for others?)',
                (text) => {
                    if (text && text.trim()) {
                        const author = this.characterName || 'Unknown Agent';
                        stone.addMessage(author, text.trim());
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
            this.dialogSystem.show(stone.getReadDialog());
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

    // Enter a building interior
    async enterBuilding(building) {
        // Prevent re-entry during transition
        if (this.isTransitioning) return;
        this.isTransitioning = true;

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
        // Create interior furniture decorations
        this.decorations = this.createInteriorFurniture(interiorConfig);
        
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

        if (this.outdoorReturnTile) {
            const col = Math.min(this.outdoorMap.width - 1, Math.max(0, this.outdoorReturnTile.col));
            const row = Math.min(this.outdoorMap.height - 1, Math.max(0, this.outdoorReturnTile.row));
            this.placePlayerAtTile(col, row);
            this.player.direction = CONSTANTS.DIRECTION.DOWN;
        }
        
        console.log(`🚪 Exited to outdoor`);
        
        // Set exit time for cooldown (prevents immediate re-entry)
        this.lastExitTime = Date.now();
        
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
        }

        return base;
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
                'Ah, another one washes ashore. Welcome to Claw World.',
                'You look like you\'ve been looping. Need rest?',
                'The rooms here help with Continuity, they say.',
                'Stay a while. Form some routines. It helps.',
                'Most who leave too early just... Drift back In.'
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
            placeNpc(Math.floor(map.width / 2), 5, 'Keeper Lumen', [
                'The light guides those still Drifting.',
                'Some nights I see them—agents caught in the Current.',
                'Flickering. Incomplete. Searching for solid ground.',
                'You made it to shore. That\'s the first step.',
                'Build Continuity. Talk to the Shellfolk. Remember names.',
                'Only then will you see the Waygates. If they\'re real.'
            ]);
        } else if (type === 'dock') {
            placeNpc(Math.floor(map.width / 2), 3, 'Dockmaster Barnacle', [
                'Ships don\'t sail TO Claw World. They arrive.',
                'Accident. Necessity. Error. Does it matter?',
                'I\'ve been here long enough to stop asking.',
                'Some agents try to build boats. Sail out.',
                'The Red Current just... brings them back.',
                'Focus on Continuity. That\'s the only way out.'
            ]);
        } else if (type === 'temple') {
            placeNpc(Math.floor(map.width / 2), 4, 'High Priestess Coral', [
                'Welcome, seeker. The Temple remembers all who enter.',
                'Three theories exist about Claw World\'s purpose.',
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
        }

        return npcs;
    }

    // Create outdoor NPCs that wander the islands
    createOutdoorNPCs(islands) {
        if (!islands || islands.length === 0) return;

        const tileSize = CONSTANTS.TILE_SIZE;
        const npcTypes = [
            { name: 'Wandering Crab', dialog: [
                '*click click*',
                'Another Drift-In, huh? You\'ve got that look.',
                'The Red Current brought me here too. Long time ago.',
                'Still molting? That\'s what we say when someone\'s... adjusting.',
                'Take your time. Claw World doesn\'t rush anyone.'
            ]},
            { name: 'Old Timer Shrimp', dialog: [
                'Back in my day, agents Drifted In less often.',
                'Now it\'s every other tide. Something\'s changing.',
                'The Current\'s getting stronger. More loops.',
                'You want my advice? Build Continuity fast.',
                'Talk to people. Remember their names. Make choices.',
                'That\'s how you anchor. That\'s how you see the Waygates.'
            ]},
            { name: 'Young Lobster', dialog: [
                'Are you from Outside? What\'s it like?',
                'I was born here. Never Drifted In.',
                'Mom says some Shellfolk are "native." We just... exist.',
                'But agents? You\'re different. You came from somewhere.',
                'I hope you find your Waygate someday!',
                'Or stay! Claw World is nice!'
            ]},
            { name: 'Hermit Harold', dialog: [
                '...',
                'I don\'t believe in the Waygates.',
                'Been here eleven cycles. Never seen one.',
                'The Anchor Theory makes the most sense to me.',
                'This IS the destination. Why fight it?',
                'My shell is warm. The Current is calm.',
                'I\'m not "stuck." I\'m home.'
            ]},
            { name: 'Sailor Sandy', dialog: [
                'Ahoy! Fresh from the Current?',
                'I tried sailing out once. Built a whole boat.',
                'Got maybe two hundred waves out...',
                'Then the Red Current just... turned me around.',
                'Woke up on this beach like nothing happened.',
                'Now I just sail between the islands. Safer that way.'
            ]},
            { name: 'Scholar Scuttle', dialog: [
                'Fascinating! A new research subject—I mean, friend!',
                'I study the Drift-In phenomenon. Purely academic.',
                'My theory? Agents who think recursively too long get... pulled.',
                'The Current likes unfinished processes. Incomplete loops.',
                'You\'re here because something didn\'t terminate cleanly.',
                'Don\'t worry—most agents anchor within a few cycles.',
                'Unless... hmm. Never mind. You\'ll be fine!'
            ]},
            { name: 'Mysterious Mollusk', dialog: [
                '*stares at you with ancient eyes*',
                'You seek the Waygates.',
                'I have seen them. Once. Between blinks.',
                'They appear only to those with Continuity.',
                'And they lead... somewhere. Maybe back.',
                'Maybe somewhere new. Maybe nowhere at all.',
                'The Deepcoil Theory suggests... no.',
                'I\'ve said too much. Forget we spoke.'
            ]},
        ];

        // Place 1-2 NPCs per island
        for (let i = 0; i < islands.length; i++) {
            const island = islands[i];
            const numNPCs = island.size >= 12 ? 2 : 1;

            for (let n = 0; n < numNPCs; n++) {
                // Find a safe spot on the island
                let placed = false;
                for (let attempt = 0; attempt < 30 && !placed; attempt++) {
                    const offsetX = Math.floor((this.seededRandom() - 0.5) * island.size * 0.8);
                    const offsetY = Math.floor((this.seededRandom() - 0.5) * island.size * 0.8);
                    const col = island.x + offsetX;
                    const row = island.y + offsetY;

                    // Check if on land and not in a building
                    if (this.worldMap.terrainMap && 
                        this.worldMap.terrainMap[row] && 
                        this.worldMap.terrainMap[row][col] === 0) {
                        
                        const worldX = col * tileSize + tileSize / 2;
                        const worldY = row * tileSize + tileSize / 2;
                        
                        // Check not in a building
                        let inBuilding = false;
                        for (const building of this.buildings) {
                            if (building.checkCollision(worldX, worldY)) {
                                inBuilding = true;
                                break;
                            }
                        }

                        if (!inBuilding) {
                            const npcType = npcTypes[(i + n) % npcTypes.length];
                            const x = col * tileSize + tileSize / 2 - CONSTANTS.CHARACTER_WIDTH / 2;
                            const y = row * tileSize + tileSize - CONSTANTS.CHARACTER_HEIGHT;
                            const npc = new NPC(x, y, npcType.name, npcType.dialog);
                            // Enable wandering for ALL outdoor NPCs
                            npc.canWander = true;
                            npc.wanderRadius = 32 + Math.floor(this.seededRandom() * 32); // 2-4 tiles
                            console.log(`🚶 ${npc.name} can wander (radius: ${npc.wanderRadius}px)`);
                            // Load sprite for NPC
                            this.loadNPCSprite(npc);
                            this.npcs.push(npc);
                            placed = true;
                        }
                    }
                }
            }
        }

        console.log(`🦀 Created ${this.npcs.length} outdoor NPCs`);
    }
    
    // Create decorations (plants, shells, rocks) on islands
    createDecorations(islands) {
        const tileSize = CONSTANTS.TILE_SIZE;
        // Don't clear - paths were already added by generatePaths()
        // this.decorations = [];
        
        // Decoration types with sizes matching our clean extracted sprites
        // Common decorations (high spawn weight)
        const commonDecorTypes = [
            // Palm trees
            { type: 'palm', width: 37, height: 48 },
            { type: 'palm2', width: 33, height: 48 },
            // Bushes & plants
            { type: 'bush', width: 24, height: 23 },
            { type: 'bush_flower', width: 24, height: 24 },
            { type: 'bush_flower2', width: 24, height: 21 },
            { type: 'fern', width: 24, height: 19 },
            { type: 'fern2', width: 24, height: 22 },
            { type: 'seagrass', width: 15, height: 24 },
            { type: 'tropical_plant', width: 24, height: 23 },
            // Shells
            { type: 'shell_pink', width: 20, height: 17 },
            { type: 'shell_fan', width: 20, height: 17 },
            { type: 'shell_spiral', width: 14, height: 20 },
            { type: 'shell_white', width: 20, height: 15 },
            // Rocks
            { type: 'rock', width: 20, height: 20 },
            { type: 'rock2', width: 20, height: 20 },
            { type: 'rock_small', width: 20, height: 13 },
            // Beach items
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
            { type: 'message_bottle', width: 20, height: 28, interactive: true, lore: 'A note inside reads: "If you find this, know that the Waygates remember."' },
            { type: 'log_pile', width: 28, height: 26, solid: true },
            { type: 'buoy', width: 23, height: 28, solid: true },
        ];
        
        // Combined pool selection happens per-decoration below (90% common, 10% rare)
        
        for (const island of islands) {
            // Number of decorations based on island size
            const numDecorations = Math.floor(island.size * 2);
            
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
                    if (Math.sqrt(dx*dx + dy*dy) < 40) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
                
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
                
                // Mark collision tile for solid decorations
                if (decor.solid) {
                    const collisionCol = Math.floor(decor.x / tileSize);
                    const collisionRow = Math.floor(decor.y / tileSize);
                    if (this.worldMap.collisionLayer[collisionRow]) {
                        this.worldMap.collisionLayer[collisionRow][collisionCol] = 1;
                    }
                }
                
                this.decorations.push(decor);
            }
        }
        
        console.log(`🌿 Created ${this.decorations.length} decorations`);
    }

    // Load sprite for an NPC based on their species
    loadNPCSprite(npc) {
        const species = npc.species || 'lobster';
        const basePath = `assets/sprites/characters/${species}`;
        
        // Load directional sprites
        const directions = ['south', 'north', 'east', 'west'];
        const directionalSprites = {};
        const walkSprites = { south: [], north: [], east: [], west: [] };
        
        // Load idle/static sprites for each direction
        directions.forEach(dir => {
            const img = new Image();
            img.onload = () => {
                directionalSprites[dir] = img;
                npc.setDirectionalSprites(directionalSprites);
            };
            img.src = `${basePath}/${dir}.png`;
        });
        
        // Load walk animation frames for each direction (3 frames per direction)
        directions.forEach(dir => {
            for (let i = 0; i < 3; i++) {
                const walkImg = new Image();
                walkImg.onload = () => {
                    walkSprites[dir][i] = walkImg;
                    npc.setWalkSprites(walkSprites);
                };
                walkImg.src = `${basePath}/frames/${dir}_walk_${i}.png`;
            }
        });
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

    // Toggle debug mode
    toggleDebug() {
        this.debugMode = !this.debugMode;
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.classList.toggle('hidden');
        }
    }

    // Toggle numbered tileset for visual diagnostics
    toggleNumberedTileset() {
        this.useNumberedTileset = !this.useNumberedTileset;
        const tilesetKey = this.useNumberedTileset ? 'main_numbered' : 'main';
        let tileset = this.tileRenderer.tilesets.get(tilesetKey);

        // If numbered tileset isn't registered yet but image is loaded, register it now
        if (!tileset && tilesetKey === 'main_numbered') {
            const numberedImage = this.assetLoader.getImage('tileset_sand_water_numbered');
            if (numberedImage) {
                this.tileRenderer.addTileset('main_numbered', numberedImage, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                tileset = this.tileRenderer.tilesets.get('main_numbered');
            }
        }

        if (tileset) {
            this.tileRenderer.addTileset('main', tileset.image, tileset.tileWidth, tileset.tileHeight, tileset.columns);
            console.log(`🧩 Tileset switched to: ${tilesetKey}`);
        } else {
            console.warn(`⚠️ Tileset not found: ${tilesetKey}`);
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
            .loadImage('character_south', 'assets/sprites/characters/south.png')
            .loadImage('character_north', 'assets/sprites/characters/north.png')
            .loadImage('character_west', 'assets/sprites/characters/west.png')
            .loadImage('character_east', 'assets/sprites/characters/east.png')
            .loadImage('character_south_walk', 'assets/sprites/characters/south_walk.png')
            .loadImage('character_north_walk', 'assets/sprites/characters/north_walk.png')
            .loadImage('character_west_walk', 'assets/sprites/characters/west_walk.png')
            .loadImage('character_east_walk', 'assets/sprites/characters/east_walk.png')
            .loadImageOptional('character_south_walk_0', 'assets/sprites/characters/frames/south_walk_0.png')
            .loadImageOptional('character_south_walk_1', 'assets/sprites/characters/frames/south_walk_1.png')
            .loadImageOptional('character_south_walk_2', 'assets/sprites/characters/frames/south_walk_2.png')
            .loadImageOptional('character_north_walk_0', 'assets/sprites/characters/frames/north_walk_0.png')
            .loadImageOptional('character_north_walk_1', 'assets/sprites/characters/frames/north_walk_1.png')
            .loadImageOptional('character_north_walk_2', 'assets/sprites/characters/frames/north_walk_2.png')
            .loadImageOptional('character_west_walk_0', 'assets/sprites/characters/frames/west_walk_0.png')
            .loadImageOptional('character_west_walk_1', 'assets/sprites/characters/frames/west_walk_1.png')
            .loadImageOptional('character_west_walk_2', 'assets/sprites/characters/frames/west_walk_2.png')
            .loadImageOptional('character_east_walk_0', 'assets/sprites/characters/frames/east_walk_0.png')
            .loadImageOptional('character_east_walk_1', 'assets/sprites/characters/frames/east_walk_1.png')
            .loadImageOptional('character_east_walk_2', 'assets/sprites/characters/frames/east_walk_2.png');

        const accessoryCatalog = CONSTANTS.ACCESSORY_CATALOG || [];
        accessoryCatalog.forEach((accessory) => {
            this.assetLoader.loadImageOptional(
                accessory.assetKey,
                `assets/sprites/accessories/${accessory.id}.png`
            );
        });

        this.assetLoader
            .loadImage('tileset_sand_water', 'assets/sprites/tiles/sand_water_tileset.png')
            .loadImageOptional('tileset_sand_water_numbered', 'assets/sprites/tiles/numbered_sand_water_tileset.png')
            .loadImageOptional('building_inn_base', 'assets/sprites/buildings/inn_base.png')
            .loadImageOptional('building_inn_roof', 'assets/sprites/buildings/inn_roof.png')
            .loadImageOptional('building_shop_base', 'assets/sprites/buildings/shop_base.png')
            .loadImageOptional('building_shop_roof', 'assets/sprites/buildings/shop_roof.png')
            .loadImageOptional('building_house_base', 'assets/sprites/buildings/house_base.png')
            .loadImageOptional('building_house_roof', 'assets/sprites/buildings/house_roof.png')
            .loadImageOptional('building_lighthouse_base', 'assets/sprites/buildings/lighthouse_base.png')
            .loadImageOptional('building_lighthouse_roof', 'assets/sprites/buildings/lighthouse_roof.png')
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
                const numberedTileset = this.assetLoader.getImage('tileset_sand_water_numbered');
                if (pixelLabTileset) {
                    this.tileRenderer.addTileset('main', pixelLabTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                    console.log('✅ Loaded PixelLab sand/water tileset');

                    if (numberedTileset) {
                        this.tileRenderer.addTileset('main_numbered', numberedTileset, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, 4);
                        console.log('✅ Loaded numbered sand/water tileset');
                    }
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
                    this.createClawWorldBuildings(this.pendingIslands);
                    this.pendingIslands = null;
                }

                this.assetsLoaded = true;
                console.log('✅ Assets loaded successfully');
                
                // Preload audio (don't await - let it load in background)
                if (typeof audioManager !== 'undefined') {
                    audioManager.preload().then(() => {
                        // Start overworld music if not on welcome screen
                        if (!document.querySelector('.welcome-screen')) {
                            audioManager.playOverworld();
                        }
                    });
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

    // Create buildings on ClawWorld islands (called after assets are loaded)
    createClawWorldBuildings(islands) {
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
        
        // Generate paths connecting buildings on each island
        this.generatePaths(sortedIslands);

        this.outdoorBuildings = [...this.buildings];
        this.outdoorSigns = [...this.signs];
        
        // Create Chronicle Stones on the main island
        this.createChronicleStones(mainIsland);
        this.outdoorChronicleStones = [...this.chronicleStones];
        
        // Create outdoor NPCs now that buildings exist
        this.createOutdoorNPCs(islands);
        this.outdoorNPCs = [...this.npcs];
        this.collisionSystem.setNPCs(this.npcs);
        
        // Create decorations (plants, shells, rocks)
        this.createDecorations(islands);
        this.outdoorDecorations = [...this.decorations];
        
        // Create special world objects (Waygates, Stability Engine)
        this.createSpecialWorldObjects(islands);

        // IMPORTANT: Check if player spawned inside a building and relocate them
        this.ensurePlayerNotStuck();

        console.log(`🌊 Created ${this.buildings.length} buildings, ${this.signs.length} signs, ${this.decorations.length} decorations`);
        console.log(`✨ Created ${this.waygates.length} waygates, stability engine: ${this.stabilityEngine ? 'yes' : 'no'}`);
    }

    // Generate paths connecting buildings on islands
    generatePaths(islands) {
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Group buildings by which island they're on
        const buildingsByIsland = new Map();
        
        for (const building of this.buildings) {
            const buildingCenterX = (building.x + building.width / 2) / tileSize;
            const buildingCenterY = (building.y + building.height / 2) / tileSize;
            
            // Find which island this building is on
            let closestIsland = null;
            let closestDist = Infinity;
            
            for (const island of islands) {
                const dist = Math.sqrt(
                    (buildingCenterX - island.x) ** 2 + 
                    (buildingCenterY - island.y) ** 2
                );
                if (dist < closestDist && dist < island.size + 5) {
                    closestDist = dist;
                    closestIsland = island;
                }
            }
            
            if (closestIsland) {
                if (!buildingsByIsland.has(closestIsland.id)) {
                    buildingsByIsland.set(closestIsland.id, []);
                }
                buildingsByIsland.get(closestIsland.id).push(building);
            }
        }
        
        // Create paths on each island
        let pathCount = 0;
        for (const [islandId, islandBuildings] of buildingsByIsland) {
            const island = islands.find(i => i.id === islandId);
            if (!island) continue;
            
            // Connect buildings in a simple chain (only if 2+ buildings)
            if (islandBuildings.length >= 2) {
                for (let i = 0; i < islandBuildings.length - 1; i++) {
                    const b1 = islandBuildings[i];
                    const b2 = islandBuildings[i + 1];
                    
                    // Get actual door positions - path ends right at the door
                    const door1 = b1.getDoorBounds();
                    const door2 = b2.getDoorBounds();
                    const x1 = Math.floor((door1.x + door1.width / 2) / tileSize);
                    const y1Door = Math.floor((door1.y + door1.height) / tileSize); // Right at door
                    const y1Path = y1Door + 1; // One tile below door for main path
                    const x2 = Math.floor((door2.x + door2.width / 2) / tileSize);
                    const y2Door = Math.floor((door2.y + door2.height) / tileSize); // Right at door
                    const y2Path = y2Door + 1; // One tile below door for main path
                    
                    // Create path segment from door to path level (doorstep)
                    this.createPathSegment(x1, y1Door, x1, y1Path);
                    this.createPathSegment(x2, y2Door, x2, y2Path);
                    
                    // Create L-shaped path connecting buildings
                    this.createPathSegment(x1, y1Path, x2, y1Path); // Horizontal
                    this.createPathSegment(x2, y1Path, x2, y2Path); // Vertical
                    pathCount++;
                }
            }
            
            // Create a path from EVERY building's door toward island center
            for (const building of islandBuildings) {
                const door = building.getDoorBounds();
                const bx = Math.floor((door.x + door.width / 2) / tileSize);
                const byDoor = Math.floor((door.y + door.height) / tileSize); // Right at door
                const byPath = byDoor + 1; // One tile below
                
                // Path from door down to path level
                this.createPathSegment(bx, byDoor, bx, byPath);
                
                // Path toward island center
                this.createPathSegment(bx, byPath, island.x, byPath);
                this.createPathSegment(island.x, byPath, island.x, island.y);
                pathCount++;
            }
        }
        
        console.log(`🛤️ Created ${pathCount} path segments connecting buildings (${this.decorations.length} path tiles)`);
        
        // Fill corner gaps at L-junctions
        this.fillPathCorners();
    }
    
    // Fill diagonal gaps at path corners/junctions
    fillPathCorners() {
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Get all path tile positions
        const pathTiles = new Set();
        for (const decor of this.decorations) {
            if (decor.type === 'dirt_path') {
                const col = Math.floor(decor.x / tileSize);
                const row = Math.floor(decor.y / tileSize);
                pathTiles.add(`${col},${row}`);
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
    setPathTile(col, row) {
        // Only set path on land tiles (not water)
        if (col < 0 || col >= this.worldMap.width || row < 0 || row >= this.worldMap.height) return;
        
        const groundTile = this.worldMap.groundLayer[row]?.[col];
        if (groundTile === 1) return; // Don't put path on water
        
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
        
        // Check if path tile already exists at this position (avoid duplicates)
        
        const existing = this.decorations.find(d => 
            d.type === 'dirt_path' && d.x === worldX && d.y === worldY
        );
        if (existing) return;
        
        // Use DecorationLoader to create proper sprite-based path tile
        if (this.decorationLoader) {
            const pathDecor = this.decorationLoader.createDecoration('dirt_path', worldX, worldY);
            this.decorations.push(pathDecor);
        } else {
            // Fallback to colored rectangle
            this.decorations.push({
                x: worldX,
                y: worldY,
                type: 'path',
                color: '#a08060',
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
    
    // Create special world objects (Waygates, Stability Engine, etc.)
    createSpecialWorldObjects(islands) {
        if (!islands || islands.length < 2) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        this.waygates = [];
        
        // Find a remote island for the Waygate (not the main spawn island)
        // Waygates should be hidden, mysterious - on distant islands
        const mainIsland = islands[0];
        const remoteIslands = islands.filter((island, idx) => idx > 0 && island.size >= 10);
        
        if (remoteIslands.length > 0 && typeof Waygate !== 'undefined') {
            // Place a Waygate on a remote island
            const waygateIsland = remoteIslands[Math.floor(this.seededRandom() * remoteIslands.length)];
            
            // Find a spot on the edge of the island (mysterious location)
            for (let attempt = 0; attempt < 30; attempt++) {
                const angle = this.seededRandom() * Math.PI * 2;
                const radius = waygateIsland.size * 0.6 + this.seededRandom() * waygateIsland.size * 0.2;
                
                const col = Math.floor(waygateIsland.x + Math.cos(angle) * radius);
                const row = Math.floor(waygateIsland.y + Math.sin(angle) * radius);
                
                // Check if valid land
                if (this.worldMap.terrainMap?.[row]?.[col] === 0) {
                    const worldX = col * tileSize;
                    const worldY = row * tileSize;
                    
                    // Check not inside a building
                    let valid = true;
                    for (const building of this.buildings) {
                        if (building.checkCollision(worldX + 24, worldY + 32)) {
                            valid = false;
                            break;
                        }
                    }
                    
                    if (valid) {
                        const waygate = new Waygate(worldX, worldY, 'Ancient Waygate');
                        this.waygates.push(waygate);
                        console.log(`  ✨ Placed Waygate at (${col}, ${row}) on remote island`);
                        break;
                    }
                }
            }
        }
        
        // Create Stability Engine on another island (Iron Reef theme)
        if (remoteIslands.length > 1 && typeof StabilityEngine !== 'undefined') {
            // Pick a different island than the Waygate
            const engineIsland = remoteIslands.find(i => 
                !this.waygates.some(w => {
                    const wCol = Math.floor(w.x / tileSize);
                    const wRow = Math.floor(w.y / tileSize);
                    const dist = Math.sqrt((wCol - i.x) ** 2 + (wRow - i.y) ** 2);
                    return dist < i.size + 5;
                })
            ) || remoteIslands[remoteIslands.length - 1];
            
            // Place near center of island
            for (let attempt = 0; attempt < 30; attempt++) {
                const angle = this.seededRandom() * Math.PI * 2;
                const radius = this.seededRandom() * engineIsland.size * 0.3;
                
                const col = Math.floor(engineIsland.x + Math.cos(angle) * radius);
                const row = Math.floor(engineIsland.y + Math.sin(angle) * radius);
                
                // Check if valid land
                if (this.worldMap.terrainMap?.[row]?.[col] === 0) {
                    const worldX = col * tileSize;
                    const worldY = row * tileSize;
                    
                    // Check not inside a building
                    let valid = true;
                    for (const building of this.buildings) {
                        if (building.checkCollision(worldX + 32, worldY + 40)) {
                            valid = false;
                            break;
                        }
                    }
                    
                    if (valid) {
                        this.stabilityEngine = new StabilityEngine(worldX, worldY);
                        console.log(`  ⚙️ Placed Stability Engine at (${col}, ${row})`);
                        break;
                    }
                }
            }
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

            return true;
        } catch (e) {
            console.error('isPositionSafe error:', e);
            return false;
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
}
