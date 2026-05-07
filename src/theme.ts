/**
 * 씬 공용 시각 토큰 — "Studio Night" 팔레트.
 *
 * 사용 규칙:
 *  - **신규 색은 반드시 이 파일에 추가하고 키로만 참조.** 씬 코드에 0xRRGGBB 직접 작성 금지.
 *  - Phaser Graphics는 number(0xRRGGBB), Phaser Text.color는 string('#RRGGBB')을 요구해
 *    같은 색이라도 두 형태로 둔다. 동일한 색은 hex가 같도록 같이 갱신할 것.
 *  - 의미가 같은 색은 한 토큰으로 묶고, 컴포넌트에 따라 다르면 별도 토큰을 둘 것.
 *
 * 팔레트 anchor (전체 명도 곡선이 어두운 파랑→회색→틴트):
 *  bg.deepest    #0e0e12   (앱 배경, body)
 *  bg.gauge      #1a1a22   (게이지·드롭존 배경)
 *  bg.empty      #20202a   (비활성 카드/슬롯)
 *  bg.surface    #2a2a38   (기본 패널)
 *  bg.disabled   #3a3a48   (비활성 버튼)
 *  bg.surfaceDn  #2a2a30   (눌린 보조 버튼)
 *  border        #4a4a62   (패널 테두리)
 *  text.dim      #6a6a78 / #9b9bb0  (라벨 / 보조 텍스트)
 *  text.body     #f2f2f7   (본문)
 *
 *  accent.primary    #4f6fff   (CTA·강조·진행 게이지)
 *  accent.primaryDn  #3d58cc   (눌린 CTA)
 *  state.ok          #3ec07b   (정배치·성공·★4–5)
 *  state.bad         #e55f5f   (오배치·실패·★1–2 / BugDebt 게이지)
 *  state.warn        #f2c94c   (연체·★3 경계 등 주의)
 *
 * 한글 본문 가독성을 위해 시스템 한글 폰트 우선, Pretendard 폴백.
 */

export const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif';

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

  // ── 상태(state) ───────────────────────────────────────────────
  /** 정배치·성공 표시. */
  matchOk: 0x3ec07b,
  /** 오배치·경고·BugDebt 게이지 채움. */
  matchBad: 0xe55f5f,
  gaugeFillBug: 0xe55f5f,
} as const;

export const TEXT_COLOR = {
  /** 본문. */
  primary: '#f2f2f7',
  /** 라벨·보조 설명. */
  dim: '#9b9bb0',
  /** 비활성 버튼 글자. */
  disabled: '#6a6a78',
  /** 정배치·매출+ 등 긍정. */
  ok: '#3ec07b',
  /** 오배치·BugDebt 위험 등 부정. */
  bad: '#e55f5f',
  /** 연체·주의. */
  warn: '#f2c94c',
} as const;
