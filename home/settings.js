// The homepage's part of the Settings panel (the gear in the top bar, built by navigation.js). Only on the
// homepage, and only with NovaUI 2.0: background effects, animation, graphics quality, ambient sound, the guide
// and resetting these. (Choosing the site's design, NovaUI 2.0 or Version 1.0, is the panel's own Design row.)

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
        box.hidden = !home.isV2();
        if (box.hidden) {
            box.innerHTML = '';
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

    box.addEventListener('click', e => {
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
        }
    });
    window.addEventListener('wsa-design', e => {
        render();
        notify(e.detail === 'v1' ? 'You\'re on Version 1.0, the original design. Switch back any time in Settings.' : 'Welcome to NovaUI 2.0.');
    });
    render();
}
