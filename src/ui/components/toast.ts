/**
 * Toast — 화면 상단/하단에 잠깐 떠올랐다 사라지는 알림.
 *
 * 사용:
 *   showToast(scene, '+100g 이노베이션 랩 효과', { tone: 'ok' });
 *   showToast(scene, '파산 위험: 골드 0', { tone: 'bad', durationMs: 3000 });
 *
 * 동시에 여러 토스트 호출 시 자동으로 위로 쌓인다 (queue).
 */
import Phaser from 'phaser';
import { COLOR, ELEVATION, MOTION, RADIUS, SPACING, TEXT_COLOR, TYPE } from '@/theme';

export type ToastTone = 'neutral' | 'ok' | 'warn' | 'bad';
export type ToastPosition = 'top' | 'bottom';

export interface ToastConfig {
  tone?: ToastTone;
  position?: ToastPosition;
  /** 표시 시간 ms (기본 2000). */
  durationMs?: number;
}

const TOAST_HEIGHT = 44;
const TOAST_GAP = 8;
const TOAST_PADDING_X = 18;
const TOAST_TOP_Y = 80;
const TOAST_BOTTOM_Y = 1180;
const TOAST_MAX_WIDTH = 600;

// 활성 토스트 추적 — 위치 충돌 방지.
const activeToasts: Array<{ container: Phaser.GameObjects.Container; position: ToastPosition }> = [];

function toneColors(tone: ToastTone): { bg: number; text: string } {
  switch (tone) {
    case 'ok':   return { bg: 0x1a3a25, text: TEXT_COLOR.ok };
    case 'warn': return { bg: 0x3a2e10, text: TEXT_COLOR.warn };
    case 'bad':  return { bg: 0x3a1a1a, text: TEXT_COLOR.bad };
    case 'neutral':
    default:     return { bg: COLOR.panel, text: TEXT_COLOR.primary };
  }
}

export function showToast(scene: Phaser.Scene, message: string, cfg: ToastConfig = {}): void {
  const tone = cfg.tone ?? 'neutral';
  const position = cfg.position ?? 'top';
  const duration = cfg.durationMs ?? 2000;
  const { bg: bgColor, text: textColor } = toneColors(tone);

  // 텍스트 폭 측정용 임시 phantom.
  const phantom = scene.add.text(0, 0, message, { ...TYPE.bodyBold, color: textColor }).setVisible(false);
  const textWidth = phantom.width;
  phantom.destroy();
  const w = Math.min(TOAST_MAX_WIDTH, textWidth + TOAST_PADDING_X * 2);

  // 같은 position 활성 개수만큼 스택.
  const sameStack = activeToasts.filter((t) => t.position === position).length;
  const stackOffset = sameStack * (TOAST_HEIGHT + TOAST_GAP);
  const baseY = position === 'top' ? TOAST_TOP_Y + stackOffset : TOAST_BOTTOM_Y - stackOffset - TOAST_HEIGHT;

  const cx = 360; // logical center
  const x = cx - w / 2;

  const container = scene.add.container(0, 0).setDepth(ELEVATION.toast);

  const bg = scene.add.graphics();
  bg.fillStyle(bgColor, 0.95);
  bg.fillRoundedRect(x, baseY, w, TOAST_HEIGHT, RADIUS.lg);
  bg.lineStyle(1, bgColor, 1);
  bg.strokeRoundedRect(x, baseY, w, TOAST_HEIGHT, RADIUS.lg);
  container.add(bg);

  const text = scene.add
    .text(cx, baseY + TOAST_HEIGHT / 2, message, { ...TYPE.bodyBold, color: textColor })
    .setOrigin(0.5);
  container.add(text);

  // 추적 등록.
  const entry = { container, position };
  activeToasts.push(entry);

  // 진입 — slide-in (위면 아래로, 아래면 위로).
  const fromY = position === 'top' ? -SPACING.xl : SPACING.xl;
  container.y = fromY;
  container.alpha = 0;
  scene.tweens.add({
    targets: container,
    y: 0,
    alpha: 1,
    duration: MOTION.duration.base,
    ease: MOTION.ease.enter,
  });

  // 자동 퇴장.
  scene.time.delayedCall(duration, () => {
    scene.tweens.add({
      targets: container,
      y: fromY,
      alpha: 0,
      duration: MOTION.duration.base,
      ease: MOTION.ease.exit,
      onComplete: () => {
        const idx = activeToasts.indexOf(entry);
        if (idx >= 0) activeToasts.splice(idx, 1);
        container.destroy(true);
      },
    });
  });
}
