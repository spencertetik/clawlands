#!/usr/bin/env node
// Script to replace all emoji icons in ItemData.js with colored dot/square system

const fs = require('fs');

// Color mapping based on rarity and category
const rarityColors = {
    'common': '#8a7068',     // muted brown
    'uncommon': '#4a9eff',   // blue  
    'rare': '#a855f7',       // purple
    'epic': '#f59e0b',       // orange
    'legendary': '#c43a24',  // red
};

const categoryColors = {
    'materials': '#8a7068',
    'food': '#4ade80',
    'quest': '#a855f7',
    'treasure': '#f59e0b',
    'weapons': '#c43a24',
    'tools': '#6b7280'
};

// Read the ItemData.js file
const filePath = '/Users/spencertetik/.claude/projects/lobster-rpg/client/js/data/ItemData.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all emoji icons with '●' (will be colored by CSS based on rarity/category)
// This regex finds lines like: icon: '🪵',
content = content.replace(/icon:\s*'[^']*',/g, "icon: '●',");

// Write the modified content back
fs.writeFileSync(filePath, content);
console.log('✅ Replaced all emoji icons in ItemData.js with colored dots');