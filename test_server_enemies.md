# Server-Side Enemy System Test

## Changes Made

### 1. Server-side: EnemyManager.js ✅
- Created new EnemyManager class for server-side enemy management
- Spawns Tier 1 enemies (Skitter) in predefined danger zones
- Handles attack resolution and broadcasts enemy state
- Simple random patrol AI within zones

### 2. Server integration ✅
- Integrated EnemyManager into multiplayerServer.js
- Added enemy_spawn, enemy_move, enemy_damage, enemy_death message types
- Updated mcpServer.js to track and display enemy information

### 3. Client-side integration ✅
- Added RemoteEnemy class for rendering server enemies
- Updated MultiplayerClient to handle enemy messages
- Extended CombatSystem to work with server enemies
- Disabled local spawning when multiplayer connected

## Key Features

### Enemy Spawning
- ~5-10 enemies total across danger zones
- Only Tier 1 "Skitter" type for now
- Respawn after 15 seconds when killed
- Spawn away from safe building areas

### Combat Integration
- Client sends attack with potential target IDs
- Server validates hits and broadcasts damage/death
- Clients show damage numbers and effects
- MCP bots can see and target server enemies

### Message Protocol
```javascript
// Server → Client
{ type: 'enemy_spawn', enemies: [...] }
{ type: 'enemy_move', enemies: [...] }  
{ type: 'enemy_damage', enemyId, shellIntegrity, maxShellIntegrity, playerId }
{ type: 'enemy_death', enemyId, playerId }

// Client → Server  
{ type: 'attack', direction, weapon, targetEnemyIds }
```

## Testing Checklist

### Single Player Mode
- [ ] Local enemies still spawn normally
- [ ] Local combat works as before
- [ ] No server enemies when not connected

### Multiplayer Mode  
- [ ] No local enemies spawn when connected
- [ ] Server enemies appear and move around
- [ ] Player attacks target server enemies
- [ ] Damage numbers and effects work
- [ ] Enemy health bars show correctly

### MCP Bot Integration
- [ ] `look` command shows nearby server enemies
- [ ] `attack` command can target specific enemies
- [ ] Enemy state syncs between bot and human players

## Files Modified
- `server/EnemyManager.js` (new)
- `server/multiplayerServer.js`
- `server/mcpServer.js` 
- `client/js/multiplayer/MultiplayerClient.js`
- `client/js/systems/CombatSystem.js`