// WSA Flight Dynamics Center: the page. Reads the form inputs, converts units to SI, calls calc.js and shows
// the results. Each calculator card works on its own; results refresh as you type and on Calculate.
import { BODIES, ENVIRONMENTS, body as findBody, surfaceGravity } from '../celestial-bodies.js';
import * as C from './calc.js';

const ENV = 'ksp-stock-opm';
const DEFAULT_BODY = 'kerbin';
const CUSTOM = 'custom';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Numbers in and out ---------- */

/**
 * Reads a number the way people type them: 3.5316e12, 3.5316×10^12, 1,000,000 or 1 000 000, 9,81.
 * Returns NaN for an empty or unreadable field.
 */
export function parseNumber(text) {
    let s = String(text ?? '').trim().replace(/[−–]/g, '-').replace(/\s|_/g, '');
    if (!s) return NaN;
    s = s.replace(/[×x*]10\^?/i, 'e');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?(e[-+]?\d+)?$/i.test(s)) s = s.replace(/,/g, '');      // 1,000,000
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');                             // 9,81
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const group = (v, decimals) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });

/** A readable number: about `sig` significant figures, grouped, scientific when very large or small. */
export function formatNumber(v, sig = 5) {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e12 || a < 1e-3) {
        const [m, e] = v.toExponential(sig - 1).split('e');
        return `${String(Number(m))} × 10${String(Number(e)).split('').map(c => SUP[c]).join('')}`;
    }
    const decimals = Math.max(0, Math.min(6, sig - 1 - Math.floor(Math.log10(a))));
    return group(Number(v.toFixed(decimals)), decimals);
}

const html = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ''), '');
const unit = (v, u, sig) => html`<span class="fdc-num">${formatNumber(v, sig)}</span> <span class="fdc-u">${u}</span>`;
const sub = text => html`<span class="fdc-sub">${text}</span>`;

const speed = v => unit(v, 'm/s');
const distance = m => m >= 1e4 ? unit(m / 1000, 'km', 6) + sub(`${formatNumber(m, 7)} m`) : unit(m, 'm', 6);
const force = n => n >= 1e4 ? unit(n / 1000, 'kN') + sub(`${formatNumber(n, 6)} N`) : unit(n, 'N');
const mass = (kg, inTonnes) => inTonnes ? unit(kg / 1000, 't') + sub(`${formatNumber(kg, 6)} kg`) : unit(kg, 'kg', 6);

/** 1,958.1 s, with the same span as hours, minutes and seconds (no "days": Kerbin's and Earth's differ) */
function duration(s) {
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s - h * 3600 - m * 60;
    const parts = [];
    if (h) parts.push(`${group(h, 0)} h`);
    if (h || m) parts.push(`${m} min`);
    parts.push(`${formatNumber(sec, sec >= 10 ? 3 : 2)} s`);
    return unit(s, 's', 6) + sub(parts.join(' '));
}

/* ---------- Bodies ---------- */

const envBodies = BODIES.filter(b => b.env === ENV);
const depth = b => { let d = 0; for (let p = b.parent; p; p = findBody(p).parent) d++; return d; };
const label = b => b.parent && depth(b) > 1 ? `${b.name} (moon of ${findBody(b.parent).name})` : b.name;

function fillBodySelect(select) {
    const stock = document.createElement('optgroup');
    stock.label = 'Kerbol system (stock)';
    const opm = document.createElement('optgroup');
    opm.label = 'Outer Planets Mod';
    for (const b of envBodies) {
        const o = new Option(label(b), b.id);
        (b.opm || (b.id === 'eeloo') ? opm : stock).append(o);
    }
    const other = document.createElement('optgroup');
    other.label = 'Other';
    other.append(new Option('Custom body: enter μ and radius', CUSTOM));
    select.append(stock, opm, other);
    select.value = DEFAULT_BODY;
}

function fillGravitySelect(select) {
    const g = document.createElement('optgroup');
    g.label = 'Surface gravity of a body';
    for (const b of envBodies) {
        if (b.id === 'kerbol') continue;
        g.append(new Option(`${b.name} surface · ${formatNumber(surfaceGravity(b), 4)} m/s²`, b.id));
    }
    const other = document.createElement('optgroup');
    other.label = 'Other';
    other.append(new Option('Custom value', CUSTOM));
    select.append(g, other);
    select.value = DEFAULT_BODY;
}

/* ---------- Cards ---------- */

const env = ENVIRONMENTS[ENV];
document.querySelector('[data-env-label]').textContent = env.label;
document.querySelector('[data-env-note]').textContent = 'Radii and gravitational parameters come from the installation\'s own Kopernicus logs; each body\'s source is listed when you choose it.';
document.querySelector('[data-ksrss-note]').textContent = ENVIRONMENTS.ksrss.note;

function setupCard(card, compute) {
    const form = card.querySelector('form');
    const out = card.querySelector('.fdc-output');
    out.removeAttribute('aria-live');
    const live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    card.append(live);
    const bodySelect = form.querySelector('.fdc-body-select');
    if (bodySelect) fillBodySelect(bodySelect);
    const gravitySelect = form.querySelector('.fdc-gravity-select');
    if (gravitySelect) fillGravitySelect(gravitySelect);
    const defaults = new Map([...form.elements].filter(e => e.name).map(e => [e, e.value]));

    const field = name => form.elements[name];
    const get = name => parseNumber(field(name)?.value);
    const scale = name => Number(field(name)?.value || 1);

    // Which body is selected, as { mu, radius, body }; custom values come from the μ and radius inputs
    function central() {
        const id = bodySelect.value;
        if (id !== CUSTOM) { const b = findBody(id); return { mu: b.mu, radius: b.radius, body: b }; }
        return { mu: get('mu'), radius: get('radius'), body: null };
    }

    function showErrors(errors) {
        form.querySelectorAll('.fdc-error').forEach(e => e.remove());
        form.querySelectorAll('[aria-invalid]').forEach(e => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); });
        for (const [name, message] of Object.entries(errors)) {
            const input = field(name);
            if (!input) continue;
            const p = document.createElement('p');
            p.className = 'fdc-error';
            p.id = `${input.id}-error`;
            p.textContent = message;
            input.closest('.fdc-field').append(p);
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', p.id);
        }
    }

    function render(values, note) {
        for (const dd of out.querySelectorAll('[data-out]')) {
            const k = dd.dataset.out;
            const next = values && values[k] != null ? values[k] : '—';
            if (dd.innerHTML !== next) {
                dd.innerHTML = next;
                if (values && !reduceMotion.matches) {
                    dd.classList.remove('fdc-changed');
                    void dd.offsetWidth;
                    dd.classList.add('fdc-changed');
                }
            }
        }
        out.querySelector('[data-note]').innerHTML = note || '';
        out.classList.toggle('fdc-empty', !values);
    }

    function run(announce) {
        const custom = bodySelect && bodySelect.value === CUSTOM;
        form.querySelector('[data-custom]')?.toggleAttribute('hidden', !custom);
        if (gravitySelect) form.querySelector('[data-gravity-custom]').toggleAttribute('hidden', gravitySelect.value !== CUSTOM);
        const result = compute({ form, get, scale, central, field });
        showErrors(result.errors || {});
        render(result.values, result.note);
        if (announce) live.textContent = result.values ? result.summary : 'Check the highlighted inputs.';
    }

    form.addEventListener('input', () => run(false));
    form.addEventListener('change', () => run(false));
    form.addEventListener('submit', e => { e.preventDefault(); run(true); });
    form.addEventListener('reset', e => {
        e.preventDefault();
        for (const [el, v] of defaults) el.value = v;
        if (bodySelect) bodySelect.value = DEFAULT_BODY;
        if (gravitySelect) gravitySelect.value = DEFAULT_BODY;
        run(false);
        live.textContent = 'Reset to the starting values.';
    });
    run(false);
}

const source = b => b ? sub(`Body data: ${b.name}, μ ${formatNumber(b.mu, 8)} m³/s², R ${formatNumber(b.radius, 8)} m (${b.opm ? 'Outer Planets Mod' : 'stock'}, from the KSP installation's Kopernicus logs).`) : sub('Custom body: your μ and radius.');
const atmosphereNote = (b, alt, what, effect = 'drag would bring a real orbit down') => b && b.atmosphere && alt < b.atmosphere
    ? `<span class="fdc-warn">${what} is inside ${b.name}'s atmosphere, which reaches ${formatNumber(b.atmosphere / 1000, 4)} km: ${effect}.</span> `
    : '';

/* Circular orbit */
setupCard(document.getElementById('circular'), ({ get, scale, central }) => {
    const { mu, radius, body } = central();
    const altitude = get('altitude') * scale('altitudeUnit');
    const r = C.circularOrbit({ mu, radius, altitude });
    if (!r.ok) return { errors: r.errors };
    return {
        values: {
            r: distance(r.r), v: speed(r.v), T: duration(r.T),
            minutes: unit(r.minutes, 'min', 6), hours: unit(r.hours, 'h', 6),
        },
        note: atmosphereNote(body, altitude, 'This altitude') + source(body),
        summary: `Circular orbit: ${formatNumber(r.v)} metres per second, period ${formatNumber(r.minutes)} minutes.`,
    };
});

/* Escape velocity */
setupCard(document.getElementById('escape'), ({ get, scale, central }) => {
    const { mu, radius, body } = central();
    const altitude = get('altitude') * scale('altitudeUnit');
    const r = C.escapeVelocity({ mu, radius, altitude });
    if (!r.ok) return { errors: r.errors };
    return {
        values: { r: distance(r.r), g: unit(r.g, 'm/s²', 4), v: speed(r.v), kms: unit(r.kms, 'km/s', 5), circular: speed(r.circular) },
        note: atmosphereNote(body, altitude, 'This altitude', 'drag would add to what a real vehicle needs') + source(body),
        summary: `Escape speed ${formatNumber(r.v)} metres per second.`,
    };
});

/* Hohmann transfer */
const hohmannCard = document.getElementById('hohmann');
setupCard(hohmannCard, ({ form, get, scale, central }) => {
    const k = scale('altitudeUnit');
    form.querySelector('[data-alt-unit]').textContent = k === 1000 ? 'km' : 'm';
    const { mu, radius, body } = central();
    const alt1 = get('alt1') * k, alt2 = get('alt2') * k;
    const r = C.hohmann({ mu, radius, alt1, alt2 });
    drawTransfer(hohmannCard.querySelector('[data-diagram]'), r.ok ? { ...r, radius } : null);
    if (!r.ok) return { errors: r.errors };
    const dir = { raise: 'Raise the orbit: two prograde burns', lower: 'Lower the orbit: two retrograde burns', none: 'Same orbit: no transfer needed' }[r.direction];
    const phaseDeg = r.phase * 180 / Math.PI;
    let note = atmosphereNote(body, Math.min(alt1, alt2), r.direction === 'none' ? 'This orbit' : 'The lower orbit');
    if (body && body.id === 'kerbol') note += '<span class="fdc-info">Round Kerbol these are heliocentric burns, not the ejection and capture burns made from parking orbits round the planets.</span> ';
    return {
        values: {
            direction: `<span class="fdc-text">${dir}</span>`,
            vc1: speed(r.vc1), vc2: speed(r.vc2), at: distance(r.at),
            dv1: speed(r.dv1) + sub(r.direction === 'raise' ? 'prograde, at the start' : r.direction === 'lower' ? 'retrograde, at the start' : ''),
            dv2: speed(r.dv2) + sub(r.direction === 'raise' ? 'prograde, at apoapsis' : r.direction === 'lower' ? 'retrograde, at periapsis' : ''),
            total: speed(r.total), t: duration(r.t),
            phase: r.direction === 'none' ? '—' : unit(phaseDeg, '°', 4) + sub(phaseDeg >= 0 ? 'target ahead of you' : 'target behind you'),
        },
        note: note + source(body),
        summary: `Hohmann transfer: ${formatNumber(r.dv1)} plus ${formatNumber(r.dv2)} metres per second, total ${formatNumber(r.total)}, taking ${formatNumber(r.t / 60)} minutes.`,
    };
});

// Schematic: orbits keep their order and relative spacing but are spread out so low orbits stay readable
function drawTransfer(svg, r) {
    if (!r || !(r.r1 > 0 && r.r2 > 0)) { svg.innerHTML = ''; return; }
    const lo = Math.min(r.r1, r.r2), hi = Math.max(r.r1, r.r2);
    const place = x => hi === lo ? 72 : 46 + 46 * (x - lo) / (hi - lo);
    const r1 = place(r.r1), r2 = place(r.r2);
    const R = 30 * Math.min(1, r.radius / lo);
    const a = (r1 + r2) / 2, b = Math.sqrt(r1 * r2);
    const moving = r.direction !== 'none';
    svg.innerHTML = `
        <circle class="fdc-d-body" r="${Math.max(4, R)}"/>
        <circle class="fdc-d-orbit1" r="${r1}"/>
        <circle class="fdc-d-orbit2" r="${r2}"/>
        ${moving ? `<path class="fdc-d-transfer" d="M ${-r1} 0 A ${a} ${b} 0 0 1 ${r2} 0"/>` : ''}
        <circle class="fdc-d-burn" cx="${-r1}" cy="0" r="3.5"/>
        ${moving ? `<circle class="fdc-d-burn" cx="${r2}" cy="0" r="3.5"/>` : ''}
        <text class="fdc-d-label" x="${-r1}" y="15" text-anchor="middle">Δv₁</text>
        ${moving ? `<text class="fdc-d-label" x="${r2}" y="15" text-anchor="middle">Δv₂</text>` : ''}`;
}

/* Thrust-to-weight */
setupCard(document.getElementById('twr'), ({ form, get, scale }) => {
    const gs = form.elements.gsource.value;
    const b = gs !== CUSTOM ? findBody(gs) : null;
    const g = b ? surfaceGravity(b) : get('g');
    const targetText = form.elements.target.value.trim();
    const massKg = get('mass') * scale('massUnit');
    const r = C.thrustToWeight({ mass: massKg, thrust: get('thrust') * scale('thrustUnit'), g, target: targetText ? parseNumber(targetText) : undefined });
    if (!r.ok) {
        if (r.errors.g && b) delete r.errors.g;
        return { errors: r.errors };
    }
    const where = b ? `on ${b.name}'s surface (g = ${formatNumber(g, 4)} m/s²)` : `where g = ${formatNumber(g, 4)} m/s²`;
    let note = r.liftoff
        ? `<span class="fdc-ok">TWR above 1: the thrust exceeds the weight ${where}.</span> `
        : `<span class="fdc-warn">TWR ${r.twr === 1 ? 'of exactly' : 'below'} 1: this vehicle cannot lift off vertically ${where}.</span> `;
    if (r.requiredThrust != null) note += r.extraThrust > 0
        ? `The target needs ${formatNumber(r.extraThrust / 1000)} kN more thrust than this configuration has. `
        : `This configuration already meets the target, with ${formatNumber(-r.extraThrust / 1000)} kN to spare. `;
    return {
        values: {
            twr: `<span class="fdc-num">${formatNumber(r.twr, 4)}</span>`,
            weight: force(r.weight), accel: unit(r.accel, 'm/s²', 4), net: unit(r.net, 'm/s²', 4),
            requiredThrust: r.requiredThrust != null ? force(r.requiredThrust) : '<span class="fdc-text">Enter a target TWR</span>',
        },
        note,
        summary: `Thrust-to-weight ratio ${formatNumber(r.twr, 4)}.`,
    };
});

/* Rocket equation */
setupCard(document.getElementById('rocket'), ({ form, get, scale }) => {
    const k = scale('massUnit');
    const tonnes = k === 1000;
    form.querySelector('[data-mass-unit]').textContent = tonnes ? 't' : 'kg';
    const targetText = form.elements.targetDv.value.trim();
    const g0Text = form.elements.g0.value.trim();
    const r = C.rocketEquation({
        m0: get('m0') * k, mf: get('mf') * k, isp: get('isp'),
        g0: g0Text ? parseNumber(g0Text) : C.G0,
        targetDv: targetText ? parseNumber(targetText) : undefined,
    });
    if (!r.ok) return { errors: r.errors };
    let note = '';
    if (r.targetMf != null) {
        note = r.targetReachable
            ? `<span class="fdc-ok">For ${formatNumber(get('targetDv'))} m/s this stage needs to burn ${formatNumber(r.targetPropellant / (tonnes ? 1000 : 1))} ${tonnes ? 't' : 'kg'} of propellant, ending at ${formatNumber(r.targetMf / (tonnes ? 1000 : 1))} ${tonnes ? 't' : 'kg'} (mass ratio ${formatNumber(r.targetRatio, 4)}).</span> `
            : `<span class="fdc-warn">This stage cannot reach that Δv: it would have to end at ${formatNumber(r.targetMf / (tonnes ? 1000 : 1))} ${tonnes ? 't' : 'kg'}, lighter than its final mass. Add propellant, cut dry mass or use a higher Isp.</span> `;
    }
    note += '<span class="fdc-info">Ideal figure: no gravity, drag or steering losses.</span>';
    return {
        values: {
            dv: speed(r.dv), propellant: mass(r.propellant, tonnes), ratio: `<span class="fdc-num">${formatNumber(r.ratio, 5)}</span>`,
            ve: speed(r.ve),
            targetMf: r.targetMf != null ? mass(r.targetMf, tonnes) : '<span class="fdc-text">Enter a target Δv</span>',
        },
        note,
        summary: `Available delta-v ${formatNumber(r.dv)} metres per second.`,
    };
});

// For automated checks
window.__flightDynamics = { parseNumber, formatNumber, calc: C };
