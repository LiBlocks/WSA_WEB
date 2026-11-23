// Where things sit in the sky. Directions are composed against the homepage's opening view (f: where the
// camera looks, r: its right, u: its up), so the first thing a visitor sees is arranged, not left to chance:
// the galaxy's band crossing behind Kerbin, a spiral galaxy above it, the nebulae off to its right. Behind
// the camera and above the system are the things to find in Explore mode.
import * as THREE from 'three';
import { stream } from './rng.js';

const dir = (f, r, u, a, b, c) => new THREE.Vector3().addScaledVector(f, a).addScaledVector(r, b).addScaledVector(u, c).normalize();

export function makeLayout(f, r, u) {
    const tilt = new THREE.Vector3().addScaledVector(r, 1).addScaledVector(u, -0.55).normalize();
    const bandNormal = new THREE.Vector3().crossVectors(f, tilt).normalize();
    // The bulge: along the band, well away from the opening view (the about-view pulls back toward it)
    const bulge = dir(f, r, u, -0.35, -0.94, -0.58);
    bulge.addScaledVector(bandNormal, -bulge.dot(bandNormal)).normalize();

    const R = stream('distant-galaxies');
    const distantGalaxies = [];
    for (let i = 0; i < 24; i++) {
        const d = new THREE.Vector3(R.normal(), R.normal(), R.normal()).normalize();
        // keep them out of the band, where they would be hidden anyway
        if (Math.abs(d.dot(bandNormal)) < 0.18) d.addScaledVector(bandNormal, 0.3 * Math.sign(d.dot(bandNormal) || 1)).normalize();
        const axis = new THREE.Vector2(R.normal(), R.normal()).normalize();
        distantGalaxies.push({ dir: d, size: R.range(0.0045, 0.012), axis, ratio: R.range(0.25, 0.9), bright: R.range(0.35, 0.9) });
    }

    return {
        f, r, u,
        bandNormal,
        bulge,
        // In the opening view the frame spans roughly f-37deg .. f+15deg across and +-17deg up and down
        // (the lens shift puts Kerbin, at f, right of centre)
        nebulaA: dir(f, r, u, 1, 0.3, -0.16),
        nebulaB: dir(f, r, u, 1, 0.42, 0.02),
        spiral: dir(f, r, u, 1, 0.13, 0.24),
        globular: dir(f, r, u, 1, -0.42, 0.25),
        openCluster: dir(f, r, u, 1, 0.38, -0.02),
        constellation: dir(f, r, u, -0.25, 0.15, 1),
        blackhole: dir(f, r, u, -1, -0.35, 0.22),
        distantGalaxies,
    };
}
