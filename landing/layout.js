// SSTO Landing: where things are at the spaceport. Plain data shared by the flight model (collisions,
// the runway and the sea) and the 3D world (drawing), so the two always agree.
//
// World frame (metres): x to the right of the landing direction, y up, z back along the approach.
// The runway threshold is at z = 0 and the runway runs from z = 0 to z = -RUNWAY.length, so the
// distance before the threshold is +z and the distance along the runway is s = -z. The ground is y = 0.

export const RUNWAY = {
    length: 2500,       // m
    width: 70,          // m, edge to edge
    numbers: ['09', '27'],
};

// The approach path the guidance and the PAPI lights show: 4° down to an aiming point past the threshold
export const GLIDE = {
    angle: 4,           // deg
    aim: 300,           // m past the threshold
    final: 3000,        // m before the threshold: the final approach starts here
};
export const glideAlt = z => Math.max(0, (z + GLIDE.aim) * Math.tan(GLIDE.angle * Math.PI / 180));

// The coast runs along the left of the runway; everything left of this is sea
export const SEA_X = -1400;

// Buildings and masts, in runway terms: x across (+ right), s along the runway from the threshold,
// w across, d along, h tall. The aircraft hitting one of these boxes ends the attempt.
export const BUILDINGS = [
    { id: 'tower', name: 'the control tower', x: 235, s: 760, w: 22, d: 22, h: 58 },
    { id: 'admin', name: 'the operations building', x: 470, s: 560, w: 74, d: 42, h: 22 },
    { id: 'hangar', name: 'the spaceplane hangar', x: 420, s: 1350, w: 112, d: 86, h: 43 },
    { id: 'vab', name: 'the vehicle assembly building', x: 790, s: 1060, w: 110, d: 96, h: 126 },
    { id: 'tanks', name: 'the fuel farm', x: 1320, s: 2250, w: 96, d: 64, h: 24 },
    { id: 'pad', name: 'the launch pad', x: 1780, s: 2950, w: 130, d: 130, h: 92 },
    { id: 'tracking', name: 'the tracking station', x: 980, s: 140, w: 130, d: 64, h: 34 },
    { id: 'mast1', name: 'a radio mast', x: 920, s: -900, w: 8, d: 8, h: 120 },
    { id: 'mast2', name: 'a radio mast', x: -330, s: 2050, w: 8, d: 8, h: 104 },
];

// Axis-aligned boxes in the world frame for the collision test
export const COLLIDERS = BUILDINGS.map(b => ({
    name: b.name,
    min: [b.x - b.w / 2, 0, -(b.s + b.d / 2)],
    max: [b.x + b.w / 2, b.h, -(b.s - b.d / 2)],
}));

// The playable area: leaving it ends the attempt
export const AREA = { x: 14000, zMin: -12000, zMax: 16000, ceiling: 3000 };
