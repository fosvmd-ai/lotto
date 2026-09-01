// Web Audio API based Sound Engine for Classroom Lotto
// Zero external assets, 100% offline & reliable, no 403/CORS issues.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private continuousOsc: OscillatorNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;

  // Initialize or resume AudioContext
  public async unlockAudio(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return !!this.ctx;
    } catch (e) {
      console.warn("Audio unlock failed:", e);
      return false;
    }
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // --- Sound Generation Primitives ---

  // Simple Tone with ADSR envelope
  private playTone(
    freq: number, 
    type: OscillatorType, 
    duration: number, 
    startTimeOffset = 0, 
    gainVal = 0.3,
    rampToFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime + startTimeOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (rampToFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, rampToFreq), t + duration);
    }

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + duration * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Noise Buffer (White/Filtered Noise)
  private createNoiseBuffer(duration = 0.5): AudioBuffer | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Play filtered noise burst (Explosion, Card whoosh, Box shake, etc.)
  private playNoise(
    duration: number, 
    filterType: BiquadFilterType = 'lowpass', 
    freq = 800, 
    startTimeOffset = 0, 
    gainVal = 0.4
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const buffer = this.createNoiseBuffer(duration);
    if (!buffer) return;

    const t = ctx.currentTime + startTimeOffset;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + duration);
  }

  // --- Step / Tick Sounds (Called during rolling animation) ---

  public playTick(effect: string) {
    const ctx = this.getContext();
    if (!ctx) return;

    switch (effect) {
      case 'slot': {
        // High click mechanical ratchet sound
        this.playTone(850 + Math.random() * 200, 'square', 0.03, 0, 0.15, 300);
        break;
      }
      case 'explosion': {
        // Ticking countdown + sizzle
        this.playTone(200, 'sawtooth', 0.04, 0, 0.2, 80);
        this.playNoise(0.05, 'bandpass', 1200, 0, 0.1);
        break;
      }
      case 'card': {
        // Soft card shuffle / flip whoosh
        this.playNoise(0.06, 'bandpass', 2400, 0, 0.25);
        break;
      }
      case 'box': {
        // Shake rattle percussion
        this.playNoise(0.05, 'highpass', 3500, 0, 0.2);
        this.playTone(180, 'triangle', 0.03, 0, 0.2, 90);
        break;
      }
      case 'machine': {
        // Bubble pop / ping of bouncy ball
        const pitch = 500 + Math.random() * 400;
        this.playTone(pitch, 'sine', 0.05, 0, 0.25, pitch * 1.5);
        break;
      }
      case 'board': {
        // 8-bit digital arcade blip
        const notes = [440, 523, 587, 659, 698, 784];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        this.playTone(randomNote, 'square', 0.04, 0, 0.12);
        break;
      }
      case 'marble': {
        // Clear glass marble click/ping
        const marblePitch = 1200 + Math.random() * 800;
        this.playTone(marblePitch, 'sine', 0.03, 0, 0.2, marblePitch * 0.8);
        break;
      }
      case 'standard':
      default: {
        // Classic wooden/plastic ball tick
        this.playTone(700, 'triangle', 0.03, 0, 0.25, 200);
        break;
      }
    }
  }

  // Marble collision bounce sound (called when marble hits pegs/walls)
  public playMarbleBounce(volume = 0.15) {
    const pitch = 900 + Math.random() * 700;
    this.playTone(pitch, 'sine', 0.025, 0, Math.min(0.3, volume), pitch * 0.6);
  }

  // Marble explosion warning beep
  public playBombWarning() {
    this.playTone(880, 'square', 0.05, 0, 0.18);
  }

  // Marble explosion blast sound
  public playExplosionBlast() {
    // 1. Noise shockwave
    this.playNoise(0.6, 'lowpass', 600, 0, 0.7);
    // 2. Sub-bass boom
    this.playTone(130, 'sine', 0.5, 0, 0.8, 30);
    this.playTone(90, 'triangle', 0.4, 0, 0.5, 20);
  }

  // Slow-mo cinematic overtake whoosh
  public playSlowMoWhoosh() {
    this.playNoise(0.8, 'lowpass', 350, 0, 0.6);
    this.playTone(280, 'sine', 0.7, 0, 0.45, 60);
    // Heartbeat thud
    this.playTone(85, 'triangle', 0.35, 0.1, 0.6, 35);
  }

  // Speed boost pad sound
  public playBoostPad() {
    this.playTone(520, 'triangle', 0.15, 0, 0.3, 1400);
  }

  // Wormhole teleport sound
  public playWarpSound() {
    this.playTone(750, 'sine', 0.2, 0, 0.35, 1800);
    this.playTone(1100, 'sine', 0.25, 0.08, 0.3, 500);
  }

  public stopTick(effect: string) {
    // Clean up if any continuous sound is active
    if (this.continuousOsc) {
      try {
        this.continuousOsc.stop();
        this.continuousOsc.disconnect();
      } catch (e) {}
      this.continuousOsc = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch (e) {}
      this.noiseNode = null;
    }
  }

  // --- Winning / Determination Sounds (Called when winner is revealed) ---

  public playWin(effect: string) {
    this.stopTick(effect);
    const ctx = this.getContext();
    if (!ctx) return;

    switch (effect) {
      case 'slot':
        this.playSlotJackpot();
        break;
      case 'explosion':
        this.playExplosionWin();
        break;
      case 'card':
        this.playCardRevealWin();
        break;
      case 'box':
        this.playBoxOpenWin();
        break;
      case 'machine':
        this.playMachineBallWin();
        break;
      case 'board':
        this.playBoardChimeWin();
        break;
      case 'marble':
        this.playMarbleFinishWin();
        break;
      case 'standard':
      default:
        this.playStandardFanfare();
        break;
    }
  }

  // 8. Marble: Sports Goal / Finish Line Cheering Fanfare (마블 레이스 골인 팡파레)
  private playMarbleFinishWin() {
    // Whistle / celebration ding
    this.playTone(1800, 'sine', 0.15, 0, 0.25, 2400);

    // High energy triumphant fanfare: C5 -> E5 -> G5 -> C6 with fast arpeggio
    const fanfareNotes = [
      { f: 523.25, d: 0.1, o: 0.08 },
      { f: 659.25, d: 0.1, o: 0.18 },
      { f: 783.99, d: 0.12, o: 0.28 },
      { f: 1046.50, d: 0.5, o: 0.40 }
    ];
    fanfareNotes.forEach(n => {
      this.playTone(n.f, 'triangle', n.d, n.o, 0.35);
      this.playTone(n.f * 1.5, 'sine', n.d * 0.8, n.o, 0.15);
    });

    // Confetti chimes
    [1318.5, 1567.98, 2093.0, 2637.0].forEach((f, idx) => {
      this.playTone(f, 'sine', 0.3, 0.45 + idx * 0.06, 0.18);
    });
  }

  // 1. Standard: Classic Lotto Brass Fanfare (도-미-솔-도 화음 + 브라스 팡파레)
  private playStandardFanfare() {
    const chord1 = [261.63, 329.63, 392.00]; // C4, E4, G4
    chord1.forEach(f => this.playTone(f, 'triangle', 0.25, 0, 0.25));

    setTimeout(() => {
      const chord2 = [293.66, 369.99, 440.00]; // D4, F#4, A4
      chord2.forEach(f => this.playTone(f, 'triangle', 0.25, 0, 0.25));
    }, 180);

    setTimeout(() => {
      const chord3 = [329.63, 392.00, 523.25]; // E4, G4, C5
      chord3.forEach(f => this.playTone(f, 'triangle', 0.35, 0, 0.28));
    }, 360);

    setTimeout(() => {
      // Big triumphant C Major chord with brass resonance
      const finalChord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      finalChord.forEach(f => {
        this.playTone(f, 'sawtooth', 0.9, 0, 0.22);
        this.playTone(f, 'sine', 1.0, 0, 0.3);
      });
      // Sparkling chimes on top
      [1046.5, 1318.5, 1567.98, 2093.0].forEach((f, idx) => {
        this.playTone(f, 'triangle', 0.6, idx * 0.08, 0.15);
      });
    }, 560);
  }

  // 2. Slot: Casino Jackpot & Coin Fountain (코인 찰랑 + 잭팟 벨)
  private playSlotJackpot() {
    // Rapid coin fountain clinking
    for (let i = 0; i < 10; i++) {
      const delay = i * 0.05;
      const coinPitch = 2000 + Math.random() * 1000;
      this.playTone(coinPitch, 'sine', 0.1, delay, 0.2);
    }

    // Classic jackpot alarm ring (high ping pulses)
    setTimeout(() => {
      const rings = [987.77, 1318.51, 987.77, 1318.51, 1567.98, 1760.00];
      rings.forEach((f, idx) => {
        this.playTone(f, 'square', 0.12, idx * 0.1, 0.2);
      });
    }, 300);

    // Grand Jackpot triumphant chord
    setTimeout(() => {
      [523.25, 659.25, 783.99, 1046.50].forEach(f => {
        this.playTone(f, 'triangle', 0.8, 0, 0.3);
      });
      // Extra coins
      for (let i = 0; i < 8; i++) {
        this.playTone(2200 + Math.random() * 800, 'sine', 0.15, i * 0.08, 0.18);
      }
    }, 900);
  }

  // 3. Explosion: Deep Boom Blast + Victory Fanfare (묵직한 폭발음 + 승리 팡파레)
  private playExplosionWin() {
    const ctx = this.getContext();
    if (!ctx) return;

    // 1. Initial Shockwave Blast (Noise burst with lowpass sweep)
    const dur = 1.2;
    const buffer = this.createNoiseBuffer(dur);
    if (buffer) {
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(40, t + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(t);
      source.stop(t + dur);
    }

    // 2. Sub-bass drop impact
    this.playTone(120, 'sine', 0.8, 0, 0.7, 30);

    // 3. Victory Fanfare rising from the explosion smoke
    setTimeout(() => {
      const melody = [
        { f: 392.00, d: 0.15 }, // G4
        { f: 523.25, d: 0.15 }, // C5
        { f: 659.25, d: 0.15 }, // E5
        { f: 783.99, d: 0.6 }   // G5
      ];
      melody.forEach((note, idx) => {
        this.playTone(note.f, 'sawtooth', note.d, idx * 0.15, 0.25);
        this.playTone(note.f, 'triangle', note.d, idx * 0.15, 0.3);
      });
    }, 350);
  }

  // 4. Card: Magical Harp Arpeggio & Tada Fanfare (마법의 하프 아르페지오 + 타다~)
  private playCardRevealWin() {
    // Shimmering Harp Arpeggio (Glissando)
    const harpNotes = [
      392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00
    ];
    harpNotes.forEach((f, idx) => {
      this.playTone(f, 'sine', 0.4, idx * 0.06, 0.22);
      this.playTone(f * 1.5, 'triangle', 0.25, idx * 0.06 + 0.01, 0.1);
    });

    // Magical "Ta-da!" Chord
    setTimeout(() => {
      const tadaChord = [523.25, 659.25, 783.99, 1046.50];
      tadaChord.forEach(f => {
        this.playTone(f, 'sine', 0.8, 0, 0.25);
        this.playTone(f, 'triangle', 0.8, 0, 0.2);
      });
      // Glockenspiel sparkle
      this.playTone(2093.00, 'triangle', 0.6, 0.05, 0.18);
      this.playTone(2637.02, 'sine', 0.6, 0.1, 0.15);
    }, 550);
  }

  // 5. Box: Mystery Box Opening Glow + Heavenly Treasure Fanfare (보물상자 오픈 + 팡파레)
  private playBoxOpenWin() {
    // Lid creak / pop
    this.playTone(300, 'triangle', 0.1, 0, 0.3, 700);

    // Magical rising sparkle chimes
    const sparkleNotes = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760];
    sparkleNotes.forEach((f, idx) => {
      this.playTone(f, 'sine', 0.3, 0.08 + idx * 0.07, 0.2);
    });

    // Heavenly Treasure Fanfare
    setTimeout(() => {
      [440, 554.37, 659.25, 880].forEach(f => {
        this.playTone(f, 'triangle', 0.8, 0, 0.28);
      });
      [880, 1108.73, 1318.51, 1760].forEach(f => {
        this.playTone(f, 'sine', 0.9, 0.1, 0.22);
      });
    }, 600);
  }

  // 6. Machine: Popping Ball Shootout + Bouncy Win Melody (볼 발사 퐁! + 경쾌한 팡파레)
  private playMachineBallWin() {
    // Characteristic "POP!" sound of winning ball shot out from tube
    this.playTone(220, 'sine', 0.08, 0, 0.5, 900);
    this.playNoise(0.06, 'bandpass', 1500, 0, 0.25);

    // Bouncy celebration melody (Playful & Lively)
    const melody = [
      { f: 523.25, d: 0.12, o: 0.12 }, // C5
      { f: 523.25, d: 0.12, o: 0.24 }, // C5
      { f: 659.25, d: 0.15, o: 0.36 }, // E5
      { f: 783.99, d: 0.2, o: 0.52 },  // G5
      { f: 659.25, d: 0.12, o: 0.72 }, // E5
      { f: 1046.50, d: 0.7, o: 0.86 }  // C6 (High finish)
    ];

    melody.forEach(note => {
      this.playTone(note.f, 'triangle', note.d, note.o, 0.3);
      this.playTone(note.f, 'sine', note.d, note.o, 0.25);
    });
  }

  // 7. Board: School/Quiz Show "Ding-Dong-Dang-Dong" + Cheerful Victory Fanfare (정답 실로폰 + 팡파레)
  private playBoardChimeWin() {
    // Iconic Korean Quiz Show "Ding-Dong-Dang-Dong" (솔-도-미-솔 실로폰)
    const quizChimes = [
      { f: 392.00, delay: 0.00 }, // 솔 (G4)
      { f: 523.25, delay: 0.18 }, // 도 (C5)
      { f: 659.25, delay: 0.36 }, // 미 (E5)
      { f: 783.99, delay: 0.54 }  // 솔 (G5)
    ];

    quizChimes.forEach(chime => {
      // Xylophone / Glockenspiel resonance: fundamental + harmonic
      this.playTone(chime.f, 'sine', 0.45, chime.delay, 0.35);
      this.playTone(chime.f * 2.76, 'triangle', 0.2, chime.delay, 0.12);
    });

    // Followed by lively classroom victory celebration fanfare
    setTimeout(() => {
      const fanfare = [
        { f: 523.25, o: 0.00, d: 0.15 },
        { f: 659.25, o: 0.12, d: 0.15 },
        { f: 783.99, o: 0.24, d: 0.15 },
        { f: 1046.50, o: 0.36, d: 0.7 }
      ];
      fanfare.forEach(item => {
        this.playTone(item.f, 'triangle', item.d, item.o, 0.28);
        this.playTone(item.f, 'square', item.d * 0.6, item.o, 0.12);
      });
    }, 750);
  }
}

export const soundEngine = new SoundEngine();
export default soundEngine;
