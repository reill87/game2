import Phaser from 'phaser';
import { COLOR, TEXT_COLOR, TINT } from '@/theme';

/** 컨디션 값(0~100)을 의미 색으로 매핑 — 70+ 양호, 40+ 주의, 그 미만 위험. */
export function conditionTint(value: number): number {
  if (value >= 70) return TINT.ok;
  if (value >= 40) return TINT.warn;
  return TINT.bad;
}

/** Text 객체에 쓰는 컨디션 의미 색. */
export function conditionTextColor(value: number): string {
  if (value >= 70) return TEXT_COLOR.ok;
  if (value >= 40) return TEXT_COLOR.warn;
  return TEXT_COLOR.bad;
}

/**
 * (x, y, w, h) 영역에 0~100 비율로 컬러 채움. 트랙 배경은 호출 측에서 한 번 그려두고
 * 매 프레임 채움만 redraw 한다고 가정.
 */
export function drawConditionFill(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
): void {
  g.clear();
  const ratio = Math.max(0, Math.min(100, value)) / 100;
  const fillW = ratio * w;
  if (fillW <= 0) return;
  g.fillStyle(conditionTint(value), 1);
  g.fillRect(x, y, fillW, h);
}

/** (옵션) 정적 트랙 배경. 한 번만 그릴 때 호출. */
export function drawConditionTrack(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle(COLOR.gaugeBg, 1);
  g.fillRect(x, y, w, h);
}
