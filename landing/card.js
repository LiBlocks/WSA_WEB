// SSTO Landing result card: a 1200 × 675 landing certificate drawn on a canvas from the landing's own
// numbers (grade, award, key statistics and the flown track over the runway), for saving or sharing.
import { RUNWAY, GLIDE } from './layout.js';
import { GRADE_WORDS } from './scoring.js';
import { SCENARIOS } from './physics.js';

export const CARD = { width: 1200, height: 675, file: 'WSA-SSTO-Landing.png' };

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const GRADE_COLORS = { S: '#f5c542', A: '#4dff91', B: '#60a5fa', C: '#a5b4fc', D: '#fbbf24', F: '#ff6b6b' };

function wrap(g, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = text.split(' ');
    let line = '', lines = 0;
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (g.measureText(test).width > maxWidth && line) {
            g.fillText(line, x, y);
            y += lineHeight;
            line = word;
            if (++lines >= maxLines - 1) break;
        } else line = test;
    }
    if (line) g.fillText(line, x, y);
    return y + lineHeight;
}

// A small top view of the spaceplane, nose up
function silhouette(g, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, -50);
    g.bezierCurveTo(6, -40, 7, -28, 7, -18);
    g.lineTo(42, 22);
    g.lineTo(42, 30);
    g.lineTo(8, 30);
    g.lineTo(9, 40);
    g.lineTo(-9, 40);
    g.lineTo(-8, 30);
    g.lineTo(-42, 30);
    g.lineTo(-42, 22);
    g.lineTo(-7, -18);
    g.bezierCurveTo(-7, -28, -6, -40, 0, -50);
    g.fill();
    g.restore();
}

function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

// The track over the last few kilometres in plan view, with the runway, touchdown and stop points.
// Sideways distances are exaggerated so small deviations stay visible.
function trackGraphic(g, r, x, y, w, h) {
    const from = -4000, to = RUNWAY.length + 150;           // along-runway range shown, m
    const lateral = 4;                                       // sideways exaggeration
    const sx = s => x + (s - from) / (to - from) * w;
    const sy = d => y + h / 2 + d * lateral * (h / 2) / 160;
    g.save();
    roundRect(g, x - 10, y - 8, w + 20, h + 16, 10);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fill();
    g.beginPath();
    g.rect(x - 10, y - 8, w + 20, h + 16);
    g.clip();
    // Extended centreline
    g.strokeStyle = 'rgba(207,216,227,0.25)';
    g.setLineDash([6, 6]);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sx(from), sy(0));
    g.lineTo(sx(0), sy(0));
    g.stroke();
    g.setLineDash([]);
    // Runway
    const half = RUNWAY.width / 2;
    g.fillStyle = '#3a4250';
    g.fillRect(sx(0), sy(-half), sx(RUNWAY.length) - sx(0), sy(half) - sy(-half));
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(sx(0), sy(0));
    g.lineTo(sx(RUNWAY.length), sy(0));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(sx(0), sy(-half), 3, sy(half) - sy(-half));
    // Track
    const pts = r.track.filter(p => -p[2] > from);
    if (pts.length > 1) {
        g.strokeStyle = '#4dff91';
        g.lineWidth = 3;
        g.lineJoin = 'round';
        g.beginPath();
        pts.forEach((p, i) => { const px = sx(-p[2]), py = sy(p[0]); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
        g.stroke();
    }
    const dot = (s, d, color, label) => {
        g.fillStyle = color;
        g.beginPath();
        g.arc(sx(s), sy(d), 6, 0, Math.PI * 2);
        g.fill();
        g.font = `600 14px ${FONT}`;
        g.fillStyle = '#cfd8e3';
        g.textAlign = 'center';
        g.fillText(label, sx(s), sy(d) - 14);
    };
    if (r.touchdown) dot(r.touchdown.s, r.touchdown.x, '#ffffff', 'Touchdown');
    dot(r.stopAt, r.pos[0], '#f5c542', 'Stop');
    g.restore();
    g.font = `500 13px ${FONT}`;
    g.fillStyle = '#7f8ea3';
    g.textAlign = 'left';
    g.fillText(`Final ${Math.abs(from / 1000)} km and the rollout, plan view (sideways ×${lateral})`, x, y + h + 26);
}

/**
 * r: the landing result; gr: grade(); award: { name, text }; info: { attempt, date, url }
 */
export function drawCard(r, gr, award, info) {
    const W = CARD.width, H = CARD.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) throw new Error('No 2D canvas.');
    const color = GRADE_COLORS[gr.letter];

    // Background: deep space blue, a faint grid and a frame with corner ticks
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#131d33');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) { g.beginPath(); g.moveTo(gx + 0.5, 0); g.lineTo(gx + 0.5, H); g.stroke(); }
    for (let gy = 0; gy < H; gy += 40) { g.beginPath(); g.moveTo(0, gy + 0.5); g.lineTo(W, gy + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(96,165,250,0.45)';
    g.lineWidth = 2;
    g.strokeRect(22, 22, W - 44, H - 44);
    g.strokeStyle = '#60a5fa';
    g.lineWidth = 4;
    for (const [cx, cy, dx, dy] of [[22, 22, 1, 1], [W - 22, 22, -1, 1], [22, H - 22, 1, -1], [W - 22, H - 22, -1, -1]]) {
        g.beginPath();
        g.moveTo(cx, cy + dy * 28);
        g.lineTo(cx, cy);
        g.lineTo(cx + dx * 28, cy);
        g.stroke();
    }

    // Header
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    g.font = `800 34px ${FONT}`;
    g.letterSpacing = '6px';
    g.fillText('WSA SSTO LANDING', 60, 86);
    g.letterSpacing = '0px';
    g.font = `500 18px ${FONT}`;
    g.fillStyle = '#9fb0c6';
    g.fillText('Woody Space Agency · Landing report', 60, 116);
    silhouette(g, W - 96, 86, 0.62, 'rgba(233,237,242,0.9)');
    g.textAlign = 'right';
    g.font = `500 16px ${FONT}`;
    g.fillStyle = '#9fb0c6';
    g.fillText(`${SCENARIOS[r.scenario].label} · attempt ${info.attempt}`, W - 150, 78);
    g.fillText(info.date, W - 150, 102);

    // Grade seal
    const gx = 170, gy = 300;
    g.beginPath();
    g.arc(gx, gy, 104, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = color;
    g.stroke();
    g.beginPath();
    g.arc(gx, gy, 88, 0, Math.PI * 2);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.stroke();
    g.textAlign = 'center';
    g.fillStyle = color;
    g.font = `800 120px ${FONT}`;
    g.fillText(gr.letter, gx, gy + 42);
    g.font = `700 16px ${MONO}`;
    g.letterSpacing = '3px';
    g.fillStyle = '#cfd8e3';
    g.fillText(`GRADE · ${GRADE_WORDS[gr.letter].toUpperCase()}`, gx, gy + 140);
    g.letterSpacing = '0px';

    // Award and landing type
    const ax = 320;
    g.textAlign = 'left';
    g.font = `700 15px ${MONO}`;
    g.letterSpacing = '3px';
    g.fillStyle = color;
    g.fillText('AWARD', ax, 196);
    g.letterSpacing = '0px';
    g.font = `800 46px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(award.name, ax, 246);
    g.font = `400 20px ${FONT}`;
    g.fillStyle = '#b3bdcf';
    const after = wrap(g, award.text, ax, 280, 400, 27, 2);
    const chip = r.assistUsed ? 'ASSISTED LANDING' : 'MANUAL LANDING';
    g.font = `700 14px ${MONO}`;
    g.letterSpacing = '2px';
    const cw = g.measureText(chip).width + 28;
    roundRect(g, ax, after - 4, cw, 30, 15);
    g.strokeStyle = r.assistUsed ? 'rgba(207,216,227,0.6)' : color;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = r.assistUsed ? '#cfd8e3' : color;
    g.fillText(chip, ax + 14, after + 16);
    g.letterSpacing = '0px';

    // Key statistics, two columns
    const td = r.touchdown;
    const stats = [
        ['Centerline', `${Math.abs(td.x).toFixed(1)} m`, gr.rows[1].rating],
        ['Touchdown', `${td.vs >= 0 ? '+' : '−'}${Math.abs(td.vs).toFixed(1)} m/s`, gr.rows[0].rating],
        ['Touchdown speed', `${td.gs.toFixed(0)} m/s`, gr.rows[3].rating],
        ['Runway alignment', `${Math.abs(td.heading).toFixed(1)}°`, gr.rows[2].rating],
        ['Runway used', `${Math.round(Math.max(0, r.stopAt)).toLocaleString('en')} m`, gr.rows[4].rating],
        ['Approach stability', r.stability == null ? 'n/a' : `${r.stability}/100`, gr.rows[5].rating],
    ];
    const sx0 = 760, sy0 = 176, colW = 200, rowH = 74;
    stats.forEach(([label, value, rating], i) => {
        const x = sx0 + (i % 2) * colW, y = sy0 + Math.floor(i / 2) * rowH;
        g.font = `600 14px ${FONT}`;
        g.fillStyle = '#7f8ea3';
        g.fillText(label.toUpperCase(), x, y);
        g.font = `700 28px ${MONO}`;
        g.fillStyle = '#eef3f8';
        g.fillText(value, x, y + 33);
        g.font = `600 13px ${FONT}`;
        g.fillStyle = rating === 'Excellent' ? '#4dff91' : rating === 'Good' ? '#9fd3ff' : rating === 'Fair' ? '#ffc94d' : '#ff9b9b';
        g.fillText(rating, x, y + 52);
    });

    trackGraphic(g, r, 70, 486, W - 140, 72);

    // Footer
    g.textAlign = 'left';
    g.font = `700 16px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText('Woody Space Agency', 60, H - 44);
    const nameW = g.measureText('Woody Space Agency').width;
    if (info.url) {
        g.font = `500 15px ${FONT}`;
        g.fillStyle = '#60a5fa';
        g.fillText(info.url, 60 + nameW + 18, H - 44);
    }
    g.textAlign = 'right';
    g.font = `500 14px ${FONT}`;
    g.fillStyle = '#7f8ea3';
    g.fillText(`Runway ${RUNWAY.numbers[0]} · ${GLIDE.angle}° glide path`, W - 60, H - 44);
    return c;
}

export function cardBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The PNG could not be encoded.'))), 'image/png');
    });
}
