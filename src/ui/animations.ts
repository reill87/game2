/**
 * 공통 모션 헬퍼 — MOTION 토큰을 사용해 일관된 애니메이션 적용.
 *
 * - countUp: 숫자 텍스트를 시작값→목표값으로 보간 (골드 변화 등).
 * - hoverPulse: 카드 hover 시 살짝 커지는 피드백.
 * - pressTap: 버튼 누름 시 scale 0.96으로 짧게 들어갔다 복귀.
 * - slideUpIn: 모달 진입 — 아래에서 올라오며 fade-in.
 * - bloomBurst: 셀러브레이션 — scale 1.0→1.2→1.0 + alpha pulse.
 */
import Phaser from 'phaser';
import { MOTION } from '@/theme';

/**
 * 텍스트 숫자를 from→to로 카운트업 트윈.
 * @param formatter 표시 형식 변환 (예: formatGold).
 */
export function countUp(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text,
  from: number,
  to: number,
  formatter: (n: number) => string,
  duration: number = MOTION.duration.slow,
): Phaser.Tweens.Tween {
  const obj = { v: from };
  return scene.tweens.add({
    targets: obj,
    v: to,
    duration,
    ease: MOTION.ease.standard,
    onUpdate: () => text.setText(formatter(Math.round(obj.v))),
  });
}

/**
 * 버튼 누름 피드백 — scale 0.96으로 짧게 들어갔다 원위치.
 * pointerdown 시점에 호출.
 */
export function pressTap(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    scale: 0.96,
    duration: MOTION.duration.fast,
    ease: MOTION.ease.exit,
    yoyo: true,
  });
}

/**
 * 모달·패널 slide-up + fade-in. 진입용.
 * @param yOffset 시작 y 오프셋 (양수면 아래에서 시작).
 */
export function slideUpIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container | Phaser.GameObjects.GameObject,
  yOffset = 24,
): Phaser.Tweens.Tween {
  const t = target as Phaser.GameObjects.Container & { alpha: number; y: number };
  const startY = t.y + yOffset;
  const targetY = t.y;
  t.y = startY;
  t.alpha = 0;
  return scene.tweens.add({
    targets: t,
    y: targetY,
    alpha: 1,
    duration: MOTION.duration.slow,
    ease: MOTION.ease.enter,
  });
}

/**
 * 셀러브레이션 — 구매·업그레이드 직후 짧은 강조.
 * scale 1.0 → 1.15 → 1.0 + alpha pulse.
 */
export function bloomBurst(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.GameObject,
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    scale: 1.15,
    duration: MOTION.duration.bloom / 2,
    ease: MOTION.ease.bounce,
    yoyo: true,
  });
}

export function microPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
  scale = 1.08,
): Phaser.Tweens.Tween {
  const baseX = target.scaleX;
  const baseY = target.scaleY;
  return scene.tweens.add({
    targets: target,
    scaleX: baseX * scale,
    scaleY: baseY * scale,
    duration: MOTION.duration.base,
    ease: MOTION.ease.bounce,
    yoyo: true,
  });
}
