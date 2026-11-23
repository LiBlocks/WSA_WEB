// The camera: a rig that resolves named poses against the moving worlds, blends between them as the page
// scrolls, adds pointer parallax and the moods' small nudges, and eases toward all of that with a
// critically damped follow (so a jump in scroll position never snaps the view). In Explore mode the rig
// hands over to OrbitControls round the selected object, flying there first.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { POSES, MOOD_DOLLY } from './environments.js';

const UP = new THREE.Vector3(0, 1, 0);
const smooth = t => t * t * (3 - 2 * t);

export class CameraRig {
    constructor(camera, system, canvas) {
        this.camera = camera;
        this.system = system;
        this.canvas = canvas;
        this.scroll = 0;                 // position along the homepage's path of poses (float index)
        this.path = ['home'];
        this.narrow = false;
        this.parallax = new THREE.Vector2();
        this.parallaxTarget = new THREE.Vector2();
        this.pos = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.fov = 34;
        this.shift = 0;
        this.orbits = 0.35;
        this.ready = false;
        this.explore = null;
        // scratch
        this._a = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, shift: 0 };
        this._b = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, shift: 0 };
        this._t = new THREE.Vector3(); this._u = new THREE.Vector3(); this._o = new THREE.Vector3();
        this._d = new THREE.Vector3();
    }

    // A pose's camera position, target, fov and shift right now
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
        out.shift = p.shift;
        out.orbits = p.orbits ?? 1;
        return out;
    }

    // The pose for the current scroll position: a smoothstep blend between neighbouring sections
    target(out) {
        const n = this.path.length;
        const s = Math.max(0, Math.min(n - 1, this.scroll));
        const i = Math.min(n - 2, Math.floor(s));
        if (n === 1) return this.resolve(this.path[0], out);
        const k = smooth(Math.max(0, Math.min(1, s - i)));
        const a = this.resolve(this.path[i], this._a);
        const b = this.resolve(this.path[i + 1], this._b);
        out.pos.copy(a.pos).lerp(b.pos, k);
        out.look.copy(a.look).lerp(b.look, k);
        out.fov = a.fov + (b.fov - a.fov) * k;
        out.shift = a.shift + (b.shift - a.shift) * k;
        out.orbits = a.orbits + (b.orbits - a.orbits) * k;
        return out;
    }

    // Snap to the current target (first frame, reduced motion)
    snap(ctx) {
        const want = this.target({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, shift: 0 });
        this.pos.copy(want.pos);
        this.look.copy(want.look);
        this.fov = want.fov;
        this.shift = want.shift;
        this.apply(ctx);
        this.ready = true;
    }

    update(dt, ctx) {
        if (this.explore) { this.explore.update(dt, ctx); return; }
        const want = this.target(this._wantStore || (this._wantStore = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0, shift: 0 }));
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
            this.pos.copy(want.pos); this.look.copy(want.look); this.fov = want.fov; this.shift = want.shift;
            this.ready = true;
        } else {
            const k = 1 - Math.exp(-dt * 2.2);
            this.pos.lerp(want.pos, k);
            this.look.lerp(want.look, k);
            this.fov += (want.fov - this.fov) * k;
            this.shift += (want.shift - this.shift) * k;
        }
        this.apply(ctx);
    }

    settled() {
        if (this.explore) return this.explore.settled();
        const want = this.target(this._a);
        return want.pos.distanceTo(this.pos) < 0.01 && want.look.distanceTo(this.look) < 0.01 && Math.abs(want.fov - this.fov) < 0.05;
    }

    apply(ctx) {
        const cam = this.camera;
        cam.position.copy(this.pos);
        cam.lookAt(this.look);
        cam.fov = this.fov;
        // Lens shift: + moves the subject to the right of the frame
        const half = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
        cam.filmOffset = -this.shift * half * cam.getFilmWidth();
        cam.updateProjectionMatrix();
    }
}

// Explore mode: free orbit round a chosen object, with flights between objects
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
        this.lastFocusPos = new THREE.Vector3();
        this._v = new THREE.Vector3();
    }

    // Distance and placement that frame an object well
    viewFor(id) {
        const u = this.u;
        const b = u.system.bodies.get(id);
        if (b) {
            const r = b.def.r;
            const dist = b.def.type === 'star' ? r * 9 : r * 5.5 + 0.4;
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
        this.focus(id || 'kerbin', true);
        c.enabled = true;
    }

    exit() {
        this.controls.enabled = false;
        this.rig.explore = null;
        this.flight = null;
        this.focusId = null;
    }

    focus(id, first) {
        const view = this.viewFor(id);
        if (!view) return;
        this.focusId = id;
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
            fromFov: cam.fov, fromShift: this.rig.shift,
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
        const off = this._v.copy(c.object.position).sub(c.target);
        const len = Math.max(c.minDistance, Math.min(c.maxDistance, off.length() * factor));
        off.setLength(len);
        c.object.position.copy(c.target).add(off);
    }

    settled() {
        return !this.flight;
    }

    update(dt, ctx) {
        const cam = this.rig.camera;
        const c = this.controls;
        const view = this.focusId && this.viewFor(this.focusId);
        if (!view) return;
        // Follow the object as it orbits: move the camera with it
        const delta = this._v.copy(view.target).sub(this.lastFocusPos);
        this.lastFocusPos.copy(view.target);
        if (this.flight) {
            const f = this.flight;
            f.t = f.dur ? Math.min(1, f.t + dt / f.dur) : 1;
            const k = smooth(smooth(f.t));
            const endPos = this._d || (this._d = new THREE.Vector3());
            endPos.copy(view.target).add(f.endOffset);
            cam.position.copy(f.fromPos).lerp(endPos, k);
            c.target.copy(f.fromLook).lerp(view.target, k);
            cam.fov = f.fromFov + (44 - f.fromFov) * k;
            this.rig.shift = f.fromShift * (1 - k);
            if (f.t >= 1) this.flight = null;
        } else {
            cam.position.add(delta);
            c.target.copy(view.target);
        }
        const half = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
        cam.filmOffset = -this.rig.shift * half * cam.getFilmWidth();
        cam.updateProjectionMatrix();
        if (!this.flight) c.update(dt);
        else cam.lookAt(c.target);
        // Keep the rig in step, so leaving Explore glides back from here
        this.rig.pos.copy(cam.position);
        this.rig.look.copy(c.target);
        this.rig.fov = cam.fov;
    }

    dispose() {
        this.controls.dispose();
    }
}
