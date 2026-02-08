// CombatSystem.js - Combat manager for Claw World
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
        this.statsKey = 'clawworld_combat_stats';
        this.stats = this.loadStats();
    }

    update(deltaTime) {
        const dt = deltaTime;
        const dtMs = dt * 1000;
        this.totalTime += dtMs;

        // Don't update combat during resolve choice
        if (this.resolveUI.isVisible) {
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

            // Skip if game is indoors
            if (this.game.currentLocation !== 'outdoor') {
                this.enemies.splice(i, 1);
                continue;
            }

            enemy.update(dt, this.game.player, this.game.collisionSystem);

            // Check if enemy just died (transition to dissolved)
            if (enemy.state === 'dissolved' && enemy.particles.length === 0) {
                // Check if this enemy needs resolve choice
                if (this.pendingResolve === enemy) {
                    // Already shown
                }
                this.enemies.splice(i, 1);
                continue;
            }

            // Show resolve UI when enemy starts dying
            if (enemy.state === 'dying' && enemy.dyingTimer < 50 && !this.pendingResolve) {
                this.pendingResolve = enemy;
                // Show resolve after a brief moment
                setTimeout(() => {
                    if (this.pendingResolve === enemy) {
                        this.resolveUI.show(enemy);
                    }
                }, 300);
            }

            // Enemy attacks player
            if (enemy.state === 'attacking') {
                // Damage is handled in DriftFauna.updateAttacking
            }

            // Despawn far enemies
            const distToPlayer = enemy.distanceTo(this.game.player);
            if (distToPlayer > this.despawnDistance && enemy.isAlive()) {
                this.enemies.splice(i, 1);
                continue;
            }
        }

        // Clear pending resolve when enemy is fully gone
        if (this.pendingResolve && !this.resolveUI.isVisible &&
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
        if (this.game.player.isDead && this.game.player.isDead() && !this._deathTriggered) {
            this._deathTriggered = true;
            this.onPlayerDeath();
        }
        // Reset death trigger when player is alive again (after respawn)
        if (this.game.player.shellIntegrity > 0) {
            this._deathTriggered = false;
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
        // Render enemies (they add themselves to ENTITIES layer)
        for (const enemy of this.enemies) {
            enemy.render(renderer);
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

        const ctx = this.game.canvas.getContext('2d');
        this.renderCombatHUD(ctx);
        this.resolveUI.render(ctx);
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

        // Outer glow arc
        ctx.globalAlpha = fadeOut * 0.3;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.9, startA, currentA);
        ctx.stroke();

        // Main slash arc
        ctx.globalAlpha = fadeOut * 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.85, startA, currentA);
        ctx.stroke();

        // Leading edge
        if (sweepProgress < 1) {
            const tipX = cx + Math.cos(currentA) * radius * 0.85;
            const tipY = cy + Math.sin(currentA) * radius * 0.85;
            ctx.globalAlpha = fadeOut;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2);
            ctx.fill();
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

        const canvas = this.game.canvas;
        const scale = CONSTANTS.DISPLAY_SCALE || 4;

        ctx.save();

        // --- ALWAYS-VISIBLE HEALTH BAR (Zelda-style, top-left) ---
        const barX = 8;
        const barY = 8;
        const barWidth = 140;
        const barHeight = 18;
        const healthPct = player.shellIntegrity / player.shellIntegrityMax;

        // Background with slight transparency
        ctx.fillStyle = 'rgba(13, 8, 6, 0.85)';
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 22);

        // Health fill — color changes based on health
        let barColor = '#cc5533';
        if (healthPct > 0.6) barColor = '#44aa44';
        if (healthPct > 0.3 && healthPct <= 0.6) barColor = '#cc8833';
        if (healthPct <= 0.3) barColor = '#cc2222';

        // Flash when recently damaged
        if (player.isInvulnerable && !player.spawnProtectionActive) {
            barColor = Math.floor(Date.now() / 80) % 2 === 0 ? '#ff6666' : barColor;
        }

        // Bar background
        ctx.fillStyle = '#2a1510';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        ctx.fillStyle = barColor;
        ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * healthPct, barHeight - 2);

        // Border
        ctx.strokeStyle = '#8a4030';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Health text
        ctx.fillStyle = '#e8d5cc';
        // Draw pixel shield icon
        this.drawShieldIcon(ctx, barX + 4, barY + barHeight - 12);
        
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.ceil(player.shellIntegrity)} / ${player.shellIntegrityMax}`,
            barX + barWidth / 2 + 6,
            barY + barHeight - 4
        );

        // Weapon name with pixel sword icon
        this.drawSwordIcon(ctx, barX, barY + barHeight + 8);
        
        ctx.fillStyle = '#8a7068';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.equippedWeapon.name, barX + 12, barY + barHeight + 12);

        // Brine Tokens (below weapon name, left side)
        if (this.game.currencySystem) {
            const tokens = this.game.currencySystem.getDisplayTokens();
            
            // Draw pixel coin icon
            this.drawCoinIcon(ctx, barX, barY + barHeight + 20);
            
            ctx.fillStyle = '#f5c542';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(tokens, barX + 12, barY + barHeight + 24);
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
