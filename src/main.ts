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
  // 부팅 실패 시에도 사용자가 빈 화면 안 보도록 폴백:
  // 5초 안에 Phaser ready 안 떨어지면 스피너 강제 제거 + 에러 메시지 표시.
  const removeSpinner = (): void => {
    document.getElementById('initial-loader')?.remove();
  };
  const fallbackTimer = setTimeout(() => {
    removeSpinner();
    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#e55f5f;font-size:14px;text-align:center;padding:20px;';
    div.innerHTML =
      '게임 부팅 실패 — 새로고침 시도.<br><br>지속되면 브라우저 콘솔(F12)에서 에러 확인.';
    document.body.appendChild(div);
  }, 5000);

  // 글로벌 에러 핸들러 — 부팅 중 throw 시 콘솔에 명확히 표시.
  window.addEventListener('error', (e) => {
    console.error('[boot error]', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled rejection]', e.reason);
  });

  const game = new Phaser.Game(gameConfig);

  // Phaser ready 시 스피너 제거 + 폴백 타이머 취소.
  game.events.once('ready', () => {
    clearTimeout(fallbackTimer);
    removeSpinner();
  });

  /**
   * HiDPI 리사이즈 — Phaser scale=NONE이라 모든 사이즈 조정을 직접 처리.
   *  - 캔버스 드로잉 버퍼: viewport × DPR (물리 픽셀)
   *  - 캔버스 CSS 표시: 100% × 100% (viewport CSS 픽셀)
   *  - 결과: buffer:CSS = DPR:1 → 브라우저가 다운샘플로 sharp 표시.
   */
  const applyHiDpiSize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    game.scale.resize(w * dpr, h * dpr);
    const canvas = game.canvas;
    if (canvas) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.display = 'block';
    }
    // 모든 활성 씬의 fitCamera 다시 계산하도록 resize 이벤트 발행.
    game.scale.refresh();
  };
  // 초기 적용 — Phaser canvas DOM 추가 후.
  setTimeout(applyHiDpiSize, 0);
  window.addEventListener('resize', applyHiDpiSize);
  window.addEventListener('orientationchange', applyHiDpiSize);
}

void boot();
