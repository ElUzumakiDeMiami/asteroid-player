
// Lightweight color extractor
export const extractDominantColor = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('168, 85, 247'); // Default purple
                return;
            }

            // Scale down for performance
            canvas.width = 50;
            canvas.height = 50;
            
            ctx.drawImage(img, 0, 0, 50, 50);
            
            try {
                const imageData = ctx.getImageData(0, 0, 50, 50).data;
                let r = 0, g = 0, b = 0, count = 0;
                
                // Simple average (skip transparent or very dark/white pixels)
                for (let i = 0; i < imageData.length; i += 4) {
                    const cr = imageData[i];
                    const cg = imageData[i + 1];
                    const cb = imageData[i + 2];
                    const ca = imageData[i + 3];

                    if (ca < 200) continue; // Skip transparent
                    
                    // Skip very dark or very white (keep saturation)
                    const brightness = (cr + cg + cb) / 3;
                    if (brightness < 40 || brightness > 230) continue;

                    r += cr;
                    g += cg;
                    b += cb;
                    count++;
                }

                if (count > 0) {
                    r = Math.round(r / count);
                    g = Math.round(g / count);
                    b = Math.round(b / count);
                    
                    // Boost saturation slightly
                    const max = Math.max(r, g, b);
                    if (max === r) r = Math.min(255, r + 20);
                    if (max === g) g = Math.min(255, g + 20);
                    if (max === b) b = Math.min(255, b + 20);

                    resolve(`${r}, ${g}, ${b}`);
                } else {
                    resolve('168, 85, 247');
                }
            } catch (e) {
                resolve('168, 85, 247');
            }
        };

        img.onerror = () => {
            resolve('168, 85, 247');
        };
    });
};
