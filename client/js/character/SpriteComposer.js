// Character sprite composer - creates customized character sprites
// Supports hue shifting for color customization
class SpriteComposer {
    constructor() {
        this.baseSprites = new Map();
        this.accessories = new Map();
    }

    addBaseSprite(name, sprites) {
        this.baseSprites.set(name, sprites);
    }

    addAccessory(name, sprites) {
        this.accessories.set(name, sprites);
    }

    /**
     * Compose a customized character sprite
     * @param {Object} config - Customization config
     *   {
     *     baseSpriteKey: 'character',
     *     hueShift: 120, // degrees to shift hue (0 = no change)
     *     accessories: ['hat_sailor']
     *   }
     * @returns {HTMLCanvasElement} Combined sprite sheet (4 directions horizontal)
     */
    compose(config) {
        const baseSprites = this.baseSprites.get(config.baseSpriteKey);
        if (!baseSprites) {
            console.error(`Base sprite '${config.baseSpriteKey}' not found`);
            return null;
        }

        const directions = ['south', 'north', 'west', 'east'];
        const spriteWidth = baseSprites.south.width;
        const spriteHeight = baseSprites.south.height;

        const canvas = document.createElement('canvas');
        canvas.width = spriteWidth * 4;
        canvas.height = spriteHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        directions.forEach((dir, index) => {
            const baseImage = baseSprites[dir];
            if (!baseImage) return;

            const x = index * spriteWidth;

            // Apply hue shift if specified
            if (config.hueShift && config.hueShift !== 0) {
                const shiftedImage = this.applyHueShift(baseImage, config.hueShift);
                ctx.drawImage(shiftedImage, x, 0);
            } else {
                ctx.drawImage(baseImage, x, 0);
            }

            // Draw accessories on top (no hue shift on accessories)
            if (config.accessories && config.accessories.length > 0) {
                for (const accessoryKey of config.accessories) {
                    const accessorySprites = this.accessories.get(accessoryKey);
                    if (accessorySprites && accessorySprites[dir]) {
                        ctx.drawImage(accessorySprites[dir], x, 0);
                    }
                }
            }
        });

        return canvas;
    }

    /**
     * Apply hue shift to red pixels only
     * @param {HTMLImageElement|HTMLCanvasElement} image - Source image
     * @param {number} hueShift - Degrees to shift (0-360)
     * @returns {HTMLCanvasElement} Shifted image
     */
    applyHueShift(image, hueShift) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0);

        if (hueShift === 0) return canvas;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            // Convert to HSL
            const hsl = this.rgbToHsl(r, g, b);

            // Only shift reddish colors (hue near 0 or near 360)
            // Red: 0°, Orange: 30°, Pink: 330°
            const isReddish = hsl.h < 40 || hsl.h > 320;
            if (!isReddish) continue;

            // Apply hue shift
            hsl.h = (hsl.h + hueShift) % 360;
            if (hsl.h < 0) hsl.h += 360;

            // Convert back to RGB
            const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Convert RGB to HSL
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    /**
     * Convert HSL to RGB
     */
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // Legacy method for backward compatibility
    applyColorTint(image, config) {
        if (config.hueShift) {
            return this.applyHueShift(image, config.hueShift);
        }
        // Fallback - just return copy
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0);
        return canvas;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    static fromImages(images, config = {}) {
        const composer = new SpriteComposer();
        composer.addBaseSprite('character', images);
        return composer.compose({
            baseSpriteKey: 'character',
            ...config
        });
    }
}
