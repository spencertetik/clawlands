// CombatSystem.js - Combat manager for Claw World
// Handles enemy spawning, player attacks, hit detection, screen shake, and Resolve choices

class CombatSystem {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.maxEnemies = 8;

        // Spawn settings
        this.spawnTimer = 0;
        this.spawnInterval = 3000; // ms between spawn checks
        this.spawnMargin = 200; // px outside camera to spawn
        this.despawnDistance = 400; // px from player to despawn

        // Player attack state
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 400; // ms
        this.attackDuration = 200; // ms visual duration
        this.attackActiveFrame = false; // true during the hit-check frame

        // Weapon data
        this.equippedWeapon = {
            name: 'Dock Wrench',
            damage: 10,
            range: 24,
            cooldown: 400,
            knockback: 8,
            swingArc: Math.PI / 2 // 90 degree swing
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

        // Spawn enemies
        if (this.totalTime > this.initialDelay && this.game.currentLocation === 'outdoor') {
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

        // Check player death
        if (this.game.player.isDead && this.game.player.isDead()) {
            this.onPlayerDeath();
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
        const hitSize = 20; // hitbox width/height

        switch (player.direction) {
            case CONSTANTS.DIRECTION.UP:
            case 'up':
                return { x: px - hitSize / 4, y: py - range, width: pw + hitSize / 2, height: range };
            case CONSTANTS.DIRECTION.DOWN:
            case 'down':
                return { x: px - hitSize / 4, y: py + ph, width: pw + hitSize / 2, height: range };
            case CONSTANTS.DIRECTION.LEFT:
            case 'left':
                return { x: px - range, y: py, width: range, height: ph };
            case CONSTANTS.DIRECTION.RIGHT:
            case 'right':
                return { x: px + pw, y: py, width: range, height: ph };
            default:
                return { x: px, y: py + ph, width: pw, height: range };
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

        // Find spawn position: outside camera but within margin
        for (let g = 0; g < groupSize; g++) {
            let spawnX, spawnY;
            let attempts = 0;
            let valid = false;

            while (attempts < 20 && !valid) {
                attempts++;

                // Pick a side to spawn from
                const side = Math.floor(Math.random() * 4);
                const margin = this.spawnMargin;

                switch (side) {
                    case 0: // Top
                        spawnX = camLeft + Math.random() * (camRight - camLeft);
                        spawnY = camTop - margin * Math.random();
                        break;
                    case 1: // Bottom
                        spawnX = camLeft + Math.random() * (camRight - camLeft);
                        spawnY = camBottom + margin * Math.random();
                        break;
                    case 2: // Left
                        spawnX = camLeft - margin * Math.random();
                        spawnY = camTop + Math.random() * (camBottom - camTop);
                        break;
                    case 3: // Right
                        spawnX = camRight + margin * Math.random();
                        spawnY = camTop + Math.random() * (camBottom - camTop);
                        break;
                }

                // Check if spawn position is on land
                if (this.game.worldMap) {
                    const tileCol = Math.floor(spawnX / CONSTANTS.TILE_SIZE);
                    const tileRow = Math.floor(spawnY / CONSTANTS.TILE_SIZE);
                    const tile = this.game.worldMap.getTile(tileCol, tileRow);

                    // tile 0 = water, 1 = shore, 2+ = land (sand/grass)
                    if (tile >= 3) {
                        valid = true;
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
        const cx = hitbox.x + hitbox.width / 2;
        const cy = hitbox.y + hitbox.height / 2;

        // Spawn arc particles
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            this.slashParticles.push({
                x: cx + (Math.random() - 0.5) * 10,
                y: cy + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.15 + Math.random() * 0.1,
                maxLife: 0.25,
                size: 1 + Math.random() * 2,
                color: '#ffffff'
            });
        }
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

        // Trigger drift reset
        if (this.game.driftReset) {
            this.game.driftReset.trigger();
        }

        // Reset player shell integrity after reset
        setTimeout(() => {
            if (this.game.player) {
                this.game.player.shellIntegrity = this.game.player.shellIntegrityMax;
            }
        }, 2000);
    }

    render(renderer) {
        const ctx = renderer.ctx;
        const cam = renderer.camera || this.game.camera;
        const scale = CONSTANTS.DISPLAY_SCALE || 4;

        // Apply screen shake offset
        if (this.shakeOffsetX !== 0 || this.shakeOffsetY !== 0) {
            ctx.save();
            ctx.translate(this.shakeOffsetX * scale, this.shakeOffsetY * scale);
        }

        // Render enemies
        for (const enemy of this.enemies) {
            enemy.render(renderer);
        }

        // Render attack slash visual
        if (this.isAttacking) {
            this.renderAttackSlash(ctx, cam, scale);
        }

        // Render slash particles
        this.renderParticles(ctx, cam, scale, this.slashParticles);

        // Render release particles
        this.renderParticles(ctx, cam, scale, this.releaseParticles);

        // Render damage numbers
        this.renderDamageNumbers(ctx, cam, scale);

        // Restore from shake
        if (this.shakeOffsetX !== 0 || this.shakeOffsetY !== 0) {
            ctx.restore();
        }

        // Render combat HUD (not affected by shake)
        this.renderCombatHUD(ctx);

        // Render resolve UI on top of everything
        this.resolveUI.render(ctx);
    }

    renderAttackSlash(ctx, cam, scale) {
        const player = this.game.player;
        const hitbox = this.getAttackHitbox(player, this.equippedWeapon);

        const screenX = (hitbox.x - cam.position.x) * scale;
        const screenY = (hitbox.y - cam.position.y) * scale;
        const w = hitbox.width * scale;
        const h = hitbox.height * scale;

        // Animated slash arc
        const progress = 1 - (this.attackDuration / 200);
        ctx.save();
        ctx.globalAlpha = 0.6 * (1 - progress);

        // White slash line
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const cx = screenX + w / 2;
        const cy = screenY + h / 2;
        const radius = Math.max(w, h) * 0.6;

        let startAngle, endAngle;
        switch (player.direction) {
            case 'up':
                startAngle = Math.PI + Math.PI / 4;
                endAngle = Math.PI * 2 - Math.PI / 4;
                break;
            case 'down':
                startAngle = Math.PI / 4;
                endAngle = Math.PI - Math.PI / 4;
                break;
            case 'left':
                startAngle = Math.PI / 2 + Math.PI / 4;
                endAngle = Math.PI + Math.PI / 4;
                break;
            case 'right':
                startAngle = -Math.PI / 4;
                endAngle = Math.PI / 2 - Math.PI / 4;
                break;
            default:
                startAngle = 0;
                endAngle = Math.PI;
        }

        // Animate arc sweep
        const currentEnd = startAngle + (endAngle - startAngle) * Math.min(progress * 2, 1);
        ctx.arc(cx, cy, radius, startAngle, currentEnd);
        ctx.stroke();

        ctx.restore();
    }

    renderParticles(ctx, cam, scale, particles) {
        for (const p of particles) {
            const px = (p.x - cam.position.x) * scale;
            const py = (p.y - cam.position.y) * scale;
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(px, py, p.size * scale, p.size * scale);
        }
        ctx.globalAlpha = 1;
    }

    renderDamageNumbers(ctx, cam, scale) {
        for (const dn of this.damageNumbers) {
            const px = (dn.x - cam.position.x) * scale;
            const py = (dn.y - cam.position.y) * scale;
            const alpha = Math.max(0, dn.life / 0.8);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(dn.text, px, py);

            // Outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(dn.text, px, py);
            ctx.fillText(dn.text, px, py); // Redraw fill on top of stroke
        }
        ctx.globalAlpha = 1;
    }

    renderCombatHUD(ctx) {
        const player = this.game.player;
        if (!player.shellIntegrity && player.shellIntegrity !== 0) return;

        // Only show HUD when in combat or recently in combat, or when damaged
        const showHUD = this.inCombat || this.combatFadeTimer > 0 ||
                        player.shellIntegrity < player.shellIntegrityMax;
        if (!showHUD) return;

        // Calculate fade
        let hudAlpha = 1;
        if (!this.inCombat && this.combatFadeTimer > 0 && this.combatFadeTimer < 2000) {
            hudAlpha = this.combatFadeTimer / 2000;
        }

        const canvas = this.game.canvas;
        const scale = CONSTANTS.DISPLAY_SCALE || 4;

        ctx.save();
        ctx.globalAlpha = hudAlpha;

        // Shell Integrity bar — top left
        const barX = 10;
        const barY = 10;
        const barWidth = 120;
        const barHeight = 14;
        const healthPct = player.shellIntegrity / player.shellIntegrityMax;

        // Background
        ctx.fillStyle = '#1a0a06';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill — color changes based on health
        let barColor = '#cc3333';
        if (healthPct > 0.6) barColor = '#cc5533';
        if (healthPct > 0.3 && healthPct <= 0.6) barColor = '#cc8833';
        if (healthPct <= 0.3) barColor = '#cc2222';

        // Flash when recently damaged
        if (player.isInvulnerable) {
            barColor = Math.floor(Date.now() / 80) % 2 === 0 ? '#ff6666' : barColor;
        }

        ctx.fillStyle = barColor;
        ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * healthPct, barHeight - 2);

        // Border
        ctx.strokeStyle = '#8a4030';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Text
        ctx.fillStyle = '#e8d5cc';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            `🛡️ ${Math.ceil(player.shellIntegrity)}/${player.shellIntegrityMax}`,
            barX + barWidth / 2,
            barY + barHeight - 3
        );

        // Weapon name
        ctx.fillStyle = '#8a7068';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`⚔ ${this.equippedWeapon.name}`, barX, barY + barHeight + 12);

        ctx.restore();
    }

    // Get enemy count for debug/stats
    getEnemyCount() {
        return this.enemies.filter(e => e.isAlive()).length;
    }
}
