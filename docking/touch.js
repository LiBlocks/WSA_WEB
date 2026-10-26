// Docking Simulator touch controls for phones and tablets: either two analog joysticks (move and turn)
// with buttons for forward/back and roll, or big buttons laid out like the keyboard keys. The player
// picks the layout; the choice is remembered. Buttons carry data-key and are handled with the key caps
// in main.js; this module handles the sticks, the FINE toggle and the layout switch.

const MODE_KEY = 'wsa-dock-touch';
const DEADZONE = 0.12;

export function createTouchControls(sim) {
    const coarse = window.matchMedia('(pointer: coarse)');
    const sticks = { move: { x: 0, y: 0 }, turn: { x: 0, y: 0 } };
    const resets = [];
    let fine = false;
    let mode = 'stick';
    try { if (localStorage.getItem(MODE_KEY) === 'buttons') mode = 'buttons'; } catch (e) { /* storage blocked */ }

    const fineButton = sim.querySelector('.sim-touch-fine');
    const modeButtons = [...sim.querySelectorAll('[data-touch-mode]')];

    function apply() {
        if (coarse.matches) sim.dataset.touch = mode;
        else delete sim.dataset.touch;
        modeButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.touchMode === mode)));
    }
    modeButtons.forEach(b => b.addEventListener('click', () => {
        mode = b.dataset.touchMode;
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* storage blocked */ }
        reset();
        apply();
    }));
    coarse.addEventListener('change', apply);
    apply();

    function setFine(on) {
        fine = on;
        fineButton.setAttribute('aria-pressed', String(on));
    }
    fineButton.addEventListener('click', () => setFine(!fine));

    // An analog stick: the knob follows the finger inside the base; output -1..1 with up positive
    sim.querySelectorAll('.sim-stick').forEach(base => {
        const out = sticks[base.dataset.stick];
        const knob = base.querySelector('.sim-stick-knob');
        let id = null, cx = 0, cy = 0, reach = 1;
        const place = (x, y) => {
            knob.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        };
        const move = e => {
            let dx = (e.clientX - cx) / reach, dy = (e.clientY - cy) / reach;
            const mag = Math.hypot(dx, dy);
            if (mag > 1) { dx /= mag; dy /= mag; }
            place(dx * reach, dy * reach);
            const m = Math.min(mag, 1);
            const k = m > DEADZONE ? (m - DEADZONE) / (1 - DEADZONE) / m : 0;
            out.x = dx * k;
            out.y = -dy * k;
        };
        const end = e => {
            if (e && e.pointerId !== id) return;
            id = null;
            out.x = out.y = 0;
            place(0, 0);
            base.classList.remove('active');
        };
        base.addEventListener('pointerdown', e => {
            if (id !== null) return;
            e.preventDefault();
            id = e.pointerId;
            try { base.setPointerCapture(id); } catch (err) { /* pointer already gone */ }
            const r = base.getBoundingClientRect();
            cx = r.left + r.width / 2;
            cy = r.top + r.height / 2;
            reach = r.width / 2 - knob.offsetWidth / 2;
            base.classList.add('active');
            move(e);
        });
        base.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
        base.addEventListener('pointerup', end);
        base.addEventListener('pointercancel', end);
        base.addEventListener('lostpointercapture', end);
        resets.push(() => end());
    });

    function reset() {
        resets.forEach(r => r());
    }

    return {
        get active() { return !!sim.dataset.touch; },
        get coarse() { return coarse.matches; },
        // Analog commands in the simulator's input form, added to whatever the keys say
        input() {
            return {
                trans: [sticks.move.x, sticks.move.y, 0],
                rot: [sticks.turn.y, -sticks.turn.x, 0],
                fine,
            };
        },
        reset,
        resetFine() { setFine(false); },
    };
}
