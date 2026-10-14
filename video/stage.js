// TeamTrack demo video stage. render(t) is a pure function of time (seconds).
/* global RECTS */
const R = window.RECTS;
const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const io = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const out = (p) => 1 - Math.pow(1 - p, 3);
const back = (p) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
/** Keyframes [[t, ...values]] with ease-in-out between them. */
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const p = io(seg(t, keys[i - 1][0], keys[i][0]));
      return keys[i]
        .slice(1)
        .map((v, j) => keys[i - 1][j + 1] + (v - keys[i - 1][j + 1]) * p);
    }
  }
  return keys[keys.length - 1].slice(1);
}
/** Opacity for an element shown during [a, b] with fade length f. */
const win = (t, a, b, f = 0.35) =>
  Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));

const S = "work/shots/";
const pad = (n) => String(n).padStart(3, "0");
const APP = "teamtrack-kappa.vercel.app";
const CANVAS = "Canvas LMS · CSS 474 · Product Development Lab";

// Each shot: image, its coordinate space (w,h), camera keys [t,x,y,z],
// cursor keys [t,x,y], clicks, highlight ring, cut (instant swap, no dip).
const LONG_SHOTS = [
  {
    a: 4.0,
    b: 8.75,
    src: S + "canvas-course.jpg",
    w: 1512,
    h: 791,
    url: CANVAS,
    cam: [
      [4.0, 0, 0, 1],
      [6.2, 0, 0, 1],
      [8.4, 0, 90, 1.35],
    ],
    cur: [
      [5.3, 1150, 760],
      [7.8, 140, 556],
      [8.75, 140, 556],
    ],
    clicks: [8.2],
    ring: { box: [96, 538, 150, 36], a: 8.1, b: 8.75 },
  },
  {
    a: 8.75,
    b: 16.85,
    cut: true,
    src: S + "canvas-teamtrack.jpg",
    w: 1512,
    h: 791,
    url: CANVAS,
    cam: [
      [8.75, 0, 90, 1.35],
      [9.7, 0, 90, 1.35],
      [11.1, 262, 60, 1.52],
    ],
    cur: [
      [8.75, 140, 556],
      [9.3, 140, 556],
    ],
    curOff: 9.5,
    ring: { box: [354, 288, 886, 58], a: 12.3, b: 16.5 },
  },
  {
    a: 16.85,
    b: 27.0,
    src: S + "prof-overview-full.jpg",
    w: 1440,
    h: R.profFullHeight,
    url: APP,
    cam: [
      [16.85, 0, 0, 1],
      [19.4, 0, 0, 1],
      [22.4, 250, 330, 1.3],
    ],
    cur: [
      [22.4, 1160, 940],
      [23.7, 800, 712],
    ],
    ring: { box: rectBox(R.profChips), a: 23.2, b: 26.7 },
  },
  {
    a: 27.0,
    b: 31.4,
    src: S + "alex-overview.jpg",
    w: 1440,
    h: 900,
    url: APP,
    pip: true,
    cam: [
      [27.0, 0, 0, 1],
      [28.2, 280, 0, 1.3],
    ],
    cur: [
      [28.0, 1120, 470],
      [28.9, 1176, 168],
    ],
    clicks: [29.0],
  },
  {
    a: 31.4,
    b: 33.5,
    src: S + "alex-agreement.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [[31.4, 150, 110, 1.25]],
    cur: [
      [31.6, 820, 560],
      [33.0, 396, 731],
    ],
    clicks: [33.3],
  },
  {
    a: 33.5,
    b: 34.95,
    cut: true,
    src: S + "alex-agreement-accepted.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [[33.5, 150, 110, 1.25]],
    cur: [
      [33.5, 396, 731],
      [34.6, 560, 640],
    ],
    ring: { box: [292, 703, 262, 38], a: 33.7, b: 34.95 },
  },
  {
    a: 34.95,
    b: 35.6,
    src: S + "alex-drawer.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [[34.95, 540, 290, 1.6]],
    cur: [
      [34.95, 1240, 860],
      [35.45, 1010, 690],
    ],
    clicks: [35.5],
  },
  {
    a: 35.6,
    b: 39.65,
    cut: true,
    typing: true,
    w: 1440,
    h: 900,
    url: APP,
    cam: [[35.6, 540, 290, 1.6]],
    cur: [
      [35.6, 1010, 690],
      [38.9, 1010, 690],
      [39.4, 1339, 811],
    ],
    clicks: [39.5],
  },
  {
    a: 39.65,
    b: 40.75,
    cut: true,
    src: S + "alex-drawer-shared.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [
      [39.65, 540, 290, 1.6],
      [40.05, 188, 117, 1.15],
    ],
    ring: { box: rectBox(R.newEntry), a: 40.0, b: 40.75 },
  },
  {
    a: 40.75,
    b: 41.4,
    cut: true,
    src: S + "alex-drawer-done.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [[40.75, 540, 0, 1.6]],
    cur: [
      [40.75, 1080, 300],
      [41.0, 956, 168],
    ],
    ring: { box: rectBox(R.statusSelect), a: 40.85, b: 41.4 },
  },
  {
    a: 41.4,
    b: 46.0,
    src: S + "prof-team.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [
      [41.4, 0, 0, 1],
      [42.8, 150, 150, 1.2],
    ],
    ring: { box: rectBox(R.alexRow), a: 43.1, b: 45.9 },
  },
  {
    a: 46.0,
    b: 51.0,
    src: S + "prof-overview-after-full.jpg",
    w: 1440,
    h: R.profAfterFullHeight,
    url: APP,
    cam: [
      [46.0, 0, 0, 1],
      [47.8, 150, 640, 1.25],
    ],
    ring: { box: rectBox(R.firstContribution), a: 48.3, b: 50.9 },
  },
];
function rectBox(r) {
  return [r.x, r.y, r.width, r.height];
}
const LONG_CAPS = [
  [4.7, 10.6, "It lives inside your Canvas course."],
  [11.3, 16.6, "Your Canvas roster, already there."],
  [17.5, 26.6, "See which teams need a hand, and why."],
  [27.4, 31.2, "Pip points students to their next step."],
  [31.6, 41.2, "Students log real evidence, not just checkboxes."],
  [41.7, 50.6, "Every contribution, recorded with who did it."],
];

const SHORT_SHOTS = [
  {
    a: 1.6,
    b: 4.1,
    src: S + "canvas-course.jpg",
    w: 1512,
    h: 791,
    url: CANVAS,
    cam: [
      [1.6, 0, 0, 1],
      [2.4, 0, 0, 1],
      [3.8, 0, 90, 1.35],
    ],
    cur: [
      [2.2, 1150, 760],
      [3.4, 140, 556],
      [4.1, 140, 556],
    ],
    clicks: [3.6],
    ring: { box: [96, 538, 150, 36], a: 3.5, b: 4.1 },
  },
  {
    a: 4.1,
    b: 6.6,
    cut: true,
    src: S + "canvas-teamtrack.jpg",
    w: 1512,
    h: 791,
    url: CANVAS,
    cam: [
      [4.1, 0, 90, 1.35],
      [4.4, 0, 90, 1.35],
      [5.2, 262, 60, 1.52],
    ],
    cur: [[4.1, 140, 556]],
    curOff: 4.5,
    ring: { box: [354, 288, 886, 58], a: 5.3, b: 6.6 },
  },
  {
    a: 6.6,
    b: 9.6,
    src: S + "prof-overview-full.jpg",
    w: 1440,
    h: R.profFullHeight,
    url: APP,
    cam: [
      [6.6, 0, 0, 1],
      [7.0, 0, 0, 1],
      [7.9, 250, 330, 1.3],
    ],
    cur: [
      [7.7, 1160, 940],
      [8.4, 800, 712],
    ],
    ring: { box: rectBox(R.profChips), a: 8.1, b: 9.6 },
  },
  {
    a: 9.6,
    b: 9.9,
    src: S + "alex-drawer.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [[9.6, 540, 290, 1.6]],
    cur: [
      [9.6, 1240, 860],
      [9.85, 1010, 690],
    ],
    clicks: [9.88],
  },
  {
    a: 9.9,
    b: 12.2,
    cut: true,
    typing: true,
    w: 1440,
    h: 900,
    url: APP,
    cam: [[9.9, 540, 290, 1.6]],
    cur: [
      [9.9, 1010, 690],
      [11.8, 1010, 690],
      [12.05, 1339, 811],
    ],
    clicks: [12.1],
  },
  {
    a: 12.2,
    b: 13.4,
    cut: true,
    src: S + "alex-drawer-shared.jpg",
    w: 1440,
    h: 900,
    url: APP,
    cam: [
      [12.2, 540, 290, 1.6],
      [12.55, 188, 117, 1.15],
    ],
    ring: { box: rectBox(R.newEntry), a: 12.5, b: 13.4 },
  },
  {
    a: 13.4,
    b: 16.3,
    src: S + "prof-overview-after-full.jpg",
    w: 1440,
    h: R.profAfterFullHeight,
    url: APP,
    cam: [
      [13.4, 150, 540, 1.25],
      [14.2, 150, 640, 1.25],
    ],
    ring: { box: rectBox(R.firstContribution), a: 14.0, b: 15.8 },
  },
];
const SHORT_CAPS = [
  [2.0, 6.5, "It lives inside your Canvas course."],
  [6.9, 9.5, "See which teams need a hand."],
  [9.9, 13.3, "Students log real evidence."],
  [13.6, 15.7, "Professors see who did what."],
];
const CUTS = {
  long: {
    shots: LONG_SHOTS,
    caps: LONG_CAPS,
    k1: [0.3, 1.95],
    k2: [2.0, 4.0],
    k2hl: [2.6, 3.1],
    k3: [51.5, 53.3],
    k4: [53.2, 55.0],
    k4hl: [53.8, 54.3],
    cardIn: 4.0,
    cardOut: 50.9,
    outro: 55.2,
    typing: [35.6, 0.1],
    pipStart: 28.0,
    tag: "Built for Canvas. Designed around people.",
  },
  short: {
    shots: SHORT_SHOTS,
    caps: SHORT_CAPS,
    k1: null,
    k2: [0.15, 1.9],
    k2hl: [0.6, 1.0],
    k3: null,
    k4: null,
    k4hl: [0, 0],
    cardIn: 1.5,
    cardOut: 15.7,
    outro: 16.0,
    typing: [9.9, 0.055],
    pipStart: 0,
    tag: "Built for Canvas. Never auto-grades.",
  },
};
const C = CUTS[window.CUT || "long"];
const SHOTS = C.shots,
  CAPS = C.caps;

// ---------- preload ----------
const urls = new Set();
SHOTS.forEach((s) => s.src && urls.add(s.src));
for (let i = 0; i < R.typingFrames; i++) urls.add(`${S}typing/${pad(i)}.jpg`);
for (let i = 0; i < 75; i++) urls.add(`${S}pip/${pad(i)}.png`);
window.ready = Promise.all([
  document.fonts.ready,
  ...[...urls].map((u) => {
    const im = new Image();
    im.src = u;
    return im.decode();
  }),
]).then(() => {
  const g = $("dots");
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      g.insertAdjacentHTML(
        "beforeend",
        `<circle cx="${6 + c * 12}" cy="${6 + r * 12}" r="2.4"/>`,
      );
  return true;
});

// ---------- render ----------
function setText(el, o, dy = 0, blur = 0, scale = 1) {
  el.style.opacity = o;
  el.style.transform = `translateY(${dy}px) scale(${scale})`;
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
}
/** Hera-style blur in / blur out. */
function kinetic(el, t, a, b, top) {
  const pin = out(seg(t, a, a + 0.6)),
    pout = io(seg(t, b - 0.4, b));
  el.style.top = top + "px";
  setText(
    el,
    pin * (1 - pout),
    (1 - pin) * 40 - pout * 30,
    (1 - pin) * 16 + pout * 14,
    0.96 + 0.04 * pin,
  );
}

function doodles(t) {
  const place = (id, x, y, extra = "") => {
    $(id).style.transform = `translate(${x}px, ${y}px) ${extra}`;
  };
  place("d-squig", 96, 120 + Math.sin(t * 1.3) * 8);
  place(
    "d-star",
    1730,
    110,
    `scale(${0.85 + 0.15 * Math.sin(t * 2.2)}) rotate(${Math.sin(t) * 12}deg)`,
  );
  place("d-star2", 170, 880, `scale(${0.8 + 0.2 * Math.sin(t * 2.6 + 1)})`);
  place("d-loop", 1690, 860 + Math.sin(t * 1.1) * 6);
  place("d-birds", 1440 + Math.sin(t * 0.5) * 30, 50 + Math.sin(t * 0.9) * 6);
  place("d-dots", 70, 520);
}

function currentShot(t) {
  return (
    SHOTS.find((s) => t >= s.a && t < s.b) ||
    (t >= C.cardOut ? SHOTS[SHOTS.length - 1] : SHOTS[0])
  );
}

window.render = function render(t) {
  doodles(t);

  // Hook and principle type.
  const kt = (id, w, top) =>
    w ? kinetic($(id), t, w[0], w[1], top) : ($(id).style.opacity = 0);
  kt("k1", C.k1, 400);
  kt("k2", C.k2, 400);
  $("k2a").style.setProperty("--hl", out(seg(t, C.k2hl[0], C.k2hl[1])));
  kt("k3", C.k3, 360);
  kt("k4", C.k4, 480);
  $("k4a").style.setProperty("--hl", out(seg(t, C.k4hl[0], C.k4hl[1] || 1)));

  // Product card: enters at 4s, leaves at 51s.
  const card = $("card"),
    cin = out(seg(t, C.cardIn, C.cardIn + 0.9)),
    cout = io(seg(t, C.cardOut, C.cardOut + 0.6));
  card.style.opacity = t < C.cardIn || t > C.cardOut + 0.6 ? 0 : 1 - cout;
  card.style.transform = `translateY(${(1 - cin) * 900 - cout * 60}px) rotate(${(1 - cin) * 5}deg) scale(${0.92 + 0.08 * cin - 0.08 * cout})`;

  const s = currentShot(t),
    i = SHOTS.indexOf(s),
    next = SHOTS[i + 1];
  const [cx, cy, cz] = kf(t, s.cam),
    b = 1344 / s.w,
    k = b * cz;
  const map = (x, y) => [(x - cx) * k, (y - cy) * k];
  $("url").textContent = s.url;

  // Screen image.
  const src = s.typing
    ? `${S}typing/${pad(Math.min(R.typingFrames - 1, Math.max(0, Math.floor((t - C.typing[0]) / C.typing[1]))))}.jpg`
    : s.src;
  const img = $("scrA");
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  img.style.width = s.w + "px";
  img.style.height = s.h + "px";
  img.style.transform = `translate(${-cx * k}px, ${-cy * k}px) scale(${k})`;
  $("scrB").style.display = "none";

  // Dip between non-cut shots: old content out, then new content in.
  let dip = 0;
  if (!s.cut && i > 0) dip = Math.max(dip, 1 - seg(t, s.a, s.a + 0.25));
  if (next && !next.cut) dip = Math.max(dip, seg(t, s.b - 0.25, s.b));
  $("dip").style.opacity = dip;

  // Pip clip on Alex's overview.
  const pip = $("pip");
  if (s.pip) {
    const f = Math.max(0, Math.min(74, Math.floor((t - C.pipStart) * 30)));
    const pimg = $("pipimg"),
      psrc = `${S}pip/${pad(f)}.png`;
    if (pimg.getAttribute("src") !== psrc) pimg.setAttribute("src", psrc);
    const c = R.alexPipClip,
      [px, py] = map(c.x, c.y);
    pip.style.display = "block";
    pip.style.width = c.width + "px";
    pip.style.height = "168px";
    pip.style.transform = `translate(${px}px, ${py}px) scale(${k})`;
  } else pip.style.display = "none";

  // Highlight ring.
  const ring = $("ring");
  if (s.ring) {
    const [x, y, w, h] = s.ring.box,
      [rx, ry] = map(x - 8, y - 8),
      o = win(t, s.ring.a, s.ring.b, 0.3),
      grow = 1 + (1 - out(seg(t, s.ring.a, s.ring.a + 0.4))) * 0.12,
      pulse = 1 + Math.sin((t - s.ring.a) * 5) * 0.012;
    ring.style.opacity = o;
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    ring.style.width = (w + 16) * k + "px";
    ring.style.height = (h + 16) * k + "px";
    ring.style.transform = `scale(${grow * pulse})`;
    ring.style.transformOrigin = "50% 50%";
  } else ring.style.opacity = 0;

  // Cursor and click ripple.
  const cur = $("cursor"),
    rip = $("ripple");
  rip.style.opacity = 0;
  if (s.cur && t >= s.cur[0][0] && !(s.curOff && t > s.curOff)) {
    const [ux, uy] = kf(t, s.cur),
      [vx, vy] = map(ux, uy);
    const appear = s.cut ? 1 : seg(t, s.cur[0][0], s.cur[0][0] + 0.25);
    let press = 1;
    for (const c of s.clicks || []) {
      press = Math.min(
        press,
        1 - 0.18 * Math.max(0, 1 - Math.abs(t - c) / 0.12),
      );
      const p = seg(t, c, c + 0.5);
      if (p > 0 && p < 1) {
        const r = 10 + out(p) * 34;
        rip.style.opacity = 1 - p;
        rip.style.left = vx - r + "px";
        rip.style.top = vy - r + "px";
        rip.style.width = rip.style.height = r * 2 + "px";
      }
    }
    cur.style.opacity = appear;
    cur.style.transform = `translate(${vx - 6}px, ${vy - 4}px) scale(${press})`;
  } else cur.style.opacity = 0;

  // Caption sticker.
  const cap = CAPS.find(([a, b]) => t >= a - 0.01 && t <= b);
  const ct = $("captext");
  if (cap) {
    const [a, b2, text] = cap;
    if (ct.textContent !== text) ct.textContent = text;
    const pin = out(seg(t, a, a + 0.45)),
      pout = io(seg(t, b2 - 0.3, b2));
    ct.style.opacity = pin * (1 - pout);
    ct.style.transform = `translateY(${(1 - pin) * 30 + pout * 16}px) rotate(${-1.2 * pin}deg)`;
    ct.style.filter =
      pin < 1 || pout > 0 ? `blur(${(1 - pin) * 10 + pout * 8}px)` : "none";
  } else ct.style.opacity = 0;

  // Outro.
  const O = C.outro,
    lp = seg(t, O, O + 0.7),
    logo = $("logo-tile"),
    ease = (a) => out(seg(t, O + a, O + a + 0.6));
  if ($("logo-tag").textContent !== C.tag) $("logo-tag").textContent = C.tag;
  $("logo-wrap").style.opacity = t < O ? 0 : 1;
  logo.style.transform = `scale(${back(lp)}) rotate(${-14 + 10 * out(lp)}deg)`;
  setText(
    $("logo-name"),
    ease(0.4),
    (1 - ease(0.4)) * 30,
    (1 - ease(0.4)) * 10,
  );
  setText($("logo-tag"), ease(0.8), (1 - ease(0.8)) * 24, (1 - ease(0.8)) * 8);
  setText(
    $("logo-url"),
    ease(1.3),
    (1 - ease(1.3)) * 20,
    0,
    0.9 + 0.1 * back(seg(t, O + 1.3, O + 1.9)),
  );
};
