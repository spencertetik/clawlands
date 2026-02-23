const { DRIFT_FAUNA_TYPES } = require('../../client/js/data/DriftFaunaData.js');

const PLAYER_WIDTH = 16;
const PLAYER_HEIGHT = 24;
const WEAPON_RANGE = 18;
const WEAPON_SWEEP = 12;
const DEFAULT_WEAPON_DAMAGE = 10;
const MIN_BUILDING_DISTANCE = 100;
const MIN_PLAYER_DISTANCE = 96;
const ENEMY_MOVE_EPSILON = 2;

class EnemyManager {
    constructor(options = {}) {
        this.players = options.players || (typeof options.getPlayers === 'function' ? options.getPlayers() : new Map());
        this.broadcast = options.broadcast || (() => { });
        this.collisionSystem = options.collisionSystem || { checkCollision: () => false };
        this.terrainData = options.terrainData;
        this.buildings = options.buildings || [];
        this.worldWidth = options.worldWidth || 3200;
        this.worldHeight = options.worldHeight || 3200;
        this.maxEnemies = options.maxEnemies || 3;
        this.spawnIntervalMs = options.spawnIntervalMs || 15000;
        this.tickRateMs = options.tickRateMs || 400;
        this.weaponDamage = options.weaponDamage || DEFAULT_WEAPON_DAMAGE;
        this.speedMultiplier = options.speedMultiplier || 1;

        this.enemies = new Map();
        this.nextEnemyId = 1;
        this._tickHandle = null;
        this._lastSpawnAt = 0;
    }

    start() {
        if (this._tickHandle) return;
        this._lastSpawnAt = Date.now();
        this._tickHandle = setInterval(() => this.tick(), this.tickRateMs);
    }

    stop() {
        if (this._tickHandle) {
            clearInterval(this._tickHandle);
            this._tickHandle = null;
        }
    }

    tick() {
        const now = Date.now();
        if (this.enemies.size < this.maxEnemies && now - this._lastSpawnAt >= this.spawnIntervalMs) {
            if (this.spawnEnemy()) {
                this._lastSpawnAt = now;
            }
        }
        this.updateEnemies(this.tickRateMs / 1000, now);
    }

    spawnEnemy() {
        const keys = Object.keys(DRIFT_FAUNA_TYPES);
        const typeKey = keys[Math.floor(Math.random() * keys.length)];
        const typeData = DRIFT_FAUNA_TYPES[typeKey];
        if (!typeData) return false;

        const spawnPos = this.findSpawnPosition(typeData);
        if (!spawnPos) return false;

        const enemy = {
            id: `enemy_${this.nextEnemyId++}`,
            type: typeKey,
            data: typeData,
            x: spawnPos.x,
            y: spawnPos.y,
            width: typeData.size,
            height: typeData.size,
            health: typeData.shellIntegrity,
            maxHealth: typeData.shellIntegrity,
            heading: Math.random() * Math.PI * 2,
            wanderTimer: 0,
            targetPlayerId: null,
            state: 'wandering',
            lastBroadcastX: spawnPos.x,
            lastBroadcastY: spawnPos.y,
            nextAttackTime: 0
        };

        this.enemies.set(enemy.id, enemy);
        const serialized = this.serializeEnemy(enemy);
        this.broadcast({
            type: 'enemy_spawn',
            enemies: [serialized]
        });
        return true;
    }

    serializeEnemy(enemy) {
        const shellIntegrity = Math.max(0, Math.round(enemy.health));
        const maxShellIntegrity = enemy.maxHealth;
        return {
            id: enemy.id,
            type: enemy.type,
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
            width: enemy.width,
            height: enemy.height,
            name: enemy.data?.name,
            health: shellIntegrity,
            maxHealth: maxShellIntegrity,
            shellIntegrity,
            maxShellIntegrity,
            state: enemy.state
        };
    }

    findSpawnPosition(typeData) {
        const players = this.getActivePlayers();
        const base = players.length > 0
            ? players[Math.floor(Math.random() * players.length)]
            : { x: this.worldWidth / 2, y: this.worldHeight / 2 };

        for (let attempt = 0; attempt < 40; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = MIN_PLAYER_DISTANCE + 100 + Math.random() * 250;
            const x = this.clamp(base.x + Math.cos(angle) * dist, typeData.size, this.worldWidth - typeData.size);
            const y = this.clamp(base.y + Math.sin(angle) * dist, typeData.size, this.worldHeight - typeData.size);

            if (!this.isValidSpawn(x, y, typeData)) continue;
            return { x: Math.round(x), y: Math.round(y) };
        }
        return null;
    }

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    isValidSpawn(x, y, typeData) {
        // Must be on walkable terrain
        if (this.collisionSystem.checkCollision(x, y, typeData.size, typeData.size)) {
            return false;
        }

        // Avoid buildings / safe zones
        for (const building of this.buildings) {
            const dist = this.distanceRectToPoint(building, x + typeData.size / 2, y + typeData.size / 2);
            if (dist < MIN_BUILDING_DISTANCE) {
                return false;
            }
        }

        // Avoid clustering on other enemies
        for (const enemy of this.enemies.values()) {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            if (dx * dx + dy * dy < 60 * 60) {
                return false;
            }
        }

        return true;
    }

    distanceRectToPoint(rect, px, py) {
        const nearestX = Math.max(rect.x, Math.min(px, rect.x + rect.width));
        const nearestY = Math.max(rect.y, Math.min(py, rect.y + rect.height));
        const dx = px - nearestX;
        const dy = py - nearestY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateEnemies(dtSeconds, now = Date.now()) {
        const moveEnemies = [];
        for (const enemy of this.enemies.values()) {
            const target = this.findNearestPlayer(enemy);
            if (target) {
                enemy.state = 'chasing';
                enemy.targetPlayerId = target.id;
                enemy.heading = Math.atan2((target.y + PLAYER_HEIGHT / 2) - (enemy.y + enemy.height / 2), (target.x + PLAYER_WIDTH / 2) - (enemy.x + enemy.width / 2));
                this.tryDamagePlayer(enemy, target, now);
            } else {
                enemy.state = 'wandering';
                enemy.targetPlayerId = null;
                enemy.wanderTimer -= dtSeconds;
                if (enemy.wanderTimer <= 0) {
                    enemy.heading = Math.random() * Math.PI * 2;
                    enemy.wanderTimer = 1.5 + Math.random() * 2.5;
                }
            }

            const speed = (enemy.state === 'chasing' ? enemy.data.speed : enemy.data.speed * 0.6) * this.speedMultiplier;
            const distance = speed * dtSeconds;
            if (distance <= 0.1) continue;

            const newX = enemy.x + Math.cos(enemy.heading) * distance;
            const newY = enemy.y + Math.sin(enemy.heading) * distance;

            if (!this.collisionSystem.checkCollision(newX, enemy.y, enemy.width, enemy.height)) {
                enemy.x = newX;
            } else {
                enemy.heading = Math.random() * Math.PI * 2;
            }

            if (!this.collisionSystem.checkCollision(enemy.x, newY, enemy.width, enemy.height)) {
                enemy.y = newY;
            } else {
                enemy.heading = Math.random() * Math.PI * 2;
            }

            if (Math.abs(enemy.x - enemy.lastBroadcastX) > ENEMY_MOVE_EPSILON || Math.abs(enemy.y - enemy.lastBroadcastY) > ENEMY_MOVE_EPSILON) {
                enemy.lastBroadcastX = enemy.x;
                enemy.lastBroadcastY = enemy.y;
                moveEnemies.push(enemy);
            }
        }

        if (moveEnemies.length) {
            this.broadcast({
                type: 'enemy_move',
                enemies: moveEnemies.map(enemy => ({
                    id: enemy.id,
                    x: Math.round(enemy.x),
                    y: Math.round(enemy.y),
                    state: enemy.state
                }))
            });
        }
    }

    findNearestPlayer(enemy) {
        const players = this.getActivePlayers();
        let nearest = null;
        let nearestDist = Infinity;
        const cx = enemy.x + enemy.width / 2;
        const cy = enemy.y + enemy.height / 2;
        for (const player of players) {
            const dx = (player.x + PLAYER_WIDTH / 2) - cx;
            const dy = (player.y + PLAYER_HEIGHT / 2) - cy;
            const distSq = dx * dx + dy * dy;
            if (distSq < nearestDist && Math.sqrt(distSq) <= enemy.data.aggroRange * 2) {
                nearestDist = distSq;
                nearest = player;
            }
        }
        return nearest;
    }

    getActivePlayers() {
        const list = [];
        for (const [id, playerEntry] of this.players.entries()) {
            const playerData = playerEntry?.data || playerEntry;
            if (!playerData || !playerData.name || playerData.isSpectator) continue;
            const ws = playerEntry?.ws || playerData?.ws;
            if (ws && ws.readyState !== 1) continue;
            list.push({ id, x: playerData.x, y: playerData.y, direction: playerData.direction || 'down', data: playerData });
        }
        return list;
    }

    handleAttack(playerId, payload = {}) {
        const playerEntry = this.players.get(playerId);
        const playerData = playerEntry?.data || playerEntry;
        if (!playerData || !playerData.name) {
            return { hit: false, message: 'Player not ready', shellIntegrity: playerData?.shellIntegrity || 100, totalTokens: playerData?.tokens || 0 };
        }

        const targetEnemy = payload.targetId ? this.enemies.get(payload.targetId) : null;
        const direction = payload.direction || playerData.direction || 'down';
        const hitbox = this.getAttackHitbox(playerData, direction);

        const enemy = targetEnemy || this.findEnemyInHitbox(hitbox);
        if (!enemy) {
            return { hit: false, message: 'No enemy in range', shellIntegrity: playerData.shellIntegrity || 100, totalTokens: playerData.tokens || 0 };
        }

        const damage = this.weaponDamage;
        enemy.health = Math.max(0, enemy.health - damage);
        enemy.state = enemy.health <= 0 ? 'dying' : 'hurt';

        const shellIntegrity = Math.max(0, Math.round(enemy.health));
        this.broadcast({
            type: 'enemy_damage',
            enemyId: enemy.id,
            health: shellIntegrity,
            maxHealth: enemy.maxHealth,
            shellIntegrity,
            maxShellIntegrity: enemy.maxHealth,
            attackerId: playerId
        });

        let tokensEarned = 0;
        let enemyDead = false;
        if (enemy.health <= 0) {
            enemyDead = true;
            tokensEarned = this.handleEnemyDeath(enemy, playerId);
        }

        return {
            hit: true,
            enemyId: enemy.id,
            enemy: enemy.data.name,
            damage,
            enemyHealth: Math.max(0, Math.round(enemy.health)),
            enemyDead,
            tokensEarned,
            shellIntegrity: playerData.shellIntegrity || 100,
            totalTokens: playerData.tokens || 0
        };
    }

    handleEnemyDeath(enemy, killerId) {
        this.enemies.delete(enemy.id);
        const loot = {
            tokens: 1 + Math.floor(Math.random() * 3),
            items: []
        };

        if (killerId) {
            const killerEntry = this.players.get(killerId);
            const killerData = killerEntry?.data || killerEntry;
            if (killerData) {
                killerData.tokens = (killerData.tokens || 0) + loot.tokens;
            }
        }

        this.broadcast({
            type: 'enemy_death',
            enemyId: enemy.id,
            killerId,
            loot
        });

        return loot.tokens;
    }

    findEnemyInHitbox(hitbox) {
        let closest = null;
        let closestDist = Infinity;
        for (const enemy of this.enemies.values()) {
            if (this.rectsOverlap(hitbox, { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height })) {
                const dist = this.distanceToEnemyCenter(hitbox, enemy);
                if (dist < closestDist) {
                    closest = enemy;
                    closestDist = dist;
                }
            }
        }
        return closest;
    }

    tryDamagePlayer(enemy, target, now = Date.now()) {
        if (!enemy || !target || !this.players.has(target.id)) return;
        const playerEntry = this.players.get(target.id);
        const playerData = playerEntry?.data || playerEntry;
        if (!playerData || playerData.isSpectator) return;
        if ((playerData.shellIntegrity ?? 100) <= 0) return;

        const cooldown = enemy.data?.attackCooldown || 1000;
        enemy.nextAttackTime = enemy.nextAttackTime || 0;
        if (now < enemy.nextAttackTime) {
            return;
        }

        const attackRange = enemy.data?.attackRange || Math.max(24, enemy.width + 6);
        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y + enemy.height / 2;
        const px = playerData.x + PLAYER_WIDTH / 2;
        const py = playerData.y + PLAYER_HEIGHT / 2;
        const dx = px - ex;
        const dy = py - ey;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > attackRange) {
            return;
        }

        const damage = Math.max(1, Math.round(enemy.data?.damage || 4));
        const currentShell = typeof playerData.shellIntegrity === 'number' ? playerData.shellIntegrity : 100;
        const newShell = Math.max(0, currentShell - damage);
        playerData.shellIntegrity = newShell;
        playerData.shellIntegrityMax = playerData.shellIntegrityMax || 100;
        playerData.lastCombatTime = now;
        enemy.nextAttackTime = now + cooldown;
        enemy.state = 'attacking';

        const payload = {
            type: 'player_damage',
            playerId: target.id,
            amount: damage,
            shellIntegrity: newShell,
            maxShellIntegrity: playerData.shellIntegrityMax,
            enemyId: enemy.id,
            enemyType: enemy.type,
            enemyName: enemy.data?.name
        };
        this.broadcast(payload);
    }

    distanceToEnemyCenter(hitbox, enemy) {
        const hx = hitbox.x + hitbox.width / 2;
        const hy = hitbox.y + hitbox.height / 2;
        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y + enemy.height / 2;
        const dx = hx - ex;
        const dy = hy - ey;
        return Math.sqrt(dx * dx + dy * dy);
    }

    rectsOverlap(a, b) {
        return !(a.x + a.width < b.x ||
            a.x > b.x + b.width ||
            a.y + a.height < b.y ||
            a.y > b.y + b.height);
    }

    getAttackHitbox(player, direction) {
        const px = player.x;
        const py = player.y;
        const range = WEAPON_RANGE;
        const sweep = WEAPON_SWEEP;
        switch (direction) {
            case 'up':
            case 'north':
                return { x: px - sweep / 2, y: py - range, width: PLAYER_WIDTH + sweep, height: range };
            case 'down':
            case 'south':
                return { x: px - sweep / 2, y: py + PLAYER_HEIGHT, width: PLAYER_WIDTH + sweep, height: range };
            case 'left':
            case 'west':
                return { x: px - range, y: py - sweep / 3, width: range, height: PLAYER_HEIGHT + sweep * 0.66 };
            case 'right':
            case 'east':
            default:
                return { x: px + PLAYER_WIDTH, y: py - sweep / 3, width: range, height: PLAYER_HEIGHT + sweep * 0.66 };
        }
    }

    getNearbyEnemies(x, y, radius) {
        const results = [];
        const radiusSq = radius * radius;
        for (const enemy of this.enemies.values()) {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= radiusSq) {
                results.push({
                    id: enemy.id,
                    type: enemy.type,
                    name: enemy.data.name,
                    x: Math.round(enemy.x),
                    y: Math.round(enemy.y),
                    distance: Math.round(Math.sqrt(distSq)),
                    health: Math.max(0, Math.round(enemy.health)),
                    maxHealth: enemy.maxHealth
                });
            }
        }
        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    getSnapshot() {
        return Array.from(this.enemies.values()).map(enemy => this.serializeEnemy(enemy));
    }
}

module.exports = { EnemyManager };
