// SSTO Landing HUD: the flight computer readouts over the view, the attitude indicator, the flight-path
// marker and the mouse indicator (SVG, projected from the 3D world), and the instrument panel below
// the view. Text only changes when its value does, so the DOM isn't rebuilt every frame.
import { RUNWAY, GLIDE } from './layout.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
}

// Set text (and an optional level for colour) only when it changed
function writer(node) {
    let last = null, lastLevel = null;
    return (text, level) => {
        if (text !== last) { node.textContent = text; last = text; }
        if (level !== undefined && level !== lastLevel) { node.dataset.level = level; lastLevel = level; }
    };
}

const fmtSide = (v, unit = 'm') => Math.abs(v) < 0.5 ? `0 ${unit}` : `${Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v))} ${unit} ${v < 0 ? 'L' : 'R'}`;
const fmtDeg = v => Math.abs(v) < 0.05 ? '0.0°' : `${Math.abs(v).toFixed(1)}° ${v < 0 ? 'L' : 'R'}`;

export function createHud(root) {
    const $ = sel => root.querySelector(sel);
    const w = {
        phase: writer($('.ld-phase')), advice: writer($('.ld-advice')),
        speed: writer($('[data-h="speed"]')), gs: writer($('[data-h="gs"]')),
        alt: writer($('[data-h="alt"]')), vs: writer($('[data-h="vs"]')),
        dist: writer($('[data-h="dist"]')), center: writer($('[data-h="center"]')),
        hdg: writer($('[data-h="hdg"]')), path: writer($('[data-h="path"]')),
        assist: writer($('[data-chip="assist"]')), gear: writer($('[data-chip="gear"]')),
        brake: writer($('[data-chip="brake"]')), stall: writer($('[data-chip="stall"]')),
        thr: writer($('[data-h="thr"]')),
    };
    const stallChip = $('[data-chip="stall"]'), brakeChip = $('[data-chip="brake"]');
    const thrFill = $('.ld-thr-fill'), thrSliderFill = $('.ld-thr-slider-fill'), thrSliderText = writer($('.ld-thr-slider-text'));
    const speedBox = $('[data-h="speed"]').closest('.ld-tape'), vsBox = $('[data-h="vs"]');
    const adi = $('.ld-adi-horizon');
    const adiBank = writer($('.ld-adi-bank'));
    const advice = $('.ld-advice');

    // Overlay symbols: flight-path marker, aiming point, mouse indicator
    const svg = $('.ld-svg');
    const fpm = el('g', { class: 'ld-fpm' }, svg);
    el('circle', { r: 7, class: 'halo' }, fpm);
    el('path', { d: 'M -18 0 H -7 M 7 0 H 18 M 0 -7 V -13', class: 'halo' }, fpm);
    el('circle', { r: 7, class: 'main' }, fpm);
    el('path', { d: 'M -18 0 H -7 M 7 0 H 18 M 0 -7 V -13', class: 'main' }, fpm);
    const aim = el('g', { class: 'ld-aim' }, svg);
    el('path', { d: 'M 0 -9 L 9 0 L 0 9 L -9 0 Z', class: 'halo' }, aim);
    el('path', { d: 'M 0 -9 L 9 0 L 0 9 L -9 0 Z', class: 'main' }, aim);
    const mouseG = el('g', { class: 'ld-mouse' }, svg);
    const mouseRing = el('circle', { r: 10, class: 'ring' }, mouseG);
    const mouseOuter = el('circle', { r: 100, class: 'outer' }, mouseG);
    const mouseLine = el('line', { class: 'line' }, mouseG);
    const mouseDot = el('circle', { r: 6, class: 'dot' }, mouseG);
    let vw = 1, vh = 1;

    const show = (g, on) => { g.style.display = on ? '' : 'none'; };

    return {
        resize(width, height) {
            vw = width;
            vh = height;
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        },
        /**
         * tm: telemetry; o: { assist, throttle, touch, project(p), pos, vel, running, mouse: {on, x, y} | null }
         */
        draw(tm, o) {
            w.phase(tm.phase, tm.phase === 'FAILED' || tm.stall ? 'alert' : tm.phase === 'FLARE' || tm.phase === 'BOUNCE' ? 'warn' : 'info');
            w.speed(tm.airspeed.toFixed(0), tm.airspeed > 100 || tm.stall ? 'alert' : tm.airspeed < 52 ? 'warn' : 'ok');
            w.gs(`GS ${tm.groundSpeed.toFixed(0)}`);
            speedBox.dataset.level = tm.stall ? 'alert' : 'ok';
            w.alt(tm.alt < 100 ? tm.alt.toFixed(1) : tm.alt.toFixed(0));
            const sink = -tm.vs;
            w.vs(`${tm.vs >= 0 ? '▲' : '▼'} ${Math.abs(tm.vs).toFixed(1)}`, tm.mode !== 'air' ? 'ok' : sink > 6 || (tm.alt < 15 && sink > 3) ? 'alert' : tm.alt < 30 && sink > 2 ? 'warn' : 'ok');
            vsBox.title = 'Vertical speed, m/s';
            w.dist(tm.along < 0 ? `${(tm.distance / 1000).toFixed(tm.distance < 10000 ? 2 : 1)} km` : `${Math.round(tm.along)} m in`);
            w.center(fmtSide(tm.x), Math.abs(tm.x) > 25 ? 'warn' : 'ok');
            w.hdg(fmtDeg(tm.heading), Math.abs(tm.heading) > 6 && tm.distance < 1500 ? 'warn' : 'ok');
            if (tm.mode === 'air' && tm.along < GLIDE.aim) {
                const d = tm.glideDev;
                w.path(Math.abs(d) < 6 ? 'on path' : `${d > 0 ? 'high' : 'low'} ${Math.round(Math.abs(d))} m`, Math.abs(d) > 25 ? 'warn' : 'ok');
            } else w.path('—', 'ok');
            w.assist(`ASSIST ${o.assist ? 'ON' : 'OFF'}`, o.assist ? 'ok' : 'warn');
            w.gear(tm.gearMoving ? 'GEAR …' : `GEAR ${tm.gearDown ? 'DOWN' : 'UP'}`,
                tm.gearDown ? 'ok' : (tm.distance < GLIDE.final || tm.alt < 200) && tm.mode === 'air' ? 'alert' : 'warn');
            const braking = tm.brake > 0.05;
            brakeChip.hidden = !braking && tm.mode !== 'ground';
            w.brake(tm.autobrake && tm.brake < 0.5 ? 'AUTOBRAKE' : braking ? 'BRAKE' : 'BRAKE OFF', braking ? 'ok' : 'warn');
            stallChip.hidden = !tm.stall;
            w.stall('STALL');
            const pct = Math.round(o.throttle * 100);
            w.thr(`THR ${pct}%`);
            thrFill.style.transform = `scaleY(${o.throttle.toFixed(3)})`;
            thrSliderFill.style.transform = `scaleY(${o.throttle.toFixed(3)})`;
            thrSliderText(`${pct}%`);
            // Attitude indicator: the horizon turns against the bank and moves with the pitch
            adi.setAttribute('transform', `rotate(${(-tm.bank).toFixed(1)}) translate(0 ${(tm.pitch * 1.6).toFixed(1)})`);
            adiBank(`${Math.abs(tm.bank).toFixed(0)}°`);

            // Flight-path marker: where the aircraft is heading, a few seconds ahead
            const ahead = [o.pos[0] + o.vel[0] * 5, o.pos[1] + o.vel[1] * 5, o.pos[2] + o.vel[2] * 5];
            const p = o.project(ahead);
            const showFpm = o.running && tm.mode === 'air' && p.front && Math.hypot(o.vel[0], o.vel[2]) > 5;
            show(fpm, showFpm);
            if (showFpm) fpm.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
            const a = o.project([0, 0, -GLIDE.aim - 25]);
            const showAim = o.running && o.assist && tm.mode === 'air' && a.front && tm.along < GLIDE.aim;
            show(aim, showAim);
            if (showAim) aim.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`);

            // Mouse indicator: the neutral ring at the centre and where the pointer is
            const m = o.mouse;
            show(mouseG, !!m && o.running);
            if (m && o.running) {
                const reach = Math.min(vw, vh) * 0.32;
                const cx = vw / 2, cy = vh / 2;
                mouseRing.setAttribute('cx', cx); mouseRing.setAttribute('cy', cy);
                mouseOuter.setAttribute('cx', cx); mouseOuter.setAttribute('cy', cy);
                mouseOuter.setAttribute('r', reach.toFixed(0));
                const mx = cx + m.x * reach, my = cy + m.y * reach;
                mouseDot.setAttribute('cx', mx.toFixed(1)); mouseDot.setAttribute('cy', my.toFixed(1));
                mouseLine.setAttribute('x1', cx); mouseLine.setAttribute('y1', cy);
                mouseLine.setAttribute('x2', mx.toFixed(1)); mouseLine.setAttribute('y2', my.toFixed(1));
                mouseG.classList.toggle('idle', !m.inside);
            }
        },
        advise(msg) {
            w.advice(msg.text, msg.level);
            advice.hidden = !msg.text;
        },
    };
}

// The instrument panel below the view
export function createDash(root) {
    const t = {};
    root.querySelectorAll('[data-t]').forEach(node => { t[node.dataset.t] = writer(node); });
    const sgn = (v, d) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
    return {
        update(tm, o) {
            t.ias(`${tm.airspeed.toFixed(1)} m/s`);
            t.gs(`${tm.groundSpeed.toFixed(1)} m/s`);
            t.vs(`${sgn(tm.vs, 1)} m/s`);
            t.aoa(`${tm.alpha.toFixed(1)}°`, tm.stall ? 'warn' : undefined);
            t.thr(`${Math.round(o.throttle * 100)}%`);
            t.alt(`${tm.alt.toFixed(1)} m`);
            t.dist(tm.along < 0 ? `${Math.round(tm.distance)} m` : `${Math.round(tm.along)} m past`);
            t.center(fmtSide(tm.x));
            t.path(tm.mode === 'air' && tm.along < GLIDE.aim ? `${sgn(tm.glideDev, 0)} m` : '—');
            t.pitch(`${sgn(tm.pitch, 1)}°`);
            t.bank(`${sgn(tm.bank, 1)}°`);
            t.hdg(fmtDeg(tm.heading));
            t.slip(`${sgn(tm.beta, 1)}°`);
            t.attempt(String(o.session.attempt));
            t.landings(`${o.session.landings} of ${o.session.attempts}`);
            t.rate(o.session.attempts ? `${Math.round(o.session.landings / o.session.attempts * 100)}%` : '—');
            t.scenario(o.scenario);
            t.remaining(`${Math.round(Math.max(0, RUNWAY.length - Math.max(0, tm.along)))} m`);
        },
    };
}
