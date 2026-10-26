// Docking Simulator HUD: the green symbology drawn over the docking camera view (SVG, recomputed every
// frame from the simulation), and the instrument panel's telemetry readouts below the view.
import { corridorAt, DOCKING } from './physics.js';

const NS = 'http://www.w3.org/2000/svg';
const GATES = [2, 4, 7, 10, 15, 20, 30, 45, 60, 80, 100, 130, 160, 200];   // corridor gates, m from the port
const MAX_GATES = 7;

function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
}

// A symbol drawn twice: a dark halo for contrast, then the green line on top
function symbol(parent, cls) {
    const g = el('g', { class: cls }, parent);
    const halo = el('path', { class: 'halo' }, g);
    const main = el('path', { class: 'main' }, g);
    let shown = true, last = '';
    return {
        g,
        draw(d) {
            if (d !== last) { halo.setAttribute('d', d); main.setAttribute('d', d); last = d; }
            if (!shown) { g.style.display = ''; shown = true; }
        },
        hide() { if (shown) { g.style.display = 'none'; shown = false; } },
        set(cls2, on) { g.classList.toggle(cls2, on); },
    };
}

const f1 = v => v.toFixed(1);
const circle = (x, y, r) => `M ${f1(x - r)} ${f1(y)} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
const chevron = (x, y, angle, size = 7) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const pt = (u, v) => `${f1(x + u * c - v * s)} ${f1(y + u * s + v * c)}`;
    return `M ${pt(-size * 0.6, -size)} L ${pt(size * 0.6, 0)} L ${pt(-size * 0.6, size)}`;
};

export function createHud(svg) {
    let W = 1, H = 1;

    // Liang–Barsky: the part of the segment a→b inside the view, as a path, or ''
    function segment(x0, y0, x1, y1) {
        let t0 = 0, t1 = 1;
        const dx = x1 - x0, dy = y1 - y0;
        for (const [p, q] of [[-dx, x0], [dx, W - x0], [-dy, y0], [dy, H - y0]]) {
            if (p === 0) {
                if (q < 0) return '';
                continue;
            }
            const r = q / p;
            if (p < 0) { if (r > t1) return ''; if (r > t0) t0 = r; }
            else { if (r < t0) return ''; if (r < t1) t1 = r; }
        }
        return `M ${f1(x0 + t0 * dx)} ${f1(y0 + t0 * dy)} L ${f1(x0 + t1 * dx)} ${f1(y0 + t1 * dy)} `;
    }

    const gates = Array.from({ length: MAX_GATES }, () => symbol(svg, 'hud-gate'));
    const axis = symbol(svg, 'hud-axis');
    const port = symbol(svg, 'hud-port');
    const portLabel = el('text', { class: 'hud-label', 'text-anchor': 'start' }, svg);
    portLabel.textContent = 'PORT';
    const offscreen = symbol(svg, 'hud-port hud-offscreen');
    const prograde = symbol(svg, 'hud-prograde');
    const boresight = symbol(svg, 'hud-boresight');
    const trans = ['left', 'right', 'up', 'down'].map(() => symbol(svg, 'hud-trans'));
    const point = symbol(svg, 'hud-point');
    const roll = symbol(svg, 'hud-roll');

    return {
        resize(w, h) {
            W = w;
            H = h;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        },
        /**
         * tm: telemetry; project(p) → { x, y, front, vx, vy, vz } in CSS px / camera space
         */
        draw(tm, project) {
            const cx = W / 2, cy = H / 2;
            const cam = tm.nose;
            const span = Math.min(W, H);

            // Approach corridor: square gates along the docking axis, ahead of the craft
            const ahead = GATES.filter(d => d < tm.axial - 0.3).reverse().slice(0, MAX_GATES);
            const outside = tm.radial > tm.corridor;
            gates.forEach((gate, i) => {
                const d = ahead[i];
                if (d === undefined) return gate.hide();
                const h = corridorAt(d);
                const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => project([x, y, d]));
                // Gates about to be flown through fade out instead of filling the view
                const near = Math.min(Math.max(((tm.axial - d) / Math.max(tm.axial, 1) - 0.06) / 0.14, 0), 1);
                if (pts.some(p => !p.front) || near === 0) return gate.hide();
                const d2 = pts.map((a, k) => segment(a.x, a.y, pts[(k + 1) % 4].x, pts[(k + 1) % 4].y)).join('');
                if (!d2) return gate.hide();
                gate.draw(d2);
                gate.g.style.opacity = ((0.85 - i * 0.1) * near).toFixed(2);
                gate.set('warn', outside);
            });

            // The docking axis as seen from here: crosshairs through its vanishing point, turned with the port
            const vp = project([cam[0], cam[1], cam[2] - 3000]);
            if (vp.front) {
                const ex = project([cam[0] + 300, cam[1], cam[2] - 3000]), ey = project([cam[0], cam[1] + 300, cam[2] - 3000]);
                const lineThrough = q => {
                    const dx = q.x - vp.x, dy = q.y - vp.y, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, L = 3 * span;
                    return segment(vp.x + ux * 24, vp.y + uy * 24, vp.x + ux * L, vp.y + uy * L) +
                        segment(vp.x - ux * 24, vp.y - uy * 24, vp.x - ux * L, vp.y - uy * L);
                };
                const inView = vp.x > 6 && vp.x < W - 6 && vp.y > 6 && vp.y < H - 6;
                const d = lineThrough(ex) + lineThrough(ey) + (inView ? circle(vp.x, vp.y, 4) : '');
                if (d) axis.draw(d);
                else axis.hide();
            } else {
                axis.hide();
            }

            // Target reticle on the active docking port; an edge arrow when it is out of view
            const pc = project([0, 0, 0]);
            const onScreen = pc.front && pc.x > 12 && pc.x < W - 12 && pc.y > 12 && pc.y < H - 12;
            if (onScreen) {
                const edge = project([0.95, 0, 0]);
                const r = Math.hypot(edge.x - pc.x, edge.y - pc.y);
                const { x, y } = pc;
                // Shrinks near the edges so the brackets stay inside the view
                const s = Math.min(Math.max(r * 1.35, 14), span * 0.45, x - 2, W - x - 2, y - 2, H - y - 2), k = Math.max(s * 0.42, 7);
                port.draw(
                    `M ${f1(x - s)} ${f1(y - s + k)} V ${f1(y - s)} H ${f1(x - s + k)} M ${f1(x + s - k)} ${f1(y - s)} H ${f1(x + s)} V ${f1(y - s + k)} ` +
                    `M ${f1(x + s)} ${f1(y + s - k)} V ${f1(y + s)} H ${f1(x + s - k)} M ${f1(x - s + k)} ${f1(y + s)} H ${f1(x - s)} V ${f1(y + s - k)} ` +
                    `M ${f1(x - 1.5)} ${f1(y)} H ${f1(x + 1.5)} M ${f1(x)} ${f1(y - 1.5)} V ${f1(y + 1.5)}`);
                portLabel.setAttribute('x', f1(x + s + 5));
                portLabel.setAttribute('y', f1(y - s + 9));
                portLabel.style.display = '';
                offscreen.hide();
            } else {
                port.hide();
                portLabel.style.display = 'none';
                let dx = pc.vx, dy = -pc.vy;
                if (Math.hypot(dx, dy) < 1e-6) { dx = 0; dy = 1; }
                const a = Math.atan2(dy, dx);
                const rx = W / 2 - 26, ry = H / 2 - 26;
                const t = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
                offscreen.draw(chevron(cx + Math.cos(a) * t, cy + Math.sin(a) * t, a, 11) + ' ' +
                    chevron(cx + Math.cos(a) * (t - 9), cy + Math.sin(a) * (t - 9), a, 11));
            }

            // Prograde: where the docking camera is actually moving relative to the station (or retrograde)
            if (tm.speed > 0.004) {
                const v = tm.vel.map(c => c / tm.speed);
                const fwd = project([cam[0] + v[0] * 1000, cam[1] + v[1] * 1000, cam[2] + v[2] * 1000]);
                const p = fwd.front ? fwd : project([cam[0] - v[0] * 1000, cam[1] - v[1] * 1000, cam[2] - v[2] * 1000]);
                if (p.front && p.x > 20 && p.x < W - 20 && p.y > 20 && p.y < H - 20) {
                    const { x, y } = p, r = 7;
                    const ticks = `M ${f1(x - r - 9)} ${f1(y)} H ${f1(x - r)} M ${f1(x + r)} ${f1(y)} H ${f1(x + r + 9)} M ${f1(x)} ${f1(y - r)} V ${f1(y - r - 7)}`;
                    const cross = fwd.front ? '' : ` M ${f1(x - 4.5)} ${f1(y - 4.5)} L ${f1(x + 4.5)} ${f1(y + 4.5)} M ${f1(x + 4.5)} ${f1(y - 4.5)} L ${f1(x - 4.5)} ${f1(y + 4.5)}`;
                    prograde.draw(circle(x, y, r) + ' ' + ticks + cross);
                    prograde.set('retro', !fwd.front);
                } else {
                    prograde.hide();
                }
            } else {
                prograde.hide();
            }

            // Centre reference: where the craft (and its docking port) is pointing
            boresight.draw(`M ${f1(cx - 32)} ${f1(cy)} H ${f1(cx - 15)} L ${f1(cx - 7.5)} ${f1(cy + 8)} L ${f1(cx)} ${f1(cy)} ` +
                `L ${f1(cx + 7.5)} ${f1(cy + 8)} L ${f1(cx + 15)} ${f1(cy)} H ${f1(cx + 32)}`);

            // Translation cues around the centre: lit toward the docking axis
            const dead = Math.max(0.05, 0.3 * tm.corridor);
            const need = [tm.toAxis[0] < -dead, tm.toAxis[0] > dead, tm.toAxis[1] > dead, tm.toAxis[1] < -dead];
            [[-48, 0, Math.PI], [48, 0, 0], [0, -48, -Math.PI / 2], [0, 48, Math.PI / 2]].forEach(([dx, dy, a], i) => {
                trans[i].draw(chevron(cx + dx, cy + dy, a, 6));
                trans[i].set('on', need[i]);
            });

            // Attitude cue: a pointer toward the axis crosshairs when the nose is off the docking axis
            const off = Math.max(Math.abs(tm.yaw), Math.abs(tm.pitch));
            if (off > 1) {
                let dx = vp.x - cx, dy = vp.y - cy;
                if (!vp.front) { dx = vp.vx; dy = -vp.vy; }
                const a = Math.atan2(dy, dx);
                point.draw(chevron(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74, a, 8) + ' ' + chevron(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66, a, 8));
                point.set('warn', off > DOCKING.maxAngle);
            } else {
                point.hide();
            }
            // Roll cue: an arc over the centre, arrow in the direction to roll back
            if (Math.abs(tm.roll) > 1) {
                const r = 90, dir = tm.roll > 0 ? 1 : -1;          // roll right (clockwise) when rolled left
                const a0 = -Math.PI / 2 - dir * 0.28, a1 = -Math.PI / 2 + dir * 0.28;
                const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
                roll.draw(`M ${f1(p0[0])} ${f1(p0[1])} A ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${f1(p1[0])} ${f1(p1[1])} ` +
                    chevron(p1[0], p1[1], a1 + dir * Math.PI / 2, 6));
                roll.set('warn', Math.abs(tm.roll) > DOCKING.maxAngle);
            } else {
                roll.hide();
            }
        },
        hide() {
            [...gates, axis, port, offscreen, prograde, boresight, ...trans, point, roll].forEach(s => s.hide());
            portLabel.style.display = 'none';
        },
    };
}

/* ---------- Instrument panel ---------- */

const sign = (v, d) => (v < 0 && Math.abs(v) >= 0.5 * 10 ** -d ? '−' : '+') + Math.abs(v).toFixed(d);
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createDashboard(root) {
    const out = {};
    root.querySelectorAll('[data-t]').forEach(node => { out[node.dataset.t] = node; });
    const keys = {};
    root.querySelectorAll('[data-key]').forEach(node => { keys[node.dataset.key] = node; });
    const set = (k, text, state) => {
        const node = out[k];
        if (!node) return;
        if (node.textContent !== text) node.textContent = text;
        if (state !== undefined) node.dataset.state = state;
    };
    return {
        update(tm, extra) {
            const near = tm.axial < 40;
            const offOk = v => (Math.abs(v) <= tm.corridor ? 'ok' : 'warn');
            set('x', sign(tm.lateral, 2), offOk(tm.lateral));
            set('y', sign(tm.vertical, 2), offOk(tm.vertical));
            set('z', tm.axial.toFixed(tm.axial < 10 ? 2 : 1));
            set('range', tm.range.toFixed(tm.range < 10 ? 2 : 1));
            set('vx', sign(tm.vel[0], 3), Math.abs(tm.vel[0]) <= 0.05 ? 'ok' : 'warn');
            set('vy', sign(tm.vel[1], 3), Math.abs(tm.vel[1]) <= 0.05 ? 'ok' : 'warn');
            set('vz', sign(tm.vel[2], 3));
            set('closing', sign(tm.closing, 2), tm.closing > tm.closingLimit ? 'warn' : 'ok');
            const ang = v => (Math.abs(v) <= DOCKING.maxAngle ? 'ok' : near ? 'warn' : '');
            set('pitch', sign(tm.pitch, 1), ang(tm.pitch));
            set('yaw', sign(tm.yaw, 1), ang(tm.yaw));
            set('roll', sign(tm.roll, 1), ang(tm.roll));
            const rate = v => (Math.abs(v) <= DOCKING.maxRate ? 'ok' : 'warn');
            set('rp', sign(tm.rates[0], 2), rate(tm.rates[0]));
            set('ry', sign(tm.rates[1], 2), rate(tm.rates[1]));
            set('rr', sign(tm.rates[2], 2), rate(tm.rates[2]));
            set('time', clock(tm.t));
            set('dv', tm.dv.toFixed(2));
            set('failed', String(tm.failed), tm.failed ? 'warn' : 'ok');
            set('assist', extra.assist ? 'ON' : 'OFF', extra.assist ? 'ok' : 'warn');
            set('fine', extra.fine ? 'FINE' : 'FULL');
            // Light the key caps for the pilot's commands, and dimly for what flight assist is doing
            const firing = extra.assistFiring;
            const assistKeys = { j: firing[0] < 0, l: firing[0] > 0, k: firing[1] < 0, i: firing[1] > 0, s: firing[3] < 0, w: firing[3] > 0, d: firing[4] < 0, a: firing[4] > 0, e: firing[5] < 0, q: firing[5] > 0 };
            for (const [k, node] of Object.entries(keys)) {
                const on = extra.pressed.has(k);
                if (node.classList.contains('on') !== on) node.classList.toggle('on', on);
                const fa = !on && !!assistKeys[k];
                if (node.classList.contains('fa') !== fa) node.classList.toggle('fa', fa);
            }
        },
    };
}
