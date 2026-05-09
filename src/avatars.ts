/**
 * 직군별 직원 아바타 — 80×80 chibi 스타일.
 * 표정 변화는 별도 텍스처 대신 morale 기반 ring 색(theme.TINT.ok/warn/bad)으로 표현.
 */
import Phaser from 'phaser';

import type { Job } from '@/domain/types';

const ASSET_BASE = '/assets/avatars';

export const AVATAR_KEY: Readonly<Record<Job, string>> = {
  planner: 'avatar-planner',
  designer: 'avatar-designer',
  programmer: 'avatar-programmer',
  qa: 'avatar-qa',
  marketing: 'avatar-marketing',
  data: 'avatar-data',
};

const FILES: ReadonlyArray<readonly [string, string]> = [
  [AVATAR_KEY.planner, 'planner.svg'],
  [AVATAR_KEY.designer, 'designer.svg'],
  [AVATAR_KEY.programmer, 'programmer.svg'],
  [AVATAR_KEY.qa, 'qa.svg'],
  [AVATAR_KEY.marketing, 'marketing.svg'],
  [AVATAR_KEY.data, 'data.svg'],
];

/** SVG는 80×80 native — 카드는 보통 48~64로 표시. preload는 native 그대로. */
const NATIVE = 80;

export function preloadAvatars(scene: Phaser.Scene): void {
  for (const [key, file] of FILES) {
    scene.load.svg(key, `${ASSET_BASE}/${file}`, { width: NATIVE, height: NATIVE });
  }
}
