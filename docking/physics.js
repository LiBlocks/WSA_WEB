// Docking Simulator physics: simplified local relative-motion model. The station is fixed in its own
// docking frame (no orbital mechanics), and the spacecraft is a rigid body that moves and turns in it
// under RCS thrust. The active docking port sits at the origin facing +Z; +X is to the right and +Y is
// up as seen from an approaching craft. No three.js here, so it can run (and be tested) on its own.

const DEG = Math.PI / 180;

// Docking conditions checked at contact. Gameplay limits, not real-world certification values.
export const DOCKING = {
    captureDistance: 0.5,   // m: the probe meets the port when the docking interfaces are this close
    maxRadial: 0.25,        // m: lateral/vertical miss from the docking axis
    maxClosing: 0.2,        // m/s: closing speed
    maxAngle: 5,            // deg: each of pitch, yaw and roll error
    maxRate: 0.5,           // deg/s: total rotation rate
    contactRadius: 1.2,     // m: inside this the port's guides take the contact; outside it is the hull
    hardContactSpeed: 1.0,  // m/s: a port contact faster than this is a crash, not a bounce
    gentleBump: 0.25,       // m/s: hull contacts slower than this bounce off instead of ending the run
    lostRange: 600,         // m: drifting this far from the port ends the run
    latchTime: 1.5,         // s: soft capture pulls the craft in and squares it up over this time
};

// The player's spacecraft
export const CRAFT = {
    transAccel: 0.15,       // m/s² from the translation thrusters
    rotAccel: 3,            // deg/s² from the rotation thrusters
    fineShare: 0.25,        // share of full thrust while Shift is held
    noseOffset: 2.5,        // m from the centre of mass forward to the docking interface (camera)
    maxRate: 20,            // deg/s hard limit on rotation, so the craft can't spin up without bound
    assist: {
        rateLimit: 6,       // deg/s: commanded rotation stops building past this
        rotTime: 0.6,       // s: time constant for damping uncommanded rotation
        transTime: 4,       // s: time constant for damping uncommanded sideways drift
        transShare: 0.35,   // share of translation thrust that damping may use
    },
    // Points on the hull (body frame, m, from the centre of mass) tested against the station
    hull: (() => {
        const pts = [[0, 0, -2.5]];
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
            pts.push([1.1 * c, 1.1 * s, -2.1], [1.45 * c, 1.45 * s, 0], [1.4 * c, 1.4 * s, 2.6]);
        }
        return pts;
    })(),
};

// Where the run starts: the docking interface 7 m right, 4.5 m low and about 180 m out, drifting a little
export const SCENARIO = {
    nose: [7, -4.5, 180],   // m, docking frame
    vel: [0.05, -0.02, -0.4],   // m/s
    attitude: { yaw: -3, pitch: -2, roll: 4 },  // deg (yaw +: nose left, pitch +: nose up, roll +: left side down)
    rates: [0.12, -0.18, 0.1],  // deg/s about the body axes (pitch, yaw, roll)
};

/* ---------- Small vector and quaternion helpers ([x, y, z], [w, x, y, z]) ---------- */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = a => Math.hypot(a[0], a[1], a[2]);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function qmul(a, b) {
    return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
}
const qnorm = q => { const n = Math.hypot(...q); return q.map(v => v / n); };
const qconj = q => [q[0], -q[1], -q[2], -q[3]];
// Rotate a vector by a unit quaternion
export function qrot(q, v) {
    const [w, x, y, z] = q;
    const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    return [v[0] + w * t[0] + y * t[2] - z * t[1], v[1] + w * t[1] + z * t[0] - x * t[2], v[2] + w * t[2] + x * t[1] - y * t[0]];
}
const qaxis = (axis, angle) => { const s = Math.sin(angle / 2); return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s]; };
// Yaw about Y, then pitch about X, then roll about Z (degrees)
export const qFromYPR = (yaw, pitch, roll) =>
    qmul(qmul(qaxis([0, 1, 0], yaw * DEG), qaxis([1, 0, 0], pitch * DEG)), qaxis([0, 0, 1], roll * DEG));
// The inverse: [yaw, pitch, roll] in degrees for the same Y-X-Z order
export function yprFromQ(q) {
    const [w, x, y, z] = q;
    const m13 = 2 * (x * z + w * y), m23 = 2 * (y * z - w * x), m33 = 1 - 2 * (x * x + y * y);
    const m21 = 2 * (x * y + w * z), m22 = 1 - 2 * (x * x + z * z);
    const m11 = 1 - 2 * (y * y + z * z), m31 = 2 * (x * z - w * y);
    const pitch = Math.asin(clamp(-m23, -1, 1));
    if (Math.abs(m23) < 0.9999999) return [Math.atan2(m13, m33) / DEG, pitch / DEG, Math.atan2(m21, m22) / DEG];
    return [Math.atan2(-m31, m11) / DEG, pitch / DEG, 0];
}
export const slerp = (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map(v => -v); d = -d; }
    if (d > 0.9995) return qnorm(a.map((v, i) => v + (b[i] - v) * t));
    const th = Math.acos(d), s = Math.sin(th);
    return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
};

/* ---------- Guidance helpers ---------- */

// The approach corridor: how far off the axis is still fine at a given distance from the port
export const corridorAt = axial => DOCKING.maxRadial + 0.04 * Math.max(axial, 0);
// The suggested top closing speed at a given distance: the contact limit near the port, faster far out
export const closingLimitAt = axial => Math.min(3, DOCKING.maxClosing + 0.02 * Math.max(axial - DOCKING.captureDistance, 0));

/* ---------- State ---------- */

const NOSE = () => [0, 0, -CRAFT.noseOffset];

export function createState(scenario = SCENARIO) {
    const a = scenario.attitude;
    const q = qFromYPR(a.yaw, a.pitch, a.roll);
    return {
        pos: sub(scenario.nose, qrot(q, NOSE())),  // centre of mass, m
        vel: [...scenario.vel],                     // m/s
        q,                                          // body → docking frame
        w: scenario.rates.map(r => r * DEG),        // rad/s about body X (pitch), Y (yaw), Z (roll)
        mode: 'flying',     // flying | latching | docked | collision | lost
        t: 0,               // flight time, s
        dv: 0,              // RCS delta-v spent, m/s
        failed: 0,          // failed contacts so far
        cooldown: false,    // backing off after a failed contact
        assistFiring: [0, 0, 0, 0, 0, 0],   // what flight assist is commanding (trans x y z, rot x y z)
        latch: null,        // { t, from: { pos, q } } while the capture pulls the craft in
        result: null,       // stats when the run ends
    };
}

/* ---------- Telemetry ---------- */

export function telemetry(s) {
    const noseArm = qrot(s.q, NOSE());
    const nose = add(s.pos, noseArm);
    const wWorld = qrot(s.q, s.w);
    const vel = add(s.vel, cross(wWorld, noseArm));     // velocity of the docking interface
    const [yaw, pitch, roll] = yprFromQ(s.q);
    const axial = nose[2], radial = Math.hypot(nose[0], nose[1]);
    const rates = s.w.map(r => r / DEG);
    const rate = Math.hypot(...rates);
    const closing = -vel[2];
    const corridor = corridorAt(axial), closingLimit = closingLimitAt(axial);
    const attitudeOk = Math.max(Math.abs(yaw), Math.abs(pitch), Math.abs(roll)) <= DOCKING.maxAngle;
    let phase;
    if (s.mode === 'latching' || s.mode === 'docked') phase = 'DOCKED';
    else if (s.mode === 'collision') phase = 'COLLISION';
    else if (s.mode === 'lost') phase = 'LOST';
    else if (axial > 40) phase = 'APPROACH';
    else if (attitudeOk && radial <= corridor && rate <= 1) phase = 'FINAL APPROACH';
    else phase = 'ALIGN';
    // Which way to translate (body frame) to get back on the axis
    const toAxis = qrot(qconj(s.q), [-nose[0], -nose[1], 0]);
    return {
        nose, vel, range: length(nose), axial, lateral: nose[0], vertical: nose[1], radial,
        closing, speed: length(vel), yaw, pitch, roll, rates, rate, corridor, closingLimit,
        attitudeOk, phase, toAxis, t: s.t, dv: s.dv, failed: s.failed,
        forward: qrot(s.q, [0, 0, -1]), up: qrot(s.q, [0, 1, 0]),
    };
}

// Which docking conditions a contact misses, as readable reasons (empty when it's a good dock)
export function dockingMisses(tm) {
    const misses = [];
    if (tm.closing > DOCKING.maxClosing) misses.push(`closing ${tm.closing.toFixed(2)} m/s (limit ${DOCKING.maxClosing})`);
    if (tm.radial > DOCKING.maxRadial) misses.push(`${tm.radial.toFixed(2)} m off the axis (limit ${DOCKING.maxRadial})`);
    const angle = Math.max(Math.abs(tm.yaw), Math.abs(tm.pitch), Math.abs(tm.roll));
    if (angle > DOCKING.maxAngle) misses.push(`${angle.toFixed(1)}° out of alignment (limit ${DOCKING.maxAngle}°)`);
    if (tm.rate > DOCKING.maxRate) misses.push(`rotating ${tm.rate.toFixed(2)}°/s (limit ${DOCKING.maxRate})`);
    return misses;
}

/* ---------- Simulation step ---------- */

const inside = (p, b) => p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] && p[2] > b.min[2] && p[2] < b.max[2];

function hullHit(s, colliders) {
    for (const local of CRAFT.hull) {
        const p = add(s.pos, qrot(s.q, local));
        for (const c of colliders) if (inside(p, c)) return c;
    }
    return null;
}

function finish(s, mode, extra) {
    const tm = telemetry(s);
    s.mode = mode;
    s.result = {
        time: s.t, closing: tm.closing, radial: tm.radial, angle: Math.max(Math.abs(tm.yaw), Math.abs(tm.pitch), Math.abs(tm.roll)),
        rate: tm.rate, dv: s.dv, failed: s.failed, ...extra,
    };
}

// The pose the craft is pulled into once captured: docking interfaces together, axes lined up
const dockedPose = () => ({ pos: sub([0, 0, 0], NOSE()), q: [1, 0, 0, 0] });

/**
 * Advances the simulation by dt seconds.
 * input: { trans: [x, y, z], rot: [pitch, yaw, roll] } each -1..1 (body axes; +Z trans is backward),
 *        fine: boolean, assist: boolean
 * colliders: [{ name, min: [x, y, z], max: [x, y, z] }] in the docking frame
 * Returns an event for the interface, or null: { type: 'bounce' | 'bump' | 'docked' | 'collision' | 'lost', … }
 */
export function step(s, input, dt, colliders = []) {
    if (s.mode === 'latching') {
        s.latch.t += dt;
        const k = Math.min(s.latch.t / DOCKING.latchTime, 1), e = k * k * (3 - 2 * k);
        const to = dockedPose();
        s.pos = add(s.latch.from.pos, scale(sub(to.pos, s.latch.from.pos), e));
        s.q = slerp(s.latch.from.q, to.q, e);
        if (k >= 1) { s.mode = 'docked'; return { type: 'docked' }; }
        return null;
    }
    if (s.mode !== 'flying') return null;

    const share = input.fine ? CRAFT.fineShare : 1;
    const A = CRAFT.assist;
    s.assistFiring = [0, 0, 0, 0, 0, 0];

    // Translation: commanded thrust along the body axes, plus (with assist) gentle damping of sideways drift
    const aBody = input.trans.map(u => clamp(u, -1, 1) * CRAFT.transAccel * share);
    if (input.assist) {
        const vBody = qrot(qconj(s.q), s.vel);
        for (const i of [0, 1]) {
            if (input.trans[i]) continue;
            const cap = CRAFT.transAccel * A.transShare;
            aBody[i] = clamp(-vBody[i] / A.transTime, -cap, cap);
            if (Math.abs(aBody[i]) > 1e-4) s.assistFiring[i] = -Math.sign(vBody[i]);
        }
    }
    const aWorld = qrot(s.q, aBody);
    s.vel = add(s.vel, scale(aWorld, dt));
    s.dv += length(aBody) * dt;

    // Rotation: angular acceleration, never an instant change of attitude
    const rotAccel = CRAFT.rotAccel * DEG * share;
    const alpha = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        const u = clamp(input.rot[i], -1, 1);
        if (u) {
            const limited = input.assist && Math.abs(s.w[i]) >= A.rateLimit * DEG && Math.sign(s.w[i]) === Math.sign(u);
            alpha[i] = limited ? 0 : u * rotAccel;
        } else if (input.assist) {
            alpha[i] = clamp(-s.w[i] / A.rotTime, -CRAFT.rotAccel * DEG, CRAFT.rotAccel * DEG);
            if (Math.abs(s.w[i]) > 0.02 * DEG) s.assistFiring[3 + i] = -Math.sign(s.w[i]);
        }
        s.w[i] = clamp(s.w[i] + alpha[i] * dt, -CRAFT.maxRate * DEG, CRAFT.maxRate * DEG);
    }
    s.dv += length(alpha) * CRAFT.noseOffset * dt * 0.5;   // rotation thrusters' share, roughly

    const before = { pos: s.pos, q: s.q };
    s.pos = add(s.pos, scale(s.vel, dt));
    const angle = length(s.w) * dt;
    if (angle > 0) s.q = qnorm(qmul(s.q, qaxis(scale(s.w, 1 / length(s.w)), angle)));
    s.t += dt;

    // Contact with the active port: the probe meets the port at the capture distance
    const tm = telemetry(s);
    if (s.cooldown && tm.axial > DOCKING.captureDistance + 0.3) s.cooldown = false;
    if (!s.cooldown && tm.axial <= DOCKING.captureDistance && tm.axial > -1 && tm.radial <= DOCKING.contactRadius) {
        const misses = dockingMisses(tm);
        if (!misses.length) {
            finish(s, 'latching', {});
            s.latch = { t: 0, from: { pos: s.pos, q: s.q } };
            s.vel = [0, 0, 0];
            s.w = [0, 0, 0];
            return { type: 'capture', telemetry: tm };
        }
        if (tm.closing > DOCKING.hardContactSpeed) {
            finish(s, 'collision', { what: 'the docking port', speed: tm.closing, misses });
            return { type: 'collision', telemetry: tm, what: 'the docking port' };
        }
        // Failed contact: the guides push the craft back along the axis, with a small upset
        s.failed++;
        s.cooldown = true;
        const back = Math.max(0.05, 0.4 * Math.max(tm.closing, 0));
        s.vel = [s.vel[0] * 0.5, s.vel[1] * 0.5, back];
        const kick = 0.3 * DEG;
        s.w = [s.w[0] * 0.5 + (tm.vertical > 0 ? kick : -kick), s.w[1] * 0.5 + (tm.lateral > 0 ? -kick : kick), s.w[2] * 0.5];
        return { type: 'bounce', telemetry: tm, misses };
    }

    // Any other contact with the station's structure
    const hit = hullHit(s, colliders);
    if (hit) {
        const speed = length(s.vel);
        if (speed <= DOCKING.gentleBump) {
            s.pos = before.pos;
            s.q = before.q;
            s.vel = scale(s.vel, -0.4);
            s.w = s.w.map(r => -0.3 * r);
            s.failed++;
            return { type: 'bump', what: hit.name, speed };
        }
        finish(s, 'collision', { what: hit.name, speed });
        return { type: 'collision', what: hit.name, speed };
    }

    if (tm.range > DOCKING.lostRange) {
        finish(s, 'lost', {});
        return { type: 'lost' };
    }
    return null;
}
