// What the moods add, and the occasional shooting star:
//   shooting stars   now and then; more often in the news and games moods
//   missions         WSA's transfer routes from Kerbin (the Mun, Minmus, Duna, Jool), dashed and flowing, each
//                    with a point of light travelling along it
//   engineering      a polar grid on the plane of the planets, round the star
//   achievements     constellation lines between the brightest stars
//   the Climb        the hidden constellation's lines, shown once it is found or selected
import * as THREE from 'three';
import { stream } from './rng.js';
import { ROUTES } from './environments.js';

const STREAK_VERT = /* glsl */ `
attribute vec2 aSide;           // x: 0 start .. 1 end, y: -1..1 across
uniform vec3 uStart;
uniform vec3 uEnd;
uniform float uHead;            // how far the head has travelled (0..1)
uniform float uWidth;
uniform vec2 uViewport;
varying float vAlong;
varying float vAcross;
void main() {
    float t = aSide.x * uHead;
    vec4 a = projectionMatrix * viewMatrix * vec4(mix(uStart, uEnd, max(uHead - 0.35, 0.0)), 1.0);
    vec4 b = projectionMatrix * viewMatrix * vec4(mix(uStart, uEnd, uHead), 1.0);
    vec4 p = mix(a, b, aSide.x);
    vec2 dir = normalize((b.xy / b.w - a.xy / a.w) * uViewport + 1e-5);
    vec2 n = vec2(-dir.y, dir.x);
    p.xy += n * aSide.y * uWidth * (0.3 + 0.7 * aSide.x) / uViewport * p.w;
    gl_Position = p;
    vAlong = aSide.x;
    vAcross = aSide.y;
}
`;
const STREAK_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uTheme;
varying float vAlong;
varying float vAcross;
void main() {
    float i = pow(vAlong, 2.2) * (1.0 - abs(vAcross)) * uAlpha;
    gl_FragColor = vec4(mix(vec3(0.9, 0.95, 1.0) * i, vec3(0.15, 0.2, 0.3), uTheme), mix(1.0, i * 0.7, uTheme));
}
`;
const DASH_VERT = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const DASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFlow;
uniform float uDashes;
varying float vT;
void main() {
    float dash = step(0.45, fract(vT * uDashes - uFlow));
    float ends = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.9, 1.0, vT));
    gl_FragColor = vec4(uColor, uOpacity * dash * ends);
}
`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;
const SPOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uColor, uOpacity * exp(-r2 * 3.5));
}
`;

const SEGS = 96;

export function createEffects(ctx, system, stars) {
    const group = new THREE.Group();
    const owned = [];
    const R = stream('effects');
    const lineMat = (color, extra = {}) => {
        const m = new THREE.ShaderMaterial({
            vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: LINE_FRAG, transparent: true, depthWrite: false,
            uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } }, ...extra,
        });
        owned.push(m);
        return m;
    };

    // ---------- shooting star ----------
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    sGeo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2));
    sGeo.setIndex([0, 2, 1, 1, 2, 3]);
    const sMat = new THREE.ShaderMaterial({
        vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uStart: { value: new THREE.Vector3() }, uEnd: { value: new THREE.Vector3() }, uHead: { value: 0 }, uWidth: { value: 1.6 },
            uViewport: { value: new THREE.Vector2(1, 1) }, uAlpha: { value: 0 }, uTheme: { value: 0 } },
    });
    const streak = new THREE.Mesh(sGeo, sMat);
    streak.frustumCulled = false;
    streak.visible = false;
    streak.renderOrder = 30;
    group.add(streak);
    owned.push(sGeo, sMat);
    const shooting = { next: 4 + R() * 6, t: -1, dur: 0.9 };
    const fwd = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();

    function launchStreak(cam) {
        cam.getWorldDirection(fwd);
        side.crossVectors(fwd, cam.up).normalize();
        upv.crossVectors(side, fwd).normalize();
        // somewhere in view, away from the middle, heading down and across
        const sx = (R() < 0.5 ? -1 : 1) * R.range(0.15, 0.5), sy = R.range(0.1, 0.38);
        const start = fwd.clone().addScaledVector(side, sx).addScaledVector(upv, sy).normalize().multiplyScalar(900).add(cam.position);
        const heading = side.clone().multiplyScalar(-Math.sign(sx) * R.range(0.5, 1)).addScaledVector(upv, -R.range(0.25, 0.7)).normalize();
        const end = start.clone().addScaledVector(heading, R.range(110, 200));
        sMat.uniforms.uStart.value.copy(start);
        sMat.uniforms.uEnd.value.copy(end);
        shooting.t = 0;
        shooting.dur = R.range(0.55, 1.0);
        streak.visible = true;
    }

    // ---------- mission routes ----------
    const kerbin = system.bodies.get('kerbin');
    const routes = ROUTES.map(id => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 3), 3));
        const at = new Float32Array(SEGS + 1);
        for (let i = 0; i <= SEGS; i++) at[i] = i / SEGS;
        geo.setAttribute('aT', new THREE.BufferAttribute(at, 1));
        const mat = new THREE.ShaderMaterial({
            vertexShader: DASH_VERT, fragmentShader: DASH_FRAG, transparent: true, depthWrite: false,
            uniforms: { uColor: { value: new THREE.Color('#8fb3ff') }, uOpacity: { value: 0 }, uFlow: { value: 0 }, uDashes: { value: id === 'mun' || id === 'minmus' ? 14 : 46 } },
        });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        group.add(line);
        owned.push(geo, mat);
        return { id, line, geo, mat, target: system.bodies.get(id), seed: R() };
    });
    const spotGeo = new THREE.BufferGeometry();
    spotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROUTES.length * 3), 3));
    const spotMat = new THREE.ShaderMaterial({
        vertexShader: `uniform float uPixelRatio; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 7.0 * uPixelRatio; }`,
        fragmentShader: SPOT_FRAG, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color('#dfe8ff') }, uOpacity: { value: 0 }, uPixelRatio: { value: ctx.pixelRatio } },
    });
    const spots = new THREE.Points(spotGeo, spotMat);
    spots.frustumCulled = false;
    group.add(spots);
    owned.push(spotGeo, spotMat);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

    function routePoint(r, s, out) {
        const from = kerbin.pos, to = r.target.pos;
        if (r.target.def.parent === 'kerbin') {
            // to a moon: a lofted arc
            tmpA.copy(from).lerp(to, 0.5);
            tmpB.copy(to).sub(from);
            tmpC.crossVectors(tmpB, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(tmpB.length() * 0.35);
            tmpA.add(tmpC).add(new THREE.Vector3(0, tmpB.length() * 0.18, 0));
            const u = 1 - s;
            return out.copy(from).multiplyScalar(u * u).addScaledVector(tmpA, 2 * u * s).addScaledVector(to, s * s);
        }
        // to a planet: a prograde transfer spiralling out from Kerbin's orbit to the target's
        const r0 = Math.hypot(from.x, from.z), r1 = Math.hypot(to.x, to.z);
        const a0 = Math.atan2(from.z, from.x);
        let a1 = Math.atan2(to.z, to.x);
        while (a1 < a0 + 0.6) a1 += Math.PI * 2;
        const e = s * s * (3 - 2 * s);
        const ang = a0 + (a1 - a0) * s;
        const rad = r0 + (r1 - r0) * e;
        return out.set(Math.cos(ang) * rad, from.y + (to.y - from.y) * e, Math.sin(ang) * rad);
    }

    // ---------- engineering grid ----------
    const gridPts = [];
    for (const rr of [6, 12, 18, 24, 30, 36, 42, 48, 60, 72]) {
        for (let i = 0; i < 128; i++) {
            const a0 = i / 128 * Math.PI * 2, a1 = (i + 1) / 128 * Math.PI * 2;
            gridPts.push(Math.cos(a0) * rr, 0, Math.sin(a0) * rr, Math.cos(a1) * rr, 0, Math.sin(a1) * rr);
        }
    }
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        gridPts.push(Math.cos(a) * 4, 0, Math.sin(a) * 4, Math.cos(a) * 72, 0, Math.sin(a) * 72);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gridPts), 3));
    const gridMat = lineMat('#8fb3ff');
    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.frustumCulled = false;
    group.add(grid);
    owned.push(gridGeo);

    // ---------- constellation lines between bright stars ----------
    // (each of the brightest stars joins its nearest neighbour or two)
    const cGeo = new THREE.BufferGeometry();
    const brightDirs = stars.brightStars;
    const segs = [];
    brightDirs.forEach((a, i) => {
        const near = brightDirs.map((b, j) => [a.distanceTo(b), j]).filter(([d, j]) => j !== i && d < 620).sort((x, y) => x[0] - y[0]).slice(0, 2);
        near.forEach(([, j]) => { if (j > i) segs.push(a.x, a.y, a.z, brightDirs[j].x, brightDirs[j].y, brightDirs[j].z); });
    });
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
    const cMat = lineMat('#cfdcff');
    const cLines = new THREE.LineSegments(cGeo, cMat);
    cLines.frustumCulled = false;
    group.add(cLines);
    owned.push(cGeo);
    // ...and stars to hang them on
    const cpGeo = new THREE.BufferGeometry();
    cpGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(brightDirs.flatMap(v => [v.x, v.y, v.z])), 3));
    const cpMat = new THREE.ShaderMaterial({
        vertexShader: `uniform float uPixelRatio; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 5.0 * uPixelRatio; }`,
        fragmentShader: SPOT_FRAG, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color('#e8eeff') }, uOpacity: { value: 0 }, uPixelRatio: { value: ctx.pixelRatio } },
    });
    const cPoints = new THREE.Points(cpGeo, cpMat);
    cPoints.frustumCulled = false;
    group.add(cPoints);
    owned.push(cpGeo, cpMat);

    // ---------- the Climb ----------
    const climbGeo = new THREE.BufferGeometry().setFromPoints(stars.constellation);
    const climbMat = lineMat('#efe6d2');
    const climb = new THREE.Line(climbGeo, climbMat);
    climb.frustumCulled = false;
    group.add(climb);
    owned.push(climbGeo);
    const state = { climb: 0, climbTarget: 0 };

    const themed = (dark, light, theme) => (theme > 0.5 ? light : dark);

    return {
        object: group,
        state,
        showClimb(on) { state.climbTarget = on ? 1 : 0; },
        streakNow(cam) { launchStreak(cam); },
        update(c) {
            const theme = c.themeMix;
            const m = c.mood;
            // shooting stars (not in reduced effects or at zero intensity)
            if (c.effects === 'full' && c.motion > 0) {
                const rate = 1 + m.news * 2.5 + m.games * 3;
                if (shooting.t < 0) {
                    shooting.next -= c.dt * rate;
                    if (shooting.next <= 0) { launchStreak(c.camera); shooting.next = R.range(9, 22); }
                }
            }
            if (shooting.t >= 0) {
                shooting.t += c.dt / shooting.dur;
                const t = shooting.t;
                sMat.uniforms.uHead.value = Math.min(1, t * 1.25);
                sMat.uniforms.uAlpha.value = Math.sin(Math.min(1, t) * Math.PI) * 0.9;
                sMat.uniforms.uViewport.value.set(c.width, c.height);
                sMat.uniforms.uWidth.value = 1.7 * c.pixelRatio;
                sMat.uniforms.uTheme.value = theme;
                if (sMat.blending !== (theme > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending)) { sMat.blending = theme > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending; sMat.needsUpdate = true; }
                if (t >= 1) { shooting.t = -1; streak.visible = false; }
            }
            // routes
            const rw = m.missions;
            if (rw > 0.003) {
                routes.forEach((r, ri) => {
                    const arr = r.geo.attributes.position.array;
                    for (let i = 0; i <= SEGS; i++) {
                        routePoint(r, i / SEGS, tmpB);
                        arr[i * 3] = tmpB.x; arr[i * 3 + 1] = tmpB.y; arr[i * 3 + 2] = tmpB.z;
                    }
                    r.geo.attributes.position.needsUpdate = true;
                    r.mat.uniforms.uOpacity.value = rw * themed(0.75, 0.6, theme);
                    r.mat.uniforms.uFlow.value = c.time * 0.35 * (0.3 + c.motion);
                    r.mat.uniforms.uColor.value.set(themed('#8fb3ff', '#2f5fbf', theme));
                    r.line.visible = true;
                    const s = (c.time * 0.06 * (0.3 + c.motion) + r.seed) % 1;
                    routePoint(r, s, tmpC);
                    spotGeo.attributes.position.setXYZ(ri, tmpC.x, tmpC.y, tmpC.z);
                });
                spotGeo.attributes.position.needsUpdate = true;
                spotMat.uniforms.uOpacity.value = rw * themed(1, 0.8, theme);
                spotMat.uniforms.uColor.value.set(themed('#e4ecff', '#1d3f8a', theme));
                spotMat.uniforms.uPixelRatio.value = c.pixelRatio;
                spots.visible = true;
            } else {
                routes.forEach(r => { r.line.visible = false; });
                spots.visible = false;
            }
            // grid
            gridMat.uniforms.uOpacity.value = m.engineering * themed(0.12, 0.16, theme);
            gridMat.uniforms.uColor.value.set(themed('#8fb3ff', '#2f5fbf', theme));
            grid.visible = m.engineering > 0.003;
            // constellations
            cMat.uniforms.uOpacity.value = m.achievements * themed(0.32, 0.35, theme);
            cMat.uniforms.uColor.value.set(themed('#cfdcff', '#1d2a45', theme));
            cpMat.uniforms.uOpacity.value = m.achievements * themed(0.9, 0.7, theme);
            cpMat.uniforms.uColor.value.set(themed('#eef2ff', '#1d2a45', theme));
            cpMat.uniforms.uPixelRatio.value = c.pixelRatio;
            cLines.visible = cPoints.visible = m.achievements > 0.003;
            state.climb += (state.climbTarget - state.climb) * Math.min(1, c.dt * 3);
            climbMat.uniforms.uOpacity.value = state.climb * themed(0.7, 0.6, theme);
            climbMat.uniforms.uColor.value.set(themed('#efe6d2', '#3a2f1c', theme));
            climb.visible = state.climb > 0.003;
        },
        dispose() { owned.forEach(o => o.dispose()); },
    };
}
