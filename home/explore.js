// Explore mode: the page's content steps back and the visitor flies round the system. Every world (and a
// few things beyond it) can be chosen by clicking it, from the list of places, or with the keyboard, and
// shows a small record: what it is, its real size and gravity (celestial-bodies.js, WSA's installation) and
// the WSA missions that went there (the mission archive's data). Three discoveries are hidden in the sky.
//
//   drag / one finger    turn          wheel / pinch / + -   zoom          arrows   turn
//   [ and ]              previous and next place                          Escape   back to the homepage
import { SYSTEM, NOTES, DEEP_SKY } from './universe/bodies.js';
import { body as bodyData, surfaceGravity } from '../celestial-bodies.js';
import { prefs } from './prefs.js';

const root = document.documentElement;
const PLACES = [
    { group: 'The Kerbol system', ids: SYSTEM.map(b => b.id) },
    { group: 'Beyond the system', ids: ['galaxy', 'nebula', 'cluster'] },
];
const DISCOVERIES = ['constellation', 'blackhole', 'comet'];
const HINTS = {
    constellation: 'Look straight up from the planets, away from the star',
    blackhole: 'Turn round from where you started, behind Kerbin',
    comet: 'Something with a tail swings through the inner system',
};
const fmt = (n, d = 0) => n.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });

export class Explorer {
    constructor(home) {
        this.home = home;
        this.active = false;
        this.focusId = null;
        this.labels = new Map();
    }

    build() {
        if (this.el) return;
        const el = document.createElement('div');
        el.className = 'home-explore v2-only';
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', 'Explore the universe');
        el.hidden = true;
        el.innerHTML = `
            <div class="hx-bar">
                <p class="hx-help" id="hx-help">Drag to look around, scroll or pinch to zoom. Arrow keys turn, + and − zoom, [ and ] step through the places.</p>
                <div class="hx-tools">
                    <button type="button" class="btn btn-secondary btn-small hx-zoom" data-zoom="out" aria-label="Zoom out">−</button>
                    <button type="button" class="btn btn-secondary btn-small hx-zoom" data-zoom="in" aria-label="Zoom in">+</button>
                    <button type="button" class="btn btn-primary btn-small hx-exit">Back to the homepage</button>
                </div>
            </div>
            <nav class="hx-places" aria-label="Places to explore">
                <h2 class="hx-title">Places</h2>
                <div class="hx-groups"></div>
                <div class="hx-discoveries">
                    <p class="hx-found"></p>
                    <ul class="hx-found-list"></ul>
                    <button type="button" class="hx-hint">Show a hint</button>
                    <p class="hx-hint-text" hidden></p>
                </div>
            </nav>
            <article class="hx-info" aria-live="polite" aria-labelledby="hx-name">
                <p class="hx-kind"></p>
                <h2 class="hx-name" id="hx-name"></h2>
                <p class="hx-note"></p>
                <dl class="hx-facts"></dl>
                <div class="hx-missions">
                    <h3>WSA missions here</h3>
                    <ul></ul>
                    <p class="hx-more"></p>
                </div>
            </article>
            <div class="hx-labels" aria-hidden="true"></div>`;
        const groups = el.querySelector('.hx-groups');
        for (const g of PLACES) {
            const h = document.createElement('h3');
            h.textContent = g.group;
            const ul = document.createElement('ul');
            for (const id of g.ids) ul.appendChild(this.placeButton(id));
            groups.append(h, ul);
        }
        el.querySelector('.hx-exit').addEventListener('click', () => this.exit());
        el.querySelectorAll('.hx-zoom').forEach(b => b.addEventListener('click', () => this.zoom(b.dataset.zoom === 'in' ? 0.75 : 1.33)));
        el.querySelector('.hx-hint').addEventListener('click', () => this.hint());
        document.body.appendChild(el);
        this.el = el;
        this.labelBox = el.querySelector('.hx-labels');
        this.renderDiscoveries();
    }

    placeButton(id) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hx-place';
        b.dataset.id = id;
        b.textContent = this.nameOf(id);
        b.addEventListener('click', () => this.select(id));
        li.appendChild(b);
        return li;
    }

    nameOf(id) {
        const b = SYSTEM.find(x => x.id === id);
        return b ? b.name : DEEP_SKY[id] ? DEEP_SKY[id].name : id;
    }

    enter(id) {
        const u = this.home.universe;
        if (!u) {
            this.home.notify && this.home.notify('Explore mode needs the 3D background, which is off or unavailable here.');
            return;
        }
        this.build();
        if (this.active) { this.select(id || 'kerbin'); return; }
        this.active = true;
        this.returnFocus = document.activeElement;
        document.querySelectorAll('.home-label').forEach(l => l.classList.remove('is-shown'));
        root.classList.add('home-exploring');
        // The page steps back: hidden from pointers, keyboards and screen readers until the visitor returns
        this.inerted = [...document.querySelectorAll('body > section, body > footer')];
        this.inerted.forEach(s => { s.inert = true; });
        this.el.hidden = false;
        u.explorer.enter(id || 'kerbin');
        u.syncLoop();
        this.select(id || 'kerbin', true);
        this.bind();
        this.el.querySelector('.hx-exit').focus({ preventScroll: true });
        this.tick = requestAnimationFrame(() => this.frame());
    }

    exit(silent) {
        if (!this.active) return;
        this.active = false;
        cancelAnimationFrame(this.tick);
        this.unbind();
        root.classList.remove('home-exploring', 'home-pointing-world');
        this.inerted.forEach(s => { s.inert = false; });
        this.el.hidden = true;
        const u = this.home.universe;
        if (u) {
            u.explorer.exit();
            u.showConstellation(false);
            u.setHover(null);
            u.syncLoop();
            u.invalidate();
        }
        this.focusId = null;
        if (!silent && this.returnFocus && this.returnFocus.isConnected) this.returnFocus.focus({ preventScroll: true });
    }

    select(id, first) {
        const u = this.home.universe;
        if (!u) return;
        this.focusId = id;
        if (!first) u.explorer.focus(id);
        u.showConstellation(id === 'constellation');
        u.setHover(SYSTEM.some(b => b.id === id) ? id : null);
        if (DISCOVERIES.includes(id)) this.discover(id);
        this.el.querySelectorAll('.hx-place').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === id)));
        this.info(id);
    }

    info(id) {
        const el = this.el;
        const def = SYSTEM.find(b => b.id === id);
        const deep = DEEP_SKY[id];
        el.querySelector('.hx-kind').textContent = def ? def.kind : deep.kind;
        el.querySelector('.hx-name').textContent = def ? def.name : deep.name;
        el.querySelector('.hx-note').textContent = def ? NOTES[id] : deep.note;
        const facts = el.querySelector('.hx-facts');
        facts.innerHTML = '';
        const data = def && bodyData(id);
        if (data) {
            const g = surfaceGravity(data);
            const rows = [
                ['Radius', `${fmt(data.radius / 1000)} km`],
                ['Surface gravity', `${fmt(g, 2)} m/s² (${fmt(g / 9.80665, 2)} g)`],
                ['Atmosphere', data.atmosphere ? `${fmt(data.atmosphere / 1000)} km high` : 'None'],
            ];
            if (data.parent) rows.push(['Orbits', this.nameOf(data.parent === 'kerbol' ? 'kerbol' : data.parent)]);
            for (const [k, v] of rows) {
                const dt = document.createElement('dt');
                dt.textContent = k;
                const dd = document.createElement('dd');
                dd.textContent = v;
                facts.append(dt, dd);
            }
        }
        const box = el.querySelector('.hx-missions');
        const list = box.querySelector('ul');
        list.innerHTML = '';
        const missions = def && window.WSA && window.WSA.MISSIONS ? window.WSA.MISSIONS.filter(m => (m.locations || []).includes(id)) : [];
        box.hidden = !def || def.type === 'star';
        const more = box.querySelector('.hx-more');
        more.textContent = '';
        if (!missions.length) {
            const li = document.createElement('li');
            li.className = 'hx-none';
            li.textContent = 'None yet.';
            list.appendChild(li);
        } else {
            missions.slice(0, 5).forEach(m => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `missions-archive.html#${m.id}`;
                a.textContent = m.name;
                li.appendChild(a);
                list.appendChild(li);
            });
            if (missions.length > 5) {
                const a = document.createElement('a');
                a.href = 'missions-archive.html';
                a.textContent = `${missions.length - 5} more in the mission archive`;
                more.appendChild(a);
            }
        }
    }

    // ---------- discoveries ----------

    discover(id) {
        const found = prefs.found();
        if (found.includes(id)) return;
        found.push(id);
        prefs.set('found', found.join(','));
        this.renderDiscoveries();
    }

    renderDiscoveries() {
        const found = prefs.found().filter(id => DISCOVERIES.includes(id));
        this.el.querySelector('.hx-found').textContent = `Discoveries: ${found.length} of ${DISCOVERIES.length}`;
        const ul = this.el.querySelector('.hx-found-list');
        ul.innerHTML = '';
        found.forEach(id => ul.appendChild(this.placeButton(id)));
        const left = DISCOVERIES.filter(id => !found.includes(id));
        this.el.querySelector('.hx-hint').hidden = !left.length;
        if (!left.length) this.el.querySelector('.hx-hint-text').hidden = true;
    }

    // A hint for the next undiscovered thing, and a way to reach it without the 3D view
    hint() {
        const left = DISCOVERIES.filter(id => !prefs.found().includes(id));
        if (!left.length) return;
        const id = left[0];
        const p = this.el.querySelector('.hx-hint-text');
        p.hidden = false;
        p.textContent = `${HINTS[id]}. `;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hx-reveal';
        b.textContent = 'Take me there';
        b.addEventListener('click', () => { p.hidden = true; this.select(id); });
        p.appendChild(b);
    }

    // ---------- input ----------

    bind() {
        const u = this.home.universe;
        const canvas = u.canvas;
        let down = null;
        this.onKey = e => {
            if (!this.active) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (document.querySelector('dialog[open], .settings-panel:not([hidden])')) return;
            const step = 0.12;
            switch (e.key) {
                case 'Escape': this.exit(); break;
                case 'ArrowLeft': u.explorer.orbit(-step, 0); break;
                case 'ArrowRight': u.explorer.orbit(step, 0); break;
                case 'ArrowUp': u.explorer.orbit(0, -step); break;
                case 'ArrowDown': u.explorer.orbit(0, step); break;
                case '+': case '=': this.zoom(0.8); break;
                case '-': case '_': this.zoom(1.25); break;
                case '[': this.step(-1); break;
                case ']': this.step(1); break;
                default: return;
            }
            e.preventDefault();
        };
        this.onDown = e => { down = { x: e.clientX, y: e.clientY }; };
        this.onUp = e => {
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
            down = null;
            const id = u.pick(e.clientX, e.clientY);
            if (id) this.select(id);
        };
        this.onMove = e => {
            if (e.pointerType === 'touch' || (e.buttons & 1)) return;
            const id = u.pick(e.clientX, e.clientY);
            root.classList.toggle('home-pointing-world', !!id);
        };
        window.addEventListener('keydown', this.onKey);
        canvas.addEventListener('pointerdown', this.onDown);
        canvas.addEventListener('pointerup', this.onUp);
        canvas.addEventListener('pointermove', this.onMove);
        this.canvas = canvas;
    }

    unbind() {
        window.removeEventListener('keydown', this.onKey);
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this.onDown);
            this.canvas.removeEventListener('pointerup', this.onUp);
            this.canvas.removeEventListener('pointermove', this.onMove);
        }
    }

    zoom(k) {
        const u = this.home.universe;
        if (u) { u.explorer.zoom(k); u.invalidate(); }
    }

    step(dir) {
        const ids = [...PLACES.flatMap(g => g.ids), ...prefs.found().filter(id => DISCOVERIES.includes(id))];
        const i = ids.indexOf(this.focusId);
        this.select(ids[(i + dir + ids.length) % ids.length]);
    }

    // Names beside the worlds in view; moons only round the world being looked at
    frame() {
        if (!this.active) return;
        const u = this.home.universe;
        if (u) {
            const seen = new Set();
            const focus = SYSTEM.find(b => b.id === this.focusId);
            const family = focus ? (focus.parent && focus.parent !== 'kerbol' ? focus.parent : focus.id) : null;
            for (const b of SYSTEM) {
                const moon = b.parent && b.parent !== 'kerbol';
                if (moon && b.parent !== family) continue;
                const p = u.screenPosition(b.id);
                if (!p || !p.visible) continue;
                let lab = this.labels.get(b.id);
                if (!lab) {
                    lab = document.createElement('span');
                    lab.className = 'hx-label';
                    lab.textContent = b.name;
                    this.labelBox.appendChild(lab);
                    this.labels.set(b.id, lab);
                }
                lab.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + Math.max(p.r, 3) + 6)}px) translate(-50%, 0)`;
                lab.classList.toggle('is-focus', b.id === this.focusId);
                seen.add(b.id);
            }
            this.labels.forEach((lab, id) => { lab.hidden = !seen.has(id); });
        }
        this.tick = requestAnimationFrame(() => this.frame());
    }
}
