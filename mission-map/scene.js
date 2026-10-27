// Mission Map: the 3D view. Draws the Kerbol system (bodies.js), the selected mission's route (routes.js)
// and an HTML overlay of labels and markers, and runs the camera. It renders only when something changed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { BODIES, REGIONS, body, position, orbitPath, systemExtent, dir } from './bodies.js';
import { pointAt, viewDistanceAt } from './routes.js';
import { surfaceCanvas, ringCanvas, glowCanvas } from './textures.js';

const FOV = 40;
const MAX_DISTANCE = 3400;
const VIEW_DIR = new THREE.Vector3(0.12, 0.62, 0.78).normalize();   // default look: from above and to one side
const VIEWS = { system: 930, inner: 345 };                           // radius each overview frames
const DASH_PX = 9;                                                   // schematic dash length on screen
const LABEL_GAP = 6;

const vec = a => new THREE.Vector3(a[0], a[1], a[2]);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seedOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Creates the 3D view. Throws if WebGL is unavailable.
 * hooks: onPick(id | null), onHover(id | null), onEvent(index), onUserCamera(kind)
 */
export function createScene({ canvas, stage, overlay, reducedMotion, hooks }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x03050a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 80000);
    const controls = new OrbitControls(camera, canvas);
    Object.assign(controls, {
        enableDamping: true, dampingFactor: 0.09, rotateSpeed: 0.55, zoomSpeed: 1.1, panSpeed: 0.85,
        screenSpacePanning: true, minDistance: 0.6, maxDistance: MAX_DISTANCE, keyPanSpeed: 18
    });
    controls.listenToKeyEvents(canvas);

    let width = 1, height = 1, offsetY = 0, dirty = true, visible = true, renders = 0;
    let selected = null, hovered = null, tween = null, follow = false;
    const lineMaterials = new Set();
    controls.addEventListener('change', () => { dirty = true; });

    /* ---------- Sky ---------- */
    (function stars() {
        const rand = rng(11);
        const layer = (n, size, spread) => {
            const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                let x, y, z;
                if (spread) {   // a faint band, like the galaxy seen edge-on
                    const t = rand() * Math.PI * 2, h = (rand() + rand() + rand() - 1.5) * spread;
                    x = Math.cos(t); y = h; z = Math.sin(t);
                    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
                    [y, z] = [y * 0.88 - z * 0.47, y * 0.47 + z * 0.88];
                } else {
                    z = rand() * 2 - 1; const t = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
                    x = r * Math.cos(t); y = z; z = r * Math.sin(t);
                }
                pos.set([x * 30000, y * 30000, z * 30000], i * 3);
                const b = 0.35 + 0.65 * Math.pow(rand(), 2.2), tint = rand();
                col.set(tint < 0.2 ? [b * 0.8, b * 0.88, b] : tint > 0.88 ? [b, b * 0.9, b * 0.75] : [b, b, b], i * 3);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: spread ? 0.5 : 0.95, depthWrite: false }));
        };
        scene.add(layer(2600, 1.3), layer(300, 2.2), layer(2400, 1.1, 0.16));
    })();

    /* ---------- Kerbol ---------- */
    const sphere = new THREE.SphereGeometry(1, 48, 32);
    const sun = body('kerbol');
    const sunMesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    sunMesh.scale.setScalar(sun.radius);
    scene.add(sunMesh);
    const glowTex = new THREE.CanvasTexture(glowCanvas('rgba(255,240,205,1)', 'rgba(255,196,110,0.45)'));
    glowTex.colorSpace = THREE.SRGBColorSpace;
    [[sun.radius * 6, 0.9], [sun.radius * 26, 0.28]].forEach(([size, opacity]) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, opacity, depthWrite: false }));
        s.scale.setScalar(size);
        scene.add(s);
    });
    scene.add(new THREE.PointLight(0xfff3e2, 3.4, 0, 0));
    scene.add(new THREE.AmbientLight(0x9db2d4, 0.6));

    /* ---------- Bodies ---------- */
    const meshes = new Map();
    const textureQueue = [];
    for (const b of BODIES) {
        if (b.kind === 'star') continue;
        const p = vec(position(b.id));
        const mat = new THREE.MeshStandardMaterial({ color: b.look.base, roughness: 1, metalness: 0 });
        const mesh = new THREE.Mesh(sphere, mat);
        mesh.scale.setScalar(b.radius);
        mesh.position.copy(p);
        mesh.rotation.set(0.2, seedOf(b.id) % 6, 0);
        scene.add(mesh);
        meshes.set(b.id, mesh);
        textureQueue.push(b);
        if (b.look.atmo) {
            const atmo = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: b.look.atmo, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false }));
            atmo.scale.setScalar(b.radius * 1.09);
            atmo.position.copy(p);
            scene.add(atmo);
        }
        if (b.look.rings) {
            const { inner, outer } = b.look.rings;
            const g = new THREE.RingGeometry(inner, outer, 180, 1);
            const pos = g.attributes.position, uv = g.attributes.uv;
            for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
            const tex = new THREE.CanvasTexture(ringCanvas(b.look, seedOf(b.id)));
            tex.colorSpace = THREE.SRGBColorSpace;
            const ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 }));
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(p);
            scene.add(ring);
        }
    }
    // Surface textures are drawn a few at a time after the first frame, so the map appears at once
    function drawNextTexture() {
        const b = textureQueue.shift();
        if (!b) return;
        const tex = new THREE.CanvasTexture(surfaceCanvas(b.look, seedOf(b.id), b.kind === 'planet' ? 512 : 256));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const mat = meshes.get(b.id).material;
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        dirty = true;
        setTimeout(drawNextTexture, 0);
    }

    /* ---------- Orbits ---------- */
    const orbits = new Map();
    const loop = (pts, color, opacity) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts.map(vec));
        const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
        scene.add(line);
        return line;
    };
    for (const b of BODIES) {
        if (!b.parent) continue;
        const planet = b.kind === 'planet';
        const line = loop(orbitPath(b.id, planet ? 360 : 160), planet ? 0x3f5b82 : 0x4d6a92, planet ? 0.75 : 0.6);
        orbits.set(b.id, { line, base: line.material.opacity, color: line.material.color.getHex() });
    }
    const kerbin = body('kerbin');
    const lkoR = REGIONS.find(r => r.id === 'lko').alt * kerbin.radius;
    const circle = (center, r, n = 128) => Array.from({ length: n }, (_, i) => {
        const d = dir(i / n * 360);
        return [center[0] + d[0] * r, center[1], center[2] + d[2] * r];
    });
    const lkoLine = loop(circle(position('kerbin'), lkoR), 0x5aa9ff, 0.28);

    /* ---------- Labels and markers (HTML over the canvas) ---------- */
    const items = [];
    function addLabel(id, name, kind, world, radius, rank) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `mm-label is-${kind}`;
        el.dataset.id = id;
        el.tabIndex = -1;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="mm-label-dot"></span><span class="mm-label-name"></span>';
        el.lastChild.textContent = name;
        el.addEventListener('click', e => { e.stopPropagation(); hooks.onPick(id); });
        el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hooks.onHover(id); });
        el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hooks.onHover(null); });
        overlay.appendChild(el);
        items.push({ id, el, kind, world, radius, rank, w: 0, screen: null, shown: false, px: 0 });
    }
    for (const b of BODIES) addLabel(b.id, b.name, b.kind, position(b.id), b.radius, b.kind === 'star' ? 0 : b.kind === 'planet' ? 1 : 3);
    const kp = position('kerbin');
    for (const r of REGIONS.filter(r => r.parent === 'kerbin')) {
        const angle = r.angle !== undefined ? r.angle : -55;
        const d = dir(angle);
        addLabel(r.id, r.name, r.kind, [kp[0] + d[0] * lkoR, kp[1], kp[2] + d[2] * lkoR], 0, 2);
    }
    const itemById = new Map(items.map(i => [i.id, i]));

    const ring = cls => {
        const el = document.createElement('div');
        el.className = `mm-ring ${cls}`;
        el.hidden = true;
        overlay.appendChild(el);
        return el;
    };
    const selectRing = ring('is-selected'), hoverRing = ring('is-hover');
    const focusRings = [ring('is-focus'), ring('is-focus'), ring('is-focus')];

    const tmp = new THREE.Vector3();
    const tanHalf = Math.tan(FOV * Math.PI / 360);
    function project(world) {
        tmp.set(world[0], world[1], world[2]);
        const d = camera.position.distanceTo(tmp);
        tmp.project(camera);
        return { x: (tmp.x + 1) / 2 * width, y: (1 - tmp.y) / 2 * height, behind: tmp.z > 1 || tmp.z < -1, dist: d };
    }
    const pxRadius = (r, dist) => r * height / (2 * dist * tanHalf);
    const camDist = id => camera.position.distanceTo(tmp.set(...position(id)));

    // Which labels may show: planets always, moons when their planet is near or selected, Kerbin's orbit
    // places when Kerbin is close
    function labelAllowed(it) {
        if (it.kind === 'star' || it.kind === 'planet') return true;
        const chain = selected ? [selected, ...lineageOf(selected)] : [];
        if (it.kind === 'moon') {
            const parent = body(it.id).parent;
            return chain.includes(parent) || chain.includes(it.id) || camDist(parent) < systemExtent(parent) * 13;
        }
        return chain.includes('kerbin') || chain.includes(it.id) || camDist('kerbin') < 75;
    }
    // Ancestors of a body or region, nearest first (a region's own planet included)
    const lineageOf = id => {
        const out = [], r = REGIONS.find(x => x.id === id);
        let b = body(r ? r.parent : id);
        if (r && b) out.push(b.id);
        for (b = b && body(b.parent); b; b = body(b.parent)) out.push(b.id);
        return out;
    };

    function placeRing(el, it, extra = 12, min = 20) {
        if (!it || !it.screen || it.screen.behind) { el.hidden = true; return; }
        let r = it.px;
        if (it.id === 'lko') { r = pxRadius(lkoR, camDist('kerbin')); it = { screen: project(position('kerbin')) }; }
        const size = Math.max(min, r * 2 + extra);
        el.hidden = false;
        el.style.transform = `translate(${it.screen.x - size / 2}px, ${it.screen.y - size / 2}px)`;
        el.style.width = el.style.height = `${size}px`;
    }

    function updateOverlay() {
        const rects = [];
        const order = items.slice().sort((a, b) => {
            const pa = a.id === selected ? -2 : a.id === hovered ? -1 : a.rank, pb = b.id === selected ? -2 : b.id === hovered ? -1 : b.rank;
            return pa - pb || b.radius - a.radius;
        });
        for (const it of order) {
            const s = project(it.world);
            it.screen = s;
            it.px = pxRadius(it.radius, s.dist);
            const onScreen = !s.behind && s.x > -40 && s.x < width + 40 && s.y > -20 && s.y < height + 20;
            let show = onScreen && labelAllowed(it);
            if (!it.w && show) { it.el.hidden = false; it.w = it.el.lastChild.offsetWidth + 16; }
            const off = Math.max(it.px, 3) + LABEL_GAP;
            const rect = [s.x - 6, s.y - 9, s.x + off + it.w, s.y + 9];
            if (show && it.id !== selected && it.id !== hovered && rects.some(r => r[0] < rect[2] && r[2] > rect[0] && r[1] < rect[3] && r[3] > rect[1])) show = false;
            if (show) rects.push(rect);
            it.shown = show;
            it.pickable = onScreen && (show || it.px >= 2);
            it.el.hidden = !show;
            if (show) {
                it.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
                it.el.style.setProperty('--off', `${off}px`);
                it.el.classList.toggle('has-dot', it.px < 3.5);
                it.el.classList.toggle('is-selected', it.id === selected);
                it.el.classList.toggle('is-hover', it.id === hovered);
            }
        }
        placeRing(selectRing, itemById.get(selected));
        if (hovered && hovered !== selected) placeRing(hoverRing, itemById.get(hovered)); else hoverRing.hidden = true;
        updateRouteOverlay();
    }

    /* ---------- Picking and pointer input ---------- */
    function pick(x, y) {
        let best = null, score = Infinity;
        if (route) for (const m of route.markers) {
            if (!m.screen || m.screen.behind) continue;
            const d = Math.hypot(x - m.screen.x, y - m.screen.y);
            if (d < 12 && d / 12 < score) { best = { event: m.events[0] }; score = d / 12; }
        }
        for (const it of items) {
            if (!it.pickable) continue;
            const r = Math.max(it.px, 9) + 4, d = Math.hypot(x - it.screen.x, y - it.screen.y);
            if (d <= r && d / r < score) { best = it.id; score = d / r; }
        }
        return best;
    }

    const pointers = new Map();
    let press = null;
    canvas.addEventListener('pointerdown', e => {
        pointers.set(e.pointerId, e.pointerType);
        cancelTween();
        if (pointers.size > 1) hooks.onUserCamera('zoom');
        else if (e.button === 2 || e.ctrlKey || e.metaKey || e.shiftKey) hooks.onUserCamera('pan');
        press = pointers.size === 1 && e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
    });
    const release = e => {
        pointers.delete(e.pointerId);
        if (e.type === 'pointerup' && press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 7 && performance.now() - press.t < 700) {
            const r = canvas.getBoundingClientRect(), hit = pick(e.clientX - r.left, e.clientY - r.top);
            if (hit && hit.event !== undefined) hooks.onEvent(hit.event);
            else hooks.onPick(hit);
        }
        press = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', () => { cancelTween(); hooks.onUserCamera('zoom'); }, { passive: true });
    canvas.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || e.buttons) return;
        const r = canvas.getBoundingClientRect(), hit = pick(e.clientX - r.left, e.clientY - r.top);
        const id = typeof hit === 'string' ? hit : null;
        canvas.style.cursor = hit ? 'pointer' : '';
        if (id !== hovered) hooks.onHover(id);
    });
    canvas.addEventListener('pointerleave', () => { if (hovered) hooks.onHover(null); });
    canvas.addEventListener('keydown', e => {
        if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
            e.preventDefault();
            hooks.onUserCamera('zoom');
            const off = camera.position.clone().sub(controls.target);
            off.setLength(THREE.MathUtils.clamp(off.length() * (e.key === '-' || e.key === '_' ? 1.25 : 0.8), controls.minDistance, MAX_DISTANCE));
            camera.position.copy(controls.target).add(off);
            dirty = true;
        } else if (e.key.startsWith('Arrow')) hooks.onUserCamera('pan');
    });

    /* ---------- Camera moves ---------- */
    function cancelTween() {
        if (!tween) return;
        tween = null;
        controls.enabled = true;
    }
    function moveCamera(target, distance, { direction, instant } = {}) {
        follow = false;
        // Use up any drag momentum first, so it doesn't nudge the camera once the move has finished
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        const t = vec(target);
        let d = direction ? direction.clone() : camera.position.clone().sub(controls.target).normalize();
        if (!isFinite(d.x) || d.lengthSq() < 0.5) d = VIEW_DIR.clone();
        if (Math.abs(d.y) < 0.28) { d.y = 0.28 * Math.sign(d.y || 1); d.normalize(); }
        const pos = t.clone().addScaledVector(d, THREE.MathUtils.clamp(distance, controls.minDistance, MAX_DISTANCE));
        if (instant || reducedMotion()) {
            tween = null;
            controls.enabled = true;
            controls.target.copy(t);
            camera.position.copy(pos);
            controls.update();
        } else {
            tween = { t: 0, dur: 1.1, p0: camera.position.clone(), q0: controls.target.clone(), p1: pos, q1: t };
            controls.enabled = false;
        }
        dirty = true;
    }
    // Distance at which a sphere of radius r fills most of the view (the panel sheet is allowed for)
    function fitDistance(r, flat = false) {
        const usable = Math.max(0.35, 1 - (2 * offsetY) / height);
        const v = Math.atan(tanHalf * usable), h = Math.atan(tanHalf * camera.aspect);
        const vr = flat ? r * 0.8 : r;
        return Math.max(vr / Math.sin(v), r / Math.sin(h)) * 1.02;
    }
    function viewDistance(id) {
        const r = REGIONS.find(x => x.id === id);
        if (r && r.parent === 'kerbin') return fitDistance(lkoR * 2.2);
        if (id === 'solar') return fitDistance(VIEWS.system, true);
        const b = body(id);
        if (b.kind === 'star') return fitDistance(VIEWS.inner, true);
        return fitDistance(Math.max(systemExtent(id) * 1.15, b.radius * (b.kind === 'moon' ? 4 : 3.2)));
    }
    function focusPlace(id, opts = {}) {
        const r = REGIONS.find(x => x.id === id);
        if (id === 'solar' || id === 'kerbol') return overview(id === 'solar' ? 'system' : 'inner', opts);
        moveCamera(position(r ? r.parent : id), viewDistance(id), opts);
    }
    function overview(kind = 'system', opts = {}) {
        moveCamera([0, 0, 0], fitDistance(VIEWS[kind] || VIEWS.system, true), { ...opts, direction: VIEW_DIR });
    }

    /* ---------- Mission routes ---------- */
    let route = null;
    function lineMaterial(opts) {
        const m = new LineMaterial({ worldUnits: false, transparent: true, depthWrite: false, ...opts });
        m.resolution.set(width, height);
        lineMaterials.add(m);
        return m;
    }
    function line(points, material) {
        const g = new LineGeometry();
        g.setPositions(points.flat());
        const l = new Line2(g, material);
        l.computeLineDistances();
        return l;
    }
    function marker(cls, text) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = cls;
        el.tabIndex = -1;
        el.setAttribute('aria-hidden', 'true');
        if (text) el.textContent = text;
        overlay.appendChild(el);
        return el;
    }

    /**
     * Draws a mission: model = { color, actual (route geometry or null), planned: [geometry], ghost (true when
     * only a planned route exists), events: [{ at, noMarker, focus }], endOrbit }
     */
    function showMission(model) {
        clearMission();
        const group = new THREE.Group();
        const color = new THREE.Color(model.color);
        const mats = {
            ghost: lineMaterial({ color, linewidth: 1.4, opacity: 0.22 }),
            schematic: lineMaterial({ color, linewidth: 2.6, opacity: 1, dashed: true, dashSize: 1, gapSize: 0.55 }),
            documented: lineMaterial({ color, linewidth: 2.6, opacity: 1 }),
            planned: lineMaterial({ color: 0xdbe6f5, linewidth: 1.6, opacity: 0.8, dashed: true, dashSize: 0.4, gapSize: 0.75 }),
            end: lineMaterial({ color, linewidth: 1.2, opacity: 0.55, dashed: true, dashSize: 0.5, gapSize: 0.8 })
        };
        const main = model.ghost ? model.planned[0] : model.actual;
        const legs = [];
        if (main && !model.ghost) {
            main.legs.forEach(l => {
                const ghost = line(l.points, mats.ghost), bright = line(l.points, l.basis === 'documented' ? mats.documented : mats.schematic);
                group.add(ghost, bright);
                legs.push({ bright, leg: l, segments: l.points.length - 1 });
            });
        }
        const tags = [];
        model.planned.forEach(p => {
            p.legs.forEach(l => group.add(line(l.points, mats.planned)));
            const last = p.places[p.places.length - 1];
            const tag = document.createElement('div');
            tag.className = 'mm-tag';
            tag.textContent = p.label;
            overlay.appendChild(tag);
            tags.push({ el: tag, world: last.pos });
        });
        let endRing = null;
        if (model.endOrbit && main && !model.ghost) {
            const last = main.places[main.places.length - 1];
            const c = last.solar ? [0, 0, 0] : position(last.body);
            const r = Math.hypot(last.pos[0] - c[0], last.pos[2] - c[2]);
            const pts = circle(c, r, 160);
            pts.push(pts[0]);
            endRing = line(pts.map(p => [p[0], last.pos[1], p[2]]), mats.end);
            endRing.visible = false;
            group.add(endRing);
        }
        // One marker per place that has events; a marker lists every event at that place
        const markers = [];
        model.events.forEach((e, k) => {
            if (e.noMarker || !main) return;
            const pos = pointAt(main, e.at);
            if (!pos) return;
            const same = markers.find(m => Math.abs(m.at - e.at) < 1e-6);
            if (same) { same.events.push(k); return; }
            const el = marker('mm-event');
            el.addEventListener('click', ev => { ev.stopPropagation(); hooks.onEvent(Number(el.dataset.event)); });
            el.dataset.event = k;
            markers.push({ el, at: e.at, world: pos, events: [k], screen: null });
        });
        const craft = document.createElement('div');
        craft.className = `mm-craft${model.ghost ? ' is-ghost' : ''}`;
        craft.style.setProperty('--route', model.color);
        overlay.appendChild(craft);
        scene.add(group);
        route = { model, main, group, mats, legs, tags, endRing, markers, craft, craftWorld: main ? pointAt(main, 0) : null, routePos: 0, current: -1, focus: [] };
        dirty = true;
    }

    function clearMission() {
        if (!route) return;
        scene.remove(route.group);
        route.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        Object.values(route.mats).forEach(m => { m.dispose(); lineMaterials.delete(m); });
        route.tags.forEach(t => t.el.remove());
        route.markers.forEach(m => m.el.remove());
        route.craft.remove();
        focusRings.forEach(r => { r.hidden = true; });
        route = null;
        follow = false;
        dirty = true;
    }

    /** Replay state: how far along the route, which event is current, which bodies to highlight */
    function setReplay(routePos, current, focus = []) {
        if (!route) return;
        route.routePos = routePos;
        route.current = current;
        route.focus = focus;
        const n = route.legs.length, idx = Math.floor(routePos + 1e-9);
        route.legs.forEach((l, i) => {
            let count = 0;
            if (i < idx) count = l.segments;
            else if (i === idx && routePos - i > 1e-9) {
                const d = Math.min(1, routePos - i) * l.leg.length, cum = l.leg.cum;
                count = Math.max(1, cum.findIndex(c => c >= d - 1e-9));
                if (count < 0) count = l.segments;
            }
            l.bright.geometry.instanceCount = count;
            l.bright.visible = count > 0;
        });
        if (route.endRing) route.endRing.visible = n > 0 && routePos >= n - 1e-6;
        route.craftWorld = route.main ? pointAt(route.main, routePos) : null;
        dirty = true;
    }

    // True when a body lies between the camera and the point, so its marker is drawn dimmed
    const ray = new THREE.Ray(), hit = new THREE.Vector3(), pt = new THREE.Vector3(), ball = new THREE.Sphere();
    const centres = BODIES.map(b => ({ c: vec(position(b.id)), r: b.radius }));
    function hidden(world) {
        pt.set(world[0], world[1], world[2]);
        const far = camera.position.distanceTo(pt);
        ray.origin.copy(camera.position);
        ray.direction.copy(pt).sub(camera.position).normalize();
        for (const { c, r } of centres) {
            if (c.distanceTo(pt) < r * 1.02) continue;   // on the surface of this body: not behind it
            ball.set(c, r * 0.98);
            if (ray.intersectSphere(ball, hit) && camera.position.distanceTo(hit) < far) return true;
        }
        return false;
    }

    function updateRouteOverlay() {
        focusRings.forEach((el, i) => {
            const id = route && route.focus[i];
            placeRing(el, id ? itemById.get(id) : null, 14, 26);
        });
        if (!route) return;
        route.markers.forEach(m => {
            const s = project(m.world);
            m.screen = s;
            const show = !s.behind && s.x > -20 && s.x < width + 20 && s.y > -20 && s.y < height + 20;
            m.el.hidden = !show;
            if (!show) return;
            m.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
            const past = m.events.every(k => k < route.current), now = m.events.includes(route.current);
            m.el.classList.toggle('is-past', past && !now);
            m.el.classList.toggle('is-behind', hidden(m.world));
            m.el.classList.toggle('is-current', now);
            m.el.dataset.event = m.events[0];
        });
        route.tags.forEach(t => {
            const s = project(t.world);
            t.el.hidden = s.behind;
            t.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
        });
        if (route.craftWorld) {
            const s = project(route.craftWorld);
            route.craft.hidden = s.behind;
            route.craft.style.transform = `translate(${s.x}px, ${s.y}px)`;
            route.craft.classList.toggle('is-behind', hidden(route.craftWorld));
        } else route.craft.hidden = true;
    }

    function frameRoute(opts = {}) {
        if (!route) return;
        const pts = [];
        if (route.main) route.main.legs.forEach(l => pts.push(...l.points));
        route.model.planned.forEach(p => p.legs.forEach(l => pts.push(...l.points)));
        if (route.main && !pts.length) pts.push(route.main.places[0].pos);
        if (!pts.length) {
            const f = route.model.events.flatMap(e => e.focus || []);
            if (f.length) focusPlace(f[0], opts);
            return;
        }
        const box = new THREE.Box3().setFromPoints(pts.map(vec)), sphereB = box.getBoundingSphere(new THREE.Sphere());
        moveCamera(sphereB.center.toArray(), Math.max(fitDistance(sphereB.radius * 1.1), 12), opts);
    }

    function setFollow(on) {
        follow = !!on && !!route;
        if (follow) cancelTween();
        dirty = true;
    }

    /* ---------- Frame ---------- */
    // Zooming stops well before the surface of the body the camera is centred on; anywhere else the camera
    // is still kept out of every body
    function keepOutOfBodies() {
        let min = 0.6;
        for (const b of BODIES) if (controls.target.distanceTo(tmp.set(...position(b.id))) < b.radius) min = Math.max(min, b.radius * 2.1);
        controls.minDistance = min;
        for (const b of BODIES) {
            const c = tmp.set(...position(b.id)), d = camera.position.distanceTo(c), min = b.radius * 1.35;
            if (d < min) {
                camera.position.sub(c).setLength(min).add(c);
                dirty = true;
            }
        }
    }

    function frame(dt) {
        if (tween) {
            tween.t = Math.min(1, tween.t + dt / tween.dur);
            const k = easeInOut(tween.t);
            camera.position.lerpVectors(tween.p0, tween.p1, k);
            controls.target.lerpVectors(tween.q0, tween.q1, k);
            if (tween.t >= 1) { tween = null; controls.enabled = true; }
            dirty = true;
        } else if (follow && route && route.craftWorld) {
            const k = 1 - Math.exp(-dt * 3.2);
            const goal = vec(route.craftWorld), before = controls.target.clone();
            controls.target.lerp(goal, k);
            camera.position.add(controls.target.clone().sub(before));
            const off = camera.position.clone().sub(controls.target);
            const want = route.main.legs.length ? viewDistanceAt(route.main, route.routePos) : 30;
            off.setLength(THREE.MathUtils.lerp(off.length(), Math.min(want, MAX_DISTANCE), k));
            camera.position.copy(controls.target).add(off);
            dirty = true;
        }
        if (!tween) controls.update(dt);
        keepOutOfBodies();
        if (!visible || !dirty) return;
        if (route) {
            const worldPerPx = 2 * camera.position.distanceTo(controls.target) * tanHalf / height;
            const scale = 1 / (DASH_PX * worldPerPx);
            ['schematic', 'planned', 'end'].forEach(k => { route.mats[k].dashScale = scale; });
        }
        // Moon orbits fade in as the camera nears their planet
        orbits.forEach((o, id) => {
            const b = body(id);
            const highlight = id === selected || id === hovered;
            o.line.material.color.setHex(highlight ? 0x9cc3ff : o.color);
            let op = o.base;
            if (b.kind === 'moon') op *= THREE.MathUtils.clamp(systemExtent(b.parent) * 30 / camDist(b.parent) - 0.4, 0, 1);
            o.line.material.opacity = highlight ? Math.max(0.95, op) : op;
            o.line.visible = o.line.material.opacity > 0.01;
        });
        const lkoOn = selected === 'lko' || hovered === 'lko' || selected === 'kgoss';
        lkoLine.material.opacity = (lkoOn ? 0.75 : 0.28) * THREE.MathUtils.clamp(140 / camDist('kerbin') - 0.3, 0, 1);
        renderer.render(scene, camera);
        renders++;
        updateOverlay();
        dirty = false;
        if (renders === 1) setTimeout(drawNextTexture, 60);
    }

    function resize() {
        const r = stage.getBoundingClientRect();
        width = Math.max(1, Math.round(r.width));
        height = Math.max(1, Math.round(r.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        applyOffset();
        lineMaterials.forEach(m => m.resolution.set(width, height));
        dirty = true;
    }
    function applyOffset() {
        if (offsetY) camera.setViewOffset(width, height, 0, offsetY, width, height);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();
    }
    /** Keeps the view centred above a panel that covers the bottom `px` of the map */
    function setBottomInset(px) {
        const next = Math.round(px / 2);
        if (next === offsetY) return;
        offsetY = next;
        applyOffset();
        dirty = true;
    }

    resize();
    overview('system', { instant: true });

    return {
        frame, resize, setBottomInset, pick, overview, focusPlace, showMission, clearMission, setReplay, setFollow, frameRoute,
        select(id) { selected = id; dirty = true; },
        hover(id) { hovered = id; dirty = true; },
        setVisible(v) { visible = v; dirty = true; },
        get following() { return follow; },
        dispose() {
            clearMission();
            controls.dispose();
            scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
            renderer.dispose();
        },
        // For tests and debugging
        debug() {
            return {
                renders, selected, hovered, follow, tween: !!tween,
                memory: { ...renderer.info.memory }, programs: renderer.info.programs ? renderer.info.programs.length : 0,
                pixelRatio: renderer.getPixelRatio(),
                camera: camera.position.toArray(), target: controls.target.toArray(),
                distance: camera.position.distanceTo(controls.target),
                meshes: meshes.size, orbits: orbits.size, texturesLeft: textureQueue.length,
                labels: items.filter(i => i.shown).map(i => i.id),
                screen: Object.fromEntries(items.filter(i => i.screen).map(i => [i.id, { x: i.screen.x, y: i.screen.y, px: i.px, shown: i.shown, behind: i.screen.behind }])),
                route: route && {
                    routePos: route.routePos, current: route.current, craft: route.craftWorld,
                    revealed: route.legs.map(l => (l.bright.visible ? l.bright.geometry.instanceCount : 0)), segments: route.legs.map(l => l.segments),
                    endRing: route.endRing ? route.endRing.visible : null, markers: route.markers.length, tags: route.tags.map(t => t.el.textContent)
                }
            };
        }
    };
}
