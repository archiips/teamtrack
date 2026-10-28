// TeamTrack 20s pitch video (violet design). render(t) is a pure function of time.
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
const win = (t, a, b, f = 0.3) =>
  Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));
const center = (r) => [r.x + r.width / 2, r.y + r.height / 2];
const box = (r) => [r.x, r.y, r.width, r.height];

const S = "work/v2/shots/";
const pad = (n) => String(n).padStart(3, "0");
const URL_TEXT = "teamtrack-kappa.vercel.app";
const T = {
  k1: [0.15, 1.35],
  k2: [1.25, 2.5],
  k2hl: [1.75, 2.15],
  cardIn: 2.2,
  cardOut: 17.4,
  outro: 17.7,
  teamStart: 12.75,
  tag: "Clear tasks. Fair teams.",
};
const [mineX, mineY] = center(R.tabMine),
  [allX, allY] = center(R.tabAll),
  [boardX, boardY] = center(R.boardButton),
  [teamX, teamY] = center(R.navTeam);

const SHOTS = [
  {
    a: 2.2,
    b: 4.3,
    src: S + "tasks-all.jpg",
    cam: [
      [2.2, 0, 0, 1],
      [3.0, 0, 0, 1],
      [3.9, 240, 150, 1.2],
    ],
    cur: [
      [2.9, 1150, 760],
      [3.9, mineX, mineY],
    ],
    clicks: [4.05],
    ring: { box: box(R.tabMine), a: 3.85, b: 4.3 },
  },
  {
    a: 4.3,
    b: 6.95,
    cut: true,
    src: S + "tasks-mine.jpg",
    cam: [[4.3, 240, 150, 1.2]],
    cur: [
      [4.3, mineX, mineY],
      [5.0, 760, 640],
      [6.0, 760, 640],
      [6.6, allX, allY],
    ],
    clicks: [6.75],
    ring: { box: box(R.myOpenTask), a: 4.6, b: 6.4 },
  },
  {
    a: 6.95,
    b: 7.75,
    cut: true,
    src: S + "tasks-all.jpg",
    cam: [[6.95, 240, 150, 1.2]],
    cur: [
      [6.95, allX, allY],
      [7.45, boardX, boardY],
    ],
    clicks: [7.6],
  },
  {
    a: 7.75,
    b: 12.75,
    cut: true,
    src: S + "board.jpg",
    cam: [
      [7.75, 240, 150, 1.2],
      [9.0, 388, 338, 1.6],
      [11.6, 388, 338, 1.6],
      [12.2, 0, 0, 1],
    ],
    cur: [
      [7.75, boardX, boardY],
      [8.2, 1100, 760],
      [11.9, 760, 560],
      [12.5, teamX, teamY],
    ],
    clicks: [12.65],
    ring: { box: box(R.jordanCard), a: 9.3, b: 11.7 },
  },
  {
    a: 12.75,
    b: 17.4,
    cut: true,
    team: true,
    cam: [
      [12.75, 0, 0, 1],
      [13.6, 0, 0, 1],
      [14.8, 0, 175, 1.25],
    ],
    cur: [
      [12.75, teamX, teamY],
      [13.2, 520, 820],
    ],
    curOff: 13.4,
    ring: { box: box(R.breakdown), a: 15.2, b: 17.3 },
  },
];
const CAPS = [
  [2.7, 6.9, "Know exactly what’s yours."],
  [7.4, 12.3, "See what teammates are working on."],
  [13.1, 17.2, "Everyone’s contribution, side by side."],
];

// ---------- preload ----------
const urls = new Set(SHOTS.filter((s) => s.src).map((s) => s.src));
for (let i = 1; i < R.teamFrames; i++) urls.add(`${S}team/${pad(i)}.jpg`);
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
  $("logo-tag").textContent = T.tag;
  ["k3", "k4"].forEach((id) => ($(id).style.opacity = 0));
  $("url").textContent = URL_TEXT;
  return true;
});

// ---------- render ----------
function setText(el, o, dy = 0, blur = 0, scale = 1) {
  el.style.opacity = o;
  el.style.transform = `translateY(${dy}px) scale(${scale})`;
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
}
function kinetic(el, t, [a, b], top) {
  const pin = out(seg(t, a, a + 0.5)),
    pout = io(seg(t, b - 0.35, b));
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
  const place = (id, x, y, extra = "") =>
    ($(id).style.transform = `translate(${x}px, ${y}px) ${extra}`);
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
const shotAt = (t) =>
  SHOTS.find((s) => t >= s.a && t < s.b) ||
  (t >= SHOTS[SHOTS.length - 1].b ? SHOTS[SHOTS.length - 1] : SHOTS[0]);

window.render = function render(t) {
  doodles(t);
  kinetic($("k1"), t, T.k1, 400);
  kinetic($("k2"), t, T.k2, 400);
  $("k2a").style.setProperty("--hl", out(seg(t, T.k2hl[0], T.k2hl[1])));

  const card = $("card"),
    cin = out(seg(t, T.cardIn, T.cardIn + 0.9)),
    cout = io(seg(t, T.cardOut, T.cardOut + 0.6));
  card.style.opacity = t < T.cardIn || t > T.cardOut + 0.6 ? 0 : 1 - cout;
  card.style.transform = `translateY(${(1 - cin) * 900 - cout * 60}px) rotate(${(1 - cin) * 5}deg) scale(${0.92 + 0.08 * cin - 0.08 * cout})`;

  const s = shotAt(t),
    [cx, cy, cz] = kf(t, s.cam),
    k = (1344 / 1440) * cz,
    map = (x, y) => [(x - cx) * k, (y - cy) * k];
  const src = s.team
    ? `${S}team/${pad(Math.min(R.teamFrames - 1, Math.max(1, 1 + Math.floor((t - T.teamStart) * 30))))}.jpg`
    : s.src;
  const img = $("scrA");
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  img.style.width = "1440px";
  img.style.height = "900px";
  img.style.transform = `translate(${-cx * k}px, ${-cy * k}px) scale(${k})`;
  $("scrB").style.display = "none";
  $("pip").style.display = "none";
  $("dip").style.opacity = 0;

  const ring = $("ring");
  if (s.ring) {
    const [x, y, w, h] = s.ring.box,
      [rx, ry] = map(x - 8, y - 8),
      grow = 1 + (1 - out(seg(t, s.ring.a, s.ring.a + 0.4))) * 0.12,
      pulse = 1 + Math.sin((t - s.ring.a) * 5) * 0.012;
    ring.style.opacity = win(t, s.ring.a, s.ring.b);
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    ring.style.width = (w + 16) * k + "px";
    ring.style.height = (h + 16) * k + "px";
    ring.style.transformOrigin = "50% 50%";
    ring.style.transform = `scale(${grow * pulse})`;
  } else ring.style.opacity = 0;

  const cur = $("cursor"),
    rip = $("ripple");
  rip.style.opacity = 0;
  if (s.cur && t >= s.cur[0][0] && !(s.curOff && t > s.curOff)) {
    const [ux, uy] = kf(t, s.cur),
      [vx, vy] = map(ux, uy);
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
    cur.style.opacity = s.cut ? 1 : seg(t, s.cur[0][0], s.cur[0][0] + 0.25);
    cur.style.transform = `translate(${vx - 6}px, ${vy - 4}px) scale(${press})`;
  } else cur.style.opacity = 0;

  const cap = CAPS.find(([a, b]) => t >= a - 0.01 && t <= b),
    ct = $("captext");
  if (cap) {
    const [a, b, text] = cap;
    if (ct.textContent !== text) ct.textContent = text;
    const pin = out(seg(t, a, a + 0.45)),
      pout = io(seg(t, b - 0.3, b));
    ct.style.opacity = pin * (1 - pout);
    ct.style.transform = `translateY(${(1 - pin) * 30 + pout * 16}px) rotate(${-1.2 * pin}deg)`;
    ct.style.filter =
      pin < 1 || pout > 0 ? `blur(${(1 - pin) * 10 + pout * 8}px)` : "none";
  } else ct.style.opacity = 0;

  const O = T.outro,
    lp = seg(t, O, O + 0.7),
    ease = (a) => out(seg(t, O + a, O + a + 0.6));
  $("logo-wrap").style.opacity = t < O ? 0 : 1;
  $("logo-tile").style.transform =
    `scale(${back(lp)}) rotate(${-14 + 10 * out(lp)}deg)`;
  setText(
    $("logo-name"),
    ease(0.35),
    (1 - ease(0.35)) * 30,
    (1 - ease(0.35)) * 10,
  );
  setText($("logo-tag"), ease(0.7), (1 - ease(0.7)) * 24, (1 - ease(0.7)) * 8);
  setText(
    $("logo-url"),
    ease(1.05),
    (1 - ease(1.05)) * 20,
    0,
    0.9 + 0.1 * back(seg(t, O + 1.05, O + 1.65)),
  );
};
