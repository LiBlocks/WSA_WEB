/*
 * WSA celestial-body data: the one place the website keeps physical constants for planets and moons.
 * The Flight Dynamics Center reads it; add a body here rather than in a calculator.
 *
 * Every value belongs to one environment (a particular KSP setup). Values from different environments must
 * never be mixed: a KSRSS Kerbin is not a stock Kerbin.
 *
 * Body fields
 *   id, name, env          id is unique within the environment; env is a key of ENVIRONMENTS
 *   parent                 id of the body it orbits (none for the star)
 *   radius                 m, the reference (equatorial) radius altitudes are measured from
 *   mu                     m³/s², standard gravitational parameter GM
 *   atmosphere             m, height of the top of the atmosphere above the radius; 0 when there is none
 *   source                 where the numbers come from
 */

export const G0 = 9.80665;   // m/s², standard gravity: KSP's conversion from surface gravity (g) and the rocket-equation constant

const STOCK_LOG = 'KSP 1.12.5 install, Kopernicus body log Logs/Kopernicus/Squad (radius and surface gravity GeeASL); μ = GeeASL × 9.80665 m/s² × radius², rounded to 8 significant figures';
const OPM_LOG = 'KSP 1.12.5 install with Outer Planets Mod 2.2.11, Kopernicus body log Logs/Kopernicus (radius and gravParameter)';

// Each system is complete in itself. The calculators only ever offer the bodies of one system at a time,
// so stock, Outer Planets Mod and KSRSS values can never be mixed in one calculation.
export const ENVIRONMENTS = {
    'ksp-stock': {
        label: 'Stock Kerbol system (KSP 1.12.5)',
        short: 'Stock',
        note: 'The stock Kerbol system. Values read from WSA\'s KSP 1.12.5 installation; the Outer Planets Mod installed there leaves the stock bodies\' sizes and gravity unchanged.',
    },
    'ksp-opm': {
        label: 'Outer Planets Mod 2.2.11 (stock system + OPM)',
        short: 'Stock + OPM',
        note: 'WSA\'s current installation: the stock Kerbol system plus the Outer Planets Mod (Sarnus, Urlum, Neidon, Plock and their moons; Eeloo becomes a moon of Sarnus). Read from the installation\'s Kopernicus logs.',
    },
    'ksrss': {
        label: 'KSRSS Reborn',
        short: 'KSRSS',
        available: false,
        note: 'KSRSS Reborn rescales the system, so its Kerbin and other bodies have different radii and gravitational parameters from the stock game. Its configuration files are not in the current installation, so no KSRSS values are listed here. Enter its μ and radius as a custom body.',
    },
};

const S = (id, name, parent, radius, mu, atmosphere) => ({ id, name, parent, radius, mu, atmosphere, source: STOCK_LOG });
const O = (id, name, parent, radius, mu, atmosphere) => ({ id, name, parent, radius, mu, atmosphere, source: OPM_LOG, opm: true });

// The stock system
const STOCK = [
    S('kerbol', 'Kerbol (the Sun)', null, 261600000, 1.1723328e18, 600000),
    S('moho', 'Moho', 'kerbol', 250000, 1.6860938e11, 0),
    S('eve', 'Eve', 'kerbol', 700000, 8.1717302e12, 90000),
    S('gilly', 'Gilly', 'eve', 13000, 8289449.8, 0),
    S('kerbin', 'Kerbin', 'kerbol', 600000, 3.5316e12, 70000),
    S('mun', 'Mun', 'kerbin', 200000, 6.5138398e10, 0),
    S('minmus', 'Minmus', 'kerbin', 60000, 1.7658e9, 0),
    S('duna', 'Duna', 'kerbol', 320000, 3.0136321e11, 50000),
    S('ike', 'Ike', 'duna', 130000, 1.8568369e10, 0),
    S('dres', 'Dres', 'kerbol', 138000, 2.1484489e10, 0),
    S('jool', 'Jool', 'kerbol', 6000000, 2.82528e14, 200000),
    S('laythe', 'Laythe', 'jool', 500000, 1.962e12, 50000),
    S('vall', 'Vall', 'jool', 300000, 2.074815e11, 0),
    S('tylo', 'Tylo', 'jool', 600000, 2.82528e12, 0),
    S('bop', 'Bop', 'jool', 65000, 2.4868349e9, 0),
    S('pol', 'Pol', 'jool', 44000, 7.2170208e8, 0),
    S('eeloo', 'Eeloo', 'kerbol', 210000, 7.4410815e10, 0),
];

// Outer Planets Mod additions. The mod leaves the stock bodies as they are, except that Eeloo becomes a
// moon of Sarnus (its size and gravity stay the stock values).
const OPM = [
    O('sarnus', 'Sarnus', 'kerbol', 5300000, 82089701953000, 580000),
    O('hale', 'Hale', 'sarnus', 6000, 811990.62, 0),
    O('ovok', 'Ovok', 'sarnus', 26000, 13258590.8, 0),
    O('slate', 'Slate', 'sarnus', 540000, 1978856444880, 0),
    O('tekto', 'Tekto', 'sarnus', 280000, 192440992408, 95000),
    O('urlum', 'Urlum', 'kerbol', 2177000, 11944573769627.4, 325000),
    O('polta', 'Polta', 'urlum', 220000, 90181953400, 0),
    O('priax', 'Priax', 'urlum', 74000, 3383176570.2, 0),
    O('wal', 'Wal', 'urlum', 370000, 496736242450, 0),
    O('tal', 'Tal', 'wal', 22000, 213588837, 0),
    O('neidon', 'Neidon', 'kerbol', 2145000, 14167881530302.5, 260000),
    O('thatmo', 'Thatmo', 'neidon', 286000, 186097580468.8, 35000),
    O('nissee', 'Nissee', 'neidon', 30000, 397169325, 0),
    O('plock', 'Plock', 'kerbol', 189000, 51844895008.2, 0),
    O('karen', 'Karen', 'plock', 85050, 4681804201.24725, 0),
];

export const BODIES = [
    ...STOCK.map(b => ({ ...b, env: 'ksp-stock' })),
    ...STOCK.map(b => ({ ...b, env: 'ksp-opm',
        ...(b.id === 'eeloo' ? { parent: 'sarnus', note: 'A planet in the stock game; the Outer Planets Mod makes it a moon of Sarnus.' } : {}) })),
    ...OPM.map(b => ({ ...b, env: 'ksp-opm' })),
];

export const DEFAULT_ENV = 'ksp-opm';
export const body = (id, env = DEFAULT_ENV) => BODIES.find(b => b.id === id && b.env === env);
export const bodiesOf = env => BODIES.filter(b => b.env === env);

/** Surface gravity at the reference radius, m/s² */
export const surfaceGravity = b => b.mu / (b.radius * b.radius);
