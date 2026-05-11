/**
 * Confetti burst — 구매·업그레이드 셀러브레이션.
 *
 * Phaser 파티클 시스템 없이 GameObject Tween으로 N개 작은 사각형을
 * 중심점에서 사방으로 날린다 (의존성 추가 없이 가벼운 구현).
 *
 * 사용:
 *   confettiBurst(scene, x, y);                       // 기본 16개
 *   confettiBurst(scene, x, y, { count: 30, palette: ['#ec4899', '#06b6d4'] });
 */
import Phaser from 'phaser';
import { CATEGORY, ELEVATION, MOTION } from '@/theme';

const DEFAULT_COUNT = 16;
const DEFAULT_PALETTE: ReadonlyArray<string> = [
  CATEGORY.rnd.str,
  CATEGORY.facility.str,
  CATEGORY.market.str,
  CATEGORY.acquisition.str,
  CATEGORY.mail.str,
  CATEGORY.office.str,
];
const PARTICLE_SIZE = 8;

export interface ConfettiConfig {
  count?: number;
  palette?: ReadonlyArray<string>;
  /** 분사 반경 (기본 120). */
  radius?: number;
}

function hexToNum(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

export function confettiBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cfg: ConfettiConfig = {},
): void {
  const count = cfg.count ?? DEFAULT_COUNT;
  const palette = cfg.palette ?? DEFAULT_PALETTE;
  const radius = cfg.radius ?? 120;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = radius * (0.6 + Math.random() * 0.4);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20; // 살짝 위쪽 가중.
    const colorStr = palette[i % palette.length] ?? '#ffffff';
    const color = hexToNum(colorStr);

    const piece = scene.add.rectangle(x, y, PARTICLE_SIZE, PARTICLE_SIZE, color, 1);
    piece.setDepth(ELEVATION.toast);
    piece.setRotation(Math.random() * Math.PI);

    const targetX = x + dx;
    const targetY = y + dy + 80; // 마지막에 살짝 떨어짐.

    scene.tweens.add({
      targets: piece,
      x: targetX,
      y: targetY,
      alpha: 0,
      rotation: piece.rotation + (Math.random() - 0.5) * Math.PI * 2,
      scale: 0.4,
      duration: MOTION.duration.bloom,
      ease: MOTION.ease.exit,
      onComplete: () => piece.destroy(),
    });
  }
}
