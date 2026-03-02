let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function isMuted(): boolean { return muted; }
export function toggleMute(): void { muted = !muted; }

function play(
  freq: number,
  type: OscillatorType,
  duration: number,
  attack: number,
  decay: number,
  volume: number,
  freqEnd?: number,
): void {
  if (muted) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + duration);
  }
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + attack + decay);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration + 0.01);
}

export function sfxArrow():     void { play(440, 'sawtooth', 0.08, 0.005, 0.07, 0.08); }
export function sfxCannon():    void { play(80,  'sawtooth', 0.20, 0.01,  0.18, 0.22, 40); }
export function sfxIce():       void { play(600, 'sine',     0.15, 0.01,  0.12, 0.10, 900); }
export function sfxFire():      void { play(180, 'sawtooth', 0.12, 0.01,  0.10, 0.16, 120); }
export function sfxSniper():    void { play(900, 'square',   0.06, 0.002, 0.05, 0.09, 600); }
export function sfxLightning(): void { play(220, 'square',   0.10, 0.003, 0.09, 0.14, 880); }
export function sfxEnemyDie():  void { play(160, 'sawtooth', 0.15, 0.005, 0.13, 0.12, 60); }
export function sfxLifeLost():  void { play(120, 'sawtooth', 0.35, 0.01,  0.32, 0.20, 60); }
export function sfxWaveStart(): void { play(440, 'sine',     0.25, 0.02,  0.20, 0.14, 550); }
export function sfxVictory():   void {
  play(440, 'sine', 0.12, 0.01, 0.10, 0.15);
  setTimeout(() => play(550, 'sine', 0.12, 0.01, 0.10, 0.15), 120);
  setTimeout(() => play(660, 'sine', 0.20, 0.01, 0.18, 0.15), 240);
}
export function sfxDefeat():    void { play(200, 'sawtooth', 0.50, 0.02,  0.46, 0.18, 80); }
