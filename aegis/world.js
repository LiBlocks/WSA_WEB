// Aegis Landing Simulator: the 3D scene (three.js r186, vendored in vendor/three). It draws the physics state
// and never changes it. The booster comes from vehicle.js's model factory, so a finished Aegis model can
// replace the placeholder without changes here.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createModel, VEHICLE } from './vehicle.js';
import { axisOf, DIFFICULTY } from './physics.js';

const UP = new THREE.Vector3(0, 1, 0);

function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
}

function grassTex() {
    return canvasTex(256, 256, (g, w, h) => {
        const r = rng(3);
        g.fillStyle = '#5b7a46';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
            const v = r();
            g.fillStyle = v < 0.5 ? `rgba(40,62,30,${0.1 + r() * 0.15})` : `rgba(140,160,90,${0.06 + r() * 0.1})`;
            g.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4);
        }
    }, 160);
}

function padTex() {
    return canvasTex(1024, 1024, (g, w) => {
        const r = rng(8), c = w / 2;
        g.fillStyle = '#a9adb1';
        g.fillRect(0, 0, w, w);
        for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * w, 3, 3); }
        // Concrete slabs, scorch, then the markings
        g.strokeStyle = 'rgba(60,64,70,0.35)';
        g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, w); g.stroke(); g.beginPath(); g.moveTo(0, i * w / 8); g.lineTo(w, i * w / 8); g.stroke(); }
        const sc = g.createRadialGradient(c, c, 0, c, c, w * 0.28);
        sc.addColorStop(0, 'rgba(30,30,30,0.55)');
        sc.addColorStop(1, 'rgba(30,30,30,0)');
        g.fillStyle = sc;
        g.fillRect(0, 0, w, w);
        g.strokeStyle = '#f4f4ee';
        g.lineWidth = 22;
        g.beginPath(); g.arc(c, c, w * 0.43, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 8;
        g.beginPath(); g.arc(c, c, w * 0.12, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#f4f4ee';
        g.fillRect(c - 7, c - w * 0.3, 14, w * 0.6);
        g.fillRect(c - w * 0.3, c - 7, w * 0.6, 14);
        g.fillStyle = '#1e3a8a';
        g.font = 'bold 84px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('WSA', c, c + w * 0.36);
    });
}

const softDot = () => canvasTex(64, 64, g => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
});

/* ---------- Exhaust ---------- */

const PLUME_VERT = `varying vec2 vUv; varying float vF;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal);
 vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const PLUME_FRAG = `uniform float uTime; uniform float uPower; uniform vec3 uCore; uniform vec3 uEdge; varying vec2 vUv; varying float vF;
void main(){ float along = 1.0 - vUv.y; float fl = 0.85 + 0.15 * sin(uTime * 51.0 + along * 20.0) * sin(uTime * 33.0 + vUv.x * 27.0);
 float a = pow(1.0 - along, 1.5) * pow(vF, 1.3) * uPower * fl; vec3 col = mix(uCore, uEdge, smoothstep(0.0, 0.75, along));
 gl_FragColor = vec4(col * (1.0 + 0.5 * (1.0 - along)), a); }`;

function plume(radius) {
    const geo = new THREE.CylinderGeometry(radius * 0.85, radius * 1.7, 1, 20, 1, true);
    geo.translate(0, -0.5, 0);
    const mk = (core, edge) => new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) } },
        vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(geo, mk('#fff1d0', '#ff8a2a'));
    const inner = new THREE.Mesh(geo, mk('#ffffff', '#ffd27a'));
    inner.scale.set(0.5, 1, 0.5);
    const g = new THREE.Group();
    g.add(outer, inner);
    g.visible = false;
    g.userData.set = (power, time) => {
        g.visible = power > 0.01;
        if (!g.visible) return;
        g.scale.set(0.8 + 0.25 * power, 4 + 12 * power, 0.8 + 0.25 * power);
        for (const m of [outer.material, inner.material]) { m.uniforms.uTime.value = time; m.uniforms.uPower.value = Math.min(1, power * 1.1); }
    };
    return g;
}

function particles(count, color, tex) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, map: tex, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false }));
    pts.frustumCulled = false;
    const base = new THREE.Color(color);
    const ps = Array.from({ length: count }, () => ({ life: 1, max: 0, p: [0, -1e4, 0], v: [0, 0, 0] }));
    let next = 0;
    const r = rng(17);
    return {
        obj: pts,
        emit(o, dir, speed, spread, n, life) {
            for (let i = 0; i < n; i++) {
                const q = ps[next];
                next = (next + 1) % count;
                q.life = 0; q.max = life * (0.6 + 0.8 * r()); q.p = o.slice();
                q.v = [dir[0] * speed + (r() - 0.5) * spread, dir[1] * speed + r() * spread * 0.3, dir[2] * speed + (r() - 0.5) * spread];
            }
        },
        update(dt) {
            for (let i = 0; i < count; i++) {
                const q = ps[i];
                if (q.life >= q.max) { pos[i * 3 + 1] = -1e4; continue; }
                q.life += dt;
                for (let k = 0; k < 3; k++) { q.v[k] *= Math.exp(-1.4 * dt); q.p[k] += q.v[k] * dt; }
                q.v[1] += 1.5 * dt;
                pos[i * 3] = q.p[0]; pos[i * 3 + 1] = Math.max(0.3, q.p[1]); pos[i * 3 + 2] = q.p[2];
                const f = 1 - q.life / q.max;
                col[i * 3] = base.r * f; col[i * 3 + 1] = base.g * f; col[i * 3 + 2] = base.b * f;
            }
            geo.attributes.position.needsUpdate = true;
            geo.attributes.color.needsUpdate = true;
        },
        clear() { for (const q of ps) q.life = q.max = 0; },
    };
}

/* ---------- World ---------- */

export const CAMERAS = ['follow', 'side', 'pad', 'free'];
export const CAMERA_NAMES = { follow: 'Follow', side: 'Side view', pad: 'Pad view', free: 'Free camera' };

export function createWorld(canvas, labelLayer) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d3ea');
    scene.fog = new THREE.Fog('#c3d8ea', 1500, 9000);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 30000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 12;
    controls.maxDistance = 2500;
    controls.enabled = false;

    // Sky dome: a vertical gradient that follows the camera
    const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color('#4f86c6') }, hor: { value: new THREE.Color('#d5e5f2') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.5)), 1.0); }',
        side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    scene.add(sky);

    const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 600;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight('#dbe8ff', '#4f6340', 1.1));

    // Ground, distant hills and the landing pad
    const ground = new THREE.Mesh(new THREE.CircleGeometry(12000, 96), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    {
        const r = rng(5);
        const hillMat = new THREE.MeshStandardMaterial({ color: '#6c8459', flatShading: true, roughness: 1 });
        for (let i = 0; i < 26; i++) {
            const a = i / 26 * Math.PI * 2 + r() * 0.2, d = 4200 + r() * 2600, hgt = 220 + r() * 520;
            const hill = new THREE.Mesh(new THREE.ConeGeometry(500 + r() * 700, hgt, 7), hillMat);
            hill.position.set(Math.cos(a) * d, hgt / 2 - 20, Math.sin(a) * d);
            scene.add(hill);
        }
    }
    const pad = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(18, 18.6, 1, 64), [
        new THREE.MeshStandardMaterial({ color: '#8f9399', roughness: 0.95 }),
        new THREE.MeshStandardMaterial({ map: padTex(), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: '#8f9399' }),
    ]);
    slab.position.y = -0.5 + 0.02;
    slab.receiveShadow = true;
    pad.add(slab);
    const lights = [];
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false }));
        l.position.set(Math.cos(a) * 18.3, 0.1, Math.sin(a) * 18.3);
        pad.add(l);
        lights.push(l);
    }
    // Windsock beside the pad
    const sock = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), new THREE.MeshStandardMaterial({ color: '#d9dde2' }));
    mast.position.y = 3.5;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#f97316', side: THREE.DoubleSide }));
    cone.rotation.z = Math.PI / 2;
    cone.position.x = 1.3;
    const coneHolder = new THREE.Group();
    coneHolder.position.y = 6.8;
    coneHolder.add(cone);
    sock.add(mast, coneHolder);
    sock.position.set(26, 0, -22);
    pad.add(sock);
    scene.add(pad);

    // Guidance markers: predicted free-fall impact (ring) and the descent trail
    const impact = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 40), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.9, depthWrite: false }));
    impact.rotation.x = -Math.PI / 2;
    impact.position.y = 0.15;
    scene.add(impact);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3000 * 3), 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#5ad1ff', transparent: true, opacity: 0.65 }));
    trail.frustumCulled = false;
    scene.add(trail);

    const dust = particles(500, '#cfc9bd', softDot());
    scene.add(dust.obj);

    // The booster: model from the factory, posed through a pivot so it can tip over a foot after landing
    const model = createModel(THREE, plume);
    const pivot = new THREE.Group();
    pivot.add(model.group);
    scene.add(pivot);

    const pinLabel = document.createElement('div');
    pinLabel.className = 'ag-label';
    pinLabel.textContent = 'PAD';
    labelLayer.appendChild(pinLabel);

    let size = { w: 1, h: 1 };
    let mode = 'follow';
    const camPos = new THREE.Vector3(-60, 30, 120);
    const camLook = new THREE.Vector3();
    let snapCam = true;
    let zoom = 1;

    function boosterCentre(s) {
        const ax = axisOf(s.pitch, s.roll);
        return new THREE.Vector3(s.pos[0] + ax[0] * 11, s.pos[1] + ax[1] * 11, s.pos[2] + ax[2] * 11);
    }

    const api = {
        renderer, camera, controls,
        get mode() { return mode; },
        setCamera(m) {
            if (!CAMERAS.includes(m)) return;
            mode = m;
            controls.enabled = m === 'free';
            snapCam = true;
            zoom = 1;
        },
        resetCamera() { snapCam = true; zoom = 1; if (mode === 'free') mode = 'follow'; controls.enabled = false; },
        zoomBy(f) { zoom = Math.min(4, Math.max(0.35, zoom * f)); if (mode === 'free') { const off = camera.position.clone().sub(controls.target); camera.position.copy(controls.target).add(off.multiplyScalar(f)); } },
        /** s: physics state; o: { time, dt, difficulty, guide } */
        update(s, o) {
            const d = DIFFICULTY[s.diff];
            pad.position.set(s.pad[0], 0, s.pad[1]);
            const base = new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]);
            model.setLegs(s.legs);
            if (s.tip && (s.phase === 'tipping' || s.phase === 'landed' || s.phase === 'toppled')) {
                const u = new THREE.Vector3(s.tip.u[0], 0, s.tip.u[1]);
                pivot.position.set(s.pos[0], 0, s.pos[2]).add(u.clone().multiplyScalar(s.tip.span));
                pivot.quaternion.setFromAxisAngle(new THREE.Vector3().crossVectors(UP, u).normalize(), s.tip.phi);
                model.group.position.copy(u.clone().multiplyScalar(-s.tip.span));
                model.group.quaternion.identity();
            } else if (s.phase === 'crashed') {
                pivot.position.set(s.pos[0], 0, s.pos[2]);
                pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.2);
                model.group.position.set(0, 0, 0);
                if (o.dt > 0) dust.emit([s.pos[0], 2, s.pos[2]], [0, 1, 0], 4, 6, 3, 5);
            } else {
                pivot.position.copy(base);
                pivot.quaternion.identity();
                model.group.position.set(0, 0, 0);
                const ax = axisOf(s.pitch, s.roll);
                model.group.quaternion.setFromUnitVectors(UP, new THREE.Vector3(ax[0], ax[1], ax[2]));
            }
            model.setEngine(s.phase === 'tipping' || s.result ? 0 : s.throttle, o.time);
            const h = s.pos[1];
            if (s.throttle > 0.05 && h < 60 && o.dt > 0 && !s.result) {
                const n = Math.ceil(s.throttle * 9 * (1 - h / 65) * Math.min(4, o.dt * 60));
                for (const dv of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0.7, 0, 0.7], [-0.7, 0, -0.7]]) dust.emit([s.pos[0], 0.5, s.pos[2]], dv, 30 * s.throttle * (1 - h / 70), 10, n, 3);
            }
            dust.update(o.dt);
            // Guidance: impact marker (Easy and Normal), blinking pad lights, trail
            impact.visible = d.guide.impact && !s.result && s.phase !== 'tipping';
            if (impact.visible) impact.position.set(o.impact[0], 0.15, o.impact[1]);
            const blink = Math.sin(o.time * 4) > 0;
            for (const l of lights) l.visible = blink || !!s.result;
            const tr = s.trackSide, arr = trailGeo.attributes.position.array;
            const n = Math.min(tr.length, 3000);
            for (let i = 0; i < n; i++) { const p = tr[tr.length - n + i]; arr[i * 3] = p[1]; arr[i * 3 + 1] = p[2] + 2; arr[i * 3 + 2] = p[3]; }
            trailGeo.attributes.position.needsUpdate = true;
            trailGeo.setDrawRange(0, n);
            const w = o.wind || [0, 0];
            const ws = Math.hypot(w[0], w[1]);
            coneHolder.rotation.y = Math.atan2(-w[1], w[0]);
            cone.rotation.z = Math.PI / 2 + (1 - Math.min(1, ws / 6)) * 0.9;

            // Cameras
            const centre = s.result || s.phase === 'tipping' ? new THREE.Vector3(s.pos[0], 9, s.pos[2]) : boosterCentre(s);
            const k = snapCam ? 1 : 1 - Math.exp(-(o.dtReal || 0.016) * 4);
            const toPad = new THREE.Vector3(s.pad[0] - s.pos[0], 0, s.pad[1] - s.pos[2]);
            if (toPad.lengthSq() < 1) toPad.set(1, 0, 0);
            toPad.normalize();
            let want;
            if (mode === 'follow') want = centre.clone().add(new THREE.Vector3(-toPad.x * 55, 16, -toPad.z * 55).multiplyScalar(zoom)).add(new THREE.Vector3(-toPad.z * 22, 0, toPad.x * 22).multiplyScalar(zoom));
            else if (mode === 'side') want = centre.clone().add(new THREE.Vector3(-toPad.z * 95, 4, toPad.x * 95).multiplyScalar(zoom));
            else if (mode === 'pad') want = new THREE.Vector3(s.pad[0] + 34 * zoom, 2.5, s.pad[1] + 30 * zoom);
            if (mode === 'free') {
                if (snapCam) { controls.target.copy(centre); camera.position.copy(centre.clone().add(new THREE.Vector3(-50, 20, 70))); }
                const delta = centre.clone().sub(controls.target);
                controls.target.add(delta);
                camera.position.add(delta);
                controls.update();
            } else {
                if (want.y < 1.5) want.y = 1.5;
                camPos.lerp(want, k);
                camLook.lerp(centre, snapCam ? 1 : 1 - Math.exp(-(o.dtReal || 0.016) * 6));
                camera.position.copy(camPos);
                camera.lookAt(camLook);
            }
            if (mode !== 'free') { controls.target.copy(camLook); }
            snapCam = false;
            sky.position.copy(camera.position);
            sun.position.copy(centre).add(new THREE.Vector3(80, 140, 50));
            sun.target.position.copy(centre);

            // Pad label projected onto the view
            const lp = new THREE.Vector3(s.pad[0], 3, s.pad[1]).project(camera);
            const vis = lp.z < 1 && Math.abs(lp.x) < 1.1 && Math.abs(lp.y) < 1.1;
            pinLabel.hidden = !vis || !!s.result;
            if (vis) pinLabel.style.transform = `translate(${((lp.x + 1) / 2 * size.w).toFixed(1)}px, ${((1 - lp.y) / 2 * size.h).toFixed(1)}px)`;
            return { padScreen: vis ? [(lp.x + 1) / 2, (1 - lp.y) / 2] : null };
        },
        render() { renderer.render(scene, camera); },
        resize(w, h) {
            size = { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
            renderer.setSize(size.w, size.h, false);
            camera.aspect = size.w / size.h;
            camera.updateProjectionMatrix();
        },
        reset() { dust.clear(); snapCam = true; },
        /** Points on screen for a world position, for the on-screen pad arrow. */
        project(p) { const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera); return { x: (v.x + 1) / 2 * size.w, y: (1 - v.y) / 2 * size.h, behind: v.z > 1 }; },
        cameraState: () => ({ pos: camera.position.toArray(), target: controls.target.toArray() }),
        vehicleHeight: VEHICLE.height,
    };
    return api;
}
