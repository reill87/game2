/**
 * 씬 공용 시각 토큰 — "Studio Night" 팔레트 + Phase 1 디자인 시스템.
 *
 * # 사용 규칙
 *  - **신규 색은 반드시 이 파일에 추가하고 키로만 참조.** 씬 코드에 0xRRGGBB 직접 작성 금지.
 *  - Phaser Graphics는 number(0xRRGGBB), Phaser Text.color는 string('#RRGGBB')을 요구해
 *    같은 색이라도 두 형태로 둔다. 동일한 색은 hex가 같도록 같이 갱신할 것.
 *  - 의미가 같은 색은 한 토큰으로 묶고, 컴포넌트에 따라 다르면 별도 토큰을 둘 것.
 *
 * # 토큰 카테고리
 *  - `COLOR`        — Phaser Graphics용 number 색.
 *  - `TEXT_COLOR`   — Phaser Text용 string 색.
 *  - `TINT`         — Phaser Image setTint용 number 색.
 *  - `CATEGORY`     — R&D/시설/시장/인수/메일 등 카테고리별 시그니처 색.
 *  - `SPACING`      — 4/8/12/16/24/32/48 grid.
 *  - `TYPE`         — fontSize × weight 매트릭스. Phaser Text style에 그대로 spread.
 *  - `RADIUS`       — 모서리 반경 (sm/md/lg/pill).
 *  - `ELEVATION`    — 그림자/depth 단계 (Phaser는 별도 그림자 없으므로 alpha+offset 활용).
 *  - `MOTION`       — 트윈 duration/ease.
 *
 * 한글 본문 가독성을 위해 시스템 한글 폰트 우선, Pretendard 폴백.
 */

export const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif';

// ──────────────────────────────────────────────────────────────────
// COLOR — Phaser Graphics (number)
// ──────────────────────────────────────────────────────────────────
export const COLOR = {
  // ── 표면(surface) ─────────────────────────────────────────────
  /** 기본 패널 배경. 카드·게이지 컨테이너 등. */
  panel: 0x2a2a38,
  /** 패널 테두리. */
  panelStroke: 0x4a4a62,
  /** 비활성/비어있는 카드 배경. */
  panelEmpty: 0x20202a,
  /** 게이지 트랙 배경. */
  gaugeBg: 0x1a1a22,
  /** 모달 overlay scrim. */
  scrim: 0x000000,

  // ── 강조(accent) — primary ────────────────────────────────────
  /** 선택 강조 테두리. */
  selected: 0x4f6fff,
  /** Primary CTA 버튼 배경. */
  btn: 0x4f6fff,
  /** Primary 버튼 눌림. */
  btnDown: 0x3d58cc,
  /** 진행 게이지 채움. */
  gaugeFillProgress: 0x4f6fff,

  // ── 강조(accent) — secondary / disabled ───────────────────────
  /** 보조 버튼 배경(폴리싱 등 비파괴 액션). */
  btnSecondary: 0x3a3a48,
  /** 보조 버튼 눌림. */
  btnSecondaryDown: 0x2a2a30,
  /** 비활성 버튼 배경. */
  btnDisabled: 0x3a3a48,
  /** Danger 버튼 (파산·삭제 등 비가역). */
  btnDanger: 0xe55f5f,
  btnDangerDown: 0xb84545,

  // ── 상태(state) ───────────────────────────────────────────────
  /** 정배치·성공 표시. */
  matchOk: 0x3ec07b,
  /** 오배치·경고·BugDebt 게이지 채움. */
  matchBad: 0xe55f5f,
  gaugeFillBug: 0xe55f5f,
} as const;

// ──────────────────────────────────────────────────────────────────
// TEXT_COLOR — Phaser Text (string)
// ──────────────────────────────────────────────────────────────────
export const TEXT_COLOR = {
  /** 본문. */
  primary: '#f2f2f7',
  /** 라벨·보조 설명. */
  dim: '#9b9bb0',
  /** 더 흐린 보조 설명 (메타 정보). */
  muted: '#6a6a78',
  /** 비활성 버튼 글자. */
  disabled: '#6a6a78',
  /** 정배치·매출+ 등 긍정. */
  ok: '#3ec07b',
  /** 오배치·BugDebt 위험 등 부정. */
  bad: '#e55f5f',
  /** 연체·주의. */
  warn: '#f2c94c',
} as const;

// ──────────────────────────────────────────────────────────────────
// TINT — Phaser Image setTint (number)
// ──────────────────────────────────────────────────────────────────
/**
 * Phaser.GameObjects.Image.setTint() 등에 쓰는 number 형태.
 * TEXT_COLOR와 같은 값을 가진 숫자 버전으로, 단색 SVG 아이콘에 의미 색을 입힐 때 사용.
 */
export const TINT = {
  primary: 0xf2f2f7,
  dim: 0x9b9bb0,
  muted: 0x6a6a78,
  ok: 0x3ec07b,
  bad: 0xe55f5f,
  warn: 0xf2c94c,
} as const;

// ──────────────────────────────────────────────────────────────────
// CATEGORY — 카테고리별 시그니처 색
// ──────────────────────────────────────────────────────────────────
/**
 * 도메인 카테고리별 시그니처 컬러.
 * 카드 헤더 stripe, 모달 헤더 띠, 탭 active 인디케이터 등에 사용.
 *
 * 사용 예: `COLOR_NUM`(Graphics) + `COLOR_STR`(Text·CSS) 페어.
 */
export const CATEGORY = {
  rnd:        { num: 0x06b6d4, str: '#06b6d4', label: 'R&D 연구' },         // cyan
  facility:   { num: 0xa855f7, str: '#a855f7', label: '회사 시설' },        // purple
  market:     { num: 0x14b8a6, str: '#14b8a6', label: '글로벌 시장' },      // teal
  acquisition:{ num: 0xd97706, str: '#d97706', label: '자회사 인수' },      // amber
  mail:       { num: 0xec4899, str: '#ec4899', label: '메일' },             // pink
  hire:       { num: 0x4f6fff, str: '#4f6fff', label: '채용' },             // blue (primary)
  office:     { num: 0xfbbf24, str: '#fbbf24', label: '사옥' },             // yellow
  rival:      { num: 0xff5722, str: '#ff5722', label: '경쟁사' },           // orange
  ending:     { num: 0xd946ef, str: '#d946ef', label: '엔딩' },             // magenta
} as const;

export type CategoryKey = keyof typeof CATEGORY;

// ──────────────────────────────────────────────────────────────────
// SPACING — 4 베이스 grid
// ──────────────────────────────────────────────────────────────────
/**
 * 모든 padding/gap/margin은 이 토큰만 사용. 임의 숫자(13, 22 등) 금지.
 * 4 단위 베이스라인 grid → Korean 한글 줄간격(line-height 1.5)과도 호환.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

// ──────────────────────────────────────────────────────────────────
// TYPE — fontSize × weight 스케일
// ──────────────────────────────────────────────────────────────────
/**
 * Phaser Text style에 spread해 쓰도록 partial style 객체로 정의.
 * `...TYPE.body` 한 줄로 fontFamily/fontSize/fontStyle 모두 적용.
 *
 * 스케일 (모바일 logical 720px 기준):
 *  - micro: 12  메타·툴팁
 *  - meta:  14  보조 정보·뱃지
 *  - body:  17  기본 본문
 *  - lead:  22  중요 라벨·서브헤더
 *  - h2:    28  섹션 타이틀
 *  - h1:    36  스크린 타이틀
 *  - hero:  48  엔딩 헤드라인
 */
type TypeStyle = {
  fontFamily: string;
  fontSize: string;
  fontStyle?: 'normal' | 'bold' | 'italic';
};

const make = (size: number, weight: 'normal' | 'bold' = 'normal'): TypeStyle => ({
  fontFamily: FONT_STACK,
  fontSize: `${size}px`,
  fontStyle: weight,
});

export const TYPE = {
  micro:     make(12),
  microBold: make(12, 'bold'),
  meta:      make(14),
  metaBold:  make(14, 'bold'),
  body:      make(17),
  bodyBold:  make(17, 'bold'),
  lead:      make(22),
  leadBold:  make(22, 'bold'),
  h2:        make(28, 'bold'),
  h1:        make(36, 'bold'),
  hero:      make(48, 'bold'),
} as const;

export type TypeKey = keyof typeof TYPE;

// ──────────────────────────────────────────────────────────────────
// RADIUS — 모서리 반경
// ──────────────────────────────────────────────────────────────────
export const RADIUS = {
  /** 작은 칩, 배지. */
  sm: 6,
  /** 기본 버튼·카드. */
  md: 10,
  /** 큰 패널·모달. */
  lg: 14,
  /** 완전 둥근(필터 칩, avatar). */
  pill: 999,
} as const;

// ──────────────────────────────────────────────────────────────────
// ELEVATION — z축 표현 (Phaser depth + alpha)
// ──────────────────────────────────────────────────────────────────
/**
 * Phaser는 CSS 그림자가 없어 depth 값으로 stacking 우선순위만 표현.
 * 모달은 100~200, 토스트는 300, 디버그 오버레이는 1000.
 *
 * 카드의 시각적 elevation은 `panelEmpty` vs `panel` 색상 차로 표현.
 */
export const ELEVATION = {
  base: 0,
  card: 10,
  popover: 50,
  modal: 100,
  modalHigh: 200,
  toast: 300,
  debug: 1000,
} as const;

// ──────────────────────────────────────────────────────────────────
// MOTION — 트윈 duration·ease
// ──────────────────────────────────────────────────────────────────
/**
 * 모션 일관성을 위한 토큰. Phaser tweens.add({ duration: MOTION.fast })로 사용.
 *
 * - instant: 즉시 (피드백 없음)
 * - fast:    100ms — 버튼 hover, 색 전환
 * - base:    200ms — 카드 enter, fade
 * - slow:    400ms — 모달 slide-up, 큰 전환
 * - bloom:   800ms — 셀러브레이션 (구매 confetti 등)
 */
export const MOTION = {
  duration: {
    instant: 0,
    fast: 100,
    base: 200,
    slow: 400,
    bloom: 800,
  },
  ease: {
    /** 기본 — 자연스러운 가감속. */
    standard: 'Cubic.easeInOut',
    /** 진입 — 빠르게 가속. */
    enter: 'Quad.easeOut',
    /** 퇴장 — 빠르게 감속. */
    exit: 'Quad.easeIn',
    /** 셀러브레이션 — 살짝 튀는 느낌. */
    bounce: 'Back.easeOut',
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// 헬퍼 — number ↔ string 색 변환
// ──────────────────────────────────────────────────────────────────

/** Phaser Graphics number(0xRRGGBB) → CSS string('#RRGGBB'). */
export function numToHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** CSS string('#RRGGBB') → Phaser Graphics number(0xRRGGBB). */
export function hexToNum(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}
