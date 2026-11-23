// Liquid Glass for the homepage's panels, done by the universe itself. The scene is drawn into a texture and
// copied to the screen; inside each panel's rounded rectangle the copy looks through a slab of glass:
//   - along the rim the view bends inward (what is seen at the edge lies a little further in), strongest at the
//     very edge and rolling off over the bezel, as through the curved edge of a thick pane;
//   - the bend splits colour slightly (chromatic aberration): red bends a little less, blue a little more, so a
//     star under the rim shows a hairline red and cyan fringe, and the flat middle has none;
//   - the middle magnifies what lies behind by a few percent, so the whole panel reads as a lens, not a hole.
// The panel's own blur and tint stay in CSS (home/home.css), which keeps the text crisp and the blur in step
// with the page as it scrolls. Panels are given in page coordinates; each frame places them from the current
// scroll position. While the page is flung fast the bend eases off, so a frame of scroll lag never shows as a
// misplaced rim. Only drawn this way while a panel is on screen: otherwise the scene goes straight out.
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
uniform float uStrength;
uniform float uBezel;
uniform float uDispersion;
varying vec2 vUv;

float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
    vec2 px = vUv * uRes;
    vec2 off = vec2(0.0);
    float rim = 0.0;
    bool inside = false;
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
            float t = clamp(-d / bezel, 0.0, 1.0);
            rim = pow(1.0 - t, 2.4);
            off = -g * rim * bezel * 0.5 - p * 0.03 * (1.0 - rim);
            inside = true;
            break;
        }
    }
    if (!inside || uStrength <= 0.0) {
        gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.0);
        return;
    }
    vec2 o = off * uStrength / uRes;
    float k = uDispersion * rim;
    vec3 col;
    col.r = texture2D(tScene, vUv + o * (1.0 - k)).r;
    col.g = texture2D(tScene, vUv + o).g;
    col.b = texture2D(tScene, vUv + o * (1.0 + k)).b;
    gl_FragColor = vec4(col, 1.0);
}
`;

export class Glass {
    constructor(renderer, { samples = 4 } = {}) {
        this.renderer = renderer;
        this.panes = [];             // { x, y, w, h, r } in CSS px, page coordinates
        this.enabled = false;
        this.strength = 1;
        this.speed = 0;
        this.lastScroll = null;
        this.target = new THREE.WebGLRenderTarget(1, 1, { samples, depthBuffer: true });
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
            uniforms: {
                tScene: { value: this.target.texture }, uRes: { value: new THREE.Vector2(1, 1) },
                uRects: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
                uRadius: { value: new Array(MAX).fill(0) }, uCount: { value: 0 }, uStrength: { value: 1 },
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
    }

    setPanes(panes) {
        this.panes = panes || [];
    }

    // Which panels are on screen now, in drawing-buffer pixels (origin bottom left). False when none is.
    place(scrollY, dt) {
        if (!this.enabled || !this.panes.length || !this.w) return false;
        // Fast flings ease the bend off (to a third), and it returns as the page slows down
        if (this.lastScroll !== null && dt > 0) {
            const v = Math.abs(scrollY - this.lastScroll) / dt;
            this.speed += (v - this.speed) * Math.min(1, dt * 12);
        }
        this.lastScroll = scrollY;
        const calm = 1 - 0.65 * Math.min(1, Math.max(0, (this.speed - 900) / 1800));
        this.strength += (calm - this.strength) * Math.min(1, dt * 10);
        const u = this.material.uniforms, pr = this.pr;
        let n = 0;
        for (const p of this.panes) {
            const top = p.y - scrollY;
            if (top > this.h || top + p.h < 0 || n >= MAX) continue;
            u.uRects.value[n].set(p.x * pr, (this.h - top - p.h) * pr, (p.x + p.w) * pr, (this.h - top) * pr);
            u.uRadius.value[n] = p.r * pr;
            n++;
        }
        u.uCount.value = n;
        u.uStrength.value = this.strength;
        return n > 0;
    }

    render(scene, camera) {
        const r = this.renderer;
        r.setRenderTarget(this.target);
        r.render(scene, camera);
        r.setRenderTarget(null);
        r.render(this.scene, this.camera);
    }

    dispose() {
        this.target.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
