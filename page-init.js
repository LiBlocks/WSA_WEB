// Loaded in <head> before first paint: applies the saved/system theme and sets up page-to-page transitions.
(function () {
    var root = document.documentElement;

    var theme = null;
    try { theme = localStorage.getItem('theme'); } catch (e) {}
    if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', theme);
    root.classList.add('js');

    // Browsers without cross-document view transitions get a simple fade-in instead
    if (!('onpagereveal' in window)) {
        root.classList.add('page-enter');
        return;
    }

    // Slide direction follows the tab order, like swiping between tabs
    var PAGE_ORDER = ['index.html', 'about.html', 'goals-achievements.html', 'vehicles-programs.html',
        'missions-archive.html', 'gallery.html', 'autoland.html', 'game.html', 'kgoss.html', 'support.html'];

    function pageIndex(url) {
        return PAGE_ORDER.indexOf(new URL(url, location.href).pathname.split('/').pop() || 'index.html');
    }

    window.addEventListener('pageswap', function () {
        try { sessionStorage.setItem('wsa-from-page', String(pageIndex(location.href))); } catch (e) {}
    });

    window.addEventListener('pagereveal', function (e) {
        var from = -1;
        try {
            var stored = sessionStorage.getItem('wsa-from-page');
            if (stored !== null) from = Number(stored);
            sessionStorage.removeItem('wsa-from-page');
        } catch (err) {}
        var to = pageIndex(location.href);
        if (!e.viewTransition || !e.viewTransition.types || from < 0 || to < 0 || from === to) return;
        e.viewTransition.types.add(to > from ? 'forward' : 'backward');
    });
})();
