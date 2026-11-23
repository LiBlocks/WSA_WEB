// Liquid Glass for the homepage's panels: the rim of each panel bends the universe behind it and splits it
// slightly into colour, like the curved edge of a thick pane.
//   - along the rim the view bends inward (what is seen at the edge lies a little further in), strongest at the
//     very edge and rolling off over the bezel;
//   - the bend splits colour (chromatic aberration): red bends a little less, blue a little more, so a star or a
//     planet's edge under the rim shows a red and cyan fringe; the flat middle has none.
//
// Where it is drawn matters. The universe is a fixed canvas drawn by the page's own thread, but browsers scroll
// the page on another thread, a frame or more ahead of it; a rim drawn into the fixed canvas would trail behind
// its panel whenever the page moves. So the rim is drawn into the panel itself: each frame the scene is rendered
// once with the rims, each panel's rim is copied into a small canvas that lives inside that panel (and so moves
// with it exactly, however the page scrolls), and the scene is rendered again without them for the page behind.
// The copy is a ring that fades out toward the middle, where the panel's own blur and tint (home/home.css) take
// over. Nothing here eases or animates: when the page stops, the glass is simply where the panel is.
import * as THREE from 'three';

const MAX = 12;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform vec4 uRects[${MAX}];
uniform float uRadius[${MAX}];
uniform int uCount;
uniform float uBezel;
uniform float uDispersion;
varying vec2 vUv;

float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
    vec2 px = vUv * uRes;
    for (int i = 0; i < ${MAX}; i++) {
        if (i >= uCount) break;
        vec4 r = uRects[i];
        vec2 c = 0.5 * (r.xy + r.zw);
        vec2 b = 0.5 * (r.zw - r.xy);
        vec2 p = px - c;
        float rad = uRadius[i];
        float d = sdBox(p, b, rad);
        if (d < 0.0) {
            // The outward normal of the rounded rectangle at this point
            vec2 g = vec2(sdBox(p + vec2(1.0, 0.0), b, rad) - sdBox(p - vec2(1.0, 0.0), b, rad),
                          sdBox(p + vec2(0.0, 1.0), b, rad) - sdBox(p - vec2(0.0, 1.0), b, rad));
            g /= max(length(g), 1e-4);
            float bezel = min(uBezel, 0.45 * min(b.x, b.y));
            float rim = pow(1.0 - clamp(-d / bezel, 0.0, 1.0), 2.4);
            vec2 o = -g * rim * bezel * 0.5 / uRes;
            float k = uDispersion * rim;
            gl_FragColor = vec4(texture2D(tScene, vUv + o * (1.0 - k)).r,
                                texture2D(tScene, vUv + o).g,
                                texture2D(tScene, vUv + o * (1.0 + k)).b, 1.0);
            return;
        }
    }
    gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.0);
}
`;

// The ring each copy is cut to: opaque at the panel's edge, fading to nothing a bezel in
function ringMask(w, h, r, bezel) {
    const m = document.createElement('canvas');
    m.width = w; m.height = h;
    const c = m.getContext('2d');
    const round = (x, y, rw, rh, rr) => {
        rr = Math.max(0, Math.min(rr, rw / 2, rh / 2));
        c.beginPath();
        c.moveTo(x + rr, y);
        c.arcTo(x + rw, y, x + rw, y + rh, rr);
        c.arcTo(x + rw, y + rh, x, y + rh, rr);
        c.arcTo(x, y + rh, x, y, rr);
        c.arcTo(x, y, x + rw, y, rr);
        c.closePath();
    };
    c.fillStyle = '#fff';
    round(0, 0, w, h, r);
    c.fill();
    // a feathered hole: the inner shape drawn far off the canvas, its blurred shadow landing in place
    const inset = bezel * 0.45, far = w * 3;
    c.globalCompositeOperation = 'destination-out';
    c.shadowColor = '#000';
    c.shadowBlur = bezel * 0.7;
    c.shadowOffsetX = far;
    round(inset - far, inset, w - 2 * inset, h - 2 * inset, r - inset);
    c.fill();
    return m;
}

export class Glass {
    constructor(renderer, { samples = 4 } = {}) {
        this.renderer = renderer;
        this.panes = [];             // { x, y, w, h, r, canvas } in CSS px, page coordinates
        this.enabled = false;
        this.visible = [];
        this.drawn = new Set();      // the panes' canvases holding a copy now
        this.masks = new Map();
        this.target = new THREE.WebGLRenderTarget(1, 1, { samples, depthBuffer: true });
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
            uniforms: {
                tScene: { value: this.target.texture }, uRes: { value: new THREE.Vector2(1, 1) },
                uRects: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
                uRadius: { value: new Array(MAX).fill(0) }, uCount: { value: 0 },
                uBezel: { value: 36 }, uDispersion: { value: 0.22 },
            },
        });
        // One triangle covering the screen
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        this.quad = new THREE.Mesh(this.geometry, this.material);
        this.quad.frustumCulled = false;
        this.scene = new THREE.Scene();
        this.scene.add(this.quad);
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    setSize(w, h, pr) {
        this.w = w; this.h = h; this.pr = pr;
        this.target.setSize(Math.round(w * pr), Math.round(h * pr));
        this.material.uniforms.uRes.value.set(Math.round(w * pr), Math.round(h * pr));
        this.material.uniforms.uBezel.value = 36 * pr;
        this.masks.clear();
        this.panes.forEach(p => this.fit(p));
    }

    setPanes(panes) {
        this.clear();
        this.panes = panes || [];
        this.panes.forEach(p => this.fit(p));
    }

    // Each panel's canvas holds its rim at the scene's resolution
    fit(p) {
        if (!p.canvas || !this.pr) return;
        const w = Math.max(1, Math.round(p.w * this.pr)), h = Math.max(1, Math.round(p.h * this.pr));
        if (p.canvas.width !== w || p.canvas.height !== h) { p.canvas.width = w; p.canvas.height = h; }
        p.ctx = p.ctx || p.canvas.getContext('2d');
    }

    mask(w, h, r) {
        const key = `${w}x${h}r${r}`;
        if (!this.masks.has(key)) this.masks.set(key, ringMask(w, h, r, 36 * this.pr));
        return this.masks.get(key);
    }

    // Which panels are on screen now (in drawing-buffer pixels, origin bottom left). False when none is.
    place(scrollY) {
        this.visible = [];
        if (!this.enabled || !this.panes.length || !this.w) return false;
        const u = this.material.uniforms, pr = this.pr;
        let n = 0;
        for (const p of this.panes) {
            const top = p.y - scrollY;
            if (top > this.h || top + p.h < 0 || n >= MAX || !p.ctx) continue;
            u.uRects.value[n].set(p.x * pr, (this.h - top - p.h) * pr, (p.x + p.w) * pr, (this.h - top) * pr);
            u.uRadius.value[n] = p.r * pr;
            this.visible.push({ p, top });
            n++;
        }
        this.count = n;
        return n > 0;
    }

    render(scene, camera) {
        const r = this.renderer, u = this.material.uniforms, pr = this.pr, src = r.domElement;
        r.setRenderTarget(this.target);
        r.render(scene, camera);
        r.setRenderTarget(null);
        // 1. the scene with the rims
        u.uCount.value = this.count;
        r.render(this.scene, this.camera);
        // 2. each panel's rim into its own canvas
        const now = new Set();
        for (const { p, top } of this.visible) {
            const c = p.ctx, cw = p.canvas.width, ch = p.canvas.height;
            c.globalCompositeOperation = 'copy';
            c.drawImage(src, p.x * pr, top * pr, p.w * pr, p.h * pr, 0, 0, cw, ch);
            c.globalCompositeOperation = 'destination-in';
            c.drawImage(this.mask(cw, ch, Math.round(p.r * pr)), 0, 0);
            c.globalCompositeOperation = 'source-over';
            now.add(p);
        }
        // panels that have left the view keep nothing stale for their return
        this.drawn.forEach(p => { if (!now.has(p)) p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height); });
        this.drawn = now;
        // 3. the plain scene, for the page behind the panels
        u.uCount.value = 0;
        r.render(this.scene, this.camera);
    }

    // No rims drawn this frame (none on screen, Explore mode, glass off): the panels' copies are emptied
    clear() {
        this.drawn.forEach(p => p.ctx && p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height));
        this.drawn = new Set();
    }

    dispose() {
        this.clear();
        this.target.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
