// Aegis Landing Simulator (aegis-landing.html): ties the physics (physics.js), the controls (input.js), the
// 3D view (world.js), the judging (scoring.js) and the certificate (card.js) together. The simulation runs
// at a fixed 120 Hz step whatever the display's frame rate, so a replay of the same inputs is identical.
import { createState, step, telemetry, DIFFICULTY } from './physics.js';
import { evaluate, requirements, shareText } from './scoring.js';
import { drawCertificate, cardBlob, CERT } from './card.js';
import { createInput } from './input.js';

const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const STORE = { diff: 'wsa-aegis-difficulty', name: 'wsa-aegis-name', record: 'wsa-aegis-record' };
const DEG = 180 / Math.PI;
const $ = id => document.getElementById(id);
const game = $('ag');
const view = $('ag-view');
const ui = {
    loading: $('ag-loading'), setup: $('ag-setup'), paused: $('ag-paused'), result: $('ag-result'), help: $('ag-help'), error: $('ag-error'),
    pause: $('ag-pause'), restart: $('ag-restart'), assist: $('ag-assist'), phase: $('ag-phase'), diff: $('ag-diff'), hold: $('ag-hold'), camChip: $('ag-cam-chip'),
    advice: $('ag-advice'), live: $('ag-live'), name: $('ag-name'), name2: $('ag-name2'), tilt: $('ag-tilt'), calibrate: $('ag-calibrate'),
};

const read = (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : v; } catch (e) { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: fine for this visit */ } };
const readRecord = () => { try { const v = JSON.parse(localStorage.getItem(STORE.record)); if (v && Number.isInteger(v.attempts) && v.attempts >= 0) return v; } catch (e) { /* ignore */ } return { attempts: 0, landings: 0 }; };

function showError(text) {
    for (const o of [ui.loading, ui.setup, ui.paused, ui.result]) o.hidden = true;
    ui.error.hidden = false;
    ui.error.querySelector('.ag-card-text').textContent = text;
    game.dataset.mode = 'error';
}

let createWorld, CAMERAS, CAMERA_NAMES;
try {
    ({ createWorld, CAMERAS, CAMERA_NAMES } = await import('./world.js'));
} catch (err) {
    showError('The game needs its 3D library (three.js), which did not load. Check your connection and reload the page.');
    throw err;
}
let world;
try {
    world = createWorld($('ag-canvas'), $('ag-labels'));
} catch (err) {
    showError('This browser or device could not start WebGL, which the game needs for its 3D view. Try another browser, or turn on hardware acceleration.');
    throw err;
}
$('ag-canvas').addEventListener('webglcontextlost', e => { e.preventDefault(); showError('The 3D view stopped (the graphics context was lost). Reload the page to fly again.'); });
ui.loading.hidden = true;

/* ---------- State ---------- */

const app = {
    mode: 'setup',          // setup | running | paused | finished | error
    diff: DIFFICULTY[read(STORE.diff, 'normal')] ? read(STORE.diff, 'normal') : 'normal',
    assist: true, assistUsed: false, throttle: 0, replaying: false, outcome: null, clock: 0,
};
let s = createState(app.diff);
let acc = 0, last = performance.now(), stepIndex = 0, lastHud = 0;
let record = null, replayIdx = 0, replayInput = null, lastRec = '';
let exported = null;
let override = null;        // for automated checks: a function supplying the inputs instead of the player
const logo = new Image();
logo.src = 'images/wsa-logo.png';
ui.name.value = ui.name2.value = read(STORE.name, '');

const input = createInput(game, {
    stickEl: $('ag-stick'), knobEl: $('ag-knob'), thrEl: $('ag-thr-slider'), thrUpEl: $('ag-thr-up'), thrDownEl: $('ag-thr-down'),
    onAction: action,
    enabled: what => {
        if (what === 'help' || what === 'camera' || what.startsWith('cam')) return app.mode !== 'error';
        if (what === 'pause') return app.mode === 'running' || app.mode === 'paused';
        if (what === 'restart') return app.mode !== 'setup' && app.mode !== 'error';
        return app.mode === 'running' && !app.replaying;
    },
});

/* ---------- Flow ---------- */

function overlay(which) {
    for (const n of ['setup', 'paused', 'result', 'help']) ui[n].hidden = n !== which;
}

function newFlight(diff = app.diff) {
    app.diff = diff;
    s = createState(diff);
    app.assist = DIFFICULTY[diff].assist;
    app.assistUsed = false;
    app.throttle = 0;
    app.outcome = null;
    app.replaying = false;
    acc = 0;
    stepIndex = 0;
    input.releaseAll();
    world.reset();
    showReqs();
    syncControls();
}

function start(diff) {
    newFlight(diff);
    record = { diff: app.diff, events: [] };
    lastRec = '';
    app.mode = 'running';
    overlay(null);
    view.focus({ preventScroll: true });
    last = performance.now();
    announce(`${DIFFICULTY[app.diff].label} descent. Altitude ${Math.round(s.pos[1])} metres.`);
    syncControls();
}

function replay() {
    if (!record) return;
    newFlight(record.diff);
    app.replaying = true;
    replayIdx = 0;
    replayInput = { pitch: 0, roll: 0, throttle: 0, assist: DIFFICULTY[record.diff].assist };
    app.mode = 'running';
    overlay(null);
    announce('Replay of your last descent.');
    syncControls();
}

function action(a) {
    if (a === 'help') { if (app.mode === 'running') pause(); ui.help.hidden = false; ui.help.querySelector('[data-action="closeHelp"]').focus({ preventScroll: true }); return; }
    if (a === 'camera') return setCamera(CAMERAS[(CAMERAS.indexOf(world.mode) + 1) % CAMERAS.length]);
    if (/^cam[1-4]$/.test(a)) return setCamera(CAMERAS[Number(a[3]) - 1]);
    if (a === 'pause') return app.mode === 'paused' ? resume() : pause();
    if (a === 'restart') return start(app.diff);
    if (a === 'touchstart') return;
    if (app.replaying) return;
    if (a === 'assist') {
        app.assist = !app.assist;
        announce(app.assist ? 'Attitude hold on.' : 'Attitude hold off.');
        syncControls();
    } else if (a === 'full') app.throttle = 1;
    else if (a === 'cut') app.throttle = 0;
}

function pause() {
    if (app.mode !== 'running') return;
    app.mode = 'paused';
    overlay('paused');
    input.releaseAll();
    syncControls();
    ui.paused.querySelector('[data-action="resume"]').focus({ preventScroll: true });
}
function resume() {
    if (app.mode !== 'paused') return;
    app.mode = 'running';
    overlay(null);
    last = performance.now();
    view.focus({ preventScroll: true });
    syncControls();
}

function setCamera(m) {
    world.setCamera(m);
    for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === m));
    ui.camChip.textContent = CAMERA_NAMES[m].toUpperCase();
}

function syncControls() {
    const m = app.mode;
    game.dataset.mode = app.replaying ? 'replay' : m;
    ui.pause.textContent = m === 'running' ? 'Pause' : m === 'paused' ? 'Resume' : m === 'finished' ? 'Fly again' : 'Start';
    ui.restart.disabled = m === 'setup';
    ui.assist.textContent = `Attitude hold: ${app.assist ? 'On' : 'Off'}`;
    ui.assist.setAttribute('aria-pressed', String(app.assist));
    ui.assist.disabled = app.replaying || m !== 'running';
    ui.hold.textContent = app.replaying ? 'REPLAY' : app.assist ? 'HOLD ON' : 'HOLD OFF';
    ui.hold.dataset.level = app.replaying ? 'info' : app.assist ? 'ok' : 'warn';
    $('ag-t-assist').setAttribute('aria-pressed', String(app.assist));
    ui.diff.textContent = DIFFICULTY[app.diff].label.toUpperCase();
}

/* ---------- Setup screen ---------- */

const radios = [...document.querySelectorAll('input[name="ag-diff"]')];
for (const r of radios) {
    r.nextElementSibling.querySelector('small').textContent = DIFFICULTY[r.value].blurb;
    r.checked = r.value === app.diff;
    r.addEventListener('change', () => { app.diff = r.value; write(STORE.diff, r.value); showReqs(); syncControls(); });
}
function showReqs() {
    const items = requirements(app.diff).map(q => `<li>${q.label}</li>`).join('');
    $('ag-reqs').innerHTML = items;
    $('ag-limits').innerHTML = `<li><b>${DIFFICULTY[app.diff].label}</b></li>${items}<li>Guidance: ${DIFFICULTY[app.diff].guide.impact ? 'impact marker' : 'pad marker only'}${DIFFICULTY[app.diff].guide.burnCue ? ', burn cue' : ''}</li>`;
}
$('ag-start').addEventListener('click', () => start(app.diff));
for (const el of [ui.name, ui.name2]) {
    el.addEventListener('input', () => {
        const v = el.value.slice(0, 32);
        (el === ui.name ? ui.name2 : ui.name).value = v;
        write(STORE.name, v);
        clearTimeout(el._t);
        el._t = setTimeout(() => { if (app.outcome && !app.replaying) renderCertificate(); }, 350);
    });
}

/* ---------- Finishing ---------- */

function finish() {
    const r = s.result;
    app.mode = 'finished';
    input.releaseAll();
    if (app.replaying) {
        app.replaying = false;
        syncControls();
        setTimeout(() => { if (app.mode === 'finished' && app.outcome) overlay('result'); }, 1500);
        return;
    }
    const rec = readRecord();
    const first = rec.attempts === 0;
    rec.attempts++;
    const e = evaluate(r, { first, assistUsed: app.assistUsed });
    if (e.success) rec.landings++;
    write(STORE.record, JSON.stringify(rec));
    app.outcome = { r, e, attempt: rec.attempts };
    syncControls();
    announce(`${e.outcome}. Score ${e.score} out of 100. ${e.award.name}.`);
    setTimeout(() => { if (app.mode === 'finished' && app.outcome && app.outcome.r === r) showResult(); }, 1500);
}

function showResult() {
    const { r, e } = app.outcome;
    const td = r.td;
    $('ag-result-outcome').textContent = e.outcome;
    $('ag-result-outcome').dataset.ok = e.success ? 'yes' : 'no';
    $('ag-score').textContent = e.score;
    $('ag-word').textContent = e.word;
    $('ag-headline').textContent = e.headline;
    $('ag-award-name').textContent = e.award.name;
    $('ag-award-text').textContent = e.award.text;
    $('ag-award-also').textContent = e.extras.length ? `Also earned: ${e.extras.join(', ')}` : '';
    $('ag-checks').innerHTML = e.checks.map(c => `<li data-ok="${c.ok ? 'yes' : 'no'}"><span>${c.label}</span><b>${c.value}</b></li>`).join('');
    $('ag-tips').innerHTML = e.tips.map(t => `<li>${t}</li>`).join('');
    const rows = [
        ['Difficulty', DIFFICULTY[r.diff].label], ['Distance from pad centre', `${td.dist.toFixed(1)} m`], ['Vertical speed at touchdown', `${td.vs.toFixed(2)} m/s`],
        ['Horizontal speed at touchdown', `${td.hs.toFixed(2)} m/s`], ['Lean at touchdown', `${(td.tilt * DEG).toFixed(1)}°`], ['Legs', td.legs ? 'down and locked' : 'not locked'],
        ['Propellant left', `${(td.prop / 1000).toFixed(2)} t (${Math.round(100 * td.prop / r.prop0)}%)${td.fuelOut ? ', tanks ran dry' : ''}`],
        ['Attitude hold', app.assistUsed ? 'used' : 'off the whole flight'], ['Flight time', `${td.t.toFixed(1)} s`], ['Attempt', `#${app.outcome.attempt}`],
    ];
    $('ag-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    overlay('result');
    ui.result.scrollTop = 0;
    renderCertificate();
    ui.result.querySelector('[data-action="restart"]').focus({ preventScroll: true });
}

const siteUrl = () => (/^https?:/.test(location.protocol) ? `${location.origin}${location.pathname}` : null);

async function renderCertificate() {
    const o = app.outcome;
    const status = $('ag-share-status');
    status.textContent = 'Creating your certificate…';
    try {
        if (!logo.complete) await new Promise(res => { logo.onload = logo.onerror = res; setTimeout(res, 1500); });
        const url = siteUrl();
        const canvas = drawCertificate(o.r, o.e, {
            name: ui.name2.value, attempt: o.attempt, logo,
            date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
            url: url ? url.replace(/^https?:\/\//, '') : null,
        });
        const blob = await cardBlob(canvas);
        if (app.outcome !== o) return;
        if (exported) URL.revokeObjectURL(exported.url);
        exported = { blob, url: URL.createObjectURL(blob) };
        $('ag-cert-img').src = exported.url;
        $('ag-save').href = exported.url;
        status.textContent = '';
    } catch (err) {
        status.textContent = "Couldn't create the certificate image here. You can still copy the result as text.";
    }
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
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
const resultText = () => shareText(app.outcome.r, app.outcome.e, { url: siteUrl() });
let sharing = false;
$('ag-share').addEventListener('click', async () => {
    if (sharing || !app.outcome) return;
    const status = $('ag-share-status');
    const text = resultText(), title = 'WSA Aegis Landing Simulator', url = siteUrl();
    sharing = true;
    try {
        const file = exported ? new File([exported.blob], CERT.file, { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text });
            status.textContent = 'Shared.';
        } else if (navigator.share) {
            await navigator.share(url ? { title, text, url } : { title, text });
            status.textContent = "Shared as text: this browser can't attach the image. Use Download certificate to keep it.";
        } else if (await copyText(text)) {
            status.textContent = "Sharing isn't available in this browser, so the result was copied as text instead.";
        } else {
            status.textContent = "Sharing isn't available in this browser. Use Download certificate, or Copy result.";
        }
    } catch (err) {
        status.textContent = err && err.name === 'AbortError' ? 'Share cancelled.' : "Couldn't open sharing. Use Download certificate or Copy result instead.";
    } finally {
        sharing = false;
    }
});
$('ag-copy').addEventListener('click', async () => {
    if (!app.outcome) return;
    $('ag-share-status').textContent = await copyText(resultText()) ? 'Result copied.' : "Couldn't copy here. Select the statistics text instead.";
});
$('ag-save').addEventListener('click', e => {
    if (!exported) { e.preventDefault(); $('ag-share-status').textContent = 'The certificate is still being created. Try again in a moment.'; }
});
window.addEventListener('pagehide', () => { if (exported) URL.revokeObjectURL(exported.url); });

/* ---------- Buttons ---------- */

game.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || !game.contains(b)) return;
    const a = b.dataset.action;
    if (a === 'resume') resume();
    else if (a === 'restart') start(app.diff);
    else if (a === 'setup') { app.mode = 'setup'; app.replaying = false; newFlight(app.diff); overlay('setup'); syncControls(); }
    else if (a === 'replay') replay();
    else if (a === 'closeHelp') { ui.help.hidden = true; if (app.mode === 'setup') overlay('setup'); else if (app.mode === 'finished' && app.outcome) overlay('result'); }
    else action(a);
});
ui.pause.addEventListener('click', () => {
    if (app.mode === 'running') pause();
    else if (app.mode === 'paused') resume();
    else if (app.mode === 'setup') start(app.diff);
    else if (app.mode === 'finished') start(app.diff);
});
ui.restart.addEventListener('click', () => start(app.diff));
ui.assist.addEventListener('click', () => action('assist'));
$('ag-help-btn').addEventListener('click', () => action('help'));
$('ag-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (game.requestFullscreen) game.requestFullscreen().catch(() => {});
});
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => setCamera(b.dataset.cam));
for (const b of document.querySelectorAll('[data-zoom]')) {
    b.addEventListener('click', () => {
        if (b.dataset.zoom === 'reset') { world.resetCamera(); setCamera(world.mode); }
        else world.zoomBy(b.dataset.zoom === 'in' ? 0.8 : 1.25);
    });
}
// Dragging in the 3D view takes the camera into Free mode, so the mouse always moves the camera
view.addEventListener('pointerdown', e => {
    if (e.target !== $('ag-canvas')) return;
    if (world.mode !== 'free') { setCamera('free'); }
});
ui.tilt.addEventListener('click', async () => {
    if (input.tiltOn) {
        input.disableTilt();
        ui.tilt.setAttribute('aria-pressed', 'false');
        ui.calibrate.hidden = true;
        announce('Tilt control off.');
        return;
    }
    const res = await input.enableTilt();
    if (res.ok) {
        ui.tilt.setAttribute('aria-pressed', 'true');
        ui.calibrate.hidden = false;
        announce('Tilt control on. Hold the device how you like and press Level.');
    } else {
        announce(res.why === 'denied' ? 'Motion access was not allowed. The touch controls still work.' : 'This device does not report tilt. The touch controls still work.');
    }
});
ui.calibrate.addEventListener('click', () => { input.calibrate(); announce('Level set.'); });

const coarse = window.matchMedia('(pointer: coarse)');
const applyTouch = () => { if (coarse.matches) game.dataset.touch = ''; else delete game.dataset.touch; };
coarse.addEventListener('change', applyTouch);
applyTouch();

document.addEventListener('visibilitychange', () => { if (document.hidden && app.mode === 'running') pause(); });

/* ---------- HUD ---------- */

function announce(text) {
    ui.live.textContent = '';
    requestAnimationFrame(() => { ui.live.textContent = text; });
}

const tile = k => game.querySelector(`.ag-tile[data-k="${k}"]`);
const tiles = Object.fromEntries(['alt', 'vs', 'hs', 'speed', 'dist', 'tilt'].map(k => [k, tile(k)]));
function setTile(k, text, level, gauge) {
    const t = tiles[k];
    t.querySelector('b').textContent = text;
    t.dataset.level = level || '';
    if (gauge !== undefined) t.querySelector('.ag-gauge i').style.width = `${Math.min(100, gauge * 100).toFixed(0)}%`;
}
const PHASES = { approach: 'APPROACH', correction: 'DESCENT CORRECTION', final: 'FINAL LANDING', tipping: 'TOUCHDOWN', landed: 'LANDED', toppled: 'TIPPED OVER', crashed: 'UNSUCCESSFUL' };

function hud(tm) {
    const L = tm.limits, d = DIFFICULTY[s.diff];
    setTile('alt', tm.alt >= 1000 ? `${(tm.alt / 1000).toFixed(2)} km` : `${tm.alt.toFixed(tm.alt < 100 ? 1 : 0)} m`);
    const vsAbs = -tm.vs;
    setTile('vs', `${tm.vs.toFixed(1)} m/s`, tm.alt < 60 ? (vsAbs > L.vs * 2 ? 'alert' : vsAbs > L.vs ? 'warn' : 'ok') : '', Math.max(0, vsAbs) / (L.vs * 4));
    setTile('hs', `${tm.hs.toFixed(1)} m/s`, tm.alt < 100 ? (tm.hs > L.hs * 2 ? 'alert' : tm.hs > L.hs ? 'warn' : 'ok') : '', tm.hs / (L.hs * 4));
    setTile('speed', `${tm.speed.toFixed(1)} m/s`);
    setTile('dist', `${tm.dist.toFixed(1)} m`, tm.dist <= L.pad ? 'ok' : tm.alt < 100 ? 'warn' : '');
    setTile('tilt', `${(tm.tilt * DEG).toFixed(1)}°`, tm.alt < 40 ? (tm.tilt > L.tilt ? 'warn' : 'ok') : '', tm.tilt / (L.tilt * 3));
    ui.phase.textContent = PHASES[s.phase] || s.phase.toUpperCase();
    ui.phase.dataset.level = s.phase === 'final' ? 'warn' : s.phase === 'crashed' || s.phase === 'toppled' ? 'alert' : s.phase === 'landed' ? 'ok' : 'info';
    // Bars
    const thrBar = $('ag-thr-bar'), fuelBar = $('ag-fuel-bar');
    thrBar.querySelector('i i').style.width = `${(s.throttle * 100).toFixed(0)}%`;
    thrBar.querySelector('b').textContent = `${Math.round(s.throttle * 100)}%`;
    fuelBar.querySelector('i i').style.width = `${(tm.propFrac * 100).toFixed(0)}%`;
    fuelBar.querySelector('b').textContent = `${Math.round(tm.propFrac * 100)}%`;
    fuelBar.dataset.level = tm.propFrac < 0.15 ? 'alert' : tm.propFrac < 0.3 ? 'warn' : '';
    $('ag-thr-fill').style.height = `${(app.throttle * 100).toFixed(0)}%`;
    $('ag-thr-text').textContent = `${Math.round(app.throttle * 100)}%`;
    $('ag-thr-slider').setAttribute('aria-valuenow', String(Math.round(app.throttle * 100)));
    // Top view: pad relative to the booster (north up), velocity and predicted impact
    const sc = 56 / Math.max(60, Math.min(600, tm.dist * 1.3, 600));
    const clampR = (x, z) => { const m = Math.hypot(x, z); const k = m > 54 ? 54 / m : 1; return [x * k, z * k]; };
    const [px, pz] = clampR(tm.dx * sc, tm.dz * sc);
    $('ag-radar-pad').setAttribute('transform', `translate(${px.toFixed(1)} ${pz.toFixed(1)})`);
    const imp = $('ag-radar-impact');
    imp.style.display = d.guide.impact && !s.result ? '' : 'none';
    if (d.guide.impact) { const [ix, iz] = clampR((tm.impact[0] - s.pos[0]) * sc, (tm.impact[1] - s.pos[2]) * sc); imp.setAttribute('cx', ix.toFixed(1)); imp.setAttribute('cy', iz.toFixed(1)); }
    const [vx, vz] = clampR(s.vel[0] * 1.6, s.vel[2] * 1.6);
    $('ag-radar-vel').setAttribute('d', `M0 0L${vx.toFixed(1)} ${vz.toFixed(1)}`);
    // Attitude dial: lean as a dot (roll right, pitch forward is up), the touchdown limit as a ring
    const ak = 50 / 0.6;
    $('ag-att-dot').setAttribute('cx', (Math.sin(s.roll) * ak).toFixed(1));
    $('ag-att-dot').setAttribute('cy', (-Math.sin(s.pitch) * ak).toFixed(1));
    $('ag-att-limit').setAttribute('r', (Math.sin(L.tilt) * ak).toFixed(1));
    $('ag-att-dot').dataset.level = tm.tilt > L.tilt ? 'warn' : 'ok';
    // Advice: short, encouraging and only when it helps
    let msg = '', lvl = 'info';
    if (!s.result && s.phase !== 'tipping') {
        if (tm.propFrac <= 0) { msg = 'Out of propellant: keep the booster upright.'; lvl = 'alert'; }
        else if (d.guide.burnCue && s.throttle < 0.4 && tm.stop > tm.alt * 0.8 && -tm.vs > 8) { msg = 'Start the landing burn now: throttle up (Shift or Z).'; lvl = 'warn'; }
        else if (tm.alt < 120 && tm.alt > 8 && tm.hs > L.hs * 2.5) { msg = 'Drifting: lean against your sideways motion.'; lvl = 'warn'; }
        else if (tm.alt < 60 && -tm.vs > Math.max(L.vs * 2, tm.alt * 0.5 + 2)) { msg = 'Descending fast: more throttle.'; lvl = 'alert'; }
        else if (tm.alt < 15 && tm.tilt > L.tilt) { msg = 'Level the booster for touchdown.'; lvl = 'warn'; }
        else if (tm.propFrac < 0.15) { msg = 'Fuel low: land soon.'; lvl = 'warn'; }
        else if (s.t < 4 && !app.replaying) { msg = d.guide.padArrow ? 'Find the pad on the top view, and plan your landing burn.' : ''; }
    }
    ui.advice.hidden = !msg;
    ui.advice.textContent = msg;
    ui.advice.dataset.level = lvl;
    // Flight data panel
    const set = (k, v) => { const el = game.querySelector(`[data-t="${k}"]`); if (el) el.textContent = v; };
    set('phase', PHASES[s.phase] || s.phase);
    set('twr', tm.twr.toFixed(2));
    set('stop', Number.isFinite(tm.stop) ? `${tm.stop.toFixed(0)} m` : 'cannot stop');
    set('legs', s.legs >= 1 ? 'down and locked' : s.legs > 0 ? 'deploying' : 'stowed');
    set('pitch', `${(s.pitch * DEG).toFixed(1)}°`);
    set('roll', `${(s.roll * DEG).toFixed(1)}°`);
    set('rates', `${(tm.rates * DEG).toFixed(1)}°/s`);
    set('wind', `${Math.hypot(...tm.wind).toFixed(1)} m/s`);
}

/* ---------- Frame loop ---------- */

function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let dtSim = 0;
    if (app.mode === 'running') {
        const stick = input.read(real, app.throttle);
        if (!app.replaying) app.throttle = stick.throttle;
        acc += real;
        while (acc >= STEP && app.mode === 'running') {
            let inp;
            if (app.replaying) {
                const ev = record.events;
                while (replayIdx < ev.length && ev[replayIdx].i <= stepIndex) Object.assign(replayInput, ev[replayIdx++].v);
                inp = { ...replayInput };
            } else if (override) {
                inp = override(s);
                app.throttle = inp.throttle;
            } else {
                inp = { pitch: stick.pitch, roll: stick.roll, throttle: app.throttle, assist: app.assist };
            }
            if (!app.replaying) {
                const sig = `${inp.pitch}|${inp.roll}|${inp.throttle}|${inp.assist}`;
                if (sig !== lastRec) { lastRec = sig; record.events.push({ i: stepIndex, v: { pitch: inp.pitch, roll: inp.roll, throttle: inp.throttle, assist: inp.assist } }); }
                if (inp.assist) app.assistUsed = true;
            }
            const ev = step(s, inp, STEP);
            stepIndex++;
            acc -= STEP;
            dtSim += STEP;
            for (const e of ev) handle(e);
            if (s.result && app.mode === 'running') finish();
        }
        app.clock += real;
    } else if (app.mode === 'finished') {
        // Keep stepping after touchdown so a tip-over (or settling) plays out
        app.clock += real;
    }
    const tm = telemetry(s);
    world.update(s, { time: app.clock, dt: app.mode === 'running' || app.mode === 'finished' ? real : 0, dtReal: real, impact: tm.impact, wind: tm.wind });
    world.render();
    if (now - lastHud > 66) { hud(tm); lastHud = now; }
}

function handle(e) {
    if (e.type === 'legs') announce('Legs deploying.');
    else if (e.type === 'burn') announce('Landing burn started.');
    else if (e.type === 'fuelout') announce('Propellant exhausted.');
    else if (e.type === 'phase' && e.phase === 'final') announce('Final landing. Under 80 metres.');
    else if (e.type === 'touchdown') announce(`Touchdown at ${e.vs.toFixed(1)} metres per second.`);
}

function resize() {
    const r = view.getBoundingClientRect();
    world.resize(r.width, r.height);
}
new ResizeObserver(resize).observe(view);
resize();

showReqs();
syncControls();
setCamera('follow');
overlay('setup');
requestAnimationFrame(frame);

// For automated checks: fly with scripted inputs faster than real time, and read the outcome
window.WSAAegis = {
    get mode() { return app.mode; }, get state() { return s; }, get outcome() { return app.outcome; }, get app() { return app; }, get record() { return record; },
    start, replay, pause, resume, setCamera, telemetry: () => telemetry(s),
    setOverride(fn) { override = fn; },
    advance(seconds) {
        let n = Math.round(seconds / STEP);
        while (n-- > 0 && app.mode === 'running') {
            let inp;
            if (app.replaying) {
                const ev = record.events;
                while (replayIdx < ev.length && ev[replayIdx].i <= stepIndex) Object.assign(replayInput, ev[replayIdx++].v);
                inp = { ...replayInput };
            } else {
                inp = override ? override(s) : { pitch: 0, roll: 0, throttle: app.throttle, assist: app.assist };
                const sig = `${inp.pitch}|${inp.roll}|${inp.throttle}|${inp.assist}`;
                if (sig !== lastRec) { lastRec = sig; record.events.push({ i: stepIndex, v: { ...inp } }); }
                if (inp.assist) app.assistUsed = true;
            }
            const ev = step(s, inp, STEP);
            stepIndex++;
            for (const e of ev) handle(e);
            if (s.result && app.mode === 'running') finish();
        }
        return app.mode;
    },
};
