/**
 * 이벤트 카테고리 일러스트(11종) — 모달 헤더 배너로 사용.
 * 각 SVG는 240×80 banner 비율. EventCategory(A~K)와 1:1.
 */
import Phaser from 'phaser';

import type { EventCategory } from '@/domain/events';

const ASSET_BASE = '/assets/event-categories';

export const EVENT_CATEGORY_TEXTURE: Readonly<Record<EventCategory, string>> = {
  A: 'evcat-A',
  B: 'evcat-B',
  C: 'evcat-C',
  D: 'evcat-D',
  E: 'evcat-E',
  F: 'evcat-F',
  G: 'evcat-G',
  H: 'evcat-H',
  I: 'evcat-I',
  J: 'evcat-J',
  K: 'evcat-K',
};

const NATIVE_W = 480;
const NATIVE_H = 160;

export function preloadEventCategories(scene: Phaser.Scene): void {
  for (const [cat, key] of Object.entries(EVENT_CATEGORY_TEXTURE)) {
    scene.load.svg(key, `${ASSET_BASE}/${cat}.svg`, { width: NATIVE_W, height: NATIVE_H });
  }
}
