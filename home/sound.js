// Ambient sound for the 2.0 homepage: off unless the visitor turns it on in Settings, never started without
// their action. It reuses the intro's ambient pad (media/intro/, synthesised for WSA, no samples), looped
// quietly. When it was left on, it starts on the visitor's first click or key press; it pauses while the
// tab is hidden and while the intro (which has its own sound) plays.
const SRC = 'media/intro/wsa-intro-ambient';

export class AmbientSound {
    constructor() {
        this.ctx = null;
        this.gain = null;
        this.src = null;
        this.wanted = false;
        this.introBusy = false;
        this.onVisibility = () => this.sync();
        document.addEventListener('visibilitychange', this.onVisibility);
    }

    // Sound was left on: start with the first click or key press (browsers block sound before one)
    armed() {
        this.wanted = true;
        const go = () => {
            window.removeEventListener('pointerdown', go, true);
            window.removeEventListener('keydown', go, true);
            if (this.wanted) this.start();
        };
        window.addEventListener('pointerdown', go, true);
        window.addEventListener('keydown', go, true);
        this.disarm = () => {
            window.removeEventListener('pointerdown', go, true);
            window.removeEventListener('keydown', go, true);
        };
    }

    async start() {
        this.wanted = true;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try {
            if (!this.ctx) {
                this.ctx = new Ctx();
                this.gain = this.ctx.createGain();
                this.gain.gain.value = 0;
                this.gain.connect(this.ctx.destination);
                const probe = document.createElement('audio');
                const ext = probe.canPlayType('audio/ogg; codecs="opus"') ? '.ogg' : '.m4a';
                const data = await fetch(SRC + ext).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
                const buffer = await new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej));
                this.src = this.ctx.createBufferSource();
                this.src.buffer = buffer;
                this.src.loop = true;
                this.src.connect(this.gain);
                this.src.start();
            }
            await this.ctx.resume();
            this.sync();
        } catch (e) {
            console.warn('WSA ambient sound unavailable:', e);
        }
    }

    stop(silent) {
        this.wanted = false;
        if (this.disarm) this.disarm();
        this.sync(silent ? 0.05 : 0.8);
    }

    introStarted() { this.introBusy = true; this.sync(); }
    introOver() { this.introBusy = false; this.sync(); }

    get playing() {
        return !!(this.ctx && this.ctx.state === 'running' && this.wanted && !this.introBusy && !document.hidden);
    }

    // Fade toward the level this moment calls for; suspend the engine when silent
    sync(fade = 1.6) {
        if (!this.ctx || !this.gain) return;
        const audible = this.wanted && !this.introBusy && !document.hidden;
        const now = this.ctx.currentTime, g = this.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(audible ? 0.55 : 0, now + fade);
        clearTimeout(this.suspendTimer);
        if (audible) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } else {
            this.suspendTimer = setTimeout(() => { if (this.ctx && !(this.wanted && !this.introBusy && !document.hidden)) this.ctx.suspend(); }, fade * 1000 + 100);
        }
    }
}
