// WSA Flight Dynamics Center: the calculations. Pure functions, SI units throughout (m, s, kg, N), no DOM,
// so they can be tested on their own. Each returns { ok: true, ...values } or { ok: false, errors } where
// errors maps an input name to a message. Simplified two-body and ideal-rocket models only.
import { G0 } from '../celestial-bodies.js';

export { G0 };

const finite = v => typeof v === 'number' && Number.isFinite(v);
const fail = errors => ({ ok: false, errors });
// Results this far out of range are numerically meaningless for planning; say so instead of printing them
const sane = (...vals) => vals.every(v => finite(v) && Math.abs(v) < 1e300);

/** Checks a central body: mu > 0, radius ≥ 0. Adds messages to errors. */
function checkBody(mu, radius, errors) {
    if (!finite(mu)) errors.mu = 'Enter the gravitational parameter μ in m³/s².';
    else if (mu <= 0) errors.mu = 'μ must be greater than zero.';
    if (!finite(radius)) errors.radius = 'Enter the reference radius in metres.';
    else if (radius < 0) errors.radius = 'The radius cannot be negative.';
}

/** Checks an altitude above the reference radius (m): the resulting orbit must lie outside the body. */
function checkAltitude(name, alt, radius, errors, label = 'altitude') {
    if (!finite(alt)) errors[name] = `Enter the ${label}.`;
    else if (alt < 0) errors[name] = `The ${label} cannot be below the reference radius (negative).`;
    else if (finite(radius) && radius + alt <= 0) errors[name] = 'The distance from the centre must be greater than zero.';
}

/** Distance from the body's centre: the altitude is measured from the reference radius. */
export const orbitalRadius = (radius, altitude) => radius + altitude;

/** Ideal circular orbit: speed v = √(μ/r), period T = 2π√(r³/μ). */
export function circularOrbit({ mu, radius, altitude }) {
    const errors = {};
    checkBody(mu, radius, errors);
    checkAltitude('altitude', altitude, radius, errors);
    if (Object.keys(errors).length) return fail(errors);
    const r = orbitalRadius(radius, altitude);
    const v = Math.sqrt(mu / r);
    const T = 2 * Math.PI * Math.sqrt(r * r * r / mu);
    if (!sane(v, T)) return fail({ altitude: 'These values are too extreme to give a meaningful result.' });
    return { ok: true, r, v, T, minutes: T / 60, hours: T / 3600 };
}

/** Ideal escape speed from a distance r: v = √(2μ/r); local gravity g = μ/r². */
export function escapeVelocity({ mu, radius, altitude }) {
    const errors = {};
    checkBody(mu, radius, errors);
    checkAltitude('altitude', altitude, radius, errors);
    if (Object.keys(errors).length) return fail(errors);
    const r = orbitalRadius(radius, altitude);
    const g = mu / (r * r);
    const v = Math.sqrt(2 * mu / r);
    if (!sane(g, v)) return fail({ altitude: 'These values are too extreme to give a meaningful result.' });
    return { ok: true, r, g, v, kms: v / 1000, circular: v / Math.SQRT2 };
}

/**
 * Thrust-to-weight ratio, TWR = F / (m g). mass in kg, thrust in N, g in m/s².
 * accel is F/m, the acceleration the thrust alone gives (before gravity, drag or anything else);
 * net is F/m − g, the vertical acceleration when pointed straight up with no drag.
 */
export function thrustToWeight({ mass, thrust, g, target }) {
    const errors = {};
    if (!finite(mass)) errors.mass = 'Enter the vehicle mass.';
    else if (mass <= 0) errors.mass = 'The mass must be greater than zero.';
    if (!finite(thrust)) errors.thrust = 'Enter the available thrust.';
    else if (thrust < 0) errors.thrust = 'Thrust cannot be negative.';
    if (!finite(g)) errors.g = 'Enter the local gravitational acceleration.';
    else if (g <= 0) errors.g = 'Gravity must be greater than zero.';
    if (target != null && !(finite(target) && target > 0)) errors.target = 'The target TWR must be a number greater than zero.';
    if (Object.keys(errors).length) return fail(errors);
    const weight = mass * g;
    const twr = thrust / weight;
    const accel = thrust / mass;
    const out = { ok: true, weight, twr, accel, net: accel - g, liftoff: twr > 1 };
    if (target != null) {
        out.requiredThrust = target * weight;
        out.extraThrust = out.requiredThrust - thrust;
    }
    if (!sane(weight, twr, accel)) return fail({ mass: 'These values are too extreme to give a meaningful result.' });
    return out;
}

/**
 * Ideal single-stage rocket equation, Δv = Isp g0 ln(m0/mf).
 * m0 initial (wet) mass, mf final mass, both kg; isp in seconds; g0 the standard-gravity constant.
 * targetDv (m/s), optional: the final mass that would give it from the same m0 and Isp.
 */
export function rocketEquation({ m0, mf, isp, g0 = G0, targetDv }) {
    const errors = {};
    if (!finite(m0)) errors.m0 = 'Enter the initial (wet) mass.';
    else if (m0 <= 0) errors.m0 = 'The initial mass must be greater than zero.';
    if (!finite(mf)) errors.mf = 'Enter the final mass.';
    else if (mf <= 0) errors.mf = 'The final mass must be greater than zero (the vehicle cannot burn itself away).';
    else if (finite(m0) && m0 > 0 && mf > m0) errors.mf = 'The final mass cannot be larger than the initial mass.';
    if (!finite(isp)) errors.isp = 'Enter the specific impulse in seconds.';
    else if (isp <= 0) errors.isp = 'Isp must be greater than zero.';
    if (!finite(g0) || g0 <= 0) errors.g0 = 'The g0 constant must be greater than zero.';
    if (targetDv != null && !(finite(targetDv) && targetDv >= 0)) errors.targetDv = 'The target Δv must be zero or more.';
    if (Object.keys(errors).length) return fail(errors);
    const ve = isp * g0;                    // effective exhaust velocity
    const ratio = m0 / mf;
    const dv = ve * Math.log(ratio);
    const out = { ok: true, dv, ve, ratio, propellant: m0 - mf, fraction: (m0 - mf) / m0 };
    if (targetDv != null) {
        const targetRatio = Math.exp(targetDv / ve);
        out.targetMf = m0 / targetRatio;
        out.targetPropellant = m0 - out.targetMf;
        out.targetRatio = targetRatio;
        out.targetReachable = out.targetMf >= mf;      // false: this vehicle would have to end lighter than it does
        if (!sane(targetRatio)) { out.targetMf = 0; out.targetPropellant = m0; out.targetRatio = Infinity; out.targetReachable = false; }
    }
    if (!sane(dv, ratio)) return fail({ m0: 'These values are too extreme to give a meaningful result.' });
    return out;
}

/**
 * Ideal Hohmann transfer between circular, coplanar orbits round the same body.
 * Works both ways: raising (r2 > r1) burns prograde twice, lowering burns retrograde twice.
 */
export function hohmann({ mu, radius, alt1, alt2 }) {
    const errors = {};
    checkBody(mu, radius, errors);
    checkAltitude('alt1', alt1, radius, errors, 'initial altitude');
    checkAltitude('alt2', alt2, radius, errors, 'final altitude');
    if (Object.keys(errors).length) return fail(errors);
    const r1 = orbitalRadius(radius, alt1), r2 = orbitalRadius(radius, alt2);
    const at = (r1 + r2) / 2;
    const vc1 = Math.sqrt(mu / r1), vc2 = Math.sqrt(mu / r2);
    const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at));          // on the transfer ellipse at r1
    const vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));          // on the transfer ellipse at r2
    const dv1 = Math.abs(vt1 - vc1);
    const dv2 = Math.abs(vc2 - vt2);
    const t = Math.PI * Math.sqrt(at * at * at / mu);
    const direction = r2 > r1 ? 'raise' : r2 < r1 ? 'lower' : 'none';
    if (!sane(vc1, vc2, vt1, vt2, t)) return fail({ alt2: 'These values are too extreme to give a meaningful result.' });
    return {
        ok: true, r1, r2, at, vc1, vc2, vt1, vt2, dv1, dv2, total: dv1 + dv2, t,
        direction, eccentricity: Math.abs(r2 - r1) / (r1 + r2),
        // Lead angle: how far ahead of the craft a target in the final orbit must be when the first burn starts
        phase: Math.PI * (1 - Math.pow(at / r2, 1.5)),
    };
}
