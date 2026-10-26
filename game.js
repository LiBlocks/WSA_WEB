// KGOSS Station Builder (game.html): drag station modules into orbit and join their docking ports, then
// press Done to export the station as a PNG. The image is drawn from the build itself (module types,
// positions, rotations and connections), never captured from the page, so no interface ends up in it.
(function () {
    const builder = document.getElementById('builder');
    if (!builder) return;

    const WORLD = { w: 1000, h: 700 };  // assembly area, in the canvas's viewBox units
    const SNAP = 30;                    // units within which a dragged port docks to a free one
    const DRAG_START = 6;               // px a palette part has to move before it counts as a drag
    const NUDGE = 10;                   // units per arrow-key press
    const EXPORT_PAD = 60;              // units of space around the station in the image
    const EXPORT_LONG_SIDE = 2000;      // px, the image's longer side (small builds are capped at 6×)
    const FILE_NAME = 'WSA-KGOSS-Station-Build.png';

    /* ---------- Modules ---------- */

    const C = {
        hull: '#dde3eb', shade: '#a9b3c1', line: '#475569', dark: '#334155',
        glass: '#7dd3fc', foil: '#d4893b', foilDark: '#a8642a', collar: '#94a3b8',
    };
    const rect = (x, y, w, h, fill, rx = 2) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${C.line}" stroke-width="2"/>`;
    const circle = (cx, cy, r, fill, width = 2) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${C.line}" stroke-width="${width}"/>`;

    // Each part is drawn around its centre (local units) inside a w × h box; ports sit on the box edge
    // and point outward (dir: 0 = right, 90 = down, 180 = left, 270 = up)
    const PARTS = {
        node: {
            name: 'Docking Node', short: 'Node', w: 64, h: 64,
            ports: [{ x: 32, y: 0, dir: 0 }, { x: 0, y: 32, dir: 90 }, { x: -32, y: 0, dir: 180 }, { x: 0, y: -32, dir: 270 }],
            art: rect(26, -12, 6, 24, C.collar) + rect(-32, -12, 6, 24, C.collar) +
                rect(-12, 26, 24, 6, C.collar) + rect(-12, -32, 24, 6, C.collar) +
                rect(-26, -26, 52, 52, C.hull, 10) + circle(0, 0, 11, C.shade),
        },
        cabin: {
            name: 'Cabin', short: 'Cabin', w: 150, h: 58,
            ports: [{ x: -75, y: 0, dir: 180 }, { x: 75, y: 0, dir: 0 }],
            art: rect(-75, -13, 9, 26, C.collar) + rect(66, -13, 9, 26, C.collar) +
                rect(-66, -29, 132, 58, C.hull, 16) +
                `<path d="M -31 -29 V 29 M 31 -29 V 29" stroke="${C.shade}" stroke-width="3"/>` +
                [-48, -14, 14, 48].map(x => circle(x, 0, 6, C.glass, 1.5)).join(''),
        },
        centrifuge: {
            name: 'Centrifuge', short: 'Centrifuge', w: 200, h: 200,
            ports: [{ x: -100, y: 0, dir: 180 }, { x: 100, y: 0, dir: 0 }],
            art: rect(-100, -9, 200, 18, C.shade) + rect(-100, -13, 9, 26, C.collar) + rect(91, -13, 9, 26, C.collar) +
                `<path d="M -57 -57 L 57 57 M 57 -57 L -57 57" stroke="${C.shade}" stroke-width="7"/>` +
                `<circle r="84" fill="none" stroke="${C.line}" stroke-width="22"/>` +
                `<circle r="84" fill="none" stroke="${C.hull}" stroke-width="18"/>` +
                [0, 45, 90, 135, 180, 225, 270, 315].map(a =>
                    `<circle cx="${(84 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(84 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="3.5" fill="${C.glass}"/>`).join('') +
                circle(0, 0, 24, C.hull) + circle(0, 0, 9, C.shade),
        },
        tank: {
            name: 'Fuel Tank', short: 'Tank', w: 220, h: 70,
            ports: [{ x: -110, y: 0, dir: 180 }, { x: 110, y: 0, dir: 0 }],
            art: rect(-110, -14, 10, 28, C.collar) + rect(100, -14, 10, 28, C.collar) +
                rect(-100, -35, 200, 70, C.foil, 30) +
                `<path d="M -60 -35 V 35 M 0 -35 V 35 M 60 -35 V 35" stroke="${C.foilDark}" stroke-width="6"/>` +
                '<rect x="-84" y="-26" width="168" height="8" rx="4" fill="#ffffff" fill-opacity="0.2"/>',
        },
        haven: {
            name: 'Seraph SPC-1 "Haven"', short: 'Haven', w: 82, h: 72,
            ports: [{ x: -41, y: 0, dir: 180 }],
            art: rect(-41, -13, 9, 26, C.collar) +
                `<path d="M -32 -19 L 28 -36 L 28 36 L -32 19 Z" fill="${C.hull}" stroke="${C.line}" stroke-width="2" stroke-linejoin="round"/>` +
                rect(28, -36, 13, 72, C.dark, 3) + circle(-6, -8, 4.5, C.glass, 1.5) + circle(-6, 8, 4.5, C.glass, 1.5),
        },
    };

    /* ---------- Geometry ---------- */

    function rotatePoint(x, y, rot) {
        if (rot === 90) return [-y, x];
        if (rot === 180) return [-x, -y];
        if (rot === 270) return [y, -x];
        return [x, y];
    }

    function portsOf(m) {
        return PARTS[m.type].ports.map((p, i) => {
            const [px, py] = rotatePoint(p.x, p.y, m.rot);
            return { key: `${m.id}:${i}`, id: m.id, x: m.x + px, y: m.y + py, dir: (p.dir + m.rot) % 360 };
        });
    }

    function boxOf(m) {
        const part = PARTS[m.type];
        const upright = m.rot % 180 === 0;
        const w = upright ? part.w : part.h, h = upright ? part.h : part.w;
        return { x1: m.x - w / 2, y1: m.y - h / 2, x2: m.x + w / 2, y2: m.y + h / 2, w, h };
    }

    const opposite = (a, b) => (a - b + 360) % 360 === 180;
    // Touching at a docking port is fine; any deeper overlap is not
    const overlaps = (a, b) => a.x1 < b.x2 - 1 && a.x2 > b.x1 + 1 && a.y1 < b.y2 - 1 && a.y2 > b.y1 + 1;
    const inWorld = b => b.x1 >= -0.5 && b.y1 >= -0.5 && b.x2 <= WORLD.w + 0.5 && b.y2 <= WORLD.h + 0.5;

    function fits(m, others) {
        const b = boxOf(m);
        return inWorld(b) && others.every(o => o.id === m.id || !overlaps(b, boxOf(o)));
    }

    function clampToWorld(m) {
        const b = boxOf(m);
        m.x = Math.min(Math.max(m.x, b.w / 2), WORLD.w - b.w / 2);
        m.y = Math.min(Math.max(m.y, b.h / 2), WORLD.h - b.h / 2);
        return m;
    }

    // Docked pairs: ports of different modules at the same point, facing each other
    function connections(list) {
        const ports = list.flatMap(portsOf);
        const links = [], used = new Set();
        for (let i = 0; i < ports.length; i++) {
            for (let j = i + 1; j < ports.length; j++) {
                const a = ports[i], b = ports[j];
                if (a.id === b.id || !opposite(a.dir, b.dir) || Math.hypot(a.x - b.x, a.y - b.y) > 0.5) continue;
                links.push({ x: a.x, y: a.y, dir: a.dir });
                used.add(a.key);
                used.add(b.key);
            }
        }
        return { links, used };
    }

    // The closest free port within reach that the module can dock to without overlapping anything
    function snapFor(m, others) {
        const mine = portsOf(m);
        const { used } = connections(others);
        let best = null;
        others.forEach(o => portsOf(o).forEach(b => {
            if (used.has(b.key)) return;
            mine.forEach(a => {
                if (!opposite(a.dir, b.dir)) return;
                const d = Math.hypot(b.x - a.x, b.y - a.y);
                if (d > SNAP || (best && d >= best.d)) return;
                const pose = { ...m, x: m.x + b.x - a.x, y: m.y + b.y - a.y };
                if (fits(pose, others)) best = { d, pose, target: b.key };
            });
        }));
        return best;
    }

    // Where a part added by click or tap goes: docked to the first free port it fits, else the nearest
    // open space to the middle
    function spotFor(type) {
        const part = PARTS[type];
        const { used } = connections(modules);
        for (const o of modules) {
            for (const b of portsOf(o)) {
                if (used.has(b.key)) continue;
                for (const rot of [0, 90, 180, 270]) {
                    for (const p of part.ports) {
                        if (!opposite((p.dir + rot) % 360, b.dir)) continue;
                        const [px, py] = rotatePoint(p.x, p.y, rot);
                        const pose = { id: nextId, type, rot, x: b.x - px, y: b.y - py };
                        if (fits(pose, modules)) return pose;
                    }
                }
            }
        }
        for (let r = 0; r <= 600; r += 20) {
            const steps = Math.max(1, Math.round(2 * Math.PI * r / 40));
            for (let k = 0; k < steps; k++) {
                const a = 2 * Math.PI * k / steps;
                const pose = { id: nextId, type, rot: 0, x: WORLD.w / 2 + r * Math.cos(a), y: WORLD.h / 2 + r * Math.sin(a) };
                if (fits(pose, modules)) return pose;
            }
        }
        return null;
    }

    /* ---------- Drawing (shared by the canvas and the export) ---------- */

    const num = v => +v.toFixed(2);
    const artOf = m => `<g transform="translate(${num(m.x)} ${num(m.y)}) rotate(${m.rot})">${PARTS[m.type].art}</g>`;
    const collarOf = l =>
        `<g transform="translate(${num(l.x)} ${num(l.y)}) rotate(${l.dir})">${rect(-5, -17, 10, 34, C.collar)}</g>`;

    // The same sky every time: seeded, so the canvas and each export match
    function stars(x, y, w, h) {
        let seed = 1337;
        const rand = () => {
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        let out = '';
        const count = Math.round(w * h / 7000);
        for (let i = 0; i < count; i++) {
            out += `<circle cx="${num(x + rand() * w)}" cy="${num(y + rand() * h)}" r="${num(0.6 + rand())}" fill="#ffffff" fill-opacity="${num(0.35 + rand() * 0.55)}"/>`;
        }
        return out;
    }

    /* ---------- State ---------- */

    let modules = [];       // { id, type, x, y, rot }: centre in world units, rotation in 90° steps
    let nextId = 1;
    let version = 0;        // bumped on every change to the build
    let selectedId = null;
    let drag = null;
    let exported = null;    // { blob, url, version, width, height }: the one image kept
    let resultShown = false;
    let stale = false;      // an image was shown, then the build changed
    let busy = false;
    let sharing = false;
    let frame = 0;

    const $ = id => document.getElementById(id);
    const canvas = $('builder-canvas'), stage = $('builder-stage'), palette = $('builder-palette');
    const trash = $('builder-trash'), selection = $('builder-selection'), hint = $('builder-hint');
    const status = $('builder-status'), doneButton = $('builder-done'), newButton = $('builder-new');
    const result = $('builder-result'), preview = $('builder-preview'), download = $('builder-download');
    const shareButton = $('builder-share'), shareStatus = $('builder-share-status'), sizeNote = $('builder-result-size');

    canvas.innerHTML = `<g aria-hidden="true">${stars(0, 0, WORLD.w, WORLD.h)}</g>` +
        '<g class="gm-modules"></g><g class="gm-links" aria-hidden="true"></g><g class="gm-ports" aria-hidden="true"></g>';
    const modulesLayer = canvas.querySelector('.gm-modules');
    const linksLayer = canvas.querySelector('.gm-links');
    const portsLayer = canvas.querySelector('.gm-ports');

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    palette.innerHTML = Object.entries(PARTS).map(([type, p]) => {
        const box = `${-p.w / 2 - 4} ${-p.h / 2 - 4} ${p.w + 8} ${p.h + 8}`;
        return `<button type="button" class="builder-part" data-type="${type}" aria-label="Add ${esc(p.name)}">` +
            `<svg viewBox="${box}" aria-hidden="true">${p.art}</svg>` +
            `<span class="builder-part-name">${esc(p.name)}</span><span class="builder-part-short">${esc(p.short)}</span></button>`;
    }).join('');

    const STALE_NOTE = 'Build changed. Press Done to export a fresh image.';

    function say(message, error = false) {
        status.textContent = stale && !error ? [message, STALE_NOTE].filter(Boolean).join(' ') : message;
        status.classList.toggle('error', error);
    }

    // The build as it currently looks, with the dragged module at its drag position
    function shownModules() {
        if (!drag || !drag.moved) return modules;
        if (drag.kind === 'new') return drag.onCanvas ? [...modules, drag.pose] : modules;
        return modules.map(m => (m.id === drag.id ? drag.pose : m));
    }

    function render() {
        frame = 0;
        const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.gm-module');
        const list = shownModules();
        const draggedId = drag && drag.moved ? drag.pose.id : null;
        modulesLayer.innerHTML = list.map(m => {
            const b = boxOf(m);
            const classes = 'gm-module' + (m.id === draggedId ? ' dragging' : '') +
                (m.id === draggedId && !drag.valid ? ' invalid' : '');
            const outline = m.id === selectedId || m.id === draggedId
                ? `<rect class="gm-select" x="${num(-b.w / 2 - 6)}" y="${num(-b.h / 2 - 6)}" width="${b.w + 12}" height="${b.h + 12}" rx="8"/>` : '';
            return `<g class="${classes}" data-id="${m.id}" data-type="${m.type}" tabindex="0" role="button" ` +
                `aria-label="${esc(PARTS[m.type].name)}. R rotates, Delete removes, arrow keys move." ` +
                `transform="translate(${num(m.x)} ${num(m.y)})"><g class="gm-art" transform="rotate(${m.rot})">${PARTS[m.type].art}</g>${outline}</g>`;
        }).join('');
        const { links, used } = connections(list);
        linksLayer.innerHTML = links.map(collarOf).join('');
        portsLayer.innerHTML = list.flatMap(portsOf).filter(p => !used.has(p.key)).map(p =>
            `<circle class="gm-port${drag && drag.target === p.key ? ' target' : ''}" cx="${num(p.x)}" cy="${num(p.y)}" r="6"/>`).join('');
        trash.classList.toggle('armed', !!(drag && drag.overTrash));
        selection.hidden = !selectedId || !!drag;
        if (focused && selectedId) {
            const el = modulesLayer.querySelector(`[data-id="${selectedId}"]`);
            if (el) el.focus({ preventScroll: true });
        }
    }

    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    function updateControls() {
        const count = modules.length;
        doneButton.disabled = !count || busy;
        newButton.disabled = !count;
        if (!count) {
            hint.textContent = 'Drag a module into orbit to start.';
        } else {
            const links = connections(modules).links.length;
            hint.textContent = `${count} module${count === 1 ? '' : 's'}, ${links} docking connection${links === 1 ? '' : 's'}.`;
        }
    }

    // Every edit goes through here: the last export no longer matches the build
    function change() {
        version++;
        if (exported) dropExport();
        if (resultShown) {
            resultShown = false;
            stale = true;
            result.hidden = true;
            say('');
        }
        updateControls();
        render();
    }

    function dropExport() {
        URL.revokeObjectURL(exported.url);
        exported = null;
        preview.removeAttribute('src');
        download.removeAttribute('href');
    }

    function select(id) {
        selectedId = id;
        render();
    }

    function removeModule(id) {
        modules = modules.filter(m => m.id !== id);
        if (selectedId === id) selectedId = null;
        change();
        say('Module removed.');
    }

    function commit(update) {
        const before = connections(modules).links.length;
        update();
        change();
        say(connections(modules).links.length > before ? 'Docked.' : '');
    }

    /* ---------- Pointer input ---------- */

    function toWorld(clientX, clientY) {
        const ctm = canvas.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    }

    const inside = (el, x, y) => {
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    // Moves the dragged module under the pointer, docking it when a port is in reach
    function track(clientX, clientY) {
        drag.last = [clientX, clientY];
        drag.overTrash = inside(trash, clientX, clientY);
        drag.onCanvas = inside(stage, clientX, clientY);
        const p = toWorld(clientX, clientY);
        let pose = clampToWorld({ ...drag.pose, x: p.x - drag.dx, y: p.y - drag.dy });
        if (!drag.moved && Math.hypot(pose.x - drag.start.x, pose.y - drag.start.y) < 2 && pose.rot === drag.start.rot) return;
        drag.moved = true;
        const others = modules.filter(o => o.id !== pose.id);
        const snap = drag.overTrash ? null : snapFor(pose, others);
        if (snap) pose = snap.pose;
        drag.target = snap ? snap.target : null;
        drag.pose = pose;
        drag.valid = fits(pose, others);
        schedule();
    }

    function endDrag(cancelled) {
        const d = drag;
        drag = null;
        if (cancelled || !d.moved) {
            render();
            return;
        }
        if (d.kind === 'move' && d.overTrash) {
            removeModule(d.id);
            return;
        }
        if (d.kind === 'new' && (d.overTrash || !d.onCanvas)) {
            render();
            return;
        }
        if (!d.valid) {
            say(d.kind === 'new' ? "That spot is taken, so the module wasn't added." : 'That spot is taken, so the module went back.');
            render();
            return;
        }
        if (d.kind === 'new') {
            commit(() => {
                modules.push({ ...d.pose });
                nextId++;
                selectedId = d.pose.id;
            });
        } else {
            commit(() => {
                const m = modules.find(o => o.id === d.id);
                Object.assign(m, { x: d.pose.x, y: d.pose.y, rot: d.pose.rot });
            });
        }
    }

    canvas.addEventListener('pointerdown', e => {
        const g = e.target.closest('.gm-module');
        if (!g) {
            if (selectedId) select(null);
            return;
        }
        if (e.button !== 0 || drag) return;
        e.preventDefault();
        const m = modules.find(o => o.id === Number(g.dataset.id));
        const p = toWorld(e.clientX, e.clientY);
        selectedId = m.id;
        drag = { kind: 'move', id: m.id, pointerId: e.pointerId, dx: p.x - m.x, dy: p.y - m.y,
            pose: { ...m }, start: { ...m }, moved: false, valid: true, target: null, onCanvas: true };
        canvas.setPointerCapture(e.pointerId);
        render();
    });
    canvas.addEventListener('pointermove', e => {
        if (drag && drag.kind === 'move' && e.pointerId === drag.pointerId) track(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', e => {
        if (drag && drag.kind === 'move' && e.pointerId === drag.pointerId) endDrag(false);
    });
    canvas.addEventListener('pointercancel', e => {
        if (drag && drag.kind === 'move' && e.pointerId === drag.pointerId) endDrag(true);
    });
    canvas.addEventListener('focusin', e => {
        const g = e.target.closest('.gm-module');
        if (g && !drag && selectedId !== Number(g.dataset.id)) {
            selectedId = Number(g.dataset.id);
            render();
        }
    });

    // Palette: drag a part onto the canvas, or click / tap / Enter to add it
    let pressed = null;
    let suppressClick = false;
    palette.addEventListener('pointerdown', e => {
        const button = e.target.closest('.builder-part');
        if (!button || e.button !== 0 || drag) return;
        pressed = { button, type: button.dataset.type, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
        button.setPointerCapture(e.pointerId);
    });
    palette.addEventListener('pointermove', e => {
        if (!pressed || e.pointerId !== pressed.pointerId) return;
        if (!drag) {
            if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) < DRAG_START) return;
            const part = PARTS[pressed.type];
            drag = { kind: 'new', pointerId: e.pointerId, dx: 0, dy: 0, moved: false, valid: false, target: null,
                pose: { id: nextId, type: pressed.type, x: -part.w, y: -part.h, rot: 0 },
                start: { x: Infinity, y: Infinity, rot: 0 } };
            selectedId = null;
        }
        track(e.clientX, e.clientY);
    });
    const releasePalette = cancelled => e => {
        if (!pressed || e.pointerId !== pressed.pointerId) return;
        pressed = null;
        if (drag && drag.kind === 'new') {
            suppressClick = true;
            endDrag(cancelled);
        }
    };
    palette.addEventListener('pointerup', releasePalette(false));
    palette.addEventListener('pointercancel', releasePalette(true));
    palette.addEventListener('click', e => {
        const button = e.target.closest('.builder-part');
        if (!button) return;
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        const pose = spotFor(button.dataset.type);
        if (!pose) {
            say('There is no room for that module. Remove one first.', true);
            return;
        }
        commit(() => {
            modules.push(pose);
            nextId++;
            selectedId = pose.id;
        });
        if (status.textContent === (stale ? STALE_NOTE : '')) say(`${PARTS[pose.type].name} added.`);
    });

    /* ---------- Keyboard and selection tools ---------- */

    function rotateSelected() {
        const m = modules.find(o => o.id === selectedId);
        if (!m) return;
        const pose = { ...m, rot: (m.rot + 90) % 360 };
        if (!fits(pose, modules)) {
            say('There is no room to rotate it here. Move it somewhere clearer first.', true);
            return;
        }
        commit(() => { m.rot = pose.rot; });
    }

    function nudgeSelected(dx, dy) {
        const m = modules.find(o => o.id === selectedId);
        if (!m) return;
        const pose = { ...m, x: m.x + dx, y: m.y + dy };
        if (!fits(pose, modules)) return;
        commit(() => Object.assign(m, { x: pose.x, y: pose.y }));
    }

    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target;
        if (target.closest && target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
        if (target !== document.body && !builder.contains(target)) return;
        const key = e.key.toLowerCase();
        if (drag) {
            if (key === 'r') {
                e.preventDefault();
                drag.pose = { ...drag.pose, rot: (drag.pose.rot + 90) % 360 };
                if (drag.last) track(drag.last[0], drag.last[1]);
            } else if (key === 'escape') {
                drag = null;
                pressed = null;
                render();
            }
            return;
        }
        if (!selectedId) return;
        const moves = { arrowleft: [-NUDGE, 0], arrowright: [NUDGE, 0], arrowup: [0, -NUDGE], arrowdown: [0, NUDGE] };
        if (key === 'r') rotateSelected();
        else if (key === 'delete' || key === 'backspace') removeModule(selectedId);
        else if (key === 'escape') select(null);
        else if (moves[key]) nudgeSelected(...moves[key]);
        else return;
        e.preventDefault();
    });

    $('builder-rotate').addEventListener('click', rotateSelected);
    $('builder-remove').addEventListener('click', () => { if (selectedId) removeModule(selectedId); });

    newButton.addEventListener('click', () => {
        if (!modules.length || !window.confirm('Clear the station and start a new build?')) return;
        modules = [];
        selectedId = null;
        change();
        stale = false;
        say('New build started.');
    });

    /* ---------- Done: export the station as a PNG ---------- */

    function exportSVG() {
        const boxes = modules.map(boxOf);
        const x = Math.min(...boxes.map(b => b.x1)) - EXPORT_PAD, y = Math.min(...boxes.map(b => b.y1)) - EXPORT_PAD;
        const w = Math.max(...boxes.map(b => b.x2)) + EXPORT_PAD - x, h = Math.max(...boxes.map(b => b.y2)) + EXPORT_PAD - y;
        const scale = Math.min(Math.max(EXPORT_LONG_SIDE / Math.max(w, h), 2), 6);
        const width = Math.round(w * scale), height = Math.round(h * scale);
        const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">` +
            '<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#111a2e"/></linearGradient></defs>' +
            `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="url(#sky)"/>` +
            stars(x, y, w, h) + modules.map(artOf).join('') + connections(modules).links.map(collarOf).join('') + '</svg>';
        return { markup, width, height };
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('The station drawing could not be loaded.'));
            img.src = url;
        });
    }

    async function renderPNG() {
        const { markup, width, height } = exportSVG();
        const svgURL = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
        let img;
        try {
            img = await loadImage(svgURL);
        } finally {
            URL.revokeObjectURL(svgURL);
        }
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('No 2D canvas.');
        ctx.drawImage(img, 0, 0, width, height);
        const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('The PNG could not be encoded.');
        return { blob, width, height };
    }

    function showResult() {
        result.hidden = false;
        resultShown = true;
        stale = false;
        shareStatus.textContent = '';
        say('');
        result.scrollIntoView({ block: 'nearest' });
    }

    doneButton.addEventListener('click', async () => {
        if (!modules.length || busy) return;
        if (exported && exported.version === version) {
            showResult();
            return;
        }
        busy = true;
        updateControls();
        say('Creating your station image…');
        const at = version;
        try {
            const { blob, width, height } = await renderPNG();
            if (at !== version) {
                say('The build changed while exporting. Press Done again.');
                return;
            }
            exported = { blob, url: URL.createObjectURL(blob), version: at, width, height };
            preview.src = exported.url;
            download.href = exported.url;
            sizeNote.textContent = `${width} × ${height} px PNG`;
            showResult();
        } catch (err) {
            say("Couldn't create the image. Your build is untouched, so press Done to try again.", true);
        } finally {
            busy = false;
            updateControls();
        }
    });

    /* ---------- Share ---------- */

    shareButton.addEventListener('click', async () => {
        if (!exported || sharing) return;
        const file = new File([exported.blob], FILE_NAME, { type: 'image/png' });
        const title = 'My KGOSS station';
        const text = 'A station I built in the WSA KGOSS Station Builder.';
        sharing = true;
        try {
            if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title, text });
                shareStatus.textContent = 'Shared.';
            } else if (navigator.share) {
                await navigator.share({ title, text, url: location.href });
                shareStatus.textContent = "This browser can't attach images, so a link to the builder was shared instead. Use Download PNG to keep the image.";
            } else {
                shareStatus.textContent = "Sharing isn't available in this browser. Use Download PNG to save the image and share it from there.";
            }
        } catch (err) {
            shareStatus.textContent = err && err.name === 'AbortError'
                ? 'Share cancelled.'
                : "Couldn't open sharing. Use Download PNG to save the image instead.";
        } finally {
            sharing = false;
        }
    });

    window.addEventListener('pagehide', () => { if (exported) URL.revokeObjectURL(exported.url); });
    window.addEventListener('pageshow', e => {
        // Back from the cache: the revoked image can't be shown again
        if (e.persisted && exported) {
            exported = null;
            preview.removeAttribute('src');
            download.removeAttribute('href');
            result.hidden = true;
            resultShown = false;
        }
    });

    updateControls();
    render();
})();
