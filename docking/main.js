// Docking Simulator (docking-simulator.html): wires the physics, the 3D world, the HUD and the page's
// controls together. The simulation runs at a fixed 120 Hz step whatever the display's frame rate.
import { createState, step, telemetry, DOCKING } from './physics.js';
import { advise } from './guidance.js';
import { createHud, createDashboard } from './hud.js';

const STEP = 1 / 120;
const MAX_FRAME = 0.1;   // s: a longer pause between frames (a background tab) doesn't fast-forward

const $ = id => document.getElementById(id);
const sim = $('sim');
const view = $('sim-view');
const ui = {
    canvas: $('sim-canvas'), hud: $('sim-hud'), phase: $('sim-phase'), advice: $('sim-advice'),
    range: $('hud-range'), closing: $('hud-closing'), limit: $('hud-limit'), assistChip: $('hud-assist'), fineChip: $('hud-fine'),
    intro: $('sim-intro'), paused: $('sim-paused'), result: $('sim-result'), error: $('sim-error'),
    start: $('sim-start'), pause: $('sim-pause'), restart: $('sim-restart'), assist: $('sim-assist'), fullscreen: $('sim-fullscreen'),
    live: $('sim-live'), loading: $('sim-loading'),
};

function showError(title, text) {
    ui.loading.hidden = true;
    ui.intro.hidden = true;
    ui.error.hidden = false;
    ui.error.querySelector('.sim-card-title').textContent = title;
    ui.error.querySelector('.sim-card-text').textContent = text;
    [ui.pause, ui.restart, ui.assist].forEach(b => { b.disabled = true; });
}

// three.js is loaded with the world module; if it can't load, say so instead of leaving a blank view
let createWorld;
try {
    ({ createWorld } = await import('./world.js'));
} catch (err) {
    showError('The 3D engine could not load', 'The simulator needs its 3D library (three.js), which did not load. Check your connection and reload the page.');
    throw err;
}
let world;
try {
    world = createWorld(ui.canvas);
} catch (err) {
    showError('3D graphics are unavailable', 'This browser or device could not start WebGL, which the simulator needs. Try another browser, or turn on hardware acceleration.');
    throw err;
}
ui.loading.hidden = true;
ui.canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    showError('The 3D view stopped', 'The graphics context was lost (this can happen when a device is busy or wakes from sleep). Reload the page to fly again.');
    app.mode = 'error';
});

const hud = createHud(ui.hud);
const dash = createDashboard($('sim-dash'));

/* ---------- State ---------- */

const app = {
    mode: 'intro',      // intro | running | paused | docked | ended | error
    assist: true,
    view: 'cockpit',
    clock: 0,           // seconds of animation, for lights and the outro orbit
    flash: null,        // { text, level, until } a message that outranks the running advice (until: app clock)
    dockedAt: 0,
};
let state = createState();
let acc = 0;
let last = performance.now();
let dirty = true;
let lastDash = 0, lastAdvice = 0, lastPhase = '';

/* ---------- Input ---------- */

const KEYS = {
    i: ['trans', 1, 1], k: ['trans', 1, -1], j: ['trans', 0, -1], l: ['trans', 0, 1], h: ['trans', 2, -1], n: ['trans', 2, 1],
    w: ['rot', 0, 1], s: ['rot', 0, -1], a: ['rot', 1, 1], d: ['rot', 1, -1], q: ['rot', 2, 1], e: ['rot', 2, -1],
};
const pressed = new Set();      // keyboard
const touched = new Set();      // on-screen key caps
let fine = false;

function currentInput() {
    const input = { trans: [0, 0, 0], rot: [0, 0, 0], fine, assist: app.assist };
    for (const k of new Set([...pressed, ...touched])) {
        const [group, axis, dir] = KEYS[k];
        input[group][axis] += dir;
    }
    return input;
}

function releaseAll() {
    pressed.clear();
    touched.clear();
    fine = false;
}

const editable = t => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog');
// Game keys only count while the simulator is the thing being used
const forSim = e => !e.ctrlKey && !e.metaKey && !e.altKey && !editable(e.target) &&
    (e.target === document.body || e.target === document.documentElement || sim.contains(e.target)) && !document.querySelector('dialog[open]');

window.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'Shift') fine = true;
    if (!forSim(e)) return;
    if ((key === 'p' || key === 'Escape') && (app.mode === 'running' || app.mode === 'paused')) {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
    }
    if (app.mode !== 'running') return;
    if (key === 'f') {
        e.preventDefault();
        if (!e.repeat) setAssist(!app.assist);
        return;
    }
    if (KEYS[key]) {
        e.preventDefault();
        pressed.add(key);
    }
});
window.addEventListener('keyup', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'Shift') fine = false;
    if (KEYS[key]) pressed.delete(key);
});
window.addEventListener('blur', () => {
    releaseAll();
    if (app.mode === 'running') pause(true);
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        releaseAll();
        if (app.mode === 'running') pause(true);
    }
});
// Moving into a text box or dialog elsewhere on the page (site search, say) pauses the flight
document.addEventListener('focusin', e => {
    if (app.mode === 'running' && !sim.contains(e.target) && editable(e.target)) pause(true);
});

// The key caps double as touch (and mouse) controls
sim.querySelectorAll('.sim-key[data-key]').forEach(button => {
    const key = button.dataset.key;
    const down = e => {
        if (app.mode !== 'running') return;
        e.preventDefault();
        touched.add(key);
        // Keep the key held while a finger slides a little off it
        try { button.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    };
    const up = () => touched.delete(key);
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', e => e.preventDefault());
});

/* ---------- Controls ---------- */

function overlay(which) {
    for (const name of ['intro', 'paused', 'result']) ui[name].hidden = name !== which;
}

function syncControls() {
    const m = app.mode;
    ui.pause.textContent = m === 'intro' ? 'Start' : m === 'paused' ? 'Resume' : 'Pause';
    ui.pause.disabled = !(m === 'intro' || m === 'running' || m === 'paused');
    ui.restart.disabled = m === 'intro' || m === 'error';
    ui.assist.disabled = m === 'error';
    ui.assist.textContent = `Flight Assist: ${app.assist ? 'On' : 'Off'}`;
    ui.assist.setAttribute('aria-pressed', String(app.assist));
    sim.dataset.mode = m;
}

function announce(text) {
    ui.live.textContent = text;
}

function begin() {
    app.mode = 'running';
    overlay(null);
    last = performance.now();
    syncControls();
    view.focus({ preventScroll: true });
}

function pause(auto) {
    if (app.mode !== 'running') return;
    app.mode = 'paused';
    releaseAll();
    overlay('paused');
    ui.paused.querySelector('.sim-card-text').textContent = auto
        ? 'The simulator paused because the page lost focus.'
        : 'The spacecraft holds its state until you resume.';
    syncControls();
    dirty = true;
}

function togglePause() {
    if (app.mode === 'running') pause(false);
    else if (app.mode === 'paused') begin();
}

function restart() {
    state = createState();
    acc = 0;
    releaseAll();
    app.flash = null;
    app.view = 'cockpit';
    lastPhase = '';
    world.clearPuffs();
    begin();
    announce('Simulation restarted. Approach the station.');
    dirty = true;
}

function setAssist(on) {
    app.assist = on;
    syncControls();
    app.flash = { text: `Flight Assist ${on ? 'on: rotation and sideways drift are damped gently' : 'off: nothing damps your motion now'}.`, level: on ? 'info' : 'warn', until: app.clock + 3 };
    dirty = true;
}

ui.start.addEventListener('click', begin);
ui.pause.addEventListener('click', () => {
    if (app.mode === 'intro') begin();
    else togglePause();
});
sim.querySelectorAll('[data-action="resume"]').forEach(b => b.addEventListener('click', begin));
sim.querySelectorAll('[data-action="restart"]').forEach(b => b.addEventListener('click', restart));
ui.restart.addEventListener('click', restart);
ui.assist.addEventListener('click', () => setAssist(!app.assist));

const canFullscreen = !!(sim.requestFullscreen && document.fullscreenEnabled);
ui.fullscreen.hidden = !canFullscreen;
ui.fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else sim.requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
    ui.fullscreen.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    if (app.mode === 'running') view.focus({ preventScroll: true });
});

/* ---------- Results ---------- */

const fmtTime = t => `${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, '0')} s`;

function showResult(kind, r) {
    const card = ui.result;
    card.dataset.kind = kind;
    const title = { docked: 'DOCKING COMPLETE', collision: 'COLLISION', lost: 'CONTACT LOST' }[kind];
    const text = kind === 'docked' ? 'Soft capture, then hard dock. The spacecraft is secured to the station.'
        : kind === 'collision' ? `The spacecraft struck ${r.what} at ${r.speed.toFixed(2)} m/s.${r.misses ? ` At contact: ${r.misses.join('; ')}.` : ''}`
            : `The spacecraft drifted more than ${DOCKING.lostRange} m from the station.`;
    card.querySelector('.sim-card-title').textContent = title;
    card.querySelector('.sim-card-text').textContent = text;
    const rows = kind === 'docked'
        ? [['Elapsed time', fmtTime(r.time)], ['Closing speed at contact', `${r.closing.toFixed(3)} m/s`],
            ['Offset from the axis', `${r.radial.toFixed(3)} m`], ['Alignment error', `${r.angle.toFixed(2)}°`],
            ['Rotation rate', `${r.rate.toFixed(2)}°/s`], ['RCS Δv used', `${r.dv.toFixed(2)} m/s`], ['Failed contacts', String(r.failed)]]
        : [['Elapsed time', fmtTime(r.time)], ['RCS Δv used', `${r.dv.toFixed(2)} m/s`], ['Failed contacts', String(r.failed)]];
    card.querySelector('.sim-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    overlay('result');
    announce(`${title}. ${text}`);
    card.querySelector('[data-action="restart"]').focus({ preventScroll: true });
}

function handle(ev) {
    if (ev.type === 'capture') {
        app.flash = { text: 'Capture! Latching and pulling in…', level: 'ok', until: app.clock + 10 };
        announce('Capture. Latching.');
    } else if (ev.type === 'docked') {
        app.flash = null;
        app.mode = 'docked';
        app.view = 'external';
        app.dockedAt = app.clock;
        releaseAll();
        syncControls();
        setTimeout(() => { if (app.mode === 'docked') showResult('docked', state.result); }, 900);
    } else if (ev.type === 'bounce') {
        app.flash = { text: `Contact failed: ${ev.misses.join('; ')}. Back off with N and line up again.`, level: 'alert', until: app.clock + 6 };
        announce('Contact failed. Back off and line up again.');
    } else if (ev.type === 'bump') {
        app.flash = { text: `Bumped ${ev.what} at ${ev.speed.toFixed(2)} m/s. Back away and find the approach axis again.`, level: 'alert', until: app.clock + 6 };
        announce(`Bumped ${ev.what}.`);
    } else if (ev.type === 'collision' || ev.type === 'lost') {
        app.mode = 'ended';
        releaseAll();
        syncControls();
        showResult(ev.type, state.result);
    }
}

/* ---------- Frame loop ---------- */

function resize() {
    const r = view.getBoundingClientRect();
    world.resize(r.width, r.height);
    hud.resize(r.width, r.height);
    dirty = true;
}
new ResizeObserver(resize).observe(view);
resize();

const phaseLevel = { APPROACH: 'info', ALIGN: 'warn', 'FINAL APPROACH': 'ok', DOCKED: 'ok', COLLISION: 'alert', LOST: 'alert' };

function drawHudText(tm, input) {
    if (tm.phase !== lastPhase) {
        ui.phase.textContent = tm.phase;
        ui.phase.dataset.level = phaseLevel[tm.phase] || 'info';
        if (lastPhase && app.mode === 'running') announce(`Phase: ${tm.phase.toLowerCase()}.`);
        lastPhase = tm.phase;
    }
    ui.range.textContent = tm.range.toFixed(tm.range < 10 ? 2 : 1);
    ui.closing.textContent = tm.closing.toFixed(2);
    ui.closing.parentElement.dataset.level = tm.closing > tm.closingLimit * 1.5 && tm.closing > DOCKING.maxClosing + 0.1 ? 'alert'
        : tm.closing > tm.closingLimit ? 'warn' : 'ok';
    ui.limit.textContent = `guide ≤ ${tm.closingLimit.toFixed(2)}`;
    ui.assistChip.textContent = `FLT ASSIST ${app.assist ? 'ON' : 'OFF'}`;
    ui.assistChip.dataset.level = app.assist ? 'ok' : 'warn';
    ui.fineChip.hidden = !input.fine;
}

function drawAdvice(tm) {
    let msg;
    if (app.flash && app.clock < app.flash.until) msg = app.flash;
    else if (app.mode === 'docked' || state.mode === 'latching') msg = { text: 'Docked. Hard latches engaged.', level: 'ok' };
    else msg = advise(tm, { assist: app.assist });
    if (ui.advice.textContent !== msg.text) ui.advice.textContent = msg.text;
    ui.advice.dataset.level = msg.level;
}

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const input = currentInput();
    if (app.mode === 'running') {
        acc += dt;
        while (acc >= STEP) {
            const ev = step(state, input, STEP, world.colliders);
            acc -= STEP;
            if (ev) handle(ev);
            if (app.mode !== 'running') { acc = 0; break; }
        }
    }
    const animate = app.mode === 'running' || app.mode === 'docked';
    if (!animate && !dirty) return;
    if (animate) app.clock += dt;
    dirty = false;

    const tm = telemetry(state);
    world.update({
        mode: app.view, pos: state.pos, q: state.q, nose: tm.nose, vel: state.vel,
        braking: app.mode === 'running' && state.mode === 'flying' ? Math.max(input.trans[2], 0) : 0,
        time: app.mode === 'docked' ? app.clock - app.dockedAt : app.clock, dt: animate ? dt : 0,
    });
    world.render();
    if (app.view === 'cockpit' && app.mode !== 'intro') hud.draw(tm, p => world.project(p));
    else hud.hide();
    drawHudText(tm, input);
    if (now - lastAdvice > 250 || !animate) { drawAdvice(tm); lastAdvice = now; }
    if (now - lastDash > 66 || !animate) {
        dash.update(tm, { assist: app.assist, fine: input.fine, pressed: new Set([...pressed, ...touched]), assistFiring: state.assistFiring });
        lastDash = now;
    }
}

syncControls();
overlay('intro');
requestAnimationFrame(frame);

// For automated checks: read-only access to the live simulation
window.__dockingSim = { get state() { return state; }, get app() { return app; }, telemetry: () => telemetry(state), project: p => world.project(p), DOCKING };
