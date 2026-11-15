/*
 * WSA site content: the one source for the Vehicle Hangar, Development Timeline, mission records (the
 * Missions archive and the Mission Map), Flight Gallery and site search. features.js and the Mission Map
 * render everything from this file, so adding content never requires touching the UI.
 *
 * HOW TO ADD CONTENT
 *  - Vehicle:   copy an entry in VEHICLES, give it a unique `id`, and fill in only what is documented.
 *               Leave fields out when unknown; the site hides empty fields instead of guessing.
 *  - Milestone: add an entry to MILESTONES. `stage` must be an id from STAGES.
 *  - Mission:   add an entry to MISSIONS (rules and fields are described above that list).
 *  - Image:     put the file in images/gallery/ and add an entry to GALLERY (example at the bottom).
 *
 * Every `status` must be a key of STATUSES. Links (`page`, `href`) are relative to the site root.
 */
window.WSA = {
    // tone = badge colour: operational (green), experimental (amber), development (blue),
    // planned (grey), failed (red), undocumented (grey, dashed)
    STATUSES: {
        'in-service':        { label: 'In service',        tone: 'operational',  description: 'Built and currently in use, such as the KGOSS-1 station and its attached modules.' },
        'completed':         { label: 'Completed',         tone: 'operational',  description: 'The mission reached its goal and the record confirms it.' },
        'flown':             { label: 'Flown',             tone: 'operational',  description: 'The mission or flight took place. Its record may include documented problems.' },
        'demonstrated':      { label: 'Demonstrated',      tone: 'operational',  description: 'Proof of concept achieved. It works, but may need further refinement.' },
        'partial':           { label: 'Partially successful', tone: 'experimental', description: 'Some goals were reached and others were not.' },
        'stranded':          { label: 'Stranded',          tone: 'experimental', description: 'The vehicle is intact but cannot get home or reach its goal on its own; a rescue or recovery is needed.' },
        'experimental':      { label: 'Experimental',      tone: 'experimental', description: 'Under active testing. Results may be inconsistent or limited.' },
        'in-development':    { label: 'In development',    tone: 'development',  description: 'Active engineering work that is not yet flight-proven.' },
        'planned':           { label: 'Planned',           tone: 'planned',      description: 'A defined future effort. Scope and details are not final.' },
        'concept':           { label: 'Concept',           tone: 'planned',      description: 'A possible direction that has been considered but not committed to.' },
        'failed':            { label: 'Failed',            tone: 'failed',       description: 'A test, build or mission that did not work, recorded so its lessons are not lost.' },
        'lost':              { label: 'Lost',              tone: 'failed',       description: 'The vehicle was destroyed or contact with it was lost.' },
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
     *   evidence, verify   INTERNAL ONLY, never shown on the site: where a fact comes from (save files,
     *                      craft files) and what still needs the operator's confirmation
     *
     * "Current save" means the WSA Sandbox save in WSA's KSP 1.12.5 installation, read without changing it.
     */
    VEHICLES: [
        {
            id: 'aegis',
            name: 'Aegis',
            designation: 'AEGIS',
            category: 'launch-vehicles',
            program: 'Aegis',
            role: 'Reusable booster family',
            status: 'experimental',
            summary: 'WSA\'s reusable booster family and the launcher behind many WSA missions, from the Minmus Firework flight to Odysseus, Project Kepler and FAMMOK-3. Landing and recovering the boosters is still experimental, guided by WSA\'s own AutoLand software.',
            aliases: ['Quartet', 'Quintet', 'Nonet', 'Heavy', 'Super Heavy', 'Max', 'Mark II', 'Mark V', 'Aegis Mk1.3'],
            specs: [
                ['Configurations', 'Quartet, Quintet, Nonet, Heavy, Super Heavy, Max'],
                ['Versions named in flight records', 'Aegis Mk1.3, Aegis-1.1 SH, Aegis Super Heavy-1 (AegisSH-1)'],
                ['Recovery', 'Experimental: Super Heavy recovery test flights continue'],
                ['Recovery directions', 'Mark II side-booster recovery (planned); Mark V main-booster recovery (possible); a booster catch system (early concept)']
            ],
            note: 'Configuration names only: engine counts and performance figures are not documented.',
            page: 'vehicles-programs.html#aegis',
            links: [{ label: 'Photos in the Flight Gallery', href: 'gallery.html?album=aegis' }, { label: 'AutoLand Engineering', href: 'autoland.html' }],
            related: ['aegis-1-super-heavy', 'lyra'],
            evidence: ['Vessel names in the saves: "WSA Minmus Fireworks + Aegis mk1.3", "OYR-1P \\"Odysseus\\" + Aegis-1.1 SH", "Project Kepler + AegisSH-1", "FAMMOK-3 DRSE AegisSH-1", "KGOSS-1 ISRU + AegisSH-1", "Aegis Mk1.6 Crew-2", "KGOSS1-MD Aegis1.1SH to Aegis1.7SH Recovery" test flights']
        },
        {
            id: 'aegis-1-super-heavy',
            name: 'Aegis-1 Super Heavy',
            designation: 'AEGIS-1 SH',
            category: 'launch-vehicles',
            program: 'Aegis',
            role: 'Heavy-lift configuration',
            status: 'flown',
            summary: 'The heavy-lift Aegis configuration. Flight records show it launching FAMMOK-3, Project Kepler and a KGOSS-1 ISRU module, and an Aegis-1.1 Super Heavy launching Odysseus.',
            aliases: ['AegisSH-1', 'Aegis Super Heavy-1', 'Aegis-1.1 SH', 'Aegis SH'],
            specs: [
                ['Launched (flight records)', 'FAMMOK-3, Project Kepler, KGOSS-1 ISRU module'],
                ['Aegis-1.1 SH', 'Launched Odysseus']
            ],
            page: 'vehicles-programs.html#aegis',
            links: [{ label: 'Mission records', href: 'missions-archive.html#missions' }],
            related: ['aegis', 'fammok-3', 'project-kepler', 'odysseus'],
            evidence: ['Vessel names in the saves (see aegis)']
        },
        {
            id: 'lyra',
            name: 'Lyra',
            designation: 'LYRA',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Next-generation reusable booster family',
            status: 'in-development',
            summary: 'A newer, larger and more powerful reusable booster family, intended for future high-capacity missions and KGOSS construction. No Lyra flight is recorded yet.',
            specs: [
                ['Tiers', 'Selene, Sol, Astra'],
                ['Current prototype', 'Lyra P-1E (Prototype 1 Experimental)'],
                ['Engine concept', '21 main Vector engines, plus up to 9 more on each side depending on the configuration']
            ],
            note: 'Concept-level figures, not final production specifications.',
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
            status: 'in-development',
            summary: 'The first Lyra prototype. The designation stands for Prototype 1 Experimental. A design exists; no flight is recorded.',
            aliases: ['Prototype 1 Experimental'],
            page: 'vehicles-programs.html#lyra',
            related: ['lyra'],
            evidence: ['Craft file "Lyra P-1E" in the current save\'s VAB']
        },
        {
            id: 'lyra-selene',
            name: 'Lyra Selene',
            designation: 'SELENE',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Lyra tier',
            status: 'planned',
            summary: 'One of the three tiers in the Lyra family naming system.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-sol', 'lyra-astra']
        },
        {
            id: 'lyra-sol',
            name: 'Lyra Sol',
            designation: 'SOL',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Lyra tier',
            status: 'planned',
            summary: 'One of the three tiers in the Lyra family naming system.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-astra']
        },
        {
            id: 'lyra-astra',
            name: 'Lyra Astra',
            designation: 'ASTRA',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Lyra tier',
            status: 'planned',
            summary: 'One of the three tiers in the Lyra family naming system. Not to be confused with the Astra-1 space telescope.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-sol'],
            verify: ['Earlier site text called Selene the smallest tier and Astra the largest; that ordering is not in the current notes. Confirm it.']
        },
        {
            id: 'blue-whale',
            name: 'Blue Whale 1 / BWP-1LC',
            designation: 'BWP-1LC',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Atlas-related crew return craft',
            status: 'experimental',
            summary: 'A special crew return craft in the Atlas line, associated with rare pickup and recovery operations on Kerbin. No individual flights are documented yet.',
            aliases: ['Blue Whale', 'Blue Whale 1', 'BWP-1LC', 'Atlas', 'Atlas A'],
            specs: [
                ['Crew (one configuration)', '6 engineers'],
                ['Delta-v (one configuration)', '≈ 6,600 m/s before RCS']
            ],
            page: 'vehicles-programs.html#aircraft',
            evidence: ['Craft files "Blue Whale 1 (Atlas A)" and "BWP prototype" in the current save\'s SPH; no Blue Whale vessel in any save']
        },
        {
            id: 'manta-ray',
            name: 'Manta Ray / Starfield',
            designation: 'MRR-1XLR',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Spaceplane',
            status: 'record-incomplete',
            summary: 'Designated MRR-1XLR and associated with the name Starfield. Flight Gallery photos show it above the planet at sunrise; its role and flights still need documenting.',
            aliases: ['Manta Ray', 'Starfield', 'MRR-1XLR'],
            links: [{ label: 'Photos in the Flight Gallery', href: 'gallery.html?album=manta-ray' }],
            page: 'vehicles-programs.html#aircraft',
            evidence: ['No Manta Ray craft file or vessel found in the saves']
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
            aliases: ['XAS Swift 1X', 'Swift'],
            specs: [['Crew', 'Crewed or uncrewed']],
            page: 'vehicles-programs.html#aircraft',
            evidence: ['Craft files "XAS (Swift) 1X", "Swift EXS1/2/4" and "Swift Bomber-1" in the current save\'s SPH']
        },
        {
            id: 'mk2-ssto',
            name: 'Mk2 SSTO',
            designation: 'SSTO',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Single-stage-to-orbit spaceplane experiment',
            status: 'experimental',
            summary: 'A single-stage-to-orbit design built around a Mk2 spaceplane configuration. A later version reached KGOSS\'s orbit with NERV engines but did not dock: reaching orbit is not the same as completing the mission.',
            aliases: ['Single-stage-to-orbit', 'Spaceplane', 'Station docking test'],
            specs: [
                ['Mass (expanded)', '≈ 80 t'],
                ['Engines (expanded)', '4'],
                ['Docking-test version', '4 RAPIER and 2 NERV engines'],
                ['Intakes', '2 shock cone, 4 radial'],
                ['Crew modules', '4'],
                ['Monopropellant', '≈ 800 units'],
                ['Best documented result', '≈ 200 km orbit near KGOSS; no docking'],
                ['Earlier design', 'Ran out of liquid fuel near 25 km']
            ],
            page: 'vehicles-programs.html#aircraft',
            related: ['kgoss-1'],
            evidence: ['Saves "ssto rdvz2 kgoss1", "sstoexp kgoss1 dock1", "sstokgoss1 exp b4 deorbit": vessel "[CYAC] Station docking test" (Mk2 parts, 4 RAPIER, 2 NERV) at 200 × 205 km; its docking port never docked and KGOSS-1\'s docking records are unchanged'],
            verify: ['Why it did not dock: the Hangar said "no RCS capability", the Vehicles page "not enough RCS propellant". Which is right?']
        },
        {
            id: 'fx-series',
            name: 'FX series',
            designation: 'FX',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'Aircraft designations',
            status: 'undocumented',
            summary: 'Aircraft designs FX-1 to FX-4. None is documented yet.',
            aliases: ['FX-1', 'FX-2', 'FX-3', 'FX-4'],
            page: 'vehicles-programs.html#aircraft',
            evidence: ['Craft files "WSA FX-1", "WSA FX-2", "FX-3", "WSA FX-4"']
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
            page: 'vehicles-programs.html#aircraft',
            evidence: ['Craft files FAX-1, FAX-2, FAX-3, FAX-3C, FAX-3E; no FAX-3S craft file found']
        },
        {
            id: 'fsx-series',
            name: 'FSX series',
            designation: 'FSX',
            category: 'aircraft',
            program: 'Aircraft & spaceplanes',
            role: 'High-speed aircraft',
            status: 'flown',
            summary: 'Aircraft designs FSX-1P, FSX-2, FSX-2S and FSX-3. The Flight Gallery shows FSX-3 on the runway, climbing and at Mach 5.',
            aliases: ['FSX-1P', 'FSX-2', 'FSX-2S', 'FSX-3'],
            links: [{ label: 'FSX-3 photos', href: 'gallery.html?album=fsx-3' }],
            page: 'vehicles-programs.html#aircraft',
            evidence: ['Craft files FSX-1P, FSX-2, FSX-2S, FSX-3; Flight Gallery album fsx-3']
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
            role: 'Mun lander',
            status: 'flown',
            summary: 'The first FAMMOK lander. It made WSA\'s first landing on the Mun.',
            aliases: ['Fammok Mk1'],
            specs: [['Destination', 'Mun'], ['Crew', '1'], ['Milestone', 'WSA\'s first Mun landing']],
            page: 'missions-archive.html#fammok',
            related: ['fammok-2', 'fammok-3'],
            evidence: ['[NEW]MODDEDWSASANDBOX save (an earlier, differently modded environment): vessel "Fammok mk1" (1 crew) in saves "fam kerb orb1", "fammk1 evabug", "fammk1 esc kerb", "fammk1 land1"; flag "First landing!" on the Mun, plaque "WSA\'s first ladning on Mum with the Fammoh Mk1 spacecraft"; that save\'s progress records a return from the Mun\'s surface, without naming the craft']
        },
        {
            id: 'fammok-2',
            name: 'FAMMOK-2',
            designation: 'FAMMOK-2',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Lander: Minmus, Mun and Duna',
            status: 'stranded',
            summary: 'FAMMOK-2 made WSA\'s first landings on Minmus and on Duna, and landed on the Mun. After lifting off from Duna it stayed in Duna orbit, where it is stranded with three crew.',
            specs: [
                ['Landings', 'Minmus (WSA\'s first), Mun, Duna (WSA\'s first)'],
                ['Current state', 'Duna orbit, ≈ 81 × 202 km, 3 crew (current save)'],
                ['Delta-v when stranded', '≈ 2,300 m/s (as reported)'],
                ['Earlier campaign figures', '≈ 6,000 m/s before the injection burn; ≈ 3,690 m/s lander capability; ≈ 3,100 m/s in the Duna-orbit phase']
            ],
            note: 'The campaign figures are approximate and may refer to different configurations or flight phases.',
            page: 'missions-archive.html#fammok',
            related: ['fammok-1', 'fammok-3'],
            evidence: ['Flags: "First WSA Minmus landing" (plaque "First ever landing on Minmus! Craft: Fammok 2"), "WSA second landing on Mum" (plaque "Second landing on Mum ... Craft: Fammok 2"), "First WSA landing on Duna" (plaque "Craft: WSA FAMMOK-2")', 'Current save: vessel "Fammok 2" ORBITING Duna 81 × 202 km, 3 crew, 182 LiquidFuel / 223 Oxidizer aboard'],
            verify: ['The reported ≈ 2,300 m/s does not match the propellant in the current save (182 LF / 223 Ox, a rough estimate of well under 1,000 m/s for this craft). It may describe an earlier moment. Confirm the figure.']
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3',
            designation: 'FAMMOK-3',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Duna rescue mission',
            status: 'stranded',
            summary: 'A Duna rescue mission, flown as FAMMOK-3 DRSE on an Aegis-1 Super Heavy with two crew. It never reached Duna: it is in solar orbit in the current save.',
            aliases: ['FAMMOK-3 DRSE', 'Duna Rescue'],
            specs: [
                ['Launch vehicle', 'Aegis-1 Super Heavy (AegisSH-1)'],
                ['Crew', '2'],
                ['Current state', 'Solar orbit, short of Duna (current save)']
            ],
            page: 'missions-archive.html#fammok',
            related: ['aegis-1-super-heavy', 'fammok-2'],
            evidence: ['Craft files "FAMMOK-3 Duna Rescue SE", "FAMMOK-3 DRSE AegisSH-1", "FAMMOK-3 DRSE AegisQI-1"', 'Current save: vessel "FAMMOK-3 DRSE AegisSH-1" ORBITING the Sun (about 17.0 million × 46.5 million km above Kerbol), 2 crew, with substantial propellant aboard (2,061 LF / 2,519 Ox)', 'Save "fam3 before atmpenc1" shows the same orbit'],
            verify: ['Matched to the operator\'s "rescue craft stranded in solar orbit" by its name (Duna Rescue) and its state. Confirm that FAMMOK-3 is that craft, and whether it can still reach Duna with the propellant it has.']
        },
        {
            id: 'silver-bridge',
            name: 'Silver Bridge',
            designation: 'SILVER BRIDGE',
            category: 'landers',
            program: 'Project Silver Bridge',
            role: 'One-off Mun surface and ISRU mission',
            status: 'flown',
            summary: 'A one-off Mun mission and launcher concept outside the numbered launcher families: a lander that drilled and ran ISRU experiments on the Mun.',
            aliases: ['Project Silver Bridge'],
            specs: [
                ['Destination', 'Mun'],
                ['Profile', 'Undock in low Munar orbit, surface drilling and ISRU operations, return to orbit and redock'],
                ['Also supported', 'An experimental relay'],
                ['Outcome', 'A docking-port size mismatch prevented the planned docking at KGOSS; a near-stranding in low Kerbin orbit followed']
            ],
            page: 'missions-archive.html#silver-bridge',
            related: ['kgoss-1'],
            evidence: ['Saves "pjsb orbit 1" (Mun orbit 139 × 206 km), "pjsb orb2" (59 × 64 km), "pjsb b4 depart" ("Project Silver Bridge Lander" landed on the Mun, 2 crew); flag "Project Silver Bridge Landing Site" on the Mun']
        },
        {
            id: 'odysseus',
            name: 'Odysseus (OYR-1P)',
            designation: 'OYR-1P',
            category: 'landers',
            role: 'Crewed Duna spacecraft',
            status: 'flown',
            summary: 'The crewed spacecraft of WSA\'s fourth Duna attempt, launched on an Aegis-1.1 Super Heavy with three crew.',
            aliases: ['Odysseus', 'OYR-1P', 'OYR-1P2', 'OYR'],
            specs: [['Launch vehicle', 'Aegis-1.1 Super Heavy'], ['Crew', '3']],
            page: 'missions-archive.html#odysseus',
            related: ['aegis-1-super-heavy'],
            evidence: ['Vessels "OYR-1P \\"Odysseus\\" + Aegis-1.1 SH" and "OYR-1P2 \\"Odysseus\\" + Aegis-1.1 SH" (3 crew); craft files of the same names and "Odysseus P2"'],
            verify: ['No program is recorded for Odysseus. Which program does it belong to?']
        },
        {
            id: 'project-kepler',
            name: 'Project Kepler',
            designation: 'KEPLER',
            category: 'landers',
            program: 'Project Kepler',
            role: 'Crewed asteroid rendezvous mission',
            status: 'flown',
            summary: 'A crewed asteroid mission with a grapple, drills and an ISRU unit, launched on an Aegis-1 Super Heavy.',
            specs: [['Launch vehicle', 'Aegis-1 Super Heavy (AegisSH-1)'], ['Crew', '3'], ['Equipment', 'Grappling device, drills, ISRU unit']],
            page: 'missions-archive.html#project-kepler',
            related: ['aegis-1-super-heavy'],
            evidence: ['Vessel "Project Kepler + AegisSH-1" (3 crew, GrapplingDevice, MiniDrill ×2, ISRU) in saves "pjkb4 final mvmr1", "pjk before rdzv", "pjk 1_3km", "pjk b4 redirect1", "pjk redrt and disarm 1", "pjk landing"']
        },
        {
            id: 'kgoss-1',
            name: 'KGOSS-1',
            designation: 'KGOSS-1',
            category: 'station',
            program: 'KGOSS',
            role: 'Orbital station and assembly hub',
            status: 'in-service',
            summary: 'WSA\'s orbital station and assembly hub, built in Kerbin orbit from separately launched modules.',
            specs: [
                ['Orbit', '≈ 200 × 204 km round Kerbin (current save)'],
                ['Docked', 'Seraph SPC-1 "Haven", centrifuge module (≈ 43 t), fuel module (≈ 84 t)'],
                ['Cabins', 'Three attached'],
                ['Crew aboard', '38 (current save)']
            ],
            note: 'Measured in the stock-scale Kerbol system of the current installation. Under the rescaled KSRSS Reborn system, the earlier working altitude was inside the atmosphere.',
            page: 'kgoss.html',
            related: ['seraph-spc-1', 'kgoss-centrifuge', 'kgoss-cabins', 'kgoss-fuel-tanks'],
            evidence: ['Current save: vessel "KGOSS-1" (Station) ORBITING Kerbin 200 × 204 km, 260 parts, 38 crew; docking records name "KGOSS-1 core launch 1", "Centri KGOSS-1 launch1", "KGOSS-1 Fuel Mdl Mk1" and "Seraph 1 SPC-1 \\"Haven\\""', 'Assembly saves: "kgoss core undock", "kgs hab1 inter", "kgs match", "HAb1 b4rdvb1", attempts "ab at2 1_6k" … "at3soclose" (KGOSS-1A Habitation 1), "centi b4 interc at1", "centi detah1", "centi atch", "fuelmdl1 rdzv 1", "isru1 kgosssmd det1"'],
            verify: ['A "KGOSS-1 ISRU + AegisSH-1" flight is in the saves, but no ISRU module appears in KGOSS-1\'s docking records. Was it docked?', 'Which altitude did KGOSS-1 use in the KSRSS test save, and is the stock-scale 200 km orbit now the current one?']
        },
        {
            id: 'seraph-spc-1',
            name: 'Seraph SPC-1 "Haven"',
            designation: 'SPC-1',
            category: 'station',
            program: 'KGOSS',
            role: 'Crew rescue and return capsule',
            status: 'in-service',
            summary: 'WSA\'s crew rescue and return capsule, docked at KGOSS-1 so the station\'s crew always has a way home.',
            aliases: ['Haven', 'Seraph', 'Seraph 1'],
            specs: [['Location', 'Docked at KGOSS-1 (current save)']],
            page: 'kgoss.html',
            related: ['kgoss-1'],
            evidence: ['Save "spcb4rdv1": "Seraph 1 SPC-1 \\"Haven\\"" (3 crew) before rendezvous; current save: docked at KGOSS-1', 'Save "spc-1-1 duna transferang": "Seraph SPC-1 \\"Haven\\" + Aegis1SHMD" on the launch pad with 3 crew'],
            verify: ['What was the "spc-1-1 duna transferang" Seraph launch? Was a second Seraph flown toward Duna?']
        },
        {
            id: 'kgoss-centrifuge',
            name: 'KGOSS Centrifuge Module',
            designation: 'CENTRIFUGE',
            category: 'station',
            program: 'KGOSS',
            role: 'Station module',
            status: 'in-service',
            summary: 'A centrifuge module docked to KGOSS-1.',
            specs: [['Mass', '≈ 43 t']],
            page: 'kgoss.html',
            related: ['kgoss-1'],
            evidence: ['Saves "centi b4 interc at1", "centi detah1", "centi atch"; KGOSS-1 docking record "Centri KGOSS-1 launch1"']
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
            name: 'KGOSS Fuel Modules',
            designation: 'FUEL',
            category: 'station',
            program: 'KGOSS',
            role: 'Propellant storage',
            status: 'in-service',
            summary: 'The first fuel module is docked at KGOSS-1. A second, matching tank is planned to make the layout symmetrical.',
            aliases: ['KGOSS-1 Fuel Module', 'Fuel Mdl Mk1'],
            specs: [
                ['First module', '≈ 84 t, docked'],
                ['Second tank', 'Matching tank, planned']
            ],
            page: 'kgoss.html',
            related: ['kgoss-1'],
            evidence: ['Save "fuelmdl1 rdzv 1": "KGOSS-1 Fuel Mdl Mk1" (4 crew) at rendezvous; current save: KGOSS-1 docking record "KGOSS-1 Fuel Mdl Mk1"']
        },
        {
            id: 'astra-1',
            name: 'Astra-1 Kerbin Space Telescope',
            designation: 'ASTRA-1',
            category: 'station',
            program: 'Astra telescope',
            role: 'Space telescope',
            status: 'flown',
            summary: 'WSA\'s space telescope, in a near-circular orbit about 561 km above Kerbin in the current save.',
            aliases: ['Astra telescope', 'Astra-1'],
            specs: [['Orbit', '≈ 561 × 562 km round Kerbin (current save)']],
            links: [{ label: 'Launch photo', href: 'gallery.html?album=astra-telescope' }],
            page: 'missions-archive.html#astra-telescope',
            evidence: ['Current save: vessel "Astra-1 Kerbin Space Telescope" (relay) ORBITING Kerbin 561 × 562 km; craft file of the same name']
        },
        {
            id: 'lunalink-1',
            name: 'LunaLink-1',
            designation: 'LUNALINK-1',
            category: 'station',
            program: 'LunaLink',
            role: 'Relay satellite at the Mun',
            status: 'flown',
            summary: 'A relay satellite with an ion engine, in an 80 km circular orbit round the Mun in the current save.',
            aliases: ['LunaLink'],
            specs: [['Orbit', '≈ 80 km circular round the Mun (current save)'], ['Propulsion', 'Ion engine']],
            page: 'missions-archive.html#lunalink',
            evidence: ['Current save: vessel "LunaLink-1" (relay) ORBITING the Mun 80 × 80 km, with an ion engine and xenon; craft file "LunaLink-1"']
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
            description: 'The last stable version before the experimental A/B series. It could land a booster on water.',
            lesson: 'The booster could still tip over after touchdown.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-b1', stage: 'landing-control', program: 'AutoLand', status: 'failed',
            title: 'AutoLand B1',
            description: 'An experimental build that failed in testing.',
            lesson: 'The exact root cause has not been documented.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-a-series', stage: 'landing-control', program: 'AutoLand', status: 'experimental',
            title: 'AutoLand A1–A4',
            description: 'Successive experimental builds that explored throttle smoothing and increasingly autonomous landing.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'autoland-v20', stage: 'landing-control', program: 'AutoLand', status: 'planned',
            title: 'AutoLand V2.0 Designation',
            description: 'A4 is intended to become V2.0 once it is formally accepted. Until then it remains experimental.',
            href: 'autoland.html#history', linkLabel: 'AutoLand development history'
        },
        {
            id: 'kgoss-assembly', stage: 'infrastructure', program: 'KGOSS', status: 'in-service',
            title: 'KGOSS-1 Station Assembly',
            description: 'KGOSS-1 was assembled in Kerbin orbit through several docking flights: the core, a habitation module that took more than one docking attempt, a roughly 43-tonne centrifuge and a fuel module. The Seraph SPC-1 "Haven" capsule is docked as the crew\'s way home. The station orbits at about 200 km.',
            lesson: 'Building a station takes more than launching large modules: rendezvous, docking-port compatibility, approach control, fuel logistics and recovery planning all matter.',
            href: 'kgoss.html', linkLabel: 'KGOSS Station', vehicle: 'kgoss-1'
        },
        {
            id: 'kgoss-fuel', stage: 'infrastructure', program: 'KGOSS', status: 'in-service',
            title: 'KGOSS-1 Fuel Module',
            description: 'A fuel module of about 84 tonnes is docked at KGOSS-1. A second matching tank is planned to make the station symmetrical.',
            href: 'kgoss.html', linkLabel: 'KGOSS Station', vehicle: 'kgoss-fuel-tanks'
        },
        {
            id: 'astra-1', stage: 'infrastructure', program: 'Astra telescope', status: 'flown',
            title: 'Astra-1 Kerbin Space Telescope',
            description: 'WSA\'s space telescope is in a near-circular orbit about 561 km above Kerbin.',
            href: 'missions-archive.html#astra-telescope', linkLabel: 'Mission record', vehicle: 'astra-1'
        },
        {
            id: 'lunalink-1', stage: 'infrastructure', program: 'LunaLink', status: 'flown',
            title: 'LunaLink-1 Relay at the Mun',
            description: 'An ion-engined relay satellite in an 80 km circular orbit round the Mun.',
            href: 'missions-archive.html#lunalink', linkLabel: 'Mission record', vehicle: 'lunalink-1'
        },
        {
            id: 'kgoss-3', stage: 'infrastructure', program: 'KGOSS', status: 'planned',
            title: 'KGOSS-3 Deorbit-Safety Research',
            description: 'A future research direction on deorbit safety.',
            href: 'kgoss.html#kgoss-3', linkLabel: 'KGOSS-3 research'
        },
        {
            id: 'fammok-1', stage: 'exploration', program: 'FAMMOK', status: 'flown',
            title: 'FAMMOK-1: First Mun Landing',
            description: 'The first FAMMOK lander made WSA\'s first landing on the Mun.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-1'
        },
        {
            id: 'fammok-2', stage: 'exploration', program: 'FAMMOK', status: 'stranded',
            title: 'FAMMOK-2: First Minmus and Duna Landings',
            description: 'FAMMOK-2 made WSA\'s first landing on Minmus, landed on the Mun, and later made WSA\'s first landing on Duna. It lifted off again but stayed in Duna orbit, where it is stranded with three crew.',
            lesson: 'Landing is only half of a mission: the vehicle needs the margin to come home.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-2'
        },
        {
            id: 'silver-bridge', stage: 'exploration', program: 'Silver Bridge', status: 'partial',
            title: 'Project Silver Bridge',
            description: 'A one-off Mun mission: undock in low Munar orbit, drill and run ISRU experiments on the surface, return to orbit and redock, and support an experimental relay.',
            lesson: 'A docking-port size mismatch prevented the planned docking at KGOSS, and the vehicle was nearly stranded in low Kerbin orbit. Compatible docking hardware and rescue options matter.',
            href: 'missions-archive.html#silver-bridge', linkLabel: 'Silver Bridge record', vehicle: 'silver-bridge'
        },
        {
            id: 'fammok-3', stage: 'exploration', program: 'FAMMOK', status: 'stranded',
            title: 'FAMMOK-3 Duna Rescue',
            description: 'A Duna rescue mission launched on an Aegis-1 Super Heavy with two crew. It never reached Duna and is in solar orbit.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-3'
        },
        {
            id: 'odysseus', stage: 'exploration', program: 'Odysseus', status: 'flown',
            title: 'Odysseus: Fourth Duna Attempt',
            description: 'Odysseus reached Duna. With too little fuel for a safe landing, it deliberately did not land and used a Duna gravity assist to return to Kerbin.',
            lesson: 'Turning back with the crew safe was the right call: getting there and home again is a result.',
            href: 'missions-archive.html#odysseus', linkLabel: 'Mission record', vehicle: 'odysseus'
        },
        {
            id: 'minmus-firework', stage: 'exploration', program: 'Minmus Firework', status: 'completed',
            title: 'Minmus Firework',
            description: 'A crewed flight on an Aegis Mk1.3 that landed on Minmus, planted a flag and returned to a splashdown on Kerbin.',
            href: 'missions-archive.html#minmus-firework', linkLabel: 'Mission record'
        },
        {
            id: 'project-kepler', stage: 'exploration', program: 'Project Kepler', status: 'flown',
            title: 'Project Kepler Asteroid Rendezvous',
            description: 'A crewed asteroid mission that met an asteroid in solar orbit, grappled it, later released it, and came back into Kerbin\'s atmosphere.',
            href: 'missions-archive.html#project-kepler', linkLabel: 'Mission record', vehicle: 'project-kepler'
        },
        {
            id: 'autoland-v2x', stage: 'guidance', program: 'AutoLand', status: 'in-development',
            title: 'AutoLand V2.x Guidance',
            description: 'Development of predictive targeting, empirical drag modelling, entry-burn logic, glide and powered-glide guidance and a redesigned landing burn, continuing in the V2.2a and V2.2aGT script track.',
            lesson: 'In the Aeris 4A live test the landing missed by about 1.9 km, with weak guidance in the fall and a rough touchdown, but the vehicle stayed upright. Other test landings came down about 700 m from the target, rough touchdowns could damage engines, and an Aegis stabilizer setup flipped near apogee. These are test observations, not specifications.',
            href: 'autoland.html#glide', linkLabel: 'Glide & landing guidance'
        },
        {
            id: 'ssto-orbit', stage: 'guidance', program: 'Aircraft', status: 'experimental',
            title: 'Mk2 SSTO Reaches Orbit',
            description: 'A Mk2-based single-stage-to-orbit design reached roughly 200 km orbit near KGOSS with NERV engines, after an earlier design ran out of liquid fuel near 25 km.',
            lesson: 'It did not dock with KGOSS. Reaching orbit is not the same as completing the mission.',
            href: 'vehicles-programs.html#aircraft', linkLabel: 'Aircraft & SSTO program', vehicle: 'mk2-ssto'
        },
        {
            id: 'lyra-p1e', stage: 'next-gen', program: 'Lyra', status: 'in-development',
            title: 'Lyra P-1E Prototype',
            description: 'Prototype 1 Experimental, the first Lyra prototype design. The Lyra concept uses 21 main Vector engines, plus up to 9 more on each side depending on the configuration. No Lyra flight is recorded yet.',
            href: 'vehicles-programs.html#lyra', linkLabel: 'Lyra program', vehicle: 'lyra-p1e'
        },
        {
            id: 'lyra-tiers', stage: 'next-gen', program: 'Lyra', status: 'planned',
            title: 'Lyra Selene, Sol & Astra Tiers',
            description: 'Three named tiers, intended to support KGOSS construction and higher-capacity missions.',
            href: 'vehicles-programs.html#lyra', linkLabel: 'Lyra program', vehicle: 'lyra'
        },
        {
            id: 'aegis-catch', stage: 'next-gen', program: 'Aegis', status: 'concept',
            title: 'Booster Catch System',
            description: 'After an Aegis splashdown, WSA began work on an original chopstick-style system for catching boosters on their return. It is an early concept: nothing has been built yet.',
            href: 'vehicles-programs.html#aegis', linkLabel: 'Aegis program', vehicle: 'aegis'
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
        }
    ],

    /*
     * Mission records: the one list of WSA missions. The Missions archive and the Mission Map both draw from it.
     *
     * RULES
     *  - Only record what is documented. Leave a field out when it is unknown; never fill a gap with a guess.
     *  - Every event says where it comes from (`basis`):
     *      'site'      WSA's earlier published records (the archive, Hangar, gallery and so on), named by `source`
     *      'operator'  history supplied directly by the WSA operator
     *      'save'      read from WSA's KSP save files (vessel states, flags, docking records), never from a
     *                  save's file name alone
     *  - A save file's name is a clue, not evidence: a mission does not get an event because a save is called
     *    "landing". Save names and other investigation notes go in the internal `evidence` and `verify`
     *    fields, which are never shown on the site.
     *  - No route is a measured trajectory: map legs are schematic curves between recorded places, and the
     *    replay is a sequence, not real elapsed time. Intended routes go in `planned`, never in `route`.
     *  - Dates: none are recorded. Game times in the saves are not calendar dates.
     *
     * MISSION FIELDS
     *   id, name, status (a key of STATUSES), summary                        required
     *   program        program or family ('Not recorded' when unknown)
     *   objective, destination, launchVehicle, crew (number aboard, from the saves)
     *   vehicles       ids from VEHICLES (adds Hangar links);  craft  names of craft not in the Hangar
     *   relatedMissions  ids of other missions
     *   outcome        one short line: the known end state
     *   locations, route, planned, events, replayNote: used by the Mission Map (see mission-map/routes.js
     *                  for the place syntax, e.g. 'kerbin/low', 'duna/surface', 'kgoss', 'solar:kerbin>duna@0.55')
     *   notes          other documented details;  conflicts  disagreements in the record, shown publicly
     *   links          [{ label, href }] pages on this site
     *   evidence, verify   INTERNAL ONLY, never shown
     */
    MISSION_SOURCES: {
        'archive':  { label: 'WSA mission archive', href: 'missions-archive.html' },
        'kgoss':    { label: 'KGOSS Station page', href: 'kgoss.html' },
        'vehicles': { label: 'Vehicles & Programs page', href: 'vehicles-programs.html' },
        'hangar':   { label: 'Vehicle Hangar', href: 'vehicles-programs.html#hangar' },
        'timeline': { label: 'Development Timeline', href: 'goals-achievements.html#timeline' },
        'autoland': { label: 'AutoLand Engineering', href: 'autoland.html' },
        'gallery':  { label: 'Flight Gallery', href: 'gallery.html' },
        'operator': { label: 'WSA operator\'s history' },
        'save':     { label: 'WSA\'s KSP save files' }
    },

    MISSIONS: [
        {
            id: 'kgoss-1',
            name: 'KGOSS-1 construction',
            aliases: ['KGOSS', 'KGOSS-1', 'station assembly'],
            program: 'KGOSS',
            objective: 'Build WSA\'s orbital station and assembly hub in Kerbin orbit.',
            destination: 'Kerbin orbit',
            vehicles: ['kgoss-1', 'kgoss-centrifuge', 'kgoss-cabins', 'kgoss-fuel-tanks', 'seraph-spc-1'],
            relatedMissions: ['seraph-haven', 'mk2-ssto', 'silver-bridge'],
            status: 'in-service',
            outcome: 'Assembled and in service at about 200 km',
            summary: 'WSA\'s orbital station, assembled in Kerbin orbit from separately launched modules: the core, a habitation module, a centrifuge and a fuel module, with the Seraph SPC-1 "Haven" capsule docked as the crew\'s way home.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'kgoss' }] },
            events: [
                { at: 0, title: 'Modules launched one at a time', basis: 'save', source: 'save',
                  text: 'The core, a habitation module, the centrifuge and a fuel module were each launched as separate flights.' },
                { at: 1, title: 'Rendezvous in Kerbin orbit', basis: 'site', source: 'kgoss',
                  text: 'Each module had to be launched into a compatible orbit and maneuvered to rendezvous with the growing station.' },
                { at: 2, title: 'Docked and assembled on orbit', basis: 'save', source: 'save',
                  text: 'KGOSS-1\'s docking records show the core, the centrifuge (about 43 t), the fuel module (about 84 t) and the Seraph SPC-1 "Haven" capsule.' },
                { at: 2, title: 'Current state', basis: 'save', source: 'save',
                  text: 'In the current save KGOSS-1 orbits Kerbin at about 200 × 204 km with 38 crew aboard.' },
                { at: 2, kind: 'planned', title: 'Planned: second fuel tank', basis: 'operator', source: 'operator',
                  text: 'A second tank matching the docked fuel module is planned, to make the station symmetrical.' }
            ],
            replayNote: 'Shows one representative module flight. The order in which the modules arrived is drawn from the saves only loosely.',
            notes: ['The working orbit was discussed at about 200 km, with about 250 km considered. Under the rescaled KSRSS Reborn system, the earlier working altitude turned out to be inside the atmosphere; the current save uses the stock-scale system.'],
            links: [{ label: 'KGOSS Station', href: 'kgoss.html' }],
            evidence: ['See the kgoss-1 vehicle record'],
            verify: ['Was the "KGOSS-1 ISRU + AegisSH-1" module docked? It is not in KGOSS-1\'s docking records.']
        },
        {
            id: 'seraph-haven',
            name: 'Seraph SPC-1 "Haven"',
            aliases: ['Seraph', 'Haven', 'SPC-1', 'rescue capsule'],
            program: 'KGOSS',
            objective: 'Give KGOSS-1\'s crew a rescue and return capsule.',
            destination: 'KGOSS-1',
            vehicles: ['seraph-spc-1'],
            relatedMissions: ['kgoss-1'],
            status: 'in-service',
            outcome: 'Docked at KGOSS-1',
            summary: 'WSA\'s crew rescue and return capsule, launched with three crew and docked at KGOSS-1 to give crews in orbit a way home.',
            crew: 3,
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kgoss', legs: [] },
            events: [
                { at: 0, title: 'Docked at KGOSS-1', basis: 'save', source: 'save',
                  text: 'Seraph 1 SPC-1 "Haven" flew up to the station with three crew and is docked there in the current save.' }
            ],
            replayNote: 'Only its position at the station is drawn.',
            links: [{ label: 'KGOSS Station', href: 'kgoss.html' }],
            evidence: ['Save "spcb4rdv1"; KGOSS-1 docking record "Seraph 1 SPC-1 \\"Haven\\""']
        },
        {
            id: 'aegis-tests',
            name: 'Aegis flight and recovery tests',
            aliases: ['Aegis', 'booster recovery', 'AutoLand', 'Quartet', 'Quintet', 'Nonet', 'Super Heavy recovery'],
            program: 'Aegis',
            objective: 'Land and recover Aegis boosters under WSA\'s own AutoLand guidance.',
            destination: 'Kerbin',
            vehicles: ['aegis', 'aegis-1-super-heavy'],
            status: 'experimental',
            outcome: 'Recovery is still experimental',
            summary: 'Aegis boosters fly and come back to land under WSA\'s own AutoLand guidance. Recovery remains experimental: test flights continue with the Super Heavy versions, and a booster catch system is an early concept.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/apex' }, { to: 'kerbin/surface@+45' }] },
            events: [
                { at: 0, title: 'Launch', basis: 'site', source: 'gallery',
                  text: 'The Flight Gallery has Aegis on the launch pad at dawn and climbing at night.' },
                { at: 1, title: 'Booster in space', basis: 'site', source: 'gallery',
                  text: 'Flight Gallery photo of an Aegis stage in space above the horizon.' },
                { at: 1.6, title: 'AutoLand descent', basis: 'site', source: 'autoland',
                  text: 'AutoLand works out whether the booster can reach a vertical descent with the thrust available, and smooths the throttle on the way down.' },
                { at: 2, title: 'Landing and recovery', basis: 'site', source: 'vehicles',
                  text: 'WSA\'s earlier records count more than 47 successful recoveries, including water landings. Boosters have sometimes tipped over after touchdown.' },
                { at: 2, title: 'Super Heavy recovery tests', basis: 'save', source: 'save',
                  text: 'Recovery test flights of Aegis Super Heavy versions 1.1 to 1.7 are in the saves, with boosters coming down on land and in the sea.' },
                { at: 2, title: 'After a splashdown: a catch concept', basis: 'operator', source: 'operator',
                  text: 'After an Aegis splashdown, WSA began work on an original chopstick-style system for catching boosters. It is an early concept; nothing has been built.' }
            ],
            replayNote: 'A representative flight profile built from the program record, not one particular flight.',
            notes: [
                'AutoLand V1.6 could land a booster on water, but the booster could still tip over after touchdown.',
                'AutoLand B1 failed in testing; the exact cause is not documented.',
                'V2.x test landings came down roughly 700 m from the target; in the Aeris 4A live test the miss was about 1.9 km. These are test observations, not specifications.',
                'An Aegis stabilizer setup has flipped near apogee.'
            ],
            links: [{ label: 'Aegis program', href: 'vehicles-programs.html#aegis' }, { label: 'AutoLand Engineering', href: 'autoland.html' },
                    { label: 'Aegis photos', href: 'gallery.html?album=aegis' }],
            evidence: ['Vessels "KGOSS1-MD Aegis1SH/1.2SH/1.3SH/1.5SH/1.6SH/1.7SH Recovery…" and "Aegis1.62SH Recovery" in the saves (LANDED and SPLASHED on Kerbin); craft files Aegis1.1SH–1.7SH recovery tests'],
            verify: ['The "47+ successful recoveries" figure comes from the site\'s earlier text. Is it still right, and which vehicles does it count?']
        },
        {
            id: 'fammok-1',
            name: 'FAMMOK-1',
            aliases: ['FAMMOK', 'Fammok Mk1', 'Mun lander', 'first Mun landing'],
            program: 'FAMMOK',
            objective: 'Land on the Mun.',
            destination: 'Mun',
            vehicles: ['fammok-1'],
            relatedMissions: ['fammok-2-minmus-mun'],
            crew: 1,
            status: 'flown',
            outcome: 'WSA\'s first Mun landing',
            summary: 'The first FAMMOK lander, flown with one crew member, made WSA\'s first landing on the Mun.',
            locations: ['kerbin', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }] },
            events: [
                { at: 1, title: 'In Kerbin orbit', basis: 'save', source: 'save',
                  text: 'FAMMOK-1 reached Kerbin orbit with one crew member aboard.' },
                { at: 3, title: 'WSA\'s first landing on the Mun', basis: 'save', source: 'save',
                  text: 'Its flag on the Mun reads: "WSA\'s first landing on Mun with the FAMMOK Mk1 spacecraft".' },
                { at: 5, title: 'Return from the Mun', basis: 'site', source: 'archive',
                  text: 'WSA\'s archive credits FAMMOK-1 with returning from the Mun. How it came home is not recorded.' }
            ],
            replayNote: 'Every leg is schematic: Kerbin orbit and the Mun landing are recorded, the rest is not.',
            notes: ['Flown in an earlier save that used a different set of mods from the current one.'],
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['See the fammok-1 vehicle record'],
            verify: ['Did FAMMOK-1 itself return from the Mun? The earlier save\'s progress records a return from the Mun\'s surface but not by which craft.']
        },
        {
            id: 'fammok-2-minmus-mun',
            name: 'FAMMOK-2: Minmus and Mun landings',
            aliases: ['FAMMOK-2', 'first Minmus landing', 'Minmus', 'Mun landing'],
            program: 'FAMMOK',
            objective: 'Land on Minmus.',
            destination: 'Minmus and the Mun',
            vehicles: ['fammok-2'],
            relatedMissions: ['fammok-1', 'fammok-2'],
            crew: 2,
            status: 'flown',
            outcome: 'First WSA landing on Minmus, then a landing on the Mun',
            summary: 'The first FAMMOK-2 flight made WSA\'s first landing on Minmus and planted a flag. It then landed on the Mun instead of taking a planned gravity assist.',
            locations: ['kerbin', 'minmus', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'minmus/low' }, { to: 'minmus/surface' }, { to: 'minmus/low' }, { to: 'mun/low' }, { to: 'mun/surface' }] },
            events: [
                { at: 3, title: 'First WSA landing on Minmus', basis: 'save', source: 'save',
                  text: 'FAMMOK-2 landed on Minmus. Its flag reads: "First ever landing on Minmus!"' },
                { at: 6, kind: 'decision', title: 'Landing on the Mun', basis: 'save', source: 'save',
                  text: 'Its flag on the Mun reads: "Second landing on Mun, wanted a gravity assist from a Minmus mission but decided to land."' }
            ],
            replayNote: 'Every leg is schematic. What FAMMOK-2 did after the Mun landing is not recorded.',
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['Flags "First WSA Minmus landing" and "WSA second landing on Mum"; saves "fammok 2 min good landing", "fam2 flag plant", "fam 2 mum flag" show Fammok 2 landed on Minmus and the Mun (2 crew)']
        },
        {
            id: 'fammok-2',
            name: 'FAMMOK-2: Duna',
            aliases: ['FAMMOK', 'FAMMOK-2', 'Duna lander', 'first Duna landing', 'parachute', 'stranded', 'first Duna attempt'],
            program: 'FAMMOK',
            objective: 'Land on Duna.',
            destination: 'Duna',
            vehicles: ['fammok-2'],
            relatedMissions: ['fammok-2-minmus-mun', 'fammok-3', 'duna-rescue-crash', 'odysseus'],
            crew: 3,
            status: 'stranded',
            outcome: 'First WSA Duna landing; stranded in Duna orbit',
            summary: 'A second FAMMOK-2 flew to Duna with three crew and made WSA\'s first landing there. It lifted off again but has stayed in Duna orbit since, stranded. WSA counts it as the first of four attempts to reach Duna.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/high' }, { to: 'duna/surface' }, { to: 'duna/low' }], endOrbit: true },
            events: [
                { at: 1, title: 'Departure from Kerbin', basis: 'save', source: 'save',
                  text: 'FAMMOK-2 left Kerbin orbit for Duna with three crew.' },
                { at: 2, title: 'Duna orbit', basis: 'save', source: 'save',
                  text: 'It arrived in an orbit of about 258 × 260 km round Duna.' },
                { at: 2.5, title: 'Parachute problem', basis: 'site', source: 'archive',
                  text: 'WSA\'s archive records that the parachute malfunctioned or under-performed during the descent.' },
                { at: 3, title: 'First WSA landing on Duna', basis: 'save', source: 'save',
                  text: 'FAMMOK-2 landed on Duna, and a flag reading "Craft: WSA FAMMOK-2" marks WSA\'s first Duna landing.' },
                { at: 4, title: 'Back in Duna orbit', basis: 'save', source: 'save',
                  text: 'It lifted off from the surface and returned to an orbit of about 81 × 202 km.' },
                { at: 4, title: 'Stranded', basis: 'operator', source: 'operator',
                  text: 'It became stranded at Duna with about 2,300 m/s of delta-v reported remaining. It is still in that orbit, with its three crew, in the current save.' }
            ],
            replayNote: 'Duna orbit, the landing and the return to orbit are recorded; the transfer is schematic.',
            notes: ['Earlier campaign figures (approximate, possibly from different configurations or phases): about 6,000 m/s before the injection burn, about 3,690 m/s lander capability, about 3,100 m/s in the Duna-orbit phase.'],
            conflicts: ['Duna orbit: the earlier archive gives about 440 × 260 km; the arrival checkpoint in the saves shows about 258 × 260 km. They may describe different moments.'],
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['Saves "fm2dunab4tb", "fm2dunacrt1", "fm2dunaenroutr" (escaping Kerbin, 3 crew), "fm2dunaorb" (Duna 258 × 260 km), "fm2dunades" (flying at Duna), "fm2dunasf" and "fam2dunaleavesur" (landed on Duna), "fam2 duna b4 transfer" (Duna 81 × 202 km); current save: Fammok 2 in Duna orbit 81 × 202 km, 3 crew; flag "First WSA landing on Duna"'],
            verify: ['The reported 2,300 m/s does not match the propellant aboard in the current save (182 LF / 223 Ox). When was the figure measured?', 'The parachute problem is from the earlier archive; the saves cannot confirm it.']
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3 Duna rescue',
            aliases: ['FAMMOK', 'FAMMOK-3', 'FAMMOK-3 DRSE', 'rescue', 'Duna rescue attempt', 'Aegis-1 Super Heavy'],
            program: 'FAMMOK',
            objective: 'A rescue mission to Duna.',
            destination: 'Duna',
            launchVehicle: 'Aegis-1 Super Heavy',
            vehicles: ['fammok-3', 'aegis-1-super-heavy'],
            relatedMissions: ['fammok-2', 'duna-rescue-crash', 'odysseus'],
            crew: 2,
            status: 'stranded',
            outcome: 'Stranded in solar orbit, short of Duna',
            summary: 'A Duna rescue mission, flown as FAMMOK-3 DRSE on an Aegis-1 Super Heavy with two crew after FAMMOK-2 was stranded. It never reached Duna and was left in solar orbit.',
            locations: ['kerbin', 'solar', 'duna'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'solar:kerbin>duna@0.55' }], endOrbit: true },
            planned: [{ from: 1, legs: [{ to: 'duna/low' }], label: 'Intended: reach Duna' }],
            events: [
                { at: 0, title: 'Launch on Aegis-1 Super Heavy', basis: 'save', source: 'save',
                  text: 'FAMMOK-3 DRSE lifted off on an Aegis-1 Super Heavy with two crew.' },
                { at: 2, title: 'Stranded in solar orbit', basis: 'operator', source: 'operator',
                  text: 'The rescue craft became stranded in orbit round Kerbol. In the current save it is still there with its two crew, on an orbit round Kerbol that reaches from inside Duna\'s orbit to beyond Dres\'s.' }
            ],
            replayNote: 'Where it is in solar orbit is drawn for illustration only.',
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['See the fammok-3 vehicle record'],
            verify: ['Confirm that FAMMOK-3 is the rescue craft the operator described as stranded in solar orbit, and that it was the second Duna attempt (it launched after FAMMOK-2 was stranded and before Odysseus).']
        },
        {
            id: 'duna-rescue-crash',
            name: 'Duna rescue craft (crashed into Duna)',
            aliases: ['rescue', 'Duna rescue attempt', 'crash', 'third Duna attempt'],
            program: 'Not recorded',
            objective: 'A rescue mission to Duna.',
            destination: 'Duna',
            craft: ['Rescue craft (name not recorded)'],
            relatedMissions: ['fammok-2', 'fammok-3', 'odysseus'],
            status: 'lost',
            outcome: 'Crashed into Duna',
            summary: 'One of the two rescue attempts after FAMMOK-2 was stranded at Duna. It reached Duna but crashed into the planet.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/near' }, { to: 'duna/surface' }] },
            events: [
                { at: 3, title: 'Crashed into Duna', basis: 'operator', source: 'operator',
                  text: 'The rescue craft crashed into Duna. Its name and the cause are not recorded.' }
            ],
            replayNote: 'Every leg is schematic; only the crash at Duna is recorded.',
            links: [],
            verify: ['Which craft was this? A "Seraph SPC-1 \\"Haven\\" + Aegis1SHMD" was on the pad in save "spc-1-1 duna transferang"; is it related?', 'Was this the second or the third Duna attempt?']
        },
        {
            id: 'odysseus',
            name: 'Odysseus',
            aliases: ['Duna', 'gravity assist', 'fourth Duna attempt', 'OYR-1P', 'OYR'],
            program: 'Not recorded',
            objective: 'Reach Duna, and land if it was safe to.',
            destination: 'Duna',
            launchVehicle: 'Aegis-1.1 Super Heavy',
            vehicles: ['odysseus', 'aegis-1-super-heavy'],
            relatedMissions: ['fammok-2', 'fammok-3', 'duna-rescue-crash'],
            crew: 3,
            status: 'flown',
            outcome: 'Reached Duna, did not land, returned to Kerbin',
            summary: 'The fourth attempt to reach Duna. Odysseus got there, but with too little fuel for a safe landing it deliberately did not try to land. It used a Duna gravity assist to head home to Kerbin instead.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/near' }, { to: 'duna/near@+180', via: 'flyby' }, { to: 'kerbin/near' }] },
            planned: [{ from: 2, legs: [{ to: 'duna/surface' }], label: 'Intended landing (not attempted)' }],
            events: [
                { at: 0, title: 'Launch on Aegis-1.1 Super Heavy', basis: 'save', source: 'save',
                  text: 'Odysseus (OYR-1P) lifted off on an Aegis-1.1 Super Heavy with three crew.' },
                { at: 0, title: 'Fourth attempt to reach Duna', basis: 'operator', source: 'operator',
                  text: 'Odysseus followed the stranded FAMMOK-2 and the two failed rescue attempts.' },
                { at: 2, title: 'Arrived at Duna', basis: 'operator', source: 'operator',
                  text: 'Odysseus reached Duna.' },
                { at: 2, kind: 'decision', title: 'Landing not attempted', basis: 'operator', source: 'operator',
                  text: 'The fuel left was not enough to make a landing acceptably safe, so the landing was deliberately not attempted.' },
                { at: 3, title: 'Duna gravity assist', basis: 'operator', source: 'operator',
                  text: 'Odysseus used a gravity assist at Duna to head back to Kerbin.' },
                { at: 4, title: 'Returned to Kerbin', basis: 'operator', source: 'operator',
                  text: 'Odysseus returned to Kerbin.' }
            ],
            replayNote: 'Transfers and the flyby are schematic. Whether Odysseus entered Duna orbit before leaving is not recorded.',
            notes: ['The Flight Gallery has an "Odysseus Test" photo of a test flight high above the planet. How that test relates to the Duna mission is not recorded.'],
            links: [{ label: 'Odysseus test photo', href: 'gallery.html?album=odysseus' }],
            evidence: ['Vessels "OYR-1P \\"Odysseus\\" + Aegis-1.1 SH" and "OYR-1P2 \\"Odysseus\\" + Aegis-1.1 SH", 3 crew, in saves "oyrtransstart1", "oyrp2 during trans", "oyrp2 before midc1", "oyr-1 midcorse1", "oyr-1 aftermid", "oyr1 duna orbit ar" (Duna 95 × 108 km), "oyr1 before entry" (Duna 24 × 99 km), "oyyrp2PlanA b4 entry", "oyr1p2 plan a land" and "oyr1p2 plan a b4 dp" (OYR-1P2 LANDED on Duna), "oyr1p2 before pa tt" (Duna 53 × 84 km, 17 parts)', 'None of these is in the current save: they are later in game time than it, so they look like branches that were not kept'],
            verify: ['Two Odysseus variants (OYR-1P and OYR-1P2 "Plan A") appear in the saves, and in two saves OYR-1P2 is landed on Duna. This conflicts with "no landing attempted". Which branch is the official mission? The site follows the operator\'s account until this is settled.']
        },
        {
            id: 'jool-satellite',
            name: 'Unintended Jool satellite',
            aliases: ['Duna satellite', 'Vall', 'Laythe', 'gravity assist'],
            program: 'Not recorded',
            objective: 'Orbit Duna.',
            destination: 'Duna (intended); Jool system',
            craft: ['Satellite (name not recorded)'],
            status: 'lost',
            outcome: 'Contact lost; last known in Jool orbit',
            summary: 'A satellite meant for Duna orbit. An accidental gravity assist sent it to Vall instead. It later tried to reach Laythe, lost contact with Kerbin during the capture burn, and was last known to be in Jool orbit.',
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
                  text: 'Its last known state is an orbit around Jool, not Laythe. It did not enter Laythe orbit. Its present orbit and condition are not recorded.' }
            ],
            replayNote: 'Every leg is schematic. The final Jool orbit is drawn for illustration only.',
            links: [],
            verify: ['A probe called "Relay Probe wdy" orbits and then leaves a body the save calls Vall in the earlier [NEW]MODDEDWSASANDBOX save, within days of launch. That save used a different planet setup, so it cannot be matched to this story with confidence. Is that the satellite, and what is its name?']
        },
        {
            id: 'minmus-firework',
            name: 'Minmus Firework',
            aliases: ['Minmus fireworks', 'Minmus landing', 'splashdown'],
            program: 'Not recorded',
            objective: 'Land on Minmus and return.',
            destination: 'Minmus',
            launchVehicle: 'Aegis Mk1.3',
            vehicles: ['aegis'],
            crew: 3,
            status: 'completed',
            outcome: 'Landed on Minmus and splashed down on Kerbin',
            summary: 'A crewed flight on an Aegis Mk1.3 that landed on Minmus, planted a flag and came home to a splashdown on Kerbin.',
            locations: ['kerbin', 'lko', 'minmus'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'minmus/low' }, { to: 'minmus/surface' }, { to: 'minmus/low' }, { to: 'kerbin/low' }, { to: 'kerbin/surface' }] },
            events: [
                { at: 1, title: 'In Kerbin orbit', basis: 'site', source: 'gallery', text: 'Photo of the spacecraft in Kerbin orbit with the planet behind it.' },
                { at: 2, title: 'Minmus orbit', basis: 'save', source: 'save', text: 'The spacecraft entered an orbit of about 22 × 48 km round Minmus with three crew.' },
                { at: 3, title: 'On the surface of Minmus', basis: 'save', source: 'save', text: 'It landed on Minmus, and the crew planted a flag named "WSA Minmus Firework". The Flight Gallery has a photo of the lander there.' },
                { at: 5.6, title: 'Reentry', basis: 'site', source: 'gallery', text: 'Photos of the spacecraft glowing during reentry high above the coastline.' },
                { at: 5.9, title: 'Landing burn', basis: 'site', source: 'gallery', text: 'Photo of the spacecraft firing its engine above the ocean.' },
                { at: 6, title: 'Splashdown', basis: 'site', source: 'gallery', text: 'Photo of the capsule floating in the ocean.' }
            ],
            replayNote: 'Milestones come from the saves and the Flight Gallery photos; the legs between them are schematic.',
            links: [{ label: 'Minmus Firework photos', href: 'gallery.html?album=minmus-firework' }],
            evidence: ['Vessel "WSA Minmus Fireworks + Aegis mk1.3" (3 crew) in saves "minmus firework apr trans1", "minmus firework dep tr2", "min firework orbit" (Minmus 22 × 48 km), "min firew land", "min firew b4 dep1" (landed), "min firew earth return", "before splash fireworks"; flag "WSA Minmus Firework" on Minmus'],
            verify: ['Where does the "fireworks" name come from? Did the mission carry anything beyond the landing?']
        },
        {
            id: 'project-kepler',
            name: 'Project Kepler',
            aliases: ['Kepler', 'asteroid', 'grapple', 'asteroid rendezvous'],
            program: 'Project Kepler',
            objective: 'Rendezvous with an asteroid.',
            destination: 'An asteroid in solar orbit',
            launchVehicle: 'Aegis-1 Super Heavy',
            vehicles: ['project-kepler', 'aegis-1-super-heavy'],
            crew: 3,
            status: 'flown',
            outcome: 'Grappled an asteroid; back in Kerbin\'s atmosphere',
            summary: 'A crewed asteroid mission. It left Kerbin, met an asteroid in solar orbit, grappled it, later released it, and came back into Kerbin\'s atmosphere.',
            locations: ['kerbin', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'solar:kerbin>eve@0.08' }, { to: 'kerbin/air' }] },
            events: [
                { at: 1, title: 'Leaving Kerbin', basis: 'save', source: 'save',
                  text: 'Project Kepler left Kerbin\'s sphere of influence with three crew, a grapple, drills and an ISRU unit.' },
                { at: 2, title: 'Asteroid rendezvous', basis: 'save', source: 'save',
                  text: 'It met an asteroid in solar orbit near Kerbin\'s own orbit round Kerbol.' },
                { at: 2, title: 'Asteroid grappled', basis: 'save', source: 'save',
                  text: 'The asteroid was attached to the spacecraft by its grapple. Later it was released again.' },
                { at: 3, title: 'Back into Kerbin\'s atmosphere', basis: 'save', source: 'save',
                  text: 'The spacecraft came back into Kerbin\'s atmosphere with its three crew. The landing itself is not recorded.' }
            ],
            replayNote: 'The asteroid\'s position is drawn for illustration only.',
            notes: ['Whether the asteroid was moved to a new orbit, and whether any sample was brought home, is not recorded.'],
            links: [],
            evidence: ['See the project-kepler vehicle record. "pjk b4 redirect1": asteroid (PotatoRoid) attached; "pjk redrt and disarm 1": no longer attached; "pjk landing": FLYING in Kerbin\'s atmosphere, 35 parts'],
            verify: ['Was the asteroid redirected, and did the crew land safely?']
        },
        {
            id: 'astra-telescope',
            name: 'Astra-1 Kerbin Space Telescope',
            aliases: ['Astra', 'telescope', 'Astra-1'],
            program: 'Astra telescope',
            objective: 'Put a space telescope into Kerbin orbit.',
            destination: 'Kerbin orbit',
            vehicles: ['astra-1'],
            status: 'flown',
            outcome: 'In orbit at about 561 km',
            summary: 'The launch of WSA\'s Astra-1 space telescope. In the current save it is in a near-circular orbit about 561 km above Kerbin.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/high' }], endOrbit: true },
            events: [
                { at: 0, title: 'Launch', basis: 'site', source: 'gallery',
                  text: 'Photo of the rocket carrying the Astra telescope, against the edge of the planet and the sun.' },
                { at: 1, title: 'In orbit', basis: 'save', source: 'save',
                  text: 'Astra-1 is in an orbit of about 561 × 562 km round Kerbin.' }
            ],
            replayNote: 'The ascent is schematic.',
            conflicts: ['"Astra" is also the name of a Lyra tier. Whether the telescope is connected to Lyra Astra is not recorded.'],
            links: [{ label: 'Astra launch photo', href: 'gallery.html?album=astra-telescope' }]
        },
        {
            id: 'lunalink',
            name: 'LunaLink-1',
            aliases: ['LunaLink', 'relay', 'Mun relay'],
            program: 'LunaLink',
            objective: 'Place a relay satellite at the Mun.',
            destination: 'Mun orbit',
            vehicles: ['lunalink-1'],
            status: 'flown',
            outcome: 'In an 80 km orbit round the Mun',
            summary: 'A relay satellite with an ion engine. In the current save it is in an 80 km circular orbit round the Mun.',
            locations: ['kerbin', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }], endOrbit: true },
            events: [
                { at: 2, title: 'In Mun orbit', basis: 'save', source: 'save',
                  text: 'LunaLink-1 is in an orbit of about 80 km round the Mun.' }
            ],
            replayNote: 'Launch and transfer are schematic.',
            links: []
        },
        {
            id: 'silver-bridge',
            name: 'Project Silver Bridge',
            aliases: ['Silver Bridge', 'ISRU', 'Mun drilling'],
            program: 'Project Silver Bridge',
            objective: 'Land on the Mun, drill and run ISRU experiments, then return and dock with KGOSS.',
            destination: 'Mun',
            vehicles: ['silver-bridge'],
            relatedMissions: ['silver-connect', 'kgoss-1'],
            crew: 3,
            status: 'partial',
            outcome: 'Mun surface work done; could not dock with KGOSS',
            summary: 'A one-off Mun mission: undock in low Munar orbit, drill and run ISRU experiments on the surface, return to orbit and redock. A docking-port size mismatch then stopped the planned docking with KGOSS.',
            locations: ['kerbin', 'lko', 'kgoss', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }] },
            planned: [{ from: 5, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS' }],
            events: [
                { at: 2, title: 'Low Munar orbit', basis: 'save', source: 'save',
                  text: 'Project Silver Bridge reached Munar orbit with three crew and lowered its orbit to about 60 km.' },
                { at: 3, title: 'Surface operations', basis: 'save', source: 'save',
                  text: 'The lander touched down on the Mun with two crew, who planted a flag named "Project Silver Bridge Landing Site". The archive records drilling and ISRU experiments there.' },
                { at: 4, title: 'Back in orbit and redocked', basis: 'site', source: 'archive',
                  text: 'The lander returned to Munar orbit and redocked. The archive says the docking-port mismatch was discovered at this point.' },
                { at: 5, title: 'Could not dock with KGOSS', basis: 'site', source: 'archive',
                  text: 'Its docking port did not match the size of KGOSS\'s ports, so the planned docking was impossible and the vehicle was nearly stranded in low Kerbin orbit.' },
                { at: 5, title: 'Recovery', basis: 'site', source: 'archive',
                  text: 'The archive records that a rescue mission recovered the vehicle and crew from Kerbin orbit.' }
            ],
            replayNote: 'The order of events is documented; the legs between them are schematic.',
            notes: [
                'Also supported an experimental relay. When and where is not recorded, so it is not placed on the route.',
                'Lesson: compatible docking hardware, return options and rescue planning are essential.'
            ],
            conflicts: ['Recovery: the earlier archive says a rescue mission recovered the vehicle and crew; the Hangar and Development Timeline said only that the near-stranding required recovery planning.'],
            links: [{ label: 'Silver Bridge in the Hangar', href: 'vehicles-programs.html?vehicle=silver-bridge#hangar' }],
            evidence: ['See the silver-bridge vehicle record'],
            verify: ['Was "Project Silver Connect" the rescue? It launched later with three crew, landed on the Mun and ended in Kerbin orbit, which does not obviously fit a rescue from Kerbin orbit.', 'Is the probe "Mum ComLink Sat-Exp" (in Mun orbit, launched shortly after Silver Bridge) the experimental relay?']
        },
        {
            id: 'silver-connect',
            name: 'Project Silver Connect',
            aliases: ['Silver Connect', 'Mun landing'],
            program: 'Project Silver Bridge',
            destination: 'Mun',
            launchVehicle: 'AG-1 SH',
            craft: ['Project Silver Connect'],
            relatedMissions: ['silver-bridge'],
            crew: 3,
            status: 'record-incomplete',
            outcome: 'Landed on the Mun; later in Kerbin orbit',
            summary: 'A crewed flight that landed on the Mun, where its crew planted a flag named "Project Silver Connect Landing Site". Later saves have it in Kerbin orbit with three crew. Its purpose has not been documented.',
            locations: ['kerbin', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }], endOrbit: true },
            events: [
                { at: 3, title: 'Landed on the Mun', basis: 'save', source: 'save',
                  text: 'The crew planted a flag named "Project Silver Connect Landing Site" on the Mun.' },
                { at: 5, title: 'In Kerbin orbit', basis: 'save', source: 'save',
                  text: 'Later saves have the spacecraft in an orbit of about 176 × 372 km round Kerbin with three crew. It is not in the current save.' }
            ],
            replayNote: 'Every leg is schematic.',
            links: [],
            evidence: ['Vessel "Project Silver Connect (AG-1 SH ERCY)" (3 crew) in 21 saves; craft file of the same name; flag "Project Silver Connect Landing Site" (plaque "Craft: Project Silver Connect … Aiming For the Stars")'],
            verify: ['What was Silver Connect for (the name suggests a link to Silver Bridge), and what do "AG-1 SH" and "ERCY" stand for?']
        },
        {
            id: 'mk2-ssto',
            name: 'Mk2 SSTO orbital flight',
            aliases: ['SSTO', 'spaceplane', 'NERV', 'single-stage-to-orbit', 'station docking test'],
            program: 'Aircraft & spaceplanes',
            objective: 'Reach KGOSS in a single-stage spaceplane and dock.',
            destination: 'KGOSS-1',
            vehicles: ['mk2-ssto'],
            relatedMissions: ['kgoss-1'],
            crew: 2,
            status: 'experimental',
            outcome: 'Reached KGOSS\'s orbit; did not dock',
            summary: 'A Mk2-based single-stage-to-orbit spaceplane reached KGOSS\'s orbit at about 200 km with RAPIER and NERV engines, but did not dock with the station.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }] },
            planned: [{ from: 1, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS' }],
            events: [
                { at: 0, title: 'Earlier design: out of fuel near 25 km', basis: 'site', source: 'hangar',
                  text: 'An earlier version of the design ran out of liquid fuel near 25 km.' },
                { at: 1, title: 'In KGOSS\'s orbit', basis: 'save', source: 'save',
                  text: 'The docking-test version, with four RAPIER and two NERV engines and two crew, reached an orbit of about 200 × 205 km near the station.' },
                { at: 1, title: 'No docking with KGOSS', basis: 'save', source: 'save',
                  text: 'Its docking port never engaged and KGOSS-1\'s docking records are unchanged. Reaching orbit is not the same as completing the mission.' }
            ],
            replayNote: 'The climb to orbit is schematic.',
            conflicts: ['Why it did not dock: the Hangar said it lacked RCS capability; the Vehicles & Programs page said it lacked enough RCS propellant.'],
            links: [{ label: 'Aircraft & SSTO program', href: 'vehicles-programs.html#aircraft' }]
        },
        {
            id: 'fsx-3',
            name: 'FSX-3 flight',
            aliases: ['FSX-3', 'Mach 5', 'aircraft'],
            program: 'Aircraft & spaceplanes',
            destination: 'Kerbin (atmospheric flight)',
            vehicles: ['fsx-series'],
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
            links: [{ label: 'FSX-3 photos', href: 'gallery.html?album=fsx-3' }]
        },
        {
            id: 'manta-ray',
            name: 'Manta Ray at sunrise',
            aliases: ['Manta Ray', 'Starfield', 'MRR-1XLR', 'spaceplane'],
            program: 'Aircraft & spaceplanes',
            vehicles: ['manta-ray'],
            status: 'flown',
            outcome: 'Photographed above the planet',
            summary: 'Two Flight Gallery photos of the Manta Ray spaceplane (MRR-1XLR) above the planet as the sun rises.',
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

    /* Named by the operator or on the site, but with no mission record yet */
    MISSIONS_AWAITING: [
        { name: 'Blue Whale missions', vehicle: 'blue-whale',
          note: 'Blue Whale 1 / BWP-1LC is documented as a crew return craft for rare pickup and recovery operations on Kerbin, but no individual flights are recorded.' }
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
        { title: 'Flight Dynamics Center',       href: 'flight-dynamics.html',               type: 'Tools',    keywords: 'calculator tools orbit circular orbital speed period escape velocity Hohmann transfer delta-v rocket equation Isp TWR thrust weight mu gravitational parameter' },
        { title: 'Games',                        href: 'games.html',                         type: 'Page',     keywords: 'game games play minigame builder simulator' },
        { title: 'Station Builder',              href: 'game.html',                          type: 'Game',     keywords: 'game minigame build station modules docking KGOSS solar truss' },
        { title: 'Docking Simulator',            href: 'docking-simulator.html',             type: 'Game',     keywords: 'game simulator docking dock spacecraft rendezvous approach RCS first person' },
        { title: 'SSTO Landing',                 href: 'ssto-landing.html',                  type: 'Game',     keywords: 'game landing land spaceplane SSTO runway aircraft flight approach touchdown spaceport' },
        { title: 'Orbital Rendezvous Challenge', href: 'orbital-rendezvous.html',            type: 'Game',     keywords: 'game orbit orbital rendezvous transfer Hohmann intercept KGOSS docking delta-v prograde retrograde velocity' },
        { title: 'FAMMOK Program',               href: 'missions-archive.html#fammok',       type: 'Program',  keywords: 'Mun Minmus Duna lander' },
        { title: 'Project Silver Bridge',        href: 'missions-archive.html#silver-bridge', type: 'Mission', keywords: 'Mun ISRU drilling docking relay' },
        { title: 'Aegis Program',                href: 'vehicles-programs.html#aegis',       type: 'Program',  keywords: 'booster recovery Mark II Mark V' },
        { title: 'Lyra Program',                 href: 'vehicles-programs.html#lyra',        type: 'Program',  keywords: 'booster Selene Sol Astra P-1E' },
        { title: 'Aircraft & Spaceplane Program', href: 'vehicles-programs.html#aircraft',   type: 'Program',  keywords: 'SSTO Swift-1X spaceplane' },
        { title: 'Mission Map',                  href: 'mission-map.html',                   type: 'Map',      keywords: 'map 3D solar system Kerbol planets moons OPM outer planets replay timeline route Duna Jool Mun Minmus Odysseus' },
        { title: 'Missions & Project Archive',   href: 'missions-archive.html',              type: 'Page',     keywords: 'missions archive records' },
        { title: 'Goals & Achievements',         href: 'goals-achievements.html',            type: 'Page',     keywords: 'objectives status' },
        { title: 'About WSA',                    href: 'about.html',                         type: 'Page',     keywords: 'philosophy agency' },
        { title: 'Support WSA',                  href: 'support.html',                       type: 'Page',     keywords: 'donate donation bitcoin ethereum' },
        { title: 'Contact WSA',                  href: 'contact.html',                       type: 'Page',     keywords: 'contact message email form get in touch feedback question' }
    ]
};
