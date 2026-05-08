import Phaser from 'phaser';

/** 콘텐츠 컬럼 폭 — 모든 씬은 이 폭(720)을 logical 기준으로 그림. */
export const CONTENT_W = 720;
/** 콘텐츠 세로 logical 기준. 실제 viewport가 더 짧으면 콘텐츠가 살짝 잘릴 수 있음(다음 phase). */
export const CONTENT_H = 1280;

export interface Viewport {
  /** 실제 캔버스 폭. */
  readonly width: number;
  /** 실제 캔버스 높이. */
  readonly height: number;
  /** 콘텐츠 컬럼 좌측 x (= (width - CONTENT_W) / 2, min 0). */
  readonly contentX: number;
  /** 콘텐츠 컬럼 상단 y (= max(0, (height - CONTENT_H) / 2)). */
  readonly contentY: number;
  /** 콘텐츠 컬럼 폭 = min(CONTENT_W, width). */
  readonly contentW: number;
  /** 콘텐츠 컬럼 높이 = min(CONTENT_H, height). */
  readonly contentH: number;
  /** 콘텐츠 컬럼 가로 중앙 (절대 좌표). */
  readonly cx: number;
}

export function getViewport(scene: Phaser.Scene): Viewport {
  const w = scene.scale.gameSize.width;
  const h = scene.scale.gameSize.height;
  const contentW = Math.min(CONTENT_W, w);
  const contentH = Math.min(CONTENT_H, h);
  const contentX = Math.max(0, Math.floor((w - contentW) / 2));
  const contentY = Math.max(0, Math.floor((h - contentH) / 2));
  return {
    width: w,
    height: h,
    contentX,
    contentY,
    contentW,
    contentH,
    cx: contentX + contentW / 2,
  };
}

/**
 * 모바일 여부 판별 — window.innerWidth <= 480 기준.
 * 정보용으로 사용하며, logical 좌표 시스템은 그대로 유지.
 */
export function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= 480;
}

/**
 * 씬에 resize 리스너 등록 — 윈도우 크기 바뀔 때 콜백 호출.
 * shutdown/destroy 시 자동 해제.
 */
export function onResize(scene: Phaser.Scene, cb: (vp: Viewport) => void): void {
  const handler = (): void => cb(getViewport(scene));
  scene.scale.on('resize', handler);
  scene.events.once('shutdown', () => scene.scale.off('resize', handler));
  scene.events.once('destroy', () => scene.scale.off('resize', handler));
}
