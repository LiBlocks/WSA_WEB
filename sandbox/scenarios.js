// WSA Engineering Sandbox: the scenarios. Each scenario lists its parameters (one shared set of values:
// Basic mode shows some of them with plain labels, Pro mode shows them all), presets, challenges, and
// adapts a physics model from physics.js to the page: create, step, telemetry, debrief. No DOM, no three.js.
//
// Parameter values are kept in the units the controls show (kN, t, km, %, degrees); each scenario converts
// them to SI before they reach the physics.
import * as P from './physics.js';

const { G0, DEG } = P;

/* ---------- Formatting ---------- */

const finite = v => typeof v === 'number' && Number.isFinite(v);
export function num(v, digits = 0) {
    if (!finite(v)) return '—';
    return v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export const fmt = {
    kN: v => `${num(v / 1000, v < 1e4 ? 2 : v < 1e5 ? 1 : 0)} kN`,
    t: v => `${num(v / 1000, v < 1e4 ? 2 : 1)} t`,
    kg: v => `${num(v, 0)} kg`,
    kgs: v => `${num(v, v < 100 ? 1 : 0)} kg/s`,
    ms: v => `${num(v, Math.abs(v) < 100 ? 1 : 0)} m/s`,
    ms2: v => `${num(v, 2)} m/s²`,
    m: v => (Math.abs(v) >= 10000 ? `${num(v / 1000, 1)} km` : `${num(v, 0)} m`),
    km: v => (finite(v) ? `${num(v / 1000, Math.abs(v) < 1e7 ? 1 : 0)} km` : '—'),
    s: v => `${num(v, v < 100 ? 1 : 0)} s`,
    time: v => {
        if (!finite(v)) return '—';
        const a = Math.abs(v);
        if (a < 60) return `${num(v, 1)} s`;
        const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = Math.floor(a % 60);
        return `${v < 0 ? '−' : ''}${h ? `${h} h ` : ''}${m} min ${String(s).padStart(2, '0')} s`;
    },
    pct: v => `${num(v * 100, 0)}%`,
    deg: v => `${num(v / DEG, 1)}°`,
    ratio: v => (v === Infinity ? 'no gravity' : num(v, 2)),
    kNs: v => `${num(v / 1000, 0)} kN·s`,
    plain: v => (typeof v === 'string' ? v : num(v, 2)),
};

/* ---------- Parameter helpers ---------- */

// A parameter: { id, kind: 'range' | 'select' | 'toggle', value (default), min, max, step, unit, options,
//   basic: { label, help } or null (Pro only), pro: { label, help, sym }, live (applies during a run),
//   group, show(p) (when to show it) }
const range = (id, value, min, max, step, unit, basic, pro, extra = {}) => ({ id, kind: 'range', value, min, max, step, unit, basic, pro, ...extra });
const select = (id, value, options, basic, pro, extra = {}) => ({ id, kind: 'select', value, options, basic, pro, ...extra });
const toggle = (id, value, basic, pro, extra = {}) => ({ id, kind: 'toggle', value, basic, pro, ...extra });
const b = (label, help) => ({ label, help });

const WORLD_OPTIONS = [
    ...Object.values(P.WORLDS).map(w => ({ value: w.id, label: `${w.name} · ${num(w.g, w.g < 1 ? 3 : 2)} m/s²` })),
    { value: 'custom', label: 'Custom world' },
];

function worldParams(extra = {}) {
    return [
        select('world', 'kerbin', WORLD_OPTIONS,
            b('Gravity (world)', 'Which world the experiment happens on. Each one pulls with a different strength.'),
            b('Celestial body', 'Stock KSP bodies: radius and gravitational parameter μ from the same data the Flight Dynamics Center uses.'), { group: 'World', ...extra }),
        range('customG', 9.81, 0.05, 30, 0.01, 'm/s²',
            b('Gravity strength', 'How hard your custom world pulls, at its surface.'),
            b('Surface gravity g', 'g = μ / R². With the radius below this sets μ.'), { group: 'World', show: p => p.world === 'custom', ...extra }),
        range('customR', 600, 10, 7000, 10, 'km', null,
            b('Body radius R', 'The custom world\'s radius. μ = g R².'), { group: 'World', show: p => p.world === 'custom', ...extra }),
    ];
}
export function worldOf(p) {
    return p.world === 'custom' ? P.customWorld(p.customG, p.customR * 1000) : (P.WORLDS[p.world] || P.WORLDS.kerbin);
}

const timeStepParam = (value, min, max, step, extra = {}) => range('timeStep', value, min, max, step, 's', null,
    b('Physics time step Δt', 'The fixed step the integrator advances by. The display runs at your screen\'s frame rate; the physics always takes these equal steps, so a run is repeatable.'), { group: 'Simulation', ...extra });

const integratorParam = () => select('integrator', 'verlet', [
    { value: 'verlet', label: 'Velocity Verlet (symplectic)' },
    { value: 'rk4', label: 'Runge–Kutta 4' },
    { value: 'euler', label: 'Explicit Euler (to see it fail)' },
], null, b('Integrator', 'How each step is calculated. Verlet keeps an orbit\'s energy steady for ever; RK4 is very accurate per step; explicit Euler gains energy every orbit and spirals outward.'), { group: 'Simulation' });

/* ---------- Shared event wording ---------- */

const T = t => `T${t < 0 ? '−' : '+'}${Math.abs(t).toFixed(1)} s`;

/* =====================================================================================================
   A. Engine test stand
   ===================================================================================================== */

const engineParams = [
    range('engines', 1, 1, 4, 1, '', b('Number of engines', 'More engines side by side: more thrust, and more fuel used every second.'),
        b('Engine count n', 'Engines in the cluster. Total thrust and mass flow both scale with n.'), { group: 'Engine A' }),
    range('thrust', 900, 20, 2500, 10, 'kN', b('Engine power', 'How hard each engine pushes, in kilonewtons.'),
        b('Thrust per engine T', 'Full-throttle thrust of one engine (sea-level and vacuum thrust are not distinguished).'), { group: 'Engine A' }),
    range('isp', 285, 150, 460, 1, 's', b('Fuel efficiency', 'How much push the engine gets out of each kilogram of fuel. Higher numbers make fuel last longer at the same power.'),
        b('Specific impulse Isp', 'Seconds. Exhaust velocity is Isp × g0, and mass flow ṁ = T / (Isp g0).'), { group: 'Engine A' }),
    toggle('compare', 0, b('Compare with engine B', 'Run a second engine beside the first, with the same fuel load, to compare them.'),
        b('Comparison mode', 'Fire engine B on a second stand with the same propellant load, burn plan and throttle.'), { group: 'Comparison' }),
    range('bEngines', 1, 1, 4, 1, '', b('Engine B: number of engines', ''), b('Engine B count', ''), { group: 'Engine B', show: p => p.compare }),
    range('bThrust', 120, 20, 2500, 10, 'kN', b('Engine B: power', ''), b('Engine B thrust per engine', ''), { group: 'Engine B', show: p => p.compare }),
    range('bIsp', 345, 150, 460, 1, 's', b('Engine B: fuel efficiency', ''), b('Engine B specific impulse', ''), { group: 'Engine B', show: p => p.compare }),
    range('propellant', 20, 0.5, 50, 0.5, 't', b('Fuel amount', 'How much fuel each stand\'s tank holds.'),
        b('Propellant load', 'Propellant in each stand\'s tank, in tonnes.'), { group: 'Test plan' }),
    range('duration', 60, 5, 300, 5, 's', b('Burn length', 'How long the test should run. The engine shuts down early if the tank runs dry.'),
        b('Planned burn duration', 'The test controller commands shutdown at this time.'), { group: 'Test plan' }),
    range('throttle', 100, 10, 100, 1, '%', b('Throttle', 'Turn the engine down to make the fuel last longer. You can change it during the test.'),
        b('Throttle', 'Live. Thrust and mass flow both scale with throttle; Isp is held constant in this model.'), { group: 'Test plan', live: true }),
    range('refDry', 8, 1, 60, 0.5, 't', null,
        b('Reference vehicle dry mass', 'Used only for the "delta-v it would give" figure: an empty vehicle of this mass carrying the stand\'s propellant.'), { group: 'Test plan' }),
];

function engineCfg(p, which) {
    const B = which === 'B';
    return { thrust: (B ? p.bThrust : p.thrust) * 1000, isp: B ? p.bIsp : p.isp, engines: B ? p.bEngines : p.engines, propellant: p.propellant * 1000, duration: p.duration };
}

function engineDerived(p, which) {
    const c = engineCfg(p, which);
    const T = c.thrust * c.engines * p.throttle / 100;
    const mdot = P.massFlow(T, c.isp);
    return { T, mdot, burn: c.propellant / mdot, impulse: P.totalImpulse(c.isp, c.propellant), ve: P.exhaustVelocity(c.isp),
        dv: P.rocketDeltaV(c.isp, p.refDry * 1000 + c.propellant, p.refDry * 1000) };
}

const ENGINE = {
    id: 'engine', name: 'Engine Test Stand', short: 'Engine Test Stand', level: 'Introductory', view: 'stand',
    summary: 'Fire a rocket engine on a test stand. Change its power, efficiency and fuel, and compare two engines side by side.',
    learn: 'Thrust decides how hard an engine pushes; specific impulse decides how long the fuel lasts. Total impulse depends only on the fuel and the efficiency.',
    presetLabel: 'Engine profile',
    presets: [
        { id: 'booster', label: 'Booster engine (illustrative)', values: { engines: 1, thrust: 900, isp: 285, propellant: 20, duration: 60, throttle: 100, compare: 0 } },
        { id: 'sustainer', label: 'Sustainer engine (illustrative)', values: { engines: 1, thrust: 450, isp: 310, propellant: 12, duration: 90, throttle: 100, compare: 0 } },
        { id: 'vacuum', label: 'Vacuum engine (illustrative)', values: { engines: 1, thrust: 120, isp: 345, propellant: 6, duration: 180, throttle: 100, compare: 0 } },
        { id: 'cluster', label: 'Three-engine cluster (illustrative)', values: { engines: 3, thrust: 600, isp: 290, propellant: 40, duration: 60, throttle: 100, compare: 0 } },
        { id: 'versus', label: 'Comparison: booster vs vacuum engine', values: { engines: 1, thrust: 900, isp: 285, bEngines: 1, bThrust: 120, bIsp: 345, propellant: 6, duration: 300, throttle: 100, compare: 1 } },
    ],
    params: engineParams,
    challenges: [
        { id: 'full', label: 'Complete the planned burn', text: 'Run the engine for its whole planned burn without the tank running dry.' },
        { id: 'impulse', label: 'Efficiency test', text: 'Get at least 3,000 kN·s of total impulse out of just 1 t of propellant.', values: { propellant: 1, duration: 300, compare: 0 } },
        { id: 'compare', label: 'Head to head', text: 'Fire two engines on the same 6 t of propellant. Which burns out first, and which delivers more total impulse?', values: { compare: 1, propellant: 6, duration: 300, bThrust: 120, bIsp: 345, bEngines: 1 } },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [0.5, 1, 2, 5, 10], scale: 1,
    dt: () => 1 / 60,
    assumptions: [
        'Engine profiles are illustrative and are not KSP part data or the specifications of any WSA engine.',
        'Specific impulse is constant: it does not change with throttle or air pressure.',
        'Ignition and shutdown ramps (0.6 s) are illustrative. No temperatures or pressures are modelled.',
        'The stand is fixed: the load cell reads the engine\'s full thrust.',
    ],
    create(p) {
        const sim = { t: -3, countdown: true, A: P.createStand(engineCfg(p, 'A')), B: p.compare ? P.createStand(engineCfg(p, 'B')) : null, stoppedAt: null };
        return sim;
    },
    step(sim, p, input, dt) {
        const out = [];
        const cmds = input.commands;
        let command = null;
        if (sim.t < 0) {
            sim.t += dt;
            if (sim.t >= 0) { sim.t = 0; command = 'ignite'; }
            else return out;
        }
        if (cmds.includes('shutdown')) command = 'shutdown';
        else if (cmds.includes('ignite')) command = 'ignite';
        for (const key of ['A', 'B']) {
            const st = sim[key];
            if (!st) continue;
            const name = sim.B ? `Engine ${key}` : 'Engine';
            for (const e of P.stepStand(st, { throttle: p.throttle / 100, command }, dt)) {
                if (e.type === 'ignition') out.push({ text: `${name} ignition`, level: 'info' });
                if (e.type === 'shutdown') out.push({ text: `${name} shutdown command (${e.reason === 'duration' ? 'planned burn complete' : 'manual'})`, level: 'info' });
                if (e.type === 'flameout') out.push({ text: `${name} flameout: propellant exhausted after ${st.burnTime.toFixed(1)} s`, level: 'warn' });
                if (e.type === 'off') out.push({ text: `${name} off. ${fmt.kNs(st.impulse)} delivered`, level: 'info' });
                if (e.type === 'noprop') out.push({ text: `${name}: no propellant left`, level: 'warn' });
            }
        }
        sim.t = sim.A.t;
        const stopped = [sim.A, sim.B].filter(Boolean).every(s => (s.phase === 'off' || s.phase === 'flameout') && s.spool === 0);
        if (stopped && sim.stoppedAt === null) sim.stoppedAt = sim.t;
        if (!stopped) sim.stoppedAt = null;
        return out;
    },
    finished: sim => sim.stoppedAt !== null && sim.t - sim.stoppedAt > 1.5,
    telemetry(sim, p) {
        const a = sim.A, bb = sim.B;
        const tm = {
            clock: sim.t, status: standStatus(a, sim), thrust: a.thrust, mdot: a.mdot, prop: a.prop, propFrac: a.prop / a.cfg.propellant,
            burnTime: a.burnTime, impulse: a.impulse, ispEff: a.used > 0 ? a.impulse / (a.used * G0) : a.cfg.isp,
            totalThrust: a.cfg.thrust * a.cfg.engines,
        };
        if (bb) Object.assign(tm, { statusB: standStatus(bb, sim), thrustB: bb.thrust, mdotB: bb.mdot, propB: bb.prop, propFracB: bb.prop / bb.cfg.propellant, burnTimeB: bb.burnTime, impulseB: bb.impulse });
        return tm;
    },
    readouts: [
        { key: 'status', label: 'Engine', fmt: fmt.plain, hud: true },
        { key: 'thrust', label: 'Thrust (load cell)', basic: 'Push right now', fmt: fmt.kN, hud: true },
        { key: 'mdot', label: 'Mass flow ṁ', basic: 'Fuel used per second', fmt: fmt.kgs, hud: true },
        { key: 'prop', label: 'Propellant left', basic: 'Fuel left', fmt: fmt.t, bar: 'propFrac' },
        { key: 'burnTime', label: 'Burn time', fmt: fmt.s, hud: true },
        { key: 'impulse', label: 'Total impulse ∫T dt', basic: 'Total push delivered', fmt: fmt.kNs },
        { key: 'ispEff', label: 'Measured Isp (impulse ÷ propellant × g0)', fmt: v => `${num(v, 1)} s`, pro: true },
        { key: 'statusB', label: 'Engine B', fmt: fmt.plain, only: 'B' },
        { key: 'thrustB', label: 'Engine B thrust', fmt: fmt.kN, only: 'B', hud: true },
        { key: 'mdotB', label: 'Engine B mass flow', fmt: fmt.kgs, only: 'B' },
        { key: 'propB', label: 'Engine B propellant left', fmt: fmt.t, bar: 'propFracB', only: 'B' },
        { key: 'impulseB', label: 'Engine B total impulse', fmt: fmt.kNs, only: 'B' },
    ],
    graphs: [
        { id: 'thrust', label: 'Thrust', unit: 'kN', series: [{ key: 'thrust', label: 'A', k: 1e-3 }, { key: 'thrustB', label: 'B', k: 1e-3 }] },
        { id: 'prop', label: 'Propellant left', unit: 't', series: [{ key: 'prop', label: 'A', k: 1e-3 }, { key: 'propB', label: 'B', k: 1e-3 }] },
    ],
    actions: [
        { id: 'shutdown', label: 'Shut down', key: 'K', running: true },
        { id: 'ignite', label: 'Re-ignite', key: 'I', running: true },
    ],
    derived(p) {
        const a = engineDerived(p, 'A');
        const rows = [
            { label: 'Total thrust', basic: 'Total push', value: fmt.kN(a.T) },
            { label: 'Mass flow ṁ = T / (Isp g0)', basic: 'Fuel used per second', value: fmt.kgs(a.mdot) },
            { label: 'Burn time until empty', basic: 'Fuel lasts', value: fmt.s(a.burn) },
            { label: 'Total impulse Isp g0 m', basic: 'Total push the fuel can give', value: fmt.kNs(a.impulse) },
            { label: 'Exhaust velocity Isp g0', value: fmt.ms(a.ve), pro: true },
            { label: `Δv for a ${num(p.refDry, 1)} t vehicle`, value: fmt.ms(a.dv), pro: true },
        ];
        if (p.compare) {
            const c = engineDerived(p, 'B');
            rows.push({ label: 'Engine B burn time until empty', basic: 'Engine B fuel lasts', value: fmt.s(c.burn) }, { label: 'Engine B total impulse', basic: 'Engine B total push', value: fmt.kNs(c.impulse) });
        }
        return rows;
    },
    note(p, id) {
        const a = engineDerived(p, 'A');
        if (id === 'isp') return `Higher efficiency (Isp ${p.isp} s) means less fuel per second for the same push: ${fmt.kgs(a.mdot)} now, so the tank lasts ${fmt.s(a.burn)}.`;
        if (id === 'thrust' || id === 'engines') return `More thrust uses fuel faster: ${fmt.kN(a.T)} burns ${fmt.kgs(a.mdot)}. The total push the tank can give stays ${fmt.kNs(a.impulse)}; only Isp and the fuel change that.`;
        if (id === 'propellant') return `${num(p.propellant, 1)} t of propellant can deliver ${fmt.kNs(a.impulse)} in total at Isp ${p.isp} s.`;
        if (id === 'throttle') return `At ${p.throttle}% throttle the engine makes ${fmt.kN(a.T)} and the fuel lasts ${fmt.s(a.burn)}. Total impulse doesn't change with throttle.`;
        return '';
    },
    debrief(sim, p, ch) {
        const a = sim.A, bb = sim.B;
        const metrics = [
            ['Burn time', fmt.s(a.burnTime)], ['Peak thrust', fmt.kN(a.peak)], ['Propellant used', fmt.t(a.used)], ['Total impulse', fmt.kNs(a.impulse)],
            ['Average thrust', fmt.kN(a.burnTime > 0 ? a.impulse / a.burnTime : 0)],
        ];
        if (bb) metrics.push(['Engine B burn time', fmt.s(bb.burnTime)], ['Engine B total impulse', fmt.kNs(bb.impulse)], ['Engine B propellant used', fmt.t(bb.used)]);
        let met = null, score = null, summary;
        const ranDry = a.endReason === 'propellant';
        if (ch === 'full') {
            met = a.endReason === 'duration';
            score = Math.round(100 * Math.min(1, a.burnTime / p.duration));
            summary = met ? `The engine ran for the full ${p.duration} s plan with ${fmt.t(a.prop)} of propellant to spare.`
                : ranDry ? `The tank ran dry after ${a.burnTime.toFixed(1)} s of a ${p.duration} s plan. Lower the throttle, add fuel or use a more efficient engine.`
                    : `The engine was shut down by hand after ${a.burnTime.toFixed(1)} s.`;
        } else if (ch === 'impulse') {
            met = a.impulse >= 3e6 - 1;
            score = Math.round(100 * Math.min(1, a.impulse / 3e6));
            summary = met ? `${fmt.kNs(a.impulse)} from ${fmt.t(a.used)}: an Isp of ${p.isp} s gets enough push out of every kilogram.`
                : `${fmt.kNs(a.impulse)} from ${fmt.t(a.used)}. More thrust won't help here: only a higher Isp gets more impulse out of the same fuel (about 306 s or more).`;
        } else if (ch === 'compare' && bb) {
            met = true;
            const first = a.burnTime < bb.burnTime ? 'A' : 'B';
            const more = a.impulse > bb.impulse ? 'A' : 'B';
            summary = `Engine ${first} burned out first; engine ${more} delivered more total impulse (${fmt.kNs(Math.max(a.impulse, bb.impulse))} against ${fmt.kNs(Math.min(a.impulse, bb.impulse))}).`;
        } else {
            summary = `${sim.B ? 'Both engines' : 'The engine'} finished the test. ${ranDry ? 'Engine A ran its tank dry.' : ''}`;
        }
        return {
            title: met === false ? 'Test complete: not quite there' : 'Test complete', met, score, summary, metrics,
            lesson: 'Thrust sets how fast propellant is used; specific impulse sets how much push each kilogram gives. Total impulse = Isp × g0 × propellant mass, whatever the thrust.',
        };
    },
    result: sim => ({ 'Burn time': fmt.s(sim.A.burnTime), 'Total impulse': fmt.kNs(sim.A.impulse), 'Peak thrust': fmt.kN(sim.A.peak), 'Propellant used': fmt.t(sim.A.used) }),
};

function standStatus(s, sim) {
    if (sim.t < 0) return `COUNTDOWN ${Math.ceil(-sim.t)}`;
    return { ready: 'READY', ignition: 'IGNITION', running: 'RUNNING', shutdown: 'SHUTDOWN', off: 'OFF', flameout: 'FLAMEOUT' }[s.phase] || s.phase.toUpperCase();
}

/* =====================================================================================================
   Flight helpers (lift-off, staging, free play)
   ===================================================================================================== */

function flightEvents(raw, sim, label = i => `Stage ${i + 1}`) {
    const out = [];
    for (const e of raw) {
        switch (e.type) {
            case 'ignition': out.push({ text: `${label(e.stage)} ignition`, level: 'info' }); break;
            case 'cutoff': out.push({ text: `${label(e.stage)} engine cut-off`, level: 'info' }); break;
            case 'burnout': out.push({ text: `${label(e.stage)} burnout: propellant exhausted`, level: 'info' }); break;
            case 'liftoff': out.push({ text: `Lift-off! Thrust-to-weight ${num(e.twr, 2)}`, level: 'ok' }); break;
            case 'separation':
                out.push({ text: `${label(e.stage)} separated${e.left > 1 ? `, with ${fmt.t(e.left)} of propellant still in it` : ''}. Mass ${fmt.t(e.massBefore)} → ${fmt.t(e.massAfter)}`, level: e.left > 1 ? 'warn' : 'ok' });
                sim.timeline.push({ t: sim.f.t, stage: e.stage, left: e.left, before: e.massBefore, after: e.massAfter });
                break;
            case 'nostage': out.push({ text: 'No stage left to separate', level: 'warn' }); break;
            case 'noprop': out.push({ text: 'No propellant in this stage', level: 'warn' }); break;
            case 'apoapsis': out.push({ text: `Highest point reached: ${fmt.m(e.altitude)}`, level: 'info' }); break;
            case 'touchdown': out.push({ text: `Back on the ground at ${fmt.ms(e.speed)}`, level: 'ok' }); break;
            case 'impact': out.push({ text: `Impact at ${fmt.ms(e.speed)}`, level: 'bad' }); break;
            default: break;
        }
    }
    return out;
}

function flightTelemetry(f) {
    const m = P.flightMass(f);
    const g = P.localGravity(f);
    const up = f.gravity ? P.norm(f.r) : [0, 1, 0];
    const vVert = P.dot(f.v, up);
    const speed = P.len(f.v);
    const st = f.stages[f.active];
    const tm = {
        clock: f.t, altitude: P.altitude(f), speed, vVert, vHoriz: Math.sqrt(Math.max(0, speed * speed - vVert * vVert)),
        mass: m, thrust: f.thrust, weight: m * g, g, twr: P.thrustToWeight(f.thrust, m, g),
        twrMax: st ? P.thrustToWeight(st.thrust * st.engines, m, g) : 0,
        accel: f.thrust / m * P.dot(f.dir, up) - g, accelTotal: f.thrust / m,
        prop: st ? st.prop : 0, propFrac: st && st.prop0 > 0 ? st.prop / st.prop0 : 0, mdot: f.mdot,
        dvUsed: f.dvUsed, dvLeft: P.flightDeltaVLeft(f), stage: f.active + 1, stages: f.stages.length, wasted: f.wasted,
        engine: f.engineOn ? 'BURNING' : f.igniteAt !== null ? 'STAGING' : 'OFF',
        dryMass: st ? st.dry : 0, perEngine: st ? st.thrust : 0, maxAlt: f.maxAlt,
    };
    if (f.gravity && !f.landed) {
        const el = P.elements(f.r, f.v, f.mu);
        // A vertical climb is a straight-line "orbit" (e = 1): use the energy for its highest point instead
        tm.ap = el.energy < 0 ? el.a * (1 + Math.min(el.e, 1)) - f.R : Infinity;
        tm.pe = el.rp - f.R;
        tm.ecc = el.e;
        tm.timeToAp = el.e < 1 ? (el.vr > 0 ? el.timeToAp : 0) : Infinity;
        tm.el = el;
    }
    return tm;
}

function stageParams(n, defaults, show) {
    const out = [];
    for (let i = 1; i <= n; i++) {
        const d = defaults[i - 1];
        const g = `Stage ${i}`;
        const vis = p => show(p) && p.stageCount >= i;
        out.push(
            range(`s${i}Prop`, d.prop, 0, 400, 0.5, 't', b(`Stage ${i} fuel`, 'Propellant in this stage.'), b(`Stage ${i} propellant`, ''), { group: g, show: vis }),
            range(`s${i}Engines`, d.engines, 1, 9, 1, '', b(`Stage ${i} engines`, 'How many engines this stage fires at once.'), b(`Stage ${i} engine count`, ''), { group: g, show: vis }),
            range(`s${i}Thrust`, d.thrust, 5, 3000, 5, 'kN', b(`Stage ${i} engine power`, 'Thrust of each engine on this stage.'), b(`Stage ${i} thrust per engine`, ''), { group: g, show: vis }),
            range(`s${i}Dry`, d.dry, 0.1, 100, 0.1, 't', null, b(`Stage ${i} dry mass`, 'Tanks, structure and engines without propellant.'), { group: g, show: vis }),
            range(`s${i}Isp`, d.isp, 150, 460, 1, 's', null, b(`Stage ${i} specific impulse`, ''), { group: g, show: vis }),
        );
    }
    return out;
}

function stagesOf(p) {
    const out = [];
    for (let i = 1; i <= p.stageCount; i++) {
        out.push({ dry: p[`s${i}Dry`] * 1000, prop: p[`s${i}Prop`] * 1000, thrust: p[`s${i}Thrust`] * 1000, engines: p[`s${i}Engines`], isp: p[`s${i}Isp`] });
    }
    return out;
}

/* =====================================================================================================
   B. Thrust-to-weight and lift-off lab
   ===================================================================================================== */

function liftCfg(p) {
    const w = worldOf(p);
    return { w, stage: { dry: p.dryMass * 1000, prop: p.propellant * 1000, thrust: p.thrust * 1000, engines: p.engines, isp: p.isp } };
}

const LIFTOFF = {
    id: 'liftoff', name: 'Thrust-to-Weight and Lift-Off Lab', short: 'Lift-Off Lab', level: 'Introductory', view: 'flight',
    summary: 'A rocket on the pad: will it lift off, sit still or leap away? Change its mass, engines and gravity and find out.',
    learn: 'A rocket only lifts off when its thrust is greater than its weight: TWR = T / (m g) above 1. As fuel burns, the rocket gets lighter and its TWR rises.',
    presetLabel: 'Preset',
    presets: [
        { id: 'standard', label: 'Medium rocket on Kerbin', values: { world: 'kerbin', dryMass: 12, propellant: 30, engines: 3, thrust: 250, isp: 290, throttle: 100 } },
        { id: 'heavy', label: 'Too heavy to lift off (at first)', values: { world: 'kerbin', dryMass: 20, propellant: 40, engines: 3, thrust: 180, isp: 290, throttle: 100 } },
        { id: 'mun', label: 'Same rocket on the Mun', values: { world: 'mun', dryMass: 12, propellant: 30, engines: 3, thrust: 250, isp: 290, throttle: 100 } },
        { id: 'eve', label: 'Same rocket on Eve', values: { world: 'eve', dryMass: 12, propellant: 30, engines: 3, thrust: 250, isp: 290, throttle: 100 } },
    ],
    params: [
        ...worldParams(),
        range('dryMass', 12, 0.5, 200, 0.5, 't', b('Rocket mass (empty)', 'How heavy the rocket is without fuel.'), b('Dry mass m_dry', ''), { group: 'Vehicle' }),
        range('propellant', 30, 0, 400, 0.5, 't', b('Fuel amount', 'Fuel adds weight too, until it is burned.'), b('Propellant mass m_p', ''), { group: 'Vehicle' }),
        range('engines', 3, 1, 9, 1, '', b('Number of engines', ''), b('Engine count n', ''), { group: 'Engines' }),
        range('thrust', 250, 5, 3000, 5, 'kN', b('Engine power', 'How hard each engine pushes.'), b('Thrust per engine', ''), { group: 'Engines' }),
        range('isp', 290, 150, 460, 1, 's', null, b('Specific impulse Isp', 'Sets how fast the propellant is used: ṁ = T / (Isp g0).'), { group: 'Engines' }),
        range('throttle', 100, 0, 100, 1, '%', b('Throttle', 'You can change it during the flight.'), b('Throttle', 'Live.'), { group: 'Engines', live: true }),
        range('ceiling', 2, 0.5, 20, 0.5, 'km', null, b('Test ceiling', 'The experiment ends when the rocket climbs past this altitude.'), { group: 'Simulation' }),
    ],
    challenges: [
        { id: 'ceiling', label: 'Reach the test ceiling', text: 'Lift off and climb past the test ceiling (2 km unless you change it in Pro mode).' },
        { id: 'gentle', label: 'Gentle lift-off', text: 'Lift off with a thrust-to-weight ratio between 1.2 and 1.5 at ignition, and reach the ceiling.' },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [0.5, 1, 2, 4, 8], scale: 1,
    dt: () => 1 / 50,
    assumptions: [
        'A point-mass rocket flying straight up in the body\'s inverse-square gravity. No air resistance, no wind, no planet rotation.',
        'The pad holds the rocket until its thrust exceeds its weight; it never sinks into the ground.',
        'Engine values are illustrative, not KSP part data. Worlds use stock KSP gravity and radius.',
    ],
    create(p) {
        const { w, stage } = liftCfg(p);
        const f = P.createFlight({ mu: w.mu, radius: w.radius, stages: [stage], payload: 0, start: { kind: 'pad' } });
        const m0 = P.flightMass(f);
        return { t: -3, f, w, timeline: [], ignTwr: P.thrustToWeight(stage.thrust * stage.engines * p.throttle / 100, m0, w.g), reached: false, endAt: null, outcome: null };
    },
    step(sim, p, input, dt) {
        if (sim.t < 0) {
            sim.t += dt;
            if (sim.t < 0) return [];
            sim.t = 0;
            input.commands.push('ignite');
            const m = P.flightMass(sim.f);
            sim.ignTwr = P.thrustToWeight(p.thrust * 1000 * p.engines * p.throttle / 100, m, sim.w.g);
        }
        const cmds = input.commands.map(c => (c === 'cut' ? 'cutoff' : c));
        const out = flightEvents(P.stepFlight(sim.f, { throttle: p.throttle / 100, steer: { mode: 'vertical' }, commands: cmds }, dt), sim, () => 'Engine');
        sim.t = sim.f.t;
        const f = sim.f;
        if (!sim.reached && P.altitude(f) >= p.ceiling * 1000) {
            sim.reached = true;
            sim.outcome = 'ceiling';
            sim.endAt = f.t + 1;
            out.push({ text: `Passed the ${num(p.ceiling, 1)} km test ceiling`, level: 'ok' });
        }
        if (sim.endAt === null) {
            if (f.crashed) { sim.outcome = 'impact'; sim.endAt = f.t + 1.5; }
            else if (f.landed && f.liftoff !== null && !f.engineOn) { sim.outcome = 'touchdown'; sim.endAt = f.t + 1.5; }
            else if (f.landed && f.liftoff === null && f.stages[0].prop <= 0) {
                sim.outcome = 'stuck';
                sim.endAt = f.t + 1.5;
                out.push({ text: 'Out of propellant without lifting off', level: 'warn' });
            } else if (f.landed && f.liftoff === null && !f.engineOn && f.t > 1) { sim.outcome = 'stuck'; sim.endAt = f.t + 1.5; }
        }
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry: sim => ({ ...flightTelemetry(sim.f), status: sim.t < 0 ? `COUNTDOWN ${Math.ceil(-sim.t)}` : sim.f.landed ? (sim.f.engineOn ? 'HELD ON PAD' : 'ON PAD') : 'CLIMBING' }),
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'twr', label: 'Thrust-to-weight T/(m g)', basic: 'Thrust-to-weight', fmt: fmt.ratio, hud: true },
        { key: 'accel', label: 'Net vertical acceleration', basic: 'Speeding up by', fmt: fmt.ms2, hud: true },
        { key: 'thrust', label: 'Total thrust', basic: 'Engine push', fmt: fmt.kN },
        { key: 'weight', label: 'Weight m g', basic: 'Weight', fmt: fmt.kN },
        { key: 'mass', label: 'Vehicle mass', basic: 'Mass', fmt: fmt.t },
        { key: 'altitude', label: 'Altitude', fmt: fmt.m, hud: true },
        { key: 'vVert', label: 'Vertical speed', fmt: fmt.ms, hud: true },
        { key: 'prop', label: 'Propellant left', basic: 'Fuel left', fmt: fmt.t, bar: 'propFrac' },
        { key: 'dryMass', label: 'Dry mass', fmt: fmt.t, pro: true },
        { key: 'perEngine', label: 'Thrust per engine (full)', fmt: fmt.kN, pro: true },
        { key: 'mdot', label: 'Mass flow ṁ', fmt: fmt.kgs, pro: true },
        { key: 'g', label: 'Local gravity g', fmt: fmt.ms2, pro: true },
    ],
    graphs: [
        { id: 'twr', label: 'Thrust-to-weight', unit: '', series: [{ key: 'twr', label: 'TWR', cap: 10 }] },
        { id: 'alt', label: 'Altitude', unit: 'm', series: [{ key: 'altitude', label: 'Altitude' }] },
    ],
    actions: [{ id: 'cut', label: 'Cut engines', key: 'K', running: true }, { id: 'ignite', label: 'Ignite', key: 'I', running: true }],
    derived(p) {
        const { w, stage } = liftCfg(p);
        const m = stage.dry + stage.prop;
        const T = stage.thrust * stage.engines * p.throttle / 100;
        const twr = P.thrustToWeight(T, m, w.g);
        const twrEmpty = P.thrustToWeight(T, stage.dry, w.g);
        return [
            { label: 'Total thrust T', basic: 'Engine push', value: fmt.kN(T) },
            { label: 'Weight m g', basic: 'Weight', value: fmt.kN(m * w.g) },
            { label: 'TWR at ignition', basic: 'Thrust-to-weight', value: fmt.ratio(twr), tone: twr > 1 ? 'ok' : 'bad' },
            { label: 'Net acceleration (T − m g) / m', basic: 'Starts speeding up at', value: twr > 1 ? fmt.ms2(T / m - w.g) : 'stays on the pad' },
            { label: 'TWR when the tank is empty', value: fmt.ratio(twrEmpty), pro: true },
            { label: 'Burn time at this throttle', value: fmt.s(stage.prop / Math.max(1e-9, P.massFlow(T, stage.isp))), pro: true },
        ];
    },
    note(p) {
        const { w, stage } = liftCfg(p);
        const m = stage.dry + stage.prop, T = stage.thrust * stage.engines * p.throttle / 100;
        const twr = P.thrustToWeight(T, m, w.g);
        if (twr > 1) return `TWR ${num(twr, 2)}: thrust (${fmt.kN(T)}) beats weight (${fmt.kN(m * w.g)}), so the rocket accelerates upward at ${fmt.ms2(T / m - w.g)} from the moment it ignites.`;
        const needBurn = m - T / w.g;
        if (needBurn > 0 && needBurn < stage.prop) return `TWR ${num(twr, 2)}: too heavy to lift off yet. Once it has burned ${fmt.t(needBurn)} of fuel it will be light enough.`;
        return `TWR ${num(twr, 2)}: weight (${fmt.kN(m * w.g)}) is more than the thrust (${fmt.kN(T)}), so it can't lift off.`;
    },
    debrief(sim, p, ch) {
        const f = sim.f;
        const metrics = [
            ['TWR at ignition', fmt.ratio(sim.ignTwr)], ['Lift-off', f.liftoff === null ? 'never' : `T+${f.liftoff.toFixed(1)} s`],
            ['Highest altitude', fmt.m(f.maxAlt)], ['Top speed', fmt.ms(f.maxSpeed)], ['Propellant used', fmt.t(f.stages[0].prop0 - f.stages[0].prop)],
        ];
        const reached = sim.outcome === 'ceiling';
        const left = f.stages[0].prop / Math.max(1, f.stages[0].prop0);
        let met = null, score = null;
        if (ch === 'ceiling') {
            met = reached;
            score = reached ? Math.round(60 + 40 * left) : Math.round(50 * Math.min(1, f.maxAlt / (p.ceiling * 1000)));
        } else if (ch === 'gentle') {
            met = reached && sim.ignTwr >= 1.2 && sim.ignTwr <= 1.5;
            score = met ? 100 : reached ? 60 : Math.round(50 * Math.min(1, f.maxAlt / (p.ceiling * 1000)));
        }
        const summary = {
            ceiling: `The rocket lifted off ${f.liftoff > 0.5 ? `after ${f.liftoff.toFixed(1)} s on the pad` : 'straight away'} and passed the ${num(p.ceiling, 1)} km ceiling.`,
            stuck: 'The rocket never lifted off: its weight stayed more than its thrust.',
            touchdown: 'The rocket lifted off but came back down.',
            impact: 'The rocket lifted off, but fell back and hit the ground.',
        }[sim.outcome] || 'Experiment ended.';
        return { title: reached ? 'Lift-off!' : 'Experiment complete', met, score, summary, metrics,
            lesson: 'TWR = T / (m g). Above 1 the rocket accelerates upward at (T − m g) / m. Burning fuel lowers m, so TWR climbs during the flight. A low TWR wastes fuel holding the rocket up instead of speeding it up.' };
    },
    result: sim => ({ 'TWR at ignition': fmt.ratio(sim.ignTwr), 'Highest altitude': fmt.m(sim.f.maxAlt), 'Lift-off': sim.f.liftoff === null ? 'never' : `T+${sim.f.liftoff.toFixed(1)} s` }),
};

/* =====================================================================================================
   C. Staging laboratory
   ===================================================================================================== */

const STAGE_DEFAULTS = [
    { dry: 6, prop: 40, engines: 3, thrust: 300, isp: 290 },
    { dry: 2, prop: 12, engines: 1, thrust: 120, isp: 330 },
    { dry: 0.8, prop: 4, engines: 1, thrust: 40, isp: 345 },
    { dry: 0.3, prop: 1.2, engines: 1, thrust: 15, isp: 350 },
];

function stagingWorld(p) {
    if (p.env === 'space') return null;
    return P.WORLDS[p.env] || P.WORLDS.kerbin;
}

const STAGING = {
    id: 'staging', name: 'Staging Laboratory', short: 'Staging Lab', level: 'Intermediate', view: 'flight',
    summary: 'Build a rocket of up to four stages, fire it and drop each empty stage. See how shedding dead weight adds speed.',
    learn: 'Each stage gives Δv = Isp g0 ln(m₀ / m₁). Dropping empty tanks and engines makes the remaining rocket lighter, so the next stage achieves more.',
    presetLabel: 'Rocket',
    presets: [
        { id: 'two', label: 'Two-stage rocket in empty space', values: { env: 'space', stageCount: 2, payload: 1, staging: 'auto', ...stageVals(STAGE_DEFAULTS) } },
        { id: 'three', label: 'Three-stage rocket in empty space', values: { env: 'space', stageCount: 3, payload: 0.5, staging: 'auto', ...stageVals(STAGE_DEFAULTS) } },
        { id: 'single', label: 'Single stage, same propellant', values: { env: 'space', stageCount: 1, payload: 1, staging: 'auto', s1Dry: 8.8, s1Prop: 52, s1Engines: 3, s1Thrust: 300, s1Isp: 290 } },
        { id: 'kerbin', label: 'Two stages, straight up from Kerbin', values: { env: 'kerbin', stageCount: 2, payload: 1, staging: 'auto', ...stageVals(STAGE_DEFAULTS) } },
    ],
    params: [
        select('env', 'space', [{ value: 'space', label: 'Empty space (no gravity)' }, { value: 'kerbin', label: 'Straight up from Kerbin' }, { value: 'mun', label: 'Straight up from the Mun' }],
            b('Where', 'In empty space the rocket\'s final speed is exactly its delta-v. Launching against gravity loses some of it.'),
            b('Environment', 'Empty space: no gravity, so the speed gained equals the ideal Δv. Kerbin or the Mun: a vertical flight in the body\'s gravity, so some Δv goes into fighting gravity (gravity losses).'), { group: 'Setup' }),
        range('stageCount', 2, 1, 4, 1, '', b('Number of stages', ''), b('Stage count', ''), { group: 'Setup' }),
        range('payload', 1, 0, 50, 0.1, 't', b('Payload', 'What the rocket is carrying on top.'), b('Payload mass', ''), { group: 'Setup' }),
        select('staging', 'auto', [{ value: 'auto', label: 'Automatic: when a stage is empty' }, { value: 'manual', label: 'Manual: press Stage' }],
            b('Staging', 'Drop each stage automatically when it runs out of fuel, or press Stage yourself.'),
            b('Staging condition', 'Automatic stages at burnout. Manual leaves it to you; staging early throws away the propellant still in the stage.'), { group: 'Setup' }),
        range('stageDelay', 1, 0, 5, 0.1, 's', null, b('Separation to ignition delay', 'Coasting time between dropping a stage and lighting the next.'), { group: 'Setup' }),
        range('throttle', 100, 0, 100, 1, '%', b('Throttle', ''), b('Throttle', 'Live.'), { group: 'Setup', live: true }),
        ...stageParams(4, STAGE_DEFAULTS, () => true),
    ],
    challenges: [
        { id: 'speed', label: 'Reach top speed', text: 'Get the most speed out of the rocket: stage at the right times and waste nothing.' },
        { id: 'clean', label: 'Clean staging by hand', text: 'Stage manually and throw away less than 2% of the propellant.', values: { staging: 'manual' } },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [0.5, 1, 2, 5, 10, 20], scale: 2,
    dt: () => 1 / 50,
    assumptions: [
        'Point-mass rocket flying straight up (or in empty space). No air, no planet rotation.',
        'The rocket equation is applied exactly in every step, so in empty space the speed gained equals the ideal Δv.',
        'Separation pushes the spent stage back at 1.5 m/s (illustrative); its engines and leftover propellant leave with it.',
        'Tank lengths are drawn in proportion to propellant mass. Stage values are illustrative.',
    ],
    create(p) {
        const w = stagingWorld(p);
        const stages = stagesOf(p);
        const f = P.createFlight({ mu: w ? w.mu : 0, radius: w ? w.radius : 0, stages, payload: p.payload * 1000, start: { kind: w ? 'pad' : 'space' } });
        return { t: -3, f, w, timeline: [], ideal: P.stackDeltaV(stages, p.payload * 1000).total, endAt: null, outcome: null, prompt: false };
    },
    step(sim, p, input, dt) {
        if (sim.t < 0) {
            sim.t += dt;
            if (sim.t < 0) return [];
            sim.t = 0;
            input.commands.push('ignite');
        }
        const f = sim.f;
        const out = flightEvents(P.stepFlight(f, { throttle: p.throttle / 100, steer: { mode: 'vertical' }, commands: input.commands, autoStage: p.staging === 'auto', stageDelay: p.stageDelay, igniteAfterStage: true }, dt), sim);
        sim.t = f.t;
        const st = f.stages[f.active];
        const empty = st.prop <= 0 && !f.engineOn && f.igniteAt === null;
        if (p.staging === 'manual' && empty && f.active < f.stages.length - 1 && !sim.prompt) {
            sim.prompt = true;
            out.push({ text: `Stage ${f.active + 1} is empty: press Stage`, level: 'warn' });
        }
        if (!empty) sim.prompt = false;
        if (sim.endAt === null) {
            if (f.crashed) { sim.outcome = 'impact'; sim.endAt = f.t + 1.5; }
            else if (empty && f.active === f.stages.length - 1) { sim.outcome = 'done'; sim.endAt = f.t + 3; out.push({ text: 'Final stage burned out', level: 'ok' }); }
            else if (f.landed && f.liftoff !== null) { sim.outcome = 'touchdown'; sim.endAt = f.t + 1.5; }
        }
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry: sim => ({ ...flightTelemetry(sim.f), status: sim.t < 0 ? `COUNTDOWN ${Math.ceil(-sim.t)}` : sim.f.engineOn ? `STAGE ${sim.f.active + 1} BURNING` : sim.f.igniteAt !== null ? 'SEPARATION' : 'COASTING' }),
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'stage', label: 'Active stage', fmt: v => `${v}`, hud: false },
        { key: 'speed', label: 'Speed', fmt: fmt.ms, hud: true },
        { key: 'altitude', label: 'Altitude', fmt: fmt.m, hud: true, env: true },
        { key: 'mass', label: 'Vehicle mass', basic: 'Mass', fmt: fmt.t, hud: true },
        { key: 'thrust', label: 'Thrust', fmt: fmt.kN },
        { key: 'accelTotal', label: 'Thrust acceleration T/m', basic: 'Engine acceleration', fmt: fmt.ms2 },
        { key: 'prop', label: 'Stage propellant', basic: 'Stage fuel', fmt: fmt.t, bar: 'propFrac' },
        { key: 'dvUsed', label: 'Δv delivered', basic: 'Speed added by engines', fmt: fmt.ms },
        { key: 'dvLeft', label: 'Δv remaining (ideal)', basic: 'Speed still in the tanks', fmt: fmt.ms },
        { key: 'wasted', label: 'Propellant thrown away', basic: 'Fuel thrown away', fmt: fmt.t },
        { key: 'twr', label: 'TWR', fmt: fmt.ratio, pro: true },
        { key: 'mdot', label: 'Mass flow ṁ', fmt: fmt.kgs, pro: true },
    ],
    graphs: [
        { id: 'speed', label: 'Speed', unit: 'm/s', series: [{ key: 'speed', label: 'Speed' }] },
        { id: 'mass', label: 'Mass', unit: 't', series: [{ key: 'mass', label: 'Mass', k: 1e-3 }] },
    ],
    actions: [{ id: 'stage', label: 'Stage', key: 'S', running: true }],
    derived(p) {
        const stages = stagesOf(p);
        const dv = P.stackDeltaV(stages, p.payload * 1000);
        const rows = dv.per.map((v, i) => ({ label: `Stage ${i + 1} Δv`, basic: `Stage ${i + 1} adds`, value: fmt.ms(v) }));
        rows.push({ label: 'Total ideal Δv', basic: 'Total speed the rocket can add', value: fmt.ms(dv.total), tone: 'ok' });
        let m = p.payload * 1000;
        for (const s of stages) m += s.dry + s.prop;
        rows.push({ label: 'Lift-off mass', basic: 'Total mass', value: fmt.t(m) });
        const w = stagingWorld(p);
        if (w) rows.push({ label: 'Stage 1 TWR on the pad', basic: 'Thrust-to-weight at launch', value: fmt.ratio(P.thrustToWeight(stages[0].thrust * stages[0].engines * p.throttle / 100, m, w.g)) });
        return rows;
    },
    note(p, id) {
        const dv = P.stackDeltaV(stagesOf(p), p.payload * 1000);
        if (id === 'stageCount') return `With ${p.stageCount} stage${p.stageCount > 1 ? 's' : ''} the rocket can add ${fmt.ms(dv.total)}. Each empty stage left behind no longer has to be pushed.`;
        if (id === 'payload') return `A heavier payload lowers every stage's mass ratio: ${fmt.ms(dv.total)} total now.`;
        if (id === 'env') return p.env === 'space' ? 'In empty space nothing pulls back, so the rocket keeps every m/s its engines add.' : 'Flying up against gravity, every second of burning loses about g × 1 s of speed (gravity losses).';
        return `Total ideal Δv: ${fmt.ms(dv.total)} (${dv.per.map(v => fmt.ms(v)).join(' + ')}).`;
    },
    debrief(sim, p, ch) {
        const f = sim.f;
        const gained = sim.w ? f.maxSpeed : P.len(f.v);
        const usedProp = f.stages.reduce((a, s) => a + s.prop0, 0);
        const waste = usedProp > 0 ? f.wasted / usedProp : 0;
        const metrics = [
            ['Speed reached', fmt.ms(gained)], ['Ideal Δv of the design', fmt.ms(sim.ideal)], ['Δv delivered', fmt.ms(f.dvUsed)],
            ['Propellant thrown away', `${fmt.t(f.wasted)} (${num(waste * 100, 1)}%)`], ['Stages used', `${f.active + 1} of ${f.stages.length}`],
        ];
        if (sim.w) metrics.push(['Highest altitude', fmt.m(f.maxAlt)], ['Gravity losses (Δv − top speed)', fmt.ms(Math.max(0, f.dvUsed - f.maxSpeed))]);
        let met = null, score = null;
        if (ch === 'speed') {
            score = Math.round(100 * Math.min(1, f.dvUsed / Math.max(1, sim.ideal)));
            met = score >= 98;
        } else if (ch === 'clean') {
            met = p.staging === 'manual' && waste < 0.02 && f.active === f.stages.length - 1;
            score = Math.round(100 * Math.max(0, 1 - waste * 5) * Math.min(1, f.dvUsed / Math.max(1, sim.ideal)));
        }
        const summary = sim.outcome === 'impact' ? 'The rocket fell back and hit the ground: a stage without enough thrust can\'t hold itself up.'
            : `The rocket used ${f.active + 1} stage${f.active ? 's' : ''} and reached ${fmt.ms(gained)}${sim.w ? ` (the engines added ${fmt.ms(f.dvUsed)}; gravity took the rest)` : ''}.`;
        return { title: 'Flight complete', met, score, summary, metrics,
            lesson: 'Staging works because each stage only has to accelerate what is above it. The rocket equation rewards a high mass ratio m₀/m₁, and dropping dead weight raises it for every later stage.' };
    },
    result: sim => ({ 'Speed reached': fmt.ms(sim.w ? sim.f.maxSpeed : P.len(sim.f.v)), 'Δv delivered': fmt.ms(sim.f.dvUsed), 'Thrown away': fmt.t(sim.f.wasted) }),
};

function stageVals(defs) {
    const v = {};
    defs.forEach((d, i) => {
        v[`s${i + 1}Dry`] = d.dry; v[`s${i + 1}Prop`] = d.prop; v[`s${i + 1}Engines`] = d.engines; v[`s${i + 1}Thrust`] = d.thrust; v[`s${i + 1}Isp`] = d.isp;
    });
    return v;
}

/* =====================================================================================================
   D. Orbital mechanics laboratory
   ===================================================================================================== */

const BURN_DIRS = [
    { value: 'prograde', label: 'Prograde (forwards)' },
    { value: 'retrograde', label: 'Retrograde (backwards)' },
    { value: 'radialOut', label: 'Radial out (away from the planet)' },
    { value: 'radialIn', label: 'Radial in (towards the planet)' },
    { value: 'normal', label: 'Normal (out of the orbit plane)', pro: true },
    { value: 'antiNormal', label: 'Anti-normal', pro: true },
];

function orbitStep(p, w, r) {
    if (p.timeStep > 0) return p.timeStep;
    return P.clamp(P.orbitalPeriod(w.mu, r) / 3000, 0.02, 5);
}

function coastEvents(o, prevVr, out, R) {
    const vr = P.dot(o.r, o.v);
    if (prevVr > 0 && vr <= 0) out.push({ text: `Apoapsis: ${fmt.km(P.len(o.r) - R)}`, level: 'info', kind: 'ap' });
    if (prevVr < 0 && vr >= 0) out.push({ text: `Periapsis: ${fmt.km(P.len(o.r) - R)}`, level: 'info', kind: 'pe' });
    return vr;
}

const ORBIT = {
    id: 'orbit', name: 'Orbital Mechanics Laboratory', short: 'Orbit Lab', level: 'Intermediate', view: 'orbit',
    summary: 'A spacecraft in orbit. Fire burns forwards, backwards, inwards or outwards and watch the orbit change shape.',
    learn: 'A burn changes the orbit on the far side: speeding up raises the opposite point of the orbit, slowing down lowers it.',
    presetLabel: 'Start',
    presets: [
        { id: 'leo', label: 'Low Kerbin orbit, 100 km', values: { world: 'kerbin', altitude: 100, speedPct: 100, fpa: 0, burnDir: 'prograde', burnDv: 100, burnAt: 'now' } },
        { id: 'ellipse', label: 'Elliptical Kerbin orbit', values: { world: 'kerbin', altitude: 100, speedPct: 108, fpa: 0, burnDir: 'retrograde', burnDv: 60, burnAt: 'apoapsis' } },
        { id: 'mun', label: 'Low Mun orbit, 20 km', values: { world: 'mun', altitude: 20, speedPct: 100, fpa: 0, burnDir: 'prograde', burnDv: 50, burnAt: 'now' } },
        { id: 'suborbital', label: 'Too slow: suborbital', values: { world: 'kerbin', altitude: 100, speedPct: 85, fpa: 0, burnDir: 'prograde', burnDv: 300, burnAt: 'now' } },
    ],
    params: [
        ...worldParams(),
        range('altitude', 100, 5, 5000, 5, 'km', b('Orbital height', 'Starting height above the surface.'), b('Initial altitude h₀', ''), { group: 'Start' }),
        range('speedPct', 100, 60, 150, 0.5, '%', b('Starting speed', '100% is exactly the speed for a circular orbit at this height. Slower falls lower; faster climbs higher; about 141% escapes.'),
            b('Initial speed (× circular)', 'v₀ as a share of √(μ / r). √2 ≈ 141.4% is escape speed.'), { group: 'Start' }),
        range('fpa', 0, -30, 30, 0.5, '°', null, b('Initial flight-path angle', 'Angle of the starting velocity above the horizontal.'), { group: 'Start' }),
        select('burnDir', 'prograde', BURN_DIRS, b('Burn direction', 'Which way the engine pushes.'), b('Burn direction', 'Prograde and retrograde change the opposite side of the orbit most; radial burns rotate it; normal burns tilt its plane.'), { group: 'Burn', live: true }),
        range('burnDv', 100, 1, 3000, 1, 'm/s', b('Burn size (speed change)', 'How much the burn changes the spacecraft\'s speed.'), b('Burn Δv', 'Applied instantly (impulsive burn).'), { group: 'Burn', live: true }),
        select('burnAt', 'now', [{ value: 'now', label: 'Now' }, { value: 'apoapsis', label: 'At the next apoapsis (highest point)' }, { value: 'periapsis', label: 'At the next periapsis (lowest point)' }],
            b('Burn when', ''), b('Burn timing', ''), { group: 'Burn', live: true }),
        timeStepParam(0, 0, 10, 0.05, { help0: 'auto' }),
        integratorParam(),
    ],
    challenges: [
        { id: 'raise', label: 'Climb to 250 km', text: 'Start at 100 km over Kerbin and finish in a circular orbit between 240 and 260 km, using as little Δv as you can.', values: { world: 'kerbin', altitude: 100, speedPct: 100, fpa: 0 } },
        { id: 'deorbit', label: 'Come home', text: 'From 100 km over Kerbin, lower your periapsis below 40 km so the atmosphere would catch you, with as little Δv as possible.', values: { world: 'kerbin', altitude: 100, speedPct: 100, fpa: 0 } },
        { id: 'escape', label: 'Escape', text: 'Put the spacecraft on an escape trajectory with the least Δv you can.', values: { world: 'kerbin', altitude: 100, speedPct: 100, fpa: 0 } },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [1, 10, 30, 100, 300, 1000], scale: 30,
    dt: (p, sim) => sim.dt,
    assumptions: [
        'The two-body problem: one point-mass planet, no atmosphere drag, no other moons or planets.',
        'Burns are impulsive: the speed change happens instantly. Real burns take time and lose a little efficiency.',
        'The spacecraft\'s mass is not tracked here; burns are measured in Δv.',
        'The planet\'s surface is drawn without terrain; altitudes are from its reference radius.',
    ],
    create(p) {
        const w = worldOf(p);
        const r0 = w.radius + p.altitude * 1000;
        const v0 = P.circularSpeed(w.mu, r0) * p.speedPct / 100;
        const g = p.fpa * DEG;
        const o = { r: [r0, 0, 0], v: [v0 * Math.sin(g), 0, -v0 * Math.cos(g)] };
        return { t: 0, w, o, dt: orbitStep(p, w, r0), pending: null, burns: [], dvUsed: 0, E0: P.specificEnergy(o.r, o.v, w.mu), prevVr: P.dot(o.r, o.v), endAt: null, outcome: null, metAt: null, atmoWarned: false, trail: [], r0 };
    },
    step(sim, p, input, dt) {
        const out = [];
        const o = sim.o, w = sim.w;
        if (input.commands.includes('burn')) {
            if (p.burnAt === 'now') applyOrbitBurn(sim, p, out);
            else { sim.pending = { at: p.burnAt, dir: p.burnDir, dv: p.burnDv }; out.push({ text: `Burn of ${fmt.ms(p.burnDv)} ${dirLabel(p.burnDir)} set for the next ${p.burnAt}`, level: 'info' }); }
        }
        if (input.commands.includes('cancel') && sim.pending) { sim.pending = null; out.push({ text: 'Planned burn cancelled', level: 'info' }); }
        P.stepTwoBody(o, w.mu, dt, p.integrator);
        sim.t += dt;
        const ev = [];
        const vr = coastEvents(o, sim.prevVr, ev, w.radius);
        sim.prevVr = vr;
        for (const e of ev) {
            if (sim.pending && e.kind === (sim.pending.at === 'apoapsis' ? 'ap' : 'pe')) {
                applyOrbitBurn(sim, { ...p, burnDir: sim.pending.dir, burnDv: sim.pending.dv }, out);
                sim.pending = null;
            } else out.push({ ...e, quiet: true });
        }
        if (sim.t - (sim.trailT || 0) > sim.dt * 8) { sim.trail.push(o.r.slice()); sim.trailT = sim.t; if (sim.trail.length > 1500) sim.trail.shift(); }
        const rm = P.len(o.r);
        if (sim.endAt === null) {
            if (rm <= w.radius) { sim.outcome = 'impact'; sim.endAt = sim.t; out.push({ text: `Surface impact at ${fmt.ms(P.len(o.v))}`, level: 'bad' }); }
            else if (rm > w.radius * 40) { sim.outcome = 'escaped'; sim.endAt = sim.t; out.push({ text: 'Left the simulated region on an escape path', level: 'ok' }); }
        }
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry(sim) {
        const o = sim.o, w = sim.w;
        const el = P.elements(o.r, o.v, w.mu);
        const E = el.energy;
        return {
            clock: sim.t, altitude: el.r - w.radius, speed: el.speed, pe: el.rp - w.radius, ap: el.e < 1 ? el.ra - w.radius : Infinity,
            period: el.period, ecc: el.e, inc: el.inc, sma: el.a, energy: E, drift: (E - sim.E0) / Math.abs(sim.E0), dvUsed: sim.dvUsed,
            timeToAp: el.timeToAp, timeToPe: el.timeToPe, el, orbits: Number.isFinite(el.period) ? sim.t / el.period : 0,
            status: el.e >= 1 ? 'ESCAPE TRAJECTORY' : el.rp < w.radius ? 'SUBORBITAL' : el.rp < w.radius + w.atmosphere ? 'IN THE ATMOSPHERE (DRAG NOT MODELLED)' : 'ORBITING',
            pending: sim.pending ? `${fmt.ms(sim.pending.dv)} ${dirLabel(sim.pending.dir)} at ${sim.pending.at}` : 'none',
        };
    },
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'altitude', label: 'Altitude', fmt: fmt.km, hud: true },
        { key: 'speed', label: 'Orbital speed', fmt: fmt.ms, hud: true },
        { key: 'ap', label: 'Apoapsis (highest)', basic: 'Highest point', fmt: v => (v === Infinity ? 'none (escaping)' : fmt.km(v)), hud: true },
        { key: 'pe', label: 'Periapsis (lowest)', basic: 'Lowest point', fmt: fmt.km, hud: true },
        { key: 'period', label: 'Orbital period', basic: 'Time for one orbit', fmt: fmt.time },
        { key: 'dvUsed', label: 'Δv applied', basic: 'Speed changes used', fmt: fmt.ms },
        { key: 'pending', label: 'Planned burn', fmt: fmt.plain },
        { key: 'ecc', label: 'Eccentricity e', fmt: v => num(v, 4), pro: true },
        { key: 'sma', label: 'Semi-major axis a', fmt: fmt.km, pro: true },
        { key: 'inc', label: 'Inclination i', fmt: fmt.deg, pro: true },
        { key: 'timeToAp', label: 'Time to apoapsis', fmt: fmt.time, pro: true },
        { key: 'timeToPe', label: 'Time to periapsis', fmt: fmt.time, pro: true },
        { key: 'energy', label: 'Specific energy ε', fmt: v => `${num(v / 1e6, 4)} MJ/kg`, pro: true },
        { key: 'drift', label: 'Integration energy drift', fmt: v => `${(v * 100).toExponential(1)}%`, pro: true },
    ],
    graphs: [
        { id: 'alt', label: 'Altitude', unit: 'km', series: [{ key: 'altitude', label: 'Altitude', k: 1e-3 }] },
        { id: 'speed', label: 'Speed', unit: 'm/s', series: [{ key: 'speed', label: 'Speed' }] },
    ],
    actions: [{ id: 'burn', label: 'Execute burn', key: 'B', running: true, primary: true }, { id: 'cancel', label: 'Cancel planned burn', key: 'X', running: true }, { id: 'end', label: 'End experiment', key: 'E', running: true }],
    derived(p) {
        const w = worldOf(p);
        const r0 = w.radius + p.altitude * 1000;
        const vc = P.circularSpeed(w.mu, r0);
        return [
            { label: 'Circular speed √(μ/r)', basic: 'Speed for a circular orbit', value: fmt.ms(vc) },
            { label: 'Starting speed', value: fmt.ms(vc * p.speedPct / 100) },
            { label: 'Escape speed √(2μ/r)', basic: 'Escape speed', value: fmt.ms(vc * Math.SQRT2) },
            { label: 'Circular period 2π√(r³/μ)', basic: 'Time for one circular orbit', value: fmt.time(P.orbitalPeriod(w.mu, r0)) },
            { label: 'μ', value: `${w.mu.toExponential(4)} m³/s²`, pro: true },
            { label: 'Radius R', value: fmt.km(w.radius), pro: true },
        ];
    },
    note(p, id, sim) {
        if (id === 'burnDir' || id === 'burnDv' || id === 'burnAt') {
            const d = p.burnDir;
            const what = d === 'prograde' ? 'raises the far side of the orbit' : d === 'retrograde' ? 'lowers the far side of the orbit' : d.startsWith('radial') ? 'rotates the orbit around the planet, raising one side and lowering the other' : 'tilts the orbit\'s plane';
            return `A ${fmt.ms(p.burnDv)} ${dirLabel(d)} burn ${what}. The dashed line previews the result.`;
        }
        if (id === 'speedPct') return p.speedPct < 100 ? 'Slower than circular: the spacecraft falls inward and this point becomes the highest of the orbit.' : p.speedPct >= 141.4 ? 'At √2 × circular speed or more, the spacecraft escapes for ever.' : p.speedPct > 100 ? 'Faster than circular: the orbit stretches out and this point becomes the lowest of the orbit.' : 'Exactly circular speed: a circle.';
        if (id === 'integrator') return p.integrator === 'euler' ? 'Explicit Euler always overshoots outward: watch the orbit spiral away and the energy drift grow.' : 'A good integrator keeps the orbit closed: the energy drift stays tiny.';
        return '';
    },
    preview(sim, p) {
        if (!sim) return null;
        const dv = P.burnVector(sim.o.r, sim.o.v, p.burnDir, p.burnDv);
        return { r: sim.o.r, v: P.add(sim.o.v, dv) };
    },
    goal(sim, p, ch) {
        const tm = this.telemetry(sim);
        if (ch === 'raise') return tm.pe >= 240e3 && tm.ap <= 260e3 && !sim.pending;
        if (ch === 'deorbit') return tm.pe < 40e3;
        if (ch === 'escape') return tm.ecc >= 1;
        return false;
    },
    debrief(sim, p, ch) {
        const tm = this.telemetry(sim);
        const w = sim.w, r0 = sim.r0;
        let ideal = null;
        if (ch === 'raise') ideal = P.hohmann(w.mu, r0, w.radius + 250e3).total;
        if (ch === 'deorbit') { const rp = w.radius + 40e3; ideal = P.circularSpeed(w.mu, r0) - Math.sqrt(w.mu * 2 * rp / (r0 * (r0 + rp))); }
        if (ch === 'escape') ideal = (Math.SQRT2 - 1) * P.circularSpeed(w.mu, r0);
        const met = ch === 'free' ? null : !!sim.metAt;
        const eff = ideal ? Math.min(1, ideal / Math.max(1e-6, sim.dvUsed)) : 0;
        const score = ch === 'free' ? null : met ? Math.round(50 + 50 * eff) : 0;
        const metrics = [['Δv used', fmt.ms(sim.dvUsed)], ['Burns', String(sim.burns.length)], ['Final periapsis', fmt.km(tm.pe)], ['Final apoapsis', tm.ap === Infinity ? 'none' : fmt.km(tm.ap)], ['Time flown', fmt.time(sim.t)]];
        if (ideal) metrics.splice(1, 0, ['Least possible Δv (ideal)', fmt.ms(ideal)]);
        const summary = sim.outcome === 'impact' ? 'The orbit dipped below the surface and the spacecraft hit the ground.'
            : met ? `Goal reached with ${fmt.ms(sim.dvUsed)} of Δv${ideal ? `; the ideal is ${fmt.ms(ideal)}` : ''}.`
                : sim.outcome === 'escaped' ? 'The spacecraft escaped the planet.' : 'Experiment ended.';
        return { title: met ? 'Goal reached' : 'Experiment complete', met, score, summary, metrics,
            lesson: 'Burn prograde at one point and the opposite side of the orbit rises; retrograde lowers it. Two well-timed burns, one at each end, are the cheapest way between circular orbits (a Hohmann transfer).' };
    },
    result: sim => { const tm = ORBIT.telemetry(sim); return { 'Δv used': fmt.ms(sim.dvUsed), Periapsis: fmt.km(tm.pe), Apoapsis: tm.ap === Infinity ? 'none' : fmt.km(tm.ap) }; },
};

function dirLabel(d) {
    return { prograde: 'prograde', retrograde: 'retrograde', radialOut: 'radial-out', radialIn: 'radial-in', normal: 'normal', antiNormal: 'anti-normal' }[d] || d;
}

function applyOrbitBurn(sim, p, out) {
    const o = sim.o;
    const dv = P.burnVector(o.r, o.v, p.burnDir, p.burnDv);
    for (let k = 0; k < 3; k++) o.v[k] += dv[k];
    sim.dvUsed += p.burnDv;
    sim.burns.push({ t: sim.t, dir: p.burnDir, dv: p.burnDv });
    sim.E0 = P.specificEnergy(o.r, o.v, sim.w.mu);
    sim.prevVr = P.dot(o.r, o.v);
    const el = P.elements(o.r, o.v, sim.w.mu);
    const R = sim.w.radius;
    out.push({ text: `Burn: ${fmt.ms(p.burnDv)} ${dirLabel(p.burnDir)}. Periapsis ${fmt.km(el.rp - R)}, apoapsis ${el.e < 1 ? fmt.km(el.ra - R) : 'none (escape)'}`, level: 'ok', kind: 'burn' });
}

/* =====================================================================================================
   E. Hohmann transfer laboratory
   ===================================================================================================== */

const HOHMANN = {
    id: 'hohmann', name: 'Hohmann Transfer Laboratory', short: 'Hohmann Lab', level: 'Advanced', view: 'orbit',
    summary: 'Move between two circular orbits with two burns. Fire them by hand, or catch a satellite waiting in the target orbit.',
    learn: 'The cheapest way between two circular orbits is half an ellipse that touches both: one burn to start it, one to finish.',
    presetLabel: 'Transfer',
    presets: [
        { id: 'k100-500', label: 'Kerbin: 100 km to 500 km', values: { world: 'kerbin', startAlt: 100, targetAlt: 500, burn2Mode: 'auto', burn1Pct: 100, burn2Pct: 100, rendezvous: 0 } },
        { id: 'k80-2863', label: 'Kerbin: 80 km to 2,863 km', values: { world: 'kerbin', startAlt: 80, targetAlt: 2863.33, burn2Mode: 'auto', burn1Pct: 100, burn2Pct: 100, rendezvous: 0 } },
        { id: 'down', label: 'Kerbin: down from 600 km to 120 km', values: { world: 'kerbin', startAlt: 600, targetAlt: 120, burn2Mode: 'auto', burn1Pct: 100, burn2Pct: 100, rendezvous: 0 } },
        { id: 'mun', label: 'Mun: 15 km to 200 km', values: { world: 'mun', startAlt: 15, targetAlt: 200, burn2Mode: 'auto', burn1Pct: 100, burn2Pct: 100, rendezvous: 0 } },
    ],
    params: [
        ...worldParams(),
        range('startAlt', 100, 5, 5000, 1, 'km', b('Starting orbit height', ''), b('Initial orbit altitude h₁', ''), { group: 'Orbits' }),
        range('targetAlt', 500, 5, 12000, 1, 'km', b('Target orbit height', ''), b('Target orbit altitude h₂', ''), { group: 'Orbits' }),
        select('burn2Mode', 'auto', [{ value: 'auto', label: 'Automatic at arrival' }, { value: 'manual', label: 'By hand (press Burn)' }],
            b('Second burn', 'Let the computer fire the second burn when the spacecraft arrives, or time it yourself.'), b('Burn 2 timing', ''), { group: 'Burns' }),
        range('burn1Pct', 100, 80, 120, 0.5, '%', null, b('Burn 1 size (× ideal)', 'Scale the first burn to see what a mistake does to the transfer.'), { group: 'Burns' }),
        range('burn2Pct', 100, 80, 120, 0.5, '%', null, b('Burn 2 size (× ideal)', ''), { group: 'Burns' }),
        toggle('rendezvous', 0, b('Catch a satellite', 'A satellite waits in the target orbit. Fire the first burn yourself when it is the right distance ahead.'),
            b('Rendezvous target', 'A target on the circular target orbit. Burn 1 becomes manual: fire when its lead angle matches the transfer phase angle.'), { group: 'Burns' }),
        range('targetLead', 90, 0, 359, 1, '°', null, b('Target starting lead', 'How far ahead of the spacecraft the target starts, in degrees.'), { group: 'Burns', show: p => p.rendezvous }),
        timeStepParam(0, 0, 10, 0.05),
        integratorParam(),
    ],
    challenges: [
        { id: 'transfer', label: 'Complete the transfer', text: 'Arrive in a circular orbit at the target height: both burns, no wasted Δv.' },
        { id: 'manual', label: 'Fire burn 2 by hand', text: 'Time the second burn yourself: press Burn as the spacecraft reaches the far side of the ellipse.', values: { burn2Mode: 'manual', burn1Pct: 100, burn2Pct: 100, rendezvous: 0 } },
        { id: 'rendezvous', label: 'Catch the satellite', text: 'Fire the first burn at the right moment to arrive within 10 km of the satellite.', values: { rendezvous: 1, burn2Mode: 'auto', burn1Pct: 100, burn2Pct: 100 } },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [1, 10, 30, 100, 300, 1000], scale: 30,
    dt: (p, sim) => sim.dt,
    assumptions: [
        'Ideal Hohmann transfer between circular, coplanar orbits round one point-mass body; no drag, no other bodies.',
        'Burns are impulsive (instantaneous). The flight itself is integrated numerically, not animated along the ellipse.',
        'Arrival is detected as the moment the spacecraft stops climbing (or descending): the apoapsis or periapsis of the ellipse.',
    ],
    create(p) {
        const w = worldOf(p);
        const r1 = w.radius + p.startAlt * 1000, r2 = w.radius + p.targetAlt * 1000;
        const h = P.hohmann(w.mu, r1, r2);
        const o = { r: [r1, 0, 0], v: [0, 0, -h.vc1] };
        const n2 = Math.sqrt(w.mu / (r2 * r2 * r2));
        const n1 = Math.sqrt(w.mu / (r1 * r1 * r1));
        return {
            t: 0, w, o, h, r1, r2, n1, n2, dt: orbitStep(p, w, Math.min(r1, r2)), stage: p.rendezvous ? 'wait' : 'ready',
            dvUsed: 0, burn1At: null, burn2At: null, arriveAt: null, endAt: null, outcome: null, prevVr: 0, closest: Infinity, closestAt: null,
            targetAngle0: p.targetLead * DEG, trail: [], E0: P.specificEnergy(o.r, o.v, w.mu), missed: false,
        };
    },
    targetPos(sim, t = sim.t) {
        const a = sim.targetAngle0 + sim.n2 * t;
        return [sim.r2 * Math.cos(a), 0, -sim.r2 * Math.sin(a)];
    },
    step(sim, p, input, dt) {
        const out = [];
        const o = sim.o, h = sim.h;
        const burnCmd = input.commands.includes('burn');
        if ((sim.stage === 'ready') || (sim.stage === 'wait' && burnCmd)) {
            const dv = h.dv1 * p.burn1Pct / 100;
            const dir = h.raise ? 'prograde' : 'retrograde';
            const vec = P.burnVector(o.r, o.v, dir, dv);
            for (let k = 0; k < 3; k++) o.v[k] += vec[k];
            sim.dvUsed += dv;
            sim.burn1At = sim.t;
            sim.stage = 'transfer';
            sim.prevVr = P.dot(o.r, o.v);
            const el = P.elements(o.r, o.v, sim.w.mu);
            out.push({ text: `Burn 1: ${fmt.ms(dv)} ${dir}. Transfer ellipse ${fmt.km(el.rp - sim.w.radius)} × ${el.e < 1 ? fmt.km(el.ra - sim.w.radius) : 'escape'}`, level: 'ok' });
            if (p.rendezvous) {
                const lead = angleAhead(sim);
                const ideal = ((h.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                out.push({ text: `Target was ${num(lead / DEG, 1)}° ahead; the ideal lead is ${num(ideal / DEG, 1)}°`, level: Math.abs(lead - ideal) < 3 * DEG ? 'ok' : 'warn' });
            }
        }
        P.stepTwoBody(o, sim.w.mu, dt, p.integrator);
        sim.t += dt;
        const vr = P.dot(o.r, o.v);
        if (sim.stage === 'transfer') {
            const arrived = h.raise ? (sim.prevVr > 0 && vr <= 0) : (sim.prevVr < 0 && vr >= 0);
            if (arrived && sim.arriveAt === null) {
                sim.arriveAt = sim.t;
                out.push({ text: `Arrived at the far side after ${fmt.time(sim.t - sim.burn1At)} (predicted ${fmt.time(h.time)})`, level: 'info' });
            }
            const doBurn2 = (p.burn2Mode === 'auto' && arrived) || (p.burn2Mode === 'manual' && burnCmd && sim.burn1At !== null && sim.t > sim.burn1At + dt * 2);
            if (doBurn2) {
                const dv = h.dv2 * p.burn2Pct / 100;
                const dir = h.raise ? 'prograde' : 'retrograde';
                const vec = P.burnVector(o.r, o.v, dir, dv);
                for (let k = 0; k < 3; k++) o.v[k] += vec[k];
                sim.dvUsed += dv;
                sim.burn2At = sim.t;
                sim.stage = 'final';
                sim.endAt = sim.t + Math.min(2 * Math.PI / sim.n2 * 0.6, 4 * 3600);
                const el = P.elements(o.r, o.v, sim.w.mu);
                out.push({ text: `Burn 2: ${fmt.ms(dv)} ${dir}. Orbit now ${fmt.km(el.rp - sim.w.radius)} × ${el.e < 1 ? fmt.km(el.ra - sim.w.radius) : 'escape'}`, level: 'ok' });
            }
            if (sim.arriveAt !== null && sim.stage === 'transfer' && sim.t - sim.arriveAt > h.time * 1.2 && !sim.missed) {
                sim.missed = true;
                out.push({ text: 'Burn 2 missed: the spacecraft is back on its way round the ellipse. Press Burn to fire it anyway.', level: 'warn' });
            }
        }
        sim.prevVr = vr;
        if (p.rendezvous && sim.burn1At !== null) {
            const d = P.len(P.sub(o.r, this.targetPos(sim)));
            if (d < sim.closest) { sim.closest = d; sim.closestAt = sim.t; }
        }
        if (sim.t - (sim.trailT || 0) > sim.dt * 8) { sim.trail.push(o.r.slice()); sim.trailT = sim.t; if (sim.trail.length > 1500) sim.trail.shift(); }
        if (P.len(o.r) <= sim.w.radius && sim.outcome !== 'impact') { sim.outcome = 'impact'; sim.endAt = sim.t; out.push({ text: 'Surface impact', level: 'bad' }); }
        if (sim.stage === 'wait' && sim.t > 3 * 2 * Math.PI / Math.abs(sim.n1 - sim.n2 || 1e-9) && !sim.endAt) { sim.endAt = sim.t; sim.outcome = 'nowindow'; }
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry(sim) {
        const o = sim.o, w = sim.w;
        const el = P.elements(o.r, o.v, w.mu);
        const tm = {
            clock: sim.t, altitude: el.r - w.radius, speed: el.speed, pe: el.rp - w.radius, ap: el.e < 1 ? el.ra - w.radius : Infinity, ecc: el.e, el,
            dvUsed: sim.dvUsed, r1: sim.r1, r2: sim.r2, at: sim.h.at, dv1: sim.h.dv1, dv2: sim.h.dv2, dvTotal: sim.h.total, ttime: sim.h.time,
            sinceBurn: sim.burn1At === null ? 0 : sim.t - sim.burn1At,
            status: { wait: 'WAITING FOR THE WINDOW', ready: 'READY', transfer: 'ON THE TRANSFER ELLIPSE', final: 'IN THE NEW ORBIT' }[sim.stage],
        };
        if (sim.stage === 'wait' || sim.burn1At !== null) {
            tm.lead = angleAhead(sim);
            tm.leadIdeal = ((sim.h.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            tm.targetDist = P.len(P.sub(o.r, this.targetPos(sim)));
            tm.closest = sim.closest;
        }
        return tm;
    },
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'altitude', label: 'Altitude', fmt: fmt.km, hud: true },
        { key: 'speed', label: 'Speed', fmt: fmt.ms, hud: true },
        { key: 'pe', label: 'Periapsis', basic: 'Lowest point', fmt: fmt.km },
        { key: 'ap', label: 'Apoapsis', basic: 'Highest point', fmt: v => (v === Infinity ? 'none' : fmt.km(v)) },
        { key: 'sinceBurn', label: 'Time since burn 1', fmt: fmt.time, hud: true },
        { key: 'dvUsed', label: 'Δv used', basic: 'Speed changes used', fmt: fmt.ms },
        { key: 'lead', label: 'Target lead angle (now)', basic: 'Satellite is ahead by', fmt: fmt.deg, hud: true, only: 'rdv' },
        { key: 'leadIdeal', label: 'Ideal lead angle', basic: 'Burn when it is ahead by', fmt: fmt.deg, hud: true, only: 'rdv' },
        { key: 'targetDist', label: 'Distance to target', basic: 'Distance to the satellite', fmt: fmt.km, only: 'rdv' },
        { key: 'closest', label: 'Closest approach so far', fmt: fmt.km, only: 'rdv' },
        { key: 'ecc', label: 'Eccentricity e', fmt: v => num(v, 4), pro: true },
    ],
    graphs: [
        { id: 'alt', label: 'Altitude', unit: 'km', series: [{ key: 'altitude', label: 'Altitude', k: 1e-3 }] },
        { id: 'speed', label: 'Speed', unit: 'm/s', series: [{ key: 'speed', label: 'Speed' }] },
    ],
    actions: [{ id: 'burn', label: 'Burn', key: 'B', running: true, primary: true }, { id: 'end', label: 'End experiment', key: 'E', running: true }],
    derived(p) {
        const w = worldOf(p);
        const r1 = w.radius + p.startAlt * 1000, r2 = w.radius + p.targetAlt * 1000;
        const h = P.hohmann(w.mu, r1, r2);
        return [
            { label: 'Burn 1 Δv', basic: 'First burn', value: fmt.ms(h.dv1) },
            { label: 'Burn 2 Δv', basic: 'Second burn', value: fmt.ms(h.dv2) },
            { label: 'Total Δv', basic: 'Total speed change', value: fmt.ms(h.total), tone: 'ok' },
            { label: 'Transfer time π√(a³/μ)', basic: 'Time on the transfer', value: fmt.time(h.time) },
            { label: 'Initial radius r₁', value: fmt.km(r1), pro: true },
            { label: 'Target radius r₂', value: fmt.km(r2), pro: true },
            { label: 'Transfer semi-major axis a = (r₁ + r₂) / 2', value: fmt.km(h.at), pro: true },
            { label: 'Rendezvous lead angle', value: fmt.deg(h.phase), pro: true },
        ];
    },
    note(p) {
        const w = worldOf(p);
        const h = P.hohmann(w.mu, w.radius + p.startAlt * 1000, w.radius + p.targetAlt * 1000);
        return `${h.raise ? 'Raising' : 'Lowering'} the orbit takes ${fmt.ms(h.dv1)} + ${fmt.ms(h.dv2)} = ${fmt.ms(h.total)} and ${fmt.time(h.time)} on the ellipse.`;
    },
    debrief(sim, p, ch) {
        const tm = this.telemetry(sim);
        const r2 = sim.r2, R = sim.w.radius;
        const errP = Math.abs(tm.pe + R - r2), errA = tm.ap === Infinity ? Infinity : Math.abs(tm.ap + R - r2);
        const orbitQ = Math.max(0, 1 - (errP + errA) / (0.1 * r2));
        const eff = Math.min(1, sim.h.total / Math.max(1e-6, sim.dvUsed));
        let met = null, score = null;
        const done = sim.burn2At !== null;
        if (ch === 'transfer' || ch === 'manual') {
            met = done && errP < 0.01 * r2 && errA < 0.01 * r2;
            score = done ? Math.round(70 * orbitQ + 30 * eff) : 0;
        } else if (ch === 'rendezvous') {
            met = sim.closest < 10e3;
            score = Math.round(100 * Math.max(0, 1 - sim.closest / 200e3));
        }
        const metrics = [
            ['Final periapsis', fmt.km(tm.pe)], ['Final apoapsis', tm.ap === Infinity ? 'none' : fmt.km(tm.ap)], ['Target height', fmt.km(r2 - R)],
            ['Δv used', fmt.ms(sim.dvUsed)], ['Ideal Δv', fmt.ms(sim.h.total)],
            ['Transfer time', sim.arriveAt !== null ? `${fmt.time(sim.arriveAt - sim.burn1At)} (predicted ${fmt.time(sim.h.time)})` : '—'],
        ];
        if (p.rendezvous) metrics.push(['Closest approach to the satellite', fmt.km(sim.closest)]);
        const summary = sim.outcome === 'impact' ? 'The transfer took the spacecraft into the surface.'
            : sim.outcome === 'nowindow' ? 'No burn was fired, so the spacecraft stayed in its starting orbit.'
                : !done ? 'The spacecraft is still on the transfer ellipse: the second burn was never fired.'
                    : `Finished in a ${fmt.km(tm.pe)} × ${tm.ap === Infinity ? 'escape' : fmt.km(tm.ap)} orbit; the target was a ${fmt.km(r2 - R)} circle.`;
        return { title: met ? 'Transfer complete' : 'Experiment complete', met, score, summary, metrics,
            lesson: 'Burn 1 turns the circle into an ellipse that just touches the target orbit; burn 2, half an orbit later, rounds it off. Firing at the wrong time or with the wrong size leaves an ellipse instead of a circle.' };
    },
    result: sim => ({ 'Δv used': fmt.ms(sim.dvUsed), Periapsis: fmt.km(P.elements(sim.o.r, sim.o.v, sim.w.mu).rp - sim.w.radius) }),
};

function angleAhead(sim) {
    const ac = Math.atan2(-sim.o.r[2], sim.o.r[0]);
    const tp = HOHMANN.targetPos(sim);
    const at = Math.atan2(-tp[2], tp[0]);
    let d = at - ac;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;
    return d;
}

/* =====================================================================================================
   F. Autonomous landing laboratory
   ===================================================================================================== */

function landCfg(p) {
    const w = worldOf(p);
    return {
        g: w.g, dry: p.dry * 1000, prop: p.prop * 1000, thrust: p.thrust * 1000, isp: p.isp, minThrottle: p.minThrottle / 100,
        maxTilt: p.maxTilt * DEG, slewRate: p.slewRate * DEG, alt0: p.alt0, vx0: p.drift, vy0: -p.descent, vz0: p.driftZ,
        tx: p.targetX, tz: p.targetZ, legsAlt: p.legsAlt, drag: !!p.drag && w.atmosphere > 0, cd: p.cd,
    };
}

const LANDING = {
    id: 'landing', name: 'Autonomous Landing Laboratory', short: 'Landing Lab', level: 'Advanced', view: 'landing',
    summary: 'Bring a reusable booster down onto its pad. Let the guidance fly it, tune it, or take the controls yourself.',
    learn: 'A landing burn has to cancel the booster\'s speed exactly as it reaches the ground. Lean the thrust to move sideways; burn too late and there isn\'t enough thrust to stop.',
    presetLabel: 'Landing difficulty',
    presets: [
        { id: 'easy', label: 'Easy', values: { world: 'kerbin', alt0: 1200, descent: 60, drift: 8, driftZ: 0, targetX: 60, targetZ: 0, prop: 9, thrust: 650, dry: 22 } },
        { id: 'normal', label: 'Normal', values: { world: 'kerbin', alt0: 1500, descent: 90, drift: 18, driftZ: 4, targetX: 140, targetZ: -20, prop: 7, thrust: 600, dry: 22 } },
        { id: 'hard', label: 'Hard', values: { world: 'kerbin', alt0: 1800, descent: 120, drift: 30, driftZ: -8, targetX: 260, targetZ: 40, prop: 4.5, thrust: 560, dry: 22 } },
        { id: 'mun', label: 'On the Mun', values: { world: 'mun', alt0: 1500, descent: 50, drift: 15, driftZ: 0, targetX: 120, targetZ: 0, prop: 4, thrust: 250, dry: 22 } },
    ],
    params: [
        ...worldParams(),
        select('pilot', 'guidance', [{ value: 'guidance', label: 'Guidance computer (illustrative)' }, { value: 'manual', label: 'You (manual)' }],
            b('Who flies', 'The guidance computer flies the descent, or you fly it with the keys or touch buttons.'),
            b('Pilot', 'Live. The guidance is a simple braking-curve and steering law written for this lab, not WSA\'s AutoLand software.'), { group: 'Flight', live: true }),
        range('descent', 90, 10, 220, 1, 'm/s', b('Descent speed', 'How fast the booster is falling at the start.'), b('Initial vertical speed (down)', ''), { group: 'Start' }),
        range('drift', 18, -60, 60, 1, 'm/s', b('Sideways drift', 'How fast it is moving sideways at the start.'), b('Initial horizontal speed vₓ', ''), { group: 'Start' }),
        range('driftZ', 4, -40, 40, 1, 'm/s', null, b('Initial cross-range speed v_z', ''), { group: 'Start' }),
        range('alt0', 1500, 300, 4000, 10, 'm', null, b('Initial altitude', ''), { group: 'Start' }),
        range('targetX', 140, -400, 400, 5, 'm', b('Pad distance', 'How far the landing pad is from the point below the booster at the start. You can move it during the descent.'), b('Pad position x', 'Live.'), { group: 'Target', live: true }),
        range('targetZ', -20, -300, 300, 5, 'm', null, b('Pad position z', 'Live.'), { group: 'Target', live: true }),
        range('thrust', 600, 100, 1600, 10, 'kN', b('Engine power', 'Maximum thrust of the landing engines. Live: try lowering it mid-descent.'), b('Maximum thrust', 'Live.'), { group: 'Vehicle', live: true }),
        range('dry', 22, 8, 40, 0.5, 't', null, b('Dry mass', ''), { group: 'Vehicle' }),
        range('prop', 7, 0.5, 20, 0.1, 't', null, b('Landing propellant', ''), { group: 'Vehicle' }),
        range('isp', 300, 200, 380, 1, 's', null, b('Specific impulse Isp', ''), { group: 'Vehicle' }),
        range('minThrottle', 0, 0, 70, 1, '%', null, b('Minimum throttle', 'Live. Real engines cannot throttle down to zero: below this they run at the minimum or shut down.'), { group: 'Vehicle', live: true }),
        range('maxTilt', 20, 5, 35, 1, '°', null, b('Tilt limit', 'Live. How far the thrust can lean from vertical.'), { group: 'Vehicle', live: true }),
        range('slewRate', 30, 5, 90, 1, '°/s', null, b('Attitude slew rate', 'Live. How fast the booster can change its lean.'), { group: 'Vehicle', live: true }),
        range('legsAlt', 120, 20, 400, 5, 'm', null, b('Legs deploy altitude', 'Legs take 1.5 s to lock.'), { group: 'Vehicle' }),
        toggle('drag', 0, null, b('Air drag', 'Illustrative drag on worlds with air: exponential atmosphere, sea-level density 1.2 kg/m³, scale height 5.6 km.'), { group: 'Vehicle' }),
        range('cd', 0.8, 0.2, 1.5, 0.05, '', null, b('Drag coefficient C_d', ''), { group: 'Vehicle', show: p => p.drag }),
        range('gain', 1, 0.3, 2, 0.05, '×', null, b('Guidance gain', 'Live. How hard the guidance corrects errors.'), { group: 'Guidance', live: true, show: p => p.pilot === 'guidance' }),
        range('margin', 60, 20, 95, 1, '%', null, b('Braking margin', 'Live. Share of the available braking the guidance plans to use; the rest is held in reserve.'), { group: 'Guidance', live: true, show: p => p.pilot === 'guidance' }),
        range('vTouch', 1.5, 0.5, 5, 0.1, 'm/s', null, b('Planned touchdown speed', 'Live.'), { group: 'Guidance', live: true, show: p => p.pilot === 'guidance' }),
    ],
    challenges: [
        { id: 'pad', label: 'Land on the pad', text: 'Touch down upright, gently, inside the pad circle.' },
        { id: 'manual', label: 'Fly it yourself', text: 'Guidance off: land on the pad by hand (Easy start).', values: { pilot: 'manual', world: 'kerbin', alt0: 1200, descent: 60, drift: 8, driftZ: 0, targetX: 60, targetZ: 0, prop: 9, thrust: 650 } },
        { id: 'fuel', label: 'Low on fuel', text: 'Land on the pad with only 2.5 t of propellant.', values: { prop: 2.5 } },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [0.25, 0.5, 1, 2, 4], scale: 1,
    dt: () => 1 / 120,
    assumptions: [
        'Flat ground and uniform gravity at the world\'s surface value. The booster is a point mass for flight and a rigid body for tipping over after touchdown.',
        'The guidance computer is an illustrative controller written for this lab. It is not WSA\'s AutoLand software.',
        'Booster size, mass and engine values are illustrative: they are not the specifications of any real Aegis booster.',
        'The engine shuts down at touchdown. Above 12 m/s (or 3 m/s without legs) the landing is counted as a crash.',
    ],
    create(p) {
        return { t: 0, L: P.createLanding(landCfg(p)), endAt: null, trail: [] };
    },
    step(sim, p, input, dt) {
        const L = sim.L;
        Object.assign(L.cfg, { thrust: p.thrust * 1000, minThrottle: p.minThrottle / 100, maxTilt: p.maxTilt * DEG, slewRate: p.slewRate * DEG, tx: p.targetX, tz: p.targetZ });
        const out = [];
        for (const e of P.stepLanding(L, { guidance: p.pilot === 'guidance', tune: { gain: p.gain, margin: p.margin / 100, vTouch: p.vTouch }, throttle: input.throttle, tiltX: input.tiltX, tiltZ: input.tiltZ }, dt)) {
            // Throttling right down and back up is normal in a landing burn: log the engine only when it has
            // been off for a while, not every brief flicker
            if (e.type === 'ignition') {
                if (sim.offSince === undefined || L.t - sim.offSince > 1.5) out.push({ text: `Engine on at ${fmt.m(L.pos[1])}`, level: 'info' });
                sim.offSince = undefined;
            }
            if (e.type === 'cutoff') sim.offSince = L.t;
            if (e.type === 'flameout') out.push({ text: 'Propellant exhausted', level: 'bad' });
            if (e.type === 'legs') out.push({ text: 'Landing legs deploying', level: 'info' });
            if (e.type === 'touchdown') out.push({ text: `Touchdown at ${fmt.ms(e.vs)} down, ${fmt.ms(e.hs)} sideways, ${num(e.dist, 1)} m from the pad centre`, level: e.onPad ? 'ok' : 'warn' });
            if (e.type === 'hard') out.push({ text: 'Hard landing: the legs took a beating', level: 'warn' });
            if (e.type === 'crash') out.push({ text: `Crash at ${fmt.ms(e.vs)}`, level: 'bad' });
            if (e.type === 'settled') out.push({ text: 'Booster settled upright on its legs', level: 'ok' });
            if (e.type === 'toppled') out.push({ text: 'The booster tipped over', level: 'bad' });
        }
        sim.t = L.t;
        if (sim.t - (sim.trailT || -1) > 0.2 && L.phase === 'descent') { sim.trail.push(L.pos.slice()); sim.trailT = sim.t; }
        if (sim.endAt === null && (L.phase === 'landed' || L.phase === 'toppled' || L.phase === 'crashed')) sim.endAt = sim.t + 2;
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry(sim) {
        const L = sim.L, c = L.cfg;
        const m = P.landingMass(L);
        const hs = Math.hypot(L.vel[0], L.vel[2]);
        const acc = L.accel || [0, -c.g, 0];
        return {
            clock: L.t, altitude: Math.max(0, L.pos[1]), vVert: L.vel[1], vHoriz: hs, speed: P.len(L.vel), thrust: L.thrust || 0,
            throttle: L.throttle, accel: P.len(acc), accelV: acc[1], twr: P.thrustToWeight(c.thrust, m, c.g), prop: L.prop, propFrac: L.prop / Math.max(1, c.prop),
            dist: Math.hypot(L.pos[0] - c.tx, L.pos[2] - c.tz), tilt: Math.acos(P.clamp(L.dir[1], -1, 1)), mass: m,
            status: { descent: L.throttle > 0 ? 'LANDING BURN' : 'FALLING', tipping: 'TOUCHDOWN', landed: 'LANDED', toppled: 'TIPPED OVER', crashed: 'CRASHED' }[L.phase],
            impact: P.ballisticImpact(L.pos, L.vel, c.g),
            tdOffset: L.td ? L.td.dist : null, tdSpeed: L.td ? L.td.vs : null,
        };
    },
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'altitude', label: 'Altitude', fmt: fmt.m, hud: true },
        { key: 'vVert', label: 'Vertical speed', fmt: fmt.ms, hud: true },
        { key: 'vHoriz', label: 'Horizontal speed', basic: 'Sideways speed', fmt: fmt.ms, hud: true },
        { key: 'speed', label: 'Total speed', fmt: fmt.ms },
        { key: 'dist', label: 'Distance to pad centre', basic: 'To the pad', fmt: v => `${num(v, 1)} m`, hud: true },
        { key: 'throttle', label: 'Throttle', fmt: fmt.pct, hud: true },
        { key: 'thrust', label: 'Thrust', fmt: fmt.kN },
        { key: 'accel', label: 'Net acceleration |a|', basic: 'Acceleration', fmt: fmt.ms2 },
        { key: 'twr', label: 'TWR at full thrust', basic: 'Thrust-to-weight (full power)', fmt: fmt.ratio },
        { key: 'tilt', label: 'Tilt from vertical', basic: 'Lean', fmt: fmt.deg },
        { key: 'prop', label: 'Propellant', basic: 'Fuel left', fmt: fmt.t, bar: 'propFrac' },
        { key: 'tdOffset', label: 'Touchdown offset', fmt: v => (v === null ? '—' : `${num(v, 1)} m`) },
        { key: 'tdSpeed', label: 'Touchdown speed', fmt: v => (v === null ? '—' : fmt.ms(v)) },
    ],
    graphs: [
        { id: 'alt', label: 'Altitude and descent', unit: 'm, m/s', series: [{ key: 'altitude', label: 'Altitude (m)' }, { key: 'vVert', label: 'Vertical speed (m/s)' }] },
        { id: 'thr', label: 'Throttle', unit: '%', series: [{ key: 'throttle', label: 'Throttle', k: 100 }] },
    ],
    actions: [{ id: 'guidance', label: 'Guidance on/off', key: 'G', running: true }],
    manual: true,
    derived(p) {
        const w = worldOf(p);
        const c = landCfg(p);
        const m = c.dry + c.prop;
        const aUp = c.thrust / m - c.g;
        const v = p.descent;
        return [
            { label: 'TWR at full thrust', basic: 'Thrust-to-weight', value: fmt.ratio(P.thrustToWeight(c.thrust, m, w.g)), tone: c.thrust > m * w.g ? 'ok' : 'bad' },
            { label: 'Best braking (T/m − g)', basic: 'Best braking', value: aUp > 0 ? fmt.ms2(aUp) : 'cannot slow down' },
            { label: 'Shortest stopping height v²/(2a)', basic: 'Shortest stopping height', value: aUp > 0 ? fmt.m(v * v / (2 * aUp)) : '—' },
            { label: 'Propellant Δv', value: fmt.ms(P.rocketDeltaV(c.isp, m, c.dry)), pro: true },
            { label: 'Mass flow at full thrust', value: fmt.kgs(P.massFlow(c.thrust, c.isp)), pro: true },
        ];
    },
    note(p, id) {
        const c = landCfg(p);
        const m = c.dry + c.prop;
        const aUp = c.thrust / m - c.g;
        if (id === 'thrust') return aUp > 0 ? `At full power the engines can slow the booster by ${fmt.ms2(aUp)}: from ${p.descent} m/s that takes at least ${fmt.m(p.descent * p.descent / (2 * aUp))}.` : 'Not enough thrust to slow down at all: the booster will hit the ground.';
        if (id === 'drift' || id === 'targetX') return 'To move sideways the booster leans its thrust, which takes a little away from braking.';
        if (id === 'pilot') return p.pilot === 'manual' ? 'You fly: W/S throttle, A/D and Q/E lean (or the touch buttons). Lean against your drift and burn late but not too late.' : 'The guidance computer flies a braking curve and steers for the pad.';
        if (id === 'margin') return `The guidance plans to use ${p.margin}% of the available braking: lower is safer but uses more fuel.`;
        return '';
    },
    debrief(sim, p, ch) {
        const L = sim.L, td = L.td;
        const sc = P.scoreLanding(td, L.outcome);
        const metrics = td ? [
            ['Distance from pad centre', `${num(td.dist, 1)} m`], ['Touchdown speed (down)', fmt.ms(td.vs)], ['Sideways speed', fmt.ms(td.hs)], ['Tilt', fmt.deg(td.tilt)],
            ['Upright', L.outcome === 'landed' ? 'yes' : 'no'], ['Propellant left', fmt.t(td.prop)],
        ] : [];
        const ok = L.outcome === 'landed' && td && td.onPad;
        const met = ch === 'free' ? null : ok;
        const summary = !td ? 'No touchdown.'
            : L.outcome === 'crashed' ? `The booster hit the ground at ${fmt.ms(td.vs)}: too fast for its legs. Start the burn earlier or with more thrust.`
                : L.outcome === 'toppled' ? `It touched down ${td.onPad ? 'on the pad' : `${num(td.dist, 0)} m from the pad`} but ${td.hs > 1 ? `was still sliding sideways at ${fmt.ms(td.hs)}` : `was leaning ${fmt.deg(td.tilt)}`}, and tipped over.`
                    : td.onPad ? `Upright on the pad, ${num(td.dist, 1)} m from the centre, at ${fmt.ms(td.vs)}.`
                        : `Upright, but ${num(td.dist, 0)} m from the pad centre: outside the pad.`;
        const parts = sc.parts;
        metrics.push(['Score parts', `accuracy ${num(parts.accuracy, 0)}/40 · descent ${num(parts.vertical, 0)}/25 · drift ${num(parts.horizontal, 0)}/15 · attitude ${num(parts.attitude, 0)}/10 · upright ${parts.upright}/10`]);
        return { title: ok ? 'Landed on the pad' : L.outcome === 'landed' ? 'Landed' : 'Landing not completed', met, score: sc.score, grade: sc.grade, summary, metrics,
            lesson: 'The landing burn must remove all the speed exactly at the ground: v² = 2 a h. Leaning the engine steers sideways but takes a little thrust from braking; the booster has to be upright and nearly still at touchdown or it tips over its legs.' };
    },
    result: sim => { const td = sim.L.td; return td ? { Outcome: sim.L.outcome, 'Pad offset': `${num(td.dist, 1)} m`, 'Touchdown speed': fmt.ms(td.vs), Score: String(P.scoreLanding(td, sim.L.outcome).score) } : {}; },
};

/* =====================================================================================================
   G. Free-play sandbox
   ===================================================================================================== */

const FREE_STAGES = [
    { dry: 5, prop: 36, engines: 3, thrust: 260, isp: 290 },
    { dry: 1.5, prop: 9, engines: 1, thrust: 90, isp: 340 },
    { dry: 0.5, prop: 2, engines: 1, thrust: 25, isp: 345 },
];

const FREEPLAY = {
    id: 'freeplay', name: 'Free-Play Engineering Sandbox', short: 'Free Play', level: 'Open', view: 'flight', map: true,
    summary: 'Build a rocket of up to three stages, choose where it starts and how it steers, then fly it: to orbit, to space or straight back down.',
    learn: 'Everything together: thrust and weight, staging and the rocket equation, and the orbits that come out of them.',
    presetLabel: 'Experiment',
    presets: [
        { id: 'orbit', label: 'Launch to orbit from Kerbin', values: { world: 'kerbin', start: 'pad', stageCount: 2, payload: 0.8, steer: 'program', turnStart: 1, turnEnd: 50, apoCut: 90, staging: 'auto', throttle: 100, burnLimit: 0, ...stageVals(FREE_STAGES) } },
        { id: 'inorbit', label: 'Start in orbit: 100 km over Kerbin', values: { world: 'kerbin', start: 'orbit', startAlt: 100, startSpeed: 100, stageCount: 1, payload: 0.5, steer: 'prograde', apoCut: 0, staging: 'manual', throttle: 100, burnLimit: 10, s1Dry: 1.5, s1Prop: 6, s1Engines: 1, s1Thrust: 60, s1Isp: 340 } },
        { id: 'hop', label: 'Mun hop', values: { world: 'mun', start: 'pad', stageCount: 1, payload: 0.3, steer: 'vertical', apoCut: 0, staging: 'manual', throttle: 60, burnLimit: 6, s1Dry: 1.2, s1Prop: 2, s1Engines: 1, s1Thrust: 30, s1Isp: 320 } },
        { id: 'heavy', label: 'Heavy three-stage rocket', values: { world: 'kerbin', start: 'pad', stageCount: 3, payload: 3, steer: 'program', turnStart: 1, turnEnd: 55, apoCut: 120, staging: 'auto', throttle: 100, burnLimit: 0, s1Dry: 14, s1Prop: 110, s1Engines: 5, s1Thrust: 420, s1Isp: 290, s2Dry: 4, s2Prop: 30, s2Engines: 2, s2Thrust: 150, s2Isp: 330, s3Dry: 1, s3Prop: 6, s3Engines: 1, s3Thrust: 40, s3Isp: 345 } },
    ],
    params: [
        ...worldParams(),
        select('start', 'pad', [{ value: 'pad', label: 'On the launch pad' }, { value: 'orbit', label: 'In a circular orbit' }, { value: 'air', label: 'In the air, moving' }],
            b('Start', 'Where the rocket begins.'), b('Starting condition', ''), { group: 'Start' }),
        range('startAlt', 100, 0.5, 2000, 0.5, 'km', b('Starting height', ''), b('Starting altitude', ''), { group: 'Start', show: p => p.start !== 'pad' }),
        range('startSpeed', 100, 0, 150, 0.5, '%', b('Starting speed (% of orbit speed)', '100% is a circular orbit.'), b('Initial horizontal speed (× circular)', ''), { group: 'Start', show: p => p.start === 'orbit' }),
        range('airVx', 0, -2000, 2000, 5, 'm/s', b('Starting sideways speed', ''), b('Initial horizontal velocity', ''), { group: 'Start', show: p => p.start === 'air' }),
        range('airVy', 0, -500, 500, 5, 'm/s', b('Starting vertical speed', ''), b('Initial vertical velocity', ''), { group: 'Start', show: p => p.start === 'air' }),
        range('stageCount', 2, 1, 3, 1, '', b('Number of stages', ''), b('Stage count', ''), { group: 'Rocket' }),
        range('payload', 0.8, 0, 50, 0.1, 't', b('Payload', ''), b('Payload mass', ''), { group: 'Rocket' }),
        select('staging', 'auto', [{ value: 'auto', label: 'Automatic at burnout' }, { value: 'manual', label: 'Manual' }], b('Staging', ''), b('Staging condition', ''), { group: 'Rocket' }),
        ...stageParams(3, FREE_STAGES, () => true),
        select('steer', 'program', [
            { value: 'vertical', label: 'Straight up' }, { value: 'program', label: 'Pitch program (gravity turn)' }, { value: 'prograde', label: 'Prograde' },
            { value: 'retrograde', label: 'Retrograde' }, { value: 'horizontal', label: 'Horizontal (east)' }, { value: 'fixed', label: 'Fixed pitch angle' },
        ], b('Steering', 'Which way the rocket points while its engines fire. You can change it in flight.'), b('Steering mode', 'Live.'), { group: 'Flight', live: true }),
        range('turnStart', 1, 0, 30, 0.5, 'km', null, b('Pitch program: start turning at', 'Live.'), { group: 'Flight', live: true, show: p => p.steer === 'program' }),
        range('turnEnd', 50, 5, 150, 1, 'km', null, b('Pitch program: horizontal by', 'Live.'), { group: 'Flight', live: true, show: p => p.steer === 'program' }),
        range('pitch', 45, -90, 90, 1, '°', b('Pitch from vertical', ''), b('Fixed pitch angle', 'Live. 0° is straight up, 90° horizontal.'), { group: 'Flight', live: true, show: p => p.steer === 'fixed' }),
        range('throttle', 100, 0, 100, 1, '%', b('Throttle', ''), b('Throttle', 'Live.'), { group: 'Flight', live: true }),
        range('burnLimit', 0, 0, 600, 1, 's', b('Burn duration limit', '0 means no limit. Otherwise each burn stops by itself after this long.'), b('Burn duration limit', 'Live. 0 = none.'), { group: 'Flight', live: true }),
        range('apoCut', 90, 0, 2000, 5, 'km', b('Cut engines at apoapsis', 'Stop burning once the highest point of the path reaches this height (0 = off).'), b('Engine cut-off at apoapsis', 'Live. 0 = off.'), { group: 'Flight', live: true }),
        timeStepParam(0.02, 0.005, 0.2, 0.005),
    ],
    challenges: [
        { id: 'orbit', label: 'Reach orbit', text: 'Get into a stable orbit: periapsis above the atmosphere (or 10 km on airless worlds). Coast to apoapsis, steer horizontal and burn again.' },
        { id: 'space', label: 'Touch space', text: 'Climb above 100 km.' },
        { id: 'hop', label: 'Hop and land', text: 'Lift off and land back on the ground at under 6 m/s. Try the Mun hop preset.' },
        { id: 'free', label: 'Free experiment', text: 'No goal: change anything and watch what happens.' },
    ],
    scales: [0.5, 1, 2, 5, 10, 30, 100, 300], scale: 2,
    dt: p => p.timeStep,
    assumptions: [
        'A point-mass rocket in the world\'s inverse-square gravity, flying in one plane. No air resistance, no planet rotation, no heating.',
        'Steering is ideal: the rocket points exactly where the steering mode says, instantly.',
        'Values are illustrative, not KSP parts. Worlds use stock KSP gravity and radius.',
    ],
    create(p) {
        const w = worldOf(p);
        const start = p.start === 'orbit' ? { kind: 'orbit', altitude: p.startAlt * 1000, speedFactor: p.startSpeed / 100 }
            : p.start === 'air' ? { kind: 'air', altitude: p.startAlt * 1000, vHorizontal: p.airVx, vVertical: p.airVy } : { kind: 'pad' };
        const f = P.createFlight({ mu: w.mu, radius: w.radius, stages: stagesOf(p), payload: p.payload * 1000, start });
        return { t: p.start === 'pad' ? -3 : 0, f, w, timeline: [], burnStart: null, apoArmed: p.start === 'pad', endAt: null, outcome: null, orbitAt: null, reached: false, trail: [] };
    },
    step(sim, p, input, dt) {
        const f = sim.f;
        const cmds = input.commands.map(c => (c === 'cut' ? 'cutoff' : c));
        if (sim.t < 0) {
            sim.t += dt;
            if (sim.t < 0) return [];
            sim.t = 0;
            cmds.push('ignite');
        }
        const pre = [];
        if (f.engineOn && sim.burnStart !== null && p.burnLimit > 0 && f.t - sim.burnStart >= p.burnLimit) {
            cmds.push('cutoff');
            pre.push({ text: `Burn limit of ${p.burnLimit} s reached`, level: 'info' });
        }
        // The apoapsis cut-off only watches the first climb: once the engines have stopped (or you relight
        // them yourself, say to circularise), it stays out of the way
        if (sim.apoArmed && f.engineOn && p.apoCut > 0 && f.gravity && !f.landed) {
            const el = P.elements(f.r, f.v, f.mu);
            if (el.energy >= 0 || (el.e < 1 && el.ra - f.R >= p.apoCut * 1000)) {
                cmds.push('cutoff');
                pre.push({ text: `Apoapsis at ${el.e < 1 ? fmt.km(el.ra - f.R) : 'escape'}: engines cut off`, level: 'info' });
            }
        }
        if (cmds.includes('cutoff') || cmds.includes('ignite') && sim.t > 0.5) sim.apoArmed = false;
        const wasOn = f.engineOn;
        const raw = P.stepFlight(f, { throttle: p.throttle / 100, steer: { mode: p.steer, turnStart: p.turnStart * 1000, turnEnd: p.turnEnd * 1000, pitch: p.pitch }, commands: cmds, autoStage: p.staging === 'auto', stageDelay: 1, igniteAfterStage: p.staging === 'auto' }, dt);
        const out = pre.concat(flightEvents(raw, sim));
        if (!wasOn && f.engineOn) sim.burnStart = f.t;
        if (raw.some(e => e.type === 'burnout') && f.active === f.stages.length - 1 && !f.engineOn && f.igniteAt === null) sim.apoArmed = false;
        sim.t = f.t;
        if (sim.t - (sim.trailT || -1) > Math.max(0.5, dt * 10)) { sim.trail.push(f.r.slice()); sim.trailT = sim.t; if (sim.trail.length > 3000) sim.trail.shift(); }
        if (f.gravity && !f.landed) {
            const el = P.elements(f.r, f.v, f.mu);
            const safe = f.R + Math.max(sim.w.atmosphere, 10000);
            const inOrbit = el.e < 1 && el.rp > safe;
            if (inOrbit && !sim.orbitAt) { sim.orbitAt = f.t; out.push({ text: `Orbit! Periapsis ${fmt.km(el.rp - f.R)}, apoapsis ${fmt.km(el.ra - f.R)}`, level: 'ok' }); }
            if (!inOrbit) sim.orbitAt = null;
            if (P.len(f.r) > f.R * 40 && sim.endAt === null) { sim.outcome = 'escaped'; sim.endAt = f.t; out.push({ text: 'Left the simulated region on an escape path', level: 'ok' }); }
        }
        if (!sim.reached && P.altitude(f) > 100e3) { sim.reached = true; out.push({ text: 'Passed 100 km', level: 'ok' }); }
        if (sim.endAt === null) {
            if (f.crashed) { sim.outcome = 'impact'; sim.endAt = f.t + 1.5; }
            else if (f.landed && f.liftoff !== null && f.touchdown && !f.engineOn) { sim.outcome = 'landed'; sim.endAt = f.t + 1.5; }
        }
        return out;
    },
    finished: sim => sim.endAt !== null && sim.t >= sim.endAt,
    telemetry: sim => {
        const tm = flightTelemetry(sim.f);
        tm.status = sim.t < 0 ? `COUNTDOWN ${Math.ceil(-sim.t)}` : sim.f.landed ? 'ON THE GROUND' : sim.orbitAt ? 'IN ORBIT' : sim.f.engineOn ? `STAGE ${sim.f.active + 1} BURNING` : 'COASTING';
        return tm;
    },
    readouts: [
        { key: 'status', label: 'Status', fmt: fmt.plain, hud: true },
        { key: 'altitude', label: 'Altitude', fmt: fmt.m, hud: true },
        { key: 'speed', label: 'Speed', fmt: fmt.ms, hud: true },
        { key: 'vVert', label: 'Vertical speed', fmt: fmt.ms },
        { key: 'vHoriz', label: 'Horizontal speed', fmt: fmt.ms },
        { key: 'ap', label: 'Apoapsis', basic: 'Highest point of the path', fmt: v => (v === undefined ? '—' : v === Infinity ? 'escaping' : fmt.km(v)), hud: true },
        { key: 'pe', label: 'Periapsis', basic: 'Lowest point of the path', fmt: v => (v === undefined ? '—' : v < 0 ? 'below the surface' : fmt.km(v)), hud: true },
        { key: 'timeToAp', label: 'Time to apoapsis', fmt: v => (v === undefined ? '—' : fmt.time(v)) },
        { key: 'twr', label: 'TWR', basic: 'Thrust-to-weight', fmt: fmt.ratio },
        { key: 'mass', label: 'Mass', fmt: fmt.t },
        { key: 'thrust', label: 'Thrust', fmt: fmt.kN },
        { key: 'prop', label: 'Stage propellant', basic: 'Stage fuel', fmt: fmt.t, bar: 'propFrac' },
        { key: 'dvLeft', label: 'Δv remaining (ideal)', basic: 'Speed still in the tanks', fmt: fmt.ms },
        { key: 'stage', label: 'Active stage', fmt: v => String(v) },
        { key: 'ecc', label: 'Eccentricity', fmt: v => (v === undefined ? '—' : num(v, 4)), pro: true },
        { key: 'mdot', label: 'Mass flow ṁ', fmt: fmt.kgs, pro: true },
    ],
    graphs: [
        { id: 'alt', label: 'Altitude', unit: 'km', series: [{ key: 'altitude', label: 'Altitude', k: 1e-3 }] },
        { id: 'speed', label: 'Speed', unit: 'm/s', series: [{ key: 'speed', label: 'Speed' }] },
    ],
    actions: [
        { id: 'ignite', label: 'Ignite', key: 'I', running: true }, { id: 'cut', label: 'Cut engines', key: 'K', running: true },
        { id: 'stage', label: 'Stage', key: 'S', running: true }, { id: 'map', label: 'Map view', key: 'M', always: true }, { id: 'end', label: 'End experiment', key: 'E', running: true },
    ],
    derived(p) {
        const w = worldOf(p);
        const stages = stagesOf(p);
        const dv = P.stackDeltaV(stages, p.payload * 1000);
        let m = p.payload * 1000;
        for (const s of stages) m += s.dry + s.prop;
        return [
            { label: 'Total ideal Δv', basic: 'Speed the rocket can add', value: fmt.ms(dv.total), tone: 'ok' },
            ...dv.per.map((v, i) => ({ label: `Stage ${i + 1} Δv`, value: fmt.ms(v), pro: true })),
            { label: 'Lift-off TWR', basic: 'Thrust-to-weight at launch', value: fmt.ratio(P.thrustToWeight(stages[0].thrust * stages[0].engines * p.throttle / 100, m, w.g)) },
            { label: 'Circular orbit speed at 100 km', basic: 'Orbit speed at 100 km', value: fmt.ms(P.circularSpeed(w.mu, w.radius + 100e3)) },
        ];
    },
    note(p, id) {
        if (id === 'steer') return { vertical: 'Straight up: you will go high, but fall back down: orbit needs sideways speed.', program: 'The pitch program tips the rocket over gradually so it builds sideways speed for orbit.', prograde: 'Prograde points along your motion: burning adds speed most efficiently.', retrograde: 'Retrograde points against your motion: burning slows you down.', horizontal: 'Horizontal burns add sideways speed: what an orbit is made of.', fixed: 'The rocket holds one pitch angle from the local vertical.' }[p.steer];
        const dv = P.stackDeltaV(stagesOf(p), p.payload * 1000);
        return `This rocket has ${fmt.ms(dv.total)} of ideal Δv. A low Kerbin orbit takes about 2.3 km/s of speed, plus whatever gravity takes during the climb.`;
    },
    debrief(sim, p, ch) {
        const f = sim.f;
        const tm = flightTelemetry(f);
        const total = P.stackDeltaV(f.stages.map(s => ({ ...s, prop: s.prop0 })), f.payload).total;
        let met = null, score = null;
        if (ch === 'orbit') { met = !!sim.orbitAt; score = met ? Math.round(60 + 40 * Math.min(1, tm.dvLeft / Math.max(1, total))) : Math.round(40 * Math.min(1, f.maxAlt / 70000)); }
        if (ch === 'space') { met = f.maxAlt >= 100e3; score = Math.round(100 * Math.min(1, f.maxAlt / 100e3)); }
        if (ch === 'hop') { met = sim.outcome === 'landed' && f.touchdown && f.touchdown.speed <= P.SAFE_TOUCHDOWN; score = met ? Math.round(100 - 10 * f.touchdown.speed) : 0; }
        const summary = sim.outcome === 'impact' ? `The rocket came back down and hit the ground at ${fmt.ms(f.touchdown ? f.touchdown.speed : 0)}.`
            : sim.orbitAt ? `In orbit: periapsis ${fmt.km(tm.pe)}, apoapsis ${tm.ap === Infinity ? 'escape' : fmt.km(tm.ap)}.`
                : sim.outcome === 'landed' ? `Landed back on the ground at ${fmt.ms(f.touchdown.speed)}.`
                    : sim.outcome === 'escaped' ? 'The rocket escaped the planet.' : `Highest point ${fmt.m(f.maxAlt)}, top speed ${fmt.ms(f.maxSpeed)}.`;
        return { title: 'Flight complete', met, score, summary,
            metrics: [['Highest altitude', fmt.m(f.maxAlt)], ['Top speed', fmt.ms(f.maxSpeed)], ['Δv delivered', fmt.ms(f.dvUsed)], ['Δv left', fmt.ms(tm.dvLeft)], ['Stages used', `${f.active + 1} of ${f.stages.length}`], ['Flight time', fmt.time(f.t)]],
            lesson: 'Getting high is easy; staying up needs sideways speed. An orbit is falling round the planet fast enough to keep missing it.' };
    },
    result: sim => ({ 'Highest altitude': fmt.m(sim.f.maxAlt), 'Top speed': fmt.ms(sim.f.maxSpeed), 'Δv delivered': fmt.ms(sim.f.dvUsed) }),
};

export const SCENARIOS = [ENGINE, LIFTOFF, STAGING, ORBIT, HOHMANN, LANDING, FREEPLAY];
export const scenario = id => SCENARIOS.find(s => s.id === id);

/** Default values of a scenario's parameters, with a preset's values on top. */
export function defaults(sc, presetId) {
    const v = {};
    for (const p of sc.params) v[p.id] = p.value;
    const pr = sc.presets.find(x => x.id === presetId) || sc.presets[0];
    return Object.assign(v, pr ? pr.values : {});
}

/** Clamps every value to its parameter's range or options, so a stored or typed value can't break the model. */
export function sanitize(sc, values) {
    const out = {};
    for (const p of sc.params) {
        let v = values[p.id];
        if (p.kind === 'range') {
            v = Number(v);
            if (!Number.isFinite(v)) v = p.value;
            v = P.clamp(v, p.min, p.max);
        } else if (p.kind === 'toggle') v = v ? 1 : 0;
        else if (!p.options.some(o => o.value === v)) v = p.value;
        out[p.id] = v;
    }
    return out;
}
