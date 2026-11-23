// Homepage preferences, kept in localStorage next to the site's other settings. Every read survives storage
// being unavailable (private windows): the defaults apply.
//
//   version    'v1' | 'v2'                  which homepage (home/boot.js reads it before the first paint)
//   effects    'full' | 'reduced' | 'off'   the 3D background
//   intensity  0..100                       how much the universe moves (unset: 60, or 0 with reduced motion)
//   quality    'auto' | 'high' | 'ultra'    graphics quality
//   sound      'on' | 'off'                 ambient sound (off unless turned on)
//   guide      'done'                       the WSA Guide has been completed or skipped
//   found      comma list                   Explore mode discoveries

const KEYS = {
    version: 'wsa-home-version', effects: 'wsa-home-effects', intensity: 'wsa-home-intensity', quality: 'wsa-home-quality',
    sound: 'wsa-home-sound', guide: 'wsa-home-guide', found: 'wsa-home-found',
};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function read(key) {
    try { return localStorage.getItem(KEYS[key]); } catch (e) { return null; }
}

function write(key, value) {
    try {
        if (value === null || value === undefined) localStorage.removeItem(KEYS[key]);
        else localStorage.setItem(KEYS[key], String(value));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('wsa-home-prefs', { detail: { key } }));
}

export const prefs = {
    reducedMotion,
    version: () => (read('version') === 'v1' ? 'v1' : 'v2'),
    effects: () => (/^(full|reduced|off)$/.test(read('effects')) ? read('effects') : 'full'),
    quality: () => (/^(auto|high|ultra)$/.test(read('quality')) ? read('quality') : 'auto'),
    // An intensity the visitor chose wins over the system's reduced-motion preference
    intensity: () => {
        const v = parseInt(read('intensity'), 10);
        if (Number.isFinite(v)) return Math.max(0, Math.min(100, v));
        return reducedMotion.matches ? 0 : 60;
    },
    intensityChosen: () => Number.isFinite(parseInt(read('intensity'), 10)),
    sound: () => read('sound') === 'on',
    guideDone: () => read('guide') === 'done',
    found: () => (read('found') || '').split(',').filter(Boolean),
    set: write,
    // Back to the defaults (the version, the guide and the discoveries are left as they are)
    reset() {
        ['effects', 'intensity', 'quality', 'sound'].forEach(k => {
            try { localStorage.removeItem(KEYS[k]); } catch (e) {}
        });
        window.dispatchEvent(new CustomEvent('wsa-home-prefs', { detail: { key: 'reset' } }));
    },
};
