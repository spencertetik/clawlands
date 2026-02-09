// MapEditor.js - In-game map/level editor overlay
// Toggle with 'E' key, place assets with click, delete with right-click

class MapEditor {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.selectedAsset = null;
        this.selectedCategory = 'decorations';
        this.selectedLayer = 'decoration'; // ground, decoration, above
        this.gridSnap = true;
        this.showGrid = true;
        this.currentTool = 'place'; // place, delete, pick
        this.rotation = 0; // 0, 90, 180, 270 degrees
        
        // Overview mode (zoom out to see whole map)
        this.overviewMode = false;
        this.overviewZoom = 0.15; // Show ~15% scale to fit whole world
        this.overviewPan = { x: 0, y: 0 };
        this.originalCameraTarget = null;
        this.currentZoom = 1; // Current zoom level (1 = normal, 0.5 = zoomed out, 2 = zoomed in)
        this.minZoom = 0.1;
        this.maxZoom = 2;
        
        // Drag painting
        this.isDragging = false;
        this.dragStartWorld = null;
        this.lastPaintedTile = null; // Prevent duplicate placements
        
        // Smooth panning
        this.panKeys = { up: false, down: false, left: false, right: false };
        this.panSpeed = 300; // Pixels per second (at zoom 1)
        
        // Rectangle fill (shift+drag)
        this.isRectFill = false;
        this.rectStart = null;
        this.rectPreview = null;
        
        // Track placed items for save/load
        this.placedItems = [];
        this.deletedItems = new Set(); // Track deleted original items
        
        // Undo history
        this.undoStack = []; // Array of actions: { type: 'place'|'delete', items: [...] }
        this.currentAction = null; // Current batch of operations (for drag/rect)
        this.maxUndoSteps = 50;
        
        // Path auto-tiling: track which asset types are path tiles
        this.pathTileTypes = new Set(['dirt_path', 'cobblestone_path', 'brick_path']);
        this.pathRebuildPending = false; // Debounce path rebuilds during drag painting
        
        // Asset categories with their sources
        this.categories = {
            ground: {
                name: 'Ground',
                icon: '■',
                assets: ['dirt_path', 'cobblestone_path', 'brick_path']
            },
            plants: {
                name: 'Plants',
                icon: 'T',
                assets: []
            },
            decorations: {
                name: 'Decor',
                icon: '🐚',
                assets: []
            },
            furniture: {
                name: 'Furniture',
                icon: '🪑',
                assets: []
            },
            special: {
                name: 'Special',
                icon: '✨',
                assets: []
            }
        };
        
        // Build UI
        this.createUI();
        this.populateAssets();
        this.setupEventListeners();
        
        // Load saved edits
        this.loadSavedEdits();
    }
    
    createUI() {
        // Main editor container (sidebar)
        this.container = document.createElement('div');
        this.container.id = 'map-editor';
        this.container.className = 'map-editor hidden';
        this.container.innerHTML = `
            <div class="editor-header">
                <h3>MAP EDITOR</h3>
                <button class="editor-close" title="Close (E)">✕</button>
            </div>
            
            <div class="editor-tabs">
                ${Object.entries(this.categories).map(([key, cat]) => 
                    `<button class="editor-tab ${key === this.selectedCategory ? 'active' : ''}" data-category="${key}">
                        ${cat.icon}
                    </button>`
                ).join('')}
            </div>
            
            <div class="editor-assets" id="editor-assets">
                <!-- Assets will be populated here -->
            </div>
            
            <div class="editor-options">
                <div class="option-row">
                    <label>Layer:</label>
                    <select id="editor-layer">
                        <option value="ground">Ground</option>
                        <option value="decoration" selected>Decoration</option>
                        <option value="above">Above Player</option>
                    </select>
                </div>
                <div class="option-row">
                    <label>
                        <input type="checkbox" id="editor-grid" checked>
                        Snap to Grid
                    </label>
                </div>
                <div class="option-row">
                    <label>
                        <input type="checkbox" id="editor-show-grid" checked>
                        Show Grid
                    </label>
                </div>
            </div>
            
            <div class="editor-tools">
                <button class="tool-btn" id="tool-place" title="Place Mode (drag to paint)">🖌️</button>
                <button class="tool-btn" id="tool-delete" title="Delete Mode">🗑️</button>
                <button class="tool-btn" id="tool-pick" title="Pick from Map">💉</button>
                <button class="tool-btn" id="tool-rect" title="Rectangle Fill (or Shift+drag)">⬛</button>
                <button class="tool-btn" id="tool-rotate" title="Rotate 90° (R)">🔄</button>
                <button class="tool-btn" id="tool-undo" title="Undo (Ctrl+Z)">↩️</button>
            </div>
            <div class="editor-rotation">
                <span>Rotation: <span id="rotation-display">0°</span></span>
            </div>
            
            <div class="editor-zoom">
                <button class="zoom-btn" id="zoom-out" title="Zoom Out">➖</button>
                <span id="zoom-level">100%</span>
                <button class="zoom-btn" id="zoom-in" title="Zoom In">➕</button>
                <button class="zoom-btn" id="zoom-fit" title="Fit World">🔲</button>
            </div>
            
            <div class="editor-actions">
                <button class="action-btn" id="editor-overview">🗺️ Overview</button>
                <button class="action-btn" id="editor-save">💾 Save</button>
                <button class="action-btn" id="editor-clear">🗑️ Clear All</button>
                <button class="action-btn" id="editor-export">📤 Export</button>
                <button class="action-btn" id="editor-import">📥 Import</button>
            </div>
            
            <div class="editor-status">
                <span id="editor-coords">x: 0, y: 0</span>
                <span id="editor-selected">None selected</span>
                <span id="editor-hint">Drag to paint, Shift+drag for rect fill</span>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Cursor preview element
        this.cursorPreview = document.createElement('div');
        this.cursorPreview.className = 'editor-cursor-preview hidden';
        document.body.appendChild(this.cursorPreview);
    }
    
    populateAssets() {
        // Get decoration types from DecorationLoader
        if (typeof DecorationLoader !== 'undefined') {
            const decorDefs = DecorationLoader.DECORATIONS;
            
            for (const [key, def] of Object.entries(decorDefs)) {
                // Categorize based on type
                if (key.includes('palm') || key.includes('bush') || key.includes('fern') || 
                    key.includes('plant') || key.includes('seagrass') || key.includes('flower')) {
                    this.categories.plants.assets.push(key);
                } else if (key.includes('shell') || key.includes('rock') || key.includes('starfish') ||
                           key.includes('coral') || key.includes('driftwood') || key.includes('anchor')) {
                    this.categories.decorations.assets.push(key);
                } else if (key.includes('chest') || key.includes('statue') || key.includes('sign') ||
                           key.includes('campfire') || key.includes('bottle')) {
                    this.categories.special.assets.push(key);
                } else if (key.includes('_path')) {
                    // Path tiles - only add if not already in ground category
                    if (!this.categories.ground.assets.includes(key)) {
                        this.categories.ground.assets.push(key);
                    }
                } else {
                    this.categories.decorations.assets.push(key);
                }
            }
        }
        
        // Get furniture types from InteriorLoader
        if (typeof InteriorLoader !== 'undefined') {
            const furnitureDefs = InteriorLoader.FURNITURE;
            for (const key of Object.keys(furnitureDefs)) {
                this.categories.furniture.assets.push(key);
            }
        }
        
        this.renderAssetPalette();
    }
    
    renderAssetPalette() {
        const container = document.getElementById('editor-assets');
        if (!container) return;
        
        const category = this.categories[this.selectedCategory];
        if (!category) return;
        
        container.innerHTML = category.assets.map(assetKey => {
            const isSelected = this.selectedAsset === assetKey;
            
            // Get the sprite path directly from definitions
            let spritePath = null;
            if (this.selectedCategory === 'furniture' && typeof InteriorLoader !== 'undefined') {
                const def = InteriorLoader.FURNITURE[assetKey];
                spritePath = def?.path;
            } else if (typeof DecorationLoader !== 'undefined') {
                const def = DecorationLoader.DECORATIONS[assetKey];
                spritePath = def?.path;
            }
            
            return `
                <div class="asset-item ${isSelected ? 'selected' : ''}" 
                     data-asset="${assetKey}"
                     title="${assetKey}">
                    <div class="asset-preview" data-asset="${assetKey}" 
                         ${spritePath ? `style="background-image: url(${spritePath}); background-size: contain; background-repeat: no-repeat; background-position: center;"` : ''}>
                        ${spritePath ? '' : '📦'}
                    </div>
                    <span class="asset-name">${assetKey.replace(/_/g, ' ')}</span>
                </div>
            `;
        }).join('');
    }
    
    setupEventListeners() {
        // Toggle editor with E key, track pan keys for smooth movement
        document.addEventListener('keydown', (e) => {
            // Don't handle if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key === 'e' || e.key === 'E') {
                this.toggle();
                return;
            }
            
            // Ctrl+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && this.enabled) {
                e.preventDefault();
                this.undo();
                return;
            }
            
            // R for rotate
            if ((e.key === 'r' || e.key === 'R') && this.enabled) {
                e.preventDefault();
                this.rotate();
                return;
            }
            
            // Track pan keys in overview mode
            if (this.enabled && this.overviewMode) {
                switch(e.key) {
                    case 'w': case 'W': case 'ArrowUp':
                        this.panKeys.up = true;
                        e.preventDefault();
                        break;
                    case 's': case 'S': case 'ArrowDown':
                        this.panKeys.down = true;
                        e.preventDefault();
                        break;
                    case 'a': case 'A': case 'ArrowLeft':
                        this.panKeys.left = true;
                        e.preventDefault();
                        break;
                    case 'd': case 'D': case 'ArrowRight':
                        this.panKeys.right = true;
                        e.preventDefault();
                        break;
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'w': case 'W': case 'ArrowUp':
                    this.panKeys.up = false;
                    break;
                case 's': case 'S': case 'ArrowDown':
                    this.panKeys.down = false;
                    break;
                case 'a': case 'A': case 'ArrowLeft':
                    this.panKeys.left = false;
                    break;
                case 'd': case 'D': case 'ArrowRight':
                    this.panKeys.right = false;
                    break;
            }
        });
        
        // Start smooth pan update loop
        this.startPanLoop();
        
        // Close button
        this.container.querySelector('.editor-close').addEventListener('click', () => {
            this.toggle();
        });
        
        // Category tabs
        this.container.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.selectedCategory = tab.dataset.category;
                this.container.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderAssetPalette();
            });
        });
        
        // Asset selection
        this.container.querySelector('#editor-assets').addEventListener('click', (e) => {
            const item = e.target.closest('.asset-item');
            if (item) {
                this.selectAsset(item.dataset.asset);
            }
        });
        
        // Layer select
        document.getElementById('editor-layer')?.addEventListener('change', (e) => {
            this.selectedLayer = e.target.value;
        });
        
        // Grid snap
        document.getElementById('editor-grid')?.addEventListener('change', (e) => {
            this.gridSnap = e.target.checked;
        });
        
        // Show grid
        document.getElementById('editor-show-grid')?.addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
        });
        
        // Tool buttons
        document.getElementById('tool-place')?.addEventListener('click', () => this.setTool('place'));
        document.getElementById('tool-delete')?.addEventListener('click', () => this.setTool('delete'));
        document.getElementById('tool-pick')?.addEventListener('click', () => this.setTool('pick'));
        document.getElementById('tool-rect')?.addEventListener('click', () => this.setTool('rect'));
        document.getElementById('tool-rotate')?.addEventListener('click', () => this.rotate());
        document.getElementById('tool-undo')?.addEventListener('click', () => this.undo());
        
        // Zoom buttons
        document.getElementById('zoom-in')?.addEventListener('click', () => this.zoom(1.5));
        document.getElementById('zoom-out')?.addEventListener('click', () => this.zoom(1/1.5));
        document.getElementById('zoom-fit')?.addEventListener('click', () => this.zoomToFit());
        
        // Mouse wheel zoom
        window.addEventListener('wheel', (e) => {
            if (!this.enabled || !this.overviewMode) return;
            const canvas = document.getElementById('game-canvas');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right ||
                e.clientY < rect.top || e.clientY > rect.bottom) return;
            
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 1/1.2 : 1.2;
            this.zoom(zoomFactor);
        }, { passive: false });
        
        // Action buttons
        document.getElementById('editor-overview')?.addEventListener('click', () => this.toggleOverview());
        document.getElementById('editor-save')?.addEventListener('click', () => this.saveEdits());
        document.getElementById('editor-clear')?.addEventListener('click', () => this.clearAll());
        document.getElementById('editor-export')?.addEventListener('click', () => this.exportMap());
        document.getElementById('editor-import')?.addEventListener('click', () => this.importMap());
        
        // Canvas mouse handling for drag painting and rectangle fill
        window.addEventListener('mousedown', (e) => {
            if (!this.enabled || e.button !== 0) return;
            
            const canvas = document.getElementById('game-canvas');
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCanvasMouseDown(e);
            }
        }, true);
        
        window.addEventListener('mouseup', (e) => {
            if (!this.enabled) return;
            this.handleCanvasMouseUp(e);
        }, true);
        
        window.addEventListener('contextmenu', (e) => {
            if (!this.enabled) return;
            
            const canvas = document.getElementById('game-canvas');
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCanvasRightClick(e);
            }
        }, true);
        
        window.addEventListener('mousemove', (e) => {
            if (!this.enabled) return;
            this.handleCanvasMove(e);
        });
    }
    
    startPanLoop() {
        let lastTime = performance.now();
        
        const panUpdate = () => {
            const now = performance.now();
            const deltaTime = (now - lastTime) / 1000; // Convert to seconds
            lastTime = now;
            
            if (this.enabled && this.overviewMode) {
                const camera = this.game.camera;
                // Scale pan speed inversely with zoom (faster pan when zoomed out)
                const speed = this.panSpeed * deltaTime / Math.max(0.2, this.currentZoom);
                
                if (this.panKeys.up) {
                    camera.position.y = Math.max(0, camera.position.y - speed);
                }
                if (this.panKeys.down) {
                    camera.position.y = Math.min(
                        this.game.worldHeight - camera.viewportHeight,
                        camera.position.y + speed
                    );
                }
                if (this.panKeys.left) {
                    camera.position.x = Math.max(0, camera.position.x - speed);
                }
                if (this.panKeys.right) {
                    camera.position.x = Math.min(
                        this.game.worldWidth - camera.viewportWidth,
                        camera.position.x + speed
                    );
                }
            }
            
            requestAnimationFrame(panUpdate);
        };
        
        requestAnimationFrame(panUpdate);
    }
    
    toggle() {
        this.enabled = !this.enabled;
        this.container.classList.toggle('hidden', !this.enabled);
        this.cursorPreview.classList.toggle('hidden', !this.enabled);
        
        // Disable/enable player movement
        if (this.game.inputManager) {
            this.game.inputManager.setDisabled(this.enabled);
        }
        
        if (this.enabled) {
            console.log('🗺️ Map Editor enabled - Player movement disabled');
        } else {
            // Exit overview mode when disabling editor
            if (this.overviewMode) {
                this.toggleOverview();
            }
            // Clear any held pan keys
            this.panKeys = { up: false, down: false, left: false, right: false };
            console.log('🗺️ Map Editor disabled - Player movement enabled');
        }
    }
    
    toggleOverview() {
        this.overviewMode = !this.overviewMode;
        
        const btn = document.getElementById('editor-overview');
        const camera = this.game.camera;
        const renderer = this.game.renderer;
        
        if (this.overviewMode) {
            // Enter overview mode
            btn.textContent = '🎮 Normal';
            btn.classList.add('active');
            
            // Store original camera state
            this.originalCameraTarget = camera.target;
            camera.target = null; // Stop following player
            
            // Calculate zoom to fit world
            const worldWidth = this.game.worldWidth;
            const worldHeight = this.game.worldHeight;
            const viewWidth = CONSTANTS.VIEWPORT_WIDTH;
            const viewHeight = CONSTANTS.VIEWPORT_HEIGHT;
            
            // Calculate zoom to fit entire world with some padding
            const zoomX = viewWidth / worldWidth;
            const zoomY = viewHeight / worldHeight;
            this.overviewZoom = Math.min(zoomX, zoomY) * 0.9;
            
            // Center the view
            this.overviewPan.x = (worldWidth - viewWidth / this.overviewZoom) / 2;
            this.overviewPan.y = (worldHeight - viewHeight / this.overviewZoom) / 2;
            
            // Apply zoom to renderer
            this.currentZoom = this.overviewZoom;
            renderer.setZoom(this.currentZoom);
            camera.position.x = this.overviewPan.x;
            camera.position.y = this.overviewPan.y;
            
            // Expand viewport to show more world
            camera.viewportWidth = viewWidth / this.currentZoom;
            camera.viewportHeight = viewHeight / this.currentZoom;
            
            this.updateZoomDisplay();
            console.log(`🗺️ Overview mode ON - zoom: ${this.currentZoom.toFixed(3)}, world: ${worldWidth}x${worldHeight}`);
        } else {
            // Exit overview mode
            btn.textContent = '🗺️ Overview';
            btn.classList.remove('active');
            
            // Restore camera
            camera.target = this.originalCameraTarget;
            renderer.setZoom(1);
            
            // Restore viewport
            camera.viewportWidth = CONSTANTS.VIEWPORT_WIDTH;
            camera.viewportHeight = CONSTANTS.VIEWPORT_HEIGHT;
            
            console.log('🗺️ Overview mode OFF');
            this.currentZoom = 1;
            this.updateZoomDisplay();
        }
    }
    
    zoom(factor) {
        if (!this.overviewMode) {
            // Enter overview mode first
            this.toggleOverview();
        }
        
        const renderer = this.game.renderer;
        const camera = this.game.camera;
        
        // Calculate new zoom
        const oldZoom = this.currentZoom;
        this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom * factor));
        
        if (this.currentZoom === oldZoom) return;
        
        // Apply zoom
        renderer.setZoom(this.currentZoom);
        
        // Update viewport size based on zoom
        camera.viewportWidth = CONSTANTS.VIEWPORT_WIDTH / this.currentZoom;
        camera.viewportHeight = CONSTANTS.VIEWPORT_HEIGHT / this.currentZoom;
        
        // Clamp camera position to world bounds
        camera.position.x = Math.max(0, Math.min(this.game.worldWidth - camera.viewportWidth, camera.position.x));
        camera.position.y = Math.max(0, Math.min(this.game.worldHeight - camera.viewportHeight, camera.position.y));
        
        this.updateZoomDisplay();
        console.log(`🔍 Zoom: ${Math.round(this.currentZoom * 100)}%`);
    }
    
    zoomToFit() {
        if (!this.overviewMode) {
            this.toggleOverview();
            return; // toggleOverview already fits the world
        }
        
        const camera = this.game.camera;
        const renderer = this.game.renderer;
        
        // Calculate zoom to fit entire world
        const zoomX = CONSTANTS.VIEWPORT_WIDTH / this.game.worldWidth;
        const zoomY = CONSTANTS.VIEWPORT_HEIGHT / this.game.worldHeight;
        this.currentZoom = Math.min(zoomX, zoomY) * 0.95;
        
        renderer.setZoom(this.currentZoom);
        camera.viewportWidth = CONSTANTS.VIEWPORT_WIDTH / this.currentZoom;
        camera.viewportHeight = CONSTANTS.VIEWPORT_HEIGHT / this.currentZoom;
        
        // Center on world
        camera.position.x = (this.game.worldWidth - camera.viewportWidth) / 2;
        camera.position.y = (this.game.worldHeight - camera.viewportHeight) / 2;
        
        this.updateZoomDisplay();
        console.log(`🔲 Zoom to fit: ${Math.round(this.currentZoom * 100)}%`);
    }
    
    updateZoomDisplay() {
        const display = document.getElementById('zoom-level');
        if (display) {
            display.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
    }
    
    selectAsset(assetKey) {
        this.selectedAsset = assetKey;
        this.currentTool = 'place';
        
        // Auto-select ground layer for path tiles
        if (this.pathTileTypes.has(assetKey)) {
            this.selectedLayer = 'ground';
            const layerSelect = document.getElementById('editor-layer');
            if (layerSelect) layerSelect.value = 'ground';
        }
        
        // Update UI
        this.container.querySelectorAll('.asset-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.asset === assetKey);
        });
        
        document.getElementById('editor-selected').textContent = assetKey || 'None';
        
        // Update cursor preview
        this.updateCursorPreview();
    }
    
    setTool(tool) {
        this.currentTool = tool;
        this.container.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === `tool-${tool}`);
        });
    }
    
    rotate() {
        this.rotation = (this.rotation + 90) % 360;
        document.getElementById('rotation-display').textContent = `${this.rotation}°`;
        this.updateCursorPreview();
        console.log(`🔄 Rotation: ${this.rotation}°`);
    }
    
    updateCursorPreview() {
        if (!this.selectedAsset || !this.enabled) {
            this.cursorPreview.classList.add('hidden');
            return;
        }
        
        let sprite = null;
        if (this.selectedCategory === 'furniture') {
            sprite = this.game.interiorLoader?.getSprite(this.selectedAsset);
        } else {
            sprite = this.game.decorationLoader?.getSprite(this.selectedAsset);
        }
        
        if (sprite) {
            this.cursorPreview.style.backgroundImage = `url(${sprite.src})`;
            this.cursorPreview.style.width = `${sprite.width * 2}px`;
            this.cursorPreview.style.height = `${sprite.height * 2}px`;
            this.cursorPreview.style.transform = `translate(-50%, -50%) rotate(${this.rotation}deg)`;
            this.cursorPreview.classList.remove('hidden');
        }
    }
    
    handleCanvasMove(e) {
        if (!this.enabled) return;
        
        const coords = this.getWorldCoordsFromEvent(e);
        if (!coords) return;
        
        const { snapX, snapY } = coords;
        
        // Update coords display
        document.getElementById('editor-coords').textContent = 
            `x: ${Math.floor(snapX)}, y: ${Math.floor(snapY)}`;
        
        // Move cursor preview
        if (this.cursorPreview && !this.cursorPreview.classList.contains('hidden')) {
            this.cursorPreview.style.left = `${e.clientX}px`;
            this.cursorPreview.style.top = `${e.clientY}px`;
        }
        
        // Update rect preview if in rect mode
        if (this.isRectFill && this.rectStart) {
            const tileSize = CONSTANTS.TILE_SIZE;
            // Snap end to next tile boundary for preview
            const endX = snapX + tileSize;
            const endY = snapY + tileSize;
            this.updateRectPreview(this.rectStart.x, this.rectStart.y, endX, endY);
            return;
        }
        
        // Handle drag painting
        if (this.isDragging && (this.currentTool === 'place' || this.currentTool === 'delete')) {
            const tileKey = `${snapX},${snapY}`;
            
            // Only paint if we moved to a new tile
            if (tileKey !== this.lastPaintedTile) {
                this.lastPaintedTile = tileKey;
                
                if (this.currentTool === 'place' && this.selectedAsset) {
                    this.placeAsset(snapX, snapY);
                } else if (this.currentTool === 'delete') {
                    this.deleteAtPosition(snapX, snapY);
                }
            }
        }
    }
    
    getWorldCoordsFromEvent(e) {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return null;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        
        const displayScale = CONSTANTS.DISPLAY_SCALE || 4;
        const zoom = this.game.renderer?.zoom || 1;
        const totalScale = displayScale * zoom;
        const worldX = (canvasX / totalScale) + this.game.camera.position.x;
        const worldY = (canvasY / totalScale) + this.game.camera.position.y;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const snapX = this.gridSnap ? Math.floor(worldX / tileSize) * tileSize : Math.floor(worldX);
        const snapY = this.gridSnap ? Math.floor(worldY / tileSize) * tileSize : Math.floor(worldY);
        
        return { worldX, worldY, snapX, snapY, canvasX, canvasY };
    }
    
    handleCanvasMouseDown(e) {
        if (!this.enabled) return;
        
        const coords = this.getWorldCoordsFromEvent(e);
        if (!coords) return;
        
        const { snapX, snapY } = coords;
        
        // Check for rect fill mode (shift key or rect tool)
        if (e.shiftKey || this.currentTool === 'rect') {
            this.isRectFill = true;
            this.rectStart = { x: snapX, y: snapY };
            this.startActionBatch(); // Start batch for rect fill
            this.createRectPreview();
            console.log(`🗺️ Rect fill started at (${snapX}, ${snapY})`);
            return;
        }
        
        // Start drag painting
        this.isDragging = true;
        this.dragStartWorld = { x: snapX, y: snapY };
        this.lastPaintedTile = `${snapX},${snapY}`;
        this.startActionBatch(); // Start batch for drag painting
        
        // Place first tile
        if (this.currentTool === 'place' && this.selectedAsset) {
            this.placeAsset(snapX, snapY);
        } else if (this.currentTool === 'delete') {
            this.deleteAtPosition(snapX, snapY);
        } else if (this.currentTool === 'pick') {
            this.pickAtPosition(snapX, snapY);
        }
    }
    
    handleCanvasMouseUp(e) {
        if (this.isRectFill && this.rectStart) {
            const coords = this.getWorldCoordsFromEvent(e);
            if (coords) {
                this.fillRect(this.rectStart.x, this.rectStart.y, coords.snapX, coords.snapY);
            }
            this.removeRectPreview();
        }
        
        // Commit the action batch (for drag painting or rect fill)
        this.commitActionBatch();
        
        this.isDragging = false;
        this.isRectFill = false;
        this.rectStart = null;
        this.lastPaintedTile = null;
    }
    
    createRectPreview() {
        if (this.rectPreview) return;
        
        this.rectPreview = document.createElement('div');
        this.rectPreview.className = 'editor-rect-preview';
        this.rectPreview.style.cssText = `
            position: fixed;
            border: 2px dashed #4ecdc4;
            background: rgba(78, 205, 196, 0.2);
            pointer-events: none;
            z-index: 10001;
        `;
        document.body.appendChild(this.rectPreview);
    }
    
    updateRectPreview(startX, startY, endX, endY) {
        if (!this.rectPreview) return;
        
        const canvas = document.getElementById('game-canvas');
        const rect = canvas.getBoundingClientRect();
        const displayScale = CONSTANTS.DISPLAY_SCALE || 4;
        const zoom = this.game.renderer?.zoom || 1;
        const totalScale = displayScale * zoom;
        
        // Convert world coords to screen coords
        const screenStartX = (startX - this.game.camera.position.x) * totalScale * (rect.width / canvas.width) + rect.left;
        const screenStartY = (startY - this.game.camera.position.y) * totalScale * (rect.height / canvas.height) + rect.top;
        const screenEndX = (endX - this.game.camera.position.x) * totalScale * (rect.width / canvas.width) + rect.left;
        const screenEndY = (endY - this.game.camera.position.y) * totalScale * (rect.height / canvas.height) + rect.top;
        
        const left = Math.min(screenStartX, screenEndX);
        const top = Math.min(screenStartY, screenEndY);
        const width = Math.abs(screenEndX - screenStartX);
        const height = Math.abs(screenEndY - screenStartY);
        
        this.rectPreview.style.left = `${left}px`;
        this.rectPreview.style.top = `${top}px`;
        this.rectPreview.style.width = `${width}px`;
        this.rectPreview.style.height = `${height}px`;
    }
    
    removeRectPreview() {
        if (this.rectPreview) {
            this.rectPreview.remove();
            this.rectPreview = null;
        }
    }
    
    fillRect(x1, y1, x2, y2) {
        if (!this.selectedAsset || this.currentTool === 'pick') {
            console.warn('🗺️ Select an asset first for rect fill');
            return;
        }
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const startX = Math.min(x1, x2);
        const startY = Math.min(y1, y2);
        const endX = Math.max(x1, x2);
        const endY = Math.max(y1, y2);
        
        let count = 0;
        const isDelete = this.currentTool === 'delete';
        
        for (let x = startX; x <= endX; x += tileSize) {
            for (let y = startY; y <= endY; y += tileSize) {
                if (isDelete) {
                    this.deleteAtPosition(x, y);
                } else {
                    this.placeAsset(x, y);
                }
                count++;
            }
        }
        
        console.log(`🗺️ Rect fill: ${isDelete ? 'deleted' : 'placed'} ${count} items`);
    }
    
    handleCanvasRightClick(e) {
        if (!this.enabled) return;
        
        const canvas = document.getElementById('game-canvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        
        // Convert to world coordinates (divide by display scale and zoom)
        const displayScale = CONSTANTS.DISPLAY_SCALE || 4;
        const zoom = this.game.renderer?.zoom || 1;
        const totalScale = displayScale * zoom;
        const worldX = (canvasX / totalScale) + this.game.camera.position.x;
        const worldY = (canvasY / totalScale) + this.game.camera.position.y;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const snapX = this.gridSnap ? Math.floor(worldX / tileSize) * tileSize : Math.floor(worldX);
        const snapY = this.gridSnap ? Math.floor(worldY / tileSize) * tileSize : Math.floor(worldY);
        
        this.deleteAtPosition(snapX, snapY);
    }
    
    placeAsset(x, y) {
        if (!this.selectedAsset) {
            console.warn('🗺️ No asset selected');
            return;
        }
        
        const isPathTile = this.pathTileTypes.has(this.selectedAsset);
        
        // For path tiles, snap to grid and check for duplicates
        if (isPathTile) {
            const tileSize = CONSTANTS.TILE_SIZE;
            x = Math.floor(x / tileSize) * tileSize;
            y = Math.floor(y / tileSize) * tileSize;
            
            // Don't place duplicate path tiles at same position
            const exists = this.game.decorations.some(d => 
                d.type === this.selectedAsset && d.x === x && d.y === y
            );
            if (exists) return;
            
            // Remove any other path type at this position (replace dirt with cobble, etc.)
            const otherPathIdx = this.game.decorations.findIndex(d =>
                this.pathTileTypes.has(d.type) && d.x === x && d.y === y && d.type !== this.selectedAsset
            );
            if (otherPathIdx !== -1) {
                const removed = this.game.decorations.splice(otherPathIdx, 1)[0];
                this.placedItems = this.placedItems.filter(p =>
                    !(p.x === removed.x && p.y === removed.y && p.type === removed.type)
                );
            }
        }
        
        // Get asset definition and sprite path
        let def = null;
        let spritePath = null;
        
        if (this.selectedCategory === 'furniture' && typeof InteriorLoader !== 'undefined') {
            def = InteriorLoader.FURNITURE[this.selectedAsset];
            spritePath = def?.path;
        } else if (typeof DecorationLoader !== 'undefined') {
            def = DecorationLoader.DECORATIONS[this.selectedAsset];
            spritePath = def?.path;
        }
        
        if (!def) {
            console.warn(`🗺️ No definition found for ${this.selectedAsset}`);
            def = { width: 16, height: 16 };
        }
        
        // Determine layer constant
        let layer;
        if (isPathTile) {
            // Path tiles always go on ground layer
            layer = CONSTANTS.LAYER.GROUND;
        } else {
            switch (this.selectedLayer) {
                case 'ground': layer = CONSTANTS.LAYER.GROUND; break;
                case 'above': layer = CONSTANTS.LAYER.ENTITIES + 1; break;
                default: layer = CONSTANTS.LAYER.GROUND_DECORATION;
            }
        }
        
        // Get the sprite from the decoration loader
        let sprite = this.game.decorationLoader?.getSprite(this.selectedAsset);
        
        // If sprite not found in loader, create and load it
        if (!sprite && spritePath) {
            sprite = new Image();
            sprite.src = spritePath;
        }
        
        // Create decoration object
        const newDecor = {
            x: x,
            y: y,
            type: this.selectedAsset,
            width: def.width || 16,
            height: def.height || 16,
            sprite: sprite,
            layer: layer,
            ground: def.ground || false,
            editorPlaced: true,
            useSprite: !isPathTile, // Path tiles render via TileRenderer, not as sprites
            rotation: this.rotation
        };
        
        // Add to game decorations
        if (!this.game.decorations) {
            this.game.decorations = [];
        }
        this.game.decorations.push(newDecor);
        
        // Track for saving (with location)
        const placedItem = {
            x: newDecor.x,
            y: newDecor.y,
            type: newDecor.type,
            width: newDecor.width,
            height: newDecor.height,
            layer: newDecor.layer,
            rotation: newDecor.rotation,
            location: this.getCurrentLocationKey()
        };
        this.placedItems.push(placedItem);
        
        // Track for undo
        this.recordAction('place', newDecor);
        
        // If path tile, schedule a path layer rebuild (debounced for drag painting)
        if (isPathTile) {
            this.schedulePathRebuild();
        }
    }
    
    deleteAtPosition(x, y) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const tolerance = tileSize;
        
        // Find decoration at position
        const index = this.game.decorations.findIndex(d => {
            return Math.abs(d.x - x) < tolerance && Math.abs(d.y - y) < tolerance;
        });
        
        if (index !== -1) {
            const removed = this.game.decorations.splice(index, 1)[0];
            console.log(`🗑️ Deleted ${removed.type} at (${removed.x}, ${removed.y})`);
            
            // Track deletion with location key
            const locationKey = this.getCurrentLocationKey();
            this.deletedItems.add(`${locationKey}:${removed.type}_${removed.x}_${removed.y}`);
            
            // Remove from placed items if it was editor-placed
            this.placedItems = this.placedItems.filter(p => 
                !(p.x === removed.x && p.y === removed.y && p.type === removed.type)
            );
            
            // Track for undo
            this.recordAction('delete', removed);
            
            // If deleted a path tile, remove from persistent tracking and rebuild
            if (this.pathTileTypes.has(removed.type)) {
                const tileSize = CONSTANTS.TILE_SIZE;
                const col = Math.floor(removed.x / tileSize);
                const row = Math.floor(removed.y / tileSize);
                this.game.removePathPosition(col, row, removed.type);
                this.schedulePathRebuild();
            }
        }
    }
    
    // === UNDO SYSTEM ===
    
    startActionBatch() {
        // Start a new batch of actions (for drag painting or rect fill)
        this.currentAction = { type: 'batch', items: [] };
    }
    
    recordAction(type, item) {
        const actionItem = {
            actionType: type,
            x: item.x,
            y: item.y,
            type: item.type,
            width: item.width,
            height: item.height,
            layer: item.layer,
            ground: item.ground,
            sprite: item.sprite // Keep reference for restoration
        };
        
        if (this.currentAction) {
            // Add to current batch
            this.currentAction.items.push(actionItem);
        } else {
            // Single action - push directly to stack
            this.undoStack.push({ type: 'single', items: [actionItem] });
            if (this.undoStack.length > this.maxUndoSteps) {
                this.undoStack.shift();
            }
        }
    }
    
    commitActionBatch() {
        if (this.currentAction && this.currentAction.items.length > 0) {
            this.undoStack.push(this.currentAction);
            if (this.undoStack.length > this.maxUndoSteps) {
                this.undoStack.shift();
            }
            console.log(`📝 Committed batch of ${this.currentAction.items.length} actions`);
        }
        this.currentAction = null;
    }
    
    undo() {
        if (this.undoStack.length === 0) {
            console.log('↩️ Nothing to undo');
            return;
        }
        
        const action = this.undoStack.pop();
        let undoCount = 0;
        
        // Process items in reverse order
        for (let i = action.items.length - 1; i >= 0; i--) {
            const item = action.items[i];
            
            if (item.actionType === 'place') {
                // Undo a placement by removing the item
                const index = this.game.decorations.findIndex(d =>
                    d.x === item.x && d.y === item.y && d.type === item.type
                );
                if (index !== -1) {
                    this.game.decorations.splice(index, 1);
                    // Also remove from placedItems
                    this.placedItems = this.placedItems.filter(p =>
                        !(p.x === item.x && p.y === item.y && p.type === item.type)
                    );
                    undoCount++;
                }
            } else if (item.actionType === 'delete') {
                // Undo a deletion by restoring the item
                const restoredDecor = {
                    x: item.x,
                    y: item.y,
                    type: item.type,
                    width: item.width,
                    height: item.height,
                    layer: item.layer,
                    ground: item.ground,
                    sprite: item.sprite || this.game.decorationLoader?.getSprite(item.type),
                    editorPlaced: true
                };
                this.game.decorations.push(restoredDecor);
                // Remove from deletedItems
                this.deletedItems.delete(`${item.type}_${item.x}_${item.y}`);
                undoCount++;
            }
        }
        
        // Check if any undone items were path tiles — update persistent positions and rebuild
        const hadPathUndo = action.items.some(item => this.pathTileTypes.has(item.type));
        if (hadPathUndo) {
            // Sync persistent path positions: undone placements need removal, undone deletions need re-add
            const tileSize = CONSTANTS.TILE_SIZE;
            for (const item of action.items) {
                if (!this.pathTileTypes.has(item.type)) continue;
                const col = Math.floor(item.x / tileSize);
                const row = Math.floor(item.y / tileSize);
                if (item.actionType === 'place') {
                    // Undoing a placement — remove from persistent
                    this.game.removePathPosition(col, row, item.type);
                }
                // Undoing a deletion — the decoration is re-added to game.decorations,
                // buildPathTileLayer will pick it up automatically
            }
            this.schedulePathRebuild();
        }
        
        console.log(`↩️ Undid ${undoCount} item(s) - ${this.undoStack.length} undo steps remaining`);
    }
    
    pickAtPosition(x, y) {
        const tileSize = CONSTANTS.TILE_SIZE;
        const tolerance = tileSize;
        
        // Find decoration at position
        const decor = this.game.decorations.find(d => {
            return Math.abs(d.x - x) < tolerance && Math.abs(d.y - y) < tolerance;
        });
        
        if (decor) {
            // Find which category this asset belongs to
            for (const [catKey, cat] of Object.entries(this.categories)) {
                if (cat.assets.includes(decor.type)) {
                    this.selectedCategory = catKey;
                    this.container.querySelectorAll('.editor-tab').forEach(t => {
                        t.classList.toggle('active', t.dataset.category === catKey);
                    });
                    this.renderAssetPalette();
                    break;
                }
            }
            
            this.selectAsset(decor.type);
            console.log(`💉 Picked ${decor.type}`);
        }
    }
    
    // Get current location key (outdoor or building ID)
    getCurrentLocationKey() {
        if (this.game.currentLocation === 'outdoor') {
            return 'outdoor';
        } else if (this.game.currentBuilding) {
            // Use building position as unique ID
            return `interior_${this.game.currentBuilding.type}_${this.game.currentBuilding.x}_${this.game.currentBuilding.y}`;
        }
        return 'outdoor';
    }
    
    saveEdits() {
        // Load existing save data
        let allSaveData = {};
        try {
            const existing = localStorage.getItem('clawlands_map_edits_v2');
            if (existing) {
                allSaveData = JSON.parse(existing);
            }
        } catch (e) {}
        
        // Get current location
        const locationKey = this.getCurrentLocationKey();
        
        // Filter items for current location
        const locationPlaced = this.placedItems.filter(p => 
            (p.location || 'outdoor') === locationKey
        );
        const locationDeleted = Array.from(this.deletedItems).filter(d =>
            d.startsWith(locationKey + ':')
        );
        
        // Save to location-specific slot
        allSaveData[locationKey] = {
            placed: locationPlaced,
            deleted: locationDeleted,
            timestamp: Date.now()
        };
        
        localStorage.setItem('clawlands_map_edits_v2', JSON.stringify(allSaveData));
        console.log(`💾 Saved ${locationPlaced.length} items for ${locationKey}`);
        alert(`Saved ${locationPlaced.length} items for ${locationKey === 'outdoor' ? 'outdoor' : 'this interior'}!`);
    }
    
    loadSavedEdits() {
        this.loadEditsForLocation(this.getCurrentLocationKey());
    }
    
    loadEditsForLocation(locationKey) {
        try {
            const saved = localStorage.getItem('clawlands_map_edits_v2');
            if (!saved) return;
            
            const allData = JSON.parse(saved);
            const data = allData[locationKey];
            if (!data) return;
            
            // Restore placed items for this location
            if (data.placed) {
                for (const item of data.placed) {
                    // Check if already exists
                    const exists = this.game.decorations.some(d =>
                        d.x === item.x && d.y === item.y && d.type === item.type
                    );
                    if (exists) continue;
                    
                    // Get sprite
                    let sprite = null;
                    if (this.categories?.furniture?.assets?.includes(item.type)) {
                        sprite = this.game.interiorLoader?.getSprite(item.type);
                    } else {
                        sprite = this.game.decorationLoader?.getSprite(item.type);
                    }
                    
                    this.game.decorations.push({
                        ...item,
                        sprite: sprite,
                        editorPlaced: true
                    });
                    
                    // Track in placedItems if not already
                    if (!this.placedItems.some(p => p.x === item.x && p.y === item.y && p.type === item.type)) {
                        this.placedItems.push(item);
                    }
                }
            }
            
            // Restore deleted items tracking for this location
            if (data.deleted) {
                for (const key of data.deleted) {
                    this.deletedItems.add(key);
                }
                
                // Remove deleted items from game
                this.game.decorations = this.game.decorations.filter(d => {
                    const key = `${locationKey}:${d.type}_${d.x}_${d.y}`;
                    return !this.deletedItems.has(key);
                });
            }
            
            console.log(`📂 Loaded ${data.placed?.length || 0} items for ${locationKey}`);
        } catch (e) {
            console.warn('Failed to load map edits:', e);
        }
    }
    
    clearAll() {
        const locationKey = this.getCurrentLocationKey();
        const clearAll = confirm('Clear ALL editor changes (all locations)?\n\nClick OK to clear everything, or Cancel to clear just this location.');
        
        if (clearAll) {
            // Remove ALL editor-placed items
            this.game.decorations = this.game.decorations.filter(d => !d.editorPlaced);
            this.placedItems = [];
            this.deletedItems.clear();
            localStorage.removeItem('clawlands_map_edits');
            localStorage.removeItem('clawlands_map_edits_v2');
            console.log('🗑️ Cleared all editor changes (all locations)');
        } else {
            // Clear just current location
            this.game.decorations = this.game.decorations.filter(d => !d.editorPlaced);
            this.placedItems = this.placedItems.filter(p => p.location !== locationKey);
            
            // Remove from save
            try {
                const saved = localStorage.getItem('clawlands_map_edits_v2');
                if (saved) {
                    const allData = JSON.parse(saved);
                    delete allData[locationKey];
                    localStorage.setItem('clawlands_map_edits_v2', JSON.stringify(allData));
                }
            } catch (e) {}
            
            console.log(`🗑️ Cleared editor changes for ${locationKey}`);
        }
    }
    
    exportMap() {
        const exportData = {
            version: 2,
            location: this.getCurrentLocationKey(),
            decorations: this.game.decorations.map(d => ({
                x: d.x,
                y: d.y,
                type: d.type,
                width: d.width,
                height: d.height,
                layer: d.layer,
                ground: d.ground,
                editorPlaced: d.editorPlaced || false
            })),
            editorPlaced: this.placedItems,
            deleted: Array.from(this.deletedItems),
            timestamp: Date.now()
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.style.display = 'none';
        const loc = this.getCurrentLocationKey().replace(/[^a-z0-9]/g, '_');
        a.download = `clawlands_map_${loc}_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up after a short delay to ensure download starts
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log('📤 Exported map data (' + exportData.decorations.length + ' decorations)');
        console.log('📤 Export JSON:', jsonStr.slice(0, 500) + '...');
        alert('Map exported! Give the JSON file to Frank to merge into the game code.');
    }

    importMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (!data.decorations || !Array.isArray(data.decorations)) {
                        alert('Invalid map file — no decorations found.');
                        return;
                    }
                    
                    const count = data.decorations.length;
                    if (!confirm(`Import ${count} decorations from "${file.name}"?\n\nThis will replace current editor placements.`)) {
                        return;
                    }
                    
                    // Clear existing editor placements
                    this.game.decorations = this.game.decorations.filter(d => !d.editorPlaced);
                    this.placedItems = [];
                    
                    // Import editor-placed items
                    let imported = 0;
                    for (const item of data.decorations) {
                        if (item.editorPlaced) {
                            let sprite = null;
                            if (this.categories?.furniture?.assets?.includes(item.type)) {
                                sprite = this.game.interiorLoader?.getSprite(item.type);
                            } else {
                                sprite = this.game.decorationLoader?.getSprite(item.type);
                            }
                            
                            this.game.decorations.push({
                                ...item,
                                sprite: sprite,
                                editorPlaced: true
                            });
                            this.placedItems.push(item);
                            imported++;
                        }
                    }
                    
                    // Auto-save to localStorage
                    this.saveEdits();
                    
                    console.log(`📥 Imported ${imported} editor items from ${file.name}`);
                    alert(`Imported ${imported} decorations!`);
                } catch (err) {
                    alert('Failed to parse map file: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    // === PATH AUTO-TILING ===
    
    // Schedule a path tile layer rebuild (debounced for drag painting performance)
    schedulePathRebuild() {
        if (this.pathRebuildPending) return;
        this.pathRebuildPending = true;
        
        // Use requestAnimationFrame for instant visual feedback, but batch multiple calls
        requestAnimationFrame(() => {
            this.rebuildPathLayer();
            this.pathRebuildPending = false;
        });
    }
    
    // Rebuild the auto-tiled path layer from current decorations
    rebuildPathLayer() {
        if (!this.game.buildPathTileLayer) {
            console.warn('🗺️ Game.buildPathTileLayer not available');
            return;
        }
        
        // Rebuild with keepDecorations=true so the editor can still track/undo them
        this.game.buildPathTileLayer(true);
        console.log('🗺️ Path layer rebuilt for editor');
    }
    
    // Test: place decoration at player's feet (call from console with mapEditor.testPlace())
    testPlace() {
        const px = this.game.player.position.x;
        const py = this.game.player.position.y + 20; // Below player
        console.log(`🧪 Test placing shell_pink at player position (${px}, ${py})`);
        
        this.selectedAsset = 'shell_pink';
        this.selectedCategory = 'decorations';
        this.placeAsset(Math.floor(px), Math.floor(py));
    }
    
    // Render grid overlay (called from game render loop)
    renderGrid(ctx) {
        if (!this.enabled || !this.showGrid) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const camera = this.game.camera;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        const startX = Math.floor(camera.x / tileSize) * tileSize - camera.x;
        const startY = Math.floor(camera.y / tileSize) * tileSize - camera.y;
        
        const canvas = ctx.canvas;
        
        // Vertical lines
        for (let x = startX; x < canvas.width; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = startY; y < canvas.height; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapEditor;
}
