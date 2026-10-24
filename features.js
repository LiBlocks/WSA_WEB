// Interactive features: site search, Vehicle Hangar, Development Timeline, status legend and Flight Gallery albums.
// All content comes from wsa-data.js; this file only renders it.
(function () {
    const data = window.WSA;
    if (!data) return;

    const HANGAR_PAGE = 'vehicles-programs.html';
    const currentPage = location.pathname.split('/').pop() || 'index.html';

    const ICONS = {
        search: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
        close: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        prev: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
        next: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
        chevron: '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
        camera: '<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
        images: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="1.5"/><path d="M7 3h12.5A1.5 1.5 0 0 1 21 4.5V17"/></svg>'
    };

    // Line-art schematics shown when a vehicle has no image. They are drawings, not photos.
    const SCHEMATICS = {
        'launch-vehicles': '<svg class="schematic" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3c4 4 6 9 6 15v16H18V18c0-6 2-11 6-15z"/><path d="M18 18h12M18 27h12"/><path d="M18 26l-6 7v5h6M30 26l6 7v5h-6"/><path d="M21 34l-1 6M27 34l1 6M14 44l4-6M34 44l-4-6"/></svg>',
        'aircraft': '<svg class="schematic" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3c2 2 3 5 3 9v8l16 9v4l-16-4v9l5 4v3l-8-2-8 2v-3l5-4v-9L5 33v-4l16-9v-8c0-4 1-7 3-9z"/><path d="M24 12v26"/></svg>',
        'landers': '<svg class="schematic" viewBox="0 0 48 48" aria-hidden="true"><path d="M18 10h12l4 12H14z"/><path d="M21 10l1.5-5h3L27 10"/><path d="M16 22l-7 15M32 22l7 15M5 37h8M35 37h8"/><path d="M21 22l-1 6h8l-1-6"/><path d="M24 28v4"/></svg>',
        'station': '<svg class="schematic" viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="17" width="14" height="14" rx="2"/><path d="M17 24h-5M31 24h5M24 17v-6M24 31v6M21 11h6M21 37h6"/><rect x="2" y="16" width="10" height="16"/><rect x="36" y="16" width="10" height="16"/><path d="M2 24h10M36 24h10"/></svg>'
    };

    const esc = value => String(value).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const normalize = text => String(text).toLowerCase().replace(/[–—]/g, '-').replace(/["“”]/g, '');
    const tokensOf = text => normalize(text).split(/\s+/).filter(Boolean);
    const statusOf = key => data.STATUSES[key] || data.STATUSES.undocumented;
    const badge = key => `<span class="status ${statusOf(key).tone}">${esc(statusOf(key).label)}</span>`;
    const vehiclesById = new Map(data.VEHICLES.map(v => [v.id, v]));
    const hangarHref = id => `${HANGAR_PAGE}?vehicle=${encodeURIComponent(id)}#hangar`;
    const specRow = ([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    // "Category · Program", skipping the program when it just repeats the category
    const vehicleMeta = v => [data.VEHICLE_CATEGORIES[v.category], v.program]
        .filter((part, i, parts) => part && parts.findIndex(p => p && normalize(p) === normalize(part)) === i)
        .map(esc).join(' · ');
    const chip = (value, label, count, pressed = false) =>
        `<button type="button" class="chip" data-value="${esc(value)}" aria-pressed="${pressed}">${esc(label)}<span class="chip-count">${count}</span></button>`;

    function vehicleSearchText(v) {
        return normalize([v.name, v.designation, v.program, v.role, data.VEHICLE_CATEGORIES[v.category], ...(v.aliases || [])].join(' '));
    }

    function bindChips(group, onChange) {
        group.addEventListener('click', e => {
            const button = e.target.closest('.chip');
            if (!button) return;
            group.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === button)));
            onChange(button.dataset.value);
        });
    }

    function setChip(group, value) {
        group.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.value === value)));
    }

    // Shared modal dialog: Esc closes (native), clicking the backdrop or any link inside closes it
    function createDialog(className) {
        const dialog = document.createElement('dialog');
        dialog.className = `wsa-dialog ${className}`;
        dialog.addEventListener('click', e => {
            if (e.target === dialog || e.target.closest('a[href]') || e.target.closest('.dialog-close')) dialog.close();
        });
        dialog.addEventListener('close', () => {
            if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function showDialog(dialog) {
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('dialog-open');
    }

    /* ---------- Site search ---------- */

    function initSearch() {
        const trigger = document.querySelector('.search-button');
        if (!trigger) return;

        const entries = [
            ...data.SEARCH_PAGES.map(p => ({
                title: p.title, type: p.type, href: p.href,
                name: normalize(p.title), text: normalize(`${p.title} ${p.keywords || ''}`)
            })),
            ...data.VEHICLES.map(v => ({
                title: v.name, type: data.VEHICLE_CATEGORIES[v.category] || 'Vehicle', href: hangarHref(v.id),
                vehicleId: v.id, name: normalize(v.name), text: vehicleSearchText(v)
            }))
        ];

        const dialog = createDialog('search-dialog');
        dialog.setAttribute('aria-label', 'Search WSA');
        dialog.innerHTML = `
            <div class="search-box">
                ${ICONS.search}
                <input type="text" class="search-input" placeholder="Search vehicles, programs and pages" autocomplete="off" spellcheck="false"
                    role="combobox" aria-expanded="true" aria-controls="site-search-results" aria-autocomplete="list" aria-label="Search WSA" enterkeyhint="go">
                <button type="button" class="icon-button dialog-close" aria-label="Close search">${ICONS.close}</button>
            </div>
            <p class="search-hint" aria-live="polite"></p>
            <ul class="search-results" id="site-search-results" role="listbox" aria-label="Search results"></ul>`;

        const input = dialog.querySelector('.search-input');
        const list = dialog.querySelector('.search-results');
        const hint = dialog.querySelector('.search-hint');
        let results = [];
        let active = 0;

        function score(entry, tokens) {
            if (!tokens.every(t => entry.text.includes(t))) return -1;
            const query = tokens.join(' ');
            if (entry.name === query) return 4;
            if (entry.name.startsWith(query)) return 3;
            if (entry.name.includes(query)) return 2;
            return 1;
        }

        function render() {
            const tokens = tokensOf(input.value);
            if (tokens.length === 0) {
                results = entries.filter(e => !e.vehicleId).slice(0, 8);
                hint.textContent = 'Jump to';
            } else {
                results = entries
                    .map(entry => ({ entry, s: score(entry, tokens) }))
                    .filter(r => r.s > 0)
                    .sort((a, b) => b.s - a.s || a.entry.name.length - b.entry.name.length)
                    .slice(0, 8)
                    .map(r => r.entry);
                hint.textContent = results.length
                    ? `${results.length} result${results.length === 1 ? '' : 's'}`
                    : `Nothing matches "${input.value.trim()}". Try a vehicle or program name.`;
            }
            hint.classList.toggle('is-empty', results.length === 0);
            active = 0;
            list.innerHTML = results.map((r, i) => `
                <li role="option" id="site-search-option-${i}" aria-selected="false">
                    <a href="${esc(r.href)}" tabindex="-1">
                        <span class="search-result-title">${esc(r.title)}</span>
                        <span class="search-result-type">${esc(r.type)}</span>
                    </a>
                </li>`).join('');
            updateActive();
        }

        function updateActive() {
            [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
            if (results.length) {
                input.setAttribute('aria-activedescendant', `site-search-option-${active}`);
                list.children[active].scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }

        function go(entry) {
            dialog.close();
            if (entry.vehicleId && window.WSAHangar) {
                window.WSAHangar.open(entry.vehicleId);
            } else {
                location.href = entry.href;
            }
        }

        list.addEventListener('click', e => {
            const option = e.target.closest('[role="option"]');
            if (!option || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            go(results[[...list.children].indexOf(option)]);
        });

        list.addEventListener('mousemove', e => {
            const option = e.target.closest('[role="option"]');
            const index = option ? [...list.children].indexOf(option) : -1;
            if (index >= 0 && index !== active) {
                active = index;
                updateActive();
            }
        });

        input.addEventListener('input', render);
        input.addEventListener('keydown', e => {
            if (!results.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
                updateActive();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                go(results[active]);
            }
        });

        function open() {
            input.value = '';
            render();
            showDialog(dialog);
            input.focus();
        }

        trigger.addEventListener('click', open);
        document.addEventListener('keydown', e => {
            const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
            const shortcut = (e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing);
            if (!shortcut || document.querySelector('dialog[open]')) return;
            e.preventDefault();
            open();
        });
    }

    /* ---------- Vehicle Hangar ---------- */

    function vehicleVisual(v) {
        if (v.image) {
            return `<div class="vehicle-visual has-image"><img src="${esc(v.image)}" alt="${esc(v.name)}" loading="lazy"></div>`;
        }
        return `<div class="vehicle-visual" aria-hidden="true">${SCHEMATICS[v.category] || ''}<span class="vehicle-designation">${esc(v.designation || v.name)}</span></div>`;
    }

    function vehicleCard(v) {
        const specs = v.specs || [];
        const shown = specs.slice(0, 2);
        return `
            <article class="vehicle-card" data-id="${esc(v.id)}">
                ${vehicleVisual(v)}
                <div class="vehicle-body">
                    <p class="vehicle-meta">${vehicleMeta(v)}</p>
                    <h3 class="vehicle-name"><button type="button" class="vehicle-open" data-id="${esc(v.id)}">${esc(v.name)}</button></h3>
                    ${v.role ? `<p class="vehicle-role">${esc(v.role)}</p>` : ''}
                    ${badge(v.status)}
                    ${shown.length
                        ? `<dl class="spec-list compact">${shown.map(specRow).join('')}</dl>`
                        : '<p class="vehicle-undocumented">No specifications documented yet.</p>'}
                    ${specs.length > shown.length ? `<p class="vehicle-more">+${specs.length - shown.length} more in details</p>` : ''}
                </div>
            </article>`;
    }

    function initHangar() {
        const root = document.getElementById('hangar-root');
        if (!root) return;

        const total = data.VEHICLES.length;
        const countIn = key => data.VEHICLES.filter(v => v.category === key).length;
        root.innerHTML = `
            <div class="registry-controls">
                <label class="search-field">
                    ${ICONS.search}
                    <span class="visually-hidden">Search vehicles</span>
                    <input type="search" class="hangar-search" placeholder="Search by name, e.g. Lyra, FAMMOK or Haven" autocomplete="off" spellcheck="false">
                </label>
                <div class="chip-group" role="group" aria-label="Filter by category">
                    ${chip('all', 'All', total, true)}
                    ${Object.entries(data.VEHICLE_CATEGORIES).map(([key, label]) => chip(key, label, countIn(key))).join('')}
                </div>
            </div>
            <p class="registry-count" aria-live="polite"></p>
            <div class="hangar-grid">${data.VEHICLES.map(vehicleCard).join('')}</div>
            <div class="empty-state" hidden>
                <p class="empty-title">No vehicles match your search.</p>
                <p>Try another name, or <button type="button" class="link-button hangar-reset">clear the search and filters</button>.</p>
            </div>`;

        const input = root.querySelector('.hangar-search');
        const chips = root.querySelector('.chip-group');
        const countEl = root.querySelector('.registry-count');
        const empty = root.querySelector('.empty-state');
        const cards = [...root.querySelectorAll('.vehicle-card')];
        const searchText = new Map(data.VEHICLES.map(v => [v.id, vehicleSearchText(v)]));
        let category = 'all';

        function apply() {
            const tokens = tokensOf(input.value);
            let shown = 0;
            cards.forEach(card => {
                const v = vehiclesById.get(card.dataset.id);
                const match = (category === 'all' || v.category === category) &&
                    tokens.every(t => searchText.get(v.id).includes(t));
                card.hidden = !match;
                if (match) shown++;
            });
            countEl.textContent = shown === total ? `${total} vehicles` : `Showing ${shown} of ${total} vehicles`;
            empty.hidden = shown > 0;
        }

        input.addEventListener('input', apply);
        bindChips(chips, value => { category = value; apply(); });
        root.querySelector('.hangar-reset').addEventListener('click', () => {
            input.value = '';
            category = 'all';
            setChip(chips, 'all');
            apply();
            input.focus();
        });
        root.querySelector('.hangar-grid').addEventListener('click', e => {
            const card = e.target.closest('.vehicle-card');
            if (card) open(card.dataset.id);
        });
        apply();

        const dialog = createDialog('vehicle-dialog');
        dialog.setAttribute('aria-labelledby', 'vehicle-dialog-title');
        dialog.addEventListener('click', e => {
            const related = e.target.closest('.related-chip');
            if (related) open(related.dataset.id);
        });

        function open(id) {
            const v = vehiclesById.get(id);
            if (!v) return;
            const status = statusOf(v.status);
            const related = (v.related || []).map(r => vehiclesById.get(r)).filter(Boolean);
            const links = [
                ...(v.links || []),
                ...data.MILESTONES.filter(m => m.vehicle === v.id)
                    .map(m => ({ label: `Timeline: ${m.title}`, href: `goals-achievements.html#m-${m.id}` }))
            ];
            dialog.innerHTML = `
                <div class="dialog-head">
                    <div>
                        <p class="dialog-kicker">${vehicleMeta(v)}</p>
                        <h2 id="vehicle-dialog-title">${esc(v.name)}</h2>
                        ${v.role ? `<p class="dialog-role">${esc(v.role)}</p>` : ''}
                    </div>
                    <button type="button" class="icon-button dialog-close" aria-label="Close">${ICONS.close}</button>
                </div>
                <div class="dialog-body">
                    ${vehicleVisual(v)}
                    <p class="dialog-status">${badge(v.status)}<span>${esc(status.description)}</span></p>
                    ${v.summary ? `<p class="dialog-summary">${esc(v.summary)}</p>` : ''}
                    <h3>Documented specifications</h3>
                    ${v.specs && v.specs.length
                        ? `<dl class="spec-list">${v.specs.map(specRow).join('')}</dl>`
                        : '<p class="muted">No specifications have been documented yet.</p>'}
                    ${v.note ? `<p class="dialog-note">${esc(v.note)}</p>` : ''}
                    ${related.length ? `
                        <h3>Related vehicles</h3>
                        <div class="related-list">${related.map(r =>
                            `<button type="button" class="related-chip" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join('')}
                        </div>` : ''}
                    ${links.length ? `
                        <h3>Related missions &amp; pages</h3>
                        <ul class="link-list">${links.map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
                </div>
                ${v.page ? `<div class="dialog-actions"><a class="btn btn-primary" href="${esc(v.page)}">Open project page</a></div>` : ''}`;
            showDialog(dialog);
            dialog.scrollTop = 0;
            dialog.querySelector('.dialog-close').focus();
        }

        window.WSAHangar = { open };

        // Deep link from search, the timeline or other pages: vehicles-programs.html?vehicle=<id>#hangar
        const requested = new URLSearchParams(location.search).get('vehicle');
        if (requested) {
            history.replaceState(null, '', location.pathname + location.hash);
            open(requested);
        }
    }

    /* ---------- Development Timeline ---------- */

    function milestoneItem(m) {
        const status = statusOf(m.status);
        const vehicle = m.vehicle && vehiclesById.get(m.vehicle);
        const id = `m-${esc(m.id)}`;
        return `
            <li class="tl-item tone-${status.tone}" id="${id}" data-program="${esc(m.program)}">
                <span class="tl-node" aria-hidden="true"></span>
                <button type="button" class="tl-toggle" aria-expanded="false" aria-controls="${id}-panel">
                    <span class="tl-heading">
                        <span class="tl-program">${esc(m.program)}</span>
                        <span class="tl-title">${esc(m.title)}</span>
                    </span>
                    ${badge(m.status)}
                    ${ICONS.chevron}
                </button>
                <div class="tl-panel" id="${id}-panel">
                    <div class="tl-panel-inner"><div class="tl-panel-content">
                        <p>${esc(m.description)}</p>
                        ${m.lesson ? `<p class="tl-lesson"><strong>Notes and lessons:</strong> ${esc(m.lesson)}</p>` : ''}
                        <dl class="tl-facts">
                            <div><dt>Program</dt><dd>${esc(m.program)}</dd></div>
                            <div><dt>Status</dt><dd>${esc(status.label)}: ${esc(status.description)}</dd></div>
                        </dl>
                        <div class="tl-links">
                            ${m.href ? `<a class="btn btn-secondary btn-small" href="${esc(m.href)}">${esc(m.linkLabel || 'Project page')}</a>` : ''}
                            ${vehicle ? `<a class="btn btn-secondary btn-small" href="${esc(hangarHref(vehicle.id))}">View ${esc(vehicle.name)} in the Hangar</a>` : ''}
                        </div>
                    </div></div>
                </div>
            </li>`;
    }

    function initTimeline() {
        const root = document.getElementById('timeline-root');
        if (!root) return;

        const programs = [...new Set(data.MILESTONES.map(m => m.program))];
        const toneOrder = ['operational', 'development', 'experimental', 'planned', 'failed', 'undocumented'];
        const toneLabels = new Map(toneOrder.map(tone => [tone, new Set()]));
        data.MILESTONES.forEach(m => {
            const s = statusOf(m.status);
            if (!toneLabels.has(s.tone)) toneLabels.set(s.tone, new Set());
            toneLabels.get(s.tone).add(s.label);
        });
        toneLabels.forEach((labels, tone) => { if (!labels.size) toneLabels.delete(tone); });

        let stageNumber = 0;
        root.innerHTML = `
            <div class="timeline-controls">
                <div class="chip-group" role="group" aria-label="Filter by program">
                    ${chip('all', 'All programs', data.MILESTONES.length, true)}
                    ${programs.map(p => chip(p, p, data.MILESTONES.filter(m => m.program === p).length)).join('')}
                </div>
                <button type="button" class="link-button tl-expand-all" aria-pressed="false">Expand all</button>
            </div>
            <ul class="tone-legend" aria-label="Status colours">
                ${[...toneLabels].map(([tone, labels]) =>
                    `<li><span class="tone-dot tone-${tone}" aria-hidden="true"></span>${esc([...labels].join(' / '))}</li>`).join('')}
            </ul>
            <ol class="dev-timeline">
                ${data.STAGES.map(stage => {
                    const items = data.MILESTONES.filter(m => m.stage === stage.id);
                    if (!items.length) return '';
                    stageNumber++;
                    return `
                        <li class="tl-stage">
                            <div class="tl-stage-head">
                                <span class="tl-stage-index">Stage ${stageNumber}</span>
                                <h3>${esc(stage.title)}</h3>
                            </div>
                            <ol class="tl-items">${items.map(milestoneItem).join('')}</ol>
                        </li>`;
                }).join('')}
            </ol>`;

        const items = [...root.querySelectorAll('.tl-item')];
        const expandAll = root.querySelector('.tl-expand-all');

        function setOpen(item, open) {
            item.classList.toggle('open', open);
            item.querySelector('.tl-toggle').setAttribute('aria-expanded', String(open));
        }

        root.querySelector('.dev-timeline').addEventListener('click', e => {
            const toggle = e.target.closest('.tl-toggle');
            if (toggle) {
                const item = toggle.closest('.tl-item');
                setOpen(item, !item.classList.contains('open'));
            }
        });

        expandAll.addEventListener('click', () => {
            const expand = expandAll.getAttribute('aria-pressed') !== 'true';
            items.filter(item => !item.hidden).forEach(item => setOpen(item, expand));
            expandAll.setAttribute('aria-pressed', String(expand));
            expandAll.textContent = expand ? 'Collapse all' : 'Expand all';
        });

        bindChips(root.querySelector('.chip-group'), program => {
            items.forEach(item => { item.hidden = program !== 'all' && item.dataset.program !== program; });
            root.querySelectorAll('.tl-stage').forEach(stage => {
                stage.hidden = !stage.querySelector('.tl-item:not([hidden])');
            });
        });

        // Deep link: goals-achievements.html#m-<milestone id>
        function openFromHash() {
            const item = location.hash.startsWith('#m-') && document.getElementById(location.hash.slice(1));
            if (item && item.classList.contains('tl-item')) {
                setOpen(item, true);
                item.scrollIntoView({ block: 'center' });
                item.querySelector('.tl-toggle').focus({ preventScroll: true });
            }
        }
        window.addEventListener('hashchange', openFromHash);
        openFromHash();
    }

    function initStatusLegend() {
        const root = document.getElementById('status-legend-root');
        if (!root) return;
        root.innerHTML = Object.values(data.STATUSES).map(s => `
            <div class="status-card">
                <span class="status ${s.tone}">${esc(s.label)}</span>
                <p>${esc(s.description)}</p>
            </div>`).join('');
    }

    /* ---------- Flight Gallery ---------- */

    function initGallery() {
        const root = document.getElementById('gallery-root');
        if (!root) return;

        const albums = data.GALLERY;
        const categories = data.GALLERY_CATEGORIES;
        const countIn = key => albums.filter(album => (album.categories || []).includes(key)).length;
        const usedCategories = Object.entries(categories).filter(([key]) => countIn(key) > 0);
        const photoCount = n => `${n} ${n === 1 ? 'photo' : 'photos'}`;
        const thumbOf = image => image.thumb || image.src;

        function albumCover(album) {
            if (album.fit === 'contain') {
                return `<span class="album-cover is-row">${album.images.slice(0, 3).map(image =>
                    `<img src="${esc(thumbOf(image))}" alt="" loading="lazy">`).join('')}</span>`;
            }
            return `<span class="album-cover"><img src="${esc(thumbOf(album.images[0]))}" alt="" loading="lazy"></span>`;
        }

        root.innerHTML = `
            ${usedCategories.length > 1 ? `
            <div class="chip-group" role="group" aria-label="Filter by category">
                ${chip('all', 'All', albums.length, true)}
                ${usedCategories.map(([key, label]) => chip(key, label, countIn(key))).join('')}
            </div>` : ''}
            <div class="album-grid">
                ${albums.map((album, i) => `
                    <article class="album-card" data-index="${i}">
                        <div class="album-visual">
                            ${albumCover(album)}
                            <span class="album-count" aria-hidden="true">${ICONS.images}${album.images.length}</span>
                            ${album.patch ? `<img class="album-patch" src="${esc(album.patch)}" alt="" loading="lazy">` : ''}
                        </div>
                        <div class="album-info">
                            <h3 class="album-title"><button type="button" class="album-open">${esc(album.title)}</button></h3>
                            ${album.summary ? `<p class="album-summary">${esc(album.summary)}</p>` : ''}
                            <p class="album-meta">${photoCount(album.images.length)}</p>
                        </div>
                    </article>`).join('')}
            </div>
            <div class="empty-state gallery-empty" hidden>
                <span class="empty-icon">${ICONS.camera}</span>
                <p class="empty-title"></p>
                <p class="empty-text"></p>
            </div>`;

        const cards = [...root.querySelectorAll('.album-card')];
        const empty = root.querySelector('.gallery-empty');

        // A wrong path shows the path on the card instead of a broken image
        cards.forEach(card => {
            card.querySelectorAll('.album-cover img').forEach(img => {
                img.addEventListener('error', () => {
                    if (card.classList.contains('is-missing')) return;
                    card.classList.add('is-missing');
                    card.querySelector('.album-cover').insertAdjacentHTML('afterend',
                        `<span class="gallery-missing">Image not found<code>${esc(img.getAttribute('src'))}</code></span>`);
                }, { once: true });
            });
        });

        function filter(category) {
            let shown = 0;
            cards.forEach((card, i) => {
                const match = category === 'all' || (albums[i].categories || []).includes(category);
                card.hidden = !match;
                if (match) shown++;
            });
            empty.hidden = shown > 0;
            if (!shown) {
                const label = category === 'all' ? '' : categories[category].toLowerCase();
                empty.querySelector('.empty-title').textContent = albums.length
                    ? `No ${label} albums yet`
                    : 'No flight images yet';
                empty.querySelector('.empty-text').textContent = albums.length
                    ? 'Try another category, or check back as more flights are documented.'
                    : 'Screenshots from WSA flights will appear here as they are documented.';
            }
        }

        const chips = root.querySelector('.chip-group');
        if (chips) bindChips(chips, filter);
        filter('all');

        /* Mission detail view: one album, with arrows and a thumbnail strip to step through its photos */
        const dialog = createDialog('lightbox album-dialog');
        dialog.setAttribute('aria-labelledby', 'album-dialog-title');
        dialog.innerHTML = `
            <div class="album-head">
                <img class="album-head-patch" alt="" hidden>
                <div class="album-head-text">
                    <h2 class="album-head-title" id="album-dialog-title"></h2>
                    <p class="album-head-summary"></p>
                </div>
                <button type="button" class="icon-button dialog-close" aria-label="Close">${ICONS.close}</button>
            </div>
            <div class="lightbox-stage">
                <img class="lightbox-image" alt="" draggable="false">
                <button type="button" class="icon-button lightbox-nav lightbox-prev" aria-label="Previous photo">${ICONS.prev}</button>
                <button type="button" class="icon-button lightbox-nav lightbox-next" aria-label="Next photo">${ICONS.next}</button>
            </div>
            <div class="lightbox-info">
                <div>
                    <p class="lightbox-caption" aria-live="polite"></p>
                    <p class="lightbox-meta"></p>
                </div>
                <a class="btn btn-secondary btn-small lightbox-link" hidden></a>
            </div>
            <div class="album-strip" role="group" aria-label="Photos in this album"></div>`;

        const image = dialog.querySelector('.lightbox-image');
        const headPatch = dialog.querySelector('.album-head-patch');
        const headSummary = dialog.querySelector('.album-head-summary');
        const caption = dialog.querySelector('.lightbox-caption');
        const meta = dialog.querySelector('.lightbox-meta');
        const link = dialog.querySelector('.lightbox-link');
        const strip = dialog.querySelector('.album-strip');
        const navButtons = dialog.querySelectorAll('.lightbox-nav');
        let album = null;
        let position = 0;

        image.addEventListener('load', () => image.classList.remove('is-changing'));
        image.addEventListener('error', () => image.classList.remove('is-changing'));

        function show(newPosition) {
            const photos = album.images;
            position = (newPosition + photos.length) % photos.length;
            const photo = photos[position];
            if (image.getAttribute('src') !== photo.src) {
                image.classList.add('is-changing');
                image.src = photo.src;
            }
            image.alt = photo.alt;
            image.classList.toggle('is-contain', album.fit === 'contain');
            caption.textContent = photo.caption || photo.alt;
            meta.textContent = `${position + 1} of ${photos.length}`;
            const related = photo.related || album.related;
            link.hidden = !related;
            if (related) {
                link.href = related.href;
                link.textContent = related.label;
            }
            strip.querySelectorAll('.album-thumb').forEach((thumb, i) => {
                if (i === position) {
                    thumb.setAttribute('aria-current', 'true');
                    // Keep the current thumbnail centred in the strip (scrolls only the strip, never the page)
                    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
                } else {
                    thumb.removeAttribute('aria-current');
                }
            });
            // Load the neighbours so the arrows feel instant
            [position + 1, position - 1].forEach(i => { new Image().src = photos[(i + photos.length) % photos.length].src; });
        }

        function open(index, photoIndex = 0) {
            album = albums[index];
            if (!album) return;
            const several = album.images.length > 1;
            dialog.querySelector('.album-head-title').textContent = album.title;
            headSummary.textContent = album.summary ? `${album.summary} · ${photoCount(album.images.length)}` : photoCount(album.images.length);
            headPatch.hidden = !album.patch;
            if (album.patch) headPatch.src = album.patch;
            navButtons.forEach(b => { b.hidden = !several; });
            strip.hidden = !several;
            strip.classList.toggle('is-contain', album.fit === 'contain');
            strip.innerHTML = several ? album.images.map((photo, i) => `
                <button type="button" class="album-thumb" data-index="${i}" aria-label="Photo ${i + 1}: ${esc(photo.caption || photo.alt)}">
                    <img src="${esc(thumbOf(photo))}" alt="" loading="lazy" draggable="false">
                </button>`).join('') : '';
            image.removeAttribute('src');
            showDialog(dialog);
            show(photoIndex);
        }

        root.querySelector('.album-grid').addEventListener('click', e => {
            const card = e.target.closest('.album-card');
            if (card) open(Number(card.dataset.index));
        });
        strip.addEventListener('click', e => {
            const thumb = e.target.closest('.album-thumb');
            if (thumb) show(Number(thumb.dataset.index));
        });
        dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(position - 1));
        dialog.querySelector('.lightbox-next').addEventListener('click', () => show(position + 1));
        dialog.addEventListener('keydown', e => {
            if (!album || album.images.length < 2) return;
            if (e.key === 'ArrowLeft') show(position - 1);
            if (e.key === 'ArrowRight') show(position + 1);
        });

        // Swipe left/right on touch screens
        let startX = null;
        const stage = dialog.querySelector('.lightbox-stage');
        stage.addEventListener('pointerdown', e => { startX = e.clientX; });
        stage.addEventListener('pointercancel', () => { startX = null; });
        stage.addEventListener('pointerup', e => {
            if (startX === null || !album || album.images.length < 2) return;
            const dx = e.clientX - startX;
            startX = null;
            if (Math.abs(dx) > 50) show(position + (dx < 0 ? 1 : -1));
        });

        // Deep link from other pages: gallery.html?album=<id>
        const requested = new URLSearchParams(location.search).get('album');
        if (requested) {
            history.replaceState(null, '', location.pathname + location.hash);
            const index = albums.findIndex(a => a.id === requested);
            if (index >= 0) open(index);
        }
    }

    initHangar();
    initSearch();
    initTimeline();
    initStatusLegend();
    initGallery();
})();
