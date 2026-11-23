// Homepage only, in <head> before the stylesheets apply: decides which homepage this visit shows, so the
// first paint is already the right one.
//   WSA 2.0 (default)   <html class="home-v2" data-home="v2" data-home-effects="full|reduced|off">
//   WSA 1.0             <html data-home="v1">: the original homepage, exactly as it was (no home-v2 class,
//                       so none of home/home.css applies and no 3D code runs)
// The choice is kept in localStorage 'wsa-home-version' ('v1'; anything else is 2.0) and changed in
// Settings. ?home=v1 or ?home=v2 in the address also switches, and is remembered.
(function () {
    var root = document.documentElement;
    var version = null, effects = 'full';
    try {
        var asked = /[?&]home=(v1|v2)(?:&|$)/.exec(location.search);
        if (asked) {
            if (asked[1] === 'v1') localStorage.setItem('wsa-home-version', 'v1');
            else localStorage.removeItem('wsa-home-version');
        }
        version = localStorage.getItem('wsa-home-version');
        effects = localStorage.getItem('wsa-home-effects') || 'full';
    } catch (e) {}
    if (version === 'v1') {
        root.setAttribute('data-home', 'v1');
        return;
    }
    root.classList.add('home-v2');
    root.setAttribute('data-home', 'v2');
    root.setAttribute('data-home-effects', /^(full|reduced|off)$/.test(effects) ? effects : 'full');
})();
