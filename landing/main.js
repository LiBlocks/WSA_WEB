// SSTO Landing (ssto-landing.html): wires the flight model, the 3D spaceport, the HUD, the controls,
// the scoring and the result card together. The flight runs at a fixed 120 Hz step whatever the
// display's frame rate.
import { createState, step, telemetry, SCENARIOS, LIMITS } from './physics.js';
import { RUNWAY, GLIDE } from './layout.js';
import { grade, awardsFor, shareText, GRADE_WORDS, LEVELS } from './scoring.js';
import { createHud, createDash } from './hud.js';
import { createInput } from './input.js';
import { drawCard, cardBlob, CARD, GRADE_COLORS } from './card.js';

const STEP = 1 / 120;
const MAX_FRAME = 0.1;      // s: a long pause between frames (a background tab) doesn't fast-forward
const SETTINGS_KEY = 'wsa-ssto-settings';
const SESSION_KEY = 'wsa-ssto-session';     // this visit's attempts and landings (sessionStorage)
const RECORD_KEY = 'wsa-ssto-record';       // landings ever made here, for the First Landing award

const $ = id => document.getElementById(id);
const game = $('ld');
const view = $('ld-view');
const ui = {
    canvas: $('ld-canvas'), loading: $('ld-loading'), setup: $('ld-setup'), paused: $('ld-paused'),
    result: $('ld-result'), failed: $('ld-failed'), error: $('ld-error'),
    start: $('ld-start'), pause: $('ld-pause'), restart: $('ld-restart'), assist: $('ld-assist'),
    camera: $('ld-camera'), fullscreen: $('ld-fullscreen'), live: $('ld-live'), note: $('ld-note'),
    calibrate: $('ld-calibrate'), gearBtn: $('ld-gear-btn'), camBtn: $('ld-cam-btn'),
};

function showError(title, text) {
    ui.loading.hidden = true;
    for (const o of [ui.setup, ui.paused, ui.result, ui.failed]) o.hidden = true;
    ui.error.hidden = false;
    ui.error.querySelector('.ld-card-title').textContent = title;
    ui.error.querySelector('.ld-card-text').textContent = text;
    [ui.pause, ui.restart, ui.assist, ui.camera].forEach(b => { b.disabled = true; });
    game.dataset.mode = 'error';
}

// three.js is loaded with the world module; if it can't load, say so instead of leaving a blank view
let createWorld;
try {
    ({ createWorld } = await import('./world.js'));
} catch (err) {
    showError('The 3D engine could not load', 'The game needs its 3D library (three.js), which did not load. Check your connection and reload the page.');
    throw err;
}
let world;
try {
    world = createWorld(ui.canvas);
} catch (err) {
    showError('3D graphics are unavailable', 'This browser or device could not start WebGL, which the game needs. Try another browser, or turn on hardware acceleration.');
    throw err;
}
ui.loading.hidden = true;
ui.canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    showError('The 3D view stopped', 'The graphics context was lost (this can happen when a device is busy or wakes from sleep). Reload the page to fly again.');
    app.mode = 'error';
});

/* ---------- Settings and statistics (browser storage, all optional) ---------- */

function readJSON(store, key, fallback, valid) {
    try {
        const v = JSON.parse(store.getItem(key));
        if (v && typeof v === 'object' && valid(v)) return v;
    } catch (e) { /* missing, corrupted or blocked: start fresh */ }
    return fallback;
}
function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: keep going without it */ }
}
const isCount = v => Number.isInteger(v) && v >= 0 && v < 1e7;

const settings = readJSON(localStorage, SETTINGS_KEY, {}, () => true);
if (!SCENARIOS[settings.scenario]) settings.scenario = 'standard';
if (settings.control !== 'mouse') settings.control = 'keyboard';
if (settings.touchControl !== 'tilt') settings.touchControl = 'stick';
settings.invert = settings.invert === true;
settings.assist = settings.assist !== false;
const saveSettings = () => writeJSON(localStorage, SETTINGS_KEY, settings);

const session = readJSON(sessionStorage, SESSION_KEY, { attempts: 0, landings: 0 },
    v => isCount(v.attempts) && isCount(v.landings) && v.landings <= v.attempts);
const record = readJSON(localStorage, RECORD_KEY, { landings: 0 }, v => isCount(v.landings));

/* ---------- State ---------- */

const app = {
    mode: 'setup',      // setup | running | paused | finished | error
    assist: settings.assist,
    camera: 'chase',
    cameraChoice: 'chase',  // the player's choice; the result views override it until the next flight
    throttle: 0,
    gear: false,
    clock: 0,
    flash: null,        // { text, level, until }: a message that outranks the running advice
    finishedAt: 0,
    outcome: null,      // { success, gr, award } once a flight ends
};
let state;
let acc = 0, last = performance.now(), dirty = true, snap = true;
let lastDash = 0, lastAdvice = 0, lastPhase = '';
let override = null;    // for automated checks: a function supplying the inputs instead of the player
let timeScale = 1;      // for automated checks: run the flight faster than real time
let exported = null;    // { blob, url } of the current result card

const hud = createHud(view);
const dash = createDash($('ld-dash'));
const input = createInput(game, view, {
    onAction: action,
    enabled: what => {
        if (what === 'pause') return app.mode === 'running' || app.mode === 'paused';
        if (what === 'assist' || what === 'camera') return app.mode !== 'error';
        return app.mode === 'running';
    },
});

const touch = () => game.dataset.touch !== undefined;

function newFlight() {
    state = createState(settings.scenario);
    app.throttle = state.throttle;
    app.gear = state.gear;
    app.camera = app.cameraChoice;
    app.flash = null;
    app.outcome = null;
    acc = 0;
    lastPhase = '';
    snap = true;
    dirty = true;
}

/* ---------- Controls ---------- */

function overlay(which) {
    for (const name of ['setup', 'paused', 'result', 'failed']) ui[name].hidden = name !== which;
}

function syncControls() {
    const m = app.mode;
    ui.pause.textContent = m === 'setup' ? 'Start' : m === 'paused' ? 'Resume' : 'Pause';
    ui.pause.disabled = !(m === 'setup' || m === 'running' || m === 'paused');
    ui.restart.disabled = m === 'setup' || m === 'error';
    ui.assist.textContent = `Flight Assist: ${app.assist ? 'On' : 'Off'}`;
    ui.assist.setAttribute('aria-pressed', String(app.assist));
    ui.camera.textContent = `Camera: ${app.camera === 'wide' ? 'Wide' : 'Chase'}`;
    game.dataset.mode = m;
    game.dataset.control = touch() ? settings.touchControl : settings.control;
    game.querySelectorAll('[data-control-option]').forEach(b => {
        b.setAttribute('aria-checked', String(b.dataset.controlOption === (touch() ? settings.touchControl : settings.control)));
    });
    game.querySelectorAll('input[name="ld-scenario"]').forEach(r => { r.checked = r.value === settings.scenario; });
    $('ld-invert').checked = settings.invert;
    $('ld-assist-check').checked = app.assist;
    ui.gearBtn.setAttribute('aria-pressed', String(app.gear));
    ui.gearBtn.querySelector('small').textContent = app.gear ? 'down' : 'up';
    game.querySelector('.ld-stick-top').textContent = settings.invert ? 'NOSE ▲' : 'NOSE ▼';
    game.querySelector('.ld-stick-bottom').textContent = settings.invert ? 'NOSE ▼' : 'NOSE ▲';
    ui.calibrate.hidden = !(touch() && settings.touchControl === 'tilt' && input.tiltOn);
    game.querySelector('.ld-stick').classList.toggle('tilt', touch() && settings.touchControl === 'tilt' && input.tiltOn);
    // The site's floating menu button would sit on top of the touch controls
    document.body.classList.toggle('ld-touch-flying', m === 'running' && touch());
    input.set({ control: touch() ? 'touch' : settings.control, invert: settings.invert });
}

function applyTouch() {
    if (input.coarse) game.dataset.touch = '';
    else delete game.dataset.touch;
    syncControls();
}
input.coarseQuery.addEventListener('change', applyTouch);

function announce(text) { ui.live.textContent = text; }
function note(text) {
    ui.note.textContent = text;
    ui.note.hidden = !text;
}

function flash(text, level = 'info', secs = 3) {
    app.flash = { text, level, until: app.clock + secs };
    dirty = true;
}

async function begin() {
    if (touch() && settings.touchControl === 'tilt' && !input.tiltOn) await useTilt();
    if (input.tiltOn) input.calibrate();
    app.mode = 'running';
    overlay(null);
    last = performance.now();
    syncControls();
    view.focus({ preventScroll: true });
    if (touch() && !document.fullscreenElement) view.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

function pause(auto) {
    if (app.mode !== 'running') return;
    app.mode = 'paused';
    input.releaseAll();
    overlay('paused');
    ui.paused.querySelector('.ld-card-text').textContent = auto
        ? 'The game paused because the page lost focus.'
        : 'The aircraft holds its state until you resume.';
    syncControls();
    ui.paused.querySelector('[data-action="resume"]').focus({ preventScroll: true });
    dirty = true;
}

function togglePause() {
    if (app.mode === 'running') pause(false);
    else if (app.mode === 'paused') begin();
}

function restart() {
    newFlight();
    input.releaseAll();
    clearExport();
    begin();
    announce(`New attempt. ${SCENARIOS[settings.scenario].label} approach.`);
}

function toSetup() {
    newFlight();
    input.releaseAll();
    clearExport();
    app.mode = 'setup';
    overlay('setup');
    syncControls();
    ui.start.focus({ preventScroll: true });
}

function setAssist(on) {
    app.assist = on;
    settings.assist = on;
    saveSettings();
    syncControls();
    if (app.mode === 'running') {
        flash(on ? 'Flight Assist on: attitude holds when you let go, bank and pitch are limited, and the approach gates show.'
            : 'Flight Assist off: direct control. Nothing holds the attitude for you now.', on ? 'info' : 'warn', 4);
    }
    dirty = true;
}

function setCamera(next) {
    app.camera = next || (app.camera === 'wide' ? 'chase' : 'wide');
    app.cameraChoice = app.camera;
    syncControls();
    dirty = true;
}

function setGear(down) {
    app.gear = down;
    syncControls();
    announce(`Landing gear ${down ? 'down' : 'up'}.`);
}

async function useTilt() {
    note('');
    const res = await input.enableTilt();
    if (res.ok) {
        settings.touchControl = 'tilt';
        saveSettings();
        input.calibrate();
        note('Tilt controls on. Hold the device how you want to fly and press Calibrate to set that as level.');
    } else {
        settings.touchControl = 'stick';
        saveSettings();
        note(res.why === 'denied'
            ? 'Motion access was not allowed, so the on-screen stick is in use. You can allow it in your browser settings and try Tilt again.'
            : "This device or browser doesn't provide tilt data, so the on-screen stick is in use.");
    }
    syncControls();
}

function setControl(mode) {
    if (touch()) {
        if (mode === 'tilt') { useTilt(); return; }
        input.disableTilt();
        settings.touchControl = 'stick';
        note('');
    } else {
        settings.control = mode === 'mouse' ? 'mouse' : 'keyboard';
        note(settings.control === 'mouse'
            ? 'Mouse steering: move the pointer away from the centre of the view to turn; the wheel sets the throttle. The keys still work.'
            : '');
    }
    saveSettings();
    syncControls();
}

function action(name, value) {
    if (name === 'pause') return togglePause();
    if (name === 'assist') return setAssist(!app.assist);
    if (name === 'camera') return setCamera();
    if (name === 'mouse') return setControl(settings.control === 'mouse' ? 'keyboard' : 'mouse');
    if (app.mode !== 'running') return;
    if (name === 'gear') setGear(!app.gear);
    else if (name === 'idle') app.throttle = 0;
    else if (name === 'full') app.throttle = 1;
    else if (name === 'wheelup') app.throttle = Math.min(1, app.throttle + 0.05);
    else if (name === 'wheeldown') app.throttle = Math.max(0, app.throttle - 0.05);
    else if (name === 'throttle') app.throttle = value;
}

ui.start.addEventListener('click', () => { newFlight(); begin(); announce(`${SCENARIOS[settings.scenario].label} approach. Good luck.`); });
ui.pause.addEventListener('click', () => {
    if (app.mode === 'setup') ui.start.click();
    else togglePause();
});
ui.restart.addEventListener('click', restart);
// While flying, toolbar buttons hand the keyboard straight back to the view (so Space still pauses)
const refocus = () => { if (app.mode === 'running') view.focus({ preventScroll: true }); };
ui.assist.addEventListener('click', () => { setAssist(!app.assist); refocus(); });
ui.camera.addEventListener('click', () => { setCamera(); refocus(); });
ui.camBtn.addEventListener('click', () => setCamera());
ui.gearBtn.addEventListener('click', () => { if (app.mode === 'running') setGear(!app.gear); });
ui.calibrate.addEventListener('click', () => { input.calibrate(); flash('Calibrated: this is level now.', 'ok', 2); });
game.querySelectorAll('[data-action="resume"]').forEach(b => b.addEventListener('click', begin));
game.querySelectorAll('[data-action="restart"]').forEach(b => b.addEventListener('click', restart));
game.querySelectorAll('[data-action="setup"]').forEach(b => b.addEventListener('click', toSetup));
game.querySelectorAll('[data-control-option]').forEach(b => b.addEventListener('click', () => { setControl(b.dataset.controlOption); refocus(); }));
game.querySelectorAll('input[name="ld-scenario"]').forEach(r => r.addEventListener('change', () => {
    settings.scenario = r.value;
    saveSettings();
    if (app.mode === 'setup') newFlight();
}));
$('ld-invert').addEventListener('change', e => { settings.invert = e.target.checked; saveSettings(); syncControls(); });
$('ld-assist-check').addEventListener('change', e => setAssist(e.target.checked));

window.addEventListener('blur', () => { input.releaseAll(); if (app.mode === 'running') pause(true); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { input.releaseAll(); if (app.mode === 'running') pause(true); }
});
// Moving into a text box or dialog elsewhere on the page (site search, say) pauses the flight
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
    if (app.mode === 'running') view.focus({ preventScroll: true });
});

// The scene follows the site theme: daylight in light mode, dusk with the runway lights on in dark mode
const theme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dusk' : 'day';
new MutationObserver(() => { world.setTheme(theme()); dirty = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
world.setTheme(theme());

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Guidance ---------- */

function advise(tm) {
    if (app.flash && app.clock < app.flash.until) return app.flash;
    const k = touch()
        ? { gear: 'tap GEAR', brake: 'hold BRAKE', idle: 'slide the throttle to 0', steer: 'the stick or the rudder buttons', down: 'push the stick up' }
        : { gear: 'press G', brake: 'hold B', idle: 'press X for idle', steer: 'A and D', down: settings.invert ? 'press S' : 'press W' };
    if (tm.mode === 'done') return { text: '', level: 'info' };
    if (tm.mode === 'ground') {
        if (Math.abs(tm.x) > 8) return { text: `Steer back to the centreline with ${k.steer}: you're ${Math.abs(tm.x).toFixed(0)} m ${tm.x < 0 ? 'left' : 'right'}.`, level: 'warn' };
        if (app.throttle > 0.15) return { text: `Throttle to idle: ${k.idle}.`, level: 'warn' };
        if (tm.brake < 0.3) return { text: `Brake to a stop: ${k.brake}.`, level: 'warn' };
        return { text: 'Rolling out. Keep it on the centreline until you stop.', level: 'ok' };
    }
    if (tm.stall) return { text: 'Stall warning: lower the nose and add throttle.', level: 'alert' };
    if (!tm.gearDown && !tm.gearMoving && (tm.distance < 4500 || tm.alt < 250)) return { text: `Lower the landing gear: ${k.gear}.`, level: tm.distance < GLIDE.final ? 'alert' : 'warn' };
    const nearRunway = tm.along > -400;
    if (tm.alt < 15 && nearRunway) {
        if (Math.abs(tm.bank) > 5) return { text: 'Level the wings for touchdown.', level: 'warn' };
        if (app.throttle > 0.15) return { text: `Flare: raise the nose gently, and ${k.idle}.`, level: 'warn' };
        if (-tm.vs > 2) return { text: 'Flare: raise the nose gently to slow the descent.', level: 'warn' };
        return { text: 'Hold it off gently and let it settle onto the runway.', level: 'ok' };
    }
    if (Math.abs(tm.x) > 40) {
        const side = tm.x < 0 ? 'left' : 'right';
        const vx = tm.groundSpeed * Math.sin(tm.track * Math.PI / 180);
        const closing = vx * Math.sign(-tm.x);
        if (closing > Math.abs(tm.x) / 12) return { text: `Turning in: roll out as you near the centreline (${Math.round(Math.abs(tm.x))} m ${side}).`, level: 'info' };
        return { text: `The runway centreline is ${Math.round(Math.abs(tm.x))} m to your ${side === 'left' ? 'right' : 'left'}: bank ${side === 'left' ? 'right' : 'left'} gently to turn toward it.`, level: 'info' };
    }
    if (tm.airspeed > 88 && tm.distance < 4000) return { text: 'Fast: reduce the throttle to slow toward 70 m/s.', level: 'warn' };
    if (tm.glideDev > 25) return { text: `High: ${Math.round(tm.glideDev)} m above the glide path. Lower the nose a little and reduce throttle.`, level: 'warn' };
    if (tm.glideDev < -20) return { text: `Low: ${Math.round(-tm.glideDev)} m below the glide path. Raise the nose a little and add throttle.`, level: 'warn' };
    if (tm.airspeed < 58) return { text: 'Slow: add throttle.', level: 'warn' };
    if (Math.abs(tm.heading) > 8 && tm.distance < 2500) return { text: 'Line the nose up with the runway.', level: 'info' };
    return { text: 'On the approach. Keep the centreline under the nose and the PAPI lights two white, two red.', level: 'ok' };
}

/* ---------- Results ---------- */

const siteUrl = () => {
    const { protocol, hostname, origin, pathname } = location;
    if (!/^https?:$/.test(protocol) || /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(hostname)) return null;
    return origin + pathname;
};

function clearExport() {
    if (exported) URL.revokeObjectURL(exported.url);
    exported = null;
    const img = $('ld-card-img');
    img.removeAttribute('src');
    $('ld-save').removeAttribute('href');
    $('ld-share-status').textContent = '';
}

function row(dl, label, value, cls) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (cls) dd.className = cls;
    div.append(dt, dd);
    dl.appendChild(div);
}

const fmtRate = () => session.attempts ? `${Math.round(session.landings / session.attempts * 100)}% (${session.landings} of ${session.attempts})` : '—';

function finishFlight(r) {
    session.attempts++;
    let first = false;
    if (r.success) {
        session.landings++;
        first = record.landings === 0;
        record.landings++;
        writeJSON(localStorage, RECORD_KEY, record);
    }
    writeJSON(sessionStorage, SESSION_KEY, session);
    const gr = grade(r);
    const aw = awardsFor(r, gr, { first });
    app.outcome = { success: r.success, gr, award: aw.main, others: aw.others, attempt: session.attempts };
    app.mode = 'finished';
    app.finishedAt = app.clock;
    app.camera = r.success && !reduceMotion.matches ? 'orbit' : 'wide';
    input.releaseAll();
    syncControls();
    announce(r.success ? `Landing successful. Grade ${gr.letter}. ${aw.main.name}.` : `Landing failed: ${r.fail.title.toLowerCase()}. ${r.fail.text}`);
    setTimeout(() => {
        if (app.mode !== 'finished' || app.outcome === null) return;
        if (r.success) showSuccess(r); else showFailure(r);
    }, r.success ? 1600 : 1100);
}

function showSuccess(r) {
    const o = app.outcome, gr = o.gr;
    const card = ui.result;
    card.querySelector('.ld-grade').textContent = gr.letter;
    card.querySelector('.ld-grade').style.setProperty('--grade', GRADE_COLORS[gr.letter]);
    card.querySelector('.ld-grade-word').textContent = `${GRADE_WORDS[gr.letter]} · ${gr.score}/100`;
    card.querySelector('.ld-award-name').textContent = o.award.name;
    card.querySelector('.ld-award-text').textContent = o.award.text;
    card.querySelector('.ld-award-also').textContent = o.others.length ? `Also earned: ${o.others.map(a => a.name).join(', ')}` : '';
    card.querySelector('.ld-landing-type').textContent = r.assistUsed ? 'Assisted landing' : 'Manual landing';
    // Why this grade: each category with its value and rating
    const why = card.querySelector('.ld-why');
    why.replaceChildren();
    for (const rw of gr.rows) {
        const li = document.createElement('li');
        li.dataset.level = String(rw.level);
        const name = document.createElement('span');
        name.className = 'ld-why-name';
        name.textContent = rw.label;
        const val = document.createElement('span');
        val.className = 'ld-why-value';
        val.textContent = rw.value;
        const rating = document.createElement('span');
        rating.className = 'ld-why-rating';
        rating.textContent = rw.rating;
        li.append(name, val, rating);
        li.title = rw.detail;
        why.appendChild(li);
    }
    card.querySelector('.ld-why-note').textContent = gr.lost.length
        ? `Most points lost on ${gr.lost.slice(0, 2).map(x => `${x.label.toLowerCase()} (${x.rating.toLowerCase()})`).join(' and ')}.`
        : 'Excellent in every category.';
    const td = r.touchdown;
    const dl = card.querySelector('.ld-stats');
    dl.replaceChildren();
    row(dl, 'Landing rate (this visit)', fmtRate());
    row(dl, 'Attempt', `#${o.attempt}`);
    row(dl, 'Centerline at touchdown', `${Math.abs(td.x).toFixed(1)} m ${td.x < 0 ? 'left' : td.x > 0 ? 'right' : ''}`.trim());
    row(dl, 'Vertical speed at touchdown', `${td.vs >= 0 ? '+' : '−'}${Math.abs(td.vs).toFixed(2)} m/s`);
    row(dl, 'Touchdown speed', `${td.gs.toFixed(1)} m/s ground · ${td.airspeed.toFixed(1)} m/s air`);
    row(dl, 'Heading off the runway', `${Math.abs(td.heading).toFixed(1)}°`);
    row(dl, 'Bank angle', `${Math.abs(td.bank).toFixed(1)}°`);
    row(dl, 'Pitch attitude', `${td.pitch.toFixed(1)}° nose up`);
    row(dl, 'Touched down', `${Math.round(td.s)} m past the threshold`);
    row(dl, 'Runway used', `${Math.round(r.stopAt)} m (rollout ${Math.round(r.rollout)} m)`);
    row(dl, 'Runway remaining', `${Math.round(r.remaining)} m of ${RUNWAY.length}`);
    row(dl, 'Approach stability', r.stability == null ? 'n/a' : `${r.stability}/100`);
    row(dl, 'Flight Assist', r.assistUsed ? 'Used' : 'Off throughout');
    if (r.bounces) row(dl, 'Bounces', String(r.bounces));
    row(dl, 'Scenario', SCENARIOS[r.scenario].label);
    row(dl, 'Flight time', `${Math.floor(r.time / 60)} min ${String(Math.round(r.time % 60)).padStart(2, '0')} s`);
    overlay('result');
    card.scrollTop = 0;
    renderCard(r);
    card.querySelector('[data-action="restart"]').focus({ preventScroll: true });
}

function showFailure(r) {
    const card = ui.failed;
    card.querySelector('.ld-fail-title').textContent = r.fail.title;
    card.querySelector('.ld-card-text').textContent = r.fail.text;
    const dl = card.querySelector('.ld-stats');
    dl.replaceChildren();
    const td = r.touchdown;
    if (td) {
        row(dl, 'Vertical speed at touchdown', `${td.vs >= 0 ? '+' : '−'}${Math.abs(td.vs).toFixed(2)} m/s`, Math.abs(td.vs) > LIMITS.hardSink ? 'bad' : '');
        row(dl, 'Touchdown speed', `${td.gs.toFixed(1)} m/s`, td.gs > LIMITS.tyreSpeed ? 'bad' : '');
        row(dl, 'Centerline at touchdown', `${Math.abs(td.x).toFixed(1)} m`, Math.abs(td.x) > RUNWAY.width / 2 ? 'bad' : '');
        row(dl, 'Heading off the runway', `${Math.abs(td.heading).toFixed(1)}° (moving ${Math.abs(td.drift).toFixed(1)}° sideways)`, Math.abs(td.drift) > LIMITS.sideways ? 'bad' : '');
        row(dl, 'Bank angle', `${Math.abs(td.bank).toFixed(1)}°`);
    }
    row(dl, 'Landing rate (this visit)', fmtRate());
    row(dl, 'Attempt', `#${app.outcome.attempt}`);
    row(dl, 'Flight Assist', r.assistUsed || app.assist ? 'On' : 'Off');
    overlay('failed');
    card.querySelector('[data-action="restart"]').focus({ preventScroll: true });
}

async function renderCard(r) {
    const o = app.outcome;
    const status = $('ld-share-status');
    status.textContent = 'Creating your landing card…';
    try {
        const url = siteUrl();
        const canvas = drawCard(r, o.gr, o.award, {
            attempt: o.attempt,
            date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
            url: url ? url.replace(/^https?:\/\//, '') : null,
        });
        const blob = await cardBlob(canvas);
        if (app.outcome !== o) return;
        exported = { blob, url: URL.createObjectURL(blob) };
        $('ld-card-img').src = exported.url;
        $('ld-save').href = exported.url;
        status.textContent = '';
    } catch (err) {
        status.textContent = "Couldn't create the landing card image. You can still copy the result as text.";
    }
}

const resultText = () => {
    const r = state.result, o = app.outcome;
    return shareText(r, o.gr, o.award, siteUrl());
};

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Older browsers, or no clipboard permission: select a hidden copy and use the copy command
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
        return ok;
    }
}

let sharing = false;
$('ld-share').addEventListener('click', async () => {
    if (sharing || !app.outcome || !state.result) return;
    const status = $('ld-share-status');
    const text = resultText();
    const title = 'WSA SSTO Landing';
    const url = siteUrl();
    sharing = true;
    try {
        const file = exported ? new File([exported.blob], CARD.file, { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text });
            status.textContent = 'Shared.';
        } else if (navigator.share) {
            await navigator.share(url ? { title, text, url } : { title, text });
            status.textContent = "Shared as text: this browser can't attach the image. Use Save image to keep the card.";
        } else if (await copyText(text)) {
            status.textContent = "Sharing isn't available in this browser, so the result was copied as text instead. Use Save image for the card.";
        } else {
            status.textContent = "Sharing isn't available in this browser. Use Save image, or Copy result.";
        }
    } catch (err) {
        status.textContent = err && err.name === 'AbortError' ? 'Share cancelled.' : "Couldn't open sharing. Use Save image or Copy result instead.";
    } finally {
        sharing = false;
    }
});
$('ld-copy').addEventListener('click', async () => {
    if (!app.outcome || !state.result) return;
    $('ld-share-status').textContent = await copyText(resultText()) ? 'Result copied.' : "Couldn't copy here. Select the result text from the summary instead.";
});
$('ld-save').addEventListener('click', e => {
    if (!exported) {
        e.preventDefault();
        $('ld-share-status').textContent = 'The image is still being created. Try again in a moment.';
    }
});
window.addEventListener('pagehide', () => { if (exported) URL.revokeObjectURL(exported.url); });

/* ---------- Frame loop ---------- */

function resize() {
    const r = view.getBoundingClientRect();
    world.resize(r.width, r.height);
    hud.resize(r.width, r.height);
    dirty = true;
}
new ResizeObserver(resize).observe(view);
resize();

function handle(ev) {
    if (ev.type === 'touchdown') {
        const sink = ev.sink;
        flash(`Touchdown at ${sink.toFixed(1)} m/s. ${app.throttle > 0.15 ? 'Throttle to idle and brake.' : 'Brake to a stop.'}`, sink < 1.5 ? 'ok' : 'warn', 3);
        announce('Touchdown.');
    } else if (ev.type === 'bounce') {
        flash('Bounced! Hold the attitude and let it settle again.', 'warn', 3);
    } else if (ev.type === 'goaround') {
        flash('Touch and go: you climbed away. Come around and land again.', 'info', 5);
    } else if (ev.type === 'landed' || ev.type === 'failed') {
        finishFlight(state.result);
    }
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const stick = input.read(dt);
    if (app.mode === 'running') {
        app.throttle = Math.min(1, Math.max(0, app.throttle + stick.throttleRate * 0.5 * dt));
        let inp = { pitch: stick.pitch, roll: stick.roll, yaw: stick.yaw, throttle: app.throttle, brake: stick.brake, gear: app.gear };
        if (override) {
            const o = override(telemetry(state, SCENARIOS[state.scenario].wind), STEP);
            inp = { ...inp, ...o };
            app.throttle = inp.throttle;
            if (inp.gear !== app.gear) { app.gear = inp.gear; syncControls(); }
        }
        acc += dt * timeScale;
        while (acc >= STEP) {
            const ev = step(state, inp, STEP, { assist: app.assist });
            acc -= STEP;
            if (ev) handle(ev);
            if (app.mode !== 'running') { acc = 0; break; }
        }
    }
    const animate = app.mode === 'running' || app.mode === 'finished';
    if (!animate && !dirty) return;
    if (animate) app.clock += dt;
    dirty = false;

    const tm = telemetry(state, SCENARIOS[state.scenario].wind);
    world.update({
        pos: state.pos, q: state.q, vel: state.vel, gearPos: state.gearPos, thrust: state.thrust / 62000,
        camera: app.camera, time: app.clock, dt: animate ? dt : 0, snap, gates: app.assist && app.mode !== 'finished',
    });
    snap = false;
    world.render();
    const mouseOn = !touch() && settings.control === 'mouse';
    hud.draw(tm, {
        assist: app.assist, throttle: app.throttle, project: p => world.project(p), pos: state.pos, vel: state.vel,
        running: app.mode === 'running', mouse: mouseOn ? input.mouseState() : null,
    });
    if (tm.phase !== lastPhase) {
        if (lastPhase && app.mode === 'running' && tm.phase !== 'LANDED' && tm.phase !== 'FAILED') announce(`${tm.phase.toLowerCase()}.`);
        lastPhase = tm.phase;
    }
    if (now - lastAdvice > 250 || !animate) { hud.advise(app.mode === 'running' ? advise(tm) : { text: '', level: 'info' }); lastAdvice = now; }
    if (now - lastDash > 66 || !animate) {
        dash.update(tm, { throttle: app.throttle, session: { ...session, attempt: session.attempts + (app.mode === 'finished' ? 0 : 1) }, scenario: SCENARIOS[state.scenario].label });
        lastDash = now;
    }
}

newFlight();
applyTouch();
overlay('setup');
requestAnimationFrame(frame);

// For automated checks: read access to the live flight, and a way to supply the inputs
window.__sstoLanding = {
    get state() { return state; },
    get app() { return app; },
    telemetry: () => telemetry(state, SCENARIOS[state.scenario].wind),
    setOverride(fn) { override = typeof fn === 'function' ? fn : null; },
    setTimeScale(k) { timeScale = Math.min(Math.max(Number(k) || 1, 0.25), 8); },
    project: p => world.project(p),
    LEVELS,
};
