// Experimental "Liquid Glass" appearance. Deliberately separate from the light/dark theme:
// it only adds data-liquid-glass to <html> plus its own elements, and never reads or writes
// data-theme or localStorage.theme. Loaded in <head> after liquid-glass.css so a saved choice
// applies before first paint. Removing the attribute restores the regular site.
(function () {
    if (window.WSALiquidGlass) return;
    window.WSALiquidGlass = true;

    const root = document.documentElement;
    const KEY = 'wsa-liquid-glass';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function savedOn() {
        try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; }
    }

    function save(on) {
        try {
            if (on) localStorage.setItem(KEY, 'on');
            else localStorage.removeItem(KEY);
        } catch (e) {}
    }

    // Escape hatch: opening any page with ?glass=off switches the mode off before anything is drawn
    if (/[?&]glass=off(&|$)/.test(location.search)) save(false);

    // If liquid-glass.css did not load, do nothing at all: the site stays exactly as it is
    if (getComputedStyle(root).getPropertyValue('--lg-ready').trim() !== '1') return;

    if (savedOn()) root.setAttribute('data-liquid-glass', '');
    // Without @property the highlight variables can't animate, so the stylesheet animates the transform instead
    if (!(window.CSS && CSS.registerProperty)) root.classList.add('lg-no-props');

    const LENS_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
        '<circle class="lg-lens" cx="12" cy="12" r="8"/><path d="M8.3 10.6a4.3 4.3 0 0 1 2.9-3"/></svg>';

    function isOn() {
        return root.hasAttribute('data-liquid-glass');
    }

    /* ---------- Toggle buttons and confirmation ---------- */

    let dialog = null;
    let returnFocus = null;
    let status = null;

    function makeToggle() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lg-toggle';
        button.setAttribute('aria-label', 'Liquid Glass (experimental)');
        button.innerHTML = LENS_ICON;
        button.addEventListener('click', () => {
            if (isOn()) disable(true);
            else confirmEnable(button);
        });
        return button;
    }

    function syncToggles() {
        const on = isOn();
        document.querySelectorAll('.lg-toggle').forEach(button => {
            button.setAttribute('aria-pressed', String(on));
            button.dataset.tip = on ? 'Turn off Liquid Glass' : 'Liquid Glass (experimental)';
            if (on) button.removeAttribute('aria-haspopup');
            else button.setAttribute('aria-haspopup', 'dialog');
        });
    }

    function announce(text) {
        if (status) status.textContent = text;
    }

    function buildDialog() {
        const d = document.createElement('dialog');
        d.className = 'wsa-dialog lg-confirm';
        d.setAttribute('aria-labelledby', 'lg-confirm-title');
        d.setAttribute('aria-describedby', 'lg-confirm-text');
        d.innerHTML = `
            <form method="dialog">
                <div class="lg-confirm-body">
                    <span class="lg-confirm-icon">${LENS_ICON}</span>
                    <h2 id="lg-confirm-title">Liquid Glass is experimental</h2>
                    <p id="lg-confirm-text">This appearance mode uses experimental visual effects and animations. It may cause visual glitches, performance problems, or unexpected behavior on some pages and devices. Your regular light and dark modes will remain available.</p>
                    <p class="lg-confirm-note">You can turn it off at any time with the same button.</p>
                </div>
                <div class="lg-confirm-actions">
                    <button type="submit" value="cancel" class="btn btn-secondary" autofocus>Cancel</button>
                    <button type="submit" value="enable" class="btn btn-primary">Enable Liquid Glass</button>
                </div>
            </form>`;
        // A click on the backdrop lands on the dialog element itself
        d.addEventListener('click', e => {
            if (e.target === d) d.close('cancel');
        });
        d.addEventListener('close', () => {
            if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
            if (d.returnValue === 'enable') enable(true);
            if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
        });
        document.body.appendChild(d);
        return d;
    }

    function confirmEnable(trigger) {
        if (!dialog) dialog = buildDialog();
        returnFocus = trigger;
        dialog.returnValue = '';
        dialog.showModal();
        document.body.classList.add('dialog-open');
    }

    function enable(byUser) {
        root.setAttribute('data-liquid-glass', '');
        if (byUser) save(true);
        buildCosmos(byUser);
        startTilt();
        startRefraction();
        syncToggles();
        if (byUser) announce('Liquid Glass on');
    }

    function disable(byUser) {
        root.removeAttribute('data-liquid-glass');
        if (byUser) save(false);
        removeCosmos();
        stopTilt();
        stopRefraction();
        syncToggles();
        if (byUser) announce('Liquid Glass off');
    }

    /* ---------- Animated background: a few quiet astronomical diagrams ---------- */

    // Animation phases come from the clock, so the diagrams carry on seamlessly from page to page
    const now = Date.now() / 1000;
    function phase(duration, offset) {
        return ((now + offset) % duration) / duration;
    }
    function delay(duration, offset) {
        return `${(-phase(duration, offset) * duration).toFixed(2)}s`;
    }

    const STARS = [
        [70, 120, 1.3], [210, 60, 0.9], [330, 210, 1.1], [150, 380, 0.8], [460, 90, 1.0],
        [560, 260, 0.7], [690, 40, 1.2], [820, 170, 0.8], [940, 70, 1.0], [1060, 230, 0.9],
        [1180, 40, 1.4], [1320, 150, 0.8], [1470, 80, 1.1], [1550, 300, 0.9], [1400, 420, 1.2],
        [1520, 560, 0.8], [1290, 640, 1.0], [1450, 760, 1.3], [1560, 900, 0.9], [1180, 880, 0.8],
        [980, 960, 1.1], [760, 900, 0.8], [560, 980, 1.0], [380, 860, 1.2], [120, 940, 0.9],
        [60, 700, 1.1], [250, 560, 0.8], [40, 480, 1.0], [640, 520, 0.8], [880, 640, 1.0], [720, 760, 0.7]
    ];
    // Stars that brighten now and then; the first four keep doing so in lite mode
    const TWINKLE = [10, 0, 17, 7, 23, 12, 3, 29];

    function skySVG() {
        const stars = STARS.map(([x, y, r], i) => {
            const t = TWINKLE.indexOf(i);
            if (t < 0) return `<circle class="lg-star${r < 0.9 ? ' is-dim' : ''}" cx="${x}" cy="${y}" r="${r}"/>`;
            const duration = 7 + (t * 0.83) % 6;
            return `<circle class="lg-star lg-twinkle${t > 3 ? ' lg-twinkle-extra' : ''}" cx="${x}" cy="${y}" r="${r}" ` +
                `style="--lg-dur: ${duration.toFixed(1)}s; animation-delay: ${delay(duration, t * 2.3)}"/>`;
        }).join('');
        return `
<svg class="lg-sky" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <path class="lg-line lg-faint lg-dashed" d="M -60 330 C 240 150, 600 70, 1000 96"/>
    <path class="lg-line lg-faint" d="M 1660 610 C 1420 650, 1230 800, 1150 1060"/>
    ${stars}
</svg>`;
    }

    // A meridian is the right half of the limb, squashed by scaleX. Sweeping scaleX from -1 to 1
    // (front, bright) and back to -1 (far side, faint) with a sine ease reads as a turning globe.
    // The inline pose matches the current phase, so a paused (reduced-motion) globe still looks right.
    function meridians(count, radius, duration) {
        let out = '';
        for (let i = 0; i < count; i++) {
            const offset = (i * duration) / count;
            const p = phase(duration, offset);
            const front = p < 0.5;
            const scale = front ? -Math.cos(Math.PI * p * 2) : Math.cos(Math.PI * (p - 0.5) * 2);
            out += `<path class="lg-meridian" d="M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius}" ` +
                `style="transform: scaleX(${scale.toFixed(3)}); opacity: ${front ? 1 : 0.25}; animation-delay: ${delay(duration, offset)}"/>`;
        }
        return out;
    }

    function planetASVG() {
        const R = 104;
        const P = 120;
        return `
<svg class="lg-diagram lg-planet-a" viewBox="-300 -150 600 300" style="--lg-dur: ${P}s" aria-hidden="true" focusable="false">
    <defs>
        <radialGradient id="lg-a-shade" cx="0.32" cy="0.28" r="0.85">
            <stop offset="0" class="lg-stop-lit"/>
            <stop offset="0.6" class="lg-stop-mid"/>
            <stop offset="1" class="lg-stop-dark"/>
        </radialGradient>
        <clipPath id="lg-a-clip"><circle r="${R}"/></clipPath>
    </defs>
    <g transform="rotate(-12)"><path class="lg-line lg-orbit lg-dashed" d="M -270 0 A 270 58 0 0 1 270 0"/></g>
    <circle class="lg-body" r="${R}"/>
    <circle r="${R}" fill="url(#lg-a-shade)"/>
    <g transform="rotate(-20)">
        <g clip-path="url(#lg-a-clip)">
            <path class="lg-line lg-grid" d="M -104 0 H 104 M -90 -52 H 90 M -90 52 H 90 M -52 -90 H 52 M -52 90 H 52"/>
            ${meridians(6, R, P)}
        </g>
        <path class="lg-line" d="M 0 -104 V -128 M 0 104 V 122"/>
    </g>
    <circle class="lg-limb" r="${R}"/>
    <g transform="rotate(-12)">
        <path class="lg-line lg-orbit lg-dashed" d="M 270 0 A 270 58 0 0 1 -270 0"/>
        <circle class="lg-moon" cx="135" cy="50.2" r="6"/>
    </g>
</svg>`;
    }

    function planetBSVG() {
        const R = 22;
        const P = 80;
        return `
<svg class="lg-diagram lg-planet-b" viewBox="-80 -40 160 80" style="--lg-dur: ${P}s" aria-hidden="true" focusable="false">
    <defs><clipPath id="lg-b-clip"><circle r="${R}"/></clipPath></defs>
    <g transform="rotate(-14)">
        <path class="lg-line lg-orbit" d="M -54 0 A 54 11 0 0 1 54 0 M -43 0 A 43 8.5 0 0 1 43 0"/>
        <circle class="lg-body" r="${R}"/>
        <g clip-path="url(#lg-b-clip)">
            <path class="lg-line lg-grid" d="M -22 0 H 22 M -19 -11 H 19 M -19 11 H 19"/>
            ${meridians(3, R, P)}
        </g>
        <circle class="lg-limb" r="${R}"/>
        <path class="lg-line lg-orbit" d="M 54 0 A 54 11 0 0 1 -54 0 M 43 0 A 43 8.5 0 0 1 -43 0"/>
    </g>
</svg>`;
    }

    // Accretion disk: dashed rings turning in the disk plane, seen almost edge-on.
    // The near half is drawn again over the event horizon.
    function diskRings() {
        return [[150, '2 12', 120], [118, '7 15', 75], [90, '12 9', 45]].map(([r, dash, duration], i) =>
            `<circle class="lg-ring" r="${r}" stroke-dasharray="${dash}" style="--lg-dur: ${duration}s; animation-delay: ${delay(duration, i * 7)}"/>`
        ).join('') + '<circle class="lg-line lg-faint" r="62"/>';
    }

    function blackHoleSVG() {
        return `
<svg class="lg-diagram lg-blackhole" viewBox="-170 -60 340 120" aria-hidden="true" focusable="false">
    <defs><clipPath id="lg-bh-near"><rect x="-200" y="0" width="400" height="200"/></clipPath></defs>
    <g transform="rotate(-8) scale(1 0.24)">${diskRings()}</g>
    <path class="lg-line lg-lens" d="M -43 0 A 43 36 0 0 1 43 0"/>
    <circle class="lg-horizon" r="24"/>
    <circle class="lg-line lg-photon" r="30"/>
    <g transform="rotate(-8) scale(1 0.24)"><g clip-path="url(#lg-bh-near)">${diskRings()}</g></g>
</svg>`;
    }

    function buildCosmos(fadeIn) {
        if (document.querySelector('.lg-cosmos')) return;
        const cosmos = document.createElement('div');
        cosmos.className = 'lg-cosmos';
        cosmos.setAttribute('aria-hidden', 'true');
        cosmos.innerHTML = skySVG() + planetASVG() + planetBSVG() + blackHoleSVG();
        if (fadeIn) {
            cosmos.classList.add('is-entering');
            cosmos.addEventListener('animationend', e => {
                if (e.target === cosmos) cosmos.classList.remove('is-entering');
            });
        }
        document.body.prepend(cosmos);
    }

    function removeCosmos() {
        const cosmos = document.querySelector('.lg-cosmos');
        if (cosmos) cosmos.remove();
    }

    /* ---------- Pointer tilt: the surface faces the pointer and its highlights follow ---------- */

    const CARDS = '.program-card, .overview-card, .vehicle-card, .album-card, .wallet-card, .status-card';
    const CONTROLS = '.btn, .chip, .related-chip, .icon-button:not(.lightbox-nav), .lg-toggle';
    const TILT_VARS = ['--lg-nx', '--lg-ny', '--lg-glow', '--lg-angle'];
    // Resting light comes from above, slightly to the left
    const REST = { nx: -0.4, ny: -1 };
    const SETTLE_MS = 520;

    const tilt = { on: false, frame: 0, event: null, active: [null, null] };
    const tiltState = new WeakMap();

    const clamp = v => Math.max(-1, Math.min(1, v));
    // Gradient angle that puts the bright edge on the light's side, kept continuous with the last one
    function lightAngle(previous, nx, ny) {
        const angle = Math.atan2(-nx, ny) * 180 / Math.PI;
        return angle + 360 * Math.round((previous - angle) / 360);
    }
    const REST_ANGLE = lightAngle(0, REST.nx, REST.ny);

    function engage(el) {
        let s = tiltState.get(el);
        if (!s) {
            s = { angle: REST_ANGLE };
            tiltState.set(el, s);
        }
        clearTimeout(s.timer);
        // Measure untransformed; an element still settling keeps the box measured before
        if (!el.classList.contains('lg-settle') || !s.w) {
            const r = el.getBoundingClientRect();
            s.x = r.left + window.scrollX;
            s.y = r.top + window.scrollY;
            s.w = r.width;
            s.h = r.height;
        }
        el.classList.remove('lg-settle');
        el.classList.add('lg-tilt');
        el.style.setProperty('--lg-glow', '1');
    }

    function track(el, e) {
        const s = tiltState.get(el);
        const nx = clamp(((e.pageX - s.x) / s.w) * 2 - 1);
        const ny = clamp(((e.pageY - s.y) / s.h) * 2 - 1);
        // A little of the resting light keeps the edge direction steady near the centre
        s.angle = lightAngle(s.angle, nx + REST.nx * 0.25, ny + REST.ny * 0.25);
        el.style.setProperty('--lg-nx', nx.toFixed(3));
        el.style.setProperty('--lg-ny', ny.toFixed(3));
        el.style.setProperty('--lg-angle', `${s.angle.toFixed(1)}deg`);
    }

    function release(el) {
        const s = tiltState.get(el);
        s.angle = lightAngle(s.angle, REST.nx, REST.ny);
        el.style.setProperty('--lg-nx', String(REST.nx));
        el.style.setProperty('--lg-ny', String(REST.ny));
        el.style.setProperty('--lg-glow', '0');
        el.style.setProperty('--lg-angle', `${s.angle.toFixed(1)}deg`);
        el.classList.replace('lg-tilt', 'lg-settle');
        s.timer = setTimeout(() => clear(el), SETTLE_MS);
    }

    function clear(el) {
        const s = tiltState.get(el);
        if (s) {
            clearTimeout(s.timer);
            s.angle = REST_ANGLE;
        }
        // The flat 3D transform and `none` look identical, so swap them without the card's own
        // transform transition (the reveal fade has one) replaying for nothing
        el.style.transition = 'none';
        el.classList.remove('lg-tilt', 'lg-settle');
        TILT_VARS.forEach(name => el.style.removeProperty(name));
        getComputedStyle(el).transform;
        el.style.removeProperty('transition');
    }

    function releaseAll() {
        tilt.active.forEach((el, slot) => {
            if (el) release(el);
            tilt.active[slot] = null;
        });
    }

    function update() {
        tilt.frame = 0;
        const e = tilt.event;
        const target = e.target instanceof Element ? e.target : null;
        [CARDS, CONTROLS].forEach((selector, slot) => {
            let el = target && target.closest(selector);
            // Cards still fading in (decorations.js) keep their own transform until they arrive
            if (el && el.matches('.reveal:not(.revealed)')) el = null;
            if (el !== tilt.active[slot]) {
                if (tilt.active[slot]) release(tilt.active[slot]);
                if (el) engage(el);
                tilt.active[slot] = el;
            }
            if (el) track(el, e);
        });
    }

    function onPointerMove(e) {
        if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        tilt.event = e;
        if (!tilt.frame) tilt.frame = requestAnimationFrame(update);
    }

    function onPointerOut(e) {
        if (!e.relatedTarget) releaseAll();
    }

    function startTilt() {
        if (tilt.on || reduceMotion.matches) return;
        tilt.on = true;
        document.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('pointerout', onPointerOut, { passive: true });
        window.addEventListener('scroll', releaseAll, { passive: true });
        window.addEventListener('blur', releaseAll);
    }

    function stopTilt() {
        if (!tilt.on) return;
        tilt.on = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerout', onPointerOut);
        window.removeEventListener('scroll', releaseAll);
        window.removeEventListener('blur', releaseAll);
        cancelAnimationFrame(tilt.frame);
        tilt.frame = 0;
        tilt.active = [null, null];
        document.querySelectorAll('.lg-tilt, .lg-settle').forEach(clear);
    }

    /* ---------- Refraction: the rim of each control bends what lies behind it ---------- */

    // Only Chromium applies SVG filters inside backdrop-filter; other browsers keep plain clear glass.
    // Controls inside bars, dialogs or other glass are skipped: they only see that pane's own tint.
    const REFRACT = '.btn, .chip, .related-chip, .icon-button:not(.lightbox-nav), .menu-fab';
    const REFRACT_SKIP = 'header, .nav-drawer, dialog, footer, ' + CARDS +
        ', .stat-card, .expandable-section, .achievement, .tl-toggle, .search-field, .module-card';
    const canRefract = !!(navigator.userAgentData && navigator.userAgentData.brands &&
        navigator.userAgentData.brands.some(b => b.brand === 'Chromium')) &&
        window.CSS && CSS.supports('backdrop-filter', 'blur(1px)');
    const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const BEZEL_MAX = 18;   // px of rim that bends, at most
    const THICKNESS = 3;    // rim height over its width: thicker glass bends further in from the edge
    const BEND = 0.75;      // strongest inward shift, as a share of the bezel

    const refract = { on: false, defs: null, filters: new Map(), seen: new WeakSet(), resize: null, mutate: null, frame: 0 };

    // How far each rim pixel looks inward, from the edge (index 0) to the flat top: the rim is a
    // convex squircle, and its slope bends a straight-down view toward the centre (n = 1.5)
    function bendProfile(bezel) {
        const out = new Float32Array(bezel * 4 + 1);
        let max = 0;
        for (let i = 0; i < out.length; i++) {
            const t = Math.max(i / (out.length - 1), 0.02);
            const slope = THICKNESS * Math.pow(1 - t, 3) * Math.pow(1 - Math.pow(1 - t, 4), -0.75);
            const a = Math.atan(slope);
            out[i] = Math.tan(a - Math.asin(Math.sin(a) / 1.5));
            max = Math.max(max, out[i]);
        }
        return out.map(v => v / max);
    }

    // Displacement map for a rounded box: red/green = how far to look along x/y, 128 = straight through
    function mapURL(w, h, r, bezel) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, h);
        const data = img.data;
        const profile = bendProfile(bezel);
        const last = profile.length - 1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // Signed distance to the rounded edge and the outward normal there
                const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
                const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
                const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                const out = Math.hypot(ox, oy);
                const depth = r - out - Math.min(Math.max(qx, qy), 0);
                let nx = 0, ny = 0, m = 0;
                if (depth > 0 && depth < bezel) {
                    if (out > 0) { nx = ox / out; ny = oy / out; }
                    else if (qx > qy) nx = 1;
                    else ny = 1;
                    m = profile[Math.min(last, Math.round(depth / bezel * last))];
                }
                const k = (y * w + x) * 4;
                data[k] = Math.round(128 - Math.sign(px) * nx * m * 127);
                data[k + 1] = Math.round(128 - Math.sign(py) * ny * m * 127);
                data[k + 2] = 128;
                data[k + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL();
    }

    function filterFor(w, h, r) {
        const key = `${w}-${h}-${r}`;
        let id = refract.filters.get(key);
        if (id) return id;
        id = `lg-rf-${key}`;
        // A flat top stays clear in the middle of even the smallest capsule
        const bezel = Math.max(2, Math.round(Math.min(r * 0.8, BEZEL_MAX)));
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.id = id;
        [['x', 0], ['y', 0], ['width', w], ['height', h], ['filterUnits', 'userSpaceOnUse'],
            ['primitiveUnits', 'userSpaceOnUse'], ['color-interpolation-filters', 'sRGB']]
            .forEach(([name, value]) => filter.setAttribute(name, value));
        // The neutral flood stands in until the map image has decoded, so nothing jumps on load
        filter.innerHTML =
            '<feFlood flood-color="rgb(128,128,128)" result="flat"/>' +
            `<feImage href="${mapURL(w, h, r, bezel)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="img"/>` +
            '<feComposite in="img" in2="flat" operator="over" result="map"/>' +
            `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(bezel * BEND * 2).toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>`;
        refract.defs.appendChild(filter);
        refract.filters.set(key, id);
        return id;
    }

    function sizeLens(el, width, height) {
        const w = Math.round(width), h = Math.round(height);
        if (w < 8 || h < 8) {
            el.style.removeProperty('--lg-refract');
            return;
        }
        // Every lens is a capsule or a circle in Liquid Glass (see liquid-glass.css), so the rim radius
        // is half the short side. The computed radius can't be used: the site's own `transition: all`
        // on buttons is still animating it from the regular corners when the mode is switched on.
        const r = Math.round(Math.min(w, h) / 2);
        el.style.setProperty('--lg-refract', `url(#${filterFor(w, h, r)})`);
    }

    function scanLenses() {
        refract.frame = 0;
        document.querySelectorAll(REFRACT).forEach(el => {
            if (refract.seen.has(el) || el.closest(REFRACT_SKIP)) return;
            refract.seen.add(el);
            refract.resize.observe(el);
        });
    }

    function startRefraction() {
        if (refract.on || !canRefract || reduceTransparency.matches || !document.body) return;
        refract.on = true;
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'lg-lens-defs');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        refract.defs = document.createElementNS(SVG_NS, 'defs');
        svg.appendChild(refract.defs);
        document.body.appendChild(svg);
        refract.resize = new ResizeObserver(entries => entries.forEach(entry => {
            const box = entry.borderBoxSize && entry.borderBoxSize[0];
            if (box) sizeLens(entry.target, box.inlineSize, box.blockSize);
            else sizeLens(entry.target, entry.target.offsetWidth, entry.target.offsetHeight);
        }));
        // Chips, dialogs and search results are added later by features.js
        refract.mutate = new MutationObserver(() => {
            if (!refract.frame) refract.frame = requestAnimationFrame(scanLenses);
        });
        refract.mutate.observe(document.body, { childList: true, subtree: true });
        scanLenses();
    }

    function stopRefraction() {
        if (!refract.on) return;
        refract.on = false;
        refract.resize.disconnect();
        refract.mutate.disconnect();
        cancelAnimationFrame(refract.frame);
        refract.frame = 0;
        refract.defs.parentNode.remove();
        refract.filters.clear();
        refract.seen = new WeakSet();
        document.querySelectorAll(REFRACT).forEach(el => el.style.removeProperty('--lg-refract'));
    }

    /* ---------- Setup ---------- */

    // Listening on window, not document: window listeners run after navigation.js's
    // document-level DOMContentLoaded handler, so the mobile drawer exists by then.
    window.addEventListener('DOMContentLoaded', () => {
        const themeToggle = document.querySelector('.navbar > .theme-toggle');
        if (themeToggle) themeToggle.after(makeToggle());

        const drawerFooter = document.querySelector('.nav-drawer-footer');
        if (drawerFooter) {
            const row = document.createElement('div');
            row.className = 'nav-drawer-footer lg-drawer-row';
            row.innerHTML = '<span>Liquid Glass <small>Experimental</small></span>';
            row.appendChild(makeToggle());
            drawerFooter.after(row);
        }

        status = document.createElement('p');
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        document.body.appendChild(status);

        if (isOn()) {
            buildCosmos(false);
            startTilt();
            startRefraction();
        }
        syncToggles();
    });

    // Keeps other open tabs of the site in step (they were already confirmed there)
    window.addEventListener('storage', e => {
        if (e.key !== KEY && e.key !== null) return;
        if (savedOn() && !isOn()) enable(false);
        else if (!savedOn() && isOn()) disable(false);
    });

    reduceMotion.addEventListener('change', () => {
        if (reduceMotion.matches) stopTilt();
        else if (isOn()) startTilt();
    });

    reduceTransparency.addEventListener('change', () => {
        if (reduceTransparency.matches) stopRefraction();
        else if (isOn()) startRefraction();
    });
})();
