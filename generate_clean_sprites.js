const https = require('https');
const fs = require('fs');

const OPENAI_API_KEY = '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';

async function generateSprite(prompt, filename) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard"
        });

        const options = {
            hostname: 'api.openai.com',
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        console.error(`Error: ${response.error.message}`);
                        reject(new Error(response.error.message));
                        return;
                    }
                    const imageUrl = response.data[0].url;
                    console.log(`Generated ${filename}, downloading...`);
                    
                    // Download the image
                    https.get(imageUrl, (imgRes) => {
                        const chunks = [];
                        imgRes.on('data', chunk => chunks.push(chunk));
                        imgRes.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            fs.writeFileSync(`client/assets/sprites/decorations/${filename}`, buffer);
                            console.log(`Saved ${filename}`);
                            resolve();
                        });
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    // Generate clean palm tree sprite
    await generateSprite(
        "Single pixel art palm tree sprite for a 2D Pokemon-style beach RPG game. 24x48 pixels scaled up. TOP-DOWN view, beach/tropical style. The tree should be on a completely transparent background (PNG transparency). Vibrant green fronds, brown trunk. Clean crisp pixel art, no anti-aliasing, no gradients. Single isolated sprite.",
        "palm_tree_new.png"
    );
    
    console.log('Done generating sprites');
}

main().catch(console.error);
