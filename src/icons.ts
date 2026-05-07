/**
 * 아이콘 키 + 의미 매핑.
 * SVG는 stroke="#fff"로 통일되어 있어, 사용 측에서 .setTint()로 의미 색을 입힌다.
 *
 * 추가 시:
 *  1) public/assets/icons/lucide/<name>.svg 추가 (24×24 viewBox, white stroke)
 *  2) 아래 ICONS 맵에 키 등록
 *  3) BootScene.preload가 자동으로 모두 로드
 */

export const ICONS = {
  /** 골드 (코인 형태). */
  coins: { key: 'icon-coins', file: 'coins.svg' },
  /** BugDebt. */
  bug: { key: 'icon-bug', file: 'bug.svg' },
  /** Progress (게이지/속도). */
  progress: { key: 'icon-progress', file: 'progress.svg' },
  /** Appeal (반짝). */
  sparkle: { key: 'icon-sparkle', file: 'sparkle.svg' },
  /** 주차 (캘린더). */
  calendar: { key: 'icon-calendar', file: 'calendar.svg' },
  /** 기획자/기획 슬롯 (전구). */
  lightbulb: { key: 'icon-lightbulb', file: 'lightbulb.svg' },
  /** 디자이너/그래픽 슬롯 (붓). */
  brush: { key: 'icon-brush', file: 'brush.svg' },
  /** 사운드 직군/슬롯 (음표). */
  music: { key: 'icon-music', file: 'music.svg' },
  /** 개발자/프로그래밍 슬롯 (꺽쇠). */
  code: { key: 'icon-code', file: 'code.svg' },
} as const;

export type IconName = keyof typeof ICONS;

export const ICON_DIR = '/assets/icons/lucide';
