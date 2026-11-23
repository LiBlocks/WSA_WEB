// Seeded randomness: the universe is the same on every visit and between interactions. Each layer takes
// its own stream (seed + name), so adding a layer never reshuffles another.

// mulberry32: small, fast, good enough for placing stars
export function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = list => list[Math.floor(next() * list.length)];
    // Gaussian (Box-Muller)
    next.normal = () => {
        let u = 0;
        while (u === 0) u = next();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    };
    return next;
}

// A stable 32-bit seed from a string
export function seedOf(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export const UNIVERSE_SEED = 'WSA-2.0';
export const stream = name => rng(seedOf(UNIVERSE_SEED + ':' + name));
