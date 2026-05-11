/**
 * Badge — 작은 칩(상태/티어/카테고리 라벨).
 *
 * 사용:
 *   const b = createBadge(scene, x, y, { label: 'T5', tone: 'rnd' });
 *   container.add([b.bg, b.text]);
 */
import Phaser from 'phaser';
import { CATEGORY, type CategoryKey, COLOR, RADIUS, TEXT_COLOR, TYPE } from '@/theme';

export type BadgeTone = CategoryKey | 'ok' | 'warn' | 'bad' | 'neutral';

export interface BadgeConfig {
  label: string;
  tone?: BadgeTone;
  /** size sm(20h)/md(24h). */
  size?: 'sm' | 'md';
}

export interface BadgeHandle {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  destroy(): void;
}

function toneColors(tone: BadgeTone): { bg: number; text: string } {
  if (tone === 'ok')      return { bg: 0x1a3a25, text: TEXT_COLOR.ok };
  if (tone === 'warn')    return { bg: 0x3a2e10, text: TEXT_COLOR.warn };
  if (tone === 'bad')     return { bg: 0x3a1a1a, text: TEXT_COLOR.bad };
  if (tone === 'neutral') return { bg: COLOR.panelEmpty, text: TEXT_COLOR.dim };
  // CategoryKey
  return { bg: CATEGORY[tone].num, text: TEXT_COLOR.primary };
}

export function createBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cfg: BadgeConfig,
): BadgeHandle {
  const tone = cfg.tone ?? 'neutral';
  const size = cfg.size ?? 'sm';
  const h = size === 'sm' ? 20 : 24;
  const padX = size === 'sm' ? 8 : 10;
  const style = size === 'sm' ? TYPE.microBold : TYPE.metaBold;
  const { bg: bgColor, text: textColor } = toneColors(tone);

  // Phantom text로 폭 측정 → 진짜 텍스트와 배경 그림.
  const text = scene.add.text(0, 0, cfg.label, { ...style, color: textColor }).setOrigin(0, 0.5);
  const w = text.width + padX * 2;
  const cy = y + h / 2;
  text.setX(x + padX);
  text.setY(cy);

  const bg = scene.add.graphics();
  bg.fillStyle(bgColor, tone === 'ok' || tone === 'warn' || tone === 'bad' || tone === 'neutral' ? 1 : 0.18);
  bg.fillRoundedRect(x, y, w, h, RADIUS.pill);
  // category tone은 채도 낮은 fill에 stroke로 강조.
  if (tone !== 'ok' && tone !== 'warn' && tone !== 'bad' && tone !== 'neutral') {
    bg.lineStyle(1, bgColor, 0.9);
    bg.strokeRoundedRect(x, y, w, h, RADIUS.pill);
  }
  // Layer 순서: bg → text.
  bg.setDepth(text.depth - 1);

  return {
    bg, text,
    destroy(): void {
      bg.destroy();
      text.destroy();
    },
  };
}
