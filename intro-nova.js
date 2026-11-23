// NovaUI 2.0: the title that opens the homepage intro (intro.js plays it before the WSA opening).
//
// Three shots, each from a camera that does not move:
//   A  0.00-1.95 s  an extreme close-up of one corner of the lettering; the light shifts slightly, and the
//                   highlight on the letters' chamfer slides a little along the edge
//   B  1.95-3.85 s  a second close-up, of another part of the title, lit the same way
//   C  3.85-6.45 s  the whole title: it settles gently back into frame, holds, and goes dark as the WSA opening
//                   begins (intro.js starts the opening at the hand-over)
// Between the shots the picture dips to black for a moment.
//
// The words are Inter Display Light (OFL 1.1) with just a little depth: a thin slab with a small rounded chamfer
// round the face (media/intro/novaui-title.bin, built in Blender: ~/Documents/wsa-intro-production/nova/
// build_title.py), in obsidian. One material, one soft studio reflected in it (a softbox above, a wall facing
// the letters, two narrow strips whose reflections slide across the faces in the close-ups), one key light and a
// faint fill; nothing else.
//
// Framing adapts to the screen: each close-up fits its part of the title to the window, and the closing shot
// fits the whole title to its width. The renderer, its textures and its geometry are released as soon as the
// title is over (or skipped).
import * as THREE from 'three';

export const TIMING = { b: 1.95, c: 3.85, settle: 5.0, handoff: 5.95, end: 6.45 };
const DIP = 0.14;               // half the length of the dip to black between shots

// The finish of the letters: obsidian, a dark glass with a polished edge. The faces are near-black slate that
// picks up the studio's cool light; the chamfer catches warm and cool reflections that slide along it in the
// close-ups; the whole title is lifted (hold) so its thin letters read at a glance.
const FINISH = {
    color: [0.042, 0.045, 0.056], metalness: 0.9, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03,
    ior: 1.9, env: 1.65, key: 1.05, fill: 0.03,
    keyColor: [1, 0.985, 0.96],
    tint: { soft: [1.1, 1.15, 1.3], strip: [1.2, 1.3, 1.5], strip2: [1.5, 1.25, 1.15], back: [2, 2.2, 3], wall: [1.35, 1.4, 1.65] },
    hold: { env: 1.6, key: 1.8 },
};

const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));     // smootherstep
const sine = t => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
const clamp01 = t => Math.max(0, Math.min(1, t));
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);          // working (linear) values, whatever the page set
const rad = THREE.MathUtils.degToRad;

// The two close-ups, in the title's own units (font size 1; the title, Inter Display Light, runs from x -1.63 to
// 1.65, its capitals from y -0.26 to 0.27, its face at z = bbox max). Each looks at a point on the face from a
// fixed direction (yaw about the vertical, pitch about the horizontal, degrees) and fits a patch of the face
// (w x h) in view; upright screens frame a narrower, taller patch of the same part. The key light turns slightly
// over the shot (azimuth / elevation, degrees, from -> to), so the highlight on the chamfer moves a little.
const SHOTS = {
    // the top left corner of the N
    A: { wide: { at: [-1.497, 0.173], w: 0.366, h: 0.234 }, tall: { at: [-1.487, 0.1], w: 0.224, h: 0.305 },
         yaw: -15, pitch: 9, key: [[-64, 28], [-36, 34]], env: [0.24, 0.06] },
    // the bowl of the 2
    B: { wide: { at: [0.963, 0.081], w: 0.489, h: 0.326 }, tall: { at: [0.963, 0.081], w: 0.275, h: 0.407 },
         yaw: 14, pitch: -6, key: [[58, 30], [30, 42]], env: [-0.16, 0.02] },
};

// The mesh file: see build_title.py for the layout
function decode(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x41564f4e) throw new Error('not a NovaUI title mesh');        // 'NOVA'
    const n = dv.getUint32(8, true), m = dv.getUint32(12, true);
    const bb = [0, 1, 2, 3, 4, 5].map(i => dv.getFloat32(16 + i * 4, true));
    let o = 40;
    const qp = new Int16Array(buf, o, 3 * n); o += 6 * n;
    const qn = new Int16Array(buf, o, 3 * n); o += 6 * n;
    const index = n > 65535 ? new Uint32Array(buf, o, m) : new Uint16Array(buf, o, m);
    const pos = new Float32Array(3 * n);
    for (let i = 0; i < 3 * n; i++) {
        const a = i % 3;
        pos[i] = bb[a] + ((qp[i] + 32767) / 65534) * (bb[a + 3] - bb[a]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(qn, 3, true));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingBox();
    return geo;
}

// The studio the letters reflect, rendered once into an environment map: a large soft light above and in
// front, a wall facing the letters that fades from grey at the top to black at the bottom (what the flat faces
// reflect, so they read as a soft gradient), a dim light behind, and darkness everywhere else
function studio(tint = {}) {
    const s = new THREE.Scene();
    const T = (c, t) => (t ? c.map((v, i) => v * t[i]) : c);
    const owned = [];
    const panel = (w, h, top, bottom, pos) => {
        const geo = new THREE.PlaneGeometry(w, h);
        const c = [], a = lin(...top), b = lin(...bottom);
        for (let i = 0; i < geo.attributes.position.count; i++) {
            const k = geo.attributes.position.getY(i) > 0 ? a : b;
            c.push(k.r, k.g, k.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        s.add(m);
        owned.push(geo, mat);
    };
    panel(9, 3.2, T([1.7, 1.72, 1.78], tint.soft), T([1.7, 1.72, 1.78], tint.soft), [0, 4.4, 3.6]);     // the softbox
    panel(16, 8, T([0.5, 0.51, 0.54], tint.wall), T([0.015, 0.015, 0.018], tint.wall), [0, 0.6, 7]);    // the wall facing the letters
    // two narrow soft strips in front, where the faces look in the two close-ups: as the light drifts over each
    // shot, the strip's reflection slides across the letter's face (the whole title, straight on, sees neither)
    panel(0.7, 9, T([4, 4.05, 4.2], tint.strip), T([1.2, 1.22, 1.28], tint.strip), [0.8, 0.4, 6.4]);
    panel(0.7, 9, T([4, 4.05, 4.2], tint.strip2 || tint.strip), T([1.2, 1.22, 1.28], tint.strip2 || tint.strip), [-1.1, 0.4, 6.4]);
    panel(10, 2, T([0.22, 0.23, 0.26], tint.back), T([0.22, 0.23, 0.26], tint.back), [0, 2.5, -6]);     // a dim light behind
    return { scene: s, dispose: () => owned.forEach(o => o.dispose()) };
}

export async function createNova(host, { url, signal, finish } = {}) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('title mesh: HTTP ' + res.status);
    const geo = decode(await res.arrayBuffer());
    const nova = new Nova(host, geo, { ...FINISH, ...finish });
    try {
        await nova.prepare();
    } catch (e) {
        nova.dispose();
        throw e;
    }
    return nova;
}

class Nova {
    constructor(host, geo, finish) {
        this.host = host;
        this.geo = geo;
        const canvas = document.createElement('canvas');
        canvas.className = 'wsa-intro-nova-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.canvas = canvas;
        this.renderer = renderer;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 0;
        renderer.setClearColor(0x000000, 1);
        host.appendChild(canvas);

        this.scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const st = studio(finish.tint);
        this.env = pmrem.fromScene(st.scene, 0.04);
        st.dispose();
        pmrem.dispose();
        this.scene.environment = this.env.texture;
        this.scene.environmentIntensity = finish.env;

        this.material = new THREE.MeshPhysicalMaterial({
            color: lin(...finish.color), metalness: finish.metalness || 0, roughness: finish.roughness, ior: finish.ior,
            clearcoat: finish.clearcoat || 0, clearcoatRoughness: finish.clearcoatRoughness || 0,
            ...finish.extra,
        });
        this.title = new THREE.Mesh(geo, this.material);
        this.key = new THREE.DirectionalLight(lin(...(finish.keyColor || [1, 0.985, 0.96])), finish.key);
        this.fill = new THREE.HemisphereLight(lin(0.5, 0.52, 0.58), lin(0.02, 0.02, 0.025), finish.fill);
        this.scene.add(this.title, this.key, this.key.target, this.fill);
        this.shots = finish.shots || SHOTS;
        this.hold = finish.hold || { env: 1, key: 1 };
        this.baseEnv = finish.env; this.baseKey = finish.key;
        this.camera = new THREE.PerspectiveCamera(24, 1, 0.01, 60);
        this.box = geo.boundingBox;
        this.face = this.box.max.z;
        this._p = new THREE.Vector3(); this._l = new THREE.Vector3();

        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(host);
    }

    resize() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        if (!w || !h || this.disposed) return;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.t0 !== undefined) this.draw(performance.now());
    }

    // Shaders compiled before the first frame, so the title starts without a stall
    async prepare() {
        this.pose(0);
        if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
        this.renderer.render(this.scene, this.camera);
    }

    // The distance at which a w x h patch fills the view (the tighter of width and height), at the camera's fov
    fit(w, h) {
        const tan = Math.tan(rad(this.camera.fov) / 2), aspect = this.camera.aspect || 1;
        return Math.max(h / (2 * tan), w / (2 * tan * aspect));
    }

    // A close-up: the camera fixed for the whole shot; only the light changes
    closeUp(s, k) {
        const cam = this.camera, p = this._p, l = this._l;
        const f = (cam.aspect || 1) < 1 ? s.tall : s.wide;
        l.set(f.at[0], f.at[1], this.face);
        const d = this.fit(f.w, f.h);
        const yaw = rad(s.yaw), pitch = rad(s.pitch);
        p.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(d).add(l);
        cam.position.copy(p);
        cam.lookAt(l);
        this.light(s.key[0], s.key[1], k, l);
        this.scene.environmentRotation.set(0, s.env[0] + (s.env[1] - s.env[0]) * k, 0);
    }

    // The key light, turned from one direction to another over the shot (k 0..1), aimed at the point in view
    light(from, to, k, at) {
        const az = rad(from[0] + (to[0] - from[0]) * k), el = rad(from[1] + (to[1] - from[1]) * k);
        this.key.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(4).add(at);
        this.key.target.position.copy(at);
    }

    // Where the whole title fits the width of the view, with a margin
    finalDistance() {
        const b = this.box, aspect = this.camera.aspect || 1;
        const half = (b.max.x - b.min.x) / 2;
        const frac = aspect >= 1 ? 0.62 : 0.84;
        return half / (frac * Math.tan(rad(this.camera.fov) / 2) * Math.min(aspect, 2.2));
    }

    // The camera, the light and the exposure at time t (seconds)
    pose(t) {
        const T = TIMING, cam = this.camera;
        cam.fov = 24;
        cam.updateProjectionMatrix();
        let exposure = 1;
        // the close-ups are lit as authored; the whole title is lifted (finish.hold) so its letters read at a glance
        const whole = t >= T.c ? 1 : 0;
        this.scene.environmentIntensity = this.baseEnv * (whole ? this.hold.env : 1);
        this.key.intensity = this.baseKey * (whole ? this.hold.key : 1);
        if (t < T.b) {
            this.closeUp(this.shots.A, sine(t / T.b));
            exposure = ease(t / 0.5);
        } else if (t < T.c) {
            this.closeUp(this.shots.B, sine((t - T.b) / (T.c - T.b)));
        } else {
            // The whole title, straight on: it begins a touch closer and settles back, then holds
            const midX = (this.box.min.x + this.box.max.x) / 2;
            const D = this.finalDistance();
            const u = ease((t - T.c) / (T.settle - T.c));
            this._l.set(midX, 0, this.face);
            cam.position.set(midX, 0.012 * D * (1 - u), D * (0.93 + 0.07 * u));
            cam.lookAt(this._l);
            this.light([-30, 34], [-24, 32], clamp01((t - T.c) / (T.end - T.c)), this._l);
            this.scene.environmentRotation.set(0, 0.04 - 0.05 * clamp01((t - T.c) / (T.end - T.c)), 0);
            exposure = 1 - ease((t - T.handoff) / (T.end - T.handoff));
        }
        // the dips to black between the shots
        for (const cut of [T.b, T.c]) {
            const d = Math.abs(t - cut);
            if (d < DIP) exposure *= ease(d / DIP);
        }
        this.renderer.toneMappingExposure = exposure;
    }

    draw(now) {
        if (this.disposed) return;
        const t = (now - this.t0) / 1000;
        this.pose(Math.min(t, TIMING.end));
        this.renderer.render(this.scene, this.camera);
        if (!this.handedOver && t >= TIMING.handoff) {
            this.handedOver = true;
            if (this.onHandoff) this.onHandoff();
        }
        if (t >= TIMING.end) {
            this.renderer.setAnimationLoop(null);
            if (this.onEnd) this.onEnd();
        }
    }

    // Starts now; onHandoff when the WSA opening should begin, onEnd when the title is gone
    start(onHandoff, onEnd) {
        this.onHandoff = onHandoff;
        this.onEnd = onEnd;
        this.t0 = performance.now();
        this.renderer.setAnimationLoop(now => this.draw(now));
    }

    get elapsed() {
        return this.t0 === undefined ? 0 : (performance.now() - this.t0) / 1000;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.renderer.setAnimationLoop(null);
        if (this.observer) this.observer.disconnect();
        this.geo.dispose();
        this.material.dispose();
        this.env.dispose();
        this.renderer.dispose();
        try { this.renderer.forceContextLoss(); } catch (e) { /* already gone */ }
        this.canvas.remove();
    }
}
