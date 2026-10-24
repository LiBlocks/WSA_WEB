// Decorative orbit diagrams and scroll-in reveals. Purely visual: pages work without this file.
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let uid = 0;

    // A planet with a station on a low orbit (passes behind the planet) and a moon on a wide dashed orbit
    function orbitsSVG() {
        const id = `deco-${++uid}`;
        return `
<svg class="deco deco-orbits" viewBox="0 0 600 400" aria-hidden="true" focusable="false">
    <g transform="rotate(-18 300 200)">
        <path id="${id}-outer" class="deco-orbit deco-orbit-dashed" d="M 50 200 A 250 70 0 1 1 550 200 A 250 70 0 1 1 50 200"/>
        <path id="${id}-inner" class="deco-orbit" d="M 180 200 A 120 30 0 1 1 420 200 A 120 30 0 1 1 180 200"/>
        <circle class="deco-planet-base" cx="300" cy="200" r="38"/>
        <circle class="deco-planet" cx="300" cy="200" r="38"/>
        <path class="deco-orbit" d="M 420 200 A 120 30 0 0 1 180 200"/>
        <circle class="deco-moon" r="8">
            <animateMotion dur="60s" begin="-22s" repeatCount="indefinite"><mpath href="#${id}-outer"/></animateMotion>
        </circle>
        <circle class="deco-craft" r="3.5">
            <animateMotion dur="14s" repeatCount="indefinite"><mpath href="#${id}-inner"/></animateMotion>
            <animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0;1;1" keyTimes="0;0.19;0.2;0.3;0.31;1"/>
        </circle>
    </g>
</svg>`;
    }

    const STARS = [
        [90, 70, 1.6], [210, 150, 1.1], [160, 300, 1.4], [330, 60, 1.2], [60, 420, 1.1],
        [880, 80, 1.2], [1040, 420, 1.5], [1130, 250, 1.1], [760, 520, 1.3], [1150, 90, 1.6],
        [420, 540, 1.1], [980, 560, 1.2], [520, 30, 1.0], [640, 110, 1.3]
    ];

    // Twinkling star field plus a small craft climbing a dashed ascent trajectory
    function starsSVG() {
        const stars = STARS.map(([x, y, r], i) =>
            `<circle class="deco-star" cx="${x}" cy="${y}" r="${r}" style="animation-delay: ${(i * 0.7) % 5}s"/>`
        ).join('');
        return `
<svg class="deco deco-stars" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <path id="deco-ascent" class="deco-orbit deco-orbit-dashed" d="M 90 600 C 100 480 150 380 260 320"/>
    <circle class="deco-craft" r="3">
        <animateMotion dur="9s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.6;1"><mpath href="#deco-ascent"/></animateMotion>
        <animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.05;0.5;0.6;1"/>
    </circle>
    ${stars}
</svg>`;
    }

    const hero = document.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterbegin', starsSVG() + orbitsSVG());

    const pageHead = document.querySelector('.page-head');
    if (pageHead) pageHead.insertAdjacentHTML('afterbegin', orbitsSVG());

    if (reduceMotion) {
        document.querySelectorAll('svg.deco').forEach(svg => svg.pauseAnimations());
        return;
    }

    // Cards fade up as they scroll into view
    const revealTargets = document.querySelectorAll(
        '.stat-card, .overview-card, .program-card, .achievement, .module-card, .expandable-section, .wallet-card, .vehicle-card, .album-card, .status-card'
    );
    const observer = new IntersectionObserver(entries => {
        let batchIndex = 0;
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.style.transitionDelay = `${Math.min(batchIndex++, 5) * 70}ms`;
            el.classList.add('revealed');
            el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
            observer.unobserve(el);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
})();
