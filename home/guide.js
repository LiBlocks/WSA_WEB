// The WSA Guide: a short first-visit tour of the 2.0 homepage. Each step lights up the real thing it talks
// about (the page around it dims) and explains it in a sentence or two. Back, Next and Skip; arrow keys,
// Enter and Escape work too. Finishing or skipping is remembered (localStorage 'wsa-home-guide'), and
// Settings can start it again. It waits for the language question and the intro, and never needs the
// assistant or any service.
import { prefs } from './prefs.js';

const root = document.documentElement;

const STEPS = [
    {
        id: 'nav',
        title: 'Find your way around',
        text: 'The menu takes you to every part of WSA: news, vehicles, the mission archive, tools and games. Point at an item and the universe behind the page answers.',
        target: () => visible('.navbar .nav-menu') || visible('.navbar .menu-button'),
    },
    {
        id: 'universe',
        title: 'A live Kerbol system',
        text: 'Behind the page is WSA\'s home system, drawn live. Point at a world to see its name. As you scroll, the camera travels with you.',
        target: (home) => home.universe ? { world: 'kerbin' } : visible('.hero h1'),
    },
    {
        id: 'assistant',
        title: 'Ask WSA',
        text: 'The assistant answers questions about WSA\'s missions, vehicles and this site.',
        target: () => visible('.wsa-ai-launcher'),
    },
    {
        id: 'settings',
        title: 'Make it yours',
        text: 'Settings has the language, light or dark, Liquid Glass and how much the universe moves. The original homepage is there too, and this tour.',
        // on phones and tablets the gear is at the bottom of the menu
        narrowText: 'Settings is the gear at the bottom of the menu: the language, light or dark, Liquid Glass and how much the universe moves. The original homepage is there too, and this tour.',
        target: () => visible('.navbar .settings-button') || visible('.navbar .menu-button'),
    },
    {
        id: 'explore',
        title: 'Explore the universe',
        text: 'Take the controls: fly round the system, open any world\'s record, and look for three hidden discoveries.',
        target: () => visible('.home-explore-btn'),
    },
];

function visible(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height && getComputedStyle(el).visibility !== 'hidden' ? el : null;
}

export class Guide {
    constructor(home) {
        this.home = home;
        this.step = -1;
        this.open = false;
    }

    // On a first visit, once nothing else is asking for the visitor's attention
    maybeStart() {
        if (prefs.guideDone() || this.open || !this.home.isV2()) return;
        const go = () => {
            if (root.classList.contains('wsa-intro-pending') || root.classList.contains('wsa-intro-running')) return;
            if (document.querySelector('dialog[open]')) { setTimeout(go, 800); return; }
            setTimeout(() => { if (!prefs.guideDone() && !this.open && this.home.isV2()) this.start(); }, 700);
        };
        const i18n = window.WSAi18n;
        if (i18n && i18n.afterChoice) i18n.afterChoice(go);
        else go();
    }

    build() {
        if (this.el) return;
        const el = document.createElement('div');
        el.className = 'wsa-guide v2-only';
        el.innerHTML = `
            <div class="wsa-guide-spot" aria-hidden="true"></div>
            <div class="wsa-guide-card" role="dialog" aria-modal="true" aria-labelledby="wsa-guide-title" aria-describedby="wsa-guide-text">
                <p class="wsa-guide-count" aria-live="polite"></p>
                <h2 class="wsa-guide-title" id="wsa-guide-title"></h2>
                <p class="wsa-guide-text" id="wsa-guide-text"></p>
                <div class="wsa-guide-actions">
                    <button type="button" class="wsa-guide-skip">Skip the tour</button>
                    <span class="wsa-guide-nav">
                        <button type="button" class="btn btn-secondary btn-small wsa-guide-back">Back</button>
                        <button type="button" class="btn btn-primary btn-small wsa-guide-next">Next</button>
                    </span>
                </div>
            </div>`;
        document.body.appendChild(el);
        this.el = el;
        this.spot = el.querySelector('.wsa-guide-spot');
        this.card = el.querySelector('.wsa-guide-card');
        el.querySelector('.wsa-guide-skip').addEventListener('click', () => this.close(true));
        el.querySelector('.wsa-guide-back').addEventListener('click', () => this.go(this.step - 1));
        el.querySelector('.wsa-guide-next').addEventListener('click', () => this.go(this.step + 1));
        // A click on the dimmed page does nothing; the tour is ended with Skip or Escape
        el.addEventListener('click', e => { if (e.target === el) e.stopPropagation(); });
        this.onKey = e => {
            if (!this.open) return;
            if (e.key === 'Escape') { e.preventDefault(); this.close(true); }
            else if (e.key === 'ArrowRight' && !e.target.closest('input')) { e.preventDefault(); this.go(this.step + 1); }
            else if (e.key === 'ArrowLeft' && !e.target.closest('input')) { e.preventDefault(); if (this.step > 0) this.go(this.step - 1); }
            else if (e.key === 'Tab') this.trap(e);
        };
        this.onResize = () => { if (this.open) this.place(); };
    }

    start(force) {
        if (!this.home.isV2() || (!force && prefs.guideDone())) return;
        if (this.home.explore && this.home.explore.active) this.home.explore.exit(true);
        this.build();
        this.returnFocus = document.activeElement;
        window.scrollTo(0, 0);
        this.open = true;
        this.el.hidden = false;
        root.classList.add('wsa-guide-open');
        window.addEventListener('keydown', this.onKey, true);
        window.addEventListener('resize', this.onResize);
        window.addEventListener('scroll', this.onResize, { passive: true });
        requestAnimationFrame(() => this.el.classList.add('is-open'));
        this.go(0);
    }

    // Step n; one past the last is the completion card
    go(n) {
        if (!this.open) return;
        if (n < 0) return;
        if (n > STEPS.length) { this.close(true); return; }
        this.step = n;
        const done = n === STEPS.length;
        const s = STEPS[n];
        this.el.querySelector('.wsa-guide-count').textContent = done ? 'Tour complete' : `Step ${n + 1} of ${STEPS.length}`;
        this.el.querySelector('.wsa-guide-title').textContent = done ? 'You\'re all set' : s.title;
        this.el.querySelector('.wsa-guide-text').textContent = done
            ? 'Take the tour again any time from Settings, under Homepage.'
            : s.narrowText && !visible('.navbar .settings-button') ? s.narrowText : s.text;
        this.el.querySelector('.wsa-guide-back').hidden = n === 0 || done;
        this.el.querySelector('.wsa-guide-skip').hidden = done;
        const next = this.el.querySelector('.wsa-guide-next');
        next.textContent = done ? 'Done' : n === STEPS.length - 1 ? 'Finish' : 'Next';
        this.target = done ? null : s.target(this.home);
        this.el.dataset.step = done ? 'done' : s.id;
        this.place();
        next.focus({ preventScroll: true });
    }

    // The spotlight round the target and the card beside it (a bottom sheet on phones)
    place() {
        const pad = 8;
        let box = null, round = 12;
        const t = this.target;
        if (t && t.world && this.home.universe) {
            const p = this.home.universe.screenPosition(t.world);
            if (p && p.visible) {
                const r = Math.max(36, p.r * 1.18);
                box = { left: p.x - r, top: p.y - r, width: r * 2, height: r * 2 };
                round = r;
            }
        } else if (t && t.getBoundingClientRect) {
            const r = t.getBoundingClientRect();
            box = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
            round = Math.min(18, parseFloat(getComputedStyle(t).borderRadius) + pad || 12);
            if (t.classList.contains('settings-button') || t.classList.contains('menu-button') || t.classList.contains('wsa-ai-launcher')) round = Math.min(box.height / 2, 999);
        }
        const spot = this.spot;
        if (box) {
            spot.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border-radius:${round}px`;
            spot.classList.remove('is-empty');
        } else {
            spot.style.cssText = `left:50%;top:50%;width:0;height:0;border-radius:0`;
            spot.classList.add('is-empty');
        }
        const card = this.card;
        const phone = innerWidth < 640;
        this.el.classList.toggle('is-sheet', phone);
        // a sheet goes to the top when what it points at is in the lower half of the screen
        this.el.classList.toggle('is-sheet-top', phone && !!box && box.top + box.height / 2 > innerHeight * 0.5);
        if (phone || !box) {
            card.style.left = card.style.top = '';
            return;
        }
        const cw = card.offsetWidth, ch = card.offsetHeight, gap = 16;
        let top = box.top + box.height + gap;
        if (top + ch > innerHeight - 12) top = box.top - ch - gap;
        if (top < 12) top = Math.min(innerHeight - ch - 12, box.top + box.height / 2 - ch / 2);
        let left = box.left + box.width / 2 - cw / 2;
        // beside a tall target instead of on top of it
        if (box.height > innerHeight * 0.5) {
            left = box.left - cw - gap > 12 ? box.left - cw - gap : box.left + box.width + gap;
            top = Math.max(12, Math.min(innerHeight - ch - 12, box.top + box.height / 2 - ch / 2));
        }
        left = Math.max(12, Math.min(innerWidth - cw - 12, left));
        card.style.left = `${Math.round(left)}px`;
        card.style.top = `${Math.round(Math.max(12, top))}px`;
    }

    trap(e) {
        const items = [...this.card.querySelectorAll('button:not([hidden])')];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }

    close(remember) {
        if (!this.open) return;
        this.open = false;
        if (remember) prefs.set('guide', 'done');
        window.removeEventListener('keydown', this.onKey, true);
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('scroll', this.onResize);
        root.classList.remove('wsa-guide-open');
        this.el.classList.remove('is-open');
        this.el.hidden = true;
        const back = this.returnFocus;
        if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
    }
}
