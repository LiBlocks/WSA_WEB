// Mission Map (mission-map.html): ties the mission records (mission-map-data.js), the side panel and the
// replay controls to the 3D view (scene.js). Without WebGL the panel and replay timeline still work.
import { BODIES, REGIONS, body, place, describe, children } from './bodies.js';
import { buildRoute, buildPlanned, buildTimeline, sampleTimeline, eventTime, validateMission } from './routes.js';

const $ = id => document.getElementById(id);
const WSA = window.WSA || {};
const DATA = window.WSA_MISSION_MAP || { MISSIONS: [], AWAITING: [], SOURCES: {} };
const STATUSES = WSA.STATUSES || {};
const VEHICLES = WSA.VEHICLES || [];
const COLORS = ['#ffb454', '#5ad1ff', '#7ee2a8', '#c3a6ff', '#ff8f7a', '#f2d86b'];
const RATE = 0.42;            // replay units per second at 1× (a leg takes about 2.4 s)
const MAX_FRAME = 0.1;        // s: a long pause between frames does not fast-forward the replay
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const narrow = window.matchMedia('(max-width: 860px)');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nameOf = id => (place(id) || { name: id }).name;
const programName = p => (p === 'Not recorded' ? 'Program not recorded' : p);
const statusOf = key => STATUSES[key] || { label: key, tone: 'undocumented' };
const vehicleOf = id => VEHICLES.find(v => v.id === id);

const ui = {
    root: $('mm'), stage: $('mm-stage'), canvas: $('mm-canvas'), overlay: $('mm-overlay'), panel: $('mm-panel'),
    loading: $('mm-loading'), error: $('mm-error'), live: $('mm-live'), crumbs: $('mm-crumbs'),
    sheetToggle: $('mm-sheet-toggle'), legendToggle: $('mm-legend-toggle'), legend: $('mm-legend'),
    viewSystem: $('mm-view-system'), viewInner: $('mm-view-inner'), viewFit: $('mm-view-fit'),
    browse: $('mm-browse'), placeView: $('mm-place'), replayView: $('mm-replay'),
    search: $('mm-search'), program: $('mm-program'), list: $('mm-list'), count: $('mm-count'), awaiting: $('mm-awaiting'),
    tree: $('mm-locations'), tabs: [...document.querySelectorAll('.mm-tab')],
    transport: $('mm-transport'), play: $('mm-play'), restart: $('mm-restart'), prev: $('mm-prev'), next: $('mm-next'),
    scrub: $('mm-scrub'), speed: $('mm-speed'), follow: $('mm-follow'), progress: $('mm-progress')
};

/* ---------- Records ---------- */
const missions = [];
DATA.MISSIONS.forEach((m, i) => {
    const problems = validateMission(m, STATUSES, VEHICLES);
    if (problems.length) {
        console.warn(`Mission Map: "${m && m.name}" was left off the map because its record has problems:\n- ${problems.join('\n- ')}`);
        return;
    }
    const actual = m.route ? buildRoute(m.route) : null;
    const planned = (m.planned || []).map(p => buildPlanned(p, actual)).filter(Boolean);
    const ghost = !actual && planned.length > 0;
    const legCount = actual ? actual.legs.length : ghost ? planned[0].legs.length : 0;
    const vehicles = (m.vehicles || []).map(vehicleOf).filter(Boolean);
    missions.push({
        ...m, actual, planned, ghost, color: COLORS[missions.length % COLORS.length],
        timeline: buildTimeline(legCount, m.events),
        vehicleNames: [...vehicles.map(v => v.name), ...(m.craft || [])],
        haystack: [m.name, ...(m.aliases || []), m.program, m.outcome, ...vehicles.map(v => [v.name, ...(v.aliases || [])].join(' ')),
            ...(m.craft || []), ...m.locations.map(nameOf)].join(' ').toLowerCase()
    });
});
const missionById = new Map(missions.map(m => [m.id, m]));

// Places under a body: its moons (and theirs) and its regions
function nestedPlaces(id) {
    const out = [];
    REGIONS.filter(r => r.parent === id && r.id !== 'solar').forEach(r => out.push(r.id));
    children(id).forEach(b => out.push(b.id, ...nestedPlaces(b.id)));
    return out;
}
function missionsAt(id) {
    const key = id === 'kerbol' ? 'solar' : id;
    const direct = missions.filter(m => m.locations.includes(key));
    const nested = key === 'solar' ? [] : nestedPlaces(key);
    const around = missions.filter(m => !direct.includes(m) && m.locations.some(l => nested.includes(l)));
    return { direct, around };
}

/* ---------- 3D view ---------- */
let scene = null;
function showError(title, text) {
    ui.loading.hidden = true;
    ui.error.hidden = false;
    ui.error.querySelector('.mm-card-title').textContent = title;
    ui.error.querySelector('.mm-card-text').textContent = text;
    ui.root.classList.add('is-flat');
    [ui.viewSystem, ui.viewInner, ui.viewFit, ui.follow].forEach(b => { b.disabled = true; });
}
try {
    const { createScene } = await import('./scene.js');
    try {
        scene = createScene({
            canvas: ui.canvas, stage: ui.stage, overlay: ui.overlay, reducedMotion: () => reduceMotion.matches,
            hooks: {
                onPick: id => (id ? selectPlace(id, { from: 'map' }) : null),
                onHover: id => { state.hover = id; scene.hover(id); },
                onEvent: k => jumpToEvent(k),
                onUserCamera: kind => { if (kind !== 'rotate' && replay.follow) setFollow(false, true); }
            }
        });
    } catch (err) {
        showError('3D graphics are unavailable', 'This browser or device could not start WebGL, which the 3D map needs. You can still browse every mission and step through its timeline in the panel.');
        console.info('Mission Map: WebGL could not start.', err);
    }
} catch (err) {
    showError('The 3D engine could not load', 'The map\'s 3D library (three.js) did not load. Check your connection and reload the page. The mission list and timelines below still work.');
    console.info('Mission Map: three.js did not load.', err);
}
if (scene) {
    ui.loading.hidden = true;
    ui.canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        showError('The 3D view stopped', 'The graphics context was lost (this can happen when a device is busy or wakes from sleep). Reload the page to see the map again; the panel still works.');
        scene = null;
    });
    new ResizeObserver(() => { scene && scene.resize(); syncInset(); }).observe(ui.stage);
    new IntersectionObserver(entries => { if (scene) scene.setVisible(entries[0].isIntersecting); }).observe(ui.stage);
}

/* ---------- State ---------- */
const state = { view: 'browse', place: null, mission: null, hover: null, tab: 'missions', returnTo: null };
const replay = { u: 0, playing: false, speed: 1, follow: true, event: -1, autoplayAt: 0, scrubbing: false };

function announce(text) {
    ui.live.textContent = '';
    requestAnimationFrame(() => { ui.live.textContent = text; });
}

function setUrl() {
    const url = new URL(location.href);
    url.searchParams.delete('mission');
    url.searchParams.delete('place');
    if (state.view === 'replay' && state.mission) url.searchParams.set('mission', state.mission.id);
    else if (state.view === 'place' && state.place) url.searchParams.set('place', state.place);
    history.replaceState(null, '', url);
}

function showView(view) {
    if (view !== state.view) ui.panel.scrollTop = 0;
    state.view = view;
    ui.browse.hidden = view !== 'browse';
    ui.placeView.hidden = view !== 'place';
    ui.replayView.hidden = view !== 'replay';
    ui.transport.hidden = view !== 'replay';
    ui.viewFit.hidden = view !== 'replay';
    ui.root.dataset.view = view;
    renderCrumbs();
    setUrl();
    syncInset();
}

/* ---------- Mission cards ---------- */
function destinations(m) {
    const names = m.locations.filter(id => body(id) && id !== 'kerbin' && id !== 'kerbol').map(nameOf);
    return names.length ? names.join(', ') : 'Kerbin';
}
function card(m) {
    const s = statusOf(m.status);
    return `<li><button type="button" class="mm-mission" data-mission="${esc(m.id)}" style="--route: ${m.color}">
        <span class="mm-mission-head"><span class="mm-swatch" aria-hidden="true"></span><span class="mm-mission-name">${esc(m.name)}</span>
            <span class="status ${s.tone}">${esc(s.label)}</span></span>
        <span class="mm-mission-meta">${esc(programName(m.program))} · ${esc(destinations(m))}</span>
        ${m.outcome ? `<span class="mm-mission-outcome">${esc(m.outcome)}</span>` : ''}
        <span class="mm-mission-summary">${esc(m.summary)}</span>
        <span class="mm-mission-open">${m.timeline.items.length > 1 ? 'Replay mission' : 'View record'} <span aria-hidden="true">→</span></span>
    </button></li>`;
}

function renderBrowse() {
    const q = ui.search.value.trim().toLowerCase(), program = ui.program.value;
    const words = q.split(/\s+/).filter(Boolean);
    const shown = missions.filter(m => (!program || m.program === program) && words.every(w => m.haystack.includes(w)));
    ui.list.innerHTML = shown.map(card).join('');
    ui.count.textContent = shown.length === missions.length ? `${missions.length} missions` : `${shown.length} of ${missions.length} missions`;
    if (!shown.length) ui.list.innerHTML = '<li class="mm-empty">No missions match. Try another name, destination, program or vehicle.</li>';
}

function renderAwaiting() {
    ui.awaiting.innerHTML = (DATA.AWAITING || []).map(a => {
        const v = a.vehicle && vehicleOf(a.vehicle);
        return `<li><strong>${esc(a.name)}</strong> ${esc(a.note)}${v ? ` <a href="vehicles-programs.html?vehicle=${esc(v.id)}#hangar">${esc(v.name)} in the Hangar</a>` : ''}</li>`;
    }).join('');
}

function renderTree() {
    const count = id => missionsAt(id).direct.length;
    const row = (id, name, extra = '') => {
        const n = count(id);
        return `<button type="button" class="mm-place-btn" data-place="${id}"><span>${esc(name)}</span>${extra}<span class="mm-place-count" aria-label="${n} missions">${n || ''}</span></button>`;
    };
    const opm = b => (b.opm ? '<span class="mm-opm" title="Added or moved by the Outer Planets Mod">OPM</span>' : '');
    const node = b => {
        const regions = REGIONS.filter(r => r.parent === b.id && r.id !== 'solar');
        const moons = children(b.id);
        const sub = [...regions.map(r => `<li>${row(r.id, r.name)}</li>`), ...moons.map(node)];
        return `<li>${row(b.id, b.name, opm(b))}${sub.length ? `<ul>${sub.join('')}</ul>` : ''}</li>`;
    };
    ui.tree.innerHTML = `<ul>
        <li>${row('kerbol', 'Kerbol')}<ul><li>${row('solar', 'Interplanetary space')}</li>${children('kerbol').map(node).join('')}</ul></li>
    </ul>`;
}

function setTab(tab) {
    state.tab = tab;
    ui.tabs.forEach(t => {
        const on = t.dataset.tab === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !on;
    });
}

/* ---------- Places ---------- */
function selectPlace(id, { from, focus = from !== 'map' } = {}) {
    if (!place(id)) return;
    stopReplay();
    state.place = id;
    state.mission = null;
    if (scene) {
        scene.clearMission();
        scene.select(id);
        scene.focusPlace(id);
    }
    const p = place(id);
    const { direct, around } = missionsAt(id);
    const title = id === 'kerbol' ? 'Kerbol and interplanetary space' : p.name;
    $('mm-place-title').textContent = title;
    $('mm-place-kind').textContent = describe(id);
    $('mm-place-note').textContent = p.note || '';
    $('mm-place-note').hidden = !p.note;
    $('mm-place-list').innerHTML = direct.length ? direct.map(card).join('') : '<li class="mm-empty">No documented WSA missions here yet.</li>';
    $('mm-place-count').textContent = `${direct.length} ${direct.length === 1 ? 'mission' : 'missions'}`;
    const aroundWrap = $('mm-place-around-wrap');
    aroundWrap.hidden = !around.length;
    $('mm-place-around').innerHTML = around.map(card).join('');
    showView('place');
    openSheet(true);
    if (focus) ui.placeView.querySelector('h2').focus({ preventScroll: true });
    announce(`${title}: ${direct.length} ${direct.length === 1 ? 'mission' : 'missions'}.`);
}

function backToBrowse() {
    stopReplay();
    state.place = null;
    state.mission = null;
    if (scene) { scene.clearMission(); scene.select(null); scene.overview('system'); }
    showView('browse');
    renderBrowse();
}

/* ---------- Replay ---------- */
const BASIS = { site: 'Documented on this site', operator: 'From the operator\'s history' };
function sourceLink(e) {
    const s = DATA.SOURCES[e.source];
    if (!s || e.basis === 'operator') return '';   // the basis tag already says so
    return s.href ? `<a href="${esc(s.href)}">${esc(s.label)}</a>` : esc(s.label);
}

function openMission(id, { returnTo, focus = true } = {}) {
    const m = missionById.get(id);
    if (!m) return;
    state.mission = m;
    state.returnTo = returnTo !== undefined ? returnTo : state.view === 'place' ? state.place : null;
    const s = statusOf(m.status);
    $('mm-replay-title').textContent = m.name;
    $('mm-replay-status').className = `status ${s.tone}`;
    $('mm-replay-status').textContent = s.label;
    $('mm-replay-meta').textContent = [programName(m.program), m.vehicleNames.length ? m.vehicleNames.join(', ') : null].filter(Boolean).join(' · ');
    $('mm-replay-outcome').textContent = m.outcome || '';
    $('mm-replay-outcome').hidden = !m.outcome;
    $('mm-replay-summary').textContent = m.summary;
    $('mm-replay-note').textContent = m.replayNote || '';
    $('mm-replay-route-kind').textContent = m.ghost ? 'Planned route only: not flown' : m.actual && m.actual.legs.length ? 'Schematic route' : 'No route recorded';
    $('mm-replay-swatch').style.setProperty('--route', m.color);
    $('mm-replay-swatch').classList.toggle('is-planned', m.ghost);
    $('mm-events').innerHTML = m.events.map((e, k) => `<li><button type="button" class="mm-step${e.kind ? ` is-${e.kind}` : ''}" data-event="${k}">
        <span class="mm-step-n">${k + 1}</span><span class="mm-step-title">${esc(e.title)}</span>
        ${e.kind === 'planned' ? '<span class="mm-basis is-planned">Planned</span>' : ''}</button></li>`).join('');
    const list = (el, items) => { $(el).innerHTML = (items || []).map(t => `<li>${esc(t)}</li>`).join(''); $(`${el}-wrap`).hidden = !(items || []).length; };
    list('mm-notes', m.notes);
    list('mm-conflicts', m.conflicts);
    const links = [...(m.links || []), ...(m.vehicles || []).map(vehicleOf).filter(Boolean).map(v => ({ label: `${v.name} in the Hangar`, href: `vehicles-programs.html?vehicle=${v.id}#hangar` }))];
    $('mm-links').innerHTML = links.map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('');
    $('mm-links-wrap').hidden = !links.length;
    $('mm-replay-back').textContent = state.returnTo ? `← ${state.returnTo === 'kerbol' ? 'Kerbol' : nameOf(state.returnTo)}` : '← All missions';

    const canPlay = m.timeline.total > 0 && m.timeline.items.length > 1;
    [ui.play, ui.restart, ui.scrub].forEach(el => { el.disabled = !canPlay; });
    if (scene) {
        scene.select(null);
        scene.showMission({ color: m.color, actual: m.actual, planned: m.planned, ghost: m.ghost, events: m.events, endOrbit: m.route && m.route.endOrbit });
        scene.frameRoute();
    }
    showView('replay');
    openSheet(true);
    replay.u = 0;
    replay.event = -2;
    replay.playing = false;
    setFollow(true);
    applyReplay();
    if (canPlay && !reduceMotion.matches) replay.autoplayAt = performance.now() + (scene ? 1200 : 300);
    if (focus) ui.replayView.querySelector('h2').focus({ preventScroll: true });
    announce(`Replay: ${m.name}. ${m.events.length} ${m.events.length === 1 ? 'event' : 'events'}.`);
}

function closeMission() {
    const back = state.returnTo;
    stopReplay();
    if (scene) scene.clearMission();
    if (back) selectPlace(back);
    else backToBrowse();
}

function stopReplay() {
    replay.playing = false;
    replay.autoplayAt = 0;
    if (scene) scene.setFollow(false);
    syncTransport();
}

function setFollow(on, fromUser) {
    replay.follow = on;
    ui.follow.setAttribute('aria-pressed', String(on));
    if (scene) scene.setFollow(on && state.view === 'replay' && (replay.playing || replay.u > 0));
    if (fromUser) announce(on ? 'Camera follows the mission.' : 'Camera follow off.');
}

function setPlaying(on) {
    const m = state.mission;
    if (!m) return;
    if (on && replay.u >= m.timeline.total - 1e-6) replay.u = 0;
    replay.playing = on;
    replay.autoplayAt = 0;
    if (scene) scene.setFollow(replay.follow && (on || replay.u > 0));
    syncTransport();
}

function jumpToEvent(k) {
    const m = state.mission;
    if (!m) return;
    k = Math.max(0, Math.min(m.events.length - 1, k));
    replay.u = eventTime(m.timeline, k) + 1e-4;
    replay.autoplayAt = 0;
    if (scene) scene.setFollow(replay.follow);
    applyReplay(true);
}

function stepEvent(delta) {
    const m = state.mission;
    if (!m) return;
    const cur = replay.event;
    if (delta < 0 && cur >= 0 && replay.u > eventTime(m.timeline, cur) + 0.05) jumpToEvent(cur);
    else jumpToEvent(cur + delta);
}

function syncTransport() {
    ui.play.setAttribute('aria-label', replay.playing ? 'Pause' : 'Play');
    ui.play.dataset.state = replay.playing ? 'playing' : 'paused';
    ui.play.title = replay.playing ? 'Pause' : 'Play';
}

function applyReplay(fromUser) {
    const m = state.mission;
    if (!m) return;
    const tl = m.timeline, s = sampleTimeline(tl, replay.u);
    const e = s.event >= 0 ? m.events[s.event] : null;
    if (scene) scene.setReplay(s.routePos, s.event, e && e.focus ? e.focus : []);
    if (!replay.scrubbing) ui.scrub.value = tl.total ? Math.round(replay.u / tl.total * 1000) : 0;
    const pct = tl.total ? Math.round(replay.u / tl.total * 100) : 100;
    ui.progress.textContent = `${s.event >= 0 ? `Event ${s.event + 1} of ${m.events.length}` : 'Start'} · ${pct}%`;
    ui.scrub.setAttribute('aria-valuetext', e ? `Event ${s.event + 1} of ${m.events.length}: ${e.title}` : 'Start of the mission');
    ui.prev.disabled = s.event <= 0 && replay.u <= (s.event >= 0 ? eventTime(tl, s.event) + 0.05 : 0);
    ui.next.disabled = s.event >= m.events.length - 1;
    if (s.event !== replay.event) {
        replay.event = s.event;
        const now = $('mm-now');
        if (e) {
            $('mm-now-step').textContent = `Event ${s.event + 1} of ${m.events.length}`;
            $('mm-now-title').textContent = e.title;
            $('mm-now-text').textContent = e.text;
            const tag = $('mm-now-basis');
            tag.textContent = e.kind === 'planned' ? 'Planned, not flown' : BASIS[e.basis];
            tag.className = `mm-basis is-${e.kind === 'planned' ? 'planned' : e.basis}`;
            $('mm-now-source').innerHTML = sourceLink(e) ? `Source: ${sourceLink(e)}` : '';
            $('mm-now-place').textContent = e.noMarker ? 'Where this happened is not recorded.' : '';
            $('mm-now-date').textContent = e.date ? `Date: ${e.date}` : '';
            $('mm-now-date').hidden = !e.date;
            now.classList.toggle('is-decision', e.kind === 'decision');
        } else {
            $('mm-now-step').textContent = 'Start';
            $('mm-now-title').textContent = m.ghost ? 'Planned mission' : 'Mission start';
            $('mm-now-text').textContent = m.ghost ? 'This mission has not flown. The route shown is its plan.' : 'Press Play, or pick an event below.';
            $('mm-now-basis').textContent = '';
            $('mm-now-basis').className = 'mm-basis';
            $('mm-now-source').innerHTML = '';
            $('mm-now-place').textContent = '';
            $('mm-now-date').hidden = true;
            now.classList.remove('is-decision');
        }
        ui.replayView.querySelectorAll('.mm-step').forEach(b => {
            const k = Number(b.dataset.event);
            b.classList.toggle('is-past', k < s.event);
            if (k === s.event) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
        if (e && (fromUser || !replay.playing)) announce(`Event ${s.event + 1} of ${m.events.length}: ${e.title}. ${e.text}`);
    }
    if (replay.u >= tl.total - 1e-9 && replay.playing) { replay.playing = false; syncTransport(); }
}

/* ---------- Crumbs, sheet and toolbar ---------- */
function renderCrumbs() {
    const parts = [['system', 'Kerbol system']];
    const chain = id => {
        const r = REGIONS.find(x => x.id === id);
        const out = [];
        for (let b = body(r ? r.parent : id); b && b.id !== 'kerbol'; b = body(b.parent)) out.unshift([b.id, b.name]);
        if (r && r.id !== 'solar') out.push([r.id, r.name]);
        if (r && r.id === 'solar') out.push(['solar', r.name]);
        return out;
    };
    if (state.view === 'place' && state.place && state.place !== 'kerbol') parts.push(...chain(state.place));
    if (state.view === 'replay' && state.mission) parts.push(['mission', state.mission.name]);
    ui.crumbs.innerHTML = parts.map(([id, name], i) => i === parts.length - 1
        ? `<li><span aria-current="location">${esc(name)}</span></li>`
        : `<li><button type="button" data-crumb="${id}">${esc(name)}</button></li>`).join('');
}

function openSheet(open) {
    if (!narrow.matches) return;
    ui.root.classList.toggle('sheet-open', open);
    ui.sheetToggle.setAttribute('aria-expanded', String(open));
    ui.sheetToggle.setAttribute('aria-label', open ? 'Collapse panel' : 'Expand panel');
    syncInset();
}

// On narrow screens the panel covers the bottom of the map: tell the view so it centres above it
function syncInset() {
    requestAnimationFrame(() => {
        let inset = 0;
        if (narrow.matches) {
            const s = ui.stage.getBoundingClientRect(), p = ui.panel.getBoundingClientRect();
            inset = Math.max(0, s.bottom - Math.max(p.top, s.top));
        }
        ui.root.style.setProperty('--inset', `${inset}px`);
        if (scene) scene.setBottomInset(inset);
    });
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
    const missionBtn = e.target.closest('[data-mission]');
    if (missionBtn && ui.root.contains(missionBtn)) { openMission(missionBtn.dataset.mission); return; }
    const placeBtn = e.target.closest('[data-place]');
    if (placeBtn && ui.root.contains(placeBtn)) { selectPlace(placeBtn.dataset.place); return; }
    const step = e.target.closest('.mm-step');
    if (step) { jumpToEvent(Number(step.dataset.event)); return; }
    const crumb = e.target.closest('[data-crumb]');
    if (crumb) {
        const id = crumb.dataset.crumb;
        if (id === 'system') backToBrowse(); else selectPlace(id);
    }
});
ui.search.addEventListener('input', renderBrowse);
ui.program.addEventListener('change', renderBrowse);
ui.tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = ui.tabs[(i + (e.key === 'ArrowRight' ? 1 : ui.tabs.length - 1)) % ui.tabs.length];
        setTab(next.dataset.tab);
        next.focus();
    });
});
$('mm-place-back').addEventListener('click', backToBrowse);
$('mm-place-focus').addEventListener('click', () => scene && scene.focusPlace(state.place));
$('mm-replay-back').addEventListener('click', closeMission);
ui.play.addEventListener('click', () => setPlaying(!replay.playing));
ui.restart.addEventListener('click', () => { replay.u = 0; replay.event = -2; applyReplay(true); setPlaying(true); });
ui.prev.addEventListener('click', () => stepEvent(-1));
ui.next.addEventListener('click', () => stepEvent(1));
ui.scrub.addEventListener('input', () => {
    const m = state.mission;
    if (!m) return;
    replay.scrubbing = true;
    replay.playing = false;
    replay.autoplayAt = 0;
    replay.u = Number(ui.scrub.value) / 1000 * m.timeline.total;
    if (scene) scene.setFollow(replay.follow);
    syncTransport();
    applyReplay();
    replay.scrubbing = false;
});
ui.speed.addEventListener('change', () => { replay.speed = Number(ui.speed.value) || 1; });
ui.follow.addEventListener('click', () => setFollow(!replay.follow, true));
ui.viewSystem.addEventListener('click', () => { if (scene) { setFollow(false); scene.overview('system'); } });
ui.viewInner.addEventListener('click', () => { if (scene) { setFollow(false); scene.overview('inner'); } });
ui.viewFit.addEventListener('click', () => { if (scene) { setFollow(false); scene.frameRoute(); } });
ui.sheetToggle.addEventListener('click', () => openSheet(!ui.root.classList.contains('sheet-open')));
ui.legendToggle.addEventListener('click', () => {
    const open = ui.legend.hidden;
    ui.legend.hidden = !open;
    ui.legendToggle.setAttribute('aria-expanded', String(open));
});
ui.root.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (!ui.legend.hidden) { ui.legend.hidden = true; ui.legendToggle.setAttribute('aria-expanded', 'false'); ui.legendToggle.focus(); return; }
        if (state.view === 'replay') closeMission();
        else if (state.view === 'place') backToBrowse();
    }
});
narrow.addEventListener('change', () => { ui.root.classList.remove('sheet-open'); syncInset(); syncFab(); });

// On a phone the map fills the screen and the site's floating menu button would cover the panel; it comes
// back as soon as the page is scrolled away from the map (the header's menu button works throughout)
let mapCover = 0;
function syncFab() { document.body.classList.toggle('mm-fills-screen', narrow.matches && mapCover > 0.6); }
new IntersectionObserver(entries => { mapCover = entries[0].intersectionRatio; syncFab(); }, { threshold: [0, 0.3, 0.6, 0.8, 1] }).observe(ui.root);
ui.panel.addEventListener('transitionend', syncInset);

/* ---------- Loop ---------- */
let last = performance.now();
function loop(now) {
    const dt = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
    last = now;
    if (replay.autoplayAt && now >= replay.autoplayAt) setPlaying(true);
    if (state.mission && replay.playing) {
        replay.u = Math.min(state.mission.timeline.total, replay.u + dt * RATE * replay.speed);
        applyReplay();
    }
    if (scene) scene.frame(dt);
    requestAnimationFrame(loop);
}

/* ---------- Start ---------- */
const programs = [...new Set(missions.map(m => m.program))].sort((a, b) => (a === 'Not recorded') - (b === 'Not recorded') || a.localeCompare(b));
ui.program.innerHTML = '<option value="">All programs</option>' + programs.map(p => `<option value="${esc(p)}">${esc(p === 'Not recorded' ? 'Program not recorded' : p)}</option>`).join('');
const params = new URLSearchParams(location.search);   // read before showView() rewrites the address
renderBrowse();
renderAwaiting();
renderTree();
setTab('missions');
showView('browse');
syncTransport();
if (params.get('mission') && missionById.has(params.get('mission'))) openMission(params.get('mission'), { returnTo: null, focus: false });
else if (params.get('place') && place(params.get('place'))) selectPlace(params.get('place'), { focus: false });
requestAnimationFrame(loop);

// For tests and debugging
window.__missionMap = {
    missions: missions.map(m => m.id), state, replay, scene: () => scene && scene.debug(),
    bodies: BODIES.map(b => ({ id: b.id, parent: b.parent || null, kind: b.kind, opm: !!b.opm })),
    missionsAt: id => { const r = missionsAt(id); return { direct: r.direct.map(m => m.id), around: r.around.map(m => m.id) }; }
};
