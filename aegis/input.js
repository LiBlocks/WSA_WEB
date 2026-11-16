// Aegis Landing Simulator: controls. Keyboard, an on-screen attitude stick and throttle for touch screens,
// and optional device tilt (asked for only when the player switches it on, the same way as SSTO Landing).
// Everything becomes one smoothed stick { pitch, roll } plus throttle changes; discrete keys become actions.

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const TILT_RANGE = 22;      // deg of device tilt for a full stick
const TILT_DEAD = 2.5;

// Held keys (e.code, so they work on any keyboard layout) and pressed-once keys
const HOLD = {
    KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'thrUp', ShiftRight: 'thrUp', ControlLeft: 'thrDown', ControlRight: 'thrDown',
};
const PRESS = { KeyZ: 'full', KeyX: 'cut', Space: 'assist', KeyR: 'restart', KeyP: 'pause', Escape: 'pause', KeyC: 'camera', KeyH: 'help', Digit1: 'cam1', Digit2: 'cam2', Digit3: 'cam3', Digit4: 'cam4' };

export function createInput(root, { onAction, enabled, stickEl, knobEl, thrEl, thrUpEl, thrDownEl }) {
    const held = new Set();
    const stick = { x: 0, y: 0, id: null };
    const out = { pitch: 0, roll: 0 };
    const tilt = { on: false, seen: false, pitch: 0, roll: 0, p0: null, r0: 0, listening: false };
    let thrSet = null;      // throttle value set directly by the touch slider this frame

    const editable = t => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    const forGame = e => !e.metaKey && !e.altKey && !editable(e.target) &&
        (e.target === document.body || e.target === document.documentElement || root.contains(e.target));

    window.addEventListener('keydown', e => {
        if (!forGame(e)) return;
        // Ctrl is the throttle-down key, but leave the browser's own Ctrl shortcuts alone
        if (e.ctrlKey && !HOLD[e.code]) return;
        if (e.code === 'Space' && e.target.closest && e.target.closest('button, a, summary')) return;
        if (PRESS[e.code]) {
            if (!enabled(PRESS[e.code])) return;
            e.preventDefault();
            if (!e.repeat) onAction(PRESS[e.code]);
            return;
        }
        if (HOLD[e.code] && enabled('fly')) {
            e.preventDefault();
            held.add(HOLD[e.code]);
        }
    });
    window.addEventListener('keyup', e => { if (HOLD[e.code]) held.delete(HOLD[e.code]); });
    window.addEventListener('blur', () => held.clear());

    // On-screen stick: drag the knob; it springs back to the centre when released
    function stickMove(e) {
        const r = stickEl.getBoundingClientRect();
        const rad = r.width / 2;
        let x = (e.clientX - r.left - rad) / rad, y = (e.clientY - r.top - rad) / rad;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
        stick.x = x;
        stick.y = y;
        knobEl.style.transform = `translate(${(x * rad * 0.62).toFixed(1)}px, ${(y * rad * 0.62).toFixed(1)}px)`;
    }
    stickEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        stick.id = e.pointerId;
        try { stickEl.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        stickMove(e);
        onAction('touchstart');
    });
    stickEl.addEventListener('pointermove', e => { if (e.pointerId === stick.id) stickMove(e); });
    const stickEnd = () => { stick.id = null; stick.x = stick.y = 0; knobEl.style.transform = ''; };
    stickEl.addEventListener('pointerup', stickEnd);
    stickEl.addEventListener('pointercancel', stickEnd);
    stickEl.addEventListener('lostpointercapture', stickEnd);

    // Throttle slider: drag up and down; the buttons above and below step it while held
    let thrId = null;
    function thrMove(e) {
        const r = thrEl.getBoundingClientRect();
        thrSet = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    }
    thrEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        thrId = e.pointerId;
        try { thrEl.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        thrMove(e);
        onAction('touchstart');
    });
    thrEl.addEventListener('pointermove', e => { if (e.pointerId === thrId) thrMove(e); });
    const thrEnd = () => { thrId = null; };
    thrEl.addEventListener('pointerup', thrEnd);
    thrEl.addEventListener('pointercancel', thrEnd);
    for (const [el, key] of [[thrUpEl, 'thrUp'], [thrDownEl, 'thrDown']]) {
        el.addEventListener('pointerdown', e => { e.preventDefault(); held.add(`t-${key}`); el.classList.add('is-held'); onAction('touchstart'); });
        const off = () => { held.delete(`t-${key}`); el.classList.remove('is-held'); };
        el.addEventListener('pointerup', off);
        el.addEventListener('pointerleave', off);
        el.addEventListener('pointercancel', off);
        el.addEventListener('contextmenu', e => e.preventDefault());
    }

    // Device tilt (opt-in)
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
    function calibrate() { tilt.p0 = tilt.pitch; tilt.r0 = tilt.roll; }
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
        if (!tilt.listening) { window.addEventListener('deviceorientation', onOrientation); tilt.listening = true; }
        tilt.p0 = null;
        const t0 = performance.now();
        while (!tilt.seen && performance.now() - t0 < 1500) await new Promise(r => setTimeout(r, 100));
        if (!tilt.seen) return { ok: false, why: 'nodata' };
        tilt.on = true;
        return { ok: true };
    }

    return {
        enableTilt, calibrate,
        disableTilt() { tilt.on = false; },
        get tiltOn() { return tilt.on; },
        releaseAll() { held.clear(); stickEnd(); thrId = null; thrSet = null; },
        /** Smoothed stick and the throttle change for this frame. */
        read(dt, throttle) {
            let p = 0, r = 0;
            if (held.has('fwd')) p += 1;
            if (held.has('back')) p -= 1;
            if (held.has('right')) r += 1;
            if (held.has('left')) r -= 1;
            p -= stick.y;
            r += stick.x;
            if (tilt.on && tilt.p0 !== null) {
                const dz = (v) => { const m = Math.abs(v); return m < TILT_DEAD ? 0 : Math.sign(v) * Math.min(1, (m - TILT_DEAD) / (TILT_RANGE - TILT_DEAD)); };
                p -= dz(tilt.pitch - tilt.p0);
                r += dz(tilt.roll - tilt.r0);
            }
            const k = 1 - Math.exp(-dt / 0.1);
            out.pitch += (clamp(p, -1, 1) - out.pitch) * k;
            out.roll += (clamp(r, -1, 1) - out.roll) * k;
            let thr = throttle;
            const rate = 0.7;
            if (held.has('thrUp') || held.has('t-thrUp')) thr += rate * dt;
            if (held.has('thrDown') || held.has('t-thrDown')) thr -= rate * dt;
            if (thrSet !== null) { thr = thrSet; thrSet = thrId === null ? null : thrSet; }
            return { pitch: Math.abs(out.pitch) < 0.01 ? 0 : out.pitch, roll: Math.abs(out.roll) < 0.01 ? 0 : out.roll, throttle: clamp(thr, 0, 1) };
        },
        stickState: () => ({ x: stick.x, y: stick.y }),
    };
}
