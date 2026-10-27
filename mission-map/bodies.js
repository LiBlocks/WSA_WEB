// Mission Map: the Kerbol system as drawn on the map. Stock KSP bodies plus the Outer Planets Mod (OPM).
//
// Who orbits whom follows the game and the mod: OPM adds Sarnus, Urlum, Neidon and Plock beyond Jool, moves
// Eeloo from Kerbol orbit to Sarnus, puts Priax on Polta's orbit (at a libration point), makes Tal a moon of
// Wal, and pairs Plock with Karen. Thatmo's orbit is retrograde (inclination 161°) and Nissee's is very
// eccentric (0.72).
//
// Everything else here is presentation and NOT to scale: sizes are exaggerated, distances are compressed so
// the whole system fits on screen, and the angle of each body on its orbit is chosen for a readable layout.
// It is not where the bodies are at any real moment. Units are arbitrary "map units".
//
// Body fields
//   id, name, kind ('star' | 'planet' | 'moon'), parent (id), radius (map units)
//   orbit   { r, angle } circular orbit radius and the body's angle on it (degrees, counter-clockwise from
//           above); optional e (eccentricity, r is then the semi-major axis and angle the true anomaly),
//           peri (argument of periapsis, deg), incl (inclination, deg), node (ascending node, deg)
//   look    { base, accent, pattern, atmo, rings }: colours and a procedural texture style
//   opm     true when the body is added or moved by the Outer Planets Mod
//   note    one line shown in the location panel

export const BODIES = [
    { id: 'kerbol', name: 'Kerbol', kind: 'star', radius: 18, look: { base: '#ffe7a8' }, note: 'The star at the centre of the system.' },

    { id: 'moho', name: 'Moho', kind: 'planet', parent: 'kerbol', radius: 1.9, orbit: { r: 62, angle: 120 },
      look: { base: '#8a7564', accent: '#5e4c40', pattern: 'rock' } },

    { id: 'eve', name: 'Eve', kind: 'planet', parent: 'kerbol', radius: 3.6, orbit: { r: 96, angle: 205 },
      look: { base: '#7a4fa0', accent: '#a982c9', pattern: 'cloud', atmo: '#b48be0' } },
    { id: 'gilly', name: 'Gilly', kind: 'moon', parent: 'eve', radius: 0.45, orbit: { r: 9, angle: 40, e: 0.55, peri: 10, incl: 12 },
      look: { base: '#8c7462', accent: '#5f4d40', pattern: 'rock' } },

    { id: 'kerbin', name: 'Kerbin', kind: 'planet', parent: 'kerbol', radius: 3.7, orbit: { r: 135, angle: 300 },
      look: { base: '#2d6fb3', accent: '#4f8a3c', pattern: 'earth', atmo: '#8fc5ff' }, note: 'Home of the Kerbal Space Center and WSA.' },
    { id: 'mun', name: 'Mun', kind: 'moon', parent: 'kerbin', radius: 1.1, orbit: { r: 10, angle: 75 },
      look: { base: '#8f9196', accent: '#5f6166', pattern: 'rock' } },
    { id: 'minmus', name: 'Minmus', kind: 'moon', parent: 'kerbin', radius: 0.7, orbit: { r: 15.5, angle: 165, incl: 6 },
      look: { base: '#9fd8c4', accent: '#c8efe2', pattern: 'ice' } },

    { id: 'duna', name: 'Duna', kind: 'planet', parent: 'kerbol', radius: 2.8, orbit: { r: 182, angle: 40 },
      look: { base: '#b5532f', accent: '#d98a5f', pattern: 'rock', atmo: '#e6a07a' } },
    { id: 'ike', name: 'Ike', kind: 'moon', parent: 'duna', radius: 0.95, orbit: { r: 7.5, angle: 210 },
      look: { base: '#6f6f73', accent: '#4c4c50', pattern: 'rock' } },

    { id: 'dres', name: 'Dres', kind: 'planet', parent: 'kerbol', radius: 1.6, orbit: { r: 245, angle: 230 },
      look: { base: '#8d8478', accent: '#6b6359', pattern: 'rock' } },

    { id: 'jool', name: 'Jool', kind: 'planet', parent: 'kerbol', radius: 8.5, orbit: { r: 330, angle: 120 },
      look: { base: '#5d9a3a', accent: '#8cc05a', pattern: 'bands', atmo: '#a6d67a' } },
    { id: 'laythe', name: 'Laythe', kind: 'moon', parent: 'jool', radius: 1.3, orbit: { r: 14, angle: 300 },
      look: { base: '#2c5f9e', accent: '#c9c08e', pattern: 'earth', atmo: '#9cc8ff' } },
    { id: 'vall', name: 'Vall', kind: 'moon', parent: 'jool', radius: 1.15, orbit: { r: 18.5, angle: 200 },
      look: { base: '#b9c8d4', accent: '#8ea3b4', pattern: 'ice' } },
    { id: 'tylo', name: 'Tylo', kind: 'moon', parent: 'jool', radius: 1.55, orbit: { r: 24, angle: 90 },
      look: { base: '#cbbfae', accent: '#9e9282', pattern: 'rock' } },
    { id: 'bop', name: 'Bop', kind: 'moon', parent: 'jool', radius: 0.65, orbit: { r: 30, angle: 140, e: 0.235, peri: 25, incl: 15 },
      look: { base: '#7b6450', accent: '#56443a', pattern: 'rock' } },
    { id: 'pol', name: 'Pol', kind: 'moon', parent: 'jool', radius: 0.55, orbit: { r: 35, angle: 20, e: 0.17, peri: 15, incl: 4.25 },
      look: { base: '#cdbb7e', accent: '#a8955c', pattern: 'rock' } },

    { id: 'sarnus', name: 'Sarnus', kind: 'planet', parent: 'kerbol', radius: 7.5, opm: true, orbit: { r: 450, angle: 15 },
      look: { base: '#cdb48a', accent: '#a98d62', pattern: 'bands', atmo: '#e8d5ae', rings: { inner: 10, outer: 14 } },
      note: 'A ringed gas giant. Hale orbits inside the rings, Ovok at their edge.' },
    { id: 'hale', name: 'Hale', kind: 'moon', parent: 'sarnus', radius: 0.45, opm: true, orbit: { r: 12, angle: 30 },
      look: { base: '#8e8a86', accent: '#6c6864', pattern: 'rock' } },
    { id: 'ovok', name: 'Ovok', kind: 'moon', parent: 'sarnus', radius: 0.6, opm: true, orbit: { r: 14.6, angle: 150 },
      look: { base: '#d8d2c6', accent: '#b4ab9a', pattern: 'ice' } },
    { id: 'eeloo', name: 'Eeloo', kind: 'moon', parent: 'sarnus', radius: 1.1, opm: true, orbit: { r: 19, angle: 250 },
      look: { base: '#d9d6d0', accent: '#a9a39a', pattern: 'ice' }, note: 'A planet in the stock game; the Outer Planets Mod makes it a moon of Sarnus.' },
    { id: 'slate', name: 'Slate', kind: 'moon', parent: 'sarnus', radius: 1.5, opm: true, orbit: { r: 24, angle: 330 },
      look: { base: '#7d746c', accent: '#5a534d', pattern: 'rock' } },
    { id: 'tekto', name: 'Tekto', kind: 'moon', parent: 'sarnus', radius: 1.25, opm: true, orbit: { r: 29.5, angle: 80 },
      look: { base: '#c98a4a', accent: '#e0b27c', pattern: 'cloud', atmo: '#e6b27a' } },

    { id: 'urlum', name: 'Urlum', kind: 'planet', parent: 'kerbol', radius: 6, opm: true, orbit: { r: 575, angle: 205 },
      look: { base: '#8fd0d6', accent: '#b9e6ea', pattern: 'bands', atmo: '#bdf0f5' } },
    { id: 'polta', name: 'Polta', kind: 'moon', parent: 'urlum', radius: 1, opm: true, orbit: { r: 11, angle: 40 },
      look: { base: '#8c9a98', accent: '#4fa3a0', pattern: 'swirl' } },
    { id: 'priax', name: 'Priax', kind: 'moon', parent: 'urlum', radius: 0.5, opm: true, orbit: { r: 11, angle: 100 },
      look: { base: '#b3a77c', accent: '#857a55', pattern: 'rock' }, note: 'Shares Polta\'s orbit, at a libration point ahead of it.' },
    { id: 'wal', name: 'Wal', kind: 'moon', parent: 'urlum', radius: 1.3, opm: true, orbit: { r: 17, angle: 250 },
      look: { base: '#8a8178', accent: '#625a52', pattern: 'rock' }, note: 'Has a moon of its own, Tal.' },
    { id: 'tal', name: 'Tal', kind: 'moon', parent: 'wal', radius: 0.35, opm: true, orbit: { r: 2.6, angle: 0 },
      look: { base: '#9a948e', accent: '#706a64', pattern: 'rock' }, note: 'A moon of Wal, the moon of Urlum.' },

    { id: 'neidon', name: 'Neidon', kind: 'planet', parent: 'kerbol', radius: 5.5, opm: true, orbit: { r: 690, angle: 300 },
      look: { base: '#2f56b8', accent: '#5c86e0', pattern: 'bands', atmo: '#7fa6ff' } },
    { id: 'thatmo', name: 'Thatmo', kind: 'moon', parent: 'neidon', radius: 1.15, opm: true, orbit: { r: 11, angle: 120, incl: 161 },
      look: { base: '#d6c2bd', accent: '#a98f8a', pattern: 'ice' }, note: 'Orbits backwards (retrograde), tilted 161°.' },
    { id: 'nissee', name: 'Nissee', kind: 'moon', parent: 'neidon', radius: 0.6, opm: true, orbit: { r: 24, angle: 160, e: 0.72, peri: 30 },
      look: { base: '#8f8a84', accent: '#6a655f', pattern: 'rock' }, note: 'A very elongated orbit (eccentricity 0.72).' },

    { id: 'plock', name: 'Plock', kind: 'planet', parent: 'kerbol', radius: 1.5, opm: true, orbit: { r: 810, angle: 40, e: 0.12, peri: 60 },
      look: { base: '#9b7d68', accent: '#c7ab92', pattern: 'ice' }, note: 'The outermost body, on an eccentric orbit, paired with its large moon Karen.' },
    { id: 'karen', name: 'Karen', kind: 'moon', parent: 'plock', radius: 0.8, opm: true, orbit: { r: 4.2, angle: 200 },
      look: { base: '#8e8a8c', accent: '#6b6769', pattern: 'rock' } }
];

// Selectable places that are not bodies. KGOSS-1's position on low Kerbin orbit is illustrative.
export const REGIONS = [
    { id: 'lko', name: 'Low Kerbin orbit', parent: 'kerbin', kind: 'region', alt: 1.7, note: 'Where KGOSS-1 works, at about 200 km.' },
    { id: 'kgoss', name: 'KGOSS-1 station', parent: 'kerbin', kind: 'station', alt: 1.7, angle: 230, note: 'WSA\'s orbital station and assembly hub.' },
    { id: 'solar', name: 'Interplanetary space', parent: 'kerbol', kind: 'region', note: 'Solar orbit and the transfers between planets.' }
];

const DEG = Math.PI / 180;
const byId = new Map(BODIES.map(b => [b.id, b]));
const regionById = new Map(REGIONS.map(r => [r.id, r]));

export const body = id => byId.get(id);
export const region = id => regionById.get(id);
export const place = id => byId.get(id) || regionById.get(id);
export const children = id => BODIES.filter(b => b.parent === id);

/** Chain of ids from the body up to Kerbol, e.g. vall → ['vall', 'jool', 'kerbol'] */
export function ancestry(id) {
    const out = [];
    for (let b = byId.get(id); b; b = byId.get(b.parent)) out.push(b.id);
    return out;
}

// Direction for an angle in the orbital plane: counter-clockwise when seen from above (+y), like KSP's
// prograde direction. Angles are in degrees.
export function dir(angleDeg) {
    const a = angleDeg * DEG;
    return [Math.cos(a), 0, -Math.sin(a)];
}

/** A point on a body's orbit relative to its parent, for true anomaly `nu` (degrees) */
export function orbitOffset(orbit, nu = orbit.angle) {
    const e = orbit.e || 0;
    const r = e ? orbit.r * (1 - e * e) / (1 + e * Math.cos(nu * DEG)) : orbit.r;
    const [x, , z] = dir(nu + (orbit.peri || 0));
    const px = x * r, pz = z * r;
    if (!orbit.incl) return [px, 0, pz];
    // Tilt about the line of nodes, an axis n in the plane at angle `node` (Rodrigues' rotation)
    const [nx, , nz] = dir(orbit.node || 0), c = Math.cos(orbit.incl * DEG), s = Math.sin(orbit.incl * DEG);
    const along = (nx * px + nz * pz) * (1 - c);
    return [px * c + nx * along, (nz * px - nx * pz) * s, pz * c + nz * along];
}

const posCache = new Map();
/** World position of a body's centre */
export function position(id) {
    if (posCache.has(id)) return posCache.get(id);
    const b = byId.get(id);
    let p = [0, 0, 0];
    if (b && b.parent) {
        const parent = position(b.parent), o = orbitOffset(b.orbit);
        p = [parent[0] + o[0], parent[1] + o[1], parent[2] + o[2]];
    }
    posCache.set(id, p);
    return p;
}

/** Furthest point of a body's moon system from its centre (its own radius when it has no moons) */
export function systemExtent(id) {
    const b = byId.get(id);
    let ext = b.radius;
    for (const m of children(id)) {
        const o = m.orbit, apo = o.r * (1 + (o.e || 0));
        ext = Math.max(ext, apo + systemExtent(m.id));
    }
    if (b.look && b.look.rings) ext = Math.max(ext, b.look.rings.outer);
    return ext;
}

/** Sampled closed orbit path of a body around its parent, in world coordinates */
export function orbitPath(id, samples = 256) {
    const b = byId.get(id), c = position(b.parent), pts = [];
    for (let i = 0; i < samples; i++) {
        const o = orbitOffset(b.orbit, (i / samples) * 360);
        pts.push([c[0] + o[0], c[1] + o[1], c[2] + o[2]]);
    }
    return pts;
}

/** Angle (deg) of `id` as seen from `centerId` in the orbital plane */
export function angleAbout(centerId, id) {
    const c = position(centerId), p = position(id);
    return Math.atan2(-(p[2] - c[2]), p[0] - c[0]) / DEG;
}

/** Plain-language description of a body or region, e.g. "Moon of Jool · Outer Planets Mod" */
export function describe(id) {
    const r = regionById.get(id);
    if (r) return r.kind === 'station' ? 'Space station · Low Kerbin orbit' : r.id === 'solar' ? 'Region · Solar orbit' : `Region · ${byId.get(r.parent).name}`;
    const b = byId.get(id);
    const kind = b.kind === 'star' ? 'Star' : b.kind === 'planet' ? 'Planet' : `Moon of ${byId.get(b.parent).name}`;
    return b.opm ? `${kind} · Outer Planets Mod` : `${kind} · Stock`;
}
