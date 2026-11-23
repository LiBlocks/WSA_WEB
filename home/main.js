// The WSA 2.0 homepage: a live Kerbol system behind the page (home/universe/), wired to the page's
// scrolling, its menu and the visitor's pointer, with the WSA Guide, Explore mode and the homepage's
// settings. On the original homepage (WSA 1.0, chosen in Settings) only the settings entry that brings 2.0
// back is added: nothing else runs.
//
// Everything degrades: no WebGL, a failed module or the background turned off leave the still sky
// (home/home.css), and the page itself never depends on the universe.
import { prefs } from './prefs.js';
import { SCROLL_PATH, NAV_MOODS, MOODS } from './universe/environments.js';
import { initSettings } from './settings.js';
import { AmbientSound } from './sound.js';

const root = document.documentElement;
const isV2 = () => root.classList.contains('home-v2');
const theme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

const state = {
    universe: null, starting: null, host: null, label: null, offs: [], sections: [],
    navMood: Object.fromEntries(MOODS.map(m => [m, 0])), scrollMood: Object.fromEntries(MOODS.map(m => [m, 0])),
    hoverId: null, introBusy: false, explore: null, guide: null, retried: false, gen: 0,
};

function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    state.offs.push(() => target.removeEventListener(type, fn, opts));
}

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
    } catch (e) {
        return false;
    }
}

// ---------- the universe ----------

async function startUniverse() {
    if (state.universe || state.starting || !isV2()) return;
    const effects = prefs.effects();
    root.setAttribute('data-home-effects', effects);
    if (effects === 'off') return;
    if (!webglAvailable()) {
        root.setAttribute('data-home-webgl', 'unavailable');
        return;
    }
    const gen = ++state.gen;
    const job = (async () => {
        try {
            const { Universe } = await import('./universe/engine.js');
            if (!isV2() || gen !== state.gen) return;
            const u = await Universe.create(state.host, {
                quality: effects === 'reduced' ? 'low' : prefs.quality(),
                effects,
                intensity: prefs.intensity() / 100,
                theme: theme(),
            });
            // Turned off, switched to 1.0 or restarted while it was starting: this one is not needed
            if (!isV2() || gen !== state.gen) { u.dispose(); return; }
            state.universe = u;
            window.__wsaUniverse = u;          // for the browser tests
            u.setSuspended(state.introBusy);
            u.on('ready', () => { if (!state.introBusy) state.host.classList.add('is-live'); });
            if (u.firstFrame && !state.introBusy) state.host.classList.add('is-live');
            u.on('lost', () => {
                // The graphics context went away (a driver reset, too many contexts): the still sky takes over
                stopUniverse();
                if (!state.retried) {
                    state.retried = true;
                    setTimeout(() => { if (isV2()) startUniverse(); }, 2000);
                }
            });
            u.on('slow', q => {
                if (prefs.quality() === 'auto' && u.quality !== q) rebuild();
            });
            measureSections();
            onScroll();
            pushMoods();
        } catch (e) {
            if (gen === state.gen) {
                console.warn('WSA universe unavailable:', e);
                root.setAttribute('data-home-webgl', 'failed');
                stopUniverse();
            }
        } finally {
            if (state.starting === job) state.starting = null;
        }
    })();
    state.starting = job;
    return job;
}

function stopUniverse() {
    state.gen++;
    if (state.explore) state.explore.exit(true);
    if (state.universe) {
        state.universe.dispose();
        state.universe = null;
        window.__wsaUniverse = null;
    }
    if (state.host) state.host.classList.remove('is-live');
}

async function rebuild() {
    if (state.starting) await state.starting;
    const focus = state.explore && state.explore.active ? state.explore.focusId : null;
    stopUniverse();
    await startUniverse();
    if (focus && state.universe && state.explore) state.explore.enter(focus);
}

// ---------- the page drives it ----------
//
// Desktop (a mouse or trackpad and a wide window): the universe changes when the visitor moves into another
// section, and stays put while they read within one. Phones and tablets: it slides along with the finger.
// Either way the camera's springs (universe/camera.js) answer at once and settle smoothly.
const sectionMode = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
const follow = () => (sectionMode.matches ? 'sections' : 'scroll');

// The viewport height that doesn't change while a phone's toolbar slides in and out (innerHeight does)
const viewHeight = () => document.documentElement.clientHeight || innerHeight;

// Where each section sits (page coordinates), and the part of the screen its panels leave free for the camera
function measureSections() {
    state.viewH = viewHeight();
    state.sections = SCROLL_PATH.map(s => {
        const el = document.querySelector(s.section);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { mid: r.top + scrollY + r.height / 2, top: r.top + scrollY, mood: s.mood };
    });
    if (state.universe) {
        state.universe.setRegions(measureRegions());
        syncGlass();
    }
}

// The panels whose rims bend the universe (universe/glass.js), with Liquid Glass on. Each gets a canvas of its own
// (home/home.css .home-glass-rim) that the scene copies its rim into, so the rim moves with the panel exactly as the
// page scrolls; it is measured in page coordinates.
const GLASS = '.home-pane:not(.featured-programs > .home-pane), .featured-programs .program-card';
function syncGlass() {
    const u = state.universe;
    if (!u) return;
    const on = root.hasAttribute('data-liquid-glass');
    const els = [...document.querySelectorAll(GLASS)];
    if (!on) {
        els.forEach(e => { const c = e.querySelector(':scope > .home-glass-rim'); if (c) c.remove(); });
        u.setGlass([], false);
        return;
    }
    const panes = els.filter(e => e.getClientRects().length).map(e => {
        let c = e.querySelector(':scope > .home-glass-rim');
        if (!c) {
            c = document.createElement('canvas');
            c.className = 'home-glass-rim';
            c.setAttribute('aria-hidden', 'true');
            e.prepend(c);
        }
        const r = c.getBoundingClientRect();
        const radius = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
        return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: Math.max(0, radius - 1), canvas: c };
    });
    u.setGlass(panes, true);
}

// For each section with panels to avoid: the larger free band beside them (wide screens), or the space above
// the hero's content (portrait screens), as fractions of the view. Too narrow a band gives no region, and the
// pose keeps its authored composition.
function measureRegions() {
    const W = document.documentElement.clientWidth || innerWidth, H = state.viewH;
    const bar = document.querySelector('header');
    const top = Math.max(56, bar ? bar.getBoundingClientRect().height : 72);
    const narrow = W / H < 0.95;
    const regions = {};
    SCROLL_PATH.forEach((entry, i) => {
        if (!entry.avoid || (narrow && i > 0)) return;
        const els = [...document.querySelectorAll(entry.avoid)].filter(e => e.getClientRects().length);
        if (!els.length) return;
        let l = Infinity, r = -Infinity, t = Infinity;
        for (const e of els) {
            const rc = e.getBoundingClientRect();
            l = Math.min(l, rc.left); r = Math.max(r, rc.right); t = Math.min(t, rc.top + scrollY);
        }
        if (narrow) {
            // The hero on a phone: the world goes in the space between the bar and the insignia
            const y0 = (top + 12) / H, y1 = (t - 14) / H;
            if (y1 - y0 > 0.18) regions[entry.pose] = { x0: 0.05, x1: 0.95, y0, y1 };
            return;
        }
        const gap = Math.max(32, W * 0.04), edge = Math.max(16, W * 0.02);
        const leftW = l - gap - edge, rightW = W - edge - (r + gap), minW = Math.max(240, W * 0.24);
        let band = null;
        if (rightW >= leftW && rightW >= minW) band = [r + gap, W - edge];
        else if (leftW >= minW) band = [edge, l - gap];
        if (!band) return;
        let y1 = H - 28;
        const floor = entry.floor && document.querySelector(entry.floor);
        if (floor && i === 0) {
            const fy = floor.getBoundingClientRect().top + scrollY;
            if (fy < H) y1 = Math.max(top + 160, fy - 18);
        }
        regions[entry.pose] = { x0: band[0] / W, x1: band[1] / W, y0: (top + 20) / H, y1: y1 / H };
    });
    return regions;
}

// The camera's place on the path: 0 at the hero, 1 at the next section's middle, and so on (phones)
function scrollPosition() {
    const secs = state.sections;
    if (!secs.length || secs.some(s => !s)) return 0;
    const H = state.viewH || viewHeight();
    const y = scrollY + H * 0.5;
    const max = document.documentElement.scrollHeight - H;
    if (scrollY >= max - 2 && max > 0) return secs.length - 1;
    if (y <= secs[0].mid) return 0;
    for (let i = 0; i < secs.length - 1; i++) {
        if (y < secs[i + 1].mid) return i + (y - secs[i].mid) / (secs[i + 1].mid - secs[i].mid);
    }
    return secs.length - 1;
}

// The section being read (desktop): the one under a line a little above the middle of the view. It changes
// only once that line is clearly past the boundary (8% of the view), so resting near an edge never flickers
// between two places. The last section, which may be too short to reach the line, is also the one at the bottom.
function activeSection() {
    const secs = state.sections;
    if (!secs.length || secs.some(s => !s)) return 0;
    const H = state.viewH || viewHeight();
    const max = document.documentElement.scrollHeight - H;
    const cur = state.active ?? 0;
    const last = secs.length - 1;
    if (max > 0 && (scrollY >= max - 2 || (cur === last && scrollY > max - H * 0.12))) return last;
    const y = scrollY + H * 0.45;
    let idx = 0;
    for (let i = 0; i < secs.length; i++) if (y >= secs[i].top) idx = i;
    const band = H * 0.08;
    if (idx > cur && idx === cur + 1 && y < secs[idx].top + band) return cur;
    if (idx < cur && cur !== last && y > secs[cur].top - band) return cur;
    return idx;
}

let scrollFrame = 0;
function onScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const u = state.universe;
        const mode = follow();
        for (const m of MOODS) state.scrollMood[m] = 0;
        let f;
        if (mode === 'sections') {
            state.active = activeSection();
            f = state.active;
            const mood = SCROLL_PATH[f] && SCROLL_PATH[f].mood;
            if (mood) state.scrollMood[mood] = 0.7;
        } else {
            f = scrollPosition();
            state.active = Math.round(f);
            // Each section's mood, strongest at its middle
            SCROLL_PATH.forEach((s, i) => {
                if (s.mood) state.scrollMood[s.mood] = Math.max(state.scrollMood[s.mood], 0.7 * Math.max(0, 1 - Math.abs(f - i)));
            });
        }
        if (u && !(state.explore && state.explore.active)) {
            u.setFollow(mode);
            u.setScroll(f);
            pushMoods();
            u.drawNow();             // the camera and the panels' rims in step with the page, in this same frame
        }
    });
}

function pushMoods() {
    const u = state.universe;
    if (!u) return;
    for (const m of MOODS) u.setMood(m, Math.max(state.navMood[m], state.scrollMood[m]));
}

// The menu: pointing at (or tabbing to) an item gives the universe that section's mood
function navMoods() {
    let timer = 0;
    const moodOf = a => {
        const href = (a.getAttribute('href') || '').split(/[?#]/)[0];
        return NAV_MOODS[href] || null;
    };
    const set = (mood, v) => {
        clearTimeout(timer);
        const apply = () => {
            for (const m of MOODS) state.navMood[m] = m === mood ? v : 0;
            pushMoods();
        };
        // a short wait, so sweeping across the menu doesn't flicker through every mood
        if (v > 0) timer = setTimeout(apply, 140);
        else apply();
    };
    const link = e => e.target && e.target.closest && e.target.closest('.nav-menu a[href]');
    on(document, 'pointerover', e => { const a = link(e); if (a) set(moodOf(a), 1); });
    on(document, 'pointerout', e => { const a = link(e); if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) set(null, 0); });
    on(document, 'focusin', e => { const a = link(e); if (a) set(moodOf(a), 1); });
    on(document, 'focusout', e => { if (link(e)) set(null, 0); });
}

// The pointer: lensing and parallax (mouse and pen only, never a scrolling finger), and naming the world
// under it where the page has no content of its own; a click there explores it
const BACKGROUND = 'html, body, body > section, .hero > .container, .featured-programs > .container, .program-cards, .home-sky';
function pointerWorlds() {
    let frame = 0, last = null, down = null;
    const label = state.label;
    function hover() {
        frame = 0;
        const u = state.universe;
        if (state.explore && state.explore.active) {
            if (state.hoverId) {
                state.hoverId = null;
                label.classList.remove('is-shown');
            }
            return;
        }
        if (!u || !last) return;
        const bg = last.target && last.target.matches && last.target.matches(BACKGROUND);
        const id = bg ? u.pick(last.clientX, last.clientY) : null;
        const world = id && u.system.bodies.get(id) ? id : null;
        if (world !== state.hoverId) {
            state.hoverId = world;
            u.setHover(world);
            root.classList.toggle('home-pointing-world', !!world);
            if (world) {
                const b = u.system.bodies.get(world).def;
                label.innerHTML = '';
                label.append(b.name);
                const small = document.createElement('small');
                small.textContent = 'Click to explore';
                label.append(small);
            }
            label.classList.toggle('is-shown', !!world);
        }
        if (world) {
            const p = u.screenPosition(world);
            label.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - p.r - 10)}px) translate(-50%, -100%)`;
        }
    }
    on(document, 'pointermove', e => {
        const u = state.universe;
        if (!u || e.pointerType === 'touch') return;
        u.pointer(e.clientX, e.clientY, true);
        last = e;
        if (!frame) frame = requestAnimationFrame(hover);
    }, { passive: true });
    on(document.documentElement, 'pointerleave', () => {
        if (state.universe) state.universe.pointer(0, 0, false);
    });
    on(document, 'pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    on(document, 'click', e => {
        if (!state.universe || !state.explore || state.explore.active || !down) return;
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;      // a drag, not a click
        if (!(e.target && e.target.matches && e.target.matches(BACKGROUND))) return;
        const id = state.universe.pick(e.clientX, e.clientY);
        if (id && state.universe.system.bodies.get(id)) state.explore.enter(id);
    });
}

// ---------- the intro, the theme, motion preferences ----------

function followIntro() {
    const busy = () => root.classList.contains('wsa-intro-pending') || root.classList.contains('wsa-intro-running');
    state.introBusy = busy();
    const release = () => {
        if (!state.introBusy) return;
        state.introBusy = false;
        if (state.universe) {
            state.universe.setSuspended(false);
            state.host.classList.add('is-live');
        }
        sound.introOver();
        if (state.guide) state.guide.maybeStart();
    };
    on(window, 'wsa-intro-release', release);
    on(window, 'wsa-intro-end', () => {
        release();
        measureSections();
        onScroll();
    });
    // The replay link starts it again
    on(document, 'click', e => {
        if (e.target && e.target.closest && e.target.closest('.wsa-intro-replay')) {
            setTimeout(() => {
                if (busy()) {
                    state.introBusy = true;
                    if (state.universe) state.universe.setSuspended(true);
                    sound.introStarted();
                }
            }, 0);
        }
    });
}

function followTheme() {
    const mo = new MutationObserver(list => {
        if (!state.universe) return;
        if (list.some(m => m.attributeName === 'data-theme')) state.universe.setTheme(theme());
        if (list.some(m => m.attributeName === 'data-liquid-glass')) syncGlass();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-liquid-glass'] });
    state.offs.push(() => mo.disconnect());
    const rm = () => { if (!prefs.intensityChosen() && state.universe) state.universe.setIntensity(prefs.intensity() / 100); };
    prefs.reducedMotion.addEventListener('change', rm);
    state.offs.push(() => prefs.reducedMotion.removeEventListener('change', rm));
}

// ---------- the API the settings, the guide and Explore mode use ----------

const sound = new AmbientSound();

export const home = {
    get universe() { return state.universe; },
    get explore() { return state.explore; },
    isV2,
    setEffects(v) {
        prefs.set('effects', v === 'full' ? null : v);
        root.setAttribute('data-home-effects', v);
        rebuild();
    },
    setIntensity(pct) {
        prefs.set('intensity', pct);
        if (state.universe) state.universe.setIntensity(pct / 100);
    },
    setQuality(q) {
        prefs.set('quality', q === 'auto' ? null : q);
        rebuild();
    },
    setSound(on2) {
        prefs.set('sound', on2 ? 'on' : null);
        if (on2) sound.start(); else sound.stop();
    },
    restartGuide() {
        if (state.guide) state.guide.start(true);
    },
    resetPrefs() {
        prefs.reset();
        sound.stop();
        root.setAttribute('data-home-effects', 'full');
        rebuild();
    },
    // NovaUI 2.0 or Version 1.0 (Settings, Design; ui-boot.js keeps the choice): the whole page's design and,
    // here, the universe with it, in one cross-fade
    async useVersion(v) {
        const design = window.WSADesign;
        if (v === 'v1') {
            prefs.set('version', 'v1');
            await swap(() => { stopV2(); if (design) design.apply('v1'); });
        } else {
            prefs.set('version', null);
            await swap(() => { if (design) design.apply('v2'); startV2(); });
        }
    },
};

// A cross-fade between the two homepages where the browser can do one
async function swap(change) {
    window.scrollTo(0, 0);
    if (document.startViewTransition && !prefs.reducedMotion.matches) {
        try {
            await document.startViewTransition(change).updateCallbackDone;
            return;
        } catch (e) { /* fall through: change it directly */ }
    }
    change();
}

// ---------- 2.0 on and off ----------

async function startV2() {
    root.classList.add('home-v2');
    root.setAttribute('data-home', 'v2');
    state.host = document.querySelector('.home-sky');
    if (!state.host) {
        state.host = document.createElement('div');
        state.host.className = 'home-sky v2-only';
        state.host.setAttribute('aria-hidden', 'true');
        document.body.prepend(state.host);
    }
    if (!state.label) {
        state.label = document.createElement('div');
        state.label.className = 'home-label v2-only';
        state.label.setAttribute('aria-hidden', 'true');
        document.body.appendChild(state.label);
    }
    followIntro();
    followTheme();
    navMoods();
    pointerWorlds();
    on(window, 'scroll', onScroll, { passive: true });
    on(sectionMode, 'change', () => { measureSections(); onScroll(); });
    const ro = new ResizeObserver(() => { measureSections(); onScroll(); });
    ro.observe(document.body);
    state.offs.push(() => ro.disconnect());

    const [{ Explorer }, { Guide }] = await Promise.all([import('./explore.js'), import('./guide.js')]);
    state.explore = new Explorer(home);
    state.guide = new Guide(home);
    on(document, 'click', e => {
        const btn = e.target && e.target.closest && e.target.closest('.home-explore-btn');
        if (btn && state.explore) state.explore.enter('kerbin');
    });
    // Building the universe keeps the browser busy for a moment (compiling its shaders). With the intro playing
    // that waits for the film, which plays on regardless; otherwise it happens now.
    if (state.introBusy) {
        let started = false;
        const go = () => { if (!started && isV2()) { started = true; startUniverse(); } };
        ['wsa-intro-film', 'wsa-intro-release', 'wsa-intro-end'].forEach(ev => on(window, ev, go));
    } else {
        await startUniverse();
        // index.html#explore (the NovaUI 2.0 news story's link) opens Explore mode straight away
        if (location.hash === '#explore' && state.universe) state.explore.enter('kerbin');
        else state.guide.maybeStart();
    }
    if (prefs.sound()) sound.armed();
}

function stopV2() {
    if (state.guide) state.guide.close(false);
    if (state.explore) state.explore.exit(true);
    stopUniverse();
    state.offs.splice(0).forEach(off => off());
    sound.stop(true);
    if (state.label) state.label.classList.remove('is-shown');
    root.classList.remove('home-v2', 'home-pointing-world');
    root.setAttribute('data-home', 'v1');
    root.removeAttribute('data-home-effects');
    state.explore = state.guide = null;
}

initSettings(home, prefs);
if (window.WSADesign) window.WSADesign.onChange = v => home.useVersion(v);
if (isV2()) startV2();
