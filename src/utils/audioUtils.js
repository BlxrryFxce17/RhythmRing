/**
 * audioUtils.js — Web Audio API sound synthesis for RhythmRing
 * Generates beat/melody/vocal/texture sounds without any audio files.
 * Uses a single shared AudioContext to minimise memory usage.
 */

let _audioCtx = null;

/** Get or create the shared AudioContext (lazy) */
export function getAudioContext() {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === "suspended") {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/** Close the shared AudioContext (call on unmount if desired) */
export function closeAudioContext() {
  if (_audioCtx && _audioCtx.state !== "closed") {
    _audioCtx.close();
    _audioCtx = null;
  }
}

/* ─── Sound Generators ──────────────────────────────────── */

/**
 * Percussive kick / snap sound
 */
export function generateBeat(ctx, startTime = 0, variant = 0) {
  const t = ctx.currentTime + startTime;

  // Oscillator for body
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150 - variant * 20, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  oscGain.gain.setValueAtTime(0.8, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);

  // Noise burst for click
  const bufferSize = ctx.sampleRate * 0.05;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.06);

  return 0.3; // duration in seconds
}

/**
 * Tonal synth note
 */
export function generateMelody(ctx, startTime = 0, noteFreq = 440) {
  const t = ctx.currentTime + startTime;
  const duration = 0.6;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(noteFreq, t);

  // Slight vibrato
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 5;
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start(t);
  lfo.stop(t + duration);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
  gain.gain.setValueAtTime(0.5, t + duration - 0.15);
  gain.gain.linearRampToValueAtTime(0, t + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);

  return duration;
}

/**
 * Vocal-like formant buzz
 */
export function generateVocal(ctx, startTime = 0, pitch = 220) {
  const t = ctx.currentTime + startTime;
  const duration = 0.5;

  // Sawtooth for vocal formant
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(pitch, t);

  // Bandpass filter to shape formant
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, t);
  filter.Q.value = 5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
  gain.gain.setValueAtTime(0.35, t + duration - 0.1);
  gain.gain.linearRampToValueAtTime(0, t + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);

  return duration;
}

/**
 * Ambient noise texture
 */
export function generateTexture(ctx, startTime = 0) {
  const t = ctx.currentTime + startTime;
  const duration = 1.0;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Filtered noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, t);
  filter.frequency.linearRampToValueAtTime(1200, t + duration / 2);
  filter.frequency.linearRampToValueAtTime(400, t + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
  gain.gain.setValueAtTime(0.3, t + duration - 0.2);
  gain.gain.linearRampToValueAtTime(0, t + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
  source.stop(t + duration);

  return duration;
}

/* ─── Playback Helpers ──────────────────────────────────── */

const NOTE_MAP = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25,
};

/**
 * Play a single snippet based on its role.
 * Returns the duration of the sound.
 */
export function playSnippet(ctx, snippet, startTime = 0) {
  const freq = NOTE_MAP[snippet.note] || 440;
  switch (snippet.role) {
    case "beat":
      return generateBeat(ctx, startTime, snippet.variant || 0);
    case "melody":
      return generateMelody(ctx, startTime, freq);
    case "vocal":
      return generateVocal(ctx, startTime, freq / 2);
    case "texture":
      return generateTexture(ctx, startTime);
    default:
      return generateBeat(ctx, startTime);
  }
}

/**
 * Play all snippets layered as a "track".
 * Beat-role snippets play as a rhythmic pattern; others layer on top.
 */
export function playAllSnippets(ctx, snippets) {
  let maxDuration = 0;

  // Separate by role
  const beats = snippets.filter((s) => s.role === "beat");
  const others = snippets.filter((s) => s.role !== "beat");

  // Play beats as a rhythmic sequence
  beats.forEach((s, i) => {
    const t = i * 0.35;
    const dur = playSnippet(ctx, s, t);
    maxDuration = Math.max(maxDuration, t + dur);
  });

  // Layer melodic / vocal / texture with slight offsets
  others.forEach((s, i) => {
    const t = 0.1 + i * 0.5;
    const dur = playSnippet(ctx, s, t);
    maxDuration = Math.max(maxDuration, t + dur);
  });

  return maxDuration;
}

/* ─── Example Snippet Data ──────────────────────────────── */

export const EXAMPLE_RINGS = [
  {
    id: 1,
    name: "Midnight Groove",
    sounds: 5,
    genre: "Lo-Fi",
    tags: ["beat", "melody"],
    creator: "Akash",
    snippets: [
      { id: 101, role: "beat", description: "Soft desk tap", user: "Akash", note: "C4", variant: 0 },
      { id: 102, role: "beat", description: "Pen click rhythm", user: "Priya", note: "D4", variant: 1 },
      { id: 103, role: "melody", description: "Low-fi hum", user: "Sarah", note: "E4" },
      { id: 104, role: "texture", description: "Rain ambience", user: "James", note: "G4" },
      { id: 105, role: "melody", description: "Gentle whistle", user: "Ravi", note: "A4" },
    ],
  },
  {
    id: 2,
    name: "Urban Echoes",
    sounds: 4,
    genre: "Hip Hop",
    tags: ["vocal", "beat"],
    creator: "Priya",
    snippets: [
      { id: 201, role: "beat", description: "Chest thump kick", user: "Priya", note: "C4", variant: 0 },
      { id: 202, role: "beat", description: "Finger snap groove", user: "Akash", note: "D4", variant: 2 },
      { id: 203, role: "vocal", description: "Beatbox hihat", user: "DJ Leo", note: "G4" },
      { id: 204, role: "vocal", description: "Bass vocal drop", user: "Meera", note: "C4" },
    ],
  },
  {
    id: 3,
    name: "Synth Wave",
    sounds: 5,
    genre: "Electronic",
    tags: ["melody", "texture"],
    creator: "Sarah",
    snippets: [
      { id: 301, role: "melody", description: "Bright synth lead", user: "Sarah", note: "C5" },
      { id: 302, role: "melody", description: "Arpeggiated pad", user: "Akash", note: "E4" },
      { id: 303, role: "texture", description: "White noise swell", user: "James", note: "G4" },
      { id: 304, role: "beat", description: "808 sub kick", user: "Priya", note: "C4", variant: 0 },
      { id: 305, role: "texture", description: "Vinyl crackle", user: "Ravi", note: "A4" },
    ],
  },
  {
    id: 4,
    name: "Kitchen Jam",
    sounds: 4,
    genre: "Experimental",
    tags: ["beat", "texture"],
    creator: "James",
    snippets: [
      { id: 401, role: "beat", description: "Spoon on glass", user: "James", note: "F4", variant: 1 },
      { id: 402, role: "beat", description: "Cutting board chop", user: "Meera", note: "C4", variant: 2 },
      { id: 403, role: "texture", description: "Water boil fizz", user: "Sarah", note: "A4" },
      { id: 404, role: "melody", description: "Pot lid ring", user: "Akash", note: "B4" },
    ],
  },
];
