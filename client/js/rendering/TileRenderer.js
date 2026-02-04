// Tile renderer with viewport culling
class TileRenderer {
    constructor(renderEngine, camera) {
        this.renderEngine = renderEngine;
        this.camera = camera;
        this.worldMap = null;
        this.tilesets = new Map();
    }

    // Set the world map to render
    setWorldMap(worldMap) {
        this.worldMap = worldMap;
    }

    // Add a tileset
    addTileset(key, image, tileWidth, tileHeight, columns) {
        this.tilesets.set(key, {
            image,
            tileWidth,
            tileHeight,
            columns
        });
    }

    // Render all visible tiles
    render() {
        if (!this.worldMap) return;

        const tileSize = this.worldMap.tileSize || CONSTANTS.TILE_SIZE;
        const bounds = this.camera.getVisibleTileBounds(tileSize);

        // Render ground layer
        this.renderLayer(this.worldMap.groundLayer, bounds, tileSize, CONSTANTS.LAYER.GROUND);

        // Render decoration layer (if exists)
        if (this.worldMap.decorationLayer) {
            this.renderLayer(this.worldMap.decorationLayer, bounds, tileSize, CONSTANTS.LAYER.GROUND_DECORATION);
        }
    }

    // Render a specific tile layer
    renderLayer(layer, bounds, tileSize, renderLayer) {
        if (!layer) return;

        // Clamp bounds to map size
        const startRow = Math.max(0, bounds.startRow);
        const endRow = Math.min(layer.length, bounds.endRow);
        const startCol = Math.max(0, bounds.startCol);
        const endCol = Math.min(layer[0]?.length || 0, bounds.endCol);

        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                const tileEntry = layer[row]?.[col];

                // Skip empty tiles (null or undefined)
                if (tileEntry == null) continue;

                let tileId = tileEntry;
                let tilesetKey = 'main';

                if (typeof tileEntry === 'object') {
                    tileId = tileEntry.id ?? tileEntry.tileId ?? tileEntry.index;
                    tilesetKey = tileEntry.tileset || tilesetKey;
                }

                if (tileId == null) continue;

                const tileset = this.tilesets.get(tilesetKey) || this.tilesets.get('main') || this.tilesets.values().next().value;
                if (!tileset) continue;

                const x = col * tileSize;
                const y = row * tileSize;

                // Calculate source position in tileset
                const sx = (tileId % tileset.columns) * tileset.tileWidth;
                const sy = Math.floor(tileId / tileset.columns) * tileset.tileHeight;

                // Draw tile
                this.renderEngine.drawSprite(
                    tileset.image,
                    sx, sy, tileset.tileWidth, tileset.tileHeight,
                    x, y, tileSize, tileSize,
                    renderLayer
                );
            }
        }
    }
}
