// The camera: a rig that resolves named poses against the moving worlds, composes each one round the space the
// page leaves free for it, and follows them with critically damped springs. In Explore mode the rig hands over
// to OrbitControls round the selected object, flying there first.
//
// Following. Every quantity (position, aim, field of view, lens offset) is a critically damped spring: a new
// destination is answered at once, the camera's speed carries over when the destination changes again mid-way,
// and it settles without overshoot. The page either jumps between sections (desktop: one pose per section) or
// slides along them (phones: a blend that follows the finger); the springs make both feel the same.
//
// Composing. A pose names its subject (a world) and how far its glow reaches. Given the free region the page
// leaves (home/main.js measures the section's panel), the lens is offset so the subject sits in the middle of
// that region, and the camera backs away if the subject (with its glow) wouldn't fit inside it. The panels never
// move; the camera makes room. Explore mode uses the same idea for its information panel or sheet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { POSES, MOOD_DOLLY } from './environments.js';

const UP = new THREE.Vector3(0, 1, 0);
const smooth = t => t * t * (3 - 2 * t);
const FOLLOW = { sections: 4.4, scroll: 7 };     // spring stiffness (rad/s): about 1.1 s and 0.7 s to settle

// One step of a critically damped spring toward a target (exact for a held target, stable at any frame time)
function spring(s, target, omega, dt) {
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const c = s.x - target;
    const t = (s.v + omega * c) * dt;
    s.v = (s.v - omega * t) * e;
    s.x = target + (c + t) * e;
    return s.x;
}
const scalar = x => ({ x, v: 0 });
const vector = () => ({ x: [scalar(0), scalar(0), scalar(0)] });
function springV(s, target, omega, dt, out) {
    out.set(spring(s.x[0], target.x, omega, dt), spring(s.x[1], target.y, omega, dt), spring(s.x[2], target.z, omega, dt));
    return out;
}
function snapV(s, v) {
    s.x[0].x = v.x; s.x[1].x = v.y; s.x[2].x = v.z;
    s.x.forEach(c => { c.v = 0; });
}
const speedV = s => Math.hypot(s.x[0].v, s.x[1].v, s.x[2].v);

// The lens offset: (sx, sy) is where the point the camera aims at lands, in normalized device coordinates
// (+x right, +y up). A view offset rather than a turned camera, so perspective stays straight.
export function setLens(cam, sx, sy) {
    if (Math.abs(sx) < 1e-5 && Math.abs(sy) < 1e-5) {
        if (cam.view && cam.view.enabled) cam.clearViewOffset();
        else cam.updateProjectionMatrix();
        return;
    }
    // (setViewOffset also sets the camera's aspect from the full size, so the full size keeps the real aspect)
    const H = 1000, W = H * (cam.aspect || 1);
    cam.setViewOffset(W, H, -sx * W / 2, sy * H / 2, W, H);
}

export class CameraRig {
    constructor(camera, system, canvas) {
        this.camera = camera;
        this.system = system;
        this.canvas = canvas;
        this.scroll = 0;                 // position along the homepage's path of poses (float index)
        this.path = ['home'];
        this.narrow = false;
        this.follow = 'scroll';
        this.regions = {};               // pose name -> free region {x0, x1, y0, y1} (fractions of the view)
        this.parallax = new THREE.Vector2();
        this.parallaxTarget = new THREE.Vector2();
        this.pos = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.fov = 34;
        this.sx = 0;
        this.sy = 0;
        this.orbits = 0.35;
        this.ready = false;
        this.explore = null;
        this.s = { pos: vector(), look: vector(), fov: scalar(34), sx: scalar(0), sy: scalar(0) };
        // scratch
        this._a = this.blank(); this._b = this.blank(); this._w = this.blank();
        this._t = new THREE.Vector3(); this._u = new THREE.Vector3(); this._o = new THREE.Vector3();
        this._d = new THREE.Vector3(); this._f = new THREE.Vector3(); this._r = new THREE.Vector3();
        this._up = new THREE.Vector3(); this._v = new THREE.Vector3();
    }

    blank() {
        return { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, sx: 0, sy: 0, orbits: 1 };
    }

    // A pose's camera position, target, fov and lens right now, composed for the space the page leaves it
    resolve(name, out) {
        const def = POSES[name];
        const p = this.narrow && def.narrow ? { ...def, ...def.narrow } : def;
        const sun = this.system.sun.pos;
        const frameBody = this.system.bodies.get(p.frame);
        const origin = this.system.bodies.get(p.origin).pos;
        const u = this._u.copy(frameBody.pos).sub(sun).normalize();
        const t = this._t.crossVectors(UP, u).normalize();
        const at = p.at, lk = p.look;
        out.pos.copy(origin).addScaledVector(t, at[0]).addScaledVector(u, at[1]).addScaledVector(UP, at[2]);
        out.look.copy(origin).addScaledVector(t, lk[0]).addScaledVector(u, lk[1]).addScaledVector(UP, lk[2]);
        out.fov = p.fov;
        out.sx = p.shift || 0;
        out.sy = 0;
        out.orbits = p.orbits ?? 1;
        const region = this.regions[name];
        if (region && p.subject) this.compose(out, this.system.bodies.get(p.subject), p.halo || 1.3, region);
        return out;
    }

    // Put a world (and its glow) in the middle of a free region: offset the lens, and if it would be too big for
    // the region, widen the field of view (a shorter lens keeps every angle in the composition, so an eclipse stays
    // an eclipse), backing away along the line of sight only beyond that
    compose(out, body, halo, region) {
        if (!body) return;
        const aspect = this.camera.aspect || 1;
        const R = body.def.r * halo;
        const limit = 0.82 * Math.min(region.y1 - region.y0, (region.x1 - region.x0) * aspect);
        const f = this._f, r = this._r, up = this._up, v = this._v;
        const MAX_FOV = 64;
        for (let i = 0; i < 3; i++) {
            f.copy(out.look).sub(out.pos).normalize();
            r.crossVectors(f, UP).normalize();
            up.crossVectors(r, f);
            v.copy(body.pos).sub(out.pos);
            const z = v.dot(f);
            if (z <= R * 1.05) return;
            let tanH = Math.tan(THREE.MathUtils.degToRad(out.fov) / 2);
            const rn = R / z / tanH;
            if (rn > limit + 1e-3 && i < 2) {
                const want = tanH * rn / limit;
                const cap = Math.tan(THREE.MathUtils.degToRad(Math.max(out.fov, MAX_FOV)) / 2);
                if (want <= cap) {
                    out.fov = THREE.MathUtils.radToDeg(2 * Math.atan(want));
                } else {
                    out.fov = Math.max(out.fov, MAX_FOV);
                    tanH = cap;
                    const rn2 = R / z / tanH;
                    out.pos.addScaledVector(f, -(z * rn2 / limit - z));
                }
                continue;
            }
            const nx = v.dot(r) / z / (tanH * aspect);
            const ny = v.dot(up) / z / tanH;
            out.sx = (region.x0 + region.x1 - 1) - nx;
            out.sy = (1 - (region.y0 + region.y1)) - ny;
            return;
        }
    }

    // The pose for the current scroll position: a smoothstep blend between neighbouring sections
    target(out) {
        const n = this.path.length;
        const s = Math.max(0, Math.min(n - 1, this.scroll));
        if (n === 1) return this.resolve(this.path[0], out);
        const i = Math.min(n - 2, Math.floor(s));
        const k = smooth(Math.max(0, Math.min(1, s - i)));
        if (k < 1e-4) return this.resolve(this.path[i], out);
        if (k > 1 - 1e-4) return this.resolve(this.path[i + 1], out);
        const a = this.resolve(this.path[i], this._a);
        const b = this.resolve(this.path[i + 1], this._b);
        out.pos.copy(a.pos).lerp(b.pos, k);
        out.look.copy(a.look).lerp(b.look, k);
        out.fov = a.fov + (b.fov - a.fov) * k;
        out.sx = a.sx + (b.sx - a.sx) * k;
        out.sy = a.sy + (b.sy - a.sy) * k;
        out.orbits = a.orbits + (b.orbits - a.orbits) * k;
        return out;
    }

    // Snap to the current target (first frame, reduced motion)
    snap(ctx) {
        const want = this.target(this._w);
        this.set(want);
        this.apply(ctx);
        this.ready = true;
    }

    set(want) {
        this.pos.copy(want.pos); this.look.copy(want.look);
        this.fov = want.fov; this.sx = want.sx; this.sy = want.sy;
        snapV(this.s.pos, this.pos); snapV(this.s.look, this.look);
        this.s.fov.x = this.fov; this.s.sx.x = this.sx; this.s.sy.x = this.sy;
        this.s.fov.v = this.s.sx.v = this.s.sy.v = 0;
    }

    // After Explore mode (or anything else that moved the camera directly): carry on from where it is
    adopt(pos, look, fov, sx, sy) {
        this.set({ pos, look, fov, sx, sy });
    }

    update(dt, ctx) {
        if (this.explore) { this.explore.update(dt, ctx); return; }
        const want = this.target(this._w);
        // Moods: a small dolly along the line of sight
        let dolly = 0;
        for (const k in MOOD_DOLLY) dolly += MOOD_DOLLY[k] * (ctx.mood[k] || 0);
        if (dolly) want.pos.lerp(want.look, -dolly);
        // Pointer parallax and a slow drift, both scaled by the animation intensity
        this.parallax.lerp(this.parallaxTarget, 1 - Math.exp(-dt * 2.5));
        const d = this._d.copy(want.look).sub(want.pos);
        const dist = d.length();
        const right = this._o.crossVectors(d, UP).normalize();
        const amt = ctx.motion * dist * 0.022;
        want.pos.addScaledVector(right, this.parallax.x * amt).addScaledVector(UP, this.parallax.y * amt * 0.6);
        want.pos.addScaledVector(UP, Math.sin(ctx.time * 0.11) * dist * 0.006 * ctx.motion);
        this.orbits += ((want.orbits ?? 1) - (this.orbits ?? 1)) * Math.min(1, dt * 2) || 0;
        ctx.orbitShow = this.orbits ?? 1;
        if (!this.ready || !ctx.motion) {
            this.set(want);
            this.ready = true;
        } else {
            // A long journey rises over the plane of the orbits on its way (never straight through a world),
            // the rise shrinking as the camera arrives
            const gap = this.pos.distanceTo(want.pos);
            if (gap > 1.5) want.pos.addScaledVector(UP, Math.min(gap * 0.2, 14));
            const w = FOLLOW[this.follow] || FOLLOW.scroll;
            springV(this.s.pos, want.pos, w, dt, this.pos);
            springV(this.s.look, want.look, w, dt, this.look);
            this.fov = spring(this.s.fov, want.fov, w, dt);
            this.sx = spring(this.s.sx, want.sx, w, dt);
            this.sy = spring(this.s.sy, want.sy, w, dt);
        }
        this.apply(ctx);
    }

    settled() {
        if (this.explore) return this.explore.settled();
        const want = this.target(this._a);
        return want.pos.distanceTo(this.pos) < 0.01 && want.look.distanceTo(this.look) < 0.01 &&
            Math.abs(want.fov - this.fov) < 0.05 && Math.abs(want.sx - this.sx) < 0.002 && Math.abs(want.sy - this.sy) < 0.002 &&
            speedV(this.s.pos) < 0.01;
    }

    apply() {
        const cam = this.camera;
        cam.position.copy(this.pos);
        cam.lookAt(this.look);
        cam.fov = this.fov;
        cam.filmOffset = 0;
        setLens(cam, this.sx, this.sy);
    }
}

// Explore mode: free orbit round a chosen object, with flights between objects. The object is framed in the
// part of the view the information panel leaves free (safe), and refitted when that changes.
export class Explorer {
    constructor(rig, universe) {
        this.rig = rig;
        this.u = universe;
        const cam = rig.camera;
        this.controls = new OrbitControls(cam, rig.canvas);
        const c = this.controls;
        c.enableDamping = true;
        c.dampingFactor = 0.08;
        c.enablePan = false;
        c.rotateSpeed = 0.6;
        c.zoomSpeed = 0.8;
        c.minDistance = 1;
        c.maxDistance = 400;
        c.enabled = false;
        this.focusId = null;
        this.flight = null;
        this.refit = null;
        this.safe = { x0: 0, x1: 1, y0: 0, y1: 1 };
        this.lens = { sx: scalar(0), sy: scalar(0) };
        this.lastFocusPos = new THREE.Vector3();
        this._v = new THREE.Vector3();
    }

    // Where the free part of the view is (fractions: x from the left, y from the top)
    setSafe(rect) {
        const r = rect || { x0: 0, x1: 1, y0: 0, y1: 1 };
        const changed = ['x0', 'x1', 'y0', 'y1'].some(k => Math.abs(r[k] - this.safe[k]) > 1e-3);
        this.safe = { ...r };
        if (changed && this.flight && this.focusId) {
            // Mid-flight: land at the distance that fits the new space
            const view = this.viewFor(this.focusId);
            if (view) this.flight.endOffset.setLength(view.dist);
        } else if (changed && this.controls.enabled && !this.flight && this.focusId) {
            // Keep the object inside the smaller space: back away if it no longer fits (never closer by itself)
            const view = this.viewFor(this.focusId);
            if (view) {
                const now = this.controls.object.position.distanceTo(this.controls.target);
                if (view.dist > now * 1.02) this.refit = { from: now, to: view.dist, t: 0 };
            }
        }
    }

    lensTarget() {
        const s = this.safe;
        return { sx: s.x0 + s.x1 - 1, sy: 1 - (s.y0 + s.y1) };
    }

    // How far away an object fits its free region: never nearer than a comfortable distance
    fitDistance(r, halo, base) {
        const s = this.safe, cam = this.rig.camera;
        const tanH = Math.tan(THREE.MathUtils.degToRad(44) / 2);
        const room = Math.min(s.y1 - s.y0, (s.x1 - s.x0) * (cam.aspect || 1));
        return Math.max(base, (r * halo) / (0.62 * room * tanH));
    }

    // Distance and placement that frame an object well
    viewFor(id) {
        const u = this.u;
        const b = u.system.bodies.get(id);
        if (b) {
            const r = b.def.r;
            const star = b.def.type === 'star';
            const dist = this.fitDistance(r, star ? 1.9 : b.def.atmo ? 1.3 : 1.12, star ? r * 9 : r * 5.5 + 0.4);
            return { target: b.pos, dist, min: r * 1.6, max: id === 'kerbol' ? 260 : Math.max(60, r * 40) };
        }
        if (id === 'comet') {
            const c = u.system.comet.pos;
            return { target: c, dist: 9, min: 2, max: 60 };
        }
        // Beyond the system: the camera stays among the planets and turns to face the object, orbiting a
        // point a little way toward it (so dragging looks around rather than swinging across the galaxy)
        const far = u.deepSkyPosition(id);
        if (far) {
            const anchor = this._anchor || (this._anchor = new THREE.Vector3());
            anchor.set(0, 14, 0);
            const d = new THREE.Vector3().copy(far.pos).sub(anchor).normalize();
            const target = (this._farTarget = this._farTarget || new THREE.Vector3()).copy(anchor).addScaledVector(d, 12);
            return { target, dist: 34, min: 8, max: 120, dir: d.negate() };
        }
        return null;
    }

    enter(id) {
        const c = this.controls;
        this.rig.explore = this;
        this.lens.sx.x = this.rig.sx; this.lens.sy.x = this.rig.sy;
        this.lens.sx.v = this.lens.sy.v = 0;
        this.focus(id || 'kerbin', true);
        c.enabled = true;
    }

    exit() {
        this.controls.enabled = false;
        this.rig.explore = null;
        this.flight = null;
        this.refit = null;
        this.focusId = null;
        // The homepage's springs carry on from here
        const cam = this.rig.camera;
        this.rig.adopt(cam.position, this.controls.target, cam.fov, this.lens.sx.x, this.lens.sy.x);
    }

    focus(id, first) {
        const view = this.viewFor(id);
        if (!view) return;
        this.focusId = id;
        this.refit = null;
        const cam = this.rig.camera;
        const c = this.controls;
        // Arrive from the current direction, at a comfortable distance
        const dir = this._v.copy(cam.position).sub(view.target);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
        dir.normalize();
        if (view.dir) dir.copy(view.dir);
        if (first && this.u.system.bodies.get(id)) {
            // a three-quarter view from the sunlit side
            const sun = this.u.system.sun.pos;
            const toSun = new THREE.Vector3().copy(sun).sub(view.target).normalize();
            dir.copy(toSun).multiplyScalar(0.55).add(new THREE.Vector3().crossVectors(UP, toSun).normalize().multiplyScalar(-0.75)).add(new THREE.Vector3(0, 0.35, 0)).normalize();
        }
        const endPos = new THREE.Vector3().copy(view.target).addScaledVector(dir, view.dist);
        this.flight = {
            t: 0,
            dur: this.u.ctx.motion ? 1.6 : 0,
            fromPos: cam.position.clone(),
            fromLook: c.enabled ? c.target.clone() : this.rig.look.clone(),
            endOffset: endPos.clone().sub(view.target),
            fromFov: cam.fov, fromSx: this.lens.sx.x, fromSy: this.lens.sy.x,
        };
        c.minDistance = view.min;
        c.maxDistance = view.max;
        this.lastFocusPos.copy(view.target);
    }

    // Keyboard and button equivalents of drag and wheel
    orbit(dx, dy) {
        const c = this.controls;
        const off = this._v.copy(c.object.position).sub(c.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta += dx;
        sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + dy));
        off.setFromSpherical(sph);
        c.object.position.copy(c.target).add(off);
    }

    zoom(factor) {
        const c = this.controls;
        this.refit = null;
        const off = this._v.copy(c.object.position).sub(c.target);
        const len = Math.max(c.minDistance, Math.min(c.maxDistance, off.length() * factor));
        off.setLength(len);
        c.object.position.copy(c.target).add(off);
    }

    settled() {
        if (this.flight || this.refit) return false;
        const t = this.lensTarget();
        return Math.abs(this.lens.sx.x - t.sx) < 0.002 && Math.abs(this.lens.sy.x - t.sy) < 0.002;
    }

    update(dt, ctx) {
        const cam = this.rig.camera;
        const c = this.controls;
        const view = this.focusId && this.viewFor(this.focusId);
        if (!view) return;
        // Follow the object as it orbits: move the camera with it
        const delta = this._v.copy(view.target).sub(this.lastFocusPos);
        this.lastFocusPos.copy(view.target);
        const lt = this.lensTarget();
        if (this.flight) {
            const f = this.flight;
            f.t = f.dur ? Math.min(1, f.t + dt / f.dur) : 1;
            const k = smooth(smooth(f.t));
            const endPos = this._d || (this._d = new THREE.Vector3());
            endPos.copy(view.target).add(f.endOffset);
            cam.position.copy(f.fromPos).lerp(endPos, k);
            c.target.copy(f.fromLook).lerp(view.target, k);
            cam.fov = f.fromFov + (44 - f.fromFov) * k;
            this.lens.sx.x = f.fromSx + (lt.sx - f.fromSx) * k;
            this.lens.sy.x = f.fromSy + (lt.sy - f.fromSy) * k;
            this.lens.sx.v = this.lens.sy.v = 0;
            if (f.t >= 1) this.flight = null;
        } else {
            cam.position.add(delta);
            c.target.copy(view.target);
            const w = ctx.motion ? 6 : 1e4;
            spring(this.lens.sx, lt.sx, w, dt);
            spring(this.lens.sy, lt.sy, w, dt);
            if (this.refit) {
                const r = this.refit;
                r.t = ctx.motion ? Math.min(1, r.t + dt / 0.6) : 1;
                const off = this._v.copy(cam.position).sub(c.target);
                off.setLength(r.from + (r.to - r.from) * smooth(r.t));
                cam.position.copy(c.target).add(off);
                if (r.t >= 1) this.refit = null;
            }
        }
        setLens(cam, this.lens.sx.x, this.lens.sy.x);
        if (!this.flight) c.update(dt);
        else cam.lookAt(c.target);
        // Keep the rig in step, so leaving Explore glides back from here
        this.rig.pos.copy(cam.position);
        this.rig.look.copy(c.target);
        this.rig.fov = cam.fov;
        this.rig.sx = this.lens.sx.x;
        this.rig.sy = this.lens.sy.x;
    }

    dispose() {
        this.controls.dispose();
    }
}
