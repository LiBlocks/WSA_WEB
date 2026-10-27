// Mission Map: turns a mission record (mission-map-data.js) into drawable route geometry and a replay
// timeline. Pure functions with no three.js, so they can be tested on their own.
//
// Routes are SCHEMATIC: each leg is a smooth curve between recorded places (an arc round the body or star
// that both ends orbit), not a solved trajectory. The replay is a normalized mission sequence: every leg
// takes the same time and every event gets the same pause, whatever the real durations were.
import { BODIES, body, place, position, dir, angleAbout, REGIONS } from './bodies.js';

// Place altitudes, in body radii
const ALT = { surface: 1, air: 1.12, apex: 1.4, low: 1.7, high: 2.2, near: 3.2 };
const SAMPLES = 72;              // points per arc
const DEFAULT_ANGLE = 30;        // where a flight that never leaves its body starts
export const LEG_TIME = 1;       // replay units per leg
export const HOLD_TIME = 0.75;   // replay units each event is held on screen

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => a + (b - a) * t;
const mod360 = a => ((a % 360) + 360) % 360;

/* ---------- Places ---------- */

/**
 * 'duna/low@120' → { body: 'duna', alt: 'low', r, angle: 120 }
 * 'kgoss'        → the station on low Kerbin orbit
 * 'solar:kerbin>duna@0.55' → a point 55% of the way along a Kerbin–Duna transfer
 */
export function parsePlace(spec) {
    if (typeof spec !== 'string') return null;
    const solar = spec.match(/^solar:([a-z]+)>([a-z]+)@([\d.]+)$/);
    if (solar) return body(solar[1]) && body(solar[2]) ? { solar: true, from: solar[1], to: solar[2], f: +solar[3], body: 'kerbol' } : null;
    const region = place(spec);
    if (region && region.kind === 'station') return { body: region.parent, alt: 'low', r: region.alt, angle: region.angle, station: region.id };
    const m = spec.match(/^([a-z]+)\/([a-z]+|[\d.]+)(?:@([+-]?)([\d.]+))?$/);
    if (!m || !body(m[1]) || body(m[1]).kind === 'star') return null;
    const alt = m[2], r = ALT[alt] !== undefined ? ALT[alt] : Number(alt);
    if (!(r >= 1)) return null;
    const out = { body: m[1], alt, r };
    if (m[4] !== undefined) {
        if (m[3]) out.relAngle = (m[3] === '-' ? -1 : 1) * Number(m[4]);
        else out.angle = Number(m[4]);
    }
    return out;
}

// How two bodies relate for a transfer between them
function relation(a, b) {
    if (a === b) return 'same';
    const A = body(a), B = body(b);
    if (B.parent === a) return 'down';
    if (A.parent === b) return 'up';
    if (A.parent === B.parent) return 'sibling';
    // b is a moon of one of a's siblings (e.g. Kerbin → Vall)
    if (body(B.parent) && body(B.parent).parent === A.parent) return 'cross';
    return 'unsupported';
}

/* ---------- Arcs ---------- */

// Curve round `center` from p0 to p1, travelling prograde (counter-clockwise seen from above). The radius
// eases from one end to the other; `turn` overrides the swept angle (degrees); `dip` pulls the middle in.
function arc(center, p0, p1, { turn, dip = 0, samples = SAMPLES, ease = 'smooth' } = {}) {
    const a = sub(p0, center), b = sub(p1, center);
    const r0 = Math.hypot(a[0], a[2]), r1 = Math.hypot(b[0], b[2]);
    const t0 = Math.atan2(-a[2], a[0]);
    let sweep = turn !== undefined ? turn * Math.PI / 180 : Math.atan2(-b[2], b[0]) - t0;
    if (turn === undefined) {
        sweep = ((sweep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (sweep < 0.05) sweep += 2 * Math.PI;
    }
    const pts = [];
    for (let i = 0; i <= samples; i++) {
        const s = i / samples;
        const k = ease === 'out' ? Math.sin(s * Math.PI / 2) : ease === 'in' ? 1 - Math.cos(s * Math.PI / 2) : (1 - Math.cos(s * Math.PI)) / 2;
        const r = lerp(r0, r1, k) * (1 - dip * Math.sin(s * Math.PI));
        const t = t0 + sweep * s;
        pts.push([center[0] + r * Math.cos(t), center[1] + lerp(a[1], b[1], s), center[2] - r * Math.sin(t)]);
    }
    pts[0] = p0.slice();
    pts[pts.length - 1] = p1.slice();
    return pts;
}

/* ---------- Waypoints ---------- */

const pointOn = (bodyId, r, angle) => add(position(bodyId), scale(dir(angle), r * body(bodyId).radius));

// A point in solar orbit part-way along a transfer between two planets
function solarPoint(p) {
    const k = position('kerbol'), pts = arc(k, position(p.from), position(p.to));
    return pts[Math.round(Math.min(1, Math.max(0, p.f)) * (pts.length - 1))];
}

// Angle a waypoint should sit at on its body when none is given: leave in the direction of travel,
// arrive from the side the transfer comes in on, and climb or descend through a quarter turn.
function autoAngle(places, angles, i) {
    const p = places[i], next = places[i + 1], prev = places[i - 1];
    const toward = q => q && !q.solar && q.body !== p.body ? relation(p.body, q.body) : q && q.solar ? 'solar' : null;
    const out = toward(next), inn = toward(prev);
    const C = body(p.body).parent;
    if (out === 'sibling' || out === 'solar') return angleAbout(C, p.body) + 90;
    if (out === 'cross') return angleAbout(C, p.body) + 90;
    if (out === 'down') return angleAbout(p.body, next.body) - 150;
    if (out === 'up') return angleAbout(next.body, p.body) + 90;
    if (inn === 'sibling' || inn === 'solar') return angleAbout(C, p.body) - 90;
    if (inn === 'down') return angleAbout(prev.body, p.body) - 90;
    if (inn === 'cross') return angleAbout(body(p.body).parent, p.body) - 90;
    if (inn === 'up') return angleAbout(p.body, prev.body) + 150;
    return null;
}

/** Resolve a list of place specs into positioned waypoints */
export function resolvePlaces(specs, { startAngle } = {}) {
    const places = specs.map(parsePlace);
    const angles = places.map(p => (p && p.angle !== undefined ? p.angle : null));
    if (startAngle !== undefined && angles[0] === null) angles[0] = startAngle;
    // 1: angles set by transfers
    places.forEach((p, i) => { if (p && !p.solar && angles[i] === null && p.relAngle === undefined) angles[i] = autoAngle(places, angles, i); });
    // 2: climbs and descents: a quarter turn before or after a neighbour on the same body (a third of a
    //    turn between two orbits)
    const step = (a, b) => (a.r !== b.r ? 90 : 120);
    for (let pass = 0; pass < 3; pass++) {
        places.forEach((p, i) => {
            if (!p || p.solar || angles[i] !== null) return;
            const prev = places[i - 1], next = places[i + 1], known = k => angles[k] !== null && angles[k] !== undefined;
            if (p.relAngle !== undefined) { if (known(i - 1)) angles[i] = angles[i - 1] + p.relAngle; return; }
            if (next && next.body === p.body && known(i + 1)) angles[i] = angles[i + 1] - step(p, next);
            else if (prev && prev.body === p.body && known(i - 1)) angles[i] = angles[i - 1] + step(p, prev);
        });
    }
    // 3: anything still open (a flight that never leaves its body) starts from a default and steps forward
    places.forEach((p, i) => {
        if (!p || p.solar || angles[i] !== null) return;
        const prev = places[i - 1];
        if (prev && !prev.solar && prev.body === p.body) angles[i] = angles[i - 1] + (p.relAngle !== undefined ? p.relAngle : step(p, prev));
        else angles[i] = DEFAULT_ANGLE;
    });
    return places.map((p, i) => {
        if (!p) return null;
        if (p.solar) return { ...p, pos: solarPoint(p) };
        return { ...p, angle: mod360(angles[i]), pos: pointOn(p.body, p.r, angles[i]) };
    });
}

/* ---------- Legs ---------- */

// Schematic paths bend round any body they would otherwise cross, keeping a little clearance. A leg that
// starts or ends on a body's surface is allowed to touch that body.
const CLEARANCE = 1.3;
function avoidBodies(points, a, b) {
    const own = new Set([a, b].filter(p => p && !p.solar && p.r < CLEARANCE).map(p => p.body));
    const bodies = BODIES.filter(x => !own.has(x.id)).map(x => ({ c: position(x.id), r: x.radius * CLEARANCE }));
    return points.map((p, i) => {
        if (i === 0 || i === points.length - 1) return p;
        let q = p;
        for (const { c, r } of bodies) {
            const d = sub(q, c), dl = len(d);
            if (dl < r) q = dl > 1e-9 ? add(c, scale(d, r / dl)) : add(c, [0, r, 0]);
        }
        return q;
    });
}

function legPoints(a, b, via) {
    return avoidBodies(rawLegPoints(a, b, via), a, b);
}

function rawLegPoints(a, b, via) {
    if (a.solar || b.solar) {
        return arc(position('kerbol'), a.pos, b.pos);
    }
    const rel = relation(a.body, b.body);
    if (rel === 'same') {
        const c = position(a.body);
        if (via === 'flyby') return arc(c, a.pos, b.pos, { turn: mod360(b.angle - a.angle) || 180, dip: 0.4 });
        const ease = b.r > a.r ? 'out' : b.r < a.r ? 'in' : 'smooth';
        let turn = mod360(b.angle - a.angle);
        if (turn < 1) turn = Math.abs(b.r - a.r) > 0.01 ? 0 : 360;
        return arc(c, a.pos, b.pos, { turn, ease });
    }
    if (rel === 'down') return arc(position(a.body), a.pos, b.pos);
    if (rel === 'up') return arc(position(b.body), a.pos, b.pos);
    if (rel === 'sibling') return arc(position(body(a.body).parent), a.pos, b.pos);
    if (rel === 'cross') {
        // Transfer to the moon's planet, then round the planet to the moon
        const hub = body(b.body).parent, moonR = body(b.body).orbit.r;
        const mid = add(position(hub), scale(dir(angleAbout(body(hub).parent, hub) - 90), moonR * 1.3));
        return arc(position(body(a.body).parent), a.pos, mid).concat(arc(position(hub), mid, b.pos).slice(1));
    }
    return [a.pos, b.pos];
}

function measure(points) {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + len(sub(points[i], points[i - 1])));
    let lo = points[0].slice(), hi = points[0].slice();
    points.forEach(p => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
    const center = scale(add(lo, hi), 0.5);
    return { cum, length: cum[cum.length - 1], center, radius: len(sub(hi, lo)) / 2 };
}

// How far away the camera should be to see a place: about a moon system for a planet, closer for a moon
export function placeScale(p) {
    if (!p) return 60;
    if (p.solar) return 140;
    const b = body(p.body);
    return Math.max(b.radius * p.r * 3.2, b.radius * (b.kind === 'moon' ? 9 : 6));
}

/** Build geometry for a route: { places, legs: [{ points, cum, length, center, radius, via }] } */
export function buildRoute(route) {
    if (!route) return null;
    const specs = [route.start, ...route.legs.map(l => l.to)];
    const places = resolvePlaces(specs);
    if (places.some(p => !p)) return null;
    const legs = route.legs.map((l, i) => {
        const points = legPoints(places[i], places[i + 1], l.via);
        return { points, via: l.via || null, basis: l.basis === 'documented' ? 'documented' : 'schematic', ...measure(points) };
    });
    return { places, legs };
}

/** Build a planned branch that starts at a place of an actual route (or at its own start) */
export function buildPlanned(branch, actual) {
    const from = actual && branch.from !== undefined ? actual.places[branch.from] : null;
    if (branch.from !== undefined && !from) return null;
    const tail = branch.legs.map(l => l.to);
    let places;
    if (from) {
        // Resolve the rest with the branch point pinned where the actual route has it
        const pin = from.solar ? null : from.station || `${from.body}/${from.r}@${from.angle}`;
        if (!pin) return null;
        places = [from, ...resolvePlaces([pin, ...tail]).slice(1)];
    } else {
        places = resolvePlaces([branch.start, ...tail]);
    }
    if (places.some(p => !p)) return null;
    const legs = branch.legs.map((l, i) => {
        const points = legPoints(places[i], places[i + 1], l.via);
        return { points, via: l.via || null, ...measure(points) };
    });
    return { places, legs, label: branch.label || 'Intended route' };
}

/** Point at a route position (0 … legs.length), evenly spaced along each leg */
export function pointAt(geom, routePos) {
    if (!geom || !geom.legs.length) return geom && geom.places[0] ? geom.places[0].pos.slice() : null;
    const n = geom.legs.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(routePos)));
    const t = Math.min(1, Math.max(0, routePos - i));
    const leg = geom.legs[i], d = t * leg.length, cum = leg.cum;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const span = cum[hi] - cum[lo] || 1, f = (d - cum[lo]) / span;
    const a = leg.points[lo], b = leg.points[hi];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

/** Camera distance that suits a route position: close at bodies, wider on transfers */
export function viewDistanceAt(geom, routePos) {
    if (!geom) return 60;
    if (!geom.legs.length) return placeScale(geom.places[0]);
    const n = geom.legs.length, i = Math.min(n - 1, Math.max(0, Math.floor(routePos)));
    const t = Math.min(1, Math.max(0, routePos - i));
    const a = placeScale(geom.places[i]), b = placeScale(geom.places[i + 1]);
    const mid = Math.max(geom.legs[i].radius * 2.6, a, b);
    const w = Math.sin(t * Math.PI);
    return lerp(lerp(a, b, t), mid, w);
}

/* ---------- Replay timeline ---------- */

/**
 * Turns legs and events into one sequence: moving along legs, pausing on each event in order.
 * Returns { items, total, events } where items are { type: 'move', from, to } or { type: 'hold', event }
 * with start times; `events` keeps the record's order.
 */
export function buildTimeline(legCount, events) {
    const items = [];
    let pos = 0, time = 0;
    const moveTo = target => {
        while (pos < target - 1e-9) {
            const next = Math.min(target, Math.floor(pos + 1e-9) + 1);
            items.push({ type: 'move', from: pos, to: next, start: time, duration: (next - pos) * LEG_TIME });
            time += (next - pos) * LEG_TIME;
            pos = next;
        }
    };
    events.forEach((e, k) => {
        moveTo(Math.min(legCount, Math.max(0, e.at)));
        items.push({ type: 'hold', event: k, at: pos, start: time, duration: HOLD_TIME });
        time += HOLD_TIME;
    });
    moveTo(legCount);
    return { items, total: time, events };
}

/** Replay state at time u: { routePos, event (index or -1), item } */
export function sampleTimeline(tl, u) {
    const t = Math.min(tl.total, Math.max(0, u));
    let event = -1, routePos = 0, item = null;
    for (const it of tl.items) {
        if (it.start > t + 1e-9) break;
        item = it;
        if (it.type === 'hold') { event = it.event; routePos = it.at; }
        else routePos = it.from + Math.min(1, (t - it.start) / it.duration) * (it.to - it.from);
    }
    return { routePos, event, item, time: t };
}

/** Time at which event k starts being shown */
export function eventTime(tl, k) {
    const it = tl.items.find(i => i.type === 'hold' && i.event === k);
    return it ? it.start : 0;
}

/* ---------- Validation ---------- */

const PLACE_IDS = () => new Set([...REGIONS.map(r => r.id)]);

/** Problems with a mission record, as plain sentences (empty when it is valid) */
export function validateMission(m, statuses, vehicles = []) {
    const problems = [];
    const where = `Mission "${m && m.id}"`;
    if (!m || typeof m.id !== 'string' || !m.id) return ['A mission has no id.'];
    if (!m.name) problems.push(`${where} has no name.`);
    if (!statuses[m.status]) problems.push(`${where} has an unknown status "${m.status}".`);
    if (!m.summary) problems.push(`${where} has no summary.`);
    const regions = PLACE_IDS();
    (m.locations || []).forEach(id => { if (!body(id) && !regions.has(id)) problems.push(`${where} lists an unknown location "${id}".`); });
    if (!(m.locations || []).length) problems.push(`${where} has no locations.`);
    (m.vehicles || []).forEach(id => { if (!vehicles.some(v => v.id === id)) problems.push(`${where} links an unknown vehicle "${id}".`); });
    const legCount = m.route ? m.route.legs.length : (m.planned && m.planned[0] && m.planned[0].start ? m.planned[0].legs.length : 0);
    if (m.route) {
        const specs = [m.route.start, ...m.route.legs.map(l => l.to)];
        specs.forEach(s => { if (!parsePlace(s)) problems.push(`${where} has an unreadable place "${s}".`); });
        m.route.legs.forEach((l, i) => {
            const a = parsePlace(specs[i]), b = parsePlace(l.to);
            if (a && b && !a.solar && !b.solar && relation(a.body, b.body) === 'unsupported') problems.push(`${where} has a leg the map cannot draw (${specs[i]} → ${l.to}).`);
        });
    }
    (m.planned || []).forEach(p => {
        if (p.from === undefined && !p.start) problems.push(`${where} has a planned route with no start.`);
        if (p.from !== undefined && (!m.route || p.from > m.route.legs.length)) problems.push(`${where} has a planned route starting at a place that does not exist.`);
        p.legs.forEach(l => { if (!parsePlace(l.to)) problems.push(`${where} has an unreadable planned place "${l.to}".`); });
    });
    let last = -Infinity;
    (m.events || []).forEach((e, k) => {
        if (!e.title || !e.text) problems.push(`${where}: event ${k + 1} needs a title and text.`);
        if (e.basis !== 'site' && e.basis !== 'operator') problems.push(`${where}: event "${e.title}" needs basis 'site' or 'operator'.`);
        if (typeof e.at !== 'number' || e.at < 0 || e.at > legCount) problems.push(`${where}: event "${e.title}" is outside the route.`);
        if (e.at < last) problems.push(`${where}: events are out of order at "${e.title}".`);
        last = e.at;
        (e.focus || []).forEach(id => { if (!body(id)) problems.push(`${where}: event "${e.title}" focuses an unknown body "${id}".`); });
    });
    if (!(m.events || []).length) problems.push(`${where} has no events.`);
    return problems;
}

