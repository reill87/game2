/**
 * SFX 매핑. Kenney UI Sounds(.ogg) 6종을 의미 키워드로 묶는다.
 *
 * 디자인 원칙:
 *  - **남발 금지** — 게임 흐름의 "결정" 시점에만. 매주 자동 진행 틱은 약하게(volume 낮춤).
 *  - 의미 일관성 — 같은 종류 액션은 같은 사운드.
 *  - 사용자가 음소거(브라우저 정책) 못해도 거슬리지 않게 기본 볼륨 0.4 이하.
 *
 * 사용:
 *   import { SFX, playSfx } from '@/sounds';
 *   playSfx(this, SFX.click);  // primary CTA, 모달 confirm
 *   playSfx(this, SFX.tap);    // 보조 버튼, 토글
 *   playSfx(this, SFX.tick, 0.18);  // 매주 진행 틱 (작게)
 *   playSfx(this, SFX.success); // 출시·진급
 *   playSfx(this, SFX.modal);   // 이벤트 모달 등장
 */
import Phaser from 'phaser';

const ASSET_BASE = '/assets/ui/kenney/Sounds';

/** 의미 키 → Phaser audio key. preload에서 이 key로 등록한다. */
export const SFX = {
  /** Primary CTA·확인 버튼. 또렷한 클릭. */
  click: 'sfx-click-a',
  /** 보조 버튼·취소·닫기. 부드러운 클릭. */
  tap: 'sfx-click-b',
  /** 매주 자동 진행 틱. 매우 약하게 사용. */
  tick: 'sfx-tap-b',
  /** 토글 ON·정책 변경. */
  toggle: 'sfx-switch-a',
  /** 모달 등장(이벤트). */
  modal: 'sfx-switch-b',
  /** 출시·진급·업그레이드 등 긍정 이벤트. */
  success: 'sfx-tap-a',
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];

/** BootScene.preload에서 호출. 6개 ogg 등록. */
export function preloadSfx(scene: Phaser.Scene): void {
  scene.load.audio(SFX.click, `${ASSET_BASE}/click-a.ogg`);
  scene.load.audio(SFX.tap, `${ASSET_BASE}/click-b.ogg`);
  scene.load.audio(SFX.tick, `${ASSET_BASE}/tap-b.ogg`);
  scene.load.audio(SFX.toggle, `${ASSET_BASE}/switch-a.ogg`);
  scene.load.audio(SFX.modal, `${ASSET_BASE}/switch-b.ogg`);
  scene.load.audio(SFX.success, `${ASSET_BASE}/tap-a.ogg`);
}

/**
 * 안전한 SFX 재생. cache miss·decode 실패는 silent — 게임 흐름 막지 않음.
 * @param volume 0..1 기본 0.4 (UI 사운드 표준).
 */
export function playSfx(scene: Phaser.Scene, key: SfxKey, volume = 0.4): void {
  try {
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key, { volume });
  } catch {
    /* noop */
  }
}
