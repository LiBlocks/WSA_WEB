const header = document.querySelector('header');
const desktopQuery = window.matchMedia('(min-width: 1081px)');
const SCROLL_TOLERANCE = 8;
const CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let lastScrollTop = 0;
let scrollTicking = false;
let mobileNav = null;
let settings = null;

// Theme (the inline script in each page's <head> applies the initial theme before paint)
function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

function syncThemeToggles() {
    document.querySelectorAll('.theme-toggle').forEach(toggle => {
        toggle.setAttribute('aria-checked', String(isDark()));
    });
}

function toggleTheme() {
    const newTheme = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    syncThemeToggles();
}

// Keeps other open tabs of the site in sync
window.addEventListener('storage', e => {
    if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        document.documentElement.setAttribute('data-theme', e.newValue);
        syncThemeToggles();
    }
});

// Language: a choice in the settings panel (below). The languages' own names label it, so it reads the same
// in either language; i18n.js does the translating and remembers the choice.

function isChinese() {
    return window.WSAi18n.lang === 'zh-Hant';
}

function syncLanguageSwitches() {
    const on = isChinese();
    document.querySelectorAll('.lang-toggle').forEach(control => {
        control.setAttribute('aria-checked', String(on));
    });
    document.querySelectorAll('.settings-lang [data-lang]').forEach(button => {
        button.setAttribute('aria-pressed', String((button.dataset.lang === 'zh-Hant') === on));
    });
}

// Settings: a gear opens a small panel with the language, light or dark, and Liquid Glass (liquid-glass.js
// puts its switch in that row and shows it). On wide screens the gear is at the right end of the top bar
// and the panel opens under it; on phones and tablets it sits in the bottom-right corner of the menu drawer
// and the panel opens above it, over the drawer. The panel lives on <body>, for the same reason as the
// drawer below.
const GEAR_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function makeGear(className) {
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'icon-button ' + className;
    gear.setAttribute('aria-label', 'Settings');
    gear.setAttribute('aria-expanded', 'false');
    gear.setAttribute('aria-controls', 'settings-panel');
    gear.title = 'Settings';
    gear.innerHTML = GEAR_ICON;
    return gear;
}

function buildSettings() {
    const navbar = header.querySelector('.navbar');
    const gear = makeGear('settings-button');
    const menuButton = navbar.querySelector('.menu-button');
    if (menuButton) menuButton.before(gear);
    else navbar.appendChild(gear);
    const drawerGear = document.querySelector('.nav-drawer .drawer-settings-button');
    const gears = drawerGear ? [gear, drawerGear] : [gear];
    let trigger = gear;

    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.id = 'settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'settings-title');
    panel.hidden = true;
    panel.innerHTML = `
        <h2 class="settings-title" id="settings-title">Settings</h2>
        <div class="settings-row settings-lang" hidden>
            <span class="settings-label" id="settings-lang-label">Language</span>
            <div class="settings-choice" role="group" aria-labelledby="settings-lang-label" translate="no">
                <button type="button" data-lang="en" lang="en" aria-pressed="true">English</button>
                <button type="button" data-lang="zh-Hant" lang="zh-Hant" aria-pressed="false">繁體中文</button>
            </div>
        </div>
        <div class="settings-row settings-theme"><span class="settings-label">Dark mode</span></div>
        <div class="settings-row settings-glass" hidden><span class="settings-label">Liquid Glass <small>Experimental</small></span></div>
        <div class="settings-row settings-design" hidden>
            <span class="settings-label" id="settings-design-label">Design</span>
            <div class="settings-choice" role="group" aria-labelledby="settings-design-label">
                <button type="button" data-design="v2" aria-pressed="true">NovaUI 2.0</button>
                <button type="button" data-design="v1" aria-pressed="false">Version 1.0</button>
            </div>
        </div>`;
    const themeToggle = navbar.querySelector('.theme-toggle');
    if (themeToggle) panel.querySelector('.settings-theme').appendChild(themeToggle);
    if (window.WSAi18n) {
        panel.querySelector('.settings-lang').hidden = false;
        panel.querySelectorAll('.settings-lang [data-lang]').forEach(button => {
            button.addEventListener('click', () => window.WSAi18n.set(button.dataset.lang));
        });
    }
    // The site's design: NovaUI 2.0 or the original Version 1.0, on every page (ui-boot.js)
    if (window.WSADesign) {
        const row = panel.querySelector('.settings-design');
        const sync = () => row.querySelectorAll('[data-design]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.design === window.WSADesign.get())));
        row.hidden = false;
        sync();
        row.querySelectorAll('[data-design]').forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.design !== window.WSADesign.get()) window.WSADesign.set(button.dataset.design);
            });
        });
        window.addEventListener('wsa-design', () => { sync(); fitLogo(); });
    }
    document.body.appendChild(panel);

    // Right-aligned with its gear, never past either edge of the screen: under the bar's gear, above the
    // drawer's
    function place() {
        const r = trigger.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const right = Math.min(Math.max(12, vw - r.right), Math.max(12, vw - panel.offsetWidth - 12));
        const above = trigger !== gear;
        panel.classList.toggle('is-above', above);
        panel.style.top = above ? '' : Math.round(r.bottom + 10) + 'px';
        panel.style.bottom = above ? Math.round(window.innerHeight - r.top + 10) + 'px' : '';
        panel.style.right = Math.round(right) + 'px';
        return r.bottom > 0 && r.top < window.innerHeight;
    }

    function isOpen() {
        return !panel.hidden;
    }

    function open(from) {
        trigger = from || gear;
        panel.hidden = false;
        place();
        trigger.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => panel.classList.add('is-open'));
        const first = panel.querySelector('.settings-row:not([hidden]) button');
        if (first) first.focus({ preventScroll: true });
    }

    function close(refocus) {
        if (!isOpen()) return;
        panel.classList.remove('is-open');
        panel.hidden = true;
        gears.forEach(g => g.setAttribute('aria-expanded', 'false'));
        if (refocus) trigger.focus({ preventScroll: true });
    }

    gears.forEach(g => g.addEventListener('click', () => (isOpen() && trigger === g ? close(true) : (close(false), open(g)))));
    document.addEventListener('pointerdown', e => {
        if (isOpen() && !panel.contains(e.target) && !gears.some(g => g.contains(e.target))) close(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) {
            e.preventDefault();
            close(true);
        }
    });
    // Tabbing out of the panel closes it
    panel.addEventListener('focusout', e => {
        if (e.relatedTarget && !panel.contains(e.relatedTarget) && !gears.includes(e.relatedTarget)) close(false);
    });
    // It follows the gear; once the gear has scrolled or slid away (the bar hides on desktop), it closes
    const follow = () => {
        if (isOpen() && !place()) close(false);
    };
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
    // ...and as soon as the bar is told to hide (with or without a transition: Liquid Glass has none)
    new MutationObserver(() => {
        if (header.classList.contains('hide') && trigger === gear) close(false);
    }).observe(header, { attributes: true, attributeFilter: ['class'] });
    // Closing the drawer closes a panel opened from it
    new MutationObserver(() => {
        if (trigger !== gear && !document.body.classList.contains('nav-open')) close(false);
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return { close };
}

// The logo: the agency's full name whenever the bar has room for it, WSA only when it really doesn't fit
// (narrow phones, and desktop windows where all the links need the space). Measured, so it adapts to the
// language and the window. Runs straight away as well, so the intro (which copies the logo) sees the result.
function fitLogo() {
    const nav = header.querySelector('.navbar');
    const logo = nav && nav.querySelector('.logo');
    if (!logo || !logo.querySelector('.logo-full')) return;
    nav.dataset.logo = 'full';
    const cs = getComputedStyle(nav);
    const avail = nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap) || 0;
    // what will share the row (the theme switch moves into the settings panel; the gear may not exist yet)
    const kids = [...nav.children].filter(el => !el.classList.contains('theme-toggle') && el.getClientRects().length);
    let need = kids.reduce((w, el) => w + Math.max(el.scrollWidth, el.getBoundingClientRect().width), 0) + gap * (kids.length - 1);
    if (desktopQuery.matches && !nav.querySelector('.settings-button')) need += 36 + gap;
    nav.dataset.logo = need <= avail + 0.5 ? 'full' : 'short';
}

let fitFrame = 0;
function refitLogo() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitLogo);
}

fitLogo();
window.addEventListener('resize', refitLogo);
window.addEventListener('wsa-langchange', fitLogo);

// Mobile drawer + floating menu button. Appended to <body> because the header's
// backdrop-filter/transform would make fixed-position children position relative to it.
function buildMobileNav() {
    const menuButton = header.querySelector('.menu-button');

    const drawer = document.createElement('nav');
    drawer.className = 'nav-drawer';
    drawer.id = 'nav-drawer';
    drawer.setAttribute('aria-label', 'Site');
    drawer.innerHTML = `
        <div class="nav-drawer-head">
            <a href="index.html" class="logo">WSA</a>
            <button type="button" class="icon-button nav-close" aria-label="Close menu">${CLOSE_ICON}</button>
        </div>
        <div class="nav-drawer-foot"></div>`;
    const foot = drawer.querySelector('.nav-drawer-foot');
    drawer.insertBefore(header.querySelector('.nav-menu').cloneNode(true), foot);
    // Settings (language, light or dark, Liquid Glass) are behind this gear, in the drawer's corner
    foot.appendChild(makeGear('drawer-settings-button'));

    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'menu-fab';
    fab.setAttribute('aria-label', 'Open menu');
    fab.setAttribute('aria-controls', 'nav-drawer');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = menuButton.innerHTML;

    document.body.append(backdrop, drawer, fab);

    let returnFocusTo = null;

    function setExpanded(expanded) {
        [menuButton, fab].forEach(button => button.setAttribute('aria-expanded', String(expanded)));
    }

    function open(trigger) {
        returnFocusTo = trigger;
        document.body.classList.add('nav-open');
        setExpanded(true);
        drawer.querySelector('.nav-close').focus();
    }

    function close() {
        if (!document.body.classList.contains('nav-open')) return;
        document.body.classList.remove('nav-open');
        setExpanded(false);
        if (returnFocusTo) returnFocusTo.focus({ preventScroll: true });
    }

    menuButton.addEventListener('click', () => open(menuButton));
    fab.addEventListener('click', () => open(fab));
    drawer.querySelector('.nav-close').addEventListener('click', close);
    backdrop.addEventListener('click', close);
    drawer.querySelectorAll('.nav-menu a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', e => {
        // Escape closes the settings panel first, when it is open over the drawer
        const panel = document.getElementById('settings-panel');
        if (e.key === 'Escape' && !(panel && !panel.hidden)) close();
    });

    return { fab, close };
}

// Desktop: header hides on scroll down, returns on scroll up.
// Mobile: header scrolls away with the page; only the small menu button appears.
function updateOnScroll() {
    const scrollTop = Math.max(window.scrollY, 0);

    if (desktopQuery.matches) {
        const delta = scrollTop - lastScrollTop;
        if (Math.abs(delta) < SCROLL_TOLERANCE) return;
        const hide = delta > 0 && scrollTop > 100;
        header.classList.toggle('hide', hide);
        header.classList.toggle('show', !hide);
    } else {
        mobileNav.fab.classList.toggle('visible', scrollTop > header.offsetHeight);
    }

    lastScrollTop = scrollTop;
}

function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
        updateOnScroll();
        scrollTicking = false;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Pages without their own nav entry light up the section they belong to
    const SECTION = { 'game.html': 'games.html', 'docking-simulator.html': 'games.html', 'ssto-landing.html': 'games.html', 'orbital-rendezvous.html': 'games.html', 'engineering-sandbox.html': 'games.html', 'aegis-landing.html': 'games.html', 'mission-map.html': 'missions-archive.html' };
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const currentPage = SECTION[page] || page;

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === currentPage);
    });

    // The drawer copies the bar's theme switch first; then the settings panel takes the original
    mobileNav = buildMobileNav();
    settings = buildSettings();
    fitLogo();

    if (window.WSAi18n) {
        window.addEventListener('wsa-langchange', syncLanguageSwitches);
        syncLanguageSwitches();
    }

    document.querySelectorAll('.theme-toggle').forEach(toggle => {
        toggle.addEventListener('click', toggleTheme);
    });
    syncThemeToggles();

    header.classList.add('show');
    lastScrollTop = window.scrollY;
    updateOnScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    desktopQuery.addEventListener('change', () => {
        settings.close(false);
        header.classList.remove('hide');
        header.classList.add('show');
        mobileNav.close();
        mobileNav.fab.classList.remove('visible');
        lastScrollTop = window.scrollY;
        updateOnScroll();
    });

    // Expandable sections
    document.querySelectorAll('.expandable-section').forEach(section => {
        const sectionHeader = section.querySelector('.expandable-header');
        if (sectionHeader) {
            sectionHeader.addEventListener('click', function() {
                section.classList.toggle('expanded');
            });
        }
    });

    // Smooth scrolling for same-page anchor links (checked at click time so later-added links work too)
    document.addEventListener('click', e => {
        const anchor = e.target.closest('a[href^="#"]');
        const target = anchor && anchor.getAttribute('href').length > 1 && document.getElementById(anchor.getAttribute('href').slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
    });

    // Copy buttons (support page addresses)
    document.querySelectorAll('[data-copy-target]').forEach(button => {
        const label = button.textContent;
        button.addEventListener('click', async () => {
            const target = document.getElementById(button.dataset.copyTarget);
            const text = target.textContent.trim();
            let copied = false;
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch (e) {
                // The Clipboard API only exists on https/localhost; plain http on a phone lands here
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(target);
                selection.removeAllRanges();
                selection.addRange(range);
                copied = document.execCommand('copy');
            }
            button.textContent = copied ? 'Copied' : 'Selected, copy manually';
            setTimeout(() => { button.textContent = label; }, 2000);
        });
    });
});
