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
  new Phaser.Game(gameConfig);
}

void boot();
