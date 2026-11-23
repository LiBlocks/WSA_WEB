// Named places and moods: the vocabulary the homepage, its navigation and (later) other features share.
//
// A pose is a camera placement in a frame that travels with a world, so it keeps its composition while the
// world orbits. Frame axes, from the world `frame`: t along its orbit, u straight out from the star, y up.
//   origin   what the offsets are measured from (a world id)
//   at       camera offset [t, u, y]          look   target offset [t, u, y]
//   fov      vertical field of view            shift  lens shift: + puts the subject right of centre
//   orbits   how visible the orbit lines are here (1 normal)
//   narrow   the same place composed for portrait screens
// The homepage's sections travel through these in order (SCROLL_PATH); hovering a menu item gives its
// mood. A future star-system navigation can add destinations here without touching the engine.

export const POSES = {
    home: { origin: 'kerbin', frame: 'kerbin', at: [-5.4, 2.6, 0.9], look: [0.15, 0, 0], fov: 34, shift: 0.42, orbits: 0.35,
        narrow: { at: [-8.4, 3.4, 0.5], look: [0.2, 0, -2.6], fov: 50, shift: 0 } },
    // Kerbin's night side from beyond it, the star just behind its limb: a crescent and a ring of air glow
    news: { origin: 'kerbin', frame: 'kerbin', at: [-0.55, 6.2, 0.45], look: [0.1, 0, 0.05], fov: 30, shift: 0.62, orbits: 0.3,
        narrow: { at: [-0.7, 8.2, 0.4], look: [0, 0, 1.4], fov: 42, shift: 0 } },
    engineering: { origin: 'kerbol', frame: 'kerbin', at: [-12, 30, 11], look: [3, 9, -1.5], fov: 42, shift: -0.36, orbits: 1,
        narrow: { at: [-14, 34, 16], look: [2, 10, 1], fov: 54, shift: 0 } },
    // High above the star, looking out past Kerbin's orbit: the orbits sweep behind the cards, the star itself
    // stays below the frame so nothing bright sits behind their text
    vehicles: { origin: 'kerbol', frame: 'kerbin', at: [6, -12, 46], look: [-4, 34, 0], fov: 44, shift: 0, orbits: 1.2,
        narrow: { at: [6, -14, 60], look: [-4, 34, 4], fov: 56, shift: 0 } },
    missions: { origin: 'duna', frame: 'duna', at: [-3.7, 1.5, 0.7], look: [0.1, 0, 0], fov: 34, shift: 0.4, orbits: 0.5,
        narrow: { at: [-5, 1.8, 0.5], look: [0, 0, 1.2], fov: 46, shift: 0 } },
    about: { origin: 'kerbol', frame: 'kerbin', at: [-62, 64, 92], look: [6, 8, 0], fov: 48, shift: 0, orbits: 1.2,
        narrow: { at: [-70, 80, 120], look: [6, 8, 6], fov: 58, shift: 0 } },
};

// The homepage's sections, top to bottom, and where each one takes the camera (and its mood)
export const SCROLL_PATH = [
    { section: '.hero', pose: 'home', mood: null },
    { section: '.latest-news', pose: 'news', mood: 'news' },
    { section: '.overview', pose: 'engineering', mood: 'engineering' },
    { section: '.featured-programs', pose: 'vehicles', mood: 'vehicles' },
    { section: '.quick-achievements', pose: 'missions', mood: 'missions' },
    { section: '.cta-section', pose: 'about', mood: 'about' },
];

export const MOODS = ['news', 'about', 'achievements', 'vehicles', 'missions', 'gallery', 'engineering', 'games'];

// Menu items and the mood their hover gives the universe
export const NAV_MOODS = {
    'news.html': 'news',
    'about.html': 'about',
    'goals-achievements.html': 'achievements',
    'vehicles-programs.html': 'vehicles',
    'missions-archive.html': 'missions',
    'gallery.html': 'gallery',
    'autoland.html': 'engineering',
    'flight-dynamics.html': 'engineering',
    'games.html': 'games',
};

// Where WSA has flown, from Kerbin: drawn as transfer routes in the missions mood (mission archive
// destinations: the Mun, Minmus, Duna and, by accident, Jool)
export const ROUTES = ['mun', 'minmus', 'duna', 'jool'];

// Camera nudges a hover gives: a fraction of the distance to the target (+ pulls back)
export const MOOD_DOLLY = { about: 0.22, vehicles: -0.07, missions: 0.05 };
