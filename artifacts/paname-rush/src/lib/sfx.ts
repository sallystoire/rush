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
