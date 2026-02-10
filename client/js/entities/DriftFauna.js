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

        // Apply knockback — with collision check to avoid pushing into walls/rocks
        if (knockbackDir) {
            const game = window.game;
            const cs = game && game.collisionSystem;
            const kx = knockbackDir.x * this.knockbackForce;
            const ky = knockbackDir.y * this.knockbackForce;
            if (cs) {
                if (!cs.checkCollision(this.position.x + kx, this.position.y, this.width, this.height)) {
                    this.position.x += kx;
                }
                if (!cs.checkCollision(this.position.x, this.position.y + ky, this.width, this.height)) {
                    this.position.y += ky;
                }
            } else {
                this.position.x += kx;
                this.position.y += ky;
            }
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

    // Render the enemy (uses world coordinates — RenderEngine handles camera/scale)
    render(renderer) {
        if (this.state === 'dissolved' && this.particles.length === 0) return;

        const x = Math.floor(this.position.x);
        const y = Math.floor(this.position.y);
        const w = this.width;
        const h = this.height;
        const self = this;

        // Add enemy to ENTITIES layer so it renders in-world correctly
        renderer.addToLayer(CONSTANTS.LAYER.ENTITIES, (ctx) => {
            ctx.save();
            ctx.globalAlpha = self.opacity;

            // Render based on AI type
            switch (self.aiType) {
                case 'skitter':
                    self.renderSkitter(ctx, x, y, w, h);
                    break;
                case 'haze':
                    self.renderHaze(ctx, x, y, w, h);
                    break;
                case 'loop':
                    self.renderLoopling(ctx, x, y, w, h);
                    break;
                default:
                    self.renderDefault(ctx, x, y, w, h);
            }

            // Render shadow
            ctx.globalAlpha = self.opacity * 0.2;
            ctx.fillStyle = '#000000';
            const shadowW = w * 0.8;
            const shadowH = 2;
            ctx.fillRect(
                x + (w - shadowW) / 2,
                y + h,
                shadowW, shadowH
            );

            ctx.globalAlpha = 1;

            // Health bar (only when damaged)
            if (self.shellIntegrity < self.maxShellIntegrity && self.state !== 'dying' && self.state !== 'dissolved') {
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

        // Render particles in EFFECTS layer
        if (this.particles.length > 0) {
            renderer.addToLayer(CONSTANTS.LAYER.EFFECTS, (ctx) => {
                for (const p of self.particles) {
                    const px = Math.floor(p.x);
                    const py = Math.floor(p.y);
                    const alpha = p.life / p.maxLife;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(px, py, p.size, p.size);
                }
                ctx.globalAlpha = 1;
            });
        }
    }

    renderSkitter(ctx, x, y, w, h) {
        // Animation frame for idle bob
        const bobFrame = Math.floor(this.pulseTimer / 400) % 3;
        const bobY = bobFrame === 1 ? -0.5 : 0;
        
        // Twitchy jitter when moving
        const jitterX = this.state === 'chasing' ? (Math.random() - 0.5) * 1 : 0;
        const jitterY = this.state === 'chasing' ? (Math.random() - 0.5) * 1 : 0;
        
        // Leg animation frame
        const legFrame = Math.floor(this.pulseTimer / 150) % 2;

        // Base position with adjustments
        const baseX = Math.floor(x + jitterX);
        const baseY = Math.floor(y + jitterY + bobY);

        // Color palette - sandy browns and oranges
        const darkBrown = this.renderColor === this.color ? '#8B4513' : this.renderColor;
        const medBrown = this.renderColor === this.color ? '#A0522D' : this.renderColor; 
        const lightBrown = this.renderColor === this.color ? '#CD853F' : this.renderColor;
        const shell = this.renderColor === this.color ? '#D2B48C' : this.renderColor;
        const eyeColor = '#FF4500';
        const clawColor = '#8B4513';

        // Sand flea/crab body (12x12)
        // Row 1-2: Top shell edge
        ctx.fillStyle = darkBrown;
        this.drawPixel(ctx, baseX + 3, baseY + 1, 6, 1);
        ctx.fillStyle = shell;
        this.drawPixel(ctx, baseX + 2, baseY + 2, 8, 1);

        // Row 3-4: Upper shell with eyes
        ctx.fillStyle = medBrown;
        this.drawPixel(ctx, baseX + 1, baseY + 3, 10, 1);
        ctx.fillStyle = lightBrown;
        this.drawPixel(ctx, baseX + 2, baseY + 3, 8, 1);
        
        // Eyes
        ctx.fillStyle = eyeColor;
        this.drawPixel(ctx, baseX + 3, baseY + 3, 1, 1);
        this.drawPixel(ctx, baseX + 8, baseY + 3, 1, 1);

        // Row 5-6: Main body
        ctx.fillStyle = medBrown;
        this.drawPixel(ctx, baseX + 1, baseY + 4, 10, 2);
        ctx.fillStyle = lightBrown;
        this.drawPixel(ctx, baseX + 3, baseY + 4, 6, 2);

        // Row 7-8: Lower body with segment lines
        ctx.fillStyle = medBrown;
        this.drawPixel(ctx, baseX + 2, baseY + 6, 8, 2);
        ctx.fillStyle = darkBrown;
        this.drawPixel(ctx, baseX + 5, baseY + 6, 2, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 7, 4, 1);

        // Row 9-10: Bottom edge
        ctx.fillStyle = darkBrown;
        this.drawPixel(ctx, baseX + 3, baseY + 8, 6, 2);

        // Animated legs extending from sides
        ctx.fillStyle = clawColor;
        if (this.isBursting || this.state === 'chasing') {
            // Moving legs - alternate positions
            if (legFrame === 0) {
                // Extended legs
                this.drawPixel(ctx, baseX - 1, baseY + 4, 1, 1); // Left front
                this.drawPixel(ctx, baseX - 1, baseY + 6, 1, 1); // Left back
                this.drawPixel(ctx, baseX + 12, baseY + 4, 1, 1); // Right front
                this.drawPixel(ctx, baseX + 12, baseY + 6, 1, 1); // Right back
            } else {
                // Retracted legs
                this.drawPixel(ctx, baseX, baseY + 5, 1, 1); // Left
                this.drawPixel(ctx, baseX + 11, baseY + 5, 1, 1); // Right
            }
        } else {
            // Idle legs
            this.drawPixel(ctx, baseX - 1, baseY + 5, 1, 1);
            this.drawPixel(ctx, baseX + 12, baseY + 5, 1, 1);
        }

        // Front claws when attacking
        if (this.state === 'attacking') {
            ctx.fillStyle = clawColor;
            this.drawPixel(ctx, baseX + 1, baseY + 2, 1, 1); // Left claw
            this.drawPixel(ctx, baseX + 10, baseY + 2, 1, 1); // Right claw
        }
    }

    renderHaze(ctx, x, y, w, h) {
        // Animation frames for floating jellyfish
        const floatFrame = Math.floor(this.pulseTimer / 600) % 3;
        const floatY = floatFrame === 1 ? -0.5 : floatFrame === 2 ? 0.5 : 0;
        const tentacleWave = Math.sin(this.pulseTimer * 0.005) * 1.5;
        
        // Pulsing opacity for ethereal effect
        const pulse = 0.6 + Math.sin(this.pulseTimer * 0.004) * 0.3;
        const origAlpha = ctx.globalAlpha;
        
        // Base position
        const baseX = Math.floor(x);
        const baseY = Math.floor(y + floatY);

        // Color palette - ocean blues and purples
        const darkBlue = this.renderColor === this.color ? '#191970' : this.renderColor;
        const medBlue = this.renderColor === this.color ? '#4169E1' : this.renderColor;
        const lightBlue = this.renderColor === this.color ? '#6495ED' : this.renderColor;
        const glowBlue = this.renderColor === this.color ? '#87CEEB' : this.renderColor;
        const tentacleBlue = this.renderColor === this.color ? '#4682B4' : this.renderColor;

        // Jellyfish bell (14x14) - dome shape
        ctx.globalAlpha = this.opacity * pulse * 0.8;
        
        // Row 1-3: Top of bell
        ctx.fillStyle = lightBlue;
        this.drawPixel(ctx, baseX + 5, baseY + 1, 4, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 2, 6, 1);
        this.drawPixel(ctx, baseX + 3, baseY + 3, 8, 1);

        // Row 4-6: Main bell body with inner detail
        ctx.fillStyle = medBlue;
        this.drawPixel(ctx, baseX + 2, baseY + 4, 10, 1);
        this.drawPixel(ctx, baseX + 1, baseY + 5, 12, 1);
        this.drawPixel(ctx, baseX + 1, baseY + 6, 12, 1);
        
        // Inner bell pattern - lighter core
        ctx.fillStyle = lightBlue;
        this.drawPixel(ctx, baseX + 4, baseY + 4, 6, 1);
        this.drawPixel(ctx, baseX + 3, baseY + 5, 8, 1);
        this.drawPixel(ctx, baseX + 3, baseY + 6, 8, 1);

        // Central glow
        ctx.globalAlpha = this.opacity * pulse;
        ctx.fillStyle = glowBlue;
        this.drawPixel(ctx, baseX + 6, baseY + 5, 2, 1);

        // Row 7-8: Bell edge
        ctx.globalAlpha = this.opacity * pulse * 0.7;
        ctx.fillStyle = medBlue;
        this.drawPixel(ctx, baseX + 2, baseY + 7, 10, 1);
        this.drawPixel(ctx, baseX + 3, baseY + 8, 8, 1);

        // Animated tentacles flowing beneath
        ctx.globalAlpha = this.opacity * pulse * 0.6;
        ctx.fillStyle = tentacleBlue;
        
        const tentacleOffset = Math.floor(tentacleWave);
        // Left tentacle
        this.drawPixel(ctx, baseX + 3 + tentacleOffset, baseY + 9, 1, 2);
        this.drawPixel(ctx, baseX + 2 + tentacleOffset, baseY + 11, 1, 1);
        
        // Center tentacles
        this.drawPixel(ctx, baseX + 6, baseY + 9, 2, 3);
        this.drawPixel(ctx, baseX + 6, baseY + 12, 1, 1);
        this.drawPixel(ctx, baseX + 7, baseY + 12, 1, 1);
        
        // Right tentacle
        this.drawPixel(ctx, baseX + 10 - tentacleOffset, baseY + 9, 1, 2);
        this.drawPixel(ctx, baseX + 11 - tentacleOffset, baseY + 11, 1, 1);

        // Outer glow effect - very translucent
        ctx.globalAlpha = this.opacity * pulse * 0.3;
        ctx.fillStyle = glowBlue;
        this.drawPixel(ctx, baseX, baseY + 4, 14, 3);
        this.drawPixel(ctx, baseX + 1, baseY + 2, 12, 5);

        // Floating particles around haze
        ctx.globalAlpha = this.opacity * pulse * 0.4;
        ctx.fillStyle = lightBlue;
        for (let i = 0; i < 3; i++) {
            const angle = (this.pulseTimer * 0.003) + (i * Math.PI * 2 / 3);
            const orbitR = 8;
            const particleX = baseX + 7 + Math.cos(angle) * orbitR;
            const particleY = baseY + 6 + Math.sin(angle) * orbitR * 0.5;
            this.drawPixel(ctx, Math.floor(particleX), Math.floor(particleY), 1, 1);
        }

        // Restore original alpha
        ctx.globalAlpha = origAlpha;
    }

    renderLoopling(ctx, x, y, w, h) {
        // Animation for spine rotation and pulsing
        const spineFrame = Math.floor(this.pulseTimer / 200) % 4;
        const pulseFrame = Math.floor(this.pulseTimer / 500) % 3;
        const pulseSize = pulseFrame === 1 ? 1 : 0;
        
        // Base position
        const baseX = Math.floor(x);
        const baseY = Math.floor(y);

        // Color palette - dark teals and cyans
        const darkTeal = this.renderColor === this.color ? '#2F4F4F' : this.renderColor;
        const medTeal = this.renderColor === this.color ? '#008B8B' : this.renderColor;
        const lightTeal = this.renderColor === this.color ? '#20B2AA' : this.renderColor;
        const brightTeal = this.renderColor === this.color ? '#40E0D0' : this.renderColor;
        const spineColor = this.renderColor === this.color ? '#00CED1' : this.renderColor;
        const eyeColor = '#FF6347';

        // Armored nautilus shell (16x16) - circular with segments
        // Outer spines (rotate around the body)
        ctx.fillStyle = spineColor;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI / 4) + (spineFrame * Math.PI / 8);
            const spineX = baseX + 8 + Math.cos(angle) * (6 + pulseSize);
            const spineY = baseY + 8 + Math.sin(angle) * (6 + pulseSize);
            this.drawPixel(ctx, Math.floor(spineX), Math.floor(spineY), 1, 1);
            
            // Longer spines on cardinal directions
            if (i % 2 === 0) {
                const longSpineX = baseX + 8 + Math.cos(angle) * (7 + pulseSize);
                const longSpineY = baseY + 8 + Math.sin(angle) * (7 + pulseSize);
                this.drawPixel(ctx, Math.floor(longSpineX), Math.floor(longSpineY), 1, 1);
            }
        }

        // Main shell body - circular armored segments
        // Row 1-3: Top shell
        ctx.fillStyle = darkTeal;
        this.drawPixel(ctx, baseX + 6, baseY + 1, 4, 1);
        this.drawPixel(ctx, baseX + 5, baseY + 2, 6, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 3, 8, 1);

        // Row 4-6: Upper shell with armor segments
        ctx.fillStyle = medTeal;
        this.drawPixel(ctx, baseX + 3, baseY + 4, 10, 1);
        this.drawPixel(ctx, baseX + 2, baseY + 5, 12, 1);
        this.drawPixel(ctx, baseX + 2, baseY + 6, 12, 1);
        
        // Armor segment lines
        ctx.fillStyle = lightTeal;
        this.drawPixel(ctx, baseX + 5, baseY + 4, 6, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 5, 8, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 6, 8, 1);

        // Row 7-10: Central body with eye
        ctx.fillStyle = medTeal;
        this.drawPixel(ctx, baseX + 1, baseY + 7, 14, 3);
        this.drawPixel(ctx, baseX + 2, baseY + 10, 12, 1);
        
        // Central chamber detail
        ctx.fillStyle = lightTeal;
        this.drawPixel(ctx, baseX + 3, baseY + 7, 10, 3);
        this.drawPixel(ctx, baseX + 4, baseY + 10, 8, 1);

        // Central eye
        ctx.fillStyle = eyeColor;
        this.drawPixel(ctx, baseX + 7, baseY + 8, 2, 2);
        ctx.fillStyle = darkTeal;
        this.drawPixel(ctx, baseX + 7, baseY + 8, 1, 1); // Eye pupil

        // Row 11-13: Lower shell segments
        ctx.fillStyle = medTeal;
        this.drawPixel(ctx, baseX + 3, baseY + 11, 10, 1);
        this.drawPixel(ctx, baseX + 4, baseY + 12, 8, 1);
        this.drawPixel(ctx, baseX + 5, baseY + 13, 6, 1);

        // Row 14-15: Bottom shell
        ctx.fillStyle = darkTeal;
        this.drawPixel(ctx, baseX + 6, baseY + 14, 4, 1);

        // Armor plate highlights
        ctx.fillStyle = brightTeal;
        this.drawPixel(ctx, baseX + 6, baseY + 5, 4, 1);
        this.drawPixel(ctx, baseX + 7, baseY + 7, 2, 1);
        this.drawPixel(ctx, baseX + 6, baseY + 11, 4, 1);

        // Charge indicator glow
        if (this.isCharging) {
            const origAlpha = ctx.globalAlpha;
            ctx.globalAlpha = this.opacity * 0.6;
            ctx.fillStyle = brightTeal;
            
            // Glowing aura around the whole body
            this.drawPixel(ctx, baseX + 1, baseY + 6, 14, 4);
            this.drawPixel(ctx, baseX + 3, baseY + 3, 10, 10);
            
            ctx.globalAlpha = origAlpha;
        }

        // Defensive spikes when hurt
        if (this.state === 'hurt') {
            ctx.fillStyle = brightTeal;
            this.drawPixel(ctx, baseX + 8, baseY - 1, 1, 1); // Top spike
            this.drawPixel(ctx, baseX - 1, baseY + 8, 1, 1); // Left spike
            this.drawPixel(ctx, baseX + 16, baseY + 8, 1, 1); // Right spike
            this.drawPixel(ctx, baseX + 8, baseY + 16, 1, 1); // Bottom spike
        }
    }

    renderDefault(ctx, x, y, w, h) {
        ctx.fillStyle = this.renderColor;
        ctx.fillRect(x, y, w, h);
    }

    // Helper method to draw individual pixels
    drawPixel(ctx, x, y, w, h) {
        ctx.fillRect(x, y, w, h);
    }

    isDead() {
        return this.state === 'dissolved' && this.particles.length === 0;
    }

    isAlive() {
        return this.state !== 'dying' && this.state !== 'dissolved';
    }
}
