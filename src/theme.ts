/**
 * 씬 공용 시각 토큰. 새 색이 필요해지면 여기에 추가하고 씬은 키만 참조.
 * Phaser Graphics는 0xRRGGBB(number), Text.color는 '#RRGGBB'(string)을 받기에 두 형태 모두 둔다.
 */
export const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif';

export const COLOR = {
  panel: 0x2a2a38,
  panelStroke: 0x4a4a62,
  panelEmpty: 0x20202a,
  selected: 0x4f6fff,
  matchOk: 0x3ec07b,
  matchBad: 0xe55f5f,
  btn: 0x4f6fff,
  btnDown: 0x3d58cc,
  btnDisabled: 0x3a3a48,
  btnSecondary: 0x3a3a48,
  btnSecondaryDown: 0x2a2a30,
  gaugeBg: 0x1a1a22,
  gaugeFillProgress: 0x4f6fff,
  gaugeFillBug: 0xe55f5f,
} as const;

export const TEXT_COLOR = {
  primary: '#f2f2f7',
  dim: '#9b9bb0',
  ok: '#3ec07b',
  bad: '#e55f5f',
  warn: '#f2c94c',
  disabled: '#6a6a78',
} as const;
