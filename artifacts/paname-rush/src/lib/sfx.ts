let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
}

function tone({ freq, duration, type = "square", volume = 0.18, attack = 0.005, release = 0.04, freqEnd }: ToneOpts, when = 0) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + duration);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.linearRampToValueAtTime(volume, t + Math.max(attack, duration - release));
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playReady() {
  tone({ freq: 660, duration: 0.09, type: "triangle", volume: 0.2 }, 0);
  tone({ freq: 990, duration: 0.16, type: "triangle", volume: 0.2 }, 0.08);
}

export function playUnready() {
  tone({ freq: 440, duration: 0.09, type: "triangle", volume: 0.18 }, 0);
  tone({ freq: 280, duration: 0.14, type: "triangle", volume: 0.18 }, 0.08);
}

export function playTick() {
  tone({ freq: 880, duration: 0.07, type: "square", volume: 0.14, freqEnd: 700 }, 0);
}

export function playFinalTick() {
  tone({ freq: 1320, duration: 0.12, type: "square", volume: 0.22, freqEnd: 1100 }, 0);
}

export function playGo() {
  tone({ freq: 523, duration: 0.12, type: "sawtooth", volume: 0.22 }, 0);
  tone({ freq: 784, duration: 0.14, type: "sawtooth", volume: 0.22 }, 0.1);
  tone({ freq: 1046, duration: 0.28, type: "sawtooth", volume: 0.24 }, 0.22);
}

// ──────────────────────────────────────────────────────────────
// Cinematic SFX — "Suite" button click (bright UI tap)
// ──────────────────────────────────────────────────────────────
export function playCinematicClick() {
  tone({ freq: 740, duration: 0.06, type: "triangle", volume: 0.22, freqEnd: 1100 }, 0);
  tone({ freq: 1480, duration: 0.10, type: "sine", volume: 0.18, freqEnd: 1760 }, 0.04);
}

// ──────────────────────────────────────────────────────────────
// Cinematic background music — gentle adventure loop
// ──────────────────────────────────────────────────────────────
let cinematicMusic: {
  master: GainNode;
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  timeoutId: ReturnType<typeof setTimeout> | null;
} | null = null;

// Heroic D minor / F major progression (adventure feeling)
const ADVENTURE_BASS_NOTES = [
  146.83, 174.61, 220.00, 196.00,  // D3, F3, A3, G3
  146.83, 220.00, 174.61, 130.81,  // D3, A3, F3, C3
];

const ADVENTURE_LEAD_NOTES = [
  587.33, 698.46, 880.00, 783.99,  // D5, F5, A5, G5
  587.33, 880.00, 698.46, 523.25,  // D5, A5, F5, C5
];

const STEP_MS = 480; // tempo

function scheduleAdventureStep(stepIndex: number) {
  if (!cinematicMusic) return;
  const c = getCtx();
  if (!c) return;

  const i = stepIndex % ADVENTURE_BASS_NOTES.length;
  const bassFreq = ADVENTURE_BASS_NOTES[i];
  const leadFreq = ADVENTURE_LEAD_NOTES[i];
  const t = c.currentTime;
  const dur = STEP_MS / 1000;

  // Bass pluck (warm)
  const bassOsc = c.createOscillator();
  const bassGain = c.createGain();
  bassOsc.type = "triangle";
  bassOsc.frequency.setValueAtTime(bassFreq, t);
  bassGain.gain.setValueAtTime(0, t);
  bassGain.gain.linearRampToValueAtTime(0.08, t + 0.02);
  bassGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
  bassOsc.connect(bassGain).connect(cinematicMusic.master);
  bassOsc.start(t);
  bassOsc.stop(t + dur);

  // Lead arpeggio (bright, slightly delayed)
  const leadOsc = c.createOscillator();
  const leadGain = c.createGain();
  leadOsc.type = "sine";
  leadOsc.frequency.setValueAtTime(leadFreq, t + 0.05);
  leadGain.gain.setValueAtTime(0, t + 0.05);
  leadGain.gain.linearRampToValueAtTime(0.05, t + 0.09);
  leadGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
  leadOsc.connect(leadGain).connect(cinematicMusic.master);
  leadOsc.start(t + 0.05);
  leadOsc.stop(t + dur);

  // Schedule next step
  cinematicMusic.timeoutId = setTimeout(() => scheduleAdventureStep(stepIndex + 1), STEP_MS);
}

export function startCinematicMusic() {
  if (cinematicMusic) return; // already playing
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  // Master with gentle fade-in + slow LFO tremolo for "epic" breathing
  const master = c.createGain();
  master.gain.setValueAtTime(0, c.currentTime);
  master.gain.linearRampToValueAtTime(0.55, c.currentTime + 1.2);
  master.connect(c.destination);

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.3;
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();

  cinematicMusic = { master, oscs: [], lfo, timeoutId: null };
  scheduleAdventureStep(0);
}

export function stopCinematicMusic() {
  if (!cinematicMusic) return;
  const c = getCtx();
  if (!c) {
    cinematicMusic = null;
    return;
  }
  const m = cinematicMusic;
  cinematicMusic = null;
  if (m.timeoutId) clearTimeout(m.timeoutId);
  // Fade out then disconnect
  const t = c.currentTime;
  m.master.gain.cancelScheduledValues(t);
  m.master.gain.setValueAtTime(m.master.gain.value, t);
  m.master.gain.linearRampToValueAtTime(0, t + 0.5);
  setTimeout(() => {
    try { m.lfo.stop(); } catch { /* noop */ }
    try { m.master.disconnect(); } catch { /* noop */ }
  }, 600);
}
