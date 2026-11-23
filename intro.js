/*
 * WSA intro: the homepage's cinematic opening (styled by intro.css).
 *
 * Plays when the homepage is the first page opened in a browser session, and again on every reload of it;
 * moving between the site's pages or going back and forward skips it (sessionStorage 'wsa-intro-seen').
 * "Replay intro" in the homepage footer, or ?intro in the address, plays it again. Loaded in <head> so
 * the page is covered from the first paint. On a first visit the language picker (i18n.js) comes first.
 *
 *   NovaUI 2.0 (~6 s) the title of the site's interface as a polished metal object (intro-nova.js, three.js):
 *                     extreme close-ups travel across its letters under a moving light, the camera draws back
 *                     to the whole title, holds, and it goes dark as the opening begins. Without WebGL, on the
 *                     'lite' version, or if it can't load in time, the title is set in type instead (~2.4 s).
 *   Opening (~5.6 s)  the insignia fades in, a planet rises behind it, an orbit is traced round it, then
 *                     the name and the motto.
 *   Film (9 s)        media/intro/wsa-intro-*.webm|mp4, an orbital sunrise rendered in Blender
 *                     (sources: ~/Documents/wsa-intro-production). It ends pulling back from the planet.
 *   Landing (~7.6 s)  the planet shrinks into a disc and the insignia builds itself on it: WSA; the rocket
 *                     flies in drawing its trail, then the spaceplane; the blue and red arcs sweep in from
 *                     either side; the stars and the horizon; the outer ring. (Layers: media/intro/logo/,
 *                     cut from images/wsa-logo.png.) The wordmark fades and swipes in beneath it, the black
 *                     clears to the homepage, and the insignia jumps: an arc from the middle of the screen
 *                     that lands hard on its own place on the page (the hero's insignia, measured live), the
 *                     wordmark landing on the header logo. The page's buttons and panels fade in outwards
 *                     from the landing.
 *
 * Three versions: 'full'; 'lite' (data saver, a slow connection or very little memory: the same intro
 * with two stills of the film instead of the video, nothing large downloaded); 'calm'
 * (prefers-reduced-motion: the title, then the opening's lockup, each fade in and out; nothing moves). If the
 * video fails or can't buffer in time, 'full' falls back to the stills.
 *
 * Sound is on by default. Browsers hold sound back until the visitor interacts with the page; then their first
 * click, tap or key press turns it on, in step with the picture (or the sound button does). A visitor who turns
 * it off keeps it off on later visits (localStorage 'wsa-intro-sound'), until they turn it on again.
 * Escape or "Skip intro" (shown from the title onward) goes straight to the page at any point.
 */
(function () {
    'use strict';

    var SEEN = 'wsa-intro-seen';
    var SOUND = 'wsa-intro-sound';
    var MEDIA = 'media/intro/';
    var LOGO = 'images/wsa-logo.png';
    var root = document.documentElement;

    // The homepage only (served as /, /index.html, or a local copy of either)
    if (!/(^|\/)(index\.html)?$/.test(location.pathname)) return;

    // Timeline of the opening, ms from the start
    var T = {
        insignia: 300, corner: 700, planet: 1000, orbit: 1900, title: 2500, motto: 3800,
        dissolve: 5600,        // the opening dissolves into the film
        skip: 6500,            // "Skip intro" appears once the film has begun
        filmWait: 2500         // how long the film may still be buffering at the dissolve
    };
    var CONTRACT_AT = 8.2;     // film seconds: the pullback has settled; the planet starts to become the badge
    // Landing, ms from the moment the planet starts shrinking. The sound cue 'logo' starts at L.badge, with
    // the insignia's build; audio/make_audio.py follows these times.
    //   badge     the build starts on the shrinking planet (B below), which is gone at L.shrink
    //   swipe     the built insignia rises and the wordmark swipes in beneath it
    //   release   the black clears to the homepage (still blurred at first)
    //   jump      the insignia leaps from the middle of the screen and lands hard on its own place on the
    //             homepage (the hero's insignia), the wordmark on the header logo; the landing is LAND_AT of
    //             the way through, then a squash and a small rebound
    var L = { badge: 500, shrink: 1100, pieces: 600, swipe: 4500, release: 5300, releaseDur: 900,
              jump: 5700, jumpDur: 1150, interactive: 6500 };
    var LAND_AT = 0.84;
    // The insignia's build, ms from L.badge
    var B = { disc: [0, 600], wsa: [250, 600], rocket: [750, 750], plane: [1300, 850], blue: [1950, 750], red: [2050, 850],
              stars: [2700, 800], horizon: [2750, 650], ring: [3250, 650], done: 3950 };
    var RIPPLE = 0.9;          // ms per pixel from the impact: the page's parts fade in outwards from it
    var PIECE_GAP = 45;        // ...but never two at quite the same moment
    // The film's last frame: the planet sits dead centre, its disc (with the thin air glowing round it)
    // 0.702 of the frame's height across (build_scene.py: D_END)
    var PLANET_R = 0.351;
    // The orbit traced over the opening's planet: a circle round the limb in the film's first frame
    // (1920 × 1080 frame units; measured from the rendered frame, see the production README)
    var ORBIT = { cx: 1231, cy: 5874, r: 5215 };     // the planet's edge: centre (1231, 5874), radius 5105

    var STR = {
        en: { skip: 'Skip intro', soundOn: 'Turn sound on', soundOff: 'Turn sound off', motto: 'Wonders Seek Above',
              sr: 'NovaUI 2.0, and the Woody Space Agency intro. Press Escape to skip.' },
        zh: { skip: '略過片頭', soundOn: '開啟聲音', soundOff: '關閉聲音', motto: '向上探尋奇蹟',
              sr: 'NovaUI 2.0 與 Woody Space Agency 片頭動畫。按 Esc 鍵可略過。' }
    };

    var running = null;

    // The page can follow along: 'wsa-intro-opening' when the NovaUI title hands over to the WSA opening,
    // 'wsa-intro-film' once the film (or its stills) is on screen, 'wsa-intro-release'
    // as the black clears to the page, 'wsa-intro-end' when the intro is over (naturally or skipped). The 2.0
    // homepage builds its universe during the film, where a busy moment can't be seen, and starts drawing it
    // on the release.
    function announce(name) {
        try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {}
    }

    function store(get, key, value) {
        try {
            if (get) return sessionStorage.getItem(key);
            sessionStorage.setItem(key, value);
        } catch (e) { return null; }
        return null;
    }

    // The visitor's own choice of sound, kept across visits
    function soundChoice(value) {
        try {
            if (value === undefined) return localStorage.getItem(SOUND);
            localStorage.setItem(SOUND, value);
        } catch (e) { /* storage blocked: the choice lasts for this intro only */ }
        return null;
    }

    function webglOK() {
        try {
            var c = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
        } catch (e) { return false; }
    }

    function chooseMode() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'calm';
        var c = navigator.connection || {};
        if (c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return 'lite';
        return 'full';
    }

    function lang() {
        var zh = window.WSAi18n && window.WSAi18n.lang === 'zh-Hant';
        if (!zh) {
            try { zh = localStorage.getItem('wsa-lang') === 'zh-Hant'; } catch (e) {}
        }
        return zh ? 'zh' : 'en';
    }

    /* ------------------------------------------------------------------ one run of the intro */

    function Intro(mode) {
        this.mode = mode;
        this.t = STR[lang()];
        this.timers = [];
        this.anims = [];
        this.frames = [];
        this.done = false;
        this.inerted = [];
        this.audio = null;
    }

    Intro.prototype.at = function (ms, fn) {
        var self = this;
        this.timers.push(setTimeout(function () {
            if (self.done) return;
            try { fn.call(self); } catch (e) { self.fail(e); }
        }, ms));
    };

    Intro.prototype.animate = function (el, frames, opts) {
        if (!el || !el.animate) return null;
        var a = el.animate(frames, opts);
        this.anims.push(a);
        return a;
    };

    Intro.prototype.fail = function (e) {
        if (window.console) console.warn('WSA intro stopped:', e);
        this.finish(true);
    };

    Intro.prototype.build = function () {
        var t = this.t;
        var o = document.createElement('div');
        o.className = 'wsa-intro';
        o.setAttribute('translate', 'no');
        o.setAttribute('lang', lang() === 'zh' ? 'zh-Hant' : 'en');
        var n = 0;
        var title = 'WOODY SPACE AGENCY'.split('').map(function (ch) {
            return ch === ' ' ? ' ' : '<tspan style="--i:' + n++ + '">' + ch + '</tspan>';
        }).join('');
        var orbit = orbitPath();
        o.innerHTML =
            '<div class="wsa-intro-nova" aria-hidden="true"></div>' +
            '<div class="wsa-intro-media" aria-hidden="true">' +
                '<img class="wsa-intro-still" alt="" decoding="async">' +
                '<svg class="wsa-intro-orbit" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" focusable="false">' +
                    '<path d="' + orbit + '"/><circle r="3.2" cx="-20" cy="-20"/></svg>' +
            '</div>' +
            '<div class="wsa-intro-lockup" aria-hidden="true">' +
                '<div class="wsa-intro-emblem"><img class="wsa-intro-insignia" src="' + LOGO + '" alt="" width="168" height="168"></div>' +
                '<svg class="wsa-intro-title" focusable="false"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">' + title + '</text></svg>' +
                '<p class="wsa-intro-motto"></p>' +
            '</div>' +
            '<p class="wsa-intro-wordmark is-corner" aria-hidden="true"></p>' +
            '<p class="wsa-intro-wordmark is-main" aria-hidden="true"></p>' +
            '<div class="wsa-intro-badge" aria-hidden="true"><img class="wsa-intro-badge-img" src="' + LOGO + '" alt=""></div>' +
            '<button type="button" class="wsa-intro-control wsa-intro-sound" aria-pressed="false">' +
                '<svg class="is-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>' +
                '<svg class="is-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>' +
            '</button>' +
            '<button type="button" class="wsa-intro-control wsa-intro-skip"></button>' +
            '<p class="wsa-intro-sr"></p>';
        o.querySelector('.wsa-intro-motto').textContent = t.motto;
        o.querySelector('.wsa-intro-skip').textContent = t.skip;
        o.querySelector('.wsa-intro-sr').textContent = t.sr;
        this.el = o;
        this.novaLayer = o.querySelector('.wsa-intro-nova');
        this.media = o.querySelector('.wsa-intro-media');
        this.still = o.querySelector('.wsa-intro-still');
        this.orbit = o.querySelector('.wsa-intro-orbit');
        this.insignia = o.querySelector('.wsa-intro-insignia');
        this.emblem = o.querySelector('.wsa-intro-emblem');
        this.lockup = o.querySelector('.wsa-intro-lockup');
        this.motto = o.querySelector('.wsa-intro-motto');
        this.cornerWord = o.querySelector('.wsa-intro-wordmark.is-corner');
        this.word = o.querySelector('.wsa-intro-wordmark.is-main');
        this.badge = o.querySelector('.wsa-intro-badge');
        this.badgeImg = o.querySelector('.wsa-intro-badge-img');
        this.soundBtn = o.querySelector('.wsa-intro-sound');
        this.skipBtn = o.querySelector('.wsa-intro-skip');
        this.still.src = MEDIA + 'wsa-intro-poster.webp';
        return o;
    };

    // An arc of the orbit across the frame, round the top of the planet
    function orbitPath() {
        var o = ORBIT, x1 = -80, x2 = 2000;
        var y1 = o.cy - Math.sqrt(o.r * o.r - (x1 - o.cx) * (x1 - o.cx));
        var y2 = o.cy - Math.sqrt(o.r * o.r - (x2 - o.cx) * (x2 - o.cx));
        return 'M' + x1 + ' ' + y1.toFixed(1) + 'A' + o.r + ' ' + o.r + ' 0 0 1 ' + x2 + ' ' + y2.toFixed(1);
    }

    /* ------------------------------------------------------------------ start */

    Intro.prototype.start = function () {
        var self = this;
        this.t0 = performance.now();
        window.scrollTo(0, 0);
        root.classList.add('wsa-intro-running');
        document.body.appendChild(this.build());
        root.classList.remove('wsa-intro-pending');
        // intro.css didn't load: an unstyled intro would just sit at the end of the page
        if (getComputedStyle(this.el).position !== 'fixed') { this.finish(true); return; }

        // The page behind can't be reached until the intro lets go of it
        Array.prototype.forEach.call(document.body.children, function (c) {
            if (c !== self.el && !c.inert) { c.inert = true; self.inerted.push(c); }
        });
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

        this.onKey = function (e) {
            if (e.key === 'Escape') { e.preventDefault(); self.finish(true, true); return; }
            if (/^(?: |Spacebar|ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(e.key) &&
                !(e.target && e.target.closest && e.target.closest('.wsa-intro-control'))) e.preventDefault();
        };
        this.hold = function (e) { e.preventDefault(); };
        this.onShow = function (e) { if (e.persisted) self.finish(true); };
        this.onHide = function () { if (document.hidden) self.finish(true); };
        window.addEventListener('keydown', this.onKey, true);
        this.el.addEventListener('wheel', this.hold, { passive: false });
        this.el.addEventListener('touchmove', this.hold, { passive: false });
        window.addEventListener('pageshow', this.onShow);
        document.addEventListener('visibilitychange', this.onHide);
        this.skipBtn.addEventListener('click', function (e) { self.finish(true, e.detail === 0); });
        this.soundBtn.addEventListener('click', function () { self.setSound(!self.soundOn, true); });
        this.soundBtn.setAttribute('aria-label', this.t.soundOn);
        this.soundBtn.title = this.t.soundOn;

        if (this.mode === 'calm') { this.calm(); return; }
        this.prepareWordmark();
        this.loadEmblem();
        this.prepareAudio();
        if (this.mode === 'full') this.loadFilm();
        // The controls from the start, whether or not the title is ready yet: skipping is always one step away
        this.at(450, function () { this.soundBtn.classList.add('is-shown'); });
        this.at(800, function () { this.skipBtn.classList.add('is-shown'); });
        this.nova();
    };

    /* ------------------------------------------------------------------ NovaUI 2.0, the title */

    Intro.prototype.nova = function () {
        var self = this;
        var settled = false;
        function typeset() {
            if (settled || self.done) return;
            settled = true;
            self.novaType(false);
        }
        if (this.mode !== 'full' || !webglOK()) { typeset(); return; }
        // The 3D title, if it is ready within 2.6 s; otherwise the typeset one
        var wait = setTimeout(typeset, 2600);
        this.timers.push(wait);
        import('./intro-nova.js?v=1').then(function (m) {
            return m.createNova(self.novaLayer, { url: MEDIA + 'novaui-title.bin' });
        }).then(function (player) {
            clearTimeout(wait);
            if (settled || self.done) { player.dispose(); return; }
            settled = true;
            self.novaPlayer = player;
            self.novaBegins();
            player.start(function () { self.novaHandoff(); }, function () { self.novaGone(); });
        }).catch(function (e) {
            if (window.console) console.warn('NovaUI title (3D) unavailable:', e);
            clearTimeout(wait);
            typeset();
        });
    };

    // Common to both versions of the title: its sound, and the controls
    Intro.prototype.novaBegins = function () {
        this.novaT0 = performance.now();
        this.novaActive = true;
        this.novaCue = this.cue('nova');
    };

    // The title goes dark: the WSA opening begins underneath
    Intro.prototype.novaHandoff = function () {
        if (this.done || this.openingStarted) return;
        this.novaActive = false;
        this.animate(this.novaLayer, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'ease-in', fill: 'forwards' });
        this.beginOpening();
    };

    Intro.prototype.novaGone = function () {
        if (this.novaPlayer) { this.novaPlayer.dispose(); this.novaPlayer = null; }
        if (this.novaLayer) this.novaLayer.hidden = true;
    };

    // The title set in type: for the 'lite' and calm versions, without WebGL, or when the 3D one can't load
    Intro.prototype.novaType = function (calm) {
        var self = this;
        var title = document.createElement('p');
        title.className = 'wsa-intro-nova-type' + (calm ? ' is-still' : '');
        title.textContent = 'NovaUI 2.0';
        this.novaLayer.appendChild(title);
        if (!calm) this.novaBegins();
        this.animate(title, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
        this.at(1900, function () {
            this.animate(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-in', fill: 'forwards' });
        });
        this.at(2400, function () {
            self.novaGone();
            if (calm) self.calmLockup();
            else self.novaHandoff();
        });
    };

    Intro.prototype.beginOpening = function () {
        if (this.openingStarted) return;
        this.openingStarted = true;
        this.t0 = performance.now();
        announce('wsa-intro-opening');
        this.opening();
        if (this.audio && this.audio.buffers.ambient) this.startAmbient();
    };

    /* ------------------------------------------------------------------ the calm version */

    Intro.prototype.calm = function () {
        this.media.hidden = true;
        this.word.hidden = true;
        this.cornerWord.hidden = true;
        this.badge.hidden = true;
        this.soundBtn.hidden = true;
        this.skipBtn.classList.add('is-shown');
        // No movement at all: the title fades in and out, then the lockup does, and the intro fades away
        this.novaType(true);
    };

    Intro.prototype.calmLockup = function () {
        var self = this;
        var shown = [this.insignia, this.motto];
        shown.forEach(function (el) { self.animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'forwards' }); });
        this.el.classList.add('is-titled');
        this.at(2700, function () {
            root.classList.add('wsa-intro-logo-home', 'wsa-intro-badge-home');
            this.restoreInert();
            var a = this.animate(this.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
            a.onfinish = function () { self.finish(false); };
        });
    };

    /* ------------------------------------------------------------------ the opening */

    Intro.prototype.opening = function () {
        var self = this;
        this.at(T.insignia, function () {
            this.animate(this.insignia, [
                { opacity: 0, transform: 'scale(0.9)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 1500, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' });
        });
        this.at(T.corner, function () {
            this.animate(this.cornerWord, [{ opacity: 0 }, { opacity: 0.9 }], { duration: 1100, fill: 'forwards' });
            this.soundBtn.classList.add('is-shown');
        });
        this.at(T.planet, function () {
            this.animate(this.still, [
                { opacity: 0, transform: 'scale(1.07)', filter: 'brightness(0.25)' },
                { opacity: 1, transform: 'none', filter: 'brightness(1)' }
            ], { duration: 2800, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)', fill: 'forwards' });
        });
        this.at(T.orbit, function () { this.traceOrbit(1800); });
        this.at(T.title, function () { this.el.classList.add('is-titled'); });
        this.at(T.motto, function () {
            this.animate(this.motto, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
                { duration: 1000, easing: 'ease-out', fill: 'forwards' });
        });
        this.at(T.dissolve, function () { self.dissolve(); });
        this.at(T.skip, function () { this.skipBtn.classList.add('is-shown'); });
    };

    Intro.prototype.traceOrbit = function (dur) {
        var self = this;
        var path = this.orbit.querySelector('path');
        var dot = this.orbit.querySelector('circle');
        var len = path.getTotalLength();
        path.style.strokeDasharray = len + ' ' + len;
        path.style.strokeDashoffset = len;
        this.orbit.style.opacity = '1';
        this.animate(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
            { duration: dur, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' });
        var t0 = performance.now();
        // The dot leads the line, then keeps drifting slowly along the orbit
        (function step(now) {
            if (self.done) return;
            var u = Math.min(1, (now - t0) / dur);
            var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            var p = path.getPointAtLength(len * Math.min(1, e + Math.max(0, (now - t0 - dur)) / 40000));
            dot.setAttribute('cx', p.x.toFixed(1));
            dot.setAttribute('cy', p.y.toFixed(1));
            self.frames[0] = requestAnimationFrame(step);
        })(t0);
    };

    /* ------------------------------------------------------------------ the insignia, building itself */

    var EMBLEM = MEDIA + 'logo/';
    var LAYERS = ['base', 'ring', 'blue', 'red', 'horizon', 'stars', 'trail', 'wsa', 'plane', 'rocket'];

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function easeOut(u) { return 1 - Math.pow(1 - u, 3); }
    function easeInOut(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

    // The insignia's layers and drawing data, fetched during the opening (they are needed at the end)
    Intro.prototype.loadEmblem = function () {
        var self = this;
        var imgs = LAYERS.map(function (k) {
            var im = new Image();
            im.src = EMBLEM + k + '.png';
            return im.decode ? im.decode() : new Promise(function (res, rej) { im.onload = res; im.onerror = rej; });
        });
        var data = fetch(EMBLEM + 'logo-parts.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
        this.emblemData = Promise.all([data].concat(imgs))
            .then(function (res) { self.parts = res[0]; return true; })
            .catch(function () { self.parts = null; return false; });
    };

    // On the badge the planet is turning into: the insignia builds itself if its layers are here (they have
    // had the whole opening and film to arrive); if not, the plain insignia fades in instead
    Intro.prototype.startBuild = function () {
        var self = this;
        this.animate(this.badge, [{ opacity: 0, filter: 'drop-shadow(0 0 0 rgba(120,160,255,0))' },
            { opacity: 1, filter: 'drop-shadow(0 0 30px rgba(120,160,255,0.35))' }],
            { duration: 600, easing: 'ease-out', fill: 'forwards' });
        function plain() {
            self.animate(self.badgeImg, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
        }
        if (!this.parts) { plain(); return; }
        try { this.buildEmblem(this.badge, this.badgeImg); } catch (e) { plain(); }
    };

    // WSA appears; the rocket flies in drawing its trail, then the spaceplane drawing the rest of it; the blue
    // and red arcs sweep in from either side; the stars twinkle in and the horizon is drawn; the outer ring
    // closes round it all. Each line is revealed by a stroke drawn along its centreline in an SVG mask. The
    // layers stack back into the original image, so at the end the built insignia is swapped for the real one
    // (img, in the same box as the build: host).
    Intro.prototype.buildEmblem = function (host, img) {
        var self = this, d = this.parts, S = d.size, NS = 'http://www.w3.org/2000/svg';
        function make(tag, attrs, parent) {
            var n = document.createElementNS(NS, tag);
            for (var k in attrs) n.setAttribute(k, attrs[k]);
            if (parent) parent.appendChild(n);
            return n;
        }
        var svg = make('svg', { viewBox: '0 0 ' + S + ' ' + S, 'aria-hidden': 'true', focusable: 'false', 'class': 'wsa-intro-build' });
        var defs = make('defs', {}, svg);
        var line = {};
        Object.keys(d.lines).forEach(function (k) {
            var m = make('mask', { id: 'wsa-ib-' + k, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: S, height: S }, defs);
            line[k] = make('path', { d: d.lines[k].d, fill: 'none', stroke: '#fff', 'stroke-width': d.lines[k].width,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 2', 'stroke-dashoffset': 1 }, m);
        });
        var sm = make('mask', { id: 'wsa-ib-stars', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: S, height: S }, defs);
        var dots = d.stars.map(function (st) { return make('circle', { cx: st.x, cy: st.y, r: 0, fill: '#fff' }, sm); });
        function layer(k, mask, parent) {
            var im = make('image', { href: EMBLEM + k + '.png', x: 0, y: 0, width: S, height: S }, parent || svg);
            if (mask) im.setAttribute('mask', 'url(#wsa-ib-' + mask + ')');
            return im;
        }
        var base = layer('base');
        layer('ring', 'ring');
        var blueG = make('g', { opacity: 0 }, svg);
        layer('blue', 'blue', blueG);
        var redG = make('g', { opacity: 0 }, svg);
        layer('red', 'red', redG);
        layer('horizon', 'horizon');
        layer('stars', 'stars');
        var glints = make('g', {}, svg);
        var glow = d.stars.map(function (st) { return make('circle', { cx: st.x, cy: st.y, r: 0, fill: '#fff', opacity: 0 }, glints); });
        layer('trail', 'rocket');
        layer('trail', 'plane');
        var wsaG = make('g', { opacity: 0 }, svg);
        layer('wsa', null, wsaG);
        var craftG = { plane: make('g', { opacity: 0 }, svg), rocket: make('g', { opacity: 0 }, svg) };
        layer('plane', null, craftG.plane);
        layer('rocket', null, craftG.rocket);
        img.style.opacity = '0';
        host.appendChild(svg);
        this.buildSvg = svg;

        // Stars come in at scattered moments over B.stars; the sparkle on the horizon comes last
        var starAt = d.stars.map(function (st, i) { return st.horizon ? B.stars[1] - 120 : ((i * 0.6180339) % 1) * (B.stars[1] - 300); });
        var lens = {};
        Object.keys(line).forEach(function (k) { lens[k] = line[k].getTotalLength(); });
        function k(t, span) { return clamp01((t - span[0]) / span[1]); }
        function draw(key, u) { line[key].setAttribute('stroke-dashoffset', (1 - u).toFixed(4)); }
        function fly(key, u) {
            var g = craftG[key], c = d.craft[key], L = lens[key], path = line[key];
            draw(key, u);
            if (u <= 0) { g.setAttribute('opacity', 0); return; }
            var p = path.getPointAtLength(u * L);
            var a = path.getPointAtLength(Math.max(0, u * L - 2)), b = path.getPointAtLength(Math.min(L, u * L + 2));
            var turn = (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI - c.heading) * (1 - easeInOut(clamp01((u - 0.82) / 0.18)));
            if (u >= 1) { p = { x: c.x, y: c.y }; turn = 0; }
            g.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') rotate(' + turn.toFixed(2) + ') translate(' + -c.x + ' ' + -c.y + ')');
            g.setAttribute('opacity', Math.min(1, u / 0.1).toFixed(3));
        }
        function render(t) {
            base.setAttribute('opacity', easeOut(k(t, B.disc)).toFixed(3));
            var w = k(t, B.wsa), ws = 0.9 + 0.1 * easeOut(w);
            wsaG.setAttribute('opacity', w.toFixed(3));
            wsaG.setAttribute('transform', 'translate(163 157) scale(' + ws.toFixed(4) + ') translate(-163 -157)');
            fly('rocket', easeInOut(k(t, B.rocket)));
            fly('plane', easeInOut(k(t, B.plane)));
            var bu = easeOut(k(t, B.blue)), ru = easeInOut(k(t, B.red));
            draw('blue', bu);
            blueG.setAttribute('opacity', Math.min(1, bu * 3).toFixed(3));
            blueG.setAttribute('transform', 'translate(' + (-16 * (1 - bu)).toFixed(2) + ' 0)');
            draw('red', ru);
            redG.setAttribute('opacity', Math.min(1, ru * 3).toFixed(3));
            redG.setAttribute('transform', 'translate(' + (16 * (1 - ru)).toFixed(2) + ' 0)');
            draw('horizon', easeInOut(k(t, B.horizon)));
            draw('ring', easeInOut(k(t, B.ring)));
            d.stars.forEach(function (st, i) {
                var p = clamp01((t - B.stars[0] - starAt[i]) / 380);
                var r = st.r * (p < 0.6 ? easeOut(p / 0.6) * 1.3 : 1.3 - 0.3 * easeInOut((p - 0.6) / 0.4));
                dots[i].setAttribute('r', r.toFixed(2));
                var flash = p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0;
                glow[i].setAttribute('r', (st.r * (st.horizon ? 0.7 : 0.45) * flash).toFixed(2));
                glow[i].setAttribute('opacity', (0.55 * flash).toFixed(3));
            });
        }
        var t0 = performance.now();
        (function frame(now) {
            if (self.done) return;
            var t = now - t0;
            render(t);
            if (t < B.done) { self.frames[2] = requestAnimationFrame(frame); return; }
            // Built: the real insignia takes over (the layers stack to exactly the same picture)
            img.style.opacity = '1';
            svg.remove();
        })(t0);
    };

    /* ------------------------------------------------------------------ the film */

    Intro.prototype.loadFilm = function () {
        var self = this;
        var v = document.createElement('video');
        v.className = 'wsa-intro-film';
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('aria-hidden', 'true');
        v.preload = 'auto';
        v.poster = MEDIA + 'wsa-intro-poster.webp';
        var big = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) >= 1700 &&
            Math.max(window.innerWidth, window.innerHeight) >= 1000;
        var res = big ? '1080' : '720';
        var webm = v.canPlayType('video/webm; codecs="vp9, opus"');
        v.src = MEDIA + 'wsa-intro-' + res + (webm ? '.webm' : '.mp4');
        v.addEventListener('error', function () { self.filmFailed = true; });
        this.media.insertBefore(v, this.orbit);
        this.film = v;
        v.load();
    };

    Intro.prototype.dissolve = function () {
        var self = this;
        // The opening's lockup and orbit fade away; the planet stays and comes alive
        this.animate(this.lockup, [{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: 'translate(-50%, -52%) scale(0.97)' }],
            { duration: 1500, easing: 'ease-in-out', fill: 'forwards' });
        this.animate(this.orbit, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100, easing: 'ease-in', fill: 'forwards' });
        this.cue('dissolve');
        this.fadeAmbient(0, 2.2);
        if (this.mode === 'lite') { this.stills(); return; }
        var v = this.film;
        var started = false;
        function go() {
            if (started || self.done) return;
            started = true;
            self.playFilm();
        }
        if (this.filmFailed) { this.stills(); return; }
        if (v.readyState >= 3) { go(); return; }
        // Still buffering: wait a little (the poster holds the frame), then make do with the stills
        v.addEventListener('canplay', go, { once: true });
        this.at(T.filmWait, function () {
            if (!started) { started = true; v.removeEventListener('canplay', go); this.stills(); }
        });
    };

    Intro.prototype.playFilm = function () {
        var self = this;
        var v = this.film;
        if (this.soundOn) { v.muted = false; v.volume = 0.9; }
        var p = v.play();
        if (p && p.catch) p.catch(function () {
            // Sound allowed for the cues but not for the film: play it muted rather than not at all
            if (!v.muted && !self.done) {
                v.muted = true;
                self.setSound(false);
                var again = v.play();
                if (again && again.catch) again.catch(function () { self.stills(); });
            } else {
                self.stills();
            }
        });
        v.addEventListener('playing', function () {
            if (self.done) return;
            v.style.opacity = '1';
            self.still.style.visibility = 'hidden';
            announce('wsa-intro-film');
        }, { once: true });
        // The film's own clock drives the landing, so it stays in step if playback stutters
        var stalledAt = 0;
        (function watch() {
            if (self.done || self.contracting) return;
            if (v.currentTime >= CONTRACT_AT || v.ended) { self.contract(); return; }
            if (v.paused || v.readyState < 3) {
                stalledAt = stalledAt || performance.now();
                if (performance.now() - stalledAt > 3000) { self.stills(true); return; }
            } else {
                stalledAt = 0;
            }
            self.frames[1] = requestAnimationFrame(watch);
        })();
    };

    // The fallback (and the lite version): the film's first and last frames, with a slow push-in between
    Intro.prototype.stills = function (late) {
        if (this.contracting || this.usingStills) return;
        this.usingStills = true;
        var self = this;
        announce('wsa-intro-film');
        if (this.film) { this.film.pause(); this.film.style.opacity = '0'; }
        this.still.style.visibility = '';
        var end = document.createElement('img');
        end.className = 'wsa-intro-end';
        end.alt = '';
        end.src = MEDIA + 'wsa-intro-end.webp';
        this.media.insertBefore(end, this.orbit);
        var lead = late ? 0 : 3600;
        this.animate(this.still, [{ transform: 'none' }, { transform: 'scale(1.06)' }], { duration: lead + 1200, easing: 'ease-in-out', fill: 'forwards' });
        this.timers.push(setTimeout(function () {
            if (self.done) return;
            self.animate(end, [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }],
                { duration: 1200, easing: 'ease-in-out', fill: 'forwards' });
        }, lead));
        this.timers.push(setTimeout(function () { if (!self.done) self.contract(); }, lead + 1500));
    };

    /* ------------------------------------------------------------------ the landing */

    // Where the film's frame is on screen (object-fit: cover of a 16:9 frame in the media box)
    Intro.prototype.frameGeometry = function () {
        var b = this.media.getBoundingClientRect();
        var w = this.media.offsetWidth, h = this.media.offsetHeight;
        var s = Math.max(w / 1920, h / 1080);
        return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: w, h: h, planet: PLANET_R * 1080 * s };
    };

    // The insignia builds itself at this size, so it gets a little more room than the opening's
    Intro.prototype.badgeSize = function () {
        return Math.round(Math.max(128, Math.min(240, Math.min(window.innerWidth, window.innerHeight) * 0.28)));
    };

    Intro.prototype.prepareWordmark = function () {
        var a = document.querySelector('.navbar .logo');
        var span = a && Array.prototype.filter.call(a.children, function (s) { return s.getClientRects().length; })[0];
        var w = this.word, cw = this.cornerWord;
        if (!a || !span) { w.hidden = true; cw.hidden = true; return; }
        var cs = getComputedStyle(a);
        this.K = 3;                                     // drawn large, shown scaled down: crisp at the centre
        this.logoSpan = span;
        this.logoColor = cs.color;
        var r = span.getBoundingClientRect();
        // The corner: level with the header logo, close to the left edge
        this.corner = { x: Math.min(r.left, Math.max(16, window.innerWidth * 0.022)), y: r.top };
        var self = this;
        [w, cw].forEach(function (el) {
            el.textContent = span.textContent;
            el.style.fontFamily = cs.fontFamily;
            el.style.fontWeight = cs.fontWeight;
            el.style.letterSpacing = (parseFloat(cs.letterSpacing) || 0) * self.K + 'px';
            el.style.fontSize = parseFloat(cs.fontSize) * self.K + 'px';
            el.style.color = 'rgb(244, 246, 251)';
            el.style.transform = self.place(self.corner.x, self.corner.y, 1 / self.K);
        });
    };

    Intro.prototype.place = function (x, y, s) {
        return 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px) scale(' + s.toFixed(5) + ')';
    };

    // place(), squashed or stretched about the bottom centre of an element w x h (unscaled) shown at scale s
    Intro.prototype.squash = function (x, y, s, w, h, sx, sy) {
        return 'translate(' + (x + w * s * (1 - sx) / 2).toFixed(2) + 'px, ' + (y + h * s * (1 - sy)).toFixed(2) + 'px) scale(' +
            (s * sx).toFixed(5) + ', ' + (s * sy).toFixed(5) + ')';
    };

    Intro.prototype.contract = function () {
        if (this.contracting || this.done) return;
        this.contracting = true;
        var self = this;
        var g = this.frameGeometry();
        var D = this.badgeSize();
        var r = D / 2;
        this.D = D;
        this.center = { x: g.cx, y: g.cy };
        this.measureHomes();
        // The frame shrinks round the planet until the planet is the size of the badge
        var startR = Math.hypot(g.w, g.h) / 2 + 2;
        this.media.style.webkitMask = this.media.style.mask = 'none';
        this.animate(this.media, [
            { transform: 'scale(1)', clipPath: 'circle(' + startR + 'px at 50% 50%)' },
            { transform: 'scale(' + (r / g.planet).toFixed(4) + ')', clipPath: 'circle(' + (g.planet * 1.012).toFixed(1) + 'px at 50% 50%)' }
        ], { duration: L.shrink, easing: 'cubic-bezier(0.62, 0, 0.22, 1)', fill: 'forwards' });
        // ...and on it the insignia builds itself
        var b = this.badge;
        b.style.width = b.style.height = D + 'px';
        b.style.transform = this.place(g.cx - r, g.cy - r, 1);
        this.at(L.badge, function () {
            this.cue('logo');
            this.startBuild();
        });
        this.at(L.shrink, function () {
            this.animate(this.media, [{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' });
            if (this.film) this.film.pause();
        });
        var landing = L.jump + Math.round(L.jumpDur * LAND_AT);
        this.at(L.pieces, this.holdPieces);
        this.at(L.swipe, this.swipe);
        this.at(L.release, this.release);
        this.at(L.jump, this.jump);
        this.at(landing, this.impact);
        this.at(L.interactive, this.restoreInert);
    };

    // The insignia rises a little; the corner's wordmark fades away and the wordmark appears under the
    // insignia instead, fading in as a soft edge swipes across it from the left
    Intro.prototype.swipe = function () {
        var D = this.D, c = this.center;
        var w = this.word;
        var gap = Math.round(D * 0.1);
        var sc = 1;
        if (!w.hidden) {
            var maxW = window.innerWidth * 0.84;
            if (w.offsetWidth > maxW) sc = maxW / w.offsetWidth;
        }
        var wordH = w.hidden ? 0 : w.offsetHeight * sc;
        var top = c.y - (D + gap + wordH) / 2;              // the lockup is centred as a whole
        this.lockupTop = top;
        this.animate(this.badge, [{ transform: this.place(c.x - D / 2, c.y - D / 2, 1) }, { transform: this.place(c.x - D / 2, top, 1) }],
            { duration: 700, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
        if (w.hidden) return;
        this.animate(this.cornerWord, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 400, easing: 'ease-in', fill: 'forwards' });
        var a = this.wordAt = { x: c.x - (w.offsetWidth * sc) / 2, y: top + D + gap, s: sc };
        w.style.transform = this.place(a.x, a.y, a.s);
        var mask = 'linear-gradient(90deg, #000 42%, transparent 58%)';
        w.style.webkitMaskImage = w.style.maskImage = mask;
        w.style.webkitMaskSize = w.style.maskSize = '300% 100%';
        w.style.webkitMaskRepeat = w.style.maskRepeat = 'no-repeat';
        var sw = this.animate(w, [
            { opacity: 0, transform: this.place(a.x - 18, a.y, a.s), maskPosition: '100% 0', WebkitMaskPosition: '100% 0' },
            { opacity: 1, transform: this.place(a.x, a.y, a.s), maskPosition: '0% 0', WebkitMaskPosition: '0% 0' }
        ], { duration: 900, delay: 100, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'both' });
        sw.onfinish = function () { w.style.webkitMaskImage = w.style.maskImage = 'none'; };
    };

    // The jump home: once the insignia has built itself and the black has cleared, it leaps from the middle
    // of the screen in an arc and lands hard on its own place on the homepage (the hero's insignia), squashing
    // on impact and rebounding a little; the wordmark arcs into the header logo at the same moment. Both are
    // sampled along a parabola, falling faster as they come down, so the landing has weight.
    Intro.prototype.jump = function () {
        var self = this;
        window.scrollTo(0, 0);
        var D = this.D, c = this.center;
        var hero = document.querySelector('.hero-logo');
        var lift = Math.min(170, window.innerHeight * 0.2);
        // n samples of the flight, then the squash at the landing (LAND_AT), a rebound and the rest pose
        function flight(from, to, height, squashOf) {
            var frames = [], n = 28;
            for (var i = 0; i <= n; i++) {
                var u = i / n;
                var k = u * u * (3 - 2 * u) * 0.35 + u * u * 0.65;          // slow off the mark, fast coming down
                var x = from.x + (to.x - from.x) * k;
                var y = from.y + (to.y - from.y) * k - height * 4 * k * (1 - k);
                var sc = from.s + (to.s - from.s) * k;
                frames.push({ transform: self.place(x, y, sc), offset: u * LAND_AT });
            }
            frames.push({ transform: squashOf(to, 1.12, 0.86), offset: LAND_AT + 0.05, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
            frames.push({ transform: squashOf(to, 0.97, 1.04), offset: LAND_AT + 0.1, easing: 'ease-in-out' });
            frames.push({ transform: self.place(to.x, to.y, to.s), offset: 1 });
            return frames;
        }
        if (hero && this.heroHome) {
            var h = this.heroHome;
            var shadow = getComputedStyle(hero).filter;
            var to = { x: h.left, y: h.top, s: h.width / D };
            var frames = flight({ x: c.x - D / 2, y: this.lockupTop, s: 1 }, to, lift, function (p, sx, sy) {
                return self.squash(p.x, p.y, p.s, D, D, sx, sy);
            });
            frames[0].filter = 'drop-shadow(0 0 30px rgba(120,160,255,0.35))';
            frames[frames.length - 1].filter = shadow && shadow !== 'none' ? shadow : 'drop-shadow(0 0 0 rgba(0,0,0,0))';
            var fly = this.animate(this.badge, frames, { duration: L.jumpDur, easing: 'linear', fill: 'forwards' });
            fly.onfinish = function () { root.classList.add('wsa-intro-badge-home'); self.badge.style.visibility = 'hidden'; };
        } else {
            this.animate(this.badge, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
        }
        if (this.word.hidden) return;
        var r = this.logoHome || this.logoSpan.getBoundingClientRect();
        var a = this.wordAt, ww = this.word.offsetWidth, wh = this.word.offsetHeight;
        var wf = flight({ x: a.x, y: a.y, s: a.s }, { x: r.left, y: r.top, s: 1 / this.K }, lift * 0.45, function (p, sx, sy) {
            return self.squash(p.x, p.y, p.s, ww, wh, 1 + (sx - 1) * 0.5, 1 + (sy - 1) * 0.5);
        });
        var f = this.animate(this.word, wf, { duration: L.jumpDur, easing: 'linear', fill: 'forwards' });
        f.onfinish = function () { root.classList.add('wsa-intro-logo-home'); self.word.style.visibility = 'hidden'; };
    };

    // The landing, on the page itself: a ring of light spreads out from the insignia's place on the homepage,
    // the page gives a little under the blow, and its buttons and panels start fading in outwards from there
    Intro.prototype.impact = function () {
        var h = this.heroHome;
        var size = h ? h.width : this.D;
        var cx = h ? h.left + h.width / 2 : this.center.x, cy = h ? h.top + h.height / 2 : this.lockupTop + this.D / 2;
        this.landing = { x: cx, y: cy };
        var ring = document.createElement('div');
        ring.className = 'wsa-intro-shock';
        ring.style.width = ring.style.height = size + 'px';
        ring.style.left = (cx - size / 2) + 'px';
        ring.style.top = (cy - size / 2) + 'px';
        this.el.insertBefore(ring, this.badge);
        this.animate(ring, [{ opacity: 0.9, transform: 'scale(0.96)' }, { opacity: 0, transform: 'scale(2.6)' }],
            { duration: 900, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' });
        var heroSec = document.querySelector('.hero');
        if (heroSec) {
            // a short, sharp give, over before the flying insignia hands over to the real one
            this.animate(heroSec, [{ transform: 'none' }, { transform: 'translateY(5px)', offset: 0.35 },
                { transform: 'translateY(-1px)', offset: 0.7 }, { transform: 'none' }],
                { duration: 170, easing: 'ease-out' });
        }
        this.revealPieces();
    };

    // Where the two logos live on the page. Measured while the page is still in its resting layout: once
    // the reveal starts, the header is briefly offset as it slides in.
    Intro.prototype.measureHomes = function () {
        window.scrollTo(0, 0);
        var hero = document.querySelector('.hero-logo');
        this.heroHome = hero ? hero.getBoundingClientRect() : null;
        this.logoHome = this.logoSpan ? this.logoSpan.getBoundingClientRect() : null;
    };

    // The parts of the page that fade in one by one: the header's links and buttons, the hero's text and
    // stat cards, the assistant's button, and each panel or card in view. Held invisible from early on (the
    // screen is still dark then), so none of them shows when the black falls away: the lockup lands on the
    // page's background, and they appear after the impact.
    Intro.prototype.holdPieces = function () {
        var vh = window.innerHeight, list = [];
        function add(el) {
            if (!el || list.indexOf(el) >= 0) return;
            var r = el.getBoundingClientRect();
            if (r.width && r.height && r.bottom > 0 && r.top < vh) list.push(el);
        }
        function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
        all('.navbar > :not(.logo):not(.nav-menu), .nav-menu > li')
            .sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; }).forEach(add);
        all('.hero .container > :not(.hero-logo):not(.featured-stats), .featured-stats > *').forEach(add);
        add(document.querySelector('.wsa-ai-launcher'));
        all('body > section:not(.hero)').forEach(function (sec) {
            var box = sec.querySelector('.container') || sec;
            Array.prototype.forEach.call(box.children, function (ch) {
                var kids = Array.prototype.filter.call(ch.children, function (k) { return /card|item|chip|btn|achievement/.test(k.className); });
                if (kids.length >= 2) kids.forEach(add);
                else add(ch);
            });
        });
        add(document.querySelector('body > footer'));
        list.forEach(function (el) { el.classList.add('wsa-intro-piece'); });
        this.pieces = list;
    };

    // The black falls away (blurred at first) before the drop, so the lockup lands on the homepage itself.
    // The wordmark takes the header logo's colour on the way, so it reads on a light page too.
    Intro.prototype.release = function () {
        this.el.classList.add('is-releasing');
        announce('wsa-intro-release');
        this.animate(this.el, [
            { backgroundColor: 'rgba(2, 3, 8, 1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
            { backgroundColor: 'rgba(2, 3, 8, 0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', offset: 0.35 },
            { backgroundColor: 'rgba(2, 3, 8, 0)', backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }
        ], { duration: L.releaseDur, easing: 'ease-out', fill: 'forwards' });
        if (!this.word.hidden) {
            var home = getComputedStyle(this.logoSpan).color || this.logoColor;
            this.animate(this.word, [{ color: 'rgb(244, 246, 251)' }, { color: home }], { duration: L.releaseDur, easing: 'ease-in-out', fill: 'forwards' });
            this.word.style.color = home;
        }
        this.animate(this.soundBtn, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
        this.animate(this.skipBtn, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    };

    // From the landing, outwards: each part's delay grows with its distance from where the insignia came down
    Intro.prototype.revealPieces = function () {
        var self = this, list = this.pieces || [];
        var ox = this.landing.x, oy = this.landing.y;
        var order = list.map(function (el) {
            var r = el.getBoundingClientRect();
            var x = Math.max(r.left, Math.min(ox, r.right)), y = Math.max(r.top, Math.min(oy, r.bottom));
            return { el: el, wait: Math.hypot(x - ox, y - oy) * RIPPLE };
        }).sort(function (a, b) { return a.wait - b.wait; });
        var last = -PIECE_GAP;
        order.forEach(function (p) {
            var at = Math.max(p.wait, last + PIECE_GAP);
            last = at;
            self.timers.push(setTimeout(function () { if (!self.done) p.el.classList.add('is-in'); }, at));
        });
        // Over once the last piece is in and both logos have settled
        var settle = Math.round(L.jumpDur * (1 - LAND_AT)) + 400;
        this.at(Math.max(last + 1000, settle), function () { this.finish(false); });
    };

    Intro.prototype.restoreInert = function () {
        this.inerted.forEach(function (c) { c.inert = false; });
        this.inerted = [];
    };

    /* ------------------------------------------------------------------ sound */

    Intro.prototype.prepareAudio = function () {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        this.soundOn = false;
        if (!Ctx) { this.soundBtn.hidden = true; return; }
        var self = this;
        var ctx;
        try { ctx = new Ctx(); } catch (e) { this.soundBtn.hidden = true; return; }
        var master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        var probe = document.createElement('audio');
        var ext = probe.canPlayType('audio/ogg; codecs="opus"') ? '.ogg' : '.m4a';
        this.audio = { ctx: ctx, master: master, buffers: {}, ext: ext };
        ['nova', 'ambient', 'dissolve', 'logo'].forEach(function (name) {
            fetch(MEDIA + 'wsa-intro-' + name + ext).then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
                .then(function (data) { return new Promise(function (res, rej) { ctx.decodeAudioData(data, res, rej); }); })
                .then(function (buf) {
                    self.audio.buffers[name] = buf;
                    if (name === 'ambient' && self.openingStarted) self.startAmbient();
                    if (name === 'nova') self.catchUpNova();
                })
                .catch(function () { /* a missing cue is just silence */ });
        });
        // Sound is on unless the visitor turned it off. Browsers hold sound back until the visitor's first
        // click, tap or key press on the page; if that happens here, that first interaction switches it on
        // (the sound button itself excepted: it is a choice of its own)
        var wanted = soundChoice() !== 'off';
        if (ctx.state === 'running') { if (wanted) this.setSound(true); }
        else if (wanted) {
            var p = ctx.resume();
            setTimeout(function () { if (!self.done && ctx.state === 'running') self.setSound(true); }, 250);
            if (p && p.catch) p.catch(function () {});
            this.onFirstGesture = function (e) {
                ['pointerdown', 'keydown'].forEach(function (t) { window.removeEventListener(t, self.onFirstGesture, true); });
                if (self.done || self.soundOn) return;
                if (e.target && e.target.closest && e.target.closest('.wsa-intro-sound')) return;
                if (e.type === 'keydown' && e.key === 'Escape') return;
                self.setSound(true);
            };
            ['pointerdown', 'keydown'].forEach(function (t) { window.addEventListener(t, self.onFirstGesture, true); });
        }
    };

    Intro.prototype.startAmbient = function () {
        var a = this.audio;
        if (!a || this.ambient || this.done) return;
        var src = a.ctx.createBufferSource();
        src.buffer = a.buffers.ambient;
        src.loop = true;
        var g = a.ctx.createGain();
        var now = a.ctx.currentTime;
        var elapsed = (performance.now() - this.t0) / 1000;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(elapsed * 1000 < T.dissolve ? 1 : 0, now + 2.0);
        src.connect(g).connect(a.master);
        src.start(now, elapsed % src.buffer.duration);
        this.ambient = { src: src, gain: g };
        if (elapsed * 1000 >= T.dissolve) this.fadeAmbient(0, 0.5);
    };

    Intro.prototype.fadeAmbient = function (to, secs) {
        if (!this.ambient) return;
        var g = this.ambient.gain.gain, now = this.audio.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(to, now + secs);
    };

    // A cue plays only while the audio clock is running: one started while sound is blocked would wait and
    // then play late, out of step with the picture. Returns whether it started.
    Intro.prototype.cue = function (name, offset) {
        var a = this.audio;
        if (!a || !a.buffers[name] || this.done || a.ctx.state !== 'running') return false;
        if (offset && offset >= a.buffers[name].duration - 0.05) return false;
        var src = a.ctx.createBufferSource();
        src.buffer = a.buffers[name];
        src.connect(a.master);
        src.start(a.ctx.currentTime, Math.max(0, offset || 0));
        return true;
    };

    // The title's cue, if the title is still on and its sound didn't start with it (the cue arrived late, or the
    // browser only now allows sound): from where the picture is, never from the top
    Intro.prototype.catchUpNova = function () {
        if (!this.novaActive || this.novaCue || this.done) return;
        this.novaCue = this.cue('nova', (performance.now() - this.novaT0) / 1000);
    };

    Intro.prototype.setSound = function (on, byVisitor) {
        var a = this.audio;
        if (!a) return;
        var self = this;
        this.soundOn = on;
        if (byVisitor) soundChoice(on ? 'on' : 'off');
        if (on && a.ctx.state !== 'running') {
            var p = a.ctx.resume();
            if (p && p.then) p.then(function () { self.catchUpNova(); }, function () {});
        } else if (on) {
            this.catchUpNova();
        }
        var now = a.ctx.currentTime;
        a.master.gain.cancelScheduledValues(now);
        a.master.gain.setValueAtTime(a.master.gain.value, now);
        a.master.gain.linearRampToValueAtTime(on ? 1 : 0, now + (on ? 0.8 : 0.25));
        if (this.film) {
            this.film.muted = !on;
            if (on) this.film.volume = 0.9;
        }
        this.soundBtn.setAttribute('aria-pressed', String(on));
        var label = on ? this.t.soundOff : this.t.soundOn;
        this.soundBtn.setAttribute('aria-label', label);
        this.soundBtn.title = label;
    };

    /* ------------------------------------------------------------------ the end, natural or skipped */

    Intro.prototype.finish = function (skipped, byKeyboard) {
        if (this.done) return;
        this.done = true;
        var self = this;
        this.timers.forEach(clearTimeout);
        this.frames.forEach(function (f) { cancelAnimationFrame(f); });
        this.novaActive = false;
        if (this.novaPlayer) { this.novaPlayer.dispose(); this.novaPlayer = null; }
        if (this.film) { try { this.film.pause(); } catch (e) {} }
        if (this.audio) {
            var a = this.audio, now = a.ctx.currentTime;
            a.master.gain.cancelScheduledValues(now);
            a.master.gain.setValueAtTime(a.master.gain.value, now);
            a.master.gain.linearRampToValueAtTime(0, now + 0.3);
            setTimeout(function () { try { a.ctx.close(); } catch (e) {} }, 450);
        }
        window.removeEventListener('keydown', this.onKey, true);
        if (this.onFirstGesture) {
            window.removeEventListener('pointerdown', this.onFirstGesture, true);
            window.removeEventListener('keydown', this.onFirstGesture, true);
        }
        window.removeEventListener('pageshow', this.onShow);
        document.removeEventListener('visibilitychange', this.onHide);
        this.restoreInert();
        // The page in its ordinary state: no held-back parts, both logos where they always are
        root.classList.remove('wsa-intro-pending', 'wsa-intro-running', 'wsa-intro-logo-home', 'wsa-intro-badge-home');
        Array.prototype.forEach.call(document.querySelectorAll('.wsa-intro-piece'), function (el) {
            el.classList.remove('wsa-intro-piece', 'is-in');
        });
        var el = this.el;
        announce('wsa-intro-end');
        function remove() {
            self.anims.forEach(function (x) { try { x.cancel(); } catch (e) {} });
            if (el && el.parentNode) el.parentNode.removeChild(el);
            running = null;
        }
        if (el && skipped && el.animate) {
            el.style.pointerEvents = 'none';
            var out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out', fill: 'forwards' });
            out.onfinish = remove;
            setTimeout(remove, 600);
        } else {
            remove();
        }
        if (byKeyboard) {
            var logo = document.querySelector('.navbar .logo');
            if (logo) logo.focus({ preventScroll: true });
        }
    };

    /* ------------------------------------------------------------------ when to play */

    function play(fromReplay) {
        if (running) return;
        if (!document.body) return;
        running = new Intro(chooseMode());
        running.replay = !!fromReplay;
        try { running.start(); } catch (e) { running.fail(e); }
    }

    window.WSAIntro = {
        replay: function () { play(true); },
        skip: function () { if (running) running.finish(true); },
        get running() { return !!running; }
    };

    // "Replay intro" in the footer (a plain link to ?intro, so it also works before this script runs)
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest && e.target.closest('.wsa-intro-replay');
        if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        play(true);
    });

    // First page of the session, or a reload of the homepage: play. Arriving from another of the site's pages,
    // or going back and forward: straight to the page.
    var forced = /[?&]intro(=|&|$)/.test(location.search);
    var navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var reload = navEntry ? navEntry.type === 'reload' : !!(performance.navigation && performance.navigation.type === 1);
    var seen = null;
    try {
        seen = sessionStorage.getItem(SEEN);
        sessionStorage.setItem(SEEN, '1');
    } catch (e) {
        if (!forced && !reload) return;      // without session storage it would play on every page
    }
    if (seen && !forced && !reload) return;

    // Cover the page from the first paint until the intro itself is on screen
    root.classList.add('wsa-intro-pending');
    var pendingFailsafe = setTimeout(function () { root.classList.remove('wsa-intro-pending'); }, 4000);
    var preload = new Image();
    preload.src = MEDIA + 'wsa-intro-poster.webp';
    function begin() {
        clearTimeout(pendingFailsafe);
        // A first visit asks for the language first (i18n.js); the intro starts once it is chosen, in that
        // language, and the click lets the browser play its sound
        var i18n = window.WSAi18n;
        if (i18n && i18n.choosing && i18n.choosing()) {
            i18n.afterChoice(function () { play(false); });
            return;
        }
        play(false);
    }
    if (document.body && document.readyState !== 'loading') begin();
    else document.addEventListener('DOMContentLoaded', begin);
})();
