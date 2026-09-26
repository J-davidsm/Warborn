// Procedural retro audio for Warborn using zzfx-style parameter presets.
// Sounds are generated once, kept in memory, then played through WebAudio.
(function () {
  const SAMPLE_RATE = 44100;
  const MUSIC_SRC = 'assets/audio/evil-march.mp3';

  const ATTACK_PRESETS = {
    Soldier: { wave: 'square', volume: 0.42, frequency: 190, attack: 0.004, decay: 0.055, sustain: 0.025, release: 0.08, slide: -720, noise: 0.08, bitcrush: 3 },
    Spearman: { wave: 'saw', volume: 0.40, frequency: 240, attack: 0.003, decay: 0.045, sustain: 0.02, release: 0.075, slide: -1080, noise: 0.04, bitcrush: 2 },
    Archer: { wave: 'triangle', volume: 0.36, frequency: 710, attack: 0.002, decay: 0.05, sustain: 0.015, release: 0.09, slide: -1450, noise: 0.025, tremolo: 42 },
    Swordsman: { wave: 'square', volume: 0.46, frequency: 155, attack: 0.005, decay: 0.06, sustain: 0.035, release: 0.095, slide: -620, noise: 0.12, bitcrush: 4 },
    Assassin: { wave: 'triangle', volume: 0.34, frequency: 980, attack: 0.001, decay: 0.035, sustain: 0.012, release: 0.06, slide: -2300, noise: 0.06, tremolo: 75 },
    Knight: { wave: 'square', volume: 0.52, frequency: 120, attack: 0.006, decay: 0.07, sustain: 0.04, release: 0.11, slide: -360, noise: 0.05, bitcrush: 2 },
    Catapult: { wave: 'saw', volume: 0.55, frequency: 92, attack: 0.01, decay: 0.10, sustain: 0.055, release: 0.18, slide: -260, noise: 0.26, bitcrush: 5 },
    Dragon: { wave: 'saw', volume: 0.56, frequency: 72, attack: 0.02, decay: 0.18, sustain: 0.10, release: 0.28, slide: -80, noise: 0.20, tremolo: 18 },
    Cleric: { wave: 'sine', volume: 0.34, frequency: 560, attack: 0.02, decay: 0.08, sustain: 0.08, release: 0.16, slide: 340, noise: 0.0, tremolo: 9 },
    Stockade: { wave: 'square', volume: 0.42, frequency: 112, attack: 0.006, decay: 0.08, sustain: 0.05, release: 0.12, slide: -180, noise: 0.20, bitcrush: 5 },
    Fortress: { wave: 'square', volume: 0.46, frequency: 96, attack: 0.008, decay: 0.09, sustain: 0.06, release: 0.16, slide: -130, noise: 0.18, bitcrush: 4 },
    Castle: { wave: 'square', volume: 0.47, frequency: 100, attack: 0.008, decay: 0.10, sustain: 0.06, release: 0.17, slide: -150, noise: 0.16, bitcrush: 4 },
    'Heavy Fortress': { wave: 'saw', volume: 0.52, frequency: 82, attack: 0.01, decay: 0.12, sustain: 0.08, release: 0.20, slide: -90, noise: 0.24, bitcrush: 5 },
    Sloop: { wave: 'triangle', volume: 0.36, frequency: 310, attack: 0.004, decay: 0.055, sustain: 0.025, release: 0.09, slide: -640, noise: 0.08, tremolo: 26 },
    'Man-of-War': { wave: 'saw', volume: 0.45, frequency: 132, attack: 0.008, decay: 0.08, sustain: 0.045, release: 0.13, slide: -340, noise: 0.18, bitcrush: 3 },
    Battleship: { wave: 'saw', volume: 0.54, frequency: 76, attack: 0.012, decay: 0.13, sustain: 0.065, release: 0.22, slide: -170, noise: 0.28, bitcrush: 5 },
    default: { wave: 'square', volume: 0.38, frequency: 180, attack: 0.004, decay: 0.055, sustain: 0.025, release: 0.09, slide: -500, noise: 0.08, bitcrush: 3 }
  };

  const EFFECT_PRESETS = {
    move: { wave: 'triangle', volume: 0.25, frequency: 105, attack: 0.004, decay: 0.045, sustain: 0.025, release: 0.06, slide: -80, noise: 0.10, bitcrush: 3 },
    rankUp: { wave: 'sine', volume: 0.44, frequency: 360, attack: 0.015, decay: 0.10, sustain: 0.08, release: 0.22, slide: 860, noise: 0.0, tremolo: 12 }
  };

  let audioContext = null;
  let masterGain = null;
  let music = null;
  let musicRequested = false;
  let musicMuted = false;
  let preloaded = false;
  const sampleCache = {};
  const bufferCache = {};
  const MUSIC_MUTE_KEY = 'warborn.musicMuted';

  try { musicMuted = localStorage.getItem(MUSIC_MUTE_KEY) === 'true'; } catch (e) {}

  function updateMusicToggleButton() {
    const button = document.getElementById('musicToggleBtn');
    if (!button) return;
    button.textContent = musicMuted ? '♫ Music Off' : '♫ Music On';
    button.setAttribute('aria-pressed', String(musicMuted));
    button.setAttribute('aria-label', musicMuted ? 'Turn music on' : 'Mute music');
    button.title = musicMuted ? 'Turn background music on' : 'Mute background music';
  }

  function setMusicMuted(muted) {
    musicMuted = !!muted;
    try { localStorage.setItem(MUSIC_MUTE_KEY, String(musicMuted)); } catch (e) {}
    updateMusicToggleButton();
    if (musicMuted) {
      if (music) music.pause();
    } else if (musicRequested) {
      startBackgroundMusic();
    }
    return musicMuted;
  }

  function toggleMusicMute() {
    return setMusicMuted(!musicMuted);
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(audioContext.destination);
    hydrateBuffers();
    return audioContext;
  }

  function getEnvelope(t, preset) {
    const attack = preset.attack || 0.001;
    const decay = preset.decay || 0.04;
    const sustain = preset.sustain || 0.02;
    const release = preset.release || 0.08;
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - ((t - attack) / decay) * 0.42;
    if (t < attack + decay + sustain) return 0.58;
    const relT = (t - attack - decay - sustain) / release;
    return Math.max(0, 0.58 * (1 - relT));
  }

  function getWaveSample(wave, phase) {
    if (wave === 'square') return phase % 1 < 0.5 ? 1 : -1;
    if (wave === 'saw') return 2 * (phase % 1) - 1;
    if (wave === 'triangle') return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
    return Math.sin(phase * Math.PI * 2);
  }

  function renderZzfx(preset) {
    const duration = (preset.attack || 0) + (preset.decay || 0) + (preset.sustain || 0) + (preset.release || 0) + 0.02;
    const length = Math.max(1, Math.ceil(duration * SAMPLE_RATE));
    const data = new Float32Array(length);
    let phase = 0;
    let held = 0;
    const volume = preset.volume ?? 0.35;
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / Math.max(1, length - 1);
      const freq = Math.max(20, (preset.frequency || 220) + (preset.slide || 0) * progress);
      phase += freq / SAMPLE_RATE;
      if (preset.bitcrush) {
        const holdSamples = Math.max(1, preset.bitcrush | 0);
        if (i % holdSamples === 0) held = getWaveSample(preset.wave || 'sine', phase);
      } else {
        held = getWaveSample(preset.wave || 'sine', phase);
      }
      const tremolo = preset.tremolo ? 0.72 + Math.sin(t * preset.tremolo * Math.PI * 2) * 0.28 : 1;
      const noise = preset.noise ? (Math.random() * 2 - 1) * preset.noise : 0;
      const envelope = getEnvelope(t, preset);
      data[i] = Math.max(-1, Math.min(1, (held + noise) * envelope * volume * tremolo));
    }
    return data;
  }

  function hydrateBuffers() {
    const ctx = getAudioContext();
    if (!ctx) return;
    Object.entries(sampleCache).forEach(([name, samples]) => {
      if (bufferCache[name]) return;
      const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      bufferCache[name] = buffer;
    });
  }

  function cachePreset(name, preset) {
    sampleCache[name] = renderZzfx(preset);
  }

  function preload() {
    if (preloaded) return;
    preloaded = true;
    Object.entries(ATTACK_PRESETS).forEach(([unitName, preset]) => cachePreset(`attack:${unitName}`, preset));
    Object.entries(EFFECT_PRESETS).forEach(([name, preset]) => cachePreset(`effect:${name}`, preset));

    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.preload = 'auto';
    music.volume = 0.32;
    music.load();
  }

  function unlock() {
    preload();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    hydrateBuffers();
    if (musicRequested) startBackgroundMusic();
  }

  function playBuffer(name, volume = 1) {
    preload();
    const ctx = getAudioContext();
    if (!ctx || !bufferCache[name]) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = bufferCache[name];
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(masterGain || ctx.destination);
    source.start();
  }

  function playAttack(unitName) {
    playBuffer(`attack:${unitName}`, 1);
    if (!bufferCache[`attack:${unitName}`]) playBuffer('attack:default', 1);
  }

  function playMove() {
    playBuffer('effect:move', 0.85);
  }

  function playRankUp() {
    playBuffer('effect:rankUp', 1);
  }

  function startBackgroundMusic() {
    preload();
    musicRequested = true;
    if (!music || musicMuted) return;
    music.play().catch(() => {
      musicRequested = true;
    });
  }

  function stopBackgroundMusic() {
    musicRequested = false;
    if (music) music.pause();
  }

  function zzfx(nameOrPreset) {
    if (typeof nameOrPreset === 'string') {
      playBuffer(nameOrPreset);
      return;
    }
    const oneShotName = `oneshot:${Date.now()}:${Math.random()}`;
    cachePreset(oneShotName, nameOrPreset || ATTACK_PRESETS.default);
    hydrateBuffers();
    playBuffer(oneShotName);
  }

  const SoundManager = {
    preload,
    unlock,
    startBackgroundMusic,
    stopBackgroundMusic,
    setMusicMuted,
    toggleMusicMute,
    isMusicMuted: () => musicMuted,
    playAttack,
    playMove,
    playRankUp,
    zzfx
  };

  window.SoundManager = SoundManager;
  window.zzfx = zzfx;

  const musicToggleButton = document.getElementById('musicToggleBtn');
  if (musicToggleButton) musicToggleButton.addEventListener('click', toggleMusicMute);
  updateMusicToggleButton();

  ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, unlock, { once: true, passive: true });
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preload, { once: true });
  } else {
    preload();
  }
})();
