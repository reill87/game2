/**
 * BGM 음소거 토글 — 씬마다 화면 좌상단(또는 지정 위치)에 작은 버튼.
 * Phaser scene에서 한 번 호출하면 자동으로 BGM 모듈에 토글 결합.
 */
import Phaser from 'phaser';

import { BGM } from '@/bgm';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';

interface MuteToggleOpts {
  /** 좌상단 기준 x. 기본 14. */
  x?: number;
  /** 좌상단 기준 y. 기본 14. */
  y?: number;
}

export function addMuteToggle(scene: Phaser.Scene, opts: MuteToggleOpts = {}): void {
  const x = opts.x ?? 14;
  const y = opts.y ?? 14;
  const w = 36;
  const h = 36;
  const rect = new Phaser.Geom.Rectangle(x, y, w, h);
  const bg = scene.add.graphics();
  const text = scene.add
    .text(x + w / 2, y + h / 2, BGM.isMuted() ? '🔇' : '🔊', {
      fontFamily: FONT_STACK,
      fontSize: '30px',
      color: TEXT_COLOR.dim,
    })
    .setOrigin(0.5);

  const draw = (): void => {
    bg.clear();
    bg.fillStyle(COLOR.btnSecondary, 0.85);
    bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 10);
    text.setText(BGM.isMuted() ? '🔇' : '🔊');
  };
  draw();

  const hit = scene.add
    .zone(x + w / 2, y + h / 2, w, h)
    .setInteractive({ useHandCursor: true });
  hit.on('pointerup', () => {
    BGM.toggleMute();
    BGM.resume();
    playSfx(scene, SFX.tap);
    draw();
  });
}
