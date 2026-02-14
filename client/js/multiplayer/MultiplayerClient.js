/**
 * MultiplayerClient - Syncs local player with multiplayer server
 * Handles other players appearing in the same world
 */

class MultiplayerClient {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.remotePlayers = new Map(); // playerId -> RemotePlayer
        this.serverUrl = window.CONFIG?.MULTIPLAYER_URL || 'ws://localhost:3003';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50;
        this.lastSentPosition = { x: 0, y: 0 };
        this.positionSendInterval = null;
        this._pendingContexts = new Map();
        this.enemyDelegate = null;
        this.serverEnemies = new Map(); // enemyId -> RemoteEnemy
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Already connected to multiplayer server');
            return;
        }

        console.log(`🌐 Connecting to multiplayer: ${this.serverUrl}`);

        try {
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to multiplayer server');
                this.connected = true;
                this.reconnectAttempts = 0;
                // Keepalive ping every 25 seconds
                this.pingInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.send({ type: 'ping' });
                    }
                }, 25000);
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    // Handle compressed batched positions: { t: 'p', p: [...] }
                    if (msg.t === 'p') {
                        this.handleBatchedPositions(msg.p);
                        return;
                    }
                    this.handleMessage(msg);
                } catch (e) {
                    console.error('Multiplayer parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 Disconnected from multiplayer');
                this.connected = false;
                this.stopPositionSync();
                if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
                
                // Try to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Reconnecting in 3s (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => this.connect(), 3000);
                }
            };

            this.ws.onerror = (error) => {
                console.error('Multiplayer connection error');
            };

        } catch (e) {
            console.error('Failed to connect to multiplayer:', e);
        }
    }

    setEnemyDelegate(delegate) {
        this.enemyDelegate = delegate;
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                console.log(`🎫 Got player ID: ${this.playerId}`);
                // Auto-join once we have player info
                if (this.game.player && this.game.player.name) {
                    this.join();
                }
                break;

            case 'joined':
                console.log('✅ Joined multiplayer world!');
                this.startPositionSync();
                if (this.game && typeof this.game.broadcastPlayerContext === 'function') {
                    this.game.broadcastPlayerContext();
                }
                // Add existing players
                if (msg.players) {
                    msg.players.forEach(p => {
                        if (p.id !== this.playerId) {
                            this.addRemotePlayer(p);
                        }
                    });
                }
                if (Array.isArray(msg.enemies) && this.enemyDelegate?.handleEnemySnapshot) {
                    this.enemyDelegate.handleEnemySnapshot(msg.enemies);
                }
                break;

            case 'players':
                // Initial player list
                if (msg.players) {
                    msg.players.forEach(p => {
                        if (p.id !== this.playerId && !this.remotePlayers.has(p.id)) {
                            this.addRemotePlayer(p);
                        }
                    });
                }
                break;

            case 'player_joined':
                if (msg.player && msg.player.id !== this.playerId) {
                    console.log(`🦞 REMOTE PLAYER JOINED: ${msg.player.name} (${msg.player.id})`);
                    console.log(`   Position: ${msg.player.x}, ${msg.player.y}`);
                    console.log(`   Species: ${msg.player.species}, Color: ${msg.player.color}`);
                    this.addRemotePlayer(msg.player);
                    
                    // Show join message in game
                    if (this.game.showNotification) {
                        this.game.showNotification(`${msg.player.name} joined!`);
                    }
                }
                break;

            case 'player_left':
                console.log(`👋 ${msg.name || msg.playerId} left`);
                this.removeRemotePlayer(msg.playerId);
                break;

            case 'player_moved':
                // Debug: log first few position updates
                if (!this._moveLogCount) this._moveLogCount = 0;
                if (this._moveLogCount < 5) {
                    console.log(`📍 Remote player ${msg.playerId} moved to ${msg.x?.toFixed(0)}, ${msg.y?.toFixed(0)}`);
                    this._moveLogCount++;
                }
                this.updateRemotePlayer(msg.playerId, msg);
                break;

            case 'chat':
                console.log(`💬 ${msg.name}: ${msg.text}`);
                // Show speech bubble on remote player
                const speaker = this.remotePlayers.get(msg.playerId);
                if (speaker) {
                    speaker.showSpeech(msg.text);
                }
                break;

            case 'talk_request':
                // Someone wants to talk to us (for bots)
                console.log(`🗣️ ${msg.fromName} wants to talk!`);
                break;

            case 'talk_response':
                // Remote player/bot responded to our talk request
                const responderName = msg.fromName || msg.name;
                console.log(`💬 Response from ${responderName}: ${msg.text}`);
                if (this.game.handleRemotePlayerResponse) {
                    this.game.handleRemotePlayerResponse(responderName, msg.text);
                }
                // Also show speech bubble on the responder
                const responder = this.remotePlayers.get(msg.fromId);
                if (responder) {
                    responder.showSpeech(msg.text);
                }
                break;

            case 'player_action':
                // Could animate actions for remote players
                break;

            case 'player_context':
                this._applyRemoteContext(msg.playerId, msg.context || {});
                break;

            case 'enemy_spawn':
                this.handleEnemySpawn(this.normalizeEnemyPayload(msg));
                break;

            case 'enemy_move':
                this.handleEnemyMove(this.normalizeEnemyPayload(msg));
                break;

            case 'enemy_damage':
                this.handleEnemyDamage(msg);
                break;

            case 'enemy_death':
                this.handleEnemyDeath(msg);
                break;

            case 'attack':
                // Server attack response (for MCP bots)
                if (this.game.combatSystem?.handleServerAttackResult) {
                    this.game.combatSystem.handleServerAttackResult(msg);
                }
                break;

            case 'pong':
                // Latency check response
                break;
        }
    }

    handleBatchedPositions(players) {
        // Decode compressed format: [{i, x, y, d, m}, ...]
        for (const p of players) {
            this.updateRemotePlayer(p.i, {
                x: p.x,
                y: p.y,
                direction: p.d,
                isMoving: !!p.m
            });
        }
    }

    _applyRemoteContext(playerId, context = {}) {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
            remote.updateContext(context);
            return;
        }
        this._pendingContexts.set(playerId, context);
    }

    join() {
        if (!this.connected || !this.game.player) return;

        const player = this.game.player;
        const config = this.game.characterConfig || {};
        
        // Get character name - try multiple sources
        const charName = this.game.characterName || 
                        config.name ||
                        this.game.customizationData?.name ||
                        player.name || 
                        'Adventurer';
        
        // Get species from characterConfig or customization data
        const species = config.species || 
                       player.species || 
                       this.game.customizationData?.species ||
                       'lobster';
        
        // Get color from characterConfig (hueShift maps to color name)
        const colorMap = {
            0: 'red', 30: 'orange', 50: 'yellow', 120: 'green',
            170: 'teal', 200: 'blue', 270: 'purple', 320: 'pink'
        };
        const hueShift = config.hueShift || 0;
        const color = colorMap[hueShift] || player.colorName || 'red';
        
        console.log(`🎮 Joining multiplayer as: ${charName} (${species}, ${color})${this.game.spectateMode ? ' [SPECTATOR]' : ''}`);
        console.log(`   characterConfig:`, config);
        
        const joinMsg = {
            type: 'join',
            name: charName,
            species: species,
            color: color,
            x: player.position.x,
            y: player.position.y
        };
        
        // Spectators join invisibly — not shown to other players
        if (this.game.spectateMode) {
            joinMsg.spectator = true;
        }
        
        this.send(joinMsg);
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    sendPlayerContext(context) {
        this.send({
            type: 'context',
            ...context
        });
    }

    sendAttack(attackData) {
        this.send({
            type: 'attack',
            direction: attackData.direction,
            weapon: attackData.weapon,
            targetEnemyIds: attackData.targetEnemyIds
        });
    }

    sendAttack(payload = {}) {
        this.send({
            type: 'attack',
            ...payload
        });
    }

    startPositionSync() {
        // Send position updates when player moves
        this.positionSendInterval = setInterval(() => {
            if (!this.game.player) return;
            // Don't broadcast position in spectator mode (invisible watcher)
            if (this.game.spectateMode) return;

            const pos = this.game.player.position;
            const dir = this.game.player.direction;
            const moving = this.game.player.isMoving;

            // Only send if position changed
            if (pos.x !== this.lastSentPosition.x || 
                pos.y !== this.lastSentPosition.y ||
                moving) {
                
                this.send({
                    type: 'move',
                    x: pos.x,
                    y: pos.y,
                    direction: dir,
                    isMoving: moving
                });

                this.lastSentPosition = { x: pos.x, y: pos.y };
            }
        }, 50); // 20 updates per second max
    }

    stopPositionSync() {
        if (this.positionSendInterval) {
            clearInterval(this.positionSendInterval);
            this.positionSendInterval = null;
        }
    }

    addRemotePlayer(data) {
        if (this.remotePlayers.has(data.id)) {
            return; // Already tracking this exact player
        }

        // Remove any stale entry with the same name (reconnect with new ID)
        for (const [existingId, existingPlayer] of this.remotePlayers) {
            if (existingPlayer.name === data.name) {
                console.log(`♻️ Removing stale player: ${data.name} (${existingId}) → replaced by ${data.id}`);
                existingPlayer.destroy();
                this.remotePlayers.delete(existingId);
                break;
            }
        }

        console.log(`✅ ADDING REMOTE PLAYER: ${data.name} (${data.id})`);
        console.log(`   Total remote players will be: ${this.remotePlayers.size + 1}`);
        const remote = new RemotePlayer(this.game, data);
        this.remotePlayers.set(data.id, remote);
        const pendingContext = this._pendingContexts.get(data.id);
        if (pendingContext) {
            remote.updateContext(pendingContext);
            this._pendingContexts.delete(data.id);
        }
    }

    removeRemotePlayer(playerId) {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
            remote.destroy();
            this.remotePlayers.delete(playerId);
        }
    }

    updateRemotePlayer(playerId, data) {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
            remote.updatePosition(data.x, data.y, data.direction, data.isMoving);
        }
    }

    update(deltaTime) {
        // Update all remote players (interpolation)
        this.remotePlayers.forEach(player => {
            player.update(deltaTime);
        });

        // Update all server enemies (interpolation)
        this.serverEnemies.forEach(enemy => {
            enemy.update(deltaTime);
        });
    }

    render(ctx, camera) {
        // Debug: log render count occasionally
        if (!this._renderLogCount) this._renderLogCount = 0;
        if (this._renderLogCount < 3 && (this.remotePlayers.size > 0 || this.serverEnemies.size > 0)) {
            console.log(`🎨 Rendering ${this.remotePlayers.size} remote players, ${this.serverEnemies.size} server enemies`);
            this._renderLogCount++;
        }
        
        // Render all remote players
        this.remotePlayers.forEach(player => {
            player.render(ctx, camera);
        });

        // Render all server enemies
        this.serverEnemies.forEach(enemy => {
            if (this.game.renderer) {
                enemy.render(this.game.renderer);
            }
        });
    }

    normalizeEnemyPayload(payload) {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.enemies)) return payload.enemies;
        if (payload.enemy) return [payload.enemy];
        if (payload.enemies) return [payload.enemies];
        return [];
    }

    handleEnemySpawn(enemies) {
        for (const enemyData of enemies) {
            if (!enemyData || !enemyData.id) continue;
            console.log(`🦾 Enemy spawned: ${enemyData.name} (${enemyData.id}) at (${enemyData.x}, ${enemyData.y})`);
            
            const enemy = new RemoteEnemy(this.game, enemyData);
            this.serverEnemies.set(enemyData.id, enemy);
            
            // Notify combat system about server enemy
            if (this.game.combatSystem?.addServerEnemy) {
                this.game.combatSystem.addServerEnemy(enemy);
            }
        }
    }

    handleEnemyMove(enemies) {
        for (const enemyData of enemies) {
            if (!enemyData || !enemyData.id) continue;
            const enemy = this.serverEnemies.get(enemyData.id);
            if (enemy) {
                enemy.updatePosition(enemyData.x, enemyData.y);
            }
        }
    }

    handleEnemyDamage(msg) {
        if (!msg.enemyId) return;
        const enemy = this.serverEnemies.get(msg.enemyId);
        if (enemy) {
            const newHealth = msg.shellIntegrity ?? msg.health ?? enemy.shellIntegrity;
            const newMax = msg.maxShellIntegrity ?? msg.maxHealth ?? enemy.maxShellIntegrity;
            enemy.takeDamage(newHealth, newMax);
        }
    }

    handleEnemyDeath(msg) {
        if (!msg.enemyId) return;
        const enemy = this.serverEnemies.get(msg.enemyId);
        if (enemy) {
            enemy.die();
        }
        // Remove from map after short delay for death animation
        setTimeout(() => {
            this.serverEnemies.delete(msg.enemyId);
            if (this.game.combatSystem?.removeServerEnemy) {
                this.game.combatSystem.removeServerEnemy(msg.enemyId);
            }
        }, 1000);
    }

    getServerEnemies() {
        return Array.from(this.serverEnemies.values());
    }

    disconnect() {
        this.stopPositionSync();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.enemyDelegate?.handleEnemySnapshot) {
            this.enemyDelegate.handleEnemySnapshot([]);
        }
        this.remotePlayers.clear();
        this.serverEnemies.clear();
    }
}

/**
 * RemotePlayer - Represents another player in the world
 */
class RemotePlayer {
    constructor(game, data) {
        this.game = game;
        this.id = data.id;
        this.name = data.name;
        this.isBot = data.isBot || false;
        this.displayName = this.isBot ? `🤖 ${data.name}` : data.name;
        this.species = data.species || 'lobster';
        this.color = data.color || 'red';
        this.hueShift = this.getHueShiftFromColor(this.color);
        
        this.position = { x: data.x || 0, y: data.y || 0 };
        this.targetPosition = { x: data.x || 0, y: data.y || 0 };
        this.direction = data.direction || 'south';
        this.isMoving = false;
        
        this.currentLocation = data.location || 'outdoor';
        this.currentBuildingType = data.buildingType || null;
        this.currentBuildingName = data.buildingName || null;
        
        // Sprites for each direction (will be hue-shifted)
        this.sprites = {};
        this.rawSprites = {}; // Original unshifted sprites
        this.spritesReady = false;
        this.currentSprite = null;
        this.animFrame = 0;
        this.animTimer = 0;
        
        this.speechText = null;
        this.speechTimer = 0;
        
        // Mock stats for spectator mode (TODO: get from server)
        this.health = 80 + Math.floor(Math.random() * 20); // Random health 80-100
        this.maxHealth = 100;
        this.tokens = Math.floor(Math.random() * 1000); // Random tokens 0-1000
        this.kills = Math.floor(Math.random() * 25); // Random kills 0-25
        this.faction = this.isBot ? ['Iron Shell', 'Tide Runners', 'Deep Current', 'None'][Math.floor(Math.random() * 4)] : 'None';
        this.inventory = this.generateMockInventory();
        
        this.loadSprites();
    }

    getHueShiftFromColor(colorName) {
        const colorMap = {
            'red': 0,
            'orange': 30,
            'yellow': 50,
            'green': 120,
            'teal': 170,
            'blue': 200,
            'purple': 270,
            'pink': 320
        };
        return colorMap[colorName?.toLowerCase()] || 0;
    }

    generateMockInventory() {
        // Generate mock inventory items for display
        const itemPool = [
            'Shell Fragment', 'Brine Crystal', 'Seaweed', 'Pearl', 'Coral',
            'Driftwood', 'Sea Glass', 'Barnacle', 'Kelp Wrap', 'Sand Dollar',
            'Tide Pool Water', 'Sea Salt', 'Starfish', 'Anemone', 'Crab Claw'
        ];
        
        const inventory = [];
        const itemCount = Math.floor(Math.random() * 6); // 0-5 items
        
        for (let i = 0; i < itemCount; i++) {
            const item = itemPool[Math.floor(Math.random() * itemPool.length)];
            const count = Math.floor(Math.random() * 5) + 1; // 1-5 quantity
            inventory.push({
                name: item,
                count: count
            });
        }
        
        return inventory;
    }

    loadSprites() {
        const basePath = `assets/sprites/characters/${this.species}`;
        const directions = ['south', 'north', 'east', 'west'];
        let loadedCount = 0;
        const totalToLoad = directions.length * 2; // idle + walk for each direction
        
        // Walk sprite strips (3 frames of 24x24 in a 72x24 image)
        this.walkSprites = {};
        
        directions.forEach(dir => {
            // Load idle sprite
            const img = new Image();
            img.onload = () => {
                this.sprites[dir] = this.applyHueShift(img);
                loadedCount++;
                if (loadedCount >= totalToLoad) {
                    this.spritesReady = true;
                    this.currentSprite = this.sprites['south'];
                }
            };
            img.onerror = () => {
                loadedCount++;
                if (loadedCount >= totalToLoad) {
                    this.spritesReady = true;
                    this.currentSprite = this.sprites['south'];
                }
            };
            img.src = `${basePath}/${dir}.png`;
            this.rawSprites[dir] = img;
            
            // Load walk sprite strip (3 frames)
            const walkImg = new Image();
            walkImg.onload = () => {
                this.walkSprites[dir] = this.splitWalkFrames(walkImg);
                loadedCount++;
                if (loadedCount >= totalToLoad) {
                    this.spritesReady = true;
                    this.currentSprite = this.sprites['south'];
                }
            };
            walkImg.onerror = () => {
                loadedCount++;
                if (loadedCount >= totalToLoad) {
                    this.spritesReady = true;
                    this.currentSprite = this.sprites['south'];
                }
            };
            walkImg.src = `${basePath}/${dir}_walk.png`;
        });
    }

    splitWalkFrames(stripImage) {
        // Walk strip is 72x24 = 3 frames of 24x24
        const frameW = 24;
        const frameH = stripImage.height;
        const numFrames = Math.floor(stripImage.width / frameW);
        const frames = [];
        
        for (let i = 0; i < numFrames; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = frameW;
            canvas.height = frameH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(stripImage, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
            frames.push(this.applyHueShift(canvas));
        }
        
        return frames;
    }

    applyHueShift(image) {
        if (this.hueShift === 0) return image;
        
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
            
            // Only shift reddish colors
            if (h > 0.1 && h < 0.9) continue;
            
            // Apply shift
            h = (h + this.hueShift / 360) % 1;
            
            // Convert back to RGB
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
            
            data[i] = Math.round(hue2rgb(p, q, h + 1/3) * 255);
            data[i+1] = Math.round(hue2rgb(p, q, h) * 255);
            data[i+2] = Math.round(hue2rgb(p, q, h - 1/3) * 255);
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    updatePosition(x, y, direction, isMoving) {
        // Track if position actually changed (for movement detection)
        const dx = Math.abs(x - this.targetPosition.x);
        const dy = Math.abs(y - this.targetPosition.y);
        const posChanged = dx > 0.5 || dy > 0.5;
        
        this.targetPosition = { x, y };
        // Map direction names
        if (direction) {
            const dirMap = { 'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east' };
            this.direction = dirMap[direction] || direction;
        }
        
        // Use server's isMoving flag, but also detect movement from position changes
        // This prevents animation flickering when the flag briefly drops between ticks
        if (isMoving || posChanged) {
            this.isMoving = true;
            this._moveGraceTimer = 200; // Keep animating for 200ms after last movement
        } else if (!this._moveGraceTimer || this._moveGraceTimer <= 0) {
            this.isMoving = false;
        }
    }

    showSpeech(text) {
        this.speechText = text;
        this.speechTimer = 4000; // Show for 4 seconds
    }

    update(deltaTime) {
        // Interpolate toward target position for smooth movement
        // Spectated players use faster interpolation for near-real-time feel
        const speed = this._spectated ? 0.5 : 0.2;
        this.position.x += (this.targetPosition.x - this.position.x) * speed;
        this.position.y += (this.targetPosition.y - this.position.y) * speed;
        
        // Tick down movement grace timer (in ms)
        const dtMs = deltaTime * 1000; // deltaTime is in seconds, convert to ms
        if (this._moveGraceTimer > 0) {
            this._moveGraceTimer -= dtMs;
            if (this._moveGraceTimer <= 0) {
                this._moveGraceTimer = 0;
                // Check if we're actually still moving (position delta)
                const dx = Math.abs(this.targetPosition.x - this.position.x);
                const dy = Math.abs(this.targetPosition.y - this.position.y);
                if (dx < 1 && dy < 1) {
                    this.isMoving = false;
                }
            }
        }
        
        // Animation (timers in ms)
        if (this.isMoving) {
            this.animTimer += dtMs;
            if (this.animTimer > 150) {
                this.animFrame = (this.animFrame + 1) % 3;
                this.animTimer = 0;
            }
        } else {
            this.animFrame = 0;
        }
        
        // Speech timer (in ms)
        if (this.speechTimer > 0) {
            this.speechTimer -= dtMs;
            if (this.speechTimer <= 0) {
                this.speechText = null;
            }
        }
    }

    render(ctx, camera) {
        // Get display scale
        const scale = window.CONSTANTS?.DISPLAY_SCALE || 4;
        
        // Position is top-left of collision box (16x24)
        // Convert to feet position (bottom-center) for rendering
        const collisionW = 16;
        const collisionH = 24;
        const feetX = this.position.x + collisionW / 2;
        const feetY = this.position.y + collisionH;
        
        // Calculate screen position from feet
        const screenX = (feetX - (camera?.x || 0)) * scale;
        const screenY = (feetY - (camera?.y || 0)) * scale;
        
        // Get correct sprite for direction
        const dirMap = { 'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east' };
        const spriteDir = dirMap[this.direction] || this.direction || 'south';
        
        // Use walk frame if moving and walk sprites loaded, otherwise idle sprite
        let sprite;
        if (this.isMoving && this.walkSprites[spriteDir] && this.walkSprites[spriteDir].length > 0) {
            const frames = this.walkSprites[spriteDir];
            sprite = frames[this.animFrame % frames.length];
        } else {
            sprite = this.sprites[spriteDir] || this.sprites['south'];
        }
        
        // Sprite dimensions (24x24 pixels, scaled)
        const spriteW = 24 * scale;
        const spriteH = 24 * scale;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 8 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw sprite if loaded (sprite may be Image or Canvas)
        const spriteReady = sprite && (
            (sprite instanceof HTMLCanvasElement) ||
            (sprite.complete && sprite.naturalWidth > 0)
        );
        
        if (spriteReady) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                sprite,
                screenX - spriteW / 2,
                screenY - spriteH,
                spriteW,
                spriteH
            );
        } else {
            // Fallback: colored oval
            ctx.fillStyle = this.getSpeciesColor();
            ctx.beginPath();
            ctx.ellipse(screenX, screenY - 12 * scale, 8 * scale, 12 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Name label above
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = `bold ${7 * scale}px monospace`;
        ctx.textAlign = 'center';
        ctx.strokeText(this.displayName, screenX, screenY - spriteH - 4 * scale);
        ctx.fillText(this.displayName, screenX, screenY - spriteH - 4 * scale);
        
        // Speech bubble if speaking (offset to the right side)
        if (this.speechText) {
            this.renderSpeechBubble(ctx, screenX + spriteW / 2 + 10 * scale, screenY - spriteH / 2, scale);
        }
    }
    
    getSpeciesColor() {
        const colors = {
            lobster: '#E53935',
            crab: '#FF9800',
            shrimp: '#EC407A',
            hermit_crab: '#9C27B0',
            mantis_shrimp: '#4CAF50'
        };
        return colors[this.species] || '#E53935';
    }

    renderSpeechBubble(ctx, x, y, scale) {
        const text = this.speechText;
        const fontSize = Math.max(14, 4 * scale); // Bigger font
        ctx.font = `bold ${fontSize}px monospace`;
        
        // Word wrap long messages
        const maxWidth = 70 * scale;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(testLine).width > maxWidth) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        // Limit to 3 lines
        if (lines.length > 3) {
            lines.length = 3;
            lines[2] = lines[2].slice(0, -3) + '...';
        }
        
        const lineHeight = fontSize + 6;
        const padding = 10 * (scale / 4);
        const width = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width))) + padding * 2;
        const height = lines.length * lineHeight + padding * 2;
        
        const bubbleX = x;
        const bubbleY = y - height / 2;

        // Bubble background with shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect(bubbleX + 3, bubbleY + 3, width, height, 8);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, width, height, 8);
        ctx.fill();
        ctx.stroke();
        
        // Little triangle pointing left (toward character)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.beginPath();
        ctx.moveTo(bubbleX, y - 6);
        ctx.lineTo(bubbleX, y + 6);
        ctx.lineTo(bubbleX - 10, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bubbleX, y - 6);
        ctx.lineTo(bubbleX - 10, y);
        ctx.moveTo(bubbleX - 10, y);
        ctx.lineTo(bubbleX, y + 6);
        ctx.stroke();

        // Text
        ctx.fillStyle = '#1a1a2e';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + padding, bubbleY + padding + (i + 1) * lineHeight - 6);
        });
    }

    updateContext(context = {}) {
        const newLocation = context.location || this.currentLocation || 'outdoor';
        const newBuildingType = Object.prototype.hasOwnProperty.call(context, 'buildingType') ? context.buildingType : this.currentBuildingType;
        const newBuildingName = Object.prototype.hasOwnProperty.call(context, 'buildingName') ? context.buildingName : this.currentBuildingName;

        const locationChanged = newLocation !== this.currentLocation || newBuildingType !== this.currentBuildingType;

        this.currentLocation = newLocation;
        this.currentBuildingType = newBuildingType ?? null;
        this.currentBuildingName = newBuildingName ?? null;

        if (locationChanged && this.game && this.game.spectatePlayer === this && typeof this.game._onSpectatedPlayerContextChange === 'function') {
            this.game._onSpectatedPlayerContextChange();
        }
    }

    destroy() {
        // Cleanup
        this.sprite = null;
    }
}

/**
 * RemoteEnemy - Represents a server-managed enemy in the world
 */
class RemoteEnemy {
    constructor(game, data) {
        this.game = game;
        this.id = data.id;
        this.type = data.type;
        this.typeData = window.DRIFT_FAUNA_TYPES?.[this.type] || window.DRIFT_FAUNA_TYPES?.SKITTER;
        const defaultSize = this.typeData?.size || 10;
        const defaultShell = this.typeData?.shellIntegrity || 1;

        this.name = data.name || this.typeData?.name || this.type;
        this.x = data.x;
        this.y = data.y;
        this.width = data.width || defaultSize;
        this.height = data.height || defaultSize;
        this.shellIntegrity = data.shellIntegrity ?? data.health ?? defaultShell;
        this.maxShellIntegrity = data.maxShellIntegrity ?? data.maxHealth ?? defaultShell;
        this.state = data.state || 'idle';
        this.zoneId = data.zoneId;

        // Visual properties
        this.targetX = this.x;
        this.targetY = this.y;
        this.isDead = false;
        this.deathTimer = 0;
        this.flashTimer = 0;

        if (this.typeData) {
            this.color = this.typeData.color;
            this.flashColor = this.typeData.flashColor;
            this.aiType = this.typeData.aiType;
        } else {
            this.color = '#8b1a1a';
            this.flashColor = '#ff4444';
            this.aiType = 'skitter';
        }
    }

    updatePosition(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    takeDamage(newHealth, maxHealth) {
        if (typeof newHealth === 'number') {
            this.shellIntegrity = Math.max(0, newHealth);
        }
        if (typeof maxHealth === 'number') {
            this.maxShellIntegrity = maxHealth;
        }
        this.flashTimer = 200; // Flash for 200ms
    }

    die() {
        this.isDead = true;
        this.state = 'dying';
        this.deathTimer = 0;
    }

    update(deltaTime) {
        const dt = deltaTime;
        const dtMs = dt * 1000;

        // Smooth interpolation to target position
        const speed = 0.3; // Interpolation factor
        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;

        // Update flash timer
        if (this.flashTimer > 0) {
            this.flashTimer = Math.max(0, this.flashTimer - dtMs);
        }

        // Update death timer
        if (this.isDead) {
            this.deathTimer += dtMs;
        }
    }

    render(renderer) {
        if (!renderer || this.deathTimer > 600) return; // Don't render after 600ms death timer

        const x = Math.floor(this.x);
        const y = Math.floor(this.y);
        const w = this.width;
        const h = this.height;
        const self = this;

        // Add enemy to ENTITIES layer
        renderer.addToLayer(CONSTANTS.LAYER.ENTITIES, (ctx) => {
            ctx.save();

            // Death fade
            if (self.isDead) {
                ctx.globalAlpha = Math.max(0, 1 - (self.deathTimer / 600));
            }

            // Flash when taking damage
            const isFlashing = self.flashTimer > 0 && Math.floor(self.flashTimer / 100) % 2 === 0;
            const renderColor = isFlashing ? self.flashColor : self.color;

            // Render based on AI type (simplified versions of client rendering)
            switch (self.aiType) {
                case 'skitter':
                    self.renderSkitter(ctx, x, y, w, h, renderColor);
                    break;
                case 'haze':
                    self.renderHaze(ctx, x, y, w, h, renderColor);
                    break;
                case 'loop':
                    self.renderLoopling(ctx, x, y, w, h, renderColor);
                    break;
                default:
                    self.renderDefault(ctx, x, y, w, h, renderColor);
            }

            // Health bar (only when damaged)
            if (self.shellIntegrity < self.maxShellIntegrity && !self.isDead) {
                const barWidth = w + 4;
                const barHeight = 2;
                const barX = x - 2;
                const barY = y - 4;
                const healthPct = self.shellIntegrity / self.maxShellIntegrity;

                ctx.fillStyle = '#1a0000';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.fillStyle = healthPct > 0.5 ? '#cc3333' : healthPct > 0.25 ? '#cc6600' : '#cc0000';
                ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

            ctx.restore();
        });
    }

    renderSkitter(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        // Simple skitter representation
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 2, y + 2, 2, 2); // Eyes
    }

    renderHaze(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.globalAlpha *= 0.7; // Semi-transparent
        ctx.fillRect(x, y, w, h);
    }

    renderLoopling(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        // Simple spikes
        ctx.fillStyle = '#666';
        ctx.fillRect(x - 1, y + h/2, 2, 1);
        ctx.fillRect(x + w - 1, y + h/2, 2, 1);
    }

    renderDefault(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }

    // Compatibility with DriftFauna interface
    isAlive() {
        return !this.isDead && this.shellIntegrity > 0;
    }

    distanceTo(entity) {
        if (!entity || !entity.position) return Infinity;
        const dx = entity.position.x + (entity.width || 0) / 2 - (this.x + this.width / 2);
        const dy = entity.position.y + (entity.height || 0) / 2 - (this.y + this.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    destroy() {
        // Cleanup
    }
}

// Export for use
window.MultiplayerClient = MultiplayerClient;
window.RemotePlayer = RemotePlayer;
window.RemoteEnemy = RemoteEnemy;
