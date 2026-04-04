// Web Audio API sound effects - no external files needed

const SOUND_ENABLED_KEY = "notification_sounds_enabled";

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // Storage not available
  }
}

const audioCtx = () => {
  if (!(window as any).__audioCtx) {
    (window as any).__audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return (window as any).__audioCtx as AudioContext;
};

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not supported
  }
}

export function playSuccess() {
  const ctx = audioCtx();
  // Two-note ascending chime
  playTone(523.25, 0.15, "sine", 0.12); // C5
  setTimeout(() => playTone(659.25, 0.25, "sine", 0.12), 100); // E5
}

export function playError() {
  // Low descending buzz
  playTone(330, 0.12, "square", 0.08); // E4
  setTimeout(() => playTone(262, 0.2, "square", 0.08), 100); // C4
}

export function playWarning() {
  // Single mid-pitch alert
  playTone(440, 0.18, "triangle", 0.1); // A4
  setTimeout(() => playTone(440, 0.18, "triangle", 0.1), 200);
}

export function playNotification() {
  // Gentle single ding
  playTone(880, 0.2, "sine", 0.08); // A5
}

export function playDelete() {
  // Soft whoosh-down
  playTone(600, 0.08, "sine", 0.1);
  setTimeout(() => playTone(400, 0.08, "sine", 0.08), 60);
  setTimeout(() => playTone(250, 0.15, "sine", 0.06), 120);
}

export function playClick() {
  playTone(1000, 0.05, "sine", 0.06);
}
