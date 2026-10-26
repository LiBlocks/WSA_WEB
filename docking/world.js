// Docking Simulator 3D world: a procedural ISS-inspired station, the player's spacecraft, stars and a
// distant Earth, drawn with three.js. Distances are metres in the docking frame used by physics.js:
// the active docking port is at the origin facing +Z, and the station extends toward -Z.
import * as THREE from '../vendor/three/three.module.js';

const SUN = new THREE.Vector3(0.35, 0.55, 0.76).normalize();   // direction toward the sun
const HULL_R = 2.2;                                              // pressurised module radius

/* ---------- Procedural textures ---------- */

function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(...repeat);
    }
    return t;
}

// Seeded so the station looks the same on every visit
function rng(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Quilted thermal blanket on the pressurised modules
const quiltTexture = () => canvasTexture(256, 256, (g, w, h) => {
    const rand = rng(7);
    g.fillStyle = '#eceae4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '160,155,140'},${0.05 + rand() * 0.06})`;
        g.fillRect(rand() * w, rand() * h, 2 + rand() * 10, 2 + rand() * 10);
    }
    g.strokeStyle = 'rgba(120,115,100,0.35)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});

// Solar cells: dark blue panels in a grid, with the blanket's fold lines
const cellTexture = () => canvasTexture(128, 512, (g, w, h) => {
    const rand = rng(11);
    g.fillStyle = '#060c1c';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
        for (let x = 0; x < w; x += 16) {
            const l = 18 + rand() * 8;
            g.fillStyle = `hsl(224, 62%, ${l}%)`;
            g.fillRect(x + 1, y + 1, 14, 14);
        }
    }
    g.fillStyle = 'rgba(190,200,230,0.25)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
    g.fillStyle = '#b98b3a';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
});

const radiatorTexture = () => canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#f3f4f2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(110,120,130,0.35)';
    for (let y = 4; y < h; y += 8) g.fillRect(0, y, w, 1.5);
});

// A soft round sprite for thruster puffs
const puffTexture = () => {
    const t = canvasTexture(64, 64, (g, w) => {
        const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        r.addColorStop(0, 'rgba(255,255,255,1)');
        r.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, w, w);
    });
    return t;
};

// The environment that metal parts reflect: black sky above, the blue Earth below, the sun's glint
const environmentTexture = () => {
    const t = canvasTexture(256, 128, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#020308');
        grad.addColorStop(0.5, '#06080f');
        grad.addColorStop(0.62, '#2a4f86');
        grad.addColorStop(1, '#3a6aa6');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
        const sun = g.createRadialGradient(w * 0.55, h * 0.2, 0, w * 0.55, h * 0.2, 18);
        sun.addColorStop(0, 'rgba(255,250,235,1)');
        sun.addColorStop(1, 'rgba(255,250,235,0)');
        g.fillStyle = sun;
        g.fillRect(0, 0, w, h);
    });
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
};

/* ---------- Geometry helpers ---------- */

// A cylinder of radius r and length len along an axis ('x', 'y' or 'z'), centred at c
function cylinder(r1, r2, len, axis, c, mat, seg = 40, open = false) {
    const geo = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
    if (axis === 'z') geo.rotateX(Math.PI / 2);
    if (axis === 'x') geo.rotateZ(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...c);
    return m;
}

function box(size, c, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...c);
    return m;
}

// A ring facing along an axis
function ring(r, tube, axis, c, mat) {
    const geo = new THREE.TorusGeometry(r, tube, 10, 48);
    if (axis === 'x') geo.rotateY(Math.PI / 2);
    if (axis === 'y') geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...c);
    return m;
}

// Thin members placed between two points, drawn as one instanced mesh
class Members {
    constructor(mat, thickness) {
        this.mat = mat;
        this.t = thickness;
        this.list = [];
    }
    add(a, b) { this.list.push([new THREE.Vector3(...a), new THREE.Vector3(...b)]); }
    mesh() {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mat, this.list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        this.list.forEach(([a, b], i) => {
            const d = b.clone().sub(a);
            q.setFromUnitVectors(up, d.clone().normalize());
            s.set(this.t, d.length(), this.t);
            m.compose(a.clone().add(b).multiplyScalar(0.5), q, s);
            mesh.setMatrixAt(i, m);
        });
        return mesh;
    }
}

/* ---------- Station ---------- */

function buildStation(mats) {
    const station = new THREE.Group();
    const colliders = [];
    const solid = (mesh, name) => { mesh.userData.collider = name; station.add(mesh); return mesh; };
    const quilt = mats.quilt;

    // A pressurised module along an axis: hull, end bulkheads, reinforcing rings
    function pressurised(axis, from, to, at, name, r = HULL_R) {
        const len = Math.abs(to - from), mid = (from + to) / 2;
        const c = axis === 'z' ? [at[0], at[1], mid] : axis === 'x' ? [mid, at[1], at[2]] : [at[0], mid, at[2]];
        const mat = quilt.clone();
        mat.map = mats.quiltMap.clone();
        mat.map.repeat.set(6, Math.max(1, len / 2.4));
        mat.map.needsUpdate = true;
        const hull = solid(cylinder(r, r, len - 0.5, axis, c, mat), name);
        const sign = to > from ? 1 : -1;
        for (const end of [from + 0.25 * sign, to - 0.25 * sign]) {
            const e = axis === 'z' ? [at[0], at[1], end] : axis === 'x' ? [end, at[1], at[2]] : [at[0], end, at[2]];
            station.add(cylinder(r * 0.86, r * 0.86, 0.5, axis, e, mats.metal));
        }
        for (let k = 1; k < Math.floor(len / 2.6); k++) {
            const p = from + sign * (len * k / Math.floor(len / 2.6));
            const e = axis === 'z' ? [at[0], at[1], p] : axis === 'x' ? [p, at[1], at[2]] : [at[0], p, at[2]];
            station.add(ring(r + 0.02, 0.05, axis, e, mats.metal));
        }
        return hull;
    }

    // A docking port on a module face: adapter cone, docking ring and marker lights
    function port(axis, dir, base, active) {
        const g = new THREE.Group();
        const len = 1.6;
        // Open at the docking face, so the hatch and target inside are visible
        const adapter = cylinder(0.95, 1.35, len, 'y', [0, len / 2, 0], mats.adapter, 40, true);
        g.add(adapter);
        g.add(ring(0.95, 0.1, 'y', [0, len - 0.05, 0], mats.dark));
        const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), mats.hatch);
        hatch.rotation.x = -Math.PI / 2;
        hatch.position.y = len - 0.3;
        g.add(hatch);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            g.add(box([0.1, 0.12, 0.1], [Math.cos(a) * 0.95, len - 0.02, Math.sin(a) * 0.95], mats.metal));
        }
        const lightMat = active ? mats.green : mats.portLight;
        for (let i = 0; i < 4; i++) {
            const a = (i + 0.5) / 4 * Math.PI * 2;
            g.add(box([0.12, 0.06, 0.12], [Math.cos(a) * 1.12, len - 0.08, Math.sin(a) * 1.12], lightMat));
        }
        if (active) {
            // Centreline docking target: a cross on a standoff in front of a dark backplate
            const plate = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), mats.dark);
            plate.rotation.x = -Math.PI / 2;
            plate.position.y = len - 0.29;
            g.add(plate);
            const rim = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 32), mats.targetWhite);
            rim.rotation.x = -Math.PI / 2;
            rim.position.y = len - 0.285;
            g.add(rim);
            g.add(cylinder(0.02, 0.02, 0.2, 'y', [0, len - 0.19, 0], mats.targetWhite, 8));
            g.add(box([0.3, 0.03, 0.035], [0, len - 0.09, 0], mats.targetWhite));
            g.add(box([0.035, 0.03, 0.3], [0, len - 0.09, 0], mats.targetWhite));
        }
        // Point the port's +Y along the requested direction
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir));
        g.position.set(...base);
        g.updateMatrixWorld();
        station.add(g);
        adapter.userData.collider = active ? 'the docking adapter' : 'a docking port';
        return g;
    }

    // Handrails along a module, as one instanced mesh per module
    function handrails(axis, from, to, at, r, count = 3) {
        const rails = new Members(mats.rail, 0.05);
        const len = Math.abs(to - from), sign = to > from ? 1 : -1;
        for (let k = 0; k < count; k++) {
            const a = (k + 0.3) / count * Math.PI * 2;
            const off = [Math.cos(a) * (r + 0.12), Math.sin(a) * (r + 0.12)];
            const p = s => (axis === 'z' ? [at[0] + off[0], at[1] + off[1], s] : [s, at[1] + off[0], at[2] + off[1]]);
            rails.add(p(from + sign * 0.8), p(to - sign * 0.8));
        }
        station.add(rails.mesh());
    }

    /* Pressurised stack, front to back along -Z */
    // Forward node with the active port in front
    solid(cylinder(1.4, HULL_R, 0.6, 'z', [0, 0, -1.9], mats.white), 'the forward node');
    pressurised('z', -2.2, -8.6, [0, 0], 'the forward node');
    port('z', [0, 0, 1], [0, 0, -1.6], true);
    // Other docking locations on the forward node: zenith (free) and nadir (a visiting cargo craft)
    port('y', [0, 1, 0], [0, HULL_R - 0.1, -5.4], false);
    port('y', [0, -1, 0], [0, -HULL_R + 0.1, -5.4], false);
    const cargo = new THREE.Group();
    cargo.add(cylinder(1.6, 1.6, 5.4, 'y', [0, -6.6, -5.4], mats.white));
    cargo.add(cylinder(1.62, 1.62, 1.2, 'y', [0, -9.4, -5.4], mats.gold));
    cargo.add(box([5.6, 0.08, 1.8], [-4.4, -8.2, -5.4], mats.cells));
    cargo.add(box([5.6, 0.08, 1.8], [4.4, -8.2, -5.4], mats.cells));
    cargo.children.forEach(m => { m.userData.collider = 'the visiting cargo craft'; });
    station.add(cargo);
    // Side laboratories on the forward node
    pressurised('x', -HULL_R, -9.2, [0, 0, -5.4], 'the port-side laboratory');
    pressurised('x', HULL_R, 13.6, [0, 0, -5.4], 'the starboard laboratory');
    solid(box([5, 0.6, 4.2], [16.3, -0.6, -5.4], mats.metal), 'the exposed experiment platform');
    for (const x of [14.6, 16.2, 17.8]) station.add(box([1.2, 0.9, 1.1], [x, 0.15, -4.4 - (x % 2)], mats.gold));
    handrails('x', HULL_R, 13.6, [0, 0, -5.4], HULL_R);
    // Main laboratory, with a robotic arm folded along its top
    pressurised('z', -8.6, -17.1, [0, 0], 'the main laboratory');
    handrails('z', -2.2, -17.1, [0, 0], HULL_R, 4);
    const arm = new Members(mats.armWhite, 0.32);
    arm.add([0, 2.6, -15.5], [3.2, 5.4, -10.5]);
    arm.add([3.2, 5.4, -10.5], [1.6, 3.4, -4.6]);
    station.add(arm.mesh());
    for (const p of [[0, 2.6, -15.5], [3.2, 5.4, -10.5], [1.6, 3.4, -4.6]]) station.add(cylinder(0.32, 0.32, 0.5, 'x', p, mats.metal, 16));
    solid(box([0.9, 0.5, 0.9], [0, 2.35, -15.5], mats.metal), 'the robotic arm');
    // Aft node carrying the truss on a short mast, and a module to the side
    pressurised('z', -17.1, -22.6, [0, 0], 'the aft node');
    pressurised('x', -HULL_R, -8.9, [0, 0, -19.85], 'the side module');
    solid(box([2.4, 3.6, 2.4], [0, 3.9, -19.85], mats.metal), 'the truss mast');
    // Older segment: a control module and a service module, each with its own small solar wings
    pressurised('z', -22.6, -35, [0, 0], 'the control module', 2.05);
    pressurised('z', -35, -38, [0, 0], 'the service module', 1.5);
    pressurised('z', -38, -48, [0, 0], 'the service module', 2.1);
    for (const [z, span, w] of [[-27.5, 10.6, 3.4], [-44.5, 14, 3.4]]) {
        for (const s of [-1, 1]) {
            const x = s * (2.3 + span / 2);
            solid(box([span, 0.08, w], [x, 0, z], mats.cells), 'a solar array');
            station.add(cylinder(0.08, 0.08, span, 'x', [x, 0.1, z], mats.metal, 8));
        }
    }
    // A crew capsule docked at the far end
    station.add(cylinder(0.75, 0.75, 1, 'z', [0, 0, -48.4], mats.metal));
    const capsule = [
        cylinder(1.1, 1.1, 2.2, 'z', [0, 0, -50], mats.olive),
        cylinder(0.7, 1.15, 1.8, 'z', [0, 0, -52], mats.olive),
        cylinder(1.15, 1.15, 2.2, 'z', [0, 0, -54], mats.metal),
        box([9, 0.06, 1.2], [0, 0, -54], mats.cells),
    ];
    capsule.forEach(m => solid(m, 'the docked crew capsule'));

    /* Truss, solar arrays and radiators */
    const T = { y: 7.6, z: -19.85, half: 1.7, from: -55, to: 55 };
    const truss = new Members(mats.truss, 0.16);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const at = (x, [cy, cz]) => [x, T.y + cy * T.half, T.z + cz * T.half];
    const bays = 32;
    for (let i = 0; i <= bays; i++) {
        const x = T.from + (T.to - T.from) * i / bays;
        corners.forEach((c, k) => truss.add(at(x, c), at(x, corners[(k + 1) % 4])));
        if (i < bays) {
            const x2 = T.from + (T.to - T.from) * (i + 1) / bays;
            corners.forEach((c, k) => {
                truss.add(at(x, c), at(x2, c));
                truss.add(at(i % 2 ? x : x2, c), at(i % 2 ? x2 : x, corners[(k + 1) % 4]));
            });
        }
    }
    station.add(truss.mesh());
    colliders.push({ name: 'the main truss', min: [T.from - 0.3, T.y - T.half - 0.3, T.z - T.half - 0.3], max: [T.to + 0.3, T.y + T.half + 0.3, T.z + T.half + 0.3] });
    station.add(box([6, 3, 3], [0, T.y, T.z], mats.metal));
    for (const x of [-4, 4]) station.add(box([1.6, 1.2, 1.6], [x, T.y + 2.3, T.z], mats.gold));
    for (const s of [-1, 1]) station.add(cylinder(2.1, 2.1, 1.4, 'x', [s * 27, T.y, T.z], mats.metal));

    // Main solar arrays: two wing pairs at each end of the truss, one wing up and one down
    for (const x0 of [-46.5, -33.5, 33.5, 46.5]) {
        for (const up of [1, -1]) {
            const y0 = T.y + up * (T.half + 0.6), y1 = y0 + up * 32;
            for (const s of [-1, 1]) {
                const blanket = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 32), mats.cells);
                blanket.position.set(x0 + s * 3.1, (y0 + y1) / 2, T.z + 0.03);
                station.add(blanket);
                const back = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 32), mats.cellBack);
                back.rotation.y = Math.PI;
                back.position.set(x0 + s * 3.1, (y0 + y1) / 2, T.z - 0.03);
                station.add(back);
            }
            station.add(cylinder(0.12, 0.12, 32, 'y', [x0, (y0 + y1) / 2, T.z], mats.metal, 8));
            station.add(box([11, 0.5, 0.45], [x0, y1, T.z], mats.gold));
            station.add(box([11, 0.5, 0.45], [x0, y0, T.z], mats.gold));
            colliders.push({ name: 'a solar array', min: [x0 - 5.6, Math.min(y0, y1), T.z - 0.35], max: [x0 + 5.6, Math.max(y0, y1), T.z + 0.35] });
        }
    }

    // Thermal control: radiator wings hanging below the truss, sloping back
    for (const s of [-1, 1]) {
        const g = new THREE.Group();
        for (let k = 0; k < 4; k++) {
            g.add(box([3.4, 0.1, 3.2], [0, 0, -(k * 3.35 + 1.8)], mats.radiator));
            if (k) g.add(box([0.3, 0.16, 0.2], [0, 0, -(k * 3.35 + 0.12)], mats.metal));
        }
        g.add(cylinder(0.1, 0.1, 2, 'z', [0, 0, 0.6], mats.metal, 8));
        g.position.set(s * 14, T.y - T.half - 0.2, T.z - 1);
        g.rotation.x = -0.85;
        station.add(g);
        g.updateMatrixWorld();
        const b = new THREE.Box3().setFromObject(g);
        colliders.push({ name: 'a radiator', min: b.min.toArray(), max: b.max.toArray() });
    }
    // Smaller radiators beside each array pair
    for (const x of [-40, 40]) {
        for (let k = 0; k < 3; k++) station.add(box([3.2, 2.2, 0.08], [x, T.y - T.half - 1.4 - k * 2.3, T.z - 2.4], mats.radiator));
        colliders.push({ name: 'a radiator', min: [x - 1.7, T.y - T.half - 8.6, T.z - 2.6], max: [x + 1.7, T.y - T.half, T.z - 2.2] });
    }

    // Everything marked solid becomes a collision box (slightly padded)
    station.updateMatrixWorld(true);
    station.traverse(o => {
        if (!o.isMesh || !o.userData.collider) return;
        const b = new THREE.Box3().setFromObject(o).expandByScalar(0.05);
        colliders.push({ name: o.userData.collider, min: b.min.toArray(), max: b.max.toArray() });
    });
    return { station, colliders };
}

/* ---------- The player's spacecraft ---------- */

// Body frame: right +X, up +Y, forward -Z; the docking interface sits 2.5 m ahead of the centre of mass
function buildCraft(mats) {
    const craft = new THREE.Group();
    craft.add(ring(0.62, 0.07, 'z', [0, 0, -2.45], mats.dark));
    craft.add(cylinder(0.65, 0.65, 0.3, 'z', [0, 0, -2.3], mats.metal));
    craft.add(cylinder(0.8, 1.45, 2.0, 'z', [0, 0, -1.2], mats.white));
    craft.add(cylinder(1.47, 1.47, 0.25, 'z', [0, 0, -0.1], mats.dark));
    craft.add(cylinder(1.4, 1.4, 2.6, 'z', [0, 0, 1.3], mats.metal));
    craft.add(cylinder(0.45, 0.85, 0.9, 'z', [0, 0, 3.05], mats.dark));
    for (const s of [-1, 1]) craft.add(box([3.2, 0.05, 1.1], [s * 3.0, 0, 1.3], mats.cells));
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        craft.add(box([0.22, 0.22, 0.3], [Math.cos(a) * 1.05, Math.sin(a) * 1.05, -1.8], mats.dark));
        craft.add(box([0.22, 0.22, 0.3], [Math.cos(a) * 1.5, Math.sin(a) * 1.5, 2.3], mats.dark));
    }
    for (const a of [-0.5, 0.5]) craft.add(box([0.3, 0.2, 0.05], [Math.sin(a) * 1.0, 0.65, -1.3], mats.hatch));
    return craft;
}

/* ---------- Earth and sky ---------- */

const EARTH_VERTEX = `
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
    vObj = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;

const EARTH_FRAGMENT = `
uniform vec3 sunDir;
uniform float time;
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vWorld;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
void main() {
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vObj);
    float land = smoothstep(0.53, 0.57, fbm(p * 4.0));
    vec3 ocean = mix(vec3(0.015, 0.07, 0.19), vec3(0.03, 0.15, 0.33), fbm(p * 11.0));
    vec3 ground = mix(vec3(0.13, 0.21, 0.09), vec3(0.40, 0.34, 0.22), fbm(p * 9.0 + 3.0));
    vec3 col = mix(ocean, ground, land);
    float cloud = smoothstep(0.52, 0.78, fbm(p * 7.0 + vec3(time * 0.0004, 0.0, 0.0)));
    col = mix(col, vec3(0.93, 0.95, 0.97), cloud * 0.9);
    vec3 view = normalize(cameraPosition - vWorld);
    float diff = max(dot(n, sunDir), 0.0);
    float limb = pow(1.0 - max(dot(n, view), 0.0), 4.0);
    vec3 lit = col * (0.02 + 0.8 * diff) + vec3(0.30, 0.55, 1.0) * limb * (0.15 + 0.7 * diff);
    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
}`;

function buildSky() {
    const sky = new THREE.Scene();
    sky.background = new THREE.Color('#010205');
    const rand = rng(3);
    const count = 2600, pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        pos.set([r * Math.cos(a) * 9000, u * 9000, r * Math.sin(a) * 9000], i * 3);
        const b = 0.35 + Math.pow(rand(), 3) * 0.65, tint = rand();
        col.set([b * (tint < 0.2 ? 0.8 : 1), b * (tint < 0.2 ? 0.88 : 0.97), b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sky.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })));

    // Earth some 400 km below, so its horizon sits a little under the docking axis
    const earthMat = new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: SUN }, time: { value: 0 } },
        vertexShader: EARTH_VERTEX, fragmentShader: EARTH_FRAGMENT,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(6371, 128, 64), earthMat);
    earth.position.set(0, -6771, -900);
    earth.rotation.set(0.4, 0.8, 0.2);
    sky.add(earth);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(6371 * 1.012, 96, 48), new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: SUN } },
        vertexShader: EARTH_VERTEX,
        fragmentShader: `uniform vec3 sunDir; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vObj;
            void main() { vec3 n = normalize(vNormal); vec3 v = normalize(cameraPosition - vWorld);
            float rim = pow(1.0 - abs(dot(n, v)), 5.0); float lit = 0.25 + 0.75 * max(dot(n, sunDir), 0.0);
            gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * rim * lit, rim * lit); }`,
        side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(earth.position);
    sky.add(halo);
    return { sky, earthMat };
}

/* ---------- Thruster puffs ---------- */

// Short-lived puffs from the nose thrusters when they fire forward (braking), the only ones a
// forward docking camera can see
function buildPuffs() {
    const max = 120;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3), alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: puffTexture() } },
        vertexShader: `attribute float alpha; varying float vA; void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(90.0 / -mv.z, 2.0, 120.0); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D map; varying float vA; void main() { vec4 t = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), t.a * vA * 0.45); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    const parts = Array.from({ length: max }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    let next = 0;
    const quads = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, y]) => new THREE.Vector3(x * 0.75, y * 0.75, -2.2));
    const tmp = new THREE.Vector3();
    return {
        points,
        update(dt, braking, craftPos, craftQ, craftVel) {
            if (braking > 0) {
                for (const q of quads) {
                    const p = parts[next++ % max];
                    p.life = 0.55;
                    p.p.copy(q).applyQuaternion(craftQ).add(craftPos);
                    tmp.set((Math.random() - 0.5) * 0.6 + q.x * 0.5, (Math.random() - 0.5) * 0.6 + q.y * 0.5, -4.5);
                    p.v.copy(tmp).applyQuaternion(craftQ).add(craftVel);
                }
            }
            parts.forEach((p, i) => {
                if (p.life > 0) {
                    p.life -= dt;
                    p.p.addScaledVector(p.v, dt);
                }
                pos.set([p.p.x, p.p.y, p.p.z], i * 3);
                alpha[i] = Math.max(p.life / 0.55, 0);
            });
            geo.attributes.position.needsUpdate = true;
            geo.attributes.alpha.needsUpdate = true;
        },
        clear() { parts.forEach(p => { p.life = 0; }); },
    };
}

/* ---------- The world ---------- */

export function createWorld(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.autoClear = false;

    const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const quiltMap = quiltTexture();
    const cells = cellTexture();
    cells.anisotropy = aniso;
    const radiatorMap = radiatorTexture();
    radiatorMap.anisotropy = aniso;
    const mats = {
        quiltMap,
        quilt: new THREE.MeshStandardMaterial({ color: '#ffffff', map: quiltMap, roughness: 0.75, metalness: 0.02 }),
        white: new THREE.MeshStandardMaterial({ color: '#e7e9ec', roughness: 0.55, metalness: 0.05 }),
        adapter: new THREE.MeshStandardMaterial({ color: '#e7e9ec', roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }),
        metal: new THREE.MeshStandardMaterial({ color: '#9aa2ad', roughness: 0.42, metalness: 0.7 }),
        dark: new THREE.MeshStandardMaterial({ color: '#2f343c', roughness: 0.5, metalness: 0.5 }),
        hatch: new THREE.MeshStandardMaterial({ color: '#1b1f25', roughness: 0.7, metalness: 0.2 }),
        gold: new THREE.MeshStandardMaterial({ color: '#c9a04a', roughness: 0.32, metalness: 0.85 }),
        olive: new THREE.MeshStandardMaterial({ color: '#8b8f74', roughness: 0.6, metalness: 0.1 }),
        truss: new THREE.MeshStandardMaterial({ color: '#b9c0c9', roughness: 0.45, metalness: 0.6 }),
        rail: new THREE.MeshStandardMaterial({ color: '#d8a42a', roughness: 0.5, metalness: 0.3 }),
        armWhite: new THREE.MeshStandardMaterial({ color: '#f0f0ec', roughness: 0.5, metalness: 0.1 }),
        cells: new THREE.MeshStandardMaterial({ color: '#ffffff', map: cells, roughness: 0.32, metalness: 0.45, side: THREE.DoubleSide }),
        cellBack: new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.8, metalness: 0.1 }),
        radiator: new THREE.MeshStandardMaterial({ color: '#ffffff', map: radiatorMap, roughness: 0.7, metalness: 0.05 }),
        green: new THREE.MeshBasicMaterial({ color: '#39ff7f', toneMapped: false }),
        portLight: new THREE.MeshBasicMaterial({ color: '#c9d4e0' }),
        targetWhite: new THREE.MeshBasicMaterial({ color: '#f4f6f8', toneMapped: false }),
    };

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(environmentTexture()).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    const sunLight = new THREE.DirectionalLight('#fff6e8', 3.2);
    sunLight.position.copy(SUN).multiplyScalar(100);
    scene.add(sunLight);
    scene.add(new THREE.HemisphereLight('#1a2235', '#3d6aa8', 0.55));

    const { station, colliders } = buildStation(mats);
    scene.add(station);
    const craft = buildCraft(mats);
    craft.visible = false;
    scene.add(craft);
    const puffs = buildPuffs();
    scene.add(puffs.points);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 4000);
    const { sky, earthMat } = buildSky();
    const skyCamera = new THREE.PerspectiveCamera(55, 1, 10, 30000);

    const tmp = new THREE.Vector3();
    const craftQ = new THREE.Quaternion(), craftPos = new THREE.Vector3(), craftVel = new THREE.Vector3();
    const portLights = mats.green;
    let width = 1, height = 1;

    return {
        colliders,
        portRadius: 0.95,
        camera,
        resize(w, h) {
            width = Math.max(1, w);
            height = Math.max(1, h);
            renderer.setSize(width, height, false);
            // Keep a sensible field of view on tall phone screens
            const fov = width / height < 1 ? 70 : 55;
            for (const c of [camera, skyCamera]) {
                c.fov = fov;
                c.aspect = width / height;
                c.updateProjectionMatrix();
            }
        },
        /**
         * view: { mode: 'cockpit' | 'external', pos, q, nose, vel, braking, time, dt }
         */
        update(view) {
            craftQ.set(view.q[1], view.q[2], view.q[3], view.q[0]);
            craftPos.set(...view.pos);
            craftVel.set(...view.vel);
            if (view.mode === 'external') {
                // A slow sweep across the front of the docked craft (never round behind, into the station)
                const a = 0.7 * Math.cos(view.time * 0.1);
                camera.position.set(Math.sin(a) * 17, 5.5 + Math.sin(view.time * 0.07) * 1.5, 3 + Math.cos(a) * 17);
                camera.up.set(0, 1, 0);
                camera.lookAt(0, 0, 2.5);
                craft.visible = true;
                craft.position.copy(craftPos);
                craft.quaternion.copy(craftQ);
            } else {
                camera.position.set(...view.nose);
                camera.quaternion.copy(craftQ);
                craft.visible = false;
            }
            camera.updateMatrixWorld();
            skyCamera.quaternion.copy(camera.quaternion);
            skyCamera.updateMatrixWorld();
            earthMat.uniforms.time.value = view.time;
            portLights.color.setRGB(0.22, 0.75 + 0.25 * Math.sin(view.time * 2.2), 0.5);
            puffs.update(view.dt, view.braking, craftPos, craftQ, craftVel);
        },
        render() {
            renderer.clear();
            renderer.render(sky, skyCamera);
            renderer.clearDepth();
            renderer.render(scene, camera);
        },
        clearPuffs() { puffs.clear(); },
        // Screen position (CSS px) of a point in the docking frame, and whether it is in front of the camera
        project(p) {
            tmp.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
            const vx = tmp.x, vy = tmp.y, vz = tmp.z;
            tmp.applyMatrix4(camera.projectionMatrix);
            return { x: (tmp.x + 1) / 2 * width, y: (1 - tmp.y) / 2 * height, front: vz < 0, vx, vy, vz };
        },
        dispose() { renderer.dispose(); },
        renderer,
    };
}
