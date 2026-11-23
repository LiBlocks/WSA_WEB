// NovaUI 2.0, the site's design, on every page; in <head>, before the stylesheets apply, so the first paint is
// already the right design. (The homepage adds its live universe on top: home/.)
//
//   NovaUI 2.0 (default)  <html class="ui-v2" data-ui="v2" data-world="…">: ui2.css applies; data-world names
//                         the world on the page's horizon. On the homepage also class="home-v2" data-home="v2"
//                         data-home-effects="full|reduced|off" (home/home.css, home/main.js).
//   Version 1.0           <html data-ui="v1" data-home="v1">: the original site, exactly as it was. None of the
//                         2.0 stylesheets' rules apply (they are all scoped to .ui-v2 / .home-v2) and no 3D runs.
//
// The choice is kept in localStorage 'wsa-home-version' ('v1'; anything else is 2.0) and made in Settings,
// Design (navigation.js), which calls WSADesign.set(). ?home=v1 or ?home=v2 in the address also switches, and is
// remembered.
(function () {
    var root = document.documentElement;
    var KEY = 'wsa-home-version';
    var page = location.pathname.split('/').pop() || 'index.html';
    var home = /^(index\.html)?$/.test(page);
    // The world on each page's horizon (ui2.css draws it): its colours echo the worlds of the homepage
    var WORLDS = {
        'about.html': 'kerbol', 'news.html': 'kerbin', 'autoland.html': 'kerbin', 'kgoss.html': 'kerbin',
        'goals-achievements.html': 'mun', 'vehicles-programs.html': 'minmus', 'flight-dynamics.html': 'laythe',
        'missions-archive.html': 'duna', 'mission-map.html': 'duna', 'gallery.html': 'eve',
        'games.html': 'jool', 'game.html': 'jool', 'docking-simulator.html': 'jool', 'orbital-rendezvous.html': 'jool',
        'ssto-landing.html': 'jool', 'aegis-landing.html': 'jool', 'engineering-sandbox.html': 'jool',
        'contact.html': 'eeloo', 'support.html': 'eeloo'
    };
    var version = null, effects = 'full';
    try {
        var asked = /[?&]home=(v1|v2)(?:&|$)/.exec(location.search);
        if (asked) {
            if (asked[1] === 'v1') localStorage.setItem(KEY, 'v1');
            else localStorage.removeItem(KEY);
        }
        version = localStorage.getItem(KEY);
        effects = localStorage.getItem('wsa-home-effects') || 'full';
    } catch (e) {}

    // The page's classes for a design ('v1' or 'v2'). The homepage's own home-v2 class is added and removed by
    // home/main.js, which starts and stops the universe with it.
    function apply(v) {
        var two = v !== 'v1';
        root.classList.toggle('ui-v2', two);
        root.setAttribute('data-ui', two ? 'v2' : 'v1');
        if (two && WORLDS[page]) root.setAttribute('data-world', WORLDS[page]);
        else root.removeAttribute('data-world');
    }

    apply(version);
    if (home) {
        if (version === 'v1') {
            root.setAttribute('data-home', 'v1');
        } else {
            root.classList.add('home-v2');
            root.setAttribute('data-home', 'v2');
            root.setAttribute('data-home-effects', /^(full|reduced|off)$/.test(effects) ? effects : 'full');
        }
    }

    window.WSADesign = {
        get: function () { return root.classList.contains('ui-v2') ? 'v2' : 'v1'; },
        apply: apply,
        // The homepage sets this, to swap with its universe; elsewhere the classes change directly, through a
        // cross-fade where the browser has one
        onChange: null,
        set: function (v) {
            v = v === 'v1' ? 'v1' : 'v2';
            try {
                if (v === 'v1') localStorage.setItem(KEY, 'v1');
                else localStorage.removeItem(KEY);
            } catch (e) {}
            var done = function () {
                try { window.dispatchEvent(new CustomEvent('wsa-design', { detail: v })); } catch (e) {}
            };
            if (window.WSADesign.onChange) {
                Promise.resolve(window.WSADesign.onChange(v)).then(done, done);
                return;
            }
            var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (document.startViewTransition && !calm) {
                try { document.startViewTransition(function () { apply(v); }).finished.then(done, done); return; } catch (e) {}
            }
            apply(v);
            done();
        }
    };
})();
