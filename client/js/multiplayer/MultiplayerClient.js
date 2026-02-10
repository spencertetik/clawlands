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
                // Add existing players
                if (msg.players) {
                    msg.players.forEach(p => {
                        if (p.id !== this.playerId) {
                            this.addRemotePlayer(p);
                        }
                    });
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
        
        console.log(`🎮 Joining multiplayer as: ${charName} (${species}, ${color})`);
        console.log(`   characterConfig:`, config);
        
        this.send({
            type: 'join',
            name: charName,
            species: species,
            color: color,
            x: player.position.x,
            y: player.position.y
        });
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
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
    }

    render(ctx, camera) {
        // Debug: log render count occasionally
        if (!this._renderLogCount) this._renderLogCount = 0;
        if (this._renderLogCount < 3 && this.remotePlayers.size > 0) {
            console.log(`🎨 Rendering ${this.remotePlayers.size} remote players`);
            this._renderLogCount++;
        }
        
        // Render all remote players
        this.remotePlayers.forEach(player => {
            player.render(ctx, camera);
        });
    }

    disconnect() {
        this.stopPositionSync();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.remotePlayers.clear();
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
        
        // Sprites for each direction (will be hue-shifted)
        this.sprites = {};
        this.rawSprites = {}; // Original unshifted sprites
        this.spritesReady = false;
        this.currentSprite = null;
        this.animFrame = 0;
        this.animTimer = 0;
        
        this.speechText = null;
        this.speechTimer = 0;
        
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
        this.targetPosition = { x, y };
        // Map direction names
        if (direction) {
            const dirMap = { 'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east' };
            this.direction = dirMap[direction] || direction;
        }
        this.isMoving = isMoving;
        
        // If this player is being spectated, snap position immediately for real-time feel
        if (this._spectated) {
            this.position.x = x;
            this.position.y = y;
        }
    }

    showSpeech(text) {
        this.speechText = text;
        this.speechTimer = 4000; // Show for 4 seconds
    }

    update(deltaTime) {
        // Interpolate toward target position for smooth movement
        // Spectated players snap instantly (position already set in updatePosition)
        if (!this._spectated) {
            const speed = 0.2;
            this.position.x += (this.targetPosition.x - this.position.x) * speed;
            this.position.y += (this.targetPosition.y - this.position.y) * speed;
        }
        
        // Animation
        if (this.isMoving) {
            this.animTimer += deltaTime;
            if (this.animTimer > 150) {
                this.animFrame = (this.animFrame + 1) % 3;
                this.animTimer = 0;
            }
        } else {
            this.animFrame = 0;
        }
        
        // Speech timer
        if (this.speechTimer > 0) {
            this.speechTimer -= deltaTime;
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

    destroy() {
        // Cleanup
        this.sprite = null;
    }
}

// Export for use
window.MultiplayerClient = MultiplayerClient;
window.RemotePlayer = RemotePlayer;
