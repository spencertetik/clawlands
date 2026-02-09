// CombatSystem.js - Combat manager for Clawlands
// Handles enemy spawning, player attacks, hit detection, screen shake, and Resolve choices

class CombatSystem {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.maxEnemies = 8;

        // Spawn settings
        this.spawnTimer = 0;
        this.spawnInterval = 4000; // ms between spawn checks
        this.spawnMargin = 200; // px outside camera to spawn
        this.despawnDistance = 600; // px from player to despawn
        this.spawnExclusionRadius = 120; // enemies never spawn closer than this to player

        // Player attack state
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 350; // ms between attacks
        this.attackDuration = 250; // ms visual duration (Zelda-like sweep)
        this.attackActiveFrame = false; // true during the hit-check frame
        this.attackAngle = 0; // current sweep angle for animation

        // Weapon data
        this.equippedWeapon = {
            name: 'Dock Wrench',
            damage: 10,
            range: 18,    // ~1 tile — must be right in front of you
            cooldown: 350,
            knockback: 8,
            swingArc: Math.PI * 0.7 // 126 degree swing
        };

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;

        // Combat state
        this.inCombat = false;
        this.lastCombatTime = 0;
        this.combatFadeTimer = 0; // For HUD fade

        // Resolve UI
        this.resolveUI = new ResolveUI(game);
        this.pendingResolve = null; // Enemy waiting for resolve choice

        // Release effect particles
        this.releaseParticles = [];

        // Attack slash visual
        this.slashParticles = [];

        // Damage numbers
        this.damageNumbers = [];

        // Track if this is first spawn (delay initial spawn)
        this.initialDelay = 5000; // 5 seconds before first enemies appear
        this.totalTime = 0;
        
        // Spawn protection after respawn
        this.spawnProtectionTimer = 0;
        this.spawnProtectionDuration = 4000; // 4 seconds of no spawns after respawn

        // Kill stats (persisted)
        this.statsKey = 'clawlands_combat_stats';
        this.stats = this.loadStats();
    }

    update(deltaTime) {
        try {
            const dt = deltaTime;
            const dtMs = dt * 1000;
            this.totalTime += dtMs;

            // Safety: bail if player doesn't exist
            if (!this.game || !this.game.player) return;

            // Don't update combat during resolve choice
            if (this.resolveUI && this.resolveUI.isVisible) {
                this.resolveUI.update(dt);
                return;
            }

            // Update attack cooldown
            this.attackTimer = Math.max(0, this.attackTimer - dtMs);

            // Handle player attack input
            if (this.game.inputManager && this.game.inputManager.isAttackPressed && this.game.inputManager.isAttackPressed()) {
                this.tryAttack();
            }

            // Update attack visual
            if (this.isAttacking) {
                this.attackDuration -= dtMs;
                if (this.attackDuration <= 0) {
                    this.isAttacking = false;
                    this.attackDuration = 200;
                }
            }

            // Update enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                if (!enemy) { this.enemies.splice(i, 1); continue; }

                // Skip if game is indoors
                if (this.game.currentLocation !== 'outdoor') {
                    this.enemies.splice(i, 1);
                    continue;
                }

                try {
                    enemy.update(dt, this.game.player, this.game.collisionSystem);
                } catch (enemyErr) {
                    console.warn('Enemy update error, removing:', enemyErr);
                    this.enemies.splice(i, 1);
                    continue;
                }

                // Check if enemy just died (transition to dissolved)
                if (enemy.state === 'dissolved' && (!enemy.particles || enemy.particles.length === 0)) {
                    // Don't remove if resolve UI is still showing for this enemy
                    if (this.pendingResolve === enemy && this.resolveUI && this.resolveUI.isVisible) {
                        continue; // Keep in array until player makes their choice
                    }
                    this.enemies.splice(i, 1);
                    continue;
                }

                // Show resolve UI when enemy starts dying
                if (enemy.state === 'dying' && enemy.dyingTimer < 50 && !this.pendingResolve) {
                    this.pendingResolve = enemy;
                    // Show resolve after a brief moment
                    const resolveEnemy = enemy;
                    setTimeout(() => {
                        try {
                            if (this.pendingResolve === resolveEnemy && this.resolveUI) {
                                this.resolveUI.show(resolveEnemy);
                            }
                        } catch (e) { console.warn('Resolve show error:', e); }
                    }, 300);
                }

                // Enemy attacks player
                if (enemy.state === 'attacking') {
                    // Damage is handled in DriftFauna.updateAttacking
                }

                // Despawn far enemies
                try {
                    const distToPlayer = enemy.distanceTo(this.game.player);
                    if (distToPlayer > this.despawnDistance && enemy.isAlive()) {
                        this.enemies.splice(i, 1);
                        continue;
                    }
                } catch (e) {
                    this.enemies.splice(i, 1);
                    continue;
                }
            }

            // Clear pending resolve when enemy is fully gone
            if (this.pendingResolve && (!this.resolveUI || !this.resolveUI.isVisible) &&
                (this.pendingResolve.state === 'dissolved' || !this.enemies.includes(this.pendingResolve))) {
                this.pendingResolve = null;
            }

            // Update spawn protection timer
            if (this.spawnProtectionTimer > 0) {
                this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dtMs);
            }

            // Spawn enemies (with initial delay and spawn protection)
            if (this.totalTime > this.initialDelay && this.game.currentLocation === 'outdoor' && this.spawnProtectionTimer <= 0) {
                this.spawnTimer += dtMs;
                if (this.spawnTimer >= this.spawnInterval) {
                    this.spawnTimer = 0;
                    this.trySpawnEnemies();
                }
            }

            // Update combat state
            this.updateCombatState();

            // Update screen shake
            this.updateScreenShake(dt);

            // Update visual effects
            this.updateEffects(dt);

            // Update damage numbers
            this.updateDamageNumbers(dt);

            // Check player death (only trigger once)
            if (this.game.player && this.game.player.isDead && this.game.player.isDead() && !this._deathTriggered) {
                this._deathTriggered = true;
                this.onPlayerDeath();
            }
            // Reset death trigger when player is alive again (after respawn)
            if (this.game.player && this.game.player.shellIntegrity > 0) {
                this._deathTriggered = false;
            }
        } catch (e) {
            console.error('CombatSystem.update error:', e);
        }
    }

    tryAttack() {
        if (this.attackTimer > 0 || this.isAttacking) return;
        if (this.resolveUI.isVisible) return;

        this.isAttacking = true;
        this.attackTimer = this.equippedWeapon.cooldown;
        this.attackDuration = 200;
        this.attackActiveFrame = true;

        // Play attack sound
        if (this.game.sfx) {
            this.game.sfx.play('dialog_advance'); // Reuse for now
        }

        // Create attack hitbox based on player direction
        const player = this.game.player;
        const weapon = this.equippedWeapon;
        const hitbox = this.getAttackHitbox(player, weapon);

        // Spawn slash visual
        this.spawnSlashEffect(player, hitbox);

        // Check hits against all enemies
        let hitAny = false;
        for (const enemy of this.enemies) {
            if (!enemy.isAlive()) continue;

            if (this.checkHitboxCollision(hitbox, enemy.getBounds())) {
                // Calculate knockback direction
                const dx = enemy.position.x - player.position.x;
                const dy = enemy.position.y - player.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const knockDir = { x: dx / dist, y: dy / dist };

                const hit = enemy.takeDamage(weapon.damage, knockDir);
                if (hit) {
                    hitAny = true;

                    // Spawn damage number
                    this.damageNumbers.push({
                        x: enemy.position.x + enemy.width / 2,
                        y: enemy.position.y - 5,
                        text: `-${weapon.damage}`,
                        life: 0.8,
                        vy: -30
                    });

                    // Small screen shake on hit
                    this.triggerShake(2, 100);
                }
            }
        }

        this.attackActiveFrame = false;
    }

    getAttackHitbox(player, weapon) {
        const px = player.position.x;
        const py = player.position.y;
        const pw = player.width;
        const ph = player.height;
        const range = weapon.range;
        const sweep = 12; // width of the sweep — tight, must face enemy

        switch (player.direction) {
            case CONSTANTS.DIRECTION.UP:
            case 'up':
                return { x: px - sweep / 2, y: py - range, width: pw + sweep, height: range };
            case CONSTANTS.DIRECTION.DOWN:
            case 'down':
                return { x: px - sweep / 2, y: py + ph, width: pw + sweep, height: range };
            case CONSTANTS.DIRECTION.LEFT:
            case 'left':
                return { x: px - range, y: py - sweep / 3, width: range, height: ph + sweep * 0.66 };
            case CONSTANTS.DIRECTION.RIGHT:
            case 'right':
                return { x: px + pw, y: py - sweep / 3, width: range, height: ph + sweep * 0.66 };
            default:
                return { x: px - sweep / 2, y: py + ph, width: pw + sweep, height: range };
        }
    }

    checkHitboxCollision(a, b) {
        return !(a.x + a.width < b.x ||
                a.x > b.x + b.width ||
                a.y + a.height < b.y ||
                a.y > b.y + b.height);
    }

    trySpawnEnemies() {
        if (this.enemies.length >= this.maxEnemies) return;

        const player = this.game.player;
        const cam = this.game.camera;

        // Get camera bounds
        const camLeft = cam.position.x;
        const camTop = cam.position.y;
        const camRight = camLeft + (CONSTANTS.VIEWPORT_WIDTH || 160);
        const camBottom = camTop + (CONSTANTS.VIEWPORT_HEIGHT || 128);

        // Determine spawn type based on player location
        const spawnTable = this.getSpawnTableForPosition(player.position.x, player.position.y);
        if (!spawnTable || spawnTable.length === 0) return;

        // Pick enemy type by weight
        const totalWeight = spawnTable.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * totalWeight;
        let chosenType = null;
        for (const entry of spawnTable) {
            roll -= entry.weight;
            if (roll <= 0) {
                chosenType = DRIFT_FAUNA_TYPES[entry.type];
                break;
            }
        }
        if (!chosenType) return;

        // Determine group size
        const [minGroup, maxGroup] = chosenType.spawnGroup;
        const groupSize = Math.min(
            minGroup + Math.floor(Math.random() * (maxGroup - minGroup + 1)),
            this.maxEnemies - this.enemies.length
        );

        // Find spawn position: on land, outside camera but nearby on the island
        for (let g = 0; g < groupSize; g++) {
            let spawnX, spawnY;
            let attempts = 0;
            let valid = false;

            while (attempts < 40 && !valid) {
                attempts++;

                // Strategy: pick random land tile within spawn range of player
                // Use a wider search radius (300-600px from player) to find land
                const angle = Math.random() * Math.PI * 2;
                const dist = this.spawnExclusionRadius + Math.random() * 400; // 120-520px from player
                spawnX = player.position.x + Math.cos(angle) * dist;
                spawnY = player.position.y + Math.sin(angle) * dist;

                // Check if spawn position is on land
                if (this.game.worldMap) {
                    const tileCol = Math.floor(spawnX / CONSTANTS.TILE_SIZE);
                    const tileRow = Math.floor(spawnY / CONSTANTS.TILE_SIZE);
                    const tile = this.game.worldMap.getTile(this.game.worldMap.groundLayer, tileCol, tileRow);

                    // tile 0 = water, 1 = shore, 2 = coast, 3+ = land (sand/grass)
                    if (tile !== null && tile >= 3) {
                        // Make sure it's not inside the camera view (spawn off-screen)
                        const inCamera = spawnX >= camLeft && spawnX <= camRight &&
                                         spawnY >= camTop && spawnY <= camBottom;
                        if (!inCamera) {
                            valid = true;
                        } else if (attempts > 20) {
                            // After 20 failed attempts, allow on-screen spawns too
                            // (better to have enemies than none at all)
                            valid = true;
                        }
                    }
                }
            }

            if (valid) {
                const enemy = new DriftFauna(spawnX, spawnY, chosenType);
                // Offset group members slightly
                if (g > 0) {
                    enemy.position.x += (Math.random() - 0.5) * 30;
                    enemy.position.y += (Math.random() - 0.5) * 30;
                }
                this.enemies.push(enemy);
            }
        }
    }

    getSpawnTableForPosition(x, y) {
        // Try to determine which island the player is on
        if (this.game.worldMap && this.game.worldMap.islands) {
            const islands = this.game.worldMap.islands;
            let closestIsland = 0;
            let closestDist = Infinity;

            for (let i = 0; i < islands.length; i++) {
                const island = islands[i];
                const ix = island.x * CONSTANTS.TILE_SIZE;
                const iy = island.y * CONSTANTS.TILE_SIZE;
                const dx = x - ix;
                const dy = y - iy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestIsland = i;
                }
            }

            return DRIFT_FAUNA_SPAWN_TABLE[closestIsland] || DRIFT_FAUNA_SPAWN_TABLE.default;
        }

        return DRIFT_FAUNA_SPAWN_TABLE.default;
    }

    updateCombatState() {
        const player = this.game.player;
        let nearbyEnemy = false;

        for (const enemy of this.enemies) {
            if (enemy.isAlive() && enemy.distanceTo(player) < enemy.aggroRange) {
                nearbyEnemy = true;
                break;
            }
        }

        if (nearbyEnemy) {
            this.inCombat = true;
            this.lastCombatTime = Date.now();
            this.combatFadeTimer = 5000; // Stay visible for 5s after combat
        } else if (this.inCombat) {
            this.combatFadeTimer -= 16; // rough frame time
            if (this.combatFadeTimer <= 0) {
                this.inCombat = false;
            }
        }

        // Update player combat state for regen
        if (this.game.player.lastCombatTime !== undefined) {
            if (nearbyEnemy) {
                this.game.player.lastCombatTime = Date.now();
            }
        }
    }

    triggerShake(intensity, durationMs) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, durationMs);
        this.shakeTimer = 0;
    }

    updateScreenShake(dt) {
        if (this.shakeDuration > 0) {
            this.shakeTimer += dt * 1000;
            if (this.shakeTimer >= this.shakeDuration) {
                this.shakeDuration = 0;
                this.shakeIntensity = 0;
                this.shakeOffsetX = 0;
                this.shakeOffsetY = 0;
            } else {
                const decay = 1 - (this.shakeTimer / this.shakeDuration);
                this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
                this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
            }
        }
    }

    spawnSlashEffect(player, hitbox) {
        const cx = player.position.x + player.width / 2;
        const cy = player.position.y + player.height / 2;
        const range = this.equippedWeapon.range;
        const dir = player.direction;

        // Base angle for each direction
        let baseAngle;
        switch (dir) {
            case 'up': baseAngle = -Math.PI / 2; break;
            case 'down': baseAngle = Math.PI / 2; break;
            case 'left': baseAngle = Math.PI; break;
            case 'right': baseAngle = 0; break;
            default: baseAngle = Math.PI / 2;
        }

        // Spawn arc trail particles along the swing path
        const arcSpread = this.equippedWeapon.swingArc;
        for (let i = 0; i < 10; i++) {
            const t = i / 9;
            const angle = baseAngle - arcSpread / 2 + arcSpread * t;
            const dist = range * (0.6 + Math.random() * 0.4);
            this.slashParticles.push({
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                vx: Math.cos(angle) * 15,
                vy: Math.sin(angle) * 15,
                life: 0.15 + t * 0.1,
                maxLife: 0.25,
                size: 2 + Math.random(),
                color: '#ffffff'
            });
        }

        // Store swing data for the arc animation
        this.swingData = {
            cx, cy, baseAngle, arcSpread, range,
            startTime: this.attackDuration
        };
    }

    spawnReleaseEffect(x, y) {
        // Red particles flowing upward
        for (let i = 0; i < 15; i++) {
            this.releaseParticles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 15,
                vy: -30 - Math.random() * 40,
                life: 1.0 + Math.random() * 0.5,
                maxLife: 1.5,
                size: 1 + Math.random() * 3,
                color: Math.random() > 0.5 ? '#cc4444' : '#ff6666'
            });
        }
    }

    updateEffects(dt) {
        // Slash particles
        for (let i = this.slashParticles.length - 1; i >= 0; i--) {
            const p = this.slashParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.slashParticles.splice(i, 1);
        }

        // Release particles
        for (let i = this.releaseParticles.length - 1; i >= 0; i--) {
            const p = this.releaseParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 5 * dt; // Slight upward acceleration
            p.life -= dt;
            if (p.life <= 0) this.releaseParticles.splice(i, 1);
        }
    }

    updateDamageNumbers(dt) {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.y += dn.vy * dt;
            dn.life -= dt;
            if (dn.life <= 0) this.damageNumbers.splice(i, 1);
        }
    }

    onPlayerDeath() {
        // Clear all enemies
        this.enemies = [];
        this.pendingResolve = null;
        if (this.resolveUI.isVisible) {
            this.resolveUI.hide();
        }

        // Spawn protection after respawn
        this.spawnProtectionTimer = this.spawnProtectionDuration;

        // Trigger drift reset (DriftReset handles shell integrity restoration)
        if (this.game.driftReset) {
            this.game.driftReset.trigger('combat');
        }
    }

    render(renderer) {
        if (!renderer) return;
        
        // Render enemies (they add themselves to ENTITIES layer)
        for (const enemy of this.enemies) {
            try {
                if (enemy) enemy.render(renderer);
            } catch (e) { console.warn('Enemy render error:', e); }
        }

        const self = this;

        // Render world-space effects (slash, particles, damage numbers) in EFFECTS layer
        renderer.addToLayer(CONSTANTS.LAYER.EFFECTS, (ctx) => {
            // Apply screen shake offset (in world pixels)
            if (self.shakeOffsetX !== 0 || self.shakeOffsetY !== 0) {
                ctx.save();
                ctx.translate(self.shakeOffsetX, self.shakeOffsetY);
            }

            // Attack slash visual
            if (self.isAttacking) {
                self.renderAttackSlash(ctx);
            }

            // Slash particles (world space)
            self.renderWorldParticles(ctx, self.slashParticles);

            // Release particles (world space)
            self.renderWorldParticles(ctx, self.releaseParticles);

            // Damage numbers (world space)
            self.renderDamageNumbers(ctx);

            if (self.shakeOffsetX !== 0 || self.shakeOffsetY !== 0) {
                ctx.restore();
            }
        });

        // Render combat HUD + Resolve UI (screen-space, drawn AFTER renderer.render)
        // Store reference so Game.js can call renderHUD after renderer.render()
        this._needsHUDRender = true;
    }

    // Called by Game.js AFTER renderer.render() for screen-space HUD
    renderHUD() {
        if (!this._needsHUDRender) return;
        this._needsHUDRender = false;

        try {
            const ctx = this.game.canvas.getContext('2d');
            if (!ctx) return;
            this.renderCombatHUD(ctx);
            if (this.resolveUI) this.resolveUI.render(ctx);
        } catch (e) {
            console.warn('CombatSystem.renderHUD error:', e);
        }
    }

    renderAttackSlash(ctx) {
        if (!this.swingData) return;

        const sd = this.swingData;
        const progress = 1 - (this.attackDuration / 250);
        const sweepProgress = Math.min(progress * 1.5, 1);
        const fadeOut = progress > 0.6 ? 1 - ((progress - 0.6) / 0.4) : 1;

        // World coordinates — RenderEngine handles camera/scale
        const cx = sd.cx;
        const cy = sd.cy;
        const radius = sd.range;

        ctx.save();

        const startA = sd.baseAngle - sd.arcSpread / 2;
        const currentA = startA + sd.arcSpread * sweepProgress;

        // Wide outer glow arc
        ctx.globalAlpha = fadeOut * 0.4;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.9, startA, currentA);
        ctx.stroke();

        // Main slash arc (thicker)
        ctx.globalAlpha = fadeOut * 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.85, startA, currentA);
        ctx.stroke();

        // Inner bright arc for extra pop
        ctx.globalAlpha = fadeOut * 0.5;
        ctx.strokeStyle = '#ccddff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.78, startA, currentA);
        ctx.stroke();

        // Leading edge (bigger)
        if (sweepProgress < 1) {
            const tipX = cx + Math.cos(currentA) * radius * 0.85;
            const tipY = cy + Math.sin(currentA) * radius * 0.85;
            // Glow behind tip
            ctx.globalAlpha = fadeOut * 0.4;
            ctx.fillStyle = '#88ccff';
            ctx.beginPath();
            ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
            ctx.fill();
            // Bright tip
            ctx.globalAlpha = fadeOut;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pixel sword along the sweep arc (2px wide pixels)
        ctx.globalAlpha = fadeOut;
        const swordAngle = currentA;
        const swordBaseR = radius * 0.35;
        const pixelSize = 2;
        const swordPixels = [
            { offset: 0, color: '#665544' },  // handle (brown)
            { offset: 1, color: '#887766' },
            { offset: 2, color: '#aaaaaa' },  // blade body
            { offset: 3, color: '#cccccc' },
            { offset: 4, color: '#dddddd' },
            { offset: 5, color: '#eeeeff' },
            { offset: 6, color: '#ffffff' },  // tip (bright white)
        ];
        for (const sp of swordPixels) {
            const r = swordBaseR + sp.offset * pixelSize;
            const px = cx + Math.cos(swordAngle) * r;
            const py = cy + Math.sin(swordAngle) * r;
            ctx.fillStyle = sp.color;
            ctx.fillRect(Math.floor(px), Math.floor(py), pixelSize, pixelSize);
        }

        ctx.restore();
    }

    renderWorldParticles(ctx, particles) {
        for (const p of particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    renderDamageNumbers(ctx) {
        for (const dn of this.damageNumbers) {
            const alpha = Math.max(0, dn.life / 0.8);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ff4444';
            ctx.font = '4px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(dn.text, dn.x, dn.y);
            // Outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.5;
            ctx.strokeText(dn.text, dn.x, dn.y);
            ctx.fillText(dn.text, dn.x, dn.y);
        }
        ctx.globalAlpha = 1;
    }

    renderCombatHUD(ctx) {
        const player = this.game.player;
        if (!player.shellIntegrity && player.shellIntegrity !== 0) return;
        if (!this.game.gameActive) return;

        ctx.save();

        // --- REDESIGNED HUD (top-left) ---
        // Cleaner, more readable — no weapon name, bigger text, clear labels
        const boxX = 8;
        const boxY = 8;
        const boxWidth = 160;
        const pad = 6;

        // Calculate layout heights
        let y = boxY + pad;
        
        // Row 1: Health bar (simple horizontal bar, not shell icons)
        const healthBarY = y;
        y += 16; // health bar + label
        y += 4;  // gap
        
        // Row 2: Brine Tokens
        const tokenY = y;
        y += 14;
        y += 4; // gap
        
        // Row 3: Continuity tier + bar
        const contY = y;
        y += 18;
        y += pad;
        
        const boxHeight = y - boxY;

        // Dark background with rounded feel
        ctx.fillStyle = 'rgba(13, 8, 6, 0.88)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = '#5a3028';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // --- HEALTH BAR ---
        const healthPct = player.shellIntegrity / player.shellIntegrityMax;
        const isHit = player.isInvulnerable && !player.spawnProtectionActive;
        const flashOn = isHit && Math.floor(Date.now() / 80) % 2 === 0;
        
        // Health bar background
        const barX = boxX + pad;
        const barW = boxWidth - pad * 2;
        const barH = 8;
        const barY = healthBarY + 2;
        
        ctx.fillStyle = '#1a0e0a';
        ctx.fillRect(barX, barY, barW, barH);
        
        // Health bar fill — color changes with health level
        let barColor;
        if (flashOn) barColor = '#ff4444';
        else if (healthPct > 0.6) barColor = '#44aa44';
        else if (healthPct > 0.3) barColor = '#ccaa33';
        else barColor = '#cc3333';
        
        ctx.fillStyle = barColor;
        ctx.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * healthPct), barH - 2);
        
        // Border
        ctx.strokeStyle = '#5a3028';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, barH);
        
        // Health text (right-aligned percentage or fraction)
        const shellVal = Math.ceil(player.shellIntegrity);
        const shellMax = player.shellIntegrityMax;
        ctx.fillStyle = '#e8d5cc';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${shellVal}/${shellMax}`, barX + barW, barY + barH + 10);
        
        // "Shell" label (left-aligned)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#8a7068';
        ctx.fillText('Shell', barX, barY + barH + 10);

        // --- BRINE TOKENS ---
        if (this.game.currencySystem) {
            const tokens = this.game.currencySystem.getDisplayTokens();
            ctx.fillStyle = '#8a7068';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Brine', barX, tokenY + 9);
            
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(tokens, barX + barW, tokenY + 9);
        }

        // --- CONTINUITY ---
        let contValue = 0;
        let contTier = 'unmoored';
        if (this.game.continuitySystem) {
            contValue = this.game.continuitySystem.value || 0;
            contTier = this.game.continuitySystem.getTier ? this.game.continuitySystem.getTier() : 'unmoored';
        }

        const tierColors = {
            unmoored: '#888888',
            drifting: '#4a9eff',
            settling: '#4ade80',
            established: '#f59e0b',
            anchored: '#c43a24'
        };
        const contColor = tierColors[contTier] || '#888888';

        // Tier label
        ctx.fillStyle = contColor;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(contTier.charAt(0).toUpperCase() + contTier.slice(1), barX, contY + 8);
        
        // Continuity percentage
        ctx.fillStyle = '#e8d5cc';
        ctx.textAlign = 'right';
        ctx.fillText(Math.floor(contValue) + '%', barX + barW, contY + 8);

        // Continuity bar
        const contBarY = contY + 11;
        const contBarH = 4;
        ctx.fillStyle = '#1a0e0a';
        ctx.fillRect(barX, contBarY, barW, contBarH);
        ctx.fillStyle = contColor;
        ctx.fillRect(barX + 1, contBarY + 1, Math.max(0, (barW - 2) * (contValue / 100)), contBarH - 2);

        ctx.restore();
    }

    // Draw a single shell health icon with quarter-fill state
    // quarters: 0 = empty, 1 = 1/4, 2 = 1/2, 3 = 3/4, 4 = full
    drawShellIcon(ctx, x, y, size, quarters, flash) {
        const s = size;
        ctx.save();

        // Shell outline (always drawn)
        const outlineColor = quarters === 0 ? '#3a2520' : '#8a7068';
        ctx.fillStyle = outlineColor;
        // Rounded shell shape: wider at bottom, narrow at top
        ctx.fillRect(x + 2, y, s - 4, s);       // body
        ctx.fillRect(x + 1, y + 2, s - 2, s - 3); // wider middle
        ctx.fillRect(x, y + 3, s, s - 5);         // widest part

        if (quarters === 0) {
            // Empty shell — dark interior
            ctx.fillStyle = '#1a0e0a';
            ctx.fillRect(x + 3, y + 1, s - 6, s - 2);
            ctx.fillRect(x + 2, y + 3, s - 4, s - 5);
            ctx.fillRect(x + 1, y + 4, s - 2, s - 7);
        } else {
            // Determine fill color based on health level
            let fillColor = '#c43a24'; // red/low
            if (quarters >= 4) fillColor = flash ? '#ff6666' : '#44aa44'; // full = green
            else if (quarters >= 3) fillColor = flash ? '#ff6666' : '#66bb44'; // 3/4 = green-ish
            else if (quarters >= 2) fillColor = flash ? '#ff6666' : '#cc8833'; // 1/2 = yellow
            else fillColor = flash ? '#ff6666' : '#cc3333'; // 1/4 = red

            // Fill interior proportionally (bottom-up fill)
            const interiorH = s - 3;
            const fillH = Math.ceil(interiorH * (quarters / 4));
            const fillStartY = y + 1 + (interiorH - fillH);

            ctx.fillStyle = fillColor;
            // Fill the interior region (clipped to shell shape)
            for (let row = fillStartY; row < y + s - 1; row++) {
                let lx = x + 3, rw = s - 6; // narrow
                if (row >= y + 3 && row < y + s - 3) { lx = x + 1; rw = s - 2; } // widest
                else if (row >= y + 2) { lx = x + 2; rw = s - 4; } // medium
                ctx.fillRect(lx, row, rw, 1);
            }

            // Shell ridge lines (decorative)
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + 3, y + Math.floor(s * 0.3), s - 6, 1);
            ctx.fillRect(x + 2, y + Math.floor(s * 0.6), s - 4, 1);
        }

        ctx.restore();
    }

    // Get enemy count for debug/stats
    getEnemyCount() {
        return this.enemies.filter(e => e.isAlive()).length;
    }

    // Track a kill (tokens awarded via ResolveUI based on player's choice)
    recordKill(enemyType) {
        this.stats.totalKills = (this.stats.totalKills || 0) + 1;
        this.stats.killsByType = this.stats.killsByType || {};
        this.stats.killsByType[enemyType] = (this.stats.killsByType[enemyType] || 0) + 1;
        this.saveStats();
    }

    // Load combat stats from localStorage
    loadStats() {
        try {
            const saved = localStorage.getItem(this.statsKey);
            return saved ? JSON.parse(saved) : { totalKills: 0, killsByType: {} };
        } catch (e) {
            return { totalKills: 0, killsByType: {} };
        }
    }

    // Save combat stats to localStorage
    saveStats() {
        try {
            localStorage.setItem(this.statsKey, JSON.stringify(this.stats));
        } catch (e) {
            console.warn('Failed to save combat stats:', e);
        }
    }

    // Pixel art drawing functions
    drawShieldIcon(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#8a7068';
        // Shield outline
        ctx.fillRect(x+1, y, 6, 8);
        ctx.fillRect(x, y+1, 8, 6);
        ctx.fillRect(x+1, y+7, 6, 1);
        
        ctx.fillStyle = '#e8d5cc';
        // Shield inner
        ctx.fillRect(x+2, y+1, 4, 5);
        ctx.fillRect(x+1, y+2, 6, 3);
        
        ctx.fillStyle = '#c43a24';
        // Shield highlight
        ctx.fillRect(x+3, y+2, 2, 2);
        ctx.restore();
    }

    drawSwordIcon(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#8a7068';
        // Sword handle
        ctx.fillRect(x+3, y+6, 2, 3);
        ctx.fillRect(x+2, y+9, 4, 1);
        
        // Sword blade
        ctx.fillRect(x+4, y, 1, 7);
        ctx.fillRect(x+3, y+1, 3, 1);
        
        ctx.fillStyle = '#e8d5cc';
        // Sword highlight
        ctx.fillRect(x+4, y+1, 1, 5);
        ctx.restore();
    }

    drawCoinIcon(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#8a7068';
        // Coin outline
        ctx.fillRect(x+1, y, 6, 8);
        ctx.fillRect(x, y+1, 8, 6);
        
        ctx.fillStyle = '#f5c542';
        // Coin interior
        ctx.fillRect(x+1, y+1, 6, 6);
        ctx.fillRect(x+2, y, 4, 8);
        
        ctx.fillStyle = '#8a7068';
        // Coin center mark
        ctx.fillRect(x+3, y+2, 2, 4);
        ctx.restore();
    }
}
