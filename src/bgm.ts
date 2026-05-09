/**
 * 절차생성(Procedural) BGM 매니저.
 *
 * 외부 음원 자산 없이 Web Audio API로 따뜻한 chill 루프를 합성한다.
 * 디자인 원칙(공포영화 느낌 회피):
 *  - **메이저 키만** — 모든 mood가 major7/major9 코드. 단조 sustain drone 금지.
 *  - **rhythmic arpeggio** — 코드 동시 발음(드론) 대신 1/8박 sine 아르페지오로
 *    멜로디 진행이 느껴지게.
 *  - **부드러운 톤** — sine + triangle만, square·sawtooth 미사용. 저역 통과
 *    BiquadFilter(2200Hz)로 고역 깎아 lo-fi 무드.
 *  - **약한 볼륨** — 마스터 0.05. UI SFX 위에서 살짝 깔리는 정도.
 *
 * 세 mood:
 *  - 'calm'      : 메뉴/Stats — 느린 C major7 아르페지오 (4초/사이클)
 *  - 'focus'     : Development — F major9 + 살짝 빠른 진행 (3초)
 *  - 'celebrate' : Result/Ending — D major7 라이징 아르페지오 (3.2초)
 */

const STORAGE_KEY = 'game2.bgm.muted';

export type BGMMood = 'calm' | 'focus' | 'celebrate';

/** mood별 아르페지오 노트 시퀀스(주파수, Hz). 모두 메이저 톤. */
const MOOD_PATTERN: Readonly<
  Record<BGMMood, { readonly notes: ReadonlyArray<number>; readonly cycleMs: number; readonly bassHz: number }>
> = {
  // C major 7 — C4, E4, G4, B4 (높은 옥타브로 다시 C5)
  calm: {
    notes: [261.63, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63, 261.63],
    cycleMs: 4400,
    bassHz: 130.81, // C3
  },
  // F major 9 — F4, A4, C5, E5, G5
  focus: {
    notes: [349.23, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0],
    cycleMs: 3000,
    bassHz: 174.61, // F3
  },
  // D major 7 라이징 — D5, F#5, A5, C#6
  celebrate: {
    notes: [587.33, 739.99, 880.0, 1108.73, 880.0, 739.99, 587.33, 440.0],
    cycleMs: 3200,
    bassHz: 146.83, // D3
  },
};

class BGMManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private currentMood: BGMMood | null = null;
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private muted: boolean;
  private masterVolume = 0.05;

  constructor() {
    this.muted = this.loadMuted();
  }

  private loadMuted(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private saveMuted(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    } catch {
      /* noop */
    }
  }

  private ensureCtx(): boolean {
    if (this.ctx) return true;
    try {
      const W = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      // master gain
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      // 저역 통과 필터 — 고역 깎아 따뜻한 lo-fi 톤. 공포 sustain의 zing 제거.
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2200;
      this.filter.Q.value = 0.6;
      this.filter.connect(this.master);
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  resume(): void {
    if (!this.ensureCtx()) return;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMood(mood: BGMMood): void {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    this.scheduleNextCycle(0);
  }

  private scheduleNextCycle(delay: number): void {
    if (this.cycleTimer) clearTimeout(this.cycleTimer);
    this.cycleTimer = setTimeout(() => this.playOneCycle(), delay);
  }

  /** 한 사이클 — 베이스 1음 + 아르페지오 8음. */
  private playOneCycle(): void {
    if (!this.ensureCtx() || !this.ctx || !this.filter) return;
    const mood = this.currentMood;
    if (!mood) return;
    const pattern = MOOD_PATTERN[mood];
    if (this.muted) {
      this.scheduleNextCycle(pattern.cycleMs);
      return;
    }

    const now = this.ctx.currentTime;
    const cycleSec = pattern.cycleMs / 1000;
    const noteSec = cycleSec / pattern.notes.length;

    // 베이스 — 깊은 둥둥 1음. triangle, slow attack/release.
    this.scheduleTone(this.ctx, this.filter, {
      freq: pattern.bassHz,
      type: 'triangle',
      startAt: now,
      attack: 0.4,
      sustain: cycleSec - 0.8,
      release: 0.4,
      peak: 0.8,
    });

    // 아르페지오 — 각 노트 짧고 부드러운 sine. 살짝 겹치게(release tail).
    pattern.notes.forEach((freq, i) => {
      const t = now + i * noteSec;
      // 강약 — 짝수 인덱스 강, 홀수 인덱스 약 (그루브).
      const peak = i % 2 === 0 ? 0.55 : 0.32;
      this.scheduleTone(this.ctx!, this.filter!, {
        freq,
        type: 'sine',
        startAt: t,
        attack: 0.04,
        sustain: noteSec * 0.6,
        release: noteSec * 0.5,
        peak,
      });
    });

    this.scheduleNextCycle(pattern.cycleMs);
  }

  /** 단일 톤 envelope 헬퍼. attack→peak→sustain→release. */
  private scheduleTone(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      freq: number;
      type: OscillatorType;
      startAt: number;
      attack: number;
      sustain: number;
      release: number;
      peak: number;
    },
  ): void {
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.value = opts.freq;
    const g = ctx.createGain();
    const t0 = opts.startAt;
    const t1 = t0 + opts.attack;
    const t2 = t1 + opts.sustain;
    const t3 = t2 + opts.release;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.peak, t1);
    g.gain.linearRampToValueAtTime(opts.peak * 0.7, t2);
    g.gain.linearRampToValueAtTime(0, t3);
    osc.connect(g).connect(dest);
    osc.start(t0);
    osc.stop(t3 + 0.05);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.saveMuted();
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume,
        this.ctx?.currentTime ?? 0,
        0.1,
      );
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** BGM 마스터 볼륨 설정. v: 0~1. 음소거 상태에서도 값은 저장되며 음소거 해제 시 반영. */
  setVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.masterVolume, this.ctx?.currentTime ?? 0, 0.1);
    }
  }

  /** 현재 BGM 마스터 볼륨(0~1). */
  getVolume(): number {
    return this.masterVolume;
  }

  stop(): void {
    if (this.cycleTimer) clearTimeout(this.cycleTimer);
    this.cycleTimer = null;
    this.currentMood = null;
  }
}

export const BGM = new BGMManagerImpl();
