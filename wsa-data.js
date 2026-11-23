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
 *  - News:      add an entry at the top of NEWS. The home page shows the newest two; news.html shows them all.
 *               `featured: true` gives a release its picture across the top of its card on news.html.
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
        'on-hold':           { label: 'On hold',           tone: 'planned',      description: 'Work has paused while the focus is elsewhere. It may resume.' },
        'partial':           { label: 'Partially successful', tone: 'experimental', description: 'Some goals were reached and others were not.' },
        'stranded':          { label: 'Stranded',          tone: 'experimental', description: 'The vehicle is intact but cannot get home or reach its goal on its own; a rescue or recovery is needed.' },
        'experimental':      { label: 'Experimental',      tone: 'experimental', description: 'Under active testing. Results may be inconsistent or limited.' },
        'in-development':    { label: 'In development',    tone: 'development',  description: 'Active engineering work that is not yet flight-proven.' },
        'planned':           { label: 'Planned',           tone: 'planned',      description: 'A defined future effort. Scope and details are not final.' },
        'concept':           { label: 'Concept',           tone: 'planned',      description: 'A possible direction that has been considered but not committed to.' },
        'failed':            { label: 'Failed',            tone: 'failed',       description: 'A test, build or mission that did not work, recorded so its lessons are not lost.' },
        'lost':              { label: 'Lost',              tone: 'failed',       description: 'The vehicle or its crew was lost, or contact with the vehicle was lost.' },
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
            status: 'demonstrated',
            summary: 'WSA\'s reusable booster family and the launcher behind many WSA missions. Guided by WSA AutoLand V2.3, an Aegis booster has touched down directly on its designated landing pad. The newest design, Aegis Mk1.7, adds a hinge for WSA\'s future booster catch. The next step is making the landing repeatable and dependable.',
            aliases: ['Quartet', 'Quintet', 'Nonet', 'Heavy', 'Super Heavy', 'Max', 'Mark II', 'Mark V', 'Aegis Mk1.3', 'Aegis Mk1.7'],
            specs: [
                ['Configurations', 'Quartet, Quintet, Nonet, Heavy, Super Heavy, Max'],
                ['Versions named in flight records', 'Aegis Mk1.3, Aegis-1.1 SH, Aegis Super Heavy-1 (AegisSH-1)'],
                ['Newest design', 'Aegis Mk1.7, which adds a hinge for the future booster catch'],
                ['Landing', 'First successful target-pad landing, with AutoLand V2.3'],
                ['Recovery next steps', 'Repeatability and reliability; a booster catch is in development']
            ],
            note: 'Configuration names only: engine counts and performance figures are not documented.',
            page: 'vehicles-programs.html#aegis',
            links: [{ label: 'Watch the pad landing', href: 'autoland.html#pad-landing' }, { label: 'Photos in the Flight Gallery', href: 'gallery.html?album=aegis' }],
            related: ['aegis-1-super-heavy', 'lyra'],
            evidence: ['Vessel names in the saves: "WSA Minmus Fireworks + Aegis mk1.3", "OYR-1P \"Odysseus\" + Aegis-1.1 SH", "Project Kepler + AegisSH-1", "FAMMOK-3 DRSE AegisSH-1", "KGOSS-1 ISRU + AegisSH-1", "Aegis Mk1.6 Crew-2", "KGOSS1-MD Aegis1.1SH to Aegis1.7SH Recovery" test flights', 'Pad landing: operator\'s confirmation and video (videos/source/padPercisionLanding.mp4, recorded 15 November 2026); the AutoLand script announces "WITH AEGIS RECOVERABLE BOOSTER"', 'Aegis Mk1.7 and its catch hinge: operator; AutoLand repository commit d371aca "added catch hinge"']
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
            role: 'Smallest tier',
            status: 'planned',
            summary: 'The smallest of the three tiers in the Lyra family.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-sol', 'lyra-astra']
        },
        {
            id: 'lyra-sol',
            name: 'Lyra Sol',
            designation: 'SOL',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Middle tier',
            status: 'planned',
            summary: 'The middle of the three tiers in the Lyra family.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-astra']
        },
        {
            id: 'lyra-astra',
            name: 'Lyra Astra',
            designation: 'ASTRA',
            category: 'launch-vehicles',
            program: 'Lyra',
            role: 'Largest tier',
            status: 'planned',
            summary: 'The largest of the three tiers in the Lyra family. Not to be confused with the Astra-1 space telescope.',
            page: 'vehicles-programs.html#lyra',
            related: ['lyra', 'lyra-selene', 'lyra-sol']
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
            summary: 'A single-stage-to-orbit design built around a Mk2 spaceplane configuration. A later version reached KGOSS\'s orbit with NERV engines, but the docking was called off as too risky and it landed safely back at KSC.',
            aliases: ['Single-stage-to-orbit', 'Spaceplane', 'Station docking test'],
            specs: [
                ['Mass (expanded)', '≈ 80 t'],
                ['Engines (expanded)', '4'],
                ['Docking-test version', '4 RAPIER and 2 NERV engines'],
                ['Intakes', '2 shock cone, 4 radial'],
                ['Crew modules', '4'],
                ['Monopropellant', '≈ 800 units'],
                ['Best documented result', '≈ 200 km orbit near KGOSS; docking aborted; landed at KSC'],
                ['Earlier design', 'Ran out of liquid fuel near 25 km']
            ],
            page: 'vehicles-programs.html#aircraft',
            related: ['kgoss-1'],
            evidence: ['Saves "ssto rdvz2 kgoss1", "sstoexp kgoss1 dock1", "sstokgoss1 exp b4 deorbit": vessel "[CYAC] Station docking test" (Mk2 parts, 4 RAPIER, 2 NERV) at 200 × 205 km; never docked', 'Operator: docking was aborted because it had never been done with this craft and the risk of hitting the centrifuge was too great; it landed safely at KSC']
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
            summary: 'FAMMOK-2 made WSA\'s first landings on Minmus and on Duna, and landed on the Mun. At Duna it had about 2,300 m/s of delta-v: not enough to land and come home. The landing was attempted anyway; it succeeded, but it left FAMMOK-2 stranded in Duna orbit with three crew.',
            specs: [
                ['Landings', 'Minmus (WSA\'s first), Mun, Duna (WSA\'s first)'],
                ['Delta-v at Duna', '≈ 2,300 m/s, not enough to land and return'],
                ['Current state', 'Stranded in Duna orbit, ≈ 81 × 202 km, 3 crew'],
                ['Earlier campaign figures', '≈ 6,000 m/s before the injection burn; ≈ 3,690 m/s lander capability; ≈ 3,100 m/s in the Duna-orbit phase']
            ],
            note: 'The campaign figures are approximate and may refer to different configurations or flight phases.',
            page: 'missions-archive.html#fammok',
            related: ['fammok-1', 'fammok-3'],
            evidence: ['Flags: "First WSA Minmus landing" (plaque "First ever landing on Minmus! Craft: Fammok 2"), "WSA second landing on Mum" (plaque "Second landing on Mum ... Craft: Fammok 2"), "First WSA landing on Duna" (plaque "Craft: WSA FAMMOK-2")', 'Current save: vessel "Fammok 2" ORBITING Duna 81 × 202 km, 3 crew', 'Operator: about 2,300 m/s at Duna, not enough to land and return; the attempt stranded them']
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3',
            designation: 'FAMMOK-3',
            category: 'landers',
            program: 'FAMMOK',
            role: 'Duna rescue mission',
            status: 'stranded',
            summary: 'FAMMOK-3 was sent to rescue FAMMOK-2\'s crew from Duna orbit. Flown as FAMMOK-3 DRSE on an Aegis-1 Super Heavy with two crew, it never reached Duna and is itself stranded in solar orbit. WSA intends a rescue in the future.',
            aliases: ['FAMMOK-3 DRSE', 'Duna Rescue'],
            specs: [
                ['Launch vehicle', 'Aegis-1 Super Heavy (AegisSH-1)'],
                ['Crew', '2'],
                ['Current state', 'Stranded in solar orbit, short of Duna']
            ],
            page: 'missions-archive.html#fammok',
            related: ['aegis-1-super-heavy', 'fammok-2'],
            evidence: ['Craft files "FAMMOK-3 Duna Rescue SE", "FAMMOK-3 DRSE AegisSH-1", "FAMMOK-3 DRSE AegisQI-1"', 'Current save: vessel "FAMMOK-3 DRSE AegisSH-1" ORBITING the Sun, 2 crew', 'Operator: FAMMOK-3 was the rescue craft, stranded in solar orbit, with a rescue intended in the future']
        },
        {
            id: 'silver-bridge',
            name: 'Silver Bridge',
            designation: 'SILVER BRIDGE',
            category: 'landers',
            program: 'Project Silver Bridge',
            role: 'Mun landing, mining and docking demonstrator',
            status: 'flown',
            summary: 'A one-off three-part spacecraft built to prove that WSA could land on the Mun and dock back with another craft in Munar orbit: a lander, a command module carrying an ISRU unit, and a prototype LunaLink relay satellite.',
            aliases: ['Project Silver Bridge'],
            specs: [
                ['Sections', 'Lander, command module with ISRU unit, LunaLink prototype relay'],
                ['Crew', '3 (2 on the lander)'],
                ['Demonstrated', 'Mun landing, surface mining, docking in Munar orbit, ISRU in Munar orbit, relay deployment'],
                ['Not achieved', 'Docking at KGOSS-1: the docking ports did not match']
            ],
            page: 'missions-archive.html#silver-bridge',
            related: ['kgoss-1', 'lunalink-1'],
            evidence: ['Save "pjsb orbit 1": "Project Silver Bridge" (68 parts, 3 crew) with mk1-3pod, ISRU, MiniDrill, radial ore tanks, two large docking ports and a probe core with two antenna stacks', 'Save "pjsb b4 depart": lander (Mk2 lander cabin, drill, 2 crew) landed on the Mun; flag "Project Silver Bridge Landing Site"', 'The probe core and antennas match "Mum ComLink Sat-Exp" (in Mun orbit)', 'Operator: confirmed that this story belongs to Silver Bridge']
        },
        {
            id: 'odysseus',
            name: 'Odysseus (OYR-1P)',
            designation: 'OYR-1P',
            category: 'landers',
            program: 'Odysseus',
            role: 'Lander development program',
            status: 'on-hold',
            summary: 'Odysseus is WSA\'s own program to build a better lander, launched on Aegis. Its crewed spacecraft made WSA\'s fourth Duna attempt. The program has been largely set aside as WSA\'s focus shifted to AutoLand.',
            aliases: ['Odysseus', 'OYR-1P', 'OYR-1P2', 'OYR'],
            specs: [['Launch vehicle', 'Aegis-1.1 Super Heavy'], ['Crew', '3']],
            page: 'missions-archive.html#odysseus',
            related: ['aegis-1-super-heavy'],
            evidence: ['Vessels "OYR-1P \"Odysseus\" + Aegis-1.1 SH" and "OYR-1P2 \"Odysseus\" + Aegis-1.1 SH" (3 crew); craft files of the same names and "Odysseus P2"', 'Operator: its own program, built on Aegis as the launcher, an attempt at a better lander, largely abandoned as focus moved to AutoLand']
        },
        {
            id: 'project-kepler',
            name: 'Project Kepler',
            designation: 'KEPLER',
            category: 'landers',
            program: 'Project Kepler',
            role: 'Crewed asteroid-capture test',
            status: 'lost',
            summary: 'A crewed spacecraft built to test asteroid capture, with a grapple, drills and an ISRU unit, launched on an Aegis-1 Super Heavy. Its command module was lost in a high-speed splashdown after a parachute failure, and its three crew were killed.',
            specs: [['Launch vehicle', 'Aegis-1 Super Heavy (AegisSH-1)'], ['Crew', '3'], ['Equipment', 'Grappling device, drills, ISRU unit']],
            page: 'missions-archive.html#project-kepler',
            related: ['aegis-1-super-heavy'],
            evidence: ['Vessel "Project Kepler + AegisSH-1" (crew Hilwell, Aldory and Hilwig Kerman; GrapplingDevice, MiniDrill ×2, ISRU) in saves "pjkb4 final mvmr1" to "pjk landing"', 'Asteroid renamed OUU-729 "Kepler" in "pjk redrt and disarm 1"', 'Operator: parachute malfunction after reentry, high-speed splashdown, three crew lost']
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
            id: 'kgoss-isru',
            name: 'KGOSS-1 ISRU Module',
            designation: 'ISRU',
            category: 'station',
            program: 'KGOSS',
            role: 'Station module (to be docked)',
            status: 'planned',
            summary: 'An ISRU module for KGOSS-1. Its first docking attempt was called off because it lacked the RCS to control the docking reliably, and it came back to a safe splashdown on Kerbin. WSA plans to dock it in the future.',
            specs: [['Launch vehicle', 'Aegis-1 Super Heavy (AegisSH-1)'], ['Status', 'First docking attempt abandoned; to be docked later']],
            page: 'kgoss.html',
            related: ['kgoss-1', 'aegis-1-super-heavy'],
            evidence: ['Save "isru1 kgosssmd det1": "KGOSS-1 ISRU + AegisSH-1" in Kerbin orbit; craft files "KGOSS-1 ISRU Module", "KGOSS-1 ISRU + AegisSH-1"', 'Operator: first docking failed for lack of RCS control; safe splashdown; to be docked in the future']
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
            summary: 'A relay satellite with an ion engine, in an 80 km circular orbit round the Mun. It follows the LunaLink prototype relay that Project Silver Bridge carried to the Mun.',
            aliases: ['LunaLink'],
            specs: [['Orbit', '≈ 80 km circular round the Mun (current save)'], ['Propulsion', 'Ion engine']],
            page: 'missions-archive.html#lunalink',
            related: ['silver-bridge'],
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
            description: 'AutoLand began as WSA\'s own landing software, written in kOS rather than relying on MechJeb. V1.6 was the last stable version before the experimental A/B series, and it could land a booster on water.',
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
            id: 'autoland-v20', stage: 'landing-control', program: 'AutoLand', status: 'completed',
            title: 'A4 Becomes AutoLand V2.0',
            description: 'The A4 build was adopted as AutoLand V2.0, the start of the V2 line that went on to add entry-burn control, a drag model, landing prediction and diagnostics.',
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
            description: 'A fuel module of about 84 tonnes is docked at KGOSS-1. A second matching tank is planned to make the station symmetrical. An ISRU module\'s first docking attempt was called off for lack of RCS control; it splashed down safely and will be docked later.',
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
            description: 'FAMMOK-2 made WSA\'s first landing on Minmus, landed on the Mun, and later made WSA\'s first landing on Duna. With about 2,300 m/s left at Duna, not enough to land and come home, the landing was attempted anyway. It succeeded, but left FAMMOK-2 stranded in Duna orbit with three crew.',
            lesson: 'Landing is only half of a mission: the vehicle needs the margin to come home.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-2'
        },
        {
            id: 'silver-bridge', stage: 'exploration', program: 'Silver Bridge', status: 'partial',
            title: 'Project Silver Bridge',
            description: 'A three-part Mun mission that proved WSA could land on the Mun, mine its surface, dock back with the command module in Munar orbit, run ISRU there and deploy a prototype LunaLink relay.',
            lesson: 'Its docking ports did not match KGOSS-1\'s, so the planned docking at the station was impossible. Compatible docking hardware matters.',
            href: 'missions-archive.html#silver-bridge', linkLabel: 'Silver Bridge record', vehicle: 'silver-bridge'
        },
        {
            id: 'fammok-3', stage: 'exploration', program: 'FAMMOK', status: 'stranded',
            title: 'FAMMOK-3 Duna Rescue',
            description: 'A rescue mission for FAMMOK-2\'s crew, launched on an Aegis-1 Super Heavy with two crew. It never reached Duna and is stranded in solar orbit; WSA intends a rescue in the future.',
            href: 'missions-archive.html#fammok', linkLabel: 'FAMMOK mission records', vehicle: 'fammok-3'
        },
        {
            id: 'odysseus', stage: 'exploration', program: 'Odysseus', status: 'flown',
            title: 'Odysseus: Fourth Duna Attempt',
            description: 'Odysseus reached Duna and entered orbit. With too little fuel for a safe landing, it deliberately did not land and returned to Kerbin.',
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
            id: 'project-kepler', stage: 'exploration', program: 'Project Kepler', status: 'lost',
            title: 'Project Kepler: Asteroid Capture',
            description: 'A crewed test of asteroid capture. Project Kepler grappled an asteroid in solar orbit; bringing it into Kerbin orbit was judged too risky, so the crew renamed it "Kepler", released it and headed home. After reentry a parachute failed, and the command module\'s high-speed splashdown killed its three crew: Hilwell, Aldory and Hilwig Kerman.',
            href: 'missions-archive.html#project-kepler', linkLabel: 'Mission record', vehicle: 'project-kepler'
        },
        {
            id: 'ssto-orbit', stage: 'guidance', program: 'Aircraft', status: 'experimental',
            title: 'Mk2 SSTO Reaches Orbit',
            description: 'A Mk2-based single-stage-to-orbit design reached roughly 200 km orbit near KGOSS with NERV engines, after an earlier design ran out of liquid fuel near 25 km.',
            lesson: 'It had never docked before and the risk of hitting KGOSS\'s centrifuge was too great, so the docking was called off. The SSTO came home and landed safely at KSC.',
            href: 'vehicles-programs.html#aircraft', linkLabel: 'Aircraft & SSTO program', vehicle: 'mk2-ssto'
        },
        {
            id: 'autoland-v22-glide', stage: 'guidance', program: 'AutoLand', status: 'demonstrated',
            title: 'AutoLand V2.2: Powered-Glide Guidance',
            description: 'V2.2 brought powered-glide guidance and landing-target correction together. Instead of a straight vertical descent, the booster manages its horizontal motion while easing toward a near-vertical landing attitude. Earlier versions had struggled with leftover horizontal speed, inaccurate touchdown prediction and large landing offsets.',
            lesson: 'In an early test the guidance was accurate enough to bring the booster down close to another booster. That attempt ended in a tip-over, but it showed how much the positioning had improved.',
            href: 'autoland.html#v22', linkLabel: 'The road to the pad'
        },
        {
            id: 'autoland-offset', stage: 'guidance', program: 'AutoLand', status: 'demonstrated',
            title: 'AutoLand V2.2: Finding Kerbin\'s Rotation',
            description: 'V2.2 kept missing its target by more than 1.6 km. A miss that large and that consistent made the team suspicious, and they realised the guidance was missing Kerbin\'s rotation: it was not separating inertial velocity from velocity relative to Kerbin\'s turning surface. With the rotation accounted for, V2.2 landed within about 500 m of its target.',
            lesson: 'The remaining few hundred metres were closed in V2.3.',
            href: 'autoland.html#offset', linkLabel: 'The road to the pad'
        },
        {
            id: 'autoland-v23-pad', stage: 'guidance', program: 'AutoLand', status: 'demonstrated',
            title: 'AutoLand V2.3: First Successful Target-Pad Landing',
            description: 'V2.3 closed the remaining few hundred metres. Its first prototype touched down on the designated landing pad, though off-centre; a later precision landing, on video, brought an Aegis Mk1.7 booster down on the pad\'s marked centre. AutoLand\'s original objective has been demonstrated.',
            lesson: 'The next phase is making the landing repeatable, dependable and ready for routine reusable-booster recovery.',
            href: 'autoland.html#pad-landing', linkLabel: 'Watch the landing', vehicle: 'aegis'
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
            id: 'autoland-v30', stage: 'next-gen', program: 'AutoLand', status: 'planned',
            title: 'AutoLand V3.0: A Dependable System',
            description: 'V3.0 is meant to be the mature, dependable AutoLand: proving that target-pad landings repeat across many attempts, different trajectories and conditions, and different Aegis configurations. Its acceptance criteria are not final yet.',
            href: 'autoland.html#roadmap', linkLabel: 'AutoLand roadmap'
        },
        {
            id: 'autoland-sites', stage: 'next-gen', program: 'AutoLand', status: 'concept',
            title: 'Landing-Site Intelligence',
            description: 'Possible future AutoLand abilities: choosing custom landing sites, primary and backup recovery locations, and awareness of each site\'s characteristics.',
            href: 'autoland.html#roadmap', linkLabel: 'AutoLand roadmap'
        },
        {
            id: 'aegis-automation', stage: 'next-gen', program: 'Aegis', status: 'concept',
            title: 'Aegis Flight Automation',
            description: 'Ideas for automating more of an Aegis flight: ascent, staging, boostback burns and custom recovery locations. These are separate from AutoLand, which handles the powered descent and landing.',
            href: 'vehicles-programs.html#aegis', linkLabel: 'Aegis program', vehicle: 'aegis'
        },
        {
            id: 'aegis-catch', stage: 'next-gen', program: 'Aegis', status: 'in-development',
            title: 'Booster Catch',
            description: 'A separate recovery project: a mechanical structure to catch and secure returning Aegis boosters instead of landing them on legs or recovering them from the sea. After considering a capture ring and cable systems, WSA chose to pursue an original chopstick-style design. The new Aegis Mk1.7 adds a hinge for the catch. More about it will be released soon; a catch has not been demonstrated yet.',
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
            vehicles: ['kgoss-1', 'kgoss-centrifuge', 'kgoss-cabins', 'kgoss-fuel-tanks', 'kgoss-isru', 'seraph-spc-1'],
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
                { at: 2, title: 'ISRU module: first docking attempt called off', basis: 'operator', source: 'operator',
                  text: 'An ISRU module launched on an Aegis-1 Super Heavy could not be controlled precisely enough for docking because it lacked RCS. A safe splashdown back on Kerbin was judged the best option.' },
                { at: 2, kind: 'planned', title: 'Planned: dock the ISRU module', basis: 'operator', source: 'operator',
                  text: 'WSA plans to dock the ISRU module in the future.' },
                { at: 2, kind: 'planned', title: 'Planned: second fuel tank', basis: 'operator', source: 'operator',
                  text: 'A second tank matching the docked fuel module is planned, to make the station symmetrical.' }
            ],
            replayNote: 'Shows one representative module flight. The order in which the modules arrived is drawn from the saves only loosely.',
            notes: ['The working orbit was discussed at about 200 km, with about 250 km considered. Under the rescaled KSRSS Reborn system, the earlier working altitude turned out to be inside the atmosphere; the current save uses the stock-scale system.'],
            links: [{ label: 'KGOSS Station', href: 'kgoss.html' }],
            evidence: ['See the kgoss-1 vehicle record']
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
            aliases: ['Aegis', 'booster recovery', 'AutoLand', 'pad landing', 'target-pad landing', 'Aegis Mk1.7', 'Quartet', 'Quintet', 'Nonet', 'Super Heavy recovery'],
            program: 'Aegis',
            objective: 'Land and recover Aegis boosters on a designated pad under WSA\'s own AutoLand guidance.',
            destination: 'Kerbin',
            vehicles: ['aegis', 'aegis-1-super-heavy'],
            status: 'demonstrated',
            outcome: 'First successful target-pad landing, with AutoLand V2.3',
            summary: 'Aegis boosters fly and come back under WSA\'s own AutoLand guidance. With AutoLand V2.3, an Aegis booster touched down directly on its designated landing pad for the first time. The next phase is making that landing repeatable and dependable.',
            locations: ['kerbin'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/apex' }, { to: 'kerbin/surface@+45' }] },
            events: [
                { at: 0, title: 'Launch', basis: 'site', source: 'gallery',
                  text: 'The Flight Gallery has Aegis on the launch pad at dawn and climbing at night.' },
                { at: 1, title: 'Booster in space', basis: 'site', source: 'gallery',
                  text: 'Flight Gallery photo of an Aegis stage in space above the horizon.' },
                { at: 1.6, title: 'AutoLand descent', basis: 'operator', source: 'operator',
                  text: 'AutoLand predicts where the booster will touch down and corrects toward the target with powered-glide guidance, easing the booster toward a near-vertical landing attitude.' },
                { at: 2, title: 'Earlier recoveries', basis: 'site', source: 'vehicles',
                  text: 'WSA\'s earlier records count more than 47 successful recoveries, including water landings. Boosters sometimes tipped over after touchdown.' },
                { at: 2, title: 'Super Heavy recovery tests', basis: 'save', source: 'save',
                  text: 'Recovery test flights of Aegis Super Heavy versions 1.1 to 1.7 are in the saves, with boosters coming down on land and in the sea.' },
                { at: 2, title: 'First target-pad landing', basis: 'operator', source: 'operator',
                  text: 'Guided by AutoLand V2.3, an Aegis booster touched down on its designated landing pad: first off-centre, then, in a precision landing on video, on the pad\'s marked centre, where the Aegis Mk1.7 booster stayed upright. The AutoLand page has the video.' }
            ],
            replayNote: 'A representative flight profile built from the program record, not one particular flight.',
            notes: [
                'AutoLand V1.6 could land a booster on water, but the booster could still tip over after touchdown.',
                'AutoLand V2.2 kept missing its target by more than 1.6 km until the team realised it was missing Kerbin\'s rotation. Accounting for the rotation cut the miss to about 500 m; V2.3 closed the rest.',
                'The game closed during the excitement after the pad landing. Nothing suggests AutoLand or the landing caused it.',
                'The booster in the landing video is the new Aegis Mk1.7 design, which adds a hinge for WSA\'s future booster catch. The catch is a separate recovery project, not part of AutoLand; more about it will be released soon.'
            ],
            links: [{ label: 'Watch the pad landing', href: 'autoland.html#pad-landing' }, { label: 'AutoLand Engineering', href: 'autoland.html' },
                    { label: 'Aegis photos', href: 'gallery.html?album=aegis' }],
            evidence: ['Vessels "KGOSS1-MD Aegis1SH/1.2SH/1.3SH/1.5SH/1.6SH/1.7SH Recovery…" and "Aegis1.62SH Recovery" in the saves (LANDED and SPLASHED on Kerbin)', 'Pad landing: operator\'s confirmation and video (recorded 15 November 2026); AutoLand script repository commits 77df774 "Added stable V2.2 … error less than 600m", cdba0fc "V2.3 prototype, on pad uncentered" and d371aca "Percision pad landing, pending V3.0 cert, added catch hinge…"'],
            verify: ['The "47+ successful recoveries" figure comes from the site\'s earlier text.']
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
            relatedMissions: ['fammok-2-minmus-mun', 'fammok-3', 'duna-crash', 'odysseus'],
            crew: 3,
            status: 'stranded',
            outcome: 'First WSA Duna landing; stranded in Duna orbit',
            summary: 'A second FAMMOK-2 flew to Duna with three crew. With about 2,300 m/s of delta-v, not enough to land and come home, the landing was attempted anyway. FAMMOK-2 made WSA\'s first landing on Duna and lifted off again, but was left stranded in Duna orbit. WSA counts it as the first of four attempts to reach Duna.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/high' }, { to: 'duna/surface' }, { to: 'duna/low' }], endOrbit: true },
            events: [
                { at: 1, title: 'Departure from Kerbin', basis: 'save', source: 'save',
                  text: 'FAMMOK-2 left Kerbin orbit for Duna with three crew.' },
                { at: 2, title: 'Duna orbit', basis: 'save', source: 'save',
                  text: 'It arrived in an orbit of about 258 × 260 km round Duna.' },
                { at: 2, kind: 'decision', title: 'Landing attempted without the margin to return', basis: 'operator', source: 'operator',
                  text: 'About 2,300 m/s of delta-v was left: not enough to land on Duna and come home. The landing was attempted anyway.' },
                { at: 2.5, title: 'Parachute problem', basis: 'site', source: 'archive',
                  text: 'WSA\'s archive records that the parachute malfunctioned or under-performed during the descent.' },
                { at: 3, title: 'First WSA landing on Duna', basis: 'save', source: 'save',
                  text: 'FAMMOK-2 landed on Duna, and a flag reading "Craft: WSA FAMMOK-2" marks WSA\'s first Duna landing.' },
                { at: 4, title: 'Stranded in Duna orbit', basis: 'save', source: 'save',
                  text: 'It lifted off and returned to an orbit of about 81 × 202 km, without the delta-v to come home. It is still there with its three crew.' }
            ],
            replayNote: 'Duna orbit, the landing and the return to orbit are recorded; the transfer is schematic.',
            notes: ['Earlier campaign figures (approximate, possibly from different configurations or phases): about 6,000 m/s before the injection burn, about 3,690 m/s lander capability, about 3,100 m/s in the Duna-orbit phase.'],
            conflicts: ['Duna orbit: the earlier archive gives about 440 × 260 km; the arrival checkpoint in the saves shows about 258 × 260 km. They may describe different moments.'],
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['Saves "fm2dunab4tb" … "fam2 duna b4 transfer" (see the vehicle record); current save: Fammok 2 in Duna orbit 81 × 202 km, 3 crew; flag "First WSA landing on Duna"', 'Operator: about 2,300 m/s, not enough to land and return; the attempt stranded them'],
            verify: ['The parachute problem is from the earlier archive; the saves cannot confirm it.']
        },
        {
            id: 'fammok-3',
            name: 'FAMMOK-3 Duna rescue',
            aliases: ['FAMMOK', 'FAMMOK-3', 'FAMMOK-3 DRSE', 'rescue', 'Duna rescue attempt', 'Aegis-1 Super Heavy'],
            program: 'FAMMOK',
            objective: 'Rescue FAMMOK-2\'s crew from Duna orbit.',
            destination: 'Duna',
            launchVehicle: 'Aegis-1 Super Heavy',
            vehicles: ['fammok-3', 'aegis-1-super-heavy'],
            relatedMissions: ['fammok-2', 'duna-crash', 'odysseus'],
            crew: 2,
            status: 'stranded',
            outcome: 'Stranded in solar orbit, short of Duna',
            summary: 'FAMMOK-3 was sent to rescue FAMMOK-2\'s stranded crew. Flown as FAMMOK-3 DRSE on an Aegis-1 Super Heavy with two crew, it never reached Duna and is itself stranded in solar orbit. WSA intends a rescue in the future.',
            locations: ['kerbin', 'solar', 'duna'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'solar:kerbin>duna@0.55' }], endOrbit: true },
            planned: [{ from: 1, legs: [{ to: 'duna/low' }], label: 'Intended: reach FAMMOK-2 at Duna' }],
            events: [
                { at: 0, title: 'Launch on Aegis-1 Super Heavy', basis: 'save', source: 'save',
                  text: 'FAMMOK-3 DRSE lifted off on an Aegis-1 Super Heavy with two crew.' },
                { at: 2, title: 'Stranded in solar orbit', basis: 'operator', source: 'operator',
                  text: 'The rescue craft became stranded in orbit round Kerbol. In the current save it is still there with its two crew, on an orbit that reaches from inside Duna\'s orbit to beyond Dres\'s.' },
                { at: 2, kind: 'planned', title: 'Planned: a future rescue', basis: 'operator', source: 'operator',
                  text: 'WSA intends to carry out a rescue in the future.' }
            ],
            replayNote: 'Where it is in solar orbit is drawn for illustration only.',
            links: [{ label: 'FAMMOK program', href: 'missions-archive.html#fammok' }],
            evidence: ['See the fammok-3 vehicle record']
        },
        {
            id: 'duna-crash',
            name: 'Duna attempt (crashed into Duna)',
            aliases: ['Duna attempt', 'crash', 'Duna crash'],
            program: 'Not recorded',
            destination: 'Duna',
            craft: ['Craft (name not recorded)'],
            relatedMissions: ['fammok-2', 'fammok-3', 'odysseus'],
            status: 'lost',
            outcome: 'Crashed into Duna',
            summary: 'One of WSA\'s attempts to reach Duna before Odysseus. It reached Duna but crashed into the planet. The craft\'s name, its purpose and the cause of the crash are not recorded.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/near' }, { to: 'duna/surface' }] },
            events: [
                { at: 3, title: 'Crashed into Duna', basis: 'operator', source: 'operator',
                  text: 'The craft crashed into Duna. Its name and the cause are not recorded.' }
            ],
            replayNote: 'Every leg is schematic; only the crash at Duna is recorded.',
            links: [],
            verify: ['Which craft was it and what was it for? The operator says it was not a rescue craft.']
        },
        {
            id: 'odysseus',
            name: 'Odysseus',
            aliases: ['Duna', 'fourth Duna attempt', 'OYR-1P', 'OYR'],
            program: 'Odysseus',
            objective: 'Reach Duna, and land if it was safe to.',
            destination: 'Duna',
            launchVehicle: 'Aegis-1.1 Super Heavy',
            vehicles: ['odysseus', 'aegis-1-super-heavy'],
            relatedMissions: ['fammok-2', 'fammok-3', 'duna-crash'],
            crew: 3,
            status: 'flown',
            outcome: 'Reached Duna orbit, did not land, returned to Kerbin',
            summary: 'The fourth attempt to reach Duna, flown by WSA\'s Odysseus lander program. Odysseus entered orbit around Duna, but with too little fuel for a safe landing it deliberately did not try to land, and returned to Kerbin instead.',
            locations: ['kerbin', 'duna', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'duna/low' }, { to: 'kerbin/near' }] },
            planned: [{ from: 2, legs: [{ to: 'duna/surface' }], label: 'Intended landing (not attempted)' }],
            events: [
                { at: 0, title: 'Launch on Aegis-1.1 Super Heavy', basis: 'save', source: 'save',
                  text: 'Odysseus (OYR-1P) lifted off on an Aegis-1.1 Super Heavy with three crew.' },
                { at: 0, title: 'Fourth attempt to reach Duna', basis: 'operator', source: 'operator',
                  text: 'Odysseus followed FAMMOK-2, the FAMMOK-3 rescue mission and a craft that crashed into Duna.' },
                { at: 2, title: 'In orbit around Duna', basis: 'save', source: 'save',
                  text: 'Odysseus entered an orbit of about 95 × 108 km round Duna.' },
                { at: 2, kind: 'decision', title: 'Landing not attempted', basis: 'operator', source: 'operator',
                  text: 'The fuel left was not enough to make a landing acceptably safe, so the landing was deliberately not attempted.' },
                { at: 3, title: 'Returned to Kerbin', basis: 'operator', source: 'operator',
                  text: 'Odysseus left Duna orbit and returned to Kerbin.' }
            ],
            replayNote: 'The transfers are schematic.',
            notes: ['The Odysseus program was an attempt to build a better lander, launched on Aegis. It has been largely set aside as WSA\'s focus shifted to AutoLand.',
                    'The Flight Gallery has an "Odysseus Test" photo of a test flight high above the planet.'],
            links: [{ label: 'Odysseus test photo', href: 'gallery.html?album=odysseus' }],
            evidence: ['See the odysseus vehicle record. Saves "oyr1 duna orbit ar" (Duna 95 × 108 km), "oyr1 before entry"; a "Plan A" branch (OYR-1P2) landed on Duna in "oyr1p2 plan a land", but the operator confirms Odysseus never landed: that branch was not kept']
        },
        {
            id: 'jool-satellite',
            name: 'Unintended Jool satellite',
            aliases: ['Duna satellite', 'Vall', 'Laythe', 'gravity assist'],
            program: 'Not recorded',
            objective: 'Orbit Duna.',
            destination: 'Duna (intended); Jool system',
            craft: ['Relay Probe wdy'],
            status: 'lost',
            outcome: 'Contact lost; last known in Jool orbit',
            summary: 'A relay probe, Relay Probe wdy, meant for Duna orbit. An accidental gravity assist sent it to Vall instead. It later tried to reach Laythe, lost contact with Kerbin during the capture burn, and was last known to be in Jool orbit.',
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
            notes: ['Flown in an earlier save that used a different set of mods. It is WSA\'s only craft in the Jool system.'],
            links: [],
            evidence: ['A probe called "Relay Probe wdy" orbits and then leaves a body the save calls Vall in the earlier [NEW]MODDEDWSASANDBOX save, within days of launch. That save used a different planet setup, so it cannot be matched to this story with confidence. Is that the satellite, and what is its name?']
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
            aliases: ['Kepler', 'asteroid', 'grapple', 'asteroid capture', 'OUU-729'],
            program: 'Project Kepler',
            objective: 'Test asteroid capture with a crewed spacecraft.',
            destination: 'An asteroid in solar orbit',
            launchVehicle: 'Aegis-1 Super Heavy',
            vehicles: ['project-kepler', 'aegis-1-super-heavy'],
            crew: 3,
            status: 'lost',
            outcome: 'Asteroid captured; crew lost at splashdown',
            summary: 'A crewed test of asteroid capture. Project Kepler grappled an asteroid in solar orbit, but bringing it into Kerbin orbit was judged too risky, so the crew renamed it "Kepler", released it and headed home. After reentry a parachute failed, and the command module\'s high-speed splashdown killed its three crew: Hilwell Kerman, Aldory Kerman and Hilwig Kerman.',
            locations: ['kerbin', 'solar'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'solar:kerbin>eve@0.08' }, { to: 'kerbin/air' }, { to: 'kerbin/surface' }] },
            planned: [{ from: 2, legs: [{ to: 'kerbin/high' }], label: 'Considered: bring the asteroid to Kerbin orbit' }],
            events: [
                { at: 1, title: 'Leaving Kerbin', basis: 'save', source: 'save',
                  text: 'Project Kepler left Kerbin\'s sphere of influence with three crew, a grapple, drills and an ISRU unit.' },
                { at: 2, title: 'Asteroid captured', basis: 'save', source: 'save',
                  text: 'It met an asteroid in solar orbit near Kerbin\'s own orbit round Kerbol and grabbed it with its grapple.' },
                { at: 2, kind: 'decision', title: 'Not brought to Kerbin', basis: 'operator', source: 'operator',
                  text: 'Bringing the asteroid into Kerbin orbit was judged too risky. The crew renamed it OUU-729 "Kepler", released it and headed home.' },
                { at: 3, title: 'Reentry', basis: 'save', source: 'save',
                  text: 'The spacecraft came back into Kerbin\'s atmosphere with its three crew.' },
                { at: 4, title: 'Parachute failure', basis: 'operator', source: 'operator',
                  text: 'A parachute malfunctioned, and the command module hit the sea at high speed. Hilwell Kerman, Aldory Kerman and Hilwig Kerman were killed.' }
            ],
            replayNote: 'The asteroid\'s position is drawn for illustration only.',
            notes: ['In memory of Hilwell Kerman, Aldory Kerman and Hilwig Kerman.'],
            links: [],
            evidence: ['See the project-kepler vehicle record. The asteroid "OUU-729 \"Kepler\"" appears from save "pjk redrt and disarm 1"']
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
            summary: 'A relay satellite with an ion engine, following the LunaLink prototype that Project Silver Bridge released at the Mun. In the current save it is in an 80 km circular orbit round the Mun.',
            relatedMissions: ['silver-bridge'],
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
            aliases: ['Silver Bridge', 'ISRU', 'Mun mining', 'LunaLink prototype'],
            program: 'Project Silver Bridge',
            objective: 'Prove that WSA could land on the Mun and dock back with another craft in Munar orbit.',
            destination: 'Mun',
            vehicles: ['silver-bridge'],
            craft: ['LunaLink prototype relay'],
            relatedMissions: ['lunalink', 'kgoss-1'],
            crew: 3,
            status: 'partial',
            outcome: 'Mun landing, mining, docking and ISRU proved; could not dock at KGOSS',
            summary: 'A three-part spacecraft (a lander, a command module carrying an ISRU unit, and a prototype LunaLink relay) that proved WSA could land on the Mun, mine its surface, dock back in Munar orbit and run ISRU there. Its docking ports did not match KGOSS-1\'s, so the planned final docking at the station was impossible.',
            locations: ['kerbin', 'lko', 'kgoss', 'mun'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'mun/low' }, { to: 'mun/surface' }, { to: 'mun/low' }, { to: 'kerbin/low' }] },
            planned: [{ from: 5, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS-1' }],
            events: [
                { at: 2, title: 'Low Munar orbit', basis: 'save', source: 'save',
                  text: 'Project Silver Bridge reached Munar orbit with three crew and lowered its orbit to about 60 km.' },
                { at: 3, title: 'Landing and mining on the Mun', basis: 'save', source: 'save',
                  text: 'The lander touched down with two crew, who planted a flag named "Project Silver Bridge Landing Site". The mission proved WSA can mine on the Mun\'s surface.' },
                { at: 4, title: 'Docked back in Munar orbit', basis: 'operator', source: 'operator',
                  text: 'The lander returned to orbit and docked with the command module, which carries the ISRU unit, and ISRU was run in Munar orbit.' },
                { at: 4, title: 'LunaLink prototype deployed', basis: 'operator', source: 'operator',
                  text: 'The prototype LunaLink relay was released at the Mun. WSA has since put LunaLink-1 into Munar orbit.' },
                { at: 5, title: 'Could not dock with KGOSS', basis: 'operator', source: 'operator',
                  text: 'The plan was to bring the command module and lander home together and dock them at KGOSS-1, but their docking ports did not match the station\'s.' },
                { at: 5, title: 'Recovery', basis: 'site', source: 'archive',
                  text: 'WSA\'s earlier archive records that the vehicle was nearly stranded in low Kerbin orbit and that a rescue mission recovered the vehicle and crew.' }
            ],
            replayNote: 'The order of events is documented; the legs between them are schematic.',
            notes: ['Lesson: compatible docking hardware, return options and rescue planning are essential.'],
            conflicts: ['Recovery: the earlier archive says a rescue mission recovered the vehicle and crew; the Hangar and Development Timeline said only that the near-stranding required recovery planning.'],
            links: [{ label: 'Silver Bridge in the Hangar', href: 'vehicles-programs.html?vehicle=silver-bridge#hangar' }],
            evidence: ['See the silver-bridge vehicle record; the relay is probably the vessel "Mum ComLink Sat-Exp" (same parts) still in Mun orbit'],
            verify: ['Which craft carried out the rescue from low Kerbin orbit, if there was one?']
        },
        {
            id: 'silver-connect',
            name: 'Project Silver Connect',
            aliases: ['Silver Connect', 'Mun landing'],
            program: 'Not recorded',
            destination: 'Mun',
            launchVehicle: 'AG-1 SH',
            craft: ['Project Silver Connect'],
            relatedMissions: ['silver-bridge'],
            crew: 3,
            status: 'record-incomplete',
            outcome: 'Landed on the Mun; later in Kerbin orbit',
            summary: 'A later crewed flight that landed on the Mun, where its crew planted a flag named "Project Silver Connect Landing Site". Later saves have it in Kerbin orbit with three crew. Its purpose has not been documented yet.',
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
            verify: ['What was Silver Connect for, and what do "AG-1 SH" and "ERCY" stand for? Its crew included Hilwell, Barley and Hilwig Kerman.']
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
            status: 'partial',
            outcome: 'Reached KGOSS\'s orbit; docking aborted; landed at KSC',
            summary: 'A Mk2-based single-stage-to-orbit spaceplane reached KGOSS\'s orbit at about 200 km with RAPIER and NERV engines. Docking had never been done with it before and the risk of hitting the station\'s centrifuge was too great, so the docking was aborted and the SSTO flew home, landing safely at KSC.',
            locations: ['kerbin', 'lko', 'kgoss'],
            route: { start: 'kerbin/surface', legs: [{ to: 'kerbin/low' }, { to: 'kerbin/surface@+60' }] },
            planned: [{ from: 1, legs: [{ to: 'kgoss' }], label: 'Intended: dock with KGOSS' }],
            events: [
                { at: 0, title: 'Earlier design: out of fuel near 25 km', basis: 'site', source: 'hangar',
                  text: 'An earlier version of the design ran out of liquid fuel near 25 km.' },
                { at: 1, title: 'In KGOSS\'s orbit', basis: 'save', source: 'save',
                  text: 'The docking-test version, with four RAPIER and two NERV engines and two crew, reached an orbit of about 200 × 205 km near the station.' },
                { at: 1, kind: 'decision', title: 'Docking aborted', basis: 'operator', source: 'operator',
                  text: 'Docking had never been done with it before, and the risk of hitting KGOSS\'s centrifuge was too great, so the attempt was called off.' },
                { at: 2, title: 'Landed at KSC', basis: 'operator', source: 'operator',
                  text: 'The SSTO returned and landed safely back at KSC.' }
            ],
            replayNote: 'The climb to orbit and the return are schematic.',
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
            id: 'autoland-pad-landing',
            title: 'AutoLand V2.3 Pad Landing',
            summary: 'An Aegis booster on its landing pad after AutoLand\'s first target-pad landing',
            categories: ['landings'],
            related: { label: 'Watch the landing on the AutoLand page', href: 'autoland.html#pad-landing' },
            images: [
                { src: 'images/gallery/missions/autoland-pad-landing.jpg', thumb: 'images/gallery/missions/thumbs/autoland-pad-landing.jpg',
                  alt: 'Aegis Mk1.7 booster standing upright on the landing pad, with smoke drifting across the grass after touchdown',
                  caption: 'An Aegis Mk1.7 on the pad after AutoLand V2.3\'s precision landing' }
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
    /*
     * News, newest first. The home page shows the first two entries; news.html shows them all.
     *   id        unique; news.html#<id> links to the story                                   required
     *   date      'YYYY-MM-DD'                                                                 required
     *   title, summary                                                                         required
     *   topic     a short label shown next to the date
     *   image     { src, thumb, alt }
     *   body      paragraphs of plain text, shown on news.html
     *   links     [{ label, href }]
     */
    NEWS: [
        {
            id: 'novaui-2',
            date: '2026-11-23',
            topic: 'Website',
            featured: true,
            title: 'Introducing NovaUI 2.0',
            summary: 'NovaUI 2.0 is the new design of the WSA website. The homepage now sits inside a live 3D Kerbol system, its panels are Liquid Glass, and every page shares one design language.',
            image: { src: 'images/news/novaui-2.jpg', thumb: 'images/news/thumbs/novaui-2.jpg',
                     alt: 'The words NovaUI 2.0 in slim obsidian lettering on black' },
            body: [
                'The homepage is drawn live in your browser. Kerbin, the Mun, Duna, Jool and the rest of the Kerbol system turn behind the page, with a galaxy, nebulae and an asteroid swarm beyond them. Moving from one section to the next takes the camera to a new place in the system, and on wider screens each world is framed beside the text rather than behind it.',
                'Click a world, or Explore the universe, to fly round the system. Each world shows its real radius and gravity and the WSA missions that went there. On phones, its record is a sheet along the bottom of the screen, and the world is framed in the space above it.',
                'The homepage\'s panels are Liquid Glass: clear panes the universe shows through, with light along their edges and a faint split of colour at the rim. Every other page now shares the homepage\'s look: the same deep sky, the same glass cards and type, and a world of its own on the horizon.',
                'The homepage intro now opens with the NovaUI 2.0 title in slim obsidian lettering, and its sound is on by default. Your browser may wait for your first click or tap before playing it, and if you turn it off, it stays off.',
                'The original design is still there: choose Version 1.0 under Design in Settings, on any page.'
            ],
            video: { src: 'media/news/novaui-2-film.mp4', poster: 'images/news/novaui-2-film.jpg',
                     label: 'The NovaUI 2.0 film',
                     caption: 'The NovaUI 2.0 film (24 seconds, with sound): the intro, the live homepage, Liquid Glass, and Explore on a phone.' },
            links: [{ label: 'Explore the universe', href: 'index.html#explore' },
                    { label: 'Watch the intro again', href: 'index.html?intro' }]
        },
        {
            id: 'two-new-games',
            date: '2026-11-17',
            topic: 'Games',
            title: 'Two New Games Released: WSA Engineering Sandbox and Aegis Landing Simulator',
            summary: 'WSA has expanded its Games collection with two new interactive 3D experiences. The Engineering Sandbox lets visitors experiment with propulsion, staging, orbits and landing, while the Aegis Landing Simulator challenges players to bring a reusable booster down onto its recovery pad. Both run in the browser with touch controls for phones.',
            image: { src: 'images/games/aegis-landing/aegis-landing.jpg', thumb: 'images/games/aegis-landing/aegis-landing.jpg',
                     alt: 'The Aegis Landing Simulator\'s booster descending on its engines with its landing legs deployed' },
            body: [
                'The WSA Engineering Sandbox is a small aerospace laboratory in 3D. Its seven experiments cover an engine test stand with a side-by-side engine comparison, a thrust-to-weight and lift-off lab, multi-stage rockets, orbital burns, Hohmann transfers, a booster landing lab and a free-play rocket sandbox. Basic mode explains each setting in plain words; Pro mode exposes the full set of parameters, from specific impulse to the integrator\'s time step. Every experiment has live telemetry, graphs, an event log, replays and a debrief.',
                'The Aegis Landing Simulator puts you at the controls of a reusable booster in its final descent. Manage the throttle, propellant and the booster\'s attitude to touch down upright on the pad, at Easy, Normal or Hard difficulty. Each attempt ends with an honest score, an award and a certificate you can download or share.',
                'The landing game is inspired by WSA\'s reusable booster programme; it is not a recreation of AutoLand\'s real pad landing. Its booster is a temporary model with illustrative values, built so that a finished Aegis model can replace it later.',
                'Both games run in the browser on computers and phones, with keyboard, mouse and touch controls.'
            ],
            links: [{ label: 'Play Aegis Landing Simulator', href: 'aegis-landing.html' },
                    { label: 'Open the Engineering Sandbox', href: 'engineering-sandbox.html' },
                    { label: 'All games', href: 'games.html' }]
        },
        {
            id: 'autoland-v23-pad-landing',
            date: '2026-11-15',
            topic: 'AutoLand',
            title: 'AutoLand V2.3 lands an Aegis booster on its target pad',
            summary: 'WSA\'s own landing software has brought an Aegis booster down directly on its designated landing pad. AutoLand\'s original objective is demonstrated; next comes making the landing repeatable and dependable.',
            image: { src: 'images/gallery/missions/autoland-pad-landing.jpg', thumb: 'images/gallery/missions/thumbs/autoland-pad-landing.jpg',
                     alt: 'Aegis Mk1.7 booster standing upright on its landing pad after touchdown' },
            body: [
                'AutoLand V2.2 kept missing its target by more than 1.6 km. A miss that large and that consistent made the team suspicious, and they realised the guidance was missing Kerbin\'s rotation. With the rotation accounted for, V2.2 came down within about 500 m of its target.',
                'V2.3 closed the remaining few hundred metres. Its first prototype touched down on the pad, though off-centre. The precision landing in the video put the booster down on the pad\'s marked centre, where it stayed upright.',
                'The booster in the video is the new Aegis Mk1.7 design. It adds a hinge for WSA\'s future booster catch, and more about the catch will be released soon.',
                'Next, AutoLand has to show that the landing can be repeated reliably, on the way to V3.0: a mature, dependable system for routine booster recovery.'
            ],
            links: [{ label: 'Watch the landing and read the full story', href: 'autoland.html#pad-landing' },
                    { label: 'Photo in the Flight Gallery', href: 'gallery.html?album=autoland-pad-landing' }]
        }
    ],

    SEARCH_PAGES: [
        { title: 'Vehicle Hangar',               href: 'vehicles-programs.html#hangar',      type: 'Registry', keywords: 'vehicles registry' },
        { title: 'Development Timeline',         href: 'goals-achievements.html#timeline',   type: 'Timeline', keywords: 'milestones history progress' },
        { title: 'Flight Gallery',               href: 'gallery.html',                       type: 'Gallery',  keywords: 'images screenshots photos' },
        { title: 'AutoLand Engineering',         href: 'autoland.html',                      type: 'Program',  keywords: 'kOS landing guidance V1.6 A1 A4 B1 V2.0 V2.1 V2.2 V2.3 V3.0 glide pad landing Kerbin rotation video' },
        { title: 'News',                         href: 'news.html',                          type: 'Page',     keywords: 'news latest updates announcements breakthrough' },
        { title: 'KGOSS Station',                href: 'kgoss.html',                         type: 'Program',  keywords: 'station KGOSS-1 KGOSS-3 Haven Seraph centrifuge orbit' },
        { title: 'Flight Dynamics Center',       href: 'flight-dynamics.html',               type: 'Tools',    keywords: 'calculator tools orbit circular orbital speed period escape velocity Hohmann transfer delta-v rocket equation Isp TWR thrust weight mu gravitational parameter' },
        { title: 'Games',                        href: 'games.html',                         type: 'Page',     keywords: 'game games play minigame builder simulator' },
        { title: 'Station Builder',              href: 'game.html',                          type: 'Game',     keywords: 'game minigame build station modules docking KGOSS solar truss' },
        { title: 'Docking Simulator',            href: 'docking-simulator.html',             type: 'Game',     keywords: 'game simulator docking dock spacecraft rendezvous approach RCS first person' },
        { title: 'SSTO Landing',                 href: 'ssto-landing.html',                  type: 'Game',     keywords: 'game landing land spaceplane SSTO runway aircraft flight approach touchdown spaceport' },
        { title: 'Orbital Rendezvous Challenge', href: 'orbital-rendezvous.html',            type: 'Game',     keywords: 'game orbit orbital rendezvous transfer Hohmann intercept KGOSS docking delta-v prograde retrograde velocity' },
        { title: 'Aegis Landing Simulator',      href: 'aegis-landing.html',                 type: 'Game',     keywords: 'game Aegis booster landing land pad recovery reusable vertical landing VTVL difficulty certificate award' },
        { title: 'WSA Engineering Sandbox',      href: 'engineering-sandbox.html',           type: 'Game',     keywords: 'game sandbox engineering laboratory lab 3D engine test stand thrust specific impulse Isp TWR thrust-to-weight lift-off staging stage rocket equation delta-v orbit orbital mechanics Hohmann transfer landing booster guidance physics experiment' },
        { title: 'FAMMOK Program',               href: 'missions-archive.html#fammok',       type: 'Program',  keywords: 'Mun Minmus Duna lander' },
        { title: 'Project Silver Bridge',        href: 'missions-archive.html#silver-bridge', type: 'Mission', keywords: 'Mun ISRU drilling docking relay' },
        { title: 'Aegis Program',                href: 'vehicles-programs.html#aegis',       type: 'Program',  keywords: 'booster recovery Mark II Mark V Mk1.7 catch hinge chopstick' },
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
