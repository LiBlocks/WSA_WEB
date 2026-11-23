// The far sky: the galaxy's band with its dust lanes, two emission nebulae and a scatter of faint distant
// galaxies. All of it is noise, so it is drawn once into a cube map when the universe starts (bakeSky) and
// each frame only looks it up. The cube holds data, not colour: R the band and the distant galaxies, G dust,
// B and A the two nebulae. The display shader turns that into deep space or a pale observatory plate, so a
// theme change costs nothing.
import * as THREE from 'three';
import { NOISE } from './glsl.js';

const BAKE = /* glsl */ `
#define OCTAVES 6
${NOISE}
varying vec3 vDir;
uniform vec3 uBandNormal;      // the galaxy's plane
uniform vec3 uBulge;           // toward its centre
uniform vec3 uNebA;            // emission nebula (hydrogen red)
uniform vec3 uNebB;            // oxygen teal
uniform vec4 uGalaxies[24];    // xyz direction, w size
uniform vec4 uGalaxyShape[24]; // xy major axis tangent, z axis ratio, w brightness

float angleTo(vec3 a, vec3 b) { return acos(clamp(dot(a, b), -1.0, 1.0)); }

void main() {
    vec3 d = normalize(vDir);
    float lat = asin(clamp(dot(d, uBandNormal), -1.0, 1.0));
    // The band: brightest near the bulge, mottled with star clouds
    float clouds = 0.55 + 0.45 * fbm3(d * 4.0 + 3.0);
    float band = exp(-pow(lat / 0.19, 2.0)) * clouds;
    float bulge = exp(-pow(angleTo(d, uBulge) / 0.42, 2.0));
    band = band * (0.45 + 0.75 * bulge) + 0.55 * bulge * exp(-pow(lat / 0.3, 2.0));
    band += 0.04 * (0.5 + 0.5 * fbm3(d * 1.5));          // a faint overall glow
    // Dust lanes along the middle of the band, ragged
    vec3 w = d * 5.0 + 0.8 * vec3(fbm3(d * 2.0 + 1.0), fbm3(d * 2.0 + 7.0), fbm3(d * 2.0 + 13.0));
    float dust = smoothstep(0.02, 0.38, fbm3(w)) * exp(-pow((lat + 0.025) / 0.06, 2.0));
    dust = clamp(dust * (0.6 + 0.6 * bulge), 0.0, 1.0);

    // Nebulae: soft billowing clouds (warped low-frequency noise) inside an irregular envelope, with a few
    // brighter filaments near their hearts
    vec3 q = d * 2.4;
    vec3 warp = vec3(fbm3(q + 2.1), fbm3(q + 5.3), fbm3(q + 8.7));
    float cloud = smoothstep(-0.15, 0.55, fbm3(q * 1.3 + 1.2 * warp));
    float fil = pow(1.0 - abs(fbm3(q * 2.6 + warp * 1.6)), 6.0);
    float a = angleTo(d, uNebA);
    float envA = smoothstep(0.42, 0.0, a + 0.14 * fbm3(d * 5.0));
    float nebA = envA * (0.65 * cloud + 0.35 * fil * smoothstep(0.32, 0.05, a)) * smoothstep(0.0, 0.3, cloud);
    float b = angleTo(d, uNebB);
    float envB = smoothstep(0.28, 0.0, b + 0.1 * fbm3(d * 6.0 + 4.0));
    float nebB = envB * (0.6 * smoothstep(-0.1, 0.6, fbm3(q * 1.7 - 1.1 * warp)) + 0.3 * fil);

    // Distant galaxies: small soft ellipses with brighter cores
    float gal = 0.0;
    for (int i = 0; i < 24; i++) {
        vec3 c = uGalaxies[i].xyz;
        float cosA = dot(d, c);
        if (cosA < 0.999) continue;
        vec3 off = d - c * cosA;
        vec3 major = normalize(vec3(uGalaxyShape[i].x, uGalaxyShape[i].y, 0.0) - c * dot(vec3(uGalaxyShape[i].xy, 0.0), c));
        vec3 minor = cross(c, major);
        vec2 p = vec2(dot(off, major), dot(off, minor) / uGalaxyShape[i].z) / uGalaxies[i].w;
        float r = length(p);
        gal += uGalaxyShape[i].w * (exp(-r * 6.0) * 0.6 + exp(-r * 22.0));
    }

    gl_FragColor = vec4(clamp(band * 0.8 + gal, 0.0, 1.0), dust, nebA, nebB);
}
`;

const DISPLAY = /* glsl */ `
uniform samplerCube uSky;
uniform float uTheme;
uniform float uNebula;      // the gallery mood turns the nebulae up
uniform float uFade;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec3 d = normalize(vDir);
    vec4 s = textureCube(uSky, d);
    float band = s.r, dust = s.g, na = s.b * uNebula, nb = s.a * uNebula;
    float lit = band * (1.0 - 0.85 * dust);
    // Deep space
    vec3 dark = mix(vec3(0.012, 0.018, 0.045), vec3(0.03, 0.04, 0.085), 0.5 + 0.5 * d.y);
    dark += lit * vec3(0.30, 0.29, 0.36) * 1.25;
    dark += na * vec3(0.5, 0.11, 0.26) * 0.42 + na * na * vec3(0.3, 0.1, 0.15) * 0.4;
    dark += nb * vec3(0.08, 0.36, 0.42) * 0.38;
    dark -= dust * 0.012;
    // Observatory plate: ink washes on pale paper
    vec3 plate = mix(vec3(0.905, 0.928, 0.962), vec3(0.955, 0.965, 0.985), 0.5 + 0.5 * d.y);
    plate -= lit * vec3(0.11, 0.11, 0.09);
    plate -= na * vec3(0.02, 0.08, 0.05);
    plate -= nb * vec3(0.07, 0.025, 0.02);
    vec3 col = mix(dark, plate, uTheme);
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;          // dither: no banding in the soft gradients
    gl_FragColor = vec4(col * uFade + mix(vec3(0.012, 0.018, 0.045), vec3(0.93, 0.945, 0.97), uTheme) * (1.0 - uFade), 1.0);
}
`;

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;          // always at the far plane
}
`;

// Async: the bake shader is compiled in parallel where the browser can (KHR_parallel_shader_compile), so the
// page isn't frozen while it compiles
export async function createSky(renderer, layout, quality) {
    const size = quality === 'low' ? 512 : 1024;
    const target = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const galaxies = layout.distantGalaxies;
    const bakeMat = new THREE.ShaderMaterial({
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: BAKE,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        uniforms: {
            uBandNormal: { value: layout.bandNormal },
            uBulge: { value: layout.bulge },
            uNebA: { value: layout.nebulaA },
            uNebB: { value: layout.nebulaB },
            uGalaxies: { value: galaxies.map(g => new THREE.Vector4(g.dir.x, g.dir.y, g.dir.z, g.size)) },
            uGalaxyShape: { value: galaxies.map(g => new THREE.Vector4(g.axis.x, g.axis.y, g.ratio, g.bright)) },
        },
    });
    const bakeScene = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), bakeMat);
    bakeScene.add(box);
    const cubeCamera = new THREE.CubeCamera(0.1, 100, target);
    if (renderer.compileAsync) await renderer.compileAsync(bakeScene, cubeCamera.children[0]);
    cubeCamera.update(renderer, bakeScene);
    box.geometry.dispose();
    bakeMat.dispose();

    const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: DISPLAY,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        uniforms: {
            uSky: { value: target.texture },
            uTheme: { value: 0 },
            uNebula: { value: 1 },
            uFade: { value: 1 },
        },
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    mesh.onBeforeRender = (r, s, camera) => mesh.position.copy(camera.position);

    return {
        object: mesh,
        material,
        update(ctx) {
            material.uniforms.uTheme.value = ctx.themeMix;
            material.uniforms.uNebula.value = 1 + 0.6 * ctx.mood.gallery;
        },
        dispose() {
            mesh.geometry.dispose();
            material.dispose();
            target.dispose();
        },
    };
}
