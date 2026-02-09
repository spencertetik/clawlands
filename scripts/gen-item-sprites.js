/**
 * Generate 32×32 pixel art item sprites for the inventory system.
 * Each item gets a distinct, recognizable icon drawn on a transparent background.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'client', 'assets', 'sprites', 'items');

function drawPixel(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawOutline(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
}

function saveSprite(name, canvas) {
    const outPath = path.join(OUT_DIR, `${name}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);
    console.log(`  ✅ ${name}.png (${buf.length} bytes)`);
}

function makeCanvas() {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    return { c, ctx };
}

// ========== ITEM SPRITES ==========

function brineElixir() {
    const { c, ctx } = makeCanvas();
    // Potion bottle — glass with blue-green liquid
    // Bottle body
    drawRect(ctx, 12, 10, 8, 14, '#1a6b5a'); // dark teal fill
    drawRect(ctx, 13, 11, 6, 12, '#2dd4a8'); // bright teal
    drawRect(ctx, 14, 12, 4, 4, '#6ff5d8');  // highlight
    // Bottle neck
    drawRect(ctx, 14, 6, 4, 5, '#6b7280');   // gray glass
    drawRect(ctx, 15, 7, 2, 3, '#9ca3af');   // highlight
    // Cork
    drawRect(ctx, 14, 5, 4, 2, '#92400e');   // brown cork
    // Bottom
    drawRect(ctx, 11, 24, 10, 2, '#1a6b5a');
    saveSprite('brine_elixir', c);
}

function brinehooksLetter() {
    const { c, ctx } = makeCanvas();
    // Sealed letter/envelope
    drawRect(ctx, 6, 8, 20, 16, '#d4a574');  // parchment
    drawRect(ctx, 7, 9, 18, 14, '#e8c99b');  // lighter inner
    // Fold line
    drawRect(ctx, 8, 15, 16, 1, '#c4956a');
    // Wax seal (red circle)
    drawRect(ctx, 13, 18, 6, 5, '#c43a24');
    drawRect(ctx, 14, 17, 4, 1, '#c43a24');
    drawRect(ctx, 14, 23, 4, 1, '#c43a24');
    drawPixel(ctx, 15, 20, '#e87461');        // seal highlight
    saveSprite('brinehooks_letter', c);
}

function clawBlade() {
    const { c, ctx } = makeCanvas();
    // Curved claw-shaped blade
    // Handle
    drawRect(ctx, 14, 22, 4, 6, '#92400e');  // brown handle
    drawRect(ctx, 15, 23, 2, 4, '#b45309');  // handle highlight
    // Guard
    drawRect(ctx, 11, 20, 10, 2, '#c4956a');
    // Blade (angled upward) — coral-colored
    drawRect(ctx, 14, 6, 4, 14, '#e87461');  // blade
    drawRect(ctx, 15, 4, 3, 3, '#e87461');   // tip
    drawRect(ctx, 13, 8, 1, 8, '#c43a24');   // edge shadow
    drawRect(ctx, 15, 5, 2, 10, '#f5a89a');  // blade highlight
    // Tip
    drawPixel(ctx, 16, 3, '#f5a89a');
    saveSprite('claw_blade', c);
}

function coconutWater() {
    const { c, ctx } = makeCanvas();
    // Half coconut with liquid
    drawRect(ctx, 8, 12, 16, 12, '#92400e');  // brown shell
    drawRect(ctx, 9, 13, 14, 10, '#b45309');  // lighter brown
    drawRect(ctx, 10, 14, 12, 4, '#a3e8f0');  // water surface
    drawRect(ctx, 11, 15, 10, 2, '#67d4e0');  // water
    // Straw
    drawRect(ctx, 18, 6, 2, 12, '#fbbf24');
    drawPixel(ctx, 19, 5, '#fbbf24');
    // Shell edge
    drawRect(ctx, 8, 11, 16, 1, '#78350f');
    saveSprite('coconut_water', c);
}

function dockWrench() {
    const { c, ctx } = makeCanvas();
    // Heavy wrench
    // Handle
    drawRect(ctx, 14, 16, 4, 12, '#6b7280');  // gray
    drawRect(ctx, 15, 17, 2, 10, '#9ca3af');  // highlight
    // Wrench head (top)
    drawRect(ctx, 10, 4, 12, 6, '#6b7280');
    drawRect(ctx, 10, 4, 3, 6, '#4b5563');    // left jaw
    drawRect(ctx, 19, 4, 3, 6, '#4b5563');    // right jaw
    drawRect(ctx, 13, 5, 6, 4, '#9ca3af');    // inner
    // Opening
    drawRect(ctx, 14, 4, 4, 2, 'rgba(0,0,0,0)');
    ctx.clearRect(14, 4, 4, 2);
    saveSprite('dock_wrench', c);
}

function driftEssence() {
    const { c, ctx } = makeCanvas();
    // Glowing vial with swirling red
    // Vial body
    drawRect(ctx, 12, 10, 8, 14, '#7f1d1d');  // dark red
    drawRect(ctx, 13, 11, 6, 12, '#c43a24');  // red
    drawRect(ctx, 14, 12, 3, 4, '#ef4444');   // glow
    drawPixel(ctx, 15, 13, '#fca5a5');         // bright center
    // Swirl effect
    drawPixel(ctx, 14, 18, '#ef4444');
    drawPixel(ctx, 16, 16, '#fca5a5');
    drawPixel(ctx, 13, 14, '#ef4444');
    // Vial neck
    drawRect(ctx, 14, 6, 4, 5, '#6b7280');
    drawRect(ctx, 15, 7, 2, 3, '#9ca3af');
    // Stopper
    drawRect(ctx, 13, 5, 6, 2, '#f59e0b');    // gold stopper
    saveSprite('drift_essence', c);
}

function enchantedPearl() {
    const { c, ctx } = makeCanvas();
    // Shimmering multi-color pearl
    // Pearl body (circle approximation)
    drawRect(ctx, 11, 10, 10, 12, '#e8d5cc');
    drawRect(ctx, 10, 11, 12, 10, '#e8d5cc');
    drawRect(ctx, 12, 9, 8, 1, '#e8d5cc');
    drawRect(ctx, 12, 22, 8, 1, '#e8d5cc');
    // Color shift patches
    drawRect(ctx, 12, 12, 3, 3, '#a78bfa');   // purple
    drawRect(ctx, 16, 14, 3, 3, '#67e8f9');   // cyan
    drawRect(ctx, 13, 17, 3, 2, '#fbbf24');   // gold
    // Highlight
    drawRect(ctx, 13, 11, 2, 2, '#ffffff');
    // Glow dots around
    drawPixel(ctx, 9, 9, '#a78bfa');
    drawPixel(ctx, 22, 11, '#67e8f9');
    drawPixel(ctx, 10, 20, '#fbbf24');
    drawPixel(ctx, 21, 19, '#a78bfa');
    saveSprite('enchanted_pearl', c);
}

function hazeWisp() {
    const { c, ctx } = makeCanvas();
    // Wispy ghost-like fragment
    drawRect(ctx, 12, 8, 8, 10, 'rgba(168, 162, 200, 0.8)');
    drawRect(ctx, 11, 10, 10, 6, 'rgba(168, 162, 200, 0.6)');
    drawRect(ctx, 14, 7, 4, 2, 'rgba(200, 196, 230, 0.7)');
    // Wispy trails downward
    drawRect(ctx, 11, 18, 2, 4, 'rgba(168, 162, 200, 0.4)');
    drawRect(ctx, 15, 18, 2, 5, 'rgba(168, 162, 200, 0.5)');
    drawRect(ctx, 19, 18, 2, 3, 'rgba(168, 162, 200, 0.3)');
    // Eyes
    drawPixel(ctx, 14, 12, '#ffffff');
    drawPixel(ctx, 17, 12, '#ffffff');
    // Glow center
    drawPixel(ctx, 15, 11, '#e0dff0');
    drawPixel(ctx, 16, 11, '#e0dff0');
    saveSprite('haze_wisp', c);
}

function kelpSalve() {
    const { c, ctx } = makeCanvas();
    // Small jar with green salve
    // Jar body
    drawRect(ctx, 10, 12, 12, 12, '#6b7280');  // gray jar
    drawRect(ctx, 11, 13, 10, 10, '#9ca3af');  // lighter
    // Green contents visible
    drawRect(ctx, 12, 14, 8, 6, '#166534');    // dark green
    drawRect(ctx, 13, 15, 6, 4, '#22c55e');    // green salve
    drawRect(ctx, 14, 16, 3, 2, '#86efac');    // highlight
    // Lid
    drawRect(ctx, 9, 10, 14, 3, '#78350f');    // brown lid
    drawRect(ctx, 10, 11, 12, 1, '#92400e');
    saveSprite('kelp_salve', c);
}

function loopCrystal() {
    const { c, ctx } = makeCanvas();
    // Geometric crystal with infinite reflection
    // Diamond shape
    const cx = 16, cy = 14;
    drawRect(ctx, cx-1, cy-6, 2, 12, '#818cf8'); // vertical
    drawRect(ctx, cx-3, cy-4, 6, 8, '#818cf8');  // wider middle
    drawRect(ctx, cx-5, cy-2, 10, 4, '#818cf8'); // widest
    // Inner facets
    drawRect(ctx, cx-2, cy-3, 4, 6, '#a5b4fc');
    drawRect(ctx, cx-1, cy-1, 2, 2, '#c7d2fe');  // bright center
    // Infinity symbol hint (two small dots)
    drawPixel(ctx, cx-3, cy, '#e0e7ff');
    drawPixel(ctx, cx+2, cy, '#e0e7ff');
    // Sparkles
    drawPixel(ctx, cx-5, cy-5, '#c7d2fe');
    drawPixel(ctx, cx+5, cy-4, '#c7d2fe');
    saveSprite('loop_crystal', c);
}

function lumensLantern() {
    const { c, ctx } = makeCanvas();
    // Miniature lighthouse lantern — glowing
    // Lantern body (hexagonal-ish)
    drawRect(ctx, 12, 10, 8, 10, '#fbbf24');   // gold frame
    drawRect(ctx, 13, 11, 6, 8, '#fef3c7');    // glass
    // Light glow
    drawRect(ctx, 14, 12, 4, 4, '#ffffff');
    drawRect(ctx, 15, 13, 2, 2, '#fef9c3');
    // Top
    drawRect(ctx, 14, 7, 4, 3, '#92400e');     // top cap
    drawRect(ctx, 15, 5, 2, 3, '#b45309');     // finial
    drawPixel(ctx, 15, 4, '#fbbf24');
    // Handle
    drawRect(ctx, 11, 8, 1, 4, '#92400e');
    drawRect(ctx, 20, 8, 1, 4, '#92400e');
    drawRect(ctx, 11, 8, 10, 1, '#92400e');
    // Bottom
    drawRect(ctx, 12, 20, 8, 3, '#92400e');
    // Glow rays
    drawPixel(ctx, 10, 14, '#fef3c7');
    drawPixel(ctx, 21, 14, '#fef3c7');
    drawPixel(ctx, 16, 6, '#fef3c7');
    saveSprite('lumens_lantern', c);
}

function moonstoneSprite() {
    const { c, ctx } = makeCanvas();
    // Pale glowing oval stone
    drawRect(ctx, 10, 10, 12, 10, '#d1d5db');
    drawRect(ctx, 9, 11, 14, 8, '#e5e7eb');
    drawRect(ctx, 11, 9, 10, 1, '#d1d5db');
    drawRect(ctx, 11, 20, 10, 1, '#d1d5db');
    // Inner glow
    drawRect(ctx, 12, 12, 8, 6, '#f3f4f6');
    drawRect(ctx, 14, 13, 4, 3, '#ffffff');
    // Faint blue tint
    drawPixel(ctx, 13, 14, '#bfdbfe');
    drawPixel(ctx, 17, 13, '#dbeafe');
    // Glow aura
    drawPixel(ctx, 8, 14, '#e5e7eb');
    drawPixel(ctx, 23, 15, '#e5e7eb');
    saveSprite('moonstone', c);
}

function oldMapFragment() {
    const { c, ctx } = makeCanvas();
    // Torn piece of map/parchment with markings
    drawRect(ctx, 6, 6, 20, 18, '#d4a574');   // parchment
    drawRect(ctx, 7, 7, 18, 16, '#e8c99b');   // inner
    // Torn edge (right side irregular)
    ctx.clearRect(24, 6, 2, 4);
    ctx.clearRect(25, 10, 1, 3);
    ctx.clearRect(23, 20, 3, 4);
    // Map markings (lines/dots)
    drawRect(ctx, 9, 10, 8, 1, '#92400e');     // path line
    drawRect(ctx, 14, 10, 1, 6, '#92400e');    // vertical line
    drawPixel(ctx, 10, 14, '#c43a24');          // X mark
    drawPixel(ctx, 12, 14, '#c43a24');
    drawPixel(ctx, 11, 13, '#c43a24');
    drawPixel(ctx, 11, 15, '#c43a24');
    // Water squiggles
    drawPixel(ctx, 18, 12, '#3b82f6');
    drawPixel(ctx, 19, 13, '#3b82f6');
    drawPixel(ctx, 20, 12, '#3b82f6');
    saveSprite('old_map_fragment', c);
}

function redEssence() {
    const { c, ctx } = makeCanvas();
    // Drop of solidified Red Current
    // Teardrop shape
    drawRect(ctx, 14, 8, 4, 2, '#991b1b');
    drawRect(ctx, 13, 10, 6, 4, '#c43a24');
    drawRect(ctx, 12, 14, 8, 4, '#c43a24');
    drawRect(ctx, 11, 16, 10, 4, '#dc2626');
    drawRect(ctx, 12, 20, 8, 2, '#c43a24');
    drawRect(ctx, 13, 22, 6, 1, '#991b1b');
    // Inner glow/pulse
    drawRect(ctx, 14, 14, 4, 4, '#ef4444');
    drawRect(ctx, 15, 15, 2, 2, '#fca5a5');
    // Pulsing dots
    drawPixel(ctx, 14, 12, '#fca5a5');
    saveSprite('red_essence', c);
}

function sandyBread() {
    const { c, ctx } = makeCanvas();
    // Round bread loaf
    drawRect(ctx, 8, 14, 16, 8, '#b45309');   // dark bottom
    drawRect(ctx, 7, 12, 18, 6, '#d97706');   // middle
    drawRect(ctx, 8, 10, 16, 4, '#f59e0b');   // top crust
    drawRect(ctx, 10, 9, 12, 2, '#fbbf24');   // top highlight
    // Score marks on top
    drawRect(ctx, 12, 11, 1, 3, '#b45309');
    drawRect(ctx, 16, 11, 1, 3, '#b45309');
    drawRect(ctx, 20, 11, 1, 3, '#b45309');
    // Sandy specks
    drawPixel(ctx, 10, 13, '#fcd34d');
    drawPixel(ctx, 18, 15, '#fcd34d');
    drawPixel(ctx, 14, 17, '#fcd34d');
    saveSprite('sandy_bread', c);
}

function seaweedSoup() {
    const { c, ctx } = makeCanvas();
    // Bowl with green soup
    // Bowl
    drawRect(ctx, 7, 14, 18, 8, '#78350f');   // brown bowl
    drawRect(ctx, 8, 15, 16, 6, '#92400e');   // inner
    // Soup surface
    drawRect(ctx, 9, 13, 14, 4, '#166534');    // dark green
    drawRect(ctx, 10, 14, 12, 2, '#22c55e');   // green soup
    // Seaweed bits
    drawPixel(ctx, 11, 13, '#15803d');
    drawPixel(ctx, 15, 14, '#15803d');
    drawPixel(ctx, 18, 13, '#15803d');
    // Steam wisps
    drawPixel(ctx, 13, 10, '#d1d5db');
    drawPixel(ctx, 16, 9, '#e5e7eb');
    drawPixel(ctx, 14, 8, '#d1d5db');
    // Bowl rim
    drawRect(ctx, 6, 13, 20, 1, '#92400e');
    saveSprite('seaweed_soup', c);
}

function shellFragment() {
    const { c, ctx } = makeCanvas();
    // Broken shell piece — angular
    drawRect(ctx, 10, 10, 10, 8, '#e8d5cc');
    drawRect(ctx, 12, 8, 8, 4, '#d4c4b4');
    drawRect(ctx, 8, 14, 6, 6, '#d4c4b4');
    // Inner pattern
    drawRect(ctx, 12, 12, 6, 4, '#f5ebe0');
    drawPixel(ctx, 14, 13, '#ffffff');
    // Jagged edges
    ctx.clearRect(10, 10, 2, 2);
    ctx.clearRect(18, 16, 2, 2);
    // Warm tint
    drawPixel(ctx, 11, 15, '#fca5a5');
    saveSprite('shell_fragment', c);
}

function tideHammer() {
    const { c, ctx } = makeCanvas();
    // Big hammer with tidal energy
    // Handle
    drawRect(ctx, 15, 16, 3, 12, '#78350f');
    drawRect(ctx, 16, 17, 1, 10, '#92400e');
    // Hammer head — wide block
    drawRect(ctx, 8, 6, 16, 10, '#4b5563');   // dark metal
    drawRect(ctx, 9, 7, 14, 8, '#6b7280');    // gray
    drawRect(ctx, 10, 8, 4, 6, '#9ca3af');    // left face
    drawRect(ctx, 18, 8, 4, 6, '#9ca3af');    // right face
    // Tidal energy glow
    drawRect(ctx, 13, 9, 6, 4, '#3b82f6');
    drawPixel(ctx, 15, 10, '#93c5fd');
    drawPixel(ctx, 16, 10, '#93c5fd');
    // Energy sparks
    drawPixel(ctx, 7, 8, '#60a5fa');
    drawPixel(ctx, 24, 10, '#60a5fa');
    saveSprite('tide_hammer', c);
}

function tornJournalPage() {
    const { c, ctx } = makeCanvas();
    // Single torn page with writing
    drawRect(ctx, 8, 6, 16, 20, '#e8d5cc');   // page
    drawRect(ctx, 9, 7, 14, 18, '#f5ebe0');   // lighter inner
    // Text lines
    for (let y = 9; y < 22; y += 2) {
        const w = 8 + Math.floor(Math.random() * 5);
        drawRect(ctx, 10, y, w, 1, '#92400e');
    }
    // Torn edge (bottom)
    ctx.clearRect(8, 24, 3, 2);
    ctx.clearRect(20, 23, 4, 3);
    ctx.clearRect(14, 25, 2, 1);
    // Frantic scrawl at bottom
    drawRect(ctx, 10, 21, 10, 1, '#c43a24');
    drawRect(ctx, 11, 22, 8, 1, '#c43a24');
    saveSprite('torn_journal_page', c);
}

// ========== GENERATE ALL ==========

console.log('Generating inventory item sprites (32×32)...\n');

brineElixir();
brinehooksLetter();
clawBlade();
coconutWater();
dockWrench();
driftEssence();
enchantedPearl();
hazeWisp();
kelpSalve();
loopCrystal();
lumensLantern();
moonstoneSprite();
oldMapFragment();
redEssence();
sandyBread();
seaweedSoup();
shellFragment();
tideHammer();
tornJournalPage();

console.log('\nDone! All inventory sprites generated.');
