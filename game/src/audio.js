// audio.js — procedural WebAudio sound effects, no audio files.
// Every sound is a few oscillators / noise bursts built at call time.
// The context is created lazily on the first user gesture (browsers block
// audio before interaction); calls before that are silent no-ops.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch (err) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq || 1800;
    const gain = c.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    // Soft footstep while moving: a short low rustle, quieter and lower
    // while sneaking — the sound the noise radius promises.
    step(sneaking) {
      noiseBurst(0.08, sneaking ? 0.03 : 0.06, sneaking ? 300 : 420);
    },
    // Soft bell chime when an orb is collected.
    orb() {
      tone(880, 0.35, "sine", 0.14, 0);
      tone(1318, 0.5, "sine", 0.1, 0.07);
    },
    // Metallic clank when a thrown pebble lands.
    clank() {
      noiseBurst(0.12, 0.25, 2400);
      tone(620, 0.18, "triangle", 0.12, 0, 320);
    },
    // Rising two-note alarm as suspicion grows.
    suspicious() {
      tone(440, 0.16, "square", 0.05, 0, 660);
    },
    // Low drum + harsh buzz when a chase starts.
    chase() {
      tone(98, 0.4, "sine", 0.28, 0, 55);
      tone(220, 0.3, "sawtooth", 0.06, 0, 110);
    },
    // Gentle arpeggio for a level clear / victory.
    victory() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.45, "sine", 0.12, i * 0.12));
    },
    // Dull thud when the fox is caught.
    caught() {
      tone(160, 0.5, "sine", 0.25, 0, 60);
      noiseBurst(0.25, 0.15, 300);
    },
    // Short UI click.
    click() {
      tone(700, 0.07, "sine", 0.08, 0);
    },
  };
}
