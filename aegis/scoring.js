// Aegis Landing Simulator: judging a touchdown. The numbers are honest and come only from the measured
// touchdown and fixed, per-difficulty limits; the words that describe them are encouraging. A landing is
// only called successful when it really met every requirement.
import { DIFFICULTY } from './physics.js';

const clamp01 = v => Math.min(1, Math.max(0, v));
const DEG = 180 / Math.PI;

/** What a successful recovery needs at this difficulty. */
export function requirements(diff) {
    const L = DIFFICULTY[diff].limits;
    return [
        { key: 'upright', label: 'Stays upright on its legs' },
        { key: 'pad', label: `Inside the pad (within ${L.pad} m of the centre)` },
        { key: 'vs', label: `Descending no faster than ${L.vs} m/s` },
        { key: 'hs', label: `Sideways speed no more than ${L.hs} m/s` },
        { key: 'tilt', label: `Leaning no more than ${Math.round(L.tilt * DEG)}°` },
    ];
}

const WORDS = [
    [90, 'Excellent landing'],
    [78, 'Smooth touchdown'],
    [62, 'Nicely controlled'],
    [45, 'Solid effort'],
    [0, 'Good attempt'],
];

export const AWARDS = {
    precision: { name: 'Precision Recovery', text: 'Upright on the pad within 2 m of the centre, touching down at 1.5 m/s or less with almost no drift. A textbook recovery.' },
    excellent: { name: 'Excellent Touchdown', text: 'A successful recovery scoring 85 or more: accurate, gentle and steady.' },
    success: { name: 'Successful Recovery', text: 'The booster is upright on the pad and ready to fly again.' },
    training: { name: 'Training Complete', text: 'You brought the booster down upright. Tighten up one or two numbers and it will be a full recovery.' },
    first: { name: 'First Landing Attempt', text: 'Your first descent is in the log. Every recovery pilot starts here.' },
    logged: { name: 'Test Flight Logged', text: 'Every descent teaches something. Use the debrief to plan the next one.' },
};

// Extra mentions, earned alongside the main award
const EXTRAS = [
    { id: 'bullseye', name: 'Bullseye', test: (r, e) => e.success && r.td.dist <= 1 },
    { id: 'feather', name: 'Feather Touch', test: (r, e) => e.success && r.td.vs <= 1 },
    { id: 'fuel', name: 'Fuel to Spare', test: (r, e) => e.success && r.td.prop / r.prop0 >= 0.3 },
    { id: 'manual', name: 'Hands-on Pilot', test: (r, e, ctx) => e.success && ctx.assistUsed === false },
    { id: 'hard', name: 'Hard Mode Recovery', test: (r, e) => e.success && r.diff === 'hard' },
];

/**
 * r: the physics result; ctx: { first (first attempt ever), assistUsed }.
 * Returns { success, outcome, headline, score, word, parts, checks, award, extras, tips }.
 */
export function evaluate(r, ctx = {}) {
    const L = DIFFICULTY[r.diff].limits;
    const td = r.td;
    const upright = r.outcome === 'landed';
    const checks = [
        { key: 'upright', ok: upright, value: upright ? 'yes' : r.outcome === 'toppled' ? 'tipped over' : 'no' },
        { key: 'pad', ok: td.dist <= L.pad, value: `${td.dist.toFixed(1)} m` },
        { key: 'vs', ok: td.vs <= L.vs, value: `${td.vs.toFixed(1)} m/s` },
        { key: 'hs', ok: td.hs <= L.hs, value: `${td.hs.toFixed(1)} m/s` },
        { key: 'tilt', ok: td.tilt <= L.tilt, value: `${(td.tilt * DEG).toFixed(1)}°` },
    ];
    const reqs = requirements(r.diff);
    checks.forEach((c, i) => { c.label = reqs[i].label; });
    const success = checks.every(c => c.ok) && td.legs;

    // Points: each part scales with this difficulty's limit, so harder levels ask for more precision
    const parts = {
        accuracy: 35 * clamp01(1 - td.dist / (2 * L.pad)),
        descent: 25 * clamp01(1 - Math.max(0, td.vs - 0.5) / (2 * L.vs)),
        drift: 15 * clamp01(1 - td.hs / (2 * L.hs)),
        attitude: 10 * clamp01(1 - td.tilt / (2 * L.tilt)),
        upright: upright ? 10 : 0,
        fuel: td.fuelOut ? 0 : 5 * clamp01(td.prop / (0.15 * r.prop0)),
    };
    let score = Object.values(parts).reduce((a, b) => a + b, 0);
    // Honest ceilings: a landing that did not succeed can never read as an excellent one
    if (r.outcome === 'crashed') score = Math.min(score, 20);
    else if (r.outcome === 'toppled') score = Math.min(score, 40);
    else if (!success) score = Math.min(score, 69);
    score = Math.round(score);

    const word = success || upright ? WORDS.find(([min]) => score >= min)[1] : 'Landing unsuccessful';
    let award;
    if (success && td.dist <= 2 && td.vs <= 1.5 && td.hs <= 0.5) award = 'precision';
    else if (success && score >= 85) award = 'excellent';
    else if (success) award = 'success';
    else if (upright) award = 'training';
    else award = ctx.first ? 'first' : 'logged';
    const extras = EXTRAS.filter(x => x.test(r, { success }, ctx)).map(x => x.name);

    const outcome = success ? 'Successful landing'
        : upright ? 'Landed, outside the recovery limits'
            : r.outcome === 'toppled' ? 'Landing unsuccessful: the booster tipped over'
                : 'Landing unsuccessful';
    return { success, outcome, headline: headline(r, success, upright), score, word, parts, checks, award: { id: award, ...AWARDS[award] }, extras, tips: tips(r, checks, success) };
}

function headline(r, success, upright) {
    const td = r.td;
    if (success && td.dist <= 2 && td.vs <= 1.5) return 'Excellent landing! Right on the mark.';
    if (success) return 'Successful landing. Great recovery!';
    if (upright) return 'Nicely done: the booster is standing. A little more practice and it will be a full recovery.';
    if (r.outcome === 'toppled') return 'Landing unsuccessful. You got it down; give it another try and work on arriving with less sideways speed.';
    if (td.fuelOut) return 'Landing unsuccessful: the tanks ran dry. Give it another try and save propellant for the landing burn.';
    if (!td.legs) return 'Landing unsuccessful. Give it another try: start the landing burn a little higher, so the legs are down in time.';
    return 'Landing unsuccessful. Give it another try and start your landing burn a little earlier.';
}

function tips(r, checks, success) {
    const td = r.td;
    const by = Object.fromEntries(checks.map(c => [c.key, c]));
    const out = [];
    if (!by.vs.ok) out.push(td.vs > 10 ? 'Start the landing burn earlier: watch the stopping-height cue, and give it full throttle when the booster is falling fast.' : 'Ease the throttle up in the last 20 m so you arrive gently: aim for 1–2 m/s.');
    if (!by.hs.ok) out.push('Work on reducing your horizontal speed: lean against the drift above 50 m, then stand the booster upright for the last few metres.');
    if (!by.tilt.ok) out.push('Level the booster before the legs touch: let go of the stick (with attitude hold on it straightens itself).');
    if (!by.pad.ok) out.push('Steer for the pad earlier, while you still have height: the impact marker shows where you are heading.');
    if (td.fuelOut) out.push('The tanks ran dry: coast longer before the burn, and avoid hovering.');
    if (!out.length && success) out.push('Try the next difficulty, or aim for the pad centre at under 1.5 m/s for the Precision Recovery award.');
    return out;
}

/** A plain-text summary for copying or sharing. */
export function shareText(r, e, info) {
    const td = r.td;
    return [
        `WSA Aegis Landing Simulator: ${e.outcome} · ${e.score}/100 · ${e.award.name}`,
        `${DIFFICULTY[r.diff].label} difficulty · ${td.dist.toFixed(1)} m from the pad centre · ${td.vs.toFixed(1)} m/s down · ${td.hs.toFixed(1)} m/s sideways · ${(td.tilt * DEG).toFixed(1)}° lean`,
        info && info.url ? info.url : '',
    ].filter(Boolean).join('\n');
}
