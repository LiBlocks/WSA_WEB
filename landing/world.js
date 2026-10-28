// SSTO Landing 3D world: an original, Kerbal-Space-Center-inspired spaceport (runway, control tower,
// hangar, assembly building, launch pad, fuel farm, tracking dishes, radio masts, roads, coast) and
// the player's spaceplane, all built from simple procedural geometry and canvas textures with
// three.js. No KSP assets. Coordinates are those of layout.js.
import * as THREE from '../vendor/three/three.module.js';
import { RUNWAY, GLIDE, glideAlt, SEA_X, BUILDINGS } from './layout.js';

const DEG = Math.PI / 180;

/* ---------- Procedural textures ---------- */

// Seeded so the spaceport looks the same on every visit
function rng(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function canvasTexture(w, h, draw, repeat, color = true) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(...repeat);
    }
    return t;
}

function speckle(base, light, dark, count, seed, size = 3) {
    return (g, w, h) => {
        const rand = rng(seed);
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < count; i++) {
            g.fillStyle = rand() < 0.5 ? light : dark;
            g.globalAlpha = 0.25 + rand() * 0.35;
            const s = 1 + rand() * size;
            g.fillRect(rand() * w, rand() * h, s, s);
        }
        g.globalAlpha = 1;
    };
}

const grassTexture = () => canvasTexture(256, 256, speckle('#6c8b47', '#86a35a', '#56723a', 2600, 3, 4), [700, 700]);

const asphaltTexture = repeat => canvasTexture(256, 256, speckle('#4b4f55', '#62666c', '#383b40', 3200, 5, 2), repeat);
const concreteTexture = repeat => canvasTexture(256, 256, speckle('#a9aca7', '#bdbfba', '#8f928d', 2200, 9, 3), repeat);

// Office windows in rows
const facadeTexture = repeat => canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#e4e7ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2e4a63';
    for (let y = 14; y < h; y += 32) for (let x = 6; x < w; x += 16) g.fillRect(x, y, 10, 12);
}, repeat);

// The launch tower's lattice: transparent between the girders
const latticeTexture = () => canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#b8452f';
    g.lineWidth = 5;
    g.strokeRect(2, 2, w - 4, h - 4);
    g.beginPath();
    g.moveTo(2, 2); g.lineTo(w - 2, h - 2);
    g.moveTo(w - 2, 2); g.lineTo(2, h - 2);
    g.stroke();
}, [1, 7]);

function textTexture(text, w, h, font, color = '#ffffff') {
    return canvasTexture(w, h, (g) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = color;
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 4);
    });
}

/* ---------- Geometry helpers ---------- */

// Many flat rectangles on the ground as one mesh: [x0, x1, z0, z1]
function flatRects(rects, y) {
    const pos = [], uv = [], idx = [];
    rects.forEach(([x0, x1, z0, z1], i) => {
        pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        const o = i * 4;
        idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

// A ground strip with world-scaled texture coordinates (one texture repeat every `tile` metres)
function strip(x0, x1, z0, z1, y, mat, tile = 40) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / tile, uv.getY(i) * (z1 - z0) / tile);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    return m;
}

function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
}

function cyl(rTop, rBottom, h, mat, x, y, z, seg = 24) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
    m.position.set(x, y, z);
    return m;
}

// Instanced copies of one geometry at [x, y, z, scale?] positions
function instanced(geo, mat, list) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach((it, i) => {
        p.set(it[0], it[1], it[2]);
        const k = it[3] || 1;
        s.set(k, it[4] || k, k);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it[5] || 0);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

/* ---------- The spaceport ---------- */

function buildRunway(mats, lights) {
    const g = new THREE.Group();
    const L = RUNWAY.length, W = RUNWAY.width, half = W / 2;
    // Paved blast pads at both ends, then the runway itself
    g.add(strip(-half, half, 0, 120, 0.02, mats.blastpad, 30));
    g.add(strip(-half, half, -L - 120, -L, 0.02, mats.blastpad, 30));
    g.add(strip(-half - 6, half + 6, -L, 0, 0.03, mats.runway, 35));

    // Markings, all one mesh: edge lines, centreline dashes, threshold bars, aiming point, touchdown zone
    const r = [];
    r.push([-half + 1, -half + 2, -L, 0], [half - 2, half - 1, -L, 0]);
    for (let s = 110; s < L - 110; s += 50) r.push([-0.6, 0.6, -s - 30, -s]);
    const bars = s0 => {
        for (let i = 0; i < 8; i++) {
            const x = 3 + i * 3.8;
            r.push([x, x + 1.8, -s0 - 30, -s0], [-x - 1.8, -x, -s0 - 30, -s0]);
        }
    };
    bars(6);
    bars(L - 36);
    // Aiming point (both ends) and touchdown zone bars
    const aim = s0 => r.push([8, 18, -s0 - 50, -s0], [-18, -8, -s0 - 50, -s0]);
    aim(GLIDE.aim - 25);
    aim(L - GLIDE.aim - 25);
    const tdz = (s0, n) => {
        for (let i = 0; i < n; i++) {
            const x = 8 + i * 3;
            r.push([x, x + 1.8, -s0 - 22, -s0], [-x - 1.8, -x, -s0 - 22, -s0]);
        }
    };
    [[150, 3], [450, 2], [600, 2], [750, 1], [900, 1]].forEach(([s0, n]) => { tdz(s0, n); tdz(L - s0 - 22, n); });
    // The threshold line across the runway
    r.push([-half + 1, half - 1, -3, 0], [-half + 1, half - 1, -L, -L + 3]);
    const marks = new THREE.Mesh(flatRects(r, 0.05), mats.marking);
    marks.receiveShadow = true;
    g.add(marks);

    // Runway numbers
    const num = (text, s0, flip) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 34), new THREE.MeshLambertMaterial({ map: textTexture(text, 256, 384, 'bold 300px system-ui, sans-serif'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        m.rotation.x = -Math.PI / 2;
        if (flip) m.rotation.z = Math.PI;
        m.position.set(0, 0.06, -s0);
        m.receiveShadow = true;
        g.add(m);
    };
    num(RUNWAY.numbers[0], 62, false);
    num(RUNWAY.numbers[1], L - 62, true);

    // Edge lights every 60 m, green across the threshold, red across the far end
    const edge = [];
    for (let s = 0; s <= L; s += 60) edge.push([-half - 2, 0.4, -s], [half + 2, 0.4, -s]);
    const lightGeo = new THREE.SphereGeometry(0.45, 8, 6);
    g.add(instanced(lightGeo, lights.white, edge));
    const ends = [], reds = [];
    for (let x = -half; x <= half; x += 4) { ends.push([x, 0.4, 1.5]); reds.push([x, 0.4, -L - 1.5]); }
    g.add(instanced(lightGeo, lights.green, ends));
    g.add(instanced(lightGeo, lights.red, reds));

    // Approach lights: a row on short posts out to 900 m, with a crossbar at 300 m
    const approach = [], posts = [];
    for (let z = 60; z <= 900; z += 30) {
        for (const dx of [-2, 0, 2]) approach.push([dx, 2.2, z]);
        posts.push([0, 1, z, 1, 1]);
    }
    for (let x = -15; x <= 15; x += 2.5) approach.push([x, 2.2, 300]);
    g.add(instanced(new THREE.SphereGeometry(0.5, 8, 6), lights.white, approach));
    g.add(instanced(new THREE.BoxGeometry(0.4, 2, 0.4), mats.metal, posts));

    // PAPI: four lights left of the aiming point; white above the path, red below
    const papi = [];
    for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
        const m = box(2.4, 1.4, 1.2, mat, -half - 14 - i * 6, 0.9, -GLIDE.aim);
        g.add(m);
        g.add(box(3, 0.4, 2, mats.metal, m.position.x, 0.2, m.position.z));
        papi.push(mat);
    }
    return { group: g, papi };
}

function buildGround(mats) {
    const g = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), mats.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    // Fields: big patches of slightly different greens and straw, so the ground isn't one flat colour
    const rand0 = rng(13), patches = [], colors = [];
    const tints = ['#f4f9ec', '#e2ebd8', '#f7f2d2', '#f1e6c2', '#dce7d2', '#ebf2e1'];   // multiply the grass
    for (let i = 0; i < 160; i++) {
        const cx = SEA_X + 200 + rand0() * 16000, cz = -9000 + rand0() * 26000;
        if (Math.abs(cx) < 600 && cz > -3200 && cz < 5000) continue;
        if (cx > 150 && cx < 2200 && cz > -3200 && cz < 1200) continue;
        const w = 250 + rand0() * 900, d = 250 + rand0() * 900;
        patches.push([cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2]);
        const c = new THREE.Color(tints[Math.floor(rand0() * tints.length)]);
        for (let k = 0; k < 4; k++) colors.push(c.r, c.g, c.b);
    }
    const fieldGeo = flatRects(patches, 0.015);
    fieldGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Texture coordinates in world units, matching the grass texture's scale on the ground
    const fp = fieldGeo.attributes.position, fuv = fieldGeo.attributes.uv, tile = 60000 / 700;
    for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / tile, -fp.getZ(i) / tile);
    const fieldMap = mats.grass.map.clone();
    fieldMap.repeat.set(1, 1);
    const fields = new THREE.Mesh(fieldGeo, new THREE.MeshLambertMaterial({ vertexColors: true, map: fieldMap, polygonOffset: true, polygonOffsetFactor: -1 }));
    fields.receiveShadow = true;
    g.add(fields);
    // The sea, left of the coast, with a sandy shore
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 60000), mats.sea);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(SEA_X - 15000, 0.12, 0);
    g.add(sea);
    g.add(strip(SEA_X - 10, SEA_X + 70, -30000, 30000, 0.08, mats.sand, 60));
    // Distant hills, softened by the haze
    const rand = rng(21);
    const hills = new THREE.Group();
    for (let i = 0; i < 26; i++) {
        const a = -0.9 + rand() * 2.6;           // mostly to the right and ahead, away from the sea
        const d = 9000 + rand() * 9000;
        const r = 900 + rand() * 1600, h = 250 + rand() * 900;
        const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), i % 3 ? mats.hill : mats.hillDark);
        m.position.set(Math.sin(a) * d + 2000, h / 2 - 20, -Math.cos(a) * d + 1000);
        m.rotation.y = rand() * Math.PI;
        if (m.position.x < SEA_X + 3000) m.position.x = SEA_X + 3000 + rand() * 4000;
        hills.add(m);
    }
    g.add(hills);
    return g;
}

function buildPaving(mats) {
    const g = new THREE.Group();
    const at = id => BUILDINGS.find(b => b.id === id);
    const L = RUNWAY.length;
    // Parallel taxiway with connectors to the runway
    g.add(strip(160, 182, -L + 150, -150, 0.03, mats.taxiway, 30));
    for (const s of [180, 1250, L - 180]) g.add(strip(RUNWAY.width / 2 + 6, 182, -s - 11, -s + 11, 0.032, mats.taxiway, 30));
    // Apron in front of the tower, hangar and operations building
    g.add(strip(182, 360, -1450, -480, 0.03, mats.apron, 40));
    // Roads: dark grey ribbons between the facilities
    const roads = [
        [360, 1500, -1010, -1000],      // apron to the assembly building and on
        [1495, 1505, -2950, -1000],     // north to the launch pad
        [1505, 1720, -2955, -2945],
        [600, 610, -1000, -150],        // south past the operations building
        [610, 920, -155, -145],         // to the tracking station
        [1240, 1250, -2260, -1000],     // to the fuel farm
    ];
    roads.forEach(([x0, x1, z0, z1]) => g.add(strip(x0, x1, z0, z1, 0.03, mats.road, 30)));
    // Pads under the main buildings
    for (const id of ['vab', 'hangar', 'tanks', 'tracking', 'admin']) {
        const b = at(id);
        g.add(strip(b.x - b.w / 2 - 12, b.x + b.w / 2 + 12, -b.s - b.d / 2 - 12, -b.s + b.d / 2 + 12, 0.025, mats.apron, 40));
    }
    return g;
}

function buildFacilities(mats, lights) {
    const g = new THREE.Group();
    const at = id => BUILDINGS.find(b => b.id === id);
    const blinkers = [];
    const shadow = m => { m.castShadow = false; m.receiveShadow = true; return m; };

    // Control tower: a shaft, a gallery and a glass cab
    {
        const b = at('tower'), x = b.x, z = -b.s;
        g.add(shadow(cyl(5, 6, 46, mats.white, x, 23, z)));
        g.add(cyl(10.5, 10.5, 1.2, mats.panel, x, 46.5, z));
        g.add(cyl(9.5, 8.5, 7, mats.glass, x, 50.5, z, 8));
        g.add(cyl(11, 11, 1.6, mats.white, x, 54.6, z, 8));
        g.add(cyl(0.3, 0.3, 8, mats.metal, x, 59, z, 6));
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), lights.beacon);
        light.position.set(x, 63, z);
        g.add(light);
        blinkers.push(light);
        g.add(shadow(box(16, 8, 16, mats.white, x + 10, 4, z)));
    }
    // Operations building: low offices with rows of windows
    {
        const b = at('admin');
        g.add(shadow(box(b.w, b.h, b.d, mats.facade, b.x, b.h / 2, -b.s)));
        g.add(box(b.w + 1, 1, b.d + 1, mats.panel, b.x, b.h + 0.5, -b.s));
        g.add(shadow(box(30, 12, 26, mats.facade, b.x + 46, 6, -b.s + 4)));
    }
    // Spaceplane hangar: an arched hall, its doors facing the runway
    {
        const b = at('hangar'), r = b.d / 2;
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, b.w, 40, 1, false, 0, Math.PI), mats.hangar);
        arch.rotation.z = Math.PI / 2;
        arch.position.set(b.x, 0, -b.s);
        g.add(shadow(arch));
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 4, 40, 1, true, 0, Math.PI), mats.blue);
        band.rotation.z = Math.PI / 2;
        band.position.set(b.x - b.w / 2 + 6, 0, -b.s);
        g.add(band);
        g.add(box(1, 30, 58, mats.door, b.x - b.w / 2 - 0.4, 15, -b.s));
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), new THREE.MeshLambertMaterial({ map: textTexture('SPACEPLANE HANGAR', 512, 118, 'bold 64px system-ui, sans-serif', '#1f3a5f'), transparent: true }));
        sign.rotation.y = -Math.PI / 2;
        sign.position.set(b.x - b.w / 2 - 1, 35, -b.s);
        g.add(sign);
    }
    // Vehicle assembly building: the tallest thing here, with a huge door and the WSA mark
    {
        const b = at('vab');
        g.add(shadow(box(b.w, b.h, b.d, mats.white, b.x, b.h / 2, -b.s)));
        g.add(box(b.w + 0.6, 10, b.d + 0.6, mats.blue, b.x, b.h - 9, -b.s));
        g.add(box(1, 96, 50, mats.door, b.x - b.w / 2 - 0.4, 48, -b.s + 8));
        for (let i = 1; i < 6; i++) g.add(box(1.2, 0.6, 50, mats.panel, b.x - b.w / 2 - 0.6, i * 16, -b.s + 8));
        const logo = new THREE.Mesh(new THREE.PlaneGeometry(34, 17), mats.logo);
        logo.rotation.y = -Math.PI / 2;
        logo.position.set(b.x - b.w / 2 - 0.8, 104, -b.s - 30);
        g.add(logo);
        g.add(shadow(box(60, 30, 70, mats.white, b.x + 70, 15, -b.s + 10)));
    }
    // Fuel farm: spherical tanks and horizontal cylinders
    {
        const b = at('tanks');
        for (let i = 0; i < 3; i++) {
            const x = b.x - 30 + i * 30, z = -b.s - 12;
            const t = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 16), mats.white);
            t.position.set(x, 13, z);
            g.add(shadow(t));
            g.add(cyl(8, 9, 3, mats.panel, x, 1.5, z));
        }
        for (let i = 0; i < 2; i++) {
            const t = cyl(4, 4, 34, mats.tank, b.x - 10 + i * 0, 5, -b.s + 18 + i * 10);
            t.rotation.z = Math.PI / 2;
            g.add(shadow(t));
        }
    }
    // Launch pad: a concrete base, a lattice service tower, a rocket, a water tower and lightning masts
    {
        const b = at('pad'), x = b.x, z = -b.s;
        g.add(shadow(cyl(58, 64, 6, mats.concrete, x, 3, z, 8)));
        g.add(box(16, 0.4, 70, mats.door, x, 6.1, z));
        const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 86, 12), mats.lattice);
        tower.position.set(x + 20, 49, z);
        g.add(tower);
        g.add(box(16, 2, 4, mats.lattice, x + 11, 70, z));
        const rocket = new THREE.Group();
        rocket.add(cyl(4.4, 4.4, 50, mats.rocket, 0, 25, 0));
        const nose = new THREE.Mesh(new THREE.ConeGeometry(4.4, 11, 24), mats.white);
        nose.position.y = 55.5;
        rocket.add(nose);
        for (let i = 0; i < 4; i++) {
            const fin = box(0.6, 8, 6, mats.dark, 0, 4, 0);
            fin.position.set(Math.cos(i * Math.PI / 2) * 5, 4, Math.sin(i * Math.PI / 2) * 5);
            fin.rotation.y = -i * Math.PI / 2;
            rocket.add(fin);
        }
        rocket.position.set(x, 6, z);
        g.add(rocket);
        const water = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), mats.white);
        water.position.set(x - 70, 42, z - 40);
        g.add(water);
        for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) g.add(cyl(0.5, 0.5, 40, mats.metal, x - 70 + dx, 20, z - 40 + dz, 6));
        for (let i = 0; i < 3; i++) {
            const a = i * 2 * Math.PI / 3 + 0.4;
            const mx = x + Math.cos(a) * 72, mz = z + Math.sin(a) * 72;
            g.add(cyl(0.6, 1, 96, mats.metal, mx, 48, mz, 6));
            const l = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lights.beacon);
            l.position.set(mx, 97, mz);
            g.add(l);
            blinkers.push(l);
        }
    }
    // Tracking station: three dishes on pedestals and a control building
    {
        const b = at('tracking');
        for (let i = 0; i < 3; i++) {
            const x = b.x - 40 + i * 40, z = -b.s;
            g.add(cyl(1.6, 2.4, 14, mats.white, x, 7, z, 12));
            const dish = new THREE.Mesh(new THREE.SphereGeometry(13, 28, 10, 0, Math.PI * 2, 0, 0.75), mats.dish);
            dish.rotation.x = Math.PI - 0.9;
            dish.rotation.z = (i - 1) * 0.35;
            dish.position.set(x, 19, z);
            g.add(dish);
            g.add(cyl(0.25, 0.25, 9, mats.metal, x, 22, z + 3, 6));
        }
        g.add(shadow(box(30, 9, 18, mats.facade, b.x + 70, 4.5, -b.s + 20)));
    }
    // Radio masts with blinking tops
    for (const id of ['mast1', 'mast2']) {
        const b = at(id);
        g.add(cyl(0.7, 1.6, b.h, mats.mast, b.x, b.h / 2, -b.s, 6));
        for (let y = 20; y < b.h; y += 30) g.add(cyl(2.2, 2.2, 0.6, mats.metal, b.x, y, -b.s, 6));
        const l = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), lights.beacon);
        l.position.set(b.x, b.h + 1, -b.s);
        g.add(l);
        blinkers.push(l);
    }
    // Small outbuildings scattered around the complex
    const rand = rng(77), sheds = [];
    for (let i = 0; i < 46; i++) {
        const x = 300 + rand() * 1700, s = -150 + rand() * 3000;
        if (BUILDINGS.some(b => Math.abs(x - b.x) < b.w / 2 + 30 && Math.abs(s - b.s) < b.d / 2 + 30)) continue;
        if (x < 380 && s > 400 && s < 1500) continue;
        const k = 6 + rand() * 10;
        sheds.push([x, k * 0.35, -s, k, k * 0.7, rand() * Math.PI]);
    }
    g.add(instanced(new THREE.BoxGeometry(1, 1, 1), mats.shed, sheds));
    return { group: g, blinkers };
}

function buildTrees(mats) {
    const rand = rng(41), list = [];
    let tries = 0;
    while (list.length < 520 && tries++ < 6000) {
        // Clusters on both sides, kept clear of the runway, the approach and the buildings
        const cx = (rand() < 0.35 ? -1300 + rand() * 1100 : 250 + rand() * 2600);
        const s = -2500 + rand() * 7000;
        const x = cx + (rand() - 0.5) * 60;
        if (x < SEA_X + 120) continue;
        if (Math.abs(x) < 170 && s > -1200 && s < RUNWAY.length + 400) continue;
        if (Math.abs(x) < 320 && s < 0) continue;
        if (BUILDINGS.some(b => Math.abs(x - b.x) < b.w / 2 + 40 && Math.abs(s - b.s) < b.d / 2 + 40)) continue;
        if (x > 150 && x < 380 && s > 150 && s < 1500) continue;
        const k = 0.7 + rand() * 0.8;
        list.push([x, 6 * k, -s, k, k]);
    }
    return instanced(new THREE.ConeGeometry(4, 12, 6), mats.tree, list);
}

/* ---------- The spaceplane ---------- */

function buildPlane() {
    const white = new THREE.MeshStandardMaterial({ color: '#e9edf2', roughness: 0.45, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b313b', roughness: 0.6, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.45, metalness: 0.1 });
    const glass = new THREE.MeshStandardMaterial({ color: '#0f2235', roughness: 0.15, metalness: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: '#8e98a5', roughness: 0.4, metalness: 0.7 });
    const tyre = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.9 });
    const g = new THREE.Group();
    const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };

    // Fuselage and nose (nose toward -z)
    const body = add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.15, 12, 24), white), 0, 0, 0.5);
    body.rotation.x = Math.PI / 2;
    const nose = add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.6, 24), white), 0, 0, -7.8);
    nose.rotation.x = -Math.PI / 2;
    const noseTip = add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 16), dark), 0, 0, -9.7);
    noseTip.rotation.x = -Math.PI / 2;
    const canopy = add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass), 0, 0.85, -4.3);
    canopy.scale.set(0.75, 0.55, 2.1);
    const stripe = add(new THREE.Mesh(new THREE.CylinderGeometry(1.215, 1.215, 0.7, 24, 1, true), blue), 0, 0, -1.6);
    stripe.rotation.x = Math.PI / 2;

    // Delta wing (one extruded shape across both sides) with dark leading edges
    const wing = new THREE.Shape();
    wing.moveTo(0, -1.2);
    wing.lineTo(7, 3.6);
    wing.lineTo(7, 5.2);
    wing.lineTo(-7, 5.2);
    wing.lineTo(-7, 3.6);
    wing.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.24, bevelEnabled: false });
    wingGeo.rotateX(Math.PI / 2);
    const wingMesh = add(new THREE.Mesh(wingGeo, white), 0, -0.45, 0);
    wingMesh.receiveShadow = true;
    for (const sx of [-1, 1]) {
        const tip = add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 1.8), blue), sx * 7, -0.45, 4.4);
        tip.castShadow = true;
    }
    // Vertical fin with the WSA mark on both sides
    const fin = new THREE.Shape();
    fin.moveTo(3.2, 0);
    fin.lineTo(7.4, 0);
    fin.lineTo(7.6, 3.6);
    fin.lineTo(6.0, 3.6);
    fin.closePath();
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.22, bevelEnabled: false });
    finGeo.rotateY(-Math.PI / 2);
    add(new THREE.Mesh(finGeo, white), 0.11, 0.9, 0);
    const mark = new THREE.MeshBasicMaterial({ map: textTexture('WSA', 256, 128, 'bold 96px system-ui, sans-serif', '#1d4ed8'), transparent: true });
    for (const sx of [-1, 1]) {
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), mark);
        decal.position.set(sx * 0.14, 2.2, 6.4);
        decal.rotation.y = sx * Math.PI / 2;
        g.add(decal);
    }
    // Engines and glowing nozzles
    const glowMat = new THREE.MeshBasicMaterial({ color: '#9ec5ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glows = [];
    for (const sx of [-1, 1]) {
        const eng = add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 3.2, 20), metal), sx * 1.05, -0.15, 6.3);
        eng.rotation.x = Math.PI / 2;
        const nozzle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 0.8, 20, 1, true), dark), sx * 1.05, -0.15, 8.2);
        nozzle.rotation.x = Math.PI / 2;
        const glow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 16, 1, true), glowMat);
        glow.rotation.x = Math.PI / 2;
        glow.position.set(sx * 1.05, -0.15, 9.9);
        g.add(glow);
        glows.push(glow);
    }
    // Navigation lights: red left, green right, and a white strobe on the fin
    const nav = (color, x, y, z) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
        m.position.set(x, y, z);
        g.add(m);
        return m;
    };
    nav('#ff3b3b', -7.1, -0.4, 3.8);
    nav('#3bff7a', 7.1, -0.4, 3.8);
    const strobe = nav('#ffffff', 0, 4.5, 7.5);

    // Landing gear: nose and two mains; each leg slides up into the aircraft when retracted
    const legs = [];
    const leg = (x, z) => {
        const lg = new THREE.Group();
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 8), metal);
        strut.position.y = -0.75;
        strut.castShadow = true;
        lg.add(strut);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 16), tyre);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.y = -1.58;
        wheel.castShadow = true;
        lg.add(wheel);
        lg.position.set(x, -0.2, z);
        g.add(lg);
        legs.push(lg);
    };
    leg(0, -5.2);
    leg(-2.4, 1.3);
    leg(2.4, 1.3);
    return { group: g, legs, glows, strobe };
}

/* ---------- Sky ---------- */

function buildSky() {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
            sun: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() },
        },
        vertexShader: `varying vec3 vDir;
            void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform vec3 sunColor; varying vec3 vDir;
            void main() {
                float h = max(vDir.y, 0.0);
                vec3 c = mix(horizon, top, pow(h, 0.55));
                float s = max(dot(normalize(vDir), sun), 0.0);
                c += sunColor * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18);
                if (vDir.y < 0.0) c = horizon;
                gl_FragColor = vec4(c, 1.0);
            }`,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    return { sky, mat };
}

const THEMES = {
    day: {
        top: '#3f78bd', horizon: '#cfe1ef', fog: '#c8dbea', sun: [-0.45, 0.62, 0.64], sunColor: '#fff2d8',
        sunI: 2.6, hemiSky: '#cfe2ff', hemiGround: '#5c7a3c', hemiI: 1.15, exposure: 1.0,
        lights: { white: '#d9dee4', green: '#4fae6c', red: '#c45555', beacon: '#d24a4a' }, glow: 0.45,
        sea: '#3b7aa3',
    },
    dusk: {
        top: '#1f2f52', horizon: '#d6a282', fog: '#9c8a86', sun: [-0.62, 0.2, -0.76], sunColor: '#ffd2a8',
        sunI: 2.1, hemiSky: '#9aaad0', hemiGround: '#5a5844', hemiI: 1.55, exposure: 1.15,
        lights: { white: '#fff3c4', green: '#3dff7f', red: '#ff3d3d', beacon: '#ff2a2a' }, glow: 1,
        sea: '#24476a',
    },
};

/* ---------- The world ---------- */

export function createWorld(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const withAniso = t => { t.anisotropy = aniso; return t; };

    const lambert = (opts) => new THREE.MeshLambertMaterial(opts);
    const mats = {
        grass: lambert({ map: withAniso(grassTexture()) }),
        runway: lambert({ map: withAniso(asphaltTexture()) }),
        blastpad: lambert({ color: '#7e8186', map: withAniso(asphaltTexture()) }),
        taxiway: lambert({ color: '#9a9ea3', map: withAniso(asphaltTexture()) }),
        road: lambert({ color: '#8a8d92', map: withAniso(asphaltTexture()) }),
        apron: lambert({ map: withAniso(concreteTexture()) }),
        concrete: lambert({ map: concreteTexture([4, 1]) }),
        marking: lambert({ color: '#f2f2ee', polygonOffset: true, polygonOffsetFactor: -1 }),
        sand: lambert({ color: '#d9c99a' }),
        sea: new THREE.MeshPhongMaterial({ color: '#3b7aa3', shininess: 80, specular: '#9fb8cc' }),
        hill: lambert({ color: '#6f8a5a', flatShading: true }),
        hillDark: lambert({ color: '#5d7550', flatShading: true }),
        white: lambert({ color: '#e8ebee' }),
        panel: lambert({ color: '#9aa3ad' }),
        metal: lambert({ color: '#8c939c' }),
        dark: lambert({ color: '#2d3239' }),
        door: lambert({ color: '#5b6470' }),
        blue: lambert({ color: '#2f6fd6' }),
        glass: new THREE.MeshPhongMaterial({ color: '#1d3b55', shininess: 90, specular: '#aac8e0' }),
        facade: lambert({ map: facadeTexture([6, 2]) }),
        hangar: lambert({ color: '#d7dce1' }),
        tank: lambert({ color: '#f0f2f4' }),
        rocket: lambert({ color: '#f4f5f6' }),
        dish: lambert({ color: '#f3f4f5', side: THREE.DoubleSide }),
        mast: lambert({ color: '#c8503a' }),
        lattice: lambert({ map: latticeTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
        shed: lambert({ color: '#c9ccc4' }),
        tree: lambert({ color: '#3f5f34', flatShading: true }),
        logo: new THREE.MeshLambertMaterial({ map: textTexture('WSA', 512, 256, 'bold 200px system-ui, sans-serif', '#1d4ed8'), transparent: true }),
    };
    const lights = {
        white: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
        green: new THREE.MeshBasicMaterial({ color: '#3dff7f', toneMapped: false }),
        red: new THREE.MeshBasicMaterial({ color: '#ff3d3d', toneMapped: false }),
        beacon: new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }),
    };

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#c8dbea', 2600, 21000);
    const { sky, mat: skyMat } = buildSky();
    scene.add(sky);
    const sunLight = new THREE.DirectionalLight('#fff2d8', 2.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    const sc = sunLight.shadow.camera;
    sc.left = sc.bottom = -24;
    sc.right = sc.top = 24;
    sc.near = 1;
    sc.far = 2600;
    sunLight.shadow.bias = -0.0006;
    sunLight.shadow.normalBias = 0.04;
    scene.add(sunLight, sunLight.target);
    const hemi = new THREE.HemisphereLight('#cfe2ff', '#5c7a3c', 1.15);
    scene.add(hemi);

    scene.add(buildGround(mats));
    scene.add(buildPaving(mats));
    const runway = buildRunway(mats, lights);
    scene.add(runway.group);
    const facilities = buildFacilities(mats, lights);
    scene.add(facilities.group);
    scene.add(buildTrees(mats));

    // Approach gates along the glide path, shown with Flight Assist on
    const gatePts = [];
    for (let z = 400; z <= 4400; z += 400) {
        const y = glideAlt(z) + 2.2, w = 40 + z * 0.012, h = 18 + z * 0.006;
        const c = [[-w, y - h], [w, y - h], [w, y + h], [-w, y + h]];
        for (let i = 0; i < 4; i++) {
            const a = c[i], b = c[(i + 1) % 4];
            gatePts.push(a[0], a[1], z, b[0], b[1], z);
        }
    }
    const gateGeo = new THREE.BufferGeometry();
    gateGeo.setAttribute('position', new THREE.Float32BufferAttribute(gatePts, 3));
    const gates = new THREE.LineSegments(gateGeo, new THREE.LineBasicMaterial({ color: '#4dff91', transparent: true, opacity: 0.55, depthWrite: false }));
    const GATE_STEP = 400, GATE_VERTS = 8;
    scene.add(gates);

    const plane = buildPlane();
    scene.add(plane.group);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 40000);
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    let camReady = false;
    const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
    let width = 1, height = 1, themeName = '';
    let sunDir = new THREE.Vector3();

    function setTheme(name) {
        if (name === themeName) return;
        themeName = name;
        const t = THEMES[name] || THEMES.day;
        skyMat.uniforms.top.value.set(t.top);
        skyMat.uniforms.horizon.value.set(t.horizon);
        skyMat.uniforms.sunColor.value.set(t.sunColor);
        sunDir = new THREE.Vector3(...t.sun).normalize();
        skyMat.uniforms.sun.value.copy(sunDir);
        scene.fog.color.set(t.fog);
        sunLight.color.set(t.sunColor);
        sunLight.intensity = t.sunI;
        hemi.color.set(t.hemiSky);
        hemi.groundColor.set(t.hemiGround);
        hemi.intensity = t.hemiI;
        renderer.toneMappingExposure = t.exposure;
        for (const k of ['white', 'green', 'red', 'beacon']) lights[k].color.set(t.lights[k]);
        mats.sea.color.set(t.sea);
        plane.glows.forEach(g => { g.material.opacity = 0.35 + 0.45 * t.glow; });
    }
    setTheme('day');

    return {
        camera,
        setTheme,
        resize(w, h) {
            width = Math.max(1, w);
            height = Math.max(1, h);
            renderer.setSize(width, height, false);
            camera.fov = width / height < 1 ? 72 : 58;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        },
        /**
         * view: { pos, q ([w, x, y, z]), vel, gearPos, thrust (0…1), camera: 'chase' | 'wide' | 'orbit',
         *         time, dt, gates (bool), snap (bool) }
         */
        update(view) {
            const g = plane.group;
            g.position.set(view.pos[0], view.pos[1], view.pos[2]);
            q.set(view.q[1], view.q[2], view.q[3], view.q[0]);
            g.quaternion.copy(q);
            // Gear legs slide up into the aircraft as they retract
            plane.legs.forEach(l => {
                l.visible = view.gearPos > 0.02;
                l.scale.y = Math.max(view.gearPos, 0.02);
            });
            plane.glows.forEach(gl => {
                const k = 0.15 + view.thrust * 0.85;
                gl.scale.set(0.6 + k * 0.4, 0.4 + k * 1.2, 0.6 + k * 0.4);
                gl.position.z = 8.6 + (0.4 + k * 1.2) * 1.5;
            });
            plane.strobe.visible = (view.time % 1.4) < 0.08;
            const blink = (view.time % 1.6) < 0.8;
            facilities.blinkers.forEach(b => { b.visible = blink; });
            gates.visible = !!view.gates;
            // Only the gates still well ahead: one being flown through would sweep across the whole view
            const ahead = Math.max(0, Math.min(11, Math.floor((view.pos[2] - 150) / GATE_STEP)));
            gateGeo.setDrawRange(0, ahead * GATE_VERTS);

            // PAPI: lights turn white one by one as the aircraft's angle above the aiming point grows
            const dz = view.pos[2] + GLIDE.aim, dy = view.pos[1] - 2.2;
            const ang = Math.atan2(dy, Math.max(dz, 1)) / DEG;
            const steps = [GLIDE.angle - 1.2, GLIDE.angle - 0.4, GLIDE.angle + 0.4, GLIDE.angle + 1.2];
            runway.papi.forEach((m, i) => m.color.set(dz > 0 && ang > steps[3 - i] ? '#ffffff' : '#ff3030'));

            // Camera
            const p = g.position;
            const f = tmp.set(0, 0, -1).applyQuaternion(q);
            const flat = new THREE.Vector3(f.x, 0, f.z);
            if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
            flat.normalize();
            const right = new THREE.Vector3(-flat.z, 0, flat.x);
            let want, look;
            if (view.camera === 'orbit') {
                const a = view.time * 0.12;
                want = new THREE.Vector3(p.x + Math.sin(a) * 34, p.y + 9, p.z + Math.cos(a) * 34);
                look = p.clone().add(new THREE.Vector3(0, 1, 0));
            } else if (view.camera === 'wide') {
                want = p.clone().addScaledVector(flat, -72).addScaledVector(right, 26).add(new THREE.Vector3(0, 22, 0));
                look = p.clone().addScaledVector(flat, 30);
            } else {
                // Behind and above, looking past the aircraft so it sits low in the frame with the runway ahead in view
                want = p.clone().addScaledVector(flat, -32).add(new THREE.Vector3(0, 9, 0));
                look = p.clone().addScaledVector(flat, 60).add(new THREE.Vector3(0, 5.5, 0));
            }
            want.y = Math.max(want.y, 1.6);
            if (!camReady || view.snap) {
                camPos.copy(want);
                camLook.copy(look);
                camReady = true;
            } else {
                const k = 1 - Math.exp(-(view.dt || 0) * (view.camera === 'orbit' ? 1.5 : 5));
                camPos.lerp(want, k);
                camLook.lerp(look, 1 - Math.exp(-(view.dt || 0) * 8));
            }
            camera.position.copy(camPos);
            camera.up.set(0, 1, 0);
            camera.lookAt(camLook);
            camera.updateMatrixWorld();
            sky.position.copy(camera.position);
            sky.scale.setScalar(30000);

            // The shadow camera follows the aircraft
            sunLight.target.position.copy(p);
            sunLight.position.copy(p).addScaledVector(sunDir, 1200);
            sunLight.target.updateMatrixWorld();
        },
        render() { renderer.render(scene, camera); },
        // Screen position (CSS px) of a world point, and whether it is in front of the camera
        project(pt) {
            tmp.set(pt[0], pt[1], pt[2]).applyMatrix4(camera.matrixWorldInverse);
            const front = tmp.z < 0;
            tmp.applyMatrix4(camera.projectionMatrix);
            return { x: (tmp.x + 1) / 2 * width, y: (1 - tmp.y) / 2 * height, front };
        },
        renderer,
        dispose() { renderer.dispose(); },
    };
}
