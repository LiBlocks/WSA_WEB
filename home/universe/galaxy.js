// A spiral galaxy far beyond the system (two arms of points, a warm bulge, pink star-forming knots), turning
// very slowly; and, hidden behind the opening view, a small black hole: a dark disc with a thin bright ring
// and a tilted accretion glow.
import * as THREE from 'three';
import { LENS } from './glsl.js';
import { stream } from './rng.js';

const DIST = 1250;

const GAL_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aBright;
uniform float uPixelRatio;
uniform float uTheme;
uniform float uBoost;
varying vec3 vColor;
varying float vBright;
${LENS}
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = lensed(projectionMatrix * mv);
    vColor = aColor;
    vBright = aBright * (1.0 + uBoost);
    gl_PointSize = (1.2 + aBright * 2.2) * uPixelRatio * mix(1.6, 1.3, uTheme);
}
`;
const GAL_FRAG = /* glsl */ `
uniform float uTheme;
uniform float uFade;
varying vec3 vColor;
varying float vBright;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float i = exp(-r2 * 4.0) * vBright * uFade;
    gl_FragColor = vec4(mix(vColor * i * 0.55, vec3(0.16, 0.2, 0.3), uTheme), mix(1.0, i * 0.22, uTheme));
}
`;
const SPRITE_VERT = /* glsl */ `
varying vec2 vUv;
uniform float uScale;
void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mv;
}
`;
const CORE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTheme;
uniform float uFade;
void main() {
    float r = length(vUv);
    float i = (exp(-r * 7.0) + 0.25 * exp(-r * 2.5)) * smoothstep(1.0, 0.6, r) * uFade;
    gl_FragColor = vec4(mix(vec3(1.0, 0.88, 0.7) * i * 0.7, vec3(0.3, 0.28, 0.25), uTheme), mix(1.0, i * 0.3, uTheme));
}
`;
const HOLE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTheme;
uniform float uTime;
uniform float uFade;
void main() {
    float r = length(vUv);
    float ring = exp(-pow((r - 0.36) / 0.022, 2.0));
    // the accretion disc: a flattened, tilted ellipse, brighter on the side turning toward us
    vec2 e = vec2(vUv.x, vUv.y * 3.6 - 0.05);
    float disc = exp(-pow((length(e) - 0.62) / 0.2, 2.0)) * (0.55 + 0.45 * vUv.x / max(r, 0.01));
    float shadow = smoothstep(0.33, 0.3, r);
    float swirl = 0.8 + 0.2 * sin(atan(vUv.y, vUv.x) * 5.0 - uTime * 0.6);
    vec3 glow = vec3(1.0, 0.78, 0.5) * (ring * 1.4 + disc * swirl * (1.0 - shadow));
    float a = clamp(ring + disc + shadow, 0.0, 1.0) * smoothstep(1.0, 0.85, r);
    vec3 dark = glow * uFade;
    vec3 light = mix(vec3(0.08, 0.1, 0.15), vec3(0.55, 0.42, 0.3), clamp(ring + disc, 0.0, 1.0));
    // In the dark theme the hole itself must cover the stars behind it: output black with full alpha there
    gl_FragColor = uTheme < 0.5 ? vec4(dark, max(shadow, clamp(ring + disc, 0.0, 1.0)) * smoothstep(1.0, 0.85, r) * uFade) : vec4(light, a * uFade);
}
`;

export function createGalaxy(ctx, layout) {
    const group = new THREE.Group();
    const owned = [];
    const R = stream('spiral-galaxy');
    const n = { low: 5000, high: 14000, ultra: 26000 }[ctx.quality] * (ctx.effects === 'reduced' ? 0.55 : 1) | 0;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), bright = new Float32Array(n);
    const SIZE = 150;
    for (let i = 0; i < n; i++) {
        const k = R();
        let x, y, z, c, b;
        if (k < 0.22) {                                   // bulge
            const r = Math.abs(R.normal()) * SIZE * 0.13;
            const a = R() * Math.PI * 2;
            x = Math.cos(a) * r; z = Math.sin(a) * r; y = R.normal() * SIZE * 0.05;
            c = [1.0, 0.86, 0.66]; b = 0.35 + 0.5 * R();
        } else {                                          // arms: logarithmic spirals with scatter
            const arm = R() < 0.5 ? 0 : Math.PI;
            const r = SIZE * (0.08 + 0.92 * Math.pow(R(), 0.8));
            const th = arm + Math.log(r / (SIZE * 0.08)) * 2.2 + R.normal() * (0.22 + 0.25 * r / SIZE);
            x = Math.cos(th) * r; z = Math.sin(th) * r; y = R.normal() * SIZE * 0.012;
            const knot = R() < 0.05;
            c = knot ? [1.0, 0.55, 0.75] : (R() < 0.6 ? [0.72, 0.8, 1.0] : [0.95, 0.92, 0.88]);
            b = (knot ? 0.6 : 0.18) + 0.5 * Math.pow(R(), 3) * (1.1 - r / SIZE);
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        col.set(c, i * 3);
        bright[i] = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    const mat = new THREE.ShaderMaterial({
        vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uPixelRatio: { value: ctx.pixelRatio }, uTheme: { value: 0 }, uBoost: { value: 0 }, uFade: { value: 1 },
            uPointer: ctx.uniforms.uPointer, uLens: ctx.uniforms.uLens, uAspect: ctx.uniforms.uAspect },
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    const disc = new THREE.Group();
    disc.add(points);
    // core glow
    const coreMat = new THREE.ShaderMaterial({
        vertexShader: SPRITE_VERT, fragmentShader: CORE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: SIZE * 0.42 }, uTheme: { value: 0 }, uFade: { value: 1 } },
    });
    const core = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), coreMat);
    core.frustumCulled = false;
    disc.add(core);
    // tilted toward us, at a slant
    const holder = new THREE.Group();
    holder.position.copy(layout.spiral).multiplyScalar(DIST);
    holder.lookAt(0, 0, 0);
    disc.rotation.x = 1.08;
    disc.rotation.y = 0.4;
    holder.add(disc);
    group.add(holder);
    owned.push(geo, mat, core.geometry, coreMat);

    // The black hole
    const holeMat = new THREE.ShaderMaterial({
        vertexShader: SPRITE_VERT, fragmentShader: HOLE_FRAG, transparent: true, depthWrite: false,
        uniforms: { uScale: { value: 26 }, uTheme: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 } },
    });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), holeMat);
    hole.position.copy(layout.blackhole).multiplyScalar(DIST * 0.9);
    hole.frustumCulled = false;
    hole.renderOrder = 5;
    group.add(hole);
    owned.push(hole.geometry, holeMat);

    // Pick proxies (the galaxy and the hole are flat sprites)
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const proxyGeo = new THREE.SphereGeometry(1, 8, 6);
    const galaxyProxy = new THREE.Mesh(proxyGeo, proxyMat);
    galaxyProxy.position.copy(holder.position);
    galaxyProxy.scale.setScalar(SIZE * 0.6);
    galaxyProxy.userData.bodyId = 'galaxy';
    const holeProxy = new THREE.Mesh(proxyGeo, proxyMat);
    holeProxy.position.copy(hole.position);
    holeProxy.scale.setScalar(22);
    holeProxy.userData.bodyId = 'blackhole';
    group.add(galaxyProxy, holeProxy);
    owned.push(proxyGeo, proxyMat);

    return {
        object: group,
        pickables: [galaxyProxy, holeProxy],
        positions: { galaxy: holder.position, blackhole: hole.position },
        update(c) {
            disc.rotation.z = c.clock * 0.0015;
            const blending = c.themeMix > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
            for (const m of [mat, coreMat]) {
                if (m.blending !== blending) { m.blending = blending; m.needsUpdate = true; }
                m.uniforms.uTheme.value = c.themeMix;
                m.uniforms.uFade.value = c.fade;
            }
            mat.uniforms.uPixelRatio.value = c.pixelRatio;
            mat.uniforms.uBoost.value = c.mood.about * 0.6 + c.mood.gallery * 0.3;
            holeMat.uniforms.uTheme.value = c.themeMix;
            holeMat.uniforms.uTime.value = c.clock;
            holeMat.uniforms.uFade.value = c.fade;
        },
        dispose() { owned.forEach(o => o.dispose()); },
    };
}
