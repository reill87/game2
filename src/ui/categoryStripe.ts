/**
 * 카드 좌측 카테고리 stripe — 도메인을 시각적으로 구분.
 *
 * 사용:
 *   addCategoryStripe(scene, x, y, h, 'rnd')
 *   layer.add(stripe)
 *
 * 권장 두께 4px, 카드 좌측 가장자리에 정확히 맞춤.
 */
import Phaser from 'phaser';
import { CATEGORY, type CategoryKey, RADIUS } from '@/theme';

const STRIPE_W = 4;

/**
 * 카드 좌측에 그리는 4px 시그니처 색 stripe.
 * @param x 카드 좌측 x
 * @param y 카드 상단 y
 * @param h 카드 높이
 */
export function addCategoryStripe(
  scene: Phaser.Scene,
  x: number,
  y: number,
  h: number,
  category: CategoryKey,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(CATEGORY[category].num, 1);
  g.fillRoundedRect(x, y, STRIPE_W, h, { tl: RADIUS.sm, bl: RADIUS.sm, tr: 0, br: 0 });
  return g;
}

/**
 * 모달 헤더 상단 띠 — 카테고리 시그니처 색을 모달 식별자로 강하게 표시.
 * @param x 모달 좌측 x
 * @param y 모달 상단 y
 * @param w 모달 너비
 */
export function addCategoryHeaderBand(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  category: CategoryKey,
  thickness = 3,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(CATEGORY[category].num, 0.9);
  g.fillRoundedRect(x, y, w, thickness, { tl: RADIUS.lg, tr: RADIUS.lg, bl: 0, br: 0 });
  return g;
}
