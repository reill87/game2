/**
 * Card factory — 패널 + 카테고리 stripe + (옵션) 헤더 라벨.
 *
 * 카드를 만들 때 매번 makePanel + addCategoryStripe + 정렬 코드를 쓰는 것을 표준화.
 *
 * 사용:
 *   const c = createCard(this, {
 *     x: 100, y: 200, w: 560, h: 132,
 *     category: 'rnd',
 *     dim: false,
 *   });
 *   layer.add([c.panel, c.stripe]);
 *
 *   // 카드 안에 자식 추가 시:
 *   layer.add(this.add.text(c.contentX, c.contentY, '...'));
 */
import Phaser from 'phaser';
import { COLOR } from '@/theme';
import { addCategoryStripe } from '../categoryStripe';
import { makePanel } from '@/util/ui';
import type { CategoryKey } from '@/theme';

export interface CardConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 좌측 stripe 색. 미지정 시 stripe 없음. */
  category?: CategoryKey;
  /** 비활성/잠금 상태 — 더 어두운 배경 사용. */
  dim?: boolean;
  /** 패널 테두리 표시 (기본 false). */
  border?: boolean;
}

export interface CardHandle {
  panel: Phaser.GameObjects.NineSlice;
  stripe: Phaser.GameObjects.Graphics | null;
  /** 카드 내부 컨텐츠가 시작될 좌상단 (stripe 폭 + 12px 패딩 적용). */
  contentX: number;
  contentY: number;
  contentW: number;
  contentH: number;
  destroy(): void;
}

const STRIPE_W = 4;
const PADDING = 12;

export function createCard(scene: Phaser.Scene, cfg: CardConfig): CardHandle {
  const fillColor = cfg.dim ? COLOR.panelEmpty : COLOR.panel;
  const panel = makePanel(scene, cfg.x, cfg.y, cfg.w, cfg.h, fillColor, cfg.border ?? false);

  const stripe = cfg.category ? addCategoryStripe(scene, cfg.x, cfg.y, cfg.h, cfg.category) : null;

  const stripeOffset = cfg.category ? STRIPE_W + 4 : 0;

  return {
    panel,
    stripe,
    contentX: cfg.x + stripeOffset + PADDING,
    contentY: cfg.y + PADDING,
    contentW: cfg.w - stripeOffset - PADDING * 2,
    contentH: cfg.h - PADDING * 2,
    destroy(): void {
      panel.destroy();
      stripe?.destroy();
    },
  };
}
