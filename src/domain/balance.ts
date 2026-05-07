/**
 * 밸런스 v0.1 상수. 모든 수치는 docs/BALANCE.md의 표와 1:1 대응.
 * 변경 시 문서도 함께 갱신할 것.
 */
import type { GenreId, PromoTier, ThemeId } from './types';

export const BALANCE = {
  /** 정배치 직원 1명이 1주에 내는 진행도(%) — 3명 정배치 시 약 +10.5%/주 (목표 +9~11%). */
  matchedProgressPerWeek: 3.5,
  /** 오배치 시 진행 기여 배수. */
  mismatchContribFactor: 0.5,
  /** 오배치 직원 1명당 추가 BugDebt. */
  mismatchBugDebt: 2,
  /** 매주 기본 BugDebt 증가. */
  baseBugDebtPerWeek: 6,
  /** 야근 ON 시 BugDebt 가산(+4). */
  crunchBugDebtBonus: 4,
  /** 야근 ON 시 Progress 배수. */
  crunchProgressMul: 1.18,
  /** 폴리싱 1주당 BugDebt 변화량(음수). */
  polishBugDebtDelta: -12,
  /** 연체 1주당 골드 페널티(음수). */
  overrunGoldPenalty: -8,
  /** G1 튜토리얼 목표 주 수. */
  tutorialWeeksTarget: 10,
  /** Appeal — 정배치 슬롯별 주당 기여(점). 오배치는 mismatchContribFactor=0.5 곱. */
  appealBySlot: {
    planning: 0.6,
    graphics: 1.5,
    sound: 1.2,
    programming: 0.2,
  },
  /** 사운드 슬롯이 비어 있을 때 매 주 Appeal 페널티. */
  appealSoundEmpty: -0.3,
  /** 야근 ON 시 Appeal 보너스(폴리싱 분위기). */
  appealCrunchBonus: 0.4,
  /** 리뷰 점수에서 Appeal 가중. score += round(appeal * factor). */
  appealReviewFactor: 0.3,
  /** Appeal 활성 시 리뷰 base score (튜토리얼은 80, 2작부터 70 + appeal). */
  appealEnabledBaseScore: 70,
} as const;

/**
 * 장르/테마 보정. 튜토리얼 G1+T1은 baseline(1.0).
 * 곱연산으로 advanceWeek에 적용 — progressMul, bugMul 모두 (genreMul × themeMul) 형태.
 * 야근(crunch) 보너스/페널티는 별도 가산.
 */
export const GENRE_MOD: Readonly<Record<GenreId, { progressMul: number; bugMul: number }>> = {
  G1: { progressMul: 1.0, bugMul: 1.0 },
  /** G2 — 디버깅 부담↑ */
  G2: { progressMul: 0.9, bugMul: 1.2 },
  /** G3 — 그래픽 부담↓, 진행 약간 빠름 */
  G3: { progressMul: 1.05, bugMul: 0.95 },
};

export const THEME_MOD: Readonly<Record<ThemeId, { progressMul: number; bugMul: number }>> = {
  T1: { progressMul: 1.0, bugMul: 1.0 },
  /** T2 — 회의가 레벨이다: 진행 살짝 느리지만 버그 적음 */
  T2: { progressMul: 0.95, bugMul: 0.9 },
  /** T3 — 버그한테 잡아먹힘: 버그 ↑ */
  T3: { progressMul: 1.0, bugMul: 1.1 },
};

/** 홍보 — BALANCE.md §7. cost는 출시 직전 차감, revenueMul은 매출에 곱, reviewBonus는 score에 가산. */
export const PROMO: Readonly<
  Record<PromoTier, { cost: number; revenueMul: number; reviewBonus: number; label: string }>
> = {
  none: { cost: 0, revenueMul: 1.0, reviewBonus: 0, label: '없음' },
  small: { cost: 40, revenueMul: 1.08, reviewBonus: 2, label: '소' },
  medium: { cost: 100, revenueMul: 1.18, reviewBonus: 5, label: '중' },
};
