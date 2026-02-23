const fs = require('fs');
const DECORATIONS = require('./client/js/core/DecorationLoader.js').DECORATIONS;
const EDITOR_MAP_DATA = require('./client/js/data/EditorMapData.js');

let changed = 0;
for (let decor of EDITOR_MAP_DATA.decorations) {
    const def = DECORATIONS[decor.type];
    if (def) {
        if (decor.width !== def.width || decor.height !== def.height) {
            decor.width = def.width;
            decor.height = def.height;
            changed++;
        }
    }
}

if (changed > 0) {
    const output = `const EDITOR_MAP_DATA = ${JSON.stringify(EDITOR_MAP_DATA, null, 2)};\n\nif (typeof module !== 'undefined') {\n  module.exports = EDITOR_MAP_DATA;\n}\n`;
    fs.writeFileSync('./client/js/data/EditorMapData.js', output);
    console.log(`Updated ${changed} decorations with true sizes!`);
} else {
    console.log("No decorations needed updating.");
}
