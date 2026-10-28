// SSTO Landing: turns a finished landing into ratings, a grade and awards. Every rating comes from a
// measured value and fixed thresholds, so the same landing always earns the same grade.
import { SCENARIOS } from './physics.js';

export const LEVELS = ['Excellent', 'Good', 'Fair', 'Poor'];
const POINTS = [100, 82, 62, 38];
export const VREF = 65;     // m/s: the touchdown speed the spaceplane is designed around

// Lower is better; returns the level index (0 Excellent … 3 Poor)
const level = (value, limits) => {
    const i = limits.findIndex(l => value <= l);
    return i < 0 ? 3 : i;
};

const signed = (v, digits, unit) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}${unit}`;
const side = (v, unit = ' m') => Math.abs(v) < 0.05 ? `0.0${unit}` : `${Math.abs(v).toFixed(1)}${unit} ${v < 0 ? 'left' : 'right'}`;

/**
 * The rated categories of a successful landing. Each: { key, label, level (0–3), rating, value, detail, weight }
 */
export function rate(r) {
    const td = r.touchdown;
    const sink = Math.abs(td.vs);
    const rows = [];
    // Touchdown: how firmly the wheels met the runway; a bounce costs one level
    let l = level(sink, [0.8, 1.5, 2.5]);
    if (r.bounces) l = Math.min(3, l + 1);
    rows.push({ key: 'touchdown', label: 'Touchdown', level: l, value: `${signed(td.vs, 1, ' m/s')}`, detail: r.bounces ? `bounced ${r.bounces === 1 ? 'once' : `${r.bounces} times`}` : 'vertical speed', weight: 0.25 });
    rows.push({ key: 'centerline', label: 'Centerline', level: level(Math.abs(td.x), [2, 5, 10]), value: side(td.x), detail: 'from the centreline', weight: 0.2 });
    const align = Math.max(level(Math.abs(td.heading), [1.5, 3, 6]), level(Math.abs(td.bank), [2, 4, 8]));
    rows.push({ key: 'alignment', label: 'Alignment', level: align, value: `${Math.abs(td.heading).toFixed(1)}° · bank ${Math.abs(td.bank).toFixed(1)}°`, detail: 'heading off the runway, and bank', weight: 0.15 });
    rows.push({ key: 'speed', label: 'Speed', level: level(td.gs, [VREF + 5, VREF + 13, VREF + 21]), value: `${td.gs.toFixed(0)} m/s`, detail: `ground speed (target ${VREF} m/s or less)`, weight: 0.1 });
    rows.push({ key: 'rollout', label: 'Rollout', level: level(-r.remaining, [-1200, -800, -400]), value: `${Math.round(r.remaining)} m left`, detail: 'runway remaining after stopping', weight: 0.15 });
    const st = r.stability ?? 50;
    rows.push({ key: 'approach', label: 'Approach', level: level(-st, [-85, -70, -50]), value: r.stability == null ? 'n/a' : `${st}/100`, detail: 'stability on final', weight: 0.15 });
    rows.forEach(row => { row.rating = LEVELS[row.level]; });
    return rows;
}

export function grade(r) {
    if (!r.success) return { letter: 'F', score: 0, rows: [], lost: [] };
    const rows = rate(r);
    const score = Math.round(rows.reduce((sum, row) => sum + POINTS[row.level] * row.weight, 0));
    const letter = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 72 ? 'B' : score >= 58 ? 'C' : 'D';
    // The categories that cost the most, for the "why"
    const lost = rows.filter(row => row.level > 0).sort((a, b) => (POINTS[0] - POINTS[b.level]) * b.weight - (POINTS[0] - POINTS[a.level]) * a.weight);
    return { letter, score, rows, lost };
}

export const GRADE_WORDS = { S: 'Exceptional', A: 'Excellent', B: 'Good', C: 'Acceptable', D: 'Rough', F: 'Failed' };

export const AWARDS = [
    { id: 'ace', name: 'Ace Pilot', text: 'Excellent in at least five of the six landing categories.', test: (r, g) => g.rows.filter(x => x.level === 0).length >= 5 },
    { id: 'first', name: 'First Landing', text: 'Your first safe landing at the WSA spaceport.', test: (r, g, ctx) => ctx.first },
    { id: 'manual', name: 'Manual Pilot', text: 'Landed safely with Flight Assist off for the whole final approach and rollout.', test: r => !r.assistUsed },
    { id: 'smooth', name: 'Smooth Touchdown', text: 'Touched down at 0.6 m/s or gentler, without a bounce.', test: r => Math.abs(r.touchdown.vs) <= 0.6 && !r.bounces },
    { id: 'center', name: 'Dead Center', text: 'Touched down within 1.5 m of the runway centreline.', test: r => Math.abs(r.touchdown.x) <= 1.5 },
    { id: 'straight', name: 'Straight Shooter', text: 'Within 1° of the runway heading, wings level, at touchdown.', test: r => Math.abs(r.touchdown.heading) <= 1 && Math.abs(r.touchdown.bank) <= 2 },
    { id: 'short', name: 'Short Stop', text: 'Stopped within 800 m of touching down.', test: r => r.rollout <= 800 },
    { id: 'steady', name: 'Steady Approach', text: 'A final approach stability of 90 or more.', test: r => (r.stability ?? 0) >= 90 },
    { id: 'wheels', name: 'Wheels Down', text: 'A safe touchdown and a full stop on the runway.', test: () => true },
];

// The award shown on the card (the first earned, in the order above) and the others earned
export function awardsFor(r, g, ctx) {
    if (!r.success) return { main: null, others: [] };
    const earned = AWARDS.filter(a => a.test(r, g, ctx));
    const main = earned[0];
    const others = earned.slice(1).filter(a => a.id !== 'wheels');
    return { main, others };
}

// Plain-language summary for sharing or copying
export function shareText(r, g, award, url) {
    const td = r.touchdown;
    const lines = [
        `WSA SSTO Landing: grade ${g.letter} (${GRADE_WORDS[g.letter]}) · ${award.name}`,
        `Touchdown ${signed(td.vs, 1, ' m/s')} · ${Math.abs(td.x).toFixed(1)} m from the centreline · ${td.gs.toFixed(0)} m/s · ${Math.abs(td.heading).toFixed(1)}° off the runway heading`,
        `${SCENARIOS[r.scenario].label} scenario, ${r.assistUsed ? 'assisted' : 'manual'} landing, ${Math.round(r.stopAt)} m of runway used`,
    ];
    if (url) lines.push(url);
    return lines.join('\n');
}
