// Aegis Landing Simulator: the physics. A reusable booster in its final descent over flat ground: thrust,
// gravity, light illustrative drag and wind, propellant use, and attitude with real angular motion (control
// torque from engine gimbal and cold-gas thrusters, aerodynamic damping). After touchdown the booster is a
// rigid body that settles on its legs or tips over them. Pure functions and plain state, SI units, no DOM
// and no three.js: the 3D model only ever draws this state, so a final Aegis model can replace the
// placeholder without touching anything here.
import { VEHICLE } from './vehicle.js';

export const G0 = 9.80665;
export const G = 9.81;              // m/s²: Kerbin surface gravity (stock KSP), the world the booster lands on
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hyp = Math.hypot;

/**
 * The three difficulty levels. They change the actual starting conditions, wind, propellant, the help on
 * screen and the touchdown requirements; every level has been flown to a landing by the automated checks.
 */
export const DIFFICULTY = {
    easy: {
        label: 'Easy', blurb: 'Lower and slower, little sideways drift, no wind and plenty of propellant. Attitude hold on, full guidance.',
        alt: 900, vy: -45, vx: 5, vz: -2, pad: [38, 12], prop: 9000, wind: 0, gust: 0, assist: true,
        guide: { impact: true, burnCue: true, padArrow: true },
        limits: { vs: 5, hs: 2.5, tilt: 12 * DEG, pad: 15 },
    },
    normal: {
        label: 'Normal', blurb: 'Faster, with real sideways drift, a light breeze and propellant to manage. Guidance shows where you are heading but does not fly for you.',
        alt: 1400, vy: -72, vx: 13, vz: 4, pad: [105, -30], prop: 6800, wind: 3, gust: 1.2, assist: true,
        guide: { impact: true, burnCue: false, padArrow: true },
        limits: { vs: 4, hs: 1.8, tilt: 9 * DEG, pad: 13 },
    },
    hard: {
        label: 'Hard', blurb: 'High, fast and drifting the wrong way, in gusty wind, with a tight propellant margin. Minimal guidance and strict touchdown limits.',
        alt: 1800, vy: -95, vx: -18, vz: 7, pad: [140, -45], prop: 4800, wind: 6, gust: 2.5, assist: false,
        guide: { impact: false, burnCue: false, padArrow: true },
        limits: { vs: 3, hs: 1.2, tilt: 6 * DEG, pad: 11 },
    },
};

/* ---------- Attitude ----------
   The booster's lean is two angles: pitch (towards +z, W/S) and roll (towards +x, A/D). The body axis is
   the unit vector they give, and the engine thrusts along it. */
export function axisOf(pitch, roll) {
    const x = Math.tan(roll), z = Math.tan(pitch);
    const l = hyp(x, 1, z);
    return [x / l, 1 / l, z / l];
}
export const tiltOf = s => Math.acos(clamp(axisOf(s.pitch, s.roll)[1], -1, 1));

/** Wind at time t (m/s, along x and z): a steady breeze plus smooth, repeatable gusts. */
export function wind(d, t) {
    if (!d.wind && !d.gust) return [0, 0];
    const g = d.gust * (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 1.13 + 1.7) * 0.4);
    return [d.wind * 0.8 + g, d.wind * 0.6 - g * 0.7];
}

export function createState(diffId) {
    const d = DIFFICULTY[diffId] || DIFFICULTY.normal;
    return {
        diff: diffId in DIFFICULTY ? diffId : 'normal', t: 0,
        pos: [0, d.alt, 0], vel: [d.vx, d.vy, d.vz],
        pitch: 0, roll: 0, wp: 0, wr: 0,                 // lean angles (rad) and their rates (rad/s)
        prop: d.prop, prop0: d.prop, throttle: 0, thrust: 0, legs: 0,
        pad: d.pad.slice(), phase: 'approach', burnStarted: null, fuelOut: false,
        td: null, tip: null, outcome: null, result: null, minAlt: d.alt, maxThrottleSeen: 0, trackSide: [],
    };
}

export const massOf = s => VEHICLE.dry + s.prop;
export const footLowering = s => VEHICLE.legSpan * Math.sin(tiltOf(s));

/**
 * One fixed step. input: { pitch, roll (−1…1 stick), throttle (0…1 command), assist (attitude hold) }
 * Returns the events of the step.
 */
export function step(s, input, dt) {
    const ev = [];
    const d = DIFFICULTY[s.diff];
    s.t += dt;
    if (s.phase === 'tipping') { stepTip(s, dt, ev); return ev; }
    if (s.phase === 'landed' || s.phase === 'toppled' || s.phase === 'crashed') return ev;

    // Throttle: the engine follows the command quickly (0.25 s), and stops when the tanks are empty
    let cmd = clamp(input.throttle ?? 0, 0, 1);
    if (s.prop <= 0) cmd = 0;
    s.throttle += (cmd - s.throttle) * Math.min(1, dt / 0.25);
    if (s.throttle < 0.002) s.throttle = 0;

    // Attitude: control torque from the cold-gas thrusters (always) and the engine gimbal (scaled by thrust)
    const authority = VEHICLE.rcsAccel + VEHICLE.gimbalAccel * s.throttle;   // rad/s² at full stick
    const up = clamp(input.pitch ?? 0, -1, 1), ur = clamp(input.roll ?? 0, -1, 1);
    let ap, ar;
    if (input.assist) {
        // Attitude hold: the stick sets a lean angle; the controller drives towards it and damps the rates
        // (a cascaded controller: the angle error sets a rate, the rate error sets the torque)
        const tp = up * VEHICLE.assistLean, tr = ur * VEHICLE.assistLean;
        const rp = clamp(1.8 * (tp - s.pitch), -0.6, 0.6), rr = clamp(1.8 * (tr - s.roll), -0.6, 0.6);
        ap = clamp(5 * (rp - s.wp), -authority, authority);
        ar = clamp(5 * (rr - s.wr), -authority, authority);
    } else {
        ap = up * authority;
        ar = ur * authority;
    }
    // Grid fins and the airflow damp rotation a little (more when falling fast)
    const speed = hyp(...s.vel);
    const damp = VEHICLE.aeroDamp * Math.min(1, speed / 60);
    s.wp += (ap - damp * s.wp) * dt;
    s.wr += (ar - damp * s.wr) * dt;
    s.pitch += s.wp * dt;
    s.roll += s.wr * dt;
    // Past about 60° the booster is out of control and tumbles
    if (Math.abs(s.pitch) > 1.05 || Math.abs(s.roll) > 1.05) {
        s.pitch = clamp(s.pitch, -1.05, 1.05);
        s.roll = clamp(s.roll, -1.05, 1.05);
    }

    // Forces
    const m = massOf(s);
    const T = VEHICLE.thrust * s.throttle;
    const want = T / (VEHICLE.isp * G0) * dt;
    const dm = Math.min(s.prop, want);
    const Te = want > 0 ? T * dm / want : 0;
    s.thrust = Te;
    const ax = axisOf(s.pitch, s.roll);
    const w = wind(d, s.t);
    const rel = [s.vel[0] - w[0], s.vel[1], s.vel[2] - w[1]];
    const rs = hyp(...rel);
    const rho = 1.2 * Math.exp(-Math.max(0, s.pos[1]) / 5600);
    const k = 0.5 * rho * VEHICLE.cd * VEHICLE.area * rs / m;
    const acc = [Te / m * ax[0] - k * rel[0], Te / m * ax[1] - G - k * rel[1], Te / m * ax[2] - k * rel[2]];
    s.accel = acc;
    for (let i = 0; i < 3; i++) {
        s.vel[i] += acc[i] * dt;
        s.pos[i] += s.vel[i] * dt;
    }
    s.prop -= dm;
    if (s.prop <= 1e-6 && dm > 0) {
        s.prop = 0;
        if (!s.fuelOut) { s.fuelOut = true; ev.push({ type: 'fuelout' }); }
    }
    if (s.throttle > 0.05 && s.burnStarted === null) { s.burnStarted = s.t; ev.push({ type: 'burn' }); }
    s.maxThrottleSeen = Math.max(s.maxThrottleSeen, s.throttle);

    // Legs deploy by themselves low down; they take 1.6 s to lock
    if (s.pos[1] < VEHICLE.legsAlt && s.legs < 1) {
        if (s.legs === 0) ev.push({ type: 'legs' });
        s.legs = Math.min(1, s.legs + dt / 1.6);
        if (s.legs === 1) ev.push({ type: 'legslocked' });
    }
    if (s.trackSide.length === 0 || s.t - s.trackSide[s.trackSide.length - 1][0] > 0.25) s.trackSide.push([s.t, s.pos[0], s.pos[1], s.pos[2]]);
    s.minAlt = Math.min(s.minAlt, s.pos[1]);

    // Flight phases, for the display: approach, descent correction (burning), final landing (low)
    const h = s.pos[1];
    const next = h < 80 ? 'final' : s.burnStarted !== null ? 'correction' : 'approach';
    if (next !== s.phase) { s.phase = next; ev.push({ type: 'phase', phase: next }); }

    // Contact: the lowest foot (legs) or the engine bell reaches the ground
    const lowest = s.pos[1] - (s.legs >= 1 ? footLowering(s) : 0);
    if (lowest <= 0) {
        touchdown(s, ev);
    }
    return ev;
}

function touchdown(s, ev) {
    const d = DIFFICULTY[s.diff];
    const vs = Math.max(0, -s.vel[1]);
    const hs = hyp(s.vel[0], s.vel[2]);
    const tilt = tiltOf(s);
    const dist = hyp(s.pos[0] - s.pad[0], s.pos[2] - s.pad[1]);
    const legs = s.legs >= 1;
    s.pos[1] = legs ? footLowering(s) : 0;        // resting on its lowest foot (or its engine bell)
    s.td = { t: s.t, vs, hs, tilt, dist, onPad: dist <= d.limits.pad, legs, prop: s.prop, fuelOut: s.fuelOut, x: s.pos[0], z: s.pos[2], rates: hyp(s.wp, s.wr) };
    s.throttle = 0;
    s.thrust = 0;
    ev.push({ type: 'touchdown', ...s.td });
    if (vs > VEHICLE.crashSpeed || (!legs && vs > 2.5) || tilt > 30 * DEG) {
        s.phase = 'crashed';
        s.outcome = 'crashed';
        s.vel = [0, 0, 0];
        ev.push({ type: 'crashed' });
        finish(s);
        return;
    }
    // Rigid-body tip-over about the leading foot, in the plane of motion (or of the lean)
    const lx = Math.sin(s.roll), lz = Math.sin(s.pitch);
    let u = hs > 0.05 ? [s.vel[0] / hs, s.vel[2] / hs] : null;
    if (!u) { const l = hyp(lx, lz); u = l > 1e-6 ? [lx / l, lz / l] : [1, 0]; }
    const ax = axisOf(s.pitch, s.roll);
    const phi0 = Math.atan2(ax[0] * u[0] + ax[2] * u[1], ax[1]);
    const span = legs ? VEHICLE.legSpan : VEHICLE.radius;
    const cg = VEHICLE.cg, H = VEHICLE.height;
    const phic = Math.atan2(span, cg);
    const dd = hyp(span, cg);
    const ip = H * H / 12 + dd * dd;
    const ry = cg * Math.cos(phi0) + span * Math.sin(phi0);
    const hsU = s.vel[0] * u[0] + s.vel[2] * u[1];
    // A hard landing squashes the leg dampers: some of the energy goes there, none of it into the tip
    s.tip = { u, phi: phi0, psi: phi0 - phic, omega: ry * hsU / ip, phic, k: G * dd / ip, span };
    s.vel = [0, 0, 0];
    s.wp = s.wr = 0;
    s.phase = 'tipping';
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
        finish(s);
    } else if (tp.phi >= Math.PI / 2 - 0.06) {
        tp.phi = Math.PI / 2 - 0.06;
        s.phase = 'toppled';
        s.outcome = 'toppled';
        ev.push({ type: 'toppled' });
        finish(s);
    } else if (s.t - s.td.t > 12) {
        tp.phi = Math.max(0, tp.phi);
        s.phase = 'landed';
        s.outcome = 'landed';
        finish(s);
    }
}

function finish(s) {
    s.result = { outcome: s.outcome, td: s.td, diff: s.diff, time: s.t, prop0: s.prop0, track: s.trackSide.slice(), pad: s.pad.slice() };
}

/* ---------- Helpers for the guidance display ---------- */

/** Where the booster would hit the ground falling freely from here (no thrust, no drag). */
export function impactPoint(s) {
    const h = Math.max(0, s.pos[1]), vy = s.vel[1];
    const t = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G;
    return [s.pos[0] + s.vel[0] * t, s.pos[2] + s.vel[2] * t, t];
}

/** Height needed to stop the current descent at a given share of full thrust, with the engine upright. */
export function stoppingHeight(s, share = 0.75) {
    const a = VEHICLE.thrust * share / massOf(s) - G;
    if (a <= 0) return Infinity;
    const v = Math.max(0, -s.vel[1]);
    return v * v / (2 * a);
}

export function telemetry(s) {
    const d = DIFFICULTY[s.diff];
    const hs = hyp(s.vel[0], s.vel[2]);
    const lowest = s.pos[1] - (s.legs >= 1 ? footLowering(s) : 0);
    return {
        alt: Math.max(0, lowest), vs: s.vel[1], hs, speed: hyp(...s.vel), throttle: s.throttle, prop: s.prop, propFrac: s.prop / s.prop0,
        pitch: s.pitch, roll: s.roll, tilt: tiltOf(s), rates: hyp(s.wp, s.wr),
        dx: s.pad[0] - s.pos[0], dz: s.pad[1] - s.pos[2], dist: hyp(s.pad[0] - s.pos[0], s.pad[1] - s.pos[2]),
        twr: VEHICLE.thrust / (massOf(s) * G), stop: stoppingHeight(s), phase: s.phase, limits: d.limits, legs: s.legs,
        impact: impactPoint(s), wind: wind(d, s.t),
    };
}
