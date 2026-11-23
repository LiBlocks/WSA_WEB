// The Kerbol system: the star, its worlds and moons (one procedural shader, a surface per type), air glow,
// Sarnus's rings with the shadows they and the planet cast on each other, the orbits, a co-orbital swarm of
// asteroids round Kerbin's path, and a long-period comet. Positions advance on the universe's own clock
// (ctx.clock), which stands still at zero animation intensity.
import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { SYSTEM } from './bodies.js';
import { stream } from './rng.js';

const TYPES = { rock: 0, terran: 1, desert: 2, gas: 3, ice: 4, ocean: 5, eve: 6, mint: 7 };
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

const PLANET_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const buildPlanetFrag = octaves => /* glsl */ `
#define OCTAVES ${octaves}
${NOISE}
uniform float uType;
uniform vec3 uC1, uC2, uC3;
uniform float uSeed;
uniform vec3 uSun;
uniform float uTheme;
uniform float uHover;
uniform vec4 uAtmo;
uniform float uClouds;        // cloud drift angle
uniform vec3 uCenter;
uniform float uRadius;
uniform vec4 uRing;           // inner, outer, enabled, -
uniform vec3 uRingNormal;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;

float ringDensity(float r) {
    float t = (r - uRing.x) / (uRing.y - uRing.x);
    float bands = 0.55 + 0.45 * sin(t * 61.0 + 2.0 * sin(t * 13.0));
    float gap = smoothstep(0.0, 0.015, abs(t - 0.62) - 0.035);             // a dark division
    return bands * gap * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t));
}

vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }

vec3 surface(vec3 p, out float spec) {
    spec = 0.0;
    vec3 s = p + uSeed;
    int type = int(uType + 0.5);
    if (type == 1 || type == 5) {                       // Kerbin, Laythe: oceans, land, ice, clouds
        float h = fbm3(s * 1.7);
        float landLevel = type == 5 ? 0.28 : 0.04;
        float land = smoothstep(landLevel, landLevel + 0.035, h);
        vec3 sea = mix(uC1, uC2, smoothstep(-0.35, landLevel, h));
        vec3 ground = type == 5 ? uC3 : mix(uC3, vec3(0.52, 0.46, 0.33), smoothstep(0.14, 0.36, h));
        ground = mix(ground, vec3(0.86, 0.86, 0.84), smoothstep(0.42, 0.55, h));
        vec3 col = mix(sea, ground, land);
        float ice = smoothstep(0.8, 0.88, abs(p.y) + 0.07 * fbm3(s * 4.0));
        col = mix(col, vec3(0.93, 0.96, 1.0), ice);
        spec = (1.0 - land) * (1.0 - ice);
        vec3 cp = rotY(p, uClouds);
        vec3 cs = vec3(cp.x, cp.y * 2.4, cp.z) * 2.2 + vec3(uSeed * 2.0);
        float cl = smoothstep(0.12, 0.55, fbm3(cs + 0.6 * vec3(fbm3(cp * 3.0), 0.0, fbm3(cp * 3.0 + 4.0))) + 0.18 * fbm3(cp * 11.0));
        col = mix(col, vec3(0.97, 0.98, 1.0), cl * 0.85);
        spec *= 1.0 - cl;
        return col;
    }
    if (type == 2) {                                    // Duna: rust plains, darker highlands, caps
        float h = fbm3(s * 2.3);
        vec3 col = mix(uC2, uC1, smoothstep(-0.4, 0.3, h));
        col = mix(col, uC1 * 1.18 + 0.04, smoothstep(0.25, 0.5, fbm3(s * 4.5 + 3.0)) * 0.5);
        col *= 0.78 + 0.32 * smoothstep(0.0, 0.6, 1.0 - abs(fbm3(s * 6.0)));
        float rim = (1.0 - smoothstep(0.0, 0.07, abs(snoise(s * 6.5) - 0.38)));
        col = mix(col, uC1 * 1.25, rim * 0.35);
        float cap = smoothstep(0.86, 0.92, abs(p.y) + 0.05 * fbm3(s * 5.0));
        return mix(col, uC3, cap);
    }
    if (type == 3) {                                    // gas giants: turbulent bands and a storm
        float turb = fbm3(vec3(p.x * 1.6, p.y * 5.0, p.z * 1.6) + uSeed);
        float bands = sin(p.y * 15.0 + turb * 2.8 + uSeed);
        vec3 col = mix(uC2, uC1, 0.5 + 0.5 * bands);
        col = mix(col, uC3, smoothstep(0.55, 1.0, sin(p.y * 31.0 + turb * 4.0)) * 0.45);
        vec3 so = normalize(vec3(0.75, -0.32, 0.55));
        float storm = (1.0 - smoothstep(0.0, 0.16, length((p - so) * vec3(1.0, 2.4, 1.0)) + 0.05 * turb));
        col = mix(col, uC3 * 1.05, storm * 0.8);
        return col;
    }
    if (type == 4) {                                    // ice: bright, cracked
        float n = fbm3(s * 3.0);
        float crack = (1.0 - smoothstep(0.0, 0.03, abs(snoise(s * 7.0))));
        return mix(mix(uC2, uC1, 0.55 + 0.45 * n), uC2 * 0.8, crack * 0.6);
    }
    if (type == 6) {                                    // Eve: violet with dark seas
        float h = fbm3(s * 1.9);
        vec3 col = mix(uC1, uC3, smoothstep(0.1, 0.5, h));
        col = mix(uC2 * 0.7, col, smoothstep(-0.12, -0.04, h));
        return col;
    }
    if (type == 7) {                                    // Minmus: mint, with pale flats
        float h = fbm3(s * 2.4);
        vec3 col = mix(uC2, uC1, 0.5 + 0.5 * h);
        float flat_ = (1.0 - smoothstep(-0.22, -0.18, h));
        return mix(col, uC3, flat_ * 0.9);
    }
    // rock: maria, highlands and crater rims
    float h = fbm3(s * 2.1);
    vec3 col = mix(uC2, uC1, smoothstep(-0.35, 0.3, h));
    float rim = (1.0 - smoothstep(0.0, 0.08, abs(snoise(s * 5.5) - 0.35))) + 0.6 * (1.0 - smoothstep(0.0, 0.06, abs(snoise(s * 11.0) - 0.4)));
    col = mix(col, uC3, clamp(rim, 0.0, 1.0) * 0.45);
    return col;
}

void main() {
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(uSun - vPosW);
    vec3 V = normalize(cameraPosition - vPosW);
    float spec;
    vec3 albedo = surface(normalize(vObj), spec);
    float ndl = dot(N, L);
    float day = smoothstep(-0.06, 0.32, ndl);
    // The ring's shadow on the planet
    if (uRing.z > 0.5) {
        float denom = dot(L, uRingNormal);
        if (abs(denom) > 1e-3) {
            float t = dot(uCenter - vPosW, uRingNormal) / denom;
            if (t > 0.0) {
                float r = length(vPosW + L * t - uCenter);
                if (r > uRing.x && r < uRing.y) day *= 1.0 - 0.7 * ringDensity(r);
            }
        }
    }
    float amb = mix(0.018, 0.24, uTheme);
    vec3 col = albedo * (amb + day * (1.0 - amb) * (0.75 + 0.25 * max(ndl, 0.0)));
    vec3 H = normalize(L + V);
    col += spec * pow(max(dot(N, H), 0.0), 70.0) * 0.55 * day * vec3(1.0, 0.95, 0.85);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float twilight = (1.0 - smoothstep(0.0, 0.25, abs(ndl - 0.02))) * uAtmo.a;
    col *= mix(vec3(1.0), vec3(1.15, 0.82, 0.62), twilight * 0.45 * (1.0 - uTheme));
    float forward = pow(max(dot(-V, L), 0.0), 6.0);
    col += uAtmo.rgb * fres * uAtmo.a * (smoothstep(-0.25, 0.45, ndl) * 0.9 + forward * 2.2 * smoothstep(-0.35, 0.05, ndl)) * (1.0 - 0.75 * uTheme);
    col += vec3(0.55, 0.72, 1.0) * fres * uHover * 0.9;
    gl_FragColor = vec4(col, 1.0);
}
`;

// Air glow: a slightly larger shell drawn from the inside, bright just off the limb on the sunlit side
const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec4 uAtmo;
uniform float uTheme;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 L = normalize(uSun - vPosW);
    float rim = pow(clamp(-dot(N, V), 0.0, 1.0), 2.2);
    float edge = smoothstep(0.0, 0.35, -dot(N, V));
    float lit = smoothstep(-0.35, 0.55, dot(N, L));
    // forward scattering: a backlit limb glows (the ring round a planet in front of its star)
    float forward = pow(max(dot(-V, L), 0.0), 5.0) * smoothstep(-0.5, 0.0, dot(N, L)) * 3.0;
    float a = rim * edge * (lit + forward) * uAtmo.a;
    vec3 dark = uAtmo.rgb * a * 0.95;
    gl_FragColor = vec4(mix(dark, uAtmo.rgb * 0.6 + 0.1, uTheme), mix(1.0, a * 0.35 * smoothstep(0.0, 0.25, -dot(N, V)) , uTheme));
}
`;

const STAR_FRAG = /* glsl */ `
#define OCTAVES 4
${NOISE}
uniform float uTime;
uniform float uTheme;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float mu = max(dot(N, V), 0.0);
    float g = fbm3(normalize(vObj) * 9.0 + vec3(0.0, uTime * 0.02, 0.0));
    vec3 hot = vec3(1.0, 0.98, 0.93), warm = vec3(1.0, 0.62, 0.28);
    // limb darkening: white-hot middle, orange edge; granulation kept faint
    vec3 col = mix(warm, hot, pow(mu, 0.6)) * (0.92 + 0.12 * g) * (0.62 + 0.38 * pow(mu, 0.5));
    vec3 lightCol = mix(vec3(1.0, 0.84, 0.55), vec3(0.97, 0.78, 0.45), 0.5 + 0.5 * g);
    gl_FragColor = vec4(mix(col * 1.15, lightCol, uTheme), 1.0);
}
`;

// A camera-facing glow round the star (and the comet's head): radial falloff with faint spikes
const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
uniform float uScale;
void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mv;
}
`;
const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTheme;
uniform float uStrength;
uniform float uSpikes;
void main() {
    float r = length(vUv);
    float core = exp(-r * 10.0);
    float halo = exp(-r * 4.0) * 0.3 + 0.05 * exp(-r * 2.0);
    float spikes = uSpikes * (exp(-abs(vUv.x) * 70.0) * exp(-abs(vUv.y) * 4.0) + exp(-abs(vUv.y) * 70.0) * exp(-abs(vUv.x) * 4.0)) * 0.2;
    float i = (core + halo + spikes) * (1.0 - smoothstep(0.75, 1.0, r)) * uStrength;
    vec3 dark = uColor * i;
    gl_FragColor = vec4(mix(dark, uColor * 0.9, uTheme), mix(1.0, clamp(i * 0.55, 0.0, 1.0), uTheme));
}
`;

const RING_FRAG = /* glsl */ `
uniform vec4 uRing;
uniform vec3 uSun;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uTheme;
uniform vec3 uC1, uC2;
varying vec3 vPosW;
float ringDensity(float r) {
    float t = (r - uRing.x) / (uRing.y - uRing.x);
    float bands = 0.55 + 0.45 * sin(t * 61.0 + 2.0 * sin(t * 13.0));
    float gap = smoothstep(0.0, 0.015, abs(t - 0.62) - 0.035);
    return bands * gap * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t));
}
void main() {
    float r = length(vPosW - uCenter);
    if (r < uRing.x || r > uRing.y) discard;
    float d = ringDensity(r);
    // The planet's shadow across the rings
    vec3 L = normalize(uSun - vPosW);
    vec3 oc = vPosW - uCenter;
    float b = dot(oc, L);
    float c = dot(oc, oc) - uRadius * uRadius;
    float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.12 : 1.0;
    float t = (r - uRing.x) / (uRing.y - uRing.x);
    vec3 col = mix(uC2, uC1, 0.5 + 0.5 * sin(t * 23.0)) * mix(0.04, 1.0, shadow);
    float a = d * 0.82;
    gl_FragColor = vec4(mix(col, mix(col, vec3(0.3, 0.27, 0.22), 0.25), uTheme) * mix(1.0, 0.95, uTheme), a);
}
`;

const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

const ROCK_VERT = /* glsl */ `
attribute float aSpin;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vObj;
varying float vTone;
mat3 tumble(float a, vec3 axis) {
    float c = cos(a), s = sin(a), t = 1.0 - c;
    return mat3(t * axis.x * axis.x + c, t * axis.x * axis.y + s * axis.z, t * axis.x * axis.z - s * axis.y,
                t * axis.x * axis.y - s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z + s * axis.x,
                t * axis.x * axis.z + s * axis.y, t * axis.y * axis.z - s * axis.x, t * axis.z * axis.z + c);
}
void main() {
    vec3 axis = normalize(vec3(sin(aSpin * 7.0), cos(aSpin * 3.0), sin(aSpin * 5.0) + 0.3));
    mat3 rot = tumble(uTime * (0.2 + aSpin) , axis);
    vec4 w = modelMatrix * instanceMatrix * vec4(rot * position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * (rot * normal));
    // The surface pattern is fixed to the rock (it tumbles with it) and different on every rock
    vObj = position * 1.7 + vec3(aSpin * 31.0, aSpin * 17.0, aSpin * 23.0);
    vTone = 0.78 + 0.44 * fract(aSpin * 7.31);
    gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Asteroids: dusty grey-brown rock, mottled, with a few crater rims and a darker regolith in the hollows; lit by
// the star with a little light from the sky so the night side still reads as a shape
const ROCK_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uTheme;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vObj;
varying float vTone;
#define OCTAVES 2
${NOISE}
void main() {
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(uSun - vPosW);
    float d = max(dot(N, L), 0.0);
    float mottle = snoise(vObj * 1.6) * 0.6 + snoise(vObj * 4.3) * 0.3;
    float rim = 1.0 - smoothstep(0.0, 0.1, abs(snoise(vObj * 2.7 + 4.0) - 0.32));
    vec3 dark = mix(vec3(0.3, 0.27, 0.24), vec3(0.6, 0.61, 0.65), uTheme);
    vec3 light = mix(vec3(0.62, 0.56, 0.5), vec3(0.8, 0.81, 0.84), uTheme);
    vec3 base = mix(dark, light, clamp(0.5 + 0.5 * mottle, 0.0, 1.0)) * vTone;
    base = mix(base, light * 1.12, rim * 0.35);
    float amb = mix(0.06, 0.62, uTheme);
    gl_FragColor = vec4(base * (amb + d * (1.0 - amb)), 1.0);
}
`;

// Comet tail: particles streaming away from the star, an ion tail (straight, blue) and a dust tail
// (curved, cream). Moved entirely on the GPU from the head's position.
const TAIL_VERT = /* glsl */ `
attribute vec4 aSeed;   // x: offset along the tail, y,z: spread, w: 0 ion / 1 dust
uniform float uTime;
uniform vec3 uHead;
uniform vec3 uAway;
uniform vec3 uBack;
uniform float uLength;
uniform float uPixelRatio;
uniform float uTheme;
varying float vA;
varying float vDust;
void main() {
    float u = fract(aSeed.x + uTime * (0.09 + 0.05 * aSeed.w));
    vec3 side = normalize(cross(uAway, vec3(0.0, 1.0, 0.0)) + 1e-4);
    vec3 up = normalize(cross(side, uAway));
    float len = uLength * (aSeed.w > 0.5 ? 0.8 : 1.15);
    vec3 dir = normalize(uAway + aSeed.w * u * 0.55 * uBack);
    float spread = (0.04 + u * (aSeed.w > 0.5 ? 0.42 : 0.12)) * len * 0.25;
    vec3 p = uHead + dir * u * len + (side * aSeed.y + up * aSeed.z) * spread;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (1.0 - u) * (1.0 - u) * mix(0.9, 0.55, aSeed.w);
    vDust = aSeed.w;
    gl_PointSize = clamp(uPixelRatio * (3.0 + 6.0 * (1.0 - u)) * 14.0 / -mv.z, 1.0, 14.0 * uPixelRatio);
}
`;
const TAIL_FRAG = /* glsl */ `
uniform float uTheme;
varying float vA;
varying float vDust;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float i = exp(-r2 * 3.0) * vA;
    vec3 col = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 0.92, 0.78), vDust);
    gl_FragColor = vec4(mix(col * i * 0.6, mix(vec3(0.25, 0.35, 0.5), vec3(0.5, 0.42, 0.3), vDust), uTheme), mix(1.0, i * 0.35, uTheme));
}
`;

const color = hex => new THREE.Color(hex);

export function createSystem(ctx) {
    const octaves = ctx.quality === 'low' ? 3 : ctx.quality === 'ultra' ? 6 : 5;
    const group = new THREE.Group();
    group.name = 'kerbol-system';
    const sphere = new THREE.SphereGeometry(1, ctx.quality === 'low' ? 40 : 72, ctx.quality === 'low' ? 28 : 48);
    const owned = [sphere];
    const bodies = new Map();
    const pickables = [];
    const planetFrag = buildPlanetFrag(octaves);

    for (const def of SYSTEM) {
        const b = { def, id: def.id, pos: new THREE.Vector3(), radius: def.r, hover: 0, hoverTarget: 0, children: [] };
        const pivot = new THREE.Group();          // position in the system
        const body = new THREE.Group();           // tilt and spin
        pivot.add(body);
        group.add(pivot);
        b.pivot = pivot;
        b.spinner = body;
        if (def.type === 'star') {
            const mat = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uTheme: { value: 0 } } });
            const mesh = new THREE.Mesh(sphere, mat);
            mesh.scale.setScalar(def.r);
            body.add(mesh);
            b.mesh = mesh;
            b.material = mat;
            owned.push(mat);
            // Corona and wide glow, drawn after everything else
            const glowMat = new THREE.ShaderMaterial({
                vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { uColor: { value: color('#ffd9a0') }, uTheme: { value: 0 }, uStrength: { value: 1.15 }, uScale: { value: 9 }, uSpikes: { value: 1 } },
            });
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
            glow.frustumCulled = false;
            glow.renderOrder = 20;
            pivot.add(glow);
            b.glow = glow;
            owned.push(glow.geometry, glowMat);
        } else {
            const atmo = def.atmo || [0, 0, 0, 0];
            const uniforms = {
                uType: { value: TYPES[def.type] }, uC1: { value: color(def.c1) }, uC2: { value: color(def.c2) }, uC3: { value: color(def.c3) },
                uSeed: { value: stream('seed:' + def.id)() * 50 }, uSun: { value: new THREE.Vector3() }, uTheme: { value: 0 },
                uHover: { value: 0 }, uAtmo: { value: new THREE.Vector4(...atmo) }, uClouds: { value: 0 },
                uCenter: { value: b.pos }, uRadius: { value: def.r },
                uRing: { value: new THREE.Vector4(def.ring ? def.ring.inner : 0, def.ring ? def.ring.outer : 0, def.ring ? 1 : 0, 0) },
                uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
            };
            const mat = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: planetFrag, uniforms });
            const mesh = new THREE.Mesh(sphere, mat);
            mesh.scale.setScalar(def.r);
            body.add(mesh);
            b.mesh = mesh;
            b.material = mat;
            owned.push(mat);
            if (def.atmo) {
                const amat = new THREE.ShaderMaterial({
                    vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    uniforms: { uSun: uniforms.uSun, uAtmo: uniforms.uAtmo, uTheme: { value: 0 } },
                });
                const shell = new THREE.Mesh(sphere, amat);
                shell.scale.setScalar(def.r * (def.type === 'gas' ? 1.06 : 1.11));
                pivot.add(shell);
                b.atmo = amat;
                owned.push(amat);
            }
            if (def.ring) {
                const tilt = def.ring.tilt * DEG;
                body.rotation.order = 'ZYX';         // spin about the tilted axis
                body.rotation.z = tilt;
                const rgeo = new THREE.RingGeometry(def.ring.inner, def.ring.outer, 160, 1);
                const rmat = new THREE.ShaderMaterial({
                    vertexShader: PLANET_VERT, fragmentShader: RING_FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false,
                    uniforms: {
                        uRing: uniforms.uRing, uSun: uniforms.uSun, uCenter: { value: b.pos }, uRadius: { value: def.r }, uTheme: { value: 0 },
                        uC1: { value: color('#e9d6aa') }, uC2: { value: color('#9a8360') },
                    },
                });
                const ring = new THREE.Mesh(rgeo, rmat);
                ring.rotation.x = -Math.PI / 2;
                const ringHolder = new THREE.Group();
                ringHolder.rotation.z = tilt;
                ringHolder.add(ring);
                pivot.add(ringHolder);
                uniforms.uRingNormal.value.set(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
                b.ring = rmat;
                owned.push(rgeo, rmat);
            }
            mesh.userData.bodyId = def.id;
            pickables.push(mesh);
        }
        bodies.set(def.id, b);
    }
    for (const b of bodies.values()) if (b.def.parent) bodies.get(b.def.parent).children.push(b);

    // Orbits: one line per world, faint; brighter for the one pointed at
    const orbitLines = [];
    for (const b of bodies.values()) {
        const d = b.def;
        if (!d.parent) continue;
        const pts = [];
        for (let i = 0; i <= 256; i++) {
            const th = (i / 256) * Math.PI * 2;
            pts.push(orbitPoint(d, th, new THREE.Vector3()));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const moon = d.parent !== 'kerbol';
        const mat = new THREE.ShaderMaterial({
            vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: ORBIT_FRAG, transparent: true, depthWrite: false,
            uniforms: { uColor: { value: color('#efe6d2') }, uOpacity: { value: 0 } },
        });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        line.renderOrder = 2;
        const holder = moon ? bodies.get(d.parent).pivot : group;
        holder.add(line);
        orbitLines.push({ body: b, line, mat, moon });
        owned.push(geo, mat);
    }

    // Kerbin's co-orbital swarm (the kind of asteroid WSA's Project Kepler went after) and a sparse field
    const R = stream('asteroids');
    const rockCount = ctx.quality === 'low' ? 220 : ctx.quality === 'ultra' ? 900 : 520;
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    {
        const pos = rockGeo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const k = 0.75 + 0.5 * R();
            pos.setXYZ(i, v.x * k, v.y * (0.7 + 0.3 * R()), v.z * k);
        }
        rockGeo.computeVertexNormals();
    }
    const spins = new Float32Array(rockCount);
    const rockMat = new THREE.ShaderMaterial({
        vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
        uniforms: { uSun: { value: new THREE.Vector3() }, uTheme: { value: 0 }, uTime: { value: 0 } },
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const kerbin = SYSTEM.find(x => x.id === 'kerbin');
    for (let i = 0; i < rockCount; i++) {
        const swarm = i < rockCount * 0.6;
        // Swarm: Kerbin's trojans, 60 degrees ahead of and behind it; field: a broad loose ring further out
        const lon = swarm ? ((R() < 0.5 ? 60 : -60) + R.normal() * 16) * DEG : R() * Math.PI * 2;
        const a = swarm ? kerbin.a + R.normal() * 1.6 : R.range(20.5, 25);
        const y = R.normal() * (swarm ? 0.5 : 0.9);
        p.set(Math.cos(lon) * a, y, Math.sin(lon) * a);
        const s = 0.01 + 0.045 * Math.pow(R(), 4);
        sc.set(s, s, s);
        q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
        m.compose(p, q, sc);
        rocks.setMatrixAt(i, m);
        spins[i] = R();
    }
    rockGeo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spins, 1));
    const rockHolder = new THREE.Group();        // turns with Kerbin, so the swarm keeps its place
    rockHolder.add(rocks);
    group.add(rockHolder);
    owned.push(rockGeo, rockMat);

    // A long-period comet on an eccentric orbit, tilted to the planets
    const tailCount = ctx.quality === 'low' ? 260 : 700;
    const tailGeo = new THREE.BufferGeometry();
    const tailSeed = new Float32Array(tailCount * 4);
    const RC = stream('comet');
    for (let i = 0; i < tailCount; i++) {
        tailSeed[i * 4] = RC();
        tailSeed[i * 4 + 1] = RC.normal();
        tailSeed[i * 4 + 2] = RC.normal();
        tailSeed[i * 4 + 3] = i < tailCount * 0.45 ? 0 : 1;
    }
    tailGeo.setAttribute('aSeed', new THREE.BufferAttribute(tailSeed, 4));
    tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tailCount * 3), 3));
    const tailMat = new THREE.ShaderMaterial({
        vertexShader: TAIL_VERT, fragmentShader: TAIL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 }, uHead: { value: new THREE.Vector3() }, uAway: { value: new THREE.Vector3(1, 0, 0) },
            uBack: { value: new THREE.Vector3() }, uLength: { value: 6 }, uPixelRatio: { value: ctx.pixelRatio }, uTheme: { value: 0 },
        },
    });
    const tail = new THREE.Points(tailGeo, tailMat);
    tail.frustumCulled = false;
    const cometGlowMat = new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: color('#cfe4ff') }, uTheme: { value: 0 }, uStrength: { value: 0.9 }, uScale: { value: 0.9 }, uSpikes: { value: 0 } },
    });
    const cometHead = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cometGlowMat);
    cometHead.frustumCulled = false;
    const comet = { tail, head: cometHead, mat: tailMat, glow: cometGlowMat, pos: new THREE.Vector3(), period: 520, phase: 0.72 };
    group.add(tail, cometHead);
    owned.push(tailGeo, tailMat, cometHead.geometry, cometGlowMat);
    // A pick proxy for the comet's head (it has no mesh of its own)
    const cometProxy = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    cometProxy.userData.bodyId = 'comet';
    group.add(cometProxy);
    pickables.push(cometProxy);
    owned.push(cometProxy.geometry, cometProxy.material);

    const sun = bodies.get('kerbol');
    const tmp = new THREE.Vector3();

    function place(clock) {
        sun.pos.set(0, 0, 0);
        for (const b of bodies.values()) {
            const d = b.def;
            if (!d.parent) continue;
            const parent = bodies.get(d.parent);
            const th = (d.phase * DEG) + (clock / d.period) * Math.PI * 2;
            orbitPoint(d, th, tmp);
            b.pos.copy(parent.pos).add(tmp);
        }
        for (const b of bodies.values()) {
            b.pivot.position.copy(b.pos);
            b.spinner.rotation.y = (clock / (b.def.spin || 100)) * Math.PI * 2;
        }
        // The swarm turns with Kerbin
        const k = bodies.get('kerbin').def;
        rockHolder.rotation.y = -((k.phase * DEG) + (clock / k.period) * Math.PI * 2);
        // The comet: an ellipse, quick near the star (a simple eccentric anomaly stand-in)
        const M = ((clock / comet.period + comet.phase) % 1) * Math.PI * 2;
        const e = 0.82, A = 60;
        let E = M;
        for (let i = 0; i < 5; i++) E = M + e * Math.sin(E);
        const x = A * (Math.cos(E) - e), z = A * Math.sqrt(1 - e * e) * Math.sin(E);
        comet.pos.set(x, 0, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.5).applyAxisAngle(UP, 2.2);
    }

    return {
        object: group,
        bodies,
        pickables,
        comet,
        sun,
        place,
        orbitLines,
        update(ctx2) {
            place(ctx2.clock);
            const theme = ctx2.themeMix;
            const blending = theme > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
            for (const b of bodies.values()) {
                b.hover += (b.hoverTarget - b.hover) * Math.min(1, ctx2.dt * 8);
                const u = b.material.uniforms;
                u.uTheme.value = theme;
                if (u.uSun) u.uSun.value.copy(sun.pos);
                if (u.uHover) u.uHover.value = b.hover + ctx2.mood.vehicles * 0.25;
                if (u.uClouds) u.uClouds.value = ctx2.clock * 0.004;
                if (u.uTime) u.uTime.value = ctx2.clock;
                if (b.atmo) { b.atmo.uniforms.uTheme.value = theme; setBlend(b.atmo, blending); }
                if (b.ring) b.ring.uniforms.uTheme.value = theme;
            }
            const g = sun.glow.material;
            g.uniforms.uTheme.value = theme;
            g.uniforms.uScale.value = 9 * (1 + 0.04 * Math.sin(ctx2.time * 0.6));
            setBlend(g, blending);
            for (const o of orbitLines) {
                const base = (o.moon ? 0.08 : 0.11) * ctx2.orbitShow;
                const lit = o.body.hover * 0.45 + ctx2.mood.missions * 0.12 + ctx2.mood.engineering * 0.1 + ctx2.mood.vehicles * 0.12;
                o.mat.uniforms.uOpacity.value = (base + lit) * ctx2.orbitFade * (theme > 0.5 ? 1.5 : 1);
                o.mat.uniforms.uColor.value.set(theme > 0.5 ? '#18202f' : '#efe6d2');
            }
            rockMat.uniforms.uSun.value.copy(sun.pos);
            rockMat.uniforms.uTheme.value = theme;
            rockMat.uniforms.uTime.value = ctx2.clock * 0.05;
            // Comet
            comet.head.position.copy(comet.pos);
            cometProxy.position.copy(comet.pos);
            const dist = comet.pos.length();
            const away = tmp.copy(comet.pos).normalize();
            tailMat.uniforms.uHead.value.copy(comet.pos);
            tailMat.uniforms.uAway.value.copy(away);
            tailMat.uniforms.uLength.value = THREE.MathUtils.clamp(140 / (dist + 6), 1.2, 9);
            tailMat.uniforms.uTime.value = ctx2.time * (0.3 + 0.7 * ctx2.intensity);
            tailMat.uniforms.uTheme.value = theme;
            tailMat.uniforms.uPixelRatio.value = ctx2.pixelRatio;
            setBlend(tailMat, blending);
            cometGlowMat.uniforms.uTheme.value = theme;
            cometGlowMat.uniforms.uScale.value = 0.45 + 2.5 / Math.sqrt(dist + 1);
            cometProxy.scale.setScalar(Math.max(0.6, cometGlowMat.uniforms.uScale.value));
            setBlend(cometGlowMat, blending);
        },
        dispose() {
            owned.forEach(o => o.dispose());
        },
    };
}

function setBlend(mat, blending) {
    if (mat.blending !== blending) {
        mat.blending = blending;
        mat.needsUpdate = true;
    }
}

// A point on a circular orbit, inclined `inc` about the line of nodes at `node`
export function orbitPoint(d, th, out) {
    out.set(Math.cos(th) * d.a, 0, Math.sin(th) * d.a);
    if (d.inc) {
        out.applyAxisAngle(new THREE.Vector3(Math.cos(d.node * DEG), 0, Math.sin(d.node * DEG)), d.inc * DEG);
    }
    return out;
}
