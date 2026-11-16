// Aegis Landing Simulator: the landing certificate, a 1200 × 675 PNG drawn on a canvas from the attempt's
// own numbers. Saving and sharing use the same mechanism as the SSTO Landing card (cardBlob from
// landing/card.js, then a download link or the Web Share API in main.js).
import { cardBlob } from '../landing/card.js';
import { DIFFICULTY } from './physics.js';

export { cardBlob };
export const CERT = { width: 1200, height: 675, file: 'WSA-Aegis-Landing-Certificate.png' };

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const DEG = 180 / Math.PI;
export const AWARD_COLORS = { precision: '#f5c542', excellent: '#4dff91', success: '#60a5fa', training: '#a5b4fc', first: '#fbbf24', logged: '#cbd5e1' };

function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

function wrap(g, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = text.split(' ');
    let line = '', n = 0;
    for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (g.measureText(t).width > maxWidth && line) {
            g.fillText(line, x, y);
            y += lineHeight;
            line = w;
            if (++n >= maxLines - 1) break;
        } else line = t;
    }
    if (line) g.fillText(line, x, y);
    return y + lineHeight;
}

// Side view of the descent: horizontal distance from the pad against height, with the pad and touchdown
function descentGraphic(g, r, x, y, w, h) {
    g.save();
    roundRect(g, x, y, w, h, 10);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    const tr = r.track;
    const dist = p => Math.hypot(p[1] - r.pad[0], p[3] - r.pad[1]) * Math.sign((p[1] - r.pad[0]) || 1);
    let dMax = 20, hMax = 50;
    for (const p of tr) { dMax = Math.max(dMax, Math.abs(dist(p))); hMax = Math.max(hMax, p[2]); }
    const X = d => x + w / 2 + d / dMax * (w / 2 - 24);
    const Y = a => y + h - 18 - a / hMax * (h - 36);
    g.strokeStyle = 'rgba(207,216,227,0.35)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 12, Y(0)); g.lineTo(x + w - 12, Y(0)); g.stroke();
    g.fillStyle = '#9aa3ad';
    g.fillRect(X(0) - 14, Y(0) - 2, 28, 4);
    if (tr.length > 1) {
        g.strokeStyle = '#5ad1ff';
        g.lineWidth = 3;
        g.lineJoin = 'round';
        g.beginPath();
        tr.forEach((p, i) => (i ? g.lineTo(X(dist(p)), Y(p[2])) : g.moveTo(X(dist(p)), Y(p[2]))));
        g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(X(r.td.dist * Math.sign((r.td.x - r.pad[0]) || 1)), Y(0), 6, 0, Math.PI * 2); g.fill();
    g.restore();
    g.font = `500 13px ${FONT}`;
    g.fillStyle = '#7f8ea3';
    g.textAlign = 'left';
    g.fillText('Your descent, side view', x, y + h + 22);
}

/**
 * r: physics result; e: evaluate(); info: { name, date, url, logo (loaded Image or null), attempt }
 */
export function drawCertificate(r, e, info) {
    const W = CERT.width, H = CERT.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) throw new Error('No 2D canvas.');
    const accent = AWARD_COLORS[e.award.id] || '#60a5fa';

    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#16213a');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < W; i += 40) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, H); g.stroke(); }
    for (let i = 0; i < H; i += 40) { g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(W, i + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(96,165,250,0.4)';
    g.lineWidth = 2;
    g.strokeRect(22, 22, W - 44, H - 44);
    g.strokeStyle = accent;
    g.lineWidth = 4;
    for (const [cx, cy, dx, dy] of [[22, 22, 1, 1], [W - 22, 22, -1, 1], [22, H - 22, 1, -1], [W - 22, H - 22, -1, -1]]) {
        g.beginPath(); g.moveTo(cx, cy + dy * 30); g.lineTo(cx, cy); g.lineTo(cx + dx * 30, cy); g.stroke();
    }

    // Header: WSA insignia, title, date
    let tx = 60;
    if (info.logo && info.logo.complete && info.logo.naturalWidth) {
        g.drawImage(info.logo, 56, 46, 70, 70);
        tx = 142;
    }
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.font = `800 32px ${FONT}`;
    g.letterSpacing = '5px';
    g.fillText('AEGIS LANDING SIMULATOR', tx, 84);
    g.letterSpacing = '0px';
    g.font = `500 17px ${FONT}`;
    g.fillStyle = '#9fb0c6';
    g.fillText('Woody Space Agency · Booster recovery certificate', tx, 112);
    g.textAlign = 'right';
    g.fillText(info.date, W - 60, 84);
    g.fillText(`Attempt ${info.attempt}`, W - 60, 108);

    // Recipient and award
    g.textAlign = 'left';
    g.font = `600 15px ${MONO}`;
    g.letterSpacing = '3px';
    g.fillStyle = '#7f8ea3';
    g.fillText('PRESENTED TO', 60, 176);
    g.letterSpacing = '0px';
    g.font = `700 34px ${FONT}`;
    g.fillStyle = '#eef3f8';
    const name = (info.name || '').trim() || 'WSA recovery pilot';
    g.fillText(name.length > 32 ? `${name.slice(0, 31)}…` : name, 60, 216);
    g.font = `700 15px ${MONO}`;
    g.letterSpacing = '3px';
    g.fillStyle = accent;
    g.fillText('AWARD', 60, 268);
    g.letterSpacing = '0px';
    g.font = `800 48px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(e.award.name, 60, 318);
    g.font = `400 17px ${FONT}`;
    g.fillStyle = '#b3bdcf';
    const yy = wrap(g, e.award.text, 60, 350, 580, 23, 3);
    // Outcome and difficulty chips
    const chip = (text, x, y, color) => {
        g.font = `700 13px ${MONO}`;
        g.letterSpacing = '2px';
        const w = g.measureText(text).width + 26;
        roundRect(g, x, y, w, 28, 14);
        g.strokeStyle = color;
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = color;
        g.fillText(text, x + 13, y + 19);
        g.letterSpacing = '0px';
        return x + w + 10;
    };
    const cx = chip(`${DIFFICULTY[r.diff].label.toUpperCase()} DIFFICULTY`, 60, yy + 2, '#cfd8e3');
    chip(e.success ? 'SUCCESSFUL LANDING' : e.outcome.startsWith('Landed') ? 'LANDED UPRIGHT' : 'LANDING UNSUCCESSFUL', cx, yy + 2, e.success ? '#4dff91' : '#fbbf24');
    if (e.extras.length) {
        g.font = `500 15px ${FONT}`;
        g.fillStyle = '#9fb0c6';
        g.fillText(`Also earned: ${e.extras.join(', ')}`, 60, yy + 58);
    }

    // Score seal
    const sx = 735, sy = 240;
    g.beginPath(); g.arc(sx, sy, 86, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.stroke();
    g.beginPath(); g.arc(sx, sy, 86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.score / 100);
    g.strokeStyle = accent;
    g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = `800 64px ${FONT}`;
    g.fillText(String(e.score), sx, sy + 20);
    g.font = `600 14px ${MONO}`;
    g.fillStyle = '#9fb0c6';
    g.fillText('SCORE / 100', sx, sy + 48);
    g.font = `700 17px ${FONT}`;
    g.fillStyle = accent;
    g.fillText(e.word, sx, sy + 122);

    // Statistics
    const td = r.td;
    const stats = [
        ['Pad offset', `${td.dist.toFixed(1)} m`], ['Touchdown', `${td.vs.toFixed(1)} m/s`], ['Sideways', `${td.hs.toFixed(1)} m/s`],
        ['Lean', `${(td.tilt * DEG).toFixed(1)}°`], ['Fuel left', `${Math.round(100 * td.prop / r.prop0)}%`], ['Flight time', `${Math.round(td.t)} s`],
    ];
    g.textAlign = 'left';
    stats.forEach(([k, v], i) => {
        const x = 60 + i * 180, y = 488;
        g.font = `600 13px ${FONT}`;
        g.fillStyle = '#7f8ea3';
        g.fillText(k.toUpperCase(), x, y);
        g.font = `700 26px ${MONO}`;
        g.fillStyle = '#eef3f8';
        g.fillText(v, x, y + 32);
    });
    descentGraphic(g, r, 890, 150, 250, 190);

    // Footer
    g.font = `700 16px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText('Woody Space Agency', 60, H - 52);
    g.font = `400 14px ${FONT}`;
    g.fillStyle = '#7f8ea3';
    g.fillText(`A game with illustrative values${info.url ? ` · ${info.url}` : ''}. Not a record of a real Aegis flight.`, 60, H - 30);
    return c;
}

