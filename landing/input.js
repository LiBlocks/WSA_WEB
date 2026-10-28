// SSTO Landing controls: keyboard, mouse steering, an on-screen stick and device tilt, all turned into
// one smoothed stick (pitch, roll, yaw; + nose up, roll right, yaw right) plus brake and throttle
// changes. Discrete actions (gear, camera, pause, Flight Assist) are passed to main.js as named actions.

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const DEADZONE = 0.06;
const TILT_RANGE = 25;      // deg of tilt for a full deflection
const TILT_DEAD = 2.5;      // deg

// Keys that fly (held) and keys that act (pressed once)
const HOLD = {
    w: 'nosedown', arrowup: 'nosedown', s: 'noseup', arrowdown: 'noseup',
    a: 'rollleft', arrowleft: 'rollleft', d: 'rollright', arrowright: 'rollright',
    q: 'yawleft', e: 'yawright', r: 'throttleup', f: 'throttledown', b: 'brake',
};
const PRESS = { g: 'gear', v: 'camera', t: 'assist', m: 'mouse', x: 'idle', z: 'full', p: 'pause', ' ': 'pause', escape: 'pause' };

export function createInput(root, view, { onAction, enabled }) {
    const coarse = window.matchMedia('(pointer: coarse)');
    const held = new Set();         // keyboard and on-screen hold buttons
    const out = { pitch: 0, roll: 0, yaw: 0 };
    const mouse = { inside: false, x: 0, y: 0, sx: 0, sy: 0 };
    const stick = { x: 0, y: 0 };
    const tilt = { on: false, seen: false, pitch: 0, roll: 0, p0: null, r0: 0, listening: false };
    let settings = { control: 'keyboard', invert: false };

    /* ---------- Keyboard ---------- */

    const editable = t => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog');
    const forGame = e => !e.ctrlKey && !e.metaKey && !e.altKey && !editable(e.target) &&
        (e.target === document.body || e.target === document.documentElement || root.contains(e.target)) && !document.querySelector('dialog[open]');
    const keyOf = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());

    window.addEventListener('keydown', e => {
        if (!forGame(e)) return;
        const k = keyOf(e);
        // Buttons keep their own Space and Enter; elsewhere Space pauses
        if (k === ' ' && e.target.closest && e.target.closest('button, a')) return;
        if (PRESS[k]) {
            if (!enabled(PRESS[k])) return;
            e.preventDefault();
            if (!e.repeat) onAction(PRESS[k]);
            return;
        }
        if (HOLD[k] && enabled('fly')) {
            e.preventDefault();
            held.add(HOLD[k]);
        }
    });
    window.addEventListener('keyup', e => {
        const k = keyOf(e);
        if (HOLD[k]) held.delete(HOLD[k]);
    });

    /* ---------- Mouse steering ---------- */

    view.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = view.getBoundingClientRect();
        const reach = Math.min(r.width, r.height) * 0.32;
        let x = (e.clientX - r.left - r.width / 2) / reach, y = (e.clientY - r.top - r.height / 2) / reach;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
        mouse.x = x;
        mouse.y = y;
        mouse.inside = true;
    });
    view.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse.inside = false; });
    // The wheel sets the throttle in mouse mode
    view.addEventListener('wheel', e => {
        if (settings.control !== 'mouse' || !enabled('fly')) return;
        e.preventDefault();
        onAction(e.deltaY < 0 ? 'wheelup' : 'wheeldown');
    }, { passive: false });

    /* ---------- On-screen stick, hold buttons and throttle slider ---------- */

    const knob = root.querySelector('.ld-stick-knob');
    const base = root.querySelector('.ld-stick');
    let stickId = null, cx = 0, cy = 0, reach = 1;
    const place = (x, y) => { knob.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; };
    const stickMove = e => {
        let dx = (e.clientX - cx) / reach, dy = (e.clientY - cy) / reach;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        place(dx * reach, dy * reach);
        stick.x = dx;
        stick.y = -dy;
    };
    const stickEnd = e => {
        if (e && e.pointerId !== stickId) return;
        stickId = null;
        stick.x = stick.y = 0;
        place(0, 0);
        base.classList.remove('active');
    };
    base.addEventListener('pointerdown', e => {
        if (stickId !== null || !enabled('fly')) return;
        e.preventDefault();
        stickId = e.pointerId;
        try { base.setPointerCapture(stickId); } catch (err) { /* pointer already gone */ }
        const r = base.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        reach = r.width / 2 - knob.offsetWidth / 2;
        base.classList.add('active');
        stickMove(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
    base.addEventListener('pointerup', stickEnd);
    base.addEventListener('pointercancel', stickEnd);
    base.addEventListener('lostpointercapture', stickEnd);

    root.querySelectorAll('[data-hold]').forEach(b => {
        const name = b.dataset.hold;
        const down = e => {
            if (!enabled('fly')) return;
            e.preventDefault();
            held.add(name);
            b.classList.add('pressed');
            try { b.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        };
        const up = () => { held.delete(name); b.classList.remove('pressed'); };
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', e => e.preventDefault());
    });

    const slider = root.querySelector('.ld-thr-slider');
    let sliderId = null;
    const sliderSet = e => {
        const r = slider.getBoundingClientRect();
        onAction('throttle', clamp(1 - (e.clientY - r.top) / r.height, 0, 1));
    };
    slider.addEventListener('pointerdown', e => {
        if (!enabled('fly')) return;
        e.preventDefault();
        sliderId = e.pointerId;
        try { slider.setPointerCapture(sliderId); } catch (err) { /* pointer already gone */ }
        sliderSet(e);
    });
    slider.addEventListener('pointermove', e => { if (e.pointerId === sliderId) sliderSet(e); });
    const sliderEnd = () => { sliderId = null; };
    slider.addEventListener('pointerup', sliderEnd);
    slider.addEventListener('pointercancel', sliderEnd);
    slider.addEventListener('lostpointercapture', sliderEnd);

    /* ---------- Device tilt ---------- */

    // Gravity in screen coordinates from the device orientation, so the axes stay right however the
    // phone is turned: roll from tilting the left or right edge down, pitch from tilting the top away
    function onOrientation(e) {
        if (e.beta == null || e.gamma == null) return;
        tilt.seen = true;
        const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
        const gd = [Math.sin(g) * Math.cos(b), -Math.sin(b), -Math.cos(g) * Math.cos(b)];
        const angle = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI / 180;
        const sx = gd[0] * Math.cos(angle) - gd[1] * Math.sin(angle);
        const sy = gd[0] * Math.sin(angle) + gd[1] * Math.cos(angle);
        tilt.roll = Math.asin(clamp(sx, -1, 1)) * 180 / Math.PI;
        tilt.pitch = Math.atan2(-sy, -gd[2]) * 180 / Math.PI;
        if (tilt.p0 === null) calibrate();
    }

    function calibrate() {
        tilt.p0 = tilt.pitch;
        tilt.r0 = tilt.roll;
    }

    // Ask for motion access where the browser needs a tap first (iOS), then wait briefly for data
    async function enableTilt() {
        if (typeof window.DeviceOrientationEvent === 'undefined') return { ok: false, why: 'unsupported' };
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const answer = await DeviceOrientationEvent.requestPermission();
                if (answer !== 'granted') return { ok: false, why: 'denied' };
            }
        } catch (err) {
            return { ok: false, why: 'denied' };
        }
        if (!tilt.listening) {
            window.addEventListener('deviceorientation', onOrientation);
            tilt.listening = true;
        }
        tilt.p0 = null;
        const start = performance.now();
        while (!tilt.seen && performance.now() - start < 1500) await new Promise(r => setTimeout(r, 100));
        if (!tilt.seen) return { ok: false, why: 'nodata' };
        tilt.on = true;
        return { ok: true };
    }

    function disableTilt() {
        tilt.on = false;
    }

    /* ---------- The combined, smoothed stick ---------- */

    function rawStick() {
        let pitch = 0, roll = 0, yaw = 0;
        const inv = settings.invert ? -1 : 1;
        // Keys and the stick: up / W is the aircraft convention, nose down
        if (held.has('nosedown')) pitch -= inv;
        if (held.has('noseup')) pitch += inv;
        if (held.has('rollleft')) roll -= 1;
        if (held.has('rollright')) roll += 1;
        if (held.has('yawleft')) yaw -= 1;
        if (held.has('yawright')) yaw += 1;
        const shape = v => { const m = Math.abs(v); return m < DEADZONE ? 0 : Math.sign(v) * ((m - DEADZONE) / (1 - DEADZONE)) ** 1.4; };
        pitch -= inv * shape(stick.y);
        roll += shape(stick.x);
        if (settings.control === 'mouse' && mouse.inside) {
            // The pointer works like the stick: above the centre lowers the nose
            pitch += inv * shape(mouse.sy);
            roll += shape(mouse.sx);
        }
        if (tilt.on && tilt.p0 !== null) {
            const dz = (v, r) => { const m = Math.abs(v); return m < TILT_DEAD ? 0 : Math.sign(v) * Math.min(1, (m - TILT_DEAD) / (r - TILT_DEAD)); };
            // Tilting the top away pushes the nose down, like pushing a stick
            pitch += inv * dz(tilt.pitch - tilt.p0, TILT_RANGE);
            roll += dz(tilt.roll - tilt.r0, TILT_RANGE);
        }
        return { pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1), yaw: clamp(yaw, -1, 1) };
    }

    return {
        get coarse() { return coarse.matches; },
        coarseQuery: coarse,
        set(next) { settings = { ...settings, ...next }; },
        enableTilt,
        disableTilt,
        calibrate,
        get tiltOn() { return tilt.on; },
        mouseState() { return { inside: mouse.inside, x: mouse.sx, y: mouse.sy }; },
        // Called every frame: smooths the stick so keys and the mouse don't snap the aircraft around
        read(dt) {
            const k = 1 - Math.exp(-dt / 0.12);
            mouse.sx += (mouse.x - mouse.sx) * k;
            mouse.sy += (mouse.y - mouse.sy) * k;
            const raw = rawStick();
            // With tilt on, the stick's knob shows the tilt instead
            if (tilt.on && stickId === null && tilt.p0 !== null) {
                const r = base.offsetWidth / 2 - knob.offsetWidth / 2;
                const tx = clamp((tilt.roll - tilt.r0) / TILT_RANGE, -1, 1), ty = clamp(-(tilt.pitch - tilt.p0) / TILT_RANGE, -1, 1);
                place(tx * r, ty * r);
            }
            const ramp = 1 - Math.exp(-dt / 0.07);
            out.pitch += (raw.pitch - out.pitch) * ramp;
            out.roll += (raw.roll - out.roll) * ramp;
            out.yaw += (raw.yaw - out.yaw) * ramp;
            return {
                pitch: out.pitch, roll: out.roll, yaw: out.yaw,
                brake: held.has('brake') ? 1 : 0,
                throttleRate: (held.has('throttleup') ? 1 : 0) - (held.has('throttledown') ? 1 : 0),
            };
        },
        releaseAll() {
            held.clear();
            root.querySelectorAll('[data-hold].pressed').forEach(b => b.classList.remove('pressed'));
            stickEnd();
            out.pitch = out.roll = out.yaw = 0;
        },
    };
}
