// Stars at three depths, plus the brightest few drawn larger with diffraction spikes, two clusters, a hidden
// constellation and a little drifting dust near the camera.
//   far      on the sky sphere; crowded along the galaxy's band and round its bulge
//   mid      scattered through a shell round the system, close enough to shift as the camera travels
//   bright   a few dozen with spikes and halos
//   dust     faint motes in a box that follows the camera: the nearest depth, and the most parallax
// Every layer is seeded, so the sky is the same on every visit. The pointer lenses them (glsl.js LENS).
import * as THREE from 'three';
import { LENS } from './glsl.js';
import { stream } from './rng.js';

// The ascent trail of the WSA insignia, resampled to 13 stars (media/intro/logo/logo-parts.json)
export const CLIMB = [[-0.502, -0.533], [-0.646, -0.517], [-0.755, -0.427], [-0.752, -0.285], [-0.685, -0.156], [-0.598, -0.04], [-0.487, 0.054],
    [-0.373, 0.144], [-0.254, 0.228], [-0.135, 0.313], [-0.019, 0.401], [0.092, 0.495], [0.202, 0.59]];

const SKY_R = 1800;

const STAR_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aBright;
attribute float aPhase;
uniform float uTime;
uniform float uTwinkle;
uniform float uPixelRatio;
uniform float uSize;
uniform float uBoost;
uniform float uTheme;
uniform float uAttenuate;
varying vec3 vColor;
varying float vBright;
${LENS}
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = lensed(projectionMatrix * mv);
    float tw = 1.0 + uTwinkle * 0.45 * sin(uTime * (0.8 + aPhase * 2.4) + aPhase * 43.0) * (1.0 - 0.5 * aBright);
    vBright = aBright * tw * (1.0 + uBoost * aBright * 1.5);
    vColor = aColor;
    float size = (0.85 + aBright * 2.4) * uSize * uPixelRatio * mix(2.2, 1.7, uTheme);
    if (uAttenuate > 0.0) size *= clamp(uAttenuate / -mv.z, 0.6, 1.8);
    gl_PointSize = size;
}
`;
const STAR_FRAG = /* glsl */ `
uniform float uTheme;
uniform float uFade;
varying vec3 vColor;
varying float vBright;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float core = exp(-r2 * 7.0) + 0.18 * exp(-r2 * 2.2);
    vec3 dark = vColor * core * vBright * 1.35 * uFade;
    float ink = (1.0 - smoothstep(0.25, 1.0, sqrt(r2))) * clamp(0.18 + 0.85 * vBright, 0.0, 1.0) * uFade;
    vec3 inkCol = mix(vec3(0.09, 0.12, 0.19), vColor * 0.35, 0.18);
    gl_FragColor = vec4(mix(dark, inkCol, uTheme), mix(1.0, ink, uTheme));
}
`;
const BRIGHT_FRAG = /* glsl */ `
uniform float uTheme;
uniform float uFade;
varying vec3 vColor;
varying float vBright;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    if (r > 1.0) discard;
    float core = exp(-r * r * 60.0);
    float halo = exp(-r * 6.0) * 0.35;
    float spikes = (exp(-abs(c.x) * 38.0) * exp(-abs(c.y) * 3.2) + exp(-abs(c.y) * 38.0) * exp(-abs(c.x) * 3.2)) * 0.55;
    float i = (core + halo + spikes) * vBright * (1.0 - smoothstep(0.7, 1.0, r));
    vec3 dark = mix(vColor, vec3(1.0), core * 0.6) * i * 1.4 * uFade;
    float ink = ((1.0 - smoothstep(0.08, 0.22, r)) + spikes * 0.35) * clamp(vBright, 0.0, 1.0) * uFade;
    gl_FragColor = vec4(mix(dark, vec3(0.09, 0.12, 0.2), uTheme), mix(1.0, ink, uTheme));
}
`;
const DUST_VERT = /* glsl */ `
attribute float aPhase;
uniform vec3 uCam;
uniform float uBox;
uniform float uTime;
uniform float uSwirl;
uniform float uPixelRatio;
varying float vA;
void main() {
    vec3 p = position;
    // games: the dust swirls a little
    float a = uTime * (0.05 + uSwirl * 0.5) * (0.5 + aPhase);
    p.xz += vec2(cos(a + aPhase * 6.28), sin(a + aPhase * 6.28)) * uSwirl * 0.6;
    p.y += uTime * 0.02 * (aPhase - 0.5);
    vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = length(rel) / (uBox * 0.5);
    vA = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.15, 0.6, -mv.z);
    gl_PointSize = clamp(uPixelRatio * 22.0 / -mv.z, 1.0, 5.0 * uPixelRatio);
}
`;
const DUST_FRAG = /* glsl */ `
uniform float uTheme;
uniform float uFade;
varying float vA;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float i = exp(-r2 * 3.0) * vA * 0.28 * uFade;
    gl_FragColor = vec4(mix(vec3(0.75, 0.8, 0.95) * i, vec3(0.2, 0.25, 0.35), uTheme), mix(1.0, i * 0.6, uTheme));
}
`;

// Star colour by temperature: cool orange to hot blue-white
function starColor(t, out) {
    const stops = [[0, [1.0, 0.66, 0.46]], [0.3, [1.0, 0.86, 0.7]], [0.55, [1.0, 0.97, 0.93]], [0.8, [0.86, 0.9, 1.0]], [1, [0.66, 0.76, 1.0]]];
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
            const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
            for (let c = 0; c < 3; c++) out[c] = stops[i - 1][1][c] + (stops[i][1][c] - stops[i - 1][1][c]) * k;
            return out;
        }
    }
    return stops[stops.length - 1][1];
}

function basisAround(n) {
    const a = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const t = new THREE.Vector3().crossVectors(a, n).normalize();
    const b = new THREE.Vector3().crossVectors(n, t);
    return [t, b];
}

export function createStars(ctx, layout) {
    const q = ctx.quality;
    const counts = { low: [3400, 500, 26, 120], high: [9500, 1400, 42, 260], ultra: [16000, 2400, 56, 420] }[q];
    const [nFar, nMid, nBright, nDust] = ctx.effects === 'reduced' ? counts.map(c => Math.round(c * 0.55)) : counts;
    const group = new THREE.Group();
    const owned = [];
    const R = stream('stars');
    const v = new THREE.Vector3();
    const col = [0, 0, 0];
    const [bt, bb] = basisAround(layout.bandNormal);

    function sampleSky(out) {
        const k = R();
        if (k < 0.42) {                   // along the band
            const lon = R() * Math.PI * 2, lat = R.normal() * 0.16;
            out.copy(bt).multiplyScalar(Math.cos(lon) * Math.cos(lat)).addScaledVector(bb, Math.sin(lon) * Math.cos(lat)).addScaledVector(layout.bandNormal, Math.sin(lat));
        } else if (k < 0.55) {            // round the bulge
            const [t, b] = basisAround(layout.bulge);
            out.copy(layout.bulge).addScaledVector(t, R.normal() * 0.28).addScaledVector(b, R.normal() * 0.16).normalize();
        } else {
            out.set(R.normal(), R.normal(), R.normal()).normalize();
        }
        return out;
    }

    function layer(n, fill, frag, extra = {}) {
        const pos = new Float32Array(n * 3), colA = new Float32Array(n * 3), bright = new Float32Array(n), phase = new Float32Array(n);
        for (let i = 0; i < n; i++) fill(i, pos, colA, bright, phase);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
        geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        const mat = new THREE.ShaderMaterial({
            vertexShader: STAR_VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 }, uTwinkle: { value: 1 }, uPixelRatio: { value: ctx.pixelRatio }, uSize: { value: extra.size || 1 },
                uBoost: { value: 0 }, uTheme: { value: 0 }, uFade: { value: 1 }, uAttenuate: { value: extra.attenuate || 0 },
                uPointer: ctx.uniforms.uPointer, uLens: ctx.uniforms.uLens, uAspect: ctx.uniforms.uAspect,
            },
        });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        pts.renderOrder = extra.order || 0;
        group.add(pts);
        owned.push(geo, mat);
        return { points: pts, mat, pos };
    }

    const put = (pos, i, d, r) => { pos[i * 3] = d.x * r; pos[i * 3 + 1] = d.y * r; pos[i * 3 + 2] = d.z * r; };
    const paint = (colA, i, t) => { starColor(t, col); colA[i * 3] = col[0]; colA[i * 3 + 1] = col[1]; colA[i * 3 + 2] = col[2]; };

    // Far: the band, the bulge, a globular cluster, an open cluster round the teal nebula
    const nGlob = Math.round(nFar * 0.06), nOpen = 34;
    const far = layer(nFar + nGlob + nOpen, (i, pos, colA, bright, phase) => {
        if (i < nFar) {
            sampleSky(v);
            bright[i] = 0.08 + 0.92 * Math.pow(R(), 6.5);
            paint(colA, i, Math.min(1, Math.max(0, R.normal() * 0.22 + 0.55)));
        } else if (i < nFar + nGlob) {
            const [t, b] = basisAround(layout.globular);
            const s = 0.012 * Math.abs(R.normal());
            const a = R() * Math.PI * 2;
            v.copy(layout.globular).addScaledVector(t, Math.cos(a) * s).addScaledVector(b, Math.sin(a) * s).normalize();
            bright[i] = 0.12 + 0.45 * Math.pow(R(), 3);
            paint(colA, i, 0.22 + R() * 0.2);
        } else {
            const [t, b] = basisAround(layout.openCluster);
            v.copy(layout.openCluster).addScaledVector(t, R.normal() * 0.022).addScaledVector(b, R.normal() * 0.022).normalize();
            bright[i] = 0.35 + 0.6 * R();
            paint(colA, i, 0.85 + 0.15 * R());
        }
        put(pos, i, v, SKY_R);
        phase[i] = R();
    }, STAR_FRAG);

    // Mid: a shell round the system, so near stars slide against far ones as the camera moves
    const mid = layer(nMid, (i, pos, colA, bright, phase) => {
        sampleSky(v);
        put(pos, i, v, R.range(260, 700));
        bright[i] = 0.18 + 0.7 * Math.pow(R(), 3);
        paint(colA, i, R());
        phase[i] = R();
    }, STAR_FRAG, { attenuate: 420, order: 1 });

    // Bright: the few that catch the eye, and the constellation hidden among them
    const climbStars = CLIMB.length;
    const [ct, cb] = basisAround(layout.constellation);
    const constellation = [];
    const brightStars = [];
    const bright = layer(nBright + climbStars, (i, pos, colA, brightA, phase) => {
        if (i < nBright) {
            sampleSky(v);
            brightA[i] = 0.5 + 0.5 * R();
            paint(colA, i, R());
            brightStars.push(v.clone().multiplyScalar(SKY_R * 0.98));
        } else {
            const [x, y] = CLIMB[i - nBright];
            v.copy(layout.constellation).addScaledVector(ct, x * 0.16).addScaledVector(cb, y * 0.16).normalize();
            brightA[i] = 0.55 + 0.25 * ((i * 7) % 3) / 2;
            paint(colA, i, 0.6);
            constellation.push(v.clone().multiplyScalar(SKY_R * 0.98));
        }
        put(pos, i, v, SKY_R * 0.98);
        phase[i] = R();
    }, BRIGHT_FRAG, { size: 5.2, order: 2 });

    // Dust
    const dGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(nDust * 3), dPh = new Float32Array(nDust);
    const BOX = 14;
    for (let i = 0; i < nDust; i++) {
        dPos[i * 3] = R.range(-BOX, BOX); dPos[i * 3 + 1] = R.range(-BOX, BOX); dPos[i * 3 + 2] = R.range(-BOX, BOX);
        dPh[i] = R();
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('aPhase', new THREE.BufferAttribute(dPh, 1));
    const dMat = new THREE.ShaderMaterial({
        vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: BOX }, uTime: { value: 0 }, uSwirl: { value: 0 }, uPixelRatio: { value: ctx.pixelRatio }, uTheme: { value: 0 }, uFade: { value: 1 } },
    });
    const dust = new THREE.Points(dGeo, dMat);
    dust.frustumCulled = false;
    group.add(dust);
    owned.push(dGeo, dMat);

    const mats = [far.mat, mid.mat, bright.mat];
    return {
        object: group,
        constellation,
        brightStars,
        update(c) {
            const blending = c.themeMix > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
            for (const m of [...mats, dMat]) {
                if (m.blending !== blending) { m.blending = blending; m.needsUpdate = true; }
                m.uniforms.uTheme.value = c.themeMix;
                m.uniforms.uPixelRatio.value = c.pixelRatio;
                m.uniforms.uFade.value = c.fade;
            }
            for (const m of mats) {
                m.uniforms.uTime.value = c.time;
                m.uniforms.uTwinkle.value = c.intensity * (1 + c.mood.games * 1.5);
                m.uniforms.uBoost.value = c.mood.achievements;
            }
            dMat.uniforms.uCam.value.copy(c.camera.position);
            dMat.uniforms.uTime.value = c.clock;
            dMat.uniforms.uSwirl.value = c.mood.games * c.intensity;
        },
        dispose() { owned.forEach(o => o.dispose()); },
    };
}
