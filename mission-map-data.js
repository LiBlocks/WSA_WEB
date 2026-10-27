/*
 * WSA Mission Map records (mission-map.html). The map's 3D engine (mission-map/) draws whatever is listed
 * here, so adding or correcting a mission never requires touching the engine.
 *
 * RULES
 *  - Only record what is documented. Leave a field out when it is unknown; never fill a gap with a guess.
 *  - Every event says where it comes from: `basis` 'site' (a page of this website, named by `source`) or
 *    'operator' (history supplied directly by the WSA operator and not yet written up on the site).
 *  - No route on this map is a measured trajectory. Legs are drawn as schematic curves between the
 *    recorded places; the replay is a mission sequence, not real elapsed time.
 *  - Planned or intended routes go in `planned`, never in `route`. A mission that did not land must not
 *    have a surface place in its route.
 *  - Dates: none are recorded yet. When one is, add `date: '…'` to the event exactly as documented.
 *
 * MISSION FIELDS
 *   id, name, status (a key of WSA.STATUSES), summary                             required
 *   aliases     other names search should find
 *   program     program or family, as the site names it ('Not recorded' when unknown)
 *   vehicles    ids from WSA.VEHICLES (adds Hangar links);  craft  names of craft not in the Hangar
 *   outcome     one short line: the known end state
 *   locations   ids of bodies or regions (see mission-map/bodies.js) the mission can be found from
 *   route       { start, legs: [{ to, via }] } the actual known route, or leave out when none is recorded
 *               places:  'kerbin/surface', 'kerbin/air', 'kerbin/low', 'mun/high', 'duna/near',
 *                        'jool/1.85' (orbit at 1.85 body radii), 'kgoss', 'solar:kerbin>duna@0.55'
 *                        (a point in solar orbit, 55% of the way along a Kerbin–Duna transfer);
 *                        add '@120' for an angle on the body or '@+180' for one relative to the last place
 *               via:     'flyby' swings round the body (a gravity assist)
 *               basis:   'documented' draws the leg solid; leave it out (schematic, dashed) unless the
 *                        trajectory itself is recorded
 *               endOrbit true draws the orbit the mission is left in (schematic) round the last place
 *   planned     [{ from, legs, label }] intended routes; `from` is the index of a place in `route`
 *               (0 = start), or `start` when the mission has no actual route
 *   events      [{ at, title, text, basis, source, kind, focus, noMarker }] in order
 *               at        position in the route: 0 = start, 1 = end of the first leg, 1.5 = halfway along
 *                         the second leg
 *               kind      'planned' (an intention, not something that happened) or 'decision'
 *               focus     body ids to highlight when the event has no single place
 *               noMarker  true when where it happened is not recorded (no marker is drawn)
 *   replayNote  what in the replay is schematic
 *   notes       other documented details;  conflicts  disagreements or open questions in the record
 *   links       [{ label, href }] pages on this site
 */
window.WSA_MISSION_MAP = {
    SOURCES: {
        'archive':  { label: 'Missions & Project Archive', href: 'missions-archive.html' },
        'kgoss':    { label: 'KGOSS Station page', href: 'kgoss.html' },
        'vehicles': { label: 'Vehicles & Programs page', href: 'vehicles-programs.html' },
        'hangar':   { label: 'Vehicle Hangar', href: 'vehicles-programs.html#hangar' },
        'timeline': { label: 'Development Timeline', href: 'goals-achievements.html#timeline' },
        'autoland': { label: 'AutoLand Engineering', href: 'autoland.html' },
        'gallery':  { label: 'Flight Gallery', href: 'gallery.html' },
        'operator': { label: 'WSA operator\'s history' }
    },

    MISSIONS: [
        {
            id: 'kgoss-1',
            name: 'KGOSS-1 construction',
            aliases: ['KGOSS', 'KGOSS-1', 'station assembly'],
            program: 'KGOSS',
            vehicles: ['kgoss-1', 'kgoss-centrifuge', 'kgoss-cabins', 'seraph-spc-1'],
            status: 'in-service',
            outcome: 'Assembled and in service in low Kerbin orbit',
            summary: 'WSA\'s orbital station, assembled in Kerbin orbit from separately launched modules. It works at about 200 km, with about 250 km considered.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'kgoss' }] },
            events: [
                { at: 0, title: 'Modules launched one at a time', basis: 'site', source: 'kgoss',
                  text: 'KGOSS was not launched as a complete vehicle. Each station module was launched separately.' },
                { at: 1, title: 'Rendezvous in Kerbin orbit', basis: 'site', source: 'kgoss',
                  text: 'Each module had to be launched into a compatible orbit and maneuvered to rendezvous with the growing station.' },
                { at: 2, title: 'Docked and assembled on orbit', basis: 'site', source: 'kgoss',
                  text: 'Modules were docked and integrated on orbit, in a working orbit of about 200 km.' },
                { at: 2, title: 'Current configuration', basis: 'site', source: 'kgoss',
                  text: 'A centrifuge module of about 43 t, three attached cabins, and the Seraph SPC-1 "Haven" rescue and return craft docked.' },
                { at: 2, kind: 'planned', title: 'Planned: fuel tank expansion', basis: 'site', source: 'kgoss',
                  text: 'Two matching fuel tanks of about 84 t each are designed but not yet launched.' }
            ],
            replayNote: 'Shows one representative module flight. How many flights there were, and the order in which the modules arrived, are not recorded.',
            links: [{ label: 'KGOSS Station', href: 'kgoss.html' }]
        },
        {
            id: 'seraph-haven',
            name: 'Seraph SPC-1 "Haven"',
            aliases: ['Seraph', 'Haven', 'SPC-1', 'Seraph missions', 'rescue capsule'],
            program: 'KGOSS',
            vehicles: ['seraph-spc-1'],
            status: 'in-service',
            outcome: 'Docked at KGOSS-1',
            summary: 'A Dragon-like rescue and return craft, docked at KGOSS-1 to give crews in orbit a way home.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kgoss', legs: [] },
            events: [
                { at: 0, title: 'Docked at KGOSS-1', basis: 'site', source: 'kgoss',
                  text: 'Serves as the station\'s crewed return and rescue vehicle, giving crews in orbit emergency return capability.' }
            ],
            replayNote: 'Only its current position is recorded.',
            notes: ['No individual Seraph flights are documented on the site yet.'],
            links: [{ label: 'KGOSS Station', href: 'kgoss.html' }]
        },
        {
            id: 'aegis-tests',
            name: 'Aegis flight and recovery tests',
            aliases: ['Aegis', 'booster recovery', 'AutoLand', 'Quartet', 'Quintet', 'Nonet'],
            program: 'Aegis',
            vehicles: ['aegis'],
            status: 'flown',
            outcome: 'More than 47 successful booster recoveries',
            summary: 'Aegis boosters fly and come back to land under WSA\'s own AutoLand guidance. The record counts more than 47 successful recoveries, on land and in water.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/apex' }, { to: 'kerbin/surface@+45' }] },
            events: [
                { at: 0, title: 'Launch', basis: 'site', source: 'gallery',
                  text: 'The Flight Gallery has Aegis on the launch pad at dawn and climbing at night.' },
                { at: 1, title: 'Booster in space', basis: 'site', source: 'gallery',
                  text: 'Flight Gallery photo of an Aegis stage in space above the horizon.' },
                { at: 1.6, title: 'AutoLand descent', basis: 'site', source: 'vehicles',
                  text: 'AutoLand works out whether the booster can reach a vertical descent with the thrust available, and smooths the throttle on the way down.' },
                { at: 2, title: 'Landing and recovery', basis: 'site', source: 'vehicles',
                  text: 'More than 47 successful recoveries across varied landing sites, including water landings. Boosters have sometimes tipped over after touchdown.' }
            ],
            replayNote: 'A representative flight profile built from the program record, not one particular flight.',
            notes: [
                'AutoLand V1.6 demonstrated automated landings, including water landings.',
                'AutoLand B1 failed badly in testing; the exact cause is not documented.',
                'AutoLand V2.x test landings came down roughly 700 m and around 1.9 km from the target (test observations, not specifications).'
            ],
            links: [{ label: 'Aegis program', href: 'vehicles-programs.html#aegis' }, { label: 'AutoLand Engineering', href: 'autoland.html' },
                    { label: 'Aegis photos', href: 'gallery.html?album=aegis' }]
        },
        {
            id: 'silver-bridge',
            name: 'Project Silver Bridge',
            aliases: ['Silver Bridge', 'ISRU', 'Mun drilling'],
            program: 'Project Silver Bridge',
            vehicles: ['silver-bridge'],
            status: 'flown',
            outcome: 'Returned to Munar orbit; could not dock with KGOSS',
            summary: 'A one-off Mun mission: undock in low Munar orbit, drill and run ISRU experiments on the surface, return to orbit and redock. A docking-port size mismatch then stopped the planned docking with KGOSS.',
            locations: ['kerbin', 'lko', 'kgoss', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }] },
            planned: [{ from: 5, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS' }],
            events: [
                { at: 2, title: 'Low Munar orbit', basis: 'site', source: 'timeline',
                  text: 'Reached low Munar orbit and undocked the lander.' },
                { at: 3, title: 'Surface operations', basis: 'site', source: 'archive',
                  text: 'Drilling and ISRU-related experiments on the Mun.' },
                { at: 4, title: 'Back in orbit and redocked', basis: 'site', source: 'archive',
                  text: 'The lander returned to Munar orbit and redocked. The archive says the docking-port mismatch was discovered at this point.' },
                { at: 5, title: 'Could not dock with KGOSS', basis: 'site', source: 'archive',
                  text: 'Its docking port did not match the size of KGOSS\'s ports, so the planned docking was impossible and the vehicle was nearly stranded in low Kerbin orbit.' },
                { at: 5, title: 'Recovery', basis: 'site', source: 'archive',
                  text: 'The Missions archive records that a rescue mission recovered the vehicle and crew from Kerbin orbit.' }
            ],
            replayNote: 'The order of events is documented; the legs between them are schematic.',
            notes: [
                'Also supported an experimental relay. When and where is not recorded, so it is not placed on the route.',
                'Lesson recorded on the site: compatible docking hardware, return options and rescue planning are essential.'
            ],
            conflicts: ['Recovery: the Missions archive says a rescue mission recovered the vehicle and crew; the Hangar and Development Timeline say only that the near-stranding "required recovery planning".'],
            links: [{ label: 'Silver Bridge record', href: 'missions-archive.html#silver-bridge' }]
        },
        {
            id: 'fammok-1',
            name: 'FAMMOK-1',
            aliases: ['FAMMOK', 'Mun lander'],
            program: 'FAMMOK',
            vehicles: ['fammok-1'],
            status: 'record-incomplete',
            outcome: 'Landed on the Mun and returned (summary only)',
            summary: 'The Mun-capable lander baseline of the FAMMOK program. The archive credits it with showing that WSA could land on the Mun and return; the detailed record is incomplete.',
            locations: ['kerbin', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }] },
            events: [
                { at: 3, title: 'Mun landing', basis: 'site', source: 'archive',
                  text: 'The archive states that FAMMOK-1 established that WSA could successfully land on the Mun.' },
                { at: 5, title: 'Return from the Mun', basis: 'site', source: 'archive',
                  text: 'It returned from the Mun. How it came home, the landing site, the vehicle details and the dates are not recorded.' }
            ],
            replayNote: 'Every leg is schematic: only the summary "land on and return from the Mun" is recorded.',
            links: [{ label: 'FAMMOK mission records', href: 'missions-archive.html#fammok' }]
        },
        {
            id: 'fammok-2',
            name: 'FAMMOK-2',
            aliases: ['FAMMOK', 'Duna lander', 'parachute'],
            program: 'FAMMOK',
            vehicles: ['fammok-2'],
            status: 'flown',
            outcome: 'Reached the Duna surface after a parachute problem',
            summary: 'A lander campaign connected with Minmus and Mun operations and the step up to Duna. It reached Duna orbit; during the landing a parachute problem occurred, but the lander survived surface contact.',
            locations: ['kerbin', 'minmus', 'mun', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/high' }, { to: 'duna/surface' }] },
            events: [
                { at: 0, title: 'Minmus and Mun operations', basis: 'site', source: 'timeline', focus: ['minmus', 'mun'], noMarker: true,
                  text: 'The campaign is connected with Minmus and Mun operations. Their routes and order are not recorded, so they are not drawn.' },
                { at: 2, title: 'Duna orbit', basis: 'site', source: 'archive',
                  text: 'Orbital insertion around Duna, with apoapsis about 440 km and periapsis about 260 km. The long-range transfer proved viable.' },
                { at: 2.5, title: 'Parachute problem', basis: 'site', source: 'archive',
                  text: 'The landing began with parachute deployment, and the parachute malfunctioned or under-performed during the descent.' },
                { at: 3, title: 'Surface contact', basis: 'site', source: 'archive',
                  text: 'The lander reached the surface with about 2,300 m/s recorded as remaining, and survived the contact.' }
            ],
            replayNote: 'Duna orbit, entry and surface contact are documented; launch and transfer are schematic.',
            notes: ['Campaign figures (approximate, and possibly from different vehicles or phases): about 6,000 m/s before the injection burn, about 3,690 m/s lander capability, about 3,100 m/s in the Duna-orbit phase.'],
            conflicts: [
                'The 2,300 m/s figure: the Hangar and the archive\'s performance list give it as m/s remaining; the archive\'s event list calls it the residual velocity at surface contact.',
                'The operator\'s history says a FAMMOK vehicle became stranded in Duna orbit. The site does not say whether that was part of FAMMOK-2.'
            ],
            links: [{ label: 'FAMMOK mission records', href: 'missions-archive.html#fammok' }]
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3',
            aliases: ['FAMMOK', 'rescue', 'Aegis-1 Super Heavy'],
            program: 'FAMMOK',
            vehicles: ['fammok-3', 'aegis-1-super-heavy'],
            status: 'planned',
            outcome: 'Not flown yet',
            summary: 'A planned rescue and deep-space mission on the Aegis-1 Super Heavy, with improved parachutes and a full return vehicle, building on earlier FAMMOK experience.',
            locations: ['kerbin', 'duna'],
            planned: [{ start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/low' }], label: 'Planned route (not flown)' }],
            events: [
                { at: 0, kind: 'planned', title: 'Launch on Aegis-1 Super Heavy', basis: 'site', source: 'archive',
                  text: 'Intended to use the Aegis-1 Super Heavy heavy-lift configuration.' },
                { at: 2, kind: 'planned', title: 'Rescue and Duna operations', basis: 'site', source: 'archive',
                  text: 'Designed to support rescue of stranded vehicles or crew from earlier missions, with more ambitious surface operations and longer orbital phases than FAMMOK-2.' }
            ],
            replayNote: 'Planned only. The route is an intention, drawn schematically.',
            conflicts: ['Destination: the Hangar lists Duna; the Missions archive says the destination is still to be decided.'],
            links: [{ label: 'FAMMOK mission records', href: 'missions-archive.html#fammok' }]
        },
        {
            id: 'fammok-duna-stranding',
            name: 'FAMMOK vehicle stranded at Duna',
            aliases: ['FAMMOK Duna operations', 'first Duna attempt', 'stranded'],
            program: 'FAMMOK',
            craft: ['FAMMOK vehicle (which one is not recorded)'],
            status: 'flown',
            outcome: 'Stranded in Duna orbit',
            summary: 'A FAMMOK vehicle reached Duna orbit and became stranded there. The operator counts it as the first of four attempts to reach Duna; two rescue attempts and Odysseus followed.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/low' }], endOrbit: true },
            events: [
                { at: 2, title: 'Stranded in Duna orbit', basis: 'operator', source: 'operator',
                  text: 'The FAMMOK vehicle became stranded in orbit around Duna.' }
            ],
            replayNote: 'Launch and transfer are schematic; only the stranding in Duna orbit is recorded.',
            conflicts: ['Which FAMMOK vehicle this was is not recorded. It may belong to the FAMMOK-2 campaign, whose lander reached the Duna surface, but the site does not connect the two.'],
            links: [{ label: 'FAMMOK mission records', href: 'missions-archive.html#fammok' }]
        },
        {
            id: 'duna-rescue-solar',
            name: 'Duna rescue craft (stranded in solar orbit)',
            aliases: ['rescue', 'Duna rescue attempt'],
            program: 'Not recorded',
            craft: ['Rescue craft (name not recorded)'],
            status: 'flown',
            outcome: 'Stranded in solar orbit',
            summary: 'One of the two rescue attempts after the FAMMOK stranding at Duna. It never reached Duna and was left stranded in orbit around Kerbol.',
            locations: ['kerbin', 'solar', 'duna'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'solar:kerbin>duna@0.55' }], endOrbit: true },
            planned: [{ from: 1, legs: [{ to: 'duna/low' }], label: 'Intended: reach Duna' }],
            events: [
                { at: 2, title: 'Stranded in solar orbit', basis: 'operator', source: 'operator',
                  text: 'The rescue craft became stranded in solar orbit. Its name and what went wrong are not recorded.' }
            ],
            replayNote: 'Where it was stranded is not recorded; the end point is placed between Kerbin and Duna for illustration only.',
            conflicts: ['The operator\'s history does not say which of the two rescue craft flew first.'],
            links: []
        },
        {
            id: 'duna-rescue-crash',
            name: 'Duna rescue craft (crashed into Duna)',
            aliases: ['rescue', 'Duna rescue attempt', 'crash'],
            program: 'Not recorded',
            craft: ['Rescue craft (name not recorded)'],
            status: 'flown',
            outcome: 'Crashed into Duna',
            summary: 'One of the two rescue attempts after the FAMMOK stranding at Duna. It reached Duna but crashed into the planet.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/near' }, { to: 'duna/surface' }] },
            events: [
                { at: 3, title: 'Crashed into Duna', basis: 'operator', source: 'operator',
                  text: 'The rescue craft crashed into Duna. Its name and the cause are not recorded.' }
            ],
            replayNote: 'Every leg is schematic; only the crash at Duna is recorded.',
            conflicts: ['The operator\'s history does not say which of the two rescue craft flew first.'],
            links: []
        },
        {
            id: 'odysseus',
            name: 'Odysseus',
            aliases: ['Duna', 'gravity assist', 'fourth Duna attempt'],
            program: 'Not recorded',
            craft: ['Odysseus'],
            status: 'flown',
            outcome: 'Returned to Kerbin without landing on Duna',
            summary: 'The fourth attempt to reach Duna. Odysseus got there, but with too little fuel for a safe landing it did not try to land. It used a Duna gravity assist to head home to Kerbin instead.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/near' }, { to: 'duna/near@+180', via: 'flyby' }, { to: 'kerbin/near' }] },
            planned: [{ from: 2, legs: [{ to: 'duna/surface' }], label: 'Intended landing (not attempted)' }],
            events: [
                { at: 0, title: 'Fourth attempt to reach Duna', basis: 'operator', source: 'operator',
                  text: 'Odysseus followed the stranded FAMMOK vehicle and the two failed rescue attempts.' },
                { at: 2, title: 'Arrived at Duna', basis: 'operator', source: 'operator',
                  text: 'Odysseus reached Duna.' },
                { at: 2, kind: 'decision', title: 'Landing not attempted', basis: 'operator', source: 'operator',
                  text: 'The fuel left was not enough to make a landing acceptably safe, so the landing was deliberately not attempted.' },
                { at: 3, title: 'Duna gravity assist', basis: 'operator', source: 'operator',
                  text: 'Odysseus used a gravity assist at Duna to depart and head back to Kerbin.' },
                { at: 4, title: 'Returned to Kerbin', basis: 'operator', source: 'operator',
                  text: 'Odysseus returned to Kerbin.' }
            ],
            replayNote: 'Transfers and the flyby are schematic. Whether Odysseus entered Duna orbit before leaving is not recorded.',
            notes: ['The Flight Gallery has an "Odysseus Test" photo of a test flight high above the planet. How that test relates to the Duna mission is not recorded.'],
            links: [{ label: 'Odysseus test photo', href: 'gallery.html?album=odysseus' }]
        },
        {
            id: 'jool-satellite',
            name: 'Unintended Jool satellite',
            aliases: ['Duna satellite', 'Vall', 'Laythe', 'gravity assist'],
            program: 'Not recorded',
            craft: ['Satellite (name not recorded)'],
            status: 'flown',
            outcome: 'In Jool orbit; contact with Kerbin lost',
            summary: 'A satellite meant for Duna orbit. An accidental gravity assist sent it to Vall instead. It later tried to reach Laythe, lost contact with Kerbin during the capture burn, and is known to be in Jool orbit.',
            locations: ['kerbin', 'duna', 'solar', 'jool', 'vall', 'laythe'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'vall/near' }, { to: 'laythe/near' }, { to: 'jool/1.85' }], endOrbit: true },
            planned: [
                { from: 1, legs: [{ to: 'duna/low' }], label: 'Intended: Duna orbit' },
                { from: 3, legs: [{ to: 'laythe/low' }], label: 'Intended: Laythe orbit' }
            ],
            events: [
                { at: 0, title: 'Launched for Duna orbit', basis: 'operator', source: 'operator',
                  text: 'The satellite was meant to go into orbit around Duna.' },
                { at: 1.5, title: 'Accidental gravity assist', basis: 'operator', source: 'operator', noMarker: true,
                  text: 'An unplanned gravity assist sent it toward Vall instead. Where the assist happened and the actual path are not recorded.' },
                { at: 2, title: 'At Vall', basis: 'operator', source: 'operator',
                  text: 'The satellite reached Vall.' },
                { at: 2, title: 'Transfer toward Laythe', basis: 'operator', source: 'operator',
                  text: 'It later attempted a transfer toward Laythe.' },
                { at: 3, title: 'Contact lost in the capture burn', basis: 'operator', source: 'operator',
                  text: 'During the deceleration burn meant to capture it into Laythe orbit, contact with Kerbin was lost.' },
                { at: 4, title: 'Last known state: Jool orbit', basis: 'operator', source: 'operator',
                  text: 'Its current known state is an orbit around Jool, not Laythe. The orbit itself and the satellite\'s condition are not recorded.' }
            ],
            replayNote: 'Every leg is schematic. The final Jool orbit is drawn for illustration only.',
            links: []
        },
        {
            id: 'minmus-firework',
            name: 'Minmus Firework',
            aliases: ['Minmus fireworks', 'Minmus landing', 'splashdown'],
            program: 'Not recorded',
            status: 'flown',
            outcome: 'Landed on Minmus and splashed down on Kerbin',
            summary: 'From Kerbin orbit to the surface of Minmus and back to a splashdown, as recorded in the Flight Gallery.',
            locations: ['kerbin', 'lko', 'minmus'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'minmus/low' }, { to: 'minmus/surface' }, { to: 'minmus/low' }, { to: 'kerbin/low' }, { to: 'kerbin/surface' }] },
            events: [
                { at: 1, title: 'In Kerbin orbit', basis: 'site', source: 'gallery', text: 'Photo of the spacecraft in Kerbin orbit with the planet behind it.' },
                { at: 3, title: 'On the surface of Minmus', basis: 'site', source: 'gallery', text: 'Photo of the lander on Minmus with a kerbal nearby.' },
                { at: 5.6, title: 'Reentry', basis: 'site', source: 'gallery', text: 'Photos of the spacecraft glowing during reentry high above the coastline.' },
                { at: 5.9, title: 'Landing burn', basis: 'site', source: 'gallery', text: 'Photo of the spacecraft firing its engine above the ocean.' },
                { at: 6, title: 'Splashdown', basis: 'site', source: 'gallery', text: 'Photo of the capsule floating in the ocean.' }
            ],
            replayNote: 'Milestones come from the Flight Gallery photos; the legs between them are schematic.',
            links: [{ label: 'Minmus Firework photos', href: 'gallery.html?album=minmus-firework' }]
        },
        {
            id: 'astra-telescope',
            name: 'Astra telescope',
            aliases: ['Astra', 'telescope'],
            program: 'Not recorded',
            status: 'record-incomplete',
            outcome: 'Launched; destination not recorded',
            summary: 'The launch of the Astra telescope, recorded in the Flight Gallery. Its orbit and what happened next are not recorded.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/high' }] },
            events: [
                { at: 0, title: 'Launch', basis: 'site', source: 'gallery',
                  text: 'Photo of the rocket carrying the Astra telescope, against the edge of the planet and the sun.' },
                { at: 1, title: 'Record ends', basis: 'site', source: 'gallery',
                  text: 'Its target orbit, deployment and current state are not recorded.' }
            ],
            replayNote: 'The ascent is schematic, and the record ends after launch.',
            conflicts: ['"Astra" is also the name of the largest Lyra tier. Whether the telescope is connected to Lyra Astra is not recorded.'],
            links: [{ label: 'Astra launch photo', href: 'gallery.html?album=astra-telescope' }]
        },
        {
            id: 'mk2-ssto',
            name: 'Mk2 SSTO orbital flight',
            aliases: ['SSTO', 'spaceplane', 'NERV', 'single-stage-to-orbit'],
            program: 'Aircraft & spaceplanes',
            vehicles: ['mk2-ssto'],
            status: 'experimental',
            outcome: 'Reached about 200 km orbit; could not dock with KGOSS',
            summary: 'A Mk2-based single-stage-to-orbit spaceplane reached about 200 km orbit with NERV engines, but could not dock with KGOSS.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }] },
            planned: [{ from: 1, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS' }],
            events: [
                { at: 0, title: 'Earlier design: out of fuel near 25 km', basis: 'site', source: 'hangar',
                  text: 'An earlier version of the design ran out of liquid fuel near 25 km.' },
                { at: 1, title: 'About 200 km orbit', basis: 'site', source: 'hangar',
                  text: 'The later configuration reached about 200 km with NERV engines.' },
                { at: 1, title: 'No docking with KGOSS', basis: 'site', source: 'hangar',
                  text: 'It could not dock with KGOSS because it lacked RCS capability. Reaching orbit is not the same as completing the mission.' }
            ],
            replayNote: 'The climb to orbit is schematic.',
            conflicts: ['RCS: the Hangar says it "lacked RCS capability"; the Vehicles & Programs page lists about 800 units of monopropellant for RCS and says it lacked enough RCS propellant for docking.'],
            links: [{ label: 'Aircraft & SSTO program', href: 'vehicles-programs.html#aircraft' }]
        },
        {
            id: 'fsx-3',
            name: 'FSX-3 flight',
            aliases: ['FSX-3', 'Mach 5', 'aircraft'],
            program: 'Aircraft & spaceplanes',
            craft: ['FSX-3'],
            status: 'flown',
            outcome: 'Reached Mach 5',
            summary: 'An aircraft flight recorded in the Flight Gallery: on the runway, climbing, and at Mach 5.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/air' }] },
            events: [
                { at: 0, title: 'On the runway', basis: 'site', source: 'gallery', text: 'Photo of FSX-3 on the runway at sunset.' },
                { at: 0.6, title: 'Climbing', basis: 'site', source: 'gallery', text: 'Photo of FSX-3 climbing high above a coastline with its engines lit.' },
                { at: 1, title: 'Mach 5', basis: 'site', source: 'gallery', text: 'Photo of FSX-3 surrounded by heating effects at Mach 5.' }
            ],
            replayNote: 'The flight path is schematic; altitude and distance are not recorded.',
            notes: ['FSX-3 is not in the Vehicle Hangar, which lists FX and FAX designations. Whether FSX-3 belongs to either is not recorded.'],
            links: [{ label: 'FSX-3 photos', href: 'gallery.html?album=fsx-3' }]
        },
        {
            id: 'manta-ray',
            name: 'Manta Ray at sunrise',
            aliases: ['Manta Ray', 'Starfield', 'spaceplane'],
            program: 'Aircraft & spaceplanes',
            vehicles: ['manta-ray'],
            status: 'flown',
            outcome: 'Photographed above the planet',
            summary: 'Two Flight Gallery photos of the Manta Ray spaceplane above the planet as the sun rises.',
            locations: ['kerbin'],
            events: [
                { at: 0, title: 'Above the planet at sunrise', basis: 'site', source: 'gallery', focus: ['kerbin'], noMarker: true,
                  text: 'The photos show the spaceplane above the planet with the sun at the horizon. Altitude and route are not recorded.' }
            ],
            replayNote: 'No route is recorded.',
            conflicts: ['The photos do not name the planet; Kerbin is assumed.'],
            links: [{ label: 'Manta Ray photos', href: 'gallery.html?album=manta-ray' }]
        }
    ],

    /* Named by the operator or on the site, but with no mission record yet, so not placed on the map */
    AWAITING: [
        { name: 'LunaLink', note: 'Named in the operator\'s list of missions. There is no record of it on the site yet.' },
        { name: 'Project Kepler', note: 'Named in the operator\'s list of missions. There is no record of it on the site yet.' },
        { name: 'Blue Whale missions', vehicle: 'blue-whale',
          note: 'The Blue Whale / Atlas line is documented as a crew transport and return craft (up to six engineers, about 6,600 m/s before RCS), but no individual flights are recorded.' }
    ]
};
