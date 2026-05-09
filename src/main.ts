import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './config';

/** Phaser Text는 첫 레이아웃 시 폰트 메트릭이 필요하다. Pretendard가 늦게 뜨면 Sizer가 0 크기로 붕괴할 수 있음. */
async function boot(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try {
      await document.fonts.load('400 16px Pretendard');
      await document.fonts.load('600 22px Pretendard');
      await document.fonts.ready;
    } catch {
      /* 폰트 API 없거나 실패 시에도 부팅은 진행 */
    }
  }
  const game = new Phaser.Game(gameConfig);

  /**
   * HiDPI 리사이즈 핸들러 — 캔버스 드로잉 버퍼를 항상 viewport × DPR로 유지.
   * Phaser RESIZE 모드는 부모 CSS 크기에 맞추므로, 윈도우 리사이즈 후 DPR 보정을
   * 수동으로 다시 적용해야 폰트/도형 선명도가 유지된다.
   */
  const applyHiDpiSize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    game.scale.resize(window.innerWidth * dpr, window.innerHeight * dpr);
    // 캔버스 CSS는 100%로 — 결과적으로 buffer:CSS = DPR:1 (다운샘플 = 선명).
    if (game.canvas) {
      game.canvas.style.width = '100%';
      game.canvas.style.height = '100%';
    }
  };
  // 초기 적용 (Phaser 내부 정렬 후 1 frame 늦춰).
  setTimeout(applyHiDpiSize, 0);
  window.addEventListener('resize', applyHiDpiSize);
  // 모바일 화면 회전 시.
  window.addEventListener('orientationchange', applyHiDpiSize);
}

void boot();
