// Orbital Rendezvous Challenge: the debrief score. Only a docking inside the difficulty's tolerances
// scores at all; efficiency and time add to it but can never turn an unsafe contact into a success.
// Every number comes from the finished mission, so the same flight always earns the same grade.
import { DIFFICULTIES, SCENARIOS } from './physics.js';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// 100 up to 40% of a tolerance, falling to 50 at the tolerance itself
const withinTolerance = ratio => Math.round(100 - clamp((ratio - 0.4) / 0.6, 0, 1) * 50);

export const GRADE_WORDS = { S: 'Exceptional', A: 'Excellent', B: 'Good', C: 'Acceptable', D: 'Rough', F: 'Failed' };

/**
 * rows: { key, label, points (0–100), weight, value, detail }
 * failedAttempts: failures on this scenario and difficulty this visit, before this flight
 */
export function score(s, failedAttempts = 0) {
    if (s.status !== 'docked') return { letter: 'F', score: 0, rows: [] };
    const diff = DIFFICULTIES[s.difficulty], tol = diff.dock;
    const lv = SCENARIOS[s.scenario].levels[s.difficulty];
    const c = s.contact;
    const rows = [];

    rows.push({
        key: 'contact', label: 'Contact speed', weight: 0.25,
        points: withinTolerance(c.speed / tol.speed),
        value: `${c.speed.toFixed(2)} m/s`, detail: `limit ${tol.speed} m/s`,
    });
    const worst = Math.max(c.lateral / tol.lateral, c.angle / tol.angle, c.lateralSpeed / tol.lateralSpeed);
    rows.push({
        key: 'alignment', label: 'Alignment', weight: 0.2,
        points: withinTolerance(worst),
        value: `${c.lateral.toFixed(2)} m · ${c.angle.toFixed(1)}° · ${c.lateralSpeed.toFixed(2)} m/s`,
        detail: `off centre, off axis, sideways drift (limits ${tol.lateral} m, ${tol.angle}°, ${tol.lateralSpeed} m/s)`,
    });
    const used = s.dvUsed / lv.refDv;
    rows.push({
        key: 'efficiency', label: 'Propellant', weight: 0.25,
        points: Math.round(100 * clamp((diff.slack - used) / (diff.slack - 1), 0, 1)),
        value: `${s.dvUsed.toFixed(1)} m/s used`, detail: `a good flight uses about ${lv.refDv} m/s`,
    });
    const penalty = s.unsafe * diff.unsafePenalty + Math.min(30, failedAttempts * diff.failPenalty);
    rows.push({
        key: 'safety', label: 'Approach safety', weight: 0.2,
        points: Math.round(clamp(100 - penalty, 0, 100)),
        value: s.unsafe ? `${s.unsafe} unsafe ${s.unsafe === 1 ? 'moment' : 'moments'}` : 'clean approach',
        detail: failedAttempts && diff.failPenalty ? `and ${failedAttempts} failed ${failedAttempts === 1 ? 'attempt' : 'attempts'} before this one` : 'too fast, outside the corridor or a fast pass',
    });
    const slow = s.t / lv.refTime;
    rows.push({
        key: 'time', label: 'Mission time', weight: 0.1,
        points: Math.round(100 * clamp(2 - slow, 0, 1)),
        value: formatTime(s.t), detail: `a good flight takes about ${formatTime(lv.refTime)}`,
    });

    const total = Math.round(rows.reduce((sum, r) => sum + r.points * r.weight, 0));
    const letter = total >= 95 ? 'S' : total >= 85 ? 'A' : total >= 72 ? 'B' : total >= 58 ? 'C' : 'D';
    return { letter, score: total, rows };
}

export function formatTime(t) {
    t = Math.max(0, Math.round(t));
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
