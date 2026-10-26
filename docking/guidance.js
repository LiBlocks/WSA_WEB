// Docking Simulator guidance: turns telemetry into one short piece of advice for the pilot, in the
// order a careful approach needs it (speed, rotation, axis, attitude, then the final approach).
import { DOCKING } from './physics.js';

// Which way to translate to get back on the docking axis, as key hints
export function translateHint(tm) {
    const dead = Math.max(0.05, 0.2 * tm.corridor);
    const [x, y] = tm.toAxis;
    const parts = [];
    if (x > dead) parts.push('right (L)');
    else if (x < -dead) parts.push('left (J)');
    if (y > dead) parts.push('up (I)');
    else if (y < -dead) parts.push('down (K)');
    return parts.join(' and ');
}

// Which way to turn to line up with the docking axis (yaw +: nose left, pitch +: nose up, roll +: left side down)
export function attitudeHint(tm, threshold = 1) {
    const parts = [];
    if (tm.pitch > threshold) parts.push('pitch down (S)');
    else if (tm.pitch < -threshold) parts.push('pitch up (W)');
    if (tm.yaw > threshold) parts.push('yaw right (D)');
    else if (tm.yaw < -threshold) parts.push('yaw left (A)');
    if (tm.roll > threshold) parts.push('roll right (E)');
    else if (tm.roll < -threshold) parts.push('roll left (Q)');
    return parts.join(', ');
}

/** Advice for the current moment: { text, level: 'ok' | 'info' | 'warn' | 'alert' } */
export function advise(tm, { assist }) {
    if (tm.range > DOCKING.lostRange * 0.66) {
        return { text: 'Drifting away from the station. Turn toward it and thrust forward (H).', level: 'warn' };
    }
    if (tm.axial < -0.5) {
        return { text: 'You are behind the docking port. Back away (N) and come round to the front of it.', level: 'warn' };
    }
    if (tm.closing > Math.max(tm.closingLimit * 1.5, DOCKING.maxClosing + 0.1)) {
        return { text: `Closing too fast: ${tm.closing.toFixed(2)} m/s. Brake with N.`, level: 'alert' };
    }
    if (tm.rate > 3) {
        return { text: `Rotating ${tm.rate.toFixed(1)}°/s. Counter the rotation${assist ? '' : ', or turn Flight Assist on (F)'}.`, level: 'warn' };
    }
    if (tm.closing > tm.closingLimit) {
        return { text: `Closing faster than the ${tm.closingLimit.toFixed(2)} m/s guide for this range. Brake with N.`, level: 'warn' };
    }
    if (tm.radial > tm.corridor) {
        const where = translateHint(tm);
        return { text: `Off the approach axis by ${tm.radial.toFixed(1)} m. Translate ${where || 'back toward the axis'}.`, level: 'warn' };
    }
    if (!tm.attitudeOk && tm.axial < 60) {
        return { text: `Line up with the docking axis: ${attitudeHint(tm, 2) || 'small attitude corrections'}.`, level: 'warn' };
    }
    if (tm.rate > 1 && tm.axial < 40) {
        return { text: 'Steady the rotation before the final approach.', level: 'warn' };
    }
    if (tm.closing < 0.02 && tm.axial > DOCKING.captureDistance + 0.5) {
        return tm.closing < -0.02
            ? { text: 'Moving away from the port. Thrust forward (H) to close in.', level: 'info' }
            : { text: 'Holding position. Thrust forward (H) to start closing.', level: 'info' };
    }
    if (tm.axial > 40) {
        return { text: `Close in along the corridor, keeping under ${tm.closingLimit.toFixed(1)} m/s.`, level: 'info' };
    }
    if (tm.axial > 5) {
        return { text: 'Lined up. Keep the prograde marker on the port and keep slowing down.', level: 'ok' };
    }
    return { text: `Final approach: hold the alignment and touch under ${DOCKING.maxClosing} m/s.`, level: 'ok' };
}
