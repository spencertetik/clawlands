const CONSTANTS = require('../client/js/shared/Constants.js');
const { DRIFT_FAUNA_TYPES } = require('../client/js/data/DriftFaunaData.js');

/**
 * EnemyManager
 * ------------
 * Simple server-side manager for Drift Fauna enemies so every connected
 * multiplayer client shares the same combat state. Keeps a lightweight set of
 * Tier 1 enemies moving inside predefined "danger zones" and handles combat
 * resolution when players swing their weapon.
 */
class EnemyManager {
    constructor(options = {}) {
        this.broadcast = options.broadcast || (() => {});
        this.getPlayers = options.getPlayers || (() => new Map());
        this.maxEnemies = options.maxEnemies || 8;
        this.tickRateMs = options.tickRateMs || 450;
        this.respawnDelayMs = options.respawnDelayMs || 15000;
        this.playerAttackCooldownMs = options.playerAttackCooldownMs || 350;

        this.spawnZones = (options.spawnZones && options.spawnZones.length)
            ? options.spawnZones.map((zone, idx) => ({ id: zone.id || `zone_${idx}`, ...zone }))
            : this.defaultZones();

        this.tierOneTypes = ['SKITTER']; // Only Tier 1 for now per spec
        this.enemies = new Map();
        this.nextEnemyId = 1;
        this.loop = null;
        this.lastUpdate = Date.now();
        this.playerCooldowns = new Map();
    }

    start() {
        if (this.loop) return;
        this.populateInitialEnemies();
        this.loop = setInterval(() => this.update(), this.tickRateMs);
    }

    stop() {
        if (this.loop) {
            clearInterval(this.loop);
            this.loop = null;
        }
    }

    defaultZones() {
        // Rough rectangles pulled from playtest coordinates — these sit away
        // from main hub buildings so new players spawn in safety.
        return [
            { id: 'north_reef', x: 680, y: 760, width: 520, height: 420 },
            { id: 'molthaven_ridge', x: 1180, y: 1320, width: 520, height: 420 },
            { id: 'deepcoil_west', x: 1480, y: 1680, width: 520, height: 420 },
            { id: 'ebbfield', x: 360, y: 1540, width: 440, height: 420 },
            { id: 'sunken_spokes', x: 1960, y: 1160, width: 420, height: 420 }
        ];
    }

    populateInitialEnemies() {
        const target = Math.min(this.maxEnemies, this.spawnZones.length * 2);
        while (this.enemies.size < target) {
            this.spawnEnemy();
        }
    }

    spawnEnemy(zoneOverride = null) {
        const zone = zoneOverride || this.randomZone();
        const typeKey = this.randomTierOneType();
        const typeData = DRIFT_FAUNA_TYPES[typeKey];
        if (!zone || !typeData) return null;

        const enemy = {
            id: `enemy_${this.nextEnemyId++}`,
            typeId: typeKey,
            name: typeData.name,
            zoneId: zone.id,
            x: zone.x + Math.random() * zone.width,
            y: zone.y + Math.random() * zone.height,
            width: typeData.size,
            height: typeData.size,
            speed: typeData.speed || 40,
            shellIntegrity: typeData.shellIntegrity,
            maxShellIntegrity: typeData.shellIntegrity,
            state: 'idle',
            target: null,
            lastMoveBroadcast: 0,
            respawnAt: 0
        };

        this.enemies.set(enemy.id, enemy);
        this.broadcast({
            type: 'enemy_spawn',
            enemies: [this.serializeEnemy(enemy)]
        });
        return enemy;
    }

    respawnEnemy(enemy) {
        const zone = this.spawnZones.find(z => z.id === enemy.zoneId) || this.randomZone();
        const typeData = DRIFT_FAUNA_TYPES[enemy.typeId] || DRIFT_FAUNA_TYPES.SKITTER;
        enemy.x = zone.x + Math.random() * zone.width;
        enemy.y = zone.y + Math.random() * zone.height;
        enemy.shellIntegrity = typeData.shellIntegrity;
        enemy.maxShellIntegrity = typeData.shellIntegrity;
        enemy.speed = typeData.speed || 40;
        enemy.state = 'idle';
        enemy.target = null;
        enemy.respawnAt = 0;
        this.broadcast({
            type: 'enemy_spawn',
            enemies: [this.serializeEnemy(enemy)]
        });
    }

    sendInitialState(ws) {
        const enemies = Array.from(this.enemies.values())
            .filter(enemy => enemy.state !== 'dead')
            .map(enemy => this.serializeEnemy(enemy));
        if (enemies.length === 0) return;
        ws.send(JSON.stringify({ type: 'enemy_spawn', enemies }));
    }

    update() {
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        for (const enemy of this.enemies.values()) {
            if (enemy.state === 'dead') {
                if (enemy.respawnAt && now >= enemy.respawnAt) {
                    this.respawnEnemy(enemy);
                }
                continue;
            }

            this.updateEnemyMovement(enemy, dt);
        }

        // Keep population within range
        const aliveCount = Array.from(this.enemies.values()).filter(e => e.state !== 'dead').length;
        if (aliveCount < this.maxEnemies) {
            this.spawnEnemy();
        }
    }

    updateEnemyMovement(enemy, dt) {
        // Lazy random patrol: pick new waypoint when close to previous target
        if (!enemy.target || this.distance(enemy, enemy.target) < 12) {
            enemy.target = this.randomPointInZone(enemy.zoneId);
        }

        const dx = enemy.target.x - enemy.x;
        const dy = enemy.target.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const maxStep = (enemy.speed || 40) * dt;
        const step = Math.min(maxStep, dist);
        if (step <= 0) return;

        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
        this.clampToZone(enemy);

        enemy.lastMoveBroadcast += dt;
        if (enemy.lastMoveBroadcast >= 0.45) {
            enemy.lastMoveBroadcast = 0;
            this.broadcast({
                type: 'enemy_move',
                enemies: [this.serializeEnemy(enemy)]
            });
        }
    }

    clampToZone(enemy) {
        const zone = this.spawnZones.find(z => z.id === enemy.zoneId);
        if (!zone) return;
        enemy.x = Math.max(zone.x, Math.min(zone.x + zone.width, enemy.x));
        enemy.y = Math.max(zone.y, Math.min(zone.y + zone.height, enemy.y));
    }

    handleAttack(playerId, payload = {}) {
        const now = Date.now();
        const lastAttack = this.playerCooldowns.get(playerId) || 0;
        if (now - lastAttack < this.playerAttackCooldownMs) {
            return { hit: false, message: 'Attack on cooldown.' };
        }

        const players = this.getPlayers();
        const player = players.get ? players.get(playerId) : players[playerId];
        if (!player || !player.data || !player.data.name) {
            return { hit: false, message: 'Player not registered.' };
        }

        this.playerCooldowns.set(playerId, now);

        const weapon = payload.weapon || {};
        const damage = weapon.damage || 10;
        const range = weapon.range || 18;
        const swing = weapon.swingArc || (Math.PI * 0.7);
        const direction = payload.direction || player.data.direction || CONSTANTS.DIRECTION.DOWN;
        const hitbox = this.createHitbox(player.data, range, direction);

        const targetIds = Array.isArray(payload.targetEnemyIds) && payload.targetEnemyIds.length
            ? new Set(payload.targetEnemyIds)
            : null;

        let hitEnemy = null;
        for (const enemy of this.enemies.values()) {
            if (enemy.state === 'dead') continue;
            if (targetIds && !targetIds.has(enemy.id)) continue;
            if (this.hitTest(hitbox, enemy)) {
                hitEnemy = enemy;
                break;
            }
        }

        if (!hitEnemy) {
            return { hit: false, message: 'No enemies in range.' };
        }

        hitEnemy.shellIntegrity = Math.max(0, hitEnemy.shellIntegrity - damage);
        const defeated = hitEnemy.shellIntegrity <= 0;

        if (defeated) {
            this.killEnemy(hitEnemy, playerId);
        } else {
            this.broadcast({
                type: 'enemy_damage',
                enemyId: hitEnemy.id,
                shellIntegrity: hitEnemy.shellIntegrity,
                maxShellIntegrity: hitEnemy.maxShellIntegrity,
                playerId
            });
        }

        return {
            hit: true,
            enemyId: hitEnemy.id,
            enemyName: hitEnemy.name,
            damage,
            shellIntegrity: hitEnemy.shellIntegrity,
            defeated
        };
    }

    killEnemy(enemy, playerId) {
        enemy.state = 'dead';
        enemy.respawnAt = Date.now() + this.respawnDelayMs;
        enemy.shellIntegrity = 0;
        this.broadcast({
            type: 'enemy_death',
            enemyId: enemy.id,
            playerId
        });
    }

    createHitbox(playerData, range, direction) {
        const px = playerData.x;
        const py = playerData.y;
        const pw = CONSTANTS.CHARACTER_WIDTH;
        const ph = CONSTANTS.CHARACTER_HEIGHT;
        const sweep = 12;
        switch (direction) {
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
            default:
                return { x: px + pw, y: py - sweep / 3, width: range, height: ph + sweep * 0.66 };
        }
    }

    hitTest(hitbox, enemy) {
        const enemyBox = {
            x: enemy.x,
            y: enemy.y,
            width: enemy.width,
            height: enemy.height
        };
        return !(
            hitbox.x + hitbox.width < enemyBox.x ||
            hitbox.x > enemyBox.x + enemyBox.width ||
            hitbox.y + hitbox.height < enemyBox.y ||
            hitbox.y > enemyBox.y + enemyBox.height
        );
    }

    distance(a, b) {
        const dx = (a.x + (a.width || 0) / 2) - (b.x + (b.width || 0) / 2);
        const dy = (a.y + (a.height || 0) / 2) - (b.y + (b.height || 0) / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    serializeEnemy(enemy) {
        return {
            id: enemy.id,
            type: enemy.typeId,
            name: enemy.name,
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
            width: enemy.width,
            height: enemy.height,
            shellIntegrity: Math.max(0, Math.round(enemy.shellIntegrity)),
            maxShellIntegrity: enemy.maxShellIntegrity,
            state: enemy.state,
            zoneId: enemy.zoneId
        };
    }

    randomZone() {
        if (this.spawnZones.length === 0) return null;
        return this.spawnZones[Math.floor(Math.random() * this.spawnZones.length)];
    }

    randomPointInZone(zoneId) {
        const zone = this.spawnZones.find(z => z.id === zoneId) || this.randomZone();
        if (!zone) return { x: 0, y: 0 };
        return {
            x: zone.x + Math.random() * zone.width,
            y: zone.y + Math.random() * zone.height,
            width: 0,
            height: 0
        };
    }

    randomTierOneType() {
        return this.tierOneTypes[Math.floor(Math.random() * this.tierOneTypes.length)] || 'SKITTER';
    }
}

module.exports = EnemyManager;