// NovaUI 2.0: the title that opens the homepage intro (intro.js plays it before the WSA opening).
//
// The words are a real 3D object: Inter Display SemiBold (OFL 1.1) extruded into a slab with a rounded bevel
// (media/intro/novaui-title.bin, built in Blender: ~/Documents/wsa-intro-production/nova/build_title.py),
// polished metal lit by a small studio (a softbox above, a cool and a warm strip at the sides, a low band of
// WSA blue behind) whose reflections drift across it, and a light that passes close over the letters.
//
//   0.0-2.2 s   extreme close-up: the camera skims the face of the N, the o and the v, a light travelling ahead
//   2.2-3.5 s   (a breath of darkness) the curve of the 2 from above, its bevel catching the light
//   3.5-5.1 s   the camera draws back, turning to face the title, until all of it is in frame
//   5.1-5.95 s  the title, held; one last light sweeps across it
//   5.95-6.45 s it goes dark as the WSA opening begins (intro.js starts it at the hand-over)
//
// Framing adapts to the screen: the closing shot fits the whole title to the width of any window. The
// renderer, its textures and its geometry are released as soon as the title is over (or skipped).
import * as THREE from 'three';

export const TIMING = { cut: 2.2, pull: 3.5, full: 5.1, handoff: 5.95, end: 6.45 };

const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));     // smootherstep
const sine = t => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
const clamp01 = t => Math.max(0, Math.min(1, t));
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);          // working (linear) values, whatever the page set
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

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

// The studio the metal reflects: rendered once into an environment map
function studio() {
    const s = new THREE.Scene();
    const owned = [];
    const panel = (w, h, rgb, pos) => {
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({ color: lin(...rgb), side: THREE.DoubleSide });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        s.add(m);
        owned.push(geo, mat);
    };
    panel(7, 2.4, [2.3, 2.35, 2.45], [0, 4.6, 3.4]);         // softbox, above and in front
    panel(0.4, 8, [5.2, 5.6, 6.4], [-5.2, 0.4, 2.4]);        // a cool strip on the left
    panel(0.32, 8, [4.6, 4.1, 3.5], [5.6, 0, 1.4]);          // a warm strip on the right
    panel(18, 0.7, [0.07, 0.15, 0.42], [0, -1.7, -4.5]);     // a low band of WSA blue behind
    panel(5, 3, [0.45, 0.47, 0.52], [0, 1.4, -6.5]);         // a faint fill from behind, for the upright faces
    panel(16, 7, [0.16, 0.17, 0.2], [0, 1.6, 8]);            // a dim wall in front: the faces are never quite black
    panel(0.7, 9, [4.2, 4.3, 4.5], [0, 0.6, 7.6]);           // a tall strip in front: the band that sweeps the faces
    return { scene: s, dispose: () => owned.forEach(o => o.dispose()) };
}

export async function createNova(host, { url, signal } = {}) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('title mesh: HTTP ' + res.status);
    const geo = decode(await res.arrayBuffer());
    const nova = new Nova(host, geo);
    try {
        await nova.prepare();
    } catch (e) {
        nova.dispose();
        throw e;
    }
    return nova;
}

class Nova {
    constructor(host, geo) {
        this.host = host;
        this.geo = geo;
        const canvas = document.createElement('canvas');
        canvas.className = 'wsa-intro-nova-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.canvas = canvas;
        this.renderer = renderer;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0;
        renderer.setClearColor(0x000000, 1);
        host.appendChild(canvas);

        this.scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const st = studio();
        this.env = pmrem.fromScene(st.scene, 0.03);
        st.dispose();
        pmrem.dispose();
        this.scene.environment = this.env.texture;

        this.material = new THREE.MeshPhysicalMaterial({
            color: lin(0.86, 0.88, 0.92), metalness: 1, roughness: 0.17,
            clearcoat: 0.35, clearcoatRoughness: 0.05, envMapIntensity: 1.05,
        });
        this.title = new THREE.Mesh(geo, this.material);
        this.light = new THREE.PointLight(lin(1, 0.98, 0.95), 0, 5, 2);
        this.scene.add(this.title, this.light);
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 60);
        this.box = geo.boundingBox;
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

    // Where the whole title fits the width of the view (with a margin), at the closing shot's lens
    finalDistance(fov) {
        const b = this.box, aspect = this.camera.aspect || 1;
        const half = (b.max.x - b.min.x) / 2;
        const frac = aspect >= 1 ? 0.7 : 0.86;
        return half / (frac * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * Math.min(aspect, 2.2));
    }

    // The camera, the light and the exposure at time t (seconds)
    pose(t) {
        const T = TIMING, cam = this.camera, p = this._p, l = this._l;
        const midX = (this.box.min.x + this.box.max.x) / 2;
        // Portrait screens: a wider lens, so the close-ups still show a letter's shape and not just a sliver
        const wide = cam.aspect < 1 ? 1 + (1 - cam.aspect) * 2 : 1;
        let fov = 30 * wide, light = 0, exposure = 1;
        if (t < T.cut) {
            // A: skimming the face of N, o, v
            const k = sine(t / T.cut);
            p.copy(V([-1.66, 0.11, 0.4])).lerp(V([-0.74, 0.03, 0.37]), k);
            l.copy(V([-1.42, 0.03, 0.0])).lerp(V([-0.5, -0.05, 0.0]), k);
            this.light.position.set(-2.3 + 2.2 * ease(t / T.cut), 0.5, 0.55);
            light = 2.6;
            exposure = ease(t / 0.55);
        } else if (t < T.pull) {
            // B: the 2, from above
            const k = sine((t - T.cut) / (T.pull - T.cut));
            p.copy(V([1.42, 0.36, 0.42])).lerp(V([1.1, 0.4, 0.47]), k);
            l.copy(V([0.95, 0.06, 0.08])).lerp(V([0.9, 0.03, 0.08]), k);
            this.light.position.set(1.7 - 1.1 * k, 0.62, 0.6);
            light = 2.4;
        } else {
            // C: drawing back to the whole title, then holding on it
            const D = this.finalDistance(26 * wide);
            const u = ease((t - T.pull) / (T.full - T.pull));
            const p0 = V([1.1, 0.4, 0.47]), p3 = V([midX, 0.0, D]);
            const p1 = p0.clone().add(V([0.25, 0.18, 0.9]));
            const p2 = V([midX + 0.55, 0.16, D * 0.84]);
            const a = 1 - u;
            p.set(0, 0, 0).addScaledVector(p0, a * a * a).addScaledVector(p1, 3 * a * a * u).addScaledVector(p2, 3 * a * u * u).addScaledVector(p3, u * u * u);
            l.copy(V([0.9, 0.03, 0.08])).lerp(V([midX, 0, 0]), ease(Math.min(1, (t - T.pull) / (T.full - T.pull) * 1.15)));
            fov = (30 - 4 * u) * wide;
            // the hold: a slow push in
            const hold = clamp01((t - T.full) / (T.end - T.full));
            p.z -= D * 0.02 * sine(hold);
            // the last sweep of light, left to right across the whole title
            const sw = clamp01((t - (T.full - 0.15)) / 1.05);
            this.light.position.set(-2.7 + 5.4 * sine(sw), 0.22, 1.05);
            light = 3.4 * Math.sin(Math.PI * sw) + 0.4 * (1 - u);
            exposure = 1 - ease((t - T.handoff) / (T.end - T.handoff));
        }
        // a breath of darkness at the cut between the two close-ups
        const dip = Math.abs(t - T.cut);
        if (dip < 0.16) exposure *= ease(dip / 0.16);
        cam.position.copy(p);
        cam.lookAt(l);
        cam.fov = fov;
        cam.updateProjectionMatrix();
        this.light.intensity = light;
        // The studio's reflections drift across the metal all the way through; over the closing shot the strip in
        // front sweeps across the faces from left to right (the environment turns about the vertical)
        const sweep = sine(clamp01((t - (T.full - 0.3)) / 1.15));
        const drift = 0.75 - 0.9 * (Math.min(t, T.full) / T.full);
        this.scene.environmentRotation.set(0.06, t < T.full - 0.3 ? drift : drift + (-0.42 + 0.84 * sweep) - (-0.42), 0);
        this.renderer.toneMappingExposure = exposure * 1.05;
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
