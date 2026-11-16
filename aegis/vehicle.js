// Aegis Landing Simulator: the vehicle. Two separate things live here:
//
//   VEHICLE       the simulation values (mass, thrust, geometry). They are ILLUSTRATIVE game values chosen to
//                 make a fair, flyable landing. They are not the dimensions, masses or engine figures of
//                 WSA's real Aegis booster, which this page does not claim to know.
//   createModel   the 3D model factory. The first release draws a placeholder booster from simple shapes.
//
// Replacing the placeholder with a finished Aegis model
//   The game never looks inside the model. world.js only calls createModel(THREE, mats) and then uses the
//   handle it returns:
//     group            THREE.Object3D whose origin is the centre of the base of the booster (where the
//                      engine bells end), +y along the body, so it can be posed from the physics state
//     setLegs(f)       0 = stowed, 1 = deployed and locked (the physics deploys them automatically)
//     setEngine(p, t)  engine power 0–1 and the time in seconds, to animate the exhaust
//     dispose()        frees its geometry and materials
//   A model made in Blender (or similar) can be exported as glTF into images/games/aegis-landing/ and loaded
//   by a new factory with the same four members (three.js's GLTFLoader would then need adding to
//   vendor/three/addons). Its legs should be separate nodes so setLegs can swing them, and its feet should
//   sit VEHICLE.legSpan from the axis so touchdowns look the way the physics computes them.

export const VEHICLE = Object.freeze({
    // Mass and propulsion (illustrative)
    dry: 18000,             // kg without landing propellant
    thrust: 520000,         // N, all three landing engines at full throttle
    isp: 290,               // s
    // Attitude control (illustrative)
    rcsAccel: 0.45,         // rad/s² from the cold-gas thrusters at full stick
    gimbalAccel: 0.7,      // rad/s² more from gimballing the engines at full thrust
    aeroDamp: 0.45,         // 1/s rotation damping from the grid fins at speed
    assistLean: 0.35,       // rad: lean at full stick with attitude hold on (about 20°)
    // Aerodynamics (illustrative)
    cd: 0.75,
    area: Math.PI * 1.7 * 1.7,
    // Geometry (m, illustrative)
    height: 26, radius: 1.7, cg: 9.5, legSpan: 4.6,
    legsAlt: 150,           // m: the legs swing down below this height
    crashSpeed: 10,         // m/s: faster than this into the ground and the legs cannot save it
});

/* ---------- Placeholder model ---------- */

function textTexture(THREE, text, w, h, font, color) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** The procedural placeholder booster: white body, dark interstage, grid fins, three engines, four legs. */
export function createModel(THREE, plume) {
    const V = VEHICLE;
    const std = o => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.15, ...o });
    const m = {
        body: std({ color: '#eef1f4', roughness: 0.42 }),
        dark: std({ color: '#262b33', roughness: 0.55, metalness: 0.35 }),
        steel: std({ color: '#545c66', roughness: 0.45, metalness: 0.6 }),
        bell: std({ color: '#33363b', roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide }),
        band: std({ color: '#1e3a8a', roughness: 0.5 }),
        soot: std({ color: '#9aa1aa', roughness: 0.8 }),
        decal: new THREE.MeshStandardMaterial({ map: textTexture(THREE, 'WSA', 256, 128, 'bold 96px system-ui, sans-serif', '#1d4ed8'), transparent: true, roughness: 0.5 }),
        name: new THREE.MeshStandardMaterial({ map: textTexture(THREE, 'AEGIS', 512, 128, 'bold 90px system-ui, sans-serif', '#1e293b'), transparent: true, roughness: 0.5 }),
    };
    const group = new THREE.Group();
    const R = V.radius;
    const parts = [];
    const add = (geo, mat, y, extra) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true; if (extra) extra(mesh); group.add(mesh); parts.push(mesh); return mesh; };

    // Engines: three bells in a triangle, with exhaust plumes from plume()
    const plumes = [];
    const bellH = 1.25, bellR = 0.52;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(bellR * (0.35 + 0.65 * Math.pow(t, 0.7)), bellH * (1 - t))); }
    const bellGeo = new THREE.LatheGeometry(pts, 24);
    for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * R * 0.48, z = Math.sin(a) * R * 0.48;
        const bell = new THREE.Mesh(bellGeo, m.bell);
        bell.position.set(x, 0, z);
        bell.castShadow = true;
        group.add(bell);
        parts.push(bell);
        const pl = plume(bellR * 0.92);
        pl.position.set(x, 0, z);
        group.add(pl);
        plumes.push(pl);
    }
    // Thrust section, sooty skirt, body, blue band, decals, interstage, grid fins, cap
    add(new THREE.CylinderGeometry(R * 1.04, R * 1.08, 1.6, 40), m.dark, bellH + 0.8);
    add(new THREE.CylinderGeometry(R, R * 1.04, 2.4, 40), m.soot, bellH + 2.8);
    const bodyH = V.height - bellH - 4 - 2.6;
    add(new THREE.CylinderGeometry(R, R, bodyH, 48), m.body, bellH + 4 + bodyH / 2);
    add(new THREE.CylinderGeometry(R * 1.004, R * 1.004, 0.55, 48), m.band, bellH + 4 + 2.2);
    add(new THREE.CylinderGeometry(R * 1.004, R * 1.004, 0.25, 48), m.band, bellH + 4 + bodyH - 1.2);
    add(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 3.4, 48, 1, true, -0.5, 1.0), m.decal, bellH + 4 + bodyH * 0.62, me => { me.rotation.y = Math.PI / 2; me.castShadow = false; });
    add(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 1.5, 48, 1, true, -1.3, 2.6), m.name, bellH + 4 + bodyH * 0.38, me => { me.rotation.y = Math.PI / 2; me.castShadow = false; });
    const topY = bellH + 4 + bodyH;
    add(new THREE.CylinderGeometry(R, R, 2.6, 48), m.dark, topY + 1.3);
    add(new THREE.CylinderGeometry(R * 0.96, R, 0.3, 48), m.steel, topY + 2.75);
    const finGeo = new THREE.BoxGeometry(1.5, 1.25, 0.1);
    const finFrame = new THREE.BoxGeometry(0.12, 1.25, 0.5);
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const fin = new THREE.Group();
        const plate = new THREE.Mesh(finGeo, m.steel);
        plate.position.x = 0.75;
        const arm = new THREE.Mesh(finFrame, m.dark);
        fin.add(plate, arm);
        fin.position.set(Math.cos(a) * R, topY + 1.2, Math.sin(a) * R);
        fin.rotation.y = -a;
        group.add(fin);
        parts.push(plate, arm);
    }

    // Legs: hinged on the skirt, folded up along the body, swung down and out to put the feet VEHICLE.legSpan
    // from the axis at ground level (the base of the bells)
    const legs = [];
    const hingeY = 5.6;
    const legLen = Math.hypot(V.legSpan - R, hingeY);
    const deployed = Math.atan2(V.legSpan - R, hingeY);
    const legGeo = new THREE.BoxGeometry(0.3, legLen, 0.42);
    const strutGeo = new THREE.CylinderGeometry(0.07, 0.07, legLen * 0.55, 8);
    const footGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.2, 16);
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * R, hingeY, Math.sin(a) * R);
        pivot.rotation.y = -a;
        const swing = new THREE.Group();
        pivot.add(swing);
        const leg = new THREE.Mesh(legGeo, m.dark);
        leg.position.y = -legLen / 2;
        leg.castShadow = true;
        const strut = new THREE.Mesh(strutGeo, m.steel);
        strut.position.set(-0.25, -legLen * 0.3, 0);
        strut.rotation.z = 0.25;
        const foot = new THREE.Mesh(footGeo, m.steel);
        foot.position.y = -legLen;
        foot.castShadow = true;
        swing.add(leg, strut, foot);
        group.add(pivot);
        legs.push(swing);
        parts.push(leg, strut, foot);
    }
    const stowed = Math.PI - 0.06;
    function setLegs(f) {
        const e = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
        for (const s of legs) s.rotation.z = stowed + (deployed - stowed) * e;
    }
    setLegs(0);

    return {
        group, plumes,
        setLegs,
        setEngine(power, time) {
            for (const p of plumes) p.userData.set(power, time);
        },
        dispose() {
            for (const p of parts) p.geometry.dispose();
            bellGeo.dispose();
            for (const mat of Object.values(m)) { if (mat.map) mat.map.dispose(); mat.dispose(); }
        },
    };
}
