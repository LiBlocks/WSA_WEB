/*
 * WSA Assistant: the floating "Ask WSA" button and conversation panel.
 *
 * Talks only to the WSA Assistant API (/api/assistant: chat, reset, health). Never to a model directly.
 * Answers are rendered as text: only **bold**, "- " list lines and [n] citation chips become elements,
 * and citation links are built here from the validated `url` the API returns. No innerHTML with server text.
 * Conversation state lives in sessionStorage only (cleared when the tab closes or on "New conversation").
 *
 * Endpoint: window.WSA_ASSISTANT_ENDPOINT, else <meta name="wsa-assistant-endpoint">, else the local
 * backend (http://127.0.0.1:8787/api/assistant) when the site is served from localhost, else /api/assistant
 * on the site's own origin (a Cloudflare Pages Function in production).
 * Kill switch: window.WSA_ASSISTANT_DISABLED = true before this script runs.
 */
(function () {
    'use strict';
    if (window.WSA_ASSISTANT_DISABLED || document.querySelector('.wsa-ai')) return;

    var STORE = 'wsa-assistant-v1';
    var MAX_CHARS = 1000;
    var GAME_AREAS = '.ag-view, .sim-view, .ld-view, .or-stage, .es-view, .builder-stage, .mm-stage';
    var REFLEX_GAMES = '#ag, #sim, #ld, #or';     // flown in real time: the launcher hides while one is being played
    var IS_GAME_PAGE = !!document.querySelector('#ag, #sim, #ld, #or, #es, #builder, #mm');

    var T = {
        en: {
            launcher: 'Ask WSA', title: 'WSA Assistant', sub: "Answers from WSA's public pages",
            open: 'Open the WSA Assistant (AI)', close: 'Close', reset: 'New conversation',
            hello: "Hi! I'm WSA's AI assistant 🚀",
            intro: 'Ask me about our rockets, missions, AutoLand, the KGOSS station or the games. I answer from WSA\'s public pages and link my sources.',
            chips: ['What is AutoLand V2.3?', 'What is KGOSS-1?', 'Which missions reached Duna?', 'Which game should I try first?'],
            placeholder: 'Ask about WSA…', send: 'Send', thinking: 'Checking WSA records…',
            sources: 'Sources', disclaimer: 'AI-generated answers can be wrong. Please check the linked WSA pages and don\'t share personal information.',
            privacy: 'Privacy', counter: '{n} / 1000',
            offlineTitle: "Mission control is offline", offline: "The assistant isn't available right now. The rest of the site works as usual. Please try again later.",
            retry: 'Try again', busy: 'Lots of questions at once! Trying again in a few seconds…',
            busyFail: 'The assistant is still busy. Please try again in a minute.',
            rate: "You're sending messages faster than mission control can answer. Please wait {s} seconds.",
            timeout: 'That took too long to answer. Please try again, perhaps with a shorter question.',
            tooLong: 'Messages are limited to 1000 characters.', invalid: "That message couldn't be sent. Please try rephrasing it.",
            error: 'Something went wrong. Please try again.', newTab: '(opens in a new tab)',
            privacyText: [
                'The WSA Assistant is an AI that answers from WSA\'s public website. Its answers are generated automatically and can be wrong.',
                'Your messages are processed on WSA\'s own computer. The conversation is kept in memory for up to 30 minutes so follow-up questions make sense, then deleted; "New conversation" deletes it straight away. Only technical information is logged (for 7 days), never what you write.',
                'Messages are not sent to other AI companies, sold, or used to train AI. Please don\'t share personal information; for donations use the Support WSA page directly.'
            ]
        },
        zh: {
            launcher: '問問 WSA', title: 'WSA 助理', sub: '回答來自 WSA 的公開頁面',
            open: '開啟 WSA 助理（AI）', close: '關閉', reset: '新對話',
            hello: '你好！我是 WSA 的 AI 助理 🚀',
            intro: '可以問我 WSA 的火箭、任務、AutoLand、KGOSS 太空站或遊戲。我會根據 WSA 的公開頁面回答，並附上來源連結。',
            chips: ['AutoLand V2.3 是什麼？', 'KGOSS-1 是什麼？', '哪些任務到過 Duna？', '我應該先玩哪個遊戲？'],
            placeholder: '詢問 WSA 的任何事…', send: '送出', thinking: '正在查詢 WSA 紀錄…',
            sources: '來源', disclaimer: 'AI 產生的回答可能有誤，請以連結的 WSA 頁面為準，並請勿分享個人資料。',
            privacy: '隱私', counter: '{n} / 1000',
            offlineTitle: '任務控制中心目前離線', offline: '助理現在無法使用，網站其他部分仍可正常瀏覽。請稍後再試。',
            retry: '再試一次', busy: '同時有很多人在提問！幾秒後自動重試…',
            busyFail: '助理仍然忙碌中，請一分鐘後再試。',
            rate: '你傳送訊息的速度比任務控制中心回答得還快，請等候 {s} 秒。',
            timeout: '回答花了太久時間，請再試一次，或把問題縮短一些。',
            tooLong: '訊息最多 1000 個字元。', invalid: '這則訊息無法送出，請換個方式再問一次。',
            error: '發生錯誤，請再試一次。', newTab: '（在新分頁開啟）',
            privacyText: [
                'WSA 助理是一個 AI，會根據 WSA 的公開網站回答問題。回答是自動產生的，可能會出錯。',
                '你的訊息會在 WSA 自己的電腦上處理。為了讓追問有上下文，對話最多在記憶體中保留 30 分鐘，之後即刪除；按「新對話」會立刻刪除。我們只記錄技術資訊（保留 7 天），不記錄你寫的內容。',
                '你的訊息不會傳給其他 AI 公司、不會被出售，也不會用來訓練 AI。請不要分享個人資料；如要捐款，請直接使用「支持 WSA」頁面。'
            ]
        }
    };

    function lang() { return window.WSAi18n && window.WSAi18n.lang === 'zh-Hant' ? 'zh' : 'en'; }
    function t(key) { return T[lang()][key]; }

    function endpoint() {
        if (window.WSA_ASSISTANT_ENDPOINT) return String(window.WSA_ASSISTANT_ENDPOINT).replace(/\/$/, '');
        var meta = document.querySelector('meta[name="wsa-assistant-endpoint"]');
        if (meta && meta.content) return meta.content.replace(/\/$/, '');
        if (location.protocol === 'file:') return null;
        var h = location.hostname;
        if ((h === 'localhost' || h === '127.0.0.1') && location.port !== '8787') return 'http://127.0.0.1:8787/api/assistant';
        return '/api/assistant';
    }

    // ---------- state (sessionStorage only) ----------
    var state = { sid: null, msgs: [] };
    try {
        var saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
        if (saved && Array.isArray(saved.msgs)) state = { sid: typeof saved.sid === 'string' ? saved.sid : null, msgs: saved.msgs.slice(-20) };
    } catch (e) { /* storage unavailable: start fresh */ }
    function persist() {
        try { sessionStorage.setItem(STORE, JSON.stringify({ sid: state.sid, msgs: state.msgs.slice(-20) })); } catch (e) { /* ignore */ }
    }

    // ---------- DOM helpers ----------
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function svg(paths, viewBox) {
        var NS = 'http://www.w3.org/2000/svg';
        var s = document.createElementNS(NS, 'svg');
        s.setAttribute('viewBox', viewBox || '0 0 24 24');
        s.setAttribute('aria-hidden', 'true');
        s.setAttribute('focusable', 'false');
        paths.forEach(function (p) {
            var n = document.createElementNS(NS, p[0]);
            Object.keys(p[1]).forEach(function (k) { n.setAttribute(k, p[1][k]); });
            s.appendChild(n);
        });
        return s;
    }

    // ---------- build ----------
    var root = el('div', 'wsa-ai');
    root.setAttribute('translate', 'no');          // i18n.js must not rewrite the widget or the answers

    var launcher = el('button', 'wsa-ai-launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.appendChild(svg([
        ['ellipse', { class: 'wsa-ai-orbit', cx: '12', cy: '12', rx: '10', ry: '4.2', transform: 'rotate(-28 12 12)' }],
        ['circle', { class: 'wsa-ai-planet', cx: '12', cy: '12', r: '4.2' }],
        ['circle', { class: 'wsa-ai-moon', cx: '20.2', cy: '7.9', r: '1.7' }]
    ]));
    var launcherLabel = el('span', 'wsa-ai-launcher-label');
    launcher.appendChild(launcherLabel);

    var panel = el('div', 'wsa-ai-panel');        // not <section>: the site pads every section
    panel.id = 'wsa-ai-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'wsa-ai-title');
    launcher.setAttribute('aria-controls', panel.id);

    var head = el('div', 'wsa-ai-head');          // not <header>: the site styles every header as its top bar
    var headText = el('div', 'wsa-ai-head-text');
    var title = el('h2', 'wsa-ai-title');
    title.id = 'wsa-ai-title';
    var titleText = el('span');
    var tag = el('span', 'wsa-ai-tag', 'AI');
    title.appendChild(titleText);
    title.appendChild(tag);
    var sub = el('p', 'wsa-ai-sub');
    headText.appendChild(title);
    headText.appendChild(sub);
    var resetBtn = el('button', 'wsa-ai-icon-btn');
    resetBtn.type = 'button';
    resetBtn.appendChild(svg([['path', { d: 'M3 12a9 9 0 1 0 3-6.7' }], ['path', { d: 'M3 4v4.5h4.5' }]]));
    var closeBtn = el('button', 'wsa-ai-icon-btn');
    closeBtn.type = 'button';
    closeBtn.appendChild(svg([['path', { d: 'M6 6l12 12M18 6L6 18' }]]));
    head.appendChild(headText);
    head.appendChild(resetBtn);
    head.appendChild(closeBtn);

    var log = el('div', 'wsa-ai-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-relevant', 'additions');

    var form = el('form', 'wsa-ai-form');
    var input = el('textarea', 'wsa-ai-input');
    input.rows = 1;
    input.maxLength = 1200;
    input.setAttribute('aria-label', 'Message');
    var send = el('button', 'wsa-ai-send');
    send.type = 'submit';
    send.appendChild(svg([['path', { d: 'M5 12h13' }], ['path', { d: 'M12 5l7 7-7 7' }]]));
    form.appendChild(input);
    form.appendChild(send);

    var meta = el('div', 'wsa-ai-meta');
    var disclaimer = el('span', 'wsa-ai-disclaimer');
    var metaRight = el('span');
    var count = el('span', 'wsa-ai-count');
    count.hidden = true;
    var privacyBtn = el('button');
    privacyBtn.type = 'button';
    privacyBtn.setAttribute('aria-expanded', 'false');
    metaRight.appendChild(count);
    metaRight.appendChild(privacyBtn);
    meta.appendChild(disclaimer);
    meta.appendChild(metaRight);
    var privacy = el('div', 'wsa-ai-privacy');
    privacy.hidden = true;
    privacy.id = 'wsa-ai-privacy';
    privacyBtn.setAttribute('aria-controls', privacy.id);

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(meta);
    panel.appendChild(privacy);
    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Keys typed in the assistant must never reach the page (games listen for W/A/S/D, Space and so on)
    ['keydown', 'keyup', 'keypress'].forEach(function (type) {
        root.addEventListener(type, function (e) {
            if (type === 'keydown' && e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(); }
            e.stopPropagation();
        });
    });

    function applyLanguage() {
        launcherLabel.textContent = t('launcher');
        launcher.setAttribute('aria-label', t('open'));
        titleText.textContent = t('title');
        sub.textContent = t('sub');
        resetBtn.setAttribute('aria-label', t('reset'));
        resetBtn.title = t('reset');
        closeBtn.setAttribute('aria-label', t('close'));
        closeBtn.title = t('close');
        input.placeholder = t('placeholder');
        input.setAttribute('aria-label', t('placeholder'));
        send.setAttribute('aria-label', t('send'));
        disclaimer.textContent = t('disclaimer');
        privacyBtn.textContent = t('privacy');
        privacy.textContent = '';
        t('privacyText').forEach(function (p) { privacy.appendChild(el('p', null, p)); });
        root.setAttribute('lang', lang() === 'zh' ? 'zh-Hant' : 'en');
        if (!state.msgs.length) render();
    }

    // ---------- rendering ----------
    function citeHref(url) {
        try { return new URL(url, document.baseURI).href; } catch (e) { return null; }
    }

    function linkAttrs(a) {
        if (IS_GAME_PAGE) {                 // don't lose a game in progress
            a.target = '_blank';
            a.rel = 'noopener';
        }
    }

    function inline(parent, text, cites) {
        // **bold** and [n] become elements; everything else stays text
        var parts = text.split(/(\*\*[^*\n]+\*\*|\[\d{1,2}\])/);
        parts.forEach(function (part) {
            if (!part) return;
            var bold = /^\*\*([^*\n]+)\*\*$/.exec(part);
            var cite = /^\[(\d{1,2})\]$/.exec(part);
            if (bold) {
                parent.appendChild(el('strong', null, bold[1]));
            } else if (cite) {
                var c = cites.filter(function (x) { return String(x.n) === cite[1]; })[0];
                var href = c && citeHref(c.url);
                if (href) {
                    var a = el('a', 'wsa-ai-cite', cite[1]);
                    a.href = href;
                    a.title = c.title + (c.section ? ' — ' + c.section : '');
                    a.setAttribute('aria-label', (lang() === 'zh' ? '來源 ' : 'Source ') + cite[1] + ': ' + c.title);
                    linkAttrs(a);
                    parent.appendChild(a);
                }
            } else {
                parent.appendChild(document.createTextNode(part));
            }
        });
    }

    function answerNode(m) {
        var box = el('div', 'wsa-ai-msg wsa-ai-bot');
        var cites = m.citations || [];
        var list = null;
        String(m.text || '').split('\n').forEach(function (line) {
            var item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
            if (item) {
                if (!list) { list = el('ul'); box.appendChild(list); }
                var li = el('li');
                inline(li, item[1], cites);
                list.appendChild(li);
            } else {
                list = null;
                if (line.trim()) {
                    var p = el('p');
                    inline(p, line, cites);
                    box.appendChild(p);
                }
            }
        });
        if (cites.length) {
            var src = el('div', 'wsa-ai-sources');
            src.appendChild(el('p', 'wsa-ai-sources-label', t('sources')));
            var ol = el('ol');
            cites.forEach(function (c) {
                var href = citeHref(c.url);
                if (!href) return;
                var li = el('li');
                li.appendChild(el('span', null, c.n + '.'));
                var a = el('a', null, c.title);
                a.href = href;
                linkAttrs(a);
                if (IS_GAME_PAGE) a.setAttribute('aria-label', c.title + ' ' + t('newTab'));
                var wrap = el('span');
                wrap.appendChild(a);
                if (c.section && c.section !== c.title) wrap.appendChild(el('small', null, ' · ' + c.section));
                li.appendChild(wrap);
                ol.appendChild(li);
            });
            src.appendChild(ol);
            box.appendChild(src);
        }
        return box;
    }

    function chips(list) {
        var wrap = el('div', 'wsa-ai-chips');
        list.forEach(function (q) {
            var b = el('button', 'wsa-ai-chip', q);
            b.type = 'button';
            b.addEventListener('click', function () { ask(q); });
            wrap.appendChild(b);
        });
        return wrap;
    }

    function render() {
        log.textContent = '';
        if (!state.msgs.length) {
            var w = el('div', 'wsa-ai-welcome');
            w.appendChild(el('h3', null, t('hello')));
            w.appendChild(el('p', null, t('intro')));
            w.appendChild(chips(t('chips')));
            log.appendChild(w);
            return;
        }
        state.msgs.forEach(function (m, i) {
            if (m.role === 'user') log.appendChild(el('div', 'wsa-ai-msg wsa-ai-user', m.text));
            else log.appendChild(answerNode(m));
            if (m.role === 'assistant' && i === state.msgs.length - 1 && m.suggestions && m.suggestions.length) {
                log.appendChild(chips(m.suggestions));
            }
        });
        scrollDown();
    }

    function scrollDown() { log.scrollTop = log.scrollHeight; }

    function statusCard(kind, heading, text, retry) {
        clearTransient();
        var card = el('div', 'wsa-ai-status is-' + kind + ' wsa-ai-transient');
        card.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        if (heading) card.appendChild(el('strong', null, heading));
        card.appendChild(document.createTextNode(text));
        if (retry) {
            var b = el('button', 'wsa-ai-chip', t('retry'));
            b.type = 'button';
            b.addEventListener('click', retry);
            card.appendChild(el('br'));
            card.appendChild(b);
        }
        log.appendChild(card);
        scrollDown();
        return card;
    }

    function clearTransient() {
        Array.prototype.forEach.call(log.querySelectorAll('.wsa-ai-transient'), function (n) { n.remove(); });
    }

    function thinking() {
        clearTransient();
        var box = el('div', 'wsa-ai-msg wsa-ai-bot wsa-ai-transient');
        var row = el('span', 'wsa-ai-thinking');
        var dots = el('span', 'wsa-ai-dots');
        dots.setAttribute('aria-hidden', 'true');
        dots.appendChild(el('i'));
        dots.appendChild(el('i'));
        dots.appendChild(el('i'));
        row.appendChild(dots);
        row.appendChild(el('span', null, t('thinking')));
        box.appendChild(row);
        log.appendChild(box);
        scrollDown();
    }

    // ---------- network ----------
    var busy = false;
    var health = { at: 0, ok: null };

    function request(path, opts, timeoutMs) {
        var base = endpoint();
        if (!base) return Promise.reject(new Error('no-endpoint'));
        var ctrl = 'AbortController' in window ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
        opts = opts || {};
        if (ctrl) opts.signal = ctrl.signal;
        opts.credentials = 'omit';
        opts.cache = 'no-store';
        return fetch(base + path, opts).finally(function () { if (timer) clearTimeout(timer); });
    }

    function checkHealth() {
        if (health.ok !== null && Date.now() - health.at < 60000) return Promise.resolve(health.ok);
        return request('/health', { method: 'GET' }, 6000)
            .then(function (r) { return r.ok ? r.json() : { ready: false }; })
            .then(function (j) { health = { at: Date.now(), ok: !!(j && j.ready) }; return health.ok; })
            .catch(function () { health = { at: Date.now(), ok: false }; return false; });
    }

    function showOffline() {
        statusCard('offline', t('offlineTitle'), t('offline'), function () {
            health.ok = null;
            clearTransient();
            checkHealth().then(function (ok) { if (!ok) showOffline(); });
        });
    }

    function setBusy(on) {
        busy = on;
        send.disabled = on || !input.value.trim();
        Array.prototype.forEach.call(log.querySelectorAll('.wsa-ai-chip'), function (b) { b.disabled = on; });
    }

    function ask(text, isRetry) {
        text = String(text || '').trim();
        if (!text || busy) return;
        if (text.length > MAX_CHARS) { statusCard('error', null, t('tooLong')); return; }
        if (!isRetry) {
            state.msgs.push({ role: 'user', text: text });
            persist();
            var welcome = log.querySelector('.wsa-ai-welcome');
            if (welcome) welcome.remove();
            Array.prototype.forEach.call(log.querySelectorAll('.wsa-ai-chips'), function (n) { n.remove(); });
            log.appendChild(el('div', 'wsa-ai-msg wsa-ai-user', text));      // append only: the live region announces just the new parts
        }
        input.value = '';
        autosize();
        setBusy(true);
        thinking();
        var body = JSON.stringify({ message: text, session_id: state.sid, language: lang() === 'zh' ? 'zh-Hant' : 'en' });
        request('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }, 75000)
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) { return { code: r.status, j: j }; });
            })
            .then(function (res) {
                setBusy(false);
                var j = res.j || {};
                if (res.code === 200 && j.status === 'ok') {
                    state.sid = j.session_id || state.sid;
                    var m = { role: 'assistant', text: j.answer || '', citations: j.citations || [], suggestions: j.suggestions || [] };
                    state.msgs.push(m);
                    health = { at: Date.now(), ok: true };
                    persist();
                    clearTransient();
                    log.appendChild(answerNode(m));
                    if (m.suggestions.length) log.appendChild(chips(m.suggestions));
                    scrollDown();
                    return;
                }
                if (res.code === 503 && j.status === 'busy' && !isRetry) {
                    statusCard('warning', null, t('busy'));
                    setBusy(true);
                    setTimeout(function () { setBusy(false); ask(text, true); }, Math.min(15, (j.retry_after || 5)) * 1000);
                    return;
                }
                if (res.code === 503 && j.status === 'busy') { statusCard('warning', null, t('busyFail')); return; }
                if (res.code === 503 || res.code === 502 || res.code === 404) { health = { at: Date.now(), ok: false }; showOffline(); return; }
                if (res.code === 429) { statusCard('warning', null, t('rate').replace('{s}', Math.ceil(j.retry_after || 30))); return; }
                if (res.code === 504) { statusCard('error', null, t('timeout')); return; }
                if (res.code === 413) { statusCard('error', null, t('tooLong')); return; }
                if (res.code === 400 && j.error && j.error.code === 'invalid_session') { state.sid = null; persist(); }
                if (res.code === 400 || res.code === 415) { statusCard('error', null, t('invalid')); return; }
                statusCard('error', null, t('error'));
            })
            .catch(function () {
                setBusy(false);
                health = { at: Date.now(), ok: false };
                showOffline();
            });
    }

    // ---------- open / close / reset ----------
    var lastFocus = null;
    var mobile = window.matchMedia('(max-width: 640px)');

    function open() {
        if (!panel.hidden) return;
        lastFocus = document.activeElement;
        panel.hidden = false;
        root.classList.add('is-open');
        launcher.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-modal', mobile.matches ? 'true' : 'false');
        render();
        if (state.msgs.length === 0) {
            checkHealth().then(function (ok) { if (!ok && !panel.hidden && !state.msgs.length) showOffline(); });
        }
        setTimeout(function () { input.focus(); }, 30);
    }

    function close() {
        if (panel.hidden) return;
        panel.hidden = true;
        root.classList.remove('is-open');
        launcher.setAttribute('aria-expanded', 'false');
        privacy.hidden = true;
        privacyBtn.setAttribute('aria-expanded', 'false');
        var back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body && lastFocus !== launcher ? lastFocus : launcher;
        tuck();
        // The launcher's visibility transition starts at "hidden": focus it once it is visible again
        setTimeout(function () { back.focus({ preventScroll: true }); }, 60);
    }

    function reset() {
        var sid = state.sid;
        state = { sid: null, msgs: [] };
        persist();
        try { sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ }
        if (sid) {
            request('/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sid }) }, 5000)
                .catch(function () { /* the server forgets idle sessions anyway */ });
        }
        setBusy(false);
        render();
        input.focus();
    }

    launcher.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    resetBtn.addEventListener('click', reset);
    privacyBtn.addEventListener('click', function () {
        privacy.hidden = !privacy.hidden;
        privacyBtn.setAttribute('aria-expanded', String(!privacy.hidden));
    });

    // Keep keyboard focus inside the bottom sheet on phones (it covers the page)
    panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !mobile.matches) return;
        var f = panel.querySelectorAll('button:not([disabled]), textarea, a[href]');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        ask(input.value);
    });

    function autosize() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight + 2, 140) + 'px';
        var n = input.value.length;
        count.hidden = n < 800;
        count.textContent = t('counter').replace('{n}', n);
        count.classList.toggle('is-over', n > MAX_CHARS);
        send.disabled = busy || !input.value.trim() || n > MAX_CHARS;
    }
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {      // isComposing: Chinese input methods
            e.preventDefault();
            if (!send.disabled) ask(input.value);
        }
    });

    // ---------- step aside for game views ----------
    var tuckQueued = false;
    function tuck() {
        tuckQueued = false;
        if (!panel.hidden) return;
        // Over a game view: a compact round button, or none at all while a real-time game is being played
        // (no setup, pause, result or help screen showing). Fullscreen games hide everything else anyway.
        var r = launcher.getBoundingClientRect();
        var left = r.right - 160;          // the full-size button's footprint, so the compact form can't flicker back
        var area = null;
        Array.prototype.forEach.call(document.querySelectorAll(GAME_AREAS), function (g) {
            var b = g.getBoundingClientRect();
            if (b.width > 0 && b.left < r.right && b.right > left && b.top < r.bottom && b.bottom > r.top) area = g;
        });
        var game = area && area.closest(REFLEX_GAMES);
        var playing = !!game && !game.querySelector('[class*="-overlay"]:not([hidden])');
        launcher.classList.toggle('is-compact', !!area);
        launcher.classList.toggle('is-tucked', playing || !!document.fullscreenElement);
    }
    function queueTuck() {
        if (!tuckQueued) { tuckQueued = true; requestAnimationFrame(tuck); }
    }
    if (IS_GAME_PAGE) {
        window.addEventListener('scroll', queueTuck, { passive: true });
        window.addEventListener('resize', queueTuck);
        document.addEventListener('fullscreenchange', queueTuck);
        setInterval(queueTuck, 1500);       // layout changes inside games (setup → play)
        queueTuck();
    }

    window.addEventListener('wsa-langchange', applyLanguage);
    applyLanguage();
    autosize();
})();
