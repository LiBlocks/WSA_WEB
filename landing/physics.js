// SSTO Landing: the flight model. A deliberately simplified model of a small spaceplane, tuned to feel
// light and forgiving rather than to reproduce KSP's or any real aircraft's aerodynamics. Lift, drag,
// side force, thrust and gravity act on the centre of mass. The controls turn the aircraft through
// rate commands with Flight Assist on, and through control moments working against the aircraft's
// own aerodynamic stability with it off. On the ground a simple wheel model takes over: tyre grip,
// rolling friction, brakes and nose-wheel steering. No three.js here, so it can run (and be tested)
// on its own. Coordinates are those of layout.js; the body frame is the three.js one (nose toward -z,
// up +y, right wing +x).
import { RUNWAY, GLIDE, glideAlt, SEA_X, COLLIDERS, AREA } from './layout.js';

const DEG = Math.PI / 180;
const G = 9.81;
const RHO = 1.225;          // kg/m³: sea-level air, the whole flight is low
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ---------- The aircraft ---------- */

export const PLANE = {
    mass: 12000,            // kg
    wingArea: 50,           // m²
    span: 14,               // m
    cl0: 0.25,              // lift coefficient at zero angle of attack
    clAlpha: 5.2,           // per radian
    stallAlpha: 15,         // deg: lift stops growing past this
    cd0: 0.028,
    induced: 0.075,         // induced drag factor k in CD = cd0 + k CL²
    gearDrag: 0.022,
    sideForce: 1.2,         // per radian of sideslip
    thrustMax: 62000,       // N
    spool: 1.2,             // s: engine response time constant
    gearTime: 3,            // s to lower or raise the gear
    // Points on the aircraft (body frame, m from the centre of mass)
    wheels: { nose: [0, -2.2, -5.2], left: [-2.4, -2.2, 1.3], right: [2.4, -2.2, 1.3] },
    parts: [
        { part: 'tail', p: [0, -0.7, 7.9] },
        { part: 'tail', p: [-1, -0.7, 7.9] },
        { part: 'tail', p: [1, -0.7, 7.9] },
        { part: 'wingtip', p: [-7, -0.6, 4.6] },
        { part: 'wingtip', p: [7, -0.6, 4.6] },
        { part: 'nose', p: [0, -0.5, -9.4] },
        { part: 'belly', p: [0, -1.25, -3] },
        { part: 'belly', p: [0, -1.25, 3] },
    ],
    radius: 7,              // m: collision radius against buildings
};

const WEIGHT = PLANE.mass * G;
const QREF = 0.5 * RHO * 70 * 70;   // dynamic pressure at a typical approach speed

// Touchdown limits. Gameplay limits, not real-world certification values. How hard the gear can be hit
// depends on the scenario (gearLimit below); the nose wheel takes half of that.
export const LIMITS = {
    sideways: 10,           // deg between the nose and the direction of travel at touchdown
    tyreSpeed: 95,          // m/s ground speed at touchdown
    rollBank: 20,           // deg: more bank than this and a wingtip reaches the ground
    stopSpeed: 0.3,         // m/s counts as stopped
};

/* ---------- Scenarios ---------- */

// start: x across and z back from the threshold (m), alt (m), speed (m/s), heading (deg, + right of
// the runway direction), path (deg, flight path angle), gear down or up. wind: [x, y, z] m/s.
// assist: how strongly Flight Assist limits the aircraft in this scenario. gearLimit: the sink rate (m/s)
// at touchdown above which the landing gear collapses.
export const SCENARIOS = {
    training: {
        label: 'Training',
        blurb: 'Lined up, slower and closer in, gear already down, a gentle aircraft. The gear takes up to 8 m/s.',
        gearLimit: 8,
        start: { x: 40, z: 4200, alt: 330, speed: 74, heading: 2, path: -3.5, gear: true },
        wind: [0, 0, 0],
        assist: { bank: 30, pitchRate: 7, rollRate: 30 },
        handling: 0.8,
    },
    standard: {
        label: 'Standard',
        blurb: 'Off to the left of the centreline and a little fast. Lower the gear yourself. The gear takes up to 6 m/s.',
        gearLimit: 6,
        start: { x: -240, z: 6000, alt: 470, speed: 92, heading: 6, path: -3.5, gear: false },
        wind: [0, 0, 0],
        assist: { bank: 45, pitchRate: 9, rollRate: 42 },
        handling: 1,
    },
    advanced: {
        label: 'Advanced',
        blurb: 'Further out, high, fast and well off the centreline, with a 5 m/s crosswind from the right. The gear takes up to 4 m/s.',
        gearLimit: 4,
        start: { x: 520, z: 8000, alt: 720, speed: 115, heading: -14, path: -3, gear: false },
        wind: [-5, 0, 0],
        assist: { bank: 60, pitchRate: 11, rollRate: 50 },
        handling: 1.15,
    },
};

/* ---------- Vector and quaternion helpers ([x, y, z], [w, x, y, z]) ---------- */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = a => { const n = length(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

function qmul(a, b) {
    return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
}
const qnorm = q => { const n = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };
const qaxis = (axis, angle) => { const s = Math.sin(angle / 2); return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s]; };

// Rotate a vector by a unit quaternion
export function qrot(q, v) {
    const [w, x, y, z] = q;
    const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    return [v[0] + w * t[0] + y * t[2] - z * t[1], v[1] + w * t[1] + z * t[0] - x * t[2], v[2] + w * t[2] + x * t[1] - y * t[0]];
}

// Attitude from heading (+ right), pitch (+ nose up) and bank (+ right wing down), in degrees
export function qFromAttitude(heading, pitch, bank) {
    return qmul(qmul(qaxis([0, 1, 0], -heading * DEG), qaxis([1, 0, 0], pitch * DEG)), qaxis([0, 0, 1], -bank * DEG));
}

export function axes(q) {
    return { f: qrot(q, [0, 0, -1]), u: qrot(q, [0, 1, 0]), r: qrot(q, [1, 0, 0]) };
}

// Heading, pitch and bank in degrees
export function attitude(q) {
    const { f, u, r } = axes(q);
    return {
        heading: Math.atan2(f[0], -f[2]) / DEG,
        pitch: Math.asin(clamp(f[1], -1, 1)) / DEG,
        bank: Math.atan2(-r[1], u[1]) / DEG,
    };
}

/* ---------- Aerodynamics ---------- */

function liftCoef(alpha) {
    const a = alpha / DEG, s = PLANE.stallAlpha;
    const peak = PLANE.cl0 + PLANE.clAlpha * s * DEG;
    if (a > s) return Math.max(peak - (a - s) * 0.06, 0.55);
    if (a < -12) return Math.min(PLANE.cl0 - PLANE.clAlpha * 12 * DEG + (-12 - a) * 0.05, -0.3);
    return PLANE.cl0 + PLANE.clAlpha * alpha;
}

// Near the ground the wing makes less induced drag and a little more lift (ground effect)
function groundEffect(h) {
    const k = clamp(h / PLANE.span, 0, 4);
    const induced = (16 * k * k) / (1 + 16 * k * k);
    return { induced, lift: 1 + 0.08 * (1 - Math.min(k, 1)) };
}

function aero(s, wind) {
    const { f, u, r } = axes(s.q);
    const air = sub(s.vel, wind);
    const V = Math.max(length(air), 0.1);
    const vh = scale(air, 1 / V);
    const alpha = Math.atan2(-dot(air, u), dot(air, f));
    const beta = Math.asin(clamp(dot(air, r) / V, -1, 1));
    const qbar = 0.5 * RHO * V * V;
    const ge = groundEffect(Math.max(wheelHeight(s), 0));
    const cl = liftCoef(alpha) * ge.lift;
    const stalled = alpha / DEG > PLANE.stallAlpha;
    const cd = PLANE.cd0 + PLANE.induced * cl * cl * ge.induced + PLANE.gearDrag * s.gearPos
        + (stalled ? 0.5 * (alpha / DEG - PLANE.stallAlpha) * DEG : 0) + 0.6 * beta * beta;
    // Lift acts across the airflow in the plane of the wing's up direction
    const liftDir = normalize(sub(u, scale(vh, dot(u, vh))));
    const qS = qbar * PLANE.wingArea;
    const force = add(add(scale(liftDir, qS * cl), scale(vh, -qS * cd)), scale(r, -qS * PLANE.sideForce * beta));
    return { f, u, r, air, V, alpha, beta, qbar, force, stalled, cl };
}

/* ---------- State ---------- */

function trimFor(speed, path, gear) {
    const qS = 0.5 * RHO * speed * speed * PLANE.wingArea;
    const cl = WEIGHT * Math.cos(path * DEG) / qS;
    const alpha = (cl - PLANE.cl0) / PLANE.clAlpha / DEG;
    const cd = PLANE.cd0 + PLANE.induced * cl * cl + (gear ? PLANE.gearDrag : 0);
    const thrust = qS * cd + WEIGHT * Math.sin(path * DEG);
    return { alpha, throttle: clamp(thrust / PLANE.thrustMax, 0, 1) };
}

export function createState(key = 'standard') {
    const sc = SCENARIOS[key] || SCENARIOS.standard;
    const st = sc.start;
    const trim = trimFor(st.speed, st.path, st.gear);
    const h = st.heading * DEG, p = st.path * DEG;
    const vel = [st.speed * Math.sin(h) * Math.cos(p), st.speed * Math.sin(p), -st.speed * Math.cos(h) * Math.cos(p)];
    // Pointed into the relative wind, so the flight starts without sideslip
    const air = sub(vel, sc.wind);
    const heading = Math.atan2(air[0], -air[2]) / DEG;
    return {
        scenario: key,
        t: 0,
        pos: [st.x, st.alt, st.z],
        vel,
        q: qFromAttitude(heading, trim.alpha + st.path, 0),
        rates: { p: 0, q: 0, r: 0 },    // deg/s: roll right, pitch up, yaw right
        pathHold: st.path,              // deg: the flight path Flight Assist keeps when the stick is centred
        bankHold: 0,                    // deg: likewise the bank
        throttle: trim.throttle,
        thrust: trim.throttle * PLANE.thrustMax,
        gear: st.gear,                  // commanded
        gearPos: st.gear ? 1 : 0,       // 0 up … 1 down and locked
        brake: 0,                       // brake in use, 0…1 (for the display)
        autobrake: false,
        mode: 'air',                    // air | ground | done
        touchdown: null,                // what the first wheel contact measured
        bounces: 0,
        groundSince: 0,
        approach: { n: 0, lat2: 0, vert2: 0, assist: false },   // final approach samples
        assistUsed: false,              // Flight Assist was on at some point in the final approach or the rollout
        track: [],                      // [x, y, z] every 0.25 s, for the summary graphic
        trackAt: 0,
        result: null,
    };
}

/* ---------- Telemetry ---------- */

function wheelPoints(s) {
    const w = PLANE.wheels;
    return { nose: add(s.pos, qrot(s.q, w.nose)), left: add(s.pos, qrot(s.q, w.left)), right: add(s.pos, qrot(s.q, w.right)) };
}

// Height of the lowest wheel (or, with the gear up, the lowest part of the belly) above the ground
function wheelHeight(s) {
    const pts = s.gearPos > 0.5 ? Object.values(PLANE.wheels) : PLANE.parts.map(p => p.p);
    let low = Infinity;
    for (const p of pts) low = Math.min(low, s.pos[1] + qrot(s.q, p)[1]);
    return low;
}

export function telemetry(s, wind = [0, 0, 0]) {
    const a = aero(s, wind);
    const att = attitude(s.q);
    const gs = Math.hypot(s.vel[0], s.vel[2]);
    const track = gs > 1 ? Math.atan2(s.vel[0], -s.vel[2]) / DEG : att.heading;
    const z = s.pos[2];
    const agl = Math.max(wheelHeight(s), 0);
    return {
        airspeed: a.V,
        groundSpeed: gs,
        vs: s.vel[1],
        alt: agl,
        x: s.pos[0],
        z,
        along: -z,                  // m past the threshold (negative: before it)
        distance: Math.max(z, 0),   // m to the threshold
        glideDev: z > -GLIDE.aim ? s.pos[1] - 2.2 - glideAlt(z) : 0,   // m above (+) or below the path
        heading: att.heading,
        pitch: att.pitch,
        bank: att.bank,
        track,
        drift: att.heading - track,
        alpha: a.alpha / DEG,
        beta: a.beta / DEG,
        stall: a.alpha / DEG > PLANE.stallAlpha - 2 && s.mode === 'air',
        throttle: s.throttle,
        gearDown: s.gearPos > 0.99,
        gearMoving: s.gearPos > 0.01 && s.gearPos < 0.99,
        gearPos: s.gearPos,
        brake: s.brake,
        autobrake: s.autobrake,
        thrust: s.thrust / PLANE.thrustMax,
        phase: phaseOf(s, agl),
        mode: s.mode,
        path: gs > 1 ? Math.atan2(s.vel[1], gs) / DEG : 0,
    };
}

function phaseOf(s, agl) {
    if (s.result) return s.result.success ? 'LANDED' : 'FAILED';
    if (s.mode === 'ground') return s.t - s.touchdown.t < 1.5 ? 'TOUCHDOWN' : 'ROLLOUT';
    if (s.touchdown) return 'BOUNCE';
    if (s.pos[2] > GLIDE.final) return 'APPROACH';
    if (agl < 15 && s.pos[2] < 400) return 'FLARE';
    return 'FINAL';
}

/* ---------- The step ---------- */

/**
 * Advance the flight by dt seconds.
 * input: { pitch, roll, yaw } each -1…1 (+ nose up, + roll right, + yaw right), throttle 0…1,
 *        brake 0…1, gear (true: down)
 * env: { assist, wind?, colliders? }
 * Returns an event ({ type: … }) or null.
 */
export function step(s, input, dt, env) {
    if (s.mode === 'done') return null;
    const sc = SCENARIOS[s.scenario];
    const wind = sc.wind;
    s.t += dt;
    s.throttle = clamp(input.throttle, 0, 1);
    s.thrust += (s.throttle * PLANE.thrustMax - s.thrust) * (1 - Math.exp(-dt / PLANE.spool));
    if (input.gear !== s.gear) s.gear = input.gear;
    s.gearPos = clamp(s.gearPos + (s.gear ? dt : -dt) / PLANE.gearTime, 0, 1);

    const ev = s.mode === 'air' ? stepAir(s, input, dt, env, sc, wind) : stepGround(s, input, dt, env, wind);
    if (s.t >= s.trackAt) {
        s.track.push([Math.round(s.pos[0] * 10) / 10, Math.round(s.pos[1] * 10) / 10, Math.round(s.pos[2] * 10) / 10]);
        s.trackAt = s.t + 0.25;
    }
    return ev;
}

function stepAir(s, input, dt, env, sc, wind) {
    const a = aero(s, wind);
    const att = attitude(s.q);
    const gamma = Math.atan2(s.vel[1], Math.hypot(s.vel[0], s.vel[2])) / DEG;
    const alphaDeg = a.alpha / DEG, betaDeg = a.beta / DEG;
    const authority = clamp(a.qbar / QREF, 0.25, 1.4);
    const rates = s.rates;
    const k = sc.handling;

    if (env.assist) {
        // Rate commands; centre the stick and the attitude holds (the flight path, in pitch)
        const lim = sc.assist;
        let qc, pc, rc;
        if (Math.abs(input.pitch) > 0.04) {
            qc = input.pitch * lim.pitchRate * Math.min(authority, 1);
            s.pathHold = gamma;
        } else {
            qc = clamp((s.pathHold - gamma) * 1.2, -4, 4);
        }
        if (att.pitch > 25 && qc > 0) qc *= Math.max(0, (32 - att.pitch) / 7);
        if (att.pitch < -25 && qc < 0) qc *= Math.max(0, (att.pitch + 32) / 7);
        // Stall protection: the nose won't be pulled past a safe angle of attack
        if (alphaDeg > PLANE.stallAlpha - 3) {
            qc = Math.min(qc, (PLANE.stallAlpha - 3 - alphaDeg) * 2);
            s.pathHold = Math.min(s.pathHold, gamma);
        }
        // Roll: a rate while the stick is out; centred, the bank it was let go at is held
        if (Math.abs(input.roll) > 0.05) {
            pc = input.roll * lim.rollRate * Math.min(authority, 1);
            s.bankHold = att.bank;
        } else {
            pc = clamp((s.bankHold - att.bank) * 3, -15, 15);
        }
        if (Math.abs(att.bank) > lim.bank) {
            s.bankHold = Math.sign(att.bank) * Math.min(Math.abs(s.bankHold), lim.bank);
            if (Math.sign(pc) === Math.sign(att.bank)) pc = 0;
            pc -= (att.bank - Math.sign(att.bank) * lim.bank) * 1.5;
        }
        // Coordination: the nose is turned into the airflow, so turns don't skid or slip
        rc = input.yaw * 6 + betaDeg * 2.5;
        const follow = (v, c, tau) => v + (c - v) * (1 - Math.exp(-dt / tau));
        rates.q = follow(rates.q, qc, 0.3);
        rates.p = follow(rates.p, pc, 0.12);
        rates.r = follow(rates.r, rc, 0.35);
    } else {
        // Control moments against the aircraft's own stability: the nose weathervanes into the
        // airflow and settles toward a trimmed angle of attack; bank stays where it is put
        const qn = clamp(a.qbar / QREF, 0.2, 1.6);
        rates.q += (input.pitch * 36 * k * qn - 2.0 * rates.q - 2.6 * (alphaDeg - 5) * qn) * dt;
        rates.p += (input.roll * 120 * k * qn - 2.6 * rates.p) * dt;
        rates.r += (input.yaw * 22 * k * qn - 1.8 * rates.r + 2.2 * betaDeg * qn) * dt;
        s.pathHold = gamma;
        s.bankHold = att.bank;
    }
    rates.p = clamp(rates.p, -120, 120);
    rates.q = clamp(rates.q, -40, 40);
    rates.r = clamp(rates.r, -30, 30);
    // Body rates: pitch about +x, yaw right about -y, roll right about -z
    const w = [rates.q * DEG, -rates.r * DEG, -rates.p * DEG];
    const ang = Math.hypot(w[0], w[1], w[2]) * dt;
    if (ang > 1e-9) s.q = qnorm(qmul(s.q, qaxis(scale(w, dt / ang), ang)));

    // Forces
    const thrust = scale(a.f, s.thrust);
    const force = add(add(a.force, thrust), [0, -WEIGHT, 0]);
    s.vel = add(s.vel, scale(force, dt / PLANE.mass));
    s.pos = add(s.pos, scale(s.vel, dt));
    s.brake = 0;
    s.autobrake = false;

    // Final approach samples, for the stability score
    const z = s.pos[2];
    if (!s.touchdown && z > 0 && z < GLIDE.final) {
        const ap = s.approach;
        ap.n += dt;
        ap.lat2 += s.pos[0] * s.pos[0] * dt;
        const dv = s.pos[1] - 2.2 - glideAlt(z);
        ap.vert2 += dv * dv * dt;
        if (env.assist) s.assistUsed = true;
    }
    // A touch and go: climbing well away after touching down starts a new approach
    if (s.touchdown && s.pos[1] > 40) {
        s.touchdown = null;
        s.bounces = 0;
        return { type: 'goaround' };
    }

    // Collisions with the spaceport
    for (const c of env.colliders || COLLIDERS) {
        const p = s.pos, r = PLANE.radius;
        if (p[0] > c.min[0] - r && p[0] < c.max[0] + r && p[1] < c.max[1] + r * 0.5 && p[2] > c.min[2] - r && p[2] < c.max[2] + r) {
            return finish(s, false, { code: 'collision', title: 'COLLISION', text: `The aircraft flew into ${c.name}.` });
        }
    }
    if (Math.abs(s.pos[0]) > AREA.x || s.pos[2] > AREA.zMax || s.pos[2] < AREA.zMin || s.pos[1] > AREA.ceiling) {
        return finish(s, false, { code: 'area', title: 'LEFT THE LANDING AREA', text: 'The aircraft flew too far from the spaceport to come back for this landing.' });
    }

    return groundContact(s, a, env);
}

// Has anything touched the ground this step, and what does that mean?
function groundContact(s, a, env) {
    const gearDown = s.gearPos > 0.99;
    let body = null;
    for (const part of PLANE.parts) {
        const y = s.pos[1] + qrot(s.q, part.p)[1];
        if (y <= 0 && (!body || y < body.y)) body = { part: part.part, y };
    }
    const wheels = wheelPoints(s);
    const wheelLow = Math.min(wheels.nose[1], wheels.left[1], wheels.right[1]);
    const att = attitude(s.q);
    const sink = -s.vel[1];
    const gs = Math.hypot(s.vel[0], s.vel[2]);

    if (body && !(gearDown && wheelLow < body.y)) {
        const where = s.pos[0] < SEA_X ? ' in the sea' : '';
        if (sink > 10 || att.pitch < -15 || Math.abs(att.bank) > 60) {
            const how = Math.abs(att.bank) > 100 ? 'upside down' : att.pitch < -15 ? 'nose first' : `sinking at ${sink.toFixed(1)} m/s`;
            return finish(s, false, { code: 'crash', title: 'CRASH', text: `The aircraft hit the ground${where} ${how}.` });
        }
        if (!gearDown && Math.abs(att.bank) < 30) {
            return finish(s, false, { code: 'gearup', title: 'GEAR-UP LANDING', text: `The landing gear was ${s.gearPos > 0.01 ? 'still coming down' : 'up'}, so the aircraft landed on its belly${where}. Lower it with G before the flare.` });
        }
        if (body.part === 'tail') {
            return finish(s, false, { code: 'tailstrike', title: 'TAIL STRIKE', text: `The nose was ${att.pitch.toFixed(1)}° up, high enough for the tail to hit the ground first. Flare less, and keep a little more speed.` });
        }
        if (body.part === 'wingtip') {
            return finish(s, false, { code: 'wingtip', title: 'WINGTIP STRIKE', text: `The aircraft was banked ${Math.abs(att.bank).toFixed(0)}° and a wingtip hit the ground. Level the wings before touchdown.` });
        }
        return finish(s, false, { code: 'crash', title: 'CRASH', text: `The ${body.part === 'nose' ? 'nose' : 'aircraft'} hit the ground${where} before the wheels did.` });
    }
    if (!gearDown || wheelLow > 0) return null;

    // Wheels on the ground
    const tdX = (wheels.left[0] + wheels.right[0]) / 2;
    const tdS = -(wheels.left[2] + wheels.right[2]) / 2;
    const track = Math.atan2(s.vel[0], -s.vel[2]) / DEG;
    const drift = att.heading - track;
    const noseFirst = wheels.nose[1] < Math.min(wheels.left[1], wheels.right[1]) - 0.05;
    const onRunway = Math.abs(tdX) <= RUNWAY.width / 2 - 2.4 && tdS >= 0 && tdS <= RUNWAY.length;
    const first = !s.touchdown;
    if (first) {
        s.touchdown = {
            t: s.t, vs: s.vel[1], gs, airspeed: a.V, x: tdX, s: tdS, heading: att.heading, drift, bank: att.bank,
            pitch: att.pitch, noseFirst, assist: env.assist,
        };
    }
    if (!onRunway) {
        if (s.pos[0] < SEA_X) return finish(s, false, { code: 'sea', title: 'MISSED THE RUNWAY', text: 'The aircraft came down in the sea, left of the runway.' });
        if (tdS < 0) return finish(s, false, { code: 'short', title: 'SHORT OF THE RUNWAY', text: `The wheels touched the grass ${Math.round(-tdS)} m before the threshold. Stay on the glide path until the runway is under you.` });
        if (tdS > RUNWAY.length) return finish(s, false, { code: 'long', title: 'MISSED THE RUNWAY', text: 'The aircraft touched down beyond the far end of the runway.' });
        return finish(s, false, { code: 'offside', title: 'MISSED THE RUNWAY', text: `The wheels touched the grass ${Math.round(Math.abs(tdX) - RUNWAY.width / 2 + 2.4)} m ${tdX < 0 ? 'left' : 'right'} of the runway edge.` });
    }
    const gearLimit = SCENARIOS[s.scenario].gearLimit;
    if (sink > gearLimit) {
        return finish(s, false, { code: 'hard', title: 'HARD LANDING', text: `The aircraft hit the runway sinking at ${sink.toFixed(1)} m/s, more than the gear can take (${gearLimit} m/s in this scenario). Flare earlier: raise the nose gently in the last 10–15 m.` });
    }
    if (noseFirst && sink > gearLimit / 2) {
        return finish(s, false, { code: 'nosegear', title: 'NOSE GEAR COLLAPSE', text: `The nose wheel touched first, sinking at ${sink.toFixed(1)} m/s. Land on the main wheels with the nose slightly up.` });
    }
    if (Math.abs(drift) > LIMITS.sideways) {
        return finish(s, false, { code: 'sideways', title: 'SIDEWAYS TOUCHDOWN', text: `The aircraft touched down moving ${Math.abs(drift).toFixed(0)}° sideways to where its nose pointed, and the gear gave way. Line the nose up with the runway before touchdown.` });
    }
    if (gs > LIMITS.tyreSpeed) {
        return finish(s, false, { code: 'fast', title: 'TOUCHDOWN TOO FAST', text: `The aircraft touched down at ${gs.toFixed(0)} m/s, faster than the tyres are rated for (${LIMITS.tyreSpeed} m/s). Reduce throttle earlier.` });
    }
    if (Math.abs(att.bank) > LIMITS.rollBank) {
        return finish(s, false, { code: 'wingtip', title: 'WINGTIP STRIKE', text: `The aircraft was banked ${Math.abs(att.bank).toFixed(0)}° at touchdown. Level the wings first.` });
    }
    if (!first) s.bounces++;
    s.mode = 'ground';
    s.groundSince = s.t;
    s.vel[1] = 0;
    s.rates.p = s.rates.r = 0;
    s.rates.q = 0;
    settle(s);
    return { type: first ? 'touchdown' : 'retouch', sink };
}

// Put the lowest wheel on the ground
function settle(s) {
    let low = Infinity;
    for (const w of Object.values(PLANE.wheels)) low = Math.min(low, qrot(s.q, w)[1]);
    s.pos[1] = -low;
}

function stepGround(s, input, dt, env, wind) {
    const a = aero(s, wind);
    const att = attitude(s.q);
    const fh = normalize([a.f[0], 0, a.f[2]]);
    const rh = [-fh[2], 0, fh[0]];
    let u = dot(s.vel, fh), w = dot(s.vel, rh);

    // Lift and drag still act; whatever lift doesn't carry, the wheels do
    const liftUp = a.force[1];
    const normal = Math.max(0, WEIGHT - liftUp);
    const dragAlong = dot(a.force, fh);
    // Brakes: the pedal, or the autobrake Flight Assist sets once the nose wheel is down at idle
    const noseDown = att.pitch < 1;
    s.autobrake = !!env.assist && noseDown && s.throttle < 0.15 && s.t - s.groundSince > 1 && input.brake < 0.45;
    s.brake = Math.max(input.brake, s.autobrake ? 0.45 : 0);
    const brakeDecel = s.brake * 5 * (normal / WEIGHT);
    const rolling = 0.02 * normal / PLANE.mass;
    const along = (s.thrust * dot(a.f, fh) + dragAlong) / PLANE.mass;
    const resist = rolling + brakeDecel;
    u += along * dt;
    if (u > 0) u = Math.max(0, u - resist * dt);
    w *= Math.exp(-dt / 0.15);       // tyre grip stops sideways sliding

    // Nose-wheel steering (rudder keys, or the roll controls on the ground): gentler at speed
    const steer = clamp(input.yaw + input.roll * 0.8, -1, 1);
    const yawRate = steer * 10 * clamp(14 / Math.max(u, 1), 0.12, 1);
    // The nose comes down onto its wheel unless held up while there is still speed for it
    let pitch = att.pitch;
    if (pitch > 0) {
        const hold = input.pitch > 0.2 && u > 38;
        pitch = Math.max(0, pitch + (hold ? Math.min(input.pitch * 2, 1) - 0.6 : -(2.5 + Math.max(0, 40 - u) * 0.1)) * dt);
    }
    const bank = att.bank * Math.exp(-dt / 0.12);
    s.q = qFromAttitude(att.heading + yawRate * dt, pitch, bank);
    const fh2 = normalize([Math.sin((att.heading + yawRate * dt) * DEG), 0, -Math.cos((att.heading + yawRate * dt) * DEG)]);
    const rh2 = [-fh2[2], 0, fh2[0]];

    // Lift greater than weight lifts the aircraft off again (a bounce)
    let vy = s.vel[1];
    vy = liftUp > WEIGHT ? vy + (liftUp - WEIGHT) / PLANE.mass * dt : 0;
    s.vel = add(add(scale(fh2, u), scale(rh2, w)), [0, vy, 0]);
    s.pos = add(s.pos, scale(s.vel, dt));
    let low = Infinity;
    for (const p of Object.values(PLANE.wheels)) low = Math.min(low, qrot(s.q, p)[1]);
    const rest = -low;
    if (s.pos[1] - rest > 0.2) {
        s.mode = 'air';
        s.pathHold = 0;
        s.bankHold = 0;
        return { type: 'bounce' };
    }
    s.pos[1] = Math.max(rest, s.pos[1]);
    if (env.assist) s.assistUsed = true;

    // Off the runway?
    const wheels = wheelPoints(s);
    const mainX = Math.max(Math.abs(wheels.left[0]), Math.abs(wheels.right[0]));
    const mainS = -Math.min(wheels.left[2], wheels.right[2]);
    for (const part of PLANE.parts) {
        if (s.pos[1] + qrot(s.q, part.p)[1] <= 0 && part.part === 'tail') {
            return finish(s, false, { code: 'tailstrike', title: 'TAIL STRIKE', text: `The nose was held ${att.pitch.toFixed(1)}° up on the runway and the tail scraped the ground.` });
        }
    }
    if (mainX > RUNWAY.width / 2) {
        return finish(s, false, { code: 'excursion', title: 'RUNWAY EXCURSION', text: `The aircraft ran off the ${s.pos[0] < 0 ? 'left' : 'right'} side of the runway at ${u.toFixed(0)} m/s. Steer with A and D (or the rudder) to stay on the centreline.` });
    }
    if (mainS > RUNWAY.length) {
        return finish(s, false, { code: 'overrun', title: 'RUNWAY OVERRUN', text: `The aircraft ran off the far end of the runway at ${u.toFixed(0)} m/s. Touch down earlier and slower, and brake (hold B).` });
    }
    if (u < LIMITS.stopSpeed && s.t - s.groundSince > 1.5) {
        s.vel = [0, 0, 0];
        return finish(s, true, null);
    }
    return null;
}

function finish(s, success, fail) {
    s.mode = 'done';
    const td = s.touchdown;
    const ap = s.approach;
    const stopS = -s.pos[2];
    s.result = {
        success,
        fail,
        scenario: s.scenario,
        time: s.t,
        touchdown: td,
        stopAt: stopS,
        rollout: td ? stopS - td.s : 0,
        remaining: RUNWAY.length - stopS,
        stability: ap.n > 5 ? stabilityScore(ap) : null,
        bounces: s.bounces,
        assistUsed: s.assistUsed,
        track: s.track.slice(),
        pos: s.pos.slice(),
    };
    return { type: success ? 'landed' : 'failed' };
}

// 0–100 from how far the final approach strayed from the centreline and the glide path (RMS)
export function stabilityScore(ap) {
    const lat = Math.sqrt(ap.lat2 / ap.n), vert = Math.sqrt(ap.vert2 / ap.n);
    return Math.round(100 * (1 - 0.5 * Math.min(1, lat / 60) - 0.5 * Math.min(1, vert / 40)));
}
