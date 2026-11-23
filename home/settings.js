// The homepage's part of the Settings panel (the gear in the top bar, built by navigation.js). Only on the
// homepage. On 2.0: background effects, animation, graphics quality, ambient sound, the guide, resetting
// these, and going back to the original homepage. On 1.0: the way back to 2.0.

let dialog = null;
let toastEl = null;

export function notify(text) {
    if (!toastEl) {
        toastEl = document.createElement('p');
        toastEl.className = 'home-toast';
        toastEl.setAttribute('role', 'status');
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('is-shown');
    clearTimeout(toastEl.timer);
    toastEl.timer = setTimeout(() => toastEl.classList.remove('is-shown'), 4200);
}

function choice(name, label, options, current) {
    const id = `sh-${name}`;
    return `
        <div class="settings-row settings-stack" data-row="${name}">
            <span class="settings-label" id="${id}-label">${label}</span>
            <div class="settings-choice" role="group" aria-labelledby="${id}-label">
                ${options.map(([v, t]) => `<button type="button" data-${name}="${v}" aria-pressed="${v === current}">${t}</button>`).join('')}
            </div>
        </div>`;
}

function confirmV1() {
    return new Promise(resolve => {
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.className = 'wsa-dialog home-confirm';
            dialog.setAttribute('aria-labelledby', 'home-confirm-title');
            dialog.setAttribute('aria-describedby', 'home-confirm-text');
            dialog.innerHTML = `
                <form method="dialog">
                    <div class="home-confirm-body">
                        <h2 id="home-confirm-title">Return to the WSA V1.0 homepage?</h2>
                        <p id="home-confirm-text">The original homepage comes back, without the 3D universe, the guide or Explore mode. Your other settings stay as they are, and you can switch back to WSA 2.0 any time in Settings.</p>
                    </div>
                    <div class="home-confirm-actions">
                        <button type="submit" value="cancel" class="btn btn-secondary" autofocus>Keep WSA 2.0</button>
                        <button type="submit" value="v1" class="btn btn-primary">Switch to V1.0</button>
                    </div>
                </form>`;
            dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close('cancel'); });
            document.body.appendChild(dialog);
        }
        dialog.returnValue = '';
        dialog.addEventListener('close', () => {
            if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
            resolve(dialog.returnValue === 'v1');
        }, { once: true });
        dialog.showModal();
        document.body.classList.add('dialog-open');
    });
}

export function initSettings(home, prefs) {
    home.notify = notify;
    // navigation.js builds the panel when the document has loaded; this module may run first
    const panel = document.getElementById('settings-panel');
    if (!panel) {
        // (modules run before DOMContentLoaded fires, while the document is already 'interactive')
        if (document.readyState !== 'complete' && !initSettings.waiting) {
            initSettings.waiting = true;
            document.addEventListener('DOMContentLoaded', () => initSettings(home, prefs), { once: true });
        }
        return;
    }
    const box = document.createElement('div');
    box.className = 'settings-home';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-labelledby', 'settings-home-title');
    panel.appendChild(box);

    function render() {
        if (!home.isV2()) {
            box.innerHTML = `
                <h3 class="settings-subtitle" id="settings-home-title">Homepage</h3>
                <p class="settings-note">You're seeing the original WSA V1.0 homepage.</p>
                <div class="settings-actions">
                    <button type="button" class="settings-action" data-act="v2">Switch to the WSA 2.0 homepage</button>
                </div>`;
            return;
        }
        const effects = prefs.effects();
        const off = effects === 'off';
        box.innerHTML = `
            <h3 class="settings-subtitle" id="settings-home-title">Homepage</h3>
            ${choice('effects', 'Background effects', [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']], effects)}
            <div class="settings-row settings-stack" data-row="intensity">
                <label class="settings-label" for="sh-intensity">Animation <output for="sh-intensity" class="settings-value"></output></label>
                <input type="range" id="sh-intensity" class="settings-range" min="0" max="100" step="5" ${off ? 'disabled' : ''}>
            </div>
            ${choice('quality', 'Graphics quality', [['auto', 'Auto'], ['high', 'High'], ['ultra', 'Ultra']], prefs.quality())}
            <div class="settings-row" data-row="sound">
                <span class="settings-label" id="sh-sound-label">Ambient sound</span>
                <button type="button" class="settings-switch" role="switch" aria-checked="${prefs.sound()}" aria-labelledby="sh-sound-label"><span class="knob" aria-hidden="true"></span></button>
            </div>
            <div class="settings-actions">
                <button type="button" class="settings-action" data-act="guide">Restart the WSA Guide</button>
                <button type="button" class="settings-action" data-act="reset">Reset homepage preferences</button>
                <button type="button" class="settings-action is-v1" data-act="v1">Return to WSA V1.0 homepage</button>
            </div>`;
        const range = box.querySelector('#sh-intensity');
        const out = box.querySelector('.settings-value');
        range.value = prefs.intensity();
        out.textContent = `${range.value}%`;
        range.setAttribute('aria-valuetext', `${range.value} percent`);
        range.addEventListener('input', () => {
            out.textContent = `${range.value}%`;
            range.setAttribute('aria-valuetext', `${range.value} percent`);
            home.setIntensity(Number(range.value));
        });
        if (off) box.querySelectorAll('[data-quality]').forEach(b => { b.disabled = true; });
    }

    box.addEventListener('click', async e => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.effects) {
            home.setEffects(t.dataset.effects);
            render();
            box.querySelector(`[data-effects="${t.dataset.effects}"]`).focus();
        } else if (t.dataset.quality) {
            home.setQuality(t.dataset.quality);
            render();
            box.querySelector(`[data-quality="${t.dataset.quality}"]`).focus();
        } else if (t.classList.contains('settings-switch')) {
            const on = t.getAttribute('aria-checked') !== 'true';
            t.setAttribute('aria-checked', String(on));
            home.setSound(on);
        } else if (t.dataset.act === 'guide') {
            document.querySelector('.settings-button').click();      // close the panel first
            home.restartGuide();
        } else if (t.dataset.act === 'reset') {
            home.resetPrefs();
            render();
            notify('Homepage preferences are back to their defaults.');
            box.querySelector('[data-act="reset"]').focus();
        } else if (t.dataset.act === 'v1') {
            if (await confirmV1()) {
                await home.useVersion('v1');
                render();
                notify('You\'re on the WSA V1.0 homepage. Switch back any time in Settings.');
            }
        } else if (t.dataset.act === 'v2') {
            await home.useVersion('v2');
            render();
            notify('Welcome to the WSA 2.0 homepage.');
        }
    });
    render();
}
