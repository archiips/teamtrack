"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Original TeamTrack character. No downloaded models or external texture requests. */
export default function CompanionModel({
  hero = false,
  active = false,
}: {
  hero?: boolean;
  active?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const setActive = useRef<(on: boolean) => void>(() => {});
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x22396f, 3));
    const light = new THREE.DirectionalLight(0xfff5d9, 5);
    light.position.set(-3, 5, 5);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0x7d9fed, 3);
    rim.position.set(4, 1, -2);
    scene.add(rim);
    const character = new THREE.Group();
    scene.add(character);
    const cream = new THREE.MeshStandardMaterial({
      color: 0xfcf1d0,
      roughness: 0.25,
      metalness: 0.12,
    });
    const navy = new THREE.MeshStandardMaterial({
      color: 0x0d1c42,
      roughness: 0.3,
    });
    const blue = new THREE.MeshStandardMaterial({
      color: 0x5674b2,
      roughness: 0.28,
      metalness: 0.15,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xd7b96e,
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
    const hands: THREE.Mesh[] = [];
    for (const x of [-0.32, 0.32]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), navy);
      eye.scale.set(0.77, 1.2, 0.4);
      eye.position.set(x, 0.4, 0.548);
      character.add(eye);
      const gleam = new THREE.Mesh(
        new THREE.SphereGeometry(0.027, 12, 8),
        white,
      );
      gleam.position.set(x - 0.025, 0.44, 0.586);
      character.add(gleam);
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
        color: hero ? 0x60739b : 0xc2cce1,
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
        color: 0x010736,
        transparent: true,
        opacity: hero ? 0.2 : 0.08,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.28;
    shadow.scale.set(1.25, 0.65, 1);
    scene.add(shadow);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      until = performance.now() + 3500,
      targetX = -0.08,
      targetY = -0.23,
      wave = 0;
    function render(now: number) {
      frame = 0;
      if (document.hidden) return;
      const motion = !reduced.matches && now < until;
      character.rotation.y += (targetY - character.rotation.y) * 0.07;
      character.rotation.x += (targetX - character.rotation.x) * 0.07;
      character.rotation.z = -0.06;
      character.position.y = motion ? Math.sin(now * 0.0018) * 0.055 : 0;
      // Raise the left hand (viewer's left, toward the panel) while active.
      const lift = wave
        ? 0.62 + (motion ? Math.sin(now * 0.012) * 0.06 : 0)
        : 0;
      hands[0].position.y += (-0.68 + lift - hands[0].position.y) * 0.15;
      renderer.render(scene, camera);
      if (motion) frame = requestAnimationFrame(render);
    }
    function draw() {
      // rAF never fires in hidden tabs, so paint a still frame immediately.
      if (document.hidden) renderer.render(scene, camera);
      else if (!frame) frame = requestAnimationFrame(render);
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
    function move(e: PointerEvent) {
      const b = el!.getBoundingClientRect();
      targetY = ((e.clientX - b.left - b.width / 2) / b.width) * 0.7;
      targetX = (-(e.clientY - b.top - b.height / 2) / b.height) * 0.3;
      until = performance.now() + 1500;
      draw();
    }
    setActive.current = (on) => {
      wave = on ? 1 : 0;
      targetX = on ? 0.12 : -0.08;
      targetY = on ? -0.55 : -0.23;
      if (on || !reduced.matches) until = performance.now() + 1600;
      if (reduced.matches) {
        hands[0].position.y = on ? -0.06 : -0.68;
        character.rotation.set(targetX, targetY, -0.06);
      }
      draw();
    };
    function leave() {
      if (wave) return;
      targetX = -0.08;
      targetY = -0.23;
      until = performance.now() + 700;
      draw();
    }
    function visibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else draw();
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", draw);
    draw();
    return () => {
      setActive.current = () => {};
      cancelAnimationFrame(frame);
      resize.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
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
  useEffect(() => setActive.current(active), [active]);
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
