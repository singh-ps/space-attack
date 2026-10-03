"use strict";

// Small synthesized arcade cues: no downloads, samples, or audio dependencies.
const GameAudio = (() => {
  function create(config) {
    let context = null;
    let output = null;
    let noiseBuffer = null;
    let muted = false;
    const voices = new Set();

    function unlock() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        if (!context) {
          context = new AudioContext();
          output = context.createGain();
          output.gain.value = muted ? 0 : config.volume;
          output.connect(context.destination);
          noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
          const samples = noiseBuffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        }
        if (context.state === "suspended") context.resume().catch(() => {});
      } catch {
        // Gameplay and visual effects continue when audio is unavailable.
      }
    }

    function stop() {
      for (const source of voices) {
        try { source.stop(); } catch {}
      }
      voices.clear();
    }

    function setMuted(value) {
      muted = value;
      stop();
      if (output) output.gain.setTargetAtTime(muted ? 0 : config.volume, context.currentTime, 0.01);
    }

    function voice(source, duration, volume, delay = 0, filter = null) {
      if (voices.size >= config.maxVoices) {
        const oldest = voices.values().next().value;
        try { oldest.stop(); } catch {}
        voices.delete(oldest);
      }
      const now = context.currentTime + delay;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(volume, now + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter || envelope);
      if (filter) filter.connect(envelope);
      envelope.connect(output);
      voices.add(source);
      source.onended = () => {
        voices.delete(source);
        source.disconnect();
        if (filter) filter.disconnect();
        envelope.disconnect();
      };
      source.start(now);
      source.stop(now + duration + 0.02);
    }

    function tone(frequency, end, duration, volume = 0.4, delay = 0, type = "triangle") {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
      oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + delay + duration);
      voice(oscillator, duration, volume, delay);
    }

    function blast(player, frequency) {
      const duration = player ? 0.45 : 0.18;
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(player ? 2200 : 3500, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, context.currentTime + duration);
      voice(source, duration, player ? 0.65 : 0.4, 0, filter);
      tone(frequency, 45, duration, player ? 0.55 : 0.3, 0, "sawtooth");
    }

    function melody(notes, spacing = 0.1, delay = 0) {
      notes.forEach((frequency, index) => tone(frequency, frequency, 0.16, 0.35, delay + index * spacing));
    }

    function play(event) {
      if (!context || !output || !noiseBuffer || muted || context.state === "closed") return;
      const frequency = { delta: 190, alpha: 250, omega: 320 }[event.type] || 160;
      switch (event.kind) {
        case "playerFire": tone(1100, 320, 0.1, 0.3, 0, "square"); break;
        case "enemyFire": tone(frequency, frequency / 2, 0.13, 0.25, 0, "sawtooth"); break;
        case "blast": blast(event.type === "player", frequency); break;
        case "start": melody([330, 440, 660]); break;
        case "respawn": melody([440, 660], 0.09); break;
        case "levelup": melody([523, 659, 784, 1047]); break;
        case "gameover": melody([392, 330, 262, 196], 0.16, 0.22); break;
        case "victory": melody([523, 659, 784, 1047, 784, 1047], 0.13); break;
        case "pause": tone(330, 220, 0.1, 0.2); break;
        case "resume": tone(220, 440, 0.1, 0.2); break;
      }
    }

    return { unlock, play, stop, setMuted, get muted() { return muted; } };
  }

  return { create };
})();
