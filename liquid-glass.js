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
        [60, 700, 1.1], [250, 560, 0.8], [40, 480, 1.0], [640, 520, 0.8], [880, 640, 1.0], [720, 760, 0.7],
        [960, 770, 0.7], [1320, 300, 0.7], [180, 750, 0.7], [600, 830, 1.2], [770, 560, 0.8],
        [510, 500, 0.7], [1430, 940, 0.7], [550, 660, 1.2], [950, 410, 0.8], [1170, 390, 1.1],
        [410, 650, 1.0], [1300, 770, 1.0], [1030, 660, 0.7], [260, 920, 0.9], [690, 270, 1.2],
        [890, 290, 1.0], [490, 370, 0.8], [1180, 540, 0.9], [1030, 520, 1.1], [740, 430, 1.2]
    ];
    // Stars that brighten now and then; the first four keep doing so in lite mode
    const TWINKLE = [10, 0, 17, 7, 23, 12, 3, 29, 45, 14, 34, 40, 2, 49, 42, 25, 50, 38, 20, 41, 46, 44];

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

    function planetASVG(id = 'a') {
        const R = 104;
        const P = 120;
        return `
<svg class="lg-diagram lg-planet-a" viewBox="-300 -150 600 300" style="--lg-dur: ${P}s" aria-hidden="true" focusable="false">
    <defs>
        <radialGradient id="lg-${id}-shade" cx="0.32" cy="0.28" r="0.85">
            <stop offset="0" class="lg-stop-lit"/>
            <stop offset="0.6" class="lg-stop-mid"/>
            <stop offset="1" class="lg-stop-dark"/>
        </radialGradient>
        <clipPath id="lg-${id}-clip"><circle r="${R}"/></clipPath>
    </defs>
    <g transform="rotate(-12)"><path class="lg-line lg-orbit lg-dashed" d="M -270 0 A 270 58 0 0 1 270 0"/></g>
    <circle class="lg-body" r="${R}"/>
    <circle r="${R}" fill="url(#lg-${id}-shade)"/>
    <g transform="rotate(-20)">
        <g clip-path="url(#lg-${id}-clip)">
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

    function planetBSVG(id = 'b') {
        const R = 22;
        const P = 80;
        return `
<svg class="lg-diagram lg-planet-b" viewBox="-80 -40 160 80" style="--lg-dur: ${P}s" aria-hidden="true" focusable="false">
    <defs><clipPath id="lg-${id}-clip"><circle r="${R}"/></clipPath></defs>
    <g transform="rotate(-14)">
        <path class="lg-line lg-orbit" d="M -54 0 A 54 11 0 0 1 54 0 M -43 0 A 43 8.5 0 0 1 43 0"/>
        <circle class="lg-body" r="${R}"/>
        <g clip-path="url(#lg-${id}-clip)">
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

    function blackHoleSVG(id = 'bh') {
        return `
<svg class="lg-diagram lg-blackhole" viewBox="-170 -60 340 120" aria-hidden="true" focusable="false">
    <defs><clipPath id="lg-${id}-near"><rect x="-200" y="0" width="400" height="200"/></clipPath></defs>
    <g transform="rotate(-8) scale(1 0.24)">${diskRings()}</g>
    <path class="lg-line lg-lens" d="M -43 0 A 43 36 0 0 1 43 0"/>
    <circle class="lg-horizon" r="24"/>
    <circle class="lg-line lg-photon" r="30"/>
    <g transform="rotate(-8) scale(1 0.24)"><g clip-path="url(#lg-${id}-near)">${diskRings()}</g></g>
</svg>`;
    }

    // A booster's flight: up from the pad, over the top and back down onto the landing target.
    // A short bright tracer runs along the path; the target ticks pulse.
    function trajectorySVG() {
        return `
<svg class="lg-diagram lg-trajectory" viewBox="-300 -200 600 400" style="--lg-dur: 9s" aria-hidden="true" focusable="false">
    <path class="lg-line lg-faint lg-dashed" d="M -300 158 A 1250 1250 0 0 1 300 158"/>
    <path class="lg-limb" d="M -300 187 A 1250 1250 0 0 1 300 187"/>
    <path class="lg-line lg-orbit lg-dashed" d="M -200 166 C -186 -70, 30 -168, 92 -60 S 152 112 152 158"/>
    <path class="lg-tracer" pathLength="1000" d="M -200 166 C -186 -70, 30 -168, 92 -60 S 152 112 152 158"/>
    <path class="lg-line" d="M -212 166 H -188 M -200 166 V 152"/>
    <circle class="lg-line" cx="152" cy="161" r="9"/>
    <path class="lg-line" d="M 140 161 H 164 M 152 149 V 173"/>
    <circle class="lg-pulse" cx="152" cy="161" r="9"/>
    <path class="lg-line lg-faint" d="M 104 -40 l 14 -6 M 120 2 l 15 -2 M 134 46 l 15 0 M 144 92 l 15 2"/>
</svg>`;
    }

    // KGOSS in outline: a truss with modules, a centrifuge ring, solar arrays and a docked capsule,
    // swaying gently over a planet's limb
    function stationSVG() {
        const panel = (x, y) => `<g transform="translate(${x} ${y})"><rect class="lg-line" x="-11" y="-26" width="22" height="52"/>` +
            '<path class="lg-line lg-faint" d="M 0 -26 V 26 M -11 -13 H 11 M -11 0 H 11 M -11 13 H 11"/></g>';
        return `
<svg class="lg-diagram lg-station" viewBox="-260 -170 520 340" style="--lg-dur: 26s" aria-hidden="true" focusable="false">
    <path class="lg-line lg-faint lg-dashed" d="M -260 96 A 900 900 0 0 1 260 96"/>
    <path class="lg-limb" d="M -260 132 A 900 900 0 0 1 260 132"/>
    <ellipse class="lg-line lg-orbit lg-dashed" cx="0" cy="-12" rx="240" ry="46"/>
    <path class="lg-tracer" pathLength="1000" d="M -240 -12 A 240 46 0 0 0 240 -12"/>
    <g class="lg-sway">
        <path class="lg-line" d="M -104 -20 H 104"/>
        ${panel(-84, -52)}${panel(-84, 12)}${panel(84, -52)}${panel(84, 12)}
        <path class="lg-line" d="M -84 -26 V -14 M 84 -26 V -14"/>
        <circle class="lg-body" cx="-36" cy="-20" r="24"/><circle class="lg-limb" cx="-36" cy="-20" r="24"/>
        <path class="lg-line lg-faint" d="M -36 -44 V 4 M -60 -20 H -12"/>
        <rect class="lg-body" x="-6" y="-29" width="44" height="18" rx="5"/><rect class="lg-line" x="-6" y="-29" width="44" height="18" rx="5"/>
        <rect class="lg-body" x="40" y="-27" width="26" height="14" rx="4"/><rect class="lg-line" x="40" y="-27" width="26" height="14" rx="4"/>
        <path class="lg-body" d="M 104 -27 L 122 -31 L 122 -9 L 104 -13 Z"/><path class="lg-line" d="M 104 -27 L 122 -31 L 122 -9 L 104 -13 Z"/>
    </g>
</svg>`;
    }

    // A Hohmann transfer: low orbit to the Mun's orbit along half an ellipse, with burn marks at
    // both ends; the Mun travels round its orbit
    function transferSVG(id = 'tr') {
        return `
<svg class="lg-diagram lg-transfer" viewBox="-230 -210 460 420" style="--lg-dur: 10s" aria-hidden="true" focusable="false">
    <defs><clipPath id="lg-${id}-clip"><circle r="34"/></clipPath></defs>
    <circle class="lg-line lg-faint lg-dashed" r="178"/>
    <circle class="lg-line lg-orbit" r="66"/>
    <path class="lg-line lg-orbit lg-dashed" d="M 66 0 A 122 108.4 0 0 0 -178 0"/>
    <path class="lg-tracer" pathLength="1000" d="M 66 0 A 122 108.4 0 0 0 -178 0"/>
    <path class="lg-line" d="M 60 -8 L 72 0 L 60 8 M -172 -8 L -184 0 L -172 8"/>
    <circle class="lg-body" r="34"/>
    <g clip-path="url(#lg-${id}-clip)"><path class="lg-line lg-grid" d="M -34 0 H 34 M -30 -17 H 30 M -30 17 H 30"/>${meridians(3, 34, 70)}</g>
    <circle class="lg-limb" r="34"/>
    <g class="lg-revolve" style="--lg-dur: 120s"><circle class="lg-moon" cx="178" cy="0" r="11"/></g>
</svg>`;
    }

    // The Mun, cratered and turning slowly, with a lander's descent arc onto its limb
    function munSVG(id = 'mun') {
        const craters = [[-40, -30, 16], [22, -52, 10], [46, 18, 20], [-18, 38, 12], [-62, 22, 8], [10, 4, 6], [64, -34, 7], [-34, 70, 9]];
        return `
<svg class="lg-diagram lg-mun" viewBox="-230 -180 460 360" style="--lg-dur: 11s" aria-hidden="true" focusable="false">
    <defs>
        <radialGradient id="lg-${id}-shade" cx="0.3" cy="0.3" r="0.9">
            <stop offset="0" class="lg-stop-lit"/><stop offset="0.6" class="lg-stop-mid"/><stop offset="1" class="lg-stop-dark"/>
        </radialGradient>
        <clipPath id="lg-${id}-clip"><circle r="104"/></clipPath>
    </defs>
    <ellipse class="lg-line lg-faint lg-dashed" rx="170" ry="40" transform="rotate(-16)"/>
    <circle class="lg-body" r="104"/>
    <circle r="104" fill="url(#lg-${id}-shade)"/>
    <g clip-path="url(#lg-${id}-clip)"><g class="lg-revolve" style="--lg-dur: 240s">
        ${craters.map(([x, y, r]) => `<circle class="lg-line lg-grid" cx="${x}" cy="${y}" r="${r}"/>`).join('')}
    </g></g>
    <circle class="lg-limb" r="104"/>
    <path class="lg-line lg-orbit lg-dashed" d="M 214 -168 C 160 -150, 110 -128, 86 -60"/>
    <path class="lg-tracer" pathLength="1000" d="M 214 -168 C 160 -150, 110 -128, 86 -60"/>
    <path class="lg-line" d="M 78 -64 l -6 -6 M 94 -56 l 6 -6"/>
</svg>`;
    }

    // A star chart: a slowly turning celestial grid with two constellations that draw themselves in
    function chartSVG() {
        const ticks = Array.from({ length: 36 }, (_, i) => {
            const a = i * Math.PI / 18, r1 = 214, r2 = i % 3 ? 220 : 228;
            return `M ${(r1 * Math.cos(a)).toFixed(1)} ${(r1 * Math.sin(a)).toFixed(1)} L ${(r2 * Math.cos(a)).toFixed(1)} ${(r2 * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        const figure = (pts, cls, dur, offset) => `<path class="lg-line lg-constellation ${cls}" pathLength="100" ` +
            `style="--lg-dur: ${dur}s; animation-delay: ${delay(dur, offset)}" d="M ${pts.map(p => p.join(' ')).join(' L ')}"/>` +
            pts.map(([x, y]) => `<circle class="lg-chart-star" cx="${x}" cy="${y}" r="2.6"/>`).join('');
        return `
<svg class="lg-diagram lg-chart" viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
    <g class="lg-revolve" style="--lg-dur: 400s">
        <circle class="lg-line lg-faint" r="80"/><circle class="lg-line lg-faint lg-dashed" r="150"/><circle class="lg-line lg-faint" r="214"/>
        <path class="lg-line lg-faint" d="M -214 0 H 214 M 0 -214 V 214 M -151 -151 L 151 151 M -151 151 L 151 -151"/>
        <path class="lg-line" d="${ticks}"/>
    </g>
    ${figure([[-120, -60], [-70, -96], [-20, -70], [30, -104], [86, -80], [120, -30]], 'is-a', 14, 0)}
    ${figure([[-110, 70], [-60, 40], [-14, 66], [-30, 120], [40, 110], [90, 60]], 'is-b', 14, 7)}
</svg>`;
    }

    // A launcher in blueprint outline, with stage lines, a height rule and a scan line passing down it
    function blueprintSVG() {
        return `
<svg class="lg-diagram lg-blueprint" viewBox="-130 -270 260 540" style="--lg-dur: 7s" aria-hidden="true" focusable="false">
    <path class="lg-line" d="M 0 -250 C 22 -224, 26 -196, 26 -160 L 26 -110 L 30 -96 L 30 150 L 30 196 L -30 196 L -30 150 L -30 -96 L -26 -110 L -26 -160 C -26 -196, -22 -224, 0 -250 Z"/>
    <path class="lg-line lg-faint lg-dashed" d="M -70 -160 H 70 M -70 -96 H 70 M -70 150 H 70"/>
    <path class="lg-line" d="M -30 150 L -54 196 L -30 196 M 30 150 L 54 196 L 30 196"/>
    <path class="lg-line" d="M -18 196 L -24 222 L -4 222 L -10 196 M 18 196 L 24 222 L 4 222 L 10 196"/>
    <path class="lg-line lg-faint" d="M -30 -40 H 30 M -30 40 H 30 M -26 -135 H 26"/>
    <path class="lg-line" d="M 96 -250 V 222 M 90 -250 H 102 M 90 222 H 102 M 90 -160 H 102 M 90 -96 H 102 M 90 150 H 102"/>
    <g class="lg-scan"><path class="lg-line lg-orbit" d="M -80 -250 H 80"/></g>
</svg>`;
    }

    // Scenes: which diagrams fill the sky. Each page has its own, and some sections switch to
    // another as they reach the middle of the window (desktop only; phones keep the first scene).
    const SCENES = {
        orbit: () => `<div class="lg-scene" data-scene="orbit">${planetASVG()}${planetBSVG()}${blackHoleSVG()}</div>`,
        trajectory: () => `<div class="lg-scene" data-scene="trajectory">${trajectorySVG()}${planetBSVG('b2')}</div>`,
        station: () => `<div class="lg-scene" data-scene="station">${stationSVG()}${planetBSVG('b3')}</div>`,
        transfer: () => `<div class="lg-scene" data-scene="transfer">${transferSVG()}${blackHoleSVG('bh2')}</div>`,
        lunar: () => `<div class="lg-scene" data-scene="lunar">${munSVG()}${planetBSVG('b4')}</div>`,
        chart: () => `<div class="lg-scene" data-scene="chart">${chartSVG()}${blackHoleSVG('bh3')}</div>`,
        blueprint: () => `<div class="lg-scene" data-scene="blueprint">${blueprintSVG()}${trajectorySVG()}</div>`,
    };
    // page → [scene for the top of the page, [section selector, scene] …]
    const PAGE_SCENES = {
        'index.html': ['orbit', [['.overview', 'trajectory'], ['.featured-programs', 'station'], ['.quick-achievements', 'transfer'], ['.cta-section', 'lunar']]],
        'about.html': ['orbit', []],
        'goals-achievements.html': ['transfer', [['#timeline', 'trajectory']]],
        'vehicles-programs.html': ['blueprint', [['#aegis', 'trajectory'], ['#lyra', 'blueprint'], ['#aircraft', 'orbit']]],
        'missions-archive.html': ['lunar', [['#silver-bridge', 'transfer']]],
        'gallery.html': ['chart', []],
        'autoland.html': ['trajectory', [['#glide', 'lunar']]],
        'kgoss.html': ['station', []],
        'game.html': ['station', []],
        'support.html': ['orbit', []],
    };
    const SCENE_SWAP_MS = 1300;   // matches the .lg-scene transitions in liquid-glass.css
    const scene = { cosmos: null, current: null, plan: null, frame: 0 };

    function pagePlan() {
        const page = location.pathname.split('/').pop() || 'index.html';
        const plan = PAGE_SCENES[page] || ['orbit', []];
        // Phones, tablets and small windows keep one calm scene
        return lite.matches ? ['orbit', []] : plan;
    }

    // The scene for the section crossing the upper middle of the window
    function sceneForScroll() {
        let name = scene.plan[0];
        const line = innerHeight * 0.45;
        for (const [selector, value] of scene.plan[1]) {
            const el = document.querySelector(selector);
            if (el && el.getBoundingClientRect().top < line) name = value;
        }
        return name;
    }

    function showScene(name) {
        if (!scene.cosmos || name === scene.current) return;
        const next = scene.cosmos.querySelector(`.lg-scene[data-scene="${name}"]`);
        const prev = scene.current && scene.cosmos.querySelector(`.lg-scene[data-scene="${scene.current}"]`);
        scene.current = name;
        clearTimeout(next.hideTimer);
        next.hidden = false;
        void next.offsetWidth;                 // start the fade from the hidden pose
        next.classList.add('is-on');
        if (prev) {
            prev.classList.remove('is-on');
            clearTimeout(prev.hideTimer);
            // Once faded, the old scene leaves the page so its loops stop costing anything
            prev.hideTimer = setTimeout(() => {
                if (!prev.classList.contains('is-on')) {
                    prev.hidden = true;
                    startSkyClock(scene.cosmos);
                }
            }, SCENE_SWAP_MS);
        }
        startSkyClock(scene.cosmos);
    }

    function onSceneScroll() {
        if (scene.frame) return;
        scene.frame = requestAnimationFrame(() => {
            scene.frame = 0;
            showScene(sceneForScroll());
        });
    }

    function buildCosmos(fadeIn) {
        if (document.querySelector('.lg-cosmos')) return;
        const cosmos = document.createElement('div');
        cosmos.className = 'lg-cosmos';
        cosmos.id = 'lg-cosmos';
        cosmos.setAttribute('aria-hidden', 'true');
        scene.plan = pagePlan();
        const names = [...new Set([scene.plan[0], ...scene.plan[1].map(([, value]) => value)])];
        cosmos.innerHTML = skySVG() + names.map(n => SCENES[n]()).join('');
        cosmos.querySelectorAll('.lg-scene').forEach(el => { el.hidden = true; });
        if (fadeIn) {
            cosmos.classList.add('is-entering');
            cosmos.addEventListener('animationend', e => {
                if (e.target === cosmos) cosmos.classList.remove('is-entering');
            });
        }
        document.body.prepend(cosmos);
        scene.cosmos = cosmos;
        scene.current = null;
        showScene(sceneForScroll());
        if (scene.plan[1].length) window.addEventListener('scroll', onSceneScroll, { passive: true });
    }

    function removeCosmos() {
        stopSkyClock();
        window.removeEventListener('scroll', onSceneScroll);
        cancelAnimationFrame(scene.frame);
        scene.frame = 0;
        scene.cosmos = null;
        scene.current = null;
        const cosmos = document.querySelector('.lg-cosmos');
        if (cosmos) cosmos.remove();
    }

    // The loops advance in ticks rather than every frame: they move slowly enough that 12 steps a
    // second look the same, and every glass pane over the sky only has to be redrawn when it changes
    const SKY_FPS = 12;
    let skyClock = 0;

    function startSkyClock(cosmos) {
        stopSkyClock();
        const loops = cosmos.getAnimations({ subtree: true })
            .filter(a => a.effect && a.effect.getTiming().iterations === Infinity);
        if (!loops.length) return;
        const t0 = document.timeline.currentTime;
        const base = loops.map(a => {
            a.pause();
            return a.currentTime;
        });
        skyClock = setInterval(() => {
            const elapsed = document.timeline.currentTime - t0;
            loops.forEach((a, i) => {
                if (a.playState !== 'idle') a.currentTime = base[i] + elapsed;
            });
        }, 1000 / SKY_FPS);
    }

    function stopSkyClock() {
        clearInterval(skyClock);
        skyClock = 0;
    }

    /* ---------- Pointer tilt: the surface faces the pointer and its highlights follow ---------- */

    const CARDS = '.program-card, .overview-card, .vehicle-card, .album-card, .wallet-card, .status-card';
    // Panes that tilt under the pointer: the cards plus the stat tiles and the wide panels
    const TILT_PANES = CARDS + ', .stat-card, .achievement, .module-card:not(.expandable-section .module-card)';
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
        slabEngage(el, s);
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
        slabAim(el, nx, ny);
    }

    function release(el) {
        const s = tiltState.get(el);
        s.angle = lightAngle(s.angle, REST.nx, REST.ny);
        el.style.setProperty('--lg-nx', String(REST.nx));
        el.style.setProperty('--lg-ny', String(REST.ny));
        el.style.setProperty('--lg-glow', '0');
        el.style.setProperty('--lg-angle', `${s.angle.toFixed(1)}deg`);
        el.classList.replace('lg-tilt', 'lg-settle');
        slabAim(el, null);
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
        el.style.removeProperty('--lg-copy-pos');
        getComputedStyle(el).transform;
        el.style.removeProperty('transition');
    }

    function releaseAll() {
        tilt.active.forEach((el, slot) => {
            if (el) release(el);
            tilt.active[slot] = null;
        });
    }

    // A scroll settles everything at once: in Firefox the sky copy inside a tilted pane is placed for
    // the scroll position it tilted at
    function releaseOnScroll() {
        releaseAll();
        if (copyLens) document.querySelectorAll('.lg-lens-copy.lg-settle').forEach(clear);
    }

    function update() {
        tilt.frame = 0;
        const e = tilt.event;
        const target = e.target instanceof Element ? e.target : null;
        [TILT_PANES, CONTROLS].forEach((selector, slot) => {
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
        window.addEventListener('scroll', releaseOnScroll, { passive: true });
        window.addEventListener('blur', releaseAll);
    }

    function stopTilt() {
        if (!tilt.on) return;
        tilt.on = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerout', onPointerOut);
        window.removeEventListener('scroll', releaseOnScroll);
        window.removeEventListener('blur', releaseAll);
        cancelAnimationFrame(tilt.frame);
        tilt.frame = 0;
        tilt.active = [null, null];
        document.querySelectorAll('.lg-tilt, .lg-settle').forEach(clear);
    }

    /* ---------- Refraction: each clear pane is a slab of glass that bends what lies behind it ---------- */

    // Chromium applies the lens filter to the backdrop itself (--lg-refract in backdrop-filter). Firefox
    // can't, but can paint a live copy of the sky (-moz-element) inside the pane and bend that instead
    // (--lg-refract-copy and .lg-lens-copy; see liquid-glass.css). Other browsers keep plain clear glass.
    // Panes inside bars, dialogs or other panes are skipped: they only see that surface's own tint.
    const LENS_CONTROLS = '.btn, .chip, .related-chip, .icon-button:not(.lightbox-nav), .menu-fab';
    const LENS_PANES = CARDS + ', .stat-card, .expandable-section, .achievement, .tl-toggle, .search-field, ' +
        '.module-card:not(.expandable-section .module-card)';
    const LENS_SKIP = 'header, .nav-drawer, dialog, footer';
    const backdropLens = !!(navigator.userAgentData && navigator.userAgentData.brands &&
        navigator.userAgentData.brands.some(b => b.brand === 'Chromium')) &&
        window.CSS && CSS.supports('backdrop-filter', 'blur(1px)');
    const copyLens = !backdropLens && !!(window.CSS && CSS.supports('background-image', '-moz-element(#a)'));
    const LENS_VAR = copyLens ? '--lg-refract-copy' : '--lg-refract';
    const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    // Phones, tablets and small windows (the stylesheet's lite mode) refract the controls only
    const lite = window.matchMedia('(pointer: coarse), (max-width: 768px)');
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const RESIZE_SETTLE_MS = 150;

    // Chromatic aberration: the rim bends short wavelengths further than long ones, so what lies
    // behind it is seen twice, slightly apart: a red image bent a little less and a cyan-blue one a
    // little more. A star or line under the rim gets a tiny red fringe on one side and a cyan one on
    // the other. Where nothing bends (the flat middle) the two coincide and there is no colour at all.
    const DISPERSION = 0.15;    // red bends (1 - this), cyan (1 + this), as a share of the bend
    // Controls: a capsule rim that bends evenly all round
    const BEZEL_CONTROL = 18;   // px of rim that bends, at most
    const BEND = 0.75;          // strongest inward shift, as a share of the bezel
    // Panes: a rounded rim on every side, bending harder on the sides set by the slab vector (x, y in
    // -1..1; positive x favours the right side, positive y the bottom). At rest that is the bottom-right
    // corner, away from the light; under the pointer it is the side that tilts up toward the viewer,
    // and the whole view shifts a little, as it does through a tilted plate of glass. That shift is
    // the same for every colour (a flat plate barely disperses), so the middle stays clean.
    const BEZEL_PANE = 40;      // px wide, at most
    const PANE_THICKNESS = 14;  // a rounded edge: the bend holds near the rim, then rolls off over its whole width
    const EDGE_SHIFT = 18;      // px, strongest inward shift on the favoured side
    const EDGE_FLOOR = 0.5;     // the other sides still bend this much
    const TILT_SHIFT = 3;       // px, the view through a fully tilted pane
    const PANE_SCALE = 2 * EDGE_SHIFT;
    const SLAB_REST = { x: 0.9, y: 0.9, dx: 0, dy: 0 };
    // Glass softens what lies behind it a touch: a slight blur under the bend (px). At the rim the
    // lens looks further inward than the blur reaches, so the pane edges get no dark fringe.
    const SOFTEN = 1.2;
    // The rim's own light: the curved edge catches a faint hairline of light just inside it, and it
    // splits like everything else seen through the rim: its red image sits a touch further in and its
    // cyan image a touch further out, with white where they overlap. So the split shows even over an
    // empty sky. It runs RIM_LIGHT.at px in from the pane's own rounded edge (blue in the map is the
    // distance to that edge, so it hugs the corners too) and fades in on the sides the slab favours,
    // between RIM_LIGHT.fade side weights, so it follows the tilt and tapers off round the corners.
    // Chromium draws it as an image on the pane's ::after, faded per side by a mask (.lg-rim in
    // liquid-glass.css): inside its backdrop filter it would cost most of the frame rate.
    const RIM_LIGHT = { at: 2, split: 0.55, width: 0.6, fade: [0.6, 0.95] };    // px, except fade
    const RIM_RANGE = 8;        // px of edge distance the map's blue channel covers
    const RIM_STEPS = 64;
    const rimStrength = () => parseFloat(getComputedStyle(root).getPropertyValue('--lg-rim-light')) || 0.35;

    const refract = {
        on: false, defs: null, frame: 0, timer: 0, resize: null, mutate: null, theme: null,
        filters: new Map(),     // key -> { id, users }
        lens: new Map(),        // element -> key
        pending: new Map(),     // element -> [width, height] waiting for the resize to settle
        live: new Map(),        // element -> { filter, cur, goal } while its slab moves
        liveCount: 0,
        anim: 0,
    };

    // How far each rim pixel looks inward, from the edge (index 0) to the flat top: the rim is a
    // convex squircle, and its slope bends a straight-down view toward the centre (n = 1.5).
    // Taller rims (thickness) keep bending further in from the edge.
    function bendProfile(bezel, thickness) {
        const out = new Float32Array(bezel * 4 + 1);
        let max = 0;
        for (let i = 0; i < out.length; i++) {
            const t = Math.max(i / (out.length - 1), 0.02);
            const slope = thickness * Math.pow(1 - t, 3) * Math.pow(1 - Math.pow(1 - t, 4), -0.75);
            const a = Math.atan(slope);
            out[i] = Math.tan(a - Math.asin(Math.sin(a) / 1.5));
            max = Math.max(max, out[i]);
        }
        return out.map(v => v / max);
    }

    // Displacement map for a rounded box: red/green = how far to look along x/y, 128 = straight through,
    // `amp` = the strongest shift as a share of the full range; blue = how close the box's own edge
    // is, 255 at the edge down to 0 at RIM_RANGE px in. Only the rim band is computed.
    // The bend follows contours with a corner radius of at least `round`, so it curves smoothly
    // through the corners instead of meeting at a seam; the box itself keeps radius `r`.
    // With `rim`, it paints the rim light instead (see rimColour), on a clear image.
    function mapURL(w, h, r, bezel, thickness, amp, round = r, rim = false) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, h);
        const data = img.data;
        if (!rim) new Uint32Array(data.buffer).fill(0xff008080);
        const profile = bendProfile(bezel, thickness);
        const last = profile.length - 1;
        const rr = Math.min(Math.max(r, round), w / 2, h / 2);
        const band = Math.ceil(Math.max(rr, bezel));
        // Inside the box, with a pixel and a half to spare: the box's own anti-aliased edge must bend
        // inward too, or it would show the softened edge of what lies behind as a jagged dark line
        const inside = (px, py) => {
            const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
            return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) < r + 1.5;
        };
        const pixel = (x, y) => {
            // Signed distance to the rounded contour and the outward normal there
            const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
            const qx = Math.abs(px) - (w / 2 - rr), qy = Math.abs(py) - (h / 2 - rr);
            const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
            const out = Math.hypot(ox, oy);
            let depth = rr - out - Math.min(Math.max(qx, qy), 0);
            if (depth >= bezel) return;
            if (depth <= 0) {
                // The corner between a tighter box corner and the rounder contour bends like the edge
                if (!inside(px, py)) return;
                depth = 0.01;
            }
            let nx = 0, ny = 0;
            if (out > 0) { nx = ox / out; ny = oy / out; }
            else if (qx > qy) nx = 1;
            else ny = 1;
            const bend = profile[Math.min(last, Math.round(depth / bezel * last))];
            const k = (y * w + x) * 4;
            // Distance in from the box's own edge (radius r)
            const ex = Math.abs(px) - (w / 2 - r), ey = Math.abs(py) - (h / 2 - r);
            const edge = r - Math.hypot(Math.max(ex, 0), Math.max(ey, 0)) - Math.min(Math.max(ex, ey), 0);
            if (rim) {
                const [red, cyan, alpha] = rimColour(edge);
                data[k] = Math.round(red * 255);
                data[k + 1] = data[k + 2] = Math.round(cyan * 255);
                data[k + 3] = Math.round(alpha * 255);
                return;
            }
            const m = bend * amp * 127;
            data[k] = Math.round(128 - Math.sign(px) * nx * m);
            data[k + 1] = Math.round(128 - Math.sign(py) * ny * m);
            data[k + 2] = Math.round(Math.min(Math.max(1 - edge / RIM_RANGE, 0), 1) * 255);
        };
        for (let y = 0; y < h; y++) {
            if (y < band || y >= h - band) {
                for (let x = 0; x < w; x++) pixel(x, y);
            } else {
                for (let x = 0; x < Math.min(bezel, w); x++) pixel(x, y);
                for (let x = Math.max(w - bezel, 0); x < w; x++) pixel(x, y);
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL();
    }

    const fmt = v => v.toFixed(4);
    // Transfer tables that weight the pane map per side: values below 128 are the right (red) and
    // bottom (green) edges, values above the left and top. The last two give the squared per-side
    // bend, 0 (none) to 1 (full), for the rim light: summed, they are the square of how hard it bends.
    const SQUARE_STEPS = 16;
    function slabTables(v) {
        const k = EDGE_SHIFT / PANE_SCALE;
        const weight = t => EDGE_FLOOR + (1 - EDGE_FLOOR) * Math.max(t, 0);
        const squared = t => {
            const lo = weight(t), hi = weight(-t), out = [];
            for (let i = 0; i <= SQUARE_STEPS; i++) {
                const d = 2 * i / SQUARE_STEPS - 1;     // -1 (right/bottom, full) .. 1 (left/top, full)
                out.push(fmt((d < 0 ? lo : hi) ** 2 * d * d));
            }
            return out.join(' ');
        };
        return [
            `${fmt(0.5 - k * weight(v.x))} 0.5 ${fmt(0.5 + k * weight(-v.x))}`,
            `${fmt(0.5 - k * weight(v.y))} 0.5 ${fmt(0.5 + k * weight(-v.y))}`,
            squared(v.x),
            squared(v.y),
        ];
    }

    // The rim light at a given distance in from the edge (px): red and cyan (0..1, relative to the
    // brighter) and opacity. Red sits further in, cyan further out.
    function rimColour(d) {
        const red = Math.exp(-(((d - RIM_LIGHT.at - RIM_LIGHT.split) / RIM_LIGHT.width) ** 2));
        const cyan = Math.exp(-(((d - RIM_LIGHT.at + RIM_LIGHT.split) / RIM_LIGHT.width) ** 2));
        const peak = Math.max(red, cyan, 1e-6);
        return [red / peak, cyan / peak, peak];
    }

    // How much of the rim light a side shows, from its weight
    function rimShow(weight) {
        const t = Math.min(Math.max((weight - RIM_LIGHT.fade[0]) / (RIM_LIGHT.fade[1] - RIM_LIGHT.fade[0]), 0), 1);
        return t * t * (3 - 2 * t);
    }

    // Firefox draws the rim light inside its lens filter: its colour and opacity as tables over the
    // edge distance (blue), and how much of it each side shows as a table over the squared weighted
    // bend there (the rim bends almost fully that close to the edge)
    function rimTables() {
        const strength = rimStrength(), r = [], c = [], a = [], show = [];
        for (let i = 0; i <= RIM_STEPS; i++) {
            const m = i / RIM_STEPS;
            const [red, cyan, alpha] = rimColour((1 - m) * RIM_RANGE);
            r.push(fmt(red));
            c.push(fmt(cyan));
            a.push(fmt(alpha * strength));
            show.push(fmt(rimShow(Math.sqrt(m))));     // the side weight
        }
        return { r: r.join(' '), c: c.join(' '), a: a.join(' '), show: show.join(' ') };
    }

    function rimLight(bx, by) {
        const t = rimTables();
        return `<feComponentTransfer in="map-raw" result="bend"><feFuncR type="table" tableValues="${bx}"/>` +
            `<feFuncG type="table" tableValues="${by}"/></feComponentTransfer>` +
            '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 0 0 0"/>' +
            `<feComponentTransfer result="rim-show"><feFuncA type="table" tableValues="${t.show}"/></feComponentTransfer>` +
            '<feColorMatrix in="map-raw" type="matrix" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 1 0 0"/>' +
            `<feComponentTransfer class="lg-rim-light"><feFuncR type="table" tableValues="${t.r}"/>` +
            `<feFuncG type="table" tableValues="${t.c}"/><feFuncB type="table" tableValues="${t.c}"/>` +
            `<feFuncA type="table" tableValues="${t.a}"/></feComponentTransfer>` +
            '<feComposite in2="rim-show" operator="in" result="rim"/>' +
            '<feComposite in="rim" in2="view" operator="over"/>';
    }

    // The slight blur, taken before the bend
    const soften = `<feGaussianBlur in="SourceGraphic" stdDeviation="${SOFTEN}" result="soft"/>`;
    // Panes: the same, then the tilt's whole-view shift
    const softenTilted = `<feGaussianBlur in="SourceGraphic" stdDeviation="${SOFTEN}"/>` +
        '<feOffset dx="0" dy="0" result="soft"/>';

    // Two passes of the same bend: a weaker one gives the red channel, a stronger one green and blue
    function dispersed(map, scale, result = '', source = 'soft') {
        const pass = (factor, values, result) =>
            `<feDisplacementMap in="${source}" in2="${map}" scale="${(scale * factor).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>` +
            `<feColorMatrix type="matrix" values="${values}" result="${result}"/>`;
        return pass(1 - DISPERSION, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'warm') +
            pass(1 + DISPERSION, '0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0', 'cool') +
            `<feComposite in="warm" in2="cool" operator="arithmetic" k2="1" k3="1"${result && ` result="${result}"`}/>`;
    }

    function filterFor(w, h, kind) {
        let r, key, body;
        // The neutral flood stands in until the map image has decoded, so nothing jumps on load
        const image = url =>
            `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map-img"/>` +
            '<feComposite in="map-img" in2="flat" operator="over" result="map-raw"/>';
        if (kind.control) {
            // Controls are capsules or circles, so the rim radius is half the short side
            r = Math.round(Math.min(w, h) / 2);
            const bezel = Math.max(2, Math.round(Math.min(r * 0.8, BEZEL_CONTROL)));
            key = `c-${w}-${h}`;
            if (!refract.filters.has(key)) body = image(mapURL(w, h, r, bezel, 3, 1)) + soften + dispersed('map-raw', bezel * BEND * 2);
        } else {
            const bezel = Math.max(4, Math.round(Math.min(BEZEL_PANE, Math.min(w, h) / 4)));
            key = `p-${w}-${h}-${kind.radius}`;
            if (!refract.filters.has(key)) {
                const [tr, tg, bx, by] = slabTables(SLAB_REST);
                body = image(mapURL(w, h, kind.radius, bezel, PANE_THICKNESS, 1, bezel)) + softenTilted +
                    `<feComponentTransfer in="map-raw" result="map"><feFuncR type="table" tableValues="${tr}"/>` +
                    `<feFuncG type="table" tableValues="${tg}"/></feComponentTransfer>` +
                    (copyLens ? dispersed('map', PANE_SCALE, 'view') + rimLight(bx, by) : dispersed('map', PANE_SCALE));
            }
        }
        if (body) {
            const filter = document.createElementNS(SVG_NS, 'filter');
            filter.id = `lg-rf-${key}`;
            [['x', 0], ['y', 0], ['width', w], ['height', h], ['filterUnits', 'userSpaceOnUse'],
                ['primitiveUnits', 'userSpaceOnUse'], ['color-interpolation-filters', 'sRGB']]
                .forEach(([name, value]) => filter.setAttribute(name, value));
            filter.innerHTML = '<feFlood flood-color="rgb(128,128,0)" result="flat"/>' + body;
            refract.defs.appendChild(filter);
            refract.filters.set(key, { id: filter.id, users: 0 });
        }
        return key;
    }

    // Filters no pane uses any more (after a resize) are dropped
    function releaseLens(el) {
        const key = refract.lens.get(el);
        if (!key) return;
        refract.lens.delete(el);
        const entry = refract.filters.get(key);
        if (entry && --entry.users <= 0) {
            const filter = document.getElementById(entry.id);
            if (filter) filter.remove();
            refract.filters.delete(key);
        }
    }

    // Chromium's rim light: drawn once per pane size, inside the border like the pane's own corners
    const rimImages = new Map();
    function rimImage(el, w, h, radius) {
        const cw = el.clientWidth, ch = el.clientHeight, border = el.clientLeft;
        const bezel = Math.max(4, Math.round(Math.min(BEZEL_PANE, Math.min(w, h) / 4)));
        const key = `${cw}-${ch}-${radius}`;
        if (!rimImages.has(key)) {
            if (rimImages.size > 200) rimImages.clear();
            rimImages.set(key, mapURL(cw, ch, Math.max(0, radius - border), bezel, PANE_THICKNESS, 1, Math.max(0, bezel - border), true));
        }
        el.style.setProperty('--lg-rim-img', `url(${rimImages.get(key)})`);
        el.classList.add('lg-rim');
    }

    function clearLens(el) {
        dropLive(el);
        el.style.removeProperty(LENS_VAR);
        el.classList.remove('lg-lens-copy');
        el.style.removeProperty('--lg-copy-clip');
        el.style.removeProperty('--lg-rim-img');
        el.classList.remove('lg-rim');
    }

    function sizeLens(el, width, height) {
        // Firefox's sky copy fills the padding box, inside the pane's border
        if (copyLens) {
            width = el.clientWidth;
            height = el.clientHeight;
        }
        const w = Math.round(width), h = Math.round(height);
        if (w < 8 || h < 8 || !el.isConnected) {
            releaseLens(el);
            clearLens(el);
            return;
        }
        // The computed radius of a control can't be used: the site's own `transition: all` on buttons is
        // still animating it from the regular corners when the mode is switched on
        const kind = el.matches(LENS_CONTROLS) ? { control: true } :
            { radius: Math.max(0, Math.round((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) - (copyLens ? el.clientLeft : 0))) };
        const key = filterFor(w, h, kind);
        if (refract.lens.get(el) !== key) {
            dropLive(el);
            releaseLens(el);
            refract.filters.get(key).users++;
            refract.lens.set(el, key);
            el.style.setProperty(LENS_VAR, `url(#${refract.filters.get(key).id})`);
            if (copyLens) el.classList.add('lg-lens-copy');
        }
        if (backdropLens && !kind.control) rimImage(el, w, h, kind.radius);
        // Firefox doesn't clip a filtered copy to the pane's corners, so the copy is clipped by hand
        if (copyLens) el.style.setProperty('--lg-copy-clip', `inset(0 round ${kind.control ? Math.round(Math.min(w, h) / 2) : kind.radius}px)`);
    }

    /* The slab under the pointer gets its own copy of its filter, whose transfer tables follow the
       tilt, eased frame by frame, then hands back to the shared filter once it has come to rest */

    function slabEngage(el, s) {
        if (!refract.on || !refract.lens.has(el) || el.matches(LENS_CONTROLS)) return;
        // Firefox: under the tilt transform the sky copy is placed by hand instead of fixed to the viewport
        if (copyLens) {
            el.style.setProperty('--lg-copy-pos',
                `${-(s.x - window.scrollX + el.clientLeft)}px ${-(s.y - window.scrollY + el.clientTop)}px`);
        }
        let live = refract.live.get(el);
        if (!live) {
            const shared = document.getElementById(refract.filters.get(refract.lens.get(el)).id);
            const filter = shared.cloneNode(true);
            filter.id = `${shared.id}-live${++refract.liveCount}`;
            refract.defs.appendChild(filter);
            live = { filter, funcs: filter.querySelectorAll('[result="map"] > *, [result="bend"] > *'), shift: filter.querySelector('feOffset'),
                cur: { ...SLAB_REST }, goal: { ...SLAB_REST } };
            refract.live.set(el, live);
            el.style.setProperty(LENS_VAR, `url(#${filter.id})`);
        }
    }

    // nx, ny: the pointer across the pane, -1..1; null = released
    function slabAim(el, nx, ny) {
        const live = refract.live.get(el);
        if (!live) return;
        live.resting = nx === null;
        live.goal = live.resting ? { ...SLAB_REST } :
            { x: -nx, y: -ny, dx: -nx * TILT_SHIFT, dy: -ny * TILT_SHIFT };
        if (!refract.anim) refract.anim = requestAnimationFrame(stepSlabs);
    }

    // Eased by time rather than per frame, so a slow frame rate doesn't slow the glass down
    const SLAB_EASE_MS = 90;

    function stepSlabs(now) {
        refract.anim = 0;
        const ease = 1 - Math.exp(-Math.min(now - (refract.animAt || now - 16), 250) / SLAB_EASE_MS);
        refract.animAt = now;
        refract.live.forEach((live, el) => {
            let moving = false;
            for (const k in live.goal) {
                const d = live.goal[k] - live.cur[k];
                live.cur[k] = Math.abs(d) < 0.004 ? live.goal[k] : live.cur[k] + d * ease;
                if (live.cur[k] !== live.goal[k]) moving = true;
            }
            slabTables(live.cur).forEach((values, i) => live.funcs[i] && live.funcs[i].setAttribute('tableValues', values));
            rimAim(el, live.cur);
            live.shift.setAttribute('dx', fmt(-live.cur.dx));
            live.shift.setAttribute('dy', fmt(-live.cur.dy));
            if (!moving && live.resting) dropLive(el);
            else if (moving) refract.anim = refract.anim || requestAnimationFrame(stepSlabs);
        });
        if (!refract.anim) refract.animAt = 0;
    }

    // Chromium's rim light follows the slab through its mask: which side along each axis, how much
    function rimAim(el, v) {
        if (!el.classList.contains('lg-rim')) return;
        const weight = t => EDGE_FLOOR + (1 - EDGE_FLOOR) * Math.max(t, 0);
        el.style.setProperty('--lg-rim-dx', v.x < 0 ? 'to left' : 'to right');
        el.style.setProperty('--lg-rim-dy', v.y < 0 ? 'to top' : 'to bottom');
        el.style.setProperty('--lg-rim-ax', fmt(rimShow(weight(Math.abs(v.x)))));
        el.style.setProperty('--lg-rim-ay', fmt(rimShow(weight(Math.abs(v.y)))));
    }

    function dropLive(el) {
        const live = refract.live.get(el);
        if (!live) return;
        ['--lg-rim-dx', '--lg-rim-dy', '--lg-rim-ax', '--lg-rim-ay'].forEach(k => el.style.removeProperty(k));
        refract.live.delete(el);
        live.filter.remove();
        const key = refract.lens.get(el);
        if (key && refract.filters.has(key)) el.style.setProperty(LENS_VAR, `url(#${refract.filters.get(key).id})`);
    }

    function lensTargets() {
        const selector = lite.matches ? LENS_CONTROLS : LENS_CONTROLS + ', ' + LENS_PANES;
        return [...document.querySelectorAll(selector)].filter(el =>
            !el.closest(LENS_SKIP) && !(el.parentElement && el.parentElement.closest(LENS_PANES)));
    }

    function scanLenses() {
        refract.frame = 0;
        // Panes that features.js re-rendered away give their filters back
        refract.lens.forEach((key, el) => {
            if (!el.isConnected) {
                refract.resize.unobserve(el);
                dropLive(el);
                releaseLens(el);
            }
        });
        lensTargets().forEach(el => {
            if (refract.lens.has(el) || refract.pending.has(el)) return;
            refract.pending.set(el, null);
            refract.resize.observe(el);
        });
    }

    // The first measurement of a pane is applied at once; later ones wait until resizing settles
    function onResize(entries) {
        let later = false;
        entries.forEach(entry => {
            const box = entry.borderBoxSize && entry.borderBoxSize[0];
            const size = box ? [box.inlineSize, box.blockSize] : [entry.target.offsetWidth, entry.target.offsetHeight];
            if (refract.lens.has(entry.target)) {
                refract.pending.set(entry.target, size);
                later = true;
            } else {
                refract.pending.delete(entry.target);
                sizeLens(entry.target, size[0], size[1]);
            }
        });
        if (later) {
            clearTimeout(refract.timer);
            refract.timer = setTimeout(() => {
                refract.pending.forEach((size, el) => { if (size) sizeLens(el, size[0], size[1]); });
                refract.pending.clear();
            }, RESIZE_SETTLE_MS);
        }
    }

    function startRefraction() {
        if (refract.on || !(backdropLens || copyLens) || reduceTransparency.matches || !document.body) return;
        refract.on = true;
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'lg-lens-defs');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        refract.defs = document.createElementNS(SVG_NS, 'defs');
        svg.appendChild(refract.defs);
        document.body.appendChild(svg);
        refract.resize = new ResizeObserver(onResize);
        // Chips, dialogs and search results are added later by features.js
        refract.mutate = new MutationObserver(() => {
            if (!refract.frame) refract.frame = requestAnimationFrame(scanLenses);
        });
        refract.mutate.observe(document.body, { childList: true, subtree: true });
        refract.theme = new MutationObserver(() => {
            const a = rimTables().a;
            refract.defs.querySelectorAll('.lg-rim-light feFuncA').forEach(node => node.setAttribute('tableValues', a));
        });
        refract.theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        window.addEventListener('scroll', onLensScroll, { passive: true });
        scanLenses();
    }

    // Every scrolled frame would redraw every lens (Chromium bends the backdrop again, Firefox paints
    // its sky copies again), so the lenses step aside while the page moves and come back once it rests
    function onLensScroll() {
        root.classList.add('lg-scrolling');
        clearTimeout(refract.scrollTimer);
        refract.scrollTimer = setTimeout(() => root.classList.remove('lg-scrolling'), 180);
    }

    function stopRefraction() {
        if (!refract.on) return;
        refract.on = false;
        refract.resize.disconnect();
        refract.mutate.disconnect();
        refract.theme.disconnect();
        window.removeEventListener('scroll', onLensScroll);
        clearTimeout(refract.scrollTimer);
        root.classList.remove('lg-scrolling');
        cancelAnimationFrame(refract.frame);
        cancelAnimationFrame(refract.anim);
        clearTimeout(refract.timer);
        refract.frame = refract.anim = 0;
        refract.lens.forEach((key, el) => clearLens(el));
        refract.defs.parentNode.remove();
        refract.filters.clear();
        refract.lens.clear();
        refract.live.clear();
        refract.pending.clear();
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
        // The stylesheet stops or restarts the loops; the clock follows
        stopSkyClock();
        const cosmos = document.querySelector('.lg-cosmos');
        if (cosmos && !reduceMotion.matches) requestAnimationFrame(() => startSkyClock(cosmos));
    });

    reduceTransparency.addEventListener('change', () => {
        if (reduceTransparency.matches) stopRefraction();
        else if (isOn()) startRefraction();
    });

    lite.addEventListener('change', () => {
        // Phones keep one calm scene; desktop windows get the per-section scenes
        if (isOn()) {
            removeCosmos();
            buildCosmos(false);
        }
        if (!refract.on) return;
        stopRefraction();
        startRefraction();
    });
})();
