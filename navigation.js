const header = document.querySelector('header');
const desktopQuery = window.matchMedia('(min-width: 1081px)');
const SCROLL_TOLERANCE = 8;
const CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let lastScrollTop = 0;
let scrollTicking = false;
let mobileNav = null;

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
        <div class="nav-drawer-footer"><span>Dark mode</span></div>`;
    const footer = drawer.querySelector('.nav-drawer-footer');
    drawer.insertBefore(header.querySelector('.nav-menu').cloneNode(true), footer);
    footer.appendChild(header.querySelector('.theme-toggle').cloneNode(true));

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
        if (e.key === 'Escape') close();
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
    const SECTION = { 'docking-simulator.html': 'game.html' };
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const currentPage = SECTION[page] || page;

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === currentPage);
    });

    mobileNav = buildMobileNav();

    document.querySelectorAll('.theme-toggle').forEach(toggle => {
        toggle.addEventListener('click', toggleTheme);
    });
    syncThemeToggles();

    header.classList.add('show');
    lastScrollTop = window.scrollY;
    updateOnScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    desktopQuery.addEventListener('change', () => {
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
