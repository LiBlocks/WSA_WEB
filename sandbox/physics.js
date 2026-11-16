// WSA Engineering Sandbox: the physics. Every number the sandbox shows, and every move its 3D view makes,
// comes from these models. Pure functions and plain state objects in SI units (m, s, kg, N); no DOM and no
// three.js, so each model can be checked on its own.
//
// The models are simplified on purpose, and the page says so:
//   engine test stand  constant specific impulse; illustrative 0.6 s ignition and shutdown ramps
//   flight             a point-mass vehicle in a central inverse-square gravity field: no air, no planet
//                      rotation. The ideal rocket equation is applied exactly in every step, so the speed a
//                      stage gives in empty space is its rocket-equation delta-v whatever the step size
//   orbits             the two-body problem with instantaneous (impulsive) burns
//   landing            flat ground, uniform gravity, optional illustrative drag, and a rigid booster that
//                      can tip over its legs after touchdown
import { G0, body as bodyIn, surfaceGravity } from '../celestial-bodies.js';

export { G0 };

/* ---------- Vectors (plain [x, y, z] arrays) ---------- */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export function norm(a, fallback = [0, 1, 0]) {
    const l = len(a);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : fallback.slice();
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = v => clamp(v, 0, 1);
export const DEG = Math.PI / 180;

/* ---------- Worlds ---------- */

// Stock KSP bodies, read from celestial-bodies.js (the values WSA's Flight Dynamics Center uses), so the
// sandbox's Kerbin is the same Kerbin as everywhere else on the site.
const WORLD_ENV = 'ksp-stock';
const WORLD_IDS = ['kerbin', 'mun', 'minmus', 'duna', 'eve', 'tylo', 'moho', 'gilly'];
export const WORLDS = {};
for (const id of WORLD_IDS) {
    const b = bodyIn(id, WORLD_ENV);
    WORLDS[id] = Object.freeze({ id, name: b.name, mu: b.mu, radius: b.radius, atmosphere: b.atmosphere, g: surfaceGravity(b) });
}
Object.freeze(WORLDS);

/** A made-up world from a surface gravity (m/s²) and radius (m): μ = g R². */
export function customWorld(g, radius) {
    return { id: 'custom', name: 'Custom world', mu: g * radius * radius, radius, atmosphere: 0, g };
}

/* ---------- Rocket basics ---------- */

export const exhaustVelocity = isp => isp * G0;
/** Mass flow (kg/s) of an engine making `thrust` newtons at specific impulse `isp` seconds: ṁ = T / (Isp g0). */
export const massFlow = (thrust, isp) => (isp > 0 ? thrust / (isp * G0) : 0);
/** Ideal rocket equation: Δv = Isp g0 ln(m0 / m1). */
export const rocketDeltaV = (isp, m0, m1) => (m1 > 0 && m0 >= m1 ? isp * G0 * Math.log(m0 / m1) : 0);
/** Thrust-to-weight ratio T / (m g). Infinity where there is no gravity. */
export const thrustToWeight = (thrust, mass, g) => (mass > 0 && g > 0 ? thrust / (mass * g) : Infinity);
/** Total impulse (N·s) a propellant load can give: Isp g0 m. It does not depend on thrust. */
export const totalImpulse = (isp, propellant) => isp * G0 * propellant;

/** Ideal (vacuum) delta-v of each stage of a stack, bottom stage first, and the total. */
export function stackDeltaV(stages, payload) {
    const per = [];
    for (let i = 0; i < stages.length; i++) {
        let above = payload;
        for (let j = i + 1; j < stages.length; j++) above += stages[j].dry + stages[j].prop;
        const m0 = above + stages[i].dry + stages[i].prop;
        const m1 = above + stages[i].dry;
        per.push(rocketDeltaV(stages[i].isp, m0, m1));
    }
    return { per, total: per.reduce((a, b) => a + b, 0) };
}

/* ---------- Engine test stand ---------- */

export const STAND_RAMP = 0.6;   // s: illustrative ignition and shutdown ramp

/**
 * One engine (or cluster) bolted to a test stand. cfg: { thrust: N per engine, isp: s, engines, propellant: kg,
 * duration: s planned burn }.
 */
export function createStand(cfg) {
    return {
        t: 0, cfg: { ...cfg }, prop: cfg.propellant, on: false, spool: 0, phase: 'ready',
        clock: 0, burnTime: 0, impulse: 0, used: 0, thrust: 0, mdot: 0, peak: 0, endReason: null, ignitedAt: null,
    };
}

/** Advances a stand by dt. ctl: { throttle 0–1, command: 'ignite' | 'shutdown' | null }. Returns events. */
export function stepStand(s, ctl, dt) {
    const ev = [];
    const c = s.cfg;
    if (ctl.command === 'ignite' && !s.on && s.phase !== 'flameout') {
        if (s.prop > 0) {
            s.on = true;
            s.phase = 'ignition';
            if (s.ignitedAt === null) s.ignitedAt = s.t;
            ev.push({ type: 'ignition' });
        } else ev.push({ type: 'noprop' });
    }
    if (ctl.command === 'shutdown' && s.on) {
        s.on = false;
        s.phase = 'shutdown';
        s.endReason = s.endReason || 'manual';
        ev.push({ type: 'shutdown', reason: 'manual' });
    }
    if (s.on && s.clock >= c.duration) {
        s.on = false;
        s.phase = 'shutdown';
        s.endReason = s.endReason || 'duration';
        ev.push({ type: 'shutdown', reason: 'duration' });
    }
    if (s.on) s.clock += dt;

    s.spool = s.on ? Math.min(1, s.spool + dt / STAND_RAMP) : Math.max(0, s.spool - dt / STAND_RAMP);
    const thrust = s.spool * clamp01(ctl.throttle) * c.thrust * c.engines;
    const mdot = massFlow(thrust, c.isp);
    let use = mdot * dt, frac = 1;
    if (use > s.prop) {
        frac = use > 0 ? s.prop / use : 0;
        use = s.prop;
    }
    s.prop -= use;
    s.used += use;
    s.impulse += thrust * dt * frac;
    if (thrust > 0) s.burnTime += dt * frac;
    s.thrust = thrust * frac;
    s.mdot = mdot * frac;
    s.peak = Math.max(s.peak, s.thrust);
    if (s.phase === 'ignition' && s.spool >= 1) s.phase = 'running';
    if (s.prop <= 1e-9 && (s.on || s.spool > 0) && frac < 1) {
        s.prop = 0;
        s.on = false;
        s.spool = 0;
        s.phase = 'flameout';
        s.endReason = s.endReason || 'propellant';
        ev.push({ type: 'flameout' });
    }
    if (s.phase === 'shutdown' && s.spool <= 0) {
        s.phase = 'off';
        ev.push({ type: 'off' });
    }
    s.t += dt;
    return ev;
}

/* ---------- Two-body orbits ---------- */

/** Central-body gravity a = −μ r / |r|³. */
export function gravity(r, mu) {
    if (!(mu > 0)) return [0, 0, 0];
    const d2 = dot(r, r), d = Math.sqrt(d2);
    const k = -mu / (d2 * d);
    return [r[0] * k, r[1] * k, r[2] * k];
}

/**
 * One fixed step of an unpowered two-body orbit, in place. method: 'verlet' (velocity Verlet, symplectic:
 * the energy error stays bounded orbit after orbit), 'rk4' (classical Runge–Kutta) or 'euler' (explicit
 * Euler, offered only to show why it fails: it gains energy every orbit and spirals outward).
 */
export function stepTwoBody(s, mu, dt, method = 'verlet') {
    const { r, v } = s;
    if (method === 'euler') {
        const a = gravity(r, mu);
        for (let k = 0; k < 3; k++) {
            r[k] += v[k] * dt;
            v[k] += a[k] * dt;
        }
    } else if (method === 'rk4') {
        const r0 = r.slice(), v0 = v.slice();
        const a1 = gravity(r0, mu);
        const r2 = add(r0, scale(v0, dt / 2)), v2 = add(v0, scale(a1, dt / 2));
        const a2 = gravity(r2, mu);
        const r3 = add(r0, scale(v2, dt / 2)), v3 = add(v0, scale(a2, dt / 2));
        const a3 = gravity(r3, mu);
        const r4 = add(r0, scale(v3, dt)), v4 = add(v0, scale(a3, dt));
        const a4 = gravity(r4, mu);
        for (let k = 0; k < 3; k++) {
            r[k] = r0[k] + dt / 6 * (v0[k] + 2 * v2[k] + 2 * v3[k] + v4[k]);
            v[k] = v0[k] + dt / 6 * (a1[k] + 2 * a2[k] + 2 * a3[k] + a4[k]);
        }
    } else {
        const a0 = gravity(r, mu);
        for (let k = 0; k < 3; k++) {
            v[k] += 0.5 * dt * a0[k];
            r[k] += dt * v[k];
        }
        const a1 = gravity(r, mu);
        for (let k = 0; k < 3; k++) v[k] += 0.5 * dt * a1[k];
    }
}

export const specificEnergy = (r, v, mu) => dot(v, v) / 2 - mu / len(r);
export const circularSpeed = (mu, r) => Math.sqrt(mu / r);
export const orbitalPeriod = (mu, a) => 2 * Math.PI * Math.sqrt(a * a * a / mu);

/**
 * Orbital elements from a state vector. The reference plane is x–z with +y as the pole, so an orbit drawn
 * flat on the "equator" has inclination 0. Returns semi-major axis a (Infinity for a parabola, negative for
 * a hyperbola), eccentricity e, periapsis and apoapsis radii, period, inclination, true anomaly and times to
 * the next periapsis and apoapsis.
 */
export function elements(r, v, mu) {
    const rm = len(r);
    const h = cross(r, v);
    const hm = len(h);
    const energy = dot(v, v) / 2 - mu / rm;
    const evec = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / rm));
    const e = len(evec);
    const p = hm * hm / mu;
    const a = Math.abs(energy) < 1e-12 ? Infinity : -mu / (2 * energy);
    const rp = p / (1 + e);
    const ra = e < 1 ? p / (1 - e) : Infinity;
    const period = e < 1 && a > 0 ? orbitalPeriod(mu, a) : Infinity;
    const inc = hm > 0 ? Math.acos(clamp(h[1] / hm, -1, 1)) : 0;
    const vr = dot(r, v) / rm;
    let nu = 0;
    if (e > 1e-9) {
        nu = Math.acos(clamp(dot(evec, r) / (e * rm), -1, 1));
        if (vr < 0) nu = 2 * Math.PI - nu;
    }
    let timeToPe = Infinity, timeToAp = Infinity;
    if (e < 1 && e > 1e-6 && a > 0) {
        const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
        let M = E - e * Math.sin(E);
        if (M < 0) M += 2 * Math.PI;
        const n = Math.sqrt(mu / (a * a * a));
        timeToPe = (2 * Math.PI - M) / n;
        timeToAp = ((Math.PI - M) / n + period) % period;
    }
    return { a, e, evec, h, hm, p, rp, ra, period, inc, nu, vr, energy, r: rm, speed: len(v) };
}

/**
 * Points along the orbit an element set describes, for drawing. Ellipses are sampled all the way round;
 * hyperbolas from the current position outwards until rMax. Returns [x, y, z] arrays in metres.
 */
export function orbitPoints(el, r, n = 256, rMax = Infinity) {
    const hhat = norm(el.h, [0, 1, 0]);
    const P = el.e > 1e-9 ? norm(el.evec) : norm(r);
    const Q = cross(hhat, P);
    const pts = [];
    if (el.e < 1) {
        for (let i = 0; i <= n; i++) {
            const nu = (i / n) * 2 * Math.PI;
            const rr = el.p / (1 + el.e * Math.cos(nu));
            pts.push(add(scale(P, rr * Math.cos(nu)), scale(Q, rr * Math.sin(nu))));
        }
    } else {
        const nuInf = Math.acos(-1 / el.e) - 1e-3;
        const nuMax = Number.isFinite(rMax)
            ? Math.min(nuInf, Math.acos(clamp((el.p / rMax - 1) / el.e, -1, 1)))
            : nuInf;
        const start = el.nu > Math.PI ? el.nu - 2 * Math.PI : el.nu;
        const from = Math.max(-nuMax, Math.min(start, nuMax));
        for (let i = 0; i <= n; i++) {
            const nu = from + (nuMax - from) * (i / n);
            const rr = el.p / (1 + el.e * Math.cos(nu));
            pts.push(add(scale(P, rr * Math.cos(nu)), scale(Q, rr * Math.sin(nu))));
        }
    }
    return pts;
}

/** Unit vectors of the burn frame KSP players know: prograde, radial out, normal. */
export function burnFrame(r, v) {
    const pro = norm(v, [1, 0, 0]);
    const nrm = norm(cross(r, v), [0, 1, 0]);
    const rad = norm(cross(pro, nrm), norm(r));
    return { prograde: pro, retrograde: scale(pro, -1), radialOut: rad, radialIn: scale(rad, -1), normal: nrm, antiNormal: scale(nrm, -1) };
}

/** The velocity change of an impulsive burn of `dv` m/s in one of the burnFrame directions. */
export function burnVector(r, v, direction, dv) {
    const f = burnFrame(r, v);
    return scale(f[direction] || f.prograde, dv);
}

/**
 * Ideal Hohmann transfer between circular, coplanar orbits of radius r1 and r2 (m). Same formulas as the
 * Flight Dynamics Center: Δv1 = |vt1 − vc1|, Δv2 = |vc2 − vt2|, transfer time π √(a_t³ / μ).
 */
export function hohmann(mu, r1, r2) {
    const at = (r1 + r2) / 2;
    const vc1 = Math.sqrt(mu / r1), vc2 = Math.sqrt(mu / r2);
    const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at));
    const vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));
    const dv1 = Math.abs(vt1 - vc1), dv2 = Math.abs(vc2 - vt2);
    return {
        r1, r2, at, vc1, vc2, vt1, vt2, dv1, dv2, total: dv1 + dv2,
        time: Math.PI * Math.sqrt(at * at * at / mu),
        raise: r2 >= r1,
        // How far ahead of the craft a target in the final orbit must be when the first burn starts
        phase: Math.PI * (1 - Math.pow(at / r2, 1.5)),
    };
}

/* ---------- Powered flight: a staged rocket in central gravity ---------- */

export const SAFE_TOUCHDOWN = 6;   // m/s: slower than this back on the ground counts as a touchdown, faster as an impact

/**
 * cfg: {
 *   mu, radius          central body (mu 0: empty space, no gravity and no ground)
 *   stages              [{ dry, prop (kg), thrust (N per engine), engines, isp (s) }], bottom stage first
 *   payload             kg on top
 *   start               { kind: 'pad' } | { kind: 'space' } | { kind: 'orbit', altitude, speedFactor }
 *                       | { kind: 'air', altitude, vVertical, vHorizontal }
 * }
 * The launch site is the top of the body: "up" there is +y and "east" (downrange) is +x, so flights stay in
 * the x–y plane.
 */
export function createFlight(cfg) {
    const mu = cfg.mu > 0 ? cfg.mu : 0;
    const R = mu > 0 ? cfg.radius : 0;
    const s = {
        t: 0, mu, R, gravity: mu > 0,
        stages: cfg.stages.map((st, i) => ({ i, dry: st.dry, prop: st.prop, prop0: st.prop, thrust: st.thrust, engines: st.engines, isp: st.isp, burnStart: null, burnEnd: null, sepAt: null, left: 0 })),
        payload: cfg.payload || 0,
        active: 0, engineOn: false, igniteAt: null,
        r: [0, R, 0], v: [0, 0, 0], dir: [0, 1, 0],
        landed: false, crashed: false, ended: false, liftoff: null, touchdown: null,
        thrust: 0, mdot: 0, dvUsed: 0, wasted: 0, maxAlt: 0, maxSpeed: 0, prevVr: 0,
        debris: [], ignitions: 0,
    };
    const st = cfg.start || { kind: mu > 0 ? 'pad' : 'space' };
    if (!s.gravity) {
        s.r = [0, 0, 0];
    } else if (st.kind === 'pad') {
        s.landed = true;
    } else if (st.kind === 'orbit') {
        const rr = R + st.altitude;
        s.r = [0, rr, 0];
        s.v = [circularSpeed(mu, rr) * (st.speedFactor ?? 1), 0, 0];
    } else if (st.kind === 'air') {
        s.r = [0, R + st.altitude, 0];
        s.v = [st.vHorizontal || 0, st.vVertical || 0, 0];
    }
    s.maxAlt = altitude(s);
    return s;
}

export const altitude = s => (s.gravity ? len(s.r) - s.R : s.r[1]);
export const localGravity = s => (s.gravity ? s.mu / dot(s.r, s.r) : 0);

/** Current mass: every stage still attached, their propellant and the payload. */
export function flightMass(s) {
    let m = s.payload;
    for (let i = s.active; i < s.stages.length; i++) m += s.stages[i].dry + s.stages[i].prop;
    return m;
}

/** Ideal delta-v left in the propellant still on board (vacuum, rocket equation, stage by stage). */
export function flightDeltaVLeft(s) {
    return stackDeltaV(s.stages.slice(s.active), s.payload).total;
}

const upOf = s => (s.gravity ? norm(s.r) : [0, 1, 0]);
const eastOf = (s, up) => (s.gravity ? norm(cross(up, [0, 0, 1]), [1, 0, 0]) : [1, 0, 0]);

/**
 * Which way the engines point. steer: { mode: 'vertical' | 'program' | 'prograde' | 'retrograde' |
 * 'horizontal' | 'fixed', turnStart, turnEnd (m, the pitch program's altitudes), pitch (degrees from
 * vertical for 'fixed') }
 */
export function steerDirection(s, steer = {}) {
    const up = upOf(s), east = eastOf(s, up);
    const speed = len(s.v);
    switch (steer.mode) {
        case 'program': {
            const a0 = steer.turnStart ?? 1000, a1 = Math.max(a0 + 1, steer.turnEnd ?? 45000);
            const f = clamp01((altitude(s) - a0) / (a1 - a0));
            const ang = (s.landed ? 0 : Math.sqrt(f)) * Math.PI / 2;
            return add(scale(up, Math.cos(ang)), scale(east, Math.sin(ang)));
        }
        case 'prograde': return speed > 1 ? norm(s.v) : up;
        case 'retrograde': return speed > 1 ? scale(norm(s.v), -1) : up;
        case 'horizontal': return east;
        case 'fixed': {
            const ang = clamp(steer.pitch ?? 0, -90, 90) * DEG;
            return add(scale(up, Math.cos(ang)), scale(east, Math.sin(ang)));
        }
        default: return up;
    }
}

function separate(s, ev) {
    if (s.active >= s.stages.length - 1) {
        ev.push({ type: 'nostage' });
        return false;
    }
    const st = s.stages[s.active];
    st.sepAt = s.t;
    st.left = st.prop;
    s.wasted += st.prop;
    const wasBurning = s.engineOn;
    s.engineOn = false;
    // The spent stage falls away on its own: a small push back (illustrative separation springs), then
    // gravity only. Its leftover propellant goes with it; its engines never push the vehicle again.
    const back = scale(s.dir, -1.5);
    s.debris.push({ stage: s.active, r: s.r.slice(), v: add(s.v, back), dir: s.dir.slice(), t0: s.t, landed: false, spin: 0.35 + 0.15 * (s.active % 3) });
    ev.push({ type: 'separation', stage: s.active, left: st.prop, massBefore: flightMass(s) });
    s.active++;
    ev[ev.length - 1].massAfter = flightMass(s);
    return wasBurning;
}

/**
 * Advances a flight by dt. ctl: { throttle 0–1, steer, commands: ['ignite' | 'cutoff' | 'stage'],
 * autoStage: bool, stageDelay: s }. Uses velocity Verlet for gravity with the rocket-equation velocity
 * change of the step (ve ln(m0/m1)) applied half before and half after the drift. Returns events.
 */
export function stepFlight(s, ctl, dt) {
    const ev = [];
    if (s.ended) return ev;
    const delay = Math.max(0, ctl.stageDelay ?? 1);
    for (const c of ctl.commands || []) {
        if (c === 'ignite') {
            const st = s.stages[s.active];
            if (s.engineOn) continue;
            if (st && st.prop > 0) {
                s.engineOn = true;
                s.igniteAt = null;
                s.ignitions++;
                if (st.burnStart === null) st.burnStart = s.t;
                ev.push({ type: 'ignition', stage: s.active });
            } else ev.push({ type: 'noprop', stage: s.active });
        } else if (c === 'cutoff') {
            if (s.engineOn) ev.push({ type: 'cutoff', stage: s.active });
            s.engineOn = false;
            s.igniteAt = null;
        } else if (c === 'stage') {
            const was = separate(s, ev);
            if (was || ctl.igniteAfterStage) s.igniteAt = s.t + delay;
        }
    }
    if (s.igniteAt !== null && s.t >= s.igniteAt - 1e-9) {
        s.igniteAt = null;
        const st = s.stages[s.active];
        if (st && st.prop > 0) {
            s.engineOn = true;
            s.ignitions++;
            if (st.burnStart === null) st.burnStart = s.t;
            ev.push({ type: 'ignition', stage: s.active });
        }
    }

    const st = s.stages[s.active];
    const m = flightMass(s);
    const dir = steerDirection(s, ctl.steer);
    s.dir = dir;
    const throttle = clamp01(ctl.throttle ?? 1);
    let T = 0, dm = 0, dvT = 0;
    if (s.engineOn && st && st.prop > 0 && throttle > 0) {
        T = throttle * st.thrust * st.engines;
        const ve = exhaustVelocity(st.isp);
        const want = T / ve * dt;
        dm = Math.min(st.prop, want);
        dvT = ve * Math.log(m / (m - dm));
        if (dm < want) T *= dm / want;
    }
    s.thrust = T;
    s.mdot = dt > 0 ? dm / dt : 0;

    // On the pad, the vehicle stays put until its thrust beats its weight (it never sinks into the ground)
    if (s.landed) {
        const g = localGravity(s);
        const up = upOf(s);
        if ((T / m) * dot(dir, up) <= g) {
            if (st) st.prop -= dm;
            s.dvUsed += 0;
            s.v = [0, 0, 0];
            afterBurn(s, st, ctl, ev, dm);
            stepDebris(s, dt);
            s.t += dt;
            return ev;
        }
        s.landed = false;
        if (s.liftoff === null) s.liftoff = s.t;
        ev.push({ type: 'liftoff', twr: thrustToWeight(T, m, g) });
    }

    const a0 = gravity(s.r, s.mu);
    const kick = dvT / 2;
    for (let k = 0; k < 3; k++) {
        s.v[k] += 0.5 * dt * a0[k] + kick * dir[k];
        s.r[k] += dt * s.v[k];
    }
    const a1 = gravity(s.r, s.mu);
    for (let k = 0; k < 3; k++) s.v[k] += 0.5 * dt * a1[k] + kick * dir[k];
    if (st) st.prop -= dm;
    s.dvUsed += dvT;
    afterBurn(s, st, ctl, ev, dm);

    // Back on the ground
    if (s.gravity) {
        const rm = len(s.r);
        if (rm <= s.R && dot(s.r, s.v) < 0) {
            const speed = len(s.v);
            s.r = scale(norm(s.r), s.R);
            s.v = [0, 0, 0];
            s.touchdown = { t: s.t + dt, speed };
            if (speed <= SAFE_TOUCHDOWN) {
                s.landed = true;
                ev.push({ type: 'touchdown', speed });
            } else {
                s.crashed = true;
                s.ended = true;
                s.engineOn = false;
                ev.push({ type: 'impact', speed });
            }
        }
        const vr = dot(s.r, s.v) / len(s.r);
        if (!s.landed && s.prevVr > 0 && vr <= 0) ev.push({ type: 'apoapsis', altitude: altitude(s) });
        s.prevVr = vr;
    }
    stepDebris(s, dt);
    s.maxAlt = Math.max(s.maxAlt, altitude(s));
    s.maxSpeed = Math.max(s.maxSpeed, len(s.v));
    s.t += dt;
    return ev;
}

function afterBurn(s, st, ctl, ev, dm) {
    if (!st || !s.engineOn || st.prop > 1e-6) return;
    st.prop = 0;
    s.engineOn = false;
    st.burnEnd = s.t;
    ev.push({ type: 'burnout', stage: s.active });
    if (ctl.autoStage && s.active < s.stages.length - 1) {
        separate(s, ev);
        s.igniteAt = s.t + Math.max(0, ctl.stageDelay ?? 1);
    }
}

function stepDebris(s, dt) {
    for (const d of s.debris) {
        // A stage dropped during this step already sits at the end-of-step position: start it next step
        if (d.landed || d.t0 === s.t) continue;
        stepTwoBody(d, s.mu, dt, 'verlet');
        if (s.gravity && len(d.r) <= s.R) {
            d.r = scale(norm(d.r), s.R);
            d.v = [0, 0, 0];
            d.landed = true;
        }
    }
}

/* ---------- Powered landing on flat ground ---------- */

// Illustrative booster geometry (m): not the measurements of any real or KSP vehicle
export const BOOSTER = { height: 24, radius: 1.6, cg: 9, legSpan: 4.4, padRadius: 15 };
export const LANDING_LIMITS = { safe: 4, hard: 8, crash: 12, drift: 1.5, tilt: 8 * DEG };

/**
 * cfg: { g, dry, prop (kg), thrust (N, all engines), isp, minThrottle 0–1, maxTilt (rad), slewRate (rad/s),
 *        alt0, vx0, vy0 (m/s, negative = down), vz0, tx, tz (pad centre), legsAlt (m),
 *        drag: bool, cd, rho0 (kg/m³), scaleHeight (m) }
 * The booster's base (the feet of its legs) is at pos; the pad is on the ground plane y = 0.
 */
export function createLanding(cfg) {
    return {
        t: 0, cfg: { ...cfg },
        pos: [0, cfg.alt0, 0], vel: [cfg.vx0, cfg.vy0, cfg.vz0 || 0],
        prop: cfg.prop, dir: [0, 1, 0], throttle: 0, legs: 0,
        phase: 'descent', td: null, tip: null, guide: null, used: 0, endAt: null, minAlt: cfg.alt0,
    };
}

export const landingMass = s => s.cfg.dry + s.prop;

function airDensity(c, h) {
    return c.drag ? (c.rho0 ?? 1.2) * Math.exp(-Math.max(0, h) / (c.scaleHeight ?? 5600)) : 0;
}

/** Rotates unit vector a towards b by at most maxAngle radians. */
export function slerpLimit(a, b, maxAngle) {
    const c = clamp(dot(a, b), -1, 1);
    const ang = Math.acos(c);
    if (ang <= maxAngle || ang < 1e-9) return b.slice();
    const axis = norm(cross(a, b), [1, 0, 0]);
    // Rodrigues' rotation of a about axis by maxAngle
    const cs = Math.cos(maxAngle), sn = Math.sin(maxAngle);
    const kxa = cross(axis, a);
    const kda = dot(axis, a);
    return norm(add(add(scale(a, cs), scale(kxa, sn)), scale(axis, kda * (1 - cs))));
}

/** Leans a direction no further than maxTilt from vertical. */
export function limitTilt(d, maxTilt) {
    const h = Math.hypot(d[0], d[2]);
    const tilt = Math.atan2(h, d[1]);
    if (tilt <= maxTilt || h < 1e-12) return norm(d);
    return [Math.sin(maxTilt) * d[0] / h, Math.cos(maxTilt), Math.sin(maxTilt) * d[2] / h];
}

/**
 * A simple educational landing guidance (not WSA's AutoLand software): a braking curve for the descent
 * rate, and a steering law that heads for the pad and arrives with no sideways speed. tune: { gain,
 * margin (share of the available braking used), vTouch (m/s) }. Returns { throttle, dir }.
 */
export function landingGuidance(s, tune = {}) {
    const c = s.cfg;
    const gain = tune.gain ?? 1, margin = clamp(tune.margin ?? 0.6, 0.1, 1), vTouch = Math.max(0.3, tune.vTouch ?? 1.5);
    const m = landingMass(s);
    const h = Math.max(0, s.pos[1]);
    const aUp = c.thrust / m - c.g;
    const decel = Math.max(0.2, margin * aUp);
    const hb = Math.max(0, h - 2);
    const vRef = -Math.sqrt(vTouch * vTouch + 2 * decel * hb);
    // Feed forward the braking the curve itself asks for, then correct the error around it
    let aV = c.g + (hb > 0 ? decel : 0) + 3 * gain * (vRef - s.vel[1]);

    const ex = c.tx - s.pos[0], ez = c.tz - s.pos[2];
    let ax, az;
    if (h < 6) {
        ax = -2 * gain * s.vel[0];
        az = -2 * gain * s.vel[2];
    } else {
        const tgo = clamp(h / Math.max(4, -s.vel[1]), 2, 40);
        ax = gain * (6 * ex / (tgo * tgo) - 4 * s.vel[0] / tgo);
        az = gain * (6 * ez / (tgo * tgo) - 4 * s.vel[2] / tgo);
    }
    // Lean no further than the tilt limit (less near the ground), and never trade away braking for steering
    const tiltCap = c.maxTilt * clamp(h / 40, 0.25, 1);
    // While falling freely, still steer if the pad is drifting away: a leaned burn needs some upward push
    if (aV <= 0.05 && h > 30 && Math.hypot(ax, az) > 0.4) aV = Math.hypot(ax, az) / Math.tan(Math.max(tiltCap, 1e-3));
    if (aV <= 0.05) return { throttle: 0, dir: [0, 1, 0], vRef, aV };
    const ah = Math.hypot(ax, az), ahMax = aV * Math.tan(tiltCap);
    if (ah > ahMax && ah > 0) {
        ax *= ahMax / ah;
        az *= ahMax / ah;
    }
    const aMaxTotal = c.thrust / m;
    let F = [ax, aV, az];
    let fm = len(F);
    if (fm > aMaxTotal) {
        if (aV >= aMaxTotal) F = [0, aMaxTotal, 0];
        else {
            const hRoom = Math.sqrt(aMaxTotal * aMaxTotal - aV * aV);
            const k = Math.min(1, hRoom / Math.max(1e-9, Math.hypot(ax, az)));
            F = [ax * k, aV, az * k];
        }
        fm = len(F);
    }
    return { throttle: clamp01(fm / aMaxTotal), dir: norm(F), vRef, aV };
}

/**
 * Advances a landing by dt. ctl: { guidance: bool, tune, throttle 0–1, tiltX, tiltZ (−1…1 of the tilt
 * limit) }. Returns events.
 */
export function stepLanding(s, ctl, dt) {
    const ev = [];
    const c = s.cfg;
    if (s.phase === 'descent') {
        let cmd, target;
        if (ctl.guidance) {
            const gd = landingGuidance(s, ctl.tune);
            s.guide = gd;
            cmd = gd.throttle;
            target = gd.dir;
        } else {
            s.guide = null;
            cmd = clamp01(ctl.throttle ?? 0);
            const ax = clamp(ctl.tiltX ?? 0, -1, 1) * c.maxTilt, az = clamp(ctl.tiltZ ?? 0, -1, 1) * c.maxTilt;
            target = norm([Math.tan(ax), 1, Math.tan(az)]);
        }
        target = limitTilt(target, c.maxTilt);
        s.dir = slerpLimit(s.dir, target, c.slewRate * dt);
        let thr = cmd < 0.01 ? 0 : Math.max(c.minThrottle || 0, Math.min(1, cmd));
        if (s.prop <= 0) thr = 0;
        if (s.throttle === 0 && thr > 0) ev.push({ type: 'ignition' });
        if (s.throttle > 0 && thr === 0 && s.prop > 0) ev.push({ type: 'cutoff' });

        const m = landingMass(s);
        let T = c.thrust * thr;
        const want = massFlow(T, c.isp) * dt;
        const dm = Math.min(s.prop, want);
        if (dm < want) T *= want > 0 ? dm / want : 0;
        s.throttle = thr;
        s.thrust = T;
        const rho = airDensity(c, s.pos[1]);
        const speed = len(s.vel);
        const dragK = rho > 0 ? -0.5 * rho * (c.cd ?? 0.8) * Math.PI * BOOSTER.radius * BOOSTER.radius * speed / m : 0;
        const a = [
            T / m * s.dir[0] + dragK * s.vel[0],
            T / m * s.dir[1] - c.g + dragK * s.vel[1],
            T / m * s.dir[2] + dragK * s.vel[2],
        ];
        s.accel = a;
        const prevY = s.pos[1];
        for (let k = 0; k < 3; k++) {
            s.vel[k] += a[k] * dt;
            s.pos[k] += s.vel[k] * dt;
        }
        s.prop -= dm;
        s.used += dm;
        if (s.prop <= 1e-9 && dm > 0) {
            s.prop = 0;
            ev.push({ type: 'flameout' });
        }
        if (s.pos[1] < c.legsAlt && s.legs < 1) {
            if (s.legs === 0) ev.push({ type: 'legs' });
            s.legs = Math.min(1, s.legs + dt / 1.5);
        }
        s.minAlt = Math.min(s.minAlt, s.pos[1]);
        if (s.pos[1] <= 0) {
            // Back up to the moment of contact along this step's straight path
            const f = prevY > s.pos[1] ? prevY / (prevY - s.pos[1]) : 1;
            for (let k = 0; k < 3; k += 2) s.pos[k] -= s.vel[k] * dt * (1 - f);
            s.pos[1] = 0;
            touchdown(s, ev);
        }
    } else if (s.phase === 'tipping') {
        stepTip(s, dt, ev);
    }
    s.t += dt;
    return ev;
}

function touchdown(s, ev) {
    const c = s.cfg;
    const vs = Math.max(0, -s.vel[1]);
    const hs = Math.hypot(s.vel[0], s.vel[2]);
    const tilt = Math.acos(clamp(s.dir[1], -1, 1));
    const dist = Math.hypot(s.pos[0] - c.tx, s.pos[2] - c.tz);
    const legsDown = s.legs >= 1;
    s.td = { t: s.t, vs, hs, tilt, dist, onPad: dist <= BOOSTER.padRadius, legs: legsDown, prop: s.prop, x: s.pos[0], z: s.pos[2] };
    s.throttle = 0;
    s.thrust = 0;
    if (vs > LANDING_LIMITS.crash || (!legsDown && vs > 3)) {
        s.phase = 'crashed';
        s.outcome = 'crashed';
        s.vel = [0, 0, 0];
        ev.push({ type: 'crash', ...s.td });
        return;
    }
    // Rigid-body tip-over about the leading leg (2-D, in the plane of motion): the booster is a uniform rod
    // of length H pivoting on a foot `span` out from its axis, with its centre of mass `cg` up.
    let u = hs > 0.05 ? [s.vel[0] / hs, 0, s.vel[2] / hs] : null;
    const leanH = Math.hypot(s.dir[0], s.dir[2]);
    if (!u) u = leanH > 1e-6 ? [s.dir[0] / leanH, 0, s.dir[2] / leanH] : [1, 0, 0];
    const phi0 = Math.atan2(s.dir[0] * u[0] + s.dir[2] * u[2], s.dir[1]);
    const span = legsDown ? BOOSTER.legSpan : BOOSTER.radius;
    const cg = BOOSTER.cg, H = BOOSTER.height;
    const phic = Math.atan2(span, cg);
    const d = Math.hypot(span, cg);
    const ip = H * H / 12 + d * d;    // moment of inertia about the foot, per unit mass
    const ry = cg * Math.cos(phi0) + span * Math.sin(phi0);
    const hsU = s.vel[0] * u[0] + s.vel[2] * u[2];
    s.tip = { u, phi: phi0, psi: phi0 - phic, omega: ry * hsU / ip, phic, k: c.g * d / ip, span };
    s.vel = [0, 0, 0];
    s.phase = 'tipping';
    ev.push({ type: 'touchdown', ...s.td });
    if (vs > LANDING_LIMITS.hard) ev.push({ type: 'hard' });
}

function stepTip(s, dt, ev) {
    const tp = s.tip;
    tp.omega += tp.k * Math.sin(tp.psi) * dt;
    tp.psi += tp.omega * dt;
    tp.phi = tp.psi + tp.phic;
    if (tp.psi < 0 && tp.omega <= 0 && tp.phi <= 0) {
        tp.phi = 0;
        tp.omega = 0;
        s.phase = 'landed';
        s.outcome = 'landed';
        ev.push({ type: 'settled' });
    } else if (tp.psi < 0 && tp.omega <= 0 && tp.phi > 0) {
        // Rocking back onto all its legs
    } else if (tp.phi >= Math.PI / 2 - 0.06) {
        tp.phi = Math.PI / 2 - 0.06;
        tp.omega = 0;
        s.phase = 'toppled';
        s.outcome = 'toppled';
        ev.push({ type: 'toppled' });
    }
}

/** Landing score out of 100 from the touchdown record, and the share each part contributed. */
export function scoreLanding(td, outcome) {
    if (!td) return { score: 0, parts: { accuracy: 0, vertical: 0, horizontal: 0, attitude: 0, upright: 0 }, grade: 'F' };
    const parts = {
        accuracy: 40 * clamp01(1 - td.dist / 30),
        vertical: 25 * clamp01(1 - Math.max(0, td.vs - 1) / 7),
        horizontal: 15 * clamp01(1 - td.hs / 3),
        attitude: 10 * clamp01(1 - td.tilt / (15 * DEG)),
        upright: outcome === 'landed' ? 10 : 0,
    };
    let score = Object.values(parts).reduce((a, b) => a + b, 0);
    if (outcome === 'crashed') score = Math.min(score, 15);
    else if (outcome === 'toppled') score = Math.min(score, 45);
    score = Math.round(score);
    return { score, parts, grade: gradeOf(score) };
}

export const gradeOf = score => (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F');

/** Where an unpowered booster would hit the ground (no drag): for the ballistic-impact marker. */
export function ballisticImpact(pos, vel, g) {
    const h = pos[1];
    if (h <= 0 || !(g > 0)) return [pos[0], 0, pos[2]];
    const vy = vel[1];
    const t = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
    return [pos[0] + vel[0] * t, 0, pos[2] + vel[2] * t];
}
