"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Original TeamTrack character. No downloaded models or external texture requests. */
export default function CompanionModel({
  hero = false,
  active = false,
  cheer = 0,
  attention = false,
}: {
  hero?: boolean;
  /** Turn toward the open panel and raise a hand. */
  active?: boolean;
  /** Increment to make Pip hop and wave (e.g. after a save). */
  cheer?: number;
  /** Nod now and then while there is something worth a look. */
  attention?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const control = useRef({
    active: (on: boolean) => void on,
    cheer: () => {},
    attention: (on: boolean) => void on,
  });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);
    el.dataset.rendered = "true";
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.15, 6.2);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5e17eb, 3));
    const light = new THREE.DirectionalLight(0xfff6fb, 5);
    light.position.set(-3, 5, 5);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xb088ff, 3);
    rim.position.set(4, 1, -2);
    scene.add(rim);
    const character = new THREE.Group();
    scene.add(character);
    const cream = new THREE.MeshStandardMaterial({
      color: 0xfbf6f1,
      roughness: 0.25,
      metalness: 0.12,
    });
    const navy = new THREE.MeshStandardMaterial({
      color: 0x1b0f3b,
      roughness: 0.3,
    });
    const blue = new THREE.MeshStandardMaterial({
      color: 0x8c52ff,
      roughness: 0.28,
      metalness: 0.15,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xcb6ce6,
      roughness: 0.3,
      metalness: 0.45,
    });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(
      new RoundedBoxGeometry(1.55, 1.42, 1.05, 5, 0.29),
      cream,
    );
    head.position.y = 0.3;
    character.add(head);
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.98, 0.59, 0.8, 4, 0.22),
      blue,
    );
    body.position.set(0, -0.74, -0.02);
    character.add(body);
    const hands: THREE.Mesh[] = [],
      eyes: THREE.Mesh[] = [];
    for (const x of [-0.32, 0.32]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), navy);
      eye.scale.set(0.77, 1.2, 0.4);
      eye.position.set(x, 0.4, 0.548);
      character.add(eye);
      eyes.push(eye);
      const gleam = new THREE.Mesh(
        new THREE.SphereGeometry(0.027, 12, 8),
        white,
      );
      gleam.position.set(x - 0.025, 0.44, 0.586);
      character.add(gleam);
      eyes.push(gleam);
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 12),
        gold,
      );
      cheek.scale.set(1, 0.45, 0.14);
      cheek.position.set(x * 1.55, 0.16, 0.527);
      character.add(cheek);
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 20, 12),
        cream,
      );
      hand.position.set(x * 2.55, -0.68, 0.1);
      character.add(hand);
      hands.push(hand);
    }
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 8, 24, Math.PI),
      navy,
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.16, 0.56);
    character.add(smile);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 0.3, 12),
      gold,
    );
    antenna.position.set(0.08, 1.12, 0);
    antenna.rotation.z = -0.18;
    character.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), gold);
    tip.position.set(0.105, 1.3, 0);
    character.add(tip);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.012, 8, 90),
      new THREE.MeshBasicMaterial({
        color: hero ? 0xb088ff : 0xd9c6f5,
        transparent: true,
        opacity: 0.4,
      }),
    );
    orbit.rotation.set(0.6, 0.4, -0.3);
    orbit.position.z = -0.5;
    scene.add(orbit);
    const satellite = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 1),
      gold,
    );
    satellite.position.set(1.48, 0.65, -0.25);
    scene.add(satellite);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 40),
      new THREE.MeshBasicMaterial({
        color: 0x1b0f3b,
        transparent: true,
        opacity: hero ? 0.2 : 0.08,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.28;
    shadow.scale.set(1.25, 0.65, 1);
    scene.add(shadow);
    eyes.forEach((m) => (m.userData.sy = m.scale.y));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      inView = true,
      wave = false,
      attend = false,
      lookX = -0.08,
      lookY = -0.23,
      hopAt = -1e9,
      nextBlink = performance.now() + 2500,
      nodAt = performance.now() + 5000;
    const live = () => !reduced.matches && !document.hidden && inView;
    /** Sets every moving part for time `now`. Static pose under reduced motion. */
    function pose(now: number) {
      const animate = !reduced.matches,
        t = now * 0.001,
        tx = wave ? 0.12 : lookX,
        ty = wave ? -0.55 : lookY,
        hop = (now - hopAt) / 700,
        cheering = hop >= 0 && hop < 1.6;
      if (!animate) {
        character.rotation.set(tx, ty, -0.06);
        character.position.y = 0;
        hands[0].position.y = wave || cheering ? -0.06 : -0.68;
        return;
      }
      character.rotation.y += (ty - character.rotation.y) * 0.08;
      character.rotation.x += (tx - character.rotation.x) * 0.08;
      character.rotation.z = -0.06 + Math.sin(t * 1.1) * 0.035;
      let y = Math.sin(t * 1.6) * 0.07;
      if (hop >= 0 && hop < 1) y += Math.sin(hop * Math.PI) * 0.35;
      character.position.y = y;
      if (attend && !wave && now > nodAt) {
        const n = (now - nodAt) / 650;
        if (n < 1) character.rotation.x += Math.sin(n * Math.PI * 2) * 0.05;
        else nodAt = now + 7000;
      }
      const lift = wave || cheering ? 0.62 + Math.sin(now * 0.012) * 0.08 : 0;
      hands[0].position.y += (-0.68 + lift - hands[0].position.y) * 0.15;
      let open = 1;
      const b = now - nextBlink;
      if (b > 0) {
        open = b < 160 ? Math.max(0.1, Math.abs(1 - b / 80)) : 1;
        if (b >= 160) nextBlink = now + 2500 + Math.random() * 3000;
      }
      eyes.forEach((m) => (m.scale.y = m.userData.sy * open));
      satellite.position.x = Math.cos(t * 0.8) * 1.48;
      satellite.position.z = Math.sin(t * 0.8) * 0.45 - 0.25;
    }
    // ~30fps is plenty for a gentle idle and spares the GPU on projectors.
    function loop(now: number) {
      frame = 0;
      if (!live()) return;
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      pose(now);
      renderer.render(scene, camera);
    }
    function draw() {
      if (live()) {
        if (!frame) frame = requestAnimationFrame(loop);
      } else {
        // rAF never fires in hidden tabs, so paint a still frame immediately.
        pose(performance.now());
        renderer.render(scene, camera);
      }
    }
    const resize = new ResizeObserver(() => {
      const w = el!.clientWidth,
        h = el!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      draw();
    });
    resize.observe(el);
    const seen = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      draw();
    });
    seen.observe(el);
    // Follow the cursor anywhere on the page, not just over Pip.
    function look(e: PointerEvent) {
      if (reduced.matches) return;
      const b = el!.getBoundingClientRect(),
        dx = (e.clientX - (b.left + b.width / 2)) / window.innerWidth,
        dy = (e.clientY - (b.top + b.height / 2)) / window.innerHeight;
      lookY = Math.max(-0.6, Math.min(0.6, dx * 1.5));
      lookX = Math.max(-0.3, Math.min(0.3, -dy * 0.9));
    }
    function rest() {
      lookX = -0.08;
      lookY = -0.23;
    }
    control.current = {
      active: (on) => {
        wave = on;
        draw();
      },
      cheer: () => {
        hopAt = performance.now();
        draw();
      },
      attention: (on) => {
        attend = on;
      },
    };
    function visibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else draw();
    }
    window.addEventListener("pointermove", look, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", draw);
    draw();
    return () => {
      control.current = {
        active: () => {},
        cheer: () => {},
        attention: () => {},
      };
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      window.removeEventListener("pointermove", look);
      document.documentElement.removeEventListener("pointerleave", rest);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", draw);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = Array.isArray(o.material) ? o.material : [o.material];
          m.forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      delete el.dataset.rendered;
    };
  }, [hero]);
  useEffect(() => control.current.active(active), [active]);
  useEffect(() => control.current.attention(attention), [attention]);
  useEffect(() => {
    if (cheer) control.current.cheer();
  }, [cheer]);
  return (
    <span
      ref={host}
      className={`companion-model ${hero ? "hero-model" : ""}`}
      aria-hidden="true"
    >
      <span className="model-fallback">
        <span>••</span>
        <i />
      </span>
    </span>
  );
}
