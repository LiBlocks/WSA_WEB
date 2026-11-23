// The universe engine: one renderer, one scene, one loop. It owns resizing, the pixel-ratio budget, the
// theme, quality, animation intensity, moods, the pointer, picking, and pausing when nobody can see it.
// The homepage's UI (home/main.js) drives it through this small API and never touches Three.js itself.
//
//   const u = await Universe.create(host, options)    throws if WebGL is unavailable
//   u.setScroll(f) u.setNarrow(b) u.setMood(name, 0..1) u.setTheme('light'|'dark') u.setIntensity(0..1)
//   u.pointer(x, y, active) u.pick(x, y) -> id | null    u.screenPosition(id) -> {x, y, visible, r}
//   u.explorer: enter(id) exit() focus(id) orbit(dx, dy) zoom(k)
//   u.setRegions({pose: {x0, x1, y0, y1}})  free parts of the view per pose (fractions), for composing
//   u.setSafeArea({x0, x1, y0, y1} | null)   the free part of the view in Explore mode
//   u.setFollow('sections'|'scroll')          how the camera follows the page (see camera.js)
//   u.setGlass([{x, y, w, h, r}], on)         the panels the scene bends under (page px; see glass.js)
//   u.setSuspended(b)  u.on('ready'|'lost'|'slow', fn)   u.dispose()
import * as THREE from 'three';
import { createSky } from './sky.js';
import { createStars } from './stars.js';
import { createGalaxy } from './galaxy.js';
import { createSystem } from './system.js';
import { createEffects } from './effects.js';
import { makeLayout } from './layout.js';
import { CameraRig, Explorer } from './camera.js';
import { Glass } from './glass.js';
import { MOODS, POSES, SCROLL_PATH } from './environments.js';

// Colours here are authored as display values; nothing is converted on the way out
THREE.ColorManagement.enabled = false;

// Pixel-ratio budget per quality. Phones get 1.5, not 1: at 1 a 3x screen shows the scene three times
// enlarged, and the small worlds and the asteroids break up into blocks. Auto quality steps it down if slow.
const DPR = { low: 1.5, high: 1.5, ultra: 2 };

export function detectQuality() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 700;
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    return coarse || small || mem <= 4 || cores <= 4 ? 'low' : 'high';
}

export class Universe {
    static async create(host, options) {
        const u = new Universe(host, options);
        try {
            await u.init();
        } catch (e) {
            u.dispose();
            throw e;
        }
        return u;
    }

    constructor(host, { quality = 'auto', effects = 'full', intensity = 0.6, theme = 'dark', reducedMotion = false } = {}) {
        this.host = host;
        this.requestedQuality = quality;
        this.quality = quality === 'auto' ? detectQuality() : quality;
        this.effects = effects;
        this.intensity = intensity;
        this.reducedMotion = reducedMotion;
        this.theme = theme;
        this.listeners = {};
        this.moodTarget = Object.fromEntries(MOODS.map(m => [m, 0]));
        this.disposed = false;
        this.visible = !document.hidden;
        this.frameTimes = [];
    }

    on(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
    emit(name, data) { (this.listeners[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }

    async init() {
        this.starting = true;            // no frames until everything is compiled and in place
        const canvas = document.createElement('canvas');
        canvas.className = 'home-universe';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.tabIndex = -1;
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
        } catch (e) {
            throw new Error('WebGL unavailable: ' + (e && e.message));
        }
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        renderer.setClearColor(this.theme === 'light' ? 0xeef2f8 : 0x03050c, 1);
        this.renderer = renderer;
        this.canvas = canvas;
        this.host.appendChild(canvas);

        this.glass = new Glass(renderer, { samples: this.quality === 'low' ? 2 : 4 });
        const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 6000);
        this.camera = camera;
        this.scene = new THREE.Scene();

        const pr = this.pixelRatio();
        this.ctx = {
            quality: this.quality, effects: this.effects, pixelRatio: pr,
            uniforms: { uPointer: { value: new THREE.Vector2(9, 9) }, uLens: { value: 0 }, uAspect: { value: 1 } },
            time: 0, clock: 0, dt: 0, intensity: this.intensity, motion: this.motion(),
            themeMix: this.theme === 'light' ? 1 : 0, mood: Object.fromEntries(MOODS.map(m => [m, 0])),
            camera, width: 1, height: 1, fade: 0, orbitFade: 1, orbitShow: 0.35,
        };

        // The system first: the opening view decides where the sky's landmarks go
        this.system = createSystem(this.ctx);
        this.system.place(0);
        this.rig = new CameraRig(camera, this.system, canvas);
        this.rig.path = SCROLL_PATH.map(s => s.pose);
        const home = this.rig.resolve('home', { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, shift: 0 });
        const f = home.look.clone().sub(home.pos).normalize();
        const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(r, f);
        this.layout = makeLayout(f, r, up);

        const t0 = performance.now();
        this.sky = await createSky(renderer, this.layout, this.quality);
        if (this.disposed) throw new Error('disposed while starting');
        const t1 = performance.now();
        this.stars = createStars(this.ctx, this.layout);
        this.galaxy = createGalaxy(this.ctx, this.layout);
        this.effectsLayer = createEffects(this.ctx, this.system, this.stars);
        this.timings = { sky: Math.round(t1 - t0), layers: Math.round(performance.now() - t1) };
        this.layers = [this.sky, this.stars, this.galaxy, this.system, this.effectsLayer];
        for (const l of this.layers) this.scene.add(l.object);
        this.explorer = new Explorer(this.rig, this);

        // Pick proxies for the deep sky
        const proxyGeo = new THREE.SphereGeometry(1, 8, 6);
        const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
        this.deep = {
            nebula: { pos: this.layout.nebulaA.clone().multiplyScalar(1700), r: 260 },
            cluster: { pos: this.layout.globular.clone().multiplyScalar(1700), r: 40 },
            constellation: { pos: this.layout.constellation.clone().multiplyScalar(1700), r: 180 },
            galaxy: { pos: this.galaxy.positions.galaxy, r: 90 },
            blackhole: { pos: this.galaxy.positions.blackhole, r: 22 },
        };
        this.deepProxies = [];
        for (const id of ['nebula', 'cluster', 'constellation']) {
            const m = new THREE.Mesh(proxyGeo, proxyMat);
            m.position.copy(this.deep[id].pos);
            m.scale.setScalar(this.deep[id].r);
            m.userData.bodyId = id;
            this.scene.add(m);
            this.deepProxies.push(m);
        }
        this.ownedExtra = [proxyGeo, proxyMat];
        this.pickables = [...this.system.pickables, ...this.galaxy.pickables, ...this.deepProxies];
        this.raycaster = new THREE.Raycaster();

        // Sizing
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.host);
        this.resize();

        // Lifecycle
        this.onVisibility = () => {
            this.visible = !document.hidden;
            this.syncLoop();
        };
        document.addEventListener('visibilitychange', this.onVisibility);
        canvas.addEventListener('webglcontextlost', this.onLost = e => {
            e.preventDefault();
            this.lost = true;
            renderer.setAnimationLoop(null);
            this.emit('lost');
        });

        // Compile every shader before the first frame, in parallel where the browser can: the first frame
        // would otherwise compile them one after another and freeze the page for a second or more
        this.rig.snap(this.ctx);
        const c0 = performance.now();
        if (renderer.compileAsync) await renderer.compileAsync(this.scene, this.camera);
        this.timings.compile = Math.round(performance.now() - c0);
        if (this.disposed) throw new Error('disposed while starting');
        this.starting = false;
        this.last = performance.now();
        this.started = performance.now();
        this.syncLoop();
        this.invalidate();
    }

    pixelRatio() {
        return Math.min(window.devicePixelRatio || 1, DPR[this.quality] * (this.dprScale || 1));
    }

    motion() {
        return this.reducedMotion ? 0 : this.intensity;
    }

    // Resizing a canvas clears it. Drawn again here, in the same task as the resize (before the page is
    // painted), it never shows empty: before, a frame of black could be painted in between, which flashed
    // whenever a phone's toolbar came back on scrolling up. (The sky is sized to the large viewport too,
    // home/home.css, so the toolbar doesn't resize it at all.)
    resize() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        if (!w || !h || this.disposed) return;
        const pr = this.pixelRatio();
        if (w === this.size?.w && h === this.size?.h && pr === this.size?.pr) return;
        this.size = { w, h, pr };
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h, false);
        this.glass.setSize(w, h, pr);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.ctx.pixelRatio = pr;
        this.ctx.width = w * pr;
        this.ctx.height = h * pr;
        this.ctx.uniforms.uAspect.value = w / h;
        this.rig.narrow = w / h < 0.95;
        if (this.firstFrame && !this.starting && !this.suspended && !this.lost) this.frame(performance.now(), true);
        else this.invalidate();
    }

    // Continuous animation unless nothing moves (zero intensity or reduced motion): then frames are drawn
    // only when something changes, and nothing runs at all while the page is hidden.
    syncLoop() {
        if (this.disposed || this.lost || this.starting) return;
        const run = this.visible && !this.suspended && (this.motion() > 0 || this.needsFrames());
        if (run && !this.looping) {
            this.looping = true;
            this.last = performance.now();
            this.renderer.setAnimationLoop(t => this.frame(t));
        } else if (!run && this.looping) {
            this.looping = false;
            this.renderer.setAnimationLoop(null);
        }
    }

    needsFrames() {
        // fading in, moods easing, the camera travelling, a hover glow settling
        if (this.ctx.fade < 1) return true;
        for (const m of MOODS) if (Math.abs(this.ctx.mood[m] - this.moodTarget[m]) > 0.002) return true;
        if (!this.rig.settled()) return true;
        for (const b of this.system.bodies.values()) if (Math.abs(b.hover - b.hoverTarget) > 0.002) return true;
        if (this.effectsLayer.state && Math.abs(this.effectsLayer.state.climb - this.effectsLayer.state.climbTarget) > 0.002) return true;
        if (this.glass.enabled && this.glass.strength < 0.99) return true;
        return this.explorer.controls.enabled;
    }

    invalidate() {
        if (this.disposed || this.lost || this.looping || this.suspended || this.starting) return;
        if (this.pending) return;
        this.pending = requestAnimationFrame(t => {
            this.pending = 0;
            this.frame(t);
            this.syncLoop();
        });
    }

    frame(now, force) {
        if (this.disposed) return;
        // Reduced effects: about 30 frames a second
        if (!force && this.effects === 'reduced' && this.looping && now - this.lastDraw < 30) return;
        const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
        this.last = now;
        this.lastDraw = now;
        const c = this.ctx;
        c.dt = dt;
        c.time += dt;
        c.motion = this.motion();
        c.intensity = this.intensity;
        c.clock += dt * c.motion;
        c.fade = Math.min(1, c.fade + dt / 1.4);
        const themeTarget = this.theme === 'light' ? 1 : 0;
        c.themeMix = themeTarget;
        const k = 1 - Math.exp(-dt * 3.2);
        for (const m of MOODS) c.mood[m] += (this.moodTarget[m] - c.mood[m]) * (c.motion > 0 ? k : 1);
        // The pointer's lens: only with full effects
        const lens = this.effects === 'full' && this.pointerActive && !this.explorer.controls.enabled ? 0.9 * Math.max(0.35, c.motion) : 0;
        c.uniforms.uLens.value += (lens - c.uniforms.uLens.value) * Math.min(1, dt * 5);
        if (this.pointerNdc) c.uniforms.uPointer.value.lerp(this.pointerNdc, Math.min(1, dt * 10));

        this.system.update(c);
        this.rig.update(dt, c);
        for (const l of this.layers) if (l !== this.system) l.update(c);
        const r0 = this.firstFrame ? 0 : performance.now();
        if (!this.explorer.controls.enabled && this.glass.place(window.scrollY, dt)) this.glass.render(this.scene, this.camera);
        else this.renderer.render(this.scene, this.camera);
        if (!this.firstFrame) this.timings.firstFrame = Math.round(performance.now() - r0);
        this.watchSpeed(dt);
        if (!this.firstFrame) { this.firstFrame = true; this.emit('ready'); }
        if (this.looping && c.motion === 0 && !this.needsFrames()) this.syncLoop();
    }

    // Auto quality: if frames are slow once things have settled, render fewer pixels, then ask for less
    watchSpeed(dt) {
        if (this.requestedQuality !== 'auto' || !this.looping || this.explorer.controls.enabled) return;
        if (performance.now() - this.started < 2500) return;
        this.frameTimes.push(dt);
        if (this.frameTimes.length < 90) return;
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes.length = 0;
        if (avg > 0.026) {
            if ((this.dprScale || 1) > 0.67) {
                this.dprScale = (this.dprScale || 1) * 0.75;
                this.resize();
            } else if (this.quality !== 'low') {
                this.emit('slow', 'low');
            }
        }
    }

    // While the intro covers the page nothing is drawn; the fade-in starts when it lets go
    setSuspended(on) {
        this.suspended = on;
        if (on) this.ctx.fade = 0;
        this.syncLoop();
        this.invalidate();
    }

    // ---------- inputs from the page ----------
    setScroll(f) {
        this.rig.scroll = f;
        this.invalidate();
        this.syncLoop();
    }

    setRegions(regions) {
        this.rig.regions = regions || {};
        this.syncLoop();
        this.invalidate();
    }

    setSafeArea(rect) {
        this.explorer.setSafe(rect);
        this.syncLoop();
        this.invalidate();
    }

    setGlass(panes, on) {
        this.glass.setPanes(panes);
        this.glass.enabled = !!on && this.effects === 'full';
        this.invalidate();
    }

    // Draw now (from a page's own animation frame), so what follows the scroll is drawn in the same frame
    drawNow() {
        if (this.disposed || this.lost || this.starting || this.suspended || this.looping || !this.firstFrame) return;
        cancelAnimationFrame(this.pending);
        this.pending = 0;
        this.frame(performance.now(), true);
        this.syncLoop();
    }

    setFollow(mode) {
        this.rig.follow = mode;
    }

    setMood(name, value) {
        if (!(name in this.moodTarget)) return;
        this.moodTarget[name] = value;
        this.syncLoop();
        this.invalidate();
    }

    setTheme(theme) {
        this.theme = theme;
        this.renderer.setClearColor(theme === 'light' ? 0xeef2f8 : 0x03050c, 1);
        this.invalidate();
    }

    setIntensity(v) {
        this.intensity = Math.max(0, Math.min(1, v));
        this.syncLoop();
        this.invalidate();
    }

    pointer(x, y, active) {
        const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
        this.pointerActive = active;
        this.pointerNdc = (this.pointerNdc || new THREE.Vector2()).set((x / w) * 2 - 1, 1 - (y / h) * 2);
        this.rig.parallaxTarget.set(active ? this.pointerNdc.x : 0, active ? this.pointerNdc.y : 0);
        if (!this.looping) this.invalidate();
    }

    pick(x, y) {
        const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
        this.raycaster.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2), this.camera);
        const hits = this.raycaster.intersectObjects(this.pickables, false);
        return hits.length ? hits[0].object.userData.bodyId : null;
    }

    setHover(id) {
        for (const b of this.system.bodies.values()) b.hoverTarget = b.id === id ? 1 : 0;
        this.invalidate();
        this.syncLoop();
    }

    // Where an object is on screen (CSS pixels), for labels
    screenPosition(id, out = {}) {
        const b = this.system.bodies.get(id);
        const p = b ? b.pos : id === 'comet' ? this.system.comet.pos : this.deep[id] && this.deep[id].pos;
        if (!p) return null;
        const v = new THREE.Vector3().copy(p).project(this.camera);
        const w = this.host.clientWidth, h = this.host.clientHeight;
        out.x = (v.x * 0.5 + 0.5) * w;
        out.y = (0.5 - v.y * 0.5) * h;
        out.visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        const rr = b ? b.def.r : this.deep[id] ? this.deep[id].r : 0.5;
        const dist = this.camera.position.distanceTo(p);
        out.r = (rr / dist) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * h * 0.5;
        return out;
    }

    deepSkyPosition(id) {
        if (id === 'comet') return { pos: this.system.comet.pos, dist: 9 };
        const d = this.deep[id];
        if (!d) return null;
        return { pos: d.pos, dist: d.r * 4.2 };
    }

    showConstellation(on) {
        this.effectsLayer.showClimb(on);
        this.syncLoop();
        this.invalidate();
    }

    // For tests and debugging: the state worth checking
    debugState() {
        const c = this.ctx;
        return {
            quality: this.quality, pixelRatio: c.pixelRatio, looping: this.looping, clock: c.clock, fade: c.fade, theme: this.theme,
            intensity: this.intensity, scroll: this.rig.scroll, mood: { ...c.mood }, explore: !!this.explorer.controls.enabled,
            focus: this.explorer.focusId, follow: this.rig.follow, lens: [this.rig.sx, this.rig.sy],
            camera: this.camera.position.toArray(), aim: this.rig.look.toArray(), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
            geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, poses: Object.keys(POSES),
            timings: this.timings, glass: { on: this.glass.enabled, panes: this.glass.panes.length, drawn: this.glass.material.uniforms.uCount.value, strength: this.glass.strength }, programs: this.renderer.info.programs ? this.renderer.info.programs.length : null,
        };
    }

    // Safe at any point, including part-way through init()
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.renderer) this.renderer.setAnimationLoop(null);
        cancelAnimationFrame(this.pending);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
        if (this.onLost) this.canvas.removeEventListener('webglcontextlost', this.onLost);
        if (this.explorer) this.explorer.dispose();
        for (const l of this.layers || []) l.dispose();
        if (this.system && !(this.layers || []).includes(this.system)) this.system.dispose();
        (this.ownedExtra || []).forEach(o => o.dispose());
        if (this.glass) this.glass.dispose();
        if (this.renderer) this.renderer.dispose();
        if (this.canvas) this.canvas.remove();
    }
}
