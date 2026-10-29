// Orbital Rendezvous Challenge: drawing. A 2D canvas, two views of the same simulation:
//   map   – Kerbin, both orbits, the craft and KGOSS, apsides and the predicted closest approach
//   close – KGOSS's own frame (x along its direction of travel, y away from Kerbin): the station to
//           scale, the docking port and corridor, the craft, its velocity and its predicted drift
// The camera only changes what is drawn, never the simulation.
import { KERBIN, KGOSS_ALT, STATION, CRAFT, DIFFICULTIES, elements, relative, corridor } from './physics.js';

const C = {
    space0: '#050913', space1: '#0b1426',
    kerbin0: '#3f8f6b', kerbin1: '#1d4f6e', atmosphere: 'rgba(110, 170, 255, 0.16)',
    craft: '#8cc8ff', craftOrbit: 'rgba(140, 200, 255, 0.85)',
    station: '#ffb547', stationOrbit: 'rgba(255, 181, 71, 0.75)',
    text: '#d6e2f0', muted: '#7d8ba1', grid: 'rgba(140, 170, 210, 0.13)', gridText: 'rgba(160, 185, 220, 0.6)',
    warn: '#ffb547', alert: '#ff6b6b', good: '#7cf0b0',
    module: '#c9d2dd', moduleEdge: '#7f8a99', truss: '#8a95a5', array: '#1f3d6b', arrayLine: '#4d77b3',
};
const FONT = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Deterministic stars, so the backdrop never flickers between frames
function makeStars(n) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 0.9, a: 0.25 + rnd() * 0.6 }));
}
const STARS = makeStars(160);

const fmtDist = m => m >= 10000 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw on a canvas.');
    let w = 1, h = 1, dpr = 1;
    let proxRange = null;           // smoothed close-up range, m

    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = Math.max(1, r.width); h = Math.max(1, r.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }

    function backdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, C.space0); g.addColorStop(1, C.space1);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (const s of STARS) {
            ctx.globalAlpha = s.a;
            ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
        }
        ctx.globalAlpha = 1;
    }

    function label(text, x, y, color = C.text, align = 'left') {
        ctx.font = FONT;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(5, 9, 19, 0.85)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    // A craft-shaped arrow (size in px) pointing along screen angle a
    function craftIcon(x, y, a, size, color, burning) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        if (burning) {
            ctx.fillStyle = 'rgba(255, 190, 90, 0.9)';
            ctx.beginPath();
            ctx.moveTo(-size * 0.7, -size * 0.3); ctx.lineTo(-size * 1.7, 0); ctx.lineTo(-size * 0.7, size * 0.3);
            ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.strokeStyle = '#05101f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(size, 0); ctx.lineTo(-size * 0.75, -size * 0.6); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.75, size * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    function stationIcon(x, y, size) {
        ctx.fillStyle = C.station;
        ctx.strokeStyle = '#2a1a05';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x - size * 0.9, y - size * 0.35, size * 1.8, size * 0.7);
        ctx.strokeRect(x - size * 0.9, y - size * 0.35, size * 1.8, size * 0.7);
        ctx.fillRect(x - size * 0.15, y - size * 1.2, size * 0.3, size * 2.4);
    }

    function arrowHead(x, y, a, size, color) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = color; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-size, -size * 0.7); ctx.lineTo(0, 0); ctx.lineTo(-size, size * 0.7);
        ctx.stroke();
        ctx.restore();
    }

    /* ---------- Map ---------- */

    function drawOrbit(el, project, k, color, width, dash = []) {
        if (!el.bound) return;
        const b = el.a * Math.sqrt(1 - el.e * el.e);
        const [cx, cy] = project(-el.a * el.e * Math.cos(el.argPe), -el.a * el.e * Math.sin(el.argPe));
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.ellipse(cx, cy, el.a * k, b * k, -el.argPe, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Small chevrons along an orbit showing the direction of travel (anticlockwise)
    function orbitChevrons(el, project, color) {
        if (!el.bound) return;
        const p = el.a * (1 - el.e * el.e);
        for (let i = 0; i < 6; i++) {
            const nu = i * Math.PI / 3 + 0.4;
            const r = p / (1 + el.e * Math.cos(nu));
            const ang = el.argPe + nu;
            const [sx, sy] = project(r * Math.cos(ang), r * Math.sin(ang));
            const r2 = p / (1 + el.e * Math.cos(nu + 0.01));
            const [tx, ty] = project(r2 * Math.cos(ang + 0.01), r2 * Math.sin(ang + 0.01));
            arrowHead(sx, sy, Math.atan2(ty - sy, tx - sx), 5, color);
        }
    }

    function drawMap(s, o) {
        const cam = o.cam;
        const sEl = elements(s.ship), kEl = elements(s.station);
        // Default framing: Kerbin and both orbits fill the shorter side
        const outer = Math.max(KERBIN.radius + KGOSS_ALT, sEl.bound ? Math.min(sEl.a * (1 + sEl.e), 2.5e6) : 0) * 1.08;
        const k = Math.min(w, h) / 2 / outer * cam.zoom;
        const focus = cam.focus === 'ship' ? s.ship : cam.focus === 'station' ? s.station : { x: 0, y: 0 };
        const project = (x, y) => [w / 2 + (x - focus.x) * k, h / 2 - (y - focus.y) * k];

        // Kerbin and its atmosphere
        const [kx, ky] = project(0, 0);
        ctx.fillStyle = C.atmosphere;
        ctx.beginPath(); ctx.arc(kx, ky, (KERBIN.radius + KERBIN.atmosphere) * k, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(kx - KERBIN.radius * k * 0.3, ky - KERBIN.radius * k * 0.3, KERBIN.radius * k * 0.1, kx, ky, KERBIN.radius * k);
        g.addColorStop(0, C.kerbin0); g.addColorStop(1, C.kerbin1);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(kx, ky, KERBIN.radius * k, 0, Math.PI * 2); ctx.fill();
        if (KERBIN.radius * k > 30) label('KERBIN', kx, ky, 'rgba(230, 240, 255, 0.55)', 'center');

        // Orbits
        drawOrbit(kEl, project, k, C.stationOrbit, 1.4);
        orbitChevrons(kEl, project, C.stationOrbit);
        drawOrbit(sEl, project, k, C.craftOrbit, 1.6);
        orbitChevrons(sEl, project, C.craftOrbit);

        // Planned transfer (Training): the orbit a burn at the window would give
        if (o.plan) {
            const pl = o.plan;
            const el = { bound: true, a: (pl.r1 + pl.r2) / 2, e: Math.abs(pl.r2 - pl.r1) / (pl.r1 + pl.r2), argPe: pl.r1 < pl.r2 ? pl.angle : pl.angle + Math.PI };
            drawOrbit(el, project, k, 'rgba(124, 240, 176, 0.65)', 1.3, [6, 6]);
            const [bx, by] = project(pl.r1 * Math.cos(pl.angle), pl.r1 * Math.sin(pl.angle));
            ctx.fillStyle = C.good;
            ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
            label('BURN HERE', bx - 8, by + 14, C.good, 'right');
        }

        // Apoapsis and periapsis of the craft's orbit
        if (sEl.bound && sEl.e > 0.002) {
            const ap = sEl.a * (1 + sEl.e), pe = sEl.a * (1 - sEl.e);
            const [ax, ay] = project(-ap * Math.cos(sEl.argPe), -ap * Math.sin(sEl.argPe));
            const [px, py] = project(pe * Math.cos(sEl.argPe), pe * Math.sin(sEl.argPe));
            ctx.fillStyle = C.craft;
            ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            label(`Ap ${(sEl.ap / 1000).toFixed(1)} km`, ax + 7, ay - 9, C.craft);
            label(`Pe ${(sEl.pe / 1000).toFixed(1)} km`, px + 7, py - 9, sEl.pe < KERBIN.atmosphere ? C.alert : C.craft);
        }

        // Predicted path to the closest approach, and the closest-approach markers
        const pred = o.pred;
        if (pred && o.showApproach && pred.ca.dist < 60000) {
            const n = Math.min(pred.count, Math.ceil(pred.ca.t / pred.h) + 1);
            ctx.strokeStyle = 'rgba(200, 230, 255, 0.95)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const [x, y] = project(pred.path[i * 2], pred.path[i * 2 + 1]);
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.stroke();
            const [ax, ay] = project(pred.ca.ship.x, pred.ca.ship.y);
            const [bx, by] = project(pred.ca.station.x, pred.ca.station.y);
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = C.craft; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = C.station; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.stroke();
            label(`Closest ${fmtDist(pred.ca.dist)}`, Math.max(ax, bx) + 10, (ay + by) / 2, '#ffffff');
        }

        // The two craft (fixed screen size), with velocity ticks
        const [sx, sy] = project(s.station.x, s.station.y);
        stationIcon(sx, sy, 6);
        label('KGOSS', sx - 10, sy - 12, C.station, 'right');
        const [cx, cy] = project(s.ship.x, s.ship.y);
        craftIcon(cx, cy, -s.ship.heading, 9, C.craft, s.burning);
        label('YOU', cx + 11, cy + 13, C.craft);
        // Scale bar
        scaleBar(k);
    }

    function scaleBar(k) {
        const target = 110 / k;
        const p = Math.pow(10, Math.floor(Math.log10(target)));
        const m = target / p >= 5 ? 5 * p : target / p >= 2 ? 2 * p : p;
        const len = m * k;
        const x = 14, y = h - 16;
        ctx.strokeStyle = C.gridText; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len, y - 4); ctx.stroke();
        label(fmtDist(m), x + len + 6, y - 2, C.gridText);
    }

    /* ---------- Close-up: KGOSS's frame ---------- */

    function drawClose(s, o) {
        const rel = relative(s);
        const diff = DIFFICULTIES[s.difficulty];
        const want = Math.max(45, Math.hypot(rel.x, rel.y) * 1.25);
        proxRange = proxRange == null || o.snap ? want : proxRange + (want - proxRange) * Math.min(1, o.dtReal * 2.5);
        const k = Math.min(w, h) / 2 / proxRange * o.cam.closeZoom;
        const project = (x, y) => [w / 2 + x * k, h / 2 - y * k];

        // Range rings and axes
        const ringStep = (() => {
            const target = proxRange / 3;
            const p = Math.pow(10, Math.floor(Math.log10(target)));
            return target / p >= 5 ? 5 * p : target / p >= 2 ? 2 * p : p;
        })();
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        const [ox, oy] = project(0, 0);
        for (let r = ringStep, i = 0; r * k < Math.hypot(w, h) && i < 12; r += ringStep, i++) {
            ctx.beginPath(); ctx.arc(ox, oy, r * k, 0, Math.PI * 2); ctx.stroke();
            if (oy - r * k > 20) label(fmtDist(r), ox + 4, oy - r * k - 7, C.gridText);
        }
        ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
        label('DIRECTION OF TRAVEL →', w - 12, oy - 10, C.gridText, 'right');
        label('↑ AWAY FROM KERBIN', ox + 8, Math.min(oy - 24, 80), C.gridText);
        label('↓ TOWARD KERBIN', ox + 8, h - 14, C.gridText);

        // Approach corridor behind the port
        const px = STATION.port.x;
        const len = Math.max(220, proxRange * 2);
        const half = diff.corridor * Math.PI / 180;
        const cor = corridor(rel, diff.corridor);
        ctx.fillStyle = cor.inside ? 'rgba(124, 240, 176, 0.08)' : 'rgba(255, 181, 71, 0.07)';
        ctx.strokeStyle = cor.inside ? 'rgba(124, 240, 176, 0.45)' : 'rgba(255, 181, 71, 0.45)';
        ctx.lineWidth = 1;
        const [p0x, p0y] = project(px, 0);
        const [p1x, p1y] = project(px - len, Math.tan(half) * len);
        const [p2x, p2y] = project(px - len, -Math.tan(half) * len);
        ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(project(px - len, 0)[0], p0y); ctx.stroke();
        ctx.setLineDash([]);

        // KGOSS to scale, or as an icon when too small
        if (k * 50 > 26) {
            for (const p of STATION.parts) {
                const [x0, y0] = project(p.x0, p.y1);
                const pw = (p.x1 - p.x0) * k, ph = (p.y1 - p.y0) * k;
                ctx.fillStyle = p.kind === 'array' ? C.array : p.kind === 'truss' ? C.truss : p.kind === 'port' ? C.station : C.module;
                ctx.fillRect(x0, y0, pw, ph);
                ctx.strokeStyle = p.kind === 'array' ? C.arrayLine : C.moduleEdge;
                ctx.lineWidth = 1;
                ctx.strokeRect(x0, y0, pw, ph);
            }
            if (k > 6) label('DOCKING PORT', p0x - 6, p0y - Math.max(16, 3 * k), C.station, 'right');
        } else {
            stationIcon(ox, oy, 6);
        }
        label('KGOSS', ox + 12, oy + 16, C.station);

        // Predicted drift (where the craft goes if it coasts) and its closest approach
        const pred = o.pred;
        if (pred && s.status === 'flying') {
            ctx.strokeStyle = 'rgba(140, 200, 255, 0.55)';
            ctx.setLineDash([4, 5]);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            const n = o.driftCount ? Math.min(pred.count, o.driftCount) : pred.count;
            for (let i = 0; i < n; i++) {
                const [x, y] = project(pred.relPath[i * 2], pred.relPath[i * 2 + 1]);
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            if (o.showApproach && pred.ca.t > 1 && pred.ca.t * 1 < n * pred.h) {
                const i = Math.min(pred.count - 1, Math.round(pred.ca.t / pred.h));
                const [x, y] = project(pred.relPath[i * 2], pred.relPath[i * 2 + 1]);
                ctx.strokeStyle = pred.ca.dist < 30 ? C.alert : '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
                label(`closest ${fmtDist(pred.ca.dist)}`, x + 9, y, ctx.strokeStyle);
            }
        }

        // The craft: to scale when large enough
        const [cx, cy] = project(rel.x, rel.y);
        const a = -rel.heading;
        if (k * CRAFT.nose * 2 > 16) {
            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(a); ctx.scale(k, k);
            if (s.burning) {
                ctx.fillStyle = 'rgba(255, 190, 90, 0.9)';
                ctx.beginPath(); ctx.moveTo(-4, -1.1); ctx.lineTo(-8 - Math.random() * 1.5, 0); ctx.lineTo(-4, 1.1); ctx.fill();
            }
            ctx.fillStyle = '#dfe8f3';
            ctx.strokeStyle = '#5c6f88';
            ctx.lineWidth = 1.5 / k;
            ctx.beginPath();
            ctx.moveTo(3.2, -1.3); ctx.lineTo(3.2, 1.3); ctx.lineTo(-3.5, 1.8); ctx.lineTo(-4, 0); ctx.lineTo(-3.5, -1.8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = C.craft;
            ctx.fillRect(3.2, -0.8, 0.8, 1.6);          // the docking port on the nose
            if (s.rcsActive) {
                ctx.fillStyle = 'rgba(220, 235, 255, 0.7)';
                for (const [x, y] of [[2.5, 1.9], [2.5, -1.9], [-3, 2.2], [-3, -2.2]]) { ctx.beginPath(); ctx.arc(x, y, 0.45, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();
        } else {
            craftIcon(cx, cy, a, 9, C.craft, s.burning);
        }
        label('YOU', cx + 12, cy + 14, C.craft);

        // Relative velocity arrow (length grows with the log of the speed)
        if (rel.speed > 0.01 && s.status === 'flying') {
            const L = Math.min(110, 22 * Math.log10(1 + rel.speed * 10));
            const ang = Math.atan2(-rel.vy, rel.vx);
            const ex = cx + Math.cos(ang) * L, ey = cy + Math.sin(ang) * L;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
            arrowHead(ex, ey, ang, 7, '#ffffff');
            label(`${rel.speed.toFixed(rel.speed < 10 ? 2 : 1)} m/s`, ex + 6, ey - 10, '#ffffff');
        }
        scaleBar(k);
    }

    function draw(s, o) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        backdrop();
        if (!s) return;
        if (o.view === 'close') drawClose(s, o);
        else drawMap(s, o);
    }

    return { resize, draw, resetClose() { proxRange = null; } };
}
