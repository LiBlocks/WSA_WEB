// The Kerbol system as the homepage shows it: WSA's own neighbourhood, laid out for the eye rather than to
// scale (distances are compressed and the small worlds enlarged). Identities (id) match celestial-bodies.js,
// which supplies the real radius and gravity shown in the information panels, and the mission archive's
// `locations`, which supplies what WSA has done there.
//
//   a        orbit radius (scene units)       r        drawn radius
//   period   seconds per orbit at full animation intensity (negative: retrograde)
//   inc      orbit inclination (degrees)     node     where the orbit crosses the plane (degrees)
//   phase    where it starts (degrees)       spin     seconds per turn at full intensity
//   type     the surface shader: rock, terran, desert, gas, ice, ocean, eve, mint
//   c1..c3   surface colours                 atmo     [r, g, b, strength] of the air glow

export const SYSTEM = [
    { id: 'kerbol', name: 'Kerbol', kind: 'Star', r: 1.6, type: 'star', spin: 220 },
    { id: 'moho', name: 'Moho', kind: 'Planet', parent: 'kerbol', a: 7.2, r: 0.26, period: 260, inc: 7, node: 70, phase: 200, spin: 900,
      type: 'rock', c1: '#9b8370', c2: '#5c4a3d', c3: '#c9b49d' },
    { id: 'eve', name: 'Eve', kind: 'Planet', parent: 'kerbol', a: 12, r: 0.82, period: 560, inc: 2.1, node: 15, phase: 120, spin: 160,
      type: 'eve', c1: '#8a59c2', c2: '#4b2b78', c3: '#c79be8', atmo: [0.72, 0.5, 1.0, 0.9] },
    { id: 'gilly', name: 'Gilly', kind: 'Moon of Eve', parent: 'eve', a: 1.5, r: 0.07, period: 60, inc: 12, node: 80, phase: 40, spin: 40,
      type: 'rock', c1: '#a38b73', c2: '#6b5846', c3: '#c4ad94' },
    { id: 'kerbin', name: 'Kerbin', kind: 'Planet', parent: 'kerbol', a: 18, r: 0.8, period: 900, inc: 0, node: 0, phase: 18, spin: 140,
      type: 'terran', c1: '#123f78', c2: '#2d78b8', c3: '#4c8a3c', atmo: [0.45, 0.68, 1.0, 1.0] },
    { id: 'mun', name: 'Mun', kind: 'Moon of Kerbin', parent: 'kerbin', a: 2.6, r: 0.23, period: 150, inc: 0, node: 0, phase: 300, spin: 150,
      type: 'rock', c1: '#a9aaae', c2: '#5d5f64', c3: '#d2d3d6' },
    { id: 'minmus', name: 'Minmus', kind: 'Moon of Kerbin', parent: 'kerbin', a: 4.1, r: 0.1, period: 260, inc: 6, node: 78, phase: 160, spin: 120,
      type: 'mint', c1: '#a9dcc4', c2: '#75b296', c3: '#e8f6ef' },
    { id: 'duna', name: 'Duna', kind: 'Planet', parent: 'kerbol', a: 27, r: 0.52, period: 1640, inc: 0.06, node: 135, phase: 64, spin: 170,
      type: 'desert', c1: '#c9583a', c2: '#7f2d1f', c3: '#f2ddd2', atmo: [1.0, 0.62, 0.45, 0.45] },
    { id: 'ike', name: 'Ike', kind: 'Moon of Duna', parent: 'duna', a: 1.35, r: 0.17, period: 110, inc: 0.2, node: 0, phase: 90, spin: 110,
      type: 'rock', c1: '#8f8a85', c2: '#4f4b48', c3: '#b9b4ae' },
    { id: 'dres', name: 'Dres', kind: 'Dwarf planet', parent: 'kerbol', a: 36, r: 0.17, period: 2600, inc: 5, node: 280, phase: 250, spin: 90,
      type: 'rock', c1: '#9d9893', c2: '#55514d', c3: '#c8c3bd' },
    { id: 'jool', name: 'Jool', kind: 'Gas giant', parent: 'kerbol', a: 48, r: 2.3, period: 3900, inc: 1.3, node: 52, phase: 112, spin: 70,
      type: 'gas', c1: '#7aa63c', c2: '#456f25', c3: '#b9d96a', atmo: [0.66, 0.85, 0.35, 0.8] },
    { id: 'laythe', name: 'Laythe', kind: 'Moon of Jool', parent: 'jool', a: 4.2, r: 0.32, period: 120, inc: 0, node: 0, phase: 30, spin: 120,
      type: 'ocean', c1: '#143c74', c2: '#2b6fb0', c3: '#d8c690', atmo: [0.5, 0.72, 1.0, 0.7] },
    { id: 'vall', name: 'Vall', kind: 'Moon of Jool', parent: 'jool', a: 5.6, r: 0.24, period: 190, inc: 0, node: 0, phase: 210, spin: 190,
      type: 'ice', c1: '#c8dbe8', c2: '#89a3b8', c3: '#f4fbff' },
    { id: 'tylo', name: 'Tylo', kind: 'Moon of Jool', parent: 'jool', a: 7.4, r: 0.36, period: 300, inc: 0.025, node: 0, phase: 320, spin: 300,
      type: 'rock', c1: '#c3b6a6', c2: '#7b7064', c3: '#e3d9cb' },
    { id: 'sarnus', name: 'Sarnus', kind: 'Gas giant', parent: 'kerbol', a: 66, r: 2.0, period: 6200, inc: 2, node: 200, phase: 150, spin: 64,
      type: 'gas', c1: '#d7bd85', c2: '#9c7a4c', c3: '#f1e3bd', atmo: [1.0, 0.88, 0.62, 0.6],
      ring: { inner: 2.7, outer: 4.9, tilt: 24 } },
    { id: 'eeloo', name: 'Eeloo', kind: 'Moon of Sarnus', parent: 'sarnus', a: 8.2, r: 0.15, period: 420, inc: 9, node: 30, phase: 80, spin: 200,
      type: 'ice', c1: '#e5e9ec', c2: '#a9b1b8', c3: '#ffffff' },
];

// What the information panel says beyond the numbers. Plain, factual, and about WSA where WSA has been.
export const NOTES = {
    kerbol: 'The star at the centre of WSA\'s system. Every orbit on this page, and every WSA flight, goes round it.',
    moho: 'The innermost planet, small and scorched. No WSA mission has gone here yet.',
    eve: 'A purple world with a thick atmosphere and strong gravity: easy to land on, very hard to leave. No WSA mission has gone here yet.',
    gilly: 'Eve\'s tiny moon. No WSA mission has gone here yet.',
    kerbin: 'Home. WSA launches from here, and KGOSS-1, its station, orbits it at about 200 km.',
    mun: 'Kerbin\'s large moon, one of the three worlds WSA has landed on.',
    minmus: 'Kerbin\'s small icy moon with its flat plains, one of the three worlds WSA has landed on.',
    duna: 'The red planet, and the farthest world WSA has landed on.',
    ike: 'Duna\'s moon, close enough to fill its sky.',
    dres: 'A small dwarf planet between Duna and Jool. No WSA mission has gone here yet.',
    jool: 'The green gas giant, with five moons. A WSA relay probe meant for Duna reached it by accident and was last known in Jool orbit.',
    laythe: 'Jool\'s ocean moon, with an atmosphere of its own. WSA\'s stray relay probe lost contact trying to reach it.',
    vall: 'An icy moon of Jool. An accidental gravity assist sent WSA\'s relay probe past it.',
    tylo: 'Jool\'s largest moon: no atmosphere, and four-fifths of Kerbin\'s gravity.',
    sarnus: 'A ringed gas giant beyond Jool, added by the Outer Planets Mod in WSA\'s installation.',
    eeloo: 'A small icy world. In WSA\'s installation, with the Outer Planets Mod, it orbits Sarnus.',
};

// Objects beyond the system: decorative, but selectable in Explore mode. `discovery` marks the hidden ones.
export const DEEP_SKY = {
    galaxy: { name: 'A spiral galaxy', kind: 'Distant galaxy', note: 'Far beyond the Kerbol system. An artistic rendering, drawn from a few thousand points.' },
    nebula: { name: 'An emission nebula', kind: 'Nebula', note: 'Glowing gas lit by young stars. It brightens when you point at Gallery in the menu.' },
    cluster: { name: 'A globular cluster', kind: 'Star cluster', note: 'Hundreds of old stars held together by their own gravity.' },
    constellation: { name: 'The Climb', kind: 'Constellation · discovery', note: 'A constellation in the shape of the ascent trail on the WSA insignia. You found it.', discovery: true },
    blackhole: { name: 'A quiet black hole', kind: 'Black hole · discovery', note: 'Nothing WSA has built is going anywhere near it. You found it.', discovery: true },
    comet: { name: 'A long-period comet', kind: 'Comet · discovery', note: 'It swings in from the outer system and back out again. You caught it.', discovery: true },
};
