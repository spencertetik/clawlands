// Main rendering engine with layered rendering
class RenderEngine {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = camera;
        
        // Zoom level (1 = normal, 0.5 = zoomed out 2x, etc.)
        this.zoom = 1;

        // Setup pixel-perfect rendering
        this.setupPixelPerfect();

        // Render layers
        this.layers = {
            [CONSTANTS.LAYER.GROUND]: [],
            [CONSTANTS.LAYER.GROUND_DECORATION]: [],
            [CONSTANTS.LAYER.BUILDING_BASE]: [],
            [CONSTANTS.LAYER.ENTITIES]: [],
            [CONSTANTS.LAYER.BUILDING_UPPER]: [],
            [CONSTANTS.LAYER.EFFECTS]: [],
            [CONSTANTS.LAYER.UI]: []
        };
    }

    setupPixelPerfect() {
        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
    }

    // Clear all render layers
    clearLayers() {
        for (let layer in this.layers) {
            this.layers[layer] = [];
        }
    }

    // Add a render command to a specific layer
    addToLayer(layer, renderFn) {
        if (this.layers[layer]) {
            this.layers[layer].push(renderFn);
        }
    }

    // Set zoom level (1 = normal, 0.5 = zoomed out 2x, etc.)
    setZoom(zoom) {
        this.zoom = zoom;
    }
    
    // Render all layers in order
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Save context state
        this.ctx.save();

        // Scale for display (includes zoom)
        const scale = CONSTANTS.DISPLAY_SCALE * this.zoom;
        this.ctx.scale(scale, scale);

        // Translate for camera position
        this.ctx.translate(
            -Math.floor(this.camera.position.x),
            -Math.floor(this.camera.position.y)
        );

        // Render each layer in order
        for (let layerKey of Object.keys(this.layers).sort((a, b) => a - b)) {
            const layer = this.layers[layerKey];
            for (let renderFn of layer) {
                renderFn(this.ctx);
            }
        }

        // Restore context state
        this.ctx.restore();

        // Clear layers for next frame
        this.clearLayers();
    }

    // Helper: Draw a rectangle (for debugging)
    drawRect(x, y, width, height, color, layer = CONSTANTS.LAYER.GROUND) {
        this.addToLayer(layer, (ctx) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x), Math.floor(y), width, height);
        });
    }

    // Helper: Draw a sprite
    drawSprite(image, sx, sy, sw, sh, dx, dy, dw, dh, layer = CONSTANTS.LAYER.ENTITIES) {
        // Check if visible before adding to render queue
        if (!this.camera.isVisible(dx, dy, dw, dh)) {
            return;
        }

        this.addToLayer(layer, (ctx) => {
            ctx.drawImage(
                image,
                Math.floor(sx), Math.floor(sy), sw, sh,
                Math.floor(dx), Math.floor(dy), dw, dh
            );
        });
    }

    // Helper: Draw text
    drawText(text, x, y, color = '#fff', fontSize = 8, layer = CONSTANTS.LAYER.UI) {
        this.addToLayer(layer, (ctx) => {
            ctx.fillStyle = color;
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText(text, Math.floor(x), Math.floor(y));
        });
    }

    // Helper: Draw a tile
    drawTile(tileset, tileId, tileSize, columns, x, y, layer = CONSTANTS.LAYER.GROUND) {
        const sx = (tileId % columns) * tileSize;
        const sy = Math.floor(tileId / columns) * tileSize;

        this.drawSprite(
            tileset,
            sx, sy, tileSize, tileSize,
            x, y, tileSize, tileSize,
            layer
        );
    }
}
