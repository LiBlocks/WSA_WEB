// WSA Engineering Sandbox (engineering-sandbox.html): the page. Builds the controls from the scenario
// definitions (scenarios.js), runs the chosen scenario's physics at a fixed time step whatever the display's
// frame rate, and hands each frame's state to the 3D view (world.js). Basic and Pro mode share one set of
// values: switching mode only changes which controls are shown and how they are labelled.
import { SCENARIOS, scenario, defaults, sanitize, fmt, num } from './scenarios.js';

const $ = id => document.getElementById(id);
const MAX_FRAME = 0.1;           // s: a long gap between frames (a background tab) never fast-forwards
const MAX_STEPS = 6000;          // physics steps per frame at most, whatever the time scale
const STORE = { mode: 'wsa-sandbox-mode', quality: 'wsa-sandbox-quality', vectors: 'wsa-sandbox-vectors', done: 'wsa-sandbox-done', last: 'wsa-sandbox-last' };

const ui = {
    root: $('es'), view: $('es-view'), canvas: $('es-canvas'), labels: $('es-labels'), loading: $('es-loading'), error: $('es-error'),
    select: $('es-select'), selectGrid: $('es-select-grid'), selectClose: $('es-select-close'), debrief: $('es-debrief'), help: $('es-help'),
    title: $('es-title'), level: $('es-level'), objective: $('es-objective'), status: $('es-status'), clock: $('es-clock'), scaleOut: $('es-scale'),
    hud: $('es-hud-readouts'), start: $('es-start'), reset: $('es-reset'), replay: $('es-replay'), slower: $('es-slower'), faster: $('es-faster'),
    actions: $('es-actions'), pilot: $('es-pilot'), params: $('es-params'), preset: $('es-preset'), presetLabel: $('es-preset-label'),
    presetReset: $('es-preset-reset'), challenge: $('es-challenge'), challengeText: $('es-challenge-text'), pending: $('es-pending'),
    note: $('es-note'), derived: $('es-derived'), telemetry: $('es-telemetry'), system: $('es-system'), log: $('es-log'), graphs: $('es-graphs'),
    pin: $('es-pin'), compare: $('es-compare'), assumptions: $('es-assumptions'), learn: $('es-learn'), live: $('es-live'),
    modeBasic: $('es-mode-basic'), modePro: $('es-mode-pro'), vectors: $('es-vectors'), quality: $('es-quality'), follow: $('es-follow'),
    hiddenPro: $('es-hidden-pro'), pilotThrottle: $('es-pilot-throttle'),
};

function readStore(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage blocked: the setting lasts for this visit only */ }
}
function readDone() {
    try { const v = JSON.parse(localStorage.getItem(STORE.done)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
}

/* ---------- State ---------- */

const app = {
    mode: readStore(STORE.mode, 'basic') === 'pro' ? 'pro' : 'basic',
    quality: readStore(STORE.quality, 'high') === 'low' ? 'low' : 'high',
    vectors: readStore(STORE.vectors, 'on') !== 'off',
    state: 'ready',         // ready | running | paused | finished
    replaying: false,
    pendingChanges: false,
};
let sc = null;              // the scenario
let p = null;               // its parameter values (display units)
let presetId = null;
let challenge = 'free';
let sim = null;
let stepIndex = 0;
let acc = 0;
let scaleIdx = 0;
let clock = 0;              // display time for animations (s)
let queued = [];            // commands waiting for the next physics step
let record = null;          // { p0, challenge, events: [{ i, type, ... }] } of the last run, for replay
let replayCursor = 0;
let world = null;
let lastFrame = performance.now();
let raf = 0;
let dirty = true;
let lastPanel = 0, lastGraph = 0;
let series = {};            // graph samples
let lastSampleT = -Infinity;
let pinned = null, latest = null;
let goalShown = false;
const manual = { throttle: 0, tiltX: 0, tiltZ: 0, keys: new Set(), touch: new Set() };

const label = (def) => (app.mode === 'basic' && def.basic ? def.basic.label : def.pro.label);

/* ---------- 3D view ---------- */

function showError(title, text) {
    ui.loading.hidden = true;
    ui.error.hidden = false;
    ui.error.querySelector('.es-card-title').textContent = title;
    ui.error.querySelector('.es-card-text').textContent = text;
}

try {
    const { createWorld } = await import('./world.js');
    try {
        world = createWorld(ui.canvas, ui.labels, { quality: app.quality });
    } catch (err) {
        world = null;
        showError('3D graphics are unavailable', 'This browser or device could not start WebGL. The experiments, readouts and graphs still work below; only the 3D view is missing. Try another browser or turn on hardware acceleration to see it.');
        console.warn(err);
    }
} catch (err) {
    showError('The 3D engine could not load', 'The sandbox\'s 3D library (three.js) did not load. The experiments, readouts and graphs still work; reload the page to try the 3D view again.');
    console.warn(err);
}
ui.loading.hidden = true;
if (world) {
    ui.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        showError('The 3D view stopped', 'The graphics context was lost (this can happen when a device is busy or wakes from sleep). Reload the page to bring the 3D view back.');
        world = null;
    });
    world.controls.addEventListener('change', () => requestFrame());
    world.controls.addEventListener('start', () => { if (world.follow && sc && sc.view !== 'orbit') { /* keep following: the player only changes the angle */ } });
}

/* ---------- Scenario selection ---------- */

const ICONS = {
    engine: '<path d="M20 6h24v10H20zM24 16h16l-3 10H27z"/><path d="M28 26l-3 14h14l-3-14" class="hot"/>',
    liftoff: '<path d="M32 6c5 6 6 14 6 22H26c0-8 1-16 6-22z"/><path d="M26 28h12v8H26z"/><path d="M12 50h40M20 44v6M44 44v6"/><path d="M29 38l3 8 3-8" class="hot"/>',
    staging: '<path d="M32 4c4 5 5 10 5 15H27c0-5 1-10 5-15z"/><path d="M27 21h10v10H27z"/><path d="M26 38h12v14H26z" opacity=".55"/><path d="M29 33l3 4 3-4" class="hot"/>',
    orbit: '<circle cx="32" cy="32" r="10"/><ellipse cx="32" cy="32" rx="24" ry="12" fill="none"/><circle cx="54" cy="30" r="3" class="hot"/>',
    hohmann: '<circle cx="32" cy="32" r="7"/><circle cx="32" cy="32" r="13" fill="none"/><circle cx="32" cy="32" r="24" fill="none"/><path d="M45 32a19 15 0 0 1-37 0" fill="none" stroke-dasharray="3 3" class="hot"/>',
    landing: '<path d="M30 8h4v28h-4z"/><path d="M30 36l-6 8M34 36l6 8"/><path d="M14 52h36"/><path d="M30 38l2 6 2-6" class="hot"/>',
    freeplay: '<path d="M32 6c5 6 6 14 6 22H26c0-8 1-16 6-22z"/><path d="M26 28h12v10H26z"/><path d="M10 54c10-10 34-10 44 0" fill="none"/><circle cx="50" cy="14" r="3" class="hot"/>',
};

function buildSelect() {
    const done = readDone();
    ui.selectGrid.innerHTML = '';
    for (const s of SCENARIOS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'es-pick';
        b.dataset.scenario = s.id;
        const n = (done[s.id] || []).length;
        b.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" class="es-pick-icon">${ICONS[s.id]}</svg>
            <span class="es-pick-body"><span class="es-pick-top"><b>${s.name}</b><span class="es-chip" data-level="${s.level}">${s.level}</span></span>
            <span class="es-pick-sum">${s.summary}</span>
            <span class="es-pick-learn"><span class="visually-hidden">You'll learn: </span>${s.learn}</span>
            ${n ? `<span class="es-pick-done">${n} challenge${n > 1 ? 's' : ''} completed</span>` : ''}</span>`;
        b.addEventListener('click', () => { closeSelect(); loadScenario(s.id); });
        ui.selectGrid.appendChild(b);
    }
}
function openSelect() {
    if (app.state === 'running') pause();
    buildSelect();
    ui.select.hidden = false;
    ui.selectClose.hidden = !sc;
    const first = ui.selectGrid.querySelector(`[data-scenario="${sc ? sc.id : 'engine'}"]`);
    if (first) first.focus({ preventScroll: true });
}
function closeSelect() {
    ui.select.hidden = true;
}

/* ---------- Loading a scenario ---------- */

function loadScenario(id, opts = {}) {
    sc = scenario(id) || SCENARIOS[0];
    writeStore(STORE.last, sc.id);
    if (location.hash.slice(1) !== sc.id) history.replaceState(null, '', `#${sc.id}`);
    presetId = sc.presets[0].id;
    challenge = opts.challenge || sc.challenges[0].id;
    p = sanitize(sc, defaults(sc, presetId));
    applyChallengeValues();
    scaleIdx = Math.max(0, sc.scales.indexOf(sc.scale));
    pinned = null;
    latest = null;
    record = null;
    ui.title.textContent = sc.name;
    ui.level.textContent = sc.level;
    ui.level.dataset.level = sc.level;
    ui.learn.textContent = sc.learn;
    ui.presetLabel.textContent = sc.presetLabel;
    ui.preset.innerHTML = sc.presets.map(x => `<option value="${x.id}">${x.label}</option>`).join('');
    ui.challenge.innerHTML = sc.challenges.map(x => `<option value="${x.id}">${x.label}</option>`).join('');
    ui.challenge.value = challenge;
    ui.assumptions.innerHTML = sc.assumptions.map(a => `<li>${a}</li>`).join('');
    ui.note.textContent = '';
    ui.root.dataset.scenario = sc.id;
    ui.pilot.hidden = !sc.manual;
    renderParams();
    renderCompare();
    resetRun();
    announce(`${sc.name} loaded.`);
}

function applyChallengeValues() {
    const ch = sc.challenges.find(c => c.id === challenge);
    if (ch && ch.values) p = sanitize(sc, { ...p, ...ch.values });
    ui.challengeText.textContent = ch ? ch.text : '';
    ui.objective.textContent = ch && ch.id !== 'free' ? ch.label : 'Free experiment';
}

/* ---------- Parameter controls ---------- */

function decimals(step) {
    const s = String(step);
    return s.includes('.') ? s.split('.')[1].length : 0;
}
function valueText(def, v) {
    if (def.kind === 'toggle') return v ? 'On' : 'Off';
    if (def.kind === 'select') return (def.options.find(o => o.value === v) || {}).label || v;
    if (def.id === 'timeStep' && v === 0) return 'auto';
    return `${num(v, decimals(def.step))}${def.unit ? (def.unit === '%' || def.unit === '°' || def.unit === '×' ? def.unit : ` ${def.unit}`) : ''}`;
}

function renderParams() {
    ui.params.innerHTML = '';
    const groups = new Map();
    let hiddenPro = 0;
    for (const def of sc.params) {
        if (app.mode === 'basic' && !def.basic) {
            if (p[def.id] !== defaults(sc, presetId)[def.id]) hiddenPro++;
            continue;
        }
        if (!groups.has(def.group)) {
            const fs = document.createElement('fieldset');
            fs.className = 'es-group';
            fs.innerHTML = `<legend>${def.group}</legend>`;
            groups.set(def.group, fs);
            ui.params.appendChild(fs);
        }
        groups.get(def.group).appendChild(fieldFor(def));
    }
    ui.hiddenPro.hidden = !(app.mode === 'basic' && hiddenPro > 0);
    ui.hiddenPro.querySelector('b').textContent = String(hiddenPro);
    updateVisibility();
    renderDerived();
}

function fieldFor(def) {
    const wrap = document.createElement('div');
    wrap.className = 'es-field';
    wrap.dataset.id = def.id;
    const id = `es-p-${def.id}`;
    const help = app.mode === 'basic' ? (def.basic && def.basic.help) : def.pro.help;
    const sym = label(def);
    const live = def.live ? '<span class="es-live" title="Changes take effect during a run">live</span>' : '';
    let control = '';
    if (def.kind === 'range') {
        control = `<input type="range" id="${id}" min="${def.min}" max="${def.max}" step="${def.step}" value="${p[def.id]}"${help ? ` aria-describedby="${id}-help"` : ''}>`;
        if (app.mode === 'pro') control += `<input type="number" class="es-num" min="${def.min}" max="${def.max}" step="${def.step}" value="${p[def.id]}" aria-label="${sym}${def.unit ? `, ${def.unit}` : ''}">`;
    } else if (def.kind === 'select') {
        control = `<select id="${id}"${help ? ` aria-describedby="${id}-help"` : ''}>${def.options.filter(o => !o.pro || app.mode === 'pro' || o.value === p[def.id]).map(o => `<option value="${o.value}"${o.value === p[def.id] ? ' selected' : ''}>${o.label}</option>`).join('')}</select>`;
    } else {
        control = `<label class="es-switch"><input type="checkbox" id="${id}"${p[def.id] ? ' checked' : ''}${help ? ` aria-describedby="${id}-help"` : ''}><span aria-hidden="true"></span></label>`;
    }
    const proHelp = app.mode === 'pro' && help;
    wrap.innerHTML = `<div class="es-field-head"><label for="${id}">${sym}</label>${live}
        ${def.kind === 'range' ? `<output for="${id}" class="es-out">${valueText(def, p[def.id])}</output>` : ''}
        ${proHelp ? `<button type="button" class="es-info" aria-expanded="false" aria-controls="${id}-help" aria-label="About ${sym}">i</button>` : ''}</div>
        <div class="es-control">${control}</div>
        ${help ? `<p class="es-help" id="${id}-help"${proHelp ? ' hidden' : ''}>${help}</p>` : ''}`;
    const input = wrap.querySelector(`#${id}`);
    const numIn = wrap.querySelector('.es-num');
    const out = wrap.querySelector('output');
    const read = el => (def.kind === 'range' ? Number(el.value) : def.kind === 'toggle' ? (el.checked ? 1 : 0) : el.value);
    input.addEventListener('input', () => {
        const v = read(input);
        if (numIn) numIn.value = v;
        if (out) out.textContent = valueText(def, v);
        setParam(def.id, v, def.kind === 'range');
    });
    input.addEventListener('change', () => setParam(def.id, read(input), false));
    if (numIn) {
        numIn.addEventListener('change', () => {
            let v = Number(numIn.value);
            if (!Number.isFinite(v)) v = p[def.id];
            v = Math.min(def.max, Math.max(def.min, v));
            numIn.value = v;
            input.value = v;
            if (out) out.textContent = valueText(def, v);
            setParam(def.id, v, false);
        });
    }
    const info = wrap.querySelector('.es-info');
    if (info) {
        info.addEventListener('click', () => {
            const h = wrap.querySelector('.es-help');
            h.hidden = !h.hidden;
            info.setAttribute('aria-expanded', String(!h.hidden));
        });
    }
    return wrap;
}

function syncField(id) {
    const def = sc.params.find(d => d.id === id);
    const wrap = ui.params.querySelector(`.es-field[data-id="${id}"]`);
    if (!def || !wrap) return;
    const input = wrap.querySelector(`#es-p-${id}`);
    if (def.kind === 'toggle') input.checked = !!p[id];
    else input.value = p[id];
    const numIn = wrap.querySelector('.es-num');
    if (numIn) numIn.value = p[id];
    const out = wrap.querySelector('output');
    if (out) out.textContent = valueText(def, p[id]);
}

function updateVisibility() {
    for (const wrap of ui.params.querySelectorAll('.es-field')) {
        const def = sc.params.find(d => d.id === wrap.dataset.id);
        wrap.hidden = def.show ? !def.show(p) : false;
    }
    for (const fs of ui.params.querySelectorAll('fieldset')) fs.hidden = ![...fs.querySelectorAll('.es-field')].some(f => !f.hidden);
}

let rebuildTimer = 0;
function setParam(id, value, continuous) {
    const def = sc.params.find(d => d.id === id);
    if (!def || p[id] === value) return;
    p[id] = value;
    if (def.live && (app.state === 'running' || app.state === 'paused') && !app.replaying) {
        recordEvent({ type: 'param', id, value });
    }
    updateVisibility();
    renderDerived();
    const n = sc.note(p, id, sim);
    if (n) ui.note.textContent = n;
    if (def.live && (app.state === 'running' || app.state === 'paused')) { dirty = true; requestFrame(); return; }
    if (app.state === 'ready') {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => resetRun(true), continuous ? 120 : 0);
    } else {
        app.pendingChanges = true;
        ui.pending.hidden = false;
    }
}

function renderDerived() {
    const rows = sc.derived(p).filter(r => app.mode === 'pro' || !r.pro);
    ui.derived.innerHTML = rows.map(r => `<div${r.tone ? ` data-tone="${r.tone}"` : ''}><dt>${app.mode === 'basic' && r.basic ? r.basic : r.label}</dt><dd>${r.value}</dd></div>`).join('');
}

/* ---------- Run lifecycle ---------- */

function resetRun(keepNote) {
    clearTimeout(rebuildTimer);
    rebuildTimer = 0;
    sim = sc.create(p, challenge);
    stepIndex = 0;
    acc = 0;
    queued = [];
    app.state = 'ready';
    app.replaying = false;
    app.pendingChanges = false;
    goalShown = false;
    ui.pending.hidden = true;
    ui.debrief.hidden = true;
    manual.throttle = 0;
    manual.tiltX = manual.tiltZ = 0;
    series = {};
    lastSampleT = -Infinity;
    if (!keepNote) ui.log.innerHTML = '';
    else ui.log.innerHTML = '';
    logLine(sim.t, `${sc.short} ready. ${sc.challenges.find(c => c.id === challenge).label}.`, 'info');
    if (world) world.build(sc, p, sim);
    renderActions();
    syncControls();
    updatePanel(true);
    drawGraphs(true);
    dirty = true;
    requestFrame();
}

function start() {
    if (rebuildTimer) resetRun(true);       // a settings change is still waiting to rebuild the experiment
    if (app.state === 'finished') resetRun();
    if (app.state === 'ready') {
        record = { p0: { ...p }, challenge, events: [] };
        app.replaying = false;
        logLine(sim.t, 'Experiment started', 'info');
    }
    app.state = 'running';
    ui.debrief.hidden = true;
    lastFrame = performance.now();
    syncControls();
    announce('Running.');
    requestFrame();
}

function pause(auto) {
    if (app.state !== 'running') return;
    app.state = 'paused';
    syncControls();
    if (!auto) announce('Paused.');
    dirty = true;
    requestFrame();
}

function togglePlay() {
    if (app.state === 'running') pause();
    else start();
}

function replay() {
    if (!record) return;
    p = sanitize(sc, { ...record.p0 });
    challenge = record.challenge;
    ui.challenge.value = challenge;
    renderParams();
    resetRun();
    app.state = 'running';
    app.replaying = true;
    replayCursor = 0;
    logLine(0, 'Replaying the last run with the same settings and inputs', 'info');
    syncControls();
    announce('Replay.');
    requestFrame();
}

function recordEvent(e) {
    if (record && !app.replaying) record.events.push({ i: stepIndex, ...e });
}

function command(id) {
    if (!sc) return;
    if (id === 'map') {
        if (world && world.toggleMap) {
            const on = world.toggleMap();
            const b = ui.actions.querySelector('[data-action="map"]');
            if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Vehicle view' : 'Map view'; }
            dirty = true;
            requestFrame();
        }
        return;
    }
    if (app.replaying) return;
    if (id === 'guidance') {
        setParam('pilot', p.pilot === 'guidance' ? 'manual' : 'guidance');
        syncField('pilot');
        updateVisibility();
        logLine(sim.t, p.pilot === 'guidance' ? 'Guidance computer flying' : 'Manual control: you have the booster', 'info');
        if (p.pilot === 'manual') manual.throttle = sim.L ? sim.L.throttle : 0;
        return;
    }
    if (id === 'end') {
        if (app.state === 'running' || app.state === 'paused') finish();
        return;
    }
    if (app.state === 'ready') start();
    if (app.state !== 'running' && app.state !== 'paused') return;
    queued.push(id);
    recordEvent({ type: 'cmd', id });
    dirty = true;
    requestFrame();
}

function finish() {
    if (app.state === 'finished') return;
    app.state = 'finished';
    const d = sc.debrief(sim, p, challenge);
    latest = { name: `${sc.presets.find(x => x.id === presetId)?.label || 'Custom'} · ${sc.challenges.find(c => c.id === challenge).label}`, values: sc.result(sim), score: d.score };
    if (d.met && challenge !== 'free' && !app.replaying) {
        const done = readDone();
        done[sc.id] = Array.from(new Set([...(done[sc.id] || []), challenge]));
        writeStore(STORE.done, JSON.stringify(done));
    }
    logLine(sim.t, d.met === true ? 'Objective achieved' : d.met === false ? 'Objective not achieved' : 'Experiment complete', d.met === false ? 'warn' : 'ok');
    showDebrief(d);
    renderCompare();
    syncControls();
    updatePanel(true);
    drawGraphs(true);
}

function showDebrief(d) {
    const box = ui.debrief;
    box.querySelector('.es-debrief-title').textContent = d.title;
    const badge = box.querySelector('.es-debrief-met');
    badge.hidden = d.met === null || d.met === undefined;
    badge.textContent = d.met ? 'Objective achieved' : 'Objective not achieved';
    badge.dataset.met = d.met ? 'yes' : 'no';
    const sc0 = box.querySelector('.es-debrief-score');
    sc0.hidden = d.score === null || d.score === undefined;
    sc0.querySelector('b').textContent = d.score === null || d.score === undefined ? '' : `${d.score}`;
    sc0.querySelector('span').textContent = d.grade ? `Grade ${d.grade}` : 'out of 100';
    box.querySelector('.es-debrief-summary').textContent = d.summary;
    box.querySelector('.es-debrief-metrics').innerHTML = d.metrics.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    box.querySelector('.es-debrief-lesson').textContent = d.lesson;
    box.querySelector('[data-action="replay"]').hidden = !record;
    box.hidden = false;
    announce(`${d.title}. ${d.summary}${d.score !== null && d.score !== undefined ? ` Score ${d.score} out of 100.` : ''}`);
    box.querySelector('[data-action="close"]').focus({ preventScroll: true });
}

/* ---------- Controls state ---------- */

function syncControls() {
    const s = app.state;
    ui.root.dataset.state = s;
    ui.start.textContent = s === 'running' ? 'Pause' : s === 'paused' ? 'Resume' : s === 'finished' ? 'Run again' : 'Start';
    ui.start.setAttribute('aria-keyshortcuts', 'Space');
    ui.replay.disabled = !record;
    ui.status.textContent = app.replaying ? 'REPLAY' : { ready: 'READY', running: 'RUNNING', paused: 'PAUSED', finished: 'COMPLETE' }[s];
    ui.status.dataset.state = app.replaying ? 'replay' : s;
    ui.scaleOut.textContent = `${num(sc.scales[scaleIdx], sc.scales[scaleIdx] < 1 ? 2 : 0)}×`;
    ui.slower.disabled = scaleIdx === 0;
    ui.faster.disabled = scaleIdx === sc.scales.length - 1;
    for (const b of ui.actions.querySelectorAll('button')) {
        const a = sc.actions.find(x => x.id === b.dataset.action);
        b.disabled = !a || (!a.always && (app.replaying || s === 'finished'));
    }
    ui.root.classList.toggle('es-replaying', app.replaying);
    ui.follow.setAttribute('aria-pressed', String(world ? world.follow : false));
}

function renderActions() {
    ui.actions.innerHTML = '';
    for (const a of sc.actions) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn btn-small ${a.primary ? 'btn-primary' : 'btn-secondary'} es-action`;
        b.dataset.action = a.id;
        b.textContent = a.label;
        if (a.key) { b.setAttribute('aria-keyshortcuts', a.key); b.title = `${a.label} (${a.key})`; }
        if (a.id === 'map') b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => command(a.id));
        ui.actions.appendChild(b);
    }
}

/* ---------- Telemetry, HUD, system ---------- */

function readoutsFor() {
    return sc.readouts.filter(r => {
        if (r.pro && app.mode !== 'pro') return false;
        if (r.only === 'B' && !p.compare) return false;
        if (r.only === 'rdv' && !p.rendezvous) return false;
        if (r.env && sc.id === 'staging' && p.env === 'space') return false;
        return true;
    });
}

function updatePanel(force) {
    if (!sim) return;
    const tm = sc.telemetry(sim, p);
    const rows = readoutsFor();
    const html = rows.map(r => {
        const v = tm[r.key];
        const txt = v === undefined ? '—' : r.fmt(v);
        const bar = r.bar !== undefined && Number.isFinite(tm[r.bar]) ? `<span class="es-bar"><span style="width:${Math.max(0, Math.min(100, tm[r.bar] * 100)).toFixed(1)}%"></span></span>` : '';
        return `<div><dt>${app.mode === 'basic' && r.basic ? r.basic : r.label}</dt><dd>${txt}${bar}</dd></div>`;
    }).join('');
    if (force || ui.telemetry.dataset.sig !== html) { ui.telemetry.innerHTML = html; ui.telemetry.dataset.sig = html; }
    const hud = rows.filter(r => r.hud && r.key !== 'status').slice(0, 6).map(r => {
        const v = tm[r.key];
        return `<div class="es-hud-tile"><span>${app.mode === 'basic' && r.basic ? r.basic : r.label}</span><b>${v === undefined ? '—' : r.fmt(v)}</b></div>`;
    }).join('');
    if (ui.hud.dataset.sig !== hud) { ui.hud.innerHTML = hud; ui.hud.dataset.sig = hud; }
    const t = sim.t;
    ui.clock.textContent = `T${t < 0 ? '−' : '+'}${fmt.time(Math.abs(t)).replace(/^−/, '')}`;
    if (!app.replaying) ui.status.textContent = tm.status && app.state !== 'ready' ? tm.status : { ready: 'READY', running: 'RUNNING', paused: 'PAUSED', finished: 'COMPLETE' }[app.state];
    if (app.state === 'paused') ui.status.textContent = 'PAUSED';
    if (app.replaying) ui.status.textContent = 'REPLAY';
    renderSystem(tm);
    if (sc.manual) {
        ui.pilotThrottle.style.setProperty('--thr', `${Math.round((p.pilot === 'manual' ? manual.throttle : (sim.L ? sim.L.throttle : 0)) * 100)}%`);
        ui.pilotThrottle.querySelector('b').textContent = `${Math.round((sim.L ? sim.L.throttle : 0) * 100)}%`;
        ui.pilot.dataset.pilot = p.pilot;
    }
}

function renderSystem(tm) {
    let html = '';
    if (sim.f) {
        html = sim.f.stages.map((s, i) => {
            const state = i < sim.f.active ? 'separated' : i === sim.f.active ? (sim.f.engineOn ? 'burning' : 'active') : 'waiting';
            const frac = s.prop0 > 0 ? s.prop / s.prop0 : 0;
            return `<li data-state="${state}"><span>Stage ${i + 1}</span><span class="es-bar"><span style="width:${(frac * 100).toFixed(1)}%"></span></span><span>${state === 'separated' ? `dropped${s.left > 1 ? `, ${fmt.t(s.left)} unused` : ''}` : `${fmt.t(s.prop)} · ${s.engines}× ${fmt.kN(s.thrust)}`}</span></li>`;
        }).join('');
        if (sim.timeline && sim.timeline.length) html += sim.timeline.map(e => `<li class="es-sys-event"><span>T+${e.t.toFixed(1)} s</span><span>Stage ${e.stage + 1} separated</span><span>${fmt.t(e.before)} → ${fmt.t(e.after)}</span></li>`).join('');
    } else if (sim.A) {
        html = ['A', 'B'].filter(k => sim[k]).map(k => {
            const s = sim[k];
            return `<li data-state="${s.thrust > 0 ? 'burning' : 'active'}"><span>${sim.B ? `Engine ${k}` : 'Engine'}</span><span class="es-bar"><span style="width:${(100 * s.prop / Math.max(1, s.cfg.propellant)).toFixed(1)}%"></span></span><span>${s.cfg.engines}× ${fmt.kN(s.cfg.thrust)} · Isp ${s.cfg.isp} s</span></li>`;
        }).join('');
    } else if (sim.L) {
        const L = sim.L;
        html = `<li data-state="${L.throttle > 0 ? 'burning' : 'active'}"><span>Booster</span><span class="es-bar"><span style="width:${(100 * L.prop / Math.max(1, L.cfg.prop)).toFixed(1)}%"></span></span><span>${p.pilot === 'guidance' ? 'Guidance flying' : 'Manual'} · legs ${L.legs >= 1 ? 'down and locked' : L.legs > 0 ? 'deploying' : 'stowed'}</span></li>`;
    } else if (sim.o) {
        const burns = sim.burns || [];
        html = burns.length ? burns.map((b, i) => `<li class="es-sys-event"><span>Burn ${i + 1}</span><span>T+${fmt.time(b.t)}</span><span>${fmt.ms(b.dv)} ${b.dir}</span></li>`).join('')
            : sim.h ? `<li class="es-sys-event"><span>Burn 1</span><span>${sim.burn1At === null ? 'waiting' : `T+${fmt.time(sim.burn1At)}`}</span><span>${fmt.ms(sim.h.dv1)}</span></li><li class="es-sys-event"><span>Burn 2</span><span>${sim.burn2At === null ? 'waiting' : `T+${fmt.time(sim.burn2At)}`}</span><span>${fmt.ms(sim.h.dv2)}</span></li>`
                : '<li class="es-sys-event"><span>No burns yet</span><span></span><span></span></li>';
    }
    if (ui.system.dataset.sig !== html) { ui.system.innerHTML = html; ui.system.dataset.sig = html; }
}

/* ---------- Event log ---------- */

function logLine(t, text, level = 'info') {
    const li = document.createElement('li');
    li.dataset.level = level;
    li.innerHTML = `<time>T${t < 0 ? '−' : '+'}${fmt.time(Math.abs(t))}</time><span></span>`;
    li.querySelector('span').textContent = text;
    ui.log.prepend(li);
    while (ui.log.children.length > 250) ui.log.lastChild.remove();
}

/* ---------- Graphs ---------- */

const GRAPH_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
function sample(tm) {
    const every = Math.max(0.05, 0.08 * sc.scales[scaleIdx]);
    if (sim.t - lastSampleT < every) return;
    lastSampleT = sim.t;
    for (const g of sc.graphs) {
        for (const s of g.series) {
            const v = tm[s.key];
            if (typeof v !== 'number' || !Number.isFinite(v)) continue;
            const arr = series[s.key] || (series[s.key] = []);
            arr.push([sim.t, Math.min(s.cap ?? Infinity, v * (s.k ?? 1))]);
            if (arr.length > 1600) series[s.key] = arr.filter((_, i) => i % 2 === 0);
        }
    }
}

function drawGraphs(force) {
    if (!sc) return;
    const canvases = ui.graphs.querySelectorAll('canvas');
    if (canvases.length !== sc.graphs.length || force && ui.graphs.dataset.sc !== sc.id) {
        ui.graphs.dataset.sc = sc.id;
        ui.graphs.innerHTML = sc.graphs.map(g => `<figure class="es-graph"><figcaption>${g.label}${g.unit ? ` <span>(${g.unit})</span>` : ''}<span class="es-graph-key">${g.series.length > 1 ? g.series.map((s, i) => `<i style="--c:${GRAPH_COLORS[i]}"></i>${s.label}`).join(' ') : ''}</span></figcaption><canvas role="img" aria-label="${g.label} against time"></canvas></figure>`).join('');
    }
    const styles = getComputedStyle(ui.root);
    const text = styles.getPropertyValue('--es-muted').trim() || '#888';
    const line = styles.getPropertyValue('--es-line').trim() || '#ccc';
    ui.graphs.querySelectorAll('canvas').forEach((cv, gi) => {
        const g = sc.graphs[gi];
        const w = cv.clientWidth, h = cv.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        const all = g.series.map(s => series[s.key] || []);
        let t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const arr of all) for (const [t, v] of arr) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
        const padL = 46, padB = 18, padT = 6, padR = 8;
        c.strokeStyle = line;
        c.lineWidth = 1;
        c.strokeRect(padL + 0.5, padT + 0.5, w - padL - padR, h - padT - padB);
        c.fillStyle = text;
        c.font = '11px system-ui, sans-serif';
        if (!Number.isFinite(t0) || t1 <= t0) {
            c.fillText('Start the experiment to plot it', padL + 8, h / 2);
            return;
        }
        if (y0 > 0 && y0 < y1 * 0.6) y0 = 0;
        // A value holding steady gets a sensible scale round it, not a magnified flat line
        const minSpan = Math.max(Math.abs(y0), Math.abs(y1)) * 0.1 || 1;
        if (y1 - y0 < minSpan) {
            const mid = (y0 + y1) / 2;
            y0 = mid - minSpan / 2;
            y1 = mid + minSpan / 2;
            if (y0 < 0 && mid >= 0) { y1 -= y0; y0 = 0; }    // a quantity that can't go negative keeps 0 as its floor
        }
        const X = t => padL + (t - t0) / (t1 - t0) * (w - padL - padR);
        const Y = v => padT + (1 - (v - y0) / (y1 - y0)) * (h - padT - padB);
        c.textAlign = 'right';
        c.fillText(num(y1, Math.abs(y1) < 10 ? 2 : 0), padL - 4, padT + 10);
        c.fillText(num(y0, Math.abs(y0) < 10 && y0 !== 0 ? 2 : 0), padL - 4, h - padB);
        c.textAlign = 'left';
        c.fillText(`${fmt.time(t0)}`, padL, h - 4);
        c.textAlign = 'right';
        c.fillText(`${fmt.time(t1)}`, w - padR, h - 4);
        if (y0 < 0 && y1 > 0) {
            c.strokeStyle = line;
            c.beginPath(); c.moveTo(padL, Y(0)); c.lineTo(w - padR, Y(0)); c.stroke();
        }
        all.forEach((arr, i) => {
            if (arr.length < 2) return;
            c.strokeStyle = GRAPH_COLORS[i];
            c.lineWidth = 1.6;
            c.beginPath();
            arr.forEach(([t, v], k) => (k ? c.lineTo(X(t), Y(v)) : c.moveTo(X(t), Y(v))));
            c.stroke();
        });
    });
}

/* ---------- Comparison ---------- */

function renderCompare() {
    ui.pin.disabled = !latest;
    if (!pinned && !latest) {
        ui.compare.innerHTML = '<p class="es-muted">Finish a run, pin its result, then change something and run again to compare the two side by side.</p>';
        return;
    }
    const keys = Array.from(new Set([...(pinned ? Object.keys(pinned.values) : []), ...(latest ? Object.keys(latest.values) : [])]));
    ui.compare.innerHTML = `<table class="es-table"><thead><tr><th scope="col">Result</th><th scope="col">Pinned${pinned ? `<small>${pinned.name}</small>` : ''}</th><th scope="col">Latest${latest ? `<small>${latest.name}</small>` : ''}</th></tr></thead><tbody>
        ${keys.map(k => `<tr><th scope="row">${k}</th><td>${pinned && pinned.values[k] !== undefined ? pinned.values[k] : '—'}</td><td>${latest && latest.values[k] !== undefined ? latest.values[k] : '—'}</td></tr>`).join('')}
        <tr><th scope="row">Score</th><td>${pinned && pinned.score !== null && pinned.score !== undefined ? pinned.score : '—'}</td><td>${latest && latest.score !== null && latest.score !== undefined ? latest.score : '—'}</td></tr></tbody></table>`;
}

/* ---------- Frame loop ---------- */

function requestFrame() {
    if (!raf) raf = requestAnimationFrame(frame);
}

function gatherInput() {
    const input = { commands: [], throttle: manual.throttle, tiltX: manual.tiltX, tiltZ: manual.tiltZ };
    if (app.replaying) {
        const ev = record.events;
        while (replayCursor < ev.length && ev[replayCursor].i <= stepIndex) {
            const e = ev[replayCursor++];
            if (e.type === 'cmd') input.commands.push(e.id);
            else if (e.type === 'param') { p[e.id] = e.value; syncField(e.id); }
            else if (e.type === 'manual') Object.assign(replayManual, e.v);
        }
        input.throttle = replayManual.throttle;
        input.tiltX = replayManual.tiltX;
        input.tiltZ = replayManual.tiltZ;
        return input;
    }
    input.commands = queued;
    queued = [];
    return input;
}
const replayManual = { throttle: 0, tiltX: 0, tiltZ: 0 };
let lastManual = '';

function updateManual(dt) {
    if (!sc || !sc.manual || p.pilot !== 'manual' || app.replaying) return;
    const k = manual.keys, tch = manual.touch;
    const has = c => k.has(c) || tch.has(c);
    const rate = 0.8;
    if (has('up')) manual.throttle = Math.min(1, manual.throttle + rate * dt);
    if (has('down')) manual.throttle = Math.max(0, manual.throttle - rate * dt);
    manual.tiltX = (has('right') ? 1 : 0) - (has('left') ? 1 : 0);
    manual.tiltZ = (has('back') ? 1 : 0) - (has('fwd') ? 1 : 0);
    const sig = `${manual.throttle.toFixed(3)}|${manual.tiltX}|${manual.tiltZ}`;
    if (sig !== lastManual && app.state === 'running') {
        lastManual = sig;
        recordEvent({ type: 'manual', v: { throttle: manual.throttle, tiltX: manual.tiltX, tiltZ: manual.tiltZ } });
    }
}

function handleEvents(evs) {
    for (const e of evs) {
        if (e.quiet && !(e.kind === 'ap' || e.kind === 'pe')) continue;
        if (e.kind === 'ap' || e.kind === 'pe') {
            // Apsis passages repeat every orbit: keep the log readable
            if ((sim._apsisLogged = (sim._apsisLogged || 0) + 1) > 6) continue;
        }
        logLine(sim.t, e.text, e.level);
        if (e.level === 'ok' || e.level === 'bad') announce(e.text);
    }
}

function frame(now) {
    raf = 0;
    const real = Math.min((now - lastFrame) / 1000, MAX_FRAME);
    lastFrame = now;
    let dtVis = 0;
    if (app.state === 'running' && sim) {
        updateManual(real);
        const dt = sc.dt(p, sim);
        acc += real * sc.scales[scaleIdx];
        let steps = 0;
        while (acc >= dt && steps < MAX_STEPS) {
            const input = gatherInput();
            const ev = sc.step(sim, p, input, dt);
            stepIndex++;
            acc -= dt;
            steps++;
            if (ev.length) handleEvents(ev);
            if (sc.goal && challenge !== 'free' && !sim.metAt && sc.goal(sim, p, challenge)) {
                sim.metAt = sim.t;
                sim.endAt = sim.t + Math.min(3 * sc.scales[scaleIdx], 300);
                logLine(sim.t, 'Goal reached!', 'ok');
                announce('Goal reached.');
            }
            if (steps % 50 === 0) sample(sc.telemetry(sim, p));
            if (sc.finished(sim)) { finish(); break; }
        }
        if (steps >= MAX_STEPS) acc = 0;
        dtVis = real;
        clock += real;
    }
    const tm = sim ? sc.telemetry(sim, p) : null;
    if (tm && app.state === 'running') sample(tm);
    if (world && sim) {
        const preview = sc.preview && app.state !== 'finished' ? sc.preview(sim, p) : null;
        world.sync(sim, tm, p, clock, dtVis, { vectors: app.vectors, preview });
        world.render();
    }
    if (now - lastPanel > 120 || app.state !== 'running') { updatePanel(); lastPanel = now; }
    if (now - lastGraph > 400 || app.state !== 'running') { drawGraphs(); lastGraph = now; }
    if (app.state === 'running' || dirty || (world && world.controls.enableDamping && controlsMoving())) requestFrame();
    dirty = false;
}

let lastCam = '';
function controlsMoving() {
    const s = JSON.stringify(world.cameraState());
    const moving = s !== lastCam;
    lastCam = s;
    return moving;
}

/* ---------- Wiring ---------- */

function setMode(mode) {
    app.mode = mode;
    writeStore(STORE.mode, mode);
    ui.root.dataset.mode = mode;
    ui.modeBasic.setAttribute('aria-pressed', String(mode === 'basic'));
    ui.modePro.setAttribute('aria-pressed', String(mode === 'pro'));
    if (sc) {
        renderParams();
        updatePanel(true);
    }
    announce(mode === 'pro' ? 'Pro mode: every parameter shown.' : 'Basic mode.');
}

ui.modeBasic.addEventListener('click', () => setMode('basic'));
ui.modePro.addEventListener('click', () => setMode('pro'));
ui.hiddenPro.querySelector('button').addEventListener('click', () => setMode('pro'));
ui.start.addEventListener('click', togglePlay);
ui.reset.addEventListener('click', () => { resetRun(); announce('Reset.'); });
ui.replay.addEventListener('click', replay);
ui.slower.addEventListener('click', () => changeScale(-1));
ui.faster.addEventListener('click', () => changeScale(1));
ui.pending.querySelector('button').addEventListener('click', () => resetRun());
$('es-scenarios').addEventListener('click', openSelect);
ui.selectClose.addEventListener('click', closeSelect);
$('es-help-btn').addEventListener('click', () => { ui.help.hidden = false; ui.help.querySelector('button').focus({ preventScroll: true }); });
ui.help.querySelector('button').addEventListener('click', () => { ui.help.hidden = true; });
$('es-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (ui.root.requestFullscreen) ui.root.requestFullscreen().catch(() => {});
});
ui.preset.addEventListener('change', () => {
    presetId = ui.preset.value;
    p = sanitize(sc, { ...p, ...sc.presets.find(x => x.id === presetId).values });
    renderParams();
    resetRun();
    ui.note.textContent = sc.note(p, '', sim) || '';
});
ui.presetReset.addEventListener('click', () => {
    p = sanitize(sc, defaults(sc, presetId));
    applyChallengeValues();
    renderParams();
    resetRun();
    announce('Settings back to the preset.');
});
ui.challenge.addEventListener('change', () => {
    challenge = ui.challenge.value;
    applyChallengeValues();
    renderParams();
    resetRun();
});
ui.debrief.querySelector('[data-action="replay"]').addEventListener('click', replay);
ui.debrief.querySelector('[data-action="again"]').addEventListener('click', () => { resetRun(); start(); });
ui.debrief.querySelector('[data-action="close"]').addEventListener('click', () => { ui.debrief.hidden = true; });
ui.debrief.querySelector('[data-action="scenarios"]').addEventListener('click', () => { ui.debrief.hidden = true; openSelect(); });
ui.pin.addEventListener('click', () => { if (latest) { pinned = latest; renderCompare(); announce('Result pinned for comparison.'); } });
ui.vectors.checked = app.vectors;
ui.vectors.addEventListener('change', () => { app.vectors = ui.vectors.checked; writeStore(STORE.vectors, app.vectors ? 'on' : 'off'); dirty = true; requestFrame(); });
ui.quality.value = app.quality;
ui.quality.addEventListener('change', () => { app.quality = ui.quality.value; writeStore(STORE.quality, app.quality); if (world) world.setQuality(app.quality); dirty = true; requestFrame(); });
ui.follow.addEventListener('click', () => { if (!world) return; world.setFollow(!world.follow); syncControls(); });
for (const b of document.querySelectorAll('[data-cam]')) {
    b.addEventListener('click', () => {
        if (!world) return;
        const a = b.dataset.cam;
        if (a === 'in') world.zoom(0.8);
        else if (a === 'out') world.zoom(1.25);
        else world.resetCamera();
        dirty = true;
        requestFrame();
    });
}

function changeScale(d) {
    scaleIdx = Math.max(0, Math.min(sc.scales.length - 1, scaleIdx + d));
    syncControls();
    announce(`Time ${sc.scales[scaleIdx]} times.`);
}

// Touch and mouse hold buttons for flying the booster by hand
for (const b of ui.pilot.querySelectorAll('[data-hold]')) {
    const key = b.dataset.hold;
    const on = e => { e.preventDefault(); manual.touch.add(key); b.classList.add('is-held'); if (app.state === 'ready' && p.pilot === 'manual') start(); requestFrame(); };
    const off = () => { manual.touch.delete(key); b.classList.remove('is-held'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
}

const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyQ: 'fwd', KeyE: 'back' };
// Text boxes, sliders and menus keep every key for themselves; buttons and links only Space and Enter
function typing(t, e) {
    if (!t) return false;
    if (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return true;
    return /^(BUTTON|SUMMARY|A)$/.test(t.tagName) && (e.code === 'Space' || e.key === 'Enter');
}
document.addEventListener('keydown', e => {
    if (!sc || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!ui.select.hidden || !ui.help.hidden) {
        if (e.key === 'Escape') { if (!ui.help.hidden) ui.help.hidden = true; else if (sc) closeSelect(); }
        return;
    }
    if (document.querySelector('.search-overlay:not([hidden]), .search-modal[open]')) return;
    const inside = ui.root.contains(document.activeElement) || document.activeElement === document.body;
    if (!inside || typing(e.target, e)) {
        if (e.key === 'Escape' && !ui.debrief.hidden) ui.debrief.hidden = true;
        return;
    }
    const manualOn = sc.manual && p.pilot === 'manual' && !app.replaying;
    if (manualOn && KEYMAP[e.code]) {
        manual.keys.add(KEYMAP[e.code]);
        if (app.state === 'ready') start();
        e.preventDefault();
        requestFrame();
        return;
    }
    const key = e.key.toUpperCase();
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
    if (key === 'R') { resetRun(); announce('Reset.'); return; }
    if (key === 'H' || e.key === '?') { ui.help.hidden = false; return; }
    if (key === 'C') { if (world) { world.resetCamera(); requestFrame(); } return; }
    if (key === 'F') { if (world) { world.setFollow(!world.follow); syncControls(); } return; }
    if (e.key === ',' || e.key === '<') { changeScale(-1); return; }
    if (e.key === '.' || e.key === '>') { changeScale(1); return; }
    if (e.key === 'Escape') { if (!ui.debrief.hidden) ui.debrief.hidden = true; else pause(); return; }
    const act = sc.actions.find(a => a.key === key || (a.id === 'stage' && e.key === 'Enter'));
    if (act) { e.preventDefault(); command(act.id); }
});
document.addEventListener('keyup', e => { if (KEYMAP[e.code]) manual.keys.delete(KEYMAP[e.code]); });
window.addEventListener('blur', () => { manual.keys.clear(); manual.touch.clear(); });
ui.view.addEventListener('pointerdown', () => ui.view.focus({ preventScroll: true }));

document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.state === 'running') {
        pause(true);
        logLine(sim.t, 'Paused while the page was hidden', 'info');
    }
});

function resize() {
    if (!world) return;
    const r = ui.view.getBoundingClientRect();
    world.resize(r.width, r.height);
    dirty = true;
    requestFrame();
}
new ResizeObserver(resize).observe(ui.view);
new ResizeObserver(() => drawGraphs(false)).observe(ui.graphs);

function announce(text) {
    ui.live.textContent = '';
    requestAnimationFrame(() => { ui.live.textContent = text; });
}

/* ---------- Start up ---------- */

setMode(app.mode);
const fromHash = scenario(location.hash.slice(1));
loadScenario(fromHash ? fromHash.id : (scenario(readStore(STORE.last, 'engine')) || SCENARIOS[0]).id);
resize();
if (!fromHash) openSelect();
window.addEventListener('hashchange', () => {
    const s = scenario(location.hash.slice(1));
    if (s && (!sc || s.id !== sc.id)) { closeSelect(); loadScenario(s.id); }
});

// For automated checks: run the simulation without waiting for real time, and read its state
window.WSASandbox = {
    get state() { return app.state; }, get scenario() { return sc && sc.id; }, get params() { return { ...p }; }, get sim() { return sim; },
    get mode() { return app.mode; }, get world() { return world; }, telemetry: () => sc.telemetry(sim, p),
    load: id => loadScenario(id), setParam: (id, v) => { setParam(id, v, false); syncField(id); }, command, start, pause, reset: () => resetRun(), replay,
    advance(seconds) {
        if (app.state === 'ready') start();
        const dt = sc.dt(p, sim);
        let n = Math.round(seconds / dt);
        while (n-- > 0 && app.state === 'running') {
            const ev = sc.step(sim, p, gatherInput(), dt);
            stepIndex++;
            if (ev.length) handleEvents(ev);
            if (sc.goal && challenge !== 'free' && !sim.metAt && sc.goal(sim, p, challenge)) { sim.metAt = sim.t; sim.endAt = sim.t + 1; }
            if (sc.finished(sim)) { finish(); break; }
        }
        dirty = true;
        requestFrame();
        return app.state;
    },
};
