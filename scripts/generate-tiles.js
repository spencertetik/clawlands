const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY || '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';

const OUTPUT_DIR = path.join(__dirname, '../client/assets/sprites');

async function generateImage(prompt, filename) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard'
        });

        const options = {
            hostname: 'api.openai.com',
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': data.length
            }
        };

        console.log(`Generating: ${filename}...`);

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', async () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        reject(new Error(response.error.message));
                        return;
                    }
                    
                    const imageUrl = response.data[0].url;
                    console.log(`  Generated! Downloading...`);
                    
                    // Download the image
                    await downloadImage(imageUrl, filename);
                    console.log(`  ✓ Saved: ${filename}`);
                    resolve(filename);
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const filepath = path.join(OUTPUT_DIR, 'interior', filename);
            
            // Ensure directory exists
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
            
            const fileStream = fs.createWriteStream(filepath);
            res.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.log('=== Generating Individual Floor Tiles ===\n');
    
    const tiles = [
        {
            filename: 'wood_floor_tile.png',
            prompt: 'A seamless tileable wooden plank floor texture for a pixel art RPG game. Warm brown wood planks running vertically. The texture fills the entire square image and tiles seamlessly on all edges. Pixel art style, 16-bit retro game aesthetic. No borders, no frames - just the wood texture filling the whole image. Solid simple design that repeats perfectly.'
        },
        {
            filename: 'stone_floor_tile.png', 
            prompt: 'A seamless tileable stone cobblestone floor texture for a pixel art RPG game. Gray and blue-gray rounded cobblestones fitted together. The texture fills the entire square image and tiles seamlessly on all edges. Pixel art style, 16-bit retro game aesthetic. No borders, no frames - just the stone texture filling the whole image. Solid simple design that repeats perfectly.'
        }
    ];
    
    for (const tile of tiles) {
        try {
            await generateImage(tile.prompt, tile.filename);
        } catch (err) {
            console.error(`  ✗ Failed: ${tile.filename} - ${err.message}`);
        }
    }
    
    console.log('\n=== Done ===');
}

main().catch(console.error);
