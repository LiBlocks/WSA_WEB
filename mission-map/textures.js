// Mission Map: small procedural surface textures, drawn on a canvas so the map needs no image downloads.
// Each body gets a pattern from its `look` in bodies.js. Noise is sampled on the sphere, so there is no seam.

function hash(x, y, z, seed) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 3D value noise, 0…1
function noise(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, seed);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
             l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

function fbm(x, y, z, seed, octaves) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x * f, y * f, z * f, seed + o * 17);
        norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
}

const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const clamp01 = t => Math.min(1, Math.max(0, t));
const smooth = (a, b, t) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };

/** Draws an equirectangular surface texture; returns a canvas */
export function surfaceCanvas(look, seed, size) {
    const w = size, h = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h), data = img.data;
    const base = rgb(look.base), accent = rgb(look.accent || look.base);
    const pattern = look.pattern || 'rock';
    for (let j = 0; j < h; j++) {
        const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
        for (let i = 0; i < w; i++) {
            const lon = (i + 0.5) / w * Math.PI * 2;
            const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
            let c;
            if (pattern === 'bands') {
                const n = fbm(x * 2.2, y * 2.2, z * 2.2, seed, 3);
                const band = 0.5 + 0.5 * Math.sin(lat * 15 + n * 5);
                c = shade(mix(base, accent, band * 0.75), 0.9 + 0.2 * n);
            } else if (pattern === 'swirl') {
                const n = fbm(x * 2.5, y * 2.5, z * 2.5, seed, 4);
                const s = 0.5 + 0.5 * Math.sin((lat + n * 1.6) * 9);
                c = mix(base, accent, clamp01(s * 1.2 - 0.1));
            } else if (pattern === 'cloud') {
                const n = fbm(x * 3, y * 3, z * 3, seed, 4);
                const band = 0.5 + 0.5 * Math.sin(lat * 6 + n * 4);
                c = mix(base, accent, clamp01(band * 0.6 + (n - 0.5) * 0.8));
            } else if (pattern === 'earth') {
                const n = fbm(x * 2.4, y * 2.4, z * 2.4, seed, 5);
                const sea = shade(base, 0.85 + 0.3 * n), land = mix(accent, [150, 130, 95], clamp01((n - 0.53) * 4));
                c = mix(sea, land, smooth(0.515, 0.545, n));                         // soft coastlines
                c = mix(c, [235, 242, 248], smooth(1.2, 1.3, Math.abs(lat) + 0.18 * n));   // polar ice
            } else if (pattern === 'ice') {
                const n = fbm(x * 3.2, y * 3.2, z * 3.2, seed, 4);
                const streak = Math.abs(Math.sin((x + n) * 7 + z * 3));
                c = mix(base, accent, clamp01(streak * 0.5 + (n - 0.5)));
            } else {
                const n = fbm(x * 3, y * 3, z * 3, seed, 5);
                const crater = fbm(x * 9, y * 9, z * 9, seed + 99, 2);
                c = shade(mix(base, accent, clamp01((n - 0.35) * 1.6)), 1 - 0.18 * smooth(0.64, 0.74, crater));
            }
            const k = (j * w + i) * 4;
            data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

/** Ring texture: a strip from inner (left) to outer (right) edge with gaps and varying density */
export function ringCanvas(look, seed) {
    const w = 256, canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = 1;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(w, 1);
    const base = rgb(look.accent || look.base);
    for (let i = 0; i < w; i++) {
        const t = i / (w - 1);
        let a = 0.25 + 0.55 * fbm(t * 14, 0.5, 0.5, seed, 3);
        if (t > 0.58 && t < 0.63) a *= 0.15;                 // a gap
        a *= Math.min(1, t * 8) * Math.min(1, (1 - t) * 10);   // soft edges
        img.data[i * 4] = base[0]; img.data[i * 4 + 1] = base[1]; img.data[i * 4 + 2] = base[2];
        img.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

/** Soft round glow, for the star */
export function glowCanvas(inner, outer) {
    const s = 128, canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return canvas;
}
