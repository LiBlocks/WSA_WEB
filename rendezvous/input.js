// Orbital Rendezvous Challenge: keyboard, touch and (optional) tilt input. Held controls are read every
// frame with read(); one-shot keys are passed to onAction. Tilt only turns the craft, needs the device's
// permission, which is asked for only when the player switches it on, and can be recalibrated.

// Key → one-shot action. Held keys are handled separately (HELD below).
const ACTIONS = {
    KeyP: 'pause', Escape: 'pause', KeyT: 'assist', KeyV: 'view', KeyC: 'recentre', KeyF: 'focus', KeyH: 'help',
    Comma: 'warpDown', Period: 'warpUp', KeyZ: 'throttleFull', KeyX: 'throttleCut',
    Equal: 'zoomIn', NumpadAdd: 'zoomIn', Minus: 'zoomOut', NumpadSubtract: 'zoomOut',
    Digit1: 'hold:prograde', Digit2: 'hold:retrograde', Digit3: 'hold:target', Digit4: 'hold:match', Digit5: 'hold:dock',
    Digit0: 'hold:none', Backquote: 'hold:none',
};
const HELD = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyI', 'KeyK', 'KeyJ', 'KeyL',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export function createInput(root, { onAction, isActive }) {
    const keys = new Set();
    const holds = new Set();            // touch buttons being held
    const coarse = window.matchMedia('(pointer: coarse)');
    const tilt = { on: false, zero: 0, value: null, last: 0 };

    const typing = e => e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');

    function keydown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
        // Only while the game is on screen and the player isn't using the rest of the page
        if (!isActive(e)) return;
        if (HELD.has(e.code)) {
            keys.add(e.code);
            e.preventDefault();
            return;
        }
        const action = ACTIONS[e.code];
        if (action) {
            if (e.repeat && !action.startsWith('zoom') && !action.startsWith('warp')) { e.preventDefault(); return; }
            e.preventDefault();
            onAction(action, e);
        }
    }
    function keyup(e) { keys.delete(e.code); }
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);

    // Touch buttons: data-hold="turnLeft" and so on, held with pointer events
    root.querySelectorAll('[data-hold]').forEach(b => {
        const name = b.dataset.hold;
        const on = e => { e.preventDefault(); holds.add(name); b.classList.add('held'); try { b.setPointerCapture(e.pointerId); } catch { /* not capturable */ } };
        const off = () => { holds.delete(name); b.classList.remove('held'); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointercancel', off);
        b.addEventListener('lostpointercapture', off);
        b.addEventListener('contextmenu', e => e.preventDefault());
    });

    function onOrientation(e) {
        if (e.gamma == null) return;
        // Left-right tilt, whichever way up the device is held
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        const v = angle === 90 ? e.beta : angle === -90 || angle === 270 ? -e.beta : angle === 180 ? -e.gamma : e.gamma;
        tilt.value = v;
        tilt.last = performance.now();
    }

    const k = code => keys.has(code);
    return {
        read() {
            let turn = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0) + (holds.has('turnLeft') ? 1 : 0) - (holds.has('turnRight') ? 1 : 0);
            if (tilt.on && tilt.value != null && performance.now() - tilt.last < 1000) {
                const d = tilt.value - tilt.zero;
                const t = Math.abs(d) < 3 ? 0 : -(d - Math.sign(d) * 3) / 22;
                if (!turn) turn = Math.max(-1, Math.min(1, t));
            }
            const fore = (k('KeyI') || k('ArrowUp') || holds.has('fore') ? 1 : 0) - (k('KeyK') || k('ArrowDown') || holds.has('aft') ? 1 : 0);
            const side = (k('KeyJ') || k('ArrowLeft') || holds.has('left') ? 1 : 0) - (k('KeyL') || k('ArrowRight') || holds.has('right') ? 1 : 0);
            return {
                turn: Math.max(-1, Math.min(1, turn)),
                burn: k('Space') || holds.has('burn'),
                fore, side,
                fine: k('ShiftLeft') || k('ShiftRight') || holds.has('fine'),
                throttle: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0) + (holds.has('throttleUp') ? 1 : 0) - (holds.has('throttleDown') ? 1 : 0),
            };
        },
        releaseAll() {
            keys.clear();
            holds.clear();
            root.querySelectorAll('[data-hold].held').forEach(b => b.classList.remove('held'));
        },
        get coarse() { return coarse.matches; },
        coarseQuery: coarse,
        get tiltOn() { return tilt.on; },
        get tiltLive() { return tilt.on && tilt.value != null && performance.now() - tilt.last < 1000; },
        // Ask for motion data (iOS needs permission from a tap); resolves to 'on', 'denied' or 'unavailable'
        async enableTilt() {
            if (typeof DeviceOrientationEvent === 'undefined') return 'unavailable';
            try {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    const answer = await DeviceOrientationEvent.requestPermission();
                    if (answer !== 'granted') return 'denied';
                }
            } catch { return 'denied'; }
            window.addEventListener('deviceorientation', onOrientation);
            tilt.on = true;
            tilt.value = null;
            // No readings at all within a moment means no sensor (or a desktop browser)
            await new Promise(r => setTimeout(r, 1200));
            if (tilt.value == null) { this.disableTilt(); return 'unavailable'; }
            tilt.zero = tilt.value;
            return 'on';
        },
        disableTilt() {
            window.removeEventListener('deviceorientation', onOrientation);
            tilt.on = false;
            tilt.value = null;
        },
        calibrate() { if (tilt.value != null) tilt.zero = tilt.value; },
        destroy() {
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('keyup', keyup);
            this.disableTilt();
        },
    };
}
