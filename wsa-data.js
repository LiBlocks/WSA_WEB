/*
 * WSA site content for the Vehicle Hangar, Development Timeline, Flight Gallery and site search.
 * features.js renders everything from this file, so adding content never requires touching the UI.
 *
 * HOW TO ADD CONTENT
 *  - Vehicle:   copy an entry in VEHICLES, give it a unique `id`, and fill in only what is documented.
 *               Leave fields out when unknown; the site hides empty fields instead of guessing.
 *  - Milestone: add an entry to MILESTONES. `stage` must be an id from STAGES.
 *  - Image:     put the file in images/gallery/ and add an entry to GALLERY (example at the bottom).
 *
 * Every `status` must be a key of STATUSES. Links (`page`, `href`) are relative to the site root.
 */
window.WSA = {
    // tone = badge colour: operational (green), experimental (amber), development (blue),
    // planned (grey), failed (red), undocumented (grey, dashed)
    STATUSES: {
        'in-service':        { label: 'In service',        tone: 'operational',  description: 'Built and currently in use, such as the KGOSS-1 station and its attached modules.' },
        'completed':         { label: 'Completed',         tone: 'operational',  description: 'Achievement demonstrated and verified.' },
        'flown':             { label: 'Flown',             tone: 'operational',  description: 'The mission or flight took place. Its record may include documented problems.' },
        'demonstrated':      { label: 'Demonstrated',      tone: 'operational',  description: 'Proof of concept achieved. It works, but may need further refinement.' },
        'experimental':      { label: 'Experimental',      tone: 'experimental', description: 'Under active testing. Results may be inconsistent or limited.' },
        'in-development':    { label: 'In development',    tone: 'development',  description: 'Active engineering work that is not yet flight-proven.' },
        'planned':           { label: 'Planned',           tone: 'planned',      description: 'A defined future effort. Scope and details are not final.' },
        'concept':           { label: 'Concept',           tone: 'planned',      description: 'A possible direction that has been considered but not committed to.' },
        'failed':            { label: 'Failed test',       tone: 'failed',       description: 'A test or build that did not work, recorded so its lessons are not lost.' },
        'record-incomplete': { label: 'Record incomplete', tone: 'undocumented', description: 'Known to exist, but the detailed record still needs to be documented.' },
        'undocumented':      { label: 'Undocumented',      tone: 'undocumented', description: 'Named in WSA records, with no details documented yet.' }
    },

    VEHICLE_CATEGORIES: {
        'launch-vehicles': 'Launch vehicles',
        'aircraft':        'Aircraft & spaceplanes',
        'landers':         'Landers & mission craft',
        'station':         'Station & spacecraft'
    },

    /*
     * Vehicle fields:
     *   id, name, category, status            required
     *   designation   short code shown on the card graphic (defaults to the name)
     *   program, role, summary
     *   aliases       extra names that search should find
     *   specs         [label, value] pairs - documented values only
     *   note          caveat shown under the specs
     *   image         optional photo path (e.g. 'images/vehicles/aegis.png'); a schematic is shown otherwise
     *   page          main project page link
     *   links         [{ label, href }] related missions or pages
     *   related       ids of related vehicles
     */
    VEHICLES: [
        {
            id: 'aegis',
            name: 'Aegis',
            designation: 'AEGIS',
            category: 'launch-vehicles',
            program: 'Aegis',
            role: 'Reusable booster family',
            status: 'in-development',
            summary: 'WSA\'s reusable booster family, closely tied to the goal of recovering boosters and eventually supporting more ambitious missions. The family has gone through many experimental configurations.',
            aliases: ['Quartet', 'Quintet', 'Nonet', 'Heavy', 'Super Heavy', 'Max', 'Mark II', 'Mark V'],
            specs: [
                ['Configurations', 'Quartet, Quintet, Nonet, Heavy, Super Heavy, Max (included or considered)'],
                ['Recovery directions', 'Mark II side-booster recovery (planned); Mark V main-booster recovery (possible)']
            ],
            page: 'vehicles-programs.html#aegis',
            links: [{ label: 'Photos in the Flight Gallery', href: 'gallery.html?album=aegis' }, { label: 'AutoLand Engineering', href: 'autoland.html' }],
            related: ['aegis-1-super-heavy', 'lyra']
        },
        {
            id: 'aegis-1-super-heavy',
            name: 'Aegis-1 Super Heavy',
            designation: 'AEGIS-1 SH',
            category: 'launch-vehicles',
            program: 'Aegis',
            role: 'Heavy configuration for FAMMOK-3',
            status: 'planned',
            summary: 'The Aegis-1 Super Heavy configuration is part of the planned FAMMOK-3 mission architecture.',
            specs: [['Mission', 'FAMMOK-3 (planned)']],
            page: 'vehicles-programs.html#aegis',
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            related: ['aegis', 'fammok-3']
        },
        {
            id: 'lyra',
            name: 'Lyra',
            designation: 'LYRA',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Next-generation recoverable booster family',
            status: 'in-development',
            summary: 'A newer, more powerful and more cleanly designed recoverable-booster family. It is intended to support future KGOSS construction, higher-capacity missions and more ambitious payloads, and represents a new direction alongside Aegis.',
            specs: [
                ['Tiers', 'Selene (smaller), Sol (middle), Astra (largest)'],
                ['Current prototype', 'Lyra P-1E'],
                ['Engine concepts', 'Up to 21 Vector engines on the main stage, plus side-stage engines; one arrangement reaches 39 engines overall']
            ],
            note: 'Engine counts are design concepts, not final specifications.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra-p1e', 'lyra-selene', 'lyra-sol', 'lyra-astra', 'aegis', 'kgoss-1']
        },
        {
            id: 'lyra-p1e',
            name: 'Lyra P-1E',
            designation: 'P-1E',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Prototype 1 Experimental',
            status: 'experimental',
            summary: 'The current experimental prototype of the Lyra family. The designation stands for Prototype 1 Experimental.',
            aliases: ['Prototype 1 Experimental'],
            page: 'vehicles-programs.html#lyra',
            related: ['lyra']
        },
        {
            id: 'lyra-selene',
            name: 'Lyra Selene',
            designation: 'SELENE',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Smaller capability tier',
            status: 'planned',
            summary: 'The smallest tier in the Lyra family naming system.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-sol', 'lyra-astra']
        },
        {
            id: 'lyra-sol',
            name: 'Lyra Sol',
            designation: 'SOL',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Middle capability tier',
            status: 'planned',
            summary: 'The middle tier in the Lyra family naming system.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-astra']
        },
        {
            id: 'lyra-astra',
            name: 'Lyra Astra',
            designation: 'ASTRA',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Largest capability tier',
            status: 'planned',
            summary: 'The largest tier in the Lyra family naming system.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-sol']
        },
        {
            id: 'blue-whale',
            name: 'Blue Whale / Atlas',
            designation: 'BWP-1LC',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Crew transport and return to Kerbin',
            status: 'experimental',
            summary: 'The Blue Whale BWP-1LC / Blue Whale 1 / Atlas naming line is associated with crew transport and return to Kerbin.',
            aliases: ['Blue Whale', 'Blue Whale 1', 'BWP-1LC', 'Atlas'],
            specs: [
                ['Crew (one configuration)', '6 engineers'],
                ['Delta-v (one configuration)', '≈ 6,600 m/s before RCS']
            ],
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'manta-ray',
            name: 'Manta Ray / Starfield',
            designation: 'MANTA RAY',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Aircraft / spaceplane development line',
            status: 'undocumented',
            summary: 'Another named aircraft or spaceplane development line. Details have not been documented yet.',
            aliases: ['Manta Ray', 'Starfield'],
            links: [{ label: 'Photos in the Flight Gallery', href: 'gallery.html?album=manta-ray' }],
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'swift-1x',
            name: 'Swift-1X',
            designation: 'SWIFT-1X',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Small test aircraft',
            status: 'experimental',
            summary: 'A stable, fast, small aircraft used for testing aircraft concepts. It can serve as a crewed or uncrewed test platform.',
            specs: [['Crew', 'Crewed or uncrewed']],
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'mk2-ssto',
            name: 'Mk2 SSTO',
            designation: 'SSTO',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Single-stage-to-orbit spaceplane experiment',
            status: 'experimental',
            summary: 'A single-stage-to-orbit design built around a Mk2 spaceplane configuration. A later version reached orbit with NERV engines but could not dock with KGOSS because it lacked RCS capability: reaching orbit is not the same as completing the mission.',
            aliases: ['Single-stage-to-orbit', 'Spaceplane'],
            specs: [
                ['Mass (expanded)', '≈ 80 t'],
                ['Engines (expanded)', '4'],
                ['Intakes', '2 shock cone, 4 radial'],
                ['Crew modules', '4'],
                ['Monopropellant', '≈ 800 units'],
                ['Orbital propulsion', 'NERV (later configuration)'],
                ['Best documented result', '≈ 200 km orbit; could not dock with KGOSS (no RCS)'],
                ['Earlier design', 'Ran out of liquid fuel near 25 km']
            ],
            page: 'vehicles-programs.html#aircraft',
            related: ['kgoss-1']
        },
        {
            id: 'fx-series',
            name: 'FX-1 / FX-2 / FX-3',
            designation: 'FX',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Aircraft designations',
            status: 'undocumented',
            summary: 'Named aircraft designations that have not been documented yet.',
            aliases: ['FX-1', 'FX-2', 'FX-3'],
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'fax-series',
            name: 'FAX series',
            designation: 'FAX',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Aircraft designations',
            status: 'undocumented',
            summary: 'Designations FAX-1, FAX-2, FAX-3, FAX-3E, FAX-3C and FAX-3S. Not documented yet.',
            aliases: ['FAX-1', 'FAX-2', 'FAX-3', 'FAX-3E', 'FAX-3C', 'FAX-3S'],
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'srx-1',
            name: 'SRX-1',
            designation: 'SRX-1',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Aircraft designation',
            status: 'undocumented',
            summary: 'A named designation that has not been documented yet.',
            page: 'vehicles-programs.html#aircraft'
        },
        {
            id: 'fammok-1',
            name: 'FAMMOK-1',
            designation: 'FAMMOK-1',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Mun-focused lander baseline',
            status: 'record-incomplete',
            summary: 'The foundational Mun-focused lander capability of the FAMMOK program. The detailed mission record is incomplete and will be expanded when verified.',
            specs: [['Destination', 'Mun']],
            page: 'missions-archive.html#fammok',
            related: ['fammok-2', 'fammok-3']
        },
        {
            id: 'fammok-2',
            name: 'FAMMOK-2',
            designation: 'FAMMOK-2',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Minmus, Mun and Duna lander campaign',
            status: 'flown',
            summary: 'A more ambitious step in the lander program, connected with Minmus and Mun operations and the progression toward Duna missions. The Duna landing was affected by a parachute issue.',
            specs: [
                ['Recorded pre-burn figure', '≈ 6,000 m/s'],
                ['Lander capability', '≈ 3,690 m/s'],
                ['Duna orbit', 'Apoapsis ≈ 440 km, periapsis ≈ 260 km'],
                ['Duna-orbit phase figure', '≈ 3,100 m/s'],
                ['Duna landing', 'Parachute issue; reached the surface with ≈ 2,300 m/s remaining']
            ],
            note: 'Approximate figures from the campaign record. They may refer to different configurations or flight phases.',
            page: 'missions-archive.html#fammok',
            related: ['fammok-1', 'fammok-3']
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3',
            designation: 'FAMMOK-3',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Rescue and Duna operations concept',
            status: 'planned',
            summary: 'A future mission concept associated with rescue capability and more ambitious Duna operations, building on earlier FAMMOK experience.',
            specs: [
                ['Launch architecture', 'Aegis-1 Super Heavy'],
                ['Destination', 'Duna']
            ],
            page: 'missions-archive.html#fammok',
            related: ['aegis-1-super-heavy', 'fammok-2']
        },
        {
            id: 'silver-bridge',
            name: 'Silver Bridge',
            designation: 'SILVER BRIDGE',
            category: 'landers',
            program: 'Project Silver Bridge',
            role: 'One-off Mun surface and ISRU mission',
            status: 'flown',
            summary: 'An experimental, one-off mission and launcher concept outside the numbered launcher families.',
            aliases: ['Project Silver Bridge'],
            specs: [
                ['Destination', 'Mun'],
                ['Planned profile', 'Undock in low Munar orbit, surface drilling and ISRU operations, return to orbit and redock'],
                ['Also supported', 'An experimental relay'],
                ['Outcome', 'A docking-port size mismatch prevented the planned return to KGOSS; a near-stranding in low Kerbin orbit required recovery planning']
            ],
            page: 'missions-archive.html#silver-bridge',
            related: ['kgoss-1']
        },
        {
            id: 'kgoss-1',
            name: 'KGOSS-1',
            designation: 'KGOSS-1',
            category: 'station',
            program: 'KGOSS',
            role: 'Orbital station and assembly hub',
            status: 'in-service',
            summary: 'WSA\'s orbital station and assembly hub, supporting orbital assembly, docking operations, crew and vehicle logistics, and future expansion.',
            specs: [
                ['Working orbit', '≈ 200 km (≈ 250 km considered)'],
                ['Docked craft', 'Seraph SPC-1 "Haven"'],
                ['Modules', 'Centrifuge (≈ 43 t), three attached cabins']
            ],
            page: 'kgoss.html',
            related: ['seraph-spc-1', 'kgoss-centrifuge', 'kgoss-cabins', 'kgoss-fuel-tanks']
        },
        {
            id: 'seraph-spc-1',
            name: 'Seraph SPC-1 "Haven"',
            designation: 'SPC-1',
            category: 'station',
            program: 'KGOSS',
            role: 'Rescue and return craft',
            status: 'in-service',
            summary: 'A Dragon-like rescue and return craft, docked at KGOSS-1.',
            aliases: ['Haven', 'Seraph'],
            specs: [['Location', 'Docked at KGOSS-1']],
            page: 'kgoss.html',
            related: ['kgoss-1']
        },
        {
            id: 'kgoss-centrifuge',
            name: 'KGOSS Centrifuge Module',
            designation: 'CENTRIFUGE',
            category: 'station',
            program: 'KGOSS',
            role: 'Station module',
            status: 'in-service',
            summary: 'A centrifuge module attached to KGOSS-1.',
            specs: [['Mass', '≈ 43 t']],
            page: 'kgoss.html',
            related: ['kgoss-1']
        },
        {
            id: 'kgoss-cabins',
            name: 'KGOSS Cabins',
            designation: 'CABINS',
            category: 'station',
            program: 'KGOSS',
            role: 'Attached cabins',
            status: 'in-service',
            summary: 'Three cabins attached to KGOSS-1.',
            specs: [['Count', '3']],
            page: 'kgoss.html',
            related: ['kgoss-1']
        },
        {
            id: 'kgoss-fuel-tanks',
            name: 'KGOSS Fuel Tanks',
            designation: 'FUEL TANKS',
            category: 'station',
            program: 'KGOSS',
            role: 'Planned propellant storage',
            status: 'planned',
            summary: 'A planned fuel tank for KGOSS-1, with a second matching tank for a more symmetrical layout.',
            specs: [
                ['Planned tank', '≈ 84 t'],
                ['Second tank', 'Matching tank, also planned']
            ],
            page: 'kgoss.html',
            related: ['kgoss-1']
        }
    ],

    /* Timeline stages, in display order. Stage names are development stages, not dates. */
    STAGES: [
        { id: 'foundations',     title: 'Booster Recovery Foundations' },
        { id: 'landing-control', title: 'Experimental Landing Control' },
        { id: 'infrastructure',  title: 'Orbital Infrastructure' },
        { id: 'exploration',     title: 'Planetary Exploration' },
        { id: 'guidance',        title: 'Guidance & Spaceplane Experiments' },
        { id: 'next-gen',        title: 'Next-Generation Development' }
    ],

    /*
     * Milestone fields: id, stage, title, program, status, description   required
     *   lesson    what the milestone showed or taught (optional)
     *   href      project page link;  linkLabel  text for that link
     *   vehicle   id of a related vehicle in VEHICLES (adds a "View in Hangar" link)
     * Version numbers (V1.6, A1-A4, V2.0) are software designations, not dates.
     */
    MILESTONES: [
        {
            id: 'aegis-early', stage: 'foundations', program: 'Aegis', status: 'experimental',
            title: 'Early Aegis Reusable-Booster Experiments',
            description: 'Aegis began with reusable-booster experiments, including returning boosters from atmospheric descent and developing autonomous landing and throttle control.',
            href: 'vehicles-programs.html#aegis', linkLabel: 'Aegis program', vehicle: 'aegis'
        },
        {
            id: 'autoland-v16', stage: 'foundations', program: 'AutoLand', status: 'demonstrated',
            title: 'AutoLand V1.6 Baseline',
            description: 'The last stable baseline before the experimental A/B builds. It demonstrated automated landings, including water landings.',
            lesson: 'The booster could tip over after touchdown.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-b1', stage: 'landing-control', program: 'AutoLand', status: 'failed',
            title: 'AutoLand B1',
            description: 'An experimental build that failed badly in testing.',
            lesson: 'The exact root cause has not been documented.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-a-series', stage: 'landing-control', program: 'AutoLand', status: 'experimental',
            title: 'AutoLand A1–A4',
            description: 'Experimental iterations that progressively improved throttle smoothing and semi-autonomous over-land landing capability.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-v20', stage: 'landing-control', program: 'AutoLand', status: 'planned',
            title: 'AutoLand V2.0 Designation',
            description: 'V2.0 is the intended stable version designation once A4 is officially confirmed.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'kgoss-assembly', stage: 'infrastructure', program: 'KGOSS', status: 'in-service',
            title: 'KGOSS-1 Station Assembly',
            description: 'WSA\'s orbital station and assembly hub, in a working orbit of about 200 km, with a docked Seraph SPC-1 "Haven", a roughly 43-tonne centrifuge module and three attached cabins.',
            lesson: 'Building a station takes more than launching large modules: rendezvous, docking-port compatibility, approach control, fuel logistics and recovery planning all matter.',
            href: 'kgoss.html', linkLabel: 'KGOSS Station', vehicle: 'kgoss-1'
        },
        {
            id: 'kgoss-fuel', stage: 'infrastructure', program: 'KGOSS', status: 'planned',
            title: 'KGOSS Fuel Tank Expansion',
            description: 'A roughly 84-tonne fuel tank, with a second matching tank for a more symmetrical station layout.',
            href: 'kgoss.html', linkLabel: 'KGOSS Station', vehicle: 'kgoss-fuel-tanks'
        },
        {
            id: 'kgoss-3', stage: 'infrastructure', program: 'KGOSS', status: 'planned',
            title: 'KGOSS-3 Deorbit-Safety Research',
            description: 'A future research direction on deorbit safety.',
            href: 'kgoss.html#kgoss-3', linkLabel: 'KGOSS-3 research'
        },
        {
            id: 'fammok-1', stage: 'exploration', program: 'FAMMOK', status: 'record-incomplete',
            title: 'FAMMOK-1 Mun Lander Baseline',
            description: 'Established the foundational Mun-focused lander capability of the FAMMOK program.',
            lesson: 'The detailed mission record is incomplete and will be expanded when verified.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-1'
        },
        {
            id: 'fammok-2', stage: 'exploration', program: 'FAMMOK', status: 'flown',
            title: 'FAMMOK-2 Minmus, Mun & Duna Campaign',
            description: 'A more ambitious lander campaign connected with Minmus and Mun operations and the progression toward Duna. The record includes a Duna orbit of roughly 440 × 260 km.',
            lesson: 'The Duna landing was affected by a parachute issue; the lander reached the surface with roughly 2,300 m/s remaining.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-2'
        },
        {
            id: 'silver-bridge', stage: 'exploration', program: 'Silver Bridge', status: 'flown',
            title: 'Project Silver Bridge',
            description: 'A one-off Mun mission: undock from low Munar orbit, drill and run ISRU operations on the surface, return to orbit and redock, and support an experimental relay.',
            lesson: 'A docking-port size mismatch prevented the planned return to KGOSS, and a near-stranding in low Kerbin orbit required recovery planning. Compatible docking hardware and rescue options matter.',
            href: 'missions-archive.html#silver-bridge', linkLabel: 'Silver Bridge record', vehicle: 'silver-bridge'
        },
        {
            id: 'autoland-v2x', stage: 'guidance', program: 'AutoLand', status: 'in-development',
            title: 'AutoLand V2.x Guidance',
            description: 'Development of predictive targeting, empirical drag modelling, entry-burn logic, glide and powered-glide guidance, and a redesigned landing burn.',
            lesson: 'Test landings came down roughly 700 m and around 1.9 km from the target, and rough touchdowns could damage engines. These are test observations, not performance specifications.',
            href: 'autoland.html#glide', linkLabel: 'Glide & landing guidance'
        },
        {
            id: 'ssto-orbit', stage: 'guidance', program: 'Aircraft', status: 'experimental',
            title: 'Mk2 SSTO Reaches Orbit',
            description: 'A Mk2-based single-stage-to-orbit design reached roughly 200 km orbit with NERV engines, after an earlier design ran out of liquid fuel near 25 km.',
            lesson: 'It could not dock with KGOSS because it lacked RCS capability. Reaching orbit is not the same as completing the mission.',
            href: 'vehicles-programs.html#aircraft', linkLabel: 'Aircraft & SSTO program', vehicle: 'mk2-ssto'
        },
        {
            id: 'lyra-p1e', stage: 'next-gen', program: 'Lyra', status: 'experimental',
            title: 'Lyra P-1E Prototype',
            description: 'Prototype 1 Experimental, the current Lyra development vehicle. Lyra designs have explored multi-engine layouts of up to 21 Vector engines on the main stage.',
            href: 'vehicles-programs.html#lyra', linkLabel: 'Lyra program', vehicle: 'lyra-p1e'
        },
        {
            id: 'lyra-tiers', stage: 'next-gen', program: 'Lyra', status: 'planned',
            title: 'Lyra Selene, Sol & Astra Tiers',
            description: 'Three capability tiers, from the smaller Selene through Sol to the largest Astra, intended to support KGOSS construction and higher-capacity missions.',
            href: 'vehicles-programs.html#lyra', linkLabel: 'Lyra program', vehicle: 'lyra'
        },
        {
            id: 'aegis-mark-ii', stage: 'next-gen', program: 'Aegis', status: 'planned',
            title: 'Aegis Mark II Side-Booster Recovery',
            description: 'A planned direction for recovering side boosters.',
            href: 'vehicles-programs.html#aegis', linkLabel: 'Aegis program', vehicle: 'aegis'
        },
        {
            id: 'aegis-mark-v', stage: 'next-gen', program: 'Aegis', status: 'concept',
            title: 'Aegis Mark V Main-Booster Recovery',
            description: 'A possible direction involving recovery of the main booster.',
            href: 'vehicles-programs.html#aegis', linkLabel: 'Aegis program', vehicle: 'aegis'
        },
        {
            id: 'fammok-3', stage: 'next-gen', program: 'FAMMOK', status: 'planned',
            title: 'FAMMOK-3 Rescue & Duna Operations',
            description: 'A mission concept for rescue capability and more ambitious Duna operations, using the Aegis-1 Super Heavy architecture and building on earlier FAMMOK experience.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-3'
        }
    ],

    GALLERY_CATEGORIES: {
        vehicles: 'Vehicles',
        launches: 'Launches',
        landings: 'Landings',
        stations: 'Stations',
        missions: 'Missions',
        insignia: 'Patches & insignia'
    },

    /*
     * Flight Gallery, one album per mission. Real WSA screenshots and official patches belong here.
     * Each album shows as one card; selecting it opens the album with arrows to step through its photos.
     *
     * Album fields
     *   id          unique, lowercase; gallery.html?album=<id> opens it directly        required
     *   title       mission name shown on the card                                       required
     *   summary     optional one-line description
     *   categories  one or more keys of GALLERY_CATEGORIES (used by the filters)         required
     *   patch       optional mission patch shown on the card and in the album header
     *   related     optional { label, href } link to the project page
     *   fit         optional; 'contain' shows whole images instead of cropping them
     *               (use it for patches and logos)
     *   images      list of photos, in mission order; the first one is the cover        required
     *
     * Photo fields
     *   src         full-size image path                                                 required
     *   thumb       optional smaller copy for the card and thumbnail strip (src otherwise)
     *   alt         short description of what the image shows                            required
     *   caption     text shown under the large view
     *   related     optional link for this photo only (overrides the album's)
     *
     * To add a photo, copy a line inside an album's `images` list and change the paths and text.
     * To add a mission, copy a whole album block and give it a new id.
     */
    GALLERY: [
        {
            id: 'aegis',
            title: 'Aegis',
            summary: 'Reusable booster family',
            categories: ['launches', 'vehicles'],
            patch: 'images/gallery/aegis-patch.png',
            related: { label: 'Aegis program', href: 'vehicles-programs.html#aegis' },
            images: [
                { src: 'images/gallery/missions/aegis-dawn-launchpad.jpg', thumb: 'images/gallery/missions/thumbs/aegis-dawn-launchpad.jpg',
                  alt: 'Aegis rocket standing on the launch pad at dawn', caption: 'On the launch pad at dawn' },
                { src: 'images/gallery/missions/aegis-night-closeup.jpg', thumb: 'images/gallery/missions/thumbs/aegis-night-closeup.jpg',
                  alt: 'Aegis rocket climbing at night with its engines lit, close-up', caption: 'Night ascent, close-up' },
                { src: 'images/gallery/missions/aegis-night-far.jpg', thumb: 'images/gallery/missions/thumbs/aegis-night-far.jpg',
                  alt: 'Aegis rocket climbing at night, seen from a distance', caption: 'Night ascent, wide view' },
                { src: 'images/gallery/missions/aegis-in-space.jpg', thumb: 'images/gallery/missions/thumbs/aegis-in-space.jpg',
                  alt: 'Aegis stage in space above the blue horizon of the planet', caption: 'In space' }
            ]
        },
        {
            id: 'minmus-firework',
            title: 'Minmus Firework',
            summary: 'From Kerbin orbit to the surface of Minmus and back to splashdown',
            categories: ['missions', 'landings'],
            images: [
                { src: 'images/gallery/missions/minmus-firework-kerbin-orbit.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-kerbin-orbit.jpg',
                  alt: 'Spacecraft in Kerbin orbit with the planet behind it', caption: 'In Kerbin orbit' },
                { src: 'images/gallery/missions/minmus-firework-on-surface.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-on-surface.jpg',
                  alt: 'Lander standing on the surface of Minmus with a kerbal nearby', caption: 'On the surface of Minmus' },
                { src: 'images/gallery/missions/minmus-firework-reentry-far.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-reentry-far.jpg',
                  alt: 'Spacecraft glowing during reentry high above the coastline', caption: 'Reentry, wide view' },
                { src: 'images/gallery/missions/minmus-firework-reentry-closeup.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-reentry-closeup.jpg',
                  alt: 'Close view of the spacecraft surrounded by reentry plasma', caption: 'Reentry, close-up' },
                { src: 'images/gallery/missions/minmus-firework-landing-burn.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-landing-burn.jpg',
                  alt: 'Spacecraft firing its engine above the ocean', caption: 'Landing burn' },
                { src: 'images/gallery/missions/minmus-firework-splashdown.jpg', thumb: 'images/gallery/missions/thumbs/minmus-firework-splashdown.jpg',
                  alt: 'Capsule floating in the ocean after splashdown', caption: 'Splashdown' }
            ]
        },
        {
            id: 'fsx-3',
            title: 'FSX-3',
            summary: 'On the runway, climbing, and at Mach 5',
            categories: ['vehicles'],
            related: { label: 'Aircraft & spaceplanes', href: 'vehicles-programs.html#aircraft' },
            images: [
                { src: 'images/gallery/missions/fsx-3-on-runway.jpg', thumb: 'images/gallery/missions/thumbs/fsx-3-on-runway.jpg',
                  alt: 'FSX-3 aircraft on the runway at sunset', caption: 'On the runway' },
                { src: 'images/gallery/missions/fsx-3-climb.jpg', thumb: 'images/gallery/missions/thumbs/fsx-3-climb.jpg',
                  alt: 'FSX-3 climbing high above a coastline with its engines lit', caption: 'Climbing' },
                { src: 'images/gallery/missions/fsx-3-mach-5.jpg', thumb: 'images/gallery/missions/thumbs/fsx-3-mach-5.jpg',
                  alt: 'FSX-3 surrounded by heating effects at Mach 5', caption: 'At Mach 5' }
            ]
        },
        {
            id: 'manta-ray',
            title: 'Manta Ray',
            summary: 'Sunrise over the planet',
            categories: ['vehicles'],
            related: { label: 'Manta Ray in the Hangar', href: 'vehicles-programs.html?vehicle=manta-ray#hangar' },
            images: [
                { src: 'images/gallery/missions/manta-ray-sunrise-1.jpg', thumb: 'images/gallery/missions/thumbs/manta-ray-sunrise-1.jpg',
                  alt: 'Manta Ray spaceplane above the planet with the sun over the horizon', caption: 'Sunrise' },
                { src: 'images/gallery/missions/manta-ray-sunrise-2.jpg', thumb: 'images/gallery/missions/thumbs/manta-ray-sunrise-2.jpg',
                  alt: 'Manta Ray spaceplane above the planet as the sun rises at the horizon', caption: 'Sunrise at the horizon' }
            ]
        },
        {
            id: 'astra-telescope',
            title: 'Astra Telescope Launch',
            categories: ['launches'],
            images: [
                { src: 'images/gallery/missions/astra-telescope-launch.jpg', thumb: 'images/gallery/missions/thumbs/astra-telescope-launch.jpg',
                  alt: 'Rocket carrying the Astra telescope, seen against the edge of the planet and the sun', caption: 'Astra telescope launch' }
            ]
        },
        {
            id: 'odysseus',
            title: 'Odysseus Test',
            categories: ['launches'],
            images: [
                { src: 'images/gallery/missions/odysseus-test.jpg', thumb: 'images/gallery/missions/thumbs/odysseus-test.jpg',
                  alt: 'Odysseus in flight high above the planet surface', caption: 'Odysseus test flight' }
            ]
        },
        {
            id: 'insignia',
            title: 'Patches & insignia',
            summary: 'Mission patches and the agency insignia',
            categories: ['insignia'],
            fit: 'contain',
            images: [
                { src: 'images/gallery/silver-bridge-patch.png', alt: 'Project Silver Bridge mission patch',
                  caption: 'Project Silver Bridge mission patch',
                  related: { label: 'Project Silver Bridge', href: 'missions-archive.html#silver-bridge' } },
                { src: 'images/gallery/aegis-patch.png', alt: 'Aegis program patch',
                  caption: 'Aegis program patch',
                  related: { label: 'Aegis program', href: 'vehicles-programs.html#aegis' } },
                { src: 'images/wsa-logo.png', alt: 'Woody Space Agency insignia',
                  caption: 'Woody Space Agency insignia',
                  related: { label: 'About WSA', href: 'about.html' } }
            ]
        }
    ],

    /* Pages and programs that site search can jump to (vehicles are added automatically). */
    SEARCH_PAGES: [
        { title: 'Vehicle Hangar',               href: 'vehicles-programs.html#hangar',      type: 'Registry', keywords: 'vehicles registry' },
        { title: 'Development Timeline',         href: 'goals-achievements.html#timeline',   type: 'Timeline', keywords: 'milestones history progress' },
        { title: 'Flight Gallery',               href: 'gallery.html',                       type: 'Gallery',  keywords: 'images screenshots photos' },
        { title: 'AutoLand Engineering',         href: 'autoland.html',                      type: 'Program',  keywords: 'kOS landing guidance V1.6 A1 A4 B1 V2.0 V2.x glide' },
        { title: 'KGOSS Station',                href: 'kgoss.html',                         type: 'Program',  keywords: 'station KGOSS-1 KGOSS-3 Haven Seraph centrifuge orbit' },
        { title: 'Games',                        href: 'games.html',                         type: 'Page',     keywords: 'game games play minigame builder simulator' },
        { title: 'Station Builder',              href: 'game.html',                          type: 'Game',     keywords: 'game minigame build station modules docking KGOSS solar truss' },
        { title: 'Docking Simulator',            href: 'docking-simulator.html',             type: 'Game',     keywords: 'game simulator docking dock spacecraft rendezvous approach RCS first person' },
        { title: 'FAMMOK Program',               href: 'missions-archive.html#fammok',       type: 'Program',  keywords: 'Mun Minmus Duna lander' },
        { title: 'Project Silver Bridge',        href: 'missions-archive.html#silver-bridge', type: 'Mission', keywords: 'Mun ISRU drilling docking relay' },
        { title: 'Aegis Program',                href: 'vehicles-programs.html#aegis',       type: 'Program',  keywords: 'booster recovery Mark II Mark V' },
        { title: 'Lyra Program',                 href: 'vehicles-programs.html#lyra',        type: 'Program',  keywords: 'booster Selene Sol Astra P-1E' },
        { title: 'Aircraft & Spaceplane Program', href: 'vehicles-programs.html#aircraft',   type: 'Program',  keywords: 'SSTO Swift-1X spaceplane' },
        { title: 'Mission Map',                  href: 'mission-map.html',                   type: 'Map',      keywords: 'map 3D solar system Kerbol planets moons OPM outer planets replay timeline route Duna Jool Mun Minmus Odysseus' },
        { title: 'Missions & Project Archive',   href: 'missions-archive.html',              type: 'Page',     keywords: 'missions archive records' },
        { title: 'Goals & Achievements',         href: 'goals-achievements.html',            type: 'Page',     keywords: 'objectives status' },
        { title: 'About WSA',                    href: 'about.html',                         type: 'Page',     keywords: 'philosophy agency' },
        { title: 'Support WSA',                  href: 'support.html',                       type: 'Page',     keywords: 'donate donation bitcoin ethereum' }
    ]
};
