// Orbital Rendezvous Challenge: the simulation. Two-body gravity in the plane of the orbit: Kerbin is a
// point mass, and the spacecraft and KGOSS each move under its pull alone (no atmosphere drag, no third
// bodies, no out-of-plane motion). Both are stepped with the same fixed-step integrator, so KGOSS moves
// on its own and nothing is ever placed by hand once a mission starts. Units are metres, seconds,
// kilograms and radians. Inertial frame: Kerbin at the origin, x right, y up, orbits run anticlockwise.
// Close to KGOSS the game also works in KGOSS's local frame (LVLH): x along its direction of travel,
// y radially up, away from Kerbin. That frame turns once per orbit with the station, so a velocity of
// zero in it means staying put relative to KGOSS. No DOM here, so it can run (and be tested) on its own.

export const KERBIN = {
    radius: 600000,         // m
    mu: 3.5316e12,          // m³/s²: gravitational parameter
    atmosphere: 70000,      // m: top of the atmosphere
};

// kgoss.html: KGOSS works in an orbit of about 200 km
export const KGOSS_ALT = 200000;
export const DT = 1 / 30;   // s: the fixed simulation step, at every time warp
const G0 = 9.80665;
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- The spacecraft and the station ---------- */

export const CRAFT = {
    dryMass: 2400,          // kg, without propellant
    isp: 320,               // s: main engine and translation thrusters share the propellant (simplified)
    thrust: 4000,           // N: main engine at full throttle
    rcsThrust: 300,         // N: translation thrusters
    maxRate: 30 * DEG,      // rad/s: fastest turn the reaction wheels allow
    wheelAccel: 40 * DEG,   // rad/s²
    nose: 4,                // m from the centre to the docking port on the nose
    radius: 1.8,            // m: hull, for collisions
};

// KGOSS in its own frame (LVLH, metres). The docking port is on the trailing end and faces backwards,
// so the approach is from behind, flying in the station's direction of travel.
export const STATION = {
    port: { x: -21, half: 1.2 },
    capture: 1.6,           // m: a nose this close to the port's centre line meets the port itself
    parts: [
        { x0: -21, x1: -18, y0: -1.2, y1: 1.2, kind: 'port' },
        { x0: -18, x1: 14, y0: -3, y1: 3, kind: 'module' },
        { x0: 14, x1: 24, y0: -4.5, y1: 4.5, kind: 'module' },
        { x0: -2, x1: 2, y0: -26, y1: 26, kind: 'truss' },
        { x0: -9, x1: 9, y0: 12, y1: 26, kind: 'array' },
        { x0: -9, x1: 9, y0: -26, y1: -12, kind: 'array' },
    ],
};

/* ---------- Difficulty and scenarios ---------- */

// Tolerances are gameplay values. Speeds in m/s, offsets in m, angles in degrees.
export const DIFFICULTIES = {
    training: {
        label: 'Training', tag: 'Easy', guidance: 'full', assist: true,
        dock: { speed: 0.8, lateral: 1.0, lateralSpeed: 0.3, angle: 10 },
        corridor: 20,       // deg: half-angle of the approach corridor
        slack: 3,           // propellant and time: how far past the reference still earns points
        unsafePenalty: 8, failPenalty: 0,
    },
    operations: {
        label: 'Operations', tag: 'Normal', guidance: 'some', assist: false,
        dock: { speed: 0.5, lateral: 0.6, lateralSpeed: 0.2, angle: 6 },
        corridor: 15,
        slack: 2.2,
        unsafePenalty: 15, failPenalty: 4,
    },
    precision: {
        label: 'Precision', tag: 'Hard', guidance: 'minimal', assist: false,
        dock: { speed: 0.3, lateral: 0.35, lateralSpeed: 0.12, angle: 3 },
        corridor: 10,
        slack: 1.7,
        unsafePenalty: 25, failPenalty: 8,
    },
};

// Each scenario's start for each difficulty. Orbit scenarios give the spacecraft's orbit (periapsis and
// apoapsis altitudes, the true anomaly it starts at) and how many degrees it starts behind KGOSS (lead;
// negative is ahead), chosen so an efficient transfer opens 1.5 to 4 minutes in. The docking scenario starts in KGOSS's frame. budget is the
// spacecraft's delta-v when full; refDv and refTime are what a good flight uses, for scoring.
export const SCENARIOS = {
    first: {
        label: 'First Rendezvous', kind: 'orbit',
        blurb: 'Start a little below KGOSS and catch it up: one burn to rise to its orbit, then match its motion and dock.',
        levels: {
            training: { pe: 180000, ap: 180000, at: 0, lead: 3.64, budget: 150, refDv: 48, refTime: 1700 },
            operations: { pe: 150000, ap: 150000, at: 0, lead: 11.06, budget: 125, refDv: 85, refTime: 1900 },
            precision: { pe: 135000, ap: 165000, at: 0, lead: 13.15, budget: 120, refDv: 88, refTime: 1900 },
        },
    },
    intercept: {
        label: 'KGOSS Intercept', kind: 'orbit',
        blurb: 'Start in a higher orbit, well ahead of KGOSS. Drop down to meet it, correct the intercept and match velocity.',
        levels: {
            training: { pe: 240000, ap: 240000, at: 0, lead: -7.75, budget: 160, refDv: 66, refTime: 1900 },
            operations: { pe: 265000, ap: 285000, at: 180, lead: -17.31, budget: 145, refDv: 108, refTime: 2000 },
            precision: { pe: 255000, ap: 300000, at: 150, lead: -23.25, budget: 135, refDv: 110, refTime: 2200 },
        },
    },
    docking: {
        label: 'Precision Docking', kind: 'proximity',
        blurb: 'Start close to KGOSS but moving too fast. Brake, line up with the port and fly a clean final approach.',
        levels: {
            training: { x: -600, y: 0, vx: 3, vy: 0, heading: 0, budget: 45, refDv: 7, refTime: 400 },
            operations: { x: -1500, y: -60, vx: 8, vy: 0.4, heading: 10, budget: 36, refDv: 15, refTime: 550 },
            precision: { x: -3000, y: -150, vx: 14, vy: 1.2, heading: -25, budget: 32, refDv: 22, refTime: 700 },
        },
    },
};

/* ---------- Orbits ---------- */

const gravity = (x, y) => {
    const r2 = x * x + y * y;
    const k = -KERBIN.mu / (r2 * Math.sqrt(r2));
    return [k * x, k * y];
};

// Orbital elements of a state: semi-major axis, eccentricity, apoapsis and periapsis altitudes,
// period and the argument of periapsis (angle of the periapsis direction)
export function elements(b) {
    const { mu, radius } = KERBIN;
    const r = Math.hypot(b.x, b.y);
    const v2 = b.vx * b.vx + b.vy * b.vy;
    const h = b.x * b.vy - b.y * b.vx;
    const energy = v2 / 2 - mu / r;
    const a = -mu / (2 * energy);
    const rv = b.x * b.vx + b.y * b.vy;
    const ex = ((v2 - mu / r) * b.x - rv * b.vx) / mu;
    const ey = ((v2 - mu / r) * b.y - rv * b.vy) / mu;
    const e = Math.hypot(ex, ey);
    const bound = energy < 0 && e < 1;
    return {
        a, e, h, energy, bound,
        pe: a * (1 - e) - radius,
        ap: bound ? a * (1 + e) - radius : Infinity,
        period: bound ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity,
        argPe: Math.atan2(ey, ex),
    };
}

const circularSpeed = r => Math.sqrt(KERBIN.mu / r);

// A state on an orbit with the given periapsis and apoapsis radii, the periapsis at angle argPe,
// at true anomaly nu (anticlockwise motion)
function onOrbit(rp, ra, argPe, nu) {
    const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
    const p = a * (1 - e * e);
    const r = p / (1 + e * Math.cos(nu));
    const k = Math.sqrt(KERBIN.mu / p);
    const vr = k * e * Math.sin(nu), vt = k * (1 + e * Math.cos(nu));
    const ang = argPe + nu;
    const c = Math.cos(ang), s = Math.sin(ang);
    return { x: r * c, y: r * s, vx: vr * c - vt * s, vy: vr * s + vt * c, angle: ang };
}

/* ---------- KGOSS's local frame ---------- */

// The station's frame at this moment: angle of its along-track axis, and its turn rate
function frame(st) {
    const r = Math.hypot(st.x, st.y);
    const ux = st.x / r, uy = st.y / r;     // radial (up)
    const tx = -uy, ty = ux;                // along-track (anticlockwise orbits)
    const rate = (st.x * st.vy - st.y * st.vx) / (r * r);
    return { ux, uy, tx, ty, rate, angle: Math.atan2(ty, tx) };
}

// Inertial vector → station frame (x along-track, y radial)
const toLocal = (f, x, y) => [x * f.tx + y * f.ty, x * f.ux + y * f.uy];
const toInertial = (f, x, y) => [x * f.tx + y * f.ux, x * f.ty + y * f.uy];

// Where the spacecraft is and how it moves, seen from KGOSS. Velocity is measured in the station's
// turning frame, so zero means the spacecraft keeps its place relative to KGOSS.
export function relative(s) {
    const sh = s.ship, st = s.station;
    const f = frame(st);
    const dx = sh.x - st.x, dy = sh.y - st.y;
    const [x, y] = toLocal(f, dx, dy);
    const dvx = sh.vx - st.vx + f.rate * dy, dvy = sh.vy - st.vy - f.rate * dx;
    const [vx, vy] = toLocal(f, dvx, dvy);
    const dist = Math.hypot(x, y);
    const closing = dist > 1e-9 ? -(x * vx + y * vy) / dist : 0;
    const heading = wrap(sh.heading - f.angle);     // the craft's nose in the station frame
    const nx = x + CRAFT.nose * Math.cos(heading), ny = y + CRAFT.nose * Math.sin(heading);
    const spin = sh.rate - f.rate;
    const nvx = vx - spin * CRAFT.nose * Math.sin(heading), nvy = vy + spin * CRAFT.nose * Math.cos(heading);
    return { x, y, vx, vy, speed: Math.hypot(vx, vy), dist, closing, heading, nx, ny, nvx, nvy, frame: f };
}

// Approach corridor: a cone behind the port, opening backwards along the station's -x axis
export function corridor(rel, halfAngleDeg) {
    const ax = STATION.port.x - rel.x;      // how far behind the port face
    const off = Math.abs(rel.y);
    const angle = ax > 0 ? Math.atan2(off, ax) / DEG : 90;
    return { range: Math.hypot(ax, off), angle, inside: ax > 0 && angle <= halfAngleDeg };
}

// The closing speed considered safe at a distance from the port, slowing down to the docking limit
export const safeSpeed = (d, dock) => dock.speed + Math.max(0, d) / 80;

/* ---------- Mission state ---------- */

function stationStart() {
    const r = KERBIN.radius + KGOSS_ALT;
    const v = circularSpeed(r);
    return { x: 0, y: r, vx: -v, vy: 0 };   // at the top of the map, moving left (anticlockwise)
}

// Start state for a scenario and difficulty
export function createState(scenarioId, difficultyId) {
    const sc = SCENARIOS[scenarioId], lv = sc.levels[difficultyId], diff = DIFFICULTIES[difficultyId];
    const station = stationStart();
    const fs = frame(station);
    let ship;
    if (sc.kind === 'orbit') {
        const rp = KERBIN.radius + lv.pe, ra = KERBIN.radius + lv.ap;
        // The craft starts at true anomaly lv.at, lv.lead degrees behind KGOSS
        const nu = lv.at * DEG;
        const o = onOrbit(rp, ra, Math.PI / 2 - lv.lead * DEG - nu, nu);
        ship = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, heading: Math.atan2(o.vy, o.vx), rate: 0 };
    } else {
        const [dx, dy] = toInertial(fs, lv.x, lv.y);
        const [wx, wy] = toInertial(fs, lv.vx, lv.vy);
        ship = {
            x: station.x + dx, y: station.y + dy,
            vx: station.vx + wx - fs.rate * dy, vy: station.vy + wy + fs.rate * dx,
            heading: fs.angle + lv.heading * DEG, rate: 0,
        };
    }
    const mass = CRAFT.dryMass * Math.exp(lv.budget / (CRAFT.isp * G0));
    ship.mass = mass;
    const s = {
        scenario: scenarioId, difficulty: difficultyId, kind: sc.kind,
        t: 0, status: 'flying', outcome: null,
        ship, station,
        startMass: mass, budget: lv.budget,
        throttle: sc.kind === 'orbit' ? 1 : 0.1,
        assist: diff.assist, hold: 'none', assistUsed: false,
        burning: false, rcsActive: false,
        dvUsed: 0,
        minDist: Infinity, rendezvousAt: null,
        unsafe: 0, unsafeLog: [],
        latch: { fast: false, corridor: false, miss: false },
        passed: false, prevDist: null, wasClosing: false,
        prevNose: null, contact: null,
    };
    const rel = relative(s);
    s.minDist = rel.dist;
    s.startDist = rel.dist;
    s.startRel = rel.speed;
    s.prevDist = rel.dist;
    s.prevNose = { x: rel.nx, y: rel.ny };
    return s;
}

export const deltaV = s => CRAFT.isp * G0 * Math.log(s.ship.mass / CRAFT.dryMass);
export const propellant = s => s.ship.mass - CRAFT.dryMass;
export const fullPropellant = s => s.startMass - CRAFT.dryMass;

// The direction (inertial angle) a Flight Assist hold points the nose, or null
export function holdAngle(s, mode, rel = relative(s)) {
    const sh = s.ship, st = s.station;
    switch (mode) {
        case 'prograde': return Math.atan2(sh.vy, sh.vx);
        case 'retrograde': return Math.atan2(-sh.vy, -sh.vx);
        case 'target': return Math.atan2(st.y - sh.y, st.x - sh.x);
        case 'match': {
            if (rel.speed < 0.02) return null;
            const [ix, iy] = toInertial(rel.frame, -rel.vx, -rel.vy);
            return Math.atan2(iy, ix);
        }
        case 'dock': return rel.frame.angle;
        default: return null;
    }
}

/* ---------- One step ---------- */

const NO_INPUT = { turn: 0, burn: false, fore: 0, side: 0, fine: false };

function finish(s, ok, outcome) {
    s.status = ok ? 'docked' : 'failed';
    s.outcome = outcome;
    s.burning = false;
    s.rcsActive = false;
}

function noteUnsafe(s, kind, text) {
    s.unsafe++;
    s.unsafeLog.push({ t: s.t, kind, text });
}

const insideRect = (p, x, y, pad) => x >= p.x0 - pad && x <= p.x1 + pad && y >= p.y0 - pad && y <= p.y1 + pad;

// Advance the mission by one fixed step. input: turn -1…1 (anticlockwise +), burn (main engine at
// the set throttle), fore and side -1…1 (translation thrusters, side + to the left), fine.
export function step(s, input = NO_INPUT, sensitivity = 1) {
    if (s.status !== 'flying') return;
    const dt = DT;
    const sh = s.ship, st = s.station;
    const diff = DIFFICULTIES[s.difficulty];

    // Attitude: reaction wheels, no propellant
    const fine = input.fine ? 0.25 : 1;
    const turn = clamp(input.turn || 0, -1, 1);
    let want = null;
    if (s.assist) {
        if (turn) {
            s.hold = 'none';
            want = turn * CRAFT.maxRate * fine * sensitivity;
        } else if (s.hold !== 'none') {
            const target = holdAngle(s, s.hold);
            if (target == null) want = 0;
            else {
                const e = wrap(target - sh.heading);
                // Turn at the rate that can still stop on the target, slowing in the last few degrees
                const v = Math.min(Math.sqrt(2 * CRAFT.wheelAccel * 0.8 * Math.abs(e)), 3 * Math.abs(e), CRAFT.maxRate);
                want = Math.sign(e) * v;
                s.assistUsed = true;
            }
        } else want = 0;
        sh.rate += clamp(want - sh.rate, -CRAFT.wheelAccel * dt, CRAFT.wheelAccel * dt);
    } else {
        sh.rate = clamp(sh.rate + turn * CRAFT.wheelAccel * fine * sensitivity * dt, -CRAFT.maxRate, CRAFT.maxRate);
    }
    sh.heading = wrap(sh.heading + sh.rate * dt);

    // Thrust: main engine along the nose, translation thrusters in the craft's own axes
    const hx = Math.cos(sh.heading), hy = Math.sin(sh.heading);
    let ax = 0, ay = 0;
    s.burning = false;
    s.rcsActive = false;
    if (input.burn && s.throttle > 0 && sh.mass > CRAFT.dryMass) {
        const force = CRAFT.thrust * s.throttle;
        const dm = Math.min(force / (CRAFT.isp * G0) * dt, sh.mass - CRAFT.dryMass);
        const a = (dm * CRAFT.isp * G0 / dt) / sh.mass;
        ax += a * hx; ay += a * hy;
        sh.mass -= dm;
        s.dvUsed += a * dt;
        s.burning = true;
    }
    let fore = clamp(input.fore || 0, -1, 1), side = clamp(input.side || 0, -1, 1);
    const mag = Math.hypot(fore, side);
    if (mag > 1) { fore /= mag; side /= mag; }
    if ((fore || side) && sh.mass > CRAFT.dryMass) {
        const force = CRAFT.rcsThrust * fine * Math.min(1, Math.hypot(fore, side));
        const dm = Math.min(force / (CRAFT.isp * G0) * dt, sh.mass - CRAFT.dryMass);
        const a = (dm * CRAFT.isp * G0 / dt) / sh.mass;
        const n = Math.hypot(fore, side);
        const bx = (fore * hx - side * hy) / n, by = (fore * hy + side * hx) / n;
        ax += a * bx; ay += a * by;
        sh.mass -= dm;
        s.dvUsed += a * dt;
        s.rcsActive = true;
    }

    // Kick-drift-kick (velocity Verlet): symplectic, so orbits keep their energy over long warps
    let [gx, gy] = gravity(sh.x, sh.y);
    sh.vx += (gx + ax) * dt / 2; sh.vy += (gy + ay) * dt / 2;
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    [gx, gy] = gravity(sh.x, sh.y);
    sh.vx += (gx + ax) * dt / 2; sh.vy += (gy + ay) * dt / 2;

    [gx, gy] = gravity(st.x, st.y);
    st.vx += gx * dt / 2; st.vy += gy * dt / 2;
    st.x += st.vx * dt; st.y += st.vy * dt;
    [gx, gy] = gravity(st.x, st.y);
    st.vx += gx * dt / 2; st.vy += gy * dt / 2;

    s.t += dt;

    // Checks
    if (Math.hypot(sh.x, sh.y) - KERBIN.radius < KERBIN.atmosphere) {
        return finish(s, false, { code: 'atmosphere', title: 'ENTERED THE ATMOSPHERE', text: 'The spacecraft dropped below 70 km into Kerbin\'s atmosphere. A rendezvous craft can\'t survive reentry, so the mission is lost. Keep your periapsis above 70 km.' });
    }
    const rel = relative(s);
    if (!Number.isFinite(rel.dist)) return finish(s, false, { code: 'error', title: 'SIMULATION ERROR', text: 'The simulation produced an invalid value and stopped.' });
    s.minDist = Math.min(s.minDist, rel.dist);
    if (s.rendezvousAt == null && rel.dist < 1000) s.rendezvousAt = s.t;

    // Passing the target: the range stops shrinking and starts to grow while close
    const closingNow = rel.closing > 0.05;
    if (rel.dist < 5000) {
        if (s.wasClosing && rel.closing < -0.05) s.passed = true;
        if (closingNow) s.passed = false;
    } else s.passed = false;
    if (closingNow) s.wasClosing = true;
    else if (rel.closing < -0.05) s.wasClosing = false;

    // Unsafe approaches (each counted once until the craft is back within limits)
    const portRange = Math.hypot(rel.x - STATION.port.x, rel.y);
    const safe = safeSpeed(portRange, diff.dock);
    if (rel.dist < 200 && rel.closing > 1.6 * safe) {
        if (!s.latch.fast) { s.latch.fast = true; noteUnsafe(s, 'fast', `Closed at ${rel.closing.toFixed(1)} m/s ${Math.round(rel.dist)} m out`); }
    } else if (rel.closing < safe) s.latch.fast = false;
    const cor = corridor(rel, diff.corridor);
    if (portRange < 150 && !cor.inside && rel.closing > 0.05) {
        if (!s.latch.corridor) { s.latch.corridor = true; noteUnsafe(s, 'corridor', `Outside the approach corridor ${Math.round(portRange)} m from the port`); }
    } else if (cor.inside || portRange > 170) s.latch.corridor = false;
    if (rel.dist < 60 && rel.speed > 3) {
        if (!s.latch.miss) { s.latch.miss = true; noteUnsafe(s, 'miss', `Passed ${Math.round(rel.dist)} m from KGOSS at ${rel.speed.toFixed(1)} m/s`); }
    } else if (rel.dist > 120) s.latch.miss = false;

    // Contact with KGOSS
    if (rel.dist < 80) {
        const px = STATION.port.x;
        const prev = s.prevNose;
        if (prev && prev.x < px && rel.nx >= px && Math.abs(rel.ny) <= STATION.capture) {
            return dockingContact(s, rel, diff);
        }
        for (const p of STATION.parts) {
            if (insideRect(p, rel.nx, rel.ny, 0) || insideRect(p, rel.x, rel.y, CRAFT.radius)) {
                s.contact = { speed: rel.speed, part: p.kind };
                return finish(s, false, { code: 'collision', title: 'COLLISION', text: `The spacecraft hit KGOSS's ${p.kind === 'array' ? 'solar array' : p.kind === 'truss' ? 'truss' : p.kind === 'port' ? 'docking port off-centre' : 'hull'} at ${rel.speed.toFixed(2)} m/s. Only the docking port, met head-on and gently, is a safe contact.` });
            }
        }
    }
    s.prevNose = { x: rel.nx, y: rel.ny };
    s.prevDist = rel.dist;
}

// The nose met the port: dock if every value is inside the difficulty's tolerances
function dockingContact(s, rel, diff) {
    const tol = diff.dock;
    const c = {
        speed: rel.nvx,                         // closing speed along the port axis
        lateral: Math.abs(rel.ny),
        lateralSpeed: Math.abs(rel.nvy),
        angle: Math.abs(rel.heading) / DEG,
    };
    s.contact = c;
    if (c.speed > tol.speed) {
        return finish(s, false, { code: 'hard', title: 'HARD CONTACT', text: `The spacecraft met the port at ${c.speed.toFixed(2)} m/s. The docking latches take up to ${tol.speed} m/s on ${diff.label}.` });
    }
    if (c.angle > tol.angle) {
        return finish(s, false, { code: 'angle', title: 'MISALIGNED', text: `The nose was ${c.angle.toFixed(1)}° off the port's axis. The latches need ${tol.angle}° or better on ${diff.label}.` });
    }
    if (c.lateral > tol.lateral) {
        return finish(s, false, { code: 'offset', title: 'OFF-CENTRE CONTACT', text: `The docking ports met ${c.lateral.toFixed(2)} m off centre. The latches need ${tol.lateral} m or better on ${diff.label}.` });
    }
    if (c.lateralSpeed > tol.lateralSpeed) {
        return finish(s, false, { code: 'drift', title: 'SIDEWAYS DRIFT', text: `The nose was sliding sideways at ${c.lateralSpeed.toFixed(2)} m/s when the ports met. The latches need ${tol.lateralSpeed} m/s or less on ${diff.label}.` });
    }
    finish(s, true, { code: 'docked', title: 'DOCKED', text: 'Soft capture, then hard dock. The spacecraft is secured to KGOSS.' });
}

export function abort(s) {
    if (s.status === 'flying') finish(s, false, { code: 'abort', title: 'MISSION ABORTED', text: 'You ended the mission before docking.' });
}

/* ---------- Prediction ---------- */

function rk4(b, h) {
    const f = (x, y, vx, vy) => { const [ax, ay] = gravity(x, y); return [vx, vy, ax, ay]; };
    const k1 = f(b.x, b.y, b.vx, b.vy);
    const k2 = f(b.x + k1[0] * h / 2, b.y + k1[1] * h / 2, b.vx + k1[2] * h / 2, b.vy + k1[3] * h / 2);
    const k3 = f(b.x + k2[0] * h / 2, b.y + k2[1] * h / 2, b.vx + k2[2] * h / 2, b.vy + k2[3] * h / 2);
    const k4 = f(b.x + k3[0] * h, b.y + k3[1] * h, b.vx + k3[2] * h, b.vy + k3[3] * h);
    b.x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    b.y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    b.vx += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    b.vy += h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
}

const copy = b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy });

// Coast both craft forward (no thrust) for `span` seconds in steps of `h`. Returns the craft's path,
// its path in KGOSS's frame, and the closest approach (refined between samples).
export function predict(s, span, h, shipOverride) {
    const sh = copy(shipOverride || s.ship), st = copy(s.station);
    const n = Math.max(2, Math.ceil(span / h));
    const path = new Float64Array((n + 1) * 2);
    const relPath = new Float64Array((n + 1) * 2);
    const states = [];
    let best = Infinity, bestI = 0;
    const sample = i => {
        path[i * 2] = sh.x; path[i * 2 + 1] = sh.y;
        const f = frame(st);
        const [x, y] = toLocal(f, sh.x - st.x, sh.y - st.y);
        relPath[i * 2] = x; relPath[i * 2 + 1] = y;
        const d = Math.hypot(x, y);
        if (d < best) { best = d; bestI = i; }
    };
    for (let i = 0; i <= n; i++) {
        if (i) { rk4(sh, h); rk4(st, h); }
        states.push([copy(sh), copy(st)]);
        sample(i);
    }
    // Refine around the best sample
    const i0 = Math.max(0, bestI - 1);
    const a = copy(states[i0][0]), b = copy(states[i0][1]);
    const fine = h / 40;
    let t = i0 * h, caT = bestI * h;
    const steps = (Math.min(n, bestI + 1) - i0) * 40;
    for (let k = 0; k < steps; k++) {
        rk4(a, fine); rk4(b, fine); t += fine;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < best) { best = d; caT = t; }
    }
    // Relative speed at closest approach (station frame)
    const ca = states[Math.min(n, Math.round(caT / h))];
    const fake = { ship: { ...ca[0], heading: 0, rate: 0 }, station: ca[1] };
    const relCa = relative(fake);
    return {
        path, relPath, count: n + 1, h,
        ca: { dist: best, t: caT, speed: relCa.speed, ship: copy(ca[0]), station: copy(ca[1]) },
    };
}

// A rough transfer-window estimate for the guidance line: a Hohmann transfer from the craft's mean
// orbital radius to KGOSS's, treating both orbits as circles. Returns seconds until the window and
// the first burn's size, or null when there's no sensible estimate.
export function transferWindow(s) {
    const { mu, radius } = KERBIN;
    const el = elements(s.ship);
    if (!el.bound) return null;
    const r1 = el.a, r2 = radius + KGOSS_ALT;
    if (Math.abs(r1 - r2) < 3000) return null;
    const n1 = Math.sqrt(mu / r1 ** 3), n2 = Math.sqrt(mu / r2 ** 3);
    const transfer = Math.PI * Math.sqrt(((r1 + r2) / 2) ** 3 / mu);
    const lead = Math.PI - n2 * transfer;
    const now = wrap(Math.atan2(s.station.y, s.station.x) - Math.atan2(s.ship.y, s.ship.x));
    const rate = n2 - n1;           // how fast KGOSS's lead changes
    let wait = wrap(lead - now) / rate;
    if (wait < -20) wait += 2 * Math.PI / Math.abs(rate);
    const burn = circularSpeed(r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
    return { wait, burn, direction: burn >= 0 ? 'prograde' : 'retrograde' };
}
