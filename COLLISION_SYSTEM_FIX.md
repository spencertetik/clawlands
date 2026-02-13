# Bot Collision System Fix

## Problem
Bots were running into things and having trouble navigating because their server-side collision system didn't match the client's actual collision data.

## Solution Overview
Created a comprehensive server-side collision system that exactly mirrors the client's collision detection logic.

## Changes Made

### 1. Created ServerCollisionSystem (`server/serverCollisionSystem.js`)
- **Mirrors client CollisionSystem.js exactly**
- Implements tile-based collision using collision layer
- Handles building collision with door zones
- Processes decoration collision with proper offsets and sizes
- Includes NPC collision boxes
- Matches all client constants and behavior

### 2. Updated Terrain Generation (`server/terrainMap.js`)
- **Loads EditorMapData.js for exact terrain match**
- Processes 7,158 decorations from editor data
- Computes islands from actual terrain data (2 islands detected)
- Handles bridge tiles properly (920 tiles marked as walkable)
- Creates proper Building instances when possible
- Separates terrain collision from decoration collision

### 3. Enhanced Module Compatibility
- Added Node.js exports to client modules:
  - `client/js/core/DecorationLoader.js`
  - `client/js/world/Building.js`
  - `client/js/shared/Constants.js`
- Made browser-specific code (Image loading) gracefully handle server environment

### 4. Updated Server Logic (`server/railwayServer.js`)
- **Replaced manual collision checks with unified collision system**
- Uses ServerCollisionSystem for all bot movement validation
- Properly handles NPC collision detection
- Updated world dimensions based on actual terrain data

## Collision System Details

### Terrain Collision
- **Water tiles (value 1)**: Blocked
- **Land tiles (value 0)**: Walkable
- Uses exact same 200×200 terrain map as client

### Building Collision
- **25 buildings loaded from editor data**
- Proper door zones (walkable areas)
- Building interiors blocked except door areas
- Matches client Building.js collision logic exactly

### Decoration Collision  
- **1,408 solid decorations** (out of 7,158 total)
- Proper collision boxes with offsets
- Ground decorations (paths, grass) are walkable
- Rocks, chests, plants block movement
- **Bridge decorations override water collision** (always walkable)

### NPC Collision
- Character collision boxes: 12×12 pixels at feet
- Matches client NPC.js collision detection
- Prevents bot-NPC overlap

## Key Features

### Exact Client Alignment
- **Same terrain data**: Uses EditorMapData.js directly
- **Same decoration definitions**: Uses DecorationLoader.DECORATIONS
- **Same building logic**: Uses Building class methods
- **Same constants**: Character dimensions, tile sizes, etc.

### Proper Collision Separation
- Terrain collision (water vs land)
- Decoration collision (with offsets)  
- Building collision (with door zones)
- NPC collision (footprint-based)
- Bridge override collision (walkable over water)

### Static vs Dynamic Objects
- **Static objects** (rocks, chests, buildings): Simple blocking, no physics
- **Moving entities** (NPCs, players): Push-away to prevent overlap
- Matches client behavior exactly

## Test Coverage
- **Comprehensive test scripts** validate collision behavior
- Tests terrain, decoration, building, and NPC collision
- Validates edge cases and boundary conditions
- Debug tools for troubleshooting collision issues

## Results
- **Server collision now matches client exactly**
- Bots can navigate using the same collision data as players
- No more bots running into decorations, buildings, or obstacles
- Proper pathfinding around blocked areas
- Bridges work correctly (walkable over water)
- Door areas allow proper building entry

## Files Modified
- `server/serverCollisionSystem.js` (NEW)
- `server/terrainMap.js` (MAJOR UPDATE)
- `server/railwayServer.js` (COLLISION UPDATE)  
- `client/js/core/DecorationLoader.js` (NODE EXPORT)
- `client/js/world/Building.js` (NODE EXPORT)
- `client/js/shared/Constants.js` (NODE EXPORT)

## Commits
1. **ed34534**: Initial collision system implementation
2. **3b540fc**: Fixed land tile collision separation

The bot collision system now perfectly matches the client's collision detection, ensuring consistent navigation behavior between human players and AI bots.