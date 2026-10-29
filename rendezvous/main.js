// Orbital Rendezvous Challenge: the page. Briefing, the flight loop, HUD, tutorial, debrief and records.
// The simulation (physics.js) runs at a fixed step whatever the frame rate or time warp; this file only
// feeds it the player's inputs and shows what it does.
import * as P from './physics.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { score, formatTime, GRADE_WORDS } from './scoring.js';

const { SCENARIOS, DIFFICULTIES, STATION, KERBIN } = P;
const SETTINGS_KEY = 'wsa-orbit-settings';     // difficulty, scenario, turn sensitivity (localStorage)
const RECORDS_KEY = 'wsa-orbit-records';       // best results per scenario and difficulty (localStorage)
const SESSION_KEY = 'wsa-orbit-session';       // failed attempts this visit (sessionStorage)
const WARPS = [1, 2, 5, 10, 25, 50, 100];

const $ = id => document.getElementById(id);
const game = $('or'), view = $('or-view'), canvas = $('or-canvas'), panel = $('or-panel');
const ui = {
    pause: $('or-pause'), restart: $('or-restart'), assist: $('or-assist'), viewBtn: $('or-view-btn'),
    helpBtn: $('or-help-btn'), fullscreen: $('or-fullscreen'), note: $('or-note'), live: $('or-live'),
    guide: $('or-guide'), warnings: $('or-warnings'), banner: $('or-banner'), focusBtn: $('or-focus-btn'),
    tutorial: $('or-tutorial'), tilt: $('or-tilt'), calibrate: $('or-calibrate'),
    overlays: { loading: $('or-loading'), setup: $('or-setup'), paused: $('or-paused'), debrief: $('or-debrief'), help: $('or-help'), error: $('or-error') },
};
const chip = name => view.querySelector(`[data-chip="${name}"]`);
const tele = name => panel.querySelector(`[data-t="${name}"]`);

/* ---------- Storage (all optional: blocked or corrupted storage just starts fresh) ---------- */

function readJSON(store, key, fallback, valid) {
    try {
        const v = JSON.parse(store.getItem(key));
        if (v && typeof v === 'object' && !Array.isArray(v) && valid(v)) return v;
    } catch { /* missing, corrupted or blocked */ }
    return fallback;
}
function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep going without it */ }
}
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const settings = readJSON(localStorage, SETTINGS_KEY, {}, () => true);
if (!DIFFICULTIES[settings.difficulty]) settings.difficulty = 'training';
if (!SCENARIOS[settings.scenario]) settings.scenario = 'first';
if (![0.6, 1, 1.4].includes(settings.sensitivity)) settings.sensitivity = 1;
const saveSettings = () => writeJSON(localStorage, SETTINGS_KEY, {
    difficulty: settings.difficulty, scenario: settings.scenario, sensitivity: settings.sensitivity,
});

// Records: { "first/training": { best, grade, dv, time, completions, date } }. Each entry is checked;
// anything malformed is dropped rather than shown.
const validRecord = r => r && typeof r === 'object' && num(r.best, 0, 100) && /^[SABCD]$/.test(r.grade)
    && num(r.dv, 0, 1e4) && num(r.time, 0, 1e7) && Number.isInteger(r.completions) && r.completions > 0 && r.completions < 1e7;
const records = (() => {
    const raw = readJSON(localStorage, RECORDS_KEY, {}, () => true);
    const out = {};
    for (const sc of Object.keys(SCENARIOS)) for (const df of Object.keys(DIFFICULTIES)) {
        const key = `${sc}/${df}`;
        if (validRecord(raw[key])) out[key] = raw[key];
    }
    return out;
})();
const session = readJSON(sessionStorage, SESSION_KEY, { fails: {} }, v => v.fails && typeof v.fails === 'object');
const failsFor = key => (Number.isInteger(session.fails[key]) && session.fails[key] >= 0 ? session.fails[key] : 0);

/* ---------- State ---------- */

const app = {
    mode: 'loading',        // loading | setup | running | paused | debrief | error
    helpFrom: null,         // the mode the help panel was opened from
    s: null,                // the simulation state
    assistChoice: DIFFICULTIES[settings.difficulty].assist,
    warp: 0,                // index into WARPS
    view: 'map', autoView: true,
    cam: { zoom: 1, focus: 'kerbin', closeZoom: 1 },
    pred: null, predAt: -1, predKey: '',
    tutorial: null,         // { step, hidden } in Training's First Rendezvous
    endTimer: 0,
    result: null,
    lastHud: 0, lastPhase: '', lastWarnings: '',
};
let raf = 0, last = performance.now(), acc = 0, snap = true;
let override = null;        // for automated checks: a function supplying inputs instead of the player
let renderer, input;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const touch = () => game.dataset.touch !== undefined;
const guidance = () => DIFFICULTIES[app.s ? app.s.difficulty : settings.difficulty].guidance;

/* ---------- Formatting ---------- */

const km = m => `${(m / 1000).toFixed(1)} km`;
const dist = m => m >= 10000 ? `${(m / 1000).toFixed(1)} km` : m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 10 ? 1 : 0)} m`;
const speed = v => `${Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)} m/s`;
const signed = v => `${v >= 0 ? '+' : '−'}${speed(Math.abs(v))}`;

/* ---------- Mission lifecycle ---------- */

function newMission() {
    cancelEnd();
    app.s = P.createState(settings.scenario, settings.difficulty);
    app.s.assist = app.assistChoice;
    app.warp = 0;
    acc = 0;
    app.pred = null;
    app.predAt = -1;
    app.autoView = true;
    app.view = app.s.kind === 'proximity' ? 'close' : 'map';
    app.cam = { zoom: 1, focus: 'kerbin', closeZoom: 1 };
    app.tutorial = settings.scenario === 'first' && settings.difficulty === 'training' ? { step: 0, hidden: false } : null;
    app.lastPhase = '';
    app.lastWarnings = '';
    app.result = null;
    renderer.resetClose();
    snap = true;
    updatePrediction(true);
    updateHud(true);
    syncButtons();
}

function setMode(m) {
    app.mode = m;
    game.dataset.mode = m;
    for (const [name, el] of Object.entries(ui.overlays)) el.hidden = name !== m;
    // The site's floating menu button would sit on top of the touch controls
    document.body.classList.toggle('or-touch-flying', m === 'running' && touch());
    syncButtons();
    requestFrame();
}

function start() {
    if (!app.s || app.s.status !== 'flying' || app.s.t > 0) newMission();
    setMode('running');
    last = performance.now();
    view.focus({ preventScroll: true });
    if (touch() && !document.fullscreenElement) view.scrollIntoView({ block: 'start', behavior: 'smooth' });
    announce(`${SCENARIOS[app.s.scenario].label}, ${DIFFICULTIES[app.s.difficulty].label}. Mission started.`);
}

function pause(on) {
    if (on && app.mode === 'running') { input.releaseAll(); setMode('paused'); }
    else if (!on && app.mode === 'paused') { setMode('running'); last = performance.now(); view.focus({ preventScroll: true }); }
}

function restart() {
    if (app.s && app.s.status === 'flying' && app.s.t > 5) countFailure(app.s);  // giving up counts as an attempt
    newMission();
    setMode('running');
    last = performance.now();
    view.focus({ preventScroll: true });
}

function toSetup() {
    cancelEnd();
    if (app.s && app.s.status === 'flying' && app.s.t > 5 && app.mode !== 'setup') countFailure(app.s);
    app.s = null;
    renderSetup();
    newMission();
    setMode('setup');
}

function countFailure(s) {
    const key = `${s.scenario}/${s.difficulty}`;
    session.fails[key] = failsFor(key) + 1;
    writeJSON(sessionStorage, SESSION_KEY, session);
}

function cancelEnd() {
    clearTimeout(app.endTimer);
    app.endTimer = 0;
    ui.banner.hidden = true;
}

// The simulation reported docked or failed
function missionOver() {
    const s = app.s;
    input.releaseAll();
    const key = `${s.scenario}/${s.difficulty}`;
    if (s.status === 'docked') {
        const failed = failsFor(key);
        const sc = score(s, failed);
        const prev = records[key];
        const isBest = !prev || sc.score > prev.best;
        records[key] = {
            best: isBest ? sc.score : prev.best,
            grade: isBest ? sc.letter : prev.grade,
            dv: isBest ? +s.dvUsed.toFixed(1) : prev.dv,
            time: isBest ? Math.round(s.t) : prev.time,
            completions: (prev ? prev.completions : 0) + 1,
            date: isBest ? new Date().toLocaleDateString('en-CA') : prev.date,     // YYYY-MM-DD, local
        };
        writeJSON(localStorage, RECORDS_KEY, records);
        session.fails[key] = 0;
        writeJSON(sessionStorage, SESSION_KEY, session);
        app.result = { sc, prev, isBest, failed };
        ui.banner.hidden = false;
        ui.banner.classList.toggle('still', reduceMotion.matches);
        announce(`Docked with KGOSS. Grade ${sc.letter}, ${sc.score} out of 100.`);
        app.endTimer = setTimeout(() => { ui.banner.hidden = true; showDebrief(); }, 1700);
    } else {
        if (s.outcome.code !== 'abort' || s.t > 5) countFailure(s);
        app.result = { sc: score(s), failed: failsFor(key) };
        announce(`${s.outcome.title}. ${s.outcome.text}`);
        app.endTimer = setTimeout(showDebrief, s.outcome.code === 'abort' ? 0 : 900);
    }
    app.warp = 0;
    updateHud(true);
    setMode('ended');
}

/* ---------- The loop ---------- */

function requestFrame() {
    if (!raf) raf = requestAnimationFrame(frame);
}

function maxWarp(rel) {
    if (rel.dist < 300) return 1;           // 2×
    if (rel.dist < 3000) return 3;          // 10×
    return WARPS.length - 1;
}

function frame(now) {
    raf = 0;
    const dtReal = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const s = app.s;
    if (app.mode === 'running' && s && s.status === 'flying') {
        const inp = override ? override(s) : input.read();
        if (inp.throttle) s.throttle = Math.min(1, Math.max(0.05, s.throttle + inp.throttle * 0.6 * dtReal));
        // Burning runs at normal speed, and time warp is limited close to KGOSS
        const thrusting = inp.burn || inp.fore || inp.side;
        if (thrusting && app.warp > 0 && !override) { app.warp = 0; flash('Time warp off while thrusting'); }
        const rel = P.relative(s);
        const cap = maxWarp(rel);
        if (app.warp > cap) { app.warp = cap; flash(`Time warp limited to ${WARPS[cap]}× this close to KGOSS`); }
        acc += dtReal * (override && app.testScale ? app.testScale : WARPS[app.warp]);
        let steps = Math.floor(acc / P.DT);
        acc -= steps * P.DT;
        steps = Math.min(steps, 6000);
        for (let i = 0; i < steps && s.status === 'flying'; i++) P.step(s, override && i ? override(s) : inp, settings.sensitivity);
        if (s.status !== 'flying') { acc = 0; missionOver(); }
        else {
            autoView();
            tutorialTick();
        }
    }
    if (s) {
        const busy = app.mode === 'running';
        if (busy && (performance.now() - app.predAt > (s.burning || s.rcsActive ? 120 : 300) || app.predAt < 0)) updatePrediction();
        if (busy && now - app.lastHud > 100) updateHud();
    }
    draw(dtReal);
    if (app.mode === 'running' || app.mode === 'ended') requestFrame();
}

function draw(dtReal = 0) {
    const s = app.s;
    const g = guidance();
    let plan = null;
    if (s && app.view === 'map' && g === 'full' && s.status === 'flying' && s.kind === 'orbit') {
        const w = P.transferWindow(s);
        if (w && w.wait > -15 && (!app.pred || app.pred.ca.dist > 5000)) {
            const el = P.elements(s.ship);
            const n1 = Math.sqrt(KERBIN.mu / el.a ** 3);
            plan = { r1: el.a, r2: KERBIN.radius + P.KGOSS_ALT, angle: Math.atan2(s.ship.y, s.ship.x) + n1 * Math.max(0, w.wait) };
        }
    }
    renderer.draw(s, {
        view: app.view, cam: app.cam, pred: app.pred, plan,
        showApproach: g !== 'minimal',
        driftCount: g === 'minimal' ? 121 : 0,
        dtReal, snap: snap || reduceMotion.matches,
    });
    snap = false;
}

function updatePrediction() {
    const s = app.s;
    if (!s || s.status !== 'flying') return;
    const rel = P.relative(s);
    app.predAt = performance.now();
    if (rel.dist < 15000) app.pred = P.predict(s, 900, 1);
    else {
        const el = P.elements(s.ship);
        const span = Math.min(6000, 1.25 * Math.max(el.bound ? el.period : 3000, 2400));
        app.pred = P.predict(s, span, 5);
    }
}

function autoView() {
    if (!app.autoView) return;
    const d = P.relative(app.s).dist;
    const want = app.view === 'close' ? (d > 12000 ? 'map' : 'close') : (d < 8000 ? 'close' : 'map');
    if (want !== app.view) { app.view = want; snap = true; syncButtons(); }
}

/* ---------- Actions ---------- */

function action(name) {
    const running = app.mode === 'running';
    if (name === 'pause') {
        if (app.helpFrom != null) return closeHelp();
        if (running) pause(true); else if (app.mode === 'paused') pause(false);
        return;
    }
    if (name === 'help') {
        if (app.helpFrom != null) closeHelp();
        else if (app.mode === 'running' || app.mode === 'paused' || app.mode === 'setup' || app.mode === 'debrief') openHelp();
        return;
    }
    if (name === 'view') { setView(app.view === 'map' ? 'close' : 'map'); return; }
    if (name === 'recentre') {
        app.cam = { zoom: 1, focus: 'kerbin', closeZoom: 1 };
        app.autoView = true;
        snap = true;
        if (app.s) autoView();
        syncButtons();
        flash('View recentred');
        return requestFrame();
    }
    if (name === 'focus') {
        const order = ['kerbin', 'ship', 'station'];
        app.cam.focus = order[(order.indexOf(app.cam.focus) + 1) % order.length];
        if (app.cam.focus !== 'kerbin' && app.cam.zoom < 8) app.cam.zoom = 40;
        if (app.cam.focus === 'kerbin') app.cam.zoom = 1;
        if (app.view !== 'map') setView('map');
        syncButtons();
        return requestFrame();
    }
    if (name === 'zoomIn' || name === 'zoomOut') {
        const f = name === 'zoomIn' ? 1.4 : 1 / 1.4;
        if (app.view === 'map') app.cam.zoom = Math.min(4000, Math.max(0.5, app.cam.zoom * f));
        else app.cam.closeZoom = Math.min(20, Math.max(0.05, app.cam.closeZoom * f));
        return requestFrame();
    }
    if (!app.s || app.s.status !== 'flying' || (app.mode !== 'running' && app.mode !== 'paused')) return;
    const s = app.s;
    if (name === 'assist') return setAssist(!s.assist);
    if (name.startsWith('hold:')) {
        const mode = name.slice(5);
        if (mode !== 'none' && !s.assist) { setAssist(true); }
        s.hold = mode;
        flash(mode === 'none' ? 'Flight Assist hold released' : `Flight Assist: holding ${HOLD_NAMES[mode]}`);
        syncButtons();
        updateHud(true);
        return;
    }
    if (name === 'warpUp' || name === 'warpDown') {
        const cap = maxWarp(P.relative(s));
        const next = Math.max(0, Math.min(WARPS.length - 1, app.warp + (name === 'warpUp' ? 1 : -1)));
        if (next > cap) { flash(`Time warp is limited to ${WARPS[cap]}× this close to KGOSS`); app.warp = cap; }
        else app.warp = next;
        updateHud(true);
        return;
    }
    if (name === 'throttleFull') { s.throttle = 1; updateHud(true); return; }
    if (name === 'throttleCut') { s.throttle = 0.05; updateHud(true); return; }
}

const HOLD_NAMES = { prograde: 'prograde', retrograde: 'retrograde', target: 'toward KGOSS', match: 'match velocity', dock: 'the docking axis', none: 'nothing' };

function setAssist(on) {
    app.assistChoice = on;
    $('or-assist-check').checked = on;
    if (app.s) {
        app.s.assist = on;
        if (!on) app.s.hold = 'none';
    }
    syncButtons();
    if (app.mode === 'running' || app.mode === 'paused') flash(on ? 'Flight Assist on: the craft stops turning when you let go' : 'Flight Assist off: rotation keeps going until you counter it');
    updateHud(true);
}

function setView(v) {
    app.view = v;
    app.autoView = false;
    snap = true;
    syncButtons();
    requestFrame();
}

function openHelp() {
    if (app.mode === 'running') { input.releaseAll(); setMode('paused'); }
    app.helpFrom = app.mode;
    ui.overlays.help.hidden = false;
    for (const [name, el] of Object.entries(ui.overlays)) if (name !== 'help') el.hidden = true;
    ui.overlays.help.querySelector('[data-action="closeHelp"]').focus({ preventScroll: true });
}

function closeHelp() {
    const back = app.helpFrom;
    app.helpFrom = null;
    ui.overlays.help.hidden = true;
    setMode(back === 'ended' ? 'debrief' : back || 'setup');
    if (back === 'paused') ui.overlays.paused.querySelector('[data-action="resume"]').focus({ preventScroll: true });
}

let flashTimer = 0;
function flash(text) {
    ui.note.textContent = text;
    ui.note.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { ui.note.hidden = true; }, 2600);
}

function announce(text) {
    ui.live.textContent = '';
    setTimeout(() => { ui.live.textContent = text; }, 30);
}

function syncButtons() {
    const s = app.s;
    const m = app.mode;
    ui.pause.textContent = m === 'running' ? 'Pause' : m === 'paused' ? 'Resume' : 'Start';
    ui.pause.disabled = m === 'loading' || m === 'error' || m === 'ended' || m === 'debrief';
    ui.restart.disabled = !s || m === 'setup' || m === 'loading';
    const on = s ? s.assist : app.assistChoice;
    ui.assist.textContent = `Flight Assist: ${on ? 'On' : 'Off'}`;
    ui.assist.setAttribute('aria-pressed', String(on));
    ui.viewBtn.textContent = `View: ${app.view === 'map' ? 'Map' : 'Close-up'}`;
    ui.focusBtn.textContent = { kerbin: 'Kerbin', ship: 'You', station: 'KGOSS' }[app.cam.focus];
    game.querySelectorAll('[data-action^="hold:"]').forEach(b => b.setAttribute('aria-pressed', String(!!s && s.assist && b.dataset.action === `hold:${s.hold}`)));
    ui.calibrate.hidden = !input || !input.tiltOn;
    ui.tilt.setAttribute('aria-pressed', String(!!input && input.tiltOn));
}

/* ---------- HUD ---------- */

function phaseOf(s, rel) {
    if (s.status === 'docked') return ['DOCKED', 'ok'];
    if (s.status === 'failed') return [s.outcome.code === 'abort' ? 'ABORTED' : 'FAILED', 'alert'];
    if (rel.dist > 10000) return ['TRANSFER', 'info'];
    if (rel.dist > 300) return ['RENDEZVOUS', 'info'];
    return ['FINAL APPROACH', 'info'];
}

function warningsFor(s, rel) {
    const out = [];
    if (s.status !== 'flying') return out;
    const diff = DIFFICULTIES[s.difficulty];
    const dv = P.deltaV(s);
    if (dv <= 0.01) out.push(['alert', 'OUT OF PROPELLANT']);
    else if (dv < Math.max(5, 0.15 * s.budget)) out.push(['warn', `PROPELLANT LOW · ${dv.toFixed(1)} m/s LEFT`]);
    const el = P.elements(s.ship);
    if (el.pe < KERBIN.atmosphere) out.push(['alert', `PERIAPSIS ${(el.pe / 1000).toFixed(0)} KM · INSIDE THE ATMOSPHERE`]);
    const portRange = Math.hypot(rel.x - STATION.port.x, rel.y);
    if (rel.dist < 3000 && rel.closing > P.safeSpeed(portRange, diff.dock)) out.push(['alert', `CLOSING TOO FAST · ${rel.closing.toFixed(2)} M/S (SAFE ${P.safeSpeed(portRange, diff.dock).toFixed(2)})`]);
    const p = app.pred;
    if (p && p.ca.t > 1 && p.ca.t < 600 && p.ca.dist < 50 && p.ca.speed > 2) out.push(['alert', `UNSAFE PASS AHEAD · ${Math.round(p.ca.dist)} M AT ${p.ca.speed.toFixed(1)} M/S`]);
    if (s.passed) out.push(['warn', 'PASSED KGOSS · THE RANGE IS GROWING']);
    if (portRange < 200 && !P.corridor(rel, diff.corridor).inside) out.push(['warn', 'OUTSIDE THE APPROACH CORRIDOR']);
    return out;
}

// One line of contextual guidance; how much depends on the difficulty
function guideFor(s, rel) {
    const g = guidance();
    if (g === 'minimal' || s.status !== 'flying') return '';
    const diff = DIFFICULTIES[s.difficulty];
    const p = app.pred;
    const keys = !touch();
    if (rel.dist > 10000) {
        if (g === 'some') return 'Plan a transfer to KGOSS\'s orbit, then check the closest approach.';
        if (p && p.ca.dist < 3000) return `On an intercept: closest approach ${dist(p.ca.dist)} in ${formatTime(p.ca.t)}. Time-warp ${keys ? '(.)' : '(»)'} until KGOSS is close.`;
        const w = P.transferWindow(s);
        if (w && w.wait > 8) return `Transfer window in ${formatTime(w.wait)}: then burn about ${Math.abs(w.burn).toFixed(0)} m/s ${w.direction} at the green marker. Time warp ${keys ? '(.)' : '(»)'} to get there.`;
        if (w && w.wait > -15) return `Window open: point ${w.direction} (${keys ? (w.direction === 'prograde' ? '1' : '2') : (w.direction === 'prograde' ? 'PRO' : 'RETRO')}) and burn about ${Math.abs(w.burn).toFixed(0)} m/s, watching the closest approach shrink.`;
        return 'Burn prograde to raise your orbit or retrograde to lower it, until the closest approach is under 3 km.';
    }
    const portRange = Math.hypot(rel.x - STATION.port.x, rel.y);
    const safe = P.safeSpeed(portRange, diff.dock);
    if (g === 'some') {
        if (rel.dist > 300) return rel.speed > 5 ? 'Match velocity with KGOSS before closing in.' : 'Close in slowly and move behind KGOSS onto its docking axis.';
        return 'Stay in the corridor and keep the closing speed down.';
    }
    if (rel.speed > Math.max(3, safe * 1.5) && rel.dist > 300) return `Relative speed ${speed(rel.speed)}: point to match velocity (${keys ? '4' : 'MATCH'}) and burn until it's under 2 m/s.`;
    if (rel.dist > 300) {
        if (rel.x > STATION.port.x - 20) return 'The port faces backwards: fly round behind KGOSS onto the dashed docking axis before closing in.';
        return `Point toward KGOSS (${keys ? '3' : 'TGT'}) and burn gently, or use the thrusters. Keep the closing speed under ${safe.toFixed(1)} m/s.`;
    }
    return `Point along the docking axis (${keys ? '5' : 'DOCK'}) and creep in with ${keys ? 'I' : '▲'}. ${keys ? 'J and L' : '◀ and ▶'} nudge sideways. Touch the port under ${diff.dock.speed} m/s.`;
}

function setChip(name, text, level) {
    const c = chip(name);
    c.textContent = text;
    if (level) c.dataset.level = level; else delete c.dataset.level;
}

function setTele(name, text, level) {
    const el = tele(name);
    if (el.textContent !== text) el.textContent = text;
    if (level) el.dataset.level = level; else delete el.dataset.level;
}

function updateHud(force) {
    const s = app.s;
    if (!s) return;
    app.lastHud = performance.now();
    const rel = P.relative(s);
    const diff = DIFFICULTIES[s.difficulty];
    const [phase, plevel] = phaseOf(s, rel);
    setChip('phase', phase, plevel);
    if (phase !== app.lastPhase && app.lastPhase && s.status === 'flying') announce(`Phase: ${phase.toLowerCase()}.`);
    app.lastPhase = phase;
    setChip('difficulty', diff.label.toUpperCase());
    setChip('assist', s.assist ? (s.hold !== 'none' ? `ASSIST · HOLD ${HOLD_NAMES[s.hold].toUpperCase()}` : 'ASSIST ON') : 'ASSIST OFF', s.assist ? (s.hold !== 'none' ? 'active' : 'ok') : null);
    setChip('warp', `WARP ${WARPS[app.warp]}×`, app.warp ? 'warn' : null);
    setChip('met', `T+ ${formatTime(s.t)}`);

    // Orbit
    const el = P.elements(s.ship);
    const alt = Math.hypot(s.ship.x, s.ship.y) - KERBIN.radius;
    setTele('alt', km(alt));
    setTele('speed', `${Math.hypot(s.ship.vx, s.ship.vy).toFixed(1)} m/s`);
    setTele('ap', el.bound ? km(el.ap) : 'escape');
    setTele('pe', km(el.pe), el.pe < KERBIN.atmosphere ? 'alert' : null);
    setTele('period', el.bound ? formatTime(el.period) : '—');

    // KGOSS
    setTele('dist', dist(rel.dist));
    setTele('rel', speed(rel.speed));
    setTele('closing', signed(rel.closing));
    const p = app.pred;
    if (s.status !== 'flying') setTele('ca', '—');
    else if (p && p.ca.t > 1) setTele('ca', `${dist(p.ca.dist)} in ${formatTime(p.ca.t)}`, p.ca.dist < 50 && p.ca.speed > 2 ? 'alert' : null);
    else setTele('ca', 'now: the range is growing');
    const along = rel.x >= 0 ? 'ahead' : 'behind', radial = rel.y >= 0 ? 'above' : 'below';
    setTele('relpos', `${dist(Math.abs(rel.x))} ${along}, ${dist(Math.abs(rel.y))} ${radial}`);

    // Final approach
    const portRange = Math.hypot(rel.x - STATION.port.x, rel.y);
    const near = portRange < 1000;
    // Close in, the docking readouts replace the orbit ones
    panel.querySelector('[data-group="dock"]').hidden = !near;
    panel.querySelector('[data-group="orbit"]').hidden = near;
    const tol = diff.dock;
    const safe = P.safeSpeed(portRange, tol);
    const cor = P.corridor(rel, diff.corridor);
    const noseRange = Math.max(0, STATION.port.x - rel.nx);
    setTele('port', near ? dist(noseRange) : '—');
    setTele('dclosing', near ? `${signed(rel.nvx)} / ${safe.toFixed(2)}` : '—', near ? (rel.nvx > safe ? 'alert' : rel.nvx > safe * 0.8 ? 'warn' : 'ok') : null);
    setTele('lateral', near ? `${Math.abs(rel.ny).toFixed(2)} m / ${tol.lateral}` : '—', near && noseRange < 30 ? (Math.abs(rel.ny) > tol.lateral ? 'alert' : 'ok') : null);
    setTele('lspeed', near ? `${Math.abs(rel.nvy).toFixed(2)} / ${tol.lateralSpeed}` : '—', near && noseRange < 30 ? (Math.abs(rel.nvy) > tol.lateralSpeed ? 'alert' : 'ok') : null);
    const off = Math.abs(rel.heading) * 180 / Math.PI;
    setTele('align', near ? `${off.toFixed(1)}° / ${tol.angle}°` : '—', near && noseRange < 60 ? (off > tol.angle ? 'alert' : 'ok') : null);
    setTele('corridor', near ? (cor.inside ? `inside (${cor.angle.toFixed(0)}° of ${diff.corridor}°)` : 'outside') : '—', near ? (cor.inside ? 'ok' : 'warn') : null);

    // Craft
    const full = P.fullPropellant(s), left = P.propellant(s);
    panel.querySelector('[data-bar="prop"]').style.width = `${(100 * left / full).toFixed(1)}%`;
    setTele('prop', `${left.toFixed(0)} kg · ${P.deltaV(s).toFixed(1)} m/s`, P.deltaV(s) < Math.max(5, 0.15 * s.budget) ? 'warn' : null);
    panel.querySelector('[data-bar="thr"]').style.width = `${(100 * s.throttle).toFixed(0)}%`;
    setTele('thr', `${Math.round(s.throttle * 100)}%`);
    setTele('engine', s.burning ? 'BURNING' : s.rcsActive ? 'THRUSTERS' : 'OFF', s.burning ? 'warn' : s.rcsActive ? 'active' : null);
    game.classList.toggle('burning', s.burning);
    dial(s, rel);

    // Guidance and warnings
    const g = guideFor(s, rel);
    ui.guide.hidden = !g || (app.tutorial && !app.tutorial.hidden);
    if (g && ui.guide.textContent !== g) ui.guide.textContent = g;
    const warns = warningsFor(s, rel);
    const sig = warns.map(w => w[1].split(' · ')[0]).join('|');
    if (force || sig !== app.lastWarnings) {
        ui.warnings.replaceChildren(...warns.map(([level, text]) => {
            const li = document.createElement('li');
            li.dataset.level = level;
            li.textContent = text;
            return li;
        }));
        if (sig && sig !== app.lastWarnings && s.status === 'flying') announce(`Warning: ${warns.map(w => w[1].split(' · ')[0].toLowerCase()).join(', ')}.`);
    } else {
        ui.warnings.querySelectorAll('li').forEach((li, i) => { if (warns[i] && li.textContent !== warns[i][1]) li.textContent = warns[i][1]; });
    }
    app.lastWarnings = sig;
    renderTutorial();
}

// The heading dial: the nose and the useful directions, in the frame of the current view
const dialMarks = panel.querySelector('.or-dial-marks');
const dialNose = panel.querySelector('.or-dial-nose');
function dial(s, rel) {
    const base = app.view === 'close' ? rel.frame.angle : 0;
    const at = a => [50 * Math.cos(a - base), -50 * Math.sin(a - base)];
    const marks = [
        ['pro', P.holdAngle(s, 'prograde', rel)],
        ['retro', P.holdAngle(s, 'retrograde', rel)],
        ['tgt', P.holdAngle(s, 'target', rel)],
        ['match', P.holdAngle(s, 'match', rel)],
    ];
    let html = '';
    for (const [k, a] of marks) {
        if (a == null) continue;
        const [x, y] = at(a);
        if (k === 'pro') html += `<circle class="m-pro" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`;
        else if (k === 'retro') html += `<path class="m-retro" d="M${(x - 4).toFixed(1)} ${(y - 4).toFixed(1)}l8 8m0 -8l-8 8"/>`;
        else if (k === 'tgt') html += `<rect class="m-tgt" x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
        else html += `<path class="m-match" d="M${x.toFixed(1)} ${(y - 5).toFixed(1)}l5 9h-10z"/>`;
    }
    dialMarks.innerHTML = html;
    dialNose.setAttribute('transform', `rotate(${(-(s.ship.heading - base) * 180 / Math.PI).toFixed(1)})`);
}

/* ---------- Tutorial (Training, First Rendezvous) ---------- */

const TUTORIAL = [
    { title: 'Read the map', manual: true, text: () => 'Kerbin is in the middle. KGOSS (amber) circles at 200 km; you (blue) are in the lower orbit. Both go anticlockwise, and a lower orbit is faster, so you are slowly catching KGOSS up.' },
    { title: 'Prograde and retrograde', text: () => `Prograde is the direction you're moving; retrograde is the opposite. Point prograde: ${touch() ? 'tap PRO' : 'press 1'} and Flight Assist turns you there (the ◯ on the dial).`, done: s => Math.abs(P.wrap(P.holdAngle(s, 'prograde') - s.ship.heading)) < 0.08 },
    { title: 'Burn at the window', text: s => { const w = P.transferWindow(s); return `A prograde burn raises the far side of your orbit. ${w && w.wait > 5 ? `The transfer window opens in ${formatTime(w.wait)} at the green marker: time warp there (${touch() ? '»' : '.'}), then` : 'The window is open now:'} hold ${touch() ? 'BURN' : 'Space'} for about ${w ? Math.abs(w.burn).toFixed(0) : 13} m/s.`; }, done: s => s.dvUsed > 4 },
    { title: 'Watch the orbit change', manual: true, text: () => 'Your Ap (highest point) has risen toward KGOSS\'s orbit. The white markers show where you and KGOSS will be at the closest approach, and the panel shows how close that is.' },
    { title: 'Plan the transfer', text: () => `Keep adjusting with short prograde or retrograde burns until the closest approach is under 2 km. Then time-warp (${touch() ? '»' : '.'}) toward the encounter; the view switches to a close-up of KGOSS.`, done: s => P.relative(s).dist < 8000 },
    { title: 'Match KGOSS\'s motion', text: () => `You're close, but probably moving fast relative to KGOSS. Being close isn't enough. ${touch() ? 'Tap MATCH' : 'Press 4'} to point against your relative velocity and burn until the relative speed is under 2 m/s.`, done: s => P.relative(s).speed < 2 },
    { title: 'Close in slowly', text: () => `The port faces backwards along KGOSS's path. Fly behind it onto the dashed docking axis, inside the green corridor, keeping the closing speed under the safe value in the panel. ${touch() ? 'TGT' : '3'} points at KGOSS; the thrusters (${touch() ? 'arrows' : 'I J K L'}) move you without turning.`, done: s => { const r = P.relative(s); return Math.hypot(r.x - STATION.port.x, r.y) < 250 && P.corridor(r, DIFFICULTIES[s.difficulty].corridor).inside; } },
    { title: 'Final approach', text: () => `${touch() ? 'Tap DOCK' : 'Press 5'} to point along the docking axis, then creep forward with ${touch() ? '▲' : 'I'}. ${touch() ? '◀ ▶' : 'J and L'} correct sideways drift. Touch the port under 0.8 m/s.`, done: () => false },
];

// Steps finish when the player has done them; a player who's ahead skips the steps already done
function tutorialTick() {
    const t = app.tutorial;
    if (!t || t.step >= TUTORIAL.length) return;
    for (let j = TUTORIAL.length - 1; j >= t.step; j--) {
        if (TUTORIAL[j].done && TUTORIAL[j].done(app.s)) { t.step = j + 1; renderTutorial(true); return; }
    }
}

function renderTutorial(changed) {
    const t = app.tutorial;
    const show = !!t && !t.hidden && app.s && app.s.status === 'flying' && t.step < TUTORIAL.length;
    ui.tutorial.hidden = !show;
    if (!show) return;
    const st = TUTORIAL[t.step];
    ui.tutorial.querySelector('.or-tutorial-step').textContent = `Tutorial ${t.step + 1} of ${TUTORIAL.length} · ${st.title}`;
    const text = st.text(app.s);
    const p = ui.tutorial.querySelector('.or-tutorial-text');
    if (p.textContent !== text) p.textContent = text;
    $('or-tutorial-next').hidden = !st.manual;
    if (changed) announce(`Tutorial: ${st.title}. ${text}`);
}

$('or-tutorial-next').addEventListener('click', () => {
    if (app.tutorial) { app.tutorial.step++; renderTutorial(true); }
    refocus();
});
$('or-tutorial-hide').addEventListener('click', () => {
    if (app.tutorial) app.tutorial.hidden = true;
    renderTutorial();
    updateHud(true);
    refocus();
});

/* ---------- Briefing ---------- */

function renderSetup() {
    game.querySelectorAll('input[name="or-difficulty"]').forEach(r => { r.checked = r.value === settings.difficulty; });
    game.querySelectorAll('input[name="or-scenario"]').forEach(r => { r.checked = r.value === settings.scenario; });
    const diff = DIFFICULTIES[settings.difficulty];
    for (const id of Object.keys(SCENARIOS)) {
        game.querySelector(`[data-blurb="${id}"]`).textContent = SCENARIOS[id].blurb;
        const r = records[`${id}/${settings.difficulty}`];
        game.querySelector(`[data-best="${id}"]`).textContent = r ? `Best on ${diff.label}: ${r.grade} · ${r.best}/100 (${r.completions} docked)` : `Not yet completed on ${diff.label}`;
    }
    const s = P.createState(settings.scenario, settings.difficulty);
    const sc = SCENARIOS[settings.scenario];
    const rel = P.relative(s);
    const el = P.elements(s.ship);
    $('or-brief-name').textContent = `· ${sc.label} · ${diff.label}`;
    const facts = [
        ['Your orbit', s.kind === 'orbit' ? `${(el.pe / 1000).toFixed(0)} × ${(el.ap / 1000).toFixed(0)} km` : `next to KGOSS: ${dist(Math.abs(rel.x))} behind, ${dist(Math.abs(rel.y))} ${rel.y < 0 ? 'below' : 'above'}`],
        ['KGOSS orbit', '200 km, circular'],
        ['Separation', dist(rel.dist)],
        ['Relative velocity', `${speed(rel.speed)}${s.kind === 'orbit' ? ' (mostly from the different orbits)' : ' toward KGOSS'}`],
        ['Delta-v', `${s.budget} m/s (${P.propellant(s).toFixed(0)} kg of propellant)`],
        ['Guidance', { full: 'Full: tutorial (First Rendezvous), hints, transfer preview', some: 'Some: short hints and the closest-approach marker', minimal: 'Minimal: instruments and safety warnings only' }[diff.guidance]],
    ];
    $('or-brief-facts').replaceChildren(...facts.flatMap(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        const div = document.createElement('div'); div.append(dt, dd);
        return [div];
    }));
    const tol = diff.dock;
    const objectives = sc.kind === 'orbit'
        ? ['Plan a transfer to KGOSS\'s orbit.', 'Bring the closest approach under about 2 km.', 'Near the encounter, match velocity with KGOSS.', `Fly up the approach corridor and dock gently.`]
        : ['Brake: you are closing much too fast.', 'Move onto the docking axis behind KGOSS.', 'Line the nose up with the port.', 'Dock gently, inside the limits below.'];
    $('or-brief-objectives').replaceChildren(...objectives.map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));
    $('or-brief-limits').textContent = `Contact at ${tol.speed} m/s or less, within ${tol.lateral} m of the port's centre, nose within ${tol.angle}° of its axis, sideways drift under ${tol.lateralSpeed} m/s. Approach corridor ±${diff.corridor}°.`;
    $('or-assist-check').checked = app.assistChoice;
    $('or-sensitivity').value = String(settings.sensitivity);
}

game.querySelectorAll('input[name="or-difficulty"]').forEach(r => r.addEventListener('change', () => {
    settings.difficulty = r.value;
    app.assistChoice = DIFFICULTIES[r.value].assist;
    saveSettings();
    renderSetup();
    newMission();
    requestFrame();
}));
game.querySelectorAll('input[name="or-scenario"]').forEach(r => r.addEventListener('change', () => {
    settings.scenario = r.value;
    saveSettings();
    renderSetup();
    newMission();
    requestFrame();
}));
$('or-assist-check').addEventListener('change', e => setAssist(e.target.checked));
$('or-sensitivity').addEventListener('change', e => { settings.sensitivity = Number(e.target.value); saveSettings(); });
$('or-start').addEventListener('click', start);

/* ---------- Debrief ---------- */

function showDebrief() {
    const s = app.s, r = app.result;
    const box = ui.overlays.debrief;
    const ok = s.status === 'docked';
    const diff = DIFFICULTIES[s.difficulty], sc = SCENARIOS[s.scenario];
    box.querySelector('.or-kicker').textContent = ok ? 'MISSION COMPLETE · DOCKED WITH KGOSS' : 'MISSION FAILED';
    box.querySelector('.or-kicker').classList.toggle('fail', !ok);
    box.querySelector('.or-grade').textContent = r.sc.letter;
    box.querySelector('.or-grade').dataset.grade = r.sc.letter;
    box.querySelector('.or-grade-score').textContent = ok ? `${r.sc.score}/100 · ${GRADE_WORDS[r.sc.letter]}` : 'No score';
    box.querySelector('.or-debrief-title').textContent = ok ? 'Docked' : s.outcome.title.charAt(0) + s.outcome.title.slice(1).toLowerCase();
    box.querySelector('.or-debrief-text').textContent = s.outcome.text;
    box.querySelector('.or-debrief-meta').textContent = `${sc.label} · ${diff.label} (${diff.tag}) · Flight Assist ${s.assist ? 'on' : 'off'} at the end${s.assistUsed ? ', holds used' : ''}`;
    const rec = records[`${s.scenario}/${s.difficulty}`];
    box.querySelector('.or-debrief-record').textContent = ok
        ? (r.isBest ? (r.prev ? `New best on ${diff.label}: up from ${r.prev.best}.` : `First completion on ${diff.label}.`) : `Your best on ${diff.label}: ${rec.grade} · ${rec.best}/100.`)
        : (rec ? `Your best on ${diff.label}: ${rec.grade} · ${rec.best}/100.` : '');
    const list = box.querySelector('.or-breakdown');
    list.replaceChildren(...r.sc.rows.map(row => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="or-bd-label"></span><span class="or-bd-bar"><span style="width:${row.points}%"></span></span><b>${row.points}</b><small></small>`;
        li.querySelector('.or-bd-label').textContent = `${row.label} · ${Math.round(row.weight * 100)}%`;
        li.querySelector('small').textContent = `${row.value} (${row.detail})`;
        return li;
    }));
    box.querySelector('.or-breakdown-wrap').hidden = !ok;
    const c = s.contact;
    const stats = [
        ['Difficulty', `${diff.label} (${diff.tag})`],
        ['Scenario', sc.label],
        ['Mission time', formatTime(s.t)],
        ['Time to rendezvous', s.rendezvousAt != null ? `${formatTime(s.rendezvousAt)} (first within 1 km)` : 'never within 1 km'],
        ['Delta-v used', `${s.dvUsed.toFixed(1)} of ${s.budget} m/s`],
        ['Propellant left', `${P.propellant(s).toFixed(0)} kg`],
    ];
    if (ok) stats.push(
        ['Final approach speed', `${c.speed.toFixed(2)} m/s (limit ${diff.dock.speed})`],
        ['Off centre', `${c.lateral.toFixed(2)} m (limit ${diff.dock.lateral})`],
        ['Nose off axis', `${c.angle.toFixed(1)}° (limit ${diff.dock.angle}°)`],
        ['Sideways drift', `${c.lateralSpeed.toFixed(2)} m/s (limit ${diff.dock.lateralSpeed})`],
    );
    else {
        const rel = P.relative(s);
        stats.push(['Minimum separation', dist(s.minDist)], ['Relative speed at the end', speed(c && c.speed != null ? c.speed : rel.speed)]);
    }
    stats.push(['Unsafe moments', String(s.unsafe)], ['Failed attempts this visit', String(ok ? r.failed : failsFor(`${s.scenario}/${s.difficulty}`))]);
    box.querySelector('.or-stats').replaceChildren(...stats.map(([k, v]) => {
        const div = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        div.append(dt, dd);
        return div;
    }));
    box.querySelector('.or-unsafe-wrap').hidden = !s.unsafeLog.length;
    box.querySelector('.or-unsafe').replaceChildren(...s.unsafeLog.slice(0, 8).map(u => { const li = document.createElement('li'); li.textContent = `T+ ${formatTime(u.t)} · ${u.text}`; return li; }));
    setMode('debrief');
    box.querySelector('[data-action="restart"]').focus({ preventScroll: true });
}

/* ---------- Buttons and page events ---------- */

function refocus() {
    if (app.mode === 'running') view.focus({ preventScroll: true });
}

game.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || !game.contains(b)) return;
    const a = b.dataset.action;
    if (a === 'resume') pause(false);
    else if (a === 'restart') restart();
    else if (a === 'setup') toSetup();
    else if (a === 'abort') { P.abort(app.s); missionOver(); }
    else if (a === 'help') openHelp();
    else if (a === 'closeHelp') closeHelp();
    else if (a === 'tutorial') openHelp();
    else action(a);
    if (!['restart', 'setup', 'help', 'tutorial', 'closeHelp', 'abort'].includes(a)) refocus();
});
ui.pause.addEventListener('click', () => {
    if (app.mode === 'setup') start();
    else if (app.mode === 'running') pause(true);
    else if (app.mode === 'paused') pause(false);
});
ui.restart.addEventListener('click', restart);
ui.assist.addEventListener('click', () => { setAssist(!(app.s ? app.s.assist : app.assistChoice)); refocus(); });
ui.viewBtn.addEventListener('click', () => { setView(app.view === 'map' ? 'close' : 'map'); refocus(); });
ui.helpBtn.addEventListener('click', () => action('help'));

ui.tilt.addEventListener('click', async () => {
    if (input.tiltOn) { input.disableTilt(); flash('Tilt off: use the ⟲ ⟳ buttons to turn'); syncButtons(); return; }
    flash('Asking for motion data, used only to turn the craft…');
    const r = await input.enableTilt();
    if (r === 'on') flash('Tilt on: tip the device left or right to turn. Calibrate sets level.');
    else if (r === 'denied') flash('Motion access was declined. The touch buttons work as before.');
    else flash('No motion sensor readings. The touch buttons work as before.');
    syncButtons();
});
ui.calibrate.addEventListener('click', () => { input.calibrate(); flash('Tilt calibrated: this is now level'); });

canvas.addEventListener('wheel', e => {
    if (app.mode === 'setup' || app.mode === 'loading' || document.activeElement !== view) return;
    e.preventDefault();
    action(e.deltaY < 0 ? 'zoomIn' : 'zoomOut');
}, { passive: false });

window.addEventListener('blur', () => { input.releaseAll(); if (app.mode === 'running' && !override) pause(true); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { input.releaseAll(); if (app.mode === 'running') pause(true); }
});
document.addEventListener('focusin', e => {
    if (app.mode === 'running' && !game.contains(e.target) && e.target.closest && e.target.closest('input, textarea, select, dialog')) pause(true);
});

const canFullscreen = !!(game.requestFullscreen && document.fullscreenEnabled);
ui.fullscreen.hidden = !canFullscreen;
ui.fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else game.requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
    ui.fullscreen.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    refocus();
});

function syncTouch() {
    if (input.coarse) game.dataset.touch = '';
    else delete game.dataset.touch;
    document.body.classList.toggle('or-touch-flying', app.mode === 'running' && touch());
}

/* ---------- Start up ---------- */

function init() {
    renderer = createRenderer(canvas);
    input = createInput(game, {
        onAction: action,
        // Keys fly the craft only while the view (or nothing in particular) has focus. A focused button
        // keeps Space and Enter for itself, and paused overlays only take pause and help.
        isActive: e => {
            const t = e.target;
            const free = t === document.body || t === view;
            if (app.mode === 'running') return free || (game.contains(t) && e.code !== 'Space' && e.code !== 'Enter');
            if (app.mode === 'paused') return (free || game.contains(t)) && ['Escape', 'KeyP', 'KeyH'].includes(e.code);
            return false;
        },
    });
    syncTouch();
    input.coarseQuery.addEventListener('change', syncTouch);
    new ResizeObserver(() => { renderer.resize(); snap = true; requestFrame(); }).observe(view);
    renderer.resize();
    renderSetup();
    newMission();
    setMode('setup');
}

try {
    init();
} catch (err) {
    app.mode = 'error';
    game.dataset.mode = 'error';
    ui.overlays.loading.hidden = true;
    ui.overlays.error.hidden = false;
    ui.overlays.error.querySelector('.or-card-title').textContent = 'The game could not start';
    ui.overlays.error.querySelector('.or-card-text').textContent = `${err && err.message ? err.message : 'An unexpected error stopped it.'} Try reloading the page or another browser.`;
}

// Leaving: stop the loop; if the page is being thrown away, remove the listeners too
window.addEventListener('pagehide', e => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (app.mode === 'running') pause(true);
    if (!e.persisted && input) input.destroy();
});

// For automated checks: inspect state, drive inputs and speed up time
window.__orbitRendezvous = {
    app, P, settings, records,
    get state() { return app.s; },
    setOverride(fn) { override = fn; },
    setTestScale(k) { app.testScale = k; },
    hud: () => updateHud(true),
};
