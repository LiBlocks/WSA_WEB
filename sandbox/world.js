// WSA Engineering Sandbox: the 3D view (three.js r186, vendored in vendor/three). It only draws: every
// position, angle and plume comes from the simulation state handed to sync(). Four views share one renderer:
//   stand    engine test stands
//   flight   a rocket on its pad, climbing, staging (or in empty space); free play adds a map view
//   orbit    a planet with orbits, transfers and burns
//   landing  a booster coming down onto its pad
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import * as P from './physics.js';

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);

/* ---------- Procedural textures (canvas, no image files) ---------- */

function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    t.anisotropy = 4;
    return t;
}

function noiseFill(g, w, h, base, spread, seed, cell = 4) {
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
            const v = (r() - 0.5) * spread;
            g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
            g.fillRect(x, y, cell, cell);
        }
    }
}

const concreteTex = () => canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#b9bcbf', 0.09, 7, 2);
    g.strokeStyle = 'rgba(60,64,70,0.35)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
}, [1, 1]);

function terrainTex(color, seed) {
    return canvasTexture(256, 256, (g, w, h) => {
        noiseFill(g, w, h, color, 0.12, seed, 4);
        const r = rng(seed + 1);
        for (let i = 0; i < 60; i++) {
            g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
            g.beginPath();
            g.arc(r() * w, r() * h, 6 + r() * 26, 0, Math.PI * 2);
            g.fill();
        }
    }, [1, 1]);
}

const gridTex = () => canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke();
        g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke();
    }
});

function textTex(text, w, h, font, color, bg) {
    return canvasTexture(w, h, (g) => {
        if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
        g.fillStyle = color;
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2);
    });
}

const softDot = () => canvasTexture(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
});

// Planet looks per world: illustrative colours only, not maps of the real bodies
const LOOKS = {
    kerbin: { ground: '#5f7d4c', planet: ['#2c6aa6', '#3f8a52', '#6c9a59', '#e8eef2'], sky: '#8fbbe6', horizon: '#d7e7f3', air: '#7fb2ff' },
    mun: { ground: '#8d8f93', planet: ['#77797d', '#8f9196', '#606266', '#a2a4a8'], sky: null },
    minmus: { ground: '#a6d4c2', planet: ['#a3d6c3', '#c3ece0', '#8cc2ae', '#d9f5ec'], sky: null },
    duna: { ground: '#a65a3c', planet: ['#9a4e33', '#b9643f', '#7d3d29', '#e6d8d0'], sky: '#d39a7c', horizon: '#ecc3a8', air: '#e8a080' },
    eve: { ground: '#5b3f78', planet: ['#4d2f6b', '#6d4791', '#3c2457', '#8a68aa'], sky: '#a48ac0', horizon: '#d4c3e3', air: '#b48cff' },
    tylo: { ground: '#bdb6ad', planet: ['#b4ada4', '#cfc8bf', '#9b948c', '#e0d9d0'], sky: null },
    moho: { ground: '#7a5c48', planet: ['#6e5242', '#8a6a55', '#5a4235', '#a07f68'], sky: null },
    gilly: { ground: '#8c7a6a', planet: ['#7f6e60', '#9a887a', '#6a5b4f', '#ad9c8d'], sky: null },
    custom: { ground: '#7d8590', planet: ['#6f7782', '#8a929c', '#5d646d', '#a9b0b8'], sky: null },
};
const lookOf = id => LOOKS[id] || LOOKS.custom;

function planetTex(look, seed) {
    return canvasTexture(1024, 512, (g, w, h) => {
        const [c0, c1, c2, cap] = look.planet;
        g.fillStyle = c0;
        g.fillRect(0, 0, w, h);
        const r = rng(seed);
        for (let i = 0; i < 260; i++) {
            const x = r() * w, y = h * (0.12 + r() * 0.76), rad = 8 + r() * 60;
            g.fillStyle = r() < 0.55 ? c1 : c2;
            g.globalAlpha = 0.35 + r() * 0.5;
            g.beginPath();
            g.ellipse(x, y, rad * (1 + r()), rad * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
            g.fill();
        }
        g.globalAlpha = 0.55;
        g.fillStyle = cap;
        g.fillRect(0, 0, w, h * 0.03);
        g.fillRect(0, h * 0.97, w, h * 0.03);
        g.globalAlpha = 1;
    });
}

/* ---------- Materials ---------- */

function makeMaterials() {
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, ...o });
    return {
        white: std({ color: '#eef1f4', roughness: 0.45 }),
        offwhite: std({ color: '#d9dee4', roughness: 0.5 }),
        dark: std({ color: '#2a2f36', roughness: 0.55, metalness: 0.3 }),
        steel: std({ color: '#8d959f', roughness: 0.4, metalness: 0.6 }),
        darksteel: std({ color: '#4b525b', roughness: 0.5, metalness: 0.5 }),
        nozzle: std({ color: '#3a3d42', roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide }),
        copper: std({ color: '#a8673d', roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }),
        blue: std({ color: '#2f6fd6', roughness: 0.5 }),
        amber: std({ color: '#e0a03c', roughness: 0.5 }),
        concrete: std({ color: '#ffffff', map: concreteTex(), roughness: 0.95 }),
        glass: new THREE.MeshStandardMaterial({ color: '#9ec7ff', transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1 }),
        liquid: new THREE.MeshStandardMaterial({ color: '#4ea8ff', emissive: '#12355e', roughness: 0.3 }),
        legs: std({ color: '#30353c', roughness: 0.5, metalness: 0.5 }),
        stage: ['#eef1f4', '#dfe4ea', '#eef1f4', '#dfe4ea'].map(c => std({ color: c, roughness: 0.45 })),
        band: std({ color: '#1e3a8a', roughness: 0.5 }),
    };
}

/* ---------- Engine plume ---------- */

// The renderer uses a logarithmic depth buffer, so custom shaders include three's log-depth chunks
const PLUME_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying float vFres;
void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFres = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
}`;
const PLUME_FRAG = `
uniform float uTime;
uniform float uPower;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec2 vUv;
varying float vFres;
#include <logdepthbuf_pars_fragment>
void main() {
    #include <logdepthbuf_fragment>
    float along = 1.0 - vUv.y;                 // 0 at the nozzle, 1 at the tail
    float flick = 0.85 + 0.15 * sin(uTime * 47.0 + along * 18.0) * sin(uTime * 31.0 + vUv.x * 25.0);
    float a = pow(1.0 - along, 1.6) * pow(vFres, 1.4) * uPower * flick;
    vec3 col = mix(uCore, uEdge, smoothstep(0.0, 0.7, along));
    gl_FragColor = vec4(col * (1.0 + 0.6 * (1.0 - along)), a);
}`;

function plumeMaterial(core = '#fff3d6', edge = '#ff8a2a') {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) } },
        vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

/** A plume hanging below a nozzle exit (local origin), pointing down -y. Scaled each frame by thrust. */
function makePlume(radius) {
    const geo = new THREE.CylinderGeometry(radius * 0.9, radius * 1.6, 1, 20, 1, true);
    geo.translate(0, -0.5, 0);
    const outer = new THREE.Mesh(geo, plumeMaterial());
    const inner = new THREE.Mesh(geo, plumeMaterial('#ffffff', '#ffd27a'));
    inner.scale.set(0.55, 1, 0.55);
    outer.renderOrder = 2;
    inner.renderOrder = 3;
    const g = new THREE.Group();
    g.add(outer, inner);
    g.userData = { outer, inner, radius };
    g.visible = false;
    return g;
}

function setPlume(pl, power, length, time, vacuum = false) {
    pl.visible = power > 0.01;
    if (!pl.visible) return;
    const { outer, inner } = pl.userData;
    const widen = vacuum ? 1.8 : 1;
    pl.scale.set(widen * (0.8 + 0.2 * power), length * (0.55 + 0.45 * power), widen * (0.8 + 0.2 * power));
    for (const m of [outer.material, inner.material]) {
        m.uniforms.uTime.value = time;
        m.uniforms.uPower.value = Math.min(1, power) * (vacuum ? 0.65 : 1);
    }
}

/* ---------- Particles (exhaust clouds, dust) ---------- */

function makeParticles(count, color, tex) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 6, map: tex, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    const base = new THREE.Color(color);
    const parts = Array.from({ length: count }, () => ({ life: 0, max: 1, p: [0, -1e5, 0], v: [0, 0, 0] }));
    let next = 0;
    const r = rng(99);
    return {
        obj: pts,
        emit(origin, dir, speed, spread, n, life) {
            for (let i = 0; i < n; i++) {
                const q = parts[next];
                next = (next + 1) % count;
                q.life = 0;
                q.max = life * (0.6 + 0.8 * r());
                q.p = origin.slice();
                q.v = [dir[0] * speed + (r() - 0.5) * spread, dir[1] * speed + (r() - 0.5) * spread * 0.4, dir[2] * speed + (r() - 0.5) * spread];
            }
        },
        update(dt) {
            for (let i = 0; i < count; i++) {
                const q = parts[i];
                if (q.life >= q.max) {
                    pos[i * 3 + 1] = -1e5;
                    continue;
                }
                q.life += dt;
                for (let k = 0; k < 3; k++) {
                    q.v[k] *= Math.exp(-1.6 * dt);
                    q.p[k] += q.v[k] * dt;
                }
                if (q.p[1] < 0.3) { q.p[1] = 0.3; q.v[1] = Math.abs(q.v[1]) * 0.3; }
                q.v[1] += 1.2 * dt;
                pos[i * 3] = q.p[0]; pos[i * 3 + 1] = q.p[1]; pos[i * 3 + 2] = q.p[2];
                const fade = 1 - q.life / q.max;
                col[i * 3] = base.r * fade; col[i * 3 + 1] = base.g * fade; col[i * 3 + 2] = base.b * fade;
            }
            geo.attributes.position.needsUpdate = true;
            geo.attributes.color.needsUpdate = true;
        },
        clear() { for (const q of parts) q.life = q.max = 0; },
    };
}

/* ---------- Rocket and engine models ---------- */

function bellGeometry(radius, length) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector2(radius * (0.32 + 0.68 * Math.pow(t, 0.7)), length * (1 - t)));
    }
    return new THREE.LatheGeometry(pts, 24);
}

function enginePositions(n, R) {
    if (n <= 1) return [[0, 0]];
    const out = [];
    const ring = n >= 5 ? n - 1 : n;
    const rr = n >= 5 ? R * 0.64 : R * (n === 2 ? 0.45 : 0.52);
    if (n >= 5) out.push([0, 0]);
    for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2 + Math.PI / 4;
        out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return out;
}

/** An engine cluster: bells with plumes. Local origin at the nozzle exit plane, engines above it. */
function engineCluster(mats, n, R, height) {
    const g = new THREE.Group();
    const pos = enginePositions(n, R);
    const bellR = n === 1 ? R * 0.62 : Math.min(R * 0.42, R * 1.25 / Math.sqrt(n));
    const plumes = [];
    for (const [x, z] of pos) {
        const bell = new THREE.Mesh(bellGeometry(bellR, height), mats.nozzle);
        bell.position.set(x, 0, z);
        bell.castShadow = true;
        g.add(bell);
        const pl = makePlume(bellR * 0.95);
        pl.position.set(x, 0, z);
        g.add(pl);
        plumes.push(pl);
    }
    return { group: g, plumes, bellR };
}

/** Radius and tank length drawn for a stage: lengths are proportional to propellant (illustrative). */
function stageShape(st, below) {
    const m = st.dry + st.prop;
    let R = THREE.MathUtils.clamp(1.25 * Math.cbrt(m / 30000), 0.45, 3.6);
    if (below) R = Math.min(R, below);
    const L = Math.max(1.4, st.prop / (420 * Math.PI * R * R) + st.dry / (900 * Math.PI * R * R));
    return { R, L: Math.min(L, 70) };
}

/**
 * A stack of stages, bottom first. Each stage is its own group (origin at its nozzle exit) so a spent stage
 * can fly off on its own. Returns { group, stages: [{ group, plumes, height, R }], height, payloadTop }.
 */
function buildRocket(mats, stages, payload) {
    const group = new THREE.Group();
    const out = [];
    let y = 0, below = null;
    stages.forEach((st, i) => {
        const { R, L } = stageShape(st, below);
        below = R;
        const sg = new THREE.Group();
        const engH = Math.max(0.8, R * 0.9);
        const eng = engineCluster(mats, st.engines, R, engH);
        sg.add(eng.group);
        const thrustSection = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.02, engH * 0.45, 32), mats.dark);
        thrustSection.position.y = engH + engH * 0.225 - 0.05;
        sg.add(thrustSection);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 40), mats.stage[i % mats.stage.length]);
        tank.position.y = engH + engH * 0.45 + L / 2;
        tank.castShadow = tank.receiveShadow = true;
        sg.add(tank);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.005, R * 1.005, Math.min(0.5, L * 0.08), 40), mats.band);
        band.position.y = engH + engH * 0.45 + L * 0.85;
        sg.add(band);
        const top = engH + engH * 0.45 + L;
        const inter = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R, 0.5, 32, 1, true), mats.darksteel);
        inter.position.y = top + 0.25;
        sg.add(inter);
        const h = top + 0.5;
        sg.position.y = y;
        group.add(sg);
        out.push({ group: sg, plumes: eng.plumes, height: h, R, bellR: eng.bellR, base: y });
        y += h;
    });
    // Payload fairing: an ogive on a short cylinder
    const R = below || 1;
    const fh = Math.max(1.5, 1.6 * Math.cbrt(Math.max(payload, 200) / 1000)) + R;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(new THREE.Vector2(R * Math.sqrt(Math.max(0, 1 - t * t)) * (t < 0.35 ? 1 : 1 - (t - 0.35) * 0.15), fh * 0.35 + t * fh));
    }
    pts.unshift(new THREE.Vector2(R, 0));
    const fairing = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mats.white);
    fairing.position.y = y;
    fairing.castShadow = true;
    out[out.length - 1].group.add(fairing);
    fairing.position.y = out[out.length - 1].height;
    const decal = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, R * 0.9, 40, 1, true, -0.6, 1.2), new THREE.MeshStandardMaterial({ map: textTex('WSA', 256, 128, 'bold 92px system-ui, sans-serif', '#1d4ed8'), transparent: true, roughness: 0.5 }));
    decal.position.y = out[0].height * 0.55;
    out[0].group.add(decal);
    return { group, stages: out, height: y + fh * 1.35 };
}

/* ---------- Reusable booster (landing lab) ---------- */

function buildBooster(mats) {
    const B = P.BOOSTER;
    const g = new THREE.Group();
    const engineY = 0.7;
    const eng = engineCluster(mats, 3, B.radius, 1.3);
    eng.group.position.y = engineY;
    g.add(eng.group);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(B.radius, B.radius * 1.08, 1.2, 32), mats.dark);
    skirt.position.y = engineY + 1.3 + 0.6;
    g.add(skirt);
    const bodyH = B.height - 3.2;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(B.radius, B.radius, bodyH, 40), mats.white);
    body.position.y = engineY + 2.5 + bodyH / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const inter = new THREE.Mesh(new THREE.CylinderGeometry(B.radius, B.radius, 2.2, 40), mats.dark);
    inter.position.y = engineY + 2.5 + bodyH - 1.1;
    g.add(inter);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(B.radius * 1.004, B.radius * 1.004, 0.5, 40), mats.band);
    band.position.y = engineY + 2.5 + 3;
    g.add(band);
    const decal = new THREE.Mesh(new THREE.CylinderGeometry(B.radius * 1.01, B.radius * 1.01, 3.2, 40, 1, true, -0.55, 1.1),
        new THREE.MeshStandardMaterial({ map: textTex('WSA', 256, 128, 'bold 92px system-ui, sans-serif', '#1d4ed8'), transparent: true, roughness: 0.5 }));
    decal.position.y = engineY + 2.5 + bodyH * 0.55;
    decal.rotation.y = Math.PI / 2;
    g.add(decal);
    // Grid fins near the top
    const finGeo = new THREE.BoxGeometry(1.3, 1.1, 0.08);
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const fin = new THREE.Mesh(finGeo, mats.darksteel);
        fin.position.set(Math.cos(a) * (B.radius + 0.65), engineY + 2.5 + bodyH - 3.2, Math.sin(a) * (B.radius + 0.65));
        fin.rotation.y = -a;
        g.add(fin);
    }
    // Four legs, hinged on the skirt: folded flat along the body, swung out to put the feet on the ground
    const legs = [];
    const hingeY = 5.4;
    const legLen = Math.hypot(B.legSpan - B.radius, hingeY);
    const deployed = Math.atan2(B.legSpan - B.radius, hingeY);    // angle from straight down
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * B.radius, hingeY, Math.sin(a) * B.radius);
        pivot.rotation.y = -a;
        const swing = new THREE.Group();
        pivot.add(swing);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, legLen, 0.36), mats.legs);
        leg.position.y = -legLen / 2;
        leg.castShadow = true;
        swing.add(leg);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 16), mats.legs);
        foot.position.y = -legLen;
        swing.add(foot);
        g.add(pivot);
        legs.push(swing);
    }
    return {
        group: g, plumes: eng.plumes, legs,
        setLegs(f) {
            // f = 0: stowed (pointing up along the body); f = 1: deployed
            const stowed = Math.PI - 0.08;
            const ang = stowed + (deployed - stowed) * THREE.MathUtils.smoothstep(f, 0, 1);
            for (const s of legs) s.rotation.z = ang;
        },
    };
}

/* ---------- Lines ---------- */

function fatLine(color, width, dashed = false, opacity = 1) {
    const geo = new LineGeometry();
    geo.setPositions([0, 0, 0, 0, 0, 0]);
    const mat = new LineMaterial({ color, linewidth: width, dashed, dashSize: 0.6, gapSize: 0.4, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    return line;
}

function setLine(line, pts, k = 1, offset = [0, 0, 0]) {
    if (!pts || pts.length < 2) { line.visible = false; return; }
    const arr = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
        arr[i * 3] = pts[i][0] * k + offset[0];
        arr[i * 3 + 1] = pts[i][1] * k + offset[1];
        arr[i * 3 + 2] = pts[i][2] * k + offset[2];
    }
    line.geometry.dispose();
    line.geometry = new LineGeometry();
    line.geometry.setPositions(arr);
    if (line.material.dashed) line.computeLineDistances();
    line.visible = true;
}

function trailLine(color, max) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    return line;
}

function setTrail(line, pts, k = 1, offset = [0, 0, 0]) {
    const a = line.geometry.attributes.position;
    const n = Math.min(pts.length, a.count);
    const s = pts.length - n;
    for (let i = 0; i < n; i++) {
        a.array[i * 3] = pts[s + i][0] * k + offset[0];
        a.array[i * 3 + 1] = pts[s + i][1] * k + offset[1];
        a.array[i * 3 + 2] = pts[s + i][2] * k + offset[2];
    }
    a.needsUpdate = true;
    line.geometry.setDrawRange(0, n);
}

/* ---------- The world ---------- */

export function createWorld(canvas, labelLayer, opts = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    let quality = opts.quality === 'low' ? 'low' : 'high';

    const mats = makeMaterials();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 4e6);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI;

    const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.position.set(60, 90, 40);
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 400;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight('#dbe8ff', '#5d6650', 1.1);
    scene.add(hemi);

    // Sky dome (follows the camera) and stars
    const skyMat = new THREE.ShaderMaterial({
        uniforms: { uTop: { value: new THREE.Color('#6fa3dc') }, uHorizon: { value: new THREE.Color('#d7e7f3') }, uMix: { value: 1 } },
        vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n#include <logdepthbuf_vertex>\n}',
        fragmentShader: 'uniform vec3 uTop; uniform vec3 uHorizon; uniform float uMix; varying vec3 vDir;\n#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\nfloat h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(uHorizon, uTop, pow(max(h,0.0), 0.55)); gl_FragColor = vec4(c, uMix); }',
        side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
    sky.scale.setScalar(1e5);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
    const starGeo = new THREE.BufferGeometry();
    {
        const r = rng(4), n = 2200, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            a[i * 3] = s * Math.cos(th); a[i * 3 + 1] = u; a[i * 3 + 2] = s * Math.sin(th);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    }
    const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    const stars = new THREE.Points(starGeo, starMat);
    stars.scale.setScalar(9e4);
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    scene.add(stars);

    const dot = softDot();
    const smoke = makeParticles(420, '#d9dadb', dot);
    scene.add(smoke.obj);

    let root = new THREE.Group();
    scene.add(root);
    let view = null;            // the current view's handles
    let kind = null;
    let follow = true;
    let tracked = null;         // THREE.Vector3 the camera follows
    const lastTracked = new THREE.Vector3();
    let mapMode = false;
    let size = { w: 1, h: 1 };
    const labels = new Map();
    const lineMats = [];

    function applyQuality() {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1));
        renderer.shadowMap.enabled = quality === 'high';
        sun.castShadow = quality === 'high';
        renderer.setSize(size.w, size.h, false);
    }

    function clearRoot() {
        scene.remove(root);
        root.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material && !Object.values(mats).includes(o.material) && !mats.stage.includes(o.material)) {
                if (o.material.map && o.material.map !== mats.concrete.map) o.material.map.dispose();
                o.material.dispose();
            }
        });
        root = new THREE.Group();
        scene.add(root);
        lineMats.length = 0;
        for (const el of labels.values()) el.remove();
        labels.clear();
        smoke.clear();
    }

    function addLine(line) {
        lineMats.push(line.material);
        line.material.resolution.set(size.w, size.h);
        return line;
    }

    function label(id, text, cls = '') {
        let el = labels.get(id);
        if (!el) {
            el = document.createElement('div');
            el.className = `es-label ${cls}`;
            labelLayer.appendChild(el);
            labels.set(id, el);
        }
        if (el.textContent !== text) el.textContent = text;
        return el;
    }
    const tmpV = new THREE.Vector3();
    function placeLabel(id, text, pos, cls) {
        const el = label(id, text, cls);
        tmpV.copy(pos).project(camera);
        const vis = tmpV.z < 1 && tmpV.z > -1 && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2;
        el.hidden = !vis;
        if (vis) el.style.transform = `translate(${((tmpV.x + 1) / 2 * size.w).toFixed(1)}px, ${((1 - tmpV.y) / 2 * size.h).toFixed(1)}px)`;
    }
    function hideLabel(id) { const el = labels.get(id); if (el) el.hidden = true; }

    function setSky(top, horizon, starOpacity, skyAlpha) {
        skyMat.uniforms.uTop.value.set(top);
        skyMat.uniforms.uHorizon.value.set(horizon);
        skyMat.uniforms.uMix.value = skyAlpha;
        starMat.opacity = starOpacity;
        sky.visible = skyAlpha > 0.01;
        stars.visible = starOpacity > 0.01;
        scene.background = new THREE.Color(skyAlpha > 0.5 ? horizon : '#02040a');
    }

    function arrow(color) {
        const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, color, 0.6, 0.35);
        a.line.material.depthTest = false;
        a.cone.material.depthTest = false;
        a.renderOrder = 10;
        a.visible = false;
        return a;
    }
    function setArrow(a, origin, dir, length, on) {
        a.visible = on && length > 0.05;
        if (!a.visible) return;
        a.position.copy(origin);
        a.setDirection(dir.clone().normalize());
        a.setLength(length, Math.min(length * 0.3, 2.2), Math.min(length * 0.18, 1.2));
    }

    function groundEnv(worldId, radiusM) {
        const look = lookOf(worldId);
        const ground = new THREE.Mesh(new THREE.CircleGeometry(radiusM, 96), new THREE.MeshStandardMaterial({ map: terrainTex(look.ground, 11), roughness: 1 }));
        ground.material.map.repeat.set(radiusM / 40, radiusM / 40);
        ground.material.map.wrapS = ground.material.map.wrapT = THREE.RepeatWrapping;
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        const grid = new THREE.Mesh(new THREE.CircleGeometry(Math.min(radiusM, 600), 64), new THREE.MeshBasicMaterial({ map: gridTex(), transparent: true, opacity: 0.35, depthWrite: false }));
        grid.material.map.wrapS = grid.material.map.wrapT = THREE.RepeatWrapping;
        grid.material.map.repeat.set(Math.min(radiusM, 600) / 10, Math.min(radiusM, 600) / 10);
        grid.rotation.x = -Math.PI / 2;
        grid.position.y = 0.03;
        const g = new THREE.Group();
        g.add(ground, grid);
        return { group: g, look };
    }

    function skyFor(look, alt, atmo) {
        if (!look.sky || atmo <= 0) { setSky('#02040a', '#02040a', 1, 0); return; }
        const f = THREE.MathUtils.clamp(alt / (atmo * 0.75), 0, 1);
        const top = new THREE.Color(look.sky).lerp(new THREE.Color('#02040a'), f);
        const hor = new THREE.Color(look.horizon).lerp(new THREE.Color('#0a1424'), f);
        setSky(`#${top.getHexString()}`, `#${hor.getHexString()}`, f * f, 1 - f * 0.999);
    }

    function padModel(radius, towerH) {
        const g = new THREE.Group();
        const slab = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.04, 1.2, 48), mats.concrete);
        slab.position.y = -0.55;
        slab.receiveShadow = true;
        g.add(slab);
        if (towerH > 0) {
            const tw = new THREE.Group();
            const s = 2.4;
            for (const [x, z] of [[0, 0], [s, 0], [0, s], [s, s]]) {
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, towerH, 0.3), mats.amber);
                col.position.set(x, towerH / 2, z);
                col.castShadow = true;
                tw.add(col);
            }
            for (let y = 3; y < towerH; y += 3) {
                const ring = new THREE.Mesh(new THREE.BoxGeometry(s + 0.3, 0.18, s + 0.3), mats.amber);
                ring.position.set(s / 2, y, s / 2);
                tw.add(ring);
            }
            tw.position.set(radius * 0.55, 0, -s / 2);
            g.add(tw);
        }
        return g;
    }

    /* ----- Views ----- */

    function buildStand(p) {
        const env = groundEnv(p.world || 'kerbin', 1500);
        root.add(env.group);
        skyFor(LOOKS.kerbin, 0, 1);
        const stands = [];
        const list = p.compare ? [['A', -14], ['B', 14]] : [['A', 0]];
        for (const [id, x] of list) {
            const n = id === 'B' ? p.bEngines : p.engines;
            const g = new THREE.Group();
            g.position.x = x;
            const H = 14, W = 7;
            const deck = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.6, W + 1), mats.darksteel);
            deck.position.y = H;
            deck.castShadow = deck.receiveShadow = true;
            g.add(deck);
            for (const [cx, cz] of [[-W / 2, -W / 2], [W / 2, -W / 2], [-W / 2, W / 2], [W / 2, W / 2]]) {
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, H + 12, 0.6), mats.steel);
                col.position.set(cx, (H + 12) / 2, cz);
                col.castShadow = true;
                g.add(col);
            }
            for (const y of [4, 9, H + 6, H + 11]) {
                for (const [w, d, ox, oz] of [[W, 0.3, 0, -W / 2], [W, 0.3, 0, W / 2], [0.3, W, -W / 2, 0], [0.3, W, W / 2, 0]]) {
                    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mats.steel);
                    beam.position.set(ox, y, oz);
                    g.add(beam);
                }
            }
            // Flame deflector: a concrete wedge that turns the exhaust sideways
            const defl = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 8, 32, 1, false, 0, Math.PI / 2), mats.concrete);
            defl.rotation.set(0, 0, Math.PI / 2);
            defl.position.set(0, 0, -4.5);
            defl.rotation.y = Math.PI / 2;
            g.add(defl);
            // Engines below the deck, tank above it with a sight glass showing the propellant level
            const R = 1.6;
            const eng = engineCluster(mats, n, R, 2.2);
            eng.group.position.y = H - 2.6;
            g.add(eng.group);
            const thrustFrame = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.5, 24), mats.dark);
            thrustFrame.position.y = H - 0.15;
            g.add(thrustFrame);
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 9, 32), mats.white);
            tank.position.y = H + 5;
            tank.castShadow = true;
            g.add(tank);
            const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.2), mats.glass);
            glass.position.set(0, H + 5, 2.25);
            g.add(glass);
            const fill = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1, 0.16), mats.liquid);
            fill.position.set(0, H + 1, 2.25);
            g.add(fill);
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: textTex(id, 128, 64, 'bold 46px system-ui, sans-serif', '#ffffff', '#1e3a8a') }));
            sign.position.set(0, H + 8.5, 2.23);
            g.add(sign);
            root.add(g);
            stands.push({ id, group: g, plumes: eng.plumes, fill, H, x, n });
        }
        view = { stands };
        const target = new THREE.Vector3(0, 11, 0);
        resetCam(target, new THREE.Vector3(p.compare ? 30 : 22, 18, p.compare ? 52 : 40));
        tracked = null;
    }

    function syncStand(sim, tm, p, t, dt) {
        for (const st of view.stands) {
            const s = sim[st.id];
            if (!s) continue;
            const power = s.thrust / Math.max(1, s.cfg.thrust * s.cfg.engines);
            for (const pl of st.plumes) setPlume(pl, power, 9 + 6 * Math.min(1, s.cfg.thrust / 1e6), t);
            st.fill.scale.y = Math.max(0.001, 7.8 * s.prop / Math.max(1, s.cfg.propellant));
            st.fill.position.y = st.H + 1.1 + st.fill.scale.y / 2;
            if (power > 0.05 && dt > 0) {
                const n = Math.ceil(power * 6 * Math.min(4, dt * 60));
                smoke.emit([st.x, 1.5, -2], [0, 0.15, -1], 28 * power, 10, n, 3.5);
            }
            placeLabel(`load-${st.id}`, `${view.stands.length > 1 ? `${st.id}: ` : ''}${(s.thrust / 1000).toFixed(0)} kN`, new THREE.Vector3(st.x + 4.5, st.H + 1, 0), 'es-label-value');
        }
    }

    function buildFlight(sc, p, sim) {
        const f = sim.f;
        const space = !f.gravity;
        const worldId = space ? null : (sim.w && sim.w.id) || 'kerbin';
        const look = lookOf(worldId);
        const rocket = buildRocket(mats, f.stages.map(s => ({ dry: s.dry, prop: s.prop0, engines: s.engines, thrust: s.thrust })), f.payload);
        root.add(rocket.group);
        rocket.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
        const v = { rocket, space, look, debris: [], worldId, atmo: space ? 0 : sim.w.atmosphere, arrows: { thrust: arrow('#ff9a3c'), weight: arrow('#b48cff'), vel: arrow('#5ee09a') } };
        for (const a of Object.values(v.arrows)) root.add(a);
        if (space) {
            setSky('#02040a', '#02040a', 1, 0);
            // A field of faint markers, repeating round the rocket, makes the speed visible in empty space
            const g = new THREE.BufferGeometry();
            const r = rng(21), n = 900, a = new Float32Array(n * 3);
            for (let i = 0; i < n * 3; i++) a[i] = (r() - 0.5) * 400;
            g.setAttribute('position', new THREE.BufferAttribute(a, 3));
            v.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#8fb4ff', size: 0.5, transparent: true, opacity: 0.55, depthWrite: false }));
            v.dust.frustumCulled = false;
            v.dustBase = a.slice();
            root.add(v.dust);
            hemi.intensity = 0.5;
        } else {
            const env = groundEnv(worldId, 12000);
            root.add(env.group);
            const pad = padModel(Math.max(10, rocket.stages[0].R * 6), sc.id === 'freeplay' || sc.id === 'liftoff' || sc.id === 'staging' ? rocket.height + 4 : 0);
            root.add(pad);
            // The planet below, for when the rocket climbs high enough to see the horizon curve
            const R = sim.w.radius;
            const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshStandardMaterial({ map: planetTex(look, 3), roughness: 1 }));
            planet.position.y = -R - 2;
            planet.rotation.x = Math.PI / 2;
            root.add(planet);
            v.planet = planet;
            v.env = env;
            hemi.intensity = 1.1;
        }
        if (sc.map) v.map = buildMap(sim.w, root);
        view = v;
        const h = rocket.height;
        tracked = new THREE.Vector3(0, h * 0.5, 0);
        lastTracked.copy(tracked);
        resetCam(tracked.clone(), new THREE.Vector3(h * 1.1, h * 0.75, h * 1.9));
        setMap(false);
    }

    const qTmp = new THREE.Quaternion();
    function syncFlight(sim, tm, p, t, dt, vectors) {
        const f = sim.f, v = view;
        const site = f.gravity ? [0, f.R, 0] : [0, 0, 0];
        const local = r => [r[0] - site[0], r[1] - site[1], r[2] - site[2]];
        const pos = V3(local(f.r));
        // Attitude: the steering direction; on the pad and while coasting straight up, upright
        const dir = V3(f.dir);
        qTmp.setFromUnitVectors(UP, dir.clone().normalize());
        v.rocket.group.position.copy(pos);
        v.rocket.group.quaternion.slerp(qTmp, dt > 0 ? Math.min(1, dt * 6) : 1);
        // Spent stages: detach once, then follow their own simulated flight
        for (const d of f.debris) {
            let rec = v.debris.find(x => x.d === d);
            if (!rec) {
                const sg = v.rocket.stages[d.stage].group;
                v.rocket.group.remove(sg);
                root.add(sg);
                rec = { d, g: sg };
                v.debris.push(rec);
                for (const pl of v.rocket.stages[d.stage].plumes) pl.visible = false;
            }
            rec.g.position.copy(V3(local(d.r)));
            const tumble = d.landed ? 1.35 : Math.min(1.4, (f.t - d.t0) * d.spin * 0.25);
            rec.g.quaternion.setFromUnitVectors(UP, V3(d.dir).normalize());
            rec.g.rotateX(tumble);
        }
        // Plumes on the active stage
        const st = v.rocket.stages[f.active];
        const sts = f.stages[f.active];
        const power = sts ? f.thrust / Math.max(1, sts.thrust * sts.engines) : 0;
        const alt = P.altitude(f);
        const vac = v.space || alt > (v.atmo || 0) * 0.8;
        for (let i = 0; i < v.rocket.stages.length; i++) {
            for (const pl of v.rocket.stages[i].plumes) setPlume(pl, i === f.active ? power : 0, 6 + st.bellR * 10, t, vac);
        }
        // Remaining stack: the camera follows its middle
        const baseY = st ? st.base : 0;
        const topH = v.rocket.height - baseY;
        const centre = pos.clone().add(dir.clone().multiplyScalar(baseY + topH * 0.45));
        tracked = centre;
        if (!v.space) {
            if (alt < 60 && power > 0.05 && dt > 0) {
                const n = Math.ceil(power * 8 * Math.min(4, dt * 60));
                const ex = pos.clone();
                smoke.emit([ex.x + 2, 0.6, ex.z], [1, 0.1, 0], 22 * power, 14, n, 4);
                smoke.emit([ex.x - 2, 0.6, ex.z], [-1, 0.1, 0], 22 * power, 14, n, 4);
            }
            skyFor(v.look, alt, v.atmo);
            v.planet.visible = alt > 1500;
            v.env.group.visible = alt < 60000;
        } else if (v.dust) {
            const a = v.dust.geometry.attributes.position.array, b = v.dustBase;
            for (let i = 0; i < a.length; i += 3) {
                for (let k = 0; k < 3; k++) {
                    const c = k === 0 ? pos.x : k === 1 ? pos.y : pos.z;
                    a[i + k] = c + (((b[i + k] - c) % 400) + 600) % 400 - 200;
                }
            }
            v.dust.geometry.attributes.position.needsUpdate = true;
        }
        // Force and velocity arrows
        const scaleL = Math.max(4, v.rocket.height * 0.35);
        const m = tm.mass, g = tm.g;
        const wRef = Math.max(m * (g || 9.81), 1);
        setArrow(v.arrows.thrust, centre, dir, scaleL * f.thrust / wRef, vectors && !mapMode);
        setArrow(v.arrows.weight, centre, f.gravity ? V3(f.r).normalize().negate() : new THREE.Vector3(0, -1, 0), g > 0 ? scaleL * m * g / wRef : 0, vectors && !mapMode);
        const sp = P.len(f.v);
        setArrow(v.arrows.vel, centre, sp > 0.01 ? V3(f.v) : UP, sp > 0.05 ? scaleL * 0.6 * Math.log10(1 + sp) : 0, vectors && !mapMode);
        if (v.map) syncMap(v.map, sim.w, f.r, f.v, sim.trail, t, null);
        if (!mapMode && !v.space) placeLabel('alt', `${alt >= 10000 ? `${(alt / 1000).toFixed(1)} km` : `${alt.toFixed(0)} m`}`, centre.clone().add(new THREE.Vector3(v.rocket.stages[0].R * 3, 0, 0)), 'es-label-value');
        else hideLabel('alt');
    }

    /* ----- Orbit (and the free-play map) ----- */

    function buildMap(w, parent) {
        const look = lookOf(w.id);
        const k = 10 / w.radius;
        const g = new THREE.Group();
        const planet = new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), new THREE.MeshStandardMaterial({ map: planetTex(look, 5), roughness: 0.95 }));
        g.add(planet);
        if (w.atmosphere > 0 && look.air) {
            const atmo = new THREE.Mesh(new THREE.SphereGeometry(10 + w.atmosphere * k, 64, 32), new THREE.MeshBasicMaterial({ color: look.air, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.BackSide }));
            g.add(atmo);
        }
        const orbit = addLine(fatLine('#8cc8ff', 2.2));
        const preview = addLine(fatLine('#ffb547', 2, true, 0.95));
        const ideal = addLine(fatLine('#7cf0b0', 1.6, true, 0.75));
        const target = addLine(fatLine('#c3a6ff', 1.6, false, 0.7));
        const start = addLine(fatLine('#6f7d92', 1.4, false, 0.5));
        const trail = trailLine('#5ad1ff', 3000);
        const craft = new THREE.Group();
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 16), mats.white);
        body.rotation.x = Math.PI / 2;
        craft.add(body);
        const pan = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.5), mats.blue);
        craft.add(pan);
        const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: '#c3a6ff', emissive: '#4b3a7a' }));
        sat.visible = false;
        const velArrow = arrow('#5ee09a');
        const burnArrow = arrow('#ffb547');
        g.add(orbit, preview, ideal, target, start, trail, craft, sat, velArrow, burnArrow);
        parent.add(g);
        return { group: g, k, planet, orbit, preview, ideal, target, start, trail, craft, sat, velArrow, burnArrow, lastKey: '' };
    }

    function orbitKey(r, v) { return `${r.map(x => x.toFixed(-1)).join()}`; }

    function syncMap(M, w, r, v, trail, t, extra) {
        const k = M.k;
        const el = P.elements(r, v, w.mu);
        const rMax = w.radius * 40;
        // Recompute the conic a few times a second (it only changes at burns, or with Euler's drift)
        const key = `${el.a.toPrecision(7)}|${el.e.toFixed(6)}|${el.evec.map(x => x.toFixed(3)).join()}`;
        if (key !== M.lastKey || (extra && extra.force)) {
            setLine(M.orbit, P.orbitPoints(el, r, 360, rMax), k);
            M.lastKey = key;
        }
        const cp = V3(r).multiplyScalar(k);
        M.craft.position.copy(cp);
        const camD = camera.position.distanceTo(cp);
        M.craft.scale.setScalar(Math.max(0.05, camD * 0.018));
        M.craft.lookAt(cp.clone().add(V3(v)));
        setTrail(M.trail, trail, k);
        setArrow(M.velArrow, cp, V3(v), camD * 0.08, true);
        if (el.e < 1) {
            const pe = P.scale(P.norm(el.evec, P.norm(r)), el.rp * k);
            const ap = P.scale(P.norm(el.evec, P.norm(r)), -el.ra * k);
            placeLabel('pe', `Pe ${((el.rp - w.radius) / 1000).toFixed(1)} km`, V3(pe), 'es-label-pe');
            if (el.e > 0.001) placeLabel('ap', `Ap ${((el.ra - w.radius) / 1000).toFixed(1)} km`, V3(ap), 'es-label-ap');
            else hideLabel('ap');
            if (el.e <= 0.001) hideLabel('pe');
        } else { hideLabel('ap'); hideLabel('pe'); }
        return el;
    }

    function buildOrbit(sc, p, sim) {
        setSky('#02040a', '#02040a', 1, 0);
        hemi.intensity = 0.35;
        const M = buildMap(sim.w, root);
        view = { M, sc };
        if (sc.id === 'hohmann') {
            const k = M.k;
            const circ = (r) => Array.from({ length: 257 }, (_, i) => { const a = i / 256 * Math.PI * 2; return [r * Math.cos(a), 0, -r * Math.sin(a)]; });
            setLine(M.target, circ(sim.r2), k);
            setLine(M.start, circ(sim.r1), k);
            const el = P.elements(sim.o.r, P.add(sim.o.v, P.burnVector(sim.o.r, sim.o.v, sim.h.raise ? 'prograde' : 'retrograde', sim.h.dv1)), sim.w.mu);
            const pts = P.orbitPoints(el, sim.o.r, 360);
            setLine(M.ideal, sim.h.raise ? pts.slice(0, 181) : pts.slice(180), k);
            M.sat.visible = !!p.rendezvous;
        }
        const span = sc.id === 'hohmann' ? Math.max(sim.r1, sim.r2) : P.len(sim.o.r) * (p.speedPct > 110 ? 2.5 : 1.3);
        const d = Math.max(32, span * M.k * 2.6);
        tracked = null;
        resetCam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, d * 0.55, d * 0.85));
    }

    function syncOrbit(sim, tm, p, t, dt, vectors, preview) {
        const { M, sc } = view;
        syncMap(M, sim.w, sim.o.r, sim.o.v, sim.trail, t, null);
        M.velArrow.visible = vectors;
        if (sc.id === 'orbit') {
            if (preview && p.burnDv > 0) {
                const el = P.elements(preview.r, preview.v, sim.w.mu);
                const key = `${el.a.toPrecision(7)}|${el.e.toFixed(6)}`;
                if (key !== M.previewKey) { setLine(M.preview, P.orbitPoints(el, preview.r, 360, sim.w.radius * 40), M.k); M.previewKey = key; }
                const cp = V3(sim.o.r).multiplyScalar(M.k);
                setArrow(M.burnArrow, cp, V3(P.sub(preview.v, sim.o.v)), camera.position.distanceTo(cp) * 0.07, true);
            } else { M.preview.visible = false; M.burnArrow.visible = false; }
        } else {
            M.preview.visible = false;
            M.burnArrow.visible = false;
            if (p.rendezvous) {
                const tp = sc.targetPos(sim);
                M.sat.position.copy(V3(tp).multiplyScalar(M.k));
                M.sat.scale.setScalar(Math.max(0.05, camera.position.distanceTo(M.sat.position) * 0.02));
                placeLabel('sat', 'Satellite', M.sat.position, 'es-label-target');
            }
            M.ideal.visible = sim.stage !== 'final';
        }
        if (follow && tracked) tracked = M.craft.position.clone();
    }

    /* ----- Landing ----- */

    function buildLanding(sc, p, sim) {
        const L = sim.L;
        const worldId = p.world || 'kerbin';
        const env = groundEnv(worldId, 6000);
        root.add(env.group);
        const look = env.look;
        skyFor(look, 0, P.WORLDS[worldId] ? P.WORLDS[worldId].atmosphere : 0);
        hemi.intensity = look.sky ? 1.1 : 0.6;
        const pad = padModel(P.BOOSTER.padRadius, 0);
        root.add(pad);
        const ring = new THREE.Mesh(new THREE.RingGeometry(P.BOOSTER.padRadius * 0.86, P.BOOSTER.padRadius * 0.92, 64), new THREE.MeshBasicMaterial({ color: '#f2f2ee' }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        pad.add(ring);
        const cross = new THREE.Group();
        for (const rot of [0, Math.PI / 2]) {
            const bar = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ color: '#f2f2ee' }));
            bar.rotation.set(-Math.PI / 2, 0, rot);
            bar.position.y = 0.09;
            cross.add(bar);
        }
        pad.add(cross);
        const lights = [];
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false }));
            l.position.set(Math.cos(a) * P.BOOSTER.padRadius * 1.02, 0.15, Math.sin(a) * P.BOOSTER.padRadius * 1.02);
            pad.add(l);
            lights.push(l);
        }
        const booster = buildBooster(mats);
        const pivot = new THREE.Group();
        pivot.add(booster.group);
        root.add(pivot);
        booster.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
        const impact = new THREE.Mesh(new THREE.RingGeometry(1.4, 2, 32), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.85, depthWrite: false }));
        impact.rotation.x = -Math.PI / 2;
        impact.position.y = 0.12;
        root.add(impact);
        const trail = trailLine('#5ad1ff', 2000);
        root.add(trail);
        const arrows = { thrust: arrow('#ff9a3c'), weight: arrow('#b48cff'), vel: arrow('#5ee09a') };
        for (const a of Object.values(arrows)) root.add(a);
        view = { pad, booster, pivot, impact, trail, arrows, look, lights, worldId };
        tracked = new THREE.Vector3(L.pos[0], L.pos[1] + 12, L.pos[2]);
        lastTracked.copy(tracked);
        resetCam(tracked.clone(), tracked.clone().add(new THREE.Vector3(-55, 10, 85)));
    }

    function syncLanding(sim, tm, p, t, dt, vectors) {
        const L = sim.L, v = view;
        v.pad.position.set(L.cfg.tx, 0, L.cfg.tz);
        const base = V3(L.pos);
        v.booster.setLegs(L.legs);
        // Pose: flying, the body axis is the thrust direction; after touchdown, rotation about the foot
        const bg = v.booster.group, pv = v.pivot;
        if (L.tip && L.phase !== 'descent') {
            const u = V3(L.tip.u);
            const span = L.tip.span;
            pv.position.copy(base).add(u.clone().multiplyScalar(span));
            const axis = new THREE.Vector3().crossVectors(UP, u).normalize();
            pv.quaternion.setFromAxisAngle(axis, L.tip.phi);
            bg.position.copy(u.clone().multiplyScalar(-span));
            bg.quaternion.identity();
        } else {
            pv.position.copy(base);
            pv.quaternion.identity();
            bg.position.set(0, 0, 0);
            bg.quaternion.setFromUnitVectors(UP, V3(L.dir).normalize());
        }
        if (L.phase === 'crashed') {
            pv.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5);
            bg.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.userData.burnt) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.35); o.userData.burnt = true; } });
            if (dt > 0) smoke.emit([base.x, 2, base.z], [0, 1, 0], 6, 6, 2, 5);
        }
        const power = L.throttle;
        const noz = L.phase === 'descent' ? power : 0;
        for (const pl of v.booster.plumes) setPlume(pl, noz, 10 + 8 * noz, t, !v.look.sky);
        const h = Math.max(0, L.pos[1]);
        if (noz > 0.05 && h < 50 && dt > 0) {
            const n = Math.ceil(noz * 10 * (1 - h / 50) * Math.min(4, dt * 60));
            for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) smoke.emit([base.x, 0.6, base.z], d, 26 * noz * (1 - h / 60), 12, n, 3);
        }
        const imp = tm.impact;
        v.impact.visible = L.phase === 'descent' && p.pilot === 'manual' || L.phase === 'descent' && vectors;
        v.impact.position.set(imp[0], 0.12, imp[2]);
        setTrail(v.trail, sim.trail.concat(L.phase === 'descent' ? [L.pos] : []));
        const blink = Math.sin(t * 4) > 0;
        for (const l of v.lights) l.visible = blink || L.phase !== 'descent';
        const centre = base.clone().add(V3(L.dir).multiplyScalar(11));
        tracked = L.phase === 'descent' ? centre : new THREE.Vector3(base.x, 8, base.z);
        const m = tm.mass, g = L.cfg.g;
        const sc = 12 / Math.max(m * g, 1);
        setArrow(v.arrows.thrust, centre, V3(L.dir), (L.thrust || 0) * sc, vectors && L.phase === 'descent');
        setArrow(v.arrows.weight, centre, new THREE.Vector3(0, -1, 0), 12, vectors && L.phase === 'descent');
        setArrow(v.arrows.vel, centre, V3(L.vel), Math.min(40, P.len(L.vel) * 0.4), vectors && L.phase === 'descent');
        placeLabel('pad', 'Pad', new THREE.Vector3(L.cfg.tx, 2, L.cfg.tz + P.BOOSTER.padRadius + 3), 'es-label-target');
    }

    /* ----- Camera ----- */

    let camHome = { target: new THREE.Vector3(), pos: new THREE.Vector3(10, 10, 10) };
    function resetCam(target, pos) {
        camHome = { target: target.clone(), pos: pos.clone(), rel: pos.clone().sub(target) };
        controls.target.copy(target);
        camera.position.copy(pos);
        const d = pos.distanceTo(target);
        controls.minDistance = Math.max(0.5, d * 0.04);
        controls.maxDistance = d * 40;
        camera.near = Math.max(0.05, d * 0.002);
        camera.far = Math.max(4e6, d * 400);
        camera.updateProjectionMatrix();
        controls.update();
    }

    function setMap(on) {
        if (!view || !view.map) return;
        mapMode = on;
        view.map.group.visible = on;
        view.rocket.group.visible = !on;
        for (const d of view.debris) d.g.visible = !on;
        if (view.env) view.env.group.visible = !on;
        if (view.planet) view.planet.visible = !on && view.planet.visible;
        if (on) {
            view.savedCam = { target: controls.target.clone(), pos: camera.position.clone(), follow };
            view.map.group.position.set(0, 0, 0);
            setSky('#02040a', '#02040a', 1, 0);
            const d = 60;
            camera.near = 0.05;
            camera.far = 4e5;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            camera.position.set(0, d * 0.25, d);
            controls.minDistance = 11;
            controls.maxDistance = 2000;
        } else if (view.savedCam) {
            controls.target.copy(view.savedCam.target);
            camera.position.copy(view.savedCam.pos);
            resetCam(view.savedCam.target, view.savedCam.pos);
        }
        controls.update();
    }

    const api = {
        renderer, camera, controls,
        get mapMode() { return mapMode; },
        build(sc, p, sim) {
            clearRoot();
            kind = sc.view;
            mapMode = false;
            if (kind === 'stand') buildStand(p);
            else if (kind === 'flight') buildFlight(sc, p, sim);
            else if (kind === 'orbit') buildOrbit(sc, p, sim);
            else buildLanding(sc, p, sim);
            if (kind !== 'orbit') smoke.obj.visible = true;
        },
        sync(sim, tm, p, t, dt, o = {}) {
            if (!view) return;
            if (kind === 'stand') syncStand(sim, tm, p, t, dt);
            else if (kind === 'flight') syncFlight(sim, tm, p, t, dt, o.vectors);
            else if (kind === 'orbit') syncOrbit(sim, tm, p, t, dt, o.vectors, o.preview);
            else syncLanding(sim, tm, p, t, dt, o.vectors);
            smoke.update(dt);
            // Follow: move the camera with the tracked point, keeping the angle the player chose
            if (tracked && follow && !mapMode) {
                const d = tracked.clone().sub(lastTracked);
                if (d.lengthSq() > 0) {
                    controls.target.add(d);
                    camera.position.add(d);
                }
                lastTracked.copy(tracked);
                sun.position.copy(tracked).add(new THREE.Vector3(60, 90, 40));
                sun.target.position.copy(tracked);
            } else if (tracked) {
                lastTracked.copy(tracked);
            }
            if (kind !== 'orbit' && !mapMode) {
                if (!tracked) { sun.position.set(60, 90, 40); sun.target.position.set(0, 0, 0); }
                sky.position.copy(camera.position);
                stars.position.copy(camera.position);
            } else {
                sky.position.set(0, 0, 0);
                stars.position.copy(camera.position);
                sun.position.set(400, 120, 300);
                sun.target.position.set(0, 0, 0);
            }
        },
        render() {
            controls.update();
            renderer.render(scene, camera);
        },
        resize(w, h) {
            size = { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
            camera.aspect = size.w / size.h;
            camera.updateProjectionMatrix();
            applyQuality();
            for (const m of lineMats) m.resolution.set(size.w, size.h);
        },
        resetCamera() {
            if (mapMode) { setMap(true); return; }
            const target = tracked ? tracked.clone() : camHome.target.clone();
            controls.target.copy(target);
            camera.position.copy(target.clone().add(camHome.rel || camHome.pos.clone().sub(camHome.target)));
            lastTracked.copy(target);
            controls.update();
        },
        zoom(factor) {
            const off = camera.position.clone().sub(controls.target);
            const d = THREE.MathUtils.clamp(off.length() * factor, controls.minDistance, controls.maxDistance);
            camera.position.copy(controls.target).add(off.setLength(d));
            controls.update();
        },
        setFollow(on) { follow = on; if (on && tracked) lastTracked.copy(tracked); },
        get follow() { return follow; },
        hasTracking: () => !!tracked || (kind === 'orbit'),
        toggleMap() { setMap(!mapMode); return mapMode; },
        setQuality(q) { quality = q === 'low' ? 'low' : 'high'; applyQuality(); },
        cameraState: () => ({ pos: camera.position.toArray(), target: controls.target.toArray() }),
        dispose() { clearRoot(); renderer.dispose(); controls.dispose(); },
    };
    applyQuality();
    return api;
}
