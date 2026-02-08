// DriftFauna.js - Base enemy class for Drift Fauna creatures
// Fragments of dissolved minds compressed into instinct

class DriftFauna extends Entity {
    constructor(x, y, typeData) {
        super(x, y, typeData.size, typeData.size);

        // Copy type data
        this.typeData = typeData;
        this.name = typeData.name;
        this.shellIntegrity = typeData.shellIntegrity;
        this.maxShellIntegrity = typeData.shellIntegrity;
        this.damage = typeData.damage;
        this.speed = typeData.speed;
        this.color = typeData.color;
        this.flashColor = typeData.flashColor || '#ffffff';
        this.aggroRange = typeData.aggroRange;
        this.deaggroRange = typeData.deaggroRange || typeData.aggroRange * 1.5;
        this.attackRange = typeData.attackRange;
        this.attackCooldown = typeData.attackCooldown;
        this.knockbackForce = typeData.knockback || 8;
        this.aiType = typeData.aiType || 'skitter';
        this.loot = typeData.loot || [];

        // State machine
        this.state = 'idle'; // idle, wandering, chasing, attacking, hurt, dying, dissolved
        this.stateTimer = 0;

        // Combat timers
        this.attackTimer = 0;
        this.hurtTimer = 0;
        this.hurtDuration = 200;  // ms of hurt flash
        this.dyingTimer = 0;
        this.dyingDuration = 600; // ms of death animation
        this.flashCount = 0;

        // Wandering AI
        this.wanderTarget = null;
        this.wanderTimer = Math.random() * 2000;
        this.wanderInterval = 1500 + Math.random() * 2000;
        this.homePosition = { x, y };
        this.wanderRadius = 64;

        // Skitter-specific: burst movement
        this.burstTimer = 0;
        this.burstDuration = 300;
        this.burstPause = 500 + Math.random() * 500;
        this.isBursting = false;

        // Haze-specific: sinusoidal drift
        this.hazeOffset = Math.random() * Math.PI * 2;
        this.hazeAmplitude = 20;
        this.hazeFrequency = 0.002;

        // Loopling-specific: pattern movement
        this.loopPatternIndex = 0;
        this.loopPatternTimer = 0;
        this.loopPattern = this.generateLoopPattern();
        this.isCharging = false;
        this.chargeDirection = null;

        // Visual effects
        this.opacity = 1;
        this.renderColor = this.color;
        this.pulseTimer = Math.random() * 1000;

        // Particle effects on death
        this.particles = [];
    }

    // Generate a movement pattern for Looplings
    generateLoopPattern() {
        const patterns = [
            // Square pattern
            [
                { dx: 1, dy: 0, duration: 400 },
                { dx: 0, dy: 1, duration: 400 },
                { dx: -1, dy: 0, duration: 400 },
                { dx: 0, dy: -1, duration: 400 }
            ],
            // Triangle pattern
            [
                { dx: 1, dy: 0, duration: 500 },
                { dx: -0.5, dy: 1, duration: 500 },
                { dx: -0.5, dy: -1, duration: 500 }
            ],
            // Figure-8 ish
            [
                { dx: 1, dy: 0.5, duration: 350 },
                { dx: 0, dy: -1, duration: 350 },
                { dx: -1, dy: 0.5, duration: 350 },
                { dx: 0, dy: -1, duration: 350 }
            ]
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    update(deltaTime, player, collisionSystem) {
        if (this.state === 'dissolved') return;

        const dt = deltaTime; // deltaTime is already in seconds

        // Update timers
        this.attackTimer = Math.max(0, this.attackTimer - dt * 1000);
        this.pulseTimer += dt * 1000;

        // Update particles
        this.updateParticles(dt);

        // State machine
        switch (this.state) {
            case 'idle':
            case 'wandering':
                this.updateWandering(dt, player, collisionSystem);
                break;
            case 'chasing':
                this.updateChasing(dt, player, collisionSystem);
                break;
            case 'attacking':
                this.updateAttacking(dt, player);
                break;
            case 'hurt':
                this.updateHurt(dt);
                break;
            case 'dying':
                this.updateDying(dt);
                break;
        }
    }

    updateWandering(dt, player, collisionSystem) {
        // Check if player is in aggro range
        const distToPlayer = this.distanceTo(player);
        if (distToPlayer < this.aggroRange) {
            this.state = 'chasing';
            return;
        }

        // AI-specific wandering
        switch (this.aiType) {
            case 'skitter':
                this.updateSkitterWander(dt, collisionSystem);
                break;
            case 'haze':
                this.updateHazeWander(dt, collisionSystem);
                break;
            case 'loop':
                this.updateLoopWander(dt, collisionSystem);
                break;
        }
    }

    updateSkitterWander(dt, collisionSystem) {
        this.burstTimer += dt * 1000;

        if (this.isBursting) {
            if (this.burstTimer >= this.burstDuration) {
                this.isBursting = false;
                this.burstTimer = 0;
                this.velocity.set(0, 0);
            } else {
                // Move in burst direction
                this.applyMovement(dt, collisionSystem);
            }
        } else {
            if (this.burstTimer >= this.burstPause) {
                // Start new burst
                this.isBursting = true;
                this.burstTimer = 0;
                const angle = Math.random() * Math.PI * 2;
                this.velocity.x = Math.cos(angle) * this.speed;
                this.velocity.y = Math.sin(angle) * this.speed;
                // Add jitter
                this.position.x += (Math.random() - 0.5) * 2;
                this.position.y += (Math.random() - 0.5) * 2;
            }
        }
    }

    updateHazeWander(dt, collisionSystem) {
        // Slow sinusoidal drift
        const time = this.pulseTimer;
        const driftX = Math.sin(time * this.hazeFrequency + this.hazeOffset) * this.speed * 0.3;
        const driftY = Math.cos(time * this.hazeFrequency * 0.7 + this.hazeOffset) * this.speed * 0.3;
        this.velocity.x = driftX;
        this.velocity.y = driftY;
        this.applyMovement(dt, collisionSystem);
    }

    updateLoopWander(dt, collisionSystem) {
        this.loopPatternTimer += dt * 1000;
        const step = this.loopPattern[this.loopPatternIndex];

        if (this.loopPatternTimer >= step.duration) {
            this.loopPatternTimer = 0;
            this.loopPatternIndex = (this.loopPatternIndex + 1) % this.loopPattern.length;
        }

        this.velocity.x = step.dx * this.speed;
        this.velocity.y = step.dy * this.speed;
        this.applyMovement(dt, collisionSystem);
    }

    updateChasing(dt, player, collisionSystem) {
        const distToPlayer = this.distanceTo(player);

        // Deaggro check
        if (distToPlayer > this.deaggroRange) {
            this.state = 'wandering';
            this.velocity.set(0, 0);
            return;
        }

        // In attack range?
        if (distToPlayer < this.attackRange && this.attackTimer <= 0) {
            this.state = 'attacking';
            this.stateTimer = 0;
            return;
        }

        // Move toward player with AI-specific behavior
        const dx = player.position.x - this.position.x;
        const dy = player.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        let moveSpeed = this.speed;

        switch (this.aiType) {
            case 'skitter':
                // Burst-chase: fast short dashes
                this.burstTimer += dt * 1000;
                if (!this.isBursting && this.burstTimer > 200) {
                    this.isBursting = true;
                    this.burstTimer = 0;
                    moveSpeed = this.speed * 1.5;
                } else if (this.isBursting && this.burstTimer > 150) {
                    this.isBursting = false;
                    this.burstTimer = 0;
                    moveSpeed = 0;
                }
                break;

            case 'haze':
                // Sinusoidal approach
                const wobble = Math.sin(this.pulseTimer * 0.003) * 30;
                this.velocity.x = (dx / dist) * moveSpeed + Math.cos(wobble) * 10;
                this.velocity.y = (dy / dist) * moveSpeed + Math.sin(wobble) * 10;
                this.applyMovement(dt, collisionSystem);
                return;

            case 'loop':
                // Charge in straight line if close enough
                if (distToPlayer < this.aggroRange * 0.6 && !this.isCharging) {
                    this.isCharging = true;
                    this.chargeDirection = { x: dx / dist, y: dy / dist };
                }
                if (this.isCharging) {
                    moveSpeed = this.speed * 2;
                    this.velocity.x = this.chargeDirection.x * moveSpeed;
                    this.velocity.y = this.chargeDirection.y * moveSpeed;
                    this.applyMovement(dt, collisionSystem);
                    // End charge after passing attack range or 500ms
                    this.stateTimer += dt * 1000;
                    if (this.stateTimer > 500) {
                        this.isCharging = false;
                        this.stateTimer = 0;
                    }
                    return;
                }
                break;
        }

        this.velocity.x = (dx / dist) * moveSpeed;
        this.velocity.y = (dy / dist) * moveSpeed;
        this.applyMovement(dt, collisionSystem);
    }

    updateAttacking(dt, player) {
        this.stateTimer += dt * 1000;

        // Attack windup (200ms) then deal damage
        if (this.stateTimer >= 200 && this.stateTimer < 250) {
            // Deal damage to player
            const distToPlayer = this.distanceTo(player);
            if (distToPlayer < this.attackRange * 1.5) {
                if (player.takeDamage) {
                    player.takeDamage(this.damage, this);
                }
            }
        }

        // Return to chase after attack animation
        if (this.stateTimer >= 400) {
            this.attackTimer = this.attackCooldown;
            this.state = 'chasing';
            this.stateTimer = 0;
            this.isCharging = false;
        }
    }

    updateHurt(dt) {
        this.hurtTimer += dt * 1000;

        // Flash effect
        if (this.hurtTimer < this.hurtDuration) {
            this.renderColor = Math.floor(this.hurtTimer / 50) % 2 === 0 ? '#ffffff' : this.flashColor;
        } else {
            this.renderColor = this.color;
            this.state = this.shellIntegrity > 0 ? 'chasing' : 'dying';
            if (this.state === 'dying') {
                this.dyingTimer = 0;
                this.flashCount = 0;
            }
        }
    }

    updateDying(dt) {
        this.dyingTimer += dt * 1000;

        // Flash white 3 times
        if (this.dyingTimer < 400) {
            const flashPhase = Math.floor(this.dyingTimer / 65);
            this.renderColor = flashPhase % 2 === 0 ? '#ffffff' : this.color;
            this.opacity = 1;
        }
        // Fade out
        else if (this.dyingTimer < this.dyingDuration) {
            this.opacity = 1 - ((this.dyingTimer - 400) / (this.dyingDuration - 400));
            this.renderColor = this.color;

            // Spawn dissolve particles
            if (Math.random() < 0.3) {
                this.particles.push({
                    x: this.position.x + Math.random() * this.width,
                    y: this.position.y + Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 40,
                    vy: -Math.random() * 30 - 10,
                    life: 0.5 + Math.random() * 0.3,
                    maxLife: 0.8,
                    size: 1 + Math.random() * 2,
                    color: this.flashColor
                });
            }
        }
        // Done dying
        else {
            this.state = 'dissolved';
            this.opacity = 0;
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 20 * dt; // slight upward drift
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // Take damage from player attack
    takeDamage(amount, knockbackDir) {
        if (this.state === 'dying' || this.state === 'dissolved' || this.state === 'hurt') return false;

        this.shellIntegrity = Math.max(0, this.shellIntegrity - amount);
        this.state = 'hurt';
        this.hurtTimer = 0;
        this.renderColor = '#ffffff';

        // Apply knockback
        if (knockbackDir) {
            this.position.x += knockbackDir.x * this.knockbackForce;
            this.position.y += knockbackDir.y * this.knockbackForce;
        }

        // Spawn hit particles
        for (let i = 0; i < 4; i++) {
            this.particles.push({
                x: this.position.x + this.width / 2,
                y: this.position.y + this.height / 2,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.4,
                size: 1 + Math.random() * 2,
                color: '#ffffff'
            });
        }

        return true;
    }

    // Apply velocity movement with basic bounds checking
    applyMovement(dt, collisionSystem) {
        const newX = this.position.x + this.velocity.x * dt;
        const newY = this.position.y + this.velocity.y * dt;

        // Basic collision check — enemies avoid water/buildings
        if (collisionSystem) {
            const canMoveX = !collisionSystem.checkCollision(newX, this.position.y, this.width, this.height);
            const canMoveY = !collisionSystem.checkCollision(this.position.x, newY, this.width, this.height);

            if (canMoveX) this.position.x = newX;
            if (canMoveY) this.position.y = newY;

            // If stuck, reverse direction
            if (!canMoveX && !canMoveY) {
                this.velocity.x *= -1;
                this.velocity.y *= -1;
            }
        } else {
            this.position.x = newX;
            this.position.y = newY;
        }
    }

    // Distance to another entity
    distanceTo(entity) {
        const dx = entity.position.x + entity.width / 2 - (this.position.x + this.width / 2);
        const dy = entity.position.y + entity.height / 2 - (this.position.y + this.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Render the enemy
    render(renderer) {
        if (this.state === 'dissolved' && this.particles.length === 0) return;

        const cam = renderer.camera;
        const screenX = (this.position.x - cam.position.x) * (CONSTANTS.DISPLAY_SCALE || 1);
        const screenY = (this.position.y - cam.position.y) * (CONSTANTS.DISPLAY_SCALE || 1);
        const scale = CONSTANTS.DISPLAY_SCALE || 1;
        const ctx = renderer.ctx;

        // Don't render if off-screen
        if (screenX < -50 || screenX > renderer.canvas.width + 50 ||
            screenY < -50 || screenY > renderer.canvas.height + 50) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Render based on AI type
        switch (this.aiType) {
            case 'skitter':
                this.renderSkitter(ctx, screenX, screenY, scale);
                break;
            case 'haze':
                this.renderHaze(ctx, screenX, screenY, scale);
                break;
            case 'loop':
                this.renderLoopling(ctx, screenX, screenY, scale);
                break;
            default:
                this.renderDefault(ctx, screenX, screenY, scale);
        }

        // Render shadow
        ctx.globalAlpha = this.opacity * 0.2;
        ctx.fillStyle = '#000000';
        const shadowW = this.width * scale * 0.8;
        const shadowH = 3 * scale;
        ctx.fillRect(
            screenX + (this.width * scale - shadowW) / 2,
            screenY + this.height * scale,
            shadowW, shadowH
        );

        ctx.globalAlpha = 1;

        // Health bar (only when damaged)
        if (this.shellIntegrity < this.maxShellIntegrity && this.state !== 'dying' && this.state !== 'dissolved') {
            const barWidth = this.width * scale + 4;
            const barHeight = 3 * scale;
            const barX = screenX - 2;
            const barY = screenY - 6 * scale;
            const healthPct = this.shellIntegrity / this.maxShellIntegrity;

            // Background
            ctx.fillStyle = '#1a0000';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            // Health fill
            ctx.fillStyle = healthPct > 0.5 ? '#cc3333' : healthPct > 0.25 ? '#cc6600' : '#cc0000';
            ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);
            // Border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        ctx.restore();

        // Render particles (always, even after dissolved)
        this.renderParticles(ctx, cam, scale);
    }

    renderSkitter(ctx, x, y, scale) {
        const w = this.width * scale;
        const h = this.height * scale;

        // Twitchy jitter when moving
        const jitterX = this.state === 'chasing' ? (Math.random() - 0.5) * 2 * scale : 0;
        const jitterY = this.state === 'chasing' ? (Math.random() - 0.5) * 2 * scale : 0;

        // Body (small dark red rectangle)
        ctx.fillStyle = this.renderColor;
        ctx.fillRect(x + jitterX, y + jitterY, w, h);

        // Eyes (two tiny white dots)
        ctx.fillStyle = '#ff6666';
        const eyeSize = Math.max(1, 2 * scale);
        ctx.fillRect(x + jitterX + w * 0.2, y + jitterY + h * 0.2, eyeSize, eyeSize);
        ctx.fillRect(x + jitterX + w * 0.6, y + jitterY + h * 0.2, eyeSize, eyeSize);

        // Legs (tiny lines on sides when moving)
        if (this.isBursting || this.state === 'chasing') {
            ctx.fillStyle = this.renderColor;
            const legOffset = Math.floor(this.pulseTimer / 100) % 2 === 0 ? 0 : scale;
            ctx.fillRect(x + jitterX - scale, y + jitterY + h * 0.3 + legOffset, scale, scale);
            ctx.fillRect(x + jitterX + w, y + jitterY + h * 0.3 + legOffset, scale, scale);
            ctx.fillRect(x + jitterX - scale, y + jitterY + h * 0.7 - legOffset, scale, scale);
            ctx.fillRect(x + jitterX + w, y + jitterY + h * 0.7 - legOffset, scale, scale);
        }
    }

    renderHaze(ctx, x, y, scale) {
        const w = this.width * scale;
        const h = this.height * scale;

        // Pulsing opacity
        const pulse = 0.4 + Math.sin(this.pulseTimer * 0.004) * 0.2;
        ctx.globalAlpha = this.opacity * pulse;

        // Outer glow
        ctx.fillStyle = this.renderColor === this.color ? '#b42828' : this.renderColor;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Inner core (brighter)
        ctx.globalAlpha = this.opacity * (pulse + 0.2);
        ctx.fillStyle = this.renderColor === this.color ? '#dd4444' : this.renderColor;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Wisps (small dots orbiting)
        ctx.globalAlpha = this.opacity * pulse * 0.6;
        ctx.fillStyle = '#ff8888';
        for (let i = 0; i < 3; i++) {
            const angle = (this.pulseTimer * 0.002) + (i * Math.PI * 2 / 3);
            const orbitR = w * 0.5;
            const wx = x + w / 2 + Math.cos(angle) * orbitR;
            const wy = y + h / 2 + Math.sin(angle) * orbitR;
            ctx.fillRect(wx, wy, scale, scale);
        }
    }

    renderLoopling(ctx, x, y, scale) {
        const w = this.width * scale;
        const h = this.height * scale;

        // Color cycling
        const colors = ['#4a2080', '#6030a0', '#8040c0'];
        const colorIdx = Math.floor(this.pulseTimer / 300) % colors.length;
        const baseColor = this.renderColor === this.color ? colors[colorIdx] : this.renderColor;

        // Geometric diamond shape
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);           // top
        ctx.lineTo(x + w, y + h / 2);       // right
        ctx.lineTo(x + w / 2, y + h);       // bottom
        ctx.lineTo(x, y + h / 2);           // left
        ctx.closePath();
        ctx.fill();

        // Inner diamond (lighter)
        ctx.fillStyle = this.renderColor === this.color ? '#aa66ff' : this.renderColor;
        const inset = w * 0.25;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + inset);
        ctx.lineTo(x + w - inset, y + h / 2);
        ctx.lineTo(x + w / 2, y + h - inset);
        ctx.lineTo(x + inset, y + h / 2);
        ctx.closePath();
        ctx.fill();

        // Charge indicator (glow when charging)
        if (this.isCharging) {
            ctx.globalAlpha = this.opacity * 0.4;
            ctx.fillStyle = '#ff44ff';
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h / 2, w * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderDefault(ctx, x, y, scale) {
        ctx.fillStyle = this.renderColor;
        ctx.fillRect(x, y, this.width * scale, this.height * scale);
    }

    renderParticles(ctx, cam, scale) {
        for (const p of this.particles) {
            const px = (p.x - cam.position.x) * scale;
            const py = (p.y - cam.position.y) * scale;
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(px, py, p.size * scale, p.size * scale);
        }
        ctx.globalAlpha = 1;
    }

    isDead() {
        return this.state === 'dissolved' && this.particles.length === 0;
    }

    isAlive() {
        return this.state !== 'dying' && this.state !== 'dissolved';
    }
}
