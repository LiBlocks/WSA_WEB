// Intro curtain (styled and timed by intro.css). Plays on whichever page the visitor enters first in a
// browser session, and again on every reload; moving between pages or going back and forward skips it.
// Loaded in <head> after page-init.js, so the curtain follows the theme that script has already set.
(function () {
    var KEY = 'wsa-intro-seen';
    var LOGO = 'images/wsa-logo.png';
    var TITLE = 'Woody Space Agency';
    // The sequence ends at 3.5s (intro.css); the curtain goes regardless if animationend never comes
    var FAILSAFE_MS = 4300;
    var root = document.documentElement;

    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var reload = !!nav && nav.type === 'reload';
    try {
        if (sessionStorage.getItem(KEY) && !reload) return;
        sessionStorage.setItem(KEY, '1');
    } catch (e) {
        return; // without session storage it would replay on every page
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    new Image().src = LOGO; // fetch the insignia while the page parses
    // Cover the page from the first paint until the curtain itself exists
    root.classList.add('wsa-intro-pending');
    var pending = setTimeout(function () { root.classList.remove('wsa-intro-pending'); }, FAILSAFE_MS);

    function start() {
        var curtain = document.createElement('div');
        curtain.className = 'wsa-intro';
        curtain.setAttribute('aria-hidden', 'true');
        // One <tspan> per letter, each animated on its own, numbered so they start one after another
        var n = 0;
        var letters = TITLE.split('').map(function (ch) {
            return ch === ' ' ? ' ' : '<tspan style="--i:' + n++ + '">' + ch + '</tspan>';
        }).join('');
        curtain.innerHTML =
            '<img class="wsa-intro-logo" src="' + LOGO + '" alt="" width="148" height="148">' +
            '<svg class="wsa-intro-title" aria-hidden="true" focusable="false">' +
            '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">' + letters + '</text></svg>';

        var logo = curtain.querySelector('img');
        logo.addEventListener('error', function () { logo.remove(); });

        // Wheel and touch scrolling over the curtain would scroll the page out of place underneath
        function hold(e) { e.preventDefault(); }
        curtain.addEventListener('wheel', hold, { passive: false });
        curtain.addEventListener('touchmove', hold, { passive: false });

        var timer = 0;
        function finish() {
            clearTimeout(timer);
            root.classList.remove('wsa-intro-pending');
            window.removeEventListener('pageshow', onShow);
            curtain.remove();
        }
        // Restored from the back/forward cache mid-intro: go straight to the site
        function onShow(e) {
            if (e.persisted) finish();
        }
        curtain.addEventListener('animationend', function (e) {
            if (e.target === curtain && e.animationName === 'wsa-intro-leave') finish();
        });
        window.addEventListener('pageshow', onShow);
        timer = setTimeout(finish, FAILSAFE_MS);

        document.body.appendChild(curtain);
        clearTimeout(pending);
        root.classList.remove('wsa-intro-pending');
        // intro.css didn't load: an unstyled curtain would just sit at the end of the page
        if (getComputedStyle(curtain).position !== 'fixed') finish();
    }

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
})();
