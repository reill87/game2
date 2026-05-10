/**
 * 일러스트 자산 매핑 — 사옥 단계별 배경.
 *
 * 추가 시:
 *  1) public/assets/illustrations/<file>.svg 추가
 *  2) 아래 ILLUSTRATIONS에 키 등록
 *  3) BootScene.preload가 자동 로드
 */
import Phaser from 'phaser';
import type { OfficeLevel } from './domain/types';

const ASSET_BASE = '/assets/illustrations';

/** 사옥 단계 → 일러스트 텍스처 키. */
export const OFFICE_ILLUSTRATION: Readonly<Record<OfficeLevel, string>> = {
  1: 'illust-office-1',
  2: 'illust-office-2',
  3: 'illust-office-3',
  4: 'illust-office-4',
  5: 'illust-office-5',
  6: 'illust-office-6',
};

const FILES: ReadonlyArray<readonly [string, string]> = [
  [OFFICE_ILLUSTRATION[1], 'office_stage_1.svg'],
  [OFFICE_ILLUSTRATION[2], 'office_stage_2.svg'],
  [OFFICE_ILLUSTRATION[3], 'office_stage_3.svg'],
  [OFFICE_ILLUSTRATION[4], 'office_stage_4.svg'],
  [OFFICE_ILLUSTRATION[5], 'office_stage_5.svg'],
  [OFFICE_ILLUSTRATION[6], 'office_stage_6.svg'],
];

/**
 * 원본 SVG 디자인 사이즈. 실제 표시 크기는 사용 측에서 setDisplaySize.
 * 배너 비율(3.2:1)로 office 패널 상단 풀-와이드 사용에 맞춤.
 * Phaser SVG loader는 width/height만큼 미리 렌더하므로 표시 폭(≈630)에 가까운
 * 640으로 잡아 업스케일 흐림을 줄인다.
 */
const NATIVE_W = 640;
const NATIVE_H = 200;

export function preloadIllustrations(scene: Phaser.Scene): void {
  for (const [key, file] of FILES) {
    scene.load.svg(key, `${ASSET_BASE}/${file}`, { width: NATIVE_W, height: NATIVE_H });
  }
}
