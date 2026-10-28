// Original soundtrack + in-key sound effects for the demo video (no samples).
// D major, 96 BPM, I–vi–IV–V. Writes work/music.wav (44.1 kHz stereo).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CUT = process.env.CUT || "long";
const SR = 44100,
  DUR = { long: 60, short: 19, v2: 20, v3: 14.5 }[CUT],
  N = SR * DUR,
  BEAT = 60 / 96,
  BAR = BEAT * 4;
const L = new Float32Array(N),
  Rt = new Float32Array(N);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
function add(i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - Math.max(0, pan));
  Rt[i] += v * (1 + Math.min(0, pan));
}

// Sections: intro (bars 0–1), groove (2–19), breakdown (20–21), outro (22–23).
const CHORDS = [
  [50, 54, 57, 62], // D
  [47, 50, 54, 59], // Bm
  [43, 47, 50, 55], // G
  [45, 49, 52, 57], // A
];
const BASS = [38, 47, 43, 45];
// Short cut: hook on pads (bar 0), groove bars 1-5, outro bars 6-7.
const BARS = CUT === "long" ? 24 : 8;
const groove = (bar) =>
  CUT === "long"
    ? (bar >= 2 && bar <= 19) || bar >= 22
    : CUT === "v3" || bar >= 1;
const breakdown = (bar) => CUT === "long" && bar >= 20 && bar <= 21;

for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * BAR,
    ch = CHORDS[bar % 4];
  // Pad: soft additive voices with slow attack and overlap into the next bar.
  ch.forEach((m, v) => {
    const f = hz(m),
      pan = (v % 2 ? 0.35 : -0.35) * (v / 3);
    const s0 = Math.floor(t0 * SR),
      len = Math.floor((BAR + 0.5) * SR);
    for (let k = 0; k < len; k++) {
      const t = k / SR,
        env = Math.min(1, t / 0.45) * Math.min(1, (BAR + 0.5 - t) / 0.5);
      const x =
        Math.sin(2 * Math.PI * f * t) +
        0.6 * Math.sin(2 * Math.PI * f * 1.004 * t) +
        0.25 * Math.sin(2 * Math.PI * 2 * f * t) +
        0.08 * Math.sin(2 * Math.PI * 3 * f * t);
      add(s0 + k, x * env * 0.026, pan);
    }
  });
  // Pluck arpeggio in 8ths (from bar 1), echoed to the opposite side.
  if (bar >= 1 || CUT === "short") {
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    pattern.forEach((idx, e) => {
      const f = hz(ch[idx] + 12),
        s0 = Math.floor((t0 + (e * BEAT) / 2) * SR),
        amp = breakdown(bar) ? 0.05 : 0.065;
      for (let k = 0; k < SR * 0.6; k++) {
        const t = k / SR,
          env = Math.exp(-t / 0.16);
        const x =
          (Math.sin(2 * Math.PI * f * t) +
            0.35 * Math.sin(4 * Math.PI * f * t)) *
          env *
          amp;
        add(s0 + k, x, -0.2);
        add(s0 + k + Math.floor(SR * BEAT * 0.75), x * 0.32, 0.5);
      }
    });
  }
  if (!groove(bar)) continue;
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    // Kick on 1 and 3.
    if (b % 2 === 0) {
      const s0 = Math.floor(tb * SR);
      let ph = 0;
      for (let k = 0; k < SR * 0.35; k++) {
        const t = k / SR,
          f = 48 + 70 * Math.exp(-t / 0.04);
        ph += (2 * Math.PI * f) / SR;
        add(s0 + k, Math.sin(ph) * Math.exp(-t / 0.13) * 0.42);
      }
    } else {
      // Soft clap on 2 and 4.
      const s0 = Math.floor(tb * SR);
      let prev = 0;
      for (let k = 0; k < SR * 0.18; k++) {
        const t = k / SR,
          n = rnd(),
          hp = n - prev;
        prev = n;
        add(s0 + k, hp * Math.exp(-t / 0.05) * 0.05, 0.1);
      }
    }
    // Hats on the off-beat 8ths.
    {
      const s0 = Math.floor((tb + BEAT / 2) * SR);
      let prev = 0;
      for (let k = 0; k < SR * 0.05; k++) {
        const n = rnd(),
          hp = n - prev;
        prev = n;
        add(s0 + k, hp * Math.exp(-k / SR / 0.012) * 0.03, 0.3);
      }
    }
    // Bass: root on each beat, gently saturated.
    {
      const f = hz(BASS[bar % 4]),
        s0 = Math.floor(tb * SR);
      for (let k = 0; k < SR * BEAT; k++) {
        const t = k / SR,
          env = Math.min(1, t / 0.01) * Math.exp(-t / 0.3);
        const x = Math.tanh(
          1.6 *
            (Math.sin(2 * Math.PI * f * t) +
              0.3 * Math.sin(4 * Math.PI * f * t)),
        );
        add(s0 + k, x * env * 0.12);
      }
    }
  }
}

// ---------- sound effects, in key and mixed under the music ----------
function whoosh(at, amp = 0.09, dur = 0.65) {
  const s0 = Math.floor((at - dur / 2) * SR);
  let lp = 0;
  for (let k = 0; k < SR * dur; k++) {
    const p = k / (SR * dur),
      cut = 300 + 3200 * Math.sin(Math.PI * p),
      a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += a * (rnd() - lp);
    add(s0 + k, lp * Math.sin(Math.PI * p) * amp, -0.6 + 1.2 * p);
  }
}
function click(at) {
  const s0 = Math.floor(at * SR);
  for (let k = 0; k < SR * 0.09; k++) {
    const t = k / SR,
      env = Math.exp(-t / 0.018);
    add(
      s0 + k,
      (Math.sin(2 * Math.PI * hz(81) * t) +
        0.5 * Math.sin(2 * Math.PI * hz(88) * t)) *
        env *
        0.1,
    );
  }
}
function chime(at) {
  [86, 90, 93].forEach((m, i) => {
    const s0 = Math.floor((at + i * 0.045) * SR);
    for (let k = 0; k < SR * 1.0; k++) {
      const t = k / SR,
        env = Math.exp(-t / 0.28);
      add(
        s0 + k,
        (Math.sin(2 * Math.PI * hz(m) * t) +
          0.2 * Math.sin(2 * Math.PI * 2.76 * hz(m) * t)) *
          env *
          0.045,
        (i - 1) * 0.4,
      );
    }
  });
}
function tick(at, pan) {
  const s0 = Math.floor(at * SR);
  let prev = 0;
  for (let k = 0; k < SR * 0.012; k++) {
    const n = rnd(),
      hp = n - prev;
    prev = n;
    add(s0 + k, hp * Math.exp(-k / SR / 0.003) * 0.05, pan);
  }
}

const CUES = {
  long: {
    soft: [0.3, 2.0],
    whoosh: [3.95, 16.85, 27.0, 31.4, 41.4, 50.95, 55.15],
    click: [8.2, 29.0, 33.3, 35.5, 39.5],
    chime: [33.55, 39.75, 40.85, 55.35],
    typing: [35.62, 39.2],
  },
  short: {
    soft: [0.15],
    whoosh: [1.5, 6.6, 9.6, 13.4, 15.9],
    click: [3.6, 9.88, 12.1],
    chime: [12.25, 16.1],
    typing: [9.92, 11.85],
  },
  v3: {
    soft: [0.05],
    whoosh: [0.7, 4.15, 7.0, 10.0, 12.45],
    click: [1.75, 3.62, 4.08, 6.9],
    chime: [12.7],
    typing: [0, 0],
  },
  v2: {
    soft: [0.15, 1.25],
    whoosh: [2.15, 7.75, 12.75, 17.5],
    click: [4.05, 6.75, 7.6, 12.65],
    chime: [17.85],
    typing: [0, 0],
  },
}[CUT];
CUES.soft.forEach((t) => whoosh(t, 0.06, 0.5));
CUES.whoosh.forEach((t) => whoosh(t));
CUES.click.forEach(click);
CUES.chime.forEach(chime);
for (
  let t = CUES.typing[0];
  t < CUES.typing[1];
  t += 0.06 + Math.abs(rnd()) * 0.04
)
  tick(t, rnd() * 0.4);

// ---------- master ----------
const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write("WAVEfmt ", 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR,
    fade = Math.min(1, t / 0.3) * Math.min(1, (DUR - t) / 2.2);
  const l = Math.tanh(L[i] * 1.15) * fade,
    r = Math.tanh(Rt[i] * 1.15) * fade;
  out.writeInt16LE(Math.round(l * 32000), 44 + i * 4);
  out.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
}
writeFileSync(
  fileURLToPath(
    new URL(
      `./work/music${CUT === "long" ? "" : "-" + CUT}.wav`,
      import.meta.url,
    ),
  ),
  out,
);
console.log("music.wav written");
