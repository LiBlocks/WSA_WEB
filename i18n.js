// Site language: English (the source) or Traditional Chinese. Loaded in <head> right after page-init.js.
//
// The pages and games are written in English. The first page a visitor opens asks which language they want
// (askLanguage below); the answer is kept in localStorage until they change it in Settings (the gear in the
// top bar) or the menu drawer. When Traditional Chinese is chosen, this file loads the dictionary (i18n-zh-Hant.js) and translates the page
// in place as it is parsed and whenever scripts change it: text, the attributes people read or hear
// (title, aria-label, alt, placeholder…), text drawn on canvases (game HUDs, certificates, graphs), page
// titles, dialogs and shared or copied text. Switching back restores the original English.
//
// Dictionary format (see i18n-zh-Hant.js):
//   exact:    { 'English text': '中文' } — whitespace is collapsed before lookup.
//             Text that runs around inline elements (links, <strong>, <kbd>…) is looked up as one sentence,
//             with each element written <0>, <1>… so the translation can place them where they belong.
//   patterns: [['Fuel left {#} kg', '剩餘燃料 {1} kg'], …] — {#} matches a number, {*} any text (itself
//             translated when the dictionary knows it), {=} any text kept as written (a search query);
//             {1}, {2}… in the translation are the matches in order.
//   keep:     ['Fammok-2', …] — names and other text that stays as written.
(function () {
    'use strict';
    var KEY = 'wsa-lang';
    var ZH = 'zh-Hant';
    var DICT_SRC = 'i18n-zh-Hant.js?v=4';
    var root = document.documentElement;

    var ATTRS = ['title', 'aria-label', 'alt', 'placeholder', 'data-tip', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'label'];
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1, TEMPLATE: 1, script: 1, style: 1 };
    var INLINE = {
        A: 1, ABBR: 1, B: 1, BDI: 1, BDO: 1, BR: 1, CITE: 1, CODE: 1, DATA: 1, DFN: 1, EM: 1, I: 1, IMG: 1, KBD: 1, MARK: 1,
        Q: 1, S: 1, SAMP: 1, SMALL: 1, SPAN: 1, STRONG: 1, SUB: 1, SUP: 1, TIME: 1, U: 1, VAR: 1, WBR: 1, svg: 1, tspan: 1
    };
    var LETTERS = /[A-Za-z]{2}/;
    // Measurement units stay as written (SI symbols read the same in Chinese technical text)
    var UNITS = /^(?:m|km|Mm|Gm|cm|mm|kg|t|kt|g|N|kN|MN|s|ms|min|h|hr|d|Hz|kHz|deg|rad|Isp|kPa|Pa|atm|px|fps|FPS|x|AU|UT|MET|ISO|PNG|JPG|WSA|KSP|TWR|RCS|SAS|GPS|HUD|UTC|OK)$/;
    var MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

    var I = window.WSAi18n = {
        lang: 'en',
        on: false,
        collect: false,
        missing: null,
        tr: function (s) { return s; },
        set: setLang,
        ready: function () { if (wanted === ZH) start(); }
    };

    var wanted = 'en';
    try { wanted = localStorage.getItem(KEY) === ZH ? ZH : 'en'; } catch (e) {}
    try { I.collect = localStorage.getItem('wsa-i18n-collect') === '1'; } catch (e) {}
    if (I.collect) I.missing = new Set();

    /* ---------- Dictionary ---------- */

    var exact = null, lower = null, patIndex = null, patGeneric = null, cache = new Map();

    function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function compile(data) {
        exact = new Map();
        lower = new Map();
        Object.keys(data.exact || {}).forEach(function (k) {
            var key = norm(k);
            exact.set(key, data.exact[k]);
            if (!lower.has(key.toLowerCase())) lower.set(key.toLowerCase(), data.exact[k]);
        });
        (data.keep || []).forEach(function (k) { exact.set(norm(k), norm(k)); });
        patIndex = Object.create(null);
        patGeneric = [];
        (data.patterns || []).forEach(function (p) {
            var key = norm(p[0]);
            var src = '^' + key.split(/(\{#\}|\{\*\}|\{=\})/).map(function (part) {
                if (part === '{#}') return '([-+−]?\\d[\\d,]*(?:\\.\\d+)?)';
                if (part === '{*}' || part === '{=}') return '(.*?)';
                return escapeRe(part);
            }).join('') + '$';
            var entry = { re: new RegExp(src), out: p[1], kinds: (key.match(/\{#\}|\{\*\}|\{=\}/g) || []) };
            var prefix = key.split(/\{#\}|\{\*\}|\{=\}|<\d+>/)[0];
            var word = /[A-Za-z]+/.exec(prefix);
            if (word && prefix.trim().indexOf(word[0]) === 0) (patIndex[word[0].toLowerCase()] = patIndex[word[0].toLowerCase()] || []).push(entry);
            else patGeneric.push(entry);
        });
        cache = new Map();
    }

    function untranslatable(s) {
        // Numbers, units, single letters, addresses, file names and the like
        if (!LETTERS.test(s)) return true;
        if (/@|:\/\/|^[\w.-]+\.(?:html|js|css|png|jpe?g|mp4|svg)$/i.test(s)) return true;
        var words = s.match(/[A-Za-z]+/g) || [];
        return words.every(function (w) { return w.length < 2 || UNITS.test(w); });
    }

    function dateText(s) {
        var m = /^(?:(\d{1,2}) )?([A-Za-z]{3,9})\.? (?:(\d{1,2}), )?(\d{4})$/.exec(s);
        if (!m || !MONTHS[m[2].toLowerCase()]) return null;
        var day = m[1] || m[3];
        return m[4] + '年' + MONTHS[m[2].toLowerCase()] + '月' + (day ? Number(day) + '日' : '');
    }

    function viaPatterns(core) {
        var word = /[A-Za-z]+/.exec(core);
        var lists = [word ? patIndex[word[0].toLowerCase()] : null, patGeneric];
        for (var l = 0; l < 2; l++) {
            var list = lists[l];
            if (!list) continue;
            for (var i = 0; i < list.length; i++) {
                var p = list[i], m = p.re.exec(core);
                if (!m) continue;
                // A {*} part must itself be known (or be a number or unit), so a short pattern never
                // half-translates an unrelated sentence that happens to fit around it
                var parts = [], ok = true;
                for (var k = 1; k < m.length; k++) {
                    var v = m[k];
                    if (p.kinds[k - 1] === '{*}') {
                        var t = lookup(v, true) || listOf(v);
                        if (t === null && !untranslatable(v)) { ok = false; break; }
                        v = t === null ? v : t;
                    }
                    parts.push(v);
                }
                if (!ok) continue;
                return p.out.replace(/\{(\d+)\}/g, function (_, n) { return parts[Number(n) - 1] === undefined ? '' : parts[Number(n) - 1]; });
            }
        }
        return null;
    }

    // Text built from parts at run time: "Normal difficulty · 2.1 m from the pad" or several sentences
    function viaParts(core) {
        var parts, joiner;
        if (core.indexOf(' · ') > 0) { parts = core.split(' · '); joiner = ' · '; }
        else if (/[.!?] +[A-Z]/.test(core)) { parts = core.replace(/([.!?]) +(?=[A-Z])/g, '$1\u0000').split('\u0000'); joiner = ''; }
        else return null;
        var any = false;
        var out = parts.map(function (part) {
            // Elements are numbered across the whole sentence; look each part up numbered from <0>
            var marks = part.match(/<\d+>/g) || [];
            var t = lookup(part.replace(/<\d+>/g, (function (n) { return function () { return '<' + (n++) + '>'; }; })(0)), true);
            if (t !== null && marks.length) t = t.replace(/<(\d+)>/g, function (m, k) { return marks[Number(k)] || m; });
            if (t !== null) { any = true; return t; }
            if (!untranslatable(part)) note(part);
            return part;
        });
        return any ? out.join(joiner) : null;
    }

    function lookup(core, quiet) {
        if (cache.has(core)) return cache.get(core);
        var out = exact.get(core);
        if (out === undefined && core === core.toUpperCase()) out = lower.get(core.toLowerCase());
        if (out === undefined) out = dateText(core);
        if (out === undefined || out === null) out = viaPatterns(core);
        if (out === null && !quiet) out = viaParts(core);
        if (out === undefined) out = null;
        if (out === null && quiet) return null;     // a full lookup may still find it sentence by sentence
        if (cache.size > 8000) cache.clear();
        cache.set(core, out);
        return out;
    }

    function note(core) {
        if (I.collect && I.missing && !untranslatable(core) && !/[\u2e80-\u9fff]/.test(core)) I.missing.add(core);
    }

    // "Bullseye, Feather Touch, Fuel to Spare": a list whose items the dictionary knows
    function listOf(text) {
        var sep = text.indexOf('; ') >= 0 ? '; ' : text.indexOf(', ') >= 0 ? ', ' : null;
        if (!sep) return null;
        var items = text.split(sep).map(function (item) { return lookup(item, true); });
        return items.every(function (t) { return t !== null; }) ? items.join(sep === '; ' ? '；' : '、') : null;
    }

    // Translated text → the English it came from, for copies of translated nodes that scripts make
    // (the menu drawer clones the header), so switching back can restore those too
    var rev = new Map();
    function remember(out, src) {
        if (rev.size > 6000) rev.delete(rev.keys().next().value);
        // Two different English texts with the same translation: neither can be restored from it
        rev.set(out, rev.has(out) && rev.get(out) !== src ? null : src);
    }

    function tr(s) {
        if (!I.on || typeof s !== 'string' || !LETTERS.test(s)) return s;
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
        var core = norm(m[2]);
        var out = lookup(core);
        if (out === null) {
            if (cache.get(core) === null && !untranslatable(core)) note(core);
            return s;
        }
        out = m[1] + out + m[3];
        if (out !== s) remember(out, s);
        return out;
    }
    I.tr = tr;
    I.has = function (s) { return lookup(norm(s), true) !== null; };

    /* ---------- The page ---------- */

    var origText = new WeakMap(), wroteText = new WeakMap();
    var origKids = new WeakMap(), wroteKey = new WeakMap();
    var attrState = new WeakMap();      // element → { name: [original, written] }

    function skipped(el) {
        for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
            if (SKIP_TAGS[e.tagName] || e.getAttribute('translate') === 'no' || e.isContentEditable) return true;
            if (e.classList && e.classList.contains('notranslate')) return true;
        }
        return false;
    }

    function textNode(t) {
        var v = t.data;
        if (wroteText.get(t) === v || !LETTERS.test(v)) return;
        var out = tr(v);
        origText.set(t, v);
        if (out !== v) {
            wroteText.set(t, out);
            t.data = out;
        } else {
            wroteText.delete(t);
        }
    }

    function templateKey(el) {
        var key = '', n = 0;
        for (var c = el.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) key += c.data;
            else if (c.nodeType === 1) key += '<' + (n++) + '>';
        }
        return norm(key);
    }

    // An element whose own text runs around inline elements that carry text of their own is translated
    // as one sentence; anything else has its text pieces translated one by one.
    function asSentence(el) {
        var text = false, inlineText = false;
        for (var c = el.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) { if (LETTERS.test(c.data)) text = true; }
            else if (c.nodeType === 1) {
                if (!INLINE[c.tagName] && !INLINE[c.localName]) return false;
                if (c.tagName !== 'BR' && /\S/.test(c.textContent)) inlineText = true;
            }
        }
        return text && inlineText;
    }

    function sentence(el) {
        var key = templateKey(el);
        if (wroteKey.get(el) === key) return;
        var out = tr(key);
        if (out === key) return;
        var kids = Array.prototype.slice.call(el.childNodes);
        var elems = kids.filter(function (c) { return c.nodeType === 1; });
        origKids.set(el, kids);
        var used = [];
        var frag = document.createDocumentFragment();
        out.split(/<(\d+)>/).forEach(function (part, i) {
            if (i % 2 === 0) { if (part) frag.appendChild(document.createTextNode(part)); return; }
            var e = elems[Number(part)];
            if (e && used.indexOf(e) < 0) { used.push(e); frag.appendChild(e); }
        });
        elems.forEach(function (e) { if (used.indexOf(e) < 0) frag.appendChild(e); });
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(frag);
        wroteKey.set(el, templateKey(el));
    }

    function attrs(el) {
        for (var i = 0; i < ATTRS.length; i++) {
            var name = ATTRS[i];
            if (!el.hasAttribute(name)) continue;
            attr(el, name);
        }
        if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type) && el.hasAttribute('value')) attr(el, 'value');
    }

    function attr(el, name) {
        var v = el.getAttribute(name);
        var st = attrState.get(el);
        if (st && st[name] && st[name][1] === v) return;
        if (!LETTERS.test(v)) return;
        var out = tr(v);
        if (!st) attrState.set(el, st = {});
        st[name] = [v, out];
        if (out !== v) el.setAttribute(name, out);
    }

    function shallow(el) {
        if (!el || el.nodeType !== 1 || skipped(el)) return;
        if (asSentence(el)) { sentence(el); return; }
        for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) textNode(c);
    }

    function tree(node) {
        if (node.nodeType === 3) { shallow(node.parentNode); return; }
        if (node.nodeType !== 1 || skipped(node)) return;
        var walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
            acceptNode: function (e) {
                if (SKIP_TAGS[e.tagName] || e.getAttribute('translate') === 'no' || (e.classList && e.classList.contains('notranslate'))) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        for (var e = node; e; e = walker.nextNode()) {
            attrs(e);
            shallow(e);
        }
    }

    var observer = new MutationObserver(function (records) {
        if (!I.on) return;
        var parents = new Set(), trees = new Set();
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (r.type === 'attributes') {
                var buttonValue = r.attributeName !== 'value' || (r.target.tagName === 'INPUT' && /^(button|submit|reset)$/.test(r.target.type));
                if (buttonValue && r.target.isConnected && !skipped(r.target)) attr(r.target, r.attributeName);
                continue;
            }
            if (r.type === 'characterData') { parents.add(r.target.parentNode); continue; }
            parents.add(r.target);
            for (var j = 0; j < r.addedNodes.length; j++) {
                var n = r.addedNodes[j];
                if (n.nodeType === 1) trees.add(n);
            }
        }
        trees.forEach(function (n) { if (n.isConnected) tree(n); });
        parents.forEach(function (p) { if (p && p.isConnected) shallow(p); });
    });

    function observe() {
        observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
    }

    function restore() {
        observer.disconnect();
        var all = root.getElementsByTagName('*');
        var list = Array.prototype.slice.call(all);
        list.forEach(function (el) {
            var kids = origKids.get(el);
            if (kids && wroteKey.get(el) === templateKey(el)) {
                while (el.firstChild) el.removeChild(el.firstChild);
                kids.forEach(function (k) { el.appendChild(k); });
            }
            origKids.delete(el);
            wroteKey.delete(el);
            var st = attrState.get(el) || {};
            ATTRS.concat(Object.keys(st)).forEach(function (name) {
                var v = el.getAttribute(name);
                if (v === null) return;
                if (st[name] && v === st[name][1]) el.setAttribute(name, st[name][0]);
                else if (rev.get(v)) el.setAttribute(name, rev.get(v));
            });
            attrState.delete(el);
        });
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (var t = walker.nextNode(); t; t = walker.nextNode()) {
            if (wroteText.has(t) && wroteText.get(t) === t.data) t.data = origText.get(t);
            else if (rev.get(t.data)) t.data = rev.get(t.data);
            wroteText.delete(t);
        }
    }

    // A copy of a translated node (the menu drawer clones the header) keeps what its original knows,
    // so switching back restores the copy too
    var nativeClone = Node.prototype.cloneNode;
    Node.prototype.cloneNode = function (deep) {
        var copy = nativeClone.call(this, deep);
        if (I.on) carry(this, copy, deep);
        return copy;
    };
    function carry(a, b, deep) {
        if (a.nodeType === 3) {
            if (wroteText.has(a)) { wroteText.set(b, wroteText.get(a)); origText.set(b, origText.get(a)); }
            return;
        }
        if (a.nodeType !== 1) return;
        var st = attrState.get(a);
        if (st) {
            var copy = {};
            Object.keys(st).forEach(function (k) { copy[k] = st[k].slice(); });
            attrState.set(b, copy);
        }
        if (deep) for (var x = a.firstChild, y = b.firstChild; x && y; x = x.nextSibling, y = y.nextSibling) carry(x, y, true);
    }

    /* ---------- Canvas text, dialogs, sharing ---------- */

    function wrapFirstArg(obj, name) {
        if (!obj || typeof obj[name] !== 'function') return;
        var original = obj[name];
        obj[name] = function (text) {
            if (!I.on) return original.apply(this, arguments);
            var args = Array.prototype.slice.call(arguments);
            args[0] = typeof text === 'string' ? tr(text) : text;
            return original.apply(this, args);
        };
    }
    function trLines(text) {
        return typeof text === 'string' ? text.split('\n').map(tr).join('\n') : text;
    }
    if (window.CanvasRenderingContext2D) {
        ['fillText', 'strokeText', 'measureText'].forEach(function (n) { wrapFirstArg(CanvasRenderingContext2D.prototype, n); });
    }
    if (window.OffscreenCanvasRenderingContext2D) {
        ['fillText', 'strokeText', 'measureText'].forEach(function (n) { wrapFirstArg(OffscreenCanvasRenderingContext2D.prototype, n); });
    }
    ['alert', 'confirm', 'prompt'].forEach(function (n) {
        var original = window[n];
        if (typeof original !== 'function') return;
        window[n] = function (msg) {
            var args = Array.prototype.slice.call(arguments);
            if (I.on) args[0] = trLines(msg);
            return original.apply(window, args);
        };
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
        var writeText = navigator.clipboard.writeText;
        navigator.clipboard.writeText = function (text) { return writeText.call(navigator.clipboard, I.on ? trLines(text) : text); };
    }
    if (navigator.share) {
        var share = navigator.share;
        navigator.share = function (data) {
            if (I.on && data) {
                var copy = {};
                Object.keys(data).forEach(function (k) { copy[k] = data[k]; });
                if (data.title) copy.title = trLines(data.title);
                if (data.text) copy.text = trLines(data.text);
                data = copy;
            }
            return share.call(navigator, data);
        };
    }

    /* ---------- Switching ---------- */

    function start() {
        var data = window.WSAi18nData && window.WSAi18nData[ZH];
        if (!data || I.on) return;
        if (!exact) compile(data);
        I.on = true;
        I.lang = ZH;
        root.lang = ZH;
        tree(root);
        observe();
        announce();
    }

    function stop() {
        if (!I.on) return;
        I.on = false;
        I.lang = 'en';
        restore();
        root.lang = 'en';
        cache = new Map();
        announce();
    }

    function announce() {
        root.setAttribute('data-lang', I.lang);
        try { window.dispatchEvent(new CustomEvent('wsa-langchange', { detail: { lang: I.lang } })); } catch (e) {}
    }

    function loadDictionary(then) {
        if (window.WSAi18nData && window.WSAi18nData[ZH]) { then(); return; }
        var s = document.createElement('script');
        s.src = DICT_SRC;
        s.onload = then;
        s.onerror = function () { wanted = 'en'; announce(); };
        document.head.appendChild(s);
    }

    function setLang(lang) {
        wanted = lang === ZH ? ZH : 'en';
        try { localStorage.setItem(KEY, wanted); } catch (e) {}
        if (asking) chosen(wanted);
        if (wanted === ZH) loadDictionary(start);
        else stop();
    }

    /* ---------- First visit: which language? ---------- */

    // Asked once, on the first page a visitor opens, before anything else happens on it (the homepage's
    // intro waits for it: see afterChoice). The answer is remembered; changing it later in Settings replaces
    // it. Without working storage nothing is asked, since the answer couldn't be kept. Pages shown inside a
    // frame never ask.
    var asking = false, waiting = [], picker = null;
    try {
        var saved = localStorage.getItem(KEY);
        asking = saved !== ZH && saved !== 'en' && window.self === window.top;
    } catch (e) {}

    I.choosing = function () { return asking; };
    I.afterChoice = function (fn) { if (asking) waiting.push(fn); else fn(); };

    function suggested() {
        var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        for (var i = 0; i < langs.length; i++) {
            var l = String(langs[i]).toLowerCase();
            if (l.indexOf('zh') === 0) return ZH;
            if (l.indexOf('en') === 0) return 'en';
        }
        return 'en';
    }

    function chosen() {
        if (!asking) return;
        asking = false;
        if (picker && picker.open) picker.close('chosen');
        var run = waiting;
        waiting = [];
        run.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
    }

    var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/>' +
        '<path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/></svg>';

    function askLanguage() {
        if (!asking || picker || !document.body) return;
        var d = picker = document.createElement('dialog');
        if (!d.showModal) { setLang(suggested()); return; }
        d.className = 'wsa-dialog lang-picker';
        d.setAttribute('translate', 'no');
        d.setAttribute('aria-labelledby', 'lang-picker-title');
        d.innerHTML =
            '<div class="lang-picker-body">' +
                '<span class="lang-picker-icon">' + GLOBE + '</span>' +
                '<h2 class="lang-picker-title" id="lang-picker-title"><span lang="en">Choose your language</span>' +
                    '<span lang="zh-Hant">選擇語言</span></h2>' +
                '<div class="lang-picker-options">' +
                    '<button type="button" class="lang-picker-option" data-lang="en" lang="en">English</button>' +
                    '<button type="button" class="lang-picker-option" data-lang="zh-Hant" lang="zh-Hant">繁體中文' +
                        '<small lang="en">Traditional Chinese</small></button>' +
                '</div>' +
                '<p class="lang-picker-hint"><span lang="en">You can change this any time in Settings.</span>' +
                    '<span lang="zh-Hant">之後可隨時在「設定」中更改。</span></p>' +
            '</div>';
        var first = suggested();
        Array.prototype.forEach.call(d.querySelectorAll('.lang-picker-option'), function (b) {
            if (b.getAttribute('data-lang') === first) b.autofocus = true;
            b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
        });
        // Escape doesn't dismiss it unanswered; if the browser closes it anyway, the suggestion is kept
        d.addEventListener('cancel', function (e) { e.preventDefault(); });
        d.addEventListener('close', function () {
            if (asking) setLang(first);
            if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
            if (d.parentNode) d.parentNode.removeChild(d);
        });
        document.body.appendChild(d);
        d.showModal();
        document.body.classList.add('dialog-open');
    }

    if (asking) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', askLanguage);
        else askLanguage();
    }

    // Other open tabs of the site follow along (and stop asking, if one of them was answered)
    window.addEventListener('storage', function (e) {
        if (e.key !== KEY && e.key !== null) return;
        var v = null;
        try { v = localStorage.getItem(KEY); } catch (err) {}
        if (asking && (v === ZH || v === 'en')) chosen();
        if ((v === ZH) !== I.on) setLang(v === ZH ? ZH : 'en');
    });

    root.setAttribute('data-lang', 'en');
    if (wanted === ZH) {
        if (window.WSAi18nData && window.WSAi18nData[ZH]) start();
        else if (document.readyState === 'loading') document.write('<script src="' + DICT_SRC + '"><\/script>');
        else loadDictionary(start);
    }
})();
